-- ---------------------------------------------------------------------------
-- Migration 0016: Constraint UNIQUE para asset_prices (ticker, user_id)
-- Permite operações de ON CONFLICT e garante integridade do override manual
-- ---------------------------------------------------------------------------

-- Remove o índice parcial anterior se existir
drop index if exists public.idx_asset_prices_manual_unique;

-- Adiciona a constraint UNIQUE (ticker, user_id)
alter table public.asset_prices
  drop constraint if exists asset_prices_ticker_user_id_key;

alter table public.asset_prices
  add constraint asset_prices_ticker_user_id_key unique (ticker, user_id);
