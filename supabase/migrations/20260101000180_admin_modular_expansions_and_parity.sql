-- ============================================================================
-- Migration 0180: Expansões Modulares (Família, Viagem, PJ), Paridade Legada,
-- Preview de Impacto e Motivo de Auditoria no Toggle Global
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cadastro das features de expansão em public.system_features
-- ----------------------------------------------------------------------------
INSERT INTO public.system_features (
  key,
  name,
  description,
  is_globally_enabled,
  default_enabled_for_new_users
)
VALUES
  (
    'family',
    'Modo Família',
    'Gestão financeira compartilhada, despesas conjuntas e metas familiares.',
    true,
    true
  ),
  (
    'trips',
    'Modo Viagem',
    'Orçamentos de viagem, câmbio e divisão de gastos em viagens.',
    true,
    true
  ),
  (
    'business',
    'Modo Negócio (PJ)',
    'Fluxo de caixa empresarial, clientes e separação entre contas PF e PJ.',
    true,
    true
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_globally_enabled = EXCLUDED.is_globally_enabled,
  default_enabled_for_new_users = EXCLUDED.default_enabled_for_new_users,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 2. Atualização de public.get_user_module_access(uuid, text)
--    Preserva toda a segurança/lógica da 0157, inclui expansões em
--    v_is_core_module e aplica paridade legada herdando override de 'transactions'
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
    'budgets', 'investments', 'reports', 'insights', 'reminders',
    'family', 'trips', 'business'
  );

  SELECT access_level INTO v_override
  FROM public.user_module_permissions
  WHERE user_id = p_user_id
    AND module_key = p_module_key
    AND (expires_at IS NULL OR expires_at > now());

  IF v_override IS NULL AND p_module_key IN ('family', 'trips', 'business') THEN
    SELECT access_level INTO v_override
    FROM public.user_module_permissions
    WHERE user_id = p_user_id
      AND module_key = 'transactions'
      AND (expires_at IS NULL OR expires_at > now());
  END IF;

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
-- 3. RPC public.admin_preview_global_feature_impact(p_feature_key text)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_global_feature_impact(
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_users_total integer := 0;
  v_recent_active_24h integer := 0;
  v_explicit_overrides_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  SELECT count(*)::integer
  INTO v_active_users_total
  FROM public.profiles
  WHERE status = 'active'::public.user_status;

  BEGIN
    SELECT count(DISTINCT user_id)::integer
    INTO v_recent_active_24h
    FROM public.user_devices
    WHERE is_revoked = false
      AND last_seen_at >= now() - interval '24 hours';
  EXCEPTION
    WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      v_recent_active_24h := 0;
  END;

  SELECT count(DISTINCT user_id)::integer
  INTO v_explicit_overrides_count
  FROM (
    SELECT user_id
    FROM public.user_module_permissions
    WHERE module_key = p_feature_key
      AND (expires_at IS NULL OR expires_at > now())
    UNION
    SELECT user_id
    FROM public.user_feature_overrides
    WHERE feature_key = p_feature_key
  ) AS overrides;

  RETURN jsonb_build_object(
    'feature_key', p_feature_key,
    'active_users_total', coalesce(v_active_users_total, 0),
    'recent_active_24h', coalesce(v_recent_active_24h, 0),
    'explicit_overrides_count', coalesce(v_explicit_overrides_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_preview_global_feature_impact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_global_feature_impact(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Atualização de public.admin_toggle_global_feature com p_reason
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_toggle_global_feature(text, boolean);

CREATE OR REPLACE FUNCTION public.admin_toggle_global_feature(
  p_feature_key text,
  p_enabled boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  UPDATE public.system_features
  SET is_globally_enabled = p_enabled,
      updated_at = now()
  WHERE key = p_feature_key;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'system_features',
    p_feature_key,
    'TOGGLE_GLOBAL_FEATURE',
    jsonb_build_object(
      'is_globally_enabled', p_enabled,
      'reason', v_reason
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_global_feature(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_global_feature(text, boolean, text) TO authenticated, service_role;
