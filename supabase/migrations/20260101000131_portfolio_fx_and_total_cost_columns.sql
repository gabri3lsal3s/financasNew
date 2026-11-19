-- ============================================================================
-- Migration: 20260101000131_portfolio_fx_and_total_cost_columns.sql
-- Descrição: Adiciona colunas de custo em BRL e taxa cambial em portfolio_assets
--            e portfolio_transactions para suporte multi-moeda e invariância cambial (§Investimentos).
-- ============================================================================

-- 1. Tabela public.portfolio_assets
alter table public.portfolio_assets
  add column if not exists total_cost_brl numeric(18, 2),
  add column if not exists average_cost_brl numeric(18, 4),
  add column if not exists fx_rate_at_purchase numeric(18, 4);

-- Constraints de validação
alter table public.portfolio_assets
  drop constraint if exists portfolio_assets_total_cost_brl_check;
alter table public.portfolio_assets
  add constraint portfolio_assets_total_cost_brl_check
    check (total_cost_brl is null or total_cost_brl >= 0);

alter table public.portfolio_assets
  drop constraint if exists portfolio_assets_average_cost_brl_check;
alter table public.portfolio_assets
  add constraint portfolio_assets_average_cost_brl_check
    check (average_cost_brl is null or average_cost_brl >= 0);

alter table public.portfolio_assets
  drop constraint if exists portfolio_assets_fx_rate_at_purchase_check;
alter table public.portfolio_assets
  add constraint portfolio_assets_fx_rate_at_purchase_check
    check (fx_rate_at_purchase is null or fx_rate_at_purchase > 0);

comment on column public.portfolio_assets.total_cost_brl is
  'Custo total histórico de aquisição consolidado em reais (BRL).';
comment on column public.portfolio_assets.average_cost_brl is
  'Custo médio histórico de aquisição em reais (BRL).';
comment on column public.portfolio_assets.fx_rate_at_purchase is
  'Taxa de câmbio média de aquisição (R$ / Moeda) para ativos em moeda estrangeira.';

-- 2. Tabela public.portfolio_transactions
alter table public.portfolio_transactions
  add column if not exists total_cost_brl numeric(18, 2),
  add column if not exists fx_rate numeric(18, 4),
  add column if not exists notes text;

-- Constraints de validação
alter table public.portfolio_transactions
  drop constraint if exists portfolio_transactions_total_cost_brl_check;
alter table public.portfolio_transactions
  add constraint portfolio_transactions_total_cost_brl_check
    check (total_cost_brl is null or total_cost_brl >= 0);

alter table public.portfolio_transactions
  drop constraint if exists portfolio_transactions_fx_rate_check;
alter table public.portfolio_transactions
  add constraint portfolio_transactions_fx_rate_check
    check (fx_rate is null or fx_rate > 0);

comment on column public.portfolio_transactions.total_cost_brl is
  'Valor financeiro total convertido em BRL na data da operação.';
comment on column public.portfolio_transactions.fx_rate is
  'Taxa de câmbio negociada / PTAX na data da operação.';
comment on column public.portfolio_transactions.notes is
  'Observações livres ou anotações da transação no ledger.';
