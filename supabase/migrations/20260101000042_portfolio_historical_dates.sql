-- ================================================================
-- 0042_portfolio_historical_dates.sql — Suporte a Histórico Anterior a 2026 (§Investimentos)
--
-- Objetivos:
--   1. Permitir que aportes externos (portfolio_contributions) registrem datas anteriores a 2026-01-01
--      (necessário para cadastrar o Marco Zero do Bolso com a data real em que o usuário começou a investir, ex: 2023, 2022);
--   2. Permitir que dividendos e proventos históricos (portfolio_dividends) aceitem datas anteriores a 2026;
--   3. Permitir que transações de ativos (portfolio_transactions) aceitem datas históricas completas (>= 2000-01-01);
--   4. Preservar a integridade relacional, as RLS policies e os triggers de segurança existentes.
-- ================================================================

-- 1. Tabela public.portfolio_contributions (Aportes do Bolso / Marco Zero)
alter table public.portfolio_contributions
  drop constraint if exists portfolio_contributions_date_check;

alter table public.portfolio_contributions
  add constraint portfolio_contributions_date_check
  check (date >= date '2000-01-01');

-- 2. Tabela public.portfolio_dividends (Extrato e Proventos Históricos)
alter table public.portfolio_dividends
  drop constraint if exists portfolio_dividends_date_check;

alter table public.portfolio_dividends
  add constraint portfolio_dividends_date_check
  check (date >= date '2000-01-01');

-- 3. Tabela public.portfolio_transactions (Transações de Ativos / Custódia Histórica)
alter table public.portfolio_transactions
  drop constraint if exists portfolio_transactions_date_check;

alter table public.portfolio_transactions
  add constraint portfolio_transactions_date_check
  check (date >= date '2000-01-01');

comment on constraint portfolio_contributions_date_check on public.portfolio_contributions is
  'Permite registros de aportes e marco zero do bolso desde 2000-01-01 para calibrar com exatidão a TIR histórica.';
