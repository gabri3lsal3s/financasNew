-- =============================================================================
-- Migration 0167: Onda 3 (T3.5) — Atomicidade e Idempotência em Lotes
-- =============================================================================
-- 1. Tabelas de recibos idempotentes (RLS por usuário) para:
--    - portfolio_import_receipts
--    - portfolio_milestone_receipts
--    - statement_reconciliation_receipts
-- 2. RPC import_portfolio_atomic(): cria/atualiza ativos + transações em 1 transação.
-- 3. RPC save_pocket_cost_milestone_atomic(): salva marco + snapshot em 1 transação.
-- 4. RPC commit_statement_reconciliation_batch(): wrapper idempotente por (import_id, chunk_index).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_import_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.portfolio_import_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_import_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portfolio_import_receipts TO authenticated;

DROP POLICY IF EXISTS "portfolio_import_receipts_own" ON public.portfolio_import_receipts;
CREATE POLICY "portfolio_import_receipts_own"
  ON public.portfolio_import_receipts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.portfolio_milestone_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.portfolio_milestone_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_milestone_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portfolio_milestone_receipts TO authenticated;

DROP POLICY IF EXISTS "portfolio_milestone_receipts_own" ON public.portfolio_milestone_receipts;
CREATE POLICY "portfolio_milestone_receipts_own"
  ON public.portfolio_milestone_receipts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.statement_reconciliation_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  card_id uuid NOT NULL,
  competence_month text NOT NULL,
  plan_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, import_id, chunk_index)
);

ALTER TABLE public.statement_reconciliation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.statement_reconciliation_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.statement_reconciliation_receipts TO authenticated;

