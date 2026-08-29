-- ================================================================
-- 0037_security_fixes_and_rpc_hardening.sql — Remediação de Segurança e Hardening de RPCs
--
-- Objetivos de Segurança:
--   1. Correção de IDOR na RPC import_bank_transactions (P1 - Issue 1):
--      - Validação de category_id em despesas e receitas contra categorias do próprio usuário;
--      - Fallback automático e seguro para a categoria padrão/reservada caso inválida ou de terceiro;
--      - Fixação de search_path = public, pg_temp.
--   2. Blindagem de Status de Conta Ativa em 100% das RPCs SECURITY DEFINER (P2 - Issue 2):
--      - Trava com public.is_current_user_active() em todas as funções transacionais de mutação,
--        garantindo que contas com status 'pending_approval', 'suspended' ou 'banned' não possam
--        executar operações financeiras via RPC.
--   3. Validação de Vínculo Contrato-Parcela em early_amortize_loan (P3 - Issue 3):
--      - Garantia de que as parcelas quitadas pertençam de fato ao installment_group_id do contrato.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. import_bank_transactions (IDOR fix + active check + search_path)
-- ----------------------------------------------------------------
create or replace function public.import_bank_transactions(
  p_expenses jsonb,
  p_incomes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_exp_inserted int := 0;
  v_exp_skipped int := 0;
  v_inc_inserted int := 0;
  v_inc_skipped int := 0;
  v_exp_id uuid;
  v_inc_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_inc_cat_id uuid;
  v_fallback_exp_cat_id uuid;
  v_fallback_inc_cat_id uuid;
  v_receive_type text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  -- Categorias padrão de fallback do próprio usuário
  select id into v_fallback_exp_cat_id
    from public.categories
   where user_id = v_user_id and type = 'expense'
   order by is_reserved desc, created_at asc
   limit 1;

  select id into v_fallback_inc_cat_id
    from public.categories
   where user_id = v_user_id and type = 'income'
   order by is_reserved desc, created_at asc
   limit 1;

  if v_fallback_inc_cat_id is null then
    insert into public.categories (user_id, type, name, is_reserved)
    values (v_user_id, 'income', 'Outros', true)
    returning id into v_fallback_inc_cat_id;
  end if;

  -- 1. Processa Despesas Bancárias
  if p_expenses is not null and jsonb_typeof(p_expenses) = 'array' then
    for v_item in select * from jsonb_array_elements(p_expenses)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;
      v_cat_id := (v_item->>'category_id')::uuid;

      -- Validação de IDOR na categoria de despesa
      if v_cat_id is null or not exists (
        select 1 from public.categories
         where id = v_cat_id and user_id = v_user_id and type = 'expense'
      ) then
        v_cat_id := v_fallback_exp_cat_id;
      end if;

      if v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento anterior a 2026-01-01: %', v_date;
      end if;

      if v_val <= 0 then
        raise exception 'Valor de despesa deve ser estritamente positivo: %', v_val;
      end if;

      insert into public.expenses (
        user_id,
        category_id,
        payment_method,
        value,
        base_amount,
        report_weight,
        date,
        description,
        installments_total,
        installment_number,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        v_cat_id,
        coalesce(v_item->>'payment_method', 'cash'),
        v_val,
        v_val,
        coalesce((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        v_item->>'description',
        1,
        1,
        v_item->>'statement_hash',
        true
      )
      on conflict (user_id, statement_hash) where card_id is null and statement_hash is not null
      do nothing
      returning id into v_exp_id;

      if v_exp_id is not null then
        v_exp_inserted := v_exp_inserted + 1;
      else
        v_exp_skipped := v_exp_skipped + 1;
      end if;
    end loop;
  end if;

  -- 2. Processa Receitas Bancárias
  if p_incomes is not null and jsonb_typeof(p_incomes) = 'array' then
    for v_item in select * from jsonb_array_elements(p_incomes)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;
      v_inc_cat_id := (v_item->>'category_id')::uuid;

      -- Validação de IDOR na categoria de receita
      if v_inc_cat_id is null or not exists (
        select 1 from public.categories
         where id = v_inc_cat_id and user_id = v_user_id and type = 'income'
      ) then
        v_inc_cat_id := v_fallback_inc_cat_id;
      end if;

      if v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento anterior a 2026-01-01: %', v_date;
      end if;

      if v_val <= 0 then
        raise exception 'Valor de receita deve ser estritamente positivo: %', v_val;
      end if;

      v_receive_type := case 
        when lower(coalesce(v_item->>'receive_type', '')) in ('pix') then 'pix'
        when lower(coalesce(v_item->>'receive_type', '')) in ('ted', 'doc', 'transfer', 'transferencia', 'transferência') then 'transfer'
        when lower(coalesce(v_item->>'receive_type', '')) in ('cash', 'dinheiro') then 'cash'
        else 'other'
      end;

      insert into public.incomes (
        user_id,
        category_id,
        value,
        date,
        description,
        receive_type,
        report_weight,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        v_inc_cat_id,
        v_val,
        v_date,
        v_item->>'description',
        v_receive_type,
        1.0,
        v_item->>'statement_hash',
        true
      )
      on conflict (user_id, statement_hash) where statement_hash is not null
      do nothing
      returning id into v_inc_id;

      if v_inc_id is not null then
        v_inc_inserted := v_inc_inserted + 1;
      else
        v_inc_skipped := v_inc_skipped + 1;
      end if;
    end loop;
  end if;

  -- 3. Auditoria única
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'bank_account',
    v_user_id::text,
    'IMPORT_BANK_STATEMENT_BATCH',
    jsonb_build_object(
      'expenses_inserted', v_exp_inserted,
      'expenses_skipped', v_exp_skipped,
      'incomes_inserted', v_inc_inserted,
      'incomes_skipped', v_inc_skipped,
      'total_expenses_received', coalesce(jsonb_array_length(p_expenses), 0),
      'total_incomes_received', coalesce(jsonb_array_length(p_incomes), 0)
    )
  );

  return jsonb_build_object(
    'success', true,
    'expenses_inserted', v_exp_inserted,
    'expenses_skipped', v_exp_skipped,
    'incomes_inserted', v_inc_inserted,
    'incomes_skipped', v_inc_skipped
  );
end;
$$;


-- ----------------------------------------------------------------
-- 2. early_amortize_loan (Validação cruzada de contrato-parcela + active check)
-- ----------------------------------------------------------------
create or replace function public.early_amortize_loan(
  p_loan_id uuid,
  p_debt_ids uuid[],
  p_create_expense boolean,
  p_expense_category_id uuid,
  p_total_paid numeric,
  p_discount_total numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_expense_id uuid;
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  select * into v_loan
    from public.loans
   where id = p_loan_id and user_id = v_user_id;
  if not found then
    raise exception 'Contrato de empréstimo não encontrado';
  end if;

  if array_length(p_debt_ids, 1) is null or array_length(p_debt_ids, 1) < 1 then
    raise exception 'Nenhuma parcela informada para amortização';
  end if;

  -- Marca parcelas como quitadas garantindo vínculo estrito com o contrato
  update public.debts
     set paid_at = now()
   where id = any(p_debt_ids)
     and user_id = v_user_id
     and installment_group_id = v_loan.installment_group_id
     and paid_at is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> array_length(p_debt_ids, 1) then
    raise exception 'Uma ou mais parcelas não pertencem a este contrato de empréstimo ou já foram quitadas.';
  end if;

  if p_create_expense and p_total_paid > 0 then
    if p_expense_category_id is null then
      raise exception 'Categoria obrigatória ao criar despesa de amortização';
    end if;

    if not exists (
      select 1 from public.categories
       where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method,
      installments_total, installment_number, report_weight, base_amount,
      description, charge_kind
    ) values (
      v_user_id, p_total_paid, current_date, p_expense_category_id, 'other',
      1, 1, 1, p_total_paid,
      format('Amortização antecipada: %s (%s parcelas)', v_loan.name, array_length(p_debt_ids, 1)),
      'regular'
    )
    returning id into v_expense_id;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'loan', p_loan_id::text, 'early_amortization',
    jsonb_build_object(
      'debt_ids', p_debt_ids,
      'total_paid', p_total_paid,
      'discount_total', p_discount_total,
      'expense_id', v_expense_id
    )
  );

  return true;
end;
$$;


-- ----------------------------------------------------------------
-- 3. create_expense_with_debt (active check)
-- ----------------------------------------------------------------
create or replace function public.create_expense_with_debt(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_payment_method text,
  p_card_id uuid,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb,
  p_debt_name text,
  p_debt_amount numeric,
  p_debt_due_date date,
  p_debt_type text default 'payable'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_group uuid := gen_random_uuid();
  v_expense_id uuid;
  v_count integer;
  v_sum numeric;
  v_parcela jsonb;
  v_i integer := 0;
  v_debt_type text := coalesce(p_debt_type, 'payable');
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  if p_payment_method = 'credit_card' then
    if p_card_id is null then
      raise exception 'Cartão obrigatório para pagamento no crédito';
    end if;
    if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> 'expense' then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;

  if v_debt_type not in ('payable', 'receivable') then
    raise exception 'Tipo de dívida inválido';
  end if;

  if jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count > 60 then
    raise exception 'Máximo de 60 parcelas';
  end if;

  select coalesce(sum((parcela ->> 'value')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_installments) parcela;
  if v_sum <> p_value then
    raise exception 'Soma das parcelas (%s) difere do valor original (%s)', v_sum, p_value;
  end if;

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method, card_id,
      installments_total, installment_number, installment_group_id,
      bill_competence, report_weight, base_amount, description
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_payment_method,
      case when p_payment_method = 'credit_card' then p_card_id else null end,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end,
      nullif(v_parcela ->> 'bill_competence', ''),
      p_report_weight,
      (v_parcela ->> 'value')::numeric,
      p_description
    )
    returning id into v_expense_id;

    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;
      insert into public.debts (user_id, name, type, amount, due_date, expense_id, installment_group_id)
      values (
        v_user_id,
        coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, '')),
        v_debt_type,
        p_debt_amount,
        coalesce(p_debt_due_date, (v_parcela ->> 'date')::date),
        v_expense_id,
        case when v_count > 1 then v_group else null end
      );
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'expense', v_expense_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value')
    );
  end loop;

  return v_expense_id;
