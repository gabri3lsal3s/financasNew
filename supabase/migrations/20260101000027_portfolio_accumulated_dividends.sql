-- ----------------------------------------------------------------
-- Migração 20260101000027: Proventos Acumulados e Estimativa de Dividendo/Cota
-- ----------------------------------------------------------------
-- Objetivo:
--   1. accumulated_dividends: proventos históricos anteriores ao extrato periódico.
--      Alimenta o YoC (Yield on Cost) sem entrar no calendário/extrato mensal.
--   2. estimated_monthly_dividend_per_share: estimativa de dividendo mensal por cota
--      (na moeda nativa do ativo). Alimenta a Bola de Neve quando o ativo não possui
--      lançamentos periódicos em portfolio_dividends (Cenário B).
-- ----------------------------------------------------------------

alter table public.portfolio_assets
  add column if not exists accumulated_dividends numeric(14, 2)
    not null default 0 check (accumulated_dividends >= 0),
  add column if not exists estimated_monthly_dividend_per_share numeric(12, 6)
    not null default 0 check (estimated_monthly_dividend_per_share >= 0);

comment on column public.portfolio_assets.accumulated_dividends is
  'Proventos históricos acumulados anteriores ao extrato periódico (portfolio_dividends). '
  'Alimenta YoC e Bola de Neve sem distorcer o calendário/extrato mensal.';

comment on column public.portfolio_assets.estimated_monthly_dividend_per_share is
  'Dividendo mensal estimado por cota (moeda nativa do ativo). Alimenta a Bola de Neve '
  'quando não há lançamentos periódicos em portfolio_dividends (Cenário B).';
