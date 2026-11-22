-- =============================================================================
-- Migration 0138: Notification Hub Hardening, Broadcast Security & Lifecycle Fixes
-- =============================================================================

-- 1. Trava RPCs de Broadcast contra acesso anonimo (PUBLIC / anon) e exige auth.uid()
DROP FUNCTION IF EXISTS public.get_my_broadcast_notifications(integer);

CREATE OR REPLACE FUNCTION public.get_my_broadcast_notifications(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  type text,
  action_url text,
  created_at timestamptz,
  expires_at timestamptz,
  is_read boolean,
  is_dismissed boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id,
    b.title,
    b.message,
    b.type,
    b.action_url,
    b.created_at,
    b.expires_at,
    (r.read_at IS NOT NULL) AS is_read,
    (r.dismissed_at IS NOT NULL) AS is_dismissed
  FROM public.admin_broadcast_notifications b
  LEFT JOIN public.user_notification_reads r
    ON r.notification_id = b.id AND r.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND (b.expires_at IS NULL OR b.expires_at > now())
    AND (r.dismissed_at IS NULL)
    AND (
      b.target_audience = 'all'
      OR (b.target_audience = 'specific_users' AND (auth.uid() = ANY(b.target_user_ids)))
      OR (b.target_audience = 'pro' AND EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.status IN ('active', 'trialing')
          AND s.tier IN ('pro_monthly', 'pro_annual', 'lifetime')
      ))
      OR (b.target_audience = 'free' AND NOT EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.status IN ('active', 'trialing')
          AND s.tier IN ('pro_monthly', 'pro_annual', 'lifetime')
      ))
    )
  ORDER BY b.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.get_my_broadcast_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_broadcast_notifications(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_broadcast_as_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  INSERT INTO public.user_notification_reads (user_id, notification_id, read_at)
  VALUES (v_uid, p_notification_id, now())
  ON CONFLICT (user_id, notification_id)
  DO UPDATE SET read_at = COALESCE(public.user_notification_reads.read_at, now());
END;
$$;

REVOKE ALL ON FUNCTION public.mark_broadcast_as_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_broadcast_as_read(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.dismiss_broadcast_notification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_broadcast_notification(uuid) TO authenticated;

-- 2. Atualiza admin_send_broadcast_notification para suportar expires_at e validar action_url
DROP FUNCTION IF EXISTS public.admin_send_broadcast_notification(text, text, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.admin_send_broadcast_notification(text, text, text, text, text, uuid[], timestamptz);

CREATE OR REPLACE FUNCTION public.admin_send_broadcast_notification(
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_action_url text DEFAULT NULL,
  p_target_audience text DEFAULT 'all',
  p_target_user_ids uuid[] DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_notification_id uuid;
  v_action_url text;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  v_action_url := NULLIF(trim(COALESCE(p_action_url, '')), '');
  IF v_action_url IS NOT NULL THEN
    IF NOT (
      (v_action_url LIKE '/%' AND v_action_url NOT LIKE '//%')
      OR v_action_url ~* '^https://[a-z0-9.-]+'
    ) THEN
      RAISE EXCEPTION 'URL de ação inválida. Utilize rota interna (/...) ou link HTTPS.';
    END IF;
  END IF;

  INSERT INTO public.admin_broadcast_notifications (
    title,
    message,
    type,
    action_url,
    target_audience,
    target_user_ids,
    expires_at,
    created_by
  ) VALUES (
    trim(p_title),
    trim(p_message),
    p_type,
    v_action_url,
    p_target_audience,
    p_target_user_ids,
    p_expires_at,
    v_admin_id
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'broadcast_notification',
    v_notification_id::text,
    'admin_create_broadcast',
    jsonb_build_object(
      'title', trim(p_title),
      'type', p_type,
      'target_audience', p_target_audience,
      'expires_at', p_expires_at,
      'target_count', CASE WHEN p_target_user_ids IS NOT NULL THEN array_length(p_target_user_ids, 1) ELSE NULL END
    )
  );

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_send_broadcast_notification(text, text, text, text, text, uuid[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast_notification(text, text, text, text, text, uuid[], timestamptz) TO authenticated;

-- 3. Restringe SELECT direto na tabela admin_broadcast_notifications para admins (clientes usam get_my_broadcast_notifications)
DROP POLICY IF EXISTS broadcast_notifications_select ON public.admin_broadcast_notifications;
CREATE POLICY broadcast_notifications_select ON public.admin_broadcast_notifications
  FOR SELECT TO authenticated
  USING (public.is_admin() AND auth.uid() IS NOT NULL);

-- Politica administrativa de leitura para push_delivery_logs
DROP POLICY IF EXISTS push_delivery_logs_select_admin ON public.push_delivery_logs;
CREATE POLICY push_delivery_logs_select_admin ON public.push_delivery_logs
  FOR SELECT TO authenticated
  USING (public.is_admin() AND auth.uid() IS NOT NULL);

-- FORCE ROW LEVEL SECURITY nas tabelas sensiveis de notificacao e e-mail
ALTER TABLE public.user_push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_reads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_broadcast_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_email_logs FORCE ROW LEVEL SECURITY;

-- 4. Fixa search_path em public.update_updated_at()
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- 5. Corrige handle_new_user(): usa coluna custom_settings (substituindo 'preferences' inexistente)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_count     integer;
  v_invite_code    text;
  v_invite         public.access_invites%rowtype;
  v_has_invite     boolean := false;
  v_initial_role   public.user_role := 'user'::public.user_role;
  v_initial_status public.user_status := 'active'::public.user_status;
  v_approved_at    timestamptz := now();
  v_target_tier    public.subscription_tier := 'trial'::public.subscription_tier;
  v_target_plan    text := 'trial';
  v_trial_days     integer := 30;
  v_trial_ends_at  timestamptz := now() + interval '30 days';
  v_sub_status     public.subscription_status := 'trialing'::public.subscription_status;
  v_starts_at      timestamptz := now();
  v_trial_started_at timestamptz := now();
  v_module_key     text;
  v_access_val     text;
  v_app_mode       text := 'investor';
BEGIN
  -- Contagem de usuarios existentes (auth.users nao tem RLS)
  SELECT count(*) - 1 INTO v_user_count FROM auth.users;

  -- Primeiro usuario do sistema e superadmin com plano Vitalicio
  IF v_user_count <= 0 THEN
    v_initial_role     := 'superadmin'::public.user_role;
    v_initial_status   := 'active'::public.user_status;
    v_approved_at      := now();
    v_target_tier      := 'lifetime'::public.subscription_tier;
    v_target_plan      := 'lifetime';
    v_sub_status       := 'active'::public.subscription_status;
    v_trial_ends_at    := NULL;
    v_trial_started_at := NULL;
  ELSE
    v_invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));

    IF v_invite_code <> '' THEN
      BEGIN
        SELECT * INTO v_invite
        FROM public.access_invites
        WHERE upper(code) = upper(v_invite_code)
          AND is_revoked = false
          AND (expires_at IS NULL OR expires_at > now())
          AND used_count < max_uses
        FOR UPDATE;

        IF found THEN
          IF v_invite.target_email IS NULL OR lower(v_invite.target_email) = lower(new.email) THEN
            v_has_invite := true;
            v_target_tier := v_invite.target_tier;
            v_target_plan := CASE
              WHEN v_target_tier = 'lifetime'::public.subscription_tier    THEN 'lifetime'
              WHEN v_target_tier = 'pro_annual'::public.subscription_tier  THEN 'pro_annual'
              WHEN v_target_tier = 'pro_monthly'::public.subscription_tier THEN 'pro_monthly'
              ELSE 'trial'
            END;

            IF v_target_tier = 'lifetime'::public.subscription_tier
               OR v_target_tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) THEN
              v_sub_status       := 'active'::public.subscription_status;
              v_trial_ends_at    := NULL;
              v_trial_started_at := NULL;
            ELSE
              v_trial_days       := coalesce(v_invite.custom_trial_days, 30);
              v_trial_ends_at    := now() + (v_trial_days || ' days')::interval;
              v_sub_status       := 'trialing'::public.subscription_status;
              v_trial_started_at := now();
            END IF;

            UPDATE public.access_invites
            SET used_count = used_count + 1
            WHERE id = v_invite.id;
          END IF;
        END IF;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Invite increment skipped: %', sqlerrm;
      END;
    END IF;
  END IF;

  IF (new.raw_user_meta_data ->> 'app_mode') IN ('essential', 'investor') THEN
    v_app_mode := new.raw_user_meta_data ->> 'app_mode';
  END IF;

  -- 1. Cria perfil
  BEGIN
    INSERT INTO public.profiles (
      id, name, email, role, status, approved_at,
      phone, postal_code, address_number
    )
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      new.email,
      v_initial_role,
      v_initial_status,
      v_approved_at,
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'postal_code', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'address_number', '')), '')
    )
    ON CONFLICT (id) DO UPDATE
    SET name = coalesce(nullif(excluded.name, ''), profiles.name),
        phone = coalesce(excluded.phone, profiles.phone),
        postal_code = coalesce(excluded.postal_code, profiles.postal_code),
        address_number = coalesce(excluded.address_number, profiles.address_number);
  EXCEPTION WHEN others THEN
    RAISE WARNING '[handle_new_user] Erro ao criar perfil para %: %', new.id, sqlerrm;
  END;

  -- 2. Cria assinatura com datas de inicio e trial preenchidas
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      tier,
      status,
      starts_at,
      trial_started_at,
      trial_ends_at
    )
    VALUES (
      new.id,
      v_target_plan,
      v_target_tier,
      v_sub_status,
      v_starts_at,
      v_trial_started_at,
      v_trial_ends_at
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING '[handle_new_user] Erro ao criar assinatura para %: %', new.id, sqlerrm;
  END;

  -- 3. Aplica overrides de modulos do convite se houver convite atribuido
  IF v_has_invite THEN
    IF v_invite.module_grants IS NOT NULL AND v_invite.module_grants <> '{}'::jsonb THEN
      BEGIN
        FOR v_module_key, v_access_val IN
          SELECT key, value#>>'{}' FROM jsonb_each(v_invite.module_grants)
        LOOP
          IF EXISTS (SELECT 1 FROM public.system_features WHERE key = v_module_key) THEN
            INSERT INTO public.user_module_permissions (user_id, module_key, access_level)
            VALUES (new.id, v_module_key, v_access_val::public.access_level)
            ON CONFLICT (user_id, module_key) DO UPDATE
            SET access_level = excluded.access_level;
          END IF;
        END LOOP;
      EXCEPTION WHEN others THEN
        RAISE WARNING '[handle_new_user] Erro ao aplicar modulos do convite para %: %', new.id, sqlerrm;
      END;
    END IF;
  END IF;

  -- 4. Cria preferencias de usuario na coluna canonica custom_settings
  BEGIN
    INSERT INTO public.user_preferences (user_id, app_mode, custom_settings)
    VALUES (
      new.id,
      v_app_mode,
      jsonb_build_object(
        'familyModeEnabled', true,
        'hideValues', false,
        'hasCompletedWizard', false
      )
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING '[handle_new_user] Erro ao criar preferencias para %: %', new.id, sqlerrm;
  END;

  -- 5. Seed das categorias padrao
  BEGIN
    PERFORM public.seed_default_categories_for_user(new.id);
  EXCEPTION WHEN others THEN
    RAISE WARNING '[handle_new_user] Erro ao criar categorias padrao para %: %', new.id, sqlerrm;
  END;

  RETURN new;
END;
$$;

-- 6. Permite execucao direta pelo pg_cron (postgres/supabase_admin) em reconcile_expired_subscriptions()
CREATE OR REPLACE FUNCTION public.reconcile_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
  v_step_count integer := 0;
BEGIN
  IF NOT (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos para reconciliar assinaturas.';
  END IF;

  -- 1) Expira assinaturas com cancelamento agendado cujo current_period_end ja passou
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

  -- 2) Expira trials vencidos que nao possuem plano futuro agendado
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

  -- 3) Expira assinaturas past_due cujo grace period de 3 dias ja se encerrou
  WITH expired_past_due AS (
    UPDATE public.user_subscriptions
    SET status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        updated_at = now()
    WHERE status = 'past_due'::public.subscription_status
      AND current_period_end IS NOT NULL
      AND current_period_end + INTERVAL '3 days' <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_step_count FROM expired_past_due;
  v_updated_count := v_updated_count + v_step_count;

  -- 4) Marca billing_intents pendentes ha mais de 24 horas como expiradas
  UPDATE public.billing_intents
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND created_at < (now() - INTERVAL '24 hours');

  RETURN v_updated_count;
END;
$$;

-- 7. Otimizacao de Subplan Caching (InitPlan) nas policies de user_push_subscriptions e push_delivery_logs
DROP POLICY IF EXISTS "user_push_subscriptions_select_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_select_own"
  ON public.user_push_subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_push_subscriptions_insert_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_insert_own"
  ON public.user_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_push_subscriptions_update_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_update_own"
  ON public.user_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_push_subscriptions_delete_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_delete_own"
  ON public.user_push_subscriptions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "push_delivery_logs_select_own" ON public.push_delivery_logs;
CREATE POLICY "push_delivery_logs_select_own"
  ON public.push_delivery_logs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
