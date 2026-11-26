-- =============================================================================
-- Migration 0164: Onda 1 — Segurança, RLS, Governança AAL2 e restore_backup
-- =============================================================================
-- Endereça T1.1, T1.2 e T1.3 do Plano Mestre de Correções:
--   - T1.1: Revoga SELECT de anon em public_shares, exige is_current_user_active()
--           e can_current_user_write() nas policies, e remove user_id do retorno
--           de get_public_share_by_token().
--   - T1.2: Exige MFA AAL2 incondicional em assert_active_superadmin_aal2(),
--           protege concessão lifetime em admin_set_user_subscription(),
--           revoga escrita direta de authenticated em plans/access_invites/audit_events,
--           endurece support_tickets, app_analytics_events, user_push_subscriptions
--           e categories, e cria RPC validate_access_invite().
--   - T1.3: Reescreve restore_backup() com pg_temp._id_map (ON COMMIT DROP),
--           rejeição de old_id duplicado, remapeamento de PKs/FKs, validação de
--           simetria de transfer_pair_id e reset de app.allow_pair_mutation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. [T1.1] public.public_shares: revogar anon e endurecer RLS + RPC
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.public_shares FROM anon;

DROP POLICY IF EXISTS "public_shares_select" ON public.public_shares;
CREATE POLICY "public_shares_select"
  ON public.public_shares
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "public_shares_insert" ON public.public_shares;
CREATE POLICY "public_shares_insert"
  ON public.public_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

DROP POLICY IF EXISTS "public_shares_update" ON public.public_shares;
CREATE POLICY "public_shares_update"
  ON public.public_shares
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

DROP POLICY IF EXISTS "public_shares_delete" ON public.public_shares;
CREATE POLICY "public_shares_delete"
  ON public.public_shares
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

CREATE OR REPLACE FUNCTION public.get_public_share_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_token text;
  v_share record;
BEGIN
  v_clean_token := trim(coalesce(p_token, ''));
  v_clean_token := regexp_replace(v_clean_token, '[?#].*$', '');
  v_clean_token := regexp_replace(v_clean_token, '^/+|/+$', '', 'g');
  v_clean_token := regexp_replace(v_clean_token, '[\.,;:!\s/]+$', '');
  v_clean_token := regexp_replace(v_clean_token, '[^a-zA-Z0-9_-]', '', 'g');

  IF v_clean_token = ''
     OR length(v_clean_token) NOT BETWEEN 6 AND 64
     OR NOT (v_clean_token ~ '^[a-zA-Z0-9_-]+$') THEN
    RETURN NULL;
  END IF;

  SELECT
    id,
    kind,
    token,
    payload,
    created_at,
    expires_at,
    is_revoked,
    updated_at,
    expense_id,
    installment_group_id,
    debt_id
  INTO v_share
  FROM public.public_shares
  WHERE token = v_clean_token
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > now())
    AND NOT (
      kind = 'split'
      AND (
        coalesce((payload->>'is_completed')::boolean, false) = true
        OR coalesce((payload->>'public_page_paused')::boolean, false) = true
      )
    )
  LIMIT 1;

  IF NOT FOUND OR v_share IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_share.id,
    'kind', v_share.kind,
    'token', v_share.token,
    'payload', v_share.payload,
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at,
    'is_revoked', v_share.is_revoked,
    'updated_at', v_share.updated_at,
    'expense_id', v_share.expense_id,
    'installment_group_id', v_share.installment_group_id,
    'debt_id', v_share.debt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_share_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_share_by_token(text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. [T1.2] Governança Superadmin (AAL2 incondicional) & RLS auxiliar
-- -----------------------------------------------------------------------------
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

  v_aal := coalesce(auth.jwt() ->> 'aal', 'aal1');
  IF NOT v_has_verified_mfa OR v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'Verificação de segundo fator (MFA/2FA AAL2) obrigatória e ativa para %.', coalesce(p_action_label, 'esta operação')
      USING ERRCODE = '42501';
  END IF;

  RETURN v_caller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_active_superadmin_aal2(text) FROM PUBLIC, anon, authenticated;

-- Endurece admin_set_user_subscription: concessão de lifetime exige Superadmin com AAL2
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
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tier = 'lifetime'::public.subscription_tier OR lower(trim(coalesce(p_plan_id, ''))) = 'lifetime' THEN
    PERFORM public.assert_active_superadmin_aal2('conceder assinatura vitalícia');
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_target_role = 'superadmin'::public.user_role AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas um superadministrador pode alterar contas superadmin.'
      USING ERRCODE = '42501';
  END IF;

  SELECT trial_ends_at, current_period_end
  INTO v_existing_trial_ends_at, v_existing_current_period_end
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

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

-- Revoga escrita direta de authenticated em plans, access_invites e audit_events
DROP POLICY IF EXISTS "Admins gerenciam planos" ON public.plans;
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM authenticated;

DROP POLICY IF EXISTS "Admins gerenciam convites" ON public.access_invites;
CREATE POLICY "Admins leem convites"
  ON public.access_invites
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_admin())
  );