DROP POLICY IF EXISTS "statement_reconciliation_receipts_own" ON public.statement_reconciliation_receipts;
CREATE POLICY "statement_reconciliation_receipts_own"
  ON public.statement_reconciliation_receipts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- RPC 1: import_portfolio_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_portfolio_atomic(
  p_request_id uuid,
  p_assets_to_create jsonb DEFAULT '[]'::jsonb,
  p_assets_to_update jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing jsonb;
  v_item jsonb;
  v_patch jsonb;
  v_asset_id uuid;
  v_ticker text;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_tx_count integer := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'p_request_id é obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('import_portfolio_atomic:' || v_uid::text || ':' || p_request_id::text)
  );

  SELECT result INTO v_existing
  FROM public.portfolio_import_receipts
  WHERE user_id = v_uid AND request_id = p_request_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  -- 1. Criar novos ativos
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_assets_to_create, '[]'::jsonb))
  LOOP
    v_ticker := UPPER(TRIM(v_item->>'ticker'));
    INSERT INTO public.portfolio_assets (
      user_id, ticker, asset_class, sector, currency, quantity, average_price, fixed_income_metadata
    )
    VALUES (
      v_uid,
      v_ticker,
      NULLIF(TRIM(v_item->>'asset_class'), ''),
      NULLIF(TRIM(v_item->>'sector'), ''),
      COALESCE(NULLIF(TRIM(v_item->>'currency'), ''), 'BRL'),
      COALESCE((v_item->>'quantity')::numeric, 0),
      COALESCE((v_item->>'average_price')::numeric, 0),
      CASE
        WHEN v_item ? 'fixed_income_metadata' AND jsonb_typeof(v_item->'fixed_income_metadata') = 'object'
        THEN v_item->'fixed_income_metadata'
        ELSE NULL
      END
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  -- 2. Atualizar ativos existentes (suporta { id, patch: { quantity, average_price, asset_class } } e formato plano)
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_assets_to_update, '[]'::jsonb))
  LOOP
    v_patch := COALESCE(v_item->'patch', v_item);
    UPDATE public.portfolio_assets
    SET
      quantity = COALESCE((v_patch->>'quantity')::numeric, quantity),
      average_price = COALESCE((v_patch->>'average_price')::numeric, average_price),
      asset_class = COALESCE(NULLIF(TRIM(v_patch->>'asset_class'), ''), asset_class),
      updated_at = now()
    WHERE id = (v_item->>'id')::uuid
      AND user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ativo % não encontrado para atualização.', v_item->>'id' USING ERRCODE = 'P0002';
    END IF;
    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- 3. Inserir transações resolvendo asset_id por id ou ticker (sempre validando user_id)
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_transactions, '[]'::jsonb))
  LOOP
    v_asset_id := NULLIF(TRIM(v_item->>'asset_id'), '')::uuid;
    IF v_asset_id IS NOT NULL THEN
      SELECT id INTO v_asset_id
      FROM public.portfolio_assets
      WHERE id = v_asset_id AND user_id = v_uid;
    ELSE
      v_ticker := UPPER(TRIM(v_item->>'ticker'));
      SELECT id INTO v_asset_id
      FROM public.portfolio_assets
      WHERE user_id = v_uid AND UPPER(TRIM(ticker)) = v_ticker
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'Ativo não localizado para transação (%).', COALESCE(v_item->>'ticker', '?') USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.portfolio_transactions (
      user_id, asset_id, type, date, quantity, price, total, notes
    )
    VALUES (
      v_uid,
      v_asset_id,
      v_item->>'type',
      (v_item->>'date')::date,
      (v_item->>'quantity')::numeric,
      (v_item->>'price')::numeric,
      (v_item->>'total')::numeric,
      NULLIF(v_item->>'notes', '')
    );
    v_tx_count := v_tx_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'created_assets', v_created_count,
    'updated_assets', v_updated_count,
    'inserted_transactions', v_tx_count
  );

  INSERT INTO public.portfolio_import_receipts (user_id, request_id, result)
  VALUES (v_uid, p_request_id, v_result)
  ON CONFLICT (user_id, request_id) DO NOTHING;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_portfolio_atomic(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_portfolio_atomic(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC 2: save_pocket_cost_milestone_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_pocket_cost_milestone_atomic(
  p_request_id uuid,
  p_contribution_id uuid DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_snapshot_month text DEFAULT NULL,
  p_snapshot_total_value numeric DEFAULT NULL,
  p_snapshot_total_cost numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing jsonb;
  v_contrib_id uuid := p_contribution_id;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'p_request_id é obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('save_pocket_cost_milestone_atomic:' || v_uid::text || ':' || p_request_id::text)
  );

  SELECT result INTO v_existing
  FROM public.portfolio_milestone_receipts
  WHERE user_id = v_uid AND request_id = p_request_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  IF p_amount IS NOT NULL AND p_amount > 0 AND p_date IS NOT NULL THEN
    IF p_contribution_id IS NOT NULL THEN
      UPDATE public.portfolio_contributions
      SET date = p_date, amount = p_amount, notes = p_notes
      WHERE id = p_contribution_id AND user_id = v_uid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Marco histórico não encontrado.' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      INSERT INTO public.portfolio_contributions (user_id, asset_id, date, amount, notes)
      VALUES (v_uid, NULL, p_date, p_amount, p_notes)
      RETURNING id INTO v_contrib_id;
    END IF;
  END IF;

  IF p_snapshot_month IS NOT NULL AND p_snapshot_total_value IS NOT NULL AND p_snapshot_total_value > 0 THEN
    -- Usa caminho canônico (00130) para preservar auditoria de calibração e contexto app.snapshot_rpc='on'
    PERFORM public.calibrate_portfolio_snapshot(
      p_snapshot_month,
      p_snapshot_total_value,
      COALESCE(p_snapshot_total_cost, 0)
    );
    IF p_date IS NOT NULL THEN
      UPDATE public.portfolio_snapshots
      SET closing_date = COALESCE(closing_date, p_date)
      WHERE user_id = v_uid AND month = p_snapshot_month;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'contribution_id', v_contrib_id,
    'snapshot_month', p_snapshot_month
  );

  INSERT INTO public.portfolio_milestone_receipts (user_id, request_id, result)
  VALUES (v_uid, p_request_id, v_result)
  ON CONFLICT (user_id, request_id) DO NOTHING;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_pocket_cost_milestone_atomic(
  uuid, uuid, date, numeric, text, text, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_pocket_cost_milestone_atomic(
  uuid, uuid, date, numeric, text, text, numeric, numeric
) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC 3: commit_statement_reconciliation_batch (idempotente por chunk + plano)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_statement_reconciliation_batch(
  p_import_id uuid,
  p_chunk_index integer,
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb DEFAULT '[]'::jsonb,
  p_link_adjustments jsonb DEFAULT '[]'::jsonb,
  p_competence_moves jsonb DEFAULT '[]'::jsonb,
  p_refunds jsonb DEFAULT '[]'::jsonb,
  p_delete_expense_ids uuid[] DEFAULT '{}'::uuid[],
  p_plan_hash text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.statement_reconciliation_receipts%ROWTYPE;
  v_result jsonb;
  v_effective_hash text := COALESCE(NULLIF(TRIM(p_plan_hash), ''), p_import_id::text);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_import_id IS NULL OR p_chunk_index IS NULL OR p_chunk_index < 0 THEN
    RAISE EXCEPTION 'p_import_id e p_chunk_index são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(
      'commit_statement_reconciliation_batch:' || v_uid::text || ':' || p_import_id::text || ':' || p_chunk_index::text
    )
  );

  SELECT * INTO v_existing
  FROM public.statement_reconciliation_receipts
  WHERE user_id = v_uid AND import_id = p_import_id AND chunk_index = p_chunk_index;

  IF FOUND THEN
    IF v_existing.card_id <> p_card_id
      OR v_existing.competence_month <> p_competence_month
      OR v_existing.plan_hash <> v_effective_hash THEN
      RAISE EXCEPTION 'Conflito de escopo ou plano para este import_id.' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent', true);
  END IF;

  v_result := public.commit_statement_reconciliation(
    p_card_id,
    p_competence_month,
    p_expenses,
    p_link_adjustments,
    p_competence_moves,
    p_refunds,
    p_delete_expense_ids
  );

  INSERT INTO public.statement_reconciliation_receipts (
    user_id, import_id, chunk_index, card_id, competence_month, plan_hash, result
  )
  VALUES (
    v_uid, p_import_id, p_chunk_index, p_card_id, p_competence_month, v_effective_hash, v_result
  )
  ON CONFLICT (user_id, import_id, chunk_index) DO NOTHING;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_statement_reconciliation_batch(
  uuid, integer, uuid, text, jsonb, jsonb, jsonb, jsonb, uuid[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_statement_reconciliation_batch(
  uuid, integer, uuid, text, jsonb, jsonb, jsonb, jsonb, uuid[], text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_statement_reconciliation_receipts(
  p_import_id uuid,
  p_card_id uuid,
  p_competence_month text,
  p_plan_hash text DEFAULT ''
)
RETURNS TABLE (
  chunk_index integer,
  result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_effective_hash text := COALESCE(NULLIF(TRIM(p_plan_hash), ''), p_import_id::text);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.chunk_index, r.result
  FROM public.statement_reconciliation_receipts r
  WHERE r.user_id = v_uid
    AND r.import_id = p_import_id
    AND r.card_id = p_card_id
    AND r.competence_month = p_competence_month
    AND r.plan_hash = v_effective_hash
  ORDER BY r.chunk_index ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_statement_reconciliation_receipts(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_statement_reconciliation_receipts(uuid, uuid, text, text) TO authenticated;
