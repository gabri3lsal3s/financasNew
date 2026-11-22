-- ==============================================================================
-- Migração 20260101000133: Preço Teto, Valuation & Mesa de Consenso Multimodelo
-- Suporte a Bazin, Graham, Gordon, P/VP, P/L e Regra de Prudência
-- ==============================================================================

-- 1. Novos campos de valuation e preço teto em portfolio_assets
alter table public.portfolio_assets
  add column if not exists ceiling_price numeric(15,4) check (ceiling_price is null or ceiling_price >= 0),
  add column if not exists ceiling_method text default null
    check (ceiling_method is null or ceiling_method in (
      'manual',
      'bazin',
      'graham',
      'gordon',
      'multiple',
      'pvp',
      'hybrid_fii',
      'conservative',
      'average'
    )),
  add column if not exists ceiling_metadata jsonb default null;

-- 2. Índice parcial para aceleração de consultas de ativos com Preço Teto cadastrado
create index if not exists idx_portfolio_assets_ceiling_price
  on public.portfolio_assets (user_id, ticker)
  where ceiling_price is not null;

-- 3. Notifica o PostgREST para recarga de schema imediata
notify pgrst, 'reload schema';