REVOKE INSERT, UPDATE, DELETE ON public.access_invites FROM authenticated;

DROP POLICY IF EXISTS "audit_events_insert_own" ON public.audit_events;
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_client_audit_event(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_uid,
    left(coalesce(nullif(trim(p_entity_type), ''), 'client'), 80),
    left(coalesce(nullif(trim(p_entity_id), ''), v_uid::text), 120),
    left(coalesce(nullif(trim(p_action), ''), 'event'), 80),
    coalesce(p_payload, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_client_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_client_audit_event(text, text, text, jsonb) TO authenticated;

-- Endurece support_tickets (exige usuário ativo, bloqueia DELETE e alteração de status pelo usuário)
DROP POLICY IF EXISTS "Users can insert own support tickets" ON public.support_tickets;
CREATE POLICY "Users can insert own support tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view own support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Users can update own support tickets" ON public.support_tickets;
CREATE POLICY "Users can update own support tickets"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Users can delete own support tickets" ON public.support_tickets;
REVOKE DELETE ON public.support_tickets FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_support_ticket_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     OR NEW.admin_replied_at IS DISTINCT FROM OLD.admin_replied_at
     OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Usuários não podem alterar status ou campos administrativos do chamado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_support_ticket_user_update ON public.support_tickets;
CREATE TRIGGER trg_guard_support_ticket_user_update
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_support_ticket_user_update();

-- Endurece app_analytics_events (exige usuário ativo e user_id = auth.uid())
DROP POLICY IF EXISTS "Users can insert own analytics events" ON public.app_analytics_events;
CREATE POLICY "Users can insert own analytics events"
  ON public.app_analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select public.is_current_user_active())
    AND user_id = (select auth.uid())
  );

-- Endurece user_push_subscriptions (exige is_current_user_active())
DROP POLICY IF EXISTS "user_push_subscriptions_select_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_select_own"
  ON public.user_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "user_push_subscriptions_insert_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_insert_own"
  ON public.user_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "user_push_subscriptions_update_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_update_own"
  ON public.user_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

DROP POLICY IF EXISTS "user_push_subscriptions_delete_own" ON public.user_push_subscriptions;
CREATE POLICY "user_push_subscriptions_delete_own"
  ON public.user_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

-- Endurece categories (separa SELECT de escrita com can_current_user_write())
DROP POLICY IF EXISTS "categories_all_own" ON public.categories;
CREATE POLICY "categories_select_own"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
  );

CREATE POLICY "categories_insert_own"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

CREATE POLICY "categories_update_own"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

CREATE POLICY "categories_delete_own"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select public.is_current_user_active())
    AND (select public.can_current_user_write())
  );

