-- ----------------------------------------------------------------
-- Migração 20260101000023: Integridade Relacional e Preservação de Proventos
-- ----------------------------------------------------------------

-- 1. Permitir asset_id nulo e preservação do ticker em portfolio_dividends
alter table public.portfolio_dividends
  alter column asset_id drop not null,
  add column if not exists ticker text;

-- 2. Atualizar a foreign key de portfolio_dividends para ON DELETE SET NULL
alter table public.portfolio_dividends
  drop constraint if exists portfolio_dividends_asset_id_fkey,
  add constraint portfolio_dividends_asset_id_fkey
    foreign key (asset_id) references public.portfolio_assets (id) on delete set null;

-- 3. Preencher a coluna ticker com base nos ativos existentes
update public.portfolio_dividends d
set ticker = a.ticker
from public.portfolio_assets a
where d.asset_id = a.id and (d.ticker is null or d.ticker = '');
