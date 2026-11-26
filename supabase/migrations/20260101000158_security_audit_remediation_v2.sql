-- ============================================================================
-- Migration: 20260101000158_security_audit_remediation_v2.sql
-- Remediação integral da Auditoria de Segurança (5 Categorias — Axir v3.30.0)
--
-- Itens endereçados:
--   [F-01] Substitui 6 políticas RLS administrativas inline (sem status='active')
--          por (select public.is_admin()) + FORCE ROW LEVEL SECURITY:
--          support_tickets, admin_telegram_settings, app_analytics_events,
--          billing_webhook_logs e billing_intents.
--   [F-02] Cria public.assert_active_superadmin_aal2(text) e endurece
--          admin_delete_user e admin_reset_user_mfa (status='active', AAL2 e
--          bloqueio de exclusão direta de outro superadmin).
--   [F-03] Exige public.can_current_user_write_module('cards') em
--          upsert_statement_layout_blueprint e record_statement_blueprint_outcome.
--   [F-05] Adiciona trip_passcode_rate_limits + verify_trip_passcode_guarded(),
--          migra hashes legados para bcrypt e remove fallback em texto plano nas
--          RPCs get_public_trip_ledger, add_public_trip_expense e claim_trip_member.
--   [F-11] Valida esquema https:// (max 1000 chars) para p_receipt_url em
--          add_public_trip_expense.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. [F-01] Hardening de Políticas RLS Administrativas (exigir status='active')
-- ----------------------------------------------------------------------------

-- 1.1 public.support_tickets
DROP POLICY IF EXISTS "Admins can view and manage all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can view and manage all support tickets"
  ON public.support_tickets
  FOR ALL
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

-- 1.2 public.admin_telegram_settings
ALTER TABLE public.admin_telegram_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view telegram settings" ON public.admin_telegram_settings;
CREATE POLICY "Admins can view telegram settings"
  ON public.admin_telegram_settings
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

DROP POLICY IF EXISTS "Admins can update telegram settings" ON public.admin_telegram_settings;
CREATE POLICY "Admins can update telegram settings"
  ON public.admin_telegram_settings
  FOR ALL
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

-- 1.3 public.app_analytics_events
DROP POLICY IF EXISTS "Admins can view analytics events" ON public.app_analytics_events;
CREATE POLICY "Admins can view analytics events"
  ON public.app_analytics_events
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

-- 1.4 public.billing_webhook_logs
ALTER TABLE public.billing_webhook_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores leem billing_webhook_logs" ON public.billing_webhook_logs;
CREATE POLICY "Apenas administradores leem billing_webhook_logs"
  ON public.billing_webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

-- 1.5 public.billing_intents
ALTER TABLE public.billing_intents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários leem apenas suas próprias billing_intents" ON public.billing_intents;
CREATE POLICY "Usuários leem apenas suas próprias billing_intents"
  ON public.billing_intents
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (
      (select auth.uid()) IS NOT NULL
      AND (select public.is_admin())
    )
  );


