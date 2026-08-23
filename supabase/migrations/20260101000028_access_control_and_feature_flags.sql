-- ================================================================
-- 0028_access_control_and_feature_flags.sql — RBAC, Onboarding & Feature Flags (§F43)
--
-- Controles de Acesso, Ciclo de Vida de Contas e Feature Flags:
--   • Enums user_role ('user', 'admin', 'superadmin') e user_status ('pending_approval', 'active', 'suspended', 'banned');
--   • Colunas de segurança em profiles com proteção estrita via trigger;
--   • Tabelas access_invites, system_features e user_feature_overrides;
--   • Funções auxiliares is_admin(), is_superadmin(), is_current_user_active();
--   • Trigger handle_new_user com auto-promoção do primeiro usuário (superadmin/active) e consumo de convite;
--   • RPCs administrativas com security definer e auditoria.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Enums de Governança
-- ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'admin', 'superadmin');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type public.user_status as enum ('pending_approval', 'active', 'suspended', 'banned');
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Extensões de Segurança na Tabela profiles
-- ----------------------------------------------------------------
alter table public.profiles
  add column if not exists role public.user_role not null default 'user'::public.user_role,
  add column if not exists status public.user_status not null default 'pending_approval'::public.user_status,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles (id) on delete set null,
  add column if not exists suspended_reason text;

-- Garante que usuários já existentes no banco sejam marcados como ativos e o primeiro usuário seja superadmin
update public.profiles
set status = 'active'::public.user_status,
    approved_at = coalesce(approved_at, now())
where status = 'pending_approval'::public.user_status;

-- Promove o primeiro perfil criado a superadmin caso ainda não haja superadmin
update public.profiles
set role = 'superadmin'::public.user_role
where id = (
  select id from public.profiles order by created_at asc limit 1
) and not exists (
  select 1 from public.profiles where role = 'superadmin'::public.user_role
);

-- ----------------------------------------------------------------
-- 3. Tabela de Convites de Acesso (Allowlist / Invites)
-- ----------------------------------------------------------------
create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  max_uses integer not null default 1 check (max_uses >= 1),
  used_count integer not null default 0 check (used_count >= 0),
  target_email text,
  expires_at timestamptz,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_invites_code on public.access_invites(code);

-- ----------------------------------------------------------------
-- 4. Tabelas de Feature Flags
-- ----------------------------------------------------------------
create table if not exists public.system_features (
  key text primary key,
  name text not null,
  description text,
  is_globally_enabled boolean not null default true,
  default_enabled_for_new_users boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature_key text not null references public.system_features (key) on delete cascade,
  is_enabled boolean not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create index if not exists idx_user_feature_overrides_user on public.user_feature_overrides(user_id);

-- Carga inicial das funcionalidades canônicas do sistema
insert into public.system_features (key, name, description, is_globally_enabled, default_enabled_for_new_users)
values
  ('investments', 'Módulo de Investimentos & Carteira', 'Acesso à gestão de ativos, posições, aportes inteligentes e proventos.', true, true),
  ('debts', 'Módulo de Dívidas & Financiamentos', 'Acesso ao controle de dívidas, parcelamentos de contratos e amortizações.', true, true),
  ('budgets', 'Módulo de Orçamentos', 'Acesso ao planejamento de tetos por categoria e limites de gastos.', true, true),
  ('reports', 'Central de Relatórios & Dossiês A4', 'Acesso aos relatórios consolidados, DRE pessoal e exportações.', true, true),
  ('insights', 'Centro de Insights & Projeções', 'Acesso ao motor preditivo de economia, assinaturas e score financeiro.', true, true),
  ('reminders', 'Central de Notificações & Lembretes', 'Acesso aos avisos de vencimento de contas, dívidas e faturas.', true, true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

-- ----------------------------------------------------------------
-- 5. Funções Auxiliares de Segurança (Security Definer)
-- ----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin'::public.user_role, 'superadmin'::public.user_role)
      and status = 'active'::public.user_status
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'superadmin'::public.user_role
      and status = 'active'::public.user_status
  );
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'::public.user_status
  );
$$;

-- ----------------------------------------------------------------
-- 6. Trigger de Proteção dos Campos de Segurança de profiles
-- ----------------------------------------------------------------
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Se o chamador não for admin ou superadmin, bloqueia alterações nos campos de segurança
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Acesso negado: você não tem permissão para alterar o nível de acesso (role).';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Acesso negado: você não tem permissão para alterar o status da conta.';
    end if;
    if new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by then
      raise exception 'Acesso negado: você não tem permissão para alterar os metadados de aprovação.';
    end if;
  end if;

  -- Apenas superadmin pode alterar para ou de 'superadmin'
  if (new.role = 'superadmin'::public.user_role or old.role = 'superadmin'::public.user_role)
     and new.role is distinct from old.role
     and not public.is_superadmin() then
    raise exception 'Apenas um Superadmin pode conceder ou revogar privilégios de Superadmin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_security_fields on public.profiles;
