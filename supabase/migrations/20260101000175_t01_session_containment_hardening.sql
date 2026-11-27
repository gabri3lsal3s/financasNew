-- ============================================================================
-- Migration: 20260101000175_t01_session_containment_hardening.sql
-- Plano Mestre Multiconta e Isolamento de Sessões (T01)
-- Contenção de riscos S02, S03 e S04 no fluxo atual.
-- ============================================================================

-- 1. Registro server-side de sessões revogadas (S03 / S04)
create table if not exists public.revoked_auth_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revoked_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  reason text
);

create index if not exists idx_revoked_auth_sessions_user_id
  on public.revoked_auth_sessions(user_id, revoked_at desc);

alter table public.revoked_auth_sessions enable row level security;
alter table public.revoked_auth_sessions force row level security;

revoke all on public.revoked_auth_sessions from public, anon;
grant select on public.revoked_auth_sessions to authenticated;

-- 2. Múltiplas sessões da mesma conta no mesmo aparelho sem sobrescrever vínculo (S04)
alter table public.user_devices
  drop constraint if exists user_devices_user_device_unique,
  drop constraint if exists user_devices_user_id_device_id_key;

create unique index if not exists uq_user_devices_user_auth_session
  on public.user_devices (user_id, auth_session_id)
  where auth_session_id is not null;

create unique index if not exists uq_user_devices_user_device_legacy
  on public.user_devices (user_id, device_id)
  where auth_session_id is null;

-- 3. Endurecimento uniforme de is_admin() e is_superadmin() com AAL2 e sessão não revogada (S02)
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_aal text;
begin
  if v_uid is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role in ('admin'::public.user_role, 'superadmin'::public.user_role)
      and status = 'active'::public.user_status
  ) then
    return false;
  end if;

  v_aal := coalesce(auth.jwt() ->> 'aal', 'aal1');
  if v_aal <> 'aal2' then
    return false;
  end if;

  if not exists (
    select 1
    from auth.mfa_factors
    where user_id = v_uid
      and status = 'verified'
  ) then
    return false;
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is not null and exists (
    select 1
    from public.revoked_auth_sessions r
    where r.session_id = v_session_id
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.is_superadmin()
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_aal text;
begin
  if v_uid is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role = 'superadmin'::public.user_role
      and status = 'active'::public.user_status
  ) then
    return false;
  end if;

  v_aal := coalesce(auth.jwt() ->> 'aal', 'aal1');
  if v_aal <> 'aal2' then
    return false;
  end if;

  if not exists (
    select 1
    from auth.mfa_factors
    where user_id = v_uid
      and status = 'verified'
  ) then
    return false;
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is not null and exists (
    select 1
    from public.revoked_auth_sessions r
    where r.session_id = v_session_id
  ) then
    return false;
  end if;

  return true;
end;
$$;

