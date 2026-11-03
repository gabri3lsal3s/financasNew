-- ================================================================
-- Migration: 0046_modular_access_whitelist_hardening.sql
-- Descrição: Endurecimento de segurança do Acesso Modular (SaaS).
--            Implementa o modelo Whitelist estrito: se o usuário possui
--            qualquer permissão explícita em user_module_permissions,
--            módulos não concedidos tornam-se automaticamente 'none' (bloqueados),
--            eliminando vazamento de acesso para usuários restritos.
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
  v_override public.access_level;
  v_sub record;
begin
  -- 1. Se a feature estiver desativada globalmente (Kill-Switch), o acesso é 'none'
  select is_globally_enabled into v_feature_globally_enabled
  from public.system_features
  where key = p_module_key;

  if v_feature_globally_enabled is false then
    return 'none'::public.access_level;
  end if;

  -- 2. Consulta perfil
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

  -- 3. Verifica se há override explícito para o usuário e módulo
  select access_level into v_override
  from public.user_module_permissions
  where user_id = p_user_id
    and module_key = p_module_key
    and (expires_at is null or expires_at > now());

  if v_override is not null then
    return v_override;
  end if;

  -- Whitelist Mode: se o usuário possui qualquer outro override ativo em user_module_permissions,
  -- ele opera em modo restrito estrito. Qualquer módulo não explicitamente concedido é 'none'.
  if exists (
    select 1
    from public.user_module_permissions
    where user_id = p_user_id
      and (expires_at is null or expires_at > now())
  ) then
    return 'none'::public.access_level;
  end if;

  -- 4. Fallback pelo status e tier da assinatura (usuário comum sem restrições modulares)
  select tier, status, trial_ends_at, current_period_end into v_sub
  from public.user_subscriptions
  where user_id = p_user_id;

  if not found then
    -- Sem assinatura registrada -> trata como somente-leitura básico
    return 'read'::public.access_level;
  end if;

  -- Vitalício ativo -> acesso total de escrita
  if v_sub.tier = 'lifetime'::public.subscription_tier and v_sub.status = 'active'::public.subscription_status then
    return 'write'::public.access_level;
  end if;

  -- Pro ativo -> acesso total de escrita
  if v_sub.tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
     and v_sub.status = 'active'::public.subscription_status then
    return 'write'::public.access_level;
  end if;

  -- Trial ativo (dentro do prazo) -> acesso total de escrita
  if v_sub.tier = 'trial'::public.subscription_tier
     and v_sub.status = 'trialing'::public.subscription_status
     and (v_sub.trial_ends_at is null or v_sub.trial_ends_at > now()) then
    return 'write'::public.access_level;
  end if;

  -- Assinatura expirada, cancelada ou trial encerrado -> downgrade para Somente-Leitura
  return 'read'::public.access_level;
end;
$$;
