-- ================================================================
-- 0040_saas_plans_and_modular_access.sql — Arquitetura SaaS, Planos & Permissões Modulares (§Fase 76.1)
--
-- Controles de Assinatura, Ciclo de Vida SaaS e Controle Granular de Acesso:
--   • Enums subscription_tier, subscription_status e access_level;
--   • Tabelas plans, user_subscriptions e user_module_permissions;
--   • Expansão da tabela access_invites (target_tier, custom_trial_days, module_grants, notes);
--   • Backfill automático: usuários existentes migrados para tier 'lifetime' (ativo);
--   • Funções SQL get_user_module_access(), can_current_user_write(), can_current_user_write_module();
--   • RPC get_my_subscription() e RPCs administrativas para gestão de planos e permissões;
--   • Trigger handle_new_user() atualizado com suporte atômico a planos, 30d trial e presets modulares;
--   • Políticas RLS para plans, user_subscriptions e user_module_permissions.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Enums de Assinatura e Níveis de Acesso
-- ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_tier') then
    create type public.subscription_tier as enum ('trial', 'pro_monthly', 'pro_annual', 'lifetime', 'read_only');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'read_only_expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type public.access_level as enum ('none', 'read', 'write', 'admin');
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Tabela de Planos Canônicos (plans)
-- ----------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  billing_interval text check (billing_interval in ('month', 'year', null)),
  is_publicly_available boolean not null default true,
  created_at timestamptz not null default now()
);

-- Carga inicial dos 4 planos canônicos do sistema
insert into public.plans (id, name, description, price_cents, billing_interval, is_publicly_available)
values
  ('trial', 'Teste Pro (30 dias)', 'Acesso irrestrito a todas as ferramentas por 30 dias.', 0, null, false),
  ('pro_monthly', 'Plano Pro Mensal', 'Assinatura recorrente mensal com acesso completo.', 1990, 'month', true),
  ('pro_annual', 'Plano Pro Anual', 'Assinatura anual com 25% de desconto.', 17880, 'year', true),
  ('lifetime', 'Plano Vitalício VIP', 'Acesso completo permanente sem expiração.', 0, null, false)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    billing_interval = excluded.billing_interval,
    is_publicly_available = excluded.is_publicly_available;

-- ----------------------------------------------------------------
-- 3. Tabela de Assinaturas de Usuários (user_subscriptions)
-- ----------------------------------------------------------------
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade unique,
  plan_id text not null references public.plans (id) default 'trial',
  tier public.subscription_tier not null default 'trial'::public.subscription_tier,
  status public.subscription_status not null default 'trialing'::public.subscription_status,
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_tier on public.user_subscriptions(tier);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);

-- ----------------------------------------------------------------
-- 4. Tabela de Permissões Modulares por Usuário (user_module_permissions)
-- ----------------------------------------------------------------
create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_key text not null references public.system_features (key) on delete cascade,
  access_level public.access_level not null default 'write'::public.access_level,
  granted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_key)
);

create index if not exists idx_user_module_permissions_user on public.user_module_permissions(user_id);

-- ----------------------------------------------------------------
-- 5. Expansão da Tabela access_invites
-- ----------------------------------------------------------------
alter table public.access_invites
  add column if not exists target_tier public.subscription_tier not null default 'trial'::public.subscription_tier,
  add column if not exists custom_trial_days integer check (custom_trial_days is null or custom_trial_days > 0),
  add column if not exists module_grants jsonb not null default '{}'::jsonb,
  add column if not exists notes text;

-- ----------------------------------------------------------------
-- 6. Backfill dos Usuários Existentes para Plano Vitalício (Lifetime)
-- ----------------------------------------------------------------
insert into public.user_subscriptions (user_id, plan_id, tier, status, starts_at)
select
  p.id,
  'lifetime',
  'lifetime'::public.subscription_tier,
  'active'::public.subscription_status,
  p.created_at
from public.profiles p
on conflict (user_id) do nothing;

