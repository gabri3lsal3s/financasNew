-- Migration 0081: Vinculação de Proventos ao Ativo Caixa (Liquidação e Estorno)
-- Adiciona colunas para rastrear se o provento alimentou o saldo de Caixa da carteira
-- e o valor exato em BRL creditado.

alter table public.portfolio_dividends
  add column if not exists sync_cash boolean not null default false,
  add column if not exists cash_amount numeric(12, 2);

comment on column public.portfolio_dividends.sync_cash is 'Indica se o provento foi creditado diretamente no ativo Caixa para reinvestimento.';
comment on column public.portfolio_dividends.cash_amount is 'Valor em BRL creditado no saldo de Caixa na data do provento.';
