-- ----------------------------------------------------------------
-- Override manual de preço (D5 — §1.6): um por ticker por usuário.
-- O cache global (user_id NULL) é escrito pela edge function e pode
-- ter múltiplas linhas por ticker (histórico) — o unique é parcial
-- apenas para os overrides do usuário (user_id IS NOT NULL).
-- ----------------------------------------------------------------
create unique index idx_asset_prices_manual_unique
  on public.asset_prices (ticker, user_id)
  where user_id is not null;
