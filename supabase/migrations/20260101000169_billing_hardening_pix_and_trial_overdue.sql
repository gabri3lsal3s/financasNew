-- =============================================================================
-- Migration 0169: Hardening do Ciclo Asaas (PIX card_last4 + Trial Overdue)
-- =============================================================================
-- 1. Em activate_subscription_from_payment(): ao limpar asaas_subscription_id
--    (p_clear_asaas_subscription = true, ex: migração para PIX Anual) sem
--    informar p_card_last4, limpa card_last4 antigo para não exibir cartão.
-- 2. Em reconcile_expired_subscriptions(): no passo 3 (expired_past_due),
--    considera também trial_ends_at / past_due_since quando billing_start_at
--    e current_period_end forem nulos (falha na 1ª cobrança após trial).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
  p_user_id uuid,
  p_subscription_row_id uuid,
  p_provider_payment_id text,
  p_kind text,
  p_amount_cents integer,
  p_target_tier public.subscription_tier,
  p_current_period_end timestamptz,
  p_asaas_customer_id text DEFAULT NULL,
  p_asaas_subscription_id text DEFAULT NULL,
  p_clear_asaas_subscription boolean DEFAULT false,
  p_asaas_sync_status text DEFAULT 'synced',
  p_set_billing_start_at boolean DEFAULT false,
  p_billing_start_at timestamptz DEFAULT NULL,
  p_trial_consumed_at timestamptz DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_card_last4 text DEFAULT NULL,
  p_intent_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_lock_id uuid;
  v_effective_billing_start timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: exclusivo para service_role.' USING ERRCODE = '42501';
  END IF;

  IF p_provider_payment_id IS NOT NULL AND trim(p_provider_payment_id) <> '' THEN
    INSERT INTO public.billing_processed_payments (
      provider,
      provider_payment_id,
      user_id,
      kind,
      amount_cents,
      period_end_applied,
      metadata
    )
    VALUES (
      'asaas',
      trim(p_provider_payment_id),
      p_user_id,
      coalesce(nullif(trim(p_kind), ''), 'subscription_renewal'),
      coalesce(p_amount_cents, 0),
      p_current_period_end,
      coalesce(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (provider, provider_payment_id) DO NOTHING
    RETURNING id INTO v_lock_id;

    IF v_lock_id IS NULL THEN
      RETURN jsonb_build_object('applied', false, 'duplicate', true);
    END IF;
  END IF;

  v_effective_billing_start := coalesce(p_billing_start_at, v_now);

  UPDATE public.user_subscriptions
  SET
    tier = p_target_tier,
    plan_id = p_target_tier::text,
    status = 'active'::public.subscription_status,
    starts_at = coalesce(starts_at, v_now),
    billing_start_at = CASE
      WHEN p_set_billing_start_at THEN v_effective_billing_start
      ELSE coalesce(billing_start_at, v_effective_billing_start)
    END,
    trial_consumed_at = coalesce(trial_consumed_at, p_trial_consumed_at, v_now),
    current_period_end = p_current_period_end,
    cancel_at_period_end = false,
    scheduled_plan_id = NULL,
    scheduled_first_charge_at = NULL,
    pending_plan_id = NULL,
    pending_plan_effective_at = NULL,
    past_due_since = NULL,
    past_due_block_at = NULL,
    past_due_last_reminded_at = NULL,
    past_due_reminder_count = 0,
    asaas_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id, '')), ''), asaas_payment_id),
    asaas_customer_id = coalesce(nullif(trim(coalesce(p_asaas_customer_id, '')), ''), asaas_customer_id),
    asaas_subscription_id = CASE
      WHEN p_clear_asaas_subscription THEN NULL
      WHEN nullif(trim(coalesce(p_asaas_subscription_id, '')), '') IS NOT NULL THEN trim(p_asaas_subscription_id)
      ELSE asaas_subscription_id
    END,
    payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), payment_method),
    card_last4 = CASE
      WHEN p_clear_asaas_subscription AND nullif(trim(coalesce(p_card_last4, '')), '') IS NULL THEN NULL
      ELSE coalesce(nullif(trim(coalesce(p_card_last4, '')), ''), card_last4)
    END,
    asaas_sync_status = coalesce(nullif(trim(coalesce(p_asaas_sync_status, '')), ''), 'synced'),
    updated_at = v_now
  WHERE id = p_subscription_row_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para atualização atômica.' USING ERRCODE = 'P0002';
  END IF;

  IF p_intent_id IS NOT NULL THEN
    UPDATE public.billing_intents
    SET
      status = 'paid',
      provider_subscription_id = coalesce(nullif(trim(coalesce(p_asaas_subscription_id, '')), ''), provider_subscription_id),
      provider_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id, '')), ''), provider_payment_id),
      updated_at = v_now
    WHERE id = p_intent_id;
  END IF;

  RETURN jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'lock_id', v_lock_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription_from_payment(
  uuid, uuid, text, text, integer, public.subscription_tier, timestamptz,
  text, text, boolean, text, boolean, timestamptz, timestamptz, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(
  uuid, uuid, text, text, integer, public.subscription_tier, timestamptz,
  text, text, boolean, text, boolean, timestamptz, timestamptz, text, text, uuid, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
  v_step_count integer := 0;
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  IF NOT (
    public.is_admin()
    OR v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos para reconciliar assinaturas.'
      USING ERRCODE = '42501';
  END IF;

  -- 1) Expira assinaturas com cancelamento agendado cujo current_period_end já passou
  WITH expired_active AS (
    UPDATE public.user_subscriptions
    SET status = 'canceled'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        cancel_at_period_end = false,
        updated_at = now()
    WHERE status = 'active'::public.subscription_status
      AND cancel_at_period_end = true
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_active;
  v_updated_count := v_updated_count + v_step_count;

  -- 1b) Expira assinaturas Pro avulsas (ex.: Anual via PIX) sem renovação automática cujo período venceu
  WITH expired_one_off AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        cancel_at_period_end = false,
        updated_at = now()
    WHERE status = 'active'::public.subscription_status
      AND tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
      AND coalesce(cancel_at_period_end, false) = false
      AND (asaas_subscription_id IS NULL OR trim(asaas_subscription_id) = '')
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_one_off;
  v_updated_count := v_updated_count + v_step_count;

  -- 2) Expira trials vencidos que não possuem plano futuro agendado
  WITH expired_trials AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        trial_consumed_at = coalesce(trial_consumed_at, now()),
        updated_at = now()
    WHERE tier = 'trial'::public.subscription_tier
      AND status IN ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= now()
      AND scheduled_plan_id IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_trials;
  v_updated_count := v_updated_count + v_step_count;

  -- 2b) Expira trials agendados órfãos (> 3 dias após trial_ends_at sem confirmação de cobrança)
  WITH expired_scheduled_trials AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        scheduled_plan_id = null,
        scheduled_first_charge_at = null,
        trial_consumed_at = coalesce(trial_consumed_at, now()),
        updated_at = now()
    WHERE tier = 'trial'::public.subscription_tier
      AND status IN ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      AND scheduled_plan_id IS NOT NULL
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at + INTERVAL '3 days' <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_scheduled_trials;
  v_updated_count := v_updated_count + v_step_count;

  -- 3) Expira assinaturas past_due quando houver bloqueio agendado vencido,
  --    modo 'auto' expirado ou falha na 1ª cobrança pós-trial (> 3 dias)
  WITH expired_past_due AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        scheduled_plan_id = null,
        scheduled_first_charge_at = null,
        trial_consumed_at = coalesce(trial_consumed_at, now()),
        updated_at = now()
    WHERE status = 'past_due'::public.subscription_status
      AND (
        (past_due_block_at IS NOT NULL AND past_due_block_at <= now())
        OR (
          billing_start_at IS NOT NULL
          AND past_due_block_at IS NULL
          AND past_due_grace_mode = 'auto'
          AND COALESCE(past_due_since, current_period_end) IS NOT NULL
          AND COALESCE(past_due_since, current_period_end) + INTERVAL '7 days' <= now()
        )
        OR (
          billing_start_at IS NULL
          AND COALESCE(current_period_end, trial_ends_at, past_due_since) IS NOT NULL
          AND COALESCE(current_period_end, trial_ends_at, past_due_since) + INTERVAL '3 days' <= now()
        )
      )
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_past_due;
  v_updated_count := v_updated_count + v_step_count;

  -- 4) Marca billing_intents pendentes há mais de 24 horas como expiradas
  UPDATE public.billing_intents
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND created_at < (now() - INTERVAL '24 hours');

  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_expired_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() TO service_role;

NOTIFY pgrst, 'reload schema';
