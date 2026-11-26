-- =============================================================================
-- Migration 0162: Corte Definitivo, Backfill de Dispensas e Proteção DML (S6)
-- =============================================================================
-- Fatia S6 de `docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md` (§2, §4.3, §6):
--   1. Trigger de imutabilidade para metadados de origem/conciliação em `portfolio_dividends`
--   2. Backfill paginado e idempotente de `portfolio_dividend_dismissals` -> `user_dividend_events`
--   3. Comparador de paridade por titular antes de eventual remoção física futura
--   4. Preservação integral de `quotes-cron.sql` e compatibilidade de leitores legados
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_guard_dividend_immutable_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND coalesce(current_setting('app.dividend_reconciliation_rpc', true), '') <> 'on'
     AND coalesce(current_setting('app.snapshot_rpc', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.entry_origin IN ('engine', 'restore') THEN
        NEW.entry_origin := 'manual';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.entry_origin := OLD.entry_origin;
      NEW.request_id := OLD.request_id;
      NEW.source_event_id := OLD.source_event_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_dividend_immutable_metadata ON public.portfolio_dividends;
CREATE TRIGGER trg_guard_dividend_immutable_metadata
  BEFORE INSERT OR UPDATE ON public.portfolio_dividends
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_dividend_immutable_metadata();

-- Backfill paginado de dispensas legadas para `user_dividend_events` (preserva SETTLED)
CREATE OR REPLACE FUNCTION public.backfill_legacy_dividend_dismissals_system(
  p_batch_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_batch_limit, 500), 5000));
  v_migrated integer := 0;
  v_kept_suppression integer := 0;
  v_rec record;
  v_asset_id uuid;
  v_base_ticker text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  FOR v_rec IN
    SELECT
      d.id AS dismissal_id,
      d.user_id,
      d.corporate_dividend_id,
      d.reason,
      cd.ticker,
      cd.currency,
      cd.com_date,
      cd.payment_date,
      cd.type,
      cd.rate,
      cd.net_rate,
      cd.tax_rate_pct
    FROM public.portfolio_dividend_dismissals d
    JOIN public.corporate_dividends cd ON cd.id = d.corporate_dividend_id
    WHERE d.corporate_dividend_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_dividend_events ude
        WHERE ude.user_id = d.user_id
          AND ude.corporate_dividend_id = d.corporate_dividend_id
      )
    ORDER BY d.id
    LIMIT v_limit
  LOOP
    v_base_ticker := regexp_replace(upper(trim(v_rec.ticker)), '\.SA$', '');
    IF v_rec.currency = 'BRL' THEN
      v_base_ticker := regexp_replace(v_base_ticker, 'F$', '');
    END IF;

    SELECT pa.id INTO v_asset_id
    FROM public.portfolio_assets pa
    WHERE pa.user_id = v_rec.user_id
      AND pa.currency = v_rec.currency
      AND (
        CASE
          WHEN v_rec.currency = 'BRL' THEN regexp_replace(regexp_replace(upper(trim(pa.ticker)), '\.SA$', ''), 'F$', '')
          ELSE regexp_replace(upper(trim(pa.ticker)), '\.SA$', '')
        END
      ) = v_base_ticker
    ORDER BY
      CASE WHEN v_rec.currency = 'BRL' AND upper(trim(pa.ticker)) ~ 'F$' THEN 1 ELSE 0 END ASC,
      pa.id ASC
    LIMIT 1;

    IF v_asset_id IS NULL THEN
      v_kept_suppression := v_kept_suppression + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.user_dividend_events (
      user_id,
      asset_id,
      corporate_dividend_id,
      ticker,
      type,
      com_date,
      payment_date,
      quantity_on_com_date,
      gross_rate,
      net_rate,
      tax_rate_pct,
      gross_amount,
      net_amount,
      currency,
      status,
      dismissal_reason,
      is_manual,
      created_at,
      updated_at
    ) VALUES (
      v_rec.user_id,
      v_asset_id,
      v_rec.corporate_dividend_id,
      v_rec.ticker,
      v_rec.type,
      v_rec.com_date,
      v_rec.payment_date,
      0,
      v_rec.rate,
      v_rec.net_rate,
      coalesce(v_rec.tax_rate_pct, 0),
      0,
      0,
      v_rec.currency,
      'DISMISSED',
      v_rec.reason,
      false,
      now(),
      now()
    )
    ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
    SET status = 'DISMISSED',
        dismissal_reason = EXCLUDED.dismissal_reason,
        updated_at = now()
    WHERE public.user_dividend_events.status <> 'SETTLED';

    v_migrated := v_migrated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'migrated', v_migrated,
    'kept_suppression', v_kept_suppression
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_legacy_dividend_dismissals_system(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_legacy_dividend_dismissals_system(integer) TO service_role;

-- Comparador de paridade por titular entre tabela legada e eventos individualizados
CREATE OR REPLACE FUNCTION public.compare_dividend_dismissal_parity_system(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_legacy_count integer := 0;
  v_events_dismissed_count integer := 0;
  v_unmigrated_ids uuid[];
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço.';
  END IF;

  SELECT count(*)::integer INTO v_legacy_count
  FROM public.portfolio_dividend_dismissals
  WHERE user_id = p_user_id;

  SELECT count(*)::integer INTO v_events_dismissed_count
  FROM public.user_dividend_events
  WHERE user_id = p_user_id
    AND status = 'DISMISSED';

  SELECT array_agg(d.corporate_dividend_id) INTO v_unmigrated_ids
  FROM public.portfolio_dividend_dismissals d
  WHERE d.user_id = p_user_id
    AND d.corporate_dividend_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_dividend_events ude
      WHERE ude.user_id = p_user_id
        AND ude.corporate_dividend_id = d.corporate_dividend_id
    );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'legacy_count', v_legacy_count,
    'events_dismissed_count', v_events_dismissed_count,
    'unmigrated_corporate_ids', coalesce(v_unmigrated_ids, ARRAY[]::uuid[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compare_dividend_dismissal_parity_system(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compare_dividend_dismissal_parity_system(uuid) TO service_role;

SELECT public.backfill_legacy_dividend_dismissals_system(1000);

NOTIFY pgrst, 'reload schema';