create trigger trg_protect_profile_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

-- ----------------------------------------------------------------
-- 7. Trigger handle_new_user Atualizado com Suporte a Convites & Superadmin
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
  v_initial_status public.user_status := 'pending_approval'::public.user_status;
  v_approved_at timestamptz := null;
begin
  -- Contagem de usuários existentes
  select count(*) into v_user_count from public.profiles;

  -- Se for o primeiríssimo usuário do sistema, vira superadmin e ativo imediatamente
  if v_user_count = 0 then
    v_initial_role := 'superadmin'::public.user_role;
    v_initial_status := 'active'::public.user_status;
    v_approved_at := now();
  else
    -- Verifica se foi passado um código de convite nos metadados do auth
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
        -- Se houver target_email, confere se bate com o e-mail do usuário
        if v_invite.target_email is null or lower(v_invite.target_email) = lower(new.email) then
          v_initial_status := 'active'::public.user_status;
          v_approved_at := now();

          -- Consome 1 uso do convite
          update public.access_invites
          set used_count = used_count + 1
          where id = v_invite.id;
        end if;
      end if;
    end if;
  end if;

  -- Cria o perfil com as regras definidas
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

  -- Cria as preferências padrões
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------
-- 8. Políticas RLS (Row Level Security)
-- ----------------------------------------------------------------
alter table public.access_invites enable row level security;
alter table public.system_features enable row level security;
alter table public.user_feature_overrides enable row level security;

-- access_invites: admins podem tudo; usuários comuns podem apenas consultar convite válido para validação
drop policy if exists "Admins gerenciam convites" on public.access_invites;
create policy "Admins gerenciam convites"
  on public.access_invites
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());

-- system_features: leitura liberada para todos os autenticados; escrita apenas admins
drop policy if exists "Todos podem ler funcionalidades do sistema" on public.system_features;
create policy "Todos podem ler funcionalidades do sistema"
  on public.system_features
  for select
  using (auth.uid() is not null and auth.role() = 'authenticated');

drop policy if exists "Admins editam funcionalidades do sistema" on public.system_features;
create policy "Admins editam funcionalidades do sistema"
  on public.system_features
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());

-- user_feature_overrides: cada usuário pode ler seus próprios overrides; admins podem gerenciar todos
drop policy if exists "Usuário lê seus próprios overrides" on public.user_feature_overrides;
create policy "Usuário lê seus próprios overrides"
  on public.user_feature_overrides
  for select
  using (user_id = auth.uid() or (auth.uid() is not null and public.is_admin()));

drop policy if exists "Admins gerenciam overrides de features" on public.user_feature_overrides;
create policy "Admins gerenciam overrides de features"
  on public.user_feature_overrides
  for all
  using (auth.uid() is not null and public.is_admin())
  with check (auth.uid() is not null and public.is_admin());


-- ----------------------------------------------------------------
-- 9. RPCs Administrativas e de Controle de Acesso
-- ----------------------------------------------------------------

-- Consulta agregada de features resolvidas para o usuário autenticado
create or replace function public.get_my_features()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  select jsonb_object_agg(
    sf.key,
    case
      -- Se a feature estiver desativada globalmente (Kill-Switch), fica desativada para todos
      when sf.is_globally_enabled = false then false
      -- Se houver override específico para o usuário, ele prevalece
      when ufo.is_enabled is not null then ufo.is_enabled
      -- Fallback para o padrão global da feature
      else sf.default_enabled_for_new_users
    end
  ) into v_result
  from public.system_features sf
  left join public.user_feature_overrides ufo
    on ufo.feature_key = sf.key and ufo.user_id = v_uid;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

-- Listagem administrativa de usuários paginada com contadores e filtros
create or replace function public.admin_list_users(
  p_search text default null,
  p_status text default null,
  p_role text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  email text,
  role public.user_role,
  status public.user_status,
  created_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  suspended_reason text,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  return query
  with filtered as (
    select
      p.id,
      p.name,
      p.email,
      p.role,
      p.status,
      p.created_at,
      p.approved_at,
      p.approved_by,
      p.suspended_reason,
      count(*) over() as total_count
    from public.profiles p
    where
      (p_search is null or p_search = '' or (
        p.name ilike '%' || p_search || '%' or
        p.email ilike '%' || p_search || '%'
      ))
      and (p_status is null or p_status = '' or p.status::text = p_status)
      and (p_role is null or p_role = '' or p.role::text = p_role)
    order by p.created_at desc
    limit p_limit
    offset p_offset
  )
  select * from filtered;
end;
$$;

-- Atualização de status do usuário (Aprovação, Suspensão, Banimento, Reativação)
create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_status public.user_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_target_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;

  -- Impede que administradores suspendam/banem superadmins a menos que seja superadmin
  if v_target_role = 'superadmin'::public.user_role and not public.is_superadmin() then
    raise exception 'Apenas um Superadmin pode alterar o status de outro Superadmin.';
  end if;

  update public.profiles
  set
    status = p_status,
    suspended_reason = case when p_status in ('suspended', 'banned') then p_reason else null end,
    approved_at = case when p_status = 'active' and approved_at is null then now() else approved_at end,
    approved_by = case when p_status = 'active' and approved_by is null then v_admin_id else approved_by end
  where id = p_user_id;

  -- Registro de auditoria
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'profiles',
    p_user_id::text,
    'UPDATE_STATUS',
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );
end;
$$;

