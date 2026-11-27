-- ============================================================================
-- Migration: 20260101000176_t03_private_session_revocation_registry.sql
-- Plano Mestre Multiconta e Isolamento de Sessões (T03)
-- Registry privado de revogação de sessões em schema não exposto ao PostgREST.
-- ============================================================================

create schema if not exists private_auth;

revoke all on schema private_auth from public, anon, authenticated;
grant usage on schema private_auth to service_role;

create table if not exists private_auth.session_revocation_registry (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text,
  revoked_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  reason text not null default 'user_logout',
  upstream_confirmed boolean not null default false,
  confirmed_at timestamptz
);

create index if not exists idx_private_revocation_user_id
  on private_auth.session_revocation_registry(user_id, revoked_at desc);

create index if not exists idx_private_revocation_pending
  on private_auth.session_revocation_registry(upstream_confirmed, revoked_at)
  where upstream_confirmed = false;

revoke all on table private_auth.session_revocation_registry from public, anon, authenticated;
grant select, insert, update on table private_auth.session_revocation_registry to service_role;

create or replace function private_auth.record_session_revocation(
  p_session_id uuid,
  p_user_id uuid,
  p_installation_id text default null,
  p_revoked_by uuid default null,
  p_reason text default 'user_logout',
  p_upstream_confirmed boolean default false
)
returns void
language plpgsql
security definer
set search_path = private_auth, public, pg_temp
as $$
begin
  if p_session_id is null or p_user_id is null then
    raise exception 'session_id e user_id são obrigatórios.';
  end if;

  insert into private_auth.session_revocation_registry (
    session_id,
    user_id,
    installation_id,
    revoked_by,
    reason,
    upstream_confirmed,
    confirmed_at
  ) values (
    p_session_id,
    p_user_id,
    nullif(trim(coalesce(p_installation_id, '')), ''),
    p_revoked_by,
    coalesce(nullif(trim(p_reason), ''), 'user_logout'),
    coalesce(p_upstream_confirmed, false),
    case when coalesce(p_upstream_confirmed, false) then now() else null end
  )
  on conflict (session_id) do update set
    upstream_confirmed = private_auth.session_revocation_registry.upstream_confirmed or excluded.upstream_confirmed,
    confirmed_at = coalesce(private_auth.session_revocation_registry.confirmed_at, excluded.confirmed_at),
    reason = excluded.reason;

  insert into public.revoked_auth_sessions (session_id, user_id, revoked_by, reason)
  values (p_session_id, p_user_id, p_revoked_by, coalesce(nullif(trim(p_reason), ''), 'user_logout'))
  on conflict (session_id) do nothing;
end;
$$;

revoke all on function private_auth.record_session_revocation(uuid, uuid, text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function private_auth.record_session_revocation(uuid, uuid, text, uuid, text, boolean) to service_role;

create or replace function private_auth.is_session_revoked(
  p_session_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = private_auth, public, pg_temp
as $$
  select exists(
    select 1
    from private_auth.session_revocation_registry r
    where r.session_id = p_session_id
  )
  or exists(
    select 1
    from public.revoked_auth_sessions r2
    where r2.session_id = p_session_id
  );
$$;

revoke all on function private_auth.is_session_revoked(uuid) from public, anon, authenticated;
grant execute on function private_auth.is_session_revoked(uuid) to service_role;
