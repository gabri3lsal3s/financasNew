-- Corrige min(uuid) inexistente no PostgreSQL dentro de apply_dividend_reconciliation_system (v_op = delete).

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
      SELECT count(*), min(id::text)::uuid
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
