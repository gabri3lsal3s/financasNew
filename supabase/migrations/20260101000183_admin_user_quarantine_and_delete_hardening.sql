-- ============================================================================
-- Migration 0183: Quarentena (soft-delete), restauração e hardening de
--                 exclusão definitiva de usuários (admin_delete_user)
-- ============================================================================

-- 1. Colunas de quarentena / soft-delete em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- 2. Atualizar admin_issue_step_up_challenge para aceitar 'quarantine_user'
CREATE OR REPLACE FUNCTION public.admin_issue_step_up_challenge(
  p_operation text,
  p_target_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private_auth, extensions, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_session_id uuid;
  v_op text := trim(coalesce(p_operation, ''));
  v_target text := trim(coalesce(p_target_ref, ''));
  v_token text;
  v_hash text;
  v_challenge_id uuid;
  v_expires_at timestamptz := now() + interval '5 minutes';
BEGIN
  v_uid := public.assert_active_superadmin_aal2('emitir confirmação step-up administrativa');

  IF v_op NOT IN ('delete_user', 'quarantine_user', 'restore_user', 'reset_mfa', 'revoke_sessions') THEN
    RAISE EXCEPTION 'Operação administrativa não suportada para step-up.';
  END IF;

  IF v_target = '' THEN
    RAISE EXCEPTION 'Alvo da operação é obrigatório para emissão de step-up.';
  END IF;

  BEGIN
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_session_id := null;
  END;

  IF NOT private_auth.has_valid_admin_portal_grant(v_uid, v_session_id, 'admin_portal') THEN
    RAISE EXCEPTION 'Concessão ativa do portal administrativo não localizada.'
      USING ERRCODE = '42501';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex');

  INSERT INTO private_auth.admin_step_up_challenges (
    user_id,
    auth_session_id,
    operation,
    target_ref,
    challenge_token_hash,
    expires_at
  ) VALUES (
    v_uid,
    v_session_id,
    v_op,
    v_target,
    v_hash,
    v_expires_at
  )
  RETURNING id INTO v_challenge_id;

  RETURN jsonb_build_object(
    'challenge_id', v_challenge_id,
    'step_up_token', v_token,
    'operation', v_op,
    'target_ref', v_target,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_step_up_challenge(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_step_up_challenge(text, text) TO authenticated, service_role;

-- 3. RPC: Colocar usuário em quarentena (soft-delete)
CREATE OR REPLACE FUNCTION public.admin_quarantine_user(
  target_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_role public.user_role;
  v_clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadministradores ativos podem colocar usuários em quarentena.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_id := public.assert_active_superadmin_aal2('colocar usuário em quarentena');

  IF target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Não é permitido colocar a própria conta em quarentena.';
  END IF;

  SELECT role INTO v_target_role
    FROM public.profiles
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado.';
  END IF;

  IF v_target_role = 'superadmin'::public.user_role THEN
    RAISE EXCEPTION 'Não é permitido colocar outra conta superadministradora em quarentena.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET status = 'suspended',
         suspended_reason = COALESCE(v_clean_reason, 'Conta em quarentena administrativa'),
         deleted_at = now(),
         deleted_by = v_caller_id,
         delete_reason = v_clean_reason,
         updated_at = now()
   WHERE id = target_user_id;

  UPDATE public.user_devices
     SET is_revoked = true
   WHERE user_id = target_user_id
     AND is_revoked = false;

  UPDATE public.user_push_subscriptions
     SET is_active = false
   WHERE user_id = target_user_id
     AND is_active = true;

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
    'ADMIN_QUARANTINE_USER',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'reason', COALESCE(v_clean_reason, 'Conta em quarentena administrativa'),
      'timestamp', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quarantine_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quarantine_user(uuid, text) TO authenticated, service_role;

-- 4. RPC: Restaurar usuário da quarentena / suspensão
CREATE OR REPLACE FUNCTION public.admin_restore_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_role public.user_role;
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadministradores ativos podem restaurar contas de usuários.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_id := public.assert_active_superadmin_aal2('restaurar usuário');

  SELECT role INTO v_target_role
    FROM public.profiles
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado.';
  END IF;

  UPDATE public.profiles
     SET status = 'active',
         suspended_reason = null,
         deleted_at = null,
         deleted_by = null,
         delete_reason = null,
         updated_at = now()
   WHERE id = target_user_id;

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
    'ADMIN_RESTORE_USER',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'timestamp', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated, service_role;

-- 5. RPC: Exclusão definitiva de usuário (hardening topológico completo)
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
  -- Nota: billing_processed_payments e billing_intents são preservados (ON DELETE SET NULL para retenção fiscal/anti-chargeback)
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

  -- 7B. Tabelas recentes (notificações, dispositivos, push, IA, extração, e-mail e parâmetros admin)
  DELETE FROM public.user_notification_reads WHERE user_id = target_user_id;
  DELETE FROM public.user_devices WHERE user_id = target_user_id;
  DELETE FROM public.user_push_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.push_delivery_logs WHERE user_id = target_user_id;
  DELETE FROM public.user_ai_quotas WHERE user_id = target_user_id;
  DELETE FROM public.receipt_extractions_cache WHERE user_id = target_user_id;
  DELETE FROM public.statement_blueprints WHERE owner_user_id = target_user_id;
  DELETE FROM public.transactional_email_logs WHERE user_id = target_user_id;
  UPDATE public.admin_broadcast_notifications SET created_by = null WHERE created_by = target_user_id;
  UPDATE public.system_backups SET created_by = null WHERE created_by = target_user_id;
  UPDATE public.admin_finops_monthly_params SET updated_by = null WHERE updated_by = target_user_id;
  UPDATE public.profiles SET deleted_by = null WHERE deleted_by = target_user_id;

  -- 8. Perfil e Raiz em auth.users
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;
