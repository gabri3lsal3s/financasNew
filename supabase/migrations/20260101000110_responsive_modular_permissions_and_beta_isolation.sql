-- ================================================================
-- Migration: 20260101000110_responsive_modular_permissions_and_beta_isolation.sql
-- Descrição: Permissões modulares responsivas ao plano e isolamento de funcionalidades beta.
--            1. Os módulos do plano base (overview, transactions, cards, debts,
--               budgets, investments, reports, insights, reminders) passam a ter
--               seu acesso derivado dinamicamente do tier e status da assinatura.
--            2. As permissões modulares granulares (user_module_permissions) ficam
--               restritas a funcionalidades experimentais/beta (ex: bank_notification_listener)
--               para usuários selecionados, sem acionar whitelist que bloqueie o plano base.
--            3. admin_set_user_subscription higieniza automaticamente overrides legados
--               de módulos core ao atualizar o plano de um usuário.
--            4. Remove registros manuais legados de módulos core em user_module_permissions.
-- ================================================================

create or replace function public.get_user_module_access(
  p_user_id uuid,
  p_module_key text
)
returns public.access_level
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_status public.user_status;
  v_feature_globally_enabled boolean;
  v_default_enabled boolean;
  v_override public.access_level;
  v_sub record;
  v_is_core_module boolean;
begin
  -- 1. Se a feature estiver desativada globalmente (Kill-Switch), o acesso é 'none'
  select is_globally_enabled, coalesce(default_enabled_for_new_users, true)
  into v_feature_globally_enabled, v_default_enabled
  from public.system_features
  where key = p_module_key;

  if v_feature_globally_enabled is false then
    return 'none'::public.access_level;
  end if;

  -- 2. Consulta perfil e status da conta
  select role, status into v_role, v_status
  from public.profiles
  where id = p_user_id;

  if not found or v_status in ('suspended'::public.user_status, 'banned'::public.user_status, 'pending_approval'::public.user_status) then
    return 'none'::public.access_level;
  end if;

  -- Superadmin e admin têm permissão administrativa completa
  if v_role in ('superadmin'::public.user_role, 'admin'::public.user_role) then
    return 'admin'::public.access_level;
  end if;

  -- 3. Identifica se é módulo do core do plano base
  v_is_core_module := p_module_key in (
    'overview', 'transactions', 'cards', 'debts',
    'budgets', 'investments', 'reports', 'insights', 'reminders'
  );

  -- 4. Verifica se há override explícito na tabela user_module_permissions para este módulo específico
  select access_level into v_override
  from public.user_module_permissions
  where user_id = p_user_id
    and module_key = p_module_key
    and (expires_at is null or expires_at > now());

  if v_override is not null then
    return v_override;
  end if;

  -- 5. Se for funcionalidade beta (default_enabled_for_new_users = false ou beta específica) e não tem override:
  -- Fica bloqueada por padrão (restrita somente a usuários selecionados que possuem override)
  if not v_is_core_module and (v_default_enabled is false or p_module_key = 'bank_notification_listener') then
    return 'none'::public.access_level;
  end if;

  -- 6. Módulos do Plano Base: Derivação dinâmica e responsiva do status e tier da assinatura
  select tier, status, trial_ends_at, current_period_end into v_sub
  from public.user_subscriptions
  where user_id = p_user_id;

  if not found then
    -- Sem assinatura registrada -> opera no modo de somente-leitura básico
    return 'read'::public.access_level;
  end if;

  -- Assinatura ativa (Vitalício, Pro Anual ou Pro Mensal) -> Acesso total de escrita
  if v_sub.status = 'active'::public.subscription_status and
     v_sub.tier in ('lifetime'::public.subscription_tier, 'pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
    return 'write'::public.access_level;
  end if;

  -- Trial ativo (status active ou trialing dentro do prazo) -> Acesso total de escrita
  if v_sub.tier = 'trial'::public.subscription_tier and (
       v_sub.status = 'active'::public.subscription_status or
       (v_sub.status = 'trialing'::public.subscription_status and (v_sub.trial_ends_at is null or v_sub.trial_ends_at > now()))
     ) then
    return 'write'::public.access_level;
  end if;

  -- Assinatura inadimplente, cancelada, read_only_expired ou trial vencido -> Somente-leitura responsivo
  return 'read'::public.access_level;
end;
$$;

-- Atualiza admin_set_user_subscription para higienizar overrides legados de módulos core
create or replace function public.admin_set_user_subscription(
  p_user_id uuid,
  p_plan_id text,
  p_tier public.subscription_tier,
  p_status public.subscription_status,
  p_trial_ends_at timestamptz default null,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  insert into public.user_subscriptions (
    user_id,
    plan_id,
    tier,
    status,
    trial_ends_at,
    current_period_end,
    updated_at
  )
  values (
    p_user_id,
    p_plan_id,
    p_tier,
    p_status,
    p_trial_ends_at,
    p_current_period_end,
    now()
  )
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      tier = excluded.tier,
      status = excluded.status,
      trial_ends_at = excluded.trial_ends_at,
      current_period_end = excluded.current_period_end,
      updated_at = now();

  -- Higienização automática: remove overrides legados de módulos core para que o usuário
  -- responda diretamente e de forma fluida ao novo plano configurado, preservando módulos beta.
  delete from public.user_module_permissions
  where user_id = p_user_id
    and module_key in (
      'overview', 'transactions', 'cards', 'debts',
      'budgets', 'investments', 'reports', 'insights', 'reminders'
    );

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
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
end;
$$;

-- Higienização dos registros manuais legados de módulos core em user_module_permissions
delete from public.user_module_permissions
where module_key in (
  'overview', 'transactions', 'cards', 'debts',
  'budgets', 'investments', 'reports', 'insights', 'reminders'
);
