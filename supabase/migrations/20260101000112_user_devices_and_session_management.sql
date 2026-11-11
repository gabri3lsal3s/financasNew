-- ============================================================================
-- Migration: 20260101000112_user_devices_and_session_management.sql
-- Fase 1 (Etapa 1.1): Multi-Sessão Concorrente, Registro de Dispositivos e Revogação
-- Criação da tabela public.user_devices e RPCs de controle de sessão por aparelho
-- ============================================================================

-- 1. Criação da tabela public.user_devices
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null default 'Dispositivo desconhecido',
  browser text not null default 'Navegador',
  os text not null default 'Sistema',
  ip_address text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  is_revoked boolean not null default false,
  constraint user_devices_user_device_unique unique (user_id, device_id)
);

-- Índices de consulta rápida
create index if not exists idx_user_devices_user_id on public.user_devices(user_id);
create index if not exists idx_user_devices_lookup on public.user_devices(user_id, device_id);
create index if not exists idx_user_devices_active on public.user_devices(user_id, is_revoked);

-- 2. Habilitação e Imposição Estrita de RLS
alter table public.user_devices enable row level security;
alter table public.user_devices force row level security;

-- Políticas de RLS restritas ao próprio usuário autenticado
drop policy if exists user_devices_select on public.user_devices;
create policy user_devices_select on public.user_devices
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_devices_insert on public.user_devices;
create policy user_devices_insert on public.user_devices
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_devices_update on public.user_devices;
create policy user_devices_update on public.user_devices
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_devices_delete on public.user_devices;
create policy user_devices_delete on public.user_devices
  for delete to authenticated
  using (auth.uid() = user_id);

-- 3. RPC: Registro ou atualização de dispositivo da sessão ativa
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

  insert into public.user_devices (
    user_id,
    device_id,
    device_name,
    browser,
    os,
    ip_address,
    last_seen_at,
    is_revoked
  ) values (
    v_user_id,
    v_clean_device_id,
    coalesce(nullif(trim(p_device_name), ''), 'Dispositivo desconhecido'),
    coalesce(nullif(trim(p_browser), ''), 'Navegador'),
    coalesce(nullif(trim(p_os), ''), 'Sistema'),
    nullif(trim(p_ip_address), ''),
    now(),
    false
  )
  on conflict (user_id, device_id) do update set
    device_name = excluded.device_name,
    browser = excluded.browser,
    os = excluded.os,
    ip_address = coalesce(excluded.ip_address, user_devices.ip_address),
    last_seen_at = now(),
    is_revoked = false
  returning * into v_device;

  return v_device;
end;
$$;

revoke all on function public.register_device_session(text, text, text, text, text) from public, anon;
grant execute on function public.register_device_session(text, text, text, text, text) to authenticated;

-- 4. RPC: Consulta de revogação de sessão do aparelho
create or replace function public.check_device_session_revoked(
  p_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_revoked boolean;
begin
  if v_user_id is null then
    return true;
  end if;

  select is_revoked into v_is_revoked
  from public.user_devices
  where user_id = v_user_id and device_id = trim(coalesce(p_device_id, ''));

  if not found then
    return false;
  end if;

  return coalesce(v_is_revoked, false);
end;
$$;

revoke all on function public.check_device_session_revoked(text) from public, anon;
grant execute on function public.check_device_session_revoked(text) to authenticated;

-- 5. RPC: Revogação de sessão de dispositivo específico
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
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  update public.user_devices
  set is_revoked = true,
      last_seen_at = now()
  where id = p_device_record_id and user_id = v_user_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

revoke all on function public.revoke_device_session(uuid) from public, anon;
grant execute on function public.revoke_device_session(uuid) to authenticated;
