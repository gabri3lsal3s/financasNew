-- ================================================================
-- 20260101000046_batch_budget_limits_and_access_hardening.sql
-- Unificacao de limites de orcamento em lote e hardening de acesso modular
-- ================================================================

-- ================================================================
-- 0046_batch_budget_limits.sql — RPC de ajuste em lote de orçamentos (§Tarefa 09)
--
-- Permite atualização atômica e transacional dos limites de múltiplas
-- categorias para um dado mês, com auditoria centralizada.
-- ================================================================

create or replace function public.set_batch_budget_limits(
  p_month text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_category_id uuid;
  v_limit numeric;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido (esperado YYYY-MM)';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Lista de limites inválida';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := (v_item->>'categoryId')::uuid;
    v_limit := (v_item->>'limit')::numeric;

    if not exists (
      select 1 from public.categories
       where id = v_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria % inválida ou não pertence ao usuário', v_category_id;
    end if;

    if v_limit is null or v_limit < 0 then
      raise exception 'Limite não pode ser negativo';
    end if;

    if v_limit = 0 then
      delete from public.budgets
       where user_id = v_user_id
         and category_id = v_category_id
         and month = p_month;
    else
      insert into public.budgets (user_id, category_id, month, "limit")
      values (v_user_id, v_category_id, p_month, v_limit)
      on conflict (category_id, month)
      do update set "limit" = excluded."limit";
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'batch_upsert',
    jsonb_build_object('month', p_month, 'count', jsonb_array_length(p_items))
  );
end;
$$;

grant execute on function public.set_batch_budget_limits(text, jsonb) to authenticated;


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
