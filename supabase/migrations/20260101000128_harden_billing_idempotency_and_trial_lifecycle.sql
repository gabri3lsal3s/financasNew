-- ============================================================================
-- Migration: 20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql
-- Descrição: Fase 1 do Plano Mestre de Assinaturas e Onboarding:
--            1. Tabelas de controle idempotente (billing_processed_payments, transactional_email_logs)
--            2. Expansão de profiles (phone, postal_code, address_number) e correção de handle_new_user()
--            3. Alinhamento de Grace Period (3 dias) em get_user_module_access
--            4. Resolução de módulos Beta em get_my_features
--            5. Fechamento de brechas RLS e RPCs SECURITY DEFINER de mutação
--            6. Hardening RBAC e proteção hierárquica em RPCs administrativas
--            7. Correção de enum em reconcile_expired_subscriptions() para read_only_expired
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELAS DE IDEMPOTÊNCIA E AUDITORIA
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.billing_processed_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas',
  provider_payment_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'subscription_first_charge' | 'subscription_renewal' | 'cumulative_renewal' | 'plan_change'
  amount_cents integer NOT NULL,
  period_end_applied timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_processed_payments UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_processed_payments_user_id 
  ON public.billing_processed_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_processed_payments_provider_id 
  ON public.billing_processed_payments (provider, provider_payment_id);

ALTER TABLE public.billing_processed_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam processed payments" ON public.billing_processed_payments;
CREATE POLICY "Admins gerenciam processed payments" ON public.billing_processed_payments
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  ) WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );


CREATE TABLE IF NOT EXISTS public.transactional_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  dedup_key text NOT NULL CONSTRAINT uq_transactional_email_logs_dedup UNIQUE,
  recipient_email text NOT NULL,
  provider_message_id text,
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactional_email_logs_user_id 
  ON public.transactional_email_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_transactional_email_logs_dedup 
  ON public.transactional_email_logs (dedup_key);

ALTER TABLE public.transactional_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam email logs" ON public.transactional_email_logs;
CREATE POLICY "Admins gerenciam email logs" ON public.transactional_email_logs
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  ) WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_processed_payments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactional_email_logs TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. EXPANSÃO DE PROFILES E CORREÇÃO DE HANDLE_NEW_USER
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS address_number text;

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
  -- Contagem de usuários existentes (auth.users não tem RLS)
  SELECT count(*) - 1 INTO v_user_count FROM auth.users;

  -- Primeiro usuário do sistema é superadmin com plano Vitalício
  IF v_user_count <= 0 THEN
    v_initial_role     := 'superadmin'::public.user_role;
    v_initial_status   := 'active'::public.user_status;
    v_approved_at      := now();
    v_target_tier      := 'lifetime'::public.subscription_tier;
    v_target_plan      := 'lifetime';
    v_sub_status       := 'active'::public.subscription_status;
    v_trial_ends_at    := null;
    v_trial_started_at := null;
  ELSE
    v_invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));

    IF v_invite_code <> '' THEN
      BEGIN
        SELECT * INTO v_invite
        FROM public.access_invites
        WHERE upper(code) = upper(v_invite_code)
          AND is_revoked = false
          AND (expires_at is null OR expires_at > now())
          AND used_count < max_uses
        FOR UPDATE;

        IF found THEN
          IF v_invite.target_email is null OR lower(v_invite.target_email) = lower(new.email) THEN
            v_has_invite := true;
            v_target_tier := v_invite.target_tier;
            v_target_plan := CASE
              WHEN v_target_tier = 'lifetime'::public.subscription_tier    THEN 'lifetime'
              WHEN v_target_tier = 'pro_annual'::public.subscription_tier  THEN 'pro_annual'
              WHEN v_target_tier = 'pro_monthly'::public.subscription_tier THEN 'pro_monthly'
              ELSE 'trial'
            END;

            IF v_target_tier = 'lifetime'::public.subscription_tier
               OR v_target_tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) THEN
              v_sub_status       := 'active'::public.subscription_status;
              v_trial_ends_at    := null;
              v_trial_started_at := null;
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

  -- 2. Cria assinatura com datas de início e trial preenchidas
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

  -- 3. Aplica overrides de módulos do convite se houver convite atribuído
  IF v_has_invite THEN
    IF v_invite.module_grants is not null AND v_invite.module_grants <> '{}'::jsonb THEN
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

  -- 4. Cria preferências de usuário
  BEGIN
    INSERT INTO public.user_preferences (user_id, app_mode, preferences)
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

  -- 5. Seed das categorias padrão
  BEGIN
    PERFORM public.seed_default_categories_for_user(new.id);
  EXCEPTION WHEN others THEN
    RAISE WARNING '[handle_new_user] Erro ao criar categorias padrao para %: %', new.id, sqlerrm;
  END;

  RETURN new;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. ALINHAMENTO DE GRACE PERIOD (3 DIAS) EM GET_USER_MODULE_ACCESS
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
  v_role public.user_role;
  v_status public.user_status;
  v_feature_globally_enabled boolean;
  v_default_enabled boolean;
  v_override public.access_level;
  v_sub record;
  v_is_core_module boolean;
