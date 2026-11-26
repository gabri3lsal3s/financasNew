-- =============================================================================
-- Migration 0159: Proteção Imediata, Calibração de Corte e Saneamento (S1)
-- =============================================================================
-- Fatia S1 de `docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md` (§3.1 / §4.3):
--   1. Colunas e índices estruturais:
--      - `portfolio_assets.dividends_start_date` (`>= 2000-01-01`, teto amanhã BRT via trigger/RPC)
--      - `user_dividend_events.revision` (incremento automático em `BEFORE UPDATE`)
--      - `idx_dividend_manual_asset_date` em `portfolio_dividends`
--      - Metadados em `corporate_dividends` (`trust_tier`, `external_terms`, `published`)
--   2. Backfill único e proteção de `custom_settings.dividendAutomation.trackingStartDate`:
--      - Trigger `preserve_dividend_tracking_start_on_pref_update` preserva o corte vigente
--        contra sobrescrita por cache antigo em outras abas (`app.dividend_tracking_rpc`).
--   3. Motor SQL de corte/custódia por lote + RPC atômica `set_dividend_tracking_atomic`:
--      - Lock por titular (`pg_advisory_xact_lock`) + locks ordenados por `asset_id`;
--      - Concorrência otimista por `expected_start` / `p_expected_tracking_start` com idempotência;
--      - Proteção de overrides legados (tolerância 0,02 em moeda nativa) antes de zerar
--        eventos automáticos abertos inelegíveis ou de grupos com elegibilidade mista alterada.
--   4. Endurecimento das portas de confirmação e liquidação:
--      - `confirm_user_dividend_events_atomic`, `approve_dividends_batch_atomic`,
--        `settle_user_dividend_event_system`: sem coalesce para `today`, data real em
--        `[com_date, todayBR]`, `expected_revision`, guarda de corte sob lock.
--   5. Atualização de `restore_backup(jsonb)` a partir da `0154` com `dividends_start_date`,
--      `trackingStartDate`, `app.snapshot_rpc`/`app.dividend_tracking_rpc`, `portfolio_assets`
--      e índice parcial correto de `asset_prices`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Evolução aditiva de schema e índices
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolio_assets
  ADD COLUMN IF NOT EXISTS dividends_start_date date;

ALTER TABLE public.portfolio_assets
  DROP CONSTRAINT IF EXISTS chk_portfolio_assets_dividends_start_date;

ALTER TABLE public.portfolio_assets
  ADD CONSTRAINT chk_portfolio_assets_dividends_start_date
  CHECK (dividends_start_date IS NULL OR dividends_start_date >= DATE '2000-01-01');

CREATE OR REPLACE FUNCTION public.validate_portfolio_asset_dividends_start_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
BEGIN
  IF NEW.dividends_start_date IS NOT NULL AND (NEW.dividends_start_date < DATE '2000-01-01' OR NEW.dividends_start_date > v_max_date) THEN
    RAISE EXCEPTION 'Data de corte de proventos (%) fora do intervalo permitido (entre 2000-01-01 e %).',
      NEW.dividends_start_date, v_max_date
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_portfolio_asset_dividends_start_date ON public.portfolio_assets;
CREATE TRIGGER trg_validate_portfolio_asset_dividends_start_date
  BEFORE INSERT OR UPDATE OF dividends_start_date ON public.portfolio_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_portfolio_asset_dividends_start_date();

ALTER TABLE public.user_dividend_events
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

ALTER TABLE public.user_dividend_events
  DROP CONSTRAINT IF EXISTS chk_user_dividend_events_revision_positive;

ALTER TABLE public.user_dividend_events
  ADD CONSTRAINT chk_user_dividend_events_revision_positive
  CHECK (revision >= 1);

