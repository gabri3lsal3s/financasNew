-- ============================================================================
-- Migration: 20260101000114_billing_lifecycle_v2.sql
-- Descrição: Expande public.user_subscriptions com campos do ciclo de vida v2:
--            agendamentos de cobrança/troca de plano, método, cartão e
--            status de sincronização com o gateway Asaas (nextDueDate).
-- ============================================================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id TEXT REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_first_charge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan_id TEXT REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS pending_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('credit_card', 'pix')),
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS asaas_sync_status TEXT CHECK (asaas_sync_status IN ('synced', 'pending_resync')) DEFAULT 'synced';

-- Backfill idempotente dos dados legados
UPDATE public.user_subscriptions
SET trial_started_at = starts_at
WHERE trial_started_at IS NULL AND tier = 'trial';

UPDATE public.user_subscriptions
SET trial_consumed_at = trial_ends_at
WHERE trial_consumed_at IS NULL AND (
  tier IN ('pro_monthly', 'pro_annual', 'lifetime') OR
  (tier = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= NOW())
);

UPDATE public.user_subscriptions
SET billing_start_at = starts_at
WHERE billing_start_at IS NULL AND tier IN ('pro_monthly', 'pro_annual');

-- Índices para buscas rápidas de sincronização e agendamentos pendentes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_asaas_sync
  ON public.user_subscriptions (asaas_sync_status)
  WHERE asaas_sync_status = 'pending_resync';

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_pending_plan
  ON public.user_subscriptions (pending_plan_effective_at)
  WHERE pending_plan_id IS NOT NULL;
