-- ---------------------------------------------------------------------------
-- 20260101000080_create_get_family_invite_preview_rpc.sql
-- Módulo de Modo Família Colaborativo Multi-Contas & Consolidação Orçamentária
-- Tarefa 4.1: Rota Pública de Convite (/convite-familiar/:token)
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- RPC: get_family_invite_preview
-- Permite que visitantes (anônimos ou autenticados) consultem com segurança
-- as informações básicas de um convite para exibir o nome do convidador e
-- da família sem expor dados financeiros ou bancários (Zero Data Bleed).
-- ===========================================================================
create or replace function public.get_family_invite_preview(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_token text;
  v_invite record;
  v_family_name text;
  v_inviter_name text;
  v_status text;
begin
  -- 1. Sanitização e validação de token
  v_clean_token := trim(coalesce(p_token, ''));
  if length(v_clean_token) not between 6 and 64 then
    return null;
  end if;

  -- 2. Localizar convite
  select *
  into v_invite
  from public.family_invites
  where token = v_clean_token
  limit 1;

  if v_invite is null then
    return null;
  end if;

  -- 3. Atualizar status para expired se prazo encerrou
  v_status := v_invite.status;
  if v_invite.status = 'pending' and v_invite.expires_at <= now() then
    v_status := 'expired';
    update public.family_invites
    set status = 'expired'
    where id = v_invite.id;
  end if;

  -- 4. Obter nome da família
  select name
  into v_family_name
  from public.families
  where id = v_invite.family_id;

  -- 5. Obter nome do convidador no perfil
  select name
  into v_inviter_name
  from public.profiles
  where id = v_invite.invited_by;

  return jsonb_build_object(
    'id', v_invite.id,
    'family_id', v_invite.family_id,
    'invited_by', v_invite.invited_by,
    'invited_email', v_invite.invited_email,
    'token', v_invite.token,
    'status', v_status,
    'role', v_invite.role,
    'created_at', v_invite.created_at,
    'expires_at', v_invite.expires_at,
    'accepted_by', v_invite.accepted_by,
    'accepted_at', v_invite.accepted_at,
    'family_name', coalesce(v_family_name, 'Família'),
    'inviter_name', coalesce(v_inviter_name, 'Parceiro(a)')
  );
end;
$$;

-- Privilégios PostgREST: anônimos e autenticados podem consultar preview via token criptográfico seguro
revoke execute on function public.get_family_invite_preview(text) from public;
grant execute on function public.get_family_invite_preview(text) to anon, authenticated, service_role;
