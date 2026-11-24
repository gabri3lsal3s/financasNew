-- ============================================================================
-- Migration: 20260101000153_harden_billing_rls_pii_and_lifecycle.sql
-- Descrição: Fase P1 — Hardening de Banco de Dados, RLS, PII, Retenção Fiscal,
--            Rate Limiting Anti-Card-Testing e Ciclo de Vida de Assinaturas.
--
-- Itens cobertos:
--   1. [B-07]  Restrição de INSERT/UPDATE em public.billing_intents (apenas service_role/admin)
--   2. [A-01]  Validação obrigatória de trial_ends_at > NOW() em get_user_module_access()
--   3. [A-07]  Expiração de Anual/avulso PIX e trial_scheduled órfão em reconcile_expired_subscriptions()
--   4. [D-02]  REVOKE SELECT a nível de tabela em public.profiles + GRANT em colunas não-PII
--              + RPC SECURITY DEFINER get_my_billing_contact()
--   5. [D-03]  Retenção fiscal/chargeback: ON DELETE SET NULL em billing_processed_payments e billing_intents
--   6. [D-04]  Tabela billing_rate_limits + RPC atômica check_billing_rate_limit()
--   7. [D-06]  Coluna chargeback_flagged_at em public.user_subscriptions
--   8. [D-01/D-18] Trava de exclusão com assinatura recorrente ativa em delete_current_user_account()
--              + expurgo completo de viagens/famílias/trip_members.pix_key em admin_delete_user()
--   9. [D-18]  REVOKE FROM PUBLIC + exigência de superadmin AAL2 para CPF completo
--              em admin_get_user_contact_details()
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. [B-07] HARDENING RLS EM public.billing_intents
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Apenas service role e admins inserem billing_intents" ON public.billing_intents;
CREATE POLICY "Apenas service role e admins inserem billing_intents"
  ON public.billing_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Apenas service role e admins atualizam billing_intents" ON public.billing_intents;
CREATE POLICY "Apenas service role e admins atualizam billing_intents"
  ON public.billing_intents
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_intents FROM anon;
GRANT ALL ON TABLE public.billing_intents TO service_role;


-- ----------------------------------------------------------------------------
-- 2. [A-01] HARDENING DE get_user_module_access (VALIDAÇÃO ESTRITA DE TRIAL)
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

  -- Trial só concede escrita dentro de trial_ends_at > NOW(), independente de status ('trialing' ou 'active')
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
-- 3. [A-07] ATUALIZAÇÃO DE public.reconcile_expired_subscriptions()
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


-- ----------------------------------------------------------------------------
-- 4. [D-02] REVOGAÇÃO REAL DE PII EM public.profiles + get_my_billing_contact()
-- ----------------------------------------------------------------------------

REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  name,
  email,
  role,
  status,
  approved_at,
  approved_by,
  suspended_reason,
  created_at
) ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO service_role;

COMMENT ON COLUMN public.profiles.cpf IS
  'PII (CPF). SELECT revogado via table-level REVOKE + column-level GRANT em profiles; acesso restrito a service_role, get_my_billing_contact() ou admin_get_user_contact_details().';
COMMENT ON COLUMN public.profiles.phone IS
  'PII (Telefone/WhatsApp). SELECT revogado via table-level REVOKE + column-level GRANT em profiles; acesso restrito a service_role, get_my_billing_contact() ou admin_get_user_contact_details().';
COMMENT ON COLUMN public.profiles.postal_code IS
  'PII (CEP). SELECT revogado via table-level REVOKE + column-level GRANT em profiles; acesso restrito a service_role ou get_my_billing_contact().';
COMMENT ON COLUMN public.profiles.address_number IS
  'PII (Número do endereço). SELECT revogado via table-level REVOKE + column-level GRANT em profiles; acesso restrito a service_role ou get_my_billing_contact().';

