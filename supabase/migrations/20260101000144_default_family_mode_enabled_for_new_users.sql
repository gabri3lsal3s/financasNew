-- ================================================================
-- Migration: 20260101000144_default_family_mode_enabled_for_new_users.sql
-- Ativação por padrão do Modo Família no onboarding de novos usuários:
--
-- 1. Restaura o valor padrão da coluna custom_settings em user_preferences
--    para '{"familyModeEnabled": true}'::jsonb.
-- 2. Atualiza handle_new_user() para persistir explicitamente
--    'familyModeEnabled', true em novos cadastros.
-- 3. Atualiza contas recém-criadas ainda em onboarding (sem lançamentos e
--    com hasCompletedWizard = false) para familyModeEnabled = true.
-- ================================================================

ALTER TABLE public.user_preferences
  ALTER COLUMN custom_settings SET DEFAULT '{"familyModeEnabled": true}'::jsonb;

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

  -- 4. Cria preferencias de usuario na coluna canonica custom_settings (Modo Familia ativo por padrao)
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

-- 3. Backfill de contas ainda em onboarding (sem lancamentos e wizard nao concluido)
UPDATE public.user_preferences
SET custom_settings = jsonb_set(
  coalesce(custom_settings, '{}'::jsonb),
  '{familyModeEnabled}',
  'true'::jsonb,
  true
)
WHERE coalesce((custom_settings ->> 'familyModeEnabled')::boolean, false) = false
  AND coalesce((custom_settings ->> 'hasCompletedWizard')::boolean, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.user_id = public.user_preferences.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.incomes i WHERE i.user_id = public.user_preferences.user_id);