-- RPC pública para validação segura de convite de acesso (sem expor colunas internas)
CREATE OR REPLACE FUNCTION public.validate_access_invite(
  p_code text,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_code text := upper(trim(coalesce(p_code, '')));
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_invite record;
BEGIN
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Código de convite não informado.');
  END IF;

  SELECT
    is_active,
    expires_at,
    max_uses,
    uses_count,
    allowed_email
  INTO v_invite
  FROM public.access_invites
  WHERE upper(trim(code)) = v_clean_code
  LIMIT 1;

  IF NOT FOUND OR v_invite IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Código de convite inválido ou indisponível.');
  END IF;

  IF NOT coalesce(v_invite.is_active, false)
     OR (v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now())
     OR (v_invite.max_uses IS NOT NULL AND coalesce(v_invite.uses_count, 0) >= v_invite.max_uses) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Código de convite inválido ou indisponível.');
  END IF;

  IF v_invite.allowed_email IS NOT NULL AND trim(v_invite.allowed_email) <> '' THEN
    IF v_clean_email = '' OR lower(trim(v_invite.allowed_email)) <> v_clean_email THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'Código de convite inválido ou indisponível.');
    END IF;
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_access_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_access_invite(text, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. [T1.3] public.restore_backup: remapeamento de UUIDs sem oráculo 23505
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb := coalesce(p_backup -> 'data', p_backup);
  v_counts jsonb;
  v_max_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
  v_dup_count integer := 0;
  v_asymmetric_pairs integer := 0;
  v_table text;
  v_tables text[] := ARRAY[
    'categories', 'credit_cards', 'portfolio_assets', 'card_competence_overrides',
    'card_bill_rollovers', 'incomes', 'expenses', 'debts', 'card_payments',
    'budgets', 'income_goals', 'insight_feedback', 'reminder_states',
    'portfolio_dividends', 'portfolio_transactions', 'user_dividend_events',
    'portfolio_dividend_dismissals', 'portfolio_snapshots', 'portfolio_contributions',
    'class_targets', 'sector_targets', 'asset_prices', 'cash_checkpoints'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
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

  CREATE TEMP TABLE pg_temp._id_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE pg_temp._group_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  -- Registra todos os PKs do JSON e rejeita old_id duplicado
  FOREACH v_table IN ARRAY v_tables LOOP
    IF jsonb_typeof(v_data -> v_table) = 'array' THEN
      BEGIN
        INSERT INTO pg_temp._id_map (old_id, new_id)
        SELECT (elem ->> 'id')::uuid, gen_random_uuid()
        FROM jsonb_array_elements(v_data -> v_table) AS elem
        WHERE nullif(trim(coalesce(elem ->> 'id', '')), '') IS NOT NULL;
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Backup inválido: IDs duplicados detectados na entidade %.', v_table
          USING ERRCODE = '22023';
      END;
    END IF;
  END LOOP;

  -- Mapeia IDs de agrupamento/pareamento (installment_group_id, group_id, batch_id, transfer_pair_id)
  INSERT INTO pg_temp._group_map (old_id, new_id)
  SELECT DISTINCT gid, gen_random_uuid()
  FROM (
    SELECT (elem ->> 'installment_group_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'expenses', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'installment_group_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'installment_group_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'debts', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'installment_group_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'group_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'card_bill_rollovers', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'group_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'batch_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'batch_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'batch_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'batch_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'transfer_pair_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'incomes', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'transfer_pair_id', '')), '') IS NOT NULL
    UNION
    SELECT (elem ->> 'transfer_pair_id')::uuid AS gid
    FROM jsonb_array_elements(coalesce(v_data -> 'expenses', '[]'::jsonb)) elem
    WHERE nullif(trim(coalesce(elem ->> 'transfer_pair_id', '')), '') IS NOT NULL
  ) g
  ON CONFLICT (old_id) DO NOTHING;

  -- Valida simetria e integridade de transfer_pair_id (escopos PF/PJ distintos e valores equivalentes)
  WITH pair_rows AS (
    SELECT
      i.transfer_pair_id AS pair_id,
      'income'::text AS side,
      coalesce(nullif(i.scope, ''), 'personal') AS scope,
      i.value::numeric AS amount
    FROM jsonb_populate_recordset(NULL::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
    WHERE i.transfer_pair_id IS NOT NULL
    UNION ALL
    SELECT
      e.transfer_pair_id AS pair_id,
      'expense'::text AS side,
      coalesce(nullif(e.scope, ''), 'personal') AS scope,
      e.value::numeric AS amount
    FROM jsonb_populate_recordset(NULL::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
    WHERE e.transfer_pair_id IS NOT NULL
  ),
  pair_summary AS (
    SELECT
      pair_id,
      count(*) AS total_rows,
      count(*) FILTER (WHERE side = 'income') AS income_rows,
      count(*) FILTER (WHERE side = 'expense') AS expense_rows,
      count(DISTINCT scope) AS distinct_scopes,
      min(amount) AS min_amount,
      max(amount) AS max_amount
    FROM pair_rows
    GROUP BY pair_id
  )
  SELECT count(*) INTO v_asymmetric_pairs
  FROM pair_summary
  WHERE total_rows <> 2
     OR income_rows <> 1
     OR expense_rows <> 1
     OR distinct_scopes <> 2
     OR abs(coalesce(max_amount, 0) - coalesce(min_amount, 0)) > 0.0001;

  IF v_asymmetric_pairs > 0 THEN
    RAISE EXCEPTION 'Backup inválido: pares transfer_pair_id órfãos ou assimétricos detectados.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.snapshot_rpc', 'on', true);
  PERFORM set_config('app.dividend_tracking_rpc', 'on', true);

  -- 1) Apaga os dados atuais do usuário (ordem segura de dependências FK)
  DELETE FROM public.user_dividend_events WHERE user_id = v_uid;
  DELETE FROM public.portfolio_dividend_dismissals WHERE user_id = v_uid;
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
  DELETE FROM public.card_bill_rollovers WHERE user_id = v_uid;
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

  -- 2) Insere tabelas pais com novos UUIDs gerados em _id_map
  INSERT INTO public.categories (id, user_id, type, name, icon, color, is_reserved, is_active, scope)
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, c.type, c.name, c.icon, c.color, c.is_reserved, c.is_active,
    coalesce(nullif(c.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb)) c
  LEFT JOIN pg_temp._id_map m ON m.old_id = c.id;

  INSERT INTO public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits, scope)
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, cc.name, cc.brand, cc.credit_limit, cc.closing_day, cc.due_day, cc.color, cc.is_active, cc.last_four_digits,
    coalesce(nullif(cc.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb)) cc
  LEFT JOIN pg_temp._id_map m ON m.old_id = cc.id;

  INSERT INTO public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    total_cost_brl, average_cost_brl, fx_rate_at_purchase,
    ceiling_price, ceiling_method, ceiling_metadata,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary,
    dividends_start_date
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    pa.total_cost_brl,
    pa.average_cost_brl,
    pa.fx_rate_at_purchase,
    pa.ceiling_price,
    pa.ceiling_method,
    pa.ceiling_metadata,
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
    pa.thesis_summary,
    CASE
      WHEN pa.dividends_start_date IS NOT NULL
       AND pa.dividends_start_date >= DATE '2000-01-01'
       AND pa.dividends_start_date <= v_max_date
      THEN pa.dividends_start_date
      ELSE NULL
    END
  FROM jsonb_populate_recordset(NULL::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  LEFT JOIN pg_temp._id_map m ON m.old_id = pa.id
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
    CASE
      WHEN jsonb_typeof(custom_settings->'dividendAutomation') = 'object'
       AND (custom_settings->'dividendAutomation') ? 'trackingStartDate'
       AND public.parse_valid_dividend_date(custom_settings->'dividendAutomation'->>'trackingStartDate') IS NULL
      THEN jsonb_set(
        coalesce(custom_settings, '{}'::jsonb),
        '{dividendAutomation}',
        (custom_settings->'dividendAutomation') - 'trackingStartDate',
        true
      )
      ELSE coalesce(custom_settings, '{}'::jsonb)
    END,
    coalesce(nullif(app_mode, ''), 'investor')
  FROM jsonb_populate_recordset(NULL::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com FKs reescritas via _id_map
  INSERT INTO public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  SELECT coalesce(m.new_id, gen_random_uuid()), c.id, o.month, o.closing_day, o.due_day
  FROM jsonb_populate_recordset(NULL::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  LEFT JOIN pg_temp._id_map m ON m.old_id = o.id
  JOIN pg_temp._id_map mc ON mc.old_id = o.card_id
  JOIN public.credit_cards c ON c.id = mc.new_id AND c.user_id = v_uid;

  INSERT INTO public.card_bill_rollovers (
    id, user_id, card_id, from_competence_month, to_competence_month,
    principal_amount, kind, group_id, note, created_at
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    cc.id,
    r.from_competence_month,
    r.to_competence_month,
    r.principal_amount,
    coalesce(nullif(r.kind, ''), 'rollover'),
    coalesce(gm.new_id, gen_random_uuid()),
    r.note,
    coalesce(r.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.card_bill_rollovers, coalesce(v_data -> 'card_bill_rollovers', '[]'::jsonb)) r
  LEFT JOIN pg_temp._id_map m ON m.old_id = r.id
  LEFT JOIN pg_temp._group_map gm ON gm.old_id = r.group_id
  JOIN pg_temp._id_map mcc ON mcc.old_id = r.card_id
  JOIN public.credit_cards cc ON cc.id = mcc.new_id AND cc.user_id = v_uid;

  -- Bloco restrito para pares de transferência (ativa e reseta app.allow_pair_mutation)
  PERFORM set_config('app.allow_pair_mutation', 'true', true);

  INSERT INTO public.incomes (
    id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at,
    scope, is_internal_transfer, transfer_pair_id, transfer_kind
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, i.value, i.date, cat.id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at,
    coalesce(nullif(i.scope, ''), 'personal'),
    coalesce(i.is_internal_transfer, false),
    pm.new_id,
    i.transfer_kind
  FROM jsonb_populate_recordset(NULL::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  LEFT JOIN pg_temp._id_map m ON m.old_id = i.id
  LEFT JOIN pg_temp._group_map pm ON pm.old_id = i.transfer_pair_id
  JOIN pg_temp._id_map mcat ON mcat.old_id = i.category_id
  JOIN public.categories cat ON cat.id = mcat.new_id AND cat.user_id = v_uid;

  INSERT INTO public.expenses (
    id, user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at,
    charge_kind, scope, is_internal_transfer, transfer_pair_id, transfer_kind, is_tax_deductible,
    rollover_id
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, e.value, e.date, cat.id, e.payment_method, cc.id,
    e.installments_total, e.installment_number, gm.new_id,
    e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at,
    coalesce(nullif(e.charge_kind, ''), 'regular'),
    coalesce(nullif(e.scope, ''), 'personal'),
    coalesce(e.is_internal_transfer, false),
    pm.new_id,
    e.transfer_kind,
    coalesce(e.is_tax_deductible, false),
    r.id
  FROM jsonb_populate_recordset(NULL::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  LEFT JOIN pg_temp._id_map m ON m.old_id = e.id
  LEFT JOIN pg_temp._group_map gm ON gm.old_id = e.installment_group_id
  LEFT JOIN pg_temp._group_map pm ON pm.old_id = e.transfer_pair_id
  JOIN pg_temp._id_map mcat ON mcat.old_id = e.category_id
  JOIN public.categories cat ON cat.id = mcat.new_id AND cat.user_id = v_uid
  LEFT JOIN pg_temp._id_map mcc ON mcc.old_id = e.card_id
  LEFT JOIN public.credit_cards cc ON cc.id = mcc.new_id AND cc.user_id = v_uid
  LEFT JOIN pg_temp._id_map mr ON mr.old_id = e.rollover_id
  LEFT JOIN public.card_bill_rollovers r ON r.id = mr.new_id AND r.user_id = v_uid
  WHERE e.card_id IS NULL OR cc.id IS NOT NULL;

  PERFORM set_config('app.allow_pair_mutation', 'false', true);

  INSERT INTO public.debts (
    id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at,
    charge_kind, scope
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, e.id, gm.new_id, d.created_at,
    coalesce(nullif(d.charge_kind, ''), 'regular'),
    coalesce(nullif(d.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d
  LEFT JOIN pg_temp._id_map m ON m.old_id = d.id
  LEFT JOIN pg_temp._group_map gm ON gm.old_id = d.installment_group_id
  LEFT JOIN pg_temp._id_map me ON me.old_id = d.expense_id
  LEFT JOIN public.expenses e ON e.id = me.new_id AND e.user_id = v_uid
  WHERE d.expense_id IS NULL OR e.id IS NOT NULL;

  INSERT INTO public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, cc.id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  FROM jsonb_populate_recordset(NULL::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  LEFT JOIN pg_temp._id_map m ON m.old_id = cp.id
  JOIN pg_temp._id_map mcc ON mcc.old_id = cp.card_id
  JOIN public.credit_cards cc ON cc.id = mcc.new_id AND cc.user_id = v_uid;

  INSERT INTO public.budgets (id, user_id, category_id, month, "limit")
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, cat.id, b.month, b."limit"
  FROM jsonb_populate_recordset(NULL::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  LEFT JOIN pg_temp._id_map m ON m.old_id = b.id
  JOIN pg_temp._id_map mcat ON mcat.old_id = b.category_id
  JOIN public.categories cat ON cat.id = mcat.new_id AND cat.user_id = v_uid;

  INSERT INTO public.income_goals (id, user_id, category_id, month, expected)
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, cat.id, ig.month, ig.expected
  FROM jsonb_populate_recordset(NULL::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  LEFT JOIN pg_temp._id_map m ON m.old_id = ig.id
  JOIN pg_temp._id_map mcat ON mcat.old_id = ig.category_id
  JOIN public.categories cat ON cat.id = mcat.new_id AND cat.user_id = v_uid;

  INSERT INTO public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, inf.occurrence_key, inf.decision, inf.created_at
  FROM jsonb_populate_recordset(NULL::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb)) inf
  LEFT JOIN pg_temp._id_map m ON m.old_id = inf.id;

  INSERT INTO public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, rs.occurrence_key, rs.kind, rs.snooze_until, rs.created_at, rs.updated_at
  FROM jsonb_populate_recordset(NULL::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb)) rs
  LEFT JOIN pg_temp._id_map m ON m.old_id = rs.id;

  INSERT INTO public.portfolio_dividends (
    id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount,
    request_id, entry_origin, created_at
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    pa.id,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    pd.request_id,
    'restore',
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN pg_temp._id_map m ON m.old_id = pd.id
  LEFT JOIN pg_temp._id_map mpa ON mpa.old_id = pd.asset_id
  LEFT JOIN public.portfolio_assets pa ON pa.id = mpa.new_id AND pa.user_id = v_uid;

  INSERT INTO public.portfolio_transactions (
    id, user_id, asset_id, type, date, quantity, price, total,
    total_cost_brl, fx_rate, notes, batch_id, linked_dividend_id
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()), v_uid, pa.id, pt.type, pt.date, pt.quantity, pt.price, pt.total,
    pt.total_cost_brl, pt.fx_rate, pt.notes, gm.new_id, pd.id
  FROM jsonb_populate_recordset(NULL::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  LEFT JOIN pg_temp._id_map m ON m.old_id = pt.id
  LEFT JOIN pg_temp._group_map gm ON gm.old_id = pt.batch_id
  JOIN pg_temp._id_map mpa ON mpa.old_id = pt.asset_id
  JOIN public.portfolio_assets pa ON pa.id = mpa.new_id AND pa.user_id = v_uid
  LEFT JOIN pg_temp._id_map mpd ON mpd.old_id = pt.linked_dividend_id
  LEFT JOIN public.portfolio_dividends pd ON pd.id = mpd.new_id AND pd.user_id = v_uid;

  INSERT INTO public.user_dividend_events (
    id, user_id, corporate_dividend_id, asset_id, ticker, type, status,
    com_date, payment_date, quantity_on_com_date, gross_rate, net_rate, tax_rate_pct,
    gross_amount, net_amount, currency, fx_rate_applied, settled_dividend_id,
    settlement_origin, dismiss_reason, is_manual, is_type_uncertain, manual_review_required,
    notes, revision, created_at, updated_at
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    cd.id,
    pa.id,
    upper(trim(ude.ticker)),
    CASE
      WHEN upper(trim(coalesce(ude.type, ''))) IN ('DIVIDENDO','JCP','RENDIMENTO','SOBRA','AMORTIZACAO','OUTROS')
      THEN upper(trim(ude.type))
      ELSE 'DIVIDENDO'
    END,
    CASE
      WHEN upper(trim(coalesce(ude.status, ''))) IN ('PROVISIONED','PENDING_CONFIRMATION','SETTLED','DISMISSED')
      THEN upper(trim(ude.status))
      ELSE 'PROVISIONED'
    END,
    ude.com_date,
    ude.payment_date,
    coalesce(ude.quantity_on_com_date, 0),
    coalesce(ude.gross_rate, 0),
    coalesce(ude.net_rate, 0),
    coalesce(ude.tax_rate_pct, 0),
    coalesce(ude.gross_amount, 0),
    coalesce(ude.net_amount, 0),
    CASE WHEN upper(trim(coalesce(ude.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
    ude.fx_rate_applied,
    pd.id,
    CASE
      WHEN ude.settlement_origin IN ('auto', 'manual', 'dedup') THEN ude.settlement_origin
      ELSE NULL
    END,
    ude.dismiss_reason,
    coalesce(ude.is_manual, false),
    coalesce(ude.is_type_uncertain, false),
    coalesce(ude.manual_review_required, false),
    ude.notes,
    greatest(1, coalesce(ude.revision, 1)),
    coalesce(ude.created_at, now()),
    coalesce(ude.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.user_dividend_events, coalesce(v_data -> 'user_dividend_events', '[]'::jsonb)) ude
  LEFT JOIN pg_temp._id_map m ON m.old_id = ude.id
  JOIN pg_temp._id_map mpa ON mpa.old_id = ude.asset_id
  JOIN public.portfolio_assets pa ON pa.id = mpa.new_id AND pa.user_id = v_uid
  LEFT JOIN public.corporate_dividends cd ON cd.id = ude.corporate_dividend_id
  LEFT JOIN pg_temp._id_map mpd ON mpd.old_id = ude.settled_dividend_id
  LEFT JOIN public.portfolio_dividends pd ON pd.id = mpd.new_id AND pd.user_id = v_uid;

  UPDATE public.portfolio_dividends pd
  SET source_event_id = ude.id
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) src
  JOIN pg_temp._id_map mpd ON mpd.old_id = src.id
  JOIN pg_temp._id_map mude ON mude.old_id = src.source_event_id
  JOIN public.user_dividend_events ude ON ude.id = mude.new_id AND ude.user_id = v_uid
  WHERE pd.id = mpd.new_id
    AND pd.user_id = v_uid
    AND src.source_event_id IS NOT NULL;

  INSERT INTO public.portfolio_dividend_dismissals (id, user_id, corporate_dividend_id, reason, dismissed_at)
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    pdd.corporate_dividend_id,
    coalesce(nullif(pdd.reason, ''), 'manual_ignore'),
    coalesce(pdd.dismissed_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividend_dismissals, coalesce(v_data -> 'portfolio_dividend_dismissals', '[]'::jsonb)) pdd
  LEFT JOIN pg_temp._id_map m ON m.old_id = pdd.id
  JOIN public.corporate_dividends cd ON cd.id = pdd.corporate_dividend_id
  ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

  INSERT INTO public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
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
  FROM jsonb_populate_recordset(NULL::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps
  LEFT JOIN pg_temp._id_map m ON m.old_id = ps.id;

  INSERT INTO public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, batch_id, created_at)
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    pa.id,
    pc.date,
    pc.amount,
    pc.notes,
    gm.new_id,
    coalesce(pc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  LEFT JOIN pg_temp._id_map m ON m.old_id = pc.id
  LEFT JOIN pg_temp._group_map gm ON gm.old_id = pc.batch_id
  LEFT JOIN pg_temp._id_map mpa ON mpa.old_id = pc.asset_id
  LEFT JOIN public.portfolio_assets pa ON pa.id = mpa.new_id AND pa.user_id = v_uid;

  INSERT INTO public.class_targets (id, user_id, group_type, name, target_percentage)
  SELECT coalesce(m.new_id, gen_random_uuid()), v_uid, coalesce(nullif(ct.group_type, ''), 'class'), ct.name, ct.target_percentage
  FROM jsonb_populate_recordset(NULL::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb)) ct
  LEFT JOIN pg_temp._id_map m ON m.old_id = ct.id
  WHERE lower(trim(coalesce(ct.name, ''))) <> 'caixa';

  INSERT INTO public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    coalesce(nullif(st.group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(st.class_name, '')), ''), 'Ações'),
    st.name,
    st.target_percentage
  FROM jsonb_populate_recordset(NULL::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb)) st
  LEFT JOIN pg_temp._id_map m ON m.old_id = st.id;

  INSERT INTO public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, provider, market_price_at, updated_at)
  SELECT DISTINCT ON (upper(trim(ap.ticker)))
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    upper(trim(ap.ticker)),
    coalesce(ap.manual_price, ap.price),
    CASE WHEN upper(trim(coalesce(ap.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
    'manual',
    coalesce(ap.manual_price, ap.price),
    'manual',
    coalesce(ap.market_price_at, ap.updated_at, now()),
    coalesce(ap.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  LEFT JOIN pg_temp._id_map m ON m.old_id = ap.id
  WHERE ap.user_id IS NOT NULL
    AND nullif(trim(coalesce(ap.ticker, '')), '') IS NOT NULL
    AND (ap.source = 'manual' OR ap.manual_price IS NOT NULL)
    AND coalesce(ap.manual_price, ap.price, 0) > 0
  ORDER BY upper(trim(ap.ticker)), coalesce(ap.updated_at, now()) DESC
  ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE
  SET price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      source = 'manual',
      manual_price = EXCLUDED.manual_price,
      provider = 'manual',
      market_price_at = EXCLUDED.market_price_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at, scope)
  SELECT
    coalesce(m.new_id, gen_random_uuid()),
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now()),
    coalesce(nullif(cc.scope, ''), 'personal')
  FROM jsonb_populate_recordset(NULL::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc
  LEFT JOIN pg_temp._id_map m ON m.old_id = cc.id;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  SELECT jsonb_build_object(
    'categories', (SELECT count(*) FROM public.categories WHERE user_id = v_uid),
    'credit_cards', (SELECT count(*) FROM public.credit_cards WHERE user_id = v_uid),
    'incomes', (SELECT count(*) FROM public.incomes WHERE user_id = v_uid),
    'expenses', (SELECT count(*) FROM public.expenses WHERE user_id = v_uid),
    'card_bill_rollovers', (SELECT count(*) FROM public.card_bill_rollovers WHERE user_id = v_uid),
    'debts', (SELECT count(*) FROM public.debts WHERE user_id = v_uid),
    'portfolio_assets', (SELECT count(*) FROM public.portfolio_assets WHERE user_id = v_uid),
    'portfolio_dividends', (SELECT count(*) FROM public.portfolio_dividends WHERE user_id = v_uid),
    'user_dividend_events', (SELECT count(*) FROM public.user_dividend_events WHERE user_id = v_uid),
    'class_targets', (SELECT count(*) FROM public.class_targets WHERE user_id = v_uid),
    'sector_targets', (SELECT count(*) FROM public.sector_targets WHERE user_id = v_uid)
  ) INTO v_counts;

  RETURN jsonb_build_object('success', true, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
