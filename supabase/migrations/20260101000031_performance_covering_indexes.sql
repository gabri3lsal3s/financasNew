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
drop index if exists public.idx_expenses_user_date_covering;
create index if not exists idx_expenses_user_date_covering
  on public.expenses (user_id, date desc)
  include (category_id, value, payment_method, report_weight, card_id, installment_group_id);

-- 2. incomes: índice cobridor por usuário e data decrescente
drop index if exists public.idx_incomes_user_date_covering;
create index if not exists idx_incomes_user_date_covering
  on public.incomes (user_id, date desc)
  include (category_id, value, receive_type, report_weight);

-- 3. debts: índice por usuário e tipo com valores cobridores
drop index if exists public.idx_debts_user_covering;
create index if not exists idx_debts_user_covering
  on public.debts (user_id, type)
  include (amount, due_date, paid_at);

-- 4. portfolio_assets: índice cobridor por usuário e classe de ativos
drop index if exists public.idx_portfolio_assets_user_covering;
create index if not exists idx_portfolio_assets_user_covering
  on public.portfolio_assets (user_id, asset_class)
  include (ticker, currency);

-- 5. audit_events: índice para histórico cronológico e timeline
drop index if exists public.idx_audit_events_user_created;
create index if not exists idx_audit_events_user_created
  on public.audit_events (user_id, created_at desc);

-- 6. budgets: índice de vigência e categoria
drop index if exists public.idx_budgets_user_category_month;
create index if not exists idx_budgets_user_category_month
  on public.budgets (user_id, category_id, month)
  include ("limit");

-- 7. recurrences: índice cobridor de recorrências ativas (se a tabela existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurrences') then
    execute 'drop index if exists public.idx_recurrences_user_active_covering;';
    execute 'create index if not exists idx_recurrences_user_active_covering on public.recurrences (user_id, is_active, start_date) include (frequency, value, kind, category_id);';
  end if;
end $$;
