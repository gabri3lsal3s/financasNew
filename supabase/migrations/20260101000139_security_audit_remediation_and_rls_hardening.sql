-- =============================================================================
-- Migration 0139: Remediação Integral da Auditoria de Segurança (F-01 a F-12)
-- =============================================================================
-- Corrige:
--   [F-01/F-02] Vazamento e auto-inserção em family_invites, family_members e trip_members
--   [F-03]      Vazamento de receitas pessoais em get_family_income_ratio_suggestion
--   [F-04]      Bypass via current_user em protect_profile_security_fields() (INSERT e UPDATE)
--   [F-05]      Bypass via current_user em reconcile_expired_subscriptions() + REVOKE authenticated
--   [F-06]      Escrita direta RLS em tabelas de governança Admin + trava Superadmin em overrides
--   [F-07]      Remoção de sobrecargas SQL órfãs e hardening de refinance_credit_card_bill (5 args)
--   [F-08]      Proteção de colunas administrativas em public.support_tickets
--   [F-10]      Validação estrita de invited_email e limite de 6 membros em accept_family_invite
--   [F-11]      Validação de posse cross-tenant (asset_id, expense_id, member_id) em RPCs SECURITY DEFINER
--   [F-12]      Anti-enumeração em get_user_module_access e helpers is_family_* / is_trip_*
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. [F-04] Trigger protect_profile_security_fields() (session_user + INSERT/UPDATE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  -- Bypass restrito apenas a chamadas reais de sistema/service_role (fora de contextos PostgREST authenticated/anon)
  IF v_auth_role = 'service_role'
     OR (v_uid IS NULL AND session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') AND v_auth_role NOT IN ('authenticated', 'anon')) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      IF coalesce(NEW.role, 'user'::public.user_role) <> 'user'::public.user_role THEN
        RAISE EXCEPTION 'Acesso negado: não é permitido definir papel privilegiado na criação de perfil.'
          USING ERRCODE = '42501';
      END IF;
      NEW.role := 'user'::public.user_role;
      IF coalesce(NEW.status, 'pending_approval'::public.user_status) <> 'pending_approval'::public.user_status THEN
        NEW.status := 'pending_approval'::public.user_status;
      END IF;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    ELSIF NEW.role IN ('admin'::public.user_role, 'superadmin'::public.user_role) AND NOT public.is_superadmin() THEN
      RAISE EXCEPTION 'Acesso negado: apenas um Superadmin pode provisionar contas com papel administrativo.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE': usuário comum não altera role, status ou metadados de aprovação
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papel ou status de usuários'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papel ou status de usuários'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Acesso negado: você não tem permissão para alterar os metadados de aprovação.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Administrador não pode alterar o próprio role ou status diretamente
  IF OLD.id = v_uid AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Operação inválida: você não pode alterar seu próprio papel ou status administrativo'
      USING ERRCODE = '42501';
  END IF;

  -- Apenas Superadmin pode promover, rebaixar ou bloquear outros administradores/superadmins
  IF (
       OLD.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
       OR NEW.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
     )
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status)
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Superadmin pode promover, rebaixar ou bloquear outros administradores'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- -----------------------------------------------------------------------------
-- 2. [F-05] reconcile_expired_subscriptions() (session_user + REVOKE authenticated)
-- -----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.reconcile_expired_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() TO service_role;

-- -----------------------------------------------------------------------------
-- 3. [F-12] Anti-enumeração em get_user_module_access e helpers is_family_* / is_trip_*
-- -----------------------------------------------------------------------------
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
  v_is_core_module := p_module_key IN (
    'overview', 'transactions', 'cards', 'debts',
    'budgets', 'investments', 'reports', 'insights', 'reminders'
  );

  -- 4. Verifica se há override explícito na tabela user_module_permissions para este módulo específico
  SELECT access_level INTO v_override
  FROM public.user_module_permissions
  WHERE user_id = p_user_id
    AND module_key = p_module_key
    AND (expires_at IS NULL OR expires_at > now());

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

  IF v_sub.status = 'past_due'::public.subscription_status AND
     v_sub.current_period_end IS NOT NULL AND
     v_sub.current_period_end + INTERVAL '3 days' > NOW() THEN
    RETURN 'write'::public.access_level;
  END IF;

  IF v_sub.tier = 'trial'::public.subscription_tier AND (
       v_sub.status = 'active'::public.subscription_status OR
       (v_sub.status = 'trialing'::public.subscription_status AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at > NOW()))
     ) THEN
    RETURN 'write'::public.access_level;
  END IF;

  RETURN 'read'::public.access_level;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_module_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_module_access(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    (
      coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
      OR coalesce(p_user_id, auth.uid()) = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.family_members fm_self
        WHERE fm_self.family_id = p_family_id
          AND fm_self.user_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.family_id = p_family_id
        AND fm.user_id = coalesce(p_user_id, auth.uid())
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_family_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_family_admin(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    (
      coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
      OR coalesce(p_user_id, auth.uid()) = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.family_members fm_self
        WHERE fm_self.family_id = p_family_id
          AND fm_self.user_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.family_id = p_family_id
        AND fm.user_id = coalesce(p_user_id, auth.uid())
        AND fm.role IN ('owner', 'admin')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_family_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    (
      coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
      OR coalesce(p_user_id, auth.uid()) = auth.uid()
      OR public.is_admin()
      OR EXISTS (SELECT 1 FROM public.trips t_self WHERE t_self.id = p_trip_id AND t_self.host_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.trip_members tm_self WHERE tm_self.trip_id = p_trip_id AND tm_self.user_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = p_trip_id
        AND tm.user_id = coalesce(p_user_id, auth.uid())
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_trip_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_trip_host(p_trip_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    (
      coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
      OR coalesce(p_user_id, auth.uid()) = auth.uid()
      OR public.is_admin()
      OR EXISTS (SELECT 1 FROM public.trips t_self WHERE t_self.id = p_trip_id AND t_self.host_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.trip_members tm_self WHERE tm_self.trip_id = p_trip_id AND tm_self.user_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = p_trip_id
        AND t.host_user_id = coalesce(p_user_id, auth.uid())
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_trip_host(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_host(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_trip_expense(p_expense_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    (
      coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') NOT IN ('authenticated', 'anon'))
      OR coalesce(p_user_id, auth.uid()) = auth.uid()
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1
      FROM public.trip_expenses te
      WHERE te.id = p_expense_id
        AND (
          public.is_trip_host(te.trip_id, coalesce(p_user_id, auth.uid()))
          OR public.is_trip_member(te.trip_id, coalesce(p_user_id, auth.uid()))
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_trip_expense(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_trip_expense(uuid, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. [F-01] & [F-02] Blindagem RLS e Triggers em family_invites, family_members e trip_members
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "family_invites_select" ON public.family_invites;
CREATE POLICY "family_invites_select" ON public.family_invites
  FOR SELECT TO authenticated
  USING (
    public.is_family_member(family_id, (SELECT auth.uid()))
    OR (
      coalesce(invited_email, '') <> ''
      AND lower(invited_email) = lower(coalesce((SELECT p.email FROM public.profiles p WHERE p.id = (SELECT auth.uid())), ''))
    )
  );

DROP POLICY IF EXISTS "family_invites_insert" ON public.family_invites;
CREATE POLICY "family_invites_insert" ON public.family_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
    AND public.is_family_admin(family_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "family_invites_update" ON public.family_invites;
CREATE POLICY "family_invites_update" ON public.family_invites
  FOR UPDATE TO authenticated
  USING (
    public.is_family_admin(family_id, (SELECT auth.uid()))
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    public.is_family_admin(family_id, (SELECT auth.uid()))
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;
CREATE POLICY "family_members_insert" ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
    AND public.is_family_admin(family_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "family_members_update" ON public.family_members;
CREATE POLICY "family_members_update" ON public.family_members
  FOR UPDATE TO authenticated
  USING (
    (
      ((SELECT auth.uid()) = user_id AND public.is_family_member(family_id, (SELECT auth.uid())))
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      ((SELECT auth.uid()) = user_id AND public.is_family_member(family_id, (SELECT auth.uid())))
      OR public.is_family_admin(family_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

CREATE OR REPLACE FUNCTION public.protect_family_member_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_family_owner_id uuid;
BEGIN
  IF v_auth_role = 'service_role'
     OR (v_uid IS NULL AND session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') AND v_auth_role NOT IN ('authenticated', 'anon')) THEN
    RETURN NEW;
  END IF;

  IF NEW.family_id IS DISTINCT FROM OLD.family_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido alterar o vínculo de família ou usuário do membro.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_family_admin(OLD.family_id, v_uid) THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores da família podem alterar papéis.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role = 'owner' THEN
      SELECT owner_id INTO v_family_owner_id FROM public.families WHERE id = OLD.family_id;
      IF v_family_owner_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Operação inválida: o papel de proprietário deve estar vinculado ao titular da família.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_family_member_security_fields ON public.family_members;
CREATE TRIGGER trg_protect_family_member_security_fields
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_family_member_security_fields();

DROP POLICY IF EXISTS "trip_members_write_policy" ON public.trip_members;

CREATE POLICY "trip_members_insert_policy" ON public.trip_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
    AND public.is_trip_host(trip_id, (SELECT auth.uid()))
  );

CREATE POLICY "trip_members_update_policy" ON public.trip_members
  FOR UPDATE TO authenticated
  USING (
    (
      ((SELECT auth.uid()) = user_id AND public.is_trip_member(trip_id, (SELECT auth.uid())))
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  )
  WITH CHECK (
    (
      ((SELECT auth.uid()) = user_id AND public.is_trip_member(trip_id, (SELECT auth.uid())))
      OR public.is_trip_host(trip_id, (SELECT auth.uid()))
    )
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
  );

CREATE POLICY "trip_members_delete_policy" ON public.trip_members
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('transactions'))
    AND public.is_trip_host(trip_id, (SELECT auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.protect_trip_member_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  IF v_auth_role = 'service_role'
     OR (v_uid IS NULL AND session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') AND v_auth_role NOT IN ('authenticated', 'anon')) THEN
    RETURN NEW;
  END IF;

  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido transferir membro para outra viagem.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_host IS DISTINCT FROM OLD.is_host AND NOT public.is_trip_host(OLD.trip_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o anfitrião da viagem pode alterar privilégios de host.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF NOT (
      public.is_trip_host(OLD.trip_id, v_uid)
      OR (OLD.user_id = v_uid AND NEW.user_id IS NULL)
      OR (OLD.user_id IS NULL AND NEW.user_id = v_uid)
      OR (NEW.user_id IS NULL AND public.is_superadmin())
    ) THEN
      RAISE EXCEPTION 'Acesso negado: apenas o anfitrião ou a RPC de vínculo pode reatribuir este participante.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_trip_member_security_fields ON public.trip_members;
CREATE TRIGGER trg_protect_trip_member_security_fields
  BEFORE UPDATE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_trip_member_security_fields();

-- -----------------------------------------------------------------------------
-- 5. [F-03] Filtro is_family = true e family_id em get_family_income_ratio_suggestion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_family_income_ratio_suggestion(
  p_family_id uuid DEFAULT NULL,
  p_lookback_months int DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_months int := coalesce(p_lookback_months, 3);
  v_start_date date;
  v_total_avg_cents bigint := 0;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF v_months < 1 THEN
    v_months := 1;
  ELSIF v_months > 12 THEN
    v_months := 12;
  END IF;

  IF p_family_id IS NOT NULL THEN
    v_family_id := p_family_id;
    IF NOT public.is_family_member(v_family_id, v_user_id) THEN
      RAISE EXCEPTION 'Acesso negado: usuário não pertence à família especificada.' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT fm.family_id
    INTO v_family_id
    FROM public.family_members fm
    WHERE fm.user_id = v_user_id
    LIMIT 1;

    IF v_family_id IS NULL THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  v_start_date := (date_trunc('month', current_date) - ((v_months || ' months')::interval))::date;

  -- Agrega somente receitas explicitamente compartilhadas com a família (is_family = true)
  WITH member_incomes AS (
    SELECT
      fm.user_id,
      coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Participante') AS display_name,
      coalesce(sum(round(i.value * 100)::bigint), 0) AS total_income_cents
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.id = fm.user_id
    LEFT JOIN public.incomes i
      ON i.user_id = fm.user_id
      AND i.is_family = true
      AND i.family_id = v_family_id
      AND i.date >= v_start_date
      AND i.date < date_trunc('month', current_date)::date
    WHERE fm.family_id = v_family_id
    GROUP BY fm.user_id, fm.display_name, p.name, fm.created_at
    ORDER BY fm.created_at ASC
  ),
  member_averages AS (
    SELECT
      mi.user_id,
      mi.display_name,
      round(mi.total_income_cents::numeric / v_months::numeric)::bigint AS avg_cents
    FROM member_incomes mi
  )
  SELECT
    coalesce(sum(ma.avg_cents), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', ma.user_id,
          'display_name', ma.display_name,
          'average_monthly_income_cents', ma.avg_cents
        )
      ),
      '[]'::jsonb
    )
  INTO v_total_avg_cents, v_result
  FROM member_averages ma;

  IF v_total_avg_cents > 0 THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', elem->>'user_id',
          'display_name', elem->>'display_name',
          'average_monthly_income_cents', (elem->>'average_monthly_income_cents')::bigint,
          'suggested_percentage', round(((elem->>'average_monthly_income_cents')::numeric / v_total_avg_cents::numeric) * 100)::int
        )
      ),
      '[]'::jsonb
    )
    INTO v_result
    FROM jsonb_array_elements(v_result) AS elem;
  ELSE
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', elem->>'user_id',
          'display_name', elem->>'display_name',
          'average_monthly_income_cents', 0,
          'suggested_percentage', round(100.0 / nullif(jsonb_array_length(v_result), 0))::int
        )
      ),
      '[]'::jsonb
    )
    INTO v_result
    FROM jsonb_array_elements(v_result) AS elem;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_family_income_ratio_suggestion(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_income_ratio_suggestion(uuid, int) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. [F-06] Restrição de escrita direta em tabelas administrativas + Superadmin guard em overrides
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins editam funcionalidades do sistema" ON public.system_features;
DROP POLICY IF EXISTS "Admins visualizam funcionalidades do sistema" ON public.system_features;
CREATE POLICY "Admins visualizam funcionalidades do sistema" ON public.system_features
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Admins gerenciam overrides de features" ON public.user_feature_overrides;
DROP POLICY IF EXISTS "Admins visualizam overrides de features" ON public.user_feature_overrides;
CREATE POLICY "Admins visualizam overrides de features" ON public.user_feature_overrides
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Admins gerenciam permissões modulares" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins visualizam permissões modulares" ON public.user_module_permissions;
CREATE POLICY "Admins visualizam permissões modulares" ON public.user_module_permissions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Admins gerenciam assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admins visualizam assinaturas" ON public.user_subscriptions;
CREATE POLICY "Admins visualizam assinaturas" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.system_features,
  public.user_feature_overrides,
  public.user_module_permissions,
  public.user_subscriptions
FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_feature_override(
  p_user_id uuid,
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
  v_target_role public.user_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um Superadmin pode alterar overrides de outro Superadmin.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_feature_overrides (user_id, feature_key, is_enabled, granted_by, updated_at)
  VALUES (p_user_id, p_feature_key, p_enabled, v_admin_id, now())
  ON CONFLICT (user_id, feature_key) DO UPDATE
  SET is_enabled = excluded.is_enabled,
      granted_by = v_admin_id,
      updated_at = now();

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'user_feature_overrides',
    p_user_id::text || ':' || p_feature_key,
    'SET_OVERRIDE',
    jsonb_build_object('is_enabled', p_enabled)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_feature_override(
  p_user_id uuid,
  p_feature_key text
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
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um Superadmin pode remover overrides de outro Superadmin.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_feature_overrides
  WHERE user_id = p_user_id AND feature_key = p_feature_key;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'user_feature_overrides',
    p_user_id::text || ':' || p_feature_key,
    'REMOVE_OVERRIDE',
    '{}'::jsonb
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. [F-07] Remoção de sobrecargas órfãs e hardening de refinance_credit_card_bill (5 args)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid);
DROP FUNCTION IF EXISTS public.create_trip(text, text, date, date, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.refinance_credit_card_bill(
  p_card_id uuid,
  p_competence_month char(7),
  p_initial_payment_amount numeric,
  p_interest_installments jsonb,
  p_expense_category_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_group_id uuid := gen_random_uuid();
  v_card_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Conta inativa ou pendente de aprovação.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write_module('cards') THEN
    RAISE EXCEPTION 'Acesso somente-leitura no módulo de cartões: ative sua assinatura Pro.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_card_name
    FROM public.credit_cards
   WHERE id = p_card_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão não encontrado ou não pertence ao usuário';
  END IF;

  IF p_expense_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = p_expense_category_id AND user_id = v_user_id AND type = 'expense'
  ) THEN
    RAISE EXCEPTION 'Categoria de despesa inválida ou não pertence ao usuário';
  END IF;

  IF p_initial_payment_amount > 0 THEN
    INSERT INTO public.card_payments (
      user_id, card_id, competence_month, amount, date, note, is_refund
    ) VALUES (
      v_user_id, p_card_id, p_competence_month, p_initial_payment_amount, current_date, 'Entrada de parcelamento de fatura', false
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_interest_installments)
  LOOP
    INSERT INTO public.expenses (
      user_id, value, date, category_id, payment_method, card_id,
      installments_total, installment_number, installment_group_id,
      bill_competence, report_weight, base_amount, description, charge_kind
    ) VALUES (
      v_user_id,
      (v_item->>'amount')::numeric,
      (v_item->>'date')::date,
      p_expense_category_id,
      'credit_card',
      p_card_id,
      (v_item->>'installments_total')::integer,
      (v_item->>'installment_number')::integer,
      v_group_id,
      v_item->>'bill_competence',
      1,
      (v_item->>'amount')::numeric,
      format('Juros de parcelamento de fatura: %s', v_card_name),
      'interest'
    );
  END LOOP;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, 'credit_card', p_card_id::text, 'bill_refinance',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'initial_payment', p_initial_payment_amount,
      'installments_count', jsonb_array_length(p_interest_installments),
      'installment_group_id', v_group_id
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. [F-08] Trigger de proteção de campos administrativos em public.support_tickets
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_support_ticket_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  IF v_auth_role = 'service_role'
     OR public.is_admin()
     OR (v_uid IS NULL AND session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') AND v_auth_role NOT IN ('authenticated', 'anon')) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'open'::public.support_ticket_status;
    NEW.admin_notes := NULL;
    NEW.admin_reply := NULL;
    NEW.admin_replied_at := NULL;
    NEW.admin_id := NULL;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE': usuário final não altera colunas administrativas nem transfere ownership
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido alterar o titular do chamado.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     OR NEW.admin_replied_at IS DISTINCT FROM OLD.admin_replied_at
     OR NEW.status IS DISTINCT FROM OLD.status
     OR (
       NEW.admin_id IS DISTINCT FROM OLD.admin_id
       AND NOT (NEW.admin_id IS NULL AND OLD.admin_id = v_uid)
     ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar campos de atendimento do chamado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_support_ticket_admin_fields ON public.support_tickets;
CREATE TRIGGER trg_protect_support_ticket_admin_fields
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.protect_support_ticket_admin_fields();

-- -----------------------------------------------------------------------------
-- 9. [F-10] Validação estrita de invited_email e limite de 6 membros em accept_family_invite
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_family_invite(
  p_token text,
  p_display_name text DEFAULT NULL,
  p_pix_key text DEFAULT NULL,
  p_pix_key_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_token text;
  v_invite record;
  v_clean_display_name text;
  v_clean_pix_key text;
  v_caller_email text;
  v_member_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.' USING ERRCODE = '42501';
  END IF;

  v_clean_token := trim(coalesce(p_token, ''));
  IF length(v_clean_token) NOT BETWEEN 6 AND 64 THEN
    RAISE EXCEPTION 'Token de convite inválido.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Você já pertence a uma família ativa. Para entrar em outra família, saia da atual primeiro.' USING ERRCODE = '23505';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.family_invites
  WHERE token = v_clean_token
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado ou inválido.' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Este convite já foi utilizado.' USING ERRCODE = '22023';
  ELSIF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Este convite foi revogado.' USING ERRCODE = '22023';
  ELSIF v_invite.status = 'expired' OR v_invite.expires_at <= now() THEN
    UPDATE public.family_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Este convite expirou.' USING ERRCODE = '22023';
  END IF;

  IF v_invite.invited_by = v_user_id THEN
    RAISE EXCEPTION 'Você não pode aceitar um convite criado por você mesmo.' USING ERRCODE = '22023';
  END IF;

  -- Valida correspondência de e-mail caso o convite seja nominativo
  IF nullif(trim(coalesce(v_invite.invited_email, '')), '') IS NOT NULL
     AND lower(trim(v_invite.invited_email)) NOT LIKE 'convite-%@familia.local' THEN
    SELECT coalesce(nullif(trim(email), ''), nullif(trim(auth.jwt() ->> 'email'), ''))
    INTO v_caller_email
    FROM public.profiles
    WHERE id = v_user_id;

    v_caller_email := coalesce(v_caller_email, nullif(trim(auth.jwt() ->> 'email'), ''), '');

    IF lower(trim(v_caller_email)) <> lower(trim(v_invite.invited_email)) THEN
      RAISE EXCEPTION 'Este convite foi emitido exclusivamente para outro endereço de e-mail.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Garante teto máximo de 6 membros por família (com lock na família para prevenir corrida)
  PERFORM 1 FROM public.families WHERE id = v_invite.family_id FOR UPDATE;
  SELECT count(*) INTO v_member_count FROM public.family_members WHERE family_id = v_invite.family_id;
  IF v_member_count >= 6 THEN
    RAISE EXCEPTION 'Limite máximo de 6 membros por família atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF p_pix_key_type IS NOT NULL AND p_pix_key_type NOT IN ('cpf', 'email', 'phone', 'random') THEN
    RAISE EXCEPTION 'Tipo de chave Pix inválido.' USING ERRCODE = '22023';
  END IF;

  v_clean_pix_key := nullif(trim(coalesce(p_pix_key, '')), '');

  v_clean_display_name := trim(coalesce(p_display_name, ''));
  IF v_clean_display_name = '' THEN
    SELECT coalesce(name, 'Membro') INTO v_clean_display_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.family_members (
    family_id,
    user_id,
    role,
    display_name,
    pix_key,
    pix_key_type,
    split_ratio
  ) VALUES (
    v_invite.family_id,
    v_user_id,
    v_invite.role,
    nullif(v_clean_display_name, ''),
    v_clean_pix_key,
    p_pix_key_type,
    0.5000
  );

  UPDATE public.family_invites
  SET status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'family_id', v_invite.family_id,
    'role', v_invite.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_family_invite(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_family_invite(text, text, text, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. [F-11] Validação de posse de FKs cross-tenant em 4 RPCs SECURITY DEFINER
-- -----------------------------------------------------------------------------

-- 10.1 approve_dividends_batch_atomic: valida posse de asset_id informado no JSON
CREATE OR REPLACE FUNCTION public.approve_dividends_batch_atomic(
  p_dividends jsonb,
  p_sync_cash boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_asset_id uuid;
  v_ticker text;
  v_date date;
  v_amount numeric(12, 2);
  v_notes text;
  v_corp_div_id uuid;
  v_total_cash numeric(12, 2) := 0;
  v_inserted_count integer := 0;
  v_cash_asset_id uuid;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_dividends IS NULL OR jsonb_typeof(p_dividends) <> 'array' OR jsonb_array_length(p_dividends) = 0 THEN
    RAISE EXCEPTION 'Nenhum provento informado para aprovação.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dividends)
  LOOP
    v_ticker := trim(upper(coalesce(v_item->>'ticker', '')));
    v_date := (v_item->>'date')::date;
    v_amount := (v_item->>'amount')::numeric;
    v_notes := v_item->>'notes';

    IF v_item->>'corporate_dividend_id' IS NOT NULL AND trim(v_item->>'corporate_dividend_id') <> '' THEN
      v_corp_div_id := (v_item->>'corporate_dividend_id')::uuid;
    ELSE
      v_corp_div_id := NULL;
    END IF;

    IF v_item->>'asset_id' IS NOT NULL AND trim(v_item->>'asset_id') <> '' THEN
      SELECT id INTO v_asset_id
      FROM public.portfolio_assets
      WHERE id = (v_item->>'asset_id')::uuid
        AND user_id = v_user_id;

      IF v_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;
    ELSE
      v_asset_id := NULL;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_date IS NULL OR v_date < date '2026-01-01' THEN
      RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
    END IF;

    IF v_asset_id IS NULL AND v_ticker <> '' THEN
      SELECT id INTO v_asset_id
      FROM public.portfolio_assets
      WHERE user_id = v_user_id AND upper(ticker) = v_ticker;
    END IF;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.portfolio_dividends (
      user_id,
      asset_id,
      date,
      amount,
      notes,
      sync_cash,
      cash_amount
    ) VALUES (
      v_user_id,
      v_asset_id,
      v_date,
      v_amount,
      v_notes,
      coalesce(p_sync_cash, false),
      CASE WHEN coalesce(p_sync_cash, false) THEN v_amount ELSE NULL END
    )
    RETURNING id INTO v_new_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash := v_total_cash + v_amount;

    IF v_corp_div_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) VALUES (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
    END IF;
  END LOOP;

  IF coalesce(p_sync_cash, false) AND v_total_cash > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA';

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET quantity = quantity + v_total_cash,
          updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids
  );
END;
$$;

-- 10.2 restore_backup: valida posse de d.expense_id em public.debts
CREATE OR REPLACE FUNCTION public.restore_backup(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write() THEN
    RAISE EXCEPTION 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(v_data) <> 'object' THEN
    RAISE EXCEPTION 'Backup inválido: campo "data" ausente ou malformado.' USING ERRCODE = '22023';
  END IF;

  -- 1) Apaga os dados atuais do usuário
  DELETE FROM public.portfolio_transactions pt
    USING public.portfolio_assets a
    WHERE pt.asset_id = a.id AND a.user_id = v_uid;
  DELETE FROM public.portfolio_dividends WHERE user_id = v_uid;
  DELETE FROM public.portfolio_contributions WHERE user_id = v_uid;
  DELETE FROM public.portfolio_snapshots WHERE user_id = v_uid;
  DELETE FROM public.class_targets WHERE user_id = v_uid;
  DELETE FROM public.sector_targets WHERE user_id = v_uid;
  DELETE FROM public.cash_checkpoints WHERE user_id = v_uid;
  DELETE FROM public.card_competence_overrides o
    USING public.credit_cards c
    WHERE o.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.card_payments cp
    USING public.credit_cards c
    WHERE cp.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.debts WHERE user_id = v_uid;
  DELETE FROM public.expenses WHERE user_id = v_uid;
  DELETE FROM public.incomes WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.income_goals WHERE user_id = v_uid;
  DELETE FROM public.insight_feedback WHERE user_id = v_uid;
  DELETE FROM public.reminder_states WHERE user_id = v_uid;
  DELETE FROM public.asset_prices WHERE user_id = v_uid;
  DELETE FROM public.portfolio_assets WHERE user_id = v_uid;
  DELETE FROM public.credit_cards WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  DELETE FROM public.user_preferences WHERE user_id = v_uid;

  -- 2) Insere tabelas pais
  INSERT INTO public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  SELECT id, v_uid, type, name, icon, color, is_reserved, is_active
  FROM jsonb_populate_recordset(NULL::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  INSERT INTO public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits)
  SELECT id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits
  FROM jsonb_populate_recordset(NULL::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  INSERT INTO public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary
  )
  SELECT
    pa.id,
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    coalesce(pa.accumulated_dividends, 0),
    coalesce(pa.estimated_monthly_dividend_per_share, 0),
    pa.fixed_income_metadata,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN coalesce(pa.is_family, false) ELSE false END,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN pa.family_id ELSE NULL END,
    coalesce(nullif(pa.family_share_mode, ''), 'full'),
    coalesce(pa.family_share_percentage, 100),
    pa.notes,
    pa.score,
    coalesce(nullif(pa.allocation_status, ''), 'active'),
    coalesce(pa.score_criteria, '{}'::jsonb),
    pa.last_reviewed_at,
    coalesce(pa.review_frequency_months, 6),
    pa.thesis_summary
  FROM jsonb_populate_recordset(NULL::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  LEFT JOIN public.families f ON f.id = pa.family_id;

  INSERT INTO public.user_preferences (
    user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill,
    report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings, app_mode
  )
  SELECT
    v_uid,
    coalesce(nullif(theme, ''), 'system'),
    coalesce(reminders_enabled, true),
    coalesce(reminder_days_before_debt, 3),
    coalesce(reminder_days_before_bill, 3),
    coalesce(report_weights_enabled, false),
    coalesce(max_sector_acoes, 25),
    coalesce(max_sector_fiis, 25),
    coalesce(custom_settings, '{}'::jsonb),
    coalesce(nullif(app_mode, ''), 'investor')
  FROM jsonb_populate_recordset(NULL::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  INSERT INTO public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  SELECT o.id, o.card_id, o.month, o.closing_day, o.due_day
  FROM jsonb_populate_recordset(NULL::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  JOIN public.credit_cards c ON c.id = o.card_id
  WHERE c.user_id = v_uid;

  INSERT INTO public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  SELECT i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  FROM jsonb_populate_recordset(NULL::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  JOIN public.categories cat ON cat.id = i.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  SELECT e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id, e.installments_total, e.installment_number, e.installment_group_id, e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at
  FROM jsonb_populate_recordset(NULL::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  JOIN public.categories cat ON cat.id = e.category_id
  LEFT JOIN public.credit_cards cc ON cc.id = e.card_id
  WHERE cat.user_id = v_uid AND (e.card_id IS NULL OR cc.user_id = v_uid);

  -- Validação de posse de expense_id em debts (impede referência a despesa de terceiro)
  INSERT INTO public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  SELECT d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, e.id, d.installment_group_id, d.created_at
  FROM jsonb_populate_recordset(NULL::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d
  LEFT JOIN public.expenses e ON e.id = d.expense_id AND e.user_id = v_uid
  WHERE d.expense_id IS NULL OR e.id IS NOT NULL;

  INSERT INTO public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  SELECT cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  FROM jsonb_populate_recordset(NULL::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  JOIN public.credit_cards cc ON cc.id = cp.card_id
  WHERE cc.user_id = v_uid;

  INSERT INTO public.budgets (id, user_id, category_id, month, "limit")
  SELECT b.id, v_uid, b.category_id, b.month, b."limit"
  FROM jsonb_populate_recordset(NULL::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  JOIN public.categories cat ON cat.id = b.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.income_goals (id, user_id, category_id, month, expected)
  SELECT ig.id, v_uid, ig.category_id, ig.month, ig.expected
  FROM jsonb_populate_recordset(NULL::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  JOIN public.categories cat ON cat.id = ig.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  SELECT id, v_uid, occurrence_key, decision, created_at
  FROM jsonb_populate_recordset(NULL::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  INSERT INTO public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  SELECT id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  INSERT INTO public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  SELECT pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total
  FROM jsonb_populate_recordset(NULL::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  JOIN public.portfolio_assets pa ON pa.id = pt.asset_id
  WHERE pa.user_id = v_uid;

  INSERT INTO public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  SELECT
    ps.id,
    v_uid,
    ps.month,
    ps.total_value,
    ps.total_cost,
    ps.auto_total_value,
    ps.auto_total_cost,
    ps.manual_total_value,
    ps.manual_total_cost,
    coalesce(ps.is_manually_calibrated, false),
    ps.calibrated_at,
    coalesce(nullif(ps.status, ''), 'closed'),
    ps.closing_date,
    ps.closed_at,
    coalesce(ps.created_at, now()),
    coalesce(ps.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps;

  INSERT INTO public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, created_at)
  SELECT
    pc.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pc.asset_id ELSE NULL END,
    pc.date,
    pc.amount,
    pc.notes,
    coalesce(pc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  LEFT JOIN public.portfolio_assets pa ON pa.id = pc.asset_id AND pa.user_id = v_uid;

  INSERT INTO public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, created_at)
  SELECT
    pd.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pd.asset_id ELSE NULL END,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN public.portfolio_assets pa ON pa.id = pd.asset_id AND pa.user_id = v_uid;

  INSERT INTO public.class_targets (id, user_id, group_type, name, target_percentage)
  SELECT id, v_uid, coalesce(nullif(group_type, ''), 'class'), name, target_percentage
  FROM jsonb_populate_recordset(NULL::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb))
  WHERE lower(trim(coalesce(name, ''))) <> 'caixa';

  INSERT INTO public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  SELECT
    id,
    v_uid,
    coalesce(nullif(group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(class_name, '')), ''), 'Ações'),
    name,
    target_percentage
  FROM jsonb_populate_recordset(NULL::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  INSERT INTO public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, updated_at)
  SELECT
    ap.id,
    v_uid,
    ap.ticker,
    ap.price,
    coalesce(nullif(ap.currency, ''), 'BRL'),
    coalesce(nullif(ap.source, ''), 'manual'),
    ap.manual_price,
    coalesce(ap.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  WHERE ap.user_id = v_uid
  ON CONFLICT (ticker, user_id) DO UPDATE
  SET price = excluded.price,
      currency = excluded.currency,
      source = excluded.source,
      manual_price = excluded.manual_price,
      updated_at = excluded.updated_at;

  INSERT INTO public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at)
  SELECT
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  SELECT jsonb_build_object(
    'categories', (SELECT count(*) FROM public.categories WHERE user_id = v_uid),
    'credit_cards', (SELECT count(*) FROM public.credit_cards WHERE user_id = v_uid),
    'incomes', (SELECT count(*) FROM public.incomes WHERE user_id = v_uid),
    'expenses', (SELECT count(*) FROM public.expenses WHERE user_id = v_uid),
    'debts', (SELECT count(*) FROM public.debts WHERE user_id = v_uid),
    'portfolio_assets', (SELECT count(*) FROM public.portfolio_assets WHERE user_id = v_uid),
    'class_targets', (SELECT count(*) FROM public.class_targets WHERE user_id = v_uid),
    'sector_targets', (SELECT count(*) FROM public.sector_targets WHERE user_id = v_uid)
  ) INTO v_counts;

  RETURN jsonb_build_object('success', true, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated, service_role;

-- 10.3 add_public_trip_expense (11 args): valida created_by_member_id, splits[].member_id e share_cents >= 0
CREATE OR REPLACE FUNCTION public.add_public_trip_expense(
  p_token text,
  p_paid_by_member_id uuid,
  p_amount_cents int,
  p_description text,
  p_category_name text,
  p_expense_date date,
  p_split_type text,
  p_splits jsonb,
  p_receipt_url text DEFAULT NULL,
  p_created_by_member_id uuid DEFAULT NULL,
  p_passcode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_trip record;
  v_expense_id uuid;
  v_split record;
  v_total_split_cents integer := 0;
  v_expense_count integer := 0;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_amount_cents > 100000000 THEN
    RAISE EXCEPTION 'O valor deve ser positivo e não exceder R$ 1.000.000,00.' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR trim(p_description) = '' OR length(trim(p_description)) > 140 THEN
    RAISE EXCEPTION 'A descrição é obrigatória e deve ter no máximo 140 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE public_token = p_token;

  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'Viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Esta viagem já foi finalizada ou arquivada.' USING ERRCODE = '42501';
  END IF;

  IF v_trip.passcode_hash IS NOT NULL AND v_trip.passcode_hash <> '' THEN
    IF p_passcode IS NULL OR (
      CASE
        WHEN v_trip.passcode_hash LIKE '$2%' THEN crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash
        ELSE v_trip.passcode_hash <> p_passcode
      END
    ) THEN
      RAISE EXCEPTION 'INVALID_PASSCODE: Código de acesso incorreto ou ausente.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*) INTO v_expense_count
  FROM public.trip_expenses
  WHERE trip_id = v_trip.id;

  IF v_expense_count >= 500 THEN
    RAISE EXCEPTION 'LIMIT_REACHED: A viagem atingiu o limite máximo de 500 despesas.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE id = p_paid_by_member_id AND trip_id = v_trip.id
  ) THEN
    RAISE EXCEPTION 'Membro pagador não pertence a esta viagem.' USING ERRCODE = '22023';
  END IF;

  IF p_created_by_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE id = p_created_by_member_id AND trip_id = v_trip.id
  ) THEN
    RAISE EXCEPTION 'Membro criador não pertence a esta viagem.' USING ERRCODE = '22023';
  END IF;

  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'Divisão de cotas inválida ou vazia.' USING ERRCODE = '22023';
  END IF;

  FOR v_split IN SELECT * FROM jsonb_to_recordset(p_splits) AS x(member_id uuid, share_cents int)
  LOOP
    IF v_split.share_cents IS NULL OR v_split.share_cents < 0 THEN
      RAISE EXCEPTION 'Valor de cota inválido: deve ser não negativo.' USING ERRCODE = '22023';
    END IF;
    IF v_split.member_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE id = v_split.member_id AND trip_id = v_trip.id
    ) THEN
      RAISE EXCEPTION 'Participante da cota não pertence a esta viagem.' USING ERRCODE = '22023';
    END IF;
    v_total_split_cents := v_total_split_cents + v_split.share_cents;
  END LOOP;

  IF v_total_split_cents <> p_amount_cents THEN
    RAISE EXCEPTION 'A soma das cotas (%) deve ser exatamente igual ao valor total (%)', v_total_split_cents, p_amount_cents USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.trip_expenses (
    trip_id,
    paid_by_member_id,
    amount_cents,
    description,
    category_name,
    expense_date,
    split_type,
    receipt_url,
    created_by_member_id
  ) VALUES (
    v_trip.id,
    p_paid_by_member_id,
    p_amount_cents,
    trim(p_description),
    coalesce(nullif(trim(p_category_name), ''), 'Geral'),
    coalesce(p_expense_date, current_date),
    coalesce(p_split_type, 'equal'),
    p_receipt_url,
    p_created_by_member_id
  ) RETURNING id INTO v_expense_id;

  INSERT INTO public.trip_expense_splits (expense_id, member_id, share_cents)
  SELECT
    v_expense_id,
    x.member_id,
    x.share_cents
  FROM jsonb_to_recordset(p_splits) AS x(member_id uuid, share_cents int);

  RETURN jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid, text) TO anon, authenticated, service_role;

-- 10.4 record_trip_settlements: valida que from_member_id e to_member_id pertencem à viagem e amount_cents > 0
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

  IF p_settlements IS NULL OR jsonb_typeof(p_settlements) <> 'array' THEN
    RAISE EXCEPTION 'Lista de acertos inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_settlements) AS x(from_member_id uuid, to_member_id uuid, amount_cents int)
    WHERE coalesce(x.amount_cents, 0) <= 0
       OR x.from_member_id IS NULL
       OR x.to_member_id IS NULL
       OR x.from_member_id = x.to_member_id
       OR NOT EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.id = x.from_member_id AND tm.trip_id = p_trip_id)
       OR NOT EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.id = x.to_member_id AND tm.trip_id = p_trip_id)
  ) THEN
    RAISE EXCEPTION 'Acerto contém membros fora da viagem ou valores inválidos.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.trip_settlements
  WHERE trip_id = p_trip_id AND status = 'pending';

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

  UPDATE public.trips
  SET status = 'settling', updated_at = timezone('utc'::text, now())
  WHERE id = p_trip_id AND status IN ('planning', 'active');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_trip_settlements(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_trip_settlements(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
