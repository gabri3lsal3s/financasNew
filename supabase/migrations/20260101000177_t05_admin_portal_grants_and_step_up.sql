-- ============================================================================
-- Migration: 20260101000177_t05_admin_portal_grants_and_step_up.sql
-- Plano Mestre Multiconta e Isolamento de Sessões (T05)
-- Portal administrativo isolado: concessões de portal + step-up de uso único.
-- ============================================================================

create schema if not exists private_auth;

revoke all on schema private_auth from public, anon, authenticated;
grant usage on schema private_auth to service_role;

-- 1. Concessões de acesso ao portal administrativo isolado
create table if not exists private_auth.admin_portal_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid,
  portal_scope text not null default 'admin_portal',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  reason text,
  constraint chk_admin_portal_scope
    check (portal_scope in ('admin_portal', 'superadmin_portal'))
);

create index if not exists idx_admin_portal_grants_user_active
  on private_auth.admin_portal_grants(user_id, portal_scope, granted_at desc)
  where revoked_at is null;

revoke all on table private_auth.admin_portal_grants from public, anon, authenticated;
grant select, insert, update on table private_auth.admin_portal_grants to service_role;

-- 2. Desafios de step-up de uso único (validade máxima de 5 minutos, vinculados a operação e alvo)
create table if not exists private_auth.admin_step_up_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid,
  operation text not null,
  target_ref text not null,
  challenge_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  consumed_by_action text,
  constraint chk_admin_step_up_operation
    check (operation in ('delete_user', 'restore_user', 'reset_mfa', 'revoke_sessions')),
  constraint chk_admin_step_up_target_not_blank
    check (length(trim(target_ref)) > 0),
  constraint chk_admin_step_up_ttl_5min
    check (expires_at > created_at and expires_at <= created_at + interval '5 minutes')
);

create index if not exists idx_admin_step_up_active_lookup
  on private_auth.admin_step_up_challenges(user_id, operation, target_ref, expires_at desc)
  where consumed_at is null;

revoke all on table private_auth.admin_step_up_challenges from public, anon, authenticated;
grant select, insert, update on table private_auth.admin_step_up_challenges to service_role;

-- 3. Helpers internos em private_auth (exclusivos para service_role / SECURITY DEFINER)
create or replace function private_auth.has_valid_admin_portal_grant(
  p_user_id uuid,
  p_session_id uuid default null,
  p_scope text default 'admin_portal'
)
returns boolean
language sql
security definer
stable
set search_path = private_auth, public, pg_temp
as $$
  select exists (
    select 1
    from private_auth.admin_portal_grants g
    where g.user_id = p_user_id
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and (g.auth_session_id is null or g.auth_session_id = p_session_id)
      and (
        g.portal_scope = 'superadmin_portal'
        or g.portal_scope = coalesce(nullif(trim(p_scope), ''), 'admin_portal')
      )
  );
$$;

