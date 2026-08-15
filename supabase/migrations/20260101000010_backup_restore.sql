-- ================================================================
-- 0010_backup_restore.sql — Restauração integral de backup (F22)
--
-- Princípios (AGENTS §5 / ESPECIFICAÇÃO §1.1 / D1):
--   • Operação composta atômica (BEGIN/COMMIT implícito da função);
--   • Substitui TODO o conteúdo do usuário pelos dados do backup;
--   • IDs originais preservados (integridade FK interna do arquivo);
--   • user_id é SEMPRE forçado para auth.uid() — defesa contra
--     injeção de dados de outros usuários (security definer);
--   • Registra audit_events (D2) — imutável, fora do escopo do backup.
-- ================================================================

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

  -- ------------------------------------------------------------------
  -- 1) Apaga os dados atuais do usuário (filhos antes dos pais)
  -- ------------------------------------------------------------------
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

  insert into public.user_preferences (user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis)
  select v_uid, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select id, card_id, month, closing_day, due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb));

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select id, v_uid, value, date, category_id, receive_type, description, report_weight, source_ref, created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb));

  insert into public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  select id, v_uid, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb));

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  select id, v_uid, card_id, competence_month, amount, date, note, is_refund
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb));

  insert into public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  select id, v_uid, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb));

  insert into public.budgets (id, user_id, category_id, month, "limit")
  select id, v_uid, category_id, month, "limit"
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb));

  insert into public.income_goals (id, user_id, category_id, month, expected)
  select id, v_uid, category_id, month, expected
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb));

  insert into public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  select id, v_uid, occurrence_key, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  select id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  select id, v_uid, asset_id, type, date, quantity, price, total
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb));

  insert into public.allocation_targets (id, user_id, asset_id, target_percentage)
  select id, v_uid, asset_id, target_percentage
  from jsonb_populate_recordset(null::public.allocation_targets, coalesce(v_data -> 'allocation_targets', '[]'::jsonb));

  insert into public.class_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, group_type, name, target_percentage
  from jsonb_populate_recordset(null::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb));

  insert into public.sector_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, group_type, name, target_percentage
  from jsonb_populate_recordset(null::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  insert into public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, updated_at)
  select id, v_uid, ticker, price, currency, source, manual_price, updated_at
  from jsonb_populate_recordset(null::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb));

  -- ------------------------------------------------------------------
  -- 3) Auditoria (D2) + resumo
  -- ------------------------------------------------------------------
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

grant execute on function public.restore_backup(jsonb) to authenticated;
