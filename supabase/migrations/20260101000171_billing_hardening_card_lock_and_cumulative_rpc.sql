-- ============================================================================
-- Migration: 20260101000171_billing_hardening_card_lock_and_cumulative_rpc.sql
-- Descrição:
--   1. Índice único parcial em public.billing_intents para garantir lock atômico
--      de no máximo 1 checkout de cartão em status 'processing' por usuário.
--   2. RPC transacional atômica apply_cumulative_renewal_from_payment() que
--      serializa por user_subscriptions (FOR UPDATE), valida e trava a
--      billing_intent, calcula a extensão de meses civis em UTC dentro da
--      própria transação e grava ledger + vigência + intent atomicamente.
-- ============================================================================

-- 1. Deduplicar eventuais múltiplos locks 'processing' por usuário, preservando o mais recente para reconciliação
WITH ranked_processing_card AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.billing_intents
  WHERE method = 'credit_card' AND status = 'processing'
)
UPDATE public.billing_intents AS bi
SET
  status = 'failed',
  updated_at = NOW(),
  metadata = COALESCE(bi.metadata, '{}'::jsonb) || jsonb_build_object('superseded_processing_by_migration', '0171')
FROM ranked_processing_card AS r
WHERE bi.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_intents_one_processing_card_per_user
  ON public.billing_intents (user_id)
  WHERE method = 'credit_card' AND status = 'processing';

-- 2. RPC atômica e serializada para renovação acumulativa (Pix 2–11 meses)
CREATE OR REPLACE FUNCTION public.apply_cumulative_renewal_from_payment(
  p_user_id uuid,
  p_subscription_row_id uuid,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_months_count integer,
  p_asaas_sync_status text DEFAULT 'pending_resync',
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
  v_sub_period_end timestamptz;
  v_base_end timestamptz;
  v_new_period_end timestamptz;
  v_intent record;
  v_existing_ledger record;
  v_months integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: exclusivo para service_role.' USING ERRCODE = '42501';
  END IF;

  IF p_provider_payment_id IS NULL OR trim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'provider_payment_id obrigatório para renovação acumulativa.' USING ERRCODE = '22023';
  END IF;

  IF p_intent_id IS NULL THEN
    RAISE EXCEPTION 'intent_id obrigatório para renovação acumulativa.' USING ERRCODE = '22023';
  END IF;

  -- Serializa pela linha da assinatura antes de qualquer cálculo de vigência
  SELECT current_period_end
  INTO v_sub_period_end
  FROM public.user_subscriptions
  WHERE id = p_subscription_row_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para renovação acumulativa atômica.' USING ERRCODE = 'P0002';
  END IF;

  -- Trava e valida a intenção de cobrança
  SELECT id, user_id, kind, status, months_count, amount_cents, provider_payment_id
  INTO v_intent
  FROM public.billing_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção de cobrança não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_intent.user_id <> p_user_id OR v_intent.kind <> 'cumulative_renewal' THEN
    RAISE EXCEPTION 'Intenção incompatível com usuário ou tipo cumulative_renewal.' USING ERRCODE = '22023';
  END IF;

  v_months := coalesce(v_intent.months_count, p_months_count);
  IF v_months IS NULL OR v_months < 2 OR v_months > 11 THEN
    RAISE EXCEPTION 'Quantidade de meses inválida para renovação acumulativa (%).', v_months USING ERRCODE = '22023';
  END IF;

  IF v_intent.provider_payment_id IS NOT NULL AND trim(v_intent.provider_payment_id) <> trim(p_provider_payment_id) THEN
    RAISE EXCEPTION 'Intenção vinculada a outro pagamento (%).', v_intent.provider_payment_id USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_amount_cents, 0) < v_intent.amount_cents THEN
    RAISE EXCEPTION 'Valor pago (%) inferior ao valor da intenção (%).', p_amount_cents, v_intent.amount_cents USING ERRCODE = '22023';
  END IF;

  -- Verifica se este pagamento já foi liquidado no ledger
  SELECT id, user_id, kind, period_end_applied
  INTO v_existing_ledger
  FROM public.billing_processed_payments
  WHERE provider = 'asaas'
    AND provider_payment_id = trim(p_provider_payment_id);

  IF FOUND THEN
    IF v_existing_ledger.user_id = p_user_id
       AND v_existing_ledger.kind = 'cumulative_renewal'
       AND v_intent.status IN ('pending', 'processing') THEN
      UPDATE public.billing_intents
      SET
        status = 'paid',
        provider_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id, '')), ''), provider_payment_id),
        updated_at = v_now,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('applied_new_period_end', v_existing_ledger.period_end_applied)
      WHERE id = p_intent_id
        AND status IN ('pending', 'processing');
    END IF;

    RETURN jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'new_period_end', v_existing_ledger.period_end_applied
    );
  END IF;

  -- Nunca sobrescrever intenções canceladas/expiradas/já pagas
  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Intenção em status inválido para aplicação (%).', v_intent.status USING ERRCODE = '22023';
  END IF;

  -- Calcula a nova vigência sobre o estado lido sob lock FOR UPDATE (mesma regra UTC de addCivilMonthsServer)
  v_base_end := CASE
    WHEN v_sub_period_end IS NOT NULL AND v_sub_period_end > v_now THEN v_sub_period_end
    ELSE v_now
  END;
  v_new_period_end := ((v_base_end AT TIME ZONE 'UTC') + make_interval(months => v_months)) AT TIME ZONE 'UTC';

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
    'cumulative_renewal',
    coalesce(p_amount_cents, 0),
    v_new_period_end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_lock_id;

  UPDATE public.user_subscriptions
  SET
    current_period_end = v_new_period_end,
    asaas_sync_status = coalesce(nullif(trim(coalesce(p_asaas_sync_status, '')), ''), 'pending_resync'),
    past_due_since = NULL,
    past_due_block_at = NULL,
    past_due_last_reminded_at = NULL,
    past_due_reminder_count = 0,
    updated_at = v_now
  WHERE id = p_subscription_row_id
    AND user_id = p_user_id;

  UPDATE public.billing_intents
  SET
    status = 'paid',
    provider_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id, '')), ''), provider_payment_id),
    updated_at = v_now,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('applied_new_period_end', v_new_period_end)
  WHERE id = p_intent_id
    AND status IN ('pending', 'processing');

  RETURN jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'lock_id', v_lock_id,
    'new_period_end', v_new_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_cumulative_renewal_from_payment(
  uuid, uuid, text, integer, integer, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_cumulative_renewal_from_payment(
  uuid, uuid, text, integer, integer, text, uuid, jsonb
) TO service_role;