-- ----------------------------------------------------------------
-- 7. Funções de Avaliação e Resolução de Acesso (Security Definer)
-- ----------------------------------------------------------------

-- Avalia o nível de acesso efetivo de um usuário para determinado módulo
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

  -- 4. Fallback pelo status e tier da assinatura
  select tier, status, trial_ends_at, current_period_end into v_sub
  from public.user_subscriptions
  where user_id = p_user_id;

  if not found then
    -- Sem assinatura registrada $\rightarrow$ trata como somente-leitura básico
    return 'read'::public.access_level;
  end if;

  -- Vitalício ativo $\rightarrow$ acesso total de escrita
  if v_sub.tier = 'lifetime'::public.subscription_tier and v_sub.status = 'active'::public.subscription_status then
    return 'write'::public.access_level;
  end if;

  -- Pro ativo $\rightarrow$ acesso total de escrita
  if v_sub.tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
     and v_sub.status = 'active'::public.subscription_status then
    return 'write'::public.access_level;
  end if;

  -- Trial ativo (dentro do prazo) $\rightarrow$ acesso total de escrita
  if v_sub.tier = 'trial'::public.subscription_tier
     and v_sub.status = 'trialing'::public.subscription_status
     and (v_sub.trial_ends_at is null or v_sub.trial_ends_at > now()) then
    return 'write'::public.access_level;
  end if;

  -- Assinatura expirada, cancelada ou trial encerrado $\rightarrow$ downgrade para Somente-Leitura
  return 'read'::public.access_level;
end;
$$;

-- Verifica se o usuário autenticado pode realizar escritas gerais no sistema
create or replace function public.can_current_user_write()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.user_subscriptions s on s.user_id = p.id
    where p.id = auth.uid()
      and p.status = 'active'::public.user_status
      and (
        p.role in ('superadmin'::public.user_role, 'admin'::public.user_role)
        or s.tier = 'lifetime'::public.subscription_tier
        or (s.tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) and s.status = 'active'::public.subscription_status)
        or (s.tier = 'trial'::public.subscription_tier and s.status = 'trialing'::public.subscription_status and (s.trial_ends_at is null or s.trial_ends_at > now()))
      )
  );
$$;

