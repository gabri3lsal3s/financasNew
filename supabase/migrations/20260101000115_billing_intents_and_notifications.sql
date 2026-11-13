-- ============================================================================
-- Migration: 20260101000115_billing_intents_and_notifications.sql
-- Descrição: Cria a tabela public.billing_intents para garantir idempotência,
--            rastreabilidade de compras acumulativas e controle de pagamentos.
--            Adiciona provider_event_id em billing_webhook_logs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('subscription_start', 'plan_change', 'cumulative_renewal', 'reactivation')),
  plan_id TEXT REFERENCES public.plans (id),
  months_count INTEGER CHECK (months_count >= 1 AND months_count <= 11),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  method TEXT NOT NULL CHECK (method IN ('credit_card', 'pix')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'expired', 'canceled')) DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_payment_id TEXT,
  provider_subscription_id TEXT,
  external_reference TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida e reconciliação
CREATE INDEX IF NOT EXISTS idx_billing_intents_user ON public.billing_intents (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_intents_status ON public.billing_intents (status);
CREATE INDEX IF NOT EXISTS idx_billing_intents_payment_id ON public.billing_intents (provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_intents_ext_ref ON public.billing_intents (external_reference);

-- Habilitar RLS estrita
ALTER TABLE public.billing_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários leem apenas suas próprias billing_intents" ON public.billing_intents;
CREATE POLICY "Usuários leem apenas suas próprias billing_intents"
  ON public.billing_intents
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );

-- Inserção e atualização restrita a Service Role e administradores
DROP POLICY IF EXISTS "Apenas service role e admins inserem billing_intents" ON public.billing_intents;
CREATE POLICY "Apenas service role e admins inserem billing_intents"
  ON public.billing_intents
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );

DROP POLICY IF EXISTS "Apenas service role e admins atualizam billing_intents" ON public.billing_intents;
CREATE POLICY "Apenas service role e admins atualizam billing_intents"
  ON public.billing_intents
  FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );

-- Adicionar provider_event_id em public.billing_webhook_logs para desduplicação idempotente de webhooks
ALTER TABLE public.billing_webhook_logs
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_webhook_logs_provider_event
  ON public.billing_webhook_logs (provider_event_id)
  WHERE provider_event_id IS NOT NULL;
