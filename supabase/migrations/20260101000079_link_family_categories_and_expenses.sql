-- ---------------------------------------------------------------------------
-- 20260101000079_link_family_categories_and_expenses.sql
-- Módulo de Modo Família Colaborativo Multi-Contas & Consolidação Orçamentária
-- Tarefa 3.2: Compartilhamento de Categorias no Wizard & Auto-atribuição de family_id
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Coluna family_id na tabela recurrences (se não existir)
-- ===========================================================================
alter table public.recurrences
  add column if not exists family_id uuid references public.families(id) on delete set null;

create index if not exists idx_recurrences_family_id
  on public.recurrences (family_id)
  where family_id is not null;

-- ===========================================================================
-- 2. Trigger de Auto-Atribuição de family_id em Entidades Familiares
-- ===========================================================================
create or replace function public.set_entity_family_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
begin
  if NEW.is_family = true then
    if NEW.family_id is null then
      select fm.family_id into v_family_id
      from public.family_members fm
      where fm.user_id = NEW.user_id
      limit 1;

      NEW.family_id := v_family_id;
    end if;
  else
    NEW.family_id := null;
  end if;

  return NEW;
end;
$$;

-- Triggers em categories, expenses, incomes e recurrences
drop trigger if exists trg_set_category_family_id on public.categories;
create trigger trg_set_category_family_id
  before insert or update of is_family, family_id on public.categories
  for each row execute function public.set_entity_family_id();

drop trigger if exists trg_set_expense_family_id on public.expenses;
create trigger trg_set_expense_family_id
  before insert or update of is_family, family_id on public.expenses
  for each row execute function public.set_entity_family_id();

drop trigger if exists trg_set_income_family_id on public.incomes;
create trigger trg_set_income_family_id
  before insert or update of is_family, family_id on public.incomes
  for each row execute function public.set_entity_family_id();

drop trigger if exists trg_set_recurrence_family_id on public.recurrences;
create trigger trg_set_recurrence_family_id
  before insert or update of is_family, family_id on public.recurrences
  for each row execute function public.set_entity_family_id();

-- ===========================================================================
-- 3. Backfill de family_id em registros existentes com is_family = true
-- ===========================================================================
update public.categories c
set family_id = fm.family_id
from public.family_members fm
where c.user_id = fm.user_id
  and c.is_family = true
  and c.family_id is null;

update public.expenses e
set family_id = fm.family_id
from public.family_members fm
where e.user_id = fm.user_id
  and e.is_family = true
  and e.family_id is null;

update public.incomes i
set family_id = fm.family_id
from public.family_members fm
where i.user_id = fm.user_id
  and i.is_family = true
  and i.family_id is null;

update public.recurrences r
set family_id = fm.family_id
from public.family_members fm
where r.user_id = fm.user_id
  and r.is_family = true
  and r.family_id is null;

-- ===========================================================================
-- 4. Atualização de create_expense_with_debt para aceitar categorias familiares
-- ===========================================================================
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
  p_debt_type text default 'payable',
  p_is_family boolean default false
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
  v_family_id uuid := null;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_debt_amount is not null and not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
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

  -- Validação de categoria: pertence ao próprio usuário OU é categoria compartilhada da sua família
  select type into v_cat_type
    from public.categories
   where id = p_category_id
     and (
       user_id = v_user_id
       or (
         is_family = true
         and family_id is not null
         and public.is_family_member(family_id, v_user_id)
       )
     );
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

  if coalesce(p_is_family, false) = true then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
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
      bill_competence, report_weight, base_amount, description,
      is_family, family_id
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
      p_description,
      coalesce(p_is_family, false),
      v_family_id
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

revoke all on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
) from public;
grant execute on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
) to authenticated;

-- ===========================================================================
-- 5. Atualização de create_income_installments para aceitar categorias familiares
-- ===========================================================================
create or replace function public.create_income_installments(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb,
  p_is_family boolean default false
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
  v_count integer;
  v_sum numeric;
  v_parcela jsonb;
  v_i integer := 0;
  v_income_id uuid;
  v_first_id uuid;
  v_family_id uuid := null;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Valor da renda deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  -- Validação de categoria: própria ou compartilhada da família
  select type into v_cat_type
    from public.categories
   where id = p_category_id
     and (
       user_id = v_user_id
       or (
         is_family = true
         and family_id is not null
         and public.is_family_member(family_id, v_user_id)
       )
     );
  if v_cat_type is null or v_cat_type <> 'income' then
    raise exception 'Categoria de renda inválida';
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

  if coalesce(p_is_family, false) = true then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    insert into public.incomes (
      user_id, value, date, category_id, receive_type, description,
      report_weight, installments_total, installment_number, installment_group_id,
      is_family, family_id
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      v_count,
      v_i,
      v_group,
      coalesce(p_is_family, false),
      v_family_id
    )
    returning id into v_income_id;

    if v_first_id is null then
      v_first_id := v_income_id;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'income', v_income_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value')
    );
  end loop;

  return v_first_id;
end;
$$;

revoke all on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean
) from public;
grant execute on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean
) to authenticated;

-- ===========================================================================
-- 6. Atualização de create_recurrence para aceitar categorias familiares
-- ===========================================================================
create or replace function public.create_recurrence(
  p_kind text,
  p_frequency text,
  p_value numeric,
  p_category_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_occurrences_total integer default null,
  p_payment_method text default null,
  p_card_id uuid default null,
  p_receive_type text default null,
  p_description text default null,
  p_report_weight numeric default 1,
  p_is_family boolean default false
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
  v_family_id uuid := null;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo inválido: esperado expense ou income';
  end if;
  if p_frequency not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'Frequência inválida';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor deve ser maior que zero';
  end if;
  if p_start_date is null or p_start_date < date '2026-01-01' then
    raise exception 'Data inicial anterior à data de início do app (2026-01-01)';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data final anterior à data inicial';
  end if;
  if p_occurrences_total is not null and p_occurrences_total <= 0 then
    raise exception 'Número de ocorrências deve ser maior que zero';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  -- Validação de categoria: própria ou compartilhada da família
  select type into v_cat_type
    from public.categories
   where id = p_category_id
     and (
       user_id = v_user_id
       or (
         is_family = true
         and family_id is not null
         and public.is_family_member(family_id, v_user_id)
       )
     );
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
  else
    if p_receive_type is null then
      raise exception 'Forma de recebimento obrigatória para receita recorrente';
    end if;
  end if;

  if coalesce(p_is_family, false) = true then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  insert into public.recurrences (
    user_id, kind, frequency, value, category_id, start_date,
    end_date, occurrences_total, payment_method, card_id, receive_type,
    description, report_weight, is_active, is_family, family_id
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total, p_payment_method,
    case when p_kind = 'expense' and p_payment_method = 'credit_card' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight, true, coalesce(p_is_family, false), v_family_id
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

revoke all on function public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean
) from public;
grant execute on function public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean
) to authenticated;
