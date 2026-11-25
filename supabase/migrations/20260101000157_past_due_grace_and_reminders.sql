-- ============================================================================
-- Migration: 20260101000157_past_due_grace_and_reminders.sql
-- Descrição: Controle flexível de inadimplência (past_due) pelo Admin:
--   1. Adiciona colunas de governança de carência e lembretes semanais em
--      public.user_subscriptions (`past_due_since`, `past_due_grace_mode`,
--      `past_due_block_at`, `past_due_reminders_enabled`,
--      `past_due_last_reminded_at`, `past_due_reminder_count`).
--   2. Atualiza `can_current_user_write()`, `get_user_module_access()`,
--      `get_my_subscription()` e `reconcile_expired_subscriptions()` para
--      respeitar tolerância manual ou bloqueio agendado pelo Admin para
--      assinantes que já efetuaram pelo menos 1 pagamento.
--   3. Cria RPC `admin_list_past_due_subscriptions()` para o painel Admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Novas colunas em public.user_subscriptions
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_grace_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS past_due_block_at timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS past_due_last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_reminder_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_subscriptions_past_due_grace_mode_check'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_past_due_grace_mode_check
      CHECK (past_due_grace_mode IN ('manual', 'auto'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_past_due_active
  ON public.user_subscriptions (status, past_due_block_at, past_due_last_reminded_at)
  WHERE status = 'past_due'::public.subscription_status;

-- ----------------------------------------------------------------------------
-- 2. Atualização de public.can_current_user_write()
-- ----------------------------------------------------------------------------
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
          AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
        )
        -- Inadimplência (past_due) para quem já pagou pelo menos uma vez:
        --   • Modo manual sem data de bloqueio -> mantém escrita até ação do Admin
        --   • Com past_due_block_at definido -> mantém escrita até past_due_block_at
        --   • Modo auto sem past_due_block_at explícito -> janela padrão de 7 dias
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'past_due'::public.subscription_status
          AND s.billing_start_at IS NOT NULL
          AND (
            (s.past_due_block_at IS NOT NULL AND s.past_due_block_at > NOW())
            OR (s.past_due_block_at IS NULL AND s.past_due_grace_mode = 'manual')
            OR (
              s.past_due_block_at IS NULL
              AND s.past_due_grace_mode = 'auto'
              AND COALESCE(s.past_due_since, s.current_period_end, NOW()) + INTERVAL '7 days' > NOW()
            )
          )
        )
        -- Fallback defensivo para past_due sem pagamento prévio confirmado (3 dias)
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'past_due'::public.subscription_status
          AND s.billing_start_at IS NULL
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end + INTERVAL '3 days' > NOW()
        )
        OR (
          s.tier = 'trial'::public.subscription_tier
          AND s.status IN ('trialing'::public.subscription_status, 'active'::public.subscription_status)
          AND (s.trial_ends_at IS NULL OR s.trial_ends_at > NOW())
        )
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Atualização de public.get_user_module_access()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_module_access(
  p_user_id uuid,
  p_module_key text
)
RETURNS public.access_level
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role public.user_role;
  v_status public.user_status;
  v_feature_globally_enabled boolean;
  v_default_enabled boolean;
  v_override public.access_level;
  v_sub record;
  v_is_core_module boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'none'::public.access_level;
  END IF;

  IF coalesce(auth.role(), '') = 'anon' THEN
    RETURN 'none'::public.access_level;
  END IF;

  IF v_caller_uid IS NOT NULL
     AND p_user_id IS DISTINCT FROM v_caller_uid
     AND NOT public.is_admin() THEN
    RETURN 'none'::public.access_level;
  END IF;

  SELECT is_globally_enabled, coalesce(default_enabled_for_new_users, true)
  INTO v_feature_globally_enabled, v_default_enabled
  FROM public.system_features
  WHERE key = p_module_key;

  IF v_feature_globally_enabled IS FALSE THEN
    RETURN 'none'::public.access_level;
  END IF;

  SELECT role, status INTO v_role, v_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_status IN ('suspended'::public.user_status, 'banned'::public.user_status, 'pending_approval'::public.user_status) THEN
    RETURN 'none'::public.access_level;
  END IF;

  IF v_role IN ('superadmin'::public.user_role, 'admin'::public.user_role) THEN
    RETURN 'admin'::public.access_level;
  END IF;

  v_is_core_module := p_module_key IN (
    'overview', 'transactions', 'cards', 'debts',
    'budgets', 'investments', 'reports', 'insights', 'reminders'
  );

  SELECT access_level INTO v_override
  FROM public.user_module_permissions
  WHERE user_id = p_user_id
    AND module_key = p_module_key
    AND (expires_at IS NULL OR expires_at > now());

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  IF NOT v_is_core_module AND (v_default_enabled IS FALSE OR p_module_key = 'bank_notification_listener') THEN
    RETURN 'none'::public.access_level;
  END IF;

  SELECT
    tier,
    status,
    trial_ends_at,
    current_period_end,
    billing_start_at,
    past_due_since,
    past_due_grace_mode,
    past_due_block_at
  INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'read'::public.access_level;
  END IF;

  IF v_sub.status = 'active'::public.subscription_status THEN
    IF v_sub.tier = 'lifetime'::public.subscription_tier THEN
      RETURN 'write'::public.access_level;
    ELSIF v_sub.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) THEN
      IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > NOW() THEN
        RETURN 'write'::public.access_level;
      ELSE
        RETURN 'read'::public.access_level;
      END IF;
    END IF;
  END IF;

  IF v_sub.status = 'past_due'::public.subscription_status THEN
    IF v_sub.billing_start_at IS NOT NULL THEN
      IF (v_sub.past_due_block_at IS NOT NULL AND v_sub.past_due_block_at > NOW())
         OR (v_sub.past_due_block_at IS NULL AND v_sub.past_due_grace_mode = 'manual')
         OR (
           v_sub.past_due_block_at IS NULL
           AND v_sub.past_due_grace_mode = 'auto'
           AND COALESCE(v_sub.past_due_since, v_sub.current_period_end, NOW()) + INTERVAL '7 days' > NOW()
         ) THEN
        RETURN 'write'::public.access_level;
      END IF;
    ELSIF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end + INTERVAL '3 days' > NOW() THEN
      RETURN 'write'::public.access_level;
    END IF;
    RETURN 'read'::public.access_level;
  END IF;

  IF v_sub.tier = 'trial'::public.subscription_tier
     AND v_sub.status IN ('trialing'::public.subscription_status, 'active'::public.subscription_status)
     AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at > NOW()) THEN
    RETURN 'write'::public.access_level;
  END IF;

  RETURN 'read'::public.access_level;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_module_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_module_access(uuid, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Atualização de public.get_my_subscription()
-- ----------------------------------------------------------------------------
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
  v_past_due_within_grace boolean := false;
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
      'past_due_since', null,
      'past_due_grace_mode', 'manual',
      'past_due_block_at', null,
      'past_due_reminders_enabled', true,
      'module_permissions', COALESCE(v_module_permissions, '{}'::jsonb)
    );
  END IF;

  v_has_used_trial := (
    v_sub.trial_consumed_at IS NOT NULL
    OR v_sub.billing_start_at IS NOT NULL
    OR v_sub.tier = 'read_only'::public.subscription_tier
    OR v_sub.status IN ('canceled'::public.subscription_status, 'read_only_expired'::public.subscription_status)
    OR (v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= NOW())
  );

  IF v_sub.status = 'past_due'::public.subscription_status THEN
    IF v_sub.billing_start_at IS NOT NULL THEN
      v_past_due_within_grace := (
        (v_sub.past_due_block_at IS NOT NULL AND v_sub.past_due_block_at > NOW())
        OR (v_sub.past_due_block_at IS NULL AND v_sub.past_due_grace_mode = 'manual')
        OR (
          v_sub.past_due_block_at IS NULL
          AND v_sub.past_due_grace_mode = 'auto'
          AND COALESCE(v_sub.past_due_since, v_sub.current_period_end, NOW()) + INTERVAL '7 days' > NOW()
        )
      );
    ELSE
      v_past_due_within_grace := (
        v_sub.current_period_end IS NOT NULL
        AND v_sub.current_period_end + INTERVAL '3 days' > NOW()
      );
    END IF;
  END IF;

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
    IF v_past_due_within_grace THEN
      v_billing_phase := 'past_due';
      v_effective_tier := v_sub.tier;
    ELSE
      v_billing_phase := 'read_only';
      v_effective_tier := 'read_only'::public.subscription_tier;
    END IF;
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
    'past_due_since', v_sub.past_due_since,
    'past_due_grace_mode', COALESCE(v_sub.past_due_grace_mode, 'manual'),
    'past_due_block_at', v_sub.past_due_block_at,
    'past_due_reminders_enabled', COALESCE(v_sub.past_due_reminders_enabled, true),
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