CREATE OR REPLACE FUNCTION public.get_my_billing_contact()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name, email, cpf, phone, postal_code, address_number
  INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'name', null,
      'email', null,
      'cpf', null,
      'masked_cpf', null,
      'phone', null,
      'postal_code', null,
      'address_number', null
    );
  END IF;

  RETURN jsonb_build_object(
    'name', v_profile.name,
    'email', v_profile.email,
    'cpf', v_profile.cpf,
    'masked_cpf', public.mask_cpf(v_profile.cpf),
    'phone', v_profile.phone,
    'postal_code', v_profile.postal_code,
    'address_number', v_profile.address_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_billing_contact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_billing_contact() TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. [D-03] RETENÇÃO FISCAL / DEFESA DE CHARGEBACK (ON DELETE SET NULL)
-- ----------------------------------------------------------------------------

ALTER TABLE public.billing_processed_payments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.billing_intents
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND a.attname = 'user_id'
      AND c.conrelid IN (
        'public.billing_processed_payments'::regclass,
        'public.billing_intents'::regclass
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', v_constraint.tbl, v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.billing_processed_payments
  ADD CONSTRAINT fk_billing_processed_payments_user_id
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.billing_intents
  ADD CONSTRAINT fk_billing_intents_user_id
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE SET NULL;


-- ----------------------------------------------------------------------------
-- 6. [D-04] RATE LIMITING ANTI-CARD-TESTING (billing_rate_limits)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.billing_rate_limits (
  scope_key text NOT NULL,
  action text NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 1 CHECK (hits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, action, window_seconds, window_start)
);

CREATE INDEX IF NOT EXISTS idx_billing_rate_limits_window_start
  ON public.billing_rate_limits (window_start);

ALTER TABLE public.billing_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_rate_limits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_rate_limits_admin_select" ON public.billing_rate_limits;
CREATE POLICY "billing_rate_limits_admin_select"
  ON public.billing_rate_limits
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.billing_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_rate_limits TO authenticated;
GRANT ALL ON TABLE public.billing_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_billing_rate_limit(
  p_user_id uuid,
  p_ip text,
  p_action text,
  p_max_attempts integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_clean_action text := left(trim(coalesce(p_action, '')), 64);
  v_clean_ip text := left(trim(coalesce(p_ip, '')), 64);
  v_max integer := greatest(1, coalesce(p_max_attempts, 5));
  v_window_sec integer := greatest(10, coalesce(p_window_seconds, 900));
  v_window_start timestamptz;
  v_user_hits integer := 0;
  v_ip_hits integer := 0;
  v_allowed boolean := false;
  v_retry_after integer := 0;
  v_has_valid_ip boolean := false;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: rate limit de faturamento é exclusivo do servidor.'
      USING ERRCODE = '42501';
  END IF;

  IF v_clean_action = '' THEN
    RAISE EXCEPTION 'p_action obrigatório para check_billing_rate_limit.'
      USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NULL AND (v_clean_ip = '' OR lower(v_clean_ip) IN ('127.0.0.1', '::1', 'unknown')) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'user_hits', 0,
      'ip_hits', 0,
      'max_attempts', v_max,
      'window_seconds', v_window_sec,
      'retry_after_seconds', v_window_sec
    );
  END IF;

  -- Limpeza oportunista de janelas antigas (> 48h)
  DELETE FROM public.billing_rate_limits
  WHERE window_start < (now() - interval '48 hours');

  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / v_window_sec) * v_window_sec);

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.billing_rate_limits (scope_key, action, window_seconds, window_start, hits, updated_at)
    VALUES ('user:' || p_user_id::text, v_clean_action, v_window_sec, v_window_start, 1, now())
    ON CONFLICT (scope_key, action, window_seconds, window_start) DO UPDATE
    SET hits = public.billing_rate_limits.hits + 1,
        updated_at = now()
    RETURNING hits INTO v_user_hits;
  END IF;

  v_has_valid_ip := v_clean_ip <> '' AND lower(v_clean_ip) NOT IN ('127.0.0.1', '::1', 'unknown');
  IF v_has_valid_ip THEN
    INSERT INTO public.billing_rate_limits (scope_key, action, window_seconds, window_start, hits, updated_at)
    VALUES ('ip:' || v_clean_ip, v_clean_action, v_window_sec, v_window_start, 1, now())
    ON CONFLICT (scope_key, action, window_seconds, window_start) DO UPDATE
    SET hits = public.billing_rate_limits.hits + 1,
        updated_at = now()
    RETURNING hits INTO v_ip_hits;
  END IF;

  v_allowed := (v_user_hits <= v_max) AND (v_ip_hits <= v_max);

  IF NOT v_allowed THEN
    v_retry_after := greatest(
      1,
      ceil(extract(epoch FROM ((v_window_start + make_interval(secs => v_window_sec)) - now())))::integer
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'user_hits', v_user_hits,
    'ip_hits', v_ip_hits,
    'max_attempts', v_max,
    'window_seconds', v_window_sec,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_billing_rate_limit(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_billing_rate_limit(uuid, text, text, integer, integer) TO service_role;


-- ----------------------------------------------------------------------------
-- 7. [D-06] FLAG DE CHARGEBACK EM public.user_subscriptions
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS chargeback_flagged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_chargeback_flagged
  ON public.user_subscriptions (chargeback_flagged_at)
  WHERE chargeback_flagged_at IS NOT NULL;

COMMENT ON COLUMN public.user_subscriptions.chargeback_flagged_at IS
  'Carimbo temporal de ocorrência de chargeback/contestação; usado pelo gateway para bloquear novas compras e concessões na conta.';


-- ----------------------------------------------------------------------------
-- 8. [D-01 & D-18] HARDENING DE delete_current_user_account() E admin_delete_user()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host_trip_ids uuid[];
  v_owner_family_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado.';
  END IF;

  -- [D-01] Bloqueia exclusão se existir assinatura recorrente ativa no gateway ainda não cancelada
  IF EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = v_user_id
      AND us.asaas_subscription_id IS NOT NULL
      AND trim(us.asaas_subscription_id) <> ''
      AND coalesce(us.cancel_at_period_end, false) = false
      AND us.status IN (
        'active'::public.subscription_status,
        'trialing'::public.subscription_status,
        'past_due'::public.subscription_status,
        'incomplete'::public.subscription_status
      )
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_EXISTS: Cancele sua assinatura recorrente ativa no gateway antes de excluir a conta para evitar cobranças futuras.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Libera o trigger de transferências pareadas para exclusão integral LGPD
  PERFORM set_config('app.allow_pair_mutation', 'true', true);

  -- 0. Desvincular despesas pessoais conectadas a viagens
  UPDATE public.expenses
  SET trip_id = null
  WHERE user_id = v_user_id AND trip_id IS NOT NULL;

  -- 1. Viagens onde o usuário é o ANFITRIÃO (host_user_id): expurgo integral
  SELECT array_agg(id) INTO v_host_trip_ids
  FROM public.trips
  WHERE host_user_id = v_user_id;

  IF v_host_trip_ids IS NOT NULL AND array_length(v_host_trip_ids, 1) > 0 THEN
    DELETE FROM public.trip_settlements WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trip_expense_splits WHERE expense_id IN (
      SELECT id FROM public.trip_expenses WHERE trip_id = ANY(v_host_trip_ids)
    );
    DELETE FROM public.trip_expenses WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trip_members WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trips WHERE id = ANY(v_host_trip_ids);
  END IF;

  -- Viagens onde o usuário é apenas PARTICIPANTE: desvincular e anonimizar PII do membro
  UPDATE public.trip_members
  SET user_id = null,
      pix_key = null,
      pix_key_type = null,
      name = 'Participante removido'
  WHERE user_id = v_user_id;

  -- 2. Famílias onde o usuário é o PROPRIETÁRIO (owner_id): expurgo integral
  SELECT array_agg(id) INTO v_owner_family_ids
  FROM public.families
  WHERE owner_id = v_user_id;

  IF v_owner_family_ids IS NOT NULL AND array_length(v_owner_family_ids, 1) > 0 THEN
    DELETE FROM public.family_settlements WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.family_invites WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.family_members WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.families WHERE id = ANY(v_owner_family_ids);
  END IF;

  -- Famílias onde o usuário era apenas membro ou convidado
  DELETE FROM public.family_invites WHERE invited_by = v_user_id OR accepted_by = v_user_id;
  DELETE FROM public.family_members WHERE user_id = v_user_id;

  -- 3. Compartilhamentos Públicos (public_shares)
  DELETE FROM public.public_shares WHERE user_id = v_user_id;

  -- 4. Investimentos e Portfólio (filhos antes dos pais)
  DELETE FROM public.portfolio_dividend_dismissals WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_monthly_prices WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_transactions WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_contributions WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_dividends WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_snapshots WHERE user_id = v_user_id;
  DELETE FROM public.allocation_presets WHERE user_id = v_user_id;
  DELETE FROM public.allocation_targets WHERE user_id = v_user_id;
  DELETE FROM public.class_targets WHERE user_id = v_user_id;
  DELETE FROM public.sector_targets WHERE user_id = v_user_id;
  DELETE FROM public.asset_prices WHERE user_id = v_user_id;
  DELETE FROM public.cash_checkpoints WHERE user_id = v_user_id;
  DELETE FROM public.portfolio_assets WHERE user_id = v_user_id;

  -- 5. Cartões, Lançamentos, Empréstimos e Recorrências
  DELETE FROM public.card_competence_overrides WHERE card_id IN (SELECT id FROM public.credit_cards WHERE user_id = v_user_id);
  DELETE FROM public.card_payments WHERE card_id IN (SELECT id FROM public.credit_cards WHERE user_id = v_user_id);
  DELETE FROM public.recurrence_skips WHERE recurrence_id IN (SELECT id FROM public.recurrences WHERE user_id = v_user_id);
  DELETE FROM public.expenses WHERE user_id = v_user_id;
  DELETE FROM public.incomes WHERE user_id = v_user_id;
  DELETE FROM public.recurrences WHERE user_id = v_user_id;
  DELETE FROM public.debts WHERE user_id = v_user_id;
  DELETE FROM public.loans WHERE user_id = v_user_id;
  DELETE FROM public.budgets WHERE user_id = v_user_id;
  DELETE FROM public.income_goals WHERE user_id = v_user_id;
  DELETE FROM public.credit_cards WHERE user_id = v_user_id;
  DELETE FROM public.categories WHERE user_id = v_user_id;

  -- 6. Lembretes, Feedbacks, Suporte e Telemetria
  DELETE FROM public.reminder_states WHERE user_id = v_user_id;
  DELETE FROM public.insight_feedback WHERE user_id = v_user_id;
  DELETE FROM public.support_tickets WHERE user_id = v_user_id;
  UPDATE public.support_tickets SET admin_id = null WHERE admin_id = v_user_id;
  DELETE FROM public.app_analytics_events WHERE user_id = v_user_id;

  -- 7. Preferências, Permissões, Assinatura, Configurações e Auditoria
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.user_feature_overrides WHERE user_id = v_user_id;
  UPDATE public.user_feature_overrides SET granted_by = null WHERE granted_by = v_user_id;
  DELETE FROM public.user_module_permissions WHERE user_id = v_user_id;
  UPDATE public.user_module_permissions SET granted_by = null WHERE granted_by = v_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = v_user_id;
  DELETE FROM public.audit_events WHERE user_id = v_user_id;
  UPDATE public.access_invites SET created_by = null WHERE created_by = v_user_id;
  UPDATE public.profiles SET approved_by = null WHERE approved_by = v_user_id;
  UPDATE public.admin_telegram_settings SET updated_by = null WHERE updated_by = v_user_id;

  -- 8. Perfil e Raiz em auth.users (billing_processed_payments e billing_intents recebem SET NULL automático)
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_current_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_current_user_account() TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_host_trip_ids uuid[];
  v_owner_family_ids uuid[];
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Apenas superadministradores podem excluir contas de outros usuários.';
  END IF;

  IF target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Para excluir sua própria conta, utilize o fluxo de autoexclusão.';
  END IF;

  -- Libera o trigger de transferências pareadas para expurgo administrativo
  PERFORM set_config('app.allow_pair_mutation', 'true', true);

  -- 0. Desvincular despesas pessoais conectadas a viagens
  UPDATE public.expenses
  SET trip_id = null
  WHERE user_id = target_user_id AND trip_id IS NOT NULL;

  -- 1. Viagens onde o usuário-alvo é o ANFITRIÃO (host_user_id): expurgo integral
  SELECT array_agg(id) INTO v_host_trip_ids
  FROM public.trips
  WHERE host_user_id = target_user_id;

  IF v_host_trip_ids IS NOT NULL AND array_length(v_host_trip_ids, 1) > 0 THEN
    DELETE FROM public.trip_settlements WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trip_expense_splits WHERE expense_id IN (
      SELECT id FROM public.trip_expenses WHERE trip_id = ANY(v_host_trip_ids)
    );
    DELETE FROM public.trip_expenses WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trip_members WHERE trip_id = ANY(v_host_trip_ids);
    DELETE FROM public.trips WHERE id = ANY(v_host_trip_ids);
  END IF;

  -- [D-18] Viagens onde o usuário-alvo é apenas PARTICIPANTE: limpar pix_key e anonimizar nome
  UPDATE public.trip_members
  SET user_id = null,
      pix_key = null,
      pix_key_type = null,
      name = 'Participante removido'
  WHERE user_id = target_user_id;

  -- 2. Famílias onde o usuário-alvo é o PROPRIETÁRIO (owner_id): expurgo integral
  SELECT array_agg(id) INTO v_owner_family_ids
  FROM public.families
  WHERE owner_id = target_user_id;

  IF v_owner_family_ids IS NOT NULL AND array_length(v_owner_family_ids, 1) > 0 THEN
    DELETE FROM public.family_settlements WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.family_invites WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.family_members WHERE family_id = ANY(v_owner_family_ids);
    DELETE FROM public.families WHERE id = ANY(v_owner_family_ids);
  END IF;

  -- Famílias onde o usuário-alvo era apenas membro ou convidado
  DELETE FROM public.family_invites WHERE invited_by = target_user_id OR accepted_by = target_user_id;
  DELETE FROM public.family_members WHERE user_id = target_user_id;

  -- 3. Compartilhamentos Públicos (public_shares)
  DELETE FROM public.public_shares WHERE user_id = target_user_id;

  -- 4. Investimentos e Portfólio (filhos antes dos pais)
  DELETE FROM public.portfolio_dividend_dismissals WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_monthly_prices WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_transactions WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_contributions WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_dividends WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_snapshots WHERE user_id = target_user_id;
  DELETE FROM public.allocation_presets WHERE user_id = target_user_id;
  DELETE FROM public.allocation_targets WHERE user_id = target_user_id;
  DELETE FROM public.class_targets WHERE user_id = target_user_id;
  DELETE FROM public.sector_targets WHERE user_id = target_user_id;
  DELETE FROM public.asset_prices WHERE user_id = target_user_id;
  DELETE FROM public.cash_checkpoints WHERE user_id = target_user_id;
  DELETE FROM public.portfolio_assets WHERE user_id = target_user_id;

  -- 5. Cartões, Lançamentos, Empréstimos e Recorrências
  DELETE FROM public.card_competence_overrides WHERE card_id IN (SELECT id FROM public.credit_cards WHERE user_id = target_user_id);
  DELETE FROM public.card_payments WHERE card_id IN (SELECT id FROM public.credit_cards WHERE user_id = target_user_id);
  DELETE FROM public.recurrence_skips WHERE recurrence_id IN (SELECT id FROM public.recurrences WHERE user_id = target_user_id);
  DELETE FROM public.expenses WHERE user_id = target_user_id;
  DELETE FROM public.incomes WHERE user_id = target_user_id;
  DELETE FROM public.recurrences WHERE user_id = target_user_id;
  DELETE FROM public.debts WHERE user_id = target_user_id;
  DELETE FROM public.loans WHERE user_id = target_user_id;
  DELETE FROM public.budgets WHERE user_id = target_user_id;
  DELETE FROM public.income_goals WHERE user_id = target_user_id;
  DELETE FROM public.credit_cards WHERE user_id = target_user_id;
  DELETE FROM public.categories WHERE user_id = target_user_id;

  -- 6. Lembretes, Feedbacks, Suporte e Telemetria
  DELETE FROM public.reminder_states WHERE user_id = target_user_id;
  DELETE FROM public.insight_feedback WHERE user_id = target_user_id;
  DELETE FROM public.support_tickets WHERE user_id = target_user_id;
  UPDATE public.support_tickets SET admin_id = null WHERE admin_id = target_user_id;
  DELETE FROM public.app_analytics_events WHERE user_id = target_user_id;

  -- 7. Preferências, Permissões, Assinatura, Configurações e Auditoria
  DELETE FROM public.user_preferences WHERE user_id = target_user_id;
  DELETE FROM public.user_feature_overrides WHERE user_id = target_user_id;
  UPDATE public.user_feature_overrides SET granted_by = null WHERE granted_by = target_user_id;
  DELETE FROM public.user_module_permissions WHERE user_id = target_user_id;
  UPDATE public.user_module_permissions SET granted_by = null WHERE granted_by = target_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.audit_events WHERE user_id = target_user_id;
  UPDATE public.access_invites SET created_by = null WHERE created_by = target_user_id;
  UPDATE public.profiles SET approved_by = null WHERE approved_by = target_user_id;
  UPDATE public.admin_telegram_settings SET updated_by = null WHERE updated_by = target_user_id;

  -- 8. Perfil e Raiz em auth.users
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 9. [D-18] HARDENING DE admin_get_user_contact_details() COM MFA AAL2
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_get_user_contact_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_caller_role public.user_role;
  v_aal text;
  v_can_reveal_full_cpf boolean := false;
  v_phone text;
  v_cpf text;
  v_email text;
  v_name text;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_admin_id;

  v_aal := coalesce(auth.jwt() ->> 'aal', 'aal1');
  v_can_reveal_full_cpf := (v_caller_role = 'superadmin'::public.user_role AND v_aal = 'aal2');

  SELECT name, email, cpf, phone
  INTO v_name, v_email, v_cpf, v_phone
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Registro compulsório de auditoria para compliance LGPD
  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_admin_id,
    'profile',
    p_user_id::text,
    'REVEAL_CONTACT_DETAILS',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'has_phone', v_phone IS NOT NULL,
      'has_cpf', v_cpf IS NOT NULL,
      'aal', v_aal,
      'full_cpf_revealed', v_can_reveal_full_cpf,
      'viewed_at', now()
    )
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'name', v_name,
    'email', v_email,
    'cpf', CASE WHEN v_can_reveal_full_cpf THEN v_cpf ELSE public.mask_cpf(v_cpf) END,
    'masked_cpf', public.mask_cpf(v_cpf),
    'phone', v_phone,
    'full_cpf_revealed', v_can_reveal_full_cpf,
    'requires_aal2', NOT v_can_reveal_full_cpf
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_contact_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_contact_details(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- Recarrega schema do PostgREST
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
