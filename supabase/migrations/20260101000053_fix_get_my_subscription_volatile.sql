-- ================================================================
-- Migration: 20260101000053_fix_get_my_subscription_volatile.sql
-- Descrição: Altera a função get_my_subscription para VOLATILE e inclui
--            tratamento defensivo contra falhas de inserção de trial.
-- ================================================================

create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
security definer
volatile
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_sub record;
  v_role public.user_role;
  v_status public.user_status;
  v_is_superadmin boolean;
  v_is_admin boolean;
  v_can_write boolean;
  v_trial_days_remaining integer := null;
  v_effective_tier public.subscription_tier;
  v_module_permissions jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select role, status into v_role, v_status
  from public.profiles
  where id = v_uid;

  v_is_superadmin := (v_role = 'superadmin'::public.user_role);
  v_is_admin := (v_role in ('admin'::public.user_role, 'superadmin'::public.user_role));

  select * into v_sub
  from public.user_subscriptions
  where user_id = v_uid;

  -- Se não existir assinatura, cria como trial padrão de 30 dias a partir de agora de forma segura
  if not found then
    begin
      insert into public.user_subscriptions (user_id, plan_id, tier, status, trial_ends_at)
      values (v_uid, 'trial', 'trial'::public.subscription_tier, 'trialing'::public.subscription_status, now() + interval '30 days')
      on conflict (user_id) do nothing
      returning * into v_sub;
    exception when others then
      -- Fallback defensivo caso concorra com outro processo
    end;

    if v_sub.user_id is null then
      select * into v_sub
      from public.user_subscriptions
      where user_id = v_uid;
    end if;
  end if;

  -- Se por qualquer motivo ainda não existir registro físico, gera objeto trial virtual em memória
  if v_sub.user_id is null then
    v_can_write := public.can_current_user_write();

    select jsonb_object_agg(
      sf.key,
      public.get_user_module_access(v_uid, sf.key)
    ) into v_module_permissions
    from public.system_features sf;

    return jsonb_build_object(
      'tier', 'trial'::public.subscription_tier,
      'status', 'trialing'::public.subscription_status,
      'plan_id', 'trial',
      'starts_at', now(),
      'trial_ends_at', now() + interval '30 days',
      'current_period_end', null,
      'trial_days_remaining', 30,
      'cancel_at_period_end', false,
      'is_full_access', (v_status = 'active'::public.user_status),
      'is_trial', true,
      'is_pro', false,
      'is_lifetime', false,
      'is_read_only', false,
      'can_write', v_can_write,
      'module_permissions', coalesce(v_module_permissions, '{}'::jsonb)
    );
  end if;

  -- Calcula dias restantes de trial se estiver em trial
  if v_sub.tier = 'trial'::public.subscription_tier and v_sub.trial_ends_at is not null then
    v_trial_days_remaining := greatest(0, ceil(extract(epoch from (v_sub.trial_ends_at - now())) / 86400)::integer);
    if v_trial_days_remaining = 0 and v_sub.status = 'trialing'::public.subscription_status then
      v_effective_tier := 'read_only'::public.subscription_tier;
    else
      v_effective_tier := v_sub.tier;
    end if;
  else
    v_effective_tier := v_sub.tier;
  end if;

  v_can_write := public.can_current_user_write();

  -- Mapeamento consolidado de permissões por módulo
  select jsonb_object_agg(
    sf.key,
    public.get_user_module_access(v_uid, sf.key)
  ) into v_module_permissions
  from public.system_features sf;

  return jsonb_build_object(
    'tier', v_effective_tier,
    'status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'starts_at', v_sub.starts_at,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_end', v_sub.current_period_end,
    'trial_days_remaining', v_trial_days_remaining,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'is_full_access', (v_can_write and v_status = 'active'::public.user_status),
    'is_trial', (v_effective_tier = 'trial'::public.subscription_tier and coalesce(v_trial_days_remaining, 0) > 0),
    'is_pro', (v_effective_tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)),
    'is_lifetime', (v_effective_tier = 'lifetime'::public.subscription_tier),
    'is_read_only', (not v_can_write or v_effective_tier = 'read_only'::public.subscription_tier),
    'can_write', v_can_write,
    'module_permissions', coalesce(v_module_permissions, '{}'::jsonb)
  );
end;
$$;
