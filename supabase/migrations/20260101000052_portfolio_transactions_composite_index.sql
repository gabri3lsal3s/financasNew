-- Migration: 20260101000052_portfolio_transactions_composite_index.sql
-- FASE 3: Otimização de Banco de Dados Supabase — Índice Composto Complementar em portfolio_transactions (Tarefa 3.3)
--
-- MOTIVAÇÃO E EXPLICAÇÃO TÉCNICA:
-- As consultas de ficha detalhada de ativos e histórico de transações
-- (src/data/repositories/portfolio.ts -> listPortfolioTransactions) filtram por
-- `asset_id` sob a cláusula RLS que injeta `user_id = (select auth.uid())` e ordenam por data.
--
-- O índice composto cobridor `(user_id, asset_id, date desc)` permite ao
-- planejador do PostgreSQL resolver a restrição multi-tenant (user_id),
-- o filtro do ativo específico (asset_id) e a ordenação cronológica (date desc/asc)
-- em um único Index Scan direto, eliminando sequential scans e etapas de Sort em memória.

create index if not exists idx_portfolio_tx_user_asset_date
  on public.portfolio_transactions (user_id, asset_id, date desc);