-- ----------------------------------------------------------------------------
-- 5. Atualização de public.reconcile_expired_subscriptions()
-- ----------------------------------------------------------------------------
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

  -- 3) Expira assinaturas past_due somente quando houver bloqueio agendado vencido
  --    (ou modo 'auto' expirado / fallback sem pagamento prévio)
  WITH expired_past_due AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
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
          AND current_period_end IS NOT NULL
          AND current_period_end + INTERVAL '3 days' <= now()
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

-- ----------------------------------------------------------------------------
-- 6. RPC Admin: listar assinaturas em atraso (past_due) com perfil mascarado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_past_due_subscriptions()
RETURNS TABLE (
  subscription_id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  tier public.subscription_tier,
  status public.subscription_status,
  billing_start_at timestamptz,
  current_period_end timestamptz,
  past_due_since timestamptz,
  past_due_grace_mode text,
  past_due_block_at timestamptz,
  past_due_reminders_enabled boolean,
  past_due_last_reminded_at timestamptz,
  past_due_reminder_count integer
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
  SELECT
    s.id AS subscription_id,
    s.user_id,
    p.name AS user_name,
    p.email AS user_email,
    s.tier,
    s.status,
    s.billing_start_at,
    s.current_period_end,
    s.past_due_since,
    s.past_due_grace_mode,
    s.past_due_block_at,
    s.past_due_reminders_enabled,
    s.past_due_last_reminded_at,
    s.past_due_reminder_count
  FROM public.user_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.status = 'past_due'::public.subscription_status
  ORDER BY COALESCE(s.past_due_since, s.updated_at) ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_past_due_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_past_due_subscriptions() TO authenticated, service_role;
