-- ================================================================
-- 0003_functions.sql — Triggers + RPCs transacionais (D1)
--
-- Princípios (ESPECIFICAÇÃO §1.1 / §3.2.2 / D12):
--   • Operações compostas são funções atômicas (BEGIN/COMMIT implícito);
--   • O cliente calcula derivados (parcelas, competências) e o servidor
--     VALIDA invariantes antes de persistir (nunca confiar no cliente);
--   • Toda escrita relevante grava audit_events (D2);
--   • security definer + search_path fixo; ownership via auth.uid().
-- ================================================================

-- ----------------------------------------------------------------
-- Trigger: perfil + preferências no signup
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- Trigger: soma das metas de alocação ≤ 100% (por usuário)
-- ----------------------------------------------------------------
create or replace function public.check_allocation_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_total numeric;
begin
  v_user := coalesce(new.user_id, old.user_id);
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_allocation_targets_check
  before insert or update or delete on public.allocation_targets
  for each row execute function public.check_allocation_total();

-- ----------------------------------------------------------------
-- Helper: limite do closing day ao último dia do mês (clampDay)
-- ----------------------------------------------------------------
create or replace function public.resolve_competence_boundary(p_date date, p_closing_day integer)
returns date
language sql
immutable
as $$
  select make_date(
    extract(year from p_date)::int,
    extract(month from p_date)::int,
    least(
      greatest(p_closing_day, 1),
      extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int
    )
  );
$$;

