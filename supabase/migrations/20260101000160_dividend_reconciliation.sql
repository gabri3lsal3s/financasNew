-- =============================================================================
-- Migration 0160: Escrita Atômica de Proventos, Conciliação, Rate Limit & Backup (S3)
-- =============================================================================
-- Fatia S3 de `docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md` (§2, §3.3, §4.3, §6):
--   1. Colunas e índices estruturais:
--      - `portfolio_dividends.request_id` (uuid) + `entry_origin` ('legacy','manual','engine','restore')
--      - `uq_dividend_manual_request (user_id, request_id) WHERE request_id IS NOT NULL`
--      - `portfolio_transactions.linked_dividend_id` + `idx_dividend_tx_link`
--      - `quote_refresh_rate_limits.bucket_kind` ampliado para `dividend_minute` / `dividend_hour`
--   2. RPC sistêmica `check_dividend_sync_rate_limit` (`service_role`, lease 60s + teto 6/h)
--   3. RPC sistêmica `apply_dividend_reconciliation_system` (`service_role`):
--      - Lock por partição (titular, ticker canônico, moeda) em ordem estável + row locks;
--      - Caminho curto sem matching em Deno quando não há candidatos abertos nem vínculos;
--      - Comparação completa de snapshot sob lock no caminho completo;
--      - Idempotência estrita por `request_id`, delta real no Caixa, exclusão com estorno e reabertura;
--      - Aplicação atômica de vínculos `p_links` (`SETTLED`, `settlement_origin = 'dedup'`).
--   4. RPC autenticada `dismiss_user_dividend_events_atomic(p_ids, p_revisions, p_reason)`
--   5. Atualização de `restore_backup(jsonb)` a partir da 0159 com `request_id`, `entry_origin = 'restore'`,
--      `source_event_id`, `linked_dividend_id`, `user_dividend_events` e `portfolio_dividend_dismissals`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Evolução aditiva de schema, índices e buckets de rate limit
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolio_dividends
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS entry_origin text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.portfolio_dividends
  DROP CONSTRAINT IF EXISTS chk_portfolio_dividends_entry_origin;

