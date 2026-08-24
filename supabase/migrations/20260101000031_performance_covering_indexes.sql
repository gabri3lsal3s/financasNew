-- ================================================================
-- 0031_performance_covering_indexes.sql — Índices Compostos e Cobridores (§F46)
--
-- Objetivos de Performance:
--   1. Índices Compostos e Cobridores (Index-Only Scans com INCLUDE):
--      Permitem que consultas filtradas por (user_id, date) obtenham colunas vitais
--      (valores, categorias, pesos, formas de pagamento) diretamente da árvore B-tree
--      do índice sem tocar as páginas do heap da tabela.
--   2. Aceleração de Dashboards, Fechamentos, Relatórios e Consultoria:
--      Tempo de resposta submilisegundo em agregações e projeções de grande volume.
-- ================================================================

-- 1. expenses: índice cobridor por usuário e data decrescente
create index if not exists idx_expenses_user_date_covering
  on public.expenses (user_id, date desc)
  include (category_id, amount_cents, payment_method, report_weight, card_id, installment_group_id);

-- 2. incomes: índice cobridor por usuário e data decrescente
create index if not exists idx_incomes_user_date_covering
  on public.incomes (user_id, date desc)
  include (category_id, amount_cents, receive_type, report_weight);

-- 3. debts: índice por usuário e tipo com valores cobridores
create index if not exists idx_debts_user_covering
  on public.debts (user_id, type)
  include (total_amount_cents, remaining_amount_cents, due_date);

-- 4. portfolio_assets: índice cobridor por usuário e classe de ativos
create index if not exists idx_portfolio_assets_user_covering
  on public.portfolio_assets (user_id, asset_class)
  include (ticker, quantity, average_price, currency);

-- 5. audit_events: índice para histórico cronológico e timeline
create index if not exists idx_audit_events_user_created
  on public.audit_events (user_id, created_at desc);

-- 6. budgets: índice de vigência e categoria
create index if not exists idx_budgets_user_category_month
  on public.budgets (user_id, category_id, month);

-- 7. recurrences: índice cobridor de recorrências ativas
create index if not exists idx_recurrences_user_active_covering
  on public.recurrences (user_id, is_active, start_date)
  include (frequency, amount_cents, type, category_id);