drop policy if exists "revoked_auth_sessions_select" on public.revoked_auth_sessions;
create policy "revoked_auth_sessions_select" on public.revoked_auth_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- 4. RPCs de sessão de dispositivo orientadas a session_id sem reativação de revogadas (S04)
create or replace function public.register_device_session(
  p_device_id text,
  p_device_name text,
  p_browser text,
  p_os text,
  p_ip_address text default null
)
returns public.user_devices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_device public.user_devices;
  v_clean_device_id text;
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.' using errcode = '28000';
  end if;

  v_clean_device_id := trim(coalesce(p_device_id, ''));
  if v_clean_device_id = '' then
    raise exception 'Identificador de dispositivo não informado.';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is not null then
    if exists (
      select 1 from public.revoked_auth_sessions r
      where r.session_id = v_session_id
    ) or exists (
      select 1 from public.user_devices d
      where d.user_id = v_user_id
        and d.auth_session_id = v_session_id
        and d.is_revoked = true
    ) then
      raise exception 'Sessão revogada não pode ser reativada.' using errcode = '42501';
    end if;

    insert into public.user_devices (
      user_id,
      device_id,
      device_name,
      browser,
      os,
      ip_address,
      auth_session_id,
      last_seen_at,
      is_revoked
    ) values (
      v_user_id,
      v_clean_device_id,
      coalesce(nullif(trim(p_device_name), ''), 'Dispositivo desconhecido'),
      coalesce(nullif(trim(p_browser), ''), 'Navegador'),
      coalesce(nullif(trim(p_os), ''), 'Sistema'),
      nullif(trim(p_ip_address), ''),
      v_session_id,
      now(),
      false
    )
    on conflict (user_id, auth_session_id) where auth_session_id is not null do update set
      device_id = excluded.device_id,
      device_name = excluded.device_name,
      browser = excluded.browser,
      os = excluded.os,
      ip_address = coalesce(excluded.ip_address, user_devices.ip_address),
      last_seen_at = now()
    where user_devices.is_revoked = false
    returning * into v_device;

    if not found then
      raise exception 'Sessão revogada não pode ser reativada.' using errcode = '42501';
    end if;
  else
    if exists (
      select 1 from public.user_devices d
      where d.user_id = v_user_id
        and d.device_id = v_clean_device_id
        and d.auth_session_id is null
        and d.is_revoked = true
    ) then
      raise exception 'Sessão revogada não pode ser reativada.' using errcode = '42501';
    end if;

    insert into public.user_devices (
      user_id,
      device_id,
      device_name,
      browser,
      os,
      ip_address,
      auth_session_id,
      last_seen_at,
      is_revoked
    ) values (
      v_user_id,
      v_clean_device_id,
      coalesce(nullif(trim(p_device_name), ''), 'Dispositivo desconhecido'),
      coalesce(nullif(trim(p_browser), ''), 'Navegador'),
      coalesce(nullif(trim(p_os), ''), 'Sistema'),
      nullif(trim(p_ip_address), ''),
      null,
      now(),
      false
    )
    on conflict (user_id, device_id) where auth_session_id is null do update set
      device_name = excluded.device_name,
      browser = excluded.browser,
      os = excluded.os,
      ip_address = coalesce(excluded.ip_address, user_devices.ip_address),
      last_seen_at = now()
    where user_devices.is_revoked = false
    returning * into v_device;

    if not found then
      raise exception 'Sessão revogada não pode ser reativada.' using errcode = '42501';
    end if;
  end if;

  delete from public.user_devices
  where user_id = v_user_id
    and is_revoked = true
    and last_seen_at < now() - interval '90 days';

  return v_device;
end;
$$;

