-- ============================================================================
-- Migration: 20260101000185_admin_real_billing_and_finops_hygiene.sql
-- Descrição: Separação estrita de faturamento real, ambiente (production/sandbox),
--            estornos/chargebacks e exclusão de contas internas/teste no FinOps.
--            1. Colunas environment, refunded_at, refund_reason em billing_processed_payments
--            2. Atualização de admin_get_billing_finops_overview
--            3. Nova RPC admin_get_billing_overview()
-- ============================================================================

-- 1. Colunas de ambiente e estorno em billing_processed_payments
ALTER TABLE public.billing_processed_payments
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production'
    CHECK (environment IN ('production', 'sandbox')),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

CREATE INDEX IF NOT EXISTS idx_billing_processed_payments_env_refund
  ON public.billing_processed_payments (environment, refunded_at, created_at);

COMMENT ON COLUMN public.billing_processed_payments.environment IS
  'Ambiente do gateway em que o pagamento foi processado (production | sandbox).';
COMMENT ON COLUMN public.billing_processed_payments.refunded_at IS
  'Data/hora em que o pagamento foi estornado ou sofreu chargeback.';
COMMENT ON COLUMN public.billing_processed_payments.refund_reason IS
  'Evento/motivo do estorno ou chargeback (ex.: PAYMENT_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED).';