revoke all on function private_auth.has_valid_admin_portal_grant(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private_auth.has_valid_admin_portal_grant(uuid, uuid, text) to service_role;

create or replace function private_auth.grant_admin_portal_access(
  p_user_id uuid,
  p_granted_by uuid default null,
  p_portal_scope text default 'admin_portal',
  p_session_id uuid default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = private_auth, public, pg_temp
as $$
declare
  v_grant_id uuid;
  v_scope text := coalesce(nullif(trim(p_portal_scope), ''), 'admin_portal');
begin
  if p_user_id is null then
    raise exception 'user_id é obrigatório para conceder acesso ao portal administrativo.';
  end if;

  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'Acesso não autenticado.' using errcode = '28000';
  end if;

  if v_scope not in ('admin_portal', 'superadmin_portal') then
    raise exception 'Escopo de portal administrativo inválido.';
  end if;

  insert into private_auth.admin_portal_grants (
    user_id,
    auth_session_id,
    portal_scope,
    granted_by,
    expires_at,
    reason
  ) values (
    p_user_id,
    p_session_id,
    v_scope,
    p_granted_by,
    p_expires_at,
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_grant_id;

  return v_grant_id;
end;
$$;

revoke all on function private_auth.grant_admin_portal_access(uuid, uuid, text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function private_auth.grant_admin_portal_access(uuid, uuid, text, uuid, timestamptz, text) to service_role;

create or replace function private_auth.revoke_admin_portal_access(
  p_user_id uuid,
  p_revoked_by uuid default null,
  p_reason text default 'manual_revoke'
)
returns integer
language plpgsql
security definer
set search_path = private_auth, public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'user_id é obrigatório para revogar concessões do portal.';
  end if;

  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'Acesso não autenticado.' using errcode = '28000';
  end if;

  update private_auth.admin_portal_grants
  set revoked_at = now(),
      revoked_by = p_revoked_by,
      reason = coalesce(nullif(trim(p_reason), ''), reason)
  where user_id = p_user_id
    and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private_auth.revoke_admin_portal_access(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private_auth.revoke_admin_portal_access(uuid, uuid, text) to service_role;

create or replace function private_auth.consume_admin_step_up_challenge(
  p_user_id uuid,
  p_operation text,
  p_target_ref text,
  p_step_up_token text,
  p_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = private_auth, extensions, public, pg_temp
as $$
declare
  v_token text := trim(coalesce(p_step_up_token, ''));
  v_op text := trim(coalesce(p_operation, ''));
  v_target text := trim(coalesce(p_target_ref, ''));
  v_hash text;
  v_updated integer := 0;
begin
  if p_user_id is null or v_token = '' or v_op = '' or v_target = '' then
    return false;
  end if;

  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    return false;
  end if;

  v_hash := encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex');

  update private_auth.admin_step_up_challenges
  set consumed_at = now(),
      consumed_by_action = v_op
  where user_id = p_user_id
    and operation = v_op
    and target_ref = v_target
    and challenge_token_hash = v_hash
    and consumed_at is null
    and expires_at > now()
    and (auth_session_id is null or auth_session_id = p_session_id);

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function private_auth.consume_admin_step_up_challenge(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function private_auth.consume_admin_step_up_challenge(uuid, text, text, text, uuid) to service_role;

-- 4. RPCs públicas SECURITY DEFINER com search_path fixo e grants estritos
create or replace function public.admin_check_portal_grant()
returns jsonb
language plpgsql
security definer
stable
set search_path = private_auth, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_grant record;
begin
  if v_uid is null then
    return jsonb_build_object('granted', false, 'reason', 'unauthenticated');
  end if;

  if not public.is_admin() then
    return jsonb_build_object('granted', false, 'reason', 'admin_aal2_required');
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is not null and private_auth.is_session_revoked(v_session_id) then
    return jsonb_build_object('granted', false, 'reason', 'session_revoked');
  end if;

  select g.portal_scope, g.expires_at
  into v_grant
  from private_auth.admin_portal_grants g
  where g.user_id = v_uid
    and g.revoked_at is null
    and (g.expires_at is null or g.expires_at > now())
    and (g.auth_session_id is null or g.auth_session_id = v_session_id)
  order by g.granted_at desc
  limit 1;

  if not found then
    return jsonb_build_object('granted', false, 'reason', 'portal_grant_missing');
  end if;

  return jsonb_build_object(
    'granted', true,
    'portal_scope', v_grant.portal_scope,
    'expires_at', v_grant.expires_at
  );
end;
$$;

revoke all on function public.admin_check_portal_grant() from public, anon;
grant execute on function public.admin_check_portal_grant() to authenticated, service_role;

create or replace function public.admin_issue_step_up_challenge(
  p_operation text,
  p_target_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = private_auth, extensions, public, pg_temp
as $$
declare
  v_uid uuid;
  v_session_id uuid;
  v_op text := trim(coalesce(p_operation, ''));
  v_target text := trim(coalesce(p_target_ref, ''));
  v_token text;
  v_hash text;
  v_challenge_id uuid;
  v_expires_at timestamptz := now() + interval '5 minutes';
begin
  v_uid := public.assert_active_superadmin_aal2('emitir confirmação step-up administrativa');

  if v_op not in ('delete_user', 'restore_user', 'reset_mfa', 'revoke_sessions') then
    raise exception 'Operação administrativa não suportada para step-up.';
  end if;

  if v_target = '' then
    raise exception 'Alvo da operação é obrigatório para emissão de step-up.';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if not private_auth.has_valid_admin_portal_grant(v_uid, v_session_id, 'admin_portal') then
    raise exception 'Concessão ativa do portal administrativo não localizada.'
      using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex');

  insert into private_auth.admin_step_up_challenges (
    user_id,
    auth_session_id,
    operation,
    target_ref,
    challenge_token_hash,
    expires_at
  ) values (
    v_uid,
    v_session_id,
    v_op,
    v_target,
    v_hash,
    v_expires_at
  )
  returning id into v_challenge_id;

  return jsonb_build_object(
    'challenge_id', v_challenge_id,
    'step_up_token', v_token,
    'operation', v_op,
    'target_ref', v_target,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.admin_issue_step_up_challenge(text, text) from public, anon;
grant execute on function public.admin_issue_step_up_challenge(text, text) to authenticated, service_role;

-- 5. Wrappers exclusivos de service_role para Edge Functions (admin-super-action)
create or replace function public.admin_verify_portal_grant_service(
  p_user_id uuid,
  p_session_id uuid default null,
  p_scope text default 'admin_portal'
)
returns boolean
language sql
security definer
stable
set search_path = private_auth, public, pg_temp
as $$
  select private_auth.has_valid_admin_portal_grant(p_user_id, p_session_id, p_scope)
    and (p_session_id is null or not private_auth.is_session_revoked(p_session_id));
$$;

revoke all on function public.admin_verify_portal_grant_service(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_verify_portal_grant_service(uuid, uuid, text) to service_role;

create or replace function public.admin_consume_step_up_challenge_service(
  p_user_id uuid,
  p_operation text,
  p_target_ref text,
  p_step_up_token text,
  p_session_id uuid default null
)
returns boolean
language sql
security definer
set search_path = private_auth, extensions, public, pg_temp
as $$
  select private_auth.consume_admin_step_up_challenge(
    p_user_id,
    p_operation,
    p_target_ref,
    p_step_up_token,
    p_session_id
  );
$$;

revoke all on function public.admin_consume_step_up_challenge_service(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_consume_step_up_challenge_service(uuid, text, text, text, uuid) to service_role;
