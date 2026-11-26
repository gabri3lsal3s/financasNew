-- =============================================================================
-- Migration 0165: Onda 1 (T1.4) — Atomicidade de Billing & Idempotência Webhook
-- =============================================================================
-- 1. Adiciona processed_at em billing_webhook_logs para distinguir eventos
--    já processados de retries em voo / falhos.
-- 2. Cria RPC transacional atômica activate_subscription_from_payment() para
--    gravar billing_processed_payments + user_subscriptions + billing_intents
--    em uma única transação SQL (eliminando lock órfão W02).
-- =============================================================================

ALTER TABLE public.billing_webhook_logs
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

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
    card_last4 = coalesce(nullif(trim(coalesce(p_card_last4, '')), ''), card_last4),
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

NOTIFY pgrst, 'reload schema';
