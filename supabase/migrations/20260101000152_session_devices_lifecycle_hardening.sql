-- ============================================================================
-- Migration: 20260101000152_session_devices_lifecycle_hardening.sql
-- Plano Mestre Auth Multidispositivo, Inatividade e Bloqueio (Fase 1)
-- Hardening de public.user_devices, vínculo com auth.sessions, revogação real
-- no servidor, limpeza oportunista e habilitação idempotente no Realtime.
-- ============================================================================

-- 1. Coluna auth_session_id + índice parcial para vínculo com auth.sessions
alter table public.user_devices
  add column if not exists auth_session_id uuid;

create index if not exists idx_user_devices_auth_session
  on public.user_devices(user_id, auth_session_id)
  where auth_session_id is not null;

-- 2. Auditoria estrita da policy de SELECT para garantir entrega de eventos Realtime
-- (Não filtrar is_revoked = false, pois o cliente precisa receber o UPDATE quando is_revoked muda para true)
drop policy if exists user_devices_select on public.user_devices;
create policy user_devices_select on public.user_devices
  for select to authenticated
  using (auth.uid() = user_id);

-- 3. Atualização de public.register_device_session
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
    raise exception 'Acesso não autenticado.';
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
  on conflict (user_id, device_id) do update set
    device_name = excluded.device_name,
    browser = excluded.browser,
    os = excluded.os,
    ip_address = coalesce(excluded.ip_address, user_devices.ip_address),
    auth_session_id = coalesce(v_session_id, user_devices.auth_session_id),
    last_seen_at = now(),
    is_revoked = false
  returning * into v_device;

  -- Limpeza oportunista de registros revogados antigos (> 90 dias) do próprio usuário
  delete from public.user_devices
  where user_id = v_user_id
    and is_revoked = true
    and last_seen_at < now() - interval '90 days';

  return v_device;
end;
$$;

revoke all on function public.register_device_session(text, text, text, text, text) from public, anon;
grant execute on function public.register_device_session(text, text, text, text, text) to authenticated;

-- 4. Atualização de public.revoke_device_session com revogação real em auth.sessions
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
    raise exception 'Acesso não autenticado.';
  end if;

  update public.user_devices
  set is_revoked = true,
      last_seen_at = now()
  where id = p_device_record_id
    and user_id = v_user_id
  returning auth_session_id into v_auth_session_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count > 0 and v_auth_session_id is not null then
    begin
      delete from auth.sessions
      where id = v_auth_session_id
        and user_id = v_user_id;
    exception when insufficient_privilege then
      -- Fallback seguro: is_revoked = true + Realtime garantem a desconexão local
      null;
    end;
  end if;

  return v_updated_count > 0;
end;
$$;

revoke all on function public.revoke_device_session(uuid) from public, anon;
grant execute on function public.revoke_device_session(uuid) to authenticated;

-- 5. Nova RPC: public.revoke_other_device_sessions
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
  v_clean_device_id text;
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  v_clean_device_id := trim(coalesce(p_current_device_id, ''));
  if v_clean_device_id = '' then
    raise exception 'Identificador do dispositivo atual não informado.';
  end if;

  update public.user_devices
  set is_revoked = true,
      last_seen_at = now()
  where user_id = v_user_id
    and device_id <> v_clean_device_id
    and is_revoked = false;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.revoke_other_device_sessions(text) from public, anon;
grant execute on function public.revoke_other_device_sessions(text) to authenticated;

-- 6. Inclusão idempotente de public.user_devices na publicação supabase_realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_devices'
    ) then
      alter publication supabase_realtime add table public.user_devices;
    end if;
  end if;
end
$$;