-- Verifica se o usuário autenticado pode escrever em um módulo específico
create or replace function public.can_current_user_write_module(p_module_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.get_user_module_access(auth.uid(), p_module_key) in ('write'::public.access_level, 'admin'::public.access_level);
$$;

-- Consulta agregada de assinatura do usuário autenticado para consumo pelo frontend
create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
security definer
stable
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

  -- Se não existir assinatura, cria como trial padrão de 30 dias a partir de agora
  if not found then
    insert into public.user_subscriptions (user_id, plan_id, tier, status, trial_ends_at)
    values (v_uid, 'trial', 'trial'::public.subscription_tier, 'trialing'::public.subscription_status, now() + interval '30 days')
    returning * into v_sub;
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

-- ----------------------------------------------------------------
-- 8. RPCs Administrativas de Gestão de Planos & Módulos
-- ----------------------------------------------------------------

-- Superadmin ou Admin altera a assinatura de um usuário
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

-- Superadmin ou Admin define override de permissão granular por módulo
create or replace function public.admin_set_user_module_permission(
  p_user_id uuid,
  p_module_key text,
  p_access_level public.access_level,
  p_expires_at timestamptz default null
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

  insert into public.user_module_permissions (
    user_id,
    module_key,
    access_level,
    granted_by,
    expires_at,
    updated_at
  )
  values (
    p_user_id,
    p_module_key,
    p_access_level,
    v_admin_id,
    p_expires_at,
    now()
  )
  on conflict (user_id, module_key) do update
  set access_level = excluded.access_level,
      granted_by = v_admin_id,
      expires_at = excluded.expires_at,
      updated_at = now();

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'user_module_permissions',
    p_user_id::text || ':' || p_module_key,
    'SET_MODULE_PERMISSION',
    jsonb_build_object(
      'access_level', p_access_level,
      'expires_at', p_expires_at
    )
  );
end;
$$;

-- Superadmin ou Admin remove override de permissão granular por módulo
create or replace function public.admin_remove_user_module_permission(
  p_user_id uuid,
  p_module_key text
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

  delete from public.user_module_permissions
  where user_id = p_user_id and module_key = p_module_key;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'user_module_permissions',
    p_user_id::text || ':' || p_module_key,
    'REMOVE_MODULE_PERMISSION',
    '{}'::jsonb
  );
end;
$$;

-- Criação de Convite Avançado com Presets de Plano e Módulos
create or replace function public.admin_create_modular_invite(
  p_code text,
  p_target_tier public.subscription_tier default 'trial'::public.subscription_tier,
  p_custom_trial_days integer default null,
  p_module_grants jsonb default '{}'::jsonb,
  p_max_uses integer default 1,
  p_expires_at timestamptz default null,
  p_target_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_invite_id uuid;
  v_clean_code text := upper(trim(p_code));
  v_plan_id text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  if length(v_clean_code) < 3 then
    raise exception 'O código do convite deve conter no mínimo 3 caracteres.';
  end if;

  -- Mapeia target_tier para plan_id correspondente
  v_plan_id := case
    when p_target_tier = 'lifetime'::public.subscription_tier then 'lifetime'
    when p_target_tier = 'pro_annual'::public.subscription_tier then 'pro_annual'
    when p_target_tier = 'pro_monthly'::public.subscription_tier then 'pro_monthly'
    else 'trial'
  end;

  insert into public.access_invites (
    code,
    created_by,
    target_tier,
    custom_trial_days,
    module_grants,
    max_uses,
    expires_at,
    target_email,
    notes
  )
  values (
    v_clean_code,
    v_admin_id,
    p_target_tier,
    p_custom_trial_days,
    coalesce(p_module_grants, '{}'::jsonb),
    coalesce(p_max_uses, 1),
    p_expires_at,
    p_target_email,
    p_notes
  )
  returning id into v_invite_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'access_invites',
    v_invite_id::text,
    'CREATE_MODULAR_INVITE',
    jsonb_build_object(
      'code', v_clean_code,
      'target_tier', p_target_tier,
      'custom_trial_days', p_custom_trial_days,
      'module_grants', p_module_grants,
      'max_uses', p_max_uses,
      'target_email', p_target_email
    )
  );

  return v_invite_id;
end;
$$;

-- ----------------------------------------------------------------
-- 9. Trigger handle_new_user() Atualizado com Suporte Atômico a Planos & Presets
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_count integer;
  v_invite_code text;
  v_invite record;
  v_initial_role public.user_role := 'user'::public.user_role;
  v_initial_status public.user_status := 'active'::public.user_status;
  v_approved_at timestamptz := now();
  v_target_tier public.subscription_tier := 'trial'::public.subscription_tier;
  v_target_plan text := 'trial';
  v_trial_days integer := 30;
  v_trial_ends_at timestamptz := now() + interval '30 days';
  v_sub_status public.subscription_status := 'trialing'::public.subscription_status;
  v_module_key text;
  v_access_val text;
begin
  select count(*) into v_user_count from public.profiles;

  -- Se for o primeiríssimo usuário do sistema, vira superadmin e recebe plano Vitalício
  if v_user_count = 0 then
    v_initial_role := 'superadmin'::public.user_role;
    v_initial_status := 'active'::public.user_status;
    v_approved_at := now();
    v_target_tier := 'lifetime'::public.subscription_tier;
    v_target_plan := 'lifetime';
    v_sub_status := 'active'::public.subscription_status;
    v_trial_ends_at := null;
  else
    -- Verifica se foi passado código de convite nos metadados
    v_invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));

    if v_invite_code <> '' then
      select * into v_invite
      from public.access_invites
      where upper(code) = upper(v_invite_code)
        and is_revoked = false
        and (expires_at is null or expires_at > now())
        and used_count < max_uses
      for update;

      if found then
        -- Validação de target_email se restrito
        if v_invite.target_email is null or lower(v_invite.target_email) = lower(new.email) then
          v_target_tier := v_invite.target_tier;
          v_target_plan := case
            when v_target_tier = 'lifetime'::public.subscription_tier then 'lifetime'
            when v_target_tier = 'pro_annual'::public.subscription_tier then 'pro_annual'
            when v_target_tier = 'pro_monthly'::public.subscription_tier then 'pro_monthly'
            else 'trial'
          end;

          if v_target_tier = 'lifetime'::public.subscription_tier or v_target_tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
            v_sub_status := 'active'::public.subscription_status;
            v_trial_ends_at := null;
          else
            v_trial_days := coalesce(v_invite.custom_trial_days, 30);
            v_trial_ends_at := now() + (v_trial_days || ' days')::interval;
            v_sub_status := 'trialing'::public.subscription_status;
          end if;

          -- Consome o uso do convite
          update public.access_invites
          set used_count = used_count + 1
          where id = v_invite.id;
        end if;
      end if;
    end if;
  end if;

  -- 1. Cria o perfil do usuário
  insert into public.profiles (id, name, email, role, status, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    v_initial_role,
    v_initial_status,
    v_approved_at
  )
  on conflict (id) do nothing;

  -- 2. Cria a assinatura associada
  insert into public.user_subscriptions (
    user_id,
    plan_id,
    tier,
    status,
    trial_ends_at
  )
  values (
    new.id,
    v_target_plan,
    v_target_tier,
    v_sub_status,
    v_trial_ends_at
  )
  on conflict (user_id) do nothing;

  -- 3. Aplica os overrides de módulos do convite (se houver)
  if v_invite.id is not null and v_invite.module_grants is not null and v_invite.module_grants <> '{}'::jsonb then
    for v_module_key, v_access_val in
      select key, value#>>'{}' from jsonb_each(v_invite.module_grants)
    loop
      if exists (select 1 from public.system_features where key = v_module_key) then
        insert into public.user_module_permissions (user_id, module_key, access_level)
        values (new.id, v_module_key, v_access_val::public.access_level)
        on conflict (user_id, module_key) do update
        set access_level = excluded.access_level;
      end if;
    end loop;
  end if;

  -- 4. Cria preferências padrões do usuário
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------
-- 10. Políticas RLS (Row Level Security)
-- ----------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_module_permissions enable row level security;

