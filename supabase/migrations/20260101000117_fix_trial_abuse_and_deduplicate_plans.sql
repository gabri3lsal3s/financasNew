-- ============================================================================
-- Migration: 20260101000117_fix_trial_abuse_and_deduplicate_plans.sql
-- Descrição:
--   1. Deduplicação do catálogo de planos em public.plans:
--      Remove o alias 'lifetime_vip' e o plano legado 'free', mantendo
--      estritamente os 4 planos oficiais: 'trial', 'pro_monthly', 'pro_annual', 'lifetime'.
--   2. Blindagem contra brecha de trial recorrente:
--      Usuários em somente leitura (read_only), com status cancelado/expirado
--      ou que já tenham consumido o período de teste inicial de 30 dias
--      têm trial_consumed_at marcado e trial_days_remaining = 0, forçando
--      cobrança imediata no ato da reativação sem concessão de novos 30 dias.
--   3. Atualização do RPC get_my_subscription() para expor trial_consumed_at
--      e has_used_trial com consistência fail-closed.
-- ============================================================================

-- 1. Remoção de referências estrangeiras aos aliases legados antes da exclusão
UPDATE public.user_subscriptions
SET plan_id = 'lifetime'
WHERE plan_id = 'lifetime_vip';

UPDATE public.user_subscriptions
SET plan_id = 'trial'
WHERE plan_id = 'free';

UPDATE public.billing_intents
SET plan_id = 'lifetime'
WHERE plan_id = 'lifetime_vip';

UPDATE public.billing_intents
SET plan_id = 'trial'
WHERE plan_id = 'free';

-- 2. Remoção dos planos legados / duplicados da tabela public.plans
DELETE FROM public.plans
WHERE id IN ('lifetime_vip', 'free');

-- 3. Reseed canônico e alinhamento dos 4 planos oficiais
INSERT INTO public.plans (id, name, description, price_cents, billing_interval, is_publicly_available)
VALUES
  ('trial', 'Teste Pro (30 dias)', 'Acesso irrestrito a todas as ferramentas por 30 dias.', 0, null, false),
  ('pro_monthly', 'Plano Pro Mensal', 'Assinatura recorrente mensal com acesso completo.', 1999, 'month', true),
  ('pro_annual', 'Plano Pro Anual', 'Assinatura anual com 40% de desconto em relação ao mensal.', 14388, 'year', true),
  ('lifetime', 'Plano Vitalício VIP', 'Acesso completo permanente sem expiração.', 0, null, false)
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    billing_interval = excluded.billing_interval,
    is_publicly_available = excluded.is_publicly_available;

-- 4. Backfill de proteção contra brecha de trial em public.user_subscriptions
UPDATE public.user_subscriptions
SET trial_consumed_at = COALESCE(trial_consumed_at, trial_ends_at, NOW())
WHERE trial_consumed_at IS NULL AND (
  tier = 'read_only'::public.subscription_tier OR
  status IN ('canceled'::public.subscription_status, 'read_only_expired'::public.subscription_status, 'past_due'::public.subscription_status) OR
  billing_start_at IS NOT NULL OR
  starts_at < NOW() - INTERVAL '30 days' OR
  (tier = 'trial'::public.subscription_tier AND trial_ends_at IS NOT NULL AND trial_ends_at <= NOW())
);