ALTER TABLE public.portfolio_dividends
  ADD CONSTRAINT chk_portfolio_dividends_entry_origin
  CHECK (entry_origin IN ('legacy', 'manual', 'engine', 'restore'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_dividend_manual_request
  ON public.portfolio_dividends (user_id, request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS linked_dividend_id uuid
    REFERENCES public.portfolio_dividends(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dividend_tx_link
  ON public.portfolio_transactions (linked_dividend_id)
  WHERE linked_dividend_id IS NOT NULL;

DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'quote_refresh_rate_limits'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%bucket_kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.quote_refresh_rate_limits DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;
END
$$;

ALTER TABLE public.quote_refresh_rate_limits
  ADD CONSTRAINT chk_quote_refresh_rate_limits_bucket_kind
  CHECK (bucket_kind IN ('minute', 'hour', 'dividend_minute', 'dividend_hour'));

-- -----------------------------------------------------------------------------
-- 2. Rate Limit interativo de proventos (`service_role`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_dividend_sync_rate_limit(
  p_user_id uuid,
  p_cooldown_seconds integer DEFAULT 60,
  p_max_per_hour integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_now timestamptz := now();
  v_hour_window timestamptz := date_trunc('hour', v_now);
  v_last_lease timestamptz;
  v_hour_hits integer := 0;
  v_retry_after integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dividend_sync_rl:' || p_user_id::text));

  SELECT max(window_start)
  INTO v_last_lease
  FROM public.quote_refresh_rate_limits
  WHERE user_id = p_user_id
    AND bucket_kind = 'dividend_minute';

  IF v_last_lease IS NOT NULL
     AND v_now < v_last_lease + make_interval(secs => greatest(1, coalesce(p_cooldown_seconds, 60))) THEN
    v_retry_after := greatest(
      1,
      ceil(extract(epoch FROM ((v_last_lease + make_interval(secs => greatest(1, coalesce(p_cooldown_seconds, 60)))) - v_now)))::integer
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after', v_retry_after
    );
  END IF;

  SELECT coalesce(hits, 0)
  INTO v_hour_hits
  FROM public.quote_refresh_rate_limits
  WHERE user_id = p_user_id
    AND bucket_kind = 'dividend_hour'
    AND window_start = v_hour_window
  FOR UPDATE;

  IF coalesce(v_hour_hits, 0) >= greatest(1, coalesce(p_max_per_hour, 6)) THEN
    v_retry_after := greatest(
      1,
      ceil(extract(epoch FROM ((v_hour_window + interval '1 hour') - v_now)))::integer
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'retry_after', v_retry_after
    );
  END IF;

  DELETE FROM public.quote_refresh_rate_limits
  WHERE user_id = p_user_id
    AND bucket_kind = 'dividend_minute';

  INSERT INTO public.quote_refresh_rate_limits (user_id, bucket_kind, window_start, hits)
  VALUES (p_user_id, 'dividend_minute', v_now, 1);

  INSERT INTO public.quote_refresh_rate_limits (user_id, bucket_kind, window_start, hits)
  VALUES (p_user_id, 'dividend_hour', v_hour_window, 1)
  ON CONFLICT (user_id, bucket_kind, window_start) DO UPDATE
  SET hits = public.quote_refresh_rate_limits.hits + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'retry_after', 0,
    'remaining_hour', greatest(0, greatest(1, coalesce(p_max_per_hour, 6)) - (coalesce(v_hour_hits, 0) + 1))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_dividend_sync_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_dividend_sync_rate_limit(uuid, integer, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. RPC privada de escrita atômica & conciliação (`service_role`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_dividend_reconciliation_system(
  p_user_id uuid,
  p_command jsonb,
  p_snapshot jsonb DEFAULT NULL,
  p_links jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_op text;
  v_div_id uuid;
  v_request_id uuid;
  v_asset_id uuid;
  v_ticker text;
  v_currency text := 'BRL';
  v_canon_key text;
  v_old_canon_key text;
  v_lock_keys text[];
  v_lk text;
  v_date date;
  v_amount numeric(14, 2);
  v_sync_cash boolean := false;
  v_cash_amount numeric(14, 2);
  v_fx_rate numeric(12, 6);
  v_notes text;
  v_rollback_cash boolean := false;
  v_create_tx boolean := false;
  v_tx_type text;
  v_expected_updated_at text;
  v_existing_div public.portfolio_dividends%ROWTYPE;
  v_existing_req public.portfolio_dividends%ROWTYPE;
  v_asset public.portfolio_assets%ROWTYPE;
  v_old_asset public.portfolio_assets%ROWTYPE;
  v_cash_asset_id uuid;
  v_cash_balance numeric(18, 2) := 0;
  v_prev_cash_brl numeric(14, 2) := 0;
  v_new_cash_brl numeric(14, 2) := 0;
  v_cash_delta numeric(14, 2) := 0;
  v_reverted_cash_brl numeric(14, 2) := 0;
  v_cash_shortfall_brl numeric(14, 2) := 0;
  v_ambiguous_tx_preserved boolean := false;
  v_tx_count integer := 0;
  v_tx_id uuid;
  v_candidate_count integer := 0;
  v_link_count integer := 0;
  v_current_sig text := '';
  v_snapshot_sig text := '';
  v_reopened_event_ids uuid[] := ARRAY[]::uuid[];
  v_linked_event_ids uuid[] := ARRAY[]::uuid[];
  v_link jsonb;
  v_link_event_ids uuid[];
  v_link_eid uuid;
  v_target_div_id uuid;
  v_result_div jsonb := NULL;
  v_ev_row record;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: escrita transacional de proventos é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_command IS NULL OR jsonb_typeof(p_command) <> 'object' THEN
    RAISE EXCEPTION 'Parâmetros inválidos para apply_dividend_reconciliation_system.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Usuário inativo ou não encontrado.' USING ERRCODE = '42501';
  END IF;

  v_op := lower(trim(coalesce(p_command->>'op', '')));
  IF v_op NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'Operação inválida: %.', v_op USING ERRCODE = '22023';
  END IF;

  v_div_id := NULLIF(trim(coalesce(p_command->>'id', '')), '')::uuid;
  v_request_id := NULLIF(trim(coalesce(p_command->>'request_id', '')), '')::uuid;
  v_asset_id := NULLIF(trim(coalesce(p_command->>'asset_id', '')), '')::uuid;
  v_ticker := upper(trim(coalesce(p_command->>'ticker', '')));
  v_expected_updated_at := NULLIF(trim(coalesce(p_command->>'expected_updated_at', '')), '');

  -- Descobre metadados de partição para travamento determinístico
  IF v_op IN ('update', 'delete') AND v_div_id IS NOT NULL THEN
    SELECT * INTO v_existing_div
    FROM public.portfolio_dividends
    WHERE id = v_div_id AND user_id = p_user_id;

    IF v_op = 'delete' AND NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'noop', true,
        'reverted_cash_brl', 0,
        'cash_shortfall_brl', 0,
        'reopened_event_ids', ARRAY[]::uuid[]
      );
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Provento não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
    END IF;

    IF v_existing_div.asset_id IS NOT NULL THEN
      SELECT * INTO v_old_asset
      FROM public.portfolio_assets
      WHERE id = v_existing_div.asset_id AND user_id = p_user_id;
    END IF;

    v_old_canon_key :=
      coalesce(nullif(upper(trim(coalesce(v_old_asset.currency, 'BRL'))), ''), 'BRL') || ':' ||
      public.normalize_dividend_ticker_key(
        coalesce(nullif(v_old_asset.ticker, ''), v_existing_div.ticker, ''),
        coalesce(v_old_asset.currency, 'BRL')
      );
  END IF;

  IF v_asset_id IS NOT NULL THEN
    SELECT * INTO v_asset
    FROM public.portfolio_assets
    WHERE id = v_asset_id AND user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ativo % não encontrado ou pertence a outro titular.', v_asset_id USING ERRCODE = '42501';
    END IF;

    v_currency := CASE WHEN upper(trim(coalesce(v_asset.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END;
    v_ticker := upper(trim(v_asset.ticker));
    v_canon_key := v_currency || ':' || public.normalize_dividend_ticker_key(v_ticker, v_currency);
  ELSIF v_old_canon_key IS NOT NULL THEN
    v_canon_key := v_old_canon_key;
    v_currency := coalesce(nullif(v_old_asset.currency, ''), 'BRL');
    v_ticker := coalesce(nullif(v_ticker, ''), v_existing_div.ticker, '');
  ELSE
    v_canon_key := 'BRL:' || public.normalize_dividend_ticker_key(v_ticker, 'BRL');
  END IF;

  -- Locks ordenados por partição para evitar deadlocks entre trocas de ativo
  v_lock_keys := ARRAY[v_canon_key];
  IF v_old_canon_key IS NOT NULL AND v_old_canon_key <> v_canon_key THEN
    v_lock_keys := array_append(v_lock_keys, v_old_canon_key);
  END IF;

  FOR v_lk IN
    SELECT DISTINCT k FROM unnest(v_lock_keys) AS k ORDER BY k ASC
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('dividend_partition:' || p_user_id::text || ':' || v_lk));
  END LOOP;

  -- Idempotência estrita em CREATE via request_id sob lock
  IF v_op = 'create' AND v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing_req
    FROM public.portfolio_dividends
    WHERE user_id = p_user_id
      AND request_id = v_request_id
    FOR UPDATE;

    IF FOUND THEN
      v_date := (p_command->>'date')::date;
      v_amount := round((p_command->>'amount')::numeric, 2);
      v_sync_cash := coalesce((p_command->>'sync_cash')::boolean, false);

      IF v_existing_req.asset_id IS DISTINCT FROM v_asset_id
         OR v_existing_req.date IS DISTINCT FROM v_date
         OR abs(coalesce(v_existing_req.amount, 0) - coalesce(v_amount, 0)) > 0.005
         OR coalesce(v_existing_req.sync_cash, false) IS DISTINCT FROM v_sync_cash THEN
        RAISE EXCEPTION 'Conflito de idempotência: request_id % já utilizado com outro conteúdo.', v_request_id
          USING ERRCODE = '40001';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'needs_reconciliation', false,
        'dividend', to_jsonb(v_existing_req)
      );
    END IF;
  END IF;

  -- Re-trava linha alvo em UPDATE/DELETE após advisory lock
  IF v_op IN ('update', 'delete') AND v_div_id IS NOT NULL THEN
    SELECT * INTO v_existing_div
    FROM public.portfolio_dividends
    WHERE id = v_div_id AND user_id = p_user_id
    FOR UPDATE;

    IF v_op = 'delete' AND NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'noop', true,
        'reverted_cash_brl', 0,
        'cash_shortfall_brl', 0,
        'reopened_event_ids', ARRAY[]::uuid[]
      );
    END IF;
  END IF;

  -- Avalia candidatos abertos e vínculos na(s) partição(ões) bloqueada(s)
  SELECT count(*) INTO v_candidate_count
  FROM public.user_dividend_events u
  WHERE u.user_id = p_user_id
    AND u.status IN ('PROVISIONED', 'PENDING_CONFIRMATION')
    AND NOT u.manual_review_required
    AND (upper(trim(coalesce(u.currency, 'BRL'))) || ':' || public.normalize_dividend_ticker_key(u.ticker, u.currency)) = ANY(v_lock_keys);

  IF v_op IN ('update', 'delete') THEN
    SELECT count(*) INTO v_link_count
    FROM public.user_dividend_events u
    WHERE u.user_id = p_user_id
      AND (u.settled_dividend_id = v_div_id OR u.id = v_existing_div.source_event_id);
  END IF;

  -- Caminho curto vs solicitação de matching em Deno
  IF p_snapshot IS NULL THEN
    IF (v_op = 'create' AND v_candidate_count > 0 AND NOT coalesce((p_command->>'skip_reconciliation')::boolean, false))
       OR (v_op IN ('update', 'delete') AND (v_candidate_count > 0 OR v_link_count > 0) AND NOT coalesce((p_command->>'skip_reconciliation')::boolean, false)) THEN
      RETURN jsonb_build_object(
        'success', true,
        'needs_reconciliation', true,
        'candidate_count', v_candidate_count,
        'link_count', v_link_count,
        'partition_keys', v_lock_keys
      );
    END IF;
  ELSE
    -- Verifica integridade do snapshot sob lock (candidatos abertos + vínculos)
    SELECT coalesce(string_agg(
      u.id::text || ':' || u.revision::text || ':' || u.status || ':' || coalesce(u.net_amount::text, '0') || ':' || coalesce(u.settled_dividend_id::text, ''),
      '|' ORDER BY u.id ASC
    ), '')
    INTO v_current_sig
    FROM public.user_dividend_events u
    WHERE u.user_id = p_user_id
      AND (
        (u.status IN ('PROVISIONED', 'PENDING_CONFIRMATION') AND (upper(trim(coalesce(u.currency, 'BRL'))) || ':' || public.normalize_dividend_ticker_key(u.ticker, u.currency)) = ANY(v_lock_keys))
        OR (v_div_id IS NOT NULL AND (u.settled_dividend_id = v_div_id OR u.id = v_existing_div.source_event_id))
      );

    v_snapshot_sig := coalesce(p_snapshot->>'events_signature', '');
    IF v_current_sig <> v_snapshot_sig THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'reason', 'snapshot_changed'
      );
    END IF;

    IF v_op IN ('update', 'delete') AND v_expected_updated_at IS NOT NULL THEN
      IF coalesce(v_existing_div.updated_at::text, '') <> v_expected_updated_at THEN
        RETURN jsonb_build_object(
          'success', false,
          'conflict', true,
          'reason', 'dividend_modified'
        );
      END IF;
    END IF;
  END IF;

  -- Execução transacional do comando
  IF v_op = 'create' THEN
    v_date := (p_command->>'date')::date;
    v_amount := round((p_command->>'amount')::numeric, 2);
    v_sync_cash := coalesce((p_command->>'sync_cash')::boolean, false);
    v_notes := NULLIF(trim(coalesce(p_command->>'notes', '')), '');
    v_create_tx := coalesce((p_command->>'create_transaction')::boolean, false);
    v_tx_type := coalesce(NULLIF(trim(coalesce(p_command->>'tx_type', '')), ''), 'dividend');
    IF v_tx_type NOT IN ('dividend', 'jcp', 'fii_yield') THEN
      v_tx_type := 'dividend';
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 OR v_date IS NULL OR v_date < DATE '2000-01-01' THEN
      RAISE EXCEPTION 'Dados inválidos para registro de provento.' USING ERRCODE = '22023';
    END IF;

    IF v_sync_cash THEN
      IF NULLIF(trim(coalesce(p_command->>'cash_amount', '')), '') IS NOT NULL THEN
        v_new_cash_brl := round((p_command->>'cash_amount')::numeric, 2);
      ELSIF v_currency = 'USD' THEN
        v_fx_rate := NULLIF(trim(coalesce(p_command->>'fx_rate', '')), '')::numeric;
        IF v_fx_rate IS NULL OR v_fx_rate <= 0 THEN
          SELECT price INTO v_fx_rate
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_fx_rate := coalesce(v_fx_rate, 5.25);
        END IF;
        v_new_cash_brl := round(v_amount * v_fx_rate, 2);
      ELSE
        v_new_cash_brl := v_amount;
      END IF;
      v_cash_delta := greatest(0, v_new_cash_brl);
    ELSE
      v_new_cash_brl := NULL;
      v_cash_delta := 0;
    END IF;

    INSERT INTO public.portfolio_dividends (
      user_id,
      asset_id,
      ticker,
      date,
      amount,
      notes,
      sync_cash,
      cash_amount,
      request_id,
      entry_origin
    ) VALUES (
      p_user_id,
      v_asset_id,
      NULLIF(v_ticker, ''),
      v_date,
      v_amount,
      v_notes,
      v_sync_cash,
      CASE WHEN v_sync_cash THEN v_new_cash_brl ELSE NULL END,
      v_request_id,
      'manual'
    )
    RETURNING * INTO v_existing_div;

    IF v_create_tx AND v_asset_id IS NOT NULL THEN
      INSERT INTO public.portfolio_transactions (
        user_id,
        asset_id,
        type,
        date,
        quantity,
        price,
        total,
        notes,
        linked_dividend_id
      ) VALUES (
        p_user_id,
        v_asset_id,
        v_tx_type,
        v_date,
        1,
        v_amount,
        v_amount,
        v_notes,
        v_existing_div.id
      );
    END IF;

    v_target_div_id := v_existing_div.id;
    v_result_div := to_jsonb(v_existing_div);

  ELSIF v_op = 'update' THEN
    v_date := coalesce(NULLIF(trim(coalesce(p_command->>'date', '')), '')::date, v_existing_div.date);
    v_amount := coalesce(round(NULLIF(trim(coalesce(p_command->>'amount', '')), '')::numeric, 2), v_existing_div.amount);
    v_sync_cash := CASE
      WHEN p_command ? 'sync_cash' THEN coalesce((p_command->>'sync_cash')::boolean, false)
      ELSE coalesce(v_existing_div.sync_cash, false)
    END;
    v_notes := CASE
      WHEN p_command ? 'notes' THEN NULLIF(trim(coalesce(p_command->>'notes', '')), '')
      ELSE v_existing_div.notes
    END;

    IF v_amount IS NULL OR v_amount <= 0 OR v_date IS NULL OR v_date < DATE '2000-01-01' THEN
      RAISE EXCEPTION 'Dados inválidos para edição de provento.' USING ERRCODE = '22023';
    END IF;

    v_prev_cash_brl := CASE
      WHEN coalesce(v_existing_div.sync_cash, false) THEN coalesce(v_existing_div.cash_amount, v_existing_div.amount, 0)
      ELSE 0
    END;

    IF v_sync_cash THEN
      IF NULLIF(trim(coalesce(p_command->>'cash_amount', '')), '') IS NOT NULL THEN
        v_new_cash_brl := round((p_command->>'cash_amount')::numeric, 2);
      ELSIF v_currency = 'USD' THEN
        v_fx_rate := NULLIF(trim(coalesce(p_command->>'fx_rate', '')), '')::numeric;
        IF v_fx_rate IS NULL OR v_fx_rate <= 0 THEN
          SELECT price INTO v_fx_rate
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_fx_rate := coalesce(v_fx_rate, 5.25);
        END IF;
        v_new_cash_brl := round(v_amount * v_fx_rate, 2);
      ELSE
        v_new_cash_brl := v_amount;
      END IF;
    ELSE
      v_new_cash_brl := 0;
    END IF;

    v_cash_delta := v_new_cash_brl - v_prev_cash_brl;

    UPDATE public.portfolio_dividends
    SET
      asset_id = coalesce(v_asset_id, asset_id),
      ticker = coalesce(NULLIF(v_ticker, ''), ticker),
      date = v_date,
      amount = v_amount,
      notes = v_notes,
      sync_cash = v_sync_cash,
      cash_amount = CASE WHEN v_sync_cash THEN v_new_cash_brl ELSE NULL END
    WHERE id = v_div_id
      AND user_id = p_user_id
    RETURNING * INTO v_existing_div;

    -- Atualiza transação vinculada por FK quando existir
    UPDATE public.portfolio_transactions
    SET
      asset_id = coalesce(v_asset_id, asset_id),
      date = v_date,
      price = v_amount,
      total = v_amount,
      notes = v_notes
    WHERE linked_dividend_id = v_div_id
      AND user_id = p_user_id;

    -- Se data, valor ou ativo mudaram, desfaz vínculos anteriores incompatíveis para reconciliação limpa
    IF p_links IS NOT NULL OR coalesce((p_command->>'unlink_existing')::boolean, false) THEN
      FOR v_ev_row IN
        SELECT id, payment_date, corporate_dividend_id
        FROM public.user_dividend_events
        WHERE user_id = p_user_id
          AND settled_dividend_id = v_div_id
        FOR UPDATE
      LOOP
        UPDATE public.user_dividend_events
        SET
          status = CASE
            WHEN v_ev_row.payment_date IS NULL OR v_ev_row.payment_date > v_today_br THEN 'PROVISIONED'
            ELSE 'PENDING_CONFIRMATION'
          END,
          settled_dividend_id = NULL,
          settlement_origin = NULL,
          manual_review_required = true,
          updated_at = now()
        WHERE id = v_ev_row.id;

        v_reopened_event_ids := array_append(v_reopened_event_ids, v_ev_row.id);
      END LOOP;
    END IF;

    v_target_div_id := v_existing_div.id;
    v_result_div := to_jsonb(v_existing_div);

  ELSIF v_op = 'delete' THEN
    v_rollback_cash := coalesce((p_command->>'rollback_cash')::boolean, false);
    v_prev_cash_brl := coalesce(v_existing_div.cash_amount, v_existing_div.amount, 0);

    -- 1) Reabre todos os eventos vinculados nos dois sentidos com manual_review_required = true
    FOR v_ev_row IN
      SELECT id, payment_date, corporate_dividend_id
      FROM public.user_dividend_events
      WHERE user_id = p_user_id
        AND (settled_dividend_id = v_div_id OR id = v_existing_div.source_event_id)
      FOR UPDATE
    LOOP
      UPDATE public.user_dividend_events
      SET
        status = CASE
          WHEN v_ev_row.payment_date IS NULL OR v_ev_row.payment_date > v_today_br THEN 'PROVISIONED'
          ELSE 'PENDING_CONFIRMATION'
        END,
        settled_dividend_id = NULL,
        settlement_origin = NULL,
        manual_review_required = true,
        updated_at = now()
      WHERE id = v_ev_row.id;

      IF v_ev_row.corporate_dividend_id IS NOT NULL THEN
        DELETE FROM public.portfolio_dividend_dismissals
        WHERE user_id = p_user_id
          AND corporate_dividend_id = v_ev_row.corporate_dividend_id;
      END IF;

      v_reopened_event_ids := array_append(v_reopened_event_ids, v_ev_row.id);
    END LOOP;

    -- 2) Remove transação vinculada por FK; para legado sem FK só apaga se único inequívoco
    DELETE FROM public.portfolio_transactions
    WHERE user_id = p_user_id
      AND linked_dividend_id = v_div_id;

    GET DIAGNOSTICS v_tx_count = ROW_COUNT;

    IF v_tx_count = 0 AND v_existing_div.asset_id IS NOT NULL THEN
      SELECT count(*), min(id)
      INTO v_tx_count, v_tx_id
      FROM public.portfolio_transactions
      WHERE user_id = p_user_id
        AND asset_id = v_existing_div.asset_id
        AND date = v_existing_div.date
        AND type IN ('dividend', 'jcp', 'fii_yield')
        AND abs(total - v_existing_div.amount) < 0.01
        AND linked_dividend_id IS NULL;

      IF v_tx_count = 1 AND v_tx_id IS NOT NULL THEN
        DELETE FROM public.portfolio_transactions
        WHERE id = v_tx_id AND user_id = p_user_id;
      ELSIF v_tx_count > 1 THEN
        v_ambiguous_tx_preserved := true;
      END IF;
    END IF;

    -- 3) Remove o provento do extrato
    DELETE FROM public.portfolio_dividends
    WHERE id = v_div_id
      AND user_id = p_user_id;

    -- 4) Estorna Caixa se solicitado (salvaguarda de saldo reinvestido)
    IF v_rollback_cash AND v_prev_cash_brl > 0 THEN
      v_cash_delta := -v_prev_cash_brl;
    END IF;
  END IF;

  -- Aplica delta real de Caixa sob lock na mesma transação
  IF v_cash_delta <> 0 THEN
    SELECT id, quantity
    INTO v_cash_asset_id, v_cash_balance
    FROM public.portfolio_assets
    WHERE user_id = p_user_id
      AND (upper(trim(ticker)) = 'CAIXA' OR lower(trim(coalesce(asset_class, ''))) = 'caixa')
    ORDER BY (upper(trim(ticker)) = 'CAIXA') DESC, id ASC
    LIMIT 1
    FOR UPDATE;

    IF v_cash_delta > 0 THEN
      IF v_cash_asset_id IS NULL THEN
        INSERT INTO public.portfolio_assets (
          user_id, ticker, asset_class, currency, quantity, average_price, notes
        ) VALUES (
          p_user_id, 'CAIXA', 'Caixa', 'BRL', v_cash_delta, 1.00, 'Caixa / Saldo em Corretora'
        )
        ON CONFLICT (user_id, ticker) DO UPDATE
        SET quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
            updated_at = now()
        RETURNING id INTO v_cash_asset_id;
      ELSE
        UPDATE public.portfolio_assets
        SET quantity = round((quantity + v_cash_delta)::numeric, 2),
            average_price = 1.00,
            updated_at = now()
        WHERE id = v_cash_asset_id;
      END IF;
    ELSE
      -- Débito/Estorno em Caixa nunca deixa saldo negativo
      IF v_cash_asset_id IS NOT NULL AND v_cash_balance > 0 THEN
        v_reverted_cash_brl := least(v_cash_balance, abs(v_cash_delta));
        v_cash_shortfall_brl := greatest(0, abs(v_cash_delta) - v_reverted_cash_brl);
        UPDATE public.portfolio_assets
        SET quantity = greatest(0, round((quantity - v_reverted_cash_brl)::numeric, 2)),
            average_price = 1.00,
            updated_at = now()
        WHERE id = v_cash_asset_id;
      ELSE
        v_reverted_cash_brl := 0;
        v_cash_shortfall_brl := abs(v_cash_delta);
      END IF;
    END IF;
  END IF;

  -- Aplica vínculos de conciliação calculados em Deno (`SETTLED`, `settlement_origin='dedup'`, sem 2º crédito)
  IF p_links IS NOT NULL AND jsonb_typeof(p_links) = 'array' AND jsonb_array_length(p_links) > 0 THEN
    FOR v_link IN SELECT * FROM jsonb_array_elements(p_links)
    LOOP
      v_target_div_id := coalesce(
        NULLIF(trim(coalesce(v_link->>'manual_id', '')), '')::uuid,
        v_target_div_id
      );
      IF v_target_div_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Garante que o lançamento manual pertence ao titular
      IF NOT EXISTS (
        SELECT 1 FROM public.portfolio_dividends WHERE id = v_target_div_id AND user_id = p_user_id
      ) THEN
        RAISE EXCEPTION 'Lançamento manual alvo não pertence ao titular.' USING ERRCODE = '42501';
      END IF;

      SELECT array_agg(elem::uuid)
      INTO v_link_event_ids
      FROM jsonb_array_elements_text(coalesce(v_link->'event_ids', '[]'::jsonb)) AS elem;

      IF v_link_event_ids IS NOT NULL THEN
        FOREACH v_link_eid IN ARRAY v_link_event_ids
        LOOP
          UPDATE public.user_dividend_events
          SET
            status = 'SETTLED',
            settlement_origin = 'dedup',
            settled_dividend_id = v_target_div_id,
            manual_review_required = false,
            updated_at = now()
          WHERE id = v_link_eid
            AND user_id = p_user_id
            AND status IN ('PROVISIONED', 'PENDING_CONFIRMATION')
            AND NOT manual_review_required;

          IF FOUND THEN
            v_linked_event_ids := array_append(v_linked_event_ids, v_link_eid);
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'needs_reconciliation', false,
    'conflict', false,
    'dividend', v_result_div,
    'cash_asset_id', v_cash_asset_id,
    'cash_delta_brl', v_cash_delta,
    'reverted_cash_brl', v_reverted_cash_brl,
    'cash_shortfall_brl', v_cash_shortfall_brl,
    'ambiguous_tx_preserved', v_ambiguous_tx_preserved,
    'reopened_event_ids', v_reopened_event_ids,
    'linked_event_ids', v_linked_event_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_dividend_reconciliation_system(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dividend_reconciliation_system(uuid, jsonb, jsonb, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. RPC em lote de dispensa com revisão otimista (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_user_dividend_events_atomic(
  p_ids uuid[],
  p_revisions bigint[],
  p_reason text DEFAULT 'manual_ignore'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_idx integer;
  v_id uuid;
  v_expected_rev bigint;
  v_ev public.user_dividend_events%ROWTYPE;
  v_reason text := coalesce(NULLIF(trim(p_reason), ''), 'manual_ignore');
  v_dismissed_ids uuid[] := ARRAY[]::uuid[];
  v_new_revisions bigint[] := ARRAY[]::bigint[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Nenhum evento informado para dispensa.' USING ERRCODE = '22023';
  END IF;

  IF p_revisions IS NOT NULL AND array_length(p_revisions, 1) IS DISTINCT FROM array_length(p_ids, 1) THEN
    RAISE EXCEPTION 'Lista de revisões incompatível com os IDs informados.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dividend_tracking:' || v_user_id::text));

  FOR v_idx IN 1..array_length(p_ids, 1)
  LOOP
    v_id := p_ids[v_idx];
    v_expected_rev := CASE WHEN p_revisions IS NOT NULL THEN p_revisions[v_idx] ELSE NULL END;

    SELECT * INTO v_ev
    FROM public.user_dividend_events
    WHERE id = v_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Evento % não encontrado ou pertence a outro titular.', v_id USING ERRCODE = '42501';
    END IF;

    IF v_expected_rev IS NOT NULL AND v_ev.revision <> v_expected_rev THEN
      RAISE EXCEPTION 'Evento % modificado concorrentemente; recarregue e tente novamente.', v_ev.ticker
        USING ERRCODE = '40001';
    END IF;

    IF v_ev.status = 'SETTLED' THEN
      RAISE EXCEPTION 'Evento % já foi liquidado e não pode ser dispensado.', v_ev.ticker
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.user_dividend_events
    SET
      status = 'DISMISSED',
      dismiss_reason = v_reason,
      updated_at = now()
    WHERE id = v_id AND user_id = v_user_id
    RETURNING revision INTO v_expected_rev;

    IF v_ev.corporate_dividend_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id, corporate_dividend_id, reason, dismissed_at
      ) VALUES (
        v_user_id, v_ev.corporate_dividend_id, v_reason, now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
      SET reason = EXCLUDED.reason,
          dismissed_at = now();
    END IF;

    v_dismissed_ids := array_append(v_dismissed_ids, v_id);
    v_new_revisions := array_append(v_new_revisions, v_expected_rev);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'dismissed_ids', v_dismissed_ids,
    'revisions', v_new_revisions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_user_dividend_events_atomic(uuid[], bigint[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_user_dividend_events_atomic(uuid[], bigint[], text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Atualização de `restore_backup` preservando `0159` + S3 (vínculos e origem)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb := coalesce(p_backup -> 'data', p_backup);
  v_counts jsonb;
  v_max_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write() THEN
    RAISE EXCEPTION 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(v_data) <> 'object' THEN
    RAISE EXCEPTION 'Backup inválido: campo "data" ausente ou malformado.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.allow_pair_mutation', 'true', true);
  PERFORM set_config('app.snapshot_rpc', 'on', true);
  PERFORM set_config('app.dividend_tracking_rpc', 'on', true);

  -- 1) Apaga os dados atuais do usuário (ordem segura de dependências FK)
  DELETE FROM public.user_dividend_events WHERE user_id = v_uid;
  DELETE FROM public.portfolio_dividend_dismissals WHERE user_id = v_uid;
  DELETE FROM public.portfolio_transactions pt
    USING public.portfolio_assets a
    WHERE pt.asset_id = a.id AND a.user_id = v_uid;
  DELETE FROM public.portfolio_dividends WHERE user_id = v_uid;
  DELETE FROM public.portfolio_contributions WHERE user_id = v_uid;
  DELETE FROM public.portfolio_snapshots WHERE user_id = v_uid;
  DELETE FROM public.class_targets WHERE user_id = v_uid;
  DELETE FROM public.sector_targets WHERE user_id = v_uid;
  DELETE FROM public.cash_checkpoints WHERE user_id = v_uid;
  DELETE FROM public.card_competence_overrides o
    USING public.credit_cards c
    WHERE o.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.card_payments cp
    USING public.credit_cards c
    WHERE cp.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.debts WHERE user_id = v_uid;
  DELETE FROM public.expenses WHERE user_id = v_uid;
  DELETE FROM public.card_bill_rollovers WHERE user_id = v_uid;
  DELETE FROM public.incomes WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.income_goals WHERE user_id = v_uid;
  DELETE FROM public.insight_feedback WHERE user_id = v_uid;
  DELETE FROM public.reminder_states WHERE user_id = v_uid;
  DELETE FROM public.asset_prices WHERE user_id = v_uid;
  DELETE FROM public.portfolio_assets WHERE user_id = v_uid;
  DELETE FROM public.credit_cards WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  DELETE FROM public.user_preferences WHERE user_id = v_uid;

  -- 2) Insere tabelas pais
  INSERT INTO public.categories (id, user_id, type, name, icon, color, is_reserved, is_active, scope)
  SELECT
    id, v_uid, type, name, icon, color, is_reserved, is_active,
    coalesce(nullif(scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  INSERT INTO public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits, scope)
  SELECT
    id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits,
    coalesce(nullif(scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  INSERT INTO public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    total_cost_brl, average_cost_brl, fx_rate_at_purchase,
    ceiling_price, ceiling_method, ceiling_metadata,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary,
    dividends_start_date
  )
  SELECT
    pa.id,
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    pa.total_cost_brl,
    pa.average_cost_brl,
    pa.fx_rate_at_purchase,
    pa.ceiling_price,
    pa.ceiling_method,
    pa.ceiling_metadata,
    coalesce(pa.accumulated_dividends, 0),
    coalesce(pa.estimated_monthly_dividend_per_share, 0),
    pa.fixed_income_metadata,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN coalesce(pa.is_family, false) ELSE false END,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN pa.family_id ELSE NULL END,
    coalesce(nullif(pa.family_share_mode, ''), 'full'),
    coalesce(pa.family_share_percentage, 100),
    pa.notes,
    pa.score,
    coalesce(nullif(pa.allocation_status, ''), 'active'),
    coalesce(pa.score_criteria, '{}'::jsonb),
    pa.last_reviewed_at,
    coalesce(pa.review_frequency_months, 6),
    pa.thesis_summary,
    CASE
      WHEN pa.dividends_start_date IS NOT NULL
       AND pa.dividends_start_date >= DATE '2000-01-01'
       AND pa.dividends_start_date <= v_max_date
      THEN pa.dividends_start_date
      ELSE NULL
    END
  FROM jsonb_populate_recordset(NULL::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  LEFT JOIN public.families f ON f.id = pa.family_id;

  INSERT INTO public.user_preferences (
    user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill,
    report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings, app_mode
  )
  SELECT
    v_uid,
    coalesce(nullif(theme, ''), 'system'),
    coalesce(reminders_enabled, true),
    coalesce(reminder_days_before_debt, 3),
    coalesce(reminder_days_before_bill, 3),
    coalesce(report_weights_enabled, false),
    coalesce(max_sector_acoes, 25),
    coalesce(max_sector_fiis, 25),
    CASE
      WHEN jsonb_typeof(custom_settings->'dividendAutomation') = 'object'
       AND (custom_settings->'dividendAutomation') ? 'trackingStartDate'
       AND public.parse_valid_dividend_date(custom_settings->'dividendAutomation'->>'trackingStartDate') IS NULL
      THEN jsonb_set(
        coalesce(custom_settings, '{}'::jsonb),
        '{dividendAutomation}',
        (custom_settings->'dividendAutomation') - 'trackingStartDate',
        true
      )
      ELSE coalesce(custom_settings, '{}'::jsonb)
    END,
    coalesce(nullif(app_mode, ''), 'investor')
  FROM jsonb_populate_recordset(NULL::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  INSERT INTO public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  SELECT o.id, o.card_id, o.month, o.closing_day, o.due_day
  FROM jsonb_populate_recordset(NULL::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  JOIN public.credit_cards c ON c.id = o.card_id
  WHERE c.user_id = v_uid;

  INSERT INTO public.card_bill_rollovers (
    id, user_id, card_id, from_competence_month, to_competence_month,
    principal_amount, kind, group_id, note, created_at
  )
  SELECT
    r.id,
    v_uid,
    r.card_id,
    r.from_competence_month,
    r.to_competence_month,
    r.principal_amount,
    coalesce(nullif(r.kind, ''), 'rollover'),
    coalesce(r.group_id, gen_random_uuid()),
    r.note,
    coalesce(r.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.card_bill_rollovers, coalesce(v_data -> 'card_bill_rollovers', '[]'::jsonb)) r
  JOIN public.credit_cards cc ON cc.id = r.card_id
  WHERE cc.user_id = v_uid;

  INSERT INTO public.incomes (
    id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at,
    scope, is_internal_transfer, transfer_pair_id, transfer_kind
  )
  SELECT
    i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at,
    coalesce(nullif(i.scope, ''), 'personal'),
    coalesce(i.is_internal_transfer, false),
    i.transfer_pair_id,
    i.transfer_kind
  FROM jsonb_populate_recordset(NULL::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  JOIN public.categories cat ON cat.id = i.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.expenses (
    id, user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at,
    charge_kind, scope, is_internal_transfer, transfer_pair_id, transfer_kind, is_tax_deductible,
    rollover_id
  )
  SELECT
    e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id,
    e.installments_total, e.installment_number, e.installment_group_id,
    e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at,
    coalesce(nullif(e.charge_kind, ''), 'regular'),
    coalesce(nullif(e.scope, ''), 'personal'),
    coalesce(e.is_internal_transfer, false),
    e.transfer_pair_id,
    e.transfer_kind,
    coalesce(e.is_tax_deductible, false),
    CASE WHEN r.id IS NOT NULL THEN e.rollover_id ELSE NULL END
  FROM jsonb_populate_recordset(NULL::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  JOIN public.categories cat ON cat.id = e.category_id
  LEFT JOIN public.credit_cards cc ON cc.id = e.card_id
  LEFT JOIN public.card_bill_rollovers r ON r.id = e.rollover_id AND r.user_id = v_uid
  WHERE cat.user_id = v_uid AND (e.card_id IS NULL OR cc.user_id = v_uid);

  INSERT INTO public.debts (
    id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at,
    charge_kind, scope
  )
  SELECT
    d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, e.id, d.installment_group_id, d.created_at,
    coalesce(nullif(d.charge_kind, ''), 'regular'),
    coalesce(nullif(d.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d
  LEFT JOIN public.expenses e ON e.id = d.expense_id AND e.user_id = v_uid
  WHERE d.expense_id IS NULL OR e.id IS NOT NULL;

  INSERT INTO public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  SELECT cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  FROM jsonb_populate_recordset(NULL::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  JOIN public.credit_cards cc ON cc.id = cp.card_id
  WHERE cc.user_id = v_uid;

  INSERT INTO public.budgets (id, user_id, category_id, month, "limit")
  SELECT b.id, v_uid, b.category_id, b.month, b."limit"
  FROM jsonb_populate_recordset(NULL::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  JOIN public.categories cat ON cat.id = b.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.income_goals (id, user_id, category_id, month, expected)
  SELECT ig.id, v_uid, ig.category_id, ig.month, ig.expected
  FROM jsonb_populate_recordset(NULL::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  JOIN public.categories cat ON cat.id = ig.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  SELECT id, v_uid, occurrence_key, decision, created_at
  FROM jsonb_populate_recordset(NULL::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  INSERT INTO public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  SELECT id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  -- Passo A: portfolio_dividends antes de portfolio_transactions (source_event_id será recomposto após user_dividend_events)
  -- Força entry_origin = 'restore' em qualquer versão de backup (§2)
  INSERT INTO public.portfolio_dividends (
    id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount,
    request_id, entry_origin, created_at
  )
  SELECT
    pd.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pd.asset_id ELSE NULL END,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    pd.request_id,
    'restore',
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN public.portfolio_assets pa ON pa.id = pd.asset_id AND pa.user_id = v_uid;

  -- Passo B: portfolio_transactions com linked_dividend_id validado no próprio usuário
  INSERT INTO public.portfolio_transactions (
    id, user_id, asset_id, type, date, quantity, price, total,
    total_cost_brl, fx_rate, notes, batch_id, linked_dividend_id
  )
  SELECT
    pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total,
    pt.total_cost_brl, pt.fx_rate, pt.notes, pt.batch_id,
    CASE WHEN pd.id IS NOT NULL THEN pt.linked_dividend_id ELSE NULL END
  FROM jsonb_populate_recordset(NULL::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  JOIN public.portfolio_assets pa ON pa.id = pt.asset_id
  LEFT JOIN public.portfolio_dividends pd ON pd.id = pt.linked_dividend_id AND pd.user_id = v_uid
  WHERE pa.user_id = v_uid;

  -- Passo C: user_dividend_events e dispensas (somente do próprio titular e FKs válidas)
  INSERT INTO public.user_dividend_events (
    id, user_id, corporate_dividend_id, asset_id, ticker, type, status,
    com_date, payment_date, quantity_on_com_date, gross_rate, net_rate, tax_rate_pct,
    gross_amount, net_amount, currency, fx_rate_applied, settled_dividend_id,
    settlement_origin, dismiss_reason, is_manual, is_type_uncertain, manual_review_required,
    notes, revision, created_at, updated_at
  )
  SELECT
    ude.id,
    v_uid,
    cd.id,
    ude.asset_id,
    upper(trim(ude.ticker)),
    CASE
      WHEN upper(trim(coalesce(ude.type, ''))) IN ('DIVIDENDO','JCP','RENDIMENTO','SOBRA','AMORTIZACAO','OUTROS')
      THEN upper(trim(ude.type))
      ELSE 'DIVIDENDO'
    END,
    CASE
      WHEN upper(trim(coalesce(ude.status, ''))) IN ('PROVISIONED','PENDING_CONFIRMATION','SETTLED','DISMISSED')
      THEN upper(trim(ude.status))
      ELSE 'PROVISIONED'
    END,
    ude.com_date,
    ude.payment_date,
    coalesce(ude.quantity_on_com_date, 0),
    coalesce(ude.gross_rate, 0),
    coalesce(ude.net_rate, 0),
    coalesce(ude.tax_rate_pct, 0),
    coalesce(ude.gross_amount, 0),
    coalesce(ude.net_amount, 0),
    CASE WHEN upper(trim(coalesce(ude.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
    ude.fx_rate_applied,
    CASE WHEN pd.id IS NOT NULL THEN ude.settled_dividend_id ELSE NULL END,
    CASE
      WHEN ude.settlement_origin IN ('auto', 'manual', 'dedup') THEN ude.settlement_origin
      ELSE NULL
    END,
    ude.dismiss_reason,
    coalesce(ude.is_manual, false),
    coalesce(ude.is_type_uncertain, false),
    coalesce(ude.manual_review_required, false),
    ude.notes,
    greatest(1, coalesce(ude.revision, 1)),
    coalesce(ude.created_at, now()),
    coalesce(ude.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.user_dividend_events, coalesce(v_data -> 'user_dividend_events', '[]'::jsonb)) ude
  JOIN public.portfolio_assets pa ON pa.id = ude.asset_id AND pa.user_id = v_uid
  LEFT JOIN public.corporate_dividends cd ON cd.id = ude.corporate_dividend_id
  LEFT JOIN public.portfolio_dividends pd ON pd.id = ude.settled_dividend_id AND pd.user_id = v_uid;

  -- Recompõe FK circular `portfolio_dividends.source_event_id` para o próprio usuário
  UPDATE public.portfolio_dividends pd
  SET source_event_id = src.source_event_id
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) src
  JOIN public.user_dividend_events ude ON ude.id = src.source_event_id AND ude.user_id = v_uid
  WHERE pd.id = src.id
    AND pd.user_id = v_uid
    AND src.source_event_id IS NOT NULL;

  INSERT INTO public.portfolio_dividend_dismissals (id, user_id, corporate_dividend_id, reason, dismissed_at)
  SELECT
    coalesce(pdd.id, gen_random_uuid()),
    v_uid,
    pdd.corporate_dividend_id,
    coalesce(nullif(pdd.reason, ''), 'manual_ignore'),
    coalesce(pdd.dismissed_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividend_dismissals, coalesce(v_data -> 'portfolio_dividend_dismissals', '[]'::jsonb)) pdd
  JOIN public.corporate_dividends cd ON cd.id = pdd.corporate_dividend_id
  ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

  INSERT INTO public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  SELECT
    ps.id,
    v_uid,
    ps.month,
    ps.total_value,
    ps.total_cost,
    ps.auto_total_value,
    ps.auto_total_cost,
    ps.manual_total_value,
    ps.manual_total_cost,
    coalesce(ps.is_manually_calibrated, false),
    ps.calibrated_at,
    coalesce(nullif(ps.status, ''), 'closed'),
    ps.closing_date,
    ps.closed_at,
    coalesce(ps.created_at, now()),
    coalesce(ps.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps;

  INSERT INTO public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, batch_id, created_at)
  SELECT
    pc.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pc.asset_id ELSE NULL END,
    pc.date,
    pc.amount,
    pc.notes,
    pc.batch_id,
    coalesce(pc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  LEFT JOIN public.portfolio_assets pa ON pa.id = pc.asset_id AND pa.user_id = v_uid;

  INSERT INTO public.class_targets (id, user_id, group_type, name, target_percentage)
  SELECT id, v_uid, coalesce(nullif(group_type, ''), 'class'), name, target_percentage
  FROM jsonb_populate_recordset(NULL::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb))
  WHERE lower(trim(coalesce(name, ''))) <> 'caixa';

  INSERT INTO public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  SELECT
    id,
    v_uid,
    coalesce(nullif(group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(class_name, '')), ''), 'Ações'),
    name,
    target_percentage
  FROM jsonb_populate_recordset(NULL::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  INSERT INTO public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, provider, market_price_at, updated_at)
  SELECT DISTINCT ON (upper(trim(ap.ticker)))
    coalesce(ap.id, gen_random_uuid()),
    v_uid,
    upper(trim(ap.ticker)),
    coalesce(ap.manual_price, ap.price),
    CASE WHEN upper(trim(coalesce(ap.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
    'manual',
    coalesce(ap.manual_price, ap.price),
    'manual',
    coalesce(ap.market_price_at, ap.updated_at, now()),
    coalesce(ap.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  WHERE ap.user_id IS NOT NULL
    AND nullif(trim(coalesce(ap.ticker, '')), '') IS NOT NULL
    AND (ap.source = 'manual' OR ap.manual_price IS NOT NULL)
    AND coalesce(ap.manual_price, ap.price, 0) > 0
  ORDER BY upper(trim(ap.ticker)), coalesce(ap.updated_at, now()) DESC
  ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE
  SET price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      source = 'manual',
      manual_price = EXCLUDED.manual_price,
      provider = 'manual',
      market_price_at = EXCLUDED.market_price_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at, scope)
  SELECT
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now()),
    coalesce(nullif(cc.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  SELECT jsonb_build_object(
    'categories', (SELECT count(*) FROM public.categories WHERE user_id = v_uid),
    'credit_cards', (SELECT count(*) FROM public.credit_cards WHERE user_id = v_uid),
    'incomes', (SELECT count(*) FROM public.incomes WHERE user_id = v_uid),
    'expenses', (SELECT count(*) FROM public.expenses WHERE user_id = v_uid),
    'card_bill_rollovers', (SELECT count(*) FROM public.card_bill_rollovers WHERE user_id = v_uid),
    'debts', (SELECT count(*) FROM public.debts WHERE user_id = v_uid),
    'portfolio_assets', (SELECT count(*) FROM public.portfolio_assets WHERE user_id = v_uid),
    'portfolio_dividends', (SELECT count(*) FROM public.portfolio_dividends WHERE user_id = v_uid),
    'user_dividend_events', (SELECT count(*) FROM public.user_dividend_events WHERE user_id = v_uid),
    'class_targets', (SELECT count(*) FROM public.class_targets WHERE user_id = v_uid),
    'sector_targets', (SELECT count(*) FROM public.sector_targets WHERE user_id = v_uid)
  ) INTO v_counts;

  RETURN jsonb_build_object('success', true, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
