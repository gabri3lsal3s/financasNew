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
--   3. Defensividade:
--      Verifica a existência de cada tabela antes de criar o índice.
-- ================================================================

do $$
begin
  -- 1. expenses
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'expenses') then
    execute 'create index if not exists idx_expenses_user_date_covering on public.expenses (user_id, date desc) include (category_id, amount_cents, payment_method, report_weight, card_id, installment_group_id);';
  end if;

  -- 2. incomes
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'incomes') then
    execute 'create index if not exists idx_incomes_user_date_covering on public.incomes (user_id, date desc) include (category_id, amount_cents, receive_type, report_weight);';
  end if;

  -- 3. debts
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'debts') then
    execute 'create index if not exists idx_debts_user_covering on public.debts (user_id, type) include (total_amount_cents, remaining_amount_cents, due_date);';
  end if;

  -- 4. portfolio_assets
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portfolio_assets') then
    execute 'create index if not exists idx_portfolio_assets_user_covering on public.portfolio_assets (user_id, asset_class) include (ticker, quantity, average_price, currency);';
  end if;

  -- 5. audit_events
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_events') then
    execute 'create index if not exists idx_audit_events_user_created on public.audit_events (user_id, created_at desc);';
  end if;

  -- 6. budgets
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'budgets') then
    execute 'create index if not exists idx_budgets_user_category_month on public.budgets (user_id, category_id, month);';
  end if;

  -- 7. recurrences
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurrences') then
    execute 'create index if not exists idx_recurrences_user_active_covering on public.recurrences (user_id, is_active, start_date) include (frequency, amount_cents, type, category_id);';
  end if;
end $$;
