-- ---------------------------------------------------------------------------
-- 20260101000085_create_remove_family_member_rpc.sql
-- Módulo de Modo Família: Remoção de Membro pelo Titular
-- Permite que exclusivamente o titular (role = 'owner') remova um participante
-- da família com garantia de Zero Data Bleed (desvinculando dados da casa).
-- ---------------------------------------------------------------------------

create or replace function public.remove_family_member(
  p_family_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_member record;
  v_target_member record;
  v_family record;
begin
  -- 1. Autenticação fail-closed
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Validação de parâmetros
  if p_family_id is null or p_target_user_id is null then
    raise exception 'family_id e target_user_id são obrigatórios.' using errcode = '22023';
  end if;

  -- 3. O titular não pode remover a si mesmo por esta função
  if v_caller_id = p_target_user_id then
    raise exception 'O titular não pode remover a si mesmo. Para dissolver a família, use a exclusão de família.' using errcode = '22023';
  end if;

  -- 4. Verificar se a família existe
  select * into v_family
  from public.families
  where id = p_family_id;

  if v_family is null then
    raise exception 'Família não encontrada.' using errcode = 'P0002';
  end if;

  -- 5. Verificar se quem está chamando é o titular (role = 'owner' ou owner_id)
  select * into v_caller_member
  from public.family_members
  where family_id = p_family_id and user_id = v_caller_id;

  if v_caller_member is null or (v_caller_member.role <> 'owner' and v_family.owner_id <> v_caller_id) then
    raise exception 'Apenas o titular da família tem permissão para remover membros.' using errcode = '42501';
  end if;

  -- 6. Verificar se o membro alvo pertence a esta família
  select * into v_target_member
  from public.family_members
  where family_id = p_family_id and user_id = p_target_user_id;

  if v_target_member is null then
    raise exception 'O usuário especificado não é membro desta família.' using errcode = '42501';
  end if;

  -- 7. Remover o participante da família
  delete from public.family_members
  where family_id = p_family_id and user_id = p_target_user_id;

  -- 8. Revogar convites pendentes que o membro alvo tenha emitido
  update public.family_invites
  set status = 'revoked'
  where family_id = p_family_id and invited_by = p_target_user_id and status = 'pending';

  -- 9. Desvincular despesas, receitas, categorias e ativos do lar do membro removido (Zero Data Bleed)
  update public.expenses
  set family_id = null, is_family = false
  where family_id = p_family_id and user_id = p_target_user_id;

  update public.incomes
  set family_id = null, is_family = false
  where family_id = p_family_id and user_id = p_target_user_id;

  update public.categories
  set family_id = null, is_family = false
  where family_id = p_family_id and user_id = p_target_user_id;

  update public.portfolio_assets
  set family_id = null, is_family_shared = false
  where family_id = p_family_id and user_id = p_target_user_id;

  return jsonb_build_object(
    'success', true,
    'family_id', p_family_id,
    'removed_user_id', p_target_user_id
  );
end;
$$;

revoke execute on function public.remove_family_member(uuid, uuid) from public, anon;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated, service_role;
