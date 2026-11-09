-- ============================================================================
-- Migration: 20260101000104_billing_refinements_and_audit_logs.sql
-- Tabela de auditoria para webhooks de faturamento e grace period de 3 dias
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payment_id TEXT,
    subscription_id TEXT,
    customer_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS e permitir leitura apenas para administradores
ALTER TABLE public.billing_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores leem billing_webhook_logs" ON public.billing_webhook_logs;

CREATE POLICY "Apenas administradores leem billing_webhook_logs"
    ON public.billing_webhook_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
        )
    );

-- Criar índice para buscas rápidas por payment_id e timestamp
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_payment ON public.billing_webhook_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_created_at ON public.billing_webhook_logs (created_at DESC);

-- Atualização da função can_current_user_write com Grace Period de 3 dias para past_due
CREATE OR REPLACE FUNCTION public.can_current_user_write()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.user_subscriptions s ON s.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.status = 'active'::public.user_status
      AND (
        p.role IN ('superadmin'::public.user_role, 'admin'::public.user_role)
        OR s.tier = 'lifetime'::public.subscription_tier
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'active'::public.subscription_status
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        )
        -- Grace period de 3 dias para falhas temporárias de cartão na renovação
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'past_due'::public.subscription_status
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end + INTERVAL '3 days' > now()
        )
        OR (
          s.tier = 'trial'::public.subscription_tier
          AND s.status = 'trialing'::public.subscription_status
          AND (s.trial_ends_at IS NULL OR s.trial_ends_at > now())
        )
      )
  );
$$;
