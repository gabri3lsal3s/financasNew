-- ============================================================================
-- Migration 20260101000020 — Otimização Set-Based de Recorrências (D12)
--
-- Refatora o RPC `materialize_recurrences` para eliminar loops RBAR PL/pgSQL
-- e realizar validação e inserção atômica baseada em conjuntos (Set-Based CTEs).
-- ============================================================================

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
      r.description
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
      installment_group_id, bill_competence, report_weight, base_amount, description
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount, description
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
      r.description
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
      receive_type, description
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description
    from valid_incomes
    returning 1
  )
  select count(*) into v_income_count from inserted_incomes;

  return v_expense_count + v_income_count;
end;
$$;