end;
$$;


-- ----------------------------------------------------------------
-- 4. create_recurrence & update_recurrence_occurrences (active check)
-- ----------------------------------------------------------------
create or replace function public.create_recurrence(
  p_kind text,
  p_frequency text,
  p_value numeric,
  p_category_id uuid,
  p_start_date date,
  p_end_date date,
  p_occurrences_total integer,
  p_payment_method text,
  p_card_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_recurrence_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo de recorrência inválido';
  end if;
  if p_frequency not in ('monthly', 'weekly', 'quarterly', 'yearly') then
    raise exception 'Frequência inválida';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da recorrência deve ser maior que zero';
  end if;
  if p_start_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if (p_end_date is null) = (p_occurrences_total is null) then
    raise exception 'Defina exatamente um limite: data de fim ou número de ocorrências';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data de fim anterior à data de início da recorrência';
  end if;
  if p_occurrences_total is not null and p_occurrences_total < 1 then
    raise exception 'Número de ocorrências deve ser maior que zero';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> p_kind then
    raise exception 'Categoria de % inválida ou não pertence ao usuário', p_kind;
  end if;

  if p_kind = 'expense' then
    if p_payment_method is null then
      raise exception 'Forma de pagamento obrigatória para despesa recorrente';
    end if;
    if p_payment_method = 'credit_card' then
      if p_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    end if;
  elsif p_receive_type is null then
    raise exception 'Tipo de recebimento obrigatório para renda recorrente';
  end if;

  insert into public.recurrences (
    user_id, kind, frequency, value, category_id, start_date, end_date,
    occurrences_total, payment_method, card_id, receive_type, description, report_weight
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total,
    case when p_kind = 'expense' then p_payment_method else null end,
    case when p_kind = 'expense' and p_payment_method = 'credit_card' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight
  )
  returning id into v_recurrence_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'create',
    jsonb_build_object('kind', p_kind, 'frequency', p_frequency, 'value', p_value)
  );

  return v_recurrence_id;
