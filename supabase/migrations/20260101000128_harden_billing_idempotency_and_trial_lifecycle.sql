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
CREATE POLICY "trip_expenses_write_policy" ON public.trip_expenses
  FOR ALL TO authenticated
  USING (
    (
      payer_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR public.is_trip_member(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      payer_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
      OR public.is_trip_member(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "trip_settlements_write_policy" ON public.trip_settlements;
CREATE POLICY "trip_settlements_write_policy" ON public.trip_settlements
  FOR ALL TO authenticated
  USING (
    (
      payer_member_id = (SELECT auth.uid())
      OR receiver_member_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      payer_member_id = (SELECT auth.uid())
      OR receiver_member_id = (SELECT auth.uid())
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
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
      r.id AS recurrence_id,
      r.user_id,
      r.category_id,
      r.account_id,
      r.card_id,
      r.description,
      inc.occurrence_value AS amount,
      inc.occurrence_date AS date,
      inc.occurrence_number,
      inc.bill_competence,
      r.tags,
      r.observation,
      r.is_family,
      r.family_id
    FROM incoming inc
    JOIN public.recurrences r ON r.id = inc.recurrence_id
    WHERE r.user_id = v_user_id
      AND r.type = 'expense'
      AND NOT EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.recurrence_id = r.id
          AND e.recurrence_number = inc.occurrence_number
      )
  ),
  inserted_expenses AS (
    INSERT INTO public.expenses (
      user_id, category_id, account_id, card_id, description,
      amount, date, recurrence_id, recurrence_number,
      bill_competence, tags, observation, is_family, family_id
    )
    SELECT
      user_id, category_id, account_id, card_id, description,
      amount, date, recurrence_id, occurrence_number,
      bill_competence, tags, observation, is_family, family_id
    FROM valid_expenses
    RETURNING id
  )
  SELECT count(*) INTO v_expense_count FROM inserted_expenses;

  -- 2) Inserção em lote de ocorrências de RECEITAS (set-based)
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
      r.id AS recurrence_id,
      r.user_id,
      r.category_id,
      r.account_id,
      r.description,
      inc.occurrence_value AS amount,
      inc.occurrence_date AS date,
      inc.occurrence_number,
      r.tags,
      r.observation,
      r.is_family,
      r.family_id
    FROM incoming inc
    JOIN public.recurrences r ON r.id = inc.recurrence_id
    WHERE r.user_id = v_user_id
      AND r.type = 'income'
      AND NOT EXISTS (
        SELECT 1 FROM public.incomes i
        WHERE i.recurrence_id = r.id
          AND i.recurrence_number = inc.occurrence_number
      )
  ),
  inserted_incomes AS (
    INSERT INTO public.incomes (
      user_id, category_id, account_id, description,
      amount, date, recurrence_id, recurrence_number,
      tags, observation, is_family, family_id
    )
    SELECT
      user_id, category_id, account_id, description,
      amount, date, recurrence_id, occurrence_number,
      tags, observation, is_family, family_id
    FROM valid_incomes
    RETURNING id
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
    RAISE EXCEPTION 'Usuario nao autenticado.' USING ERRCODE = '28000';
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta compartilhada nao encontrada ou nao pertence ao usuario.' USING ERRCODE = 'P0002';
  END IF;

  IF v_share.is_revoked THEN
    RAISE EXCEPTION 'Esta meta esta arquivada ou revogada.' USING ERRCODE = '22023';
  END IF;

  v_current_cents := coalesce((v_share.payload->>'current_amount_cents')::bigint, 0);
  v_target_cents := coalesce((v_share.payload->>'target_amount_cents')::bigint, 0);
  v_new_current_cents := v_current_cents + p_amount_cents;
  v_contributions := coalesce(v_share.payload->'contributions', '[]'::jsonb);
  v_today := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  v_new_contribution := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'contributor_name', coalesce(nullif(trim(p_contributor_name), ''), 'Você'),
    'amount_cents', p_amount_cents,
    'source_account_id', p_source_account_id,
    'notes', p_notes,
    'created_at', v_today
  );

  v_contributions := v_contributions || jsonb_build_array(v_new_contribution);

  v_updated_payload := v_share.payload || jsonb_build_object(
    'current_amount_cents', v_new_current_cents,
    'contributions', v_contributions,
    'last_deposit_at', v_today
  );

  UPDATE public.public_shares
  SET payload = v_updated_payload,
      updated_at = now()
  WHERE id = p_share_id;

  INSERT INTO public.audit_events (
    user_id, entity_type, entity_id, action, payload
  )
  VALUES (
    v_uid,
    'public_shares',
    p_share_id::text,
    'ALLOCATE_GOAL_DEPOSIT',
    jsonb_build_object(
      'amount_cents', p_amount_cents,
      'previous_cents', v_current_cents,
      'new_cents', v_new_current_cents,
      'target_cents', v_target_cents,
      'contributor_name', p_contributor_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'share_id', p_share_id,
    'new_current_amount_cents', v_new_current_cents,
    'target_amount_cents', v_target_cents,
    'contribution', v_new_contribution
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família ativa.' USING ERRCODE = '23505';
  END IF;

  v_clean_name := trim(coalesce(p_name, ''));
  IF length(v_clean_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'O nome da família deve ter entre 1 e 100 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF p_monthly_budget IS NOT NULL AND p_monthly_budget < 0 THEN
    RAISE EXCEPTION 'O orçamento mensal não pode ser negativo.' USING ERRCODE = '22003';
  END IF;

  IF p_split_rule NOT IN ('equal', 'income_proportional', 'custom') THEN
    RAISE EXCEPTION 'Regra de divisão inválida.' USING ERRCODE = '22023';
  END IF;

  v_clean_display_name := nullif(trim(coalesce(p_display_name, '')), '');
  v_clean_pix_key      := nullif(trim(coalesce(p_pix_key, '')), '');

  INSERT INTO public.families (name, owner_id, monthly_budget, split_rule)
  VALUES (v_clean_name, v_user_id, p_monthly_budget, p_split_rule)
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (
    family_id, user_id, role, display_name,
    pix_key, pix_key_type, color_avatar, joined_at
  )
  VALUES (
    v_family_id,
    v_user_id,
    'owner',
    coalesce(v_clean_display_name, (SELECT name FROM public.profiles WHERE id = v_user_id), 'Proprietário'),
    v_clean_pix_key,
    p_pix_key_type,
    '#2563EB',
    now()
  );

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'families',
    v_family_id::text,
    'CREATE_FAMILY',
    jsonb_build_object(
      'name', v_clean_name,
      'split_rule', p_split_rule,
      'monthly_budget', p_monthly_budget
    )
  );

  RETURN v_family_id;
END;
$$;

-- 6.4 public.invite_family_member
CREATE OR REPLACE FUNCTION public.invite_family_member(
  p_family_id uuid,
  p_invited_email text,
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_email text;
  v_target_user_id uuid;
  v_invite_code text;
  v_expires_at timestamptz;
  v_existing_member_count int;
  v_invite_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_family_admin(p_family_id, v_user_id) THEN
    RAISE EXCEPTION 'Apenas proprietários ou administradores podem convidar membros.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_existing_member_count
  FROM public.family_members
  WHERE family_id = p_family_id;

  IF v_existing_member_count >= 10 THEN
    RAISE EXCEPTION 'Limite máximo de 10 membros por família atingido.' USING ERRCODE = 'P0001';
  END IF;

  v_clean_email := lower(trim(coalesce(p_invited_email, '')));
  IF v_clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Endereço de e-mail inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_target_user_id
  FROM public.profiles
  WHERE lower(email) = v_clean_email;

  IF v_target_user_id = v_user_id THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo.' USING ERRCODE = '22023';
  END IF;

  IF v_target_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.family_members WHERE user_id = v_target_user_id
  ) THEN
    RAISE EXCEPTION 'O usuário informado já faz parte de uma família ativa.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.family_invites
  SET status = 'canceled', updated_at = now()
  WHERE family_id = p_family_id
    AND lower(invited_email) = v_clean_email
    AND status = 'pending';

  v_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
  v_expires_at  := now() + interval '7 days';

  INSERT INTO public.family_invites (
    family_id, invited_by, invited_email, role,
    invite_code, status, expires_at
  )
  VALUES (
    p_family_id, v_user_id, v_clean_email, p_role,
    v_invite_code, 'pending', v_expires_at
  )
  RETURNING id INTO v_invite_id;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'family_invites',
    v_invite_id::text,
    'INVITE_FAMILY_MEMBER',
    jsonb_build_object(
      'family_id', p_family_id,
      'invited_email', v_clean_email,
      'role', p_role
    )
  );

  RETURN jsonb_build_object(
    'invite_id', v_invite_id,
    'invite_code', v_invite_code,
    'invited_email', v_clean_email,
    'expires_at', v_expires_at
  );
END;
$$;

-- 6.5 public.record_family_settlement
CREATE OR REPLACE FUNCTION public.record_family_settlement(
  p_family_id uuid,
  p_payer_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'pix',
  p_proof_url text DEFAULT null,
  p_notes text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settlement_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_family_member(p_family_id, v_user_id) THEN
    RAISE EXCEPTION 'Você não pertence a esta família.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_family_member(p_family_id, p_payer_id) OR
     NOT public.is_family_member(p_family_id, p_receiver_id) THEN
    RAISE EXCEPTION 'Pagador e recebedor devem ser membros da mesma família.' USING ERRCODE = '22023';
  END IF;

  IF p_payer_id = p_receiver_id THEN
    RAISE EXCEPTION 'Pagador e recebedor não podem ser a mesma pessoa.' USING ERRCODE = '22023';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do acerto deve ser maior que zero.' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.family_settlements (
    family_id, payer_id, receiver_id, amount,
    payment_method, proof_url, notes, created_by
  )
  VALUES (
    p_family_id, p_payer_id, p_receiver_id, p_amount,
    p_payment_method, p_proof_url, trim(coalesce(p_notes, '')), v_user_id
  )
  RETURNING id INTO v_settlement_id;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'family_settlements',
    v_settlement_id::text,
    'RECORD_FAMILY_SETTLEMENT',
    jsonb_build_object(
      'family_id', p_family_id,
      'payer_id', p_payer_id,
      'receiver_id', p_receiver_id,
      'amount', p_amount,
      'payment_method', p_payment_method
    )
  );

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
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
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
    v_token := md5(random()::text || clock_timestamp()::text) || md5(v_caller_id::text || clock_timestamp()::text);
  END;

  INSERT INTO public.trips (
    host_user_id,
    title,
    destination,
    start_date,
    end_date,
    currency,
    cover_photo_url,
    share_token
  )
  VALUES (
    v_caller_id,
    trim(p_title),
    nullif(trim(coalesce(p_destination, '')), ''),
    p_start_date,
    p_end_date,
    coalesce(nullif(trim(p_currency), ''), 'BRL'),
    nullif(trim(coalesce(p_cover_photo_url, '')), ''),
    v_token
  )
  RETURNING * INTO v_trip;

  IF p_host_name IS NOT NULL AND trim(p_host_name) <> '' THEN
    v_host_name := trim(p_host_name);
  ELSE
    SELECT name INTO v_host_name FROM public.profiles WHERE id = v_caller_id;
    IF v_host_name IS NULL OR trim(v_host_name) = '' THEN
      v_host_name := 'Você (Anfitrião)';
    END IF;
  END IF;

  INSERT INTO public.trip_members (
    trip_id,
    user_id,
    display_name,
    is_registered,
    is_host,
    role
  )
  VALUES (
    v_trip.id,
    v_caller_id,
    v_host_name,
    true,
    true,
    'host'
  );

  IF p_initial_members IS NOT NULL AND jsonb_array_length(p_initial_members) > 0 THEN
    FOR v_member IN
      SELECT
        trim(value->>'display_name') AS display_name,
        nullif(trim(value->>'pix_key'), '') AS pix_key,
        nullif(trim(value->>'user_id'), '')::uuid AS user_id
      FROM jsonb_array_elements(p_initial_members)
    LOOP
      IF v_member.display_name IS NOT NULL AND v_member.display_name <> '' THEN
        INSERT INTO public.trip_members (
          trip_id,
          user_id,
          display_name,
          pix_key,
          is_registered,
          is_host,
          role
        )
        VALUES (
          v_trip.id,
          v_member.user_id,
          v_member.display_name,
          v_member.pix_key,
          (v_member.user_id IS NOT NULL),
          false,
          'guest'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_trip;
END;
$$;

-- 6.7 public.delete_trip_expense_sync
CREATE OR REPLACE FUNCTION public.delete_trip_expense_sync(
  p_trip_expense_id uuid,
  p_delete_personal_copy boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expense public.trip_expenses;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_expense
  FROM public.trip_expenses
  WHERE id = p_trip_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Despesa de viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_expense.payer_id = v_uid OR public.is_trip_host(v_expense.trip_id, v_uid)) THEN
    RAISE EXCEPTION 'Permissão negada para excluir esta despesa.' USING ERRCODE = '42501';
  END IF;

  IF p_delete_personal_copy AND v_expense.source_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses
    WHERE id = v_expense.source_expense_id
      AND user_id = v_uid;
  END IF;

  DELETE FROM public.trip_expenses
  WHERE id = p_trip_expense_id;

  RETURN true;
END;
$$;

-- 6.8 public.record_trip_settlements
CREATE OR REPLACE FUNCTION public.record_trip_settlements(
  p_trip_id uuid,
  p_settlements jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_item jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_trip_host(p_trip_id, v_uid) OR public.is_trip_member(p_trip_id, v_uid)) THEN
    RAISE EXCEPTION 'Apenas o anfitrião ou membros da viagem podem registrar liquidações.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_settlements) <> 'array' OR jsonb_array_length(p_settlements) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_settlements)
  LOOP
    INSERT INTO public.trip_settlements (
      trip_id,
      payer_member_id,
      receiver_member_id,
      amount,
      is_settled,
      settled_at
    )
    VALUES (
      p_trip_id,
      (v_item->>'payer_member_id')::uuid,
      (v_item->>'receiver_member_id')::uuid,
      (v_item->>'amount')::numeric,
      coalesce((v_item->>'is_settled')::boolean, true),
      CASE WHEN coalesce((v_item->>'is_settled')::boolean, true) THEN now() ELSE null END
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6.9 public.unlink_trip_member
CREATE OR REPLACE FUNCTION public.unlink_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target_user_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_target_user_id
  FROM public.trip_members
  WHERE id = p_member_id AND trip_id = p_trip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado na viagem informada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_target_user_id = v_uid OR public.is_trip_host(p_trip_id, v_uid)) THEN
    RAISE EXCEPTION 'Apenas o próprio membro ou o anfitrião podem desvincular uma conta.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.trip_members
  SET user_id = null,
      is_registered = false,
      updated_at = now()
  WHERE id = p_member_id AND trip_id = p_trip_id;

  RETURN true;
END;
$$;


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