CREATE OR REPLACE FUNCTION public.bump_user_dividend_event_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.revision := greatest(1, coalesce(OLD.revision, 1) + 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_user_dividend_event_revision ON public.user_dividend_events;
CREATE TRIGGER trg_bump_user_dividend_event_revision
  BEFORE UPDATE ON public.user_dividend_events
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_dividend_event_revision();

CREATE INDEX IF NOT EXISTS idx_dividend_manual_asset_date
  ON public.portfolio_dividends (user_id, asset_id, date DESC, id);

ALTER TABLE public.corporate_dividends
  ADD COLUMN IF NOT EXISTS trust_tier text NOT NULL DEFAULT 'raw_fallback',
  ADD COLUMN IF NOT EXISTS external_terms jsonb,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

ALTER TABLE public.corporate_dividends
  DROP CONSTRAINT IF EXISTS chk_corporate_dividends_trust_tier;

ALTER TABLE public.corporate_dividends
  ADD CONSTRAINT chk_corporate_dividends_trust_tier
  CHECK (trust_tier IN ('official', 'community_verified', 'enriched_fallback', 'raw_fallback'));

-- -----------------------------------------------------------------------------
-- 2. Helpers puros de ticker, parsing seguro de data e proteção de preferências
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_dividend_ticker_key(
  p_ticker text,
  p_currency text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN upper(trim(coalesce(p_currency, ''))) = 'USD'
      THEN regexp_replace(upper(trim(coalesce(p_ticker, ''))), '\.SA$', '')
    ELSE regexp_replace(
      regexp_replace(upper(trim(coalesce(p_ticker, ''))), '\.SA$', ''),
      '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$',
      '\1'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.parse_valid_dividend_date(p_raw text)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean text := trim(coalesce(p_raw, ''));
  v_date date;
  v_max_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
BEGIN
  IF v_clean !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_date := v_clean::date;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF v_date < DATE '2000-01-01' OR v_date > v_max_date THEN
    RETURN NULL;
  END IF;

  RETURN v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.preserve_dividend_tracking_start_on_pref_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_privileged boolean := (
    current_setting('app.dividend_tracking_rpc', true) = 'on'
    OR current_setting('app.snapshot_rpc', true) = 'on'
    OR coalesce(auth.role(), '') = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
  );
  v_div_auto jsonb;
  v_old_div_auto jsonb;
  v_parsed_tracking date;
BEGIN
  IF v_is_privileged THEN
    IF NEW.custom_settings IS NOT NULL
       AND jsonb_typeof(NEW.custom_settings->'dividendAutomation') = 'object'
       AND (NEW.custom_settings->'dividendAutomation') ? 'trackingStartDate' THEN
      v_div_auto := NEW.custom_settings->'dividendAutomation';
      IF v_div_auto->'trackingStartDate' <> 'null'::jsonb THEN
        v_parsed_tracking := public.parse_valid_dividend_date(v_div_auto->>'trackingStartDate');
        IF v_parsed_tracking IS NULL THEN
          RAISE EXCEPTION 'trackingStartDate inválido em dividendAutomation.' USING ERRCODE = '22023';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_div_auto := CASE
    WHEN NEW.custom_settings IS NOT NULL AND jsonb_typeof(NEW.custom_settings->'dividendAutomation') = 'object'
    THEN NEW.custom_settings->'dividendAutomation'
    ELSE NULL
  END;

  IF TG_OP = 'INSERT' THEN
    IF v_div_auto IS NOT NULL AND v_div_auto ? 'trackingStartDate' THEN
      NEW.custom_settings := jsonb_set(
        coalesce(NEW.custom_settings, '{}'::jsonb),
        '{dividendAutomation}',
        v_div_auto - 'trackingStartDate',
        true
      );
    END IF;
    RETURN NEW;
  END IF;

  v_old_div_auto := CASE
    WHEN OLD.custom_settings IS NOT NULL AND jsonb_typeof(OLD.custom_settings->'dividendAutomation') = 'object'
    THEN OLD.custom_settings->'dividendAutomation'
    ELSE NULL
  END;

  IF v_old_div_auto IS NOT NULL AND v_old_div_auto ? 'trackingStartDate' THEN
    NEW.custom_settings := jsonb_set(
      coalesce(NEW.custom_settings, '{}'::jsonb),
      '{dividendAutomation}',
      coalesce(v_div_auto, '{}'::jsonb) || jsonb_build_object('trackingStartDate', v_old_div_auto->'trackingStartDate'),
      true
    );
  ELSIF v_div_auto IS NOT NULL AND v_div_auto ? 'trackingStartDate' THEN
    NEW.custom_settings := jsonb_set(
      coalesce(NEW.custom_settings, '{}'::jsonb),
      '{dividendAutomation}',
      v_div_auto - 'trackingStartDate',
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_dividend_tracking_start ON public.user_preferences;
CREATE TRIGGER trg_preserve_dividend_tracking_start
  BEFORE INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_dividend_tracking_start_on_pref_update();

-- Inicializa `trackingStartDate` uma única vez para preferências legadas sem piso
UPDATE public.user_preferences up
SET
  custom_settings = jsonb_set(
    coalesce(up.custom_settings, '{}'::jsonb),
    '{dividendAutomation}',
    CASE
      WHEN jsonb_typeof(up.custom_settings->'dividendAutomation') = 'object'
      THEN up.custom_settings->'dividendAutomation'
      ELSE '{}'::jsonb
    END || jsonb_build_object(
      'trackingStartDate',
      to_char(
        coalesce(
          public.parse_valid_dividend_date(up.custom_settings->'dividendAutomation'->>'trackingStartDate'),
          public.parse_valid_dividend_date(up.custom_settings->'dividendAutomation'->>'activatedAt'),
          (now() AT TIME ZONE 'America/Sao_Paulo')::date
        ),
        'YYYY-MM-DD'
      )
    ),
    true
  )
WHERE public.parse_valid_dividend_date(up.custom_settings->'dividendAutomation'->>'trackingStartDate') IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Avaliador interno de elegibilidade e custódia por grupo canônico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_dividend_group_cutoff(
  p_user_id uuid,
  p_canonical_ticker text,
  p_currency text,
  p_com_date date,
  p_tracking_start date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lot RECORD;
  v_tx RECORD;
  v_tx_qty numeric;
  v_zero_qty numeric;
  v_had_clamped_sell boolean;
  v_first_ledger_day date;
  v_rev_qty numeric;
  v_baseline_qty numeric;
  v_has_txs boolean;
  v_created_day date;
  v_baseline_proven_day date;
  v_first_proven_day date;
  v_eff_start date;
  v_lot_qty numeric;
  v_tx_date date;
  v_currency text := upper(trim(coalesce(p_currency, 'BRL')));
  v_eligible_qty numeric := 0;
  v_eligible_lot_count integer := 0;
  v_ineligible_lot_count integer := 0;
  v_total_lot_count integer := 0;
  v_uncalibrated_lot_count integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_canonical_ticker IS NULL OR p_com_date IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'eligible_qty', 0,
      'eligible_lot_count', 0,
      'ineligible_lot_count', 0,
      'total_lot_count', 0,
      'uncalibrated_lot_count', 0
    );
  END IF;

  FOR v_lot IN
    SELECT
      pa.id,
      greatest(0::numeric, coalesce(pa.quantity, 0)::numeric) AS current_qty,
      coalesce(pa.accumulated_dividends, 0)::numeric AS accumulated_dividends,
      pa.dividends_start_date,
      CASE
        WHEN pa.created_at IS NOT NULL
         AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= DATE '2000-01-01'
         AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
        THEN (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE NULL
      END AS created_day
    FROM public.portfolio_assets pa
    WHERE pa.user_id = p_user_id
      AND upper(trim(pa.ticker)) <> 'CAIXA'
      AND upper(trim(coalesce(pa.currency, 'BRL'))) = v_currency
      AND public.normalize_dividend_ticker_key(pa.ticker, pa.currency) = p_canonical_ticker
  LOOP
    v_total_lot_count := v_total_lot_count + 1;
    v_zero_qty := 0;
    v_had_clamped_sell := false;
    v_first_ledger_day := NULL;
    v_has_txs := false;

    -- Replay zero-baseline cronológico no mesmo tie-break canônico
    FOR v_tx IN
      SELECT
        pt.id,
        pt.type,
        pt.date::date AS tx_date,
        coalesce(pt.quantity, 0)::numeric AS qty
      FROM public.portfolio_transactions pt
      WHERE pt.asset_id = v_lot.id
        AND pt.type IN ('buy', 'subscription', 'sell', 'split', 'reverse_split')
      ORDER BY
        pt.date::date ASC,
        CASE pt.type
          WHEN 'split' THEN 0
          WHEN 'reverse_split' THEN 0
          WHEN 'buy' THEN 1
          WHEN 'subscription' THEN 1
          ELSE 2
        END ASC,
        pt.id ASC
    LOOP
      v_has_txs := true;
      v_tx_qty := coalesce(v_tx.qty, 0);
      IF v_tx.type IN ('buy', 'subscription') THEN
        v_zero_qty := v_zero_qty + greatest(0::numeric, v_tx_qty);
      ELSIF v_tx.type = 'sell' THEN
        IF v_zero_qty + 0.000001 < v_tx_qty THEN
          v_had_clamped_sell := true;
        END IF;
        v_zero_qty := greatest(0::numeric, v_zero_qty - greatest(0::numeric, v_tx_qty));
      ELSIF v_tx.type = 'split' THEN
        IF v_tx_qty > 0 THEN
          v_zero_qty := v_zero_qty * v_tx_qty;
        END IF;
      ELSIF v_tx.type = 'reverse_split' THEN
        IF v_tx_qty > 0 THEN
          v_zero_qty := v_zero_qty / v_tx_qty;
        END IF;
      END IF;

      IF v_first_ledger_day IS NULL AND v_zero_qty > 0.000001 AND v_tx.tx_date >= DATE '2000-01-01' THEN
        v_first_ledger_day := v_tx.tx_date;
      END IF;
    END LOOP;

    IF NOT v_has_txs THEN
      v_baseline_qty := v_lot.current_qty;
    ELSIF v_lot.current_qty > v_zero_qty + 0.000001 OR v_had_clamped_sell THEN
      v_rev_qty := v_lot.current_qty;
      FOR v_tx IN
        SELECT
          pt.id,
          pt.type,
          pt.date::date AS tx_date,
          coalesce(pt.quantity, 0)::numeric AS qty
        FROM public.portfolio_transactions pt
        WHERE pt.asset_id = v_lot.id
          AND pt.type IN ('buy', 'subscription', 'sell', 'split', 'reverse_split')
        ORDER BY
          pt.date::date DESC,
          CASE pt.type
            WHEN 'split' THEN 0
            WHEN 'reverse_split' THEN 0
            WHEN 'buy' THEN 1
            WHEN 'subscription' THEN 1
            ELSE 2
          END DESC,
          pt.id DESC
      LOOP
        v_tx_qty := coalesce(v_tx.qty, 0);
        IF v_tx.type IN ('buy', 'subscription') THEN
          v_rev_qty := v_rev_qty - greatest(0::numeric, v_tx_qty);
        ELSIF v_tx.type = 'sell' THEN
          v_rev_qty := v_rev_qty + greatest(0::numeric, v_tx_qty);
        ELSIF v_tx.type = 'split' THEN
          IF v_tx_qty > 0 THEN
            v_rev_qty := v_rev_qty / v_tx_qty;
          END IF;
        ELSIF v_tx.type = 'reverse_split' THEN
          IF v_tx_qty > 0 THEN
            v_rev_qty := v_rev_qty * v_tx_qty;
          END IF;
        END IF;
      END LOOP;
      v_baseline_qty := CASE WHEN v_rev_qty > 0.000001 THEN round(v_rev_qty, 8) ELSE 0 END;
    ELSE
      v_baseline_qty := 0;
    END IF;

    v_created_day := v_lot.created_day;
    v_baseline_proven_day := CASE
      WHEN v_baseline_qty > 0.000001 THEN coalesce(v_lot.dividends_start_date, v_created_day)
      ELSE NULL
    END;

    IF v_first_ledger_day IS NOT NULL AND v_baseline_proven_day IS NOT NULL THEN
      v_first_proven_day := least(v_first_ledger_day, v_baseline_proven_day);
    ELSE
      v_first_proven_day := coalesce(v_first_ledger_day, v_baseline_proven_day);
    END IF;

    -- Regra de effectiveStartDate (§3.1 items 1–3)
    IF v_lot.accumulated_dividends > 0 THEN
      IF v_lot.dividends_start_date IS NULL THEN
        v_eff_start := NULL;
        v_uncalibrated_lot_count := v_uncalibrated_lot_count + 1;
      ELSIF p_tracking_start IS NOT NULL THEN
        v_eff_start := greatest(p_tracking_start, v_lot.dividends_start_date);
      ELSE
        v_eff_start := v_lot.dividends_start_date;
      END IF;
    ELSIF v_lot.dividends_start_date IS NOT NULL THEN
      IF p_tracking_start IS NOT NULL THEN
        v_eff_start := greatest(p_tracking_start, v_lot.dividends_start_date);
      ELSE
        v_eff_start := v_lot.dividends_start_date;
      END IF;
    ELSE
      IF v_first_proven_day IS NULL THEN
        v_eff_start := NULL;
        IF v_lot.current_qty > 0.000001 THEN
          v_uncalibrated_lot_count := v_uncalibrated_lot_count + 1;
        END IF;
      ELSIF p_tracking_start IS NOT NULL THEN
        v_eff_start := greatest(p_tracking_start, v_first_proven_day);
      ELSE
        v_eff_start := v_first_proven_day;
      END IF;
    END IF;

    IF v_eff_start IS NULL OR p_com_date < v_eff_start THEN
      v_ineligible_lot_count := v_ineligible_lot_count + 1;
      CONTINUE;
    END IF;

    -- Replay até `p_com_date` inclusivo para o lote elegível
    IF NOT v_has_txs THEN
      v_lot_qty := CASE
        WHEN v_baseline_proven_day IS NOT NULL AND p_com_date >= v_baseline_proven_day THEN v_lot.current_qty
        ELSE 0
      END;
    ELSE
      v_lot_qty := CASE
        WHEN v_baseline_qty > 0.000001 AND v_baseline_proven_day IS NOT NULL AND p_com_date >= v_baseline_proven_day
        THEN v_baseline_qty
        ELSE 0
      END;

      FOR v_tx IN
        SELECT
          pt.id,
          pt.type,
          pt.date::date AS tx_date,
          coalesce(pt.quantity, 0)::numeric AS qty
        FROM public.portfolio_transactions pt
        WHERE pt.asset_id = v_lot.id
          AND pt.date::date <= p_com_date
          AND pt.type IN ('buy', 'subscription', 'sell', 'split', 'reverse_split')
        ORDER BY
          pt.date::date ASC,
          CASE pt.type
            WHEN 'split' THEN 0
            WHEN 'reverse_split' THEN 0
            WHEN 'buy' THEN 1
            WHEN 'subscription' THEN 1
            ELSE 2
          END ASC,
          pt.id ASC
      LOOP
        v_tx_qty := coalesce(v_tx.qty, 0);
        IF v_tx.type IN ('buy', 'subscription') THEN
          v_lot_qty := v_lot_qty + greatest(0::numeric, v_tx_qty);
        ELSIF v_tx.type = 'sell' THEN
          v_lot_qty := greatest(0::numeric, v_lot_qty - greatest(0::numeric, v_tx_qty));
        ELSIF v_tx.type = 'split' THEN
          IF v_tx_qty > 0 THEN
            v_lot_qty := v_lot_qty * v_tx_qty;
          END IF;
        ELSIF v_tx.type = 'reverse_split' THEN
          IF v_tx_qty > 0 THEN
            v_lot_qty := v_lot_qty / v_tx_qty;
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF v_lot_qty > 0.000001 THEN
      v_eligible_lot_count := v_eligible_lot_count + 1;
      v_eligible_qty := v_eligible_qty + round(v_lot_qty, 8);
    ELSE
      v_ineligible_lot_count := v_ineligible_lot_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'eligible', v_eligible_lot_count > 0 AND v_eligible_qty > 0.000001,
    'eligible_qty', round(v_eligible_qty, 8),
    'eligible_lot_count', v_eligible_lot_count,
    'ineligible_lot_count', v_ineligible_lot_count,
    'total_lot_count', v_total_lot_count,
    'uncalibrated_lot_count', v_uncalibrated_lot_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_user_dividend_group_cutoff(uuid, text, text, date, date) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC Atômica `set_dividend_tracking_atomic` (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_dividend_tracking_atomic(
  p_tracking_start date DEFAULT NULL,
  p_assets jsonb DEFAULT '[]'::jsonb,
  p_expected_tracking_start date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_max_date date := v_today_br + 1;
  v_assets_json jsonb := coalesce(p_assets, '[]'::jsonb);
  v_pref public.user_preferences%ROWTYPE;
  v_current_tracking date;
  v_next_tracking date;
  v_global_changed boolean := false;
  v_updated_assets_count integer := 0;
  v_protected_events_count integer := 0;
  v_affected_events_count integer := 0;
  v_invalidated_event_ids uuid[] := ARRAY[]::uuid[];
  v_affected_groups text[] := ARRAY[]::text[];
  v_requested_groups text[] := ARRAY[]::text[];
  v_seen_ids uuid[] := ARRAY[]::uuid[];
  v_item jsonb;
  v_asset_id uuid;
  v_expected_start date;
  v_start_date date;
  v_start_raw text;
  v_expected_raw text;
  v_req RECORD;
  v_asset RECORD;
  v_group_key text;
  v_all_requested_already_aligned boolean := true;
  v_ev RECORD;
  v_corp RECORD;
  v_has_override boolean;
  v_eval jsonb;
  v_eval_eligible boolean;
  v_eval_qty numeric;
  v_eval_ineligible_lots integer;
  v_updated_assets jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dividend_tracking:' || v_user_id::text));

  IF p_tracking_start IS NOT NULL AND (p_tracking_start < DATE '2000-01-01' OR p_tracking_start > v_max_date) THEN
    RAISE EXCEPTION 'Data global de acompanhamento (%) deve estar entre 2000-01-01 e %.',
      p_tracking_start, v_max_date
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_assets_json) <> 'array' THEN
    RAISE EXCEPTION 'Lista de ativos para calibração deve ser um array JSON.' USING ERRCODE = '22023';
  END IF;

  -- Cria tabela temporária transacional com os itens validados (ordenada para lock determinístico)
  CREATE TEMP TABLE IF NOT EXISTS pg_temp._s1_tracking_reqs (
    asset_id uuid PRIMARY KEY,
    expected_start date,
    start_date date
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._s1_tracking_reqs;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_assets_json)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Item inválido na lista de calibração.' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_asset_id := NULLIF(trim(coalesce(v_item->>'asset_id', '')), '')::uuid;
    EXCEPTION WHEN others THEN
      v_asset_id := NULL;
    END;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'asset_id inválido ou ausente no lote de calibração.' USING ERRCODE = '22023';
    END IF;

    IF v_asset_id = ANY(v_seen_ids) THEN
      RAISE EXCEPTION 'Ativo duplicado no lote de calibração: %.', v_asset_id USING ERRCODE = '22023';
    END IF;
    v_seen_ids := array_append(v_seen_ids, v_asset_id);

    v_expected_raw := NULLIF(trim(coalesce(v_item->>'expected_start', '')), '');
    IF v_expected_raw IS NOT NULL THEN
      v_expected_start := public.parse_valid_dividend_date(v_expected_raw);
      IF v_expected_start IS NULL THEN
        RAISE EXCEPTION 'expected_start inválido para o ativo %.', v_asset_id USING ERRCODE = '22023';
      END IF;
    ELSE
      v_expected_start := NULL;
    END IF;

    v_start_raw := NULLIF(trim(coalesce(v_item->>'start_date', '')), '');
    IF v_start_raw IS NOT NULL THEN
      v_start_date := public.parse_valid_dividend_date(v_start_raw);
      IF v_start_date IS NULL THEN
        RAISE EXCEPTION 'Data de corte inválida para o ativo % (permitido entre 2000-01-01 e %).',
          v_asset_id, v_max_date
          USING ERRCODE = '22023';
      END IF;
    ELSE
      v_start_date := NULL;
    END IF;

    INSERT INTO pg_temp._s1_tracking_reqs (asset_id, expected_start, start_date)
    VALUES (v_asset_id, v_expected_start, v_start_date);
  END LOOP;

  -- Lock em user_preferences (cria registro padrão no primeiro uso)
  SELECT * INTO v_pref
  FROM public.user_preferences
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_preferences (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_pref
    FROM public.user_preferences
    WHERE user_id = v_user_id
    FOR UPDATE;
  END IF;

  v_current_tracking := public.parse_valid_dividend_date(
    v_pref.custom_settings->'dividendAutomation'->>'trackingStartDate'
  );

  -- Locks nos ativos solicitados em ordem estrita de asset_id para evitar deadlocks
  FOR v_req IN
    SELECT asset_id, expected_start, start_date
    FROM pg_temp._s1_tracking_reqs
    ORDER BY asset_id ASC
  LOOP
    SELECT id, user_id, ticker, currency, dividends_start_date
    INTO v_asset
    FROM public.portfolio_assets
    WHERE id = v_req.asset_id
      AND user_id = v_user_id
      AND upper(trim(ticker)) <> 'CAIXA'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ativo % não encontrado, pertence a outro titular ou não é elegível a corte.',
        v_req.asset_id
        USING ERRCODE = '42501';
    END IF;

    IF v_asset.dividends_start_date IS DISTINCT FROM v_req.start_date THEN
      v_all_requested_already_aligned := false;
    END IF;

    IF v_asset.dividends_start_date IS DISTINCT FROM v_req.expected_start THEN
      -- Repetição idempotente com o mesmo estado final é sucesso
      IF v_asset.dividends_start_date IS DISTINCT FROM v_req.start_date THEN
        RAISE EXCEPTION 'O corte de proventos do ativo % foi modificado em outra sessão. Recarregue e tente novamente.',
          v_asset.ticker
          USING ERRCODE = '40001';
      END IF;
    END IF;

    v_group_key := upper(trim(coalesce(v_asset.currency, 'BRL'))) || ':' ||
                   public.normalize_dividend_ticker_key(v_asset.ticker, v_asset.currency);
    IF NOT (v_group_key = ANY(v_requested_groups)) THEN
      v_requested_groups := array_append(v_requested_groups, v_group_key);
    END IF;
  END LOOP;

  -- Concorrência otimista em trackingStartDate (comparando NULL inclusive + idempotência)
  IF p_tracking_start IS NOT NULL THEN
    IF v_current_tracking IS DISTINCT FROM p_expected_tracking_start
       AND v_current_tracking IS DISTINCT FROM p_tracking_start THEN
      RAISE EXCEPTION 'O piso global de proventos foi alterado em outra sessão. Recarregue e tente novamente.'
        USING ERRCODE = '40001';
    END IF;
  ELSIF p_expected_tracking_start IS NOT NULL THEN
    IF v_current_tracking IS DISTINCT FROM p_expected_tracking_start
       AND NOT v_all_requested_already_aligned THEN
      RAISE EXCEPTION 'O piso global de proventos foi alterado em outra sessão. Recarregue e tente novamente.'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  -- Atualiza preferência global somente se mudou
  v_next_tracking := coalesce(p_tracking_start, v_current_tracking);
  IF v_next_tracking IS DISTINCT FROM v_current_tracking THEN
    PERFORM set_config('app.dividend_tracking_rpc', 'on', true);

    UPDATE public.user_preferences
    SET
      custom_settings = jsonb_set(
        coalesce(custom_settings, '{}'::jsonb),
        '{dividendAutomation}',
        CASE
          WHEN jsonb_typeof(custom_settings->'dividendAutomation') = 'object'
          THEN custom_settings->'dividendAutomation'
          ELSE '{}'::jsonb
        END || jsonb_build_object(
          'trackingStartDate',
          CASE WHEN v_next_tracking IS NOT NULL THEN to_char(v_next_tracking, 'YYYY-MM-DD') ELSE NULL END
        ),
        true
      ),
      updated_at = now()
    WHERE user_id = v_user_id;

    v_global_changed := true;
  END IF;

  -- Aplica atualizações de dividends_start_date nos ativos em ordem determinística
  FOR v_req IN
    SELECT asset_id, expected_start, start_date
    FROM pg_temp._s1_tracking_reqs
    ORDER BY asset_id ASC
  LOOP
    SELECT id, ticker, currency, dividends_start_date
    INTO v_asset
    FROM public.portfolio_assets
    WHERE id = v_req.asset_id
      AND user_id = v_user_id;

    IF v_asset.dividends_start_date IS DISTINCT FROM v_req.start_date THEN
      UPDATE public.portfolio_assets
      SET
        dividends_start_date = v_req.start_date,
        updated_at = now()
      WHERE id = v_req.asset_id
        AND user_id = v_user_id;

      v_updated_assets_count := v_updated_assets_count + 1;
      v_group_key := upper(trim(coalesce(v_asset.currency, 'BRL'))) || ':' ||
                     public.normalize_dividend_ticker_key(v_asset.ticker, v_asset.currency);
      IF NOT (v_group_key = ANY(v_affected_groups)) THEN
        v_affected_groups := array_append(v_affected_groups, v_group_key);
      END IF;
    END IF;

    v_updated_assets := v_updated_assets || jsonb_build_array(
      jsonb_build_object(
        'asset_id', v_req.asset_id,
        'dividends_start_date', CASE WHEN v_req.start_date IS NOT NULL THEN to_char(v_req.start_date, 'YYYY-MM-DD') ELSE NULL END
      )
    );
  END LOOP;

  -- Reavalia e saneia todos os eventos abertos automáticos afetados (inclusive fora de 120d)
  IF v_global_changed OR array_length(v_affected_groups, 1) > 0 OR array_length(v_requested_groups, 1) > 0 THEN
    FOR v_ev IN
      SELECT u.*
      FROM public.user_dividend_events u
      WHERE u.user_id = v_user_id
        AND u.status IN ('PROVISIONED', 'PENDING_CONFIRMATION')
        AND NOT u.is_manual
        AND NOT u.manual_review_required
        AND u.settled_dividend_id IS NULL
        AND (
          v_global_changed
          OR (upper(trim(coalesce(u.currency, 'BRL'))) || ':' || public.normalize_dividend_ticker_key(u.ticker, u.currency)) = ANY(
            CASE
              WHEN array_length(v_affected_groups, 1) > 0 THEN v_affected_groups
              ELSE v_requested_groups
            END
          )
        )
      ORDER BY u.id ASC
      FOR UPDATE
    LOOP
      -- 1) Verifica se a linha legada possui override/divergência identificável (tolerância 0,02)
      v_has_override := false;
      IF v_ev.corporate_dividend_id IS NULL THEN
        v_has_override := true;
      ELSE
        SELECT id, type, payment_date, rate, net_rate, tax_rate_pct
        INTO v_corp
        FROM public.corporate_dividends
        WHERE id = v_ev.corporate_dividend_id;

        IF NOT FOUND THEN
          v_has_override := true;
        ELSE
          IF v_ev.type IS DISTINCT FROM v_corp.type
             OR (v_ev.payment_date IS NOT NULL AND v_ev.payment_date IS DISTINCT FROM v_corp.payment_date)
             OR abs(coalesce(v_ev.tax_rate_pct, 0) - coalesce(v_corp.tax_rate_pct, 0)) > 0.001
             OR abs(coalesce(v_ev.net_rate, 0) - coalesce(v_corp.net_rate, 0)) > 0.0001
             OR abs(coalesce(v_ev.gross_rate, 0) - coalesce(v_corp.rate, 0)) > 0.0001
             OR abs(coalesce(v_ev.net_amount, 0) - round(coalesce(v_ev.quantity_on_com_date, 0) * coalesce(v_ev.net_rate, 0), 2)) > 0.02
             OR abs(coalesce(v_ev.gross_amount, 0) - round(coalesce(v_ev.quantity_on_com_date, 0) * coalesce(v_ev.gross_rate, 0), 2)) > 0.02 THEN
            v_has_override := true;
          END IF;
        END IF;
      END IF;

      IF v_has_override THEN
        UPDATE public.user_dividend_events
        SET
          manual_review_required = true,
          updated_at = now()
        WHERE id = v_ev.id;

        v_protected_events_count := v_protected_events_count + 1;
        CONTINUE;
      END IF;

      -- 2) Avalia corte e elegibilidade do grupo canônico inteiro (nunca só do ativo principal)
      v_eval := public.evaluate_user_dividend_group_cutoff(
        v_user_id,
        public.normalize_dividend_ticker_key(v_ev.ticker, v_ev.currency),
        v_ev.currency,
        v_ev.com_date,
        v_next_tracking
      );
      v_eval_eligible := coalesce((v_eval->>'eligible')::boolean, false);
      v_eval_qty := coalesce((v_eval->>'eligible_qty')::numeric, 0);
      v_eval_ineligible_lots := coalesce((v_eval->>'ineligible_lot_count')::integer, 0);

      -- Se COM anterior/sem lote elegível OU divergência entre a custódia registrada e a elegível atual:
      -- zera quantidade e totais derivados para excluir valor obsoleto já no commit (§3.1).
      IF (NOT v_eval_eligible) OR abs(coalesce(v_ev.quantity_on_com_date, 0) - v_eval_qty) > 0.000001 THEN
        IF coalesce(v_ev.quantity_on_com_date, 0) <> 0
           OR coalesce(v_ev.gross_amount, 0) <> 0
           OR coalesce(v_ev.net_amount, 0) <> 0 THEN
          UPDATE public.user_dividend_events
          SET
            quantity_on_com_date = 0,
            gross_amount = 0,
            net_amount = 0,
            updated_at = now()
          WHERE id = v_ev.id;

          v_invalidated_event_ids := array_append(v_invalidated_event_ids, v_ev.id);
          v_affected_events_count := v_affected_events_count + 1;
        ELSE
          v_invalidated_event_ids := array_append(v_invalidated_event_ids, v_ev.id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tracking_start_date', CASE WHEN v_next_tracking IS NOT NULL THEN to_char(v_next_tracking, 'YYYY-MM-DD') ELSE NULL END,
    'updated_assets', v_updated_assets,
    'updated_assets_count', v_updated_assets_count,
    'affected_events_count', v_affected_events_count,
    'protected_events_count', v_protected_events_count,
    'invalidated_event_ids', v_invalidated_event_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_dividend_tracking_atomic(date, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_dividend_tracking_atomic(date, jsonb, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Hardening de `settle_user_dividend_event_system` (`service_role`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_user_dividend_event_system(
  p_event_id uuid,
  p_sync_cash boolean DEFAULT true,
  p_fx_rate numeric DEFAULT NULL,
  p_override_net_amount numeric DEFAULT NULL,
  p_override_payment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_event_user_id uuid;
  v_event public.user_dividend_events%ROWTYPE;
  v_amount numeric(14, 2);
  v_date date;
  v_fx numeric(12, 6);
  v_cash_credit_brl numeric(14, 2);
  v_notes text;
  v_new_div_id uuid;
  v_cash_asset_id uuid;
  v_tracking_start date;
  v_eval jsonb;
  v_eval_eligible boolean;
  v_eval_qty numeric;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: liquidação sistêmica de proventos é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_event_user_id
  FROM public.user_dividend_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de provento não encontrado: %.', p_event_id USING ERRCODE = 'P0002';
  END IF;

  -- Lock por titular sempre ANTES do row lock em user_dividend_events (previne AB/BA deadlock)
  PERFORM pg_advisory_xact_lock(hashtext('dividend_tracking:' || v_event_user_id::text));

  SELECT * INTO v_event
  FROM public.user_dividend_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de provento não encontrado: %.', p_event_id USING ERRCODE = 'P0002';
  END IF;

  IF v_event.status = 'SETTLED' OR v_event.settled_dividend_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'event_id', v_event.id,
      'dividend_id', v_event.settled_dividend_id,
      'cash_credit_brl', 0
    );
  END IF;

  IF v_event.status = 'DISMISSED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped_dismissed', true,
      'event_id', v_event.id,
      'cash_credit_brl', 0
    );
  END IF;

  IF v_event.manual_review_required THEN
    RAISE EXCEPTION 'Evento marcado para revisão manual (%): liquidação automática bloqueada.', v_event.id USING ERRCODE = 'P0001';
  END IF;

  -- Relê corte e elegibilidade sob lock antes de liquidar automaticamente
  IF NOT v_event.is_manual THEN
    SELECT public.parse_valid_dividend_date(custom_settings->'dividendAutomation'->>'trackingStartDate')
    INTO v_tracking_start
    FROM public.user_preferences
    WHERE user_id = v_event.user_id;

    v_eval := public.evaluate_user_dividend_group_cutoff(
      v_event.user_id,
      public.normalize_dividend_ticker_key(v_event.ticker, v_event.currency),
      v_event.currency,
      v_event.com_date,
      v_tracking_start
    );
    v_eval_eligible := coalesce((v_eval->>'eligible')::boolean, false);
    v_eval_qty := coalesce((v_eval->>'eligible_qty')::numeric, 0);

    IF NOT v_eval_eligible OR coalesce(v_event.quantity_on_com_date, 0) <= 0 OR v_eval_qty <= 0 THEN
      RAISE EXCEPTION 'Evento inelegível pelo corte de acompanhamento vigente (%).', v_event.id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_override_net_amount IS NOT NULL AND p_override_net_amount = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Valor líquido de provento inválido (NaN).' USING ERRCODE = '22023';
  END IF;

  v_amount := round(coalesce(p_override_net_amount, v_event.net_amount), 2);
  IF v_amount IS NULL OR v_amount = 'NaN'::numeric OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor líquido de provento inválido para liquidação: %.', v_amount USING ERRCODE = '22023';
  END IF;

  -- Nunca faz fallback para "hoje": exige data real de pagamento persistida ou explícita
  v_date := coalesce(p_override_payment_date, v_event.payment_date);
  IF v_date IS NULL OR v_date < DATE '2000-01-01' OR (v_event.com_date IS NOT NULL AND v_date < v_event.com_date) OR v_date > v_today_br THEN
    RAISE EXCEPTION 'Data real de pagamento (%) inválida para liquidação (COM %, hoje %).',
      v_date, v_event.com_date, v_today_br
      USING ERRCODE = '22023';
  END IF;

  IF v_event.currency = 'USD' THEN
    IF p_fx_rate IS NOT NULL AND p_fx_rate <> 'NaN'::numeric AND p_fx_rate > 0 THEN
      v_fx := p_fx_rate;
    ELSIF v_event.fx_rate_applied IS NOT NULL AND v_event.fx_rate_applied > 0 THEN
      v_fx := v_event.fx_rate_applied;
    ELSE
      SELECT price INTO v_fx
      FROM public.asset_prices
      WHERE user_id IS NULL
        AND ticker = 'USDBRL=X'
        AND price > 0
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
      v_fx := coalesce(v_fx, 5.25);
    END IF;
    v_cash_credit_brl := round(v_amount * v_fx, 2);
  ELSE
    v_fx := NULL;
    v_cash_credit_brl := v_amount;
  END IF;

  v_notes := coalesce(
    nullif(trim(p_notes), ''),
    nullif(trim(v_event.notes), ''),
    'Provento automático (' || v_event.type || ')'
  );

  INSERT INTO public.portfolio_dividends (
    user_id,
    asset_id,
    ticker,
    date,
    amount,
    notes,
    sync_cash,
    cash_amount,
    source_event_id
  ) VALUES (
    v_event.user_id,
    v_event.asset_id,
    v_event.ticker,
    v_date,
    v_amount,
    v_notes,
    coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0,
    CASE WHEN coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN v_cash_credit_brl ELSE NULL END,
    v_event.id
  )
  ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_new_div_id;

  IF v_new_div_id IS NULL THEN
    SELECT id INTO v_new_div_id
    FROM public.portfolio_dividends
    WHERE user_id = v_event.user_id
      AND source_event_id = v_event.id
    LIMIT 1;

    UPDATE public.user_dividend_events
    SET
      status = 'SETTLED',
      settled_dividend_id = v_new_div_id,
      settlement_origin = coalesce(settlement_origin, 'auto'),
      manual_review_required = false,
      updated_at = now()
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'event_id', v_event.id,
      'dividend_id', v_new_div_id,
      'cash_credit_brl', 0
    );
  END IF;

  IF coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_event.user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1
    FOR UPDATE;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_event.user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_cash_credit_brl,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_cash_credit_brl,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  UPDATE public.user_dividend_events
  SET
    status = 'SETTLED',
    settled_dividend_id = v_new_div_id,
    settlement_origin = 'auto',
    manual_review_required = false,
    net_amount = v_amount,
    payment_date = v_date,
    fx_rate_applied = coalesce(v_fx, fx_rate_applied),
    notes = v_notes,
    updated_at = now()
  WHERE id = v_event.id;

  IF v_event.corporate_dividend_id IS NOT NULL THEN
    INSERT INTO public.portfolio_dividend_dismissals (
      user_id,
      corporate_dividend_id,
      reason,
      dismissed_at
    ) VALUES (
      v_event.user_id,
      v_event.corporate_dividend_id,
      'already_received',
      now()
    )
    ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'event_id', v_event.id,
    'dividend_id', v_new_div_id,
    'cash_asset_id', v_cash_asset_id,
    'cash_credit_brl', CASE WHEN coalesce(p_sync_cash, false) THEN v_cash_credit_brl ELSE 0 END,
    'fx_rate_applied', v_fx
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_user_dividend_event_system(uuid, boolean, numeric, numeric, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_user_dividend_event_system(uuid, boolean, numeric, numeric, date, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Hardening de `confirm_user_dividend_events_atomic` (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_user_dividend_events_atomic(
  p_items jsonb,
  p_sync_cash boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_tracking_start date;
  v_item jsonb;
  v_event_id uuid;
  v_corp_div_id uuid;
  v_asset_id uuid;
  v_expected_revision bigint;
  v_found_asset_id uuid;
  v_found_ticker text;
  v_found_currency text;
  v_event public.user_dividend_events%ROWTYPE;
  v_ticker text;
  v_type text;
  v_has_valid_type boolean;
  v_com_date date;
  v_date_input date;
  v_date date;
  v_raw_amount numeric;
  v_amount numeric(14, 2);
  v_raw_tax numeric;
  v_tax_rate_pct numeric(5, 2);
  v_gross_amount numeric(14, 2);
  v_currency text;
  v_raw_fx numeric;
  v_fx numeric(12, 6);
  v_cash_credit_brl numeric(14, 2);
  v_notes text;
  v_new_div_id uuid;
  v_cash_asset_id uuid;
  v_total_cash_brl numeric(14, 2) := 0;
  v_inserted_count integer := 0;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_already_settled_dividend_ids uuid[] := ARRAY[]::uuid[];
  v_settled_event_ids uuid[] := ARRAY[]::uuid[];
  v_default_fx numeric(12, 6) := NULL;
  v_owns_asset boolean := false;
  v_eval jsonb;
  v_eval_eligible boolean;
  v_corp_com_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nenhum provento informado para confirmação.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dividend_tracking:' || v_user_id::text));

  SELECT public.parse_valid_dividend_date(custom_settings->'dividendAutomation'->>'trackingStartDate')
  INTO v_tracking_start
  FROM public.user_preferences
  WHERE user_id = v_user_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_event := NULL;
    v_com_date := NULL;
    v_event_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'event_id', '')), '') IS NOT NULL
      THEN (v_item->>'event_id')::uuid
      ELSE NULL
    END;
    v_corp_div_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'corporate_dividend_id', '')), '') IS NOT NULL
      THEN (v_item->>'corporate_dividend_id')::uuid
      ELSE NULL
    END;
    v_asset_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'asset_id', '')), '') IS NOT NULL
      THEN (v_item->>'asset_id')::uuid
      ELSE NULL
    END;
    v_expected_revision := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'expected_revision', '')), '') IS NOT NULL
      THEN (v_item->>'expected_revision')::bigint
      ELSE NULL
    END;

    v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
    v_has_valid_type := NULLIF(trim(coalesce(v_item->>'type', '')), '') IS NOT NULL;
    v_type := upper(trim(coalesce(v_item->>'type', 'DIVIDENDO')));
    IF v_type NOT IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN
      v_type := 'OUTROS';
    END IF;

    v_date_input := coalesce(
      NULLIF(trim(coalesce(v_item->>'date', '')), '')::date,
      NULLIF(trim(coalesce(v_item->>'payment_date', '')), '')::date
    );

    v_raw_amount := NULLIF(trim(coalesce(v_item->>'amount', '')), '')::numeric;
    IF v_raw_amount = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Valor de provento inválido (NaN).' USING ERRCODE = '22023';
    END IF;
    v_amount := CASE WHEN v_raw_amount IS NOT NULL THEN round(v_raw_amount, 2) ELSE NULL END;

    v_raw_tax := NULLIF(trim(coalesce(v_item->>'tax_rate_pct', '')), '')::numeric;
    IF v_raw_tax = 'NaN'::numeric THEN
      v_raw_tax := NULL;
    END IF;
    v_tax_rate_pct := CASE
      WHEN v_raw_tax IS NOT NULL
      THEN greatest(0, least(100, v_raw_tax))::numeric(5, 2)
      ELSE NULL
    END;
    v_notes := NULLIF(trim(coalesce(v_item->>'notes', '')), '');

    IF v_event_id IS NOT NULL THEN
      SELECT * INTO v_event
      FROM public.user_dividend_events
      WHERE id = v_event_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Evento de provento não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;

      SELECT exists (
        SELECT 1
        FROM public.portfolio_assets pa
        WHERE pa.id = v_event.asset_id
          AND pa.user_id = v_user_id
      ) INTO v_owns_asset;

      IF NOT v_owns_asset THEN
        RAISE EXCEPTION 'Ativo do evento não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;

      IF v_event.status = 'SETTLED' AND v_event.settled_dividend_id IS NOT NULL THEN
        v_already_settled_dividend_ids := array_append(v_already_settled_dividend_ids, v_event.settled_dividend_id);
        CONTINUE;
      END IF;

      IF v_expected_revision IS NOT NULL AND v_event.revision <> v_expected_revision THEN
        RAISE EXCEPTION 'Evento de provento (%) modificado concorrentemente; recarregue e tente novamente.',
          v_event.ticker
          USING ERRCODE = '40001';
      END IF;

      v_asset_id := v_event.asset_id;
      v_corp_div_id := v_event.corporate_dividend_id;
      v_ticker := v_event.ticker;
      v_com_date := v_event.com_date;
      v_type := CASE WHEN v_has_valid_type THEN v_type ELSE v_event.type END;
      -- Proibido coalesce com todayBR: exige payment_date explícito ou persistido no evento
      v_date := coalesce(v_date_input, v_event.payment_date);
      v_amount := coalesce(v_amount, v_event.net_amount);
      v_tax_rate_pct := coalesce(v_tax_rate_pct, v_event.tax_rate_pct);
      v_currency := v_event.currency;

      IF NOT v_event.is_manual AND NOT v_event.manual_review_required THEN
        v_eval := public.evaluate_user_dividend_group_cutoff(
          v_user_id,
          public.normalize_dividend_ticker_key(v_event.ticker, v_event.currency),
          v_event.currency,
          v_event.com_date,
          v_tracking_start
        );
        v_eval_eligible := coalesce((v_eval->>'eligible')::boolean, false);
        IF NOT v_eval_eligible OR coalesce(v_event.quantity_on_com_date, 0) <= 0 THEN
          RAISE EXCEPTION 'O provento de % (COM %) está fora do período de acompanhamento ou aguardando recálculo.',
            v_event.ticker, v_event.com_date
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

      IF v_date IS NULL OR v_date < DATE '2000-01-01' OR (v_com_date IS NOT NULL AND v_date < v_com_date) OR v_date > v_today_br THEN
        RAISE EXCEPTION 'Informe uma data real de pagamento para % entre a Data COM (%) e hoje (%).',
          v_ticker, coalesce(v_com_date::text, 'N/A'), v_today_br
          USING ERRCODE = '22023';
      END IF;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Valor de provento inválido para %: %.', v_ticker, v_amount USING ERRCODE = '22023';
      END IF;
    ELSE
      IF v_date_input IS NULL THEN
        RAISE EXCEPTION 'Informe a data real de pagamento do provento de %.', nullif(v_ticker, '') USING ERRCODE = '22023';
      END IF;
      v_date := v_date_input;

      v_found_asset_id := NULL;
      v_found_ticker := NULL;
      v_found_currency := NULL;

      IF v_asset_id IS NOT NULL THEN
        SELECT id, ticker, currency
        INTO v_found_asset_id, v_found_ticker, v_found_currency
        FROM public.portfolio_assets
        WHERE id = v_asset_id
          AND user_id = v_user_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
        END IF;
      ELSIF v_ticker <> '' THEN
        SELECT id, ticker, currency
        INTO v_found_asset_id, v_found_ticker, v_found_currency
        FROM public.portfolio_assets
        WHERE user_id = v_user_id
          AND (
            upper(trim(ticker)) = v_ticker
            OR public.normalize_dividend_ticker_key(ticker, currency) = public.normalize_dividend_ticker_key(v_ticker, currency)
          )
        ORDER BY quantity DESC NULLS LAST, id ASC
        LIMIT 1;
      END IF;

      IF v_found_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
      END IF;

      v_asset_id := v_found_asset_id;
      v_ticker := upper(trim(v_found_ticker));
      v_currency := upper(trim(coalesce(NULLIF(trim(coalesce(v_item->>'currency', '')), ''), v_found_currency, 'BRL')));
      IF v_currency NOT IN ('BRL', 'USD') THEN
        v_currency := 'BRL';
      END IF;

      v_com_date := NULLIF(trim(coalesce(v_item->>'com_date', '')), '')::date;

      IF v_corp_div_id IS NOT NULL THEN
        SELECT com_date INTO v_corp_com_date
        FROM public.corporate_dividends
        WHERE id = v_corp_div_id;
        v_com_date := coalesce(v_com_date, v_corp_com_date);

        SELECT * INTO v_event
        FROM public.user_dividend_events
        WHERE user_id = v_user_id
          AND corporate_dividend_id = v_corp_div_id
        FOR UPDATE;

        IF FOUND THEN
          IF v_event.status = 'SETTLED' AND v_event.settled_dividend_id IS NOT NULL THEN
            v_already_settled_dividend_ids := array_append(v_already_settled_dividend_ids, v_event.settled_dividend_id);
            CONTINUE;
          END IF;

          IF v_expected_revision IS NOT NULL AND v_event.revision <> v_expected_revision THEN
            RAISE EXCEPTION 'Evento de provento (%) modificado concorrentemente; recarregue e tente novamente.',
              v_event.ticker
              USING ERRCODE = '40001';
          END IF;

          IF NOT v_event.is_manual AND NOT v_event.manual_review_required THEN
            v_eval := public.evaluate_user_dividend_group_cutoff(
              v_user_id,
              public.normalize_dividend_ticker_key(v_event.ticker, v_event.currency),
              v_event.currency,
              v_event.com_date,
              v_tracking_start
            );
            v_eval_eligible := coalesce((v_eval->>'eligible')::boolean, false);
            IF NOT v_eval_eligible OR coalesce(v_event.quantity_on_com_date, 0) <= 0 THEN
              RAISE EXCEPTION 'O provento de % (COM %) está fora do período de acompanhamento ou aguardando recálculo.',
                v_event.ticker, v_event.com_date
                USING ERRCODE = 'P0001';
            END IF;
          END IF;

          v_event_id := v_event.id;
          v_com_date := coalesce(v_com_date, v_event.com_date);
          v_amount := coalesce(v_amount, v_event.net_amount);
          v_tax_rate_pct := coalesce(v_tax_rate_pct, v_event.tax_rate_pct);
          v_date := coalesce(v_date_input, v_event.payment_date);
          v_type := CASE WHEN v_has_valid_type THEN v_type ELSE v_event.type END;
        ELSIF v_com_date IS NOT NULL THEN
          v_eval := public.evaluate_user_dividend_group_cutoff(
            v_user_id,
            public.normalize_dividend_ticker_key(v_ticker, v_currency),
            v_currency,
            v_com_date,
            v_tracking_start
          );
          IF NOT coalesce((v_eval->>'eligible')::boolean, false) THEN
            RAISE EXCEPTION 'O provento de % (COM %) está anterior ao corte de acompanhamento.',
              v_ticker, v_com_date
              USING ERRCODE = 'P0001';
          END IF;
        END IF;
      END IF;

      IF v_date IS NULL OR v_date < DATE '2000-01-01' OR (v_com_date IS NOT NULL AND v_date < v_com_date) OR v_date > v_today_br THEN
        RAISE EXCEPTION 'Informe uma data real de pagamento para % entre a Data COM (%) e hoje (%).',
          v_ticker, coalesce(v_com_date::text, 'N/A'), v_today_br
          USING ERRCODE = '22023';
      END IF;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
      END IF;

      IF v_event_id IS NULL THEN
        v_com_date := coalesce(v_com_date, v_date);
        v_gross_amount := CASE
          WHEN coalesce(v_tax_rate_pct, 0) > 0 AND coalesce(v_tax_rate_pct, 0) < 100
          THEN round(v_amount / (1.0 - v_tax_rate_pct / 100.0), 2)
          ELSE v_amount
        END;

        INSERT INTO public.user_dividend_events (
          user_id,
          corporate_dividend_id,
          asset_id,
          ticker,
          type,
          status,
          com_date,
          payment_date,
          quantity_on_com_date,
          gross_rate,
          net_rate,
          tax_rate_pct,
          gross_amount,
          net_amount,
          currency,
          is_manual,
          is_type_uncertain,
          notes
        ) VALUES (
          v_user_id,
          v_corp_div_id,
          v_asset_id,
          v_ticker,
          v_type,
          'PENDING_CONFIRMATION',
          v_com_date,
          v_date,
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'quantity_on_com_date', '')), '')::numeric, 0)),
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'gross_rate', '')), '')::numeric, 0)),
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'net_rate', '')), '')::numeric, 0)),
          coalesce(v_tax_rate_pct, 0),
          v_gross_amount,
          v_amount,
          v_currency,
          v_corp_div_id IS NULL,
          false,
          v_notes
        )
        ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
        SET
          type = EXCLUDED.type,
          payment_date = EXCLUDED.payment_date,
          tax_rate_pct = EXCLUDED.tax_rate_pct,
          gross_amount = EXCLUDED.gross_amount,
          net_amount = EXCLUDED.net_amount,
          notes = coalesce(EXCLUDED.notes, public.user_dividend_events.notes),
          updated_at = now()
        RETURNING id INTO v_event_id;
      END IF;
    END IF;

    IF v_currency = 'USD' THEN
      v_raw_fx := NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '')::numeric;
      IF v_raw_fx IS NOT NULL AND v_raw_fx <> 'NaN'::numeric AND v_raw_fx > 0 THEN
        v_fx := v_raw_fx;
      ELSE
        IF v_default_fx IS NULL THEN
          SELECT price INTO v_default_fx
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_default_fx := coalesce(v_default_fx, 5.25);
        END IF;
        v_fx := v_default_fx;
      END IF;
      v_cash_credit_brl := round(v_amount * v_fx, 2);
    ELSE
      v_fx := NULL;
      v_cash_credit_brl := v_amount;
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
      source_event_id
    ) VALUES (
      v_user_id,
      v_asset_id,
      v_ticker,
      v_date,
      v_amount,
      coalesce(v_notes, nullif(trim(v_event.notes), ''), 'Provento confirmado (' || v_type || ')'),
      coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0,
      CASE WHEN coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN v_cash_credit_brl ELSE NULL END,
      v_event_id
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_new_div_id;

    IF v_new_div_id IS NULL THEN
      SELECT id INTO v_new_div_id
      FROM public.portfolio_dividends
      WHERE user_id = v_user_id
        AND source_event_id = v_event_id
      LIMIT 1;

      UPDATE public.user_dividend_events
      SET
        status = 'SETTLED',
        settled_dividend_id = v_new_div_id,
        settlement_origin = coalesce(settlement_origin, 'manual'),
        manual_review_required = false,
        updated_at = now()
      WHERE id = v_event_id
        AND user_id = v_user_id;

      v_already_settled_dividend_ids := array_append(v_already_settled_dividend_ids, v_new_div_id);
      CONTINUE;
    END IF;

    v_gross_amount := CASE
      WHEN coalesce(v_tax_rate_pct, 0) > 0 AND coalesce(v_tax_rate_pct, 0) < 100
      THEN round(v_amount / (1.0 - v_tax_rate_pct / 100.0), 2)
      ELSE v_amount
    END;

    UPDATE public.user_dividend_events
    SET
      type = v_type,
      status = 'SETTLED',
      settlement_origin = 'manual',
      manual_review_required = false,
      payment_date = v_date,
      gross_amount = CASE WHEN is_manual OR v_tax_rate_pct IS NOT NULL THEN v_gross_amount ELSE gross_amount END,
      net_amount = v_amount,
      tax_rate_pct = coalesce(v_tax_rate_pct, tax_rate_pct),
      fx_rate_applied = coalesce(v_fx, fx_rate_applied),
      settled_dividend_id = v_new_div_id,
      is_type_uncertain = false,
      notes = coalesce(v_notes, notes),
      updated_at = now()
    WHERE id = v_event_id
      AND user_id = v_user_id;

    IF v_corp_div_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) VALUES (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
    END IF;

    v_inserted_ids := array_append(v_inserted_ids, v_new_div_id);
    v_settled_event_ids := array_append(v_settled_event_ids, v_event_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash_brl := v_total_cash_brl + v_cash_credit_brl;
  END LOOP;

  IF coalesce(p_sync_cash, false) AND v_total_cash_brl > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1
    FOR UPDATE;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash_brl,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_total_cash_brl,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash_brl,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids,
    'already_settled_dividend_ids', v_already_settled_dividend_ids,
    'settled_event_ids', v_settled_event_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_user_dividend_events_atomic(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_user_dividend_events_atomic(jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Hardening de `approve_dividends_batch_atomic` (porta compatível legada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_dividends_batch_atomic(
  p_dividends jsonb,
  p_sync_cash boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_tracking_start date;
  v_item jsonb;
  v_asset_id uuid;
  v_ticker text;
  v_found_ticker text;
  v_asset_currency text;
  v_date date;
  v_com_date date;
  v_raw_amount numeric;
  v_amount numeric(12, 2);
  v_cash_credit_brl numeric(12, 2);
  v_raw_fx numeric;
  v_fx numeric(12, 6);
  v_default_fx numeric(12, 6) := NULL;
  v_notes text;
  v_corp_div_id uuid;
  v_event_id uuid;
  v_expected_revision bigint;
  v_existing_event public.user_dividend_events%ROWTYPE;
  v_has_existing boolean := false;
  v_source_event_id uuid;
  v_total_cash numeric(12, 2) := 0;
  v_inserted_count integer := 0;
  v_cash_asset_id uuid;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_already_settled_dividend_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_eval jsonb;
  v_corp_com_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_dividends IS NULL OR jsonb_typeof(p_dividends) <> 'array' OR jsonb_array_length(p_dividends) = 0 THEN
    RAISE EXCEPTION 'Nenhum provento informado para aprovação.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dividend_tracking:' || v_user_id::text));

  SELECT public.parse_valid_dividend_date(custom_settings->'dividendAutomation'->>'trackingStartDate')
  INTO v_tracking_start
  FROM public.user_preferences
  WHERE user_id = v_user_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dividends)
  LOOP
    v_existing_event := NULL;
    v_com_date := NULL;
    v_ticker := trim(upper(coalesce(v_item->>'ticker', '')));
    v_date := coalesce(
      NULLIF(trim(coalesce(v_item->>'date', '')), '')::date,
      NULLIF(trim(coalesce(v_item->>'payment_date', '')), '')::date
    );
    v_com_date := NULLIF(trim(coalesce(v_item->>'com_date', '')), '')::date;
    v_raw_amount := NULLIF(trim(coalesce(v_item->>'amount', '')), '')::numeric;
    IF v_raw_amount = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Valor de provento inválido (NaN).' USING ERRCODE = '22023';
    END IF;
    v_amount := CASE WHEN v_raw_amount IS NOT NULL THEN round(v_raw_amount, 2) ELSE NULL END;
    v_notes := NULLIF(trim(coalesce(v_item->>'notes', '')), '');

    v_event_id := CASE
      WHEN v_item->>'event_id' IS NOT NULL AND trim(v_item->>'event_id') <> ''
      THEN (v_item->>'event_id')::uuid
      ELSE NULL
    END;
    v_corp_div_id := CASE
      WHEN v_item->>'corporate_dividend_id' IS NOT NULL AND trim(v_item->>'corporate_dividend_id') <> ''
      THEN (v_item->>'corporate_dividend_id')::uuid
      ELSE NULL
    END;
    v_expected_revision := CASE
      WHEN v_item->>'expected_revision' IS NOT NULL AND trim(v_item->>'expected_revision') <> ''
      THEN (v_item->>'expected_revision')::bigint
      ELSE NULL
    END;

    IF v_item->>'asset_id' IS NOT NULL AND trim(v_item->>'asset_id') <> '' THEN
      SELECT id, ticker, currency INTO v_asset_id, v_found_ticker, v_asset_currency
      FROM public.portfolio_assets
      WHERE id = (v_item->>'asset_id')::uuid
        AND user_id = v_user_id;

      IF v_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;
      IF v_ticker = '' THEN
        v_ticker := upper(trim(v_found_ticker));
      END IF;
    ELSE
      v_asset_id := NULL;
      v_asset_currency := NULL;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_asset_id IS NULL AND v_ticker <> '' THEN
      SELECT id, ticker, currency INTO v_asset_id, v_found_ticker, v_asset_currency
      FROM public.portfolio_assets
      WHERE user_id = v_user_id
        AND (
          upper(trim(ticker)) = v_ticker
          OR public.normalize_dividend_ticker_key(ticker, currency) = public.normalize_dividend_ticker_key(v_ticker, currency)
        )
      ORDER BY quantity DESC NULLS LAST, id ASC
      LIMIT 1;
      IF v_asset_id IS NOT NULL THEN
        v_ticker := upper(trim(v_found_ticker));
      END IF;
    END IF;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
    END IF;

    v_source_event_id := NULL;
    v_has_existing := false;

    IF v_event_id IS NOT NULL THEN
      SELECT * INTO v_existing_event
      FROM public.user_dividend_events
      WHERE id = v_event_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Evento de provento não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;
      v_has_existing := true;
    ELSIF v_corp_div_id IS NOT NULL THEN
      SELECT * INTO v_existing_event
      FROM public.user_dividend_events
      WHERE user_id = v_user_id
        AND corporate_dividend_id = v_corp_div_id
      FOR UPDATE;
      IF FOUND THEN
        v_has_existing := true;
      END IF;
    END IF;

    IF v_has_existing THEN
      IF v_existing_event.status = 'SETTLED' AND v_existing_event.settled_dividend_id IS NOT NULL THEN
        v_already_settled_dividend_ids := array_append(v_already_settled_dividend_ids, v_existing_event.settled_dividend_id);
        CONTINUE;
      END IF;
      IF v_expected_revision IS NOT NULL AND v_existing_event.revision <> v_expected_revision THEN
        RAISE EXCEPTION 'Evento de provento (%) modificado concorrentemente; recarregue e tente novamente.',
          v_existing_event.ticker
          USING ERRCODE = '40001';
      END IF;
      v_com_date := coalesce(v_com_date, v_existing_event.com_date);
      v_date := coalesce(v_date, v_existing_event.payment_date);
      v_source_event_id := v_existing_event.id;
      v_corp_div_id := coalesce(v_corp_div_id, v_existing_event.corporate_dividend_id);

      IF NOT v_existing_event.is_manual AND NOT v_existing_event.manual_review_required THEN
        v_eval := public.evaluate_user_dividend_group_cutoff(
          v_user_id,
          public.normalize_dividend_ticker_key(v_existing_event.ticker, v_existing_event.currency),
          v_existing_event.currency,
          v_existing_event.com_date,
          v_tracking_start
        );
        IF NOT coalesce((v_eval->>'eligible')::boolean, false) OR coalesce(v_existing_event.quantity_on_com_date, 0) <= 0 THEN
          RAISE EXCEPTION 'O provento de % (COM %) está fora do período de acompanhamento ou aguardando recálculo.',
            v_existing_event.ticker, v_existing_event.com_date
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    ELSIF v_corp_div_id IS NOT NULL THEN
      SELECT com_date INTO v_corp_com_date
      FROM public.corporate_dividends
      WHERE id = v_corp_div_id;
      v_com_date := coalesce(v_com_date, v_corp_com_date);

      IF v_com_date IS NOT NULL THEN
        v_eval := public.evaluate_user_dividend_group_cutoff(
          v_user_id,
          public.normalize_dividend_ticker_key(v_ticker, coalesce(v_asset_currency, 'BRL')),
          coalesce(v_asset_currency, 'BRL'),
          v_com_date,
          v_tracking_start
        );
        IF NOT coalesce((v_eval->>'eligible')::boolean, false) THEN
          RAISE EXCEPTION 'O provento de % (COM %) está anterior ao corte de acompanhamento.',
            v_ticker, v_com_date
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    END IF;

    IF v_date IS NULL OR v_date < DATE '2000-01-01' OR (v_com_date IS NOT NULL AND v_date < v_com_date) OR v_date > v_today_br THEN
      RAISE EXCEPTION 'Informe uma data real de pagamento para % entre a Data COM (%) e hoje (%).',
        v_ticker, coalesce(v_com_date::text, 'N/A'), v_today_br
        USING ERRCODE = '22023';
    END IF;

    IF upper(coalesce(NULLIF(trim(coalesce(v_item->>'currency', '')), ''), v_asset_currency, 'BRL')) = 'USD' THEN
      v_raw_fx := NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '')::numeric;
      IF v_raw_fx IS NOT NULL AND v_raw_fx <> 'NaN'::numeric AND v_raw_fx > 0 THEN
        v_fx := v_raw_fx;
      ELSE
        IF v_default_fx IS NULL THEN
          SELECT price INTO v_default_fx
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_default_fx := coalesce(v_default_fx, 5.25);
        END IF;
        v_fx := v_default_fx;
      END IF;
      v_cash_credit_brl := round(v_amount * v_fx, 2);
    ELSE
      v_fx := NULL;
      v_cash_credit_brl := round(v_amount, 2);
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
      source_event_id
    ) VALUES (
      v_user_id,
      v_asset_id,
      nullif(v_ticker, ''),
      v_date,
      v_amount,
      v_notes,
      coalesce(p_sync_cash, false),
      CASE WHEN coalesce(p_sync_cash, false) THEN v_cash_credit_brl ELSE NULL END,
      v_source_event_id
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NULL AND v_source_event_id IS NOT NULL THEN
      SELECT id INTO v_new_id
      FROM public.portfolio_dividends
      WHERE user_id = v_user_id
        AND source_event_id = v_source_event_id
      LIMIT 1;
      IF v_new_id IS NOT NULL THEN
        v_already_settled_dividend_ids := array_append(v_already_settled_dividend_ids, v_new_id);
      END IF;
      CONTINUE;
    END IF;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash := v_total_cash + v_cash_credit_brl;

    IF v_corp_div_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) VALUES (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

      UPDATE public.user_dividend_events
      SET
        status = 'SETTLED',
        settlement_origin = 'manual',
        manual_review_required = false,
        payment_date = v_date,
        net_amount = v_amount,
        settled_dividend_id = v_new_id,
        fx_rate_applied = coalesce(v_fx, fx_rate_applied),
        updated_at = now()
      WHERE user_id = v_user_id
        AND (
          id = v_source_event_id
          OR (v_source_event_id IS NULL AND corporate_dividend_id = v_corp_div_id)
        )
        AND status <> 'SETTLED';
    ELSIF v_source_event_id IS NOT NULL THEN
      UPDATE public.user_dividend_events
      SET
        status = 'SETTLED',
        settlement_origin = 'manual',
        manual_review_required = false,
        payment_date = v_date,
        net_amount = v_amount,
        settled_dividend_id = v_new_id,
        fx_rate_applied = coalesce(v_fx, fx_rate_applied),
        updated_at = now()
      WHERE user_id = v_user_id
        AND id = v_source_event_id
        AND status <> 'SETTLED';
    END IF;
  END LOOP;

  IF coalesce(p_sync_cash, false) AND v_total_cash > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1
    FOR UPDATE;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_total_cash,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids,
    'already_settled_dividend_ids', v_already_settled_dividend_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_dividends_batch_atomic(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_dividends_batch_atomic(jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Atualização de `restore_backup(p_backup jsonb)` sobre a `0154`
--    Preserva `card_bill_rollovers`/`scope`/`rollover_id`/`app.allow_pair_mutation`,
--    restaura `app.snapshot_rpc`/`app.dividend_tracking_rpc`, `portfolio_assets` completos
--    (+ `dividends_start_date`), índice parcial de `asset_prices` (`0142`) e saneia
--    `trackingStartDate` inválido em `user_preferences`.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
  v_max_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
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

  INSERT INTO public.portfolio_transactions (
    id, user_id, asset_id, type, date, quantity, price, total,
    total_cost_brl, fx_rate, notes, batch_id
  )
  SELECT
    pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total,
    pt.total_cost_brl, pt.fx_rate, pt.notes, pt.batch_id
  FROM jsonb_populate_recordset(NULL::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  JOIN public.portfolio_assets pa ON pa.id = pt.asset_id
  WHERE pa.user_id = v_uid;

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

  INSERT INTO public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, created_at)
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
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN public.portfolio_assets pa ON pa.id = pd.asset_id AND pa.user_id = v_uid;

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
    'class_targets', (SELECT count(*) FROM public.class_targets WHERE user_id = v_uid),
    'sector_targets', (SELECT count(*) FROM public.sector_targets WHERE user_id = v_uid)
  ) INTO v_counts;

  RETURN jsonb_build_object('success', true, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
