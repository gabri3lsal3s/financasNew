-- ----------------------------------------------------------------
-- Migração 20260101000034: Metadados de Renda Fixa Parametrizada
-- ----------------------------------------------------------------
-- Objetivo:
--   Suporte a títulos de Renda Fixa privada e Tesouro Direto com
--   parametrização de Marco Zero (D₀), taxa acordada, indexador,
--   vencimento, data original de aplicação e isenção tributária.
-- ----------------------------------------------------------------

alter table public.portfolio_assets
  add column if not exists fixed_income_metadata jsonb default null;

comment on column public.portfolio_assets.fixed_income_metadata is
  'Metadados de títulos de renda fixa (rate_type, rate_value, base_date, initial_investment_date, maturity_date, is_tax_exempt).';

-- Índice para consultas filtradas por ativos com parametrização de renda fixa
create index if not exists idx_portfolio_assets_fixed_income
  on public.portfolio_assets using gin (fixed_income_metadata)
  where fixed_income_metadata is not null;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
notify pgrst, 'reload schema';
