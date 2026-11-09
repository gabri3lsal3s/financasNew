-- ---------------------------------------------------------------------------
-- 20260101000098_trips_multi_user_collaboration_and_sync.sql
-- Evolução Colaborativa: Vínculo Multi-Contas, RLS Refinado e RPCs Transacionais
-- ---------------------------------------------------------------------------

-- 1. RPC: REIVINDICAR / VINCULAR CONTA DE MEMBRO (claim_trip_member)
create or replace function public.claim_trip_member(
  p_trip_token text,
  p_member_id uuid,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip record;
  v_member record;
  v_user_pix text;
  v_user_pix_type text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Usuário precisa estar autenticado para vincular conta.';
  end if;

  -- 1. Busca e valida viagem
  select id, passcode_hash, status into v_trip
  from public.trips
  where public_token = p_trip_token;

  if not found then
    raise exception 'NOT_FOUND: Viagem não encontrada para o token informado.';
  end if;

  -- Validação de passcode se configurado
  if v_trip.passcode_hash is not null and v_trip.passcode_hash <> '' then
    if p_passcode is null or (
      case 
        when v_trip.passcode_hash like '$2%' then crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash
        else v_trip.passcode_hash <> p_passcode
      end
    ) then
      raise exception 'INVALID_PASSCODE: Código de acesso incorreto.';
    end if;
  end if;

  -- 2. Busca e valida membro
  select id, user_id, trip_id into v_member
  from public.trip_members
  where id = p_member_id and trip_id = v_trip.id;

  if not found then
    raise exception 'NOT_FOUND: Participante não encontrado nesta viagem.';
  end if;

  if v_member.user_id is not null and v_member.user_id <> v_user_id then
    raise exception 'ALREADY_CLAIMED: Este participante já está vinculado a outra conta.';
  end if;

  -- 3. Resgata chave Pix do perfil se disponível
  select 
    custom_settings->>'defaultPixKey',
    custom_settings->>'defaultPixKeyType'
  into v_user_pix, v_user_pix_type
  from public.user_preferences
  where user_id = v_user_id;

  if v_user_pix is null then
    select pix_key, pix_key_type
    into v_user_pix, v_user_pix_type
    from public.family_members
    where user_id = v_user_id and pix_key is not null
    limit 1;
  end if;

  -- 4. Atualiza vínculo do membro
  update public.trip_members
  set 
    user_id = v_user_id,
    pix_key = coalesce(pix_key, v_user_pix),
    pix_key_type = coalesce(pix_key_type, v_user_pix_type)
  where id = p_member_id;

  -- 5. Ativa Modo Viagem nas preferências do usuário
  insert into public.user_preferences (user_id, custom_settings)
  values (v_user_id, jsonb_build_object('tripModeEnabled', true))
  on conflict (user_id) do update
  set custom_settings = jsonb_set(
    coalesce(public.user_preferences.custom_settings, '{}'::jsonb),
    '{tripModeEnabled}',
    'true'::jsonb,
    true
  );

  return jsonb_build_object(
    'success', true,
    'trip_id', v_trip.id,
    'member_id', p_member_id,
    'user_id', v_user_id
  );
end;
$$;

revoke all on function public.claim_trip_member(text, uuid, text) from public;
grant execute on function public.claim_trip_member(text, uuid, text) to authenticated, service_role;

-- 2. RPC: DESVINCULAR CONTA DE MEMBRO (unlink_trip_member)
create or replace function public.unlink_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_host boolean;
  v_target_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Usuário não autenticado.';
  end if;

  -- Verifica se é o host ou o próprio membro
  v_is_host := public.is_trip_host(p_trip_id, v_user_id);
  
  select user_id into v_target_user_id
  from public.trip_members
  where id = p_member_id and trip_id = p_trip_id;

  if not found then
    raise exception 'NOT_FOUND: Membro não encontrado na viagem.';
  end if;

  if not v_is_host and (v_target_user_id is null or v_target_user_id <> v_user_id) then
    raise exception 'PERMISSION_DENIED: Apenas o anfitrião ou o próprio usuário podem desvincular a conta.';
  end if;

  update public.trip_members
  set user_id = null
  where id = p_member_id;

  return jsonb_build_object('success', true, 'member_id', p_member_id);
end;
$$;

revoke all on function public.unlink_trip_member(uuid, uuid) from public;
grant execute on function public.unlink_trip_member(uuid, uuid) to authenticated, service_role;

-- 3. RPC: EXCLUSÃO SINCRONIZADA DE DESPESA (delete_trip_expense_sync)
create or replace function public.delete_trip_expense_sync(
  p_expense_id uuid,
  p_delete_personal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_personal_id uuid;
  v_payer_user_id uuid;
  v_creator_user_id uuid;
  v_is_host boolean;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Usuário não autenticado.';
  end if;

  -- Busca despesa
  select 
    te.trip_id, 
    te.linked_personal_expense_id,
    tm_payer.user_id,
    tm_creator.user_id
  into v_trip_id, v_personal_id, v_payer_user_id, v_creator_user_id
  from public.trip_expenses te
  left join public.trip_members tm_payer on tm_payer.id = te.paid_by_member_id
  left join public.trip_members tm_creator on tm_creator.id = te.created_by_member_id
  where te.id = p_expense_id;

  if not found then
    raise exception 'NOT_FOUND: Despesa de viagem não encontrada.';
  end if;

  v_is_host := public.is_trip_host(v_trip_id, v_user_id);

  if not v_is_host 
     and (v_payer_user_id is null or v_payer_user_id <> v_user_id)
     and (v_creator_user_id is null or v_creator_user_id <> v_user_id) then
    raise exception 'PERMISSION_DENIED: Sem permissão para excluir esta despesa.';
  end if;

  -- 1. Exclui a despesa pessoal se solicitado e se pertencer ao usuário
  if p_delete_personal and v_personal_id is not null then
    delete from public.expenses
    where id = v_personal_id and user_id = v_user_id;
  elsif v_personal_id is not null then
    -- Se não excluiu a despesa pessoal, desvincula o trip_id
    update public.expenses
    set trip_id = null
    where id = v_personal_id;
  end if;

  -- 2. Exclui da viagem (cascata remove splits)
  delete from public.trip_expenses
  where id = p_expense_id;

  return jsonb_build_object(
    'success', true,
    'deleted_trip_expense_id', p_expense_id,
    'deleted_personal_expense', p_delete_personal and v_personal_id is not null
  );
end;
$$;

revoke all on function public.delete_trip_expense_sync(uuid, boolean) from public;
grant execute on function public.delete_trip_expense_sync(uuid, boolean) to authenticated, service_role;

-- 4. AJUSTE DE RLS PARA MEMBROS AUTENTICADOS (trip_members)
drop policy if exists "trip_members_write_policy" on public.trip_members;
create policy "trip_members_write_policy" on public.trip_members
  for all to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or user_id = (select auth.uid())
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or user_id = (select auth.uid())
  );