-- 5. Atualização de get_my_subscription()
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_role public.user_role;
  v_status public.user_status;
  v_is_superadmin boolean;
  v_is_admin boolean;
  v_can_write boolean;
  v_trial_days_remaining integer := 0;
  v_effective_tier public.subscription_tier;
  v_billing_phase text;
  v_module_permissions jsonb;
  v_has_used_trial boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN null;
  END IF;

  SELECT role, status INTO v_role, v_status
  FROM public.profiles
  WHERE id = v_uid;

  v_is_superadmin := (v_role = 'superadmin'::public.user_role);
  v_is_admin := (v_role IN ('admin'::public.user_role, 'superadmin'::public.user_role));

  SELECT * INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  -- Se não existir assinatura física, cria como trial padrão de 30 dias de forma idempotente
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.user_subscriptions (
        user_id, plan_id, tier, status, starts_at, trial_started_at, trial_ends_at
      )
      VALUES (
        v_uid, 'trial', 'trial'::public.subscription_tier, 'trialing'::public.subscription_status,
        NOW(), NOW(), NOW() + INTERVAL '30 days'
      )
      ON CONFLICT (user_id) DO NOTHING
      RETURNING * INTO v_sub;
    EXCEPTION WHEN others THEN
      -- Fallback defensivo
    END;

    IF v_sub.user_id IS NULL THEN
      SELECT * INTO v_sub
      FROM public.user_subscriptions
      WHERE user_id = v_uid;
    END IF;
  END IF;

  v_can_write := public.can_current_user_write();

  -- Se por qualquer motivo extremo ainda não houver linha, gera snapshot virtual
  IF v_sub.user_id IS NULL THEN
    SELECT jsonb_object_agg(
      sf.key,
      public.get_user_module_access(v_uid, sf.key)
    ) INTO v_module_permissions
    FROM public.system_features sf;

    RETURN jsonb_build_object(
      'tier', 'trial',
      'status', 'trialing',
      'billing_phase', 'trial_active',
      'plan_id', 'trial',
      'starts_at', NOW(),
      'trial_started_at', NOW(),
      'trial_ends_at', NOW() + INTERVAL '30 days',
      'current_period_end', null,
      'trial_days_remaining', 30,
      'cancel_at_period_end', false,
      'is_full_access', (v_status = 'active'::public.user_status),
      'is_trial', true,
      'is_pro', false,
      'is_lifetime', false,
      'is_read_only', false,
      'can_write', v_can_write,
      'has_card_registered', false,
      'has_auto_renew', false,
      'has_used_trial', false,
      'trial_consumed_at', null,
      'scheduled_plan_id', null,
      'scheduled_first_charge_at', null,
      'pending_plan_id', null,
      'pending_plan_effective_at', null,
      'asaas_subscription_id', null,
      'asaas_sync_status', 'synced',
      'card_last4', null,
      'module_permissions', COALESCE(v_module_permissions, '{}'::jsonb)
    );
  END IF;

  -- Flag se o usuário já consumiu o benefício de trial
  v_has_used_trial := (
    v_sub.trial_consumed_at IS NOT NULL
    OR v_sub.billing_start_at IS NOT NULL
    OR v_sub.tier = 'read_only'::public.subscription_tier
    OR v_sub.status IN ('canceled'::public.subscription_status, 'read_only_expired'::public.subscription_status)
    OR (v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= NOW())
  );

  -- 1. Resolução determinística da fase (billing_phase)
  IF v_sub.tier = 'lifetime'::public.subscription_tier AND v_sub.status = 'active'::public.subscription_status THEN
    v_billing_phase := 'lifetime';
    v_effective_tier := 'lifetime'::public.subscription_tier;
    v_trial_days_remaining := 0;
  ELSIF (v_sub.tier = 'trial'::public.subscription_tier OR v_sub.status = 'trialing'::public.subscription_status)
        AND NOT v_has_used_trial THEN
    IF v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at > NOW() THEN
      v_trial_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.trial_ends_at - NOW())) / 86400)::integer);
      IF v_sub.scheduled_plan_id IS NOT NULL OR (v_sub.scheduled_first_charge_at IS NOT NULL AND v_sub.scheduled_first_charge_at >= NOW()) THEN
        v_billing_phase := 'trial_scheduled';
      ELSE
        v_billing_phase := 'trial_active';
      END IF;
      v_effective_tier := 'trial'::public.subscription_tier;
    ELSE
      v_trial_days_remaining := 0;
      v_billing_phase := 'trial_expired';
      v_effective_tier := 'read_only'::public.subscription_tier;
    END IF;
  ELSIF v_sub.cancel_at_period_end = true AND v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > NOW() THEN
    v_billing_phase := 'canceled_until_period_end';
    v_effective_tier := v_sub.tier;
    v_trial_days_remaining := 0;
  ELSIF v_sub.status = 'past_due'::public.subscription_status THEN
    v_billing_phase := 'past_due';
    v_effective_tier := v_sub.tier;
    v_trial_days_remaining := 0;
  ELSIF v_sub.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) AND v_sub.status = 'active'::public.subscription_status THEN
    IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > NOW() THEN
      v_billing_phase := 'active';
      v_effective_tier := v_sub.tier;
      v_trial_days_remaining := 0;
    ELSE
      v_billing_phase := 'read_only';
      v_effective_tier := 'read_only'::public.subscription_tier;
      v_trial_days_remaining := 0;
    END IF;
  ELSE
    v_billing_phase := 'read_only';
    v_effective_tier := 'read_only'::public.subscription_tier;
    v_trial_days_remaining := 0;
  END IF;

  -- Mapeamento consolidado de permissões por módulo
  SELECT jsonb_object_agg(
    sf.key,
    public.get_user_module_access(v_uid, sf.key)
  ) INTO v_module_permissions
  FROM public.system_features sf;

  RETURN jsonb_build_object(
    'id', v_sub.id,
    'tier', v_effective_tier,
    'status', v_sub.status,
    'billing_phase', v_billing_phase,
    'plan_id', v_sub.plan_id,
    'starts_at', v_sub.starts_at,
    'trial_started_at', v_sub.trial_started_at,
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_consumed_at', v_sub.trial_consumed_at,
    'trial_days_remaining', v_trial_days_remaining,
    'has_used_trial', v_has_used_trial,
    'billing_start_at', v_sub.billing_start_at,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
    'scheduled_plan_id', v_sub.scheduled_plan_id,
    'scheduled_first_charge_at', v_sub.scheduled_first_charge_at,
    'pending_plan_id', v_sub.pending_plan_id,
    'pending_plan_effective_at', v_sub.pending_plan_effective_at,
    'payment_method', v_sub.payment_method,
    'card_brand', v_sub.card_brand,
    'card_last4', v_sub.card_last4,
    'asaas_subscription_id', v_sub.asaas_subscription_id,
    'asaas_customer_id', v_sub.asaas_customer_id,
    'asaas_sync_status', COALESCE(v_sub.asaas_sync_status, 'synced'),
    'is_full_access', (v_status = 'active'::public.user_status AND v_effective_tier != 'read_only'::public.subscription_tier),
    'is_trial', (v_billing_phase IN ('trial_active', 'trial_scheduled')),
    'is_pro', (v_effective_tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) AND v_billing_phase != 'read_only'),
    'is_lifetime', (v_effective_tier = 'lifetime'::public.subscription_tier),
    'is_read_only', (v_billing_phase = 'read_only' OR v_effective_tier = 'read_only'::public.subscription_tier),
    'can_write', v_can_write,
    'has_card_registered', (v_sub.asaas_subscription_id IS NOT NULL OR v_sub.card_last4 IS NOT NULL),
    'has_auto_renew', (v_sub.asaas_subscription_id IS NOT NULL AND COALESCE(v_sub.cancel_at_period_end, false) = false),
    'module_permissions', COALESCE(v_module_permissions, '{}'::jsonb)
  );
END;
$$;
