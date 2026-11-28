-- ============================================================================
-- Migration 0182: Admin FinOps Snapshots, Monthly Params & AI Quota Reset
-- Fase 5:
--   1. Tabela public.admin_finops_monthly_params (RLS restrita a is_superadmin())
--   2. RPCs admin_get_finops_monthly_params e admin_upsert_finops_monthly_params
--   3. RPC admin_reset_user_ai_quota (zera balde diário/mensal + audit_events)
--   4. RPC admin_get_billing_finops_overview (agregado mês civil America/Bahia)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Parâmetros mensais de FinOps (public.admin_finops_monthly_params)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_finops_monthly_params (
  period_month text PRIMARY KEY CHECK (period_month ~ '^\d{4}-\d{2}$'),
  asaas_pix_fee_cents integer NOT NULL DEFAULT 0 CHECK (asaas_pix_fee_cents >= 0),
  asaas_card_percent_bps integer NOT NULL DEFAULT 0 CHECK (asaas_card_percent_bps >= 0 AND asaas_card_percent_bps <= 10000),
  ai_receipt_unit_cost_cents integer NOT NULL DEFAULT 0 CHECK (ai_receipt_unit_cost_cents >= 0),
  ai_batch_unit_cost_cents integer NOT NULL DEFAULT 0 CHECK (ai_batch_unit_cost_cents >= 0),
  fixed_infra_cents integer NOT NULL DEFAULT 0 CHECK (fixed_infra_cents >= 0),
  notes text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_finops_monthly_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_finops_monthly_params FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins manage finops monthly params" ON public.admin_finops_monthly_params;
CREATE POLICY "Superadmins manage finops monthly params"
  ON public.admin_finops_monthly_params
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

REVOKE ALL ON TABLE public.admin_finops_monthly_params FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_finops_monthly_params TO authenticated;
GRANT ALL ON TABLE public.admin_finops_monthly_params TO service_role;

-- ----------------------------------------------------------------------------
-- 2. RPC: admin_get_finops_monthly_params
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_finops_monthly_params(
  p_period_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_month text := COALESCE(
    NULLIF(trim(p_period_month), ''),
    to_char(now() AT TIME ZONE 'America/Bahia', 'YYYY-MM')
  );
  v_row public.admin_finops_monthly_params;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de superadmin requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF v_period_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'p_period_month inválido (esperado YYYY-MM).'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_row
  FROM public.admin_finops_monthly_params
  WHERE period_month = v_period_month;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'period_month', v_period_month,
      'asaas_pix_fee_cents', 0,
      'asaas_card_percent_bps', 0,
      'ai_receipt_unit_cost_cents', 0,
      'ai_batch_unit_cost_cents', 0,
      'fixed_infra_cents', 0,
      'notes', null,
      'updated_by', null,
      'updated_at', null,
      'configured', false
    );
  END IF;

  RETURN jsonb_build_object(
    'period_month', v_row.period_month,
    'asaas_pix_fee_cents', v_row.asaas_pix_fee_cents,
    'asaas_card_percent_bps', v_row.asaas_card_percent_bps,
    'ai_receipt_unit_cost_cents', v_row.ai_receipt_unit_cost_cents,
    'ai_batch_unit_cost_cents', v_row.ai_batch_unit_cost_cents,
    'fixed_infra_cents', v_row.fixed_infra_cents,
    'notes', v_row.notes,
    'updated_by', v_row.updated_by,
    'updated_at', v_row.updated_at,
    'configured', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_finops_monthly_params(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_finops_monthly_params(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. RPC: admin_upsert_finops_monthly_params
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_finops_monthly_params(
  p_period_month text,
  p_asaas_pix_fee_cents integer,
  p_asaas_card_percent_bps integer,
  p_ai_receipt_unit_cost_cents integer,
  p_ai_batch_unit_cost_cents integer,
  p_fixed_infra_cents integer,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_period_month text := trim(COALESCE(p_period_month, ''));
  v_row public.admin_finops_monthly_params;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de superadmin requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF v_period_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'p_period_month inválido (esperado YYYY-MM).'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_asaas_pix_fee_cents, -1) < 0
    OR COALESCE(p_asaas_card_percent_bps, -1) < 0
    OR p_asaas_card_percent_bps > 10000
    OR COALESCE(p_ai_receipt_unit_cost_cents, -1) < 0
    OR COALESCE(p_ai_batch_unit_cost_cents, -1) < 0
    OR COALESCE(p_fixed_infra_cents, -1) < 0 THEN
    RAISE EXCEPTION 'Parâmetros FinOps inválidos: valores devem ser não negativos e bps <= 10000.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_finops_monthly_params (
    period_month,
    asaas_pix_fee_cents,
    asaas_card_percent_bps,
    ai_receipt_unit_cost_cents,
    ai_batch_unit_cost_cents,
    fixed_infra_cents,
    notes,
    updated_by,
    updated_at
  )
  VALUES (
    v_period_month,
    p_asaas_pix_fee_cents,
    p_asaas_card_percent_bps,
    p_ai_receipt_unit_cost_cents,
    p_ai_batch_unit_cost_cents,
    p_fixed_infra_cents,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_admin_id,
    now()
  )
  ON CONFLICT (period_month) DO UPDATE SET
    asaas_pix_fee_cents = excluded.asaas_pix_fee_cents,
    asaas_card_percent_bps = excluded.asaas_card_percent_bps,
    ai_receipt_unit_cost_cents = excluded.ai_receipt_unit_cost_cents,
    ai_batch_unit_cost_cents = excluded.ai_batch_unit_cost_cents,
    fixed_infra_cents = excluded.fixed_infra_cents,
    notes = excluded.notes,
    updated_by = v_admin_id,
    updated_at = now()
  RETURNING * INTO v_row;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
    VALUES (
      v_admin_id,
      'admin_finops_monthly_params',
      v_period_month,
      'UPSERT_FINOPS_PARAMS',
      jsonb_build_object(
        'asaas_pix_fee_cents', v_row.asaas_pix_fee_cents,
        'asaas_card_percent_bps', v_row.asaas_card_percent_bps,
        'ai_receipt_unit_cost_cents', v_row.ai_receipt_unit_cost_cents,
        'ai_batch_unit_cost_cents', v_row.ai_batch_unit_cost_cents,
        'fixed_infra_cents', v_row.fixed_infra_cents
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'period_month', v_row.period_month,
    'asaas_pix_fee_cents', v_row.asaas_pix_fee_cents,
    'asaas_card_percent_bps', v_row.asaas_card_percent_bps,
    'ai_receipt_unit_cost_cents', v_row.ai_receipt_unit_cost_cents,
    'ai_batch_unit_cost_cents', v_row.ai_batch_unit_cost_cents,
    'fixed_infra_cents', v_row.fixed_infra_cents,
    'notes', v_row.notes,
    'updated_by', v_row.updated_by,
    'updated_at', v_row.updated_at,
    'configured', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_finops_monthly_params(text, integer, integer, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_finops_monthly_params(text, integer, integer, integer, integer, integer, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RPC: admin_reset_user_ai_quota
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_ai_quota(
  p_user_id uuid,
  p_bucket text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_period_month text := to_char(now() AT TIME ZONE 'America/Bahia', 'YYYY-MM');
  v_reason text := trim(COALESCE(p_reason, ''));
  v_before public.user_ai_quotas;
  v_after public.user_ai_quotas;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de superadmin requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  IF p_bucket NOT IN ('receipt_calls', 'batch_calls', 'all') THEN
    RAISE EXCEPTION 'Balde de cota inválido: %', COALESCE(p_bucket, '<null>')
      USING ERRCODE = '22023';
  END IF;

  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 3 caracteres) para reset de cota de IA.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_before
  FROM public.user_ai_quotas
  WHERE user_id = p_user_id
    AND period_month = v_period_month
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.user_ai_quotas
    SET
      receipt_calls_month = CASE WHEN p_bucket IN ('receipt_calls', 'all') THEN 0 ELSE receipt_calls_month END,
      receipt_calls_day = CASE WHEN p_bucket IN ('receipt_calls', 'all') THEN 0 ELSE receipt_calls_day END,
      batch_calls_month = CASE WHEN p_bucket IN ('batch_calls', 'all') THEN 0 ELSE batch_calls_month END,
      batch_calls_day = CASE WHEN p_bucket IN ('batch_calls', 'all') THEN 0 ELSE batch_calls_day END,
      updated_at = now()
    WHERE user_id = p_user_id
      AND period_month = v_period_month
    RETURNING * INTO v_after;
  END IF;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
    VALUES (
      v_admin_id,
      'user_ai_quotas',
      p_user_id::text || ':' || v_period_month,
      'RESET_USER_AI_QUOTA',
      jsonb_build_object(
        'target_user_id', p_user_id,
        'period_month', v_period_month,
        'bucket', p_bucket,
        'reason', v_reason,
        'had_row', FOUND,
        'previous_receipt_month', COALESCE(v_before.receipt_calls_month, 0),
        'previous_receipt_day', COALESCE(v_before.receipt_calls_day, 0),
        'previous_batch_month', COALESCE(v_before.batch_calls_month, 0),
        'previous_batch_day', COALESCE(v_before.batch_calls_day, 0)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'period_month', v_period_month,
    'bucket', p_bucket,
    'reset_applied', FOUND,
    'receipt_calls_month', COALESCE(v_after.receipt_calls_month, 0),
    'receipt_calls_day', COALESCE(v_after.receipt_calls_day, 0),
    'batch_calls_month', COALESCE(v_after.batch_calls_month, 0),
    'batch_calls_day', COALESCE(v_after.batch_calls_day, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_ai_quota(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_ai_quota(uuid, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RPC: admin_get_billing_finops_overview
-- ----------------------------------------------------------------------------
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
    'gross_revenue_cents', COALESCE(SUM(amount_cents), 0)::bigint,
    'pix_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(metadata->>'billingType', metadata->>'payment_method', '')) = 'PIX')::integer,
    'pix_revenue_cents', COALESCE(SUM(amount_cents) FILTER (WHERE UPPER(COALESCE(metadata->>'billingType', metadata->>'payment_method', '')) = 'PIX'), 0)::bigint,
    'card_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(metadata->>'billingType', metadata->>'payment_method', '')) IN ('CREDIT_CARD', 'CARD'))::integer,
    'card_revenue_cents', COALESCE(SUM(amount_cents) FILTER (WHERE UPPER(COALESCE(metadata->>'billingType', metadata->>'payment_method', '')) IN ('CREDIT_CARD', 'CARD')), 0)::bigint,
    'other_count', COUNT(*) FILTER (WHERE UPPER(COALESCE(metadata->>'billingType', metadata->>'payment_method', '')) NOT IN ('PIX', 'CREDIT_CARD', 'CARD'))::integer
  )
  INTO v_payments
  FROM public.billing_processed_payments
  WHERE created_at >= v_month_start
    AND created_at < v_month_end;

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
    'total_receipt_calls', COALESCE(SUM(receipt_calls_month), 0)::bigint,
    'total_batch_calls', COALESCE(SUM(batch_calls_month), 0)::bigint
  )
  INTO v_ai_quotas
  FROM public.user_ai_quotas
  WHERE period_month = v_period_month;

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