-- plans: Todos os autenticados podem ler o catálogo de planos
drop policy if exists "Todos podem ler planos ativos" on public.plans;
create policy "Todos podem ler planos ativos"
  on public.plans
  for select
  using (auth.uid() is not null);

drop policy if exists "Admins gerenciam planos" on public.plans;
create policy "Admins gerenciam planos"
  on public.plans
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());

-- user_subscriptions: Usuário lê sua própria assinatura; Admins gerenciam
drop policy if exists "Usuário lê sua própria assinatura" on public.user_subscriptions;
create policy "Usuário lê sua própria assinatura"
  on public.user_subscriptions
  for select
  using (user_id = auth.uid() or (auth.uid() is not null and public.is_admin()));

drop policy if exists "Admins gerenciam assinaturas" on public.user_subscriptions;
create policy "Admins gerenciam assinaturas"
  on public.user_subscriptions
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());

-- user_module_permissions: Usuário lê suas permissões; Admins gerenciam
drop policy if exists "Usuário lê suas permissões modulares" on public.user_module_permissions;
create policy "Usuário lê suas permissões modulares"
  on public.user_module_permissions
  for select
  using (user_id = auth.uid() or (auth.uid() is not null and public.is_admin()));

drop policy if exists "Admins gerenciam permissões modulares" on public.user_module_permissions;
create policy "Admins gerenciam permissões modulares"
  on public.user_module_permissions
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());