create or replace function public.check_device_session_revoked(
  p_device_id text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_clean_device_id text;
begin
  if v_user_id is null then
    return true;
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is not null then
    return exists (
      select 1 from public.revoked_auth_sessions r
      where r.session_id = v_session_id
    ) or exists (
      select 1 from public.user_devices d
      where d.user_id = v_user_id
        and d.auth_session_id = v_session_id
        and d.is_revoked = true
    );
  end if;

  v_clean_device_id := trim(coalesce(p_device_id, ''));
  if v_clean_device_id = '' then
    return false;
  end if;

  return exists (
    select 1 from public.user_devices d
    where d.user_id = v_user_id
      and d.device_id = v_clean_device_id
      and d.is_revoked = true
  );
end;
$$;

revoke all on function public.check_device_session_revoked(text) from public, anon;
grant execute on function public.check_device_session_revoked(text) to authenticated;

create or replace function public.revoke_device_session(
  p_device_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_session_id uuid;
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.' using errcode = '28000';
  end if;

  update public.user_devices
  set is_revoked = true,
      last_seen_at = now()
  where id = p_device_record_id
    and user_id = v_user_id
  returning auth_session_id into v_auth_session_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count > 0 and v_auth_session_id is not null then
    insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
    values (v_auth_session_id, v_user_id, v_user_id, 'user_revoke_device')
    on conflict (session_id) do nothing;

    begin
      delete from auth.sessions
      where id = v_auth_session_id
        and user_id = v_user_id;
    exception when insufficient_privilege then
      null;
    end;
  end if;

  return v_updated_count > 0;
end;
$$;

create or replace function public.revoke_other_device_sessions(
  p_current_device_id text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid;
  v_clean_device_id text;
  v_updated_count integer := 0;
  v_revoked_sessions uuid[];
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.' using errcode = '28000';
  end if;

  v_clean_device_id := trim(coalesce(p_current_device_id, ''));
  if v_clean_device_id = '' then
    raise exception 'Identificador do dispositivo atual não informado.';
  end if;

  begin
    v_current_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_current_session_id := null;
  end;

  if v_current_session_id is not null then
    with updated as (
      update public.user_devices
      set is_revoked = true,
          last_seen_at = now()
      where user_id = v_user_id
        and auth_session_id is distinct from v_current_session_id
        and is_revoked = false
      returning auth_session_id
    )
    select
      count(*)::integer,
      coalesce(array_agg(auth_session_id) filter (where auth_session_id is not null), '{}')
    into v_updated_count, v_revoked_sessions
    from updated;

    if array_length(v_revoked_sessions, 1) is not null then
      insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
      select s_id, v_user_id, v_user_id, 'user_revoke_other_sessions'
      from unnest(v_revoked_sessions) as s_id
      on conflict (session_id) do nothing;
    end if;

    begin
      insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
      select s.id, v_user_id, v_user_id, 'user_revoke_other_sessions'
      from auth.sessions s
      where s.user_id = v_user_id
        and s.id <> v_current_session_id
      on conflict (session_id) do nothing;

      delete from auth.sessions
      where user_id = v_user_id
        and id <> v_current_session_id;
    exception when insufficient_privilege then
      null;
    end;
  else
    update public.user_devices
    set is_revoked = true,
        last_seen_at = now()
    where user_id = v_user_id
      and device_id <> v_clean_device_id
      and is_revoked = false;

    get diagnostics v_updated_count = row_count;
  end if;

  return v_updated_count;
end;
$$;

-- 5. RPC server-side para revogação global de sessões por Superadmin AAL2 (S03)
create or replace function public.admin_revoke_user_sessions(
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operator_id uuid;
  v_revoked_auth_sessions integer := 0;
  v_revoked_devices integer := 0;
  v_target_exists boolean := false;
  v_auth_sessions_deleted boolean := false;
begin
  v_operator_id := public.assert_active_superadmin_aal2('revogar sessões de usuário');

  if p_target_user_id is null then
    raise exception 'Identificador do usuário alvo é obrigatório.';
  end if;

  select exists(select 1 from public.profiles where id = p_target_user_id)
  into v_target_exists;

  if not v_target_exists then
    raise exception 'Usuário alvo não encontrado.';
  end if;

  insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
  select distinct d.auth_session_id, p_target_user_id, v_operator_id, 'admin_revoke_sessions'
  from public.user_devices d
  where d.user_id = p_target_user_id
    and d.auth_session_id is not null
  on conflict (session_id) do nothing;

  begin
    insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
    select s.id, p_target_user_id, v_operator_id, 'admin_revoke_sessions'
    from auth.sessions s
    where s.user_id = p_target_user_id
    on conflict (session_id) do nothing;

    delete from auth.sessions
    where user_id = p_target_user_id;
    get diagnostics v_revoked_auth_sessions = row_count;
    v_auth_sessions_deleted := true;
  exception when insufficient_privilege then
    v_revoked_auth_sessions := 0;
    v_auth_sessions_deleted := false;
  end;

  update public.user_devices
  set is_revoked = true,
      last_seen_at = now()
  where user_id = p_target_user_id
    and is_revoked = false;
  get diagnostics v_revoked_devices = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_operator_id,
    'profiles',
    p_target_user_id,
    'ADMIN_REVOKE_SESSIONS',
    jsonb_build_object(
      'revoked_by', v_operator_id,
      'target_user_id', p_target_user_id,
      'scope', 'global',
      'revoked_auth_sessions', v_revoked_auth_sessions,
      'revoked_devices', v_revoked_devices,
      'auth_sessions_deleted', v_auth_sessions_deleted,
      'idempotent', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'revoked_auth_sessions', v_revoked_auth_sessions,
    'revoked_devices', v_revoked_devices,
    'auth_sessions_deleted', v_auth_sessions_deleted,
    'idempotent', true
  );
end;
$$;

revoke all on function public.admin_revoke_user_sessions(uuid) from public, anon;
grant execute on function public.admin_revoke_user_sessions(uuid) to authenticated, service_role;

revoke all on function public.register_device_session(text, text, text, text, text) from public, anon;
grant execute on function public.register_device_session(text, text, text, text, text) to authenticated;

revoke all on function public.revoke_device_session(uuid) from public, anon;
grant execute on function public.revoke_device_session(uuid) to authenticated;

revoke all on function public.revoke_other_device_sessions(text) from public, anon;
grant execute on function public.revoke_other_device_sessions(text) to authenticated;
