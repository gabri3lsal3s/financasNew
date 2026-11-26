-- =============================================================================
-- Migration 0161: Consenso Progressivo Privado & Publicação de Proventos (S5)
-- =============================================================================
-- Fatia S5 de `docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md` (§2, §4.2, §6):
--   1. Tabela privada `corporate_dividend_votes` (RLS forçado, zero acesso cliente)
--   2. Política `corporate_dividends_select` exigindo `published = true`
--   3. Configuração de publicação por mercado (default FALSE = coleta privada)
--   4. Auditoria agregada sem PII (`corporate_dividend_consensus_audit`)
--   5. RPCs de serviço: registro/recontagem, expurgo LGPD e kill switch
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.corporate_dividend_votes (
  event_key uuid NOT NULL,
  anchor_terms jsonb NOT NULL CHECK (jsonb_typeof(anchor_terms) = 'object'),
  voter_hash text NOT NULL CHECK (voter_hash ~ '^[0-9a-f]{64}$'),
  corporate_id uuid REFERENCES public.corporate_dividends(id) ON DELETE RESTRICT,
  ticker text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('BRL', 'USD')),
  com_date date NOT NULL,
  payment_date date NOT NULL CHECK (payment_date >= com_date),
  type text NOT NULL CHECK (type IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS')),
  gross_rate numeric(16,8) NOT NULL CHECK (gross_rate > 0 AND gross_rate <> 'NaN'::numeric),
  tax_rate_pct numeric(5,2) NOT NULL CHECK (tax_rate_pct BETWEEN 0 AND 100),
  signal text NOT NULL CHECK (signal IN ('dedup', 'edited', 'reverted')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_dividend_vote_lookup
  ON public.corporate_dividend_votes (ticker, currency, com_date, payment_date);

ALTER TABLE public.corporate_dividend_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_dividend_votes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.corporate_dividend_votes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_dividend_votes TO service_role;

CREATE POLICY corporate_dividend_votes_deny_client
  ON public.corporate_dividend_votes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.dividend_consensus_settings (
  market text PRIMARY KEY CHECK (market IN ('BR', 'US')),
  publication_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dividend_consensus_settings (market, publication_enabled)
VALUES ('BR', false), ('US', false)
ON CONFLICT (market) DO NOTHING;

ALTER TABLE public.dividend_consensus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_consensus_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dividend_consensus_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividend_consensus_settings TO service_role;

CREATE POLICY dividend_consensus_settings_deny_client
  ON public.dividend_consensus_settings
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.corporate_dividend_consensus_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key uuid NOT NULL,
  corporate_id uuid REFERENCES public.corporate_dividends(id) ON DELETE SET NULL,
  market text NOT NULL CHECK (market IN ('BR', 'US')),
  previous_tier text,
  new_tier text NOT NULL,
  reason text NOT NULL,
  score_decimos int NOT NULL,
  positives_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corporate_dividend_consensus_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_dividend_consensus_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_dividend_consensus_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_dividend_consensus_audit TO service_role;

CREATE POLICY corporate_dividend_consensus_audit_deny_client
  ON public.corporate_dividend_consensus_audit
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND false)
  WITH CHECK (false);

-- Contrato SQL de leitura do catálogo na 0161 (§2): exige published = true
DROP POLICY IF EXISTS corporate_dividends_select ON public.corporate_dividends;
CREATE POLICY corporate_dividends_select ON public.corporate_dividends
  FOR SELECT TO authenticated USING (
    published
    AND (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_read_module('investments'))
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.corporate_dividends
  FROM PUBLIC, anon, authenticated;

-- Helper HMAC-SHA256 por titular + event_key (hash distinto por evento)
CREATE OR REPLACE FUNCTION public.compute_dividend_voter_hash_internal(
  p_user_id uuid,
  p_event_key uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
BEGIN
  v_secret := coalesce(
    nullif(current_setting('app.dividend_consensus_hmac_key', true), ''),
    'axir-dividend-consensus-hmac-v1'
  );
  RETURN encode(
    extensions.hmac(
      (p_user_id::text || ':' || p_event_key::text)::bytea,
      v_secret::bytea,
      'sha256'
    ),
    'hex'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_dividend_voter_hash_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_dividend_voter_hash_internal(uuid, uuid) TO service_role;

-- Reconta um event_key e aplica promoção/suspensão/rebaixamento conforme publication_enabled
CREATE OR REPLACE FUNCTION public.recount_dividend_consensus_event_internal(
  p_event_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_any_vote public.corporate_dividend_votes%ROWTYPE;
  v_market text;
  v_pub_enabled boolean := false;
  v_anchored boolean := false;
  v_corp public.corporate_dividends%ROWTYPE;
  v_passing_count int := 0;
  v_winner record;
  v_prev_tier text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  SELECT * INTO v_any_vote
  FROM public.corporate_dividend_votes
  WHERE event_key = p_event_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('event_key', p_event_key, 'status', 'empty');
  END IF;

  v_market := CASE WHEN v_any_vote.currency = 'USD' THEN 'US' ELSE 'BR' END;
  SELECT coalesce(publication_enabled, false) INTO v_pub_enabled
  FROM public.dividend_consensus_settings
  WHERE market = v_market;

  v_anchored := v_any_vote.corporate_id IS NOT NULL;
  IF v_anchored THEN
    SELECT * INTO v_corp
    FROM public.corporate_dividends
    WHERE id = v_any_vote.corporate_id
    FOR UPDATE;
  END IF;

  WITH variant_scores AS (
    SELECT
      ticker,
      currency,
      com_date,
      payment_date,
      type,
      gross_rate,
      tax_rate_pct,
      SUM(CASE signal WHEN 'dedup' THEN 10 WHEN 'edited' THEN 8 ELSE -15 END)::int AS score_decimos,
      COUNT(*) FILTER (WHERE signal IN ('dedup', 'edited'))::int AS positives_count
    FROM public.corporate_dividend_votes
    WHERE event_key = p_event_key
    GROUP BY ticker, currency, com_date, payment_date, type, gross_rate, tax_rate_pct
  ),
  eligible_variants AS (
    SELECT *
    FROM variant_scores
    WHERE (v_anchored AND positives_count >= 2 AND score_decimos >= 16)
       OR (NOT v_anchored AND positives_count >= 3 AND score_decimos >= 24)
  )
  SELECT COUNT(*)::int INTO v_passing_count FROM eligible_variants;

  IF v_passing_count > 1 THEN
    -- Empate / variantes conflitantes: suspende promoção e registra auditoria
    IF v_anchored AND v_corp.id IS NOT NULL AND v_corp.trust_tier = 'community_verified' AND v_pub_enabled THEN
      v_prev_tier := v_corp.trust_tier;
      IF v_corp.external_terms IS NOT NULL THEN
        UPDATE public.corporate_dividends
        SET trust_tier = coalesce(v_corp.external_terms ->> 'trust_tier', 'raw_fallback'),
            provider = coalesce(v_corp.external_terms ->> 'provider', provider),
            updated_at = now()
        WHERE id = v_corp.id;
      ELSE
        UPDATE public.corporate_dividends
        SET published = false, updated_at = now()
        WHERE id = v_corp.id;
      END IF;
      INSERT INTO public.corporate_dividend_consensus_audit (
        event_key, corporate_id, market, previous_tier, new_tier, reason, score_decimos, positives_count
      ) VALUES (
        p_event_key, v_corp.id, v_market, v_prev_tier, coalesce(v_corp.external_terms ->> 'trust_tier', 'raw_fallback'),
        'suspend_tie', 0, 0
      );
    END IF;
    RETURN jsonb_build_object('event_key', p_event_key, 'status', 'suspended_tie', 'passing_count', v_passing_count);
  END IF;

  IF v_passing_count = 1 THEN
    WITH variant_scores AS (
      SELECT
        ticker,
        currency,
        com_date,
        payment_date,
        type,
        gross_rate,
        tax_rate_pct,
        SUM(CASE signal WHEN 'dedup' THEN 10 WHEN 'edited' THEN 8 ELSE -15 END)::int AS score_decimos,
        COUNT(*) FILTER (WHERE signal IN ('dedup', 'edited'))::int AS positives_count
      FROM public.corporate_dividend_votes
      WHERE event_key = p_event_key
      GROUP BY ticker, currency, com_date, payment_date, type, gross_rate, tax_rate_pct
    )
    SELECT * INTO v_winner
    FROM variant_scores
    WHERE (v_anchored AND positives_count >= 2 AND score_decimos >= 16)
       OR (NOT v_anchored AND positives_count >= 3 AND score_decimos >= 24)
    LIMIT 1;

    IF NOT v_pub_enabled THEN
      RETURN jsonb_build_object(
        'event_key', p_event_key,
        'status', 'shadow_quorum',
        'score_decimos', v_winner.score_decimos,
        'positives_count', v_winner.positives_count
      );
    END IF;

    IF v_anchored AND v_corp.id IS NOT NULL AND v_corp.trust_tier <> 'official' THEN
      v_prev_tier := v_corp.trust_tier;
      UPDATE public.corporate_dividends
      SET payment_date = v_winner.payment_date,
          type = v_winner.type,
          rate = v_winner.gross_rate,
          tax_rate_pct = v_winner.tax_rate_pct,
          trust_tier = 'community_verified',
          published = true,
          updated_at = now()
      WHERE id = v_corp.id;

      INSERT INTO public.corporate_dividend_consensus_audit (
        event_key, corporate_id, market, previous_tier, new_tier, reason, score_decimos, positives_count
      ) VALUES (
        p_event_key, v_corp.id, v_market, v_prev_tier, 'community_verified',
        'promoted', v_winner.score_decimos, v_winner.positives_count
      );
    END IF;

    RETURN jsonb_build_object(
      'event_key', p_event_key,
      'status', 'promoted',
      'score_decimos', v_winner.score_decimos,
      'positives_count', v_winner.positives_count
    );
  END IF;

  -- Perda de quórum: restaura external_terms ou oculta candidato puramente comunitário
  IF v_anchored AND v_corp.id IS NOT NULL AND v_corp.trust_tier = 'community_verified' AND v_pub_enabled THEN
    v_prev_tier := v_corp.trust_tier;
    IF v_corp.external_terms IS NOT NULL THEN
      UPDATE public.corporate_dividends
      SET trust_tier = coalesce(v_corp.external_terms ->> 'trust_tier', 'raw_fallback'),
          provider = coalesce(v_corp.external_terms ->> 'provider', provider),
          updated_at = now()
      WHERE id = v_corp.id;
    ELSE
      UPDATE public.corporate_dividends
      SET published = false, updated_at = now()
      WHERE id = v_corp.id;
    END IF;
    INSERT INTO public.corporate_dividend_consensus_audit (
      event_key, corporate_id, market, previous_tier, new_tier, reason, score_decimos, positives_count
    ) VALUES (
      p_event_key, v_corp.id, v_market, v_prev_tier, coalesce(v_corp.external_terms ->> 'trust_tier', 'raw_fallback'),
      'quorum_lost', 0, 0
    );
  END IF;

  RETURN jsonb_build_object('event_key', p_event_key, 'status', 'below_quorum');
END;
$$;

REVOKE ALL ON FUNCTION public.recount_dividend_consensus_event_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recount_dividend_consensus_event_internal(uuid) TO service_role;

-- Registro de sinal independente no backend (deriva titular, elegibilidade e hash no servidor)
CREATE OR REPLACE FUNCTION public.record_dividend_consensus_signal_system(
  p_user_id uuid,
  p_event_key uuid,
  p_corporate_id uuid,
  p_anchor_terms jsonb,
  p_ticker text,
  p_currency text,
  p_com_date date,
  p_payment_date date,
  p_type text,
  p_gross_rate numeric,
  p_tax_rate_pct numeric,
  p_signal text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voter_hash text;
  v_is_eligible boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  IF p_user_id IS NULL OR p_event_key IS NULL THEN
    RAISE EXCEPTION 'Titular e event_key são obrigatórios para consenso.';
  END IF;

  IF p_signal NOT IN ('dedup', 'edited', 'reverted') THEN
    RAISE EXCEPTION 'Sinal de consenso inválido: %', p_signal;
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_active = true)
    AND (
      public.is_trusted_blueprint_voter(p_user_id)
      OR EXISTS (
        SELECT 1 FROM public.portfolio_assets pa
        WHERE pa.user_id = p_user_id
          AND upper(trim(pa.ticker)) = upper(trim(p_ticker))
      )
    )
  ) INTO v_is_eligible;

  IF NOT v_is_eligible THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'ineligible_voter');
  END IF;

  v_voter_hash := public.compute_dividend_voter_hash_internal(p_user_id, p_event_key);

  -- Estorno sem voto positivo prévio não fabrica débito em retries
  IF p_signal = 'reverted' AND NOT EXISTS (
    SELECT 1 FROM public.corporate_dividend_votes
    WHERE event_key = p_event_key AND voter_hash = v_voter_hash
  ) THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'no_prior_vote');
  END IF;

  INSERT INTO public.corporate_dividend_votes (
    event_key, anchor_terms, voter_hash, corporate_id, ticker, currency,
    com_date, payment_date, type, gross_rate, tax_rate_pct, signal, updated_at
  ) VALUES (
    p_event_key, p_anchor_terms, v_voter_hash, p_corporate_id, upper(trim(p_ticker)),
    CASE WHEN upper(trim(p_currency)) = 'USD' THEN 'USD' ELSE 'BRL' END,
    p_com_date, p_payment_date, p_type, p_gross_rate, p_tax_rate_pct, p_signal, now()
  )
  ON CONFLICT (event_key, voter_hash) DO UPDATE
  SET corporate_id = coalesce(EXCLUDED.corporate_id, public.corporate_dividend_votes.corporate_id),
      ticker = EXCLUDED.ticker,
      currency = EXCLUDED.currency,
      com_date = EXCLUDED.com_date,
      payment_date = EXCLUDED.payment_date,
      type = EXCLUDED.type,
      gross_rate = EXCLUDED.gross_rate,
      tax_rate_pct = EXCLUDED.tax_rate_pct,
      signal = EXCLUDED.signal,
      updated_at = now();

  RETURN jsonb_build_object(
    'recorded', true,
    'recount', public.recount_dividend_consensus_event_internal(p_event_key)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_dividend_consensus_signal_system(uuid, uuid, uuid, jsonb, text, text, date, date, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_dividend_consensus_signal_system(uuid, uuid, uuid, jsonb, text, text, date, date, text, numeric, numeric, text) TO service_role;

-- Expurgo LGPD por titular: calcula hashes antes da exclusão e reconta em lote
CREATE OR REPLACE FUNCTION public.purge_user_dividend_votes_system(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affected_keys uuid[];
  v_k uuid;
  v_deleted int := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('deleted', 0, 'recounted', 0);
  END IF;

  SELECT array_agg(DISTINCT event_key) INTO v_affected_keys
  FROM public.corporate_dividend_votes
  WHERE voter_hash = public.compute_dividend_voter_hash_internal(p_user_id, event_key);

  DELETE FROM public.corporate_dividend_votes
  WHERE voter_hash = public.compute_dividend_voter_hash_internal(p_user_id, event_key);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_affected_keys IS NOT NULL THEN
    FOREACH v_k IN ARRAY v_affected_keys LOOP
      PERFORM public.recount_dividend_consensus_event_internal(v_k);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'recounted', coalesce(array_length(v_affected_keys, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_dividend_votes_system(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_dividend_votes_system(uuid) TO service_role;

-- Kill switch de publicação: desativa publicação, restaura external_terms e preserva extrato
CREATE OR REPLACE FUNCTION public.toggle_dividend_consensus_publication_system(
  p_market text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restored int := 0;
  v_unpublished int := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  IF p_market NOT IN ('BR', 'US') THEN
    RAISE EXCEPTION 'Mercado inválido: %', p_market;
  END IF;

  INSERT INTO public.dividend_consensus_settings (market, publication_enabled, updated_at)
  VALUES (p_market, p_enabled, now())
  ON CONFLICT (market) DO UPDATE
  SET publication_enabled = EXCLUDED.publication_enabled,
      updated_at = now();

  IF NOT p_enabled THEN
    UPDATE public.corporate_dividends
    SET trust_tier = coalesce(external_terms ->> 'trust_tier', 'raw_fallback'),
        provider = coalesce(external_terms ->> 'provider', provider),
        updated_at = now()
    WHERE currency = CASE WHEN p_market = 'US' THEN 'USD' ELSE 'BRL' END
      AND trust_tier = 'community_verified'
      AND external_terms IS NOT NULL;
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    UPDATE public.corporate_dividends
    SET published = false,
        updated_at = now()
    WHERE currency = CASE WHEN p_market = 'US' THEN 'USD' ELSE 'BRL' END
      AND trust_tier = 'community_verified'
      AND external_terms IS NULL;
    GET DIAGNOSTICS v_unpublished = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'market', p_market,
    'publication_enabled', p_enabled,
    'restored_external_count', v_restored,
    'unpublished_community_count', v_unpublished
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_dividend_consensus_publication_system(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_dividend_consensus_publication_system(text, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
