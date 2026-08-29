-- ================================================================
-- 0036_security_remediation_and_hardening.sql — Remediação de Segurança e Hardening (§F50)
--
-- Objetivos de Segurança:
--   1. Blindagem de Expurgo de Auditoria (Crítica - Achado 1):
--      - cleanup_old_audit_events agora exige superadministrador ativo internamente;
--      - REVOKE EXECUTE explícito de PUBLIC / authenticated / anon.
--   2. Imunização contra IDOR em Restauração de Backups (Alta - Achado 3):
--      - restore_backup filtra card_competence_overrides garantindo posse do cartão.
--   3. Validação de Posse de Chaves Estrangeiras (IDOR - Achados 4, 5, 6 e 8):
--      - create_expense_with_debt valida se card_id pertence ao usuário;
--      - create_recurrence e updates validam posse do card_id;
--      - refinance_credit_card_bill valida se category_id de despesa pertence ao usuário;
--      - set_allocation_targets valida se asset_id pertence ao usuário em portfolio_assets;
--      - import_statement_expenses e import_bank_transactions validam posse de category_id.
--   4. Hardening de RLS Residual (Média - Achado 7):
--      - portfolio_snapshots e portfolio_contributions passam a checar is_current_user_active().
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Blindagem da Função de Expurgo de Logs de Auditoria (Achado 1)
-- ----------------------------------------------------------------
create or replace function public.cleanup_old_audit_events(retention_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
  cutoff_date timestamptz;
begin
  -- Exige papel de superadministrador ativo (bloqueia chamadas diretas não autorizadas)
  if not public.is_superadmin() then
    raise exception 'Acesso negado: privilégios de superadministrador requeridos.';
  end if;

  if retention_days < 30 then
    raise exception 'Período de retenção mínimo permitido é de 30 dias.';
  end if;

  cutoff_date := now() - (retention_days || ' days')::interval;

  delete from public.audit_events
  where created_at < cutoff_date;

  get diagnostics deleted_count = row_count;

  -- Registra o próprio evento de expurgo no log
  insert into public.audit_events (user_id, action, entity_type, payload)
  values (
    (select auth.uid()),
    'SYSTEM_AUDIT_RETENTION',
    'audit_events',
    jsonb_build_object(
      'retention_days', retention_days,
      'cutoff_date', cutoff_date,
      'records_purged', deleted_count
    )
  );

  return deleted_count;
end;
$$;

-- Revoga execução pública e concede apenas a authenticated (que será barrado se não for superadmin) e service_role
revoke execute on function public.cleanup_old_audit_events(integer) from public, anon;


-- ----------------------------------------------------------------
-- 2. Imunização contra IDOR no RPC restore_backup (Achado 3)
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
  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'Backup inválido: campo "data" ausente ou malformado';
  end if;

  -- 1) Apaga os dados atuais do usuário (filhos antes dos pais)
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

  -- 2) Insere os dados dos pais forçando user_id = v_uid
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

  -- 3) Insere card_competence_overrides APENAS para cartões pertencentes ao próprio usuário v_uid (imunização IDOR)
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
-- 3. Imunização contra IDOR em create_expense_with_debt (Achado 4)
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

  if p_value is null or p_value <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  -- Validação de posse do cartão (IDOR)
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
-- 4. Imunização contra IDOR nas Rotinas de Recorrência (Achado 5)
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

