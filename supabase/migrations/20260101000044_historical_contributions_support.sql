-- Migration: Suporte a múltiplos Marcos Históricos do Bolso (Linha do Tempo de Aportes Anteriores ao App)
-- ============================================================================
-- Permite que o investidor registre múltiplos marcos de capital inicial/histórico
-- em datas diferentes (ex.: início da jornada, aportes em massa, aportes acumulados),
-- garantindo granularidade cirúrgica para a Taxa Interna de Retorno (TIR / XIRR).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: Criação segura de Aporte Histórico do Bolso
-- Insere o registro em portfolio_contributions com asset_id = NULL e user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_historical_contribution(
  p_date    DATE,
  p_amount  NUMERIC,
  p_notes   TEXT DEFAULT 'Marco Histórico do Bolso'
)
RETURNS public.portfolio_contributions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  public.portfolio_contributions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do aporte histórico deve ser maior que zero.';
  END IF;

  INSERT INTO public.portfolio_contributions (
    user_id,
    asset_id,
    date,
    amount,
    notes
  )
  VALUES (
    v_user_id,
    NULL,
    p_date,
    p_amount,
    COALESCE(NULLIF(TRIM(p_notes), ''), 'Marco Histórico do Bolso')
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_historical_contribution(DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_historical_contribution(DATE, NUMERIC, TEXT) TO authenticated;
