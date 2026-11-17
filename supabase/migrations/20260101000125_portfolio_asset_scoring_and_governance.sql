-- ==============================================================================
-- Migração 20260101000125: Governança por Notas, Quarentenas e Diário de Bordo
-- Fase 41 (Roadmap v3.9.0) — Sistema de Ranqueamento de Ativos e Meta Única
-- ==============================================================================

-- 1. Novos campos de governança fundamentalista em portfolio_assets
alter table public.portfolio_assets
  add column if not exists score smallint check (score >= 0 and score <= 10),
  add column if not exists allocation_status text not null default 'active'
    check (allocation_status in ('active', 'neutral', 'quarantine', 'exit')),
  add column if not exists score_criteria jsonb default '{}'::jsonb,
  add column if not exists last_reviewed_at timestamptz default now(),
  add column if not exists review_frequency_months smallint not null default 6,
  add column if not exists thesis_summary text;

-- 2. Índice composto para aceleração de filtros de auditoria e revisão pendente
create index if not exists idx_portfolio_assets_review_status
  on public.portfolio_assets (user_id, last_reviewed_at, allocation_status);

-- 3. Descomissionamento limpo e seguro da tabela legada allocation_presets
drop table if exists public.allocation_presets cascade;

-- 4. Notifica o PostgREST para recarga de schema imediata
notify pgrst, 'reload schema';