-- ----------------------------------------------------------------------------
-- 2. [F-02] Hardening de RPCs Destrutivas/Sensíveis de Superadmin (AAL2 + Ativo)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_active_superadmin_aal2(p_action_label text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_has_verified_mfa boolean := false;
  v_aal text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado.'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadministradores ativos possuem permissão para %.', coalesce(p_action_label, 'executar esta ação')
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM auth.mfa_factors
     WHERE user_id = v_caller_id
       AND status = 'verified'
  ) INTO v_has_verified_mfa;

  IF v_has_verified_mfa THEN
    v_aal := coalesce(auth.jwt() ->> 'aal', 'aal1');
    IF v_aal <> 'aal2' THEN
      RAISE EXCEPTION 'Verificação de segundo fator (MFA/2FA AAL2) obrigatória para %.', coalesce(p_action_label, 'esta operação')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_caller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_active_superadmin_aal2(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_role public.user_role;
  v_host_trip_ids uuid[];
  v_owner_family_ids uuid[];
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadministradores ativos podem excluir contas de outros usuários.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_id := public.assert_active_superadmin_aal2('excluir contas de outros usuários');

  IF target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Para excluir sua própria conta, utilize o fluxo de autoexclusão.';
  END IF;

  SELECT role INTO v_target_role
    FROM public.profiles
   WHERE id = target_user_id;

  IF v_target_role = 'superadmin'::public.user_role THEN
    RAISE EXCEPTION 'Não é permitido excluir outra conta superadministradora diretamente.'
      USING ERRCODE = '42501';
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
    DELETE FROM public.trip_passcode_rate_limits WHERE trip_id = ANY(v_host_trip_ids);
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

CREATE OR REPLACE FUNCTION public.admin_reset_user_mfa(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_deleted_count integer := 0;
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadministradores ativos possuem permissão para desativar autenticadores 2FA.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_id := public.assert_active_superadmin_aal2('desativar autenticadores 2FA');

  -- Remove os fatores MFA associados ao usuário alvo de forma atômica
  DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = row_count;

  -- Registra compulsoriamente a ação na trilha de auditoria LGPD
  INSERT INTO public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) VALUES (
    v_caller_id,
    'profiles',
    target_user_id,
    'ADMIN_RESET_MFA',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'factors_removed', v_deleted_count,
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_mfa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_mfa(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. [F-03] Exigir permissão de escrita 'cards' nas RPCs de Blueprints (0156)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_statement_layout_blueprint(
  p_fingerprint text,
  p_issuer_key text,
  p_issuer_name text,
  p_file_kind text,
  p_rules_json jsonb
)
RETURNS public.statement_layout_blueprints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_fingerprint text := trim(coalesce(p_fingerprint, ''));
  v_issuer_key text := lower(trim(coalesce(p_issuer_key, '')));
  v_issuer_name text := trim(coalesce(p_issuer_name, ''));
  v_voter_hash text;
  v_is_trusted boolean;
  v_user_bp public.statement_layout_blueprints;
  v_prev_global public.statement_layout_blueprints;
  v_distinct_ok integer := 0;
  v_trusted_ok integer := 0;
  v_total_hits integer := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('cards') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_fingerprint) < 6 OR char_length(v_fingerprint) > 120 OR v_fingerprint ~ '[0-9]{11}' THEN
    RAISE EXCEPTION 'Fingerprint de layout inválido.';
  END IF;

  IF v_issuer_key !~ '^[a-z0-9_]{2,64}$' THEN
    RAISE EXCEPTION 'issuer_key inválido.';
  END IF;

  IF char_length(v_issuer_name) < 2 OR char_length(v_issuer_name) > 80 OR v_issuer_name ~ '[0-9]{4}|@' THEN
    RAISE EXCEPTION 'issuer_name inválido.';
  END IF;

  IF p_file_kind NOT IN ('pdf_text', 'text') THEN
    RAISE EXCEPTION 'file_kind inválido: %', coalesce(p_file_kind, '<null>');
  END IF;

  PERFORM public.validate_statement_blueprint_rules_json(p_rules_json);

  -- 1. Persiste/atualiza imediatamente no escopo do usuário (Trial e Pro)
  INSERT INTO public.statement_layout_blueprints (
    fingerprint,
    issuer_key,
    issuer_name,
    file_kind,
    scope,
    owner_user_id,
    status,
    rules_json,
    exact_checksum_hits,
    distinct_users_verified,
    distinct_users_failed,
    consecutive_failures
  ) VALUES (
    v_fingerprint,
    v_issuer_key,
    v_issuer_name,
    p_file_kind,
    'user',
    v_user_id,
    'active',
    p_rules_json,
    1,
    1,
    0,
    0
  )
  ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
    issuer_key = EXCLUDED.issuer_key,
    issuer_name = EXCLUDED.issuer_name,
    file_kind = EXCLUDED.file_kind,
    status = 'active',
    rules_json = EXCLUDED.rules_json,
    exact_checksum_hits = public.statement_layout_blueprints.exact_checksum_hits + 1,
    consecutive_failures = 0,
    updated_at = now()
  RETURNING * INTO v_user_bp;

  -- 2. Registra voto anônimo irreversível do usuário (zero PII)
  v_voter_hash := encode(sha256(convert_to(v_user_id::text || ':' || v_fingerprint, 'UTF8')), 'hex');
  v_is_trusted := public.is_trusted_blueprint_voter(v_user_id);

  INSERT INTO public.statement_layout_blueprint_votes (
    fingerprint,
    voter_hash,
    is_trusted_account,
    last_outcome,
    hits_count,
    consecutive_failures,
    updated_at
  ) VALUES (
    v_fingerprint,
    v_voter_hash,
    v_is_trusted,
    'success',
    1,
    0,
    now()
  )
  ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
    is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
    last_outcome = 'success',
    hits_count = public.statement_layout_blueprint_votes.hits_count + 1,
    consecutive_failures = 0,
    updated_at = now();

  SELECT
    count(*) FILTER (WHERE last_outcome = 'success'),
    count(*) FILTER (WHERE last_outcome = 'success' AND is_trusted_account),
    coalesce(sum(hits_count), 1)
  INTO v_distinct_ok, v_trusted_ok, v_total_hits
  FROM public.statement_layout_blueprint_votes
  WHERE fingerprint = v_fingerprint;

  SELECT *
    INTO v_prev_global
    FROM public.statement_layout_blueprints
   WHERE scope = 'global'
     AND owner_user_id IS NULL
     AND fingerprint = v_fingerprint;

  -- 3. Promoção Anti-Sybil vs fila pending_review Admin
  IF v_trusted_ok >= 2 THEN
    INSERT INTO public.statement_layout_blueprints (
      fingerprint,
      issuer_key,
      issuer_name,
      file_kind,
      scope,
      owner_user_id,
      status,
      rules_json,
      exact_checksum_hits,
      distinct_users_verified,
      distinct_users_failed,
      consecutive_failures,
      promoted_at
    ) VALUES (
      v_fingerprint,
      v_issuer_key,
      v_issuer_name,
      p_file_kind,
      'global',
      NULL,
      'active',
      p_rules_json,
      v_total_hits,
      v_distinct_ok,
      0,
      0,
      now()
    )
    ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
      issuer_key = EXCLUDED.issuer_key,
      issuer_name = EXCLUDED.issuer_name,
      file_kind = EXCLUDED.file_kind,
      status = 'active',
      rules_json = EXCLUDED.rules_json,
      exact_checksum_hits = greatest(public.statement_layout_blueprints.exact_checksum_hits + 1, v_total_hits),
      distinct_users_verified = v_distinct_ok,
      distinct_users_failed = 0,
      consecutive_failures = 0,
      promoted_at = coalesce(public.statement_layout_blueprints.promoted_at, now()),
      updated_at = now();

    IF v_prev_global.id IS NULL
       OR v_prev_global.status <> 'active'
       OR v_prev_global.rules_json IS DISTINCT FROM p_rules_json THEN
      DELETE FROM public.statement_layout_blueprint_votes
       WHERE fingerprint = v_fingerprint
         AND last_outcome = 'failure';
    END IF;
  ELSIF v_prev_global.id IS NULL THEN
    INSERT INTO public.statement_layout_blueprints (
      fingerprint,
      issuer_key,
      issuer_name,
      file_kind,
      scope,
      owner_user_id,
      status,
      rules_json,
      exact_checksum_hits,
      distinct_users_verified,
      distinct_users_failed,
      consecutive_failures
    ) VALUES (
      v_fingerprint,
      v_issuer_key,
      v_issuer_name,
      p_file_kind,
      'global',
      NULL,
      'pending_review',
      p_rules_json,
      v_total_hits,
      v_distinct_ok,
      0,
      0
    )
    ON CONFLICT (scope, owner_user_id, fingerprint) DO NOTHING;
  ELSE
    UPDATE public.statement_layout_blueprints
       SET exact_checksum_hits = greatest(exact_checksum_hits + 1, v_total_hits),
           distinct_users_verified = greatest(distinct_users_verified, v_distinct_ok),
           rules_json = CASE WHEN status = 'pending_review' THEN p_rules_json ELSE rules_json END,
           updated_at = now()
     WHERE id = v_prev_global.id;
  END IF;

  RETURN v_user_bp;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_statement_layout_blueprint(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_statement_layout_blueprint(text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_statement_blueprint_outcome(
  p_blueprint_id uuid,
  p_exact_checksum_hit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_bp public.statement_layout_blueprints;
  v_prev_global public.statement_layout_blueprints;
  v_voter_hash text;
  v_is_trusted boolean;
  v_distinct_ok integer := 0;
  v_trusted_ok integer := 0;
  v_trusted_fail integer := 0;
  v_total_hits integer := 1;
  v_new_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('cards') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_bp
    FROM public.statement_layout_blueprints
   WHERE id = p_blueprint_id
     AND (scope = 'global' OR owner_user_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blueprint não encontrado ou inacessível.';
  END IF;

  v_voter_hash := encode(sha256(convert_to(v_user_id::text || ':' || v_bp.fingerprint, 'UTF8')), 'hex');
  v_is_trusted := public.is_trusted_blueprint_voter(v_user_id);

  IF coalesce(p_exact_checksum_hit, false) THEN
    INSERT INTO public.statement_layout_blueprint_votes (
      fingerprint,
      voter_hash,
      is_trusted_account,
      last_outcome,
      hits_count,
      consecutive_failures,
      updated_at
    ) VALUES (
      v_bp.fingerprint,
      v_voter_hash,
      v_is_trusted,
      'success',
      1,
      0,
      now()
    )
    ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
      is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
      last_outcome = 'success',
      hits_count = public.statement_layout_blueprint_votes.hits_count + 1,
      consecutive_failures = 0,
      updated_at = now();

    SELECT
      count(*) FILTER (WHERE last_outcome = 'success'),
      count(*) FILTER (WHERE last_outcome = 'success' AND is_trusted_account),
      coalesce(sum(hits_count), 1)
    INTO v_distinct_ok, v_trusted_ok, v_total_hits
    FROM public.statement_layout_blueprint_votes
    WHERE fingerprint = v_bp.fingerprint;

    UPDATE public.statement_layout_blueprints
       SET exact_checksum_hits = exact_checksum_hits + 1,
           consecutive_failures = 0,
           distinct_users_verified = greatest(distinct_users_verified, v_distinct_ok),
           updated_at = now()
     WHERE id = v_bp.id;

    SELECT *
      INTO v_prev_global
      FROM public.statement_layout_blueprints
     WHERE scope = 'global'
       AND owner_user_id IS NULL
       AND fingerprint = v_bp.fingerprint;

    IF v_trusted_ok >= 2 THEN
      INSERT INTO public.statement_layout_blueprints (
        fingerprint,
        issuer_key,
        issuer_name,
        file_kind,
        scope,
        owner_user_id,
        status,
        rules_json,
        exact_checksum_hits,
        distinct_users_verified,
        distinct_users_failed,
        consecutive_failures,
        promoted_at
      ) VALUES (
        v_bp.fingerprint,
        v_bp.issuer_key,
        v_bp.issuer_name,
        v_bp.file_kind,
        'global',
        NULL,
        'active',
        v_bp.rules_json,
        v_total_hits,
        v_distinct_ok,
        0,
        0,
        now()
      )
      ON CONFLICT (scope, owner_user_id, fingerprint) DO UPDATE SET
        status = 'active',
        rules_json = v_bp.rules_json,
        exact_checksum_hits = greatest(public.statement_layout_blueprints.exact_checksum_hits, v_total_hits),
        distinct_users_verified = v_distinct_ok,
        distinct_users_failed = 0,
        consecutive_failures = 0,
        promoted_at = coalesce(public.statement_layout_blueprints.promoted_at, now()),
        updated_at = now();

      IF v_prev_global.id IS NULL
         OR v_prev_global.status <> 'active'
         OR v_prev_global.rules_json IS DISTINCT FROM v_bp.rules_json THEN
        DELETE FROM public.statement_layout_blueprint_votes
         WHERE fingerprint = v_bp.fingerprint
           AND last_outcome = 'failure';
      END IF;

      v_new_status := 'active';
    ELSIF v_prev_global.id IS NULL THEN
      INSERT INTO public.statement_layout_blueprints (
        fingerprint,
        issuer_key,
        issuer_name,
        file_kind,
        scope,
        owner_user_id,
        status,
        rules_json,
        exact_checksum_hits,
        distinct_users_verified,
        distinct_users_failed,
        consecutive_failures
      ) VALUES (
        v_bp.fingerprint,
        v_bp.issuer_key,
        v_bp.issuer_name,
        v_bp.file_kind,
        'global',
        NULL,
        'pending_review',
        v_bp.rules_json,
        v_total_hits,
        v_distinct_ok,
        0,
        0
      )
      ON CONFLICT (scope, owner_user_id, fingerprint) DO NOTHING;

      v_new_status := v_bp.status;
    ELSE
      v_new_status := v_bp.status;
    END IF;
  ELSE
    INSERT INTO public.statement_layout_blueprint_votes (
      fingerprint,
      voter_hash,
      is_trusted_account,
      last_outcome,
      hits_count,
      consecutive_failures,
      updated_at
    ) VALUES (
      v_bp.fingerprint,
      v_voter_hash,
      v_is_trusted,
      'failure',
      0,
      1,
      now()
    )
    ON CONFLICT (fingerprint, voter_hash) DO UPDATE SET
      is_trusted_account = public.statement_layout_blueprint_votes.is_trusted_account OR EXCLUDED.is_trusted_account,
      last_outcome = 'failure',
      consecutive_failures = public.statement_layout_blueprint_votes.consecutive_failures + 1,
      updated_at = now();

    SELECT count(*) FILTER (WHERE last_outcome = 'failure' AND is_trusted_account)
      INTO v_trusted_fail
      FROM public.statement_layout_blueprint_votes
     WHERE fingerprint = v_bp.fingerprint;

    IF v_bp.scope = 'user' THEN
      v_new_status := CASE
        WHEN v_bp.consecutive_failures + 1 >= 2 THEN 'suspended'
        ELSE v_bp.status
      END;

      UPDATE public.statement_layout_blueprints
         SET consecutive_failures = consecutive_failures + 1,
             status = v_new_status,
             updated_at = now()
       WHERE id = v_bp.id;
    ELSE
      v_new_status := CASE
        WHEN v_trusted_fail >= 2 THEN 'suspended'
        ELSE v_bp.status
      END;

      UPDATE public.statement_layout_blueprints
         SET consecutive_failures = consecutive_failures + 1,
             distinct_users_failed = v_trusted_fail,
             status = v_new_status,
             updated_at = now()
       WHERE id = v_bp.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'blueprint_id', v_bp.id,
    'scope', v_bp.scope,
    'status', v_new_status,
    'distinct_users_verified', v_distinct_ok,
    'trusted_users_verified', v_trusted_ok,
    'trusted_users_failed', v_trusted_fail
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_statement_blueprint_outcome(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_statement_blueprint_outcome(uuid, boolean) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. [F-05 + F-11] Rate limit em passcodes de viagens, migração bcrypt e URL https://
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trip_passcode_rate_limits (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, window_start)
);

ALTER TABLE public.trip_passcode_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_passcode_rate_limits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_passcode_rate_limits_admin_select" ON public.trip_passcode_rate_limits;
CREATE POLICY "trip_passcode_rate_limits_admin_select"
  ON public.trip_passcode_rate_limits
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );

REVOKE ALL ON TABLE public.trip_passcode_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.trip_passcode_rate_limits TO authenticated;
GRANT ALL ON TABLE public.trip_passcode_rate_limits TO service_role;

-- Migra eventuais passcodes legados sem prefixo bcrypt para bcrypt ($2a/$2b)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'trips'
       AND column_name = 'passcode_hash'
  ) THEN
    UPDATE public.trips
       SET passcode_hash = extensions.crypt(passcode_hash, extensions.gen_salt('bf', 10))
     WHERE passcode_hash IS NOT NULL
       AND passcode_hash <> ''
       AND passcode_hash NOT LIKE '$2%';
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    UPDATE public.trips
       SET passcode_hash = public.crypt(passcode_hash, public.gen_salt('bf', 10))
     WHERE passcode_hash IS NOT NULL
       AND passcode_hash <> ''
       AND passcode_hash NOT LIKE '$2%';
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_trip_passcode_guarded(
  p_trip_id uuid,
  p_passcode_hash text,
  p_candidate text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_window_start timestamptz;
  v_failures integer := 0;
BEGIN
  IF p_passcode_hash IS NULL OR p_passcode_hash = '' THEN
    RETURN true;
  END IF;

  IF p_trip_id IS NULL THEN
    RETURN false;
  END IF;

  -- Janela fixa de 15 minutos por viagem (teto: 5 tentativas falhas)
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / 900) * 900);

  DELETE FROM public.trip_passcode_rate_limits
   WHERE window_start < (now() - interval '24 hours');

  SELECT coalesce(failed_attempts, 0)
    INTO v_failures
    FROM public.trip_passcode_rate_limits
   WHERE trip_id = p_trip_id
     AND window_start = v_window_start;

  IF coalesce(v_failures, 0) >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED: Muitas tentativas incorretas de código de acesso. Aguarde 15 minutos.'
      USING ERRCODE = '42501';
  END IF;

  -- Probe inicial (p_candidate nulo/vazio) sinaliza requires_passcode sem consumir tentativas
  IF p_candidate IS NULL OR p_candidate = '' THEN
    RETURN false;
  END IF;

  IF p_passcode_hash LIKE '$2%' AND crypt(p_candidate, p_passcode_hash) = p_passcode_hash THEN
    RETURN true;
  END IF;

  INSERT INTO public.trip_passcode_rate_limits (trip_id, window_start, failed_attempts, updated_at)
  VALUES (p_trip_id, v_window_start, 1, now())
  ON CONFLICT (trip_id, window_start) DO UPDATE
  SET failed_attempts = public.trip_passcode_rate_limits.failed_attempts + 1,
      updated_at = now();

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_trip_passcode_guarded(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- 4.1 get_public_trip_ledger sem fallback em texto plano e com rate limiting
CREATE OR REPLACE FUNCTION public.get_public_trip_ledger(
  p_token text,
  p_passcode text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_trip record;
  v_members jsonb;
  v_expenses jsonb;
  v_settlements jsonb;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_trip
    FROM public.trips
   WHERE public_token = p_token;

  IF v_trip IS NULL THEN
    RETURN null;
  END IF;

  IF v_trip.passcode_hash IS NOT NULL AND v_trip.passcode_hash <> '' THEN
    IF NOT public.verify_trip_passcode_guarded(v_trip.id, v_trip.passcode_hash, p_passcode) THEN
      RETURN jsonb_build_object(
        'requires_passcode', true,
        'trip_title', v_trip.title
      );
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'is_host', m.is_host,
      'has_axis_account', (m.user_id IS NOT NULL),
      'pix_key', m.pix_key,
      'pix_key_type', m.pix_key_type
    ) ORDER BY m.is_host DESC, m.name ASC
  ), '[]'::jsonb) INTO v_members
    FROM public.trip_members m
   WHERE m.trip_id = v_trip.id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'paid_by_member_id', e.paid_by_member_id,
      'amount_cents', e.amount_cents,
      'description', e.description,
      'category_name', e.category_name,
      'expense_date', e.expense_date,
      'split_type', e.split_type,
      'receipt_url', e.receipt_url,
      'created_at', e.created_at,
      'splits', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'member_id', s.member_id,
            'share_cents', s.share_cents
          )
        )
        FROM public.trip_expense_splits s
        WHERE s.expense_id = e.id
      ), '[]'::jsonb)
    ) ORDER BY e.expense_date DESC, e.created_at DESC
  ), '[]'::jsonb) INTO v_expenses
    FROM public.trip_expenses e
   WHERE e.trip_id = v_trip.id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'from_member_id', s.from_member_id,
      'to_member_id', s.to_member_id,
      'amount_cents', s.amount_cents,
      'status', s.status,
      'confirmed_at', s.confirmed_at
    ) ORDER BY s.created_at ASC
  ), '[]'::jsonb) INTO v_settlements
    FROM public.trip_settlements s
   WHERE s.trip_id = v_trip.id;

  RETURN jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'destination', v_trip.destination,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'status', v_trip.status,
      'currency', v_trip.currency,
      'public_token', v_trip.public_token,
      'cover_photo_url', v_trip.cover_photo_url,
      'has_passcode', (v_trip.passcode_hash IS NOT NULL AND v_trip.passcode_hash <> '')
    ),
    'members', v_members,
    'expenses', v_expenses,
    'settlements', v_settlements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_trip_ledger(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trip_ledger(text, text) TO anon, authenticated, service_role;

-- 4.2 add_public_trip_expense sem fallback em texto plano, com rate limit e validação https:// em p_receipt_url
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
  v_clean_receipt_url text := nullif(trim(coalesce(p_receipt_url, '')), '');
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

  IF v_clean_receipt_url IS NOT NULL THEN
    IF char_length(v_clean_receipt_url) > 1000 OR v_clean_receipt_url !~* '^https://' THEN
      RAISE EXCEPTION 'URL de comprovante inválida: apenas endereços https:// são permitidos.'
        USING ERRCODE = '22023';
    END IF;
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
    IF NOT public.verify_trip_passcode_guarded(v_trip.id, v_trip.passcode_hash, p_passcode) THEN
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
    v_clean_receipt_url,
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

-- 4.3 claim_trip_member sem fallback em texto plano e com rate limit
CREATE OR REPLACE FUNCTION public.claim_trip_member(
  p_trip_token text,
  p_member_id uuid,
  p_passcode text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trip record;
  v_member record;
  v_user_pix text;
  v_user_pix_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário precisa estar autenticado para vincular conta.';
  END IF;

  SELECT id, passcode_hash, status INTO v_trip
    FROM public.trips
   WHERE public_token = p_trip_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Viagem não encontrada para o token informado.';
  END IF;

  IF v_trip.passcode_hash IS NOT NULL AND v_trip.passcode_hash <> '' THEN
    IF NOT public.verify_trip_passcode_guarded(v_trip.id, v_trip.passcode_hash, p_passcode) THEN
      RAISE EXCEPTION 'INVALID_PASSCODE: Código de acesso incorreto.';
    END IF;
  END IF;

  SELECT id, user_id, trip_id INTO v_member
    FROM public.trip_members
   WHERE id = p_member_id AND trip_id = v_trip.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Participante não encontrado nesta viagem.';
  END IF;

  IF v_member.user_id IS NOT NULL AND v_member.user_id <> v_user_id THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED: Este participante já está vinculado a outra conta.';
  END IF;

  SELECT
    custom_settings->>'defaultPixKey',
    custom_settings->>'defaultPixKeyType'
    INTO v_user_pix, v_user_pix_type
    FROM public.user_preferences
   WHERE user_id = v_user_id;

  IF v_user_pix IS NULL THEN
    SELECT pix_key, pix_key_type
      INTO v_user_pix, v_user_pix_type
      FROM public.family_members
     WHERE user_id = v_user_id AND pix_key IS NOT NULL
     LIMIT 1;
  END IF;

  UPDATE public.trip_members
     SET user_id = v_user_id,
         pix_key = coalesce(pix_key, v_user_pix),
         pix_key_type = coalesce(pix_key_type, v_user_pix_type)
   WHERE id = p_member_id;

  INSERT INTO public.user_preferences (user_id, custom_settings)
  VALUES (v_user_id, jsonb_build_object('tripModeEnabled', true))
  ON CONFLICT (user_id) DO UPDATE
  SET custom_settings = jsonb_set(
    coalesce(public.user_preferences.custom_settings, '{}'::jsonb),
    '{tripModeEnabled}',
    'true'::jsonb,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', v_trip.id,
    'member_id', p_member_id,
    'user_id', v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_trip_member(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_trip_member(text, uuid, text) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- Recarrega schema do PostgREST
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
