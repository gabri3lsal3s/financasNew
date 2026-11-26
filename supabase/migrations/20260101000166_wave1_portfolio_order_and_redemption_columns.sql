-- =============================================================================
-- Migration 0166: Onda 1 (T1.7 / T1.8) — Colunas de Resgate RF & Ordem Atômica
-- =============================================================================
-- 1. Adiciona colunas numéricas estruturadas de resgate em portfolio_transactions
--    (cost_basis_realized, iof_withheld, ir_withheld, net_realized_amount,
--    gross_realized_pnl, net_realized_pnl) e request_id para idempotência.
-- 2. Cria RPC transacional idempotente execute_portfolio_order_atomic().
-- =============================================================================

ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS cost_basis_realized numeric,
  ADD COLUMN IF NOT EXISTS iof_withheld numeric,
  ADD COLUMN IF NOT EXISTS ir_withheld numeric,
  ADD COLUMN IF NOT EXISTS net_realized_amount numeric,
  ADD COLUMN IF NOT EXISTS gross_realized_pnl numeric,
  ADD COLUMN IF NOT EXISTS net_realized_pnl numeric;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_transactions_user_request_id
  ON public.portfolio_transactions (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.execute_portfolio_order_atomic(
  p_request_id uuid,
  p_asset_id uuid,
  p_type text,
  p_date date,
  p_quantity numeric,
  p_price numeric,
  p_total numeric,
  p_notes text DEFAULT NULL,
  p_fx_rate numeric DEFAULT NULL,
  p_total_cost_brl numeric DEFAULT NULL,
  p_new_quantity numeric DEFAULT NULL,
  p_new_average_price numeric DEFAULT NULL,
  p_new_total_cost_brl numeric DEFAULT NULL,
  p_new_average_cost_brl numeric DEFAULT NULL,
  p_new_fx_rate_at_purchase numeric DEFAULT NULL,
  p_fixed_income_metadata jsonb DEFAULT NULL,
  p_cash_asset_id uuid DEFAULT NULL,
  p_new_cash_quantity numeric DEFAULT NULL,
  p_contribution_amount numeric DEFAULT NULL,
  p_contribution_notes text DEFAULT NULL,
  p_cost_basis_realized numeric DEFAULT NULL,
  p_iof_withheld numeric DEFAULT NULL,
  p_ir_withheld numeric DEFAULT NULL,
  p_net_realized_amount numeric DEFAULT NULL,
  p_gross_realized_pnl numeric DEFAULT NULL,
  p_net_realized_pnl numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_tx_id uuid;
  v_tx_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado: conta sem permissão de escrita em investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx_id
    FROM public.portfolio_transactions
    WHERE user_id = v_uid
      AND request_id = p_request_id
    LIMIT 1;

    IF v_existing_tx_id IS NOT NULL THEN
      RETURN jsonb_build_object('applied', false, 'duplicate', true, 'transaction_id', v_existing_tx_id);
    END IF;
  END IF;

  INSERT INTO public.portfolio_transactions (
    user_id, asset_id, type, date, quantity, price, total, notes,
    fx_rate, total_cost_brl, request_id,
    cost_basis_realized, iof_withheld, ir_withheld, net_realized_amount,
    gross_realized_pnl, net_realized_pnl
  )
  VALUES (
    v_uid, p_asset_id, p_type, p_date, p_quantity, p_price, p_total, p_notes,
    p_fx_rate, p_total_cost_brl, p_request_id,
    p_cost_basis_realized, p_iof_withheld, p_ir_withheld, p_net_realized_amount,
    p_gross_realized_pnl, p_net_realized_pnl
  )
  RETURNING id INTO v_tx_id;

  IF p_new_quantity IS NOT NULL OR p_new_average_price IS NOT NULL THEN
    UPDATE public.portfolio_assets
    SET
      quantity = coalesce(p_new_quantity, quantity),
      average_price = coalesce(p_new_average_price, average_price),
      total_cost_brl = coalesce(p_new_total_cost_brl, total_cost_brl),
      average_cost_brl = coalesce(p_new_average_cost_brl, average_cost_brl),
      fx_rate_at_purchase = coalesce(p_new_fx_rate_at_purchase, fx_rate_at_purchase),
      fixed_income_metadata = coalesce(p_fixed_income_metadata, fixed_income_metadata),
      updated_at = now()
    WHERE id = p_asset_id
      AND user_id = v_uid;
  END IF;

  IF p_cash_asset_id IS NOT NULL AND p_new_cash_quantity IS NOT NULL THEN
    UPDATE public.portfolio_assets
    SET
      quantity = greatest(0, p_new_cash_quantity),
      average_price = 1,
      updated_at = now()
    WHERE id = p_cash_asset_id
      AND user_id = v_uid;
  END IF;

  IF p_contribution_amount IS NOT NULL AND p_contribution_amount > 0 THEN
    INSERT INTO public.portfolio_contributions (user_id, asset_id, date, amount, notes)
    VALUES (v_uid, p_asset_id, p_date, p_contribution_amount, p_contribution_notes);
  END IF;

  RETURN jsonb_build_object('applied', true, 'duplicate', false, 'transaction_id', v_tx_id);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_portfolio_order_atomic(
  uuid, uuid, text, date, numeric, numeric, numeric, text, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, uuid, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_portfolio_order_atomic(
  uuid, uuid, text, date, numeric, numeric, numeric, text, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, uuid, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, numeric
) TO authenticated;

NOTIFY pgrst, 'reload schema';