-- 2. Atualização de admin_get_billing_finops_overview para faturamento real
CREATE OR REPLACE FUNCTION public.admin_get_billing_finops_overview(
  p_period_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_month text := COALESCE(
    NULLIF(trim(p_period_month), ''),
    to_char(now() AT TIME ZONE 'America/Bahia', 'YYYY-MM')
  );
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_payments jsonb;
  v_webhooks jsonb;
  v_ai_quotas jsonb;
  v_emails jsonb;
  v_params jsonb;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de superadmin requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF v_period_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'p_period_month inválido (esperado YYYY-MM).'
      USING ERRCODE = '22023';
  END IF;

  v_month_start := (to_date(v_period_month || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE 'America/Bahia');
  v_month_end := ((to_date(v_period_month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamp AT TIME ZONE 'America/Bahia');

  SELECT jsonb_build_object(
    'payments_count', COUNT(*)::integer,
    'gross_revenue_cents', COALESCE(SUM(bpp.amount_cents), 0)::bigint,
    'pix_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(bpp.metadata->>'billingType', bpp.metadata->>'payment_method', '')) = 'PIX')::integer,
    'pix_revenue_cents', COALESCE(SUM(bpp.amount_cents) FILTER (WHERE UPPER(COALESCE(bpp.metadata->>'billingType', bpp.metadata->>'payment_method', '')) = 'PIX'), 0)::bigint,
    'card_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(bpp.metadata->>'billingType', bpp.metadata->>'payment_method', '')) IN ('CREDIT_CARD', 'CARD'))::integer,
    'card_revenue_cents', COALESCE(SUM(bpp.amount_cents) FILTER (WHERE UPPER(COALESCE(bpp.metadata->>'billingType', bpp.metadata->>'payment_method', '')) IN ('CREDIT_CARD', 'CARD')), 0)::bigint,
    'other_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(bpp.metadata->>'billingType', bpp.metadata->>'payment_method', '')) NOT IN ('PIX', 'CREDIT_CARD', 'CARD'))::integer
  )
  INTO v_payments
  FROM public.billing_processed_payments bpp
  LEFT JOIN public.profiles p ON p.id = bpp.user_id
  WHERE bpp.created_at >= v_month_start
    AND bpp.created_at < v_month_end
    AND bpp.environment = 'production'
    AND bpp.refunded_at IS NULL
    AND (p.id IS NULL OR (p.role = 'user'::public.user_role AND p.is_test = false));

  SELECT jsonb_build_object(
    'events_count', COUNT(*)::integer,
    'failures_count', COUNT(*) FILTER (
      WHERE processed_at IS NULL
        OR COALESCE(payload->>'status', '') ILIKE '%fail%'
        OR COALESCE(payload->>'status', '') ILIKE '%error%'
        OR NULLIF(payload->>'error_message', '') IS NOT NULL
    )::integer
  )
  INTO v_webhooks
  FROM public.billing_webhook_logs
  WHERE created_at >= v_month_start
    AND created_at < v_month_end;

  SELECT jsonb_build_object(
    'active_users_count', COUNT(*)::integer,
    'total_receipt_calls', COALESCE(SUM(q.receipt_calls_month), 0)::bigint,
    'total_batch_calls', COALESCE(SUM(q.batch_calls_month), 0)::bigint
  )
  INTO v_ai_quotas
  FROM public.user_ai_quotas q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE q.period_month = v_period_month
    AND p.role = 'user'::public.user_role
    AND p.is_test = false;

  SELECT jsonb_build_object(
    'sent_count', COUNT(*) FILTER (WHERE status = 'sent')::integer,
    'failed_count', COUNT(*) FILTER (WHERE status <> 'sent')::integer
  )
  INTO v_emails
  FROM public.transactional_email_logs
  WHERE created_at >= v_month_start
    AND created_at < v_month_end;

  v_params := public.admin_get_finops_monthly_params(v_period_month);

  RETURN jsonb_build_object(
    'period_month', v_period_month,
    'timezone', 'America/Bahia',
    'window_start', v_month_start,
    'window_end', v_month_end,
    'params', v_params,
    'payments', v_payments,
    'webhooks', v_webhooks,
    'ai_quotas', v_ai_quotas,
    'emails', v_emails
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_billing_finops_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_finops_overview(text) TO authenticated, service_role;

-- 3. Nova RPC: admin_get_billing_overview
CREATE OR REPLACE FUNCTION public.admin_get_billing_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estimated_real_mrr_cents bigint;
  v_real_paid_subscribers_count integer;
  v_courtesy_lifetime_count integer;
  v_trials_count integer;
  v_expiring_trials_count integer;
  v_past_due_count integer;
  v_internal_or_test_count integer;
  v_subscriptions jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(
      CASE
        WHEN p.role = 'user'::public.user_role
          AND p.is_test = false
          AND p.deleted_at IS NULL
          AND s.status = 'active'::public.subscription_status
          AND s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND COALESCE(pl.price_cents, 0) > 0
        THEN CASE
          WHEN s.tier = 'pro_annual'::public.subscription_tier THEN ROUND(pl.price_cents / 12.0)
          ELSE pl.price_cents
        END
        ELSE 0
      END
    ), 0)::bigint,
    COUNT(*) FILTER (
      WHERE p.role = 'user'::public.user_role
        AND p.is_test = false
        AND p.deleted_at IS NULL
        AND s.status = 'active'::public.subscription_status
        AND s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
        AND COALESCE(pl.price_cents, 0) > 0
    )::integer,
    COUNT(*) FILTER (
      WHERE p.role = 'user'::public.user_role
        AND p.is_test = false
        AND p.deleted_at IS NULL
        AND (
          s.tier = 'lifetime'::public.subscription_tier
          OR (
            s.status = 'active'::public.subscription_status
            AND NOT (
              s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
              AND COALESCE(pl.price_cents, 0) > 0
            )
          )
        )
    )::integer,
    COUNT(*) FILTER (
      WHERE p.role = 'user'::public.user_role
        AND p.is_test = false
        AND p.deleted_at IS NULL
        AND s.status = 'trialing'::public.subscription_status
    )::integer,
    COUNT(*) FILTER (
      WHERE p.role = 'user'::public.user_role
        AND p.is_test = false
        AND p.deleted_at IS NULL
        AND s.status = 'trialing'::public.subscription_status
        AND s.trial_ends_at IS NOT NULL
        AND s.trial_ends_at >= now()
        AND s.trial_ends_at <= now() + interval '7 days'
    )::integer,
    COUNT(*) FILTER (
      WHERE p.role = 'user'::public.user_role
        AND p.is_test = false
        AND p.deleted_at IS NULL
        AND s.status = 'past_due'::public.subscription_status
    )::integer,
    COUNT(*) FILTER (
      WHERE p.role <> 'user'::public.user_role
        OR p.is_test = true
        OR p.deleted_at IS NOT NULL
    )::integer
  INTO
    v_estimated_real_mrr_cents,
    v_real_paid_subscribers_count,
    v_courtesy_lifetime_count,
    v_trials_count,
    v_expiring_trials_count,
    v_past_due_count,
    v_internal_or_test_count
  FROM public.user_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.plans pl ON pl.id = s.plan_id;

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_subscriptions
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'user_name', p.name,
      'user_email', p.email,
      'user_role', p.role,
      'is_test', p.is_test,
      'plan_id', s.plan_id,
      'tier', s.tier,
      'status', s.status,
      'trial_ends_at', s.trial_ends_at,
      'current_period_end', s.current_period_end,
      'asaas_subscription_id', s.asaas_subscription_id,
      'updated_at', s.updated_at,
      'created_at', s.created_at
    ) AS row_data
    FROM public.user_subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    ORDER BY s.updated_at DESC, s.created_at DESC
    LIMIT 200
  ) sub;

  RETURN jsonb_build_object(
    'estimated_real_mrr_cents', COALESCE(v_estimated_real_mrr_cents, 0),
    'real_paid_subscribers_count', COALESCE(v_real_paid_subscribers_count, 0),
    'courtesy_lifetime_count', COALESCE(v_courtesy_lifetime_count, 0),
    'trials_count', COALESCE(v_trials_count, 0),
    'expiring_trials_count', COALESCE(v_expiring_trials_count, 0),
    'past_due_count', COALESCE(v_past_due_count, 0),
    'internal_or_test_count', COALESCE(v_internal_or_test_count, 0),
    'subscriptions', v_subscriptions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_billing_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_overview() TO authenticated, service_role;
