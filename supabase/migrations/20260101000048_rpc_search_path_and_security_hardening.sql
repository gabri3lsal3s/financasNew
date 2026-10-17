-- ================================================================
-- 0048_rpc_search_path_and_security_hardening.sql
-- Blindagem de Funções RPC e Sanitização de Search Path (§Fase 5.2)
--
-- Objetivos:
--   1. Sanitização estrita de search_path em 100% das funções SECURITY DEFINER:
--      - Fixar 'set search_path = public, pg_temp' em public.upsert_marco_zero
--        e public.create_historical_contribution, eliminando riscos de search path hijacking.
--   2. Blindagem de autorização SaaS e integridade em portfolio_contributions:
--      - Validar auth.uid(), public.is_current_user_active() e
--        public.can_current_user_write_module('investments') em ambas as RPCs;
--      - Validar valores estritamente positivos (p_amount > 0).
-- ================================================================

-- 1. Redefinição blindada de public.upsert_marco_zero
CREATE OR REPLACE FUNCTION public.upsert_marco_zero(
  p_date    DATE,
  p_amount  NUMERIC,
  p_notes   TEXT DEFAULT 'Marco Zero do Bolso · Custo Histórico Inicial'
)
RETURNS public.portfolio_contributions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  public.portfolio_contributions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Investimentos requerida.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do marco zero deve ser maior que zero.';
  END IF;

  -- Remove marcos zeros anteriores do usuário
  DELETE FROM public.portfolio_contributions
  WHERE
    user_id = v_user_id
    AND asset_id IS NULL
    AND (
      LOWER(COALESCE(notes, '')) LIKE '%marco zero%'
      OR LOWER(COALESCE(notes, '')) LIKE '%custo inicial%'
      OR LOWER(COALESCE(notes, '')) LIKE '%histórico inicial%'
    );

  -- Insere o novo registro calibrado
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
    COALESCE(NULLIF(TRIM(p_notes), ''), 'Marco Zero do Bolso · Custo Histórico Inicial')
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_marco_zero(DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_marco_zero(DATE, NUMERIC, TEXT) TO authenticated;

-- 2. Redefinição blindada de public.create_historical_contribution
CREATE OR REPLACE FUNCTION public.create_historical_contribution(
  p_date    DATE,
  p_amount  NUMERIC,
  p_notes   TEXT DEFAULT 'Marco Histórico do Bolso'
)
RETURNS public.portfolio_contributions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  public.portfolio_contributions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Investimentos requerida.';
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
