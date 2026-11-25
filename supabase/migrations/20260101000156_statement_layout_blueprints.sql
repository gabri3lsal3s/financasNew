-- =============================================================================
-- Migration 0156: Aprendizado Global Blindado de Layouts de Fatura (0 PII)
-- =============================================================================
-- Implementa a Onda 1 (D7 / D16 / G13):
--   1. `public.statement_layout_blueprints`: catálogo nuvem (scope `user` e
--      `global`) 100% livre de PII, sujeito a RLS estrito.
--   2. `public.statement_layout_blueprint_votes`: tabela interna sem GRANT para
--      clientes, rastreando votos/falhas por usuário distinto via hash SHA-256
--      unidirecional e flag `is_trusted_account` (Anti-Sybil).
--   3. RPCs SECURITY DEFINER:
--      - `upsert_statement_layout_blueprint`
--      - `record_statement_blueprint_outcome`
--      - `admin_list_statement_blueprints`
--      - `admin_approve_statement_blueprint`
--      - `admin_suspend_statement_blueprint`
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela principal: public.statement_layout_blueprints
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statement_layout_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 6 AND 120),
  issuer_key text NOT NULL CHECK (issuer_key ~ '^[a-z0-9_]{2,64}$'),
  issuer_name text NOT NULL CHECK (char_length(issuer_name) BETWEEN 2 AND 80),
  file_kind text NOT NULL CHECK (file_kind IN ('pdf_text', 'text')),
  scope text NOT NULL CHECK (scope IN ('user', 'global')),
  owner_user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending_review')),
  rules_json jsonb NOT NULL,
  exact_checksum_hits integer NOT NULL DEFAULT 1 CHECK (exact_checksum_hits >= 0),
  distinct_users_verified integer NOT NULL DEFAULT 1 CHECK (distinct_users_verified >= 0),
  distinct_users_failed integer NOT NULL DEFAULT 0 CHECK (distinct_users_failed >= 0),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'user' AND owner_user_id IS NOT NULL)
    OR (scope = 'global' AND owner_user_id IS NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (scope, owner_user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_statement_blueprints_scope_status_fp
  ON public.statement_layout_blueprints (scope, status, fingerprint);

CREATE INDEX IF NOT EXISTS idx_statement_blueprints_owner_status
  ON public.statement_layout_blueprints (owner_user_id, status)
  WHERE owner_user_id IS NOT NULL;

ALTER TABLE public.statement_layout_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_layout_blueprints FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read active global or own blueprints" ON public.statement_layout_blueprints;
CREATE POLICY "Users read active global or own blueprints"
  ON public.statement_layout_blueprints
  FOR SELECT
  TO authenticated
  USING (
    (scope = 'global' AND status = 'active')
    OR (scope = 'user' AND owner_user_id = (select auth.uid()))
    OR (select public.is_admin())
  );

REVOKE ALL ON TABLE public.statement_layout_blueprints FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.statement_layout_blueprints FROM authenticated;
GRANT SELECT ON TABLE public.statement_layout_blueprints TO authenticated;
GRANT ALL ON TABLE public.statement_layout_blueprints TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Tabela interna de votos anônimos: public.statement_layout_blueprint_votes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statement_layout_blueprint_votes (
  fingerprint text NOT NULL,
  voter_hash text NOT NULL CHECK (voter_hash ~ '^[0-9a-f]{64}$'),
  is_trusted_account boolean NOT NULL DEFAULT false,
  last_outcome text NOT NULL CHECK (last_outcome IN ('success', 'failure')),
  hits_count integer NOT NULL DEFAULT 0 CHECK (hits_count >= 0),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint, voter_hash)
);

ALTER TABLE public.statement_layout_blueprint_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_layout_blueprint_votes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statement_layout_blueprint_votes_admin_select" ON public.statement_layout_blueprint_votes;
CREATE POLICY "statement_layout_blueprint_votes_admin_select"
  ON public.statement_layout_blueprint_votes
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

REVOKE ALL ON TABLE public.statement_layout_blueprint_votes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.statement_layout_blueprint_votes TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Helpers internos (uso exclusivo dos RPCs SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_statement_blueprint_rules_json(p_rules jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
  v_arr_key text;
  v_elem text;
  v_arr jsonb;
BEGIN
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN
    RAISE EXCEPTION 'rules_json deve ser um objeto JSON válido.';
  END IF;

  IF octet_length(p_rules::text) > 4096 THEN
    RAISE EXCEPTION 'rules_json excede o tamanho máximo estrutural (4KB).';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_rules)
  LOOP
    IF v_key NOT IN (
      'startMarkers',
      'pauseMarkers',
      'boletoMarkers',
      'totalLabels',
      'ignoredTotalLabels',
      'columnMode',
      'strictStartZone',
      'polarity',
      'dateFormatHint'
    ) THEN
      RAISE EXCEPTION 'Chave não permitida em rules_json: %', v_key;
    END IF;
  END LOOP;

  FOREACH v_arr_key IN ARRAY ARRAY[
    'startMarkers',
    'pauseMarkers',
    'boletoMarkers',
    'totalLabels',
    'ignoredTotalLabels'
  ]
  LOOP
    IF p_rules ? v_arr_key THEN
      v_arr := p_rules -> v_arr_key;
      IF jsonb_typeof(v_arr) <> 'array' THEN
        RAISE EXCEPTION '% deve ser um array JSON.', v_arr_key;
      END IF;
      IF jsonb_array_length(v_arr) > 25 THEN
        RAISE EXCEPTION '% excede o limite máximo de 25 marcadores.', v_arr_key;
      END IF;
      FOR v_elem IN SELECT jsonb_array_elements_text(v_arr)
      LOOP
        IF char_length(trim(v_elem)) < 2 OR char_length(v_elem) > 80 THEN
          RAISE EXCEPTION 'Marcador estrutural com tamanho inválido em %.', v_arr_key;
        END IF;
        -- Bloqueia qualquer dígito ou '@' para impedir CPF, CNPJ, valores, datas ou PII
        IF v_elem ~ '[0-9@]' THEN
          RAISE EXCEPTION 'Marcador estrutural rejeitado por política anti-PII (%).', v_arr_key;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF p_rules ? 'columnMode' AND (p_rules->>'columnMode') NOT IN ('auto', 'single', 'bimodal') THEN
    RAISE EXCEPTION 'columnMode inválido.';
  END IF;

  IF p_rules ? 'polarity' AND (p_rules->>'polarity') NOT IN ('auto', 'positive_purchase', 'negative_purchase') THEN
    RAISE EXCEPTION 'polarity inválida.';
  END IF;

  IF p_rules ? 'dateFormatHint' AND (p_rules->>'dateFormatHint') NOT IN ('dmy', 'd_mmm', 'ymd', 'auto') THEN
    RAISE EXCEPTION 'dateFormatHint inválido.';
  END IF;

  IF p_rules ? 'strictStartZone' AND jsonb_typeof(p_rules->'strictStartZone') <> 'boolean' THEN
    RAISE EXCEPTION 'strictStartZone deve ser boolean.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_statement_blueprint_rules_json(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_trusted_blueprint_voter(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = p_user_id
         AND p.status = 'active'::public.user_status
         AND p.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
    OR EXISTS (
      SELECT 1
        FROM public.user_subscriptions s
       WHERE s.user_id = p_user_id
         AND (
           s.tier = 'lifetime'
           OR (s.tier IN ('pro_monthly', 'pro_annual') AND s.status = 'active')
         )
    );
$$;

REVOKE ALL ON FUNCTION public.is_trusted_blueprint_voter(uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC: public.upsert_statement_layout_blueprint (D7 / G13)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_statement_layout_blueprint(
  p_fingerprint text,
  p_issuer_key text,
  p_issuer_name text,
  p_file_kind text,
  p_rules_json jsonb
)
RETURNS public.statement_layout_blueprints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_fingerprint text := trim(coalesce(p_fingerprint, ''));
  v_issuer_key text := lower(trim(coalesce(p_issuer_key, '')));
  v_issuer_name text := trim(coalesce(p_issuer_name, ''));
  v_voter_hash text;
  v_is_trusted boolean;
  v_user_bp public.statement_layout_blueprints;
  v_prev_global public.statement_layout_blueprints;
  v_distinct_ok integer := 0;
  v_trusted_ok integer := 0;
  v_total_hits integer := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF char_length(v_fingerprint) < 6 OR char_length(v_fingerprint) > 120 OR v_fingerprint ~ '[0-9]{11}' THEN
    RAISE EXCEPTION 'Fingerprint de layout inválido.';
  END IF;

  IF v_issuer_key !~ '^[a-z0-9_]{2,64}$' THEN
    RAISE EXCEPTION 'issuer_key inválido.';
  END IF;

  IF char_length(v_issuer_name) < 2 OR char_length(v_issuer_name) > 80 OR v_issuer_name ~ '[0-9]{4}|@' THEN
    RAISE EXCEPTION 'issuer_name inválido.';
  END IF;

  IF p_file_kind NOT IN ('pdf_text', 'text') THEN
    RAISE EXCEPTION 'file_kind inválido: %', coalesce(p_file_kind, '<null>');
  END IF;

  PERFORM public.validate_statement_blueprint_rules_json(p_rules_json);

  -- 1. Persiste/atualiza imediatamente no escopo do usuário (Trial e Pro)
  INSERT INTO public.statement_layout_blueprints (
    fingerprint,
    issuer_key,
    issuer_name,
    file_kind,
    scope,
    owner_user_id,
    status,
    rules_json,
    exact_checksum_hits,
    distinct_users_verified,
    distinct_users_failed,
    consecutive_failures
  ) VALUES (
    v_fingerprint,
    v_issuer_key,
    v_issuer_name,
    p_file_kind,
    'user',
    v_user_id,
    'active',
    p_rules_json,
    1,
    1,
    0,
    0
  )
  ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
    issuer_key = EXCLUDED.issuer_key,
    issuer_name = EXCLUDED.issuer_name,
    file_kind = EXCLUDED.file_kind,
    status = 'active',
    rules_json = EXCLUDED.rules_json,
    exact_checksum_hits = public.statement_layout_blueprints.exact_checksum_hits + 1,
    consecutive_failures = 0,
    updated_at = now()
  RETURNING * INTO v_user_bp;

  -- 2. Registra voto anônimo irreversível do usuário (zero PII)
  v_voter_hash := encode(sha256(convert_to(v_user_id::text || ':' || v_fingerprint, 'UTF8')), 'hex');
  v_is_trusted := public.is_trusted_blueprint_voter(v_user_id);

  INSERT INTO public.statement_layout_blueprint_votes (
    fingerprint,
    voter_hash,
    is_trusted_account,
    last_outcome,
    hits_count,
    consecutive_failures,
    updated_at
  ) VALUES (
    v_fingerprint,
    v_voter_hash,
    v_is_trusted,
    'success',
    1,
    0,
    now()
  )
  ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
    is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
    last_outcome = 'success',
    hits_count = public.statement_layout_blueprint_votes.hits_count + 1,
    consecutive_failures = 0,
    updated_at = now();

  SELECT
    count(*) FILTER (WHERE last_outcome = 'success'),
    count(*) FILTER (WHERE last_outcome = 'success' AND is_trusted_account),
    coalesce(sum(hits_count), 1)
  INTO v_distinct_ok, v_trusted_ok, v_total_hits
  FROM public.statement_layout_blueprint_votes
  WHERE fingerprint = v_fingerprint;

  SELECT *
    INTO v_prev_global
    FROM public.statement_layout_blueprints
   WHERE scope = 'global'
     AND owner_user_id IS NULL
     AND fingerprint = v_fingerprint;

  -- 3. Promoção Anti-Sybil vs fila pending_review Admin
  IF v_trusted_ok >= 2 THEN
    INSERT INTO public.statement_layout_blueprints (
      fingerprint,
      issuer_key,
      issuer_name,
      file_kind,
      scope,
      owner_user_id,
      status,
      rules_json,
      exact_checksum_hits,
      distinct_users_verified,
      distinct_users_failed,
      consecutive_failures,
      promoted_at
    ) VALUES (
      v_fingerprint,
      v_issuer_key,
      v_issuer_name,
      p_file_kind,
      'global',
      NULL,
      'active',
      p_rules_json,
      v_total_hits,
      v_distinct_ok,
      0,
      0,
      now()
    )
    ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
      issuer_key = EXCLUDED.issuer_key,
      issuer_name = EXCLUDED.issuer_name,
      file_kind = EXCLUDED.file_kind,
      status = 'active',
      rules_json = EXCLUDED.rules_json,
      exact_checksum_hits = greatest(public.statement_layout_blueprints.exact_checksum_hits + 1, v_total_hits),
      distinct_users_verified = v_distinct_ok,
      distinct_users_failed = 0,
      consecutive_failures = 0,
      promoted_at = coalesce(public.statement_layout_blueprints.promoted_at, now()),
      updated_at = now();

    -- Limpa falhas antigas quando promove/re-promove com rules_json atualizado
    IF v_prev_global.id IS NULL
       OR v_prev_global.status <> 'active'
       OR v_prev_global.rules_json IS DISTINCT FROM p_rules_json THEN
      DELETE FROM public.statement_layout_blueprint_votes
       WHERE fingerprint = v_fingerprint
         AND last_outcome = 'failure';
    END IF;
  ELSIF v_prev_global.id IS NULL THEN
    INSERT INTO public.statement_layout_blueprints (
      fingerprint,
      issuer_key,
      issuer_name,
      file_kind,
      scope,
      owner_user_id,
      status,
      rules_json,
      exact_checksum_hits,
      distinct_users_verified,
      distinct_users_failed,
      consecutive_failures
    ) VALUES (
      v_fingerprint,
      v_issuer_key,
      v_issuer_name,
      p_file_kind,
      'global',
      NULL,
      'pending_review',
      p_rules_json,
      v_total_hits,
      v_distinct_ok,
      0,
      0
    )
    ON CONFLICT (scope, owner_user_id, fingerprint) DO NOTHING;
  ELSE
    UPDATE public.statement_layout_blueprints
       SET exact_checksum_hits = greatest(exact_checksum_hits + 1, v_total_hits),
           distinct_users_verified = greatest(distinct_users_verified, v_distinct_ok),
           rules_json = CASE WHEN status = 'pending_review' THEN p_rules_json ELSE rules_json END,
           updated_at = now()
     WHERE id = v_prev_global.id;
  END IF;

  RETURN v_user_bp;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_statement_layout_blueprint(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_statement_layout_blueprint(text, text, text, text, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPC: public.record_statement_blueprint_outcome (Promoção & Self-Healing)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_statement_blueprint_outcome(
  p_blueprint_id uuid,
  p_exact_checksum_hit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_bp public.statement_layout_blueprints;
  v_prev_global public.statement_layout_blueprints;
  v_voter_hash text;
  v_is_trusted boolean;
  v_distinct_ok integer := 0;
  v_trusted_ok integer := 0;
  v_trusted_fail integer := 0;
  v_total_hits integer := 1;
  v_new_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  SELECT *
    INTO v_bp
    FROM public.statement_layout_blueprints
   WHERE id = p_blueprint_id
     AND (scope = 'global' OR owner_user_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blueprint não encontrado ou inacessível.';
  END IF;

  v_voter_hash := encode(sha256(convert_to(v_user_id::text || ':' || v_bp.fingerprint, 'UTF8')), 'hex');
  v_is_trusted := public.is_trusted_blueprint_voter(v_user_id);

  IF coalesce(p_exact_checksum_hit, false) THEN
    INSERT INTO public.statement_layout_blueprint_votes (
      fingerprint,
      voter_hash,
      is_trusted_account,
      last_outcome,
      hits_count,
      consecutive_failures,
      updated_at
    ) VALUES (
      v_bp.fingerprint,
      v_voter_hash,
      v_is_trusted,
      'success',
      1,
      0,
      now()
    )
    ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
      is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
      last_outcome = 'success',
      hits_count = public.statement_layout_blueprint_votes.hits_count + 1,
      consecutive_failures = 0,
      updated_at = now();

    SELECT
      count(*) FILTER (WHERE last_outcome = 'success'),
      count(*) FILTER (WHERE last_outcome = 'success' AND is_trusted_account),
      coalesce(sum(hits_count), 1)
    INTO v_distinct_ok, v_trusted_ok, v_total_hits
    FROM public.statement_layout_blueprint_votes
    WHERE fingerprint = v_bp.fingerprint;

    UPDATE public.statement_layout_blueprints
       SET exact_checksum_hits = exact_checksum_hits + 1,
           consecutive_failures = 0,
           distinct_users_verified = greatest(distinct_users_verified, v_distinct_ok),
           updated_at = now()
     WHERE id = v_bp.id;

    SELECT *
      INTO v_prev_global
      FROM public.statement_layout_blueprints
     WHERE scope = 'global'
       AND owner_user_id IS NULL
       AND fingerprint = v_bp.fingerprint;

    IF v_trusted_ok >= 2 THEN
      INSERT INTO public.statement_layout_blueprints (
        fingerprint,
        issuer_key,
        issuer_name,
        file_kind,
        scope,
        owner_user_id,
        status,
        rules_json,
        exact_checksum_hits,
        distinct_users_verified,
        distinct_users_failed,
        consecutive_failures,
        promoted_at
      ) VALUES (
        v_bp.fingerprint,
        v_bp.issuer_key,
        v_bp.issuer_name,
        v_bp.file_kind,
        'global',
        NULL,
        'active',
        v_bp.rules_json,
        v_total_hits,
        v_distinct_ok,
        0,
        0,
        now()
      )
      ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
        status = 'active',
        rules_json = v_bp.rules_json,
        exact_checksum_hits = greatest(public.statement_layout_blueprints.exact_checksum_hits, v_total_hits),
        distinct_users_verified = v_distinct_ok,
        distinct_users_failed = 0,
        consecutive_failures = 0,
        promoted_at = coalesce(public.statement_layout_blueprints.promoted_at, now()),
        updated_at = now();

      IF v_prev_global.id IS NULL
         OR v_prev_global.status <> 'active'
         OR v_prev_global.rules_json IS DISTINCT FROM v_bp.rules_json THEN
        DELETE FROM public.statement_layout_blueprint_votes
         WHERE fingerprint = v_bp.fingerprint
           AND last_outcome = 'failure';
      END IF;

      v_new_status := 'active';
    ELSIF v_prev_global.id IS NULL THEN
      INSERT INTO public.statement_layout_blueprints (
        fingerprint,
        issuer_key,
        issuer_name,
        file_kind,
        scope,
        owner_user_id,
        status,
        rules_json,
        exact_checksum_hits,
        distinct_users_verified,
        distinct_users_failed,
        consecutive_failures
      ) VALUES (
        v_bp.fingerprint,
        v_bp.issuer_key,
        v_bp.issuer_name,
        v_bp.file_kind,
        'global',
        NULL,
        'pending_review',
        v_bp.rules_json,
        v_total_hits,
        v_distinct_ok,
        0,
        0
      )
      ON CONFLICT (scope, owner_user_id, fingerprint) DO NOTHING;

      v_new_status := v_bp.status;
    ELSE
      v_new_status := v_bp.status;
    END IF;
  ELSE
    -- Registro de falha: self-healing isolado por escopo e proteção Anti-Sybil no global
    INSERT INTO public.statement_layout_blueprint_votes (
      fingerprint,
      voter_hash,
      is_trusted_account,
      last_outcome,
      hits_count,
      consecutive_failures,
      updated_at
    ) VALUES (
      v_bp.fingerprint,
      v_voter_hash,
      v_is_trusted,
      'failure',
      0,
      1,
      now()
    )
    ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
      is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
      last_outcome = 'failure',
      consecutive_failures = public.statement_layout_blueprint_votes.consecutive_failures + 1,
      updated_at = now();

    SELECT count(*) FILTER (WHERE last_outcome = 'failure' AND is_trusted_account)
      INTO v_trusted_fail
      FROM public.statement_layout_blueprint_votes
     WHERE fingerprint = v_bp.fingerprint;

    IF v_bp.scope = 'user' THEN
      v_new_status := CASE
        WHEN v_bp.consecutive_failures + 1 >= 2 THEN 'suspended'
        ELSE v_bp.status
      END;

      UPDATE public.statement_layout_blueprints
         SET consecutive_failures = consecutive_failures + 1,
             status = v_new_status,
             updated_at = now()
       WHERE id = v_bp.id;
    ELSE
      v_new_status := CASE
        WHEN v_trusted_fail >= 2 THEN 'suspended'
        ELSE v_bp.status
      END;

      UPDATE public.statement_layout_blueprints
         SET consecutive_failures = consecutive_failures + 1,
             distinct_users_failed = v_trusted_fail,
             status = v_new_status,
             updated_at = now()
       WHERE id = v_bp.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'blueprint_id', v_bp.id,
    'scope', v_bp.scope,
    'status', v_new_status,
    'distinct_users_verified', v_distinct_ok,
    'trusted_users_verified', v_trusted_ok,
    'trusted_users_failed', v_trusted_fail
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_statement_blueprint_outcome(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_statement_blueprint_outcome(uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. RPCs de Curadoria Administrativa (D16)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_statement_blueprints()
RETURNS SETOF public.statement_layout_blueprints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégio administrativo requerido.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
    FROM public.statement_layout_blueprints
   WHERE scope = 'global'
   ORDER BY
     CASE status
       WHEN 'pending_review' THEN 0
       WHEN 'active' THEN 1
       ELSE 2
     END ASC,
     distinct_users_verified DESC,
     updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_statement_blueprints() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_statement_blueprints() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_statement_blueprint(
  p_blueprint_id uuid,
  p_rules_json jsonb DEFAULT NULL
)
RETURNS public.statement_layout_blueprints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_bp public.statement_layout_blueprints;
  v_effective_rules jsonb;
  v_result public.statement_layout_blueprints;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégio administrativo requerido.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_bp FROM public.statement_layout_blueprints WHERE id = p_blueprint_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blueprint não encontrado.';
  END IF;

  v_effective_rules := coalesce(p_rules_json, v_bp.rules_json);
  PERFORM public.validate_statement_blueprint_rules_json(v_effective_rules);

  IF v_bp.scope = 'global' THEN
    UPDATE public.statement_layout_blueprints
       SET status = 'active',
           rules_json = v_effective_rules,
           distinct_users_failed = 0,
           consecutive_failures = 0,
           promoted_at = coalesce(promoted_at, now()),
           updated_at = now()
     WHERE id = v_bp.id
     RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.statement_layout_blueprints (
      fingerprint,
      issuer_key,
      issuer_name,
      file_kind,
      scope,
      owner_user_id,
      status,
      rules_json,
      exact_checksum_hits,
      distinct_users_verified,
      distinct_users_failed,
      consecutive_failures,
      promoted_at
    ) VALUES (
      v_bp.fingerprint,
      v_bp.issuer_key,
      v_bp.issuer_name,
      v_bp.file_kind,
      'global',
      NULL,
      'active',
      v_effective_rules,
      v_bp.exact_checksum_hits,
      v_bp.distinct_users_verified,
      0,
      0,
      now()
    )
    ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
      status = 'active',
      rules_json = v_effective_rules,
      distinct_users_failed = 0,
      consecutive_failures = 0,
      promoted_at = coalesce(public.statement_layout_blueprints.promoted_at, now()),
      updated_at = now()
    RETURNING * INTO v_result;
  END IF;

  -- Atenção SQL #2: limpa votos anteriores com falha desse fingerprint ao aprovar global
  DELETE FROM public.statement_layout_blueprint_votes
   WHERE fingerprint = v_bp.fingerprint
     AND last_outcome = 'failure';

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'statement_layout_blueprint',
    v_result.id::text,
    'admin_approve',
    jsonb_build_object(
      'fingerprint', v_result.fingerprint,
      'issuer_key', v_result.issuer_key,
      'updated_rules', p_rules_json IS NOT NULL
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_statement_blueprint(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_statement_blueprint(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_suspend_statement_blueprint(
  p_blueprint_id uuid
)
RETURNS public.statement_layout_blueprints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_result public.statement_layout_blueprints;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégio administrativo requerido.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.statement_layout_blueprints
     SET status = 'suspended',
         updated_at = now()
   WHERE id = p_blueprint_id
   RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blueprint não encontrado.';
  END IF;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'statement_layout_blueprint',
    v_result.id::text,
    'admin_suspend',
    jsonb_build_object(
      'fingerprint', v_result.fingerprint,
      'issuer_key', v_result.issuer_key
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_statement_blueprint(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_statement_blueprint(uuid) TO authenticated;