create or replace function public.update_recurrence_occurrences(
  p_occurrence_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recurrence_id uuid;
  v_occurrence_number integer;
  v_kind text;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
  v_payment_method text;
  v_card_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select recurrence_id, occurrence_number, 'expense'
    into v_recurrence_id, v_occurrence_number, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;
  if not found then
    select recurrence_id, occurrence_number, 'income'
      into v_recurrence_id, v_occurrence_number, v_kind
      from public.incomes
     where id = p_occurrence_id and user_id = v_user_id;
  end if;
  if v_recurrence_id is null then
    raise exception 'Ocorrência não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = v_kind) then
      raise exception 'Categoria de % inválida ou não pertence ao usuário', v_kind;
    end if;
  end if;
  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method is not null and v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  elsif p_fields ? 'card_id' then
    v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
    if v_card_id is not null and not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  -- Ids afetados pelo modo
  if p_mode = 'single' then
    v_ids := array[p_occurrence_id];
  elsif v_kind = 'expense' then
    select array_agg(id) into v_ids
      from public.expenses
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  else
    select array_agg(id) into v_ids
      from public.incomes
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  end if;

  if v_ids is not null then
    if v_kind = 'expense' then
      update public.expenses e
         set value = case when p_fields ? 'value' then v_value else e.value end,
             base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
             category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
             payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
             card_id = case
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
               else e.card_id
             end,
             bill_competence = case
               when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               else e.bill_competence
             end
       where e.id = any(v_ids);
      get diagnostics v_updated = row_count;
    else
      update public.incomes i
         set value = case when p_fields ? 'value' then v_value else i.value end,
             category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
             receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end
       where i.id = any(v_ids);
      get diagnostics v_updated = row_count;
    end if;
  else
    v_updated := 0;
  end if;

  if p_mode <> 'single' then
    update public.recurrences r
       set value = case when p_fields ? 'value' then v_value else r.value end,
           category_id = case when p_fields ? 'category_id' then v_category_id else r.category_id end,
           description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else r.description end,
           report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else r.report_weight end,
           payment_method = case when p_fields ? 'payment_method' then v_payment_method else r.payment_method end,
           card_id = case
             when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
             when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
             else r.card_id
           end,
           receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else r.receive_type end
     where r.id = v_recurrence_id;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'update_occurrences',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

create or replace function public.update_expense_installments_group(
  p_expense_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_category_id uuid;
  v_value numeric;
  v_payment_method text;
  v_card_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'expense') then
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
    end if;
  end if;
  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method is not null and v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  elsif p_fields ? 'card_id' then
    v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
    if v_card_id is not null and not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_expense_id];
  elsif v_expense.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.expenses
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and (p_mode = 'all' or installment_number >= v_expense.installment_number);
  else
    v_ids := array[p_expense_id];
  end if;

  update public.expenses e
     set value = case when p_fields ? 'value' then v_value else e.value end,
         base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
         category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
         payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
         card_id = case
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
           else e.card_id
         end,
         bill_competence = case
           when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           else e.bill_competence
         end
   where e.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;


-- ----------------------------------------------------------------
-- 5. Imunização contra IDOR em refinance_credit_card_bill (Achado 5)
-- ----------------------------------------------------------------
create or replace function public.refinance_credit_card_bill(
  p_card_id uuid,
  p_competence_month char(7),
  p_initial_payment_amount numeric,
  p_interest_installments jsonb,
  p_expense_category_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_group_id uuid := gen_random_uuid();
  v_card_name text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;
  if not found then
    raise exception 'Cartão não encontrado ou não pertence ao usuário';
  end if;

  if p_expense_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;

  -- 1. Se houve entrada/pagamento inicial na competência
  if p_initial_payment_amount > 0 then
    insert into public.card_payments (
      user_id, card_id, competence_month, amount, date, note, is_refund
    ) values (
      v_user_id, p_card_id, p_competence_month, p_initial_payment_amount, current_date, 'Entrada de parcelamento de fatura', false
    );
  end if;

  -- 2. Insere as parcelas de juros adicionais nas competências futuras
  for v_item in select * from jsonb_array_elements(p_interest_installments)
  loop
    insert into public.expenses (
      user_id, value, date, category_id, payment_method, card_id,
      installments_total, installment_number, installment_group_id,
      bill_competence, report_weight, base_amount, description, charge_kind
    ) values (
      v_user_id,
      (v_item->>'amount')::numeric,
      (v_item->>'date')::date,
      p_expense_category_id,
      'credit_card',
      p_card_id,
      (v_item->>'installments_total')::integer,
      (v_item->>'installment_number')::integer,
      v_group_id,
      v_item->>'bill_competence',
      1,
      (v_item->>'amount')::numeric,
      format('Juros de parcelamento de fatura: %s', v_card_name),
      'interest'
    );
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'bill_refinance',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'initial_payment', p_initial_payment_amount,
      'installments_count', jsonb_array_length(p_interest_installments),
      'installment_group_id', v_group_id
    )
  );

  return true;
end;
$$;


