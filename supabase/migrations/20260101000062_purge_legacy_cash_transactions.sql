-- Migration: 20260101000062_purge_legacy_cash_transactions.sql
-- Descrição: Remove pseudo-transações legadas de compra/venda de Caixa em portfolio_transactions.
-- O saldo de liquidez permanece fielmente preservado em portfolio_assets.quantity.

delete from public.portfolio_transactions
where asset_id in (
  select id from public.portfolio_assets
  where asset_class = 'Caixa' or upper(ticker) = 'CAIXA'
);
