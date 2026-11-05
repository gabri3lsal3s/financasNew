-- ============================================================================
-- Migration 20260101000071 — Suporte Completo a is_family em Recorrências e Lotes
--
-- Garante que:
-- 1. A tabela `recurrences` possua a coluna `is_family boolean not null default false`.
-- 2. `create_recurrence` persista `is_family`.
-- 3. `materialize_recurrences` herde `is_family` do template para as ocorrências
--    geradas em `expenses` e `incomes`.
-- 4. `update_expense_installments_group`, `update_income_installments_group` e
--    `update_recurrence_occurrences` atualizem `is_family` no banco quando
--    fornecido em p_fields.
-- 5. Elimina sobrecargas legadas não utilizadas de `create_expense_with_debt`.
-- ============================================================================

-- 1. Coluna is_family na tabela recurrences
alter table public.recurrences
  add column if not exists is_family boolean not null default false;

-- 2. Eliminação de sobrecarga legada de create_expense_with_debt
drop function if exists public.create_expense_with_debt(jsonb, jsonb);

-- 3. create_recurrence com suporte a p_is_family
drop function if exists public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric
);
drop function if exists public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean
);

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
  v_recurrence_id uuid;
  v_cat_type text;
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

  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo de recorrência inválido: deve ser expense ou income';
  end if;
  if p_frequency not in ('monthly', 'weekly', 'yearly') then
    raise exception 'Frequência inválida: deve ser monthly, weekly ou yearly';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor deve ser maior que zero';
  end if;
  if p_start_date < date '2026-01-01' then
    raise exception 'Data de início anterior à data de início do app';
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
    occurrences_total, payment_method, card_id, receive_type, description,
    report_weight, is_family
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total,
    case when p_kind = 'expense' then p_payment_method else null end,
    case when p_kind = 'expense' and p_payment_method = 'credit_card' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight, coalesce(p_is_family, false)
  )
  returning id into v_recurrence_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'create',
    jsonb_build_object('kind', p_kind, 'frequency', p_frequency, 'value', p_value, 'is_family', coalesce(p_is_family, false))
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

-- 4. materialize_recurrences com herança de is_family
create or replace function public.materialize_recurrences(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_count integer := 0;
  v_income_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;

  -- 1) Inserção em lote de ocorrências de DESPESAS (set-based)
  with incoming as (
    select
      (item->>'recurrence_id')::uuid as recurrence_id,
      (item->>'date')::date as occurrence_date,
      (item->>'occurrence_number')::integer as occurrence_number,
      (item->>'value')::numeric as occurrence_value,
      nullif(item->>'bill_competence', '') as bill_competence
    from jsonb_array_elements(p_items) as item
  ),
  valid_expenses as (
    select
      v_user_id as user_id,
      r.id as recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date as date,
      r.category_id,
      r.payment_method,
      r.card_id,
      1 as installments_total,
      1 as installment_number,
      null::uuid as installment_group_id,
      i.bill_competence,
      r.report_weight,
      r.value as base_amount,
      r.description,
      coalesce(r.is_family, false) as is_family
    from incoming i
    join public.recurrences r
      on r.id = i.recurrence_id
     and r.user_id = v_user_id
     and r.is_active = true
     and r.kind = 'expense'
    where i.occurrence_date >= date '2026-01-01'
      and i.occurrence_number >= 1
      and (r.end_date is null or i.occurrence_date <= r.end_date)
      and (r.occurrences_total is null or i.occurrence_number <= r.occurrences_total)
      and not exists (
        select 1 from public.recurrence_skips s
         where s.recurrence_id = r.id and s.occurrence_date = i.occurrence_date
      )
      and not exists (
        select 1 from public.expenses e
         where e.recurrence_id = r.id and e.date = i.occurrence_date
      )
  ),
  inserted_expenses as (
    insert into public.expenses (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family
    from valid_expenses
    returning 1
  )
  select count(*) into v_expense_count from inserted_expenses;

  -- 2) Inserção em lote de ocorrências de RENDAS (set-based)
  with incoming as (
    select
      (item->>'recurrence_id')::uuid as recurrence_id,
      (item->>'date')::date as occurrence_date,
      (item->>'occurrence_number')::integer as occurrence_number,
      (item->>'value')::numeric as occurrence_value
    from jsonb_array_elements(p_items) as item
  ),
  valid_incomes as (
    select
      v_user_id as user_id,
      r.id as recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date as date,
      r.category_id,
      r.receive_type,
      r.description,
      coalesce(r.is_family, false) as is_family
    from incoming i
    join public.recurrences r
      on r.id = i.recurrence_id
     and r.user_id = v_user_id
     and r.is_active = true
     and r.kind = 'income'
    where i.occurrence_date >= date '2026-01-01'
      and i.occurrence_number >= 1
      and (r.end_date is null or i.occurrence_date <= r.end_date)
      and (r.occurrences_total is null or i.occurrence_number <= r.occurrences_total)
      and not exists (
        select 1 from public.recurrence_skips s
         where s.recurrence_id = r.id and s.occurrence_date = i.occurrence_date
      )
      and not exists (
        select 1 from public.incomes inc
         where inc.recurrence_id = r.id and inc.date = i.occurrence_date
      )
  ),
  inserted_incomes as (
    insert into public.incomes (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description, is_family
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description, is_family
    from valid_incomes
    returning 1
  )
  select count(*) into v_income_count from inserted_incomes;

  return v_expense_count + v_income_count;
end;
$$;

revoke all on function public.materialize_recurrences(jsonb) from public;
grant execute on function public.materialize_recurrences(jsonb) to authenticated;

-- 5. update_expense_installments_group com suporte a is_family
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
  v_value numeric;
  v_category_id uuid;
  v_payment_method text;
  v_card_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
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
      raise exception 'Categoria inválida ou não pertence ao usuário';
    end if;
  end if;

  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        v_card_id := v_expense.card_id;
      end if;
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
         end,
         is_family = case
           when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
           else e.is_family
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

revoke all on function public.update_expense_installments_group from public;
grant execute on function public.update_expense_installments_group to authenticated;

-- 6. update_income_installments_group com suporte a is_family
create or replace function public.update_income_installments_group(
  p_income_id uuid,
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
  v_income public.incomes%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;

  if v_income.source_ref is not null then
    raise exception 'Rendas automáticas vinculadas a estornos são somente-leitura';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;

  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'income') then
      raise exception 'Categoria de renda inválida';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_income_id];
  elsif v_income.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.incomes
     where user_id = v_user_id
       and installment_group_id = v_income.installment_group_id
       and (p_mode = 'all' or installment_number >= v_income.installment_number);
  else
    v_ids := array[p_income_id];
  end if;

  update public.incomes i
     set value = case when p_fields ? 'value' then v_value else i.value end,
         category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
         receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end,
         is_family = case
           when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
           else i.is_family
         end
   where i.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income', p_income_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_income_installments_group from public;
grant execute on function public.update_income_installments_group to authenticated;

-- 7. update_recurrence_occurrences com suporte a is_family
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
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
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
             end,
             is_family = case
               when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
               else e.is_family
             end
       where e.id = any(v_ids);
      get diagnostics v_updated = row_count;
    else
      update public.incomes i
         set value = case when p_fields ? 'value' then v_value else i.value end,
             category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
             receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end,
             is_family = case
               when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
               else i.is_family
             end
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
           receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else r.receive_type end,
           is_family = case
             when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
             else r.is_family
           end
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

revoke all on function public.update_recurrence_occurrences from public;
grant execute on function public.update_recurrence_occurrences to authenticated;
