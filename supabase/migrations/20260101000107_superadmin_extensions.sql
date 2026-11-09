-- ============================================================================
-- Migration: 20260101000107_superadmin_extensions.sql
-- Recursos executivos de Superadmin: Reset de MFA com 1 clique e auditoria imutável
-- ============================================================================

-- 1. RPC para desativação de autenticador 2FA/MFA de um usuário pelo Superadmin
create or replace function public.admin_reset_user_mfa(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
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

  -- Remove os fatores MFA associados ao usuário alvo
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

revoke all on function public.admin_reset_user_mfa(uuid) from public;
grant execute on function public.admin_reset_user_mfa(uuid) to authenticated;

comment on function public.admin_reset_user_mfa(uuid) is
  'Desativa e remove compulsoriamente todos os fatores TOTP/MFA de uma conta de usuário, registrando auditoria imutável.';