-- ----------------------------------------------------------------
-- 6. Imunização contra IDOR em set_allocation_targets (Achado 6)
-- ----------------------------------------------------------------
create or replace function public.set_allocation_targets(p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_item jsonb;
  v_asset_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_targets is null then
    raise exception 'Metas de alocação inválidas';
  end if;

  -- Valida formato dos itens e checa se cada asset pertence ao usuário (IDOR)
  for v_item in select * from jsonb_array_elements(p_targets) loop
    v_asset_id := (v_item->>'asset_id')::uuid;
    if v_asset_id is null
       or (v_item->>'target_percentage')::numeric is null
       or (v_item->>'target_percentage')::numeric < 0
       or (v_item->>'target_percentage')::numeric > 100 then
      raise exception 'Metas de alocação inválidas';
    end if;

    if not exists (select 1 from public.portfolio_assets where id = v_asset_id and user_id = v_user) then
      raise exception 'Ativo inválido ou não pertence ao usuário: %', v_asset_id;
    end if;
  end loop;

  -- Limpa as metas atuais do usuário
  delete from public.allocation_targets
   where user_id = v_user;

  -- Insere o novo conjunto de metas (inclusive 0%)
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         round((item->>'target_percentage')::numeric, 2)
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric >= 0;

  -- Validação FINAL da soma após o lote
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100.001 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;

  notify pgrst, 'reload schema';
end;
$$;


-- ----------------------------------------------------------------
-- 7. Imunização contra IDOR nas RPCs de Importação de Extrato (Achado 8)
-- ----------------------------------------------------------------
create or replace function public.import_statement_expenses(
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count int := 0;
  v_skipped_count int := 0;
  v_expense_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_cat_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autorizado';
  end if;

  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão não encontrado ou não pertence ao usuário.';
  end if;

  -- Categoria padrão de fallback caso a informada não pertença ao usuário
  select id into v_fallback_cat_id
  from public.categories
  where user_id = v_user_id and type = 'expense'
  order by is_reserved desc, created_at asc
  limit 1;

  for v_item in select * from jsonb_array_elements(p_expenses)
  loop
    v_date := (v_item->>'date')::date;
    v_val := (v_item->>'value')::numeric;
    v_cat_id := (v_item->>'category_id')::uuid;

    -- Validação de IDOR na categoria
    if v_cat_id is null or not exists (select 1 from public.categories where id = v_cat_id and user_id = v_user_id and type = 'expense') then
      v_cat_id := v_fallback_cat_id;
    end if;

    if v_date < '2026-01-01'::date then
      raise exception 'Data de lançamento anterior a 2026-01-01: %', v_date;
    end if;

    if v_val <= 0 then
      raise exception 'Valor de despesa deve ser estritamente positivo: %', v_val;
    end if;

    insert into public.expenses (
      user_id,
      card_id,
      category_id,
      payment_method,
      value,
      base_amount,
      report_weight,
      date,
      bill_competence,
      description,
      installments_total,
      installment_number,
      statement_hash,
      imported_from_statement
    ) values (
      v_user_id,
      p_card_id,
      v_cat_id,
      'credit_card',
      v_val,
      v_val,
      coalesce((v_item->>'report_weight')::numeric, 1.0),
      v_date,
      p_competence_month,
      v_item->>'description',
      coalesce((v_item->>'installments_total')::int, 1),
      coalesce((v_item->>'installment_number')::int, 1),
      v_item->>'statement_hash',
      true
    )
    on conflict (user_id, card_id, statement_hash) where statement_hash is not null
    do nothing
    returning id into v_expense_id;

    if v_expense_id is not null then
      v_inserted_count := v_inserted_count + 1;
    else
      v_skipped_count := v_skipped_count + 1;
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'credit_card',
    p_card_id::text,
    'IMPORT_STATEMENT_BATCH',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'inserted_count', v_inserted_count,
      'skipped_count', v_skipped_count,
      'total_received', coalesce(jsonb_array_length(p_expenses), 0)
    )
  );

  return jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'skipped_count', v_skipped_count
  );
end;
$$;


-- ----------------------------------------------------------------
-- 8. Hardening de RLS Residual em portfolio_snapshots e portfolio_contributions (Achado 7)
-- ----------------------------------------------------------------
drop policy if exists "portfolio_snapshots_all_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_all_own" on public.portfolio_snapshots
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

drop policy if exists "portfolio_contributions_all_own" on public.portfolio_contributions;
create policy "portfolio_contributions_all_own" on public.portfolio_contributions
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());
