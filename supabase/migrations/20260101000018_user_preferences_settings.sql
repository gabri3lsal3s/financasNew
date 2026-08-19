-- ============================================================================
-- Migration 20260101000018: custom_settings em user_preferences
-- ============================================================================
-- Adiciona coluna JSONB para sincronização na nuvem de preferências de
-- interface e ergonomia (widgets, botões do header, sons, hápticos, animações,
-- densidade), preservando a escolha do tema visual no dispositivo local.

alter table public.user_preferences
  add column if not exists custom_settings jsonb not null default '{}'::jsonb;

-- Atualiza a função de restore para suportar custom_settings se presente
create or replace function public.restore_user_backup(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_data jsonb;
  v_version text;
  v_res jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  v_version := p_payload ->> 'version';
  if v_version is null or (v_version <> '1.0' and v_version <> '2.0') then
    raise exception 'Versão de backup incompatível: %', coalesce(v_version, 'null');
  end if;

  v_data := p_payload -> 'data';
  if v_data is null then
    raise exception 'Payload de backup sem nó data';
  end if;

  -- ------------------------------------------------------------------
  -- 1) Limpeza total na ordem inversa de dependências FK
  -- ------------------------------------------------------------------
  delete from public.audit_events where user_id = v_uid;
  delete from public.recurrence_skips where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.recurrences where user_id = v_uid;
  delete from public.card_competence_overrides where card_id in (
    select id from public.credit_cards where user_id = v_uid
  );
  delete from public.card_payments where user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.loans where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.asset_prices where user_id = v_uid;
  delete from public.portfolio_transactions where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.allocation_targets where user_id = v_uid;
  delete from public.class_targets where user_id = v_uid;
  delete from public.sector_targets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- ------------------------------------------------------------------
  -- 2) Insere o backup (pais antes dos filhos), forçando user_id
  -- ------------------------------------------------------------------
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (id, user_id, ticker, asset_class, currency)
  select id, v_uid, ticker, asset_class, currency
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb));

  insert into public.user_preferences (user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings)
  select v_uid, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis, coalesce(custom_settings, '{}'::jsonb)
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select id, card_id, month, closing_day, due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb));

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select id, v_uid, value, date, category_id, receive_type, description, report_weight, source_ref, created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb));

  insert into public.expenses (
    id, user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at
  )
  select
    id, v_uid, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb));

  insert into public.debts (id, user_id, type, name, total_amount, remaining_amount, due_date, status, notes, created_at)
  select id, v_uid, type, name, total_amount, remaining_amount, due_date, status, notes, created_at
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb));

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, payment_date, created_at)
  select id, v_uid, card_id, competence_month, amount, payment_date, created_at
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb));

  insert into public.budgets (id, user_id, category_id, month, amount)
  select id, v_uid, category_id, month, amount
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb));

  insert into public.income_goals (id, user_id, month, amount)
  select id, v_uid, month, amount
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb));

  insert into public.insight_feedback (id, user_id, insight_key, month, decision, created_at)
  select id, v_uid, insight_key, month, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, reminder_key, dismissed_at)
  select id, v_uid, reminder_key, dismissed_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.allocation_targets (id, user_id, ticker, target_percent)
  select id, v_uid, ticker, target_percent
  from jsonb_populate_recordset(null::public.allocation_targets, coalesce(v_data -> 'allocation_targets', '[]'::jsonb));

  insert into public.asset_prices (id, user_id, ticker, price, updated_at, source)
  select id, v_uid, ticker, price, updated_at, source
  from jsonb_populate_recordset(null::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb));

  -- ------------------------------------------------------------------
  -- 3) Retorna contagens restauradas para auditoria
  -- ------------------------------------------------------------------
  v_res := jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'user_preferences', (select count(*) from public.user_preferences where user_id = v_uid),
    'card_competence_overrides', (
      select count(*) from public.card_competence_overrides cco
      join public.credit_cards cc on cc.id = cco.card_id
      where cc.user_id = v_uid
    ),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'card_payments', (select count(*) from public.card_payments where user_id = v_uid),
    'budgets', (select count(*) from public.budgets where user_id = v_uid),
    'income_goals', (select count(*) from public.income_goals where user_id = v_uid),
    'insight_feedback', (select count(*) from public.insight_feedback where user_id = v_uid),
    'reminder_states', (select count(*) from public.reminder_states where user_id = v_uid),
    'allocation_targets', (select count(*) from public.allocation_targets where user_id = v_uid),
    'asset_prices', (select count(*) from public.asset_prices where user_id = v_uid)
  );

  return v_res;
end;
$$;
