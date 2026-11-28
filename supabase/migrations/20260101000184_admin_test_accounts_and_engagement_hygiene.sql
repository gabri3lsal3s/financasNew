-- ============================================================================
-- Migration: 20260101000184_admin_test_accounts_and_engagement_hygiene.sql
-- Descrição: Higiene de contas de teste/internas/quarentena nos indicadores
--            de engajamento, retenção, uso de IA e listagem de usuários.
--            1. Coluna profiles.is_test (e guarda idempotente de deleted_at)
--            2. RPC admin_set_user_test_flag(p_user_id, p_is_test)
--            3. Atualização de admin_list_users (retorna is_test e deleted_at)
--            4. Atualização de admin_get_metrics (apenas contas reais + contadores auxiliares)
--            5. Nova RPC admin_get_feature_usage_ranking(p_days)
--            6. Atualização de admin_get_retention_radar e admin_get_ai_usage_summary
-- ============================================================================

-- 1. Colunas de higiene em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_real_accounts
  ON public.profiles (role, is_test, deleted_at);

COMMENT ON COLUMN public.profiles.is_test IS
  'Flag administrativa que marca contas de teste/QA para exclusão de métricas de negócio, engajamento e faturamento real.';

-- 2. RPC: admin_set_user_test_flag
CREATE OR REPLACE FUNCTION public.admin_set_user_test_flag(
  p_user_id uuid,
  p_is_test boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_is_test IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos para alteração da flag de conta de teste.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET is_test = p_is_test
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'profiles',
    p_user_id::text,
    'ADMIN_SET_USER_TEST_FLAG',
    jsonb_build_object('is_test', p_is_test)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_test_flag(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_test_flag(uuid, boolean) TO authenticated, service_role;

-- 3. Atualização de admin_list_users mantendo assinatura de entrada
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role public.user_role,
  status public.user_status,
  created_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  suspended_reason text,
  is_test boolean,
  deleted_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p.name,
      p.email,
      p.role,
      p.status,
      p.created_at,
      p.approved_at,
      p.approved_by,
      p.suspended_reason,
      p.is_test,
      p.deleted_at,
      COUNT(*) OVER() AS total_count
    FROM public.profiles p
    WHERE
      (p_search IS NULL OR p_search = '' OR (
        p.name ILIKE '%' || p_search || '%' OR
        p.email ILIKE '%' || p_search || '%'
      ))
      AND (p_status IS NULL OR p_status = '' OR p.status::text = p_status)
      AND (p_role IS NULL OR p_role = '' OR p.role::text = p_role)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT * FROM filtered;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO authenticated, service_role;

-- 4. Atualização de admin_get_metrics para contar apenas contas reais
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_users bigint;
  v_active_users bigint;
  v_pending_users bigint;
  v_suspended_users bigint;
  v_test_or_internal_users bigint;
  v_quarantined_users bigint;
  v_total_invites bigint;
  v_used_invites bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE role = 'user'::public.user_role AND is_test = false AND deleted_at IS NULL),
    COUNT(*) FILTER (WHERE role = 'user'::public.user_role AND is_test = false AND deleted_at IS NULL AND status = 'active'::public.user_status),
    COUNT(*) FILTER (WHERE role = 'user'::public.user_role AND is_test = false AND deleted_at IS NULL AND status = 'pending_approval'::public.user_status),
    COUNT(*) FILTER (WHERE role = 'user'::public.user_role AND is_test = false AND deleted_at IS NULL AND status IN ('suspended'::public.user_status, 'banned'::public.user_status)),
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND (role <> 'user'::public.user_role OR is_test = true)),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
  INTO
    v_total_users,
    v_active_users,
    v_pending_users,
    v_suspended_users,
    v_test_or_internal_users,
    v_quarantined_users
  FROM public.profiles;

  SELECT COUNT(*) INTO v_total_invites FROM public.access_invites WHERE is_revoked = false;
  SELECT COALESCE(SUM(used_count), 0) INTO v_used_invites FROM public.access_invites;

  RETURN jsonb_build_object(
    'total_users', COALESCE(v_total_users, 0),
    'active_users', COALESCE(v_active_users, 0),
    'pending_users', COALESCE(v_pending_users, 0),
    'suspended_users', COALESCE(v_suspended_users, 0),
    'test_or_internal_users', COALESCE(v_test_or_internal_users, 0),
    'quarantined_users', COALESCE(v_quarantined_users, 0),
    'total_invites', COALESCE(v_total_invites, 0),
    'used_invites', COALESCE(v_used_invites, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated, service_role;

-- 5. Nova RPC: admin_get_feature_usage_ranking
CREATE OR REPLACE FUNCTION public.admin_get_feature_usage_ranking(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  module text,
  count bigint,
  percentage integer,
  last_used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH aggregated AS (
    SELECT
      e.module,
      COUNT(*)::bigint AS usage_count,
      MAX(e.created_at) AS last_used_at
    FROM public.app_analytics_events e
    JOIN public.profiles p ON p.id = e.user_id
    WHERE e.created_at >= now() - make_interval(days => v_days)
      AND p.role = 'user'::public.user_role
      AND p.is_test = false
      AND p.deleted_at IS NULL
    GROUP BY e.module
  )
  SELECT
    a.module,
    a.usage_count AS count,
    COALESCE(
      ROUND((a.usage_count::numeric * 100.0) / NULLIF(SUM(a.usage_count) OVER(), 0))::integer,
      0
    ) AS percentage,
    a.last_used_at
  FROM aggregated a
  ORDER BY a.usage_count DESC, a.last_used_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_feature_usage_ranking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_feature_usage_ranking(integer) TO authenticated, service_role;

-- 6. Atualização de admin_get_retention_radar para excluir admins/testes/quarentena
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
    WHERE p.role = 'user'::public.user_role
      AND p.is_test = false
      AND p.deleted_at IS NULL
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

-- 7. Atualização de admin_get_ai_usage_summary para excluir admins/testes/quarentena
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
    AND p.role = 'user'::public.user_role
    AND p.is_test = false
    AND p.deleted_at IS NULL
  ORDER BY (q.receipt_calls_month + q.batch_calls_month) DESC, q.updated_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_ai_usage_summary(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_usage_summary(text, integer, integer) TO authenticated, service_role;
