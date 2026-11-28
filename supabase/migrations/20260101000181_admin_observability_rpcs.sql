-- ============================================================================
-- Migration 0181: Admin Observability Passive RPCs (Phase 4)
-- 4 RPCs SECURITY DEFINER 100% passivas (sem chamadas externas):
--   1. admin_get_connections_health()
--   2. admin_get_ai_usage_summary(p_period_month, p_limit, p_offset)
--   3. admin_get_user_support_diagnostics(p_user_id)
--   4. admin_get_retention_radar(p_limit)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_connections_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_month text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_asaas jsonb;
  v_resend jsonb;
  v_quotes jsonb;
  v_ai_gemini jsonb;
  v_push jsonb;
  v_telegram jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'last_event_at', MAX(created_at),
    'events_24h', COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::integer,
    'failures_24h', COUNT(*) FILTER (
      WHERE created_at >= now() - interval '24 hours'
        AND (
          processed_at IS NULL
          OR COALESCE(payload->>'status', '') ILIKE '%fail%'
          OR COALESCE(payload->>'status', '') ILIKE '%error%'
          OR NULLIF(payload->>'error_message', '') IS NOT NULL
        )
    )::integer
  )
  INTO v_asaas
  FROM public.billing_webhook_logs;

  SELECT jsonb_build_object(
    'last_event_at', MAX(created_at),
    'sent_7d', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status = 'sent')::integer,
    'failed_7d', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status <> 'sent')::integer
  )
  INTO v_resend
  FROM public.transactional_email_logs;

  SELECT jsonb_build_object(
    'last_fetched_at', MAX(COALESCE(fetched_at, updated_at)) FILTER (WHERE source IN ('api', 'fallback')),
    'api_count', COUNT(*) FILTER (WHERE source = 'api')::integer,
    'fallback_count', COUNT(*) FILTER (WHERE source = 'fallback')::integer
  )
  INTO v_quotes
  FROM public.asset_prices;

  SELECT jsonb_build_object(
    'active_quota_users', (SELECT COUNT(*)::integer FROM public.user_ai_quotas WHERE period_month = v_current_month),
    'cache_entries', (SELECT COUNT(*)::integer FROM public.receipt_extractions_cache),
    'current_month', v_current_month
  )
  INTO v_ai_gemini;

  SELECT jsonb_build_object(
    'active_subscriptions', COUNT(*)::integer
  )
  INTO v_push
  FROM public.user_push_subscriptions
  WHERE is_active = true;

  SELECT jsonb_build_object(
    'silent_mode', s.silent_mode,
    'notify_support', s.notify_support,
    'notify_new_users', s.notify_new_users,
    'updated_at', s.updated_at
  )
  INTO v_telegram
  FROM public.admin_telegram_settings s
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF v_telegram IS NULL THEN
    v_telegram := jsonb_build_object(
      'silent_mode', false,
      'notify_support', false,
      'notify_new_users', false,
      'updated_at', null
    );
  END IF;

  RETURN jsonb_build_object(
    'supabase_db', jsonb_build_object('status', 'ok', 'checked_at', now()),
    'asaas', v_asaas,
    'resend', v_resend,
    'quotes', v_quotes,
    'ai_gemini', v_ai_gemini,
    'push', v_push,
    'telegram', v_telegram
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_connections_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_connections_health() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_ai_usage_summary(
  p_period_month text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  tier public.subscription_tier,
  sub_status public.subscription_status,
  period_month text,
  period_day text,
  receipt_calls_month integer,
  receipt_calls_day integer,
  batch_calls_month integer,
  batch_calls_day integer,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_month text := COALESCE(
    NULLIF(trim(p_period_month), ''),
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
  );
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_offset integer := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    q.user_id,
    p.name,
    p.email,
    s.tier,
    s.status AS sub_status,
    q.period_month,
    q.period_day,
    q.receipt_calls_month,
    q.receipt_calls_day,
    q.batch_calls_month,
    q.batch_calls_day,
    q.updated_at,
    COUNT(*) OVER() AS total_count
  FROM public.user_ai_quotas q
  JOIN public.profiles p ON p.id = q.user_id
  LEFT JOIN public.user_subscriptions s ON s.user_id = q.user_id
  WHERE q.period_month = v_period_month
  ORDER BY (q.receipt_calls_month + q.batch_calls_month) DESC, q.updated_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_ai_usage_summary(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_usage_summary(text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_user_support_diagnostics(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_month text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_devices jsonb;
  v_push_count integer;
  v_last_push_at timestamptz;
  v_ai_quota jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO v_devices
  FROM (
    SELECT jsonb_build_object(
      'platform', NULLIF(d.os, ''),
      'app_version', NULL::text,
      'device_label', COALESCE(NULLIF(d.device_name, ''), NULLIF(d.browser, '')),
      'last_seen_at', d.last_seen_at
    ) AS item
    FROM public.user_devices d
    WHERE d.user_id = p_user_id
      AND d.is_revoked = false
    ORDER BY d.last_seen_at DESC
    LIMIT 5
  ) sub;

  SELECT
    COUNT(*)::integer,
    MAX(COALESCE(last_used_at, updated_at))
  INTO v_push_count, v_last_push_at
  FROM public.user_push_subscriptions
  WHERE user_id = p_user_id
    AND is_active = true;

  SELECT jsonb_build_object(
    'period_month', q.period_month,
    'period_day', q.period_day,
    'receipt_calls_month', q.receipt_calls_month,
    'receipt_calls_day', q.receipt_calls_day,
    'batch_calls_month', q.batch_calls_month,
    'batch_calls_day', q.batch_calls_day,
    'updated_at', q.updated_at
  )
  INTO v_ai_quota
  FROM public.user_ai_quotas q
  WHERE q.user_id = p_user_id
    AND q.period_month = v_current_month
  LIMIT 1;

  RETURN jsonb_build_object(
    'devices', v_devices,
    'push_count', COALESCE(v_push_count, 0),
    'last_push_at', v_last_push_at,
    'ai_quota', v_ai_quota
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_support_diagnostics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_support_diagnostics(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_retention_radar(
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  tier public.subscription_tier,
  sub_status public.subscription_status,
  risk_kind text,
  last_seen_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH radar AS (
    SELECT
      s.user_id,
      p.name,
      p.email,
      s.tier,
      s.status AS sub_status,
      CASE
        WHEN s.status = 'past_due'::public.subscription_status AND COALESCE(tk.has_open_ticket, false) THEN 'past_due_with_ticket'
        WHEN s.tier = 'trial'::public.subscription_tier
          AND s.status = 'trialing'::public.subscription_status
          AND s.created_at <= now() - interval '72 hours'
          AND (dev.last_seen_at IS NULL OR dev.last_seen_at <= s.created_at + interval '1 hour') THEN 'trial_stalled_72h'
        WHEN s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier, 'lifetime'::public.subscription_tier)
          AND s.status = 'active'::public.subscription_status
          AND s.created_at <= now() - interval '21 days'
          AND (dev.last_seen_at IS NULL OR dev.last_seen_at <= now() - interval '21 days') THEN 'paid_inactive_21d'
        ELSE NULL
      END AS risk_kind,
      dev.last_seen_at,
      s.created_at
    FROM public.user_subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT MAX(d.last_seen_at) AS last_seen_at
      FROM public.user_devices d
      WHERE d.user_id = s.user_id
        AND d.is_revoked = false
    ) dev ON true
    LEFT JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1
        FROM public.support_tickets t
        WHERE t.user_id = s.user_id
          AND t.status IN ('open', 'in_progress')
      ) AS has_open_ticket
    ) tk ON true
  )
  SELECT
    r.user_id,
    r.name,
    r.email,
    r.tier,
    r.sub_status,
    r.risk_kind,
    r.last_seen_at,
    r.created_at
  FROM radar r
  WHERE r.risk_kind IS NOT NULL
  ORDER BY
    CASE r.risk_kind
      WHEN 'past_due_with_ticket' THEN 1
      WHEN 'trial_stalled_72h' THEN 2
      ELSE 3
    END,
    COALESCE(r.last_seen_at, r.created_at) ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_retention_radar(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_retention_radar(integer) TO authenticated, service_role;