BEGIN
  -- 1. Se a feature estiver desativada globalmente (Kill-Switch), o acesso é 'none'
  SELECT is_globally_enabled, coalesce(default_enabled_for_new_users, true)
  INTO v_feature_globally_enabled, v_default_enabled
  FROM public.system_features
  WHERE key = p_module_key;

  IF v_feature_globally_enabled IS FALSE THEN
    RETURN 'none'::public.access_level;
  END IF;

  -- 2. Consulta perfil e status da conta
  SELECT role, status INTO v_role, v_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_status IN ('suspended'::public.user_status, 'banned'::public.user_status, 'pending_approval'::public.user_status) THEN
    RETURN 'none'::public.access_level;
  END IF;

  -- Superadmin e admin têm permissão administrativa completa
  IF v_role IN ('superadmin'::public.user_role, 'admin'::public.user_role) THEN
    RETURN 'admin'::public.access_level;
  END IF;

  -- 3. Identifica se é módulo do core do plano base
  v_is_core_module := p_module_key in (
    'overview', 'transactions', 'cards', 'debts',
    'budgets', 'investments', 'reports', 'insights', 'reminders'
  );

  -- 4. Verifica se há override explícito na tabela user_module_permissions para este módulo específico
  SELECT access_level INTO v_override
  FROM public.user_module_permissions
  WHERE user_id = p_user_id
    AND module_key = p_module_key
    AND (expires_at is null OR expires_at > now());

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  -- 5. Se for funcionalidade beta (default_enabled_for_new_users = false ou beta específica) e não tem override:
  IF NOT v_is_core_module AND (v_default_enabled IS FALSE OR p_module_key = 'bank_notification_listener') THEN
    RETURN 'none'::public.access_level;
  END IF;

  -- 6. Módulos do Plano Base: Derivação dinâmica e responsiva do status e tier da assinatura
  SELECT tier, status, trial_ends_at, current_period_end INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Sem assinatura registrada -> opera no modo de somente-leitura básico
    RETURN 'read'::public.access_level;
  END IF;

  -- Assinatura ativa:
  -- Lifetime tem acesso de escrita perpétuo.
  -- Pro Mensal e Pro Anual exigem que o período vigente não tenha expirado (current_period_end > now()).
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

  -- Grace period de 3 dias para falhas temporárias de cartão na renovação (past_due)
  IF v_sub.status = 'past_due'::public.subscription_status AND
     v_sub.current_period_end IS NOT NULL AND
     v_sub.current_period_end + INTERVAL '3 days' > NOW() THEN
    RETURN 'write'::public.access_level;
  END IF;

  -- Trial ativo (status active ou trialing dentro do prazo) -> Acesso total de escrita
  IF v_sub.tier = 'trial'::public.subscription_tier AND (
       v_sub.status = 'active'::public.subscription_status OR
       (v_sub.status = 'trialing'::public.subscription_status AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at > NOW()))
     ) THEN
    RETURN 'write'::public.access_level;
  END IF;

  -- Assinatura inadimplente (após grace period), cancelada, read_only_expired ou trial vencido -> Somente-leitura responsivo
  RETURN 'read'::public.access_level;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. RESOLUÇÃO DE FEATURES BETA EM GET_MY_FEATURES
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_features()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT jsonb_object_agg(
    sf.key,
    CASE
      -- Se a feature estiver desativada globalmente (Kill-Switch), fica desativada para todos
      WHEN sf.is_globally_enabled = false THEN false
      -- Se houver override específico em user_feature_overrides, ele prevalece
      WHEN ufo.is_enabled IS NOT NULL THEN ufo.is_enabled
      -- Se o usuário tiver permissão explícita no módulo (user_module_permissions diferente de 'none'), habilita a feature
      WHEN EXISTS (
        SELECT 1 FROM public.user_module_permissions ump
        WHERE ump.user_id = v_uid
          AND ump.module_key = sf.key
          AND ump.access_level <> 'none'::public.access_level
          AND (ump.expires_at IS NULL OR ump.expires_at > NOW())
      ) THEN true
      -- Fallback para o padrão global da feature
      ELSE sf.default_enabled_for_new_users
    END
  ) INTO v_result
  FROM public.system_features sf
  LEFT JOIN public.user_feature_overrides ufo
    ON ufo.feature_key = sf.key AND ufo.user_id = v_uid;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. FECHAMENTO DE BRECHAS RLS EM TABELAS OPERACIONAIS
-- ----------------------------------------------------------------------------

-- 5.1 public.categories
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
CREATE POLICY "categories_insert"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "categories_update" ON public.categories;
CREATE POLICY "categories_update"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "categories_delete" ON public.categories;
CREATE POLICY "categories_delete"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

-- 5.2 public.asset_prices
DROP POLICY IF EXISTS "asset_prices_insert_own" ON public.asset_prices;
CREATE POLICY "asset_prices_insert_own"
  ON public.asset_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "asset_prices_update_own" ON public.asset_prices;
CREATE POLICY "asset_prices_update_own"
  ON public.asset_prices
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "asset_prices_delete_own" ON public.asset_prices;
CREATE POLICY "asset_prices_delete_own"
  ON public.asset_prices
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

-- 5.3 public.public_shares
DROP POLICY IF EXISTS "public_shares_insert" ON public.public_shares;
CREATE POLICY "public_shares_insert"
  ON public.public_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write())
  );

DROP POLICY IF EXISTS "public_shares_update" ON public.public_shares;
CREATE POLICY "public_shares_update"
  ON public.public_shares
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write())
  );

