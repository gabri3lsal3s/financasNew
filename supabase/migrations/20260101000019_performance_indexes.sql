-- ============================================================================
-- Migration 20260101000019 — Índices Estruturais de Alta Performance
--
-- Elimina Sequential Scans em Foreign Keys, consultas compostas com RLS e
-- rotinas de agregação / materialização em lote.
-- ============================================================================

-- 1. Foreign Keys e filtros em Despesas (expenses)
create index if not exists idx_expenses_user_category on public.expenses (user_id, category_id);
create index if not exists idx_expenses_user_card on public.expenses (user_id, card_id) where card_id is not null;
create index if not exists idx_expenses_recurrence_lookup on public.expenses (recurrence_id, date) where recurrence_id is not null;

-- 2. Foreign Keys e filtros em Rendas (incomes)
create index if not exists idx_incomes_user_category on public.incomes (user_id, category_id);
create index if not exists idx_incomes_recurrence_lookup on public.incomes (recurrence_id, date) where recurrence_id is not null;
create index if not exists idx_incomes_installment_group on public.incomes (user_id, installment_group_id) where installment_group_id is not null;
create index if not exists idx_incomes_source_ref on public.incomes (user_id, source_ref) where source_ref is not null;

-- 3. Foreign Keys e filtros em Dívidas (debts)
create index if not exists idx_debts_expense_id on public.debts (expense_id) where expense_id is not null;
create index if not exists idx_debts_installment_group on public.debts (installment_group_id) where installment_group_id is not null;
create index if not exists idx_debts_user_status on public.debts (user_id, paid_at, due_date);

-- 4. Transações de Carteira (portfolio_transactions)
create index if not exists idx_portfolio_tx_user_date on public.portfolio_transactions (user_id, date desc);

-- 5. Pagamentos de Fatura (card_payments)
create index if not exists idx_card_payments_user_date on public.card_payments (user_id, date desc);

-- 6. Recorrências e Pulos de Ocorrência (recurrences & skips)
create index if not exists idx_recurrences_user_active on public.recurrences (user_id, is_active, kind);
create index if not exists idx_recurrence_skips_lookup on public.recurrence_skips (recurrence_id, occurrence_date);
