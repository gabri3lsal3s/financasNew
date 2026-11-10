-- ============================================================================
-- Migration: 20260101000111_security_hardening_audit.sql
-- Auditoria de Segurança: Hardening Canônico de RLS e Search Path
-- 1. admin_reset_user_mfa: fixação estrita de search_path = public, pg_temp
-- 2. broadcast_notifications_write: validação fail-closed com auth.uid() is not null
-- 3. system_backups_admin_policy: validação fail-closed com auth.uid() is not null
-- ============================================================================

-- 1. Reafirmação da RPC com search_path seguro
create or replace function public.admin_reset_user_mfa(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.user_role;
  v_deleted_count integer := 0;
begin
  if v_caller_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  select role into v_caller_role from public.profiles where id = v_caller_id;
  if v_caller_role is distinct from 'superadmin'::public.user_role then
    raise exception 'Apenas superadministradores possuem permissão para desativar autenticadores 2FA.';
  end if;

  -- Remove os fatores MFA associados ao usuário alvo de forma atômica
  delete from auth.mfa_factors where user_id = target_user_id;
  get diagnostics v_deleted_count = row_count;

  -- Registra compulsoriamente a ação na trilha de auditoria LGPD
  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_caller_id,
    'profiles',
    target_user_id,
    'ADMIN_RESET_MFA',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'factors_removed', v_deleted_count,
      'timestamp', now()
    )
  );

  return true;
end;
$$;

revoke all on function public.admin_reset_user_mfa(uuid) from public, anon;
grant execute on function public.admin_reset_user_mfa(uuid) to authenticated;

-- 2. Hardening de RLS para Notificações Broadcast Administrativas
drop policy if exists broadcast_notifications_write on public.admin_broadcast_notifications;
create policy broadcast_notifications_write on public.admin_broadcast_notifications
  for all to authenticated
  using (public.is_admin() and auth.uid() is not null)
  with check (public.is_admin() and auth.uid() is not null);

-- 3. Hardening de RLS para Tabela de Backups do Sistema
drop policy if exists system_backups_admin_policy on public.system_backups;
create policy system_backups_admin_policy on public.system_backups
  for all to authenticated
  using (public.is_admin() and auth.uid() is not null)
  with check (public.is_admin() and auth.uid() is not null);