DROP POLICY IF EXISTS "public_shares_delete" ON public.public_shares;
CREATE POLICY "public_shares_delete"
  ON public.public_shares
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write())
  );

-- 5.4 public.family_invites & family_settlements
DROP POLICY IF EXISTS "family_invites_insert" ON public.family_invites;
CREATE POLICY "family_invites_insert"
  ON public.family_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
    AND (
      (SELECT auth.uid()) IS NOT NULL
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "family_invites_update" ON public.family_invites;
CREATE POLICY "family_invites_update"
  ON public.family_invites
  FOR UPDATE
  TO authenticated
  USING (
    (
      invited_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
      OR (status = 'pending' AND expires_at > now() AND (SELECT auth.uid()) IS NOT NULL)
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      invited_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
      OR (status IN ('accepted', 'pending') AND (SELECT auth.uid()) IS NOT NULL)
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "family_invites_delete" ON public.family_invites;
CREATE POLICY "family_invites_delete"
  ON public.family_invites
  FOR DELETE
  TO authenticated
  USING (
    (
      invited_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "family_settlements_insert" ON public.family_settlements;
CREATE POLICY "family_settlements_insert"
  ON public.family_settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.is_family_member(family_id, (SELECT auth.uid()))
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "family_settlements_update" ON public.family_settlements;
CREATE POLICY "family_settlements_update"
  ON public.family_settlements
  FOR UPDATE
  TO authenticated
  USING (
    (
      created_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      created_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "family_settlements_delete" ON public.family_settlements;
CREATE POLICY "family_settlements_delete"
  ON public.family_settlements
  FOR DELETE
  TO authenticated
  USING (
    (
      created_by = (SELECT auth.uid())
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

-- 5.5 public.trips e tabelas vinculadas
DROP POLICY IF EXISTS "trips_insert_policy" ON public.trips;
CREATE POLICY "trips_insert_policy" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (
    host_user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trips_update_policy" ON public.trips;
CREATE POLICY "trips_update_policy" ON public.trips
  FOR UPDATE TO authenticated
  USING (
    host_user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    host_user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trips_delete_policy" ON public.trips;
CREATE POLICY "trips_delete_policy" ON public.trips
  FOR DELETE TO authenticated
  USING (
    host_user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_members_write_policy" ON public.trip_members;
CREATE POLICY "trip_members_write_policy" ON public.trip_members
  FOR ALL TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_expenses_write_policy" ON public.trip_expenses;
DROP POLICY IF EXISTS "trip_expenses_insert_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_insert_policy" ON public.trip_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR public.is_trip_member(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_expenses_update_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_update_policy" ON public.trip_expenses
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR (SELECT auth.uid()) IN (
        SELECT tm.user_id FROM public.trip_members tm 
        WHERE tm.id IN (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
      )
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR (SELECT auth.uid()) IN (
        SELECT tm.user_id FROM public.trip_members tm 
        WHERE tm.id IN (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
      )
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_expenses_delete_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_delete_policy" ON public.trip_expenses
  FOR DELETE TO authenticated
  USING (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR (SELECT auth.uid()) IN (
        SELECT tm.user_id FROM public.trip_members tm 
        WHERE tm.id IN (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
      )
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_settlements_write_policy" ON public.trip_settlements;
CREATE POLICY "trip_settlements_write_policy" ON public.trip_settlements
  FOR ALL TO authenticated
  USING (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR public.is_trip_member(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR public.is_trip_member(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );


-- ----------------------------------------------------------------------------
-- 6. GUARDAS DEFENSIVAS EM RPCS SECURITY DEFINER DE MUTAÇÃO
-- ----------------------------------------------------------------------------

-- 6.1 public.materialize_recurrences
CREATE OR REPLACE FUNCTION public.materialize_recurrences(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_expense_count integer := 0;
  v_income_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  -- 1) Inserção em lote de ocorrências de DESPESAS (set-based)
  WITH incoming AS (
    SELECT
      (item->>'recurrence_id')::uuid AS recurrence_id,
      (item->>'date')::date AS occurrence_date,
      (item->>'occurrence_number')::integer AS occurrence_number,
      (item->>'value')::numeric AS occurrence_value,
      nullif(item->>'bill_competence', '') AS bill_competence
    FROM jsonb_array_elements(p_items) AS item
  ),
  valid_expenses AS (
    SELECT
      v_user_id AS user_id,
      r.id AS recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date AS date,
      r.category_id,
      r.payment_method,
      r.card_id,
      1 AS installments_total,
      1 AS installment_number,
      null::uuid AS installment_group_id,
      i.bill_competence,
      r.report_weight,
      r.value AS base_amount,
      r.description,
      coalesce(r.is_family, false) AS is_family
    FROM incoming i
    JOIN public.recurrences r
      ON r.id = i.recurrence_id
     AND r.user_id = v_user_id
     AND r.is_active = true
     AND r.kind = 'expense'
    WHERE i.occurrence_date >= date '2026-01-01'
      AND i.occurrence_number >= 1
      AND (r.end_date IS NULL OR i.occurrence_date <= r.end_date)
      AND (r.occurrences_total IS NULL OR i.occurrence_number <= r.occurrences_total)
      AND NOT EXISTS (
        SELECT 1 FROM public.recurrence_skips s
        WHERE s.recurrence_id = r.id AND s.occurrence_date = i.occurrence_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.recurrence_id = r.id AND e.date = i.occurrence_date
      )
  ),
  inserted_expenses AS (
    INSERT INTO public.expenses (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family
    )
    SELECT
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family
    FROM valid_expenses
    RETURNING 1
  )
  SELECT count(*) INTO v_expense_count FROM inserted_expenses;

  -- 2) Inserção em lote de ocorrências de RENDAS (set-based)
  WITH incoming AS (
    SELECT
      (item->>'recurrence_id')::uuid AS recurrence_id,
      (item->>'date')::date AS occurrence_date,
      (item->>'occurrence_number')::integer AS occurrence_number,
      (item->>'value')::numeric AS occurrence_value
    FROM jsonb_array_elements(p_items) AS item
  ),
  valid_incomes AS (
    SELECT
      v_user_id AS user_id,
      r.id AS recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date AS date,
      r.category_id,
      r.receive_type,
      r.description,
      coalesce(r.is_family, false) AS is_family
    FROM incoming i
    JOIN public.recurrences r
      ON r.id = i.recurrence_id
     AND r.user_id = v_user_id
     AND r.is_active = true
     AND r.kind = 'income'
    WHERE i.occurrence_date >= date '2026-01-01'
      AND i.occurrence_number >= 1
      AND (r.end_date IS NULL OR i.occurrence_date <= r.end_date)
      AND (r.occurrences_total IS NULL OR i.occurrence_number <= r.occurrences_total)
      AND NOT EXISTS (
        SELECT 1 FROM public.recurrence_skips s
        WHERE s.recurrence_id = r.id AND s.occurrence_date = i.occurrence_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.incomes inc
        WHERE inc.recurrence_id = r.id AND inc.date = i.occurrence_date
      )
  ),
  inserted_incomes AS (
    INSERT INTO public.incomes (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description, is_family
    )
    SELECT
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description, is_family
    FROM valid_incomes
    RETURNING 1
  )
  SELECT count(*) INTO v_income_count FROM inserted_incomes;

  RETURN v_expense_count + v_income_count;
END;
$$;

-- 6.2 public.allocate_goal_deposit
CREATE OR REPLACE FUNCTION public.allocate_goal_deposit(
  p_share_id uuid,
  p_amount_cents bigint,
  p_contributor_name text DEFAULT 'Você',
  p_source_account_id uuid DEFAULT null,
  p_notes text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_share record;
  v_current_cents bigint;
  v_target_cents bigint;
  v_new_current_cents bigint;
  v_contributions jsonb;
  v_new_contribution jsonb;
  v_today text;
  v_updated_payload jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('budgets') AND NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Metas e Orçamentos requerida.' USING ERRCODE = '42501';
  END IF;

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Valor do aporte deve ser maior que zero.' USING ERRCODE = '22003';
  END IF;

  SELECT *
  INTO v_share
  FROM public.public_shares
  WHERE id = p_share_id
    AND user_id = v_uid
    AND kind = 'goal_tracker'
  FOR UPDATE;

  IF v_share IS NULL THEN
    RAISE EXCEPTION 'Meta nao encontrada ou acesso nao autorizado.' USING ERRCODE = 'P0002';
  END IF;

  v_today := to_char(current_date, 'YYYY-MM-DD');
  v_current_cents := coalesce((v_share.payload->>'current_cents')::bigint, 0);
  v_target_cents := coalesce((v_share.payload->>'target_cents')::bigint, 0);
  v_new_current_cents := v_current_cents + p_amount_cents;

  v_contributions := coalesce(v_share.payload->'contributions', '[]'::jsonb);
  v_new_contribution := jsonb_build_object(
    'id', gen_random_uuid(),
    'amount_cents', p_amount_cents,
    'contributor_name', coalesce(nullif(trim(p_contributor_name), ''), 'Você'),
    'date', v_today,
    'created_at', now()
  );

  v_contributions := v_contributions || jsonb_build_array(v_new_contribution);

  v_updated_payload := v_share.payload || jsonb_build_object(
    'current_cents', v_new_current_cents,
    'contributions', v_contributions
  );

  IF v_target_cents > 0 AND v_new_current_cents >= v_target_cents THEN
    v_updated_payload := v_updated_payload || jsonb_build_object('status', 'completed');
  END IF;

  UPDATE public.public_shares
  SET payload = v_updated_payload,
      updated_at = now()
  WHERE id = p_share_id;

  RETURN jsonb_build_object(
    'success', true,
    'share_id', p_share_id,
    'new_current_cents', v_new_current_cents,
    'target_cents', v_target_cents,
    'is_completed', (v_target_cents > 0 AND v_new_current_cents >= v_target_cents)
  );
END;
$$;

-- 6.3 public.create_family
CREATE OR REPLACE FUNCTION public.create_family(
  p_name text,
  p_monthly_budget numeric DEFAULT null,
  p_split_rule text DEFAULT 'equal',
  p_display_name text DEFAULT null,
  p_pix_key text DEFAULT null,
  p_pix_key_type text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_clean_name text;
  v_clean_display_name text;
  v_clean_pix_key text;
BEGIN
  -- 1. Autenticação fail-closed
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  -- 2. Invariante: participante único em família ativa
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família ativa.' USING ERRCODE = '23505';
  END IF;

  -- 3. Sanitização e validação do nome da família
  v_clean_name := trim(coalesce(p_name, ''));
  IF length(v_clean_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Nome da família deve conter entre 1 e 100 caracteres.' USING ERRCODE = '22023';
  END IF;

  -- 4. Validação de teto orçamentário
  IF p_monthly_budget IS NOT NULL AND p_monthly_budget < 0 THEN
    RAISE EXCEPTION 'Teto orçamentário não pode ser negativo.' USING ERRCODE = '22023';
  END IF;

  -- 5. Validação da regra de divisão
  IF p_split_rule NOT IN ('equal', 'proportional') THEN
    RAISE EXCEPTION 'Regra de divisão inválida (esperado: equal ou proportional).' USING ERRCODE = '22023';
  END IF;

  -- 6. Validação de chave Pix se informada
  IF p_pix_key_type IS NOT NULL AND p_pix_key_type NOT IN ('cpf', 'email', 'phone', 'random') THEN
    RAISE EXCEPTION 'Tipo de chave Pix inválido.' USING ERRCODE = '22023';
  END IF;

  v_clean_pix_key := nullif(trim(coalesce(p_pix_key, '')), '');

  -- 7. Resolver nome de exibição do proprietário
  v_clean_display_name := trim(coalesce(p_display_name, ''));
  IF v_clean_display_name = '' THEN
    SELECT coalesce(name, 'Titular') INTO v_clean_display_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- 8. Inserir registro na tabela families
  INSERT INTO public.families (
    name,
    owner_id,
    monthly_budget,
    split_rule
  ) VALUES (
    v_clean_name,
    v_user_id,
    p_monthly_budget,
    p_split_rule
  ) RETURNING id INTO v_family_id;

  -- 9. Inserir atomicamente o membro proprietário
  INSERT INTO public.family_members (
    family_id,
    user_id,
    role,
    display_name,
    pix_key,
    pix_key_type,
    split_ratio
  ) VALUES (
    v_family_id,
    v_user_id,
    'owner',
    nullif(v_clean_display_name, ''),
    v_clean_pix_key,
    p_pix_key_type,
    0.5000
  );

  RETURN v_family_id;
END;
$$;

-- 6.4 public.invite_family_member
CREATE OR REPLACE FUNCTION public.invite_family_member(
  p_family_id uuid DEFAULT null,
  p_invited_email text DEFAULT null,
  p_role text DEFAULT 'member',
  p_token text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_email text;
  v_role text := coalesce(p_role, 'member');
  v_token text;
  v_invite record;
  v_active_members_count int;
  v_pending_invites_count int;
BEGIN
  -- 1. Autenticação fail-closed
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  -- 2. Resolver family_id
  IF p_family_id IS NOT NULL THEN
    v_family_id := p_family_id;
  ELSE
    SELECT fm.family_id INTO v_family_id
    FROM public.family_members fm
    WHERE fm.user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Família não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Autorização: apenas owner ou admin podem gerar convites
  IF NOT public.is_family_admin(v_family_id, v_user_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem convidar membros para a família.' USING ERRCODE = '42501';
  END IF;

  -- 4. Invariante: Limite máximo de 6 participantes na família (membros ativos + convites pendentes válidos)
  SELECT count(*) INTO v_active_members_count
  FROM public.family_members
  WHERE family_id = v_family_id;

  SELECT count(*) INTO v_pending_invites_count
  FROM public.family_invites
  WHERE family_id = v_family_id AND status = 'pending' AND expires_at > now();

  IF (v_active_members_count + v_pending_invites_count) >= 6 THEN
    RAISE EXCEPTION 'A família já atingiu o limite máximo de 6 participantes.' USING ERRCODE = '22023';
  END IF;

  -- 5. Validação de papel
  IF v_role NOT IN ('member', 'admin') THEN
    RAISE EXCEPTION 'Papel de convite inválido (permitido apenas member ou admin).' USING ERRCODE = '22023';
  END IF;

  -- 6. Validação de e-mail se fornecido
  IF p_invited_email IS NOT NULL AND trim(p_invited_email) != '' THEN
    v_email := lower(trim(p_invited_email));
    IF length(v_email) NOT BETWEEN 3 AND 255 OR v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Formato de e-mail inválido.' USING ERRCODE = '22023';
    END IF;

    -- Verificar se usuário já é membro desta família
    IF EXISTS (
      SELECT 1
      FROM public.family_members fm
      JOIN public.profiles p ON p.id = fm.user_id
      WHERE fm.family_id = v_family_id
        AND lower(p.email) = v_email
    ) THEN
      RAISE EXCEPTION 'Este usuário já é membro da família.' USING ERRCODE = '23505';
    END IF;

    -- Revogar convites pendentes anteriores para o mesmo e-mail nesta família
    UPDATE public.family_invites
    SET status = 'revoked'
    WHERE family_id = v_family_id
      AND lower(invited_email) = v_email
      AND status = 'pending';
  ELSE
    v_email := null;
  END IF;

  -- 7. Geração de token à prova de falha
  IF p_token IS NOT NULL AND trim(p_token) != '' THEN
    v_token := trim(p_token);
    IF length(v_token) NOT BETWEEN 6 AND 64 OR v_token !~ '^[a-zA-Z0-9_-]+$' THEN
      RAISE EXCEPTION 'Formato de token de convite inválido.' USING ERRCODE = '22023';
    END IF;
  ELSE
    BEGIN
      v_token := encode(extensions.gen_random_bytes(24), 'hex');
    EXCEPTION WHEN others THEN
      v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_token := substr(v_token, 1, 48);
    END;
  END IF;

  -- 8. Inserir convite ativo
  INSERT INTO public.family_invites (
    family_id,
    invited_by,
    invited_email,
    token,
    role,
    status,
    expires_at
  ) VALUES (
    v_family_id,
    v_user_id,
    v_email,
    v_token,
    v_role,
    'pending',
    now() + interval '7 days'
  ) RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'family_id', v_invite.family_id,
    'token', v_invite.token,
    'role', v_invite.role,
    'invited_email', v_invite.invited_email,
    'status', v_invite.status,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at
  );
END;
$$;

-- 6.5 public.record_family_settlement
CREATE OR REPLACE FUNCTION public.record_family_settlement(
  p_month text,
  p_payer_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_family_id uuid DEFAULT null,
  p_payment_method text DEFAULT 'pix',
  p_notes text DEFAULT null,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_settlement_id uuid;
  v_clean_month text;
  v_clean_method text := coalesce(p_payment_method, 'pix');
BEGIN
  -- 1. Autenticação fail-closed
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  -- 2. Resolver family_id
  IF p_family_id IS NOT NULL THEN
    v_family_id := p_family_id;
  ELSE
    SELECT fm.family_id INTO v_family_id
    FROM public.family_members fm
    WHERE fm.user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Família não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validação de membresia do autor
  IF NOT public.is_family_member(v_family_id, v_user_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não pertence à família especificada.' USING ERRCODE = '42501';
  END IF;

  -- 4. Validação da competência (mês YYYY-MM)
  v_clean_month := trim(coalesce(p_month, ''));
  IF v_clean_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida (formato esperado: YYYY-MM).' USING ERRCODE = '22023';
  END IF;

  -- 5. Validação de valor do acerto
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do acerto deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;

  -- 6. Validação de pagador e recebedor
  IF p_payer_id = p_receiver_id THEN
    RAISE EXCEPTION 'Pagador e recebedor devem ser membros diferentes.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_family_member(v_family_id, p_payer_id) THEN
    RAISE EXCEPTION 'Pagador não é membro da família.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_family_member(v_family_id, p_receiver_id) THEN
    RAISE EXCEPTION 'Recebedor não é membro da família.' USING ERRCODE = '22023';
  END IF;

  -- 7. Autorização: quem pode registrar? Payer, Receiver ou Admin da família
  IF v_user_id != p_payer_id AND v_user_id != p_receiver_id AND NOT public.is_family_admin(v_family_id, v_user_id) THEN
    RAISE EXCEPTION 'Apenas o pagador, recebedor ou administrador podem registrar este acerto.' USING ERRCODE = '42501';
  END IF;

  -- 8. Validação de método de pagamento
  IF v_clean_method NOT IN ('pix', 'transfer', 'cash', 'other') THEN
    RAISE EXCEPTION 'Método de pagamento inválido.' USING ERRCODE = '22023';
  END IF;

  -- 9. Inserção do acerto auditável na tabela family_settlements
  INSERT INTO public.family_settlements (
    family_id,
    month,
    payer_id,
    receiver_id,
    amount,
    settled_at,
    payment_method,
    notes,
    snapshot,
    created_by
  ) VALUES (
    v_family_id,
    v_clean_month,
    p_payer_id,
    p_receiver_id,
    p_amount,
    now(),
    v_clean_method,
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_snapshot, '{}'::jsonb),
    v_user_id
  ) RETURNING id INTO v_settlement_id;

  RETURN v_settlement_id;
END;
$$;

-- 6.6 public.create_trip
CREATE OR REPLACE FUNCTION public.create_trip(
  p_title text,
  p_destination text DEFAULT null,
  p_start_date date DEFAULT current_date,
  p_end_date date DEFAULT current_date,
  p_currency text DEFAULT 'BRL',
  p_cover_photo_url text DEFAULT null,
  p_initial_members jsonb DEFAULT '[]'::jsonb,
  p_host_name text DEFAULT null
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_trip public.trips;
  v_token text;
  v_member record;
  v_host_name text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'O título da viagem é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'A data de término não pode ser anterior à data de início.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
  EXCEPTION WHEN others THEN
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_token := substr(v_token, 1, 48);
  END;

  -- Resolve o nome do anfitrião
  IF p_host_name IS NOT NULL AND trim(p_host_name) <> '' THEN
    v_host_name := trim(p_host_name);
  ELSE
    SELECT nullif(trim(name), '') INTO v_host_name
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_host_name IS NULL THEN
      v_host_name := 'Organizador';
    END IF;
  END IF;

  INSERT INTO public.trips (
    host_user_id,
    title,
    destination,
    start_date,
    end_date,
    currency,
    cover_photo_url,
    public_token
  ) VALUES (
    v_caller_id,
    trim(p_title),
    nullif(trim(p_destination), ''),
    p_start_date,
    p_end_date,
    coalesce(nullif(trim(p_currency), ''), 'BRL'),
    nullif(trim(p_cover_photo_url), ''),
    v_token
  ) RETURNING * INTO v_trip;

  -- Insere o host com seu nome real
  INSERT INTO public.trip_members (
    trip_id,
    name,
    user_id,
    is_host
  ) VALUES (
    v_trip.id,
    v_host_name,
    v_caller_id,
    true
  );

  -- Insere membros adicionais se informados
  IF p_initial_members IS NOT NULL AND jsonb_array_length(p_initial_members) > 0 THEN
    FOR v_member IN SELECT * FROM jsonb_to_recordset(p_initial_members) AS x(
      name text,
      pix_key text,
      pix_key_type text
    )
    LOOP
      IF v_member.name IS NOT NULL AND trim(v_member.name) <> '' AND trim(v_member.name) <> v_host_name AND trim(v_member.name) <> 'Você' THEN
        INSERT INTO public.trip_members (
          trip_id,
          name,
          pix_key,
          pix_key_type,
          is_host
        ) VALUES (
          v_trip.id,
          trim(v_member.name),
          nullif(trim(v_member.pix_key), ''),
          nullif(trim(v_member.pix_key_type), ''),
          false
        ) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_trip;
END;
$$;

-- 6.7 public.delete_trip_expense_sync
CREATE OR REPLACE FUNCTION public.delete_trip_expense_sync(
  p_expense_id uuid,
  p_delete_personal boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_personal_id uuid;
  v_payer_user_id uuid;
  v_creator_user_id uuid;
  v_is_host boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  -- Busca despesa
  SELECT 
    te.trip_id, 
    te.linked_personal_expense_id,
    tm_payer.user_id,
    tm_creator.user_id
  INTO v_trip_id, v_personal_id, v_payer_user_id, v_creator_user_id
  FROM public.trip_expenses te
  LEFT JOIN public.trip_members tm_payer ON tm_payer.id = te.paid_by_member_id
  LEFT JOIN public.trip_members tm_creator ON tm_creator.id = te.created_by_member_id
  WHERE te.id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Despesa de viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_is_host := public.is_trip_host(v_trip_id, v_user_id);

  IF NOT v_is_host 
     AND (v_payer_user_id IS NULL OR v_payer_user_id <> v_user_id)
     AND (v_creator_user_id IS NULL OR v_creator_user_id <> v_user_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Sem permissão para excluir esta despesa.' USING ERRCODE = '42501';
  END IF;

  -- 1. Exclui a despesa pessoal se solicitado e se pertencer ao usuário
  IF p_delete_personal AND v_personal_id IS NOT NULL THEN
    DELETE FROM public.expenses
    WHERE id = v_personal_id AND user_id = v_user_id;
  ELSIF v_personal_id IS NOT NULL THEN
    -- Se não excluiu a despesa pessoal, desvincula o trip_id
    UPDATE public.expenses
    SET trip_id = null
    WHERE id = v_personal_id;
  END IF;

  -- 2. Exclui da viagem (cascata remove splits)
  DELETE FROM public.trip_expenses
  WHERE id = p_expense_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_trip_expense_id', p_expense_id,
    'deleted_personal_expense', p_delete_personal AND v_personal_id IS NOT NULL
  );
END;
$$;

-- 6.8 public.record_trip_settlements
CREATE OR REPLACE FUNCTION public.record_trip_settlements(
  p_trip_id uuid,
  p_settlements jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_trip record;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE id = p_trip_id;

  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'Viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.host_user_id <> v_caller_id AND NOT EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = v_trip.id AND tm.user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Permissão negada para liquidar esta viagem.' USING ERRCODE = '42501';
  END IF;

  -- Limpar pendências anteriores se re-calculando
  DELETE FROM public.trip_settlements
  WHERE trip_id = p_trip_id AND status = 'pending';

  -- Gravar novos settlements
  INSERT INTO public.trip_settlements (
    trip_id,
    from_member_id,
    to_member_id,
    amount_cents,
    status
  )
  SELECT
    p_trip_id,
    x.from_member_id,
    x.to_member_id,
    x.amount_cents,
    'pending'
  FROM jsonb_to_recordset(p_settlements) AS x(from_member_id uuid, to_member_id uuid, amount_cents int);

  -- Atualizar status da viagem para 'settling'
  UPDATE public.trips
  SET status = 'settling', updated_at = timezone('utc'::text, now())
  WHERE id = p_trip_id AND status IN ('planning', 'active');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6.9 public.unlink_trip_member
CREATE OR REPLACE FUNCTION public.unlink_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_host boolean;
  v_target_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  -- Verifica se é o host ou o próprio membro
  v_is_host := public.is_trip_host(p_trip_id, v_user_id);
  
  SELECT user_id INTO v_target_user_id
  FROM public.trip_members
  WHERE id = p_member_id AND trip_id = p_trip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Membro não encontrado na viagem.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_host AND (v_target_user_id IS NULL OR v_target_user_id <> v_user_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Apenas o anfitrião ou o próprio usuário podem desvincular a conta.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.trip_members
  SET user_id = null
  WHERE id = p_member_id;

  RETURN jsonb_build_object('success', true, 'member_id', p_member_id);
END;
$$;

-- Concessão explícita de execução para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.materialize_recurrences(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_goal_deposit(uuid, bigint, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_family(text, numeric, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invite_family_member(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_family_settlement(text, uuid, uuid, numeric, uuid, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_trip(text, text, date, date, text, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_trip_expense_sync(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_trip_settlements(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_trip_member(uuid, uuid) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. HARDENING RBAC E PROTEÇÃO DE DATAS EM RPCS ADMINISTRATIVAS
-- ----------------------------------------------------------------------------

-- 7.1 public.admin_toggle_global_feature (Restrito exclusivamente a Superadmin)
CREATE OR REPLACE FUNCTION public.admin_toggle_global_feature(
  p_feature_key text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadministradores podem alternar Kill-Switches globais.';
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
    jsonb_build_object('is_globally_enabled', p_enabled)
  );
END;
$$;

-- 7.2 public.admin_set_user_subscription (Defaults de datas + Bloqueio hierárquico)
CREATE OR REPLACE FUNCTION public.admin_set_user_subscription(
  p_user_id uuid,
  p_plan_id text,
  p_tier public.subscription_tier,
  p_status public.subscription_status,
  p_trial_ends_at timestamptz DEFAULT null,
  p_current_period_end timestamptz DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_role public.user_role;
  v_existing_trial_ends_at timestamptz;
  v_existing_current_period_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um superadministrador pode alterar contas superadmin.';
  END IF;

  SELECT trial_ends_at, current_period_end 
  INTO v_existing_trial_ends_at, v_existing_current_period_end
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  -- Defaults defensivos de datas se omitidas
  IF p_tier = 'trial'::public.subscription_tier AND p_trial_ends_at IS NULL THEN
    p_trial_ends_at := coalesce(v_existing_trial_ends_at, now() + interval '30 days');
  END IF;

  IF p_tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) AND p_current_period_end IS NULL THEN
    p_current_period_end := coalesce(
      v_existing_current_period_end,
      CASE WHEN p_tier = 'pro_annual'::public.subscription_tier THEN now() + interval '1 year' ELSE now() + interval '1 month' END
    );
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    tier,
    status,
    trial_ends_at,
    current_period_end,
    updated_at
  )
  VALUES (
    p_user_id,
    p_plan_id,
    p_tier,
    p_status,
    p_trial_ends_at,
    p_current_period_end,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id = excluded.plan_id,
      tier = excluded.tier,
      status = excluded.status,
      trial_ends_at = excluded.trial_ends_at,
      current_period_end = excluded.current_period_end,
      updated_at = now();

  -- Higienização automática de overrides de módulos core para responder de forma limpa ao plano
  DELETE FROM public.user_module_permissions
  WHERE user_id = p_user_id
    AND module_key IN (
      'overview', 'transactions', 'cards', 'debts',
      'budgets', 'investments', 'reports', 'insights', 'reminders'
    );

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'user_subscriptions',
    p_user_id::text,
    'SET_USER_SUBSCRIPTION',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'tier', p_tier,
      'status', p_status,
      'trial_ends_at', p_trial_ends_at,
      'current_period_end', p_current_period_end
    )
  );
END;
$$;

-- 7.3 public.admin_set_user_module_permission (Bloqueio hierárquico)
CREATE OR REPLACE FUNCTION public.admin_set_user_module_permission(
  p_user_id uuid,
  p_module_key text,
  p_access_level public.access_level,
  p_expires_at timestamptz DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_role public.user_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um superadministrador pode alterar contas superadmin.';
  END IF;

  INSERT INTO public.user_module_permissions (
    user_id,
    module_key,
    access_level,
    granted_by,
    expires_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_module_key,
    p_access_level,
    v_admin_id,
    p_expires_at,
    now()
  )
  ON CONFLICT (user_id, module_key) DO UPDATE
  SET access_level = excluded.access_level,
      granted_by = v_admin_id,
      expires_at = excluded.expires_at,
      updated_at = now();

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'user_module_permissions',
    p_user_id::text || ':' || p_module_key,
    'SET_MODULE_PERMISSION',
    jsonb_build_object(
      'access_level', p_access_level,
      'expires_at', p_expires_at
    )
  );
END;
$$;

-- 7.4 public.admin_remove_user_module_permission (Bloqueio hierárquico)
CREATE OR REPLACE FUNCTION public.admin_remove_user_module_permission(
  p_user_id uuid,
  p_module_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_role public.user_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.';
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um superadministrador pode alterar contas superadmin.';
  END IF;

  DELETE FROM public.user_module_permissions
  WHERE user_id = p_user_id AND module_key = p_module_key;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'user_module_permissions',
    p_user_id::text || ':' || p_module_key,
    'REMOVE_MODULE_PERMISSION',
    '{}'::jsonb
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. CORREÇÃO DE RECONCILE_EXPIRED_SUBSCRIPTIONS (read_only_expired)
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
BEGIN
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

  -- 2) Expira trials vencidos que não possuem plano futuro agendado
  -- Corrigido de 'expired'::subscription_status para 'read_only_expired'::subscription_status
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

  -- 3) Expira assinaturas past_due cujo grace period de 3 dias já se encerrou
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

  -- 4) Marca billing_intents pendentes há mais de 24 horas como expiradas
  UPDATE public.billing_intents
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND created_at < (now() - INTERVAL '24 hours');

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_global_feature(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(uuid, text, public.subscription_tier, public.subscription_status, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_module_permission(uuid, text, public.access_level, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_module_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. AGENDAMENTO DEFENSIVO NO PG_CRON (SE DISPONÍVEL NO PROVEDOR)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('reconcile-subscriptions-hourly');
    EXCEPTION WHEN OTHERS THEN
      -- ignora se não existia o job anterior
      NULL;
    END;
    PERFORM cron.schedule('reconcile-subscriptions-hourly', '0 * * * *', 'SELECT public.reconcile_expired_subscriptions();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$$;
