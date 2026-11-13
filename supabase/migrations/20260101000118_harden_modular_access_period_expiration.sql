-- ============================================================================
-- Migration: 20260101000118_harden_modular_access_period_expiration.sql
-- Descrição: Endurecimento da verificação de expiração de período no RLS/permissões
--            modulares e rotina de reconciliação de assinaturas expiradas.
-- ============================================================================

-- 1. Atualizar get_user_module_access garantindo que o status 'active' para planos
-- recorrentes (pro_monthly, pro_annual) seja estritamente condicionado a current_period_end > now().
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

  -- Assinatura ativa:
  -- Lifetime tem acesso de escrita perpétuo.
  -- Pro Mensal e Pro Anual exigem que o período vigente não tenha expirado (current_period_end > now()).
  if v_sub.status = 'active'::public.subscription_status then
    if v_sub.tier = 'lifetime'::public.subscription_tier then
      return 'write'::public.access_level;
    elsif v_sub.tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
      if v_sub.current_period_end is null or v_sub.current_period_end > now() then
        return 'write'::public.access_level;
      else
        return 'read'::public.access_level;
      end if;
    end if;
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

-- 2. Rotina de reconciliação de assinaturas expiradas (executável por cron ou Edge Functions)
create or replace function public.reconcile_expired_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated_count integer := 0;
  v_step_count integer := 0;
begin
  -- Expira assinaturas com cancelamento agendado cujo current_period_end já passou
  with expired_active as (
    update public.user_subscriptions
    set status = 'canceled'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        cancel_at_period_end = false,
        updated_at = now()
    where status = 'active'::public.subscription_status
      and cancel_at_period_end = true
      and current_period_end is not null
      and current_period_end <= now()
    returning id
  )
  select count(*) into v_step_count from expired_active;
  v_updated_count := v_updated_count + v_step_count;

  -- Expira trials vencidos que não possuem plano futuro agendado
  with expired_trials as (
    update public.user_subscriptions
    set status = 'expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        trial_consumed_at = coalesce(trial_consumed_at, now()),
        updated_at = now()
    where tier = 'trial'::public.subscription_tier
      and status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      and trial_ends_at is not null
      and trial_ends_at <= now()
      and scheduled_plan_id is null
    returning id
  )
  select count(*) into v_step_count from expired_trials;
  v_updated_count := v_updated_count + v_step_count;

  return v_updated_count;
end;
$$;
