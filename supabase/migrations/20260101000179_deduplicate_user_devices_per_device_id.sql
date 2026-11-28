-- ============================================================================
-- Migration: 20260101000179_deduplicate_user_devices_per_device_id.sql
-- Evita múltiplas linhas ativas duplicadas em public.user_devices para o mesmo
-- aparelho (user_id, device_id) ou para sessões já encerradas em auth.sessions.
-- Preserva integralmente os registros revogados (is_revoked = true) e todas
-- as garantias de contenção de sessão (T01/T03).
-- ============================================================================

-- 1. Atualiza register_device_session para substituir sessões ativas anteriores
-- do mesmo (user_id, device_id) e limpar sessões encerradas em auth.sessions.
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

  -- Remove sessões ativas anteriores do mesmo aparelho (mesmo user_id + device_id)
  -- que foram substituídas por esta nova sessão, preservando registros revogados.
  delete from public.user_devices
  where user_id = v_user_id
    and device_id = v_clean_device_id
    and is_revoked = false
    and id <> v_device.id;

  -- Remove sessões órfãs marcadas como ativas cujo auth_session_id já não existe
  -- em auth.sessions (ex.: logout ou expiração no servidor).
  begin
    delete from public.user_devices d
    where d.user_id = v_user_id
      and d.is_revoked = false
      and d.auth_session_id is not null
      and d.auth_session_id <> coalesce(v_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and not exists (
        select 1
        from auth.sessions s
        where s.id = d.auth_session_id
          and s.user_id = v_user_id
      );
  exception when insufficient_privilege then
    null;
  end;

  delete from public.user_devices
  where user_id = v_user_id
    and is_revoked = true
    and last_seen_at < now() - interval '90 days';

  return v_device;
end;
$$;

revoke all on function public.register_device_session(text, text, text, text, text) from public, anon;
grant execute on function public.register_device_session(text, text, text, text, text) to authenticated;

-- 2. Limpeza única de duplicatas ativas já existentes em public.user_devices
with ranked_active as (
  select
    id,
    row_number() over (
      partition by user_id, device_id
      order by last_seen_at desc, created_at desc, id desc
    ) as rn
  from public.user_devices
  where is_revoked = false
)
delete from public.user_devices d
using ranked_active r
where d.id = r.id
  and r.rn > 1;

-- 3. Limpeza única de sessões órfãs já encerradas em auth.sessions
do $$
begin
  delete from public.user_devices d
  where d.is_revoked = false
    and d.auth_session_id is not null
    and not exists (
      select 1
      from auth.sessions s
      where s.id = d.auth_session_id
        and s.user_id = d.user_id
    );
exception when insufficient_privilege then
  null;
end $$;