-- Alteração de papel do usuário (Promover / Rebaixar)
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  -- Apenas Superadmin pode alterar papéis para evitar que um admin simples se autopromova a superadmin
  if not public.is_superadmin() then
    raise exception 'Apenas um Superadmin pode gerenciar cargos e privilégios administrativos.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'profiles',
    p_user_id::text,
    'UPDATE_ROLE',
    jsonb_build_object('role', p_role)
  );
end;
$$;

-- Override de Feature Flag por usuário
create or replace function public.admin_set_feature_override(
  p_user_id uuid,
  p_feature_key text,
  p_enabled boolean
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

  insert into public.user_feature_overrides (user_id, feature_key, is_enabled, granted_by, updated_at)
  values (p_user_id, p_feature_key, p_enabled, v_admin_id, now())
  on conflict (user_id, feature_key) do update
  set is_enabled = excluded.is_enabled,
      granted_by = v_admin_id,
      updated_at = now();

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'user_feature_overrides',
    p_user_id::text || ':' || p_feature_key,
    'SET_OVERRIDE',
    jsonb_build_object('is_enabled', p_enabled)
  );
end;
$$;

-- Remoção de override de feature
create or replace function public.admin_remove_feature_override(
  p_user_id uuid,
  p_feature_key text
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

  delete from public.user_feature_overrides
  where user_id = p_user_id and feature_key = p_feature_key;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'user_feature_overrides',
    p_user_id::text || ':' || p_feature_key,
    'REMOVE_OVERRIDE',
    '{}'::jsonb
  );
end;
$$;

-- Toggle Global de Feature (Kill-Switch)
create or replace function public.admin_toggle_global_feature(
  p_feature_key text,
  p_enabled boolean
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

  update public.system_features
  set is_globally_enabled = p_enabled,
      updated_at = now()
  where key = p_feature_key;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'system_features',
    p_feature_key,
    'TOGGLE_GLOBAL_FEATURE',
    jsonb_build_object('is_globally_enabled', p_enabled)
  );
end;
$$;

-- Criação de Convite
create or replace function public.admin_create_invite(
  p_code text,
  p_max_uses integer default 1,
  p_expires_at timestamptz default null,
  p_target_email text default null
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
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  if length(v_clean_code) < 3 then
    raise exception 'O código do convite deve conter no mínimo 3 caracteres.';
  end if;

  insert into public.access_invites (code, max_uses, expires_at, target_email, created_by)
  values (v_clean_code, coalesce(p_max_uses, 1), p_expires_at, p_target_email, v_admin_id)
  returning id into v_invite_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'access_invites',
    v_invite_id::text,
    'CREATE_INVITE',
    jsonb_build_object('code', v_clean_code, 'max_uses', p_max_uses, 'target_email', p_target_email)
  );

  return v_invite_id;
end;
$$;

-- Revogação de Convite
create or replace function public.admin_revoke_invite(
  p_invite_id uuid
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

  update public.access_invites
  set is_revoked = true
  where id = p_invite_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'access_invites',
    p_invite_id::text,
    'REVOKE_INVITE',
    jsonb_build_object('is_revoked', true)
  );
end;
$$;

-- Métricas Executivas do Painel Admin
create or replace function public.admin_get_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_total_users bigint;
  v_active_users bigint;
  v_pending_users bigint;
  v_suspended_users bigint;
  v_total_invites bigint;
  v_used_invites bigint;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  select count(*) into v_total_users from public.profiles;
  select count(*) into v_active_users from public.profiles where status = 'active';
  select count(*) into v_pending_users from public.profiles where status = 'pending_approval';
  select count(*) into v_suspended_users from public.profiles where status in ('suspended', 'banned');

  select count(*) into v_total_invites from public.access_invites where is_revoked = false;
  select coalesce(sum(used_count), 0) into v_used_invites from public.access_invites;

  return jsonb_build_object(
    'total_users', v_total_users,
    'active_users', v_active_users,
    'pending_users', v_pending_users,
    'suspended_users', v_suspended_users,
    'total_invites', v_total_invites,
    'used_invites', v_used_invites
  );
end;
$$;