-- ----------------------------------------------------------------
-- RPC: create_expense_with_debt — despesa + cobrança vinculada (D1)
-- Recebe parcelas calculadas no cliente (D12): [{date, value, bill_competence?}]
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
  p_debt_due_date date
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
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Invariantes (servidor nunca confia no cliente — AGENTS §5)
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;
  if p_payment_method = 'credit_card' and p_card_id is null then
    raise exception 'Cartão obrigatório para pagamento no crédito';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> 'expense' then
    raise exception 'Categoria de despesa inválida';
  end if;

  -- Parcelas: array 1..60, soma = valor original, datas válidas
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
      p_card_id,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end,
      nullif(v_parcela ->> 'bill_competence', ''),
      p_report_weight,
      (v_parcela ->> 'value')::numeric,
      p_description
    )
    returning id into v_expense_id;

    -- Cobrança vinculada (uma por parcela — ESPECIFICAÇÃO §3.2.4)
    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;
      insert into public.debts (user_id, name, type, amount, due_date, expense_id, installment_group_id)
      values (
        v_user_id,
        coalesce(nullif(p_debt_name, ''), 'Cobrança integrada à despesa: ' || coalesce(p_description, '')),
        'payable',
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
-- RPC: create_refund — estorno de fatura gera renda automática (D1)
-- ----------------------------------------------------------------
create or replace function public.create_refund(
  p_card_id uuid,
  p_competence_month text,
  p_amount numeric,
  p_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_refund_category uuid;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do estorno deve ser maior que zero';
  end if;

  -- Categoria reservada "Estorno" (cria se ainda não existir)
  select id into v_refund_category
    from public.categories
   where user_id = v_user_id and type = 'income' and name = 'Estorno' and is_reserved;

  if v_refund_category is null then
    insert into public.categories (user_id, type, name, is_reserved)
    values (v_user_id, 'income', 'Estorno', true)
    returning id into v_refund_category;
  end if;

  -- Estorno = pagamento com valor negativo + is_refund (ESPECIFICAÇÃO §3.3.3)
  insert into public.card_payments (user_id, card_id, competence_month, amount, date, note, is_refund)
  values (v_user_id, p_card_id, p_competence_month, -p_amount, p_date, p_note, true)
  returning id into v_payment_id;

  -- Renda automática somente-leitura (source_ref [REFUND]{id do pagamento})
  insert into public.incomes (user_id, value, date, category_id, receive_type, description, source_ref, report_weight)
  values (
    v_user_id, p_amount, p_date, v_refund_category, 'other',
    coalesce(p_note, 'Estorno de cartão'),
    '[REFUND]' || v_payment_id::text,
    1
  );

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', v_payment_id::text, 'refund',
    jsonb_build_object('amount', p_amount, 'note', p_note)
  );

  return v_payment_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: delete_expense_installments — exclusão 3 modos + cascata (D1)
-- ----------------------------------------------------------------
create or replace function public.delete_expense_installments(
  p_expense_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  -- Cascata: remove apenas dívidas PENDENTES vinculadas; pagas nunca são tocadas (§3.2.2)
  if p_mode = 'single' then
    delete from public.debts
     where user_id = v_user_id and expense_id = p_expense_id and paid_at is null;
    delete from public.expenses where id = p_expense_id;
    v_deleted := 1;
  elsif p_mode = 'all' and v_expense.installment_group_id is not null then
    delete from public.debts
     where user_id = v_user_id and installment_group_id = v_expense.installment_group_id and paid_at is null;
    delete from public.expenses
     where user_id = v_user_id and installment_group_id = v_expense.installment_group_id;
    get diagnostics v_deleted = row_count;
  elsif p_mode = 'subsequent' and v_expense.installment_group_id is not null then
    delete from public.debts
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and paid_at is null
       and expense_id in (
         select id from public.expenses
          where installment_group_id = v_expense.installment_group_id
            and installment_number >= v_expense.installment_number
       );
    delete from public.expenses
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and installment_number >= v_expense.installment_number;
    get diagnostics v_deleted = row_count;
  else
    -- sem grupo (parcela única) em modo all/subsequent: exclui a própria
    delete from public.debts
     where user_id = v_user_id and expense_id = p_expense_id and paid_at is null;
    delete from public.expenses where id = p_expense_id;
    v_deleted := 1;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'delete_' || p_mode,
    jsonb_build_object('deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: pay_debt — quitação de dívida a pagar (+ criar despesa opcional)
-- ----------------------------------------------------------------
create or replace function public.pay_debt(
  p_debt_id uuid,
  p_create_expense boolean,
  p_expense_category_id uuid
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
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
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

  if p_create_expense then
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
      installments_total, installment_number, report_weight, base_amount, description
    ) values (
      v_user_id, v_debt.amount, v_debt.due_date, p_expense_category_id, 'other',
      1, 1, 1, v_debt.amount, v_debt.name
    )
    returning id into v_expense_id;
  end if;

  update public.debts set paid_at = now() where id = p_debt_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'pay',
    jsonb_build_object('created_expense', coalesce(p_create_expense, false), 'expense_id', v_expense_id)
  );

  return coalesce(v_expense_id, v_debt.id);
end;
$$;

-- ----------------------------------------------------------------
-- RPC: receive_debt — quitação de dívida a receber (+ criar renda opcional)
-- ----------------------------------------------------------------
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
    raise exception 'Dívida já quitada';
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

    insert into public.incomes (user_id, value, date, category_id, receive_type, description, report_weight)
    values (v_user_id, v_debt.amount, v_debt.due_date, p_income_category_id, 'other', v_debt.name, 1)
    returning id into v_income_id;
  end if;

  update public.debts set paid_at = now() where id = p_debt_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'receive',
    jsonb_build_object('created_income', coalesce(p_create_income, false), 'income_id', v_income_id)
  );

  return coalesce(v_income_id, v_debt.id);
end;
$$;

-- ----------------------------------------------------------------
-- RPC: settle_integrated_receivable — recebível reduz despesa no relatório
-- p_result: valor final da despesa no relatório (editável pelo usuário).
-- O peso é derivado: report_weight = p_result / base_amount (0–1).
-- ----------------------------------------------------------------
create or replace function public.settle_integrated_receivable(
  p_debt_id uuid,
  p_result numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
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
    raise exception 'Dívida já quitada';
  end if;
  if v_debt.expense_id is null then
    raise exception 'Dívida sem despesa vinculada';
  end if;

  if p_result < 0 then
    raise exception 'Resultado não pode ser negativo';
  end if;

  update public.expenses
     set report_weight = greatest(
           0,
           least(1, p_result / nullif(base_amount, 0))
         )
   where id = v_debt.expense_id and user_id = v_user_id;

  update public.debts set paid_at = now() where id = p_debt_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'settle_integrated_receivable',
    jsonb_build_object('result', p_result, 'expense_id', v_debt.expense_id)
  );
end;
$$;

-- ----------------------------------------------------------------
-- RPC: delete_category_migrate — exclui categoria (opcionalmente migra itens)
-- ----------------------------------------------------------------
create or replace function public.delete_category_migrate(
  p_category_id uuid,
  p_migrate_to uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat public.categories%rowtype;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_cat
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if not found then
    raise exception 'Categoria não encontrada';
  end if;
  if v_cat.is_reserved then
    raise exception 'Categoria reservada não pode ser excluída';
  end if;

  if p_migrate_to is not null then
    if not exists (
      select 1 from public.categories
       where id = p_migrate_to and user_id = v_user_id and type = v_cat.type
    ) then
      raise exception 'Categoria de destino inválida (mesmo usuário e tipo)';
    end if;

    update public.expenses set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.incomes set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.budgets set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.income_goals set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
  end if;

  delete from public.categories where id = p_category_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'category', p_category_id::text, 'delete',
    jsonb_build_object('migrate_to', p_migrate_to)
  );
end;
$$;

-- ----------------------------------------------------------------
-- RPC: set_budget_limit — upsert de orçamento (unique category+month)
-- ----------------------------------------------------------------
create or replace function public.set_budget_limit(
  p_category_id uuid,
  p_month text,
  p_limit numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not exists (
    select 1 from public.categories
     where id = p_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de despesa inválida';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'Limite deve ser maior que zero';
  end if;

  insert into public.budgets (user_id, category_id, month, "limit")
  values (v_user_id, p_category_id, p_month, p_limit)
  on conflict (category_id, month)
  do update set "limit" = excluded."limit";

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_category_id::text || ':' || p_month, 'upsert',
    jsonb_build_object('limit', p_limit)
  );
end;
$$;

-- ----------------------------------------------------------------
-- RPC: set_income_goal — upsert de meta de renda
-- ----------------------------------------------------------------
create or replace function public.set_income_goal(
  p_category_id uuid,
  p_month text,
  p_expected numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not exists (
    select 1 from public.categories
     where id = p_category_id and user_id = v_user_id and type = 'income'
  ) then
    raise exception 'Categoria de renda inválida';
  end if;
  if p_expected is null or p_expected <= 0 then
    raise exception 'Meta deve ser maior que zero';
  end if;

  insert into public.income_goals (user_id, category_id, month, expected)
  values (v_user_id, p_category_id, p_month, p_expected)
  on conflict (category_id, month)
  do update set expected = excluded.expected;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income_goal', p_category_id::text || ':' || p_month, 'upsert',
    jsonb_build_object('expected', p_expected)
  );
end;
$$;

-- ----------------------------------------------------------------
-- RPC: recalculate_bill_competences — recálculo controlado em lote (D3)
-- Regra: dia da compra >= closing (com override mensal) → mês seguinte.
-- O snapshot na escrita vem do cliente (D12); este RPC é o recálculo
-- oferecido ao alterar regras do cartão (§1.5) — exige confirmação na UI.
-- ----------------------------------------------------------------
create or replace function public.recalculate_bill_competences(p_card_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido';
  end if;

  update public.expenses e
     set bill_competence = to_char(
       case
         when e.date >= public.resolve_competence_boundary(e.date, coalesce(ov.closing_day, c.closing_day))
         then e.date + interval '1 month'
         else e.date
       end,
       'YYYY-MM'
     )
    from public.credit_cards c
    left join public.card_competence_overrides ov
      on ov.card_id = c.id and ov.month = to_char(e.date, 'YYYY-MM')
   where e.user_id = v_user_id
     and e.card_id = p_card_id
     and c.id = e.card_id;

  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'recalculate_competences',
    jsonb_build_object('updated', v_updated)
  );

  return v_updated;
end;
$$;