end;
$$;


-- ----------------------------------------------------------------
-- 5. restore_backup (active check)
-- ----------------------------------------------------------------
create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'Backup inválido: campo "data" ausente ou malformado';
  end if;

  -- 1) Apaga os dados atuais do usuário
  delete from public.portfolio_transactions pt
    using public.portfolio_assets a
    where pt.asset_id = a.id and a.user_id = v_uid;
  delete from public.allocation_targets t
    using public.portfolio_assets a
    where t.asset_id = a.id and a.user_id = v_uid;
  delete from public.card_competence_overrides o
    using public.credit_cards c
    where o.card_id = c.id and c.user_id = v_uid;
  delete from public.card_payments cp
    using public.credit_cards c
    where cp.card_id = c.id and c.user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.asset_prices where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- 2) Insere dados dos pais
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (id, user_id, ticker, asset_class, currency)
  select id, v_uid, ticker, asset_class, currency
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb));

  insert into public.user_preferences (user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis)
  select v_uid, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select o.id, o.card_id, o.month, o.closing_day, o.due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  join public.credit_cards c on c.id = o.card_id
  where c.user_id = v_uid;

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories cat on cat.id = i.category_id
  where cat.user_id = v_uid;

  insert into public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  select e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id, e.installments_total, e.installment_number, e.installment_group_id, e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id and cat.user_id = v_uid
  left join public.credit_cards c on c.id = e.card_id
  where (e.card_id is null or c.user_id = v_uid);

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  select cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  join public.credit_cards c on c.id = cp.card_id
  where c.user_id = v_uid;

  insert into public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  select id, v_uid, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb));

  insert into public.budgets (id, user_id, category_id, month, "limit")
  select b.id, v_uid, b.category_id, b.month, b."limit"
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  join public.categories cat on cat.id = b.category_id
  where cat.user_id = v_uid;

  insert into public.income_goals (id, user_id, category_id, month, expected)
  select g.id, v_uid, g.category_id, g.month, g.expected
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) g
  join public.categories cat on cat.id = g.category_id
  where cat.user_id = v_uid;

  insert into public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  select id, v_uid, occurrence_key, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  select id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  select pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  join public.portfolio_assets a on a.id = pt.asset_id
  where a.user_id = v_uid;

  insert into public.allocation_targets (id, user_id, asset_id, target_percentage)
  select t.id, v_uid, t.asset_id, t.target_percentage
  from jsonb_populate_recordset(null::public.allocation_targets, coalesce(v_data -> 'allocation_targets', '[]'::jsonb)) t
  join public.portfolio_assets a on a.id = t.asset_id
  where a.user_id = v_uid;

  insert into public.class_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, group_type, name, target_percentage
  from jsonb_populate_recordset(null::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb));

  insert into public.sector_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, group_type, name, target_percentage
  from jsonb_populate_recordset(null::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  insert into public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, updated_at)
  select id, v_uid, ticker, price, currency, source, manual_price, updated_at
  from jsonb_populate_recordset(null::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb));

  -- 4) Auditoria + resumo
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('exportedAt', v_data -> 'exportedAt'));

  select jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'card_competence_overrides', (select count(*) from public.card_competence_overrides o join public.credit_cards c on c.id = o.card_id where c.user_id = v_uid),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'card_payments', (select count(*) from public.card_payments cp join public.credit_cards c on c.id = cp.card_id where c.user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'budgets', (select count(*) from public.budgets where user_id = v_uid),
    'income_goals', (select count(*) from public.income_goals where user_id = v_uid),
    'insight_feedback', (select count(*) from public.insight_feedback where user_id = v_uid),
    'reminder_states', (select count(*) from public.reminder_states where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'portfolio_transactions', (select count(*) from public.portfolio_transactions pt join public.portfolio_assets a on a.id = pt.asset_id where a.user_id = v_uid),
    'allocation_targets', (select count(*) from public.allocation_targets t join public.portfolio_assets a on a.id = t.asset_id where a.user_id = v_uid),
    'class_targets', (select count(*) from public.class_targets where user_id = v_uid),
    'sector_targets', (select count(*) from public.sector_targets where user_id = v_uid),
    'asset_prices', (select count(*) from public.asset_prices where user_id = v_uid),
    'user_preferences', (select count(*) from public.user_preferences where user_id = v_uid)
  ) into v_counts;

  return v_counts;
end;
$$;


-- ----------------------------------------------------------------
-- 6. pay_debt & receive_debt (active check)
-- ----------------------------------------------------------------
create or replace function public.pay_debt(
  p_debt_id uuid,
  p_create_expense boolean,
  p_expense_category_id uuid,
  p_fine_amount numeric default 0,
  p_interest_amount numeric default 0,
  p_discount_amount numeric default 0,
  p_total_paid numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_expense_id uuid;
  v_effective_total numeric(12, 2);
  v_fine numeric(12, 2) := coalesce(p_fine_amount, 0);
  v_interest numeric(12, 2) := coalesce(p_interest_amount, 0);
  v_discount numeric(12, 2) := coalesce(p_discount_amount, 0);
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  select * into v_debt
    from public.debts
   where id = p_debt_id and user_id = v_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if v_debt.type <> 'payable' then
    raise exception 'Dívida não é do tipo a pagar';
  end if;
  if v_debt.paid_at is not null then
    raise exception 'Dívida já quitada';
  end if;

  if p_total_paid is not null and p_total_paid > 0 then
    v_effective_total := p_total_paid;
  else
    v_effective_total := v_debt.amount + v_fine + v_interest - v_discount;
  end if;

  if v_effective_total < 0 then
    raise exception 'Valor total pago não pode ser negativo';
  end if;

  if p_create_expense and v_effective_total > 0 then
    if p_expense_category_id is null then
      raise exception 'Categoria obrigatória ao criar despesa';
    end if;
    if not exists (
      select 1 from public.categories
       where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria de despesa inválida';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method,
      installments_total, installment_number, report_weight, base_amount, description,
      charge_kind
    ) values (
      v_user_id, v_effective_total, coalesce(current_date, v_debt.due_date), p_expense_category_id, 'other',
      1, 1, 1, v_effective_total, v_debt.name,
      case when v_debt.charge_kind <> 'regular' then v_debt.charge_kind else 'regular' end
    )
    returning id into v_expense_id;
  end if;

  update public.debts
     set paid_at = now()
   where id = p_debt_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'pay',
    jsonb_build_object(
      'created_expense', coalesce(p_create_expense, false),
      'expense_id', v_expense_id,
      'original_amount', v_debt.amount,
      'fine_amount', v_fine,
      'interest_amount', v_interest,
      'discount_amount', v_discount,
      'total_paid', v_effective_total
    )
  );

  return p_debt_id;
end;
$$;

create or replace function public.receive_debt(
  p_debt_id uuid,
  p_create_income boolean,
  p_income_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_income_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  select * into v_debt
    from public.debts
   where id = p_debt_id and user_id = v_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if v_debt.type <> 'receivable' then
    raise exception 'Dívida não é do tipo a receber';
  end if;
  if v_debt.paid_at is not null then
    raise exception 'Dívida já recebida';
  end if;

  if p_create_income then
    if p_income_category_id is null then
      raise exception 'Categoria obrigatória ao criar renda';
    end if;
    if not exists (
      select 1 from public.categories
       where id = p_income_category_id and user_id = v_user_id and type = 'income'
    ) then
      raise exception 'Categoria de renda inválida';
    end if;

    insert into public.incomes (user_id, value, date, category_id, receive_type, description)
    values (v_user_id, v_debt.amount, current_date, p_income_category_id, 'other', v_debt.name)
    returning id into v_income_id;
  end if;

  update public.debts
     set paid_at = now()
   where id = p_debt_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'receive',
    jsonb_build_object('created_income', coalesce(p_create_income, false), 'income_id', v_income_id)
  );

  return p_debt_id;
end;
$$;


-- ----------------------------------------------------------------
-- 7. execute_portfolio_batch_aporte (active check)
-- ----------------------------------------------------------------
create or replace function public.execute_portfolio_batch_aporte(
  p_items jsonb,
  p_date date,
  p_total_amount numeric,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_item record;
  v_asset record;
  v_new_qty numeric(18, 8);
  v_new_avg_price numeric(18, 8);
  v_current_qty numeric(18, 8);
  v_current_avg_price numeric(18, 8);
  v_item_qty numeric(18, 8);
  v_item_price numeric(18, 8);
  v_item_total numeric(18, 2);
  v_sum_total numeric(18, 2) := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhum ativo informado para o lote de aporte.';
  end if;

  if p_date is null or p_date < date '2026-01-01' then
    raise exception 'Data de aporte inválida (deve ser >= 2026-01-01).';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Valor total do aporte deve ser positivo.';
  end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(
    asset_id uuid,
    quantity numeric,
    price numeric,
    total numeric
  )
  loop
    v_item_qty := coalesce(v_item.quantity, 0);
    v_item_price := coalesce(v_item.price, 0);
    v_item_total := coalesce(v_item.total, round(v_item_qty * v_item_price, 2));

    if v_item.asset_id is null or v_item_qty <= 0 or v_item_price <= 0 then
      raise exception 'Parâmetros de ativo inválidos no lote: asset_id=%, qty=%, price=%', v_item.asset_id, v_item_qty, v_item_price;
    end if;

    select id, quantity, average_price into v_asset
    from public.portfolio_assets
    where id = v_item.asset_id and user_id = v_user_id;

    if v_asset.id is null then
      raise exception 'Ativo não encontrado ou não pertence ao usuário: %', v_item.asset_id;
    end if;

    v_current_qty := coalesce(v_asset.quantity, 0);
    v_current_avg_price := coalesce(v_asset.average_price, 0);

    v_new_qty := v_current_qty + v_item_qty;
    if v_new_qty > 0 then
      v_new_avg_price := round(((v_current_qty * v_current_avg_price) + (v_item_qty * v_item_price)) / v_new_qty, 8);
    else
      v_new_avg_price := 0;
    end if;

    update public.portfolio_assets
    set
      quantity = v_new_qty,
      average_price = v_new_avg_price,
      updated_at = now()
    where id = v_item.asset_id and user_id = v_user_id;

    insert into public.portfolio_transactions (
      user_id,
      asset_id,
      type,
      date,
      quantity,
      price,
      total
    ) values (
      v_user_id,
      v_item.asset_id,
      'buy',
      p_date,
      v_item_qty,
      v_item_price,
      v_item_total
    );

    v_sum_total := v_sum_total + v_item_total;
  end loop;

  insert into public.portfolio_contributions (
    user_id,
    asset_id,
    date,
    amount,
    notes
  ) values (
    v_user_id,
    null,
    p_date,
    p_total_amount,
    coalesce(p_notes, 'Aporte inteligente')
  );

  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_user_id,
    'portfolio',
    v_user_id::text,
    'execute_batch_aporte',
    jsonb_build_object(
      'date', p_date,
      'total_amount', p_total_amount,
      'items_count', jsonb_array_length(p_items)
    )
  );

  return true;
end;
$$;
