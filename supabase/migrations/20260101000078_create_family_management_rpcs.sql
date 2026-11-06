-- ---------------------------------------------------------------------------
-- 20260101000078_create_family_management_rpcs.sql
-- Módulo de Modo Família Colaborativo Multi-Contas & Consolidação Orçamentária
-- RPCs Transacionais de Gestão Familiar (Tarefa 1.3 / DoD Fase 1)
-- create_family, invite_family_member, accept_family_invite, leave_family, record_family_settlement.
-- Invariantes: Participante Único (uq_family_members_user), Fail-Closed (D4),
-- Zero Data Bleed e Isolamento RLS Integral.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. RPC: create_family
-- Cria uma unidade familiar e registra atomicamente o criador como proprietário.
-- ===========================================================================
create or replace function public.create_family(
  p_name text,
  p_monthly_budget numeric default null,
  p_split_rule text default 'equal',
  p_display_name text default null,
  p_pix_key text default null,
  p_pix_key_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_clean_name text;
  v_clean_display_name text;
  v_clean_pix_key text;
begin
  -- 1. Autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Invariante: participante único em família ativa
  if exists (select 1 from public.family_members where user_id = v_user_id) then
    raise exception 'Usuário já pertence a uma família ativa.' using errcode = '23505';
  end if;

  -- 3. Sanitização e validação do nome da família
  v_clean_name := trim(coalesce(p_name, ''));
  if length(v_clean_name) not between 1 and 100 then
    raise exception 'Nome da família deve conter entre 1 e 100 caracteres.' using errcode = '22023';
  end if;

  -- 4. Validação de teto orçamentário
  if p_monthly_budget is not null and p_monthly_budget < 0 then
    raise exception 'Teto orçamentário não pode ser negativo.' using errcode = '22023';
  end if;

  -- 5. Validação da regra de divisão
  if p_split_rule not in ('equal', 'proportional') then
    raise exception 'Regra de divisão inválida (esperado: equal ou proportional).' using errcode = '22023';
  end if;

  -- 6. Validação de chave Pix se informada
  if p_pix_key_type is not null and p_pix_key_type not in ('cpf', 'email', 'phone', 'random') then
    raise exception 'Tipo de chave Pix inválido.' using errcode = '22023';
  end if;

  v_clean_pix_key := nullif(trim(coalesce(p_pix_key, '')), '');

  -- 7. Resolver nome de exibição do proprietário
  v_clean_display_name := trim(coalesce(p_display_name, ''));
  if v_clean_display_name = '' then
    select coalesce(name, 'Titular') into v_clean_display_name from public.profiles where id = v_user_id;
  end if;

  -- 8. Inserir registro na tabela families
  insert into public.families (
    name,
    owner_id,
    monthly_budget,
    split_rule
  ) values (
    v_clean_name,
    v_user_id,
    p_monthly_budget,
    p_split_rule
  ) returning id into v_family_id;

  -- 9. Inserir atomicamente o membro proprietário
  insert into public.family_members (
    family_id,
    user_id,
    role,
    display_name,
    pix_key,
    pix_key_type,
    split_ratio
  ) values (
    v_family_id,
    v_user_id,
    'owner',
    nullif(v_clean_display_name, ''),
    v_clean_pix_key,
    p_pix_key_type,
    0.5000
  );

  return v_family_id;
end;
$$;

-- ===========================================================================
-- 2. RPC: invite_family_member
-- Gera convite seguro com token e validade de 7 dias para novo parceiro/membro.
-- ===========================================================================
create or replace function public.invite_family_member(
  p_family_id uuid default null,
  p_invited_email text default null,
  p_role text default 'member',
  p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_email text;
  v_role text := coalesce(p_role, 'member');
  v_token text;
  v_invite record;
begin
  -- 1. Autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Resolver family_id
  if p_family_id is not null then
    v_family_id := p_family_id;
  else
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'Família não encontrada.' using errcode = 'P0002';
  end if;

  -- 3. Autorização: apenas owner ou admin podem gerar convites
  if not public.is_family_admin(v_family_id, v_user_id) then
    raise exception 'Apenas administradores podem convidar membros para a família.' using errcode = '42501';
  end if;

  -- 4. Validação de papel
  if v_role not in ('member', 'admin') then
    raise exception 'Papel de convite inválido (permitido apenas member ou admin).' using errcode = '22023';
  end if;

  -- 5. Validação de e-mail se fornecido
  if p_invited_email is not null and trim(p_invited_email) != '' then
    v_email := lower(trim(p_invited_email));
    if length(v_email) not between 3 and 255 or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
      raise exception 'Formato de e-mail inválido.' using errcode = '22023';
    end if;

    -- Verificar se usuário já é membro desta família
    if exists (
      select 1
      from public.family_members fm
      join public.profiles p on p.id = fm.user_id
      where fm.family_id = v_family_id
        and lower(p.email) = v_email
    ) then
      raise exception 'Este usuário já é membro da família.' using errcode = '23505';
    end if;

    -- Revogar convites pendentes anteriores para o mesmo e-mail nesta família
    update public.family_invites
    set status = 'revoked'
    where family_id = v_family_id
      and lower(invited_email) = v_email
      and status = 'pending';
  else
    v_email := null;
  end if;

  -- 6. Geração ou validação de token criptográfico
  if p_token is not null and trim(p_token) != '' then
    v_token := trim(p_token);
    if length(v_token) not between 6 and 64 or v_token !~ '^[a-zA-Z0-9_-]+$' then
      raise exception 'Formato de token de convite inválido.' using errcode = '22023';
    end if;
  else
    v_token := encode(gen_random_bytes(24), 'hex');
  end if;

  -- 7. Inserir convite ativo
  insert into public.family_invites (
    family_id,
    invited_by,
    invited_email,
    token,
    role,
    status,
    expires_at
  ) values (
    v_family_id,
    v_user_id,
    v_email,
    v_token,
    v_role,
    'pending',
    now() + interval '7 days'
  ) returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'family_id', v_invite.family_id,
    'token', v_invite.token,
    'role', v_invite.role,
    'invited_email', v_invite.invited_email,
    'status', v_invite.status,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at
  );
end;
$$;

-- ===========================================================================
-- 3. RPC: accept_family_invite
-- Vincula atomicamente o parceiro autenticado à família via token de convite.
-- ===========================================================================
create or replace function public.accept_family_invite(
  p_token text,
  p_display_name text default null,
  p_pix_key text default null,
  p_pix_key_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean_token text;
  v_invite record;
  v_clean_display_name text;
  v_clean_pix_key text;
begin
  -- 1. Autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Sanitização e validação de token
  v_clean_token := trim(coalesce(p_token, ''));
  if length(v_clean_token) not between 6 and 64 then
    raise exception 'Token de convite inválido.' using errcode = '22023';
  end if;

  -- 3. Invariante: participante único em família ativa
  if exists (select 1 from public.family_members where user_id = v_user_id) then
    raise exception 'Você já pertence a uma família ativa. Para entrar em outra família, saia da atual primeiro.' using errcode = '23505';
  end if;

  -- 4. Localizar convite com trava de linha (for update) para prevenir condições de corrida
  select *
  into v_invite
  from public.family_invites
  where token = v_clean_token
  for update;

  if v_invite is null then
    raise exception 'Convite não encontrado ou inválido.' using errcode = 'P0002';
  end if;

  -- 5. Validação de status e prazo
  if v_invite.status = 'accepted' then
    raise exception 'Este convite já foi utilizado.' using errcode = '22023';
  elsif v_invite.status = 'revoked' then
    raise exception 'Este convite foi revogado.' using errcode = '22023';
  elsif v_invite.status = 'expired' or v_invite.expires_at <= now() then
    update public.family_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Este convite expirou.' using errcode = '22023';
  end if;

  -- 6. Impedir auto-convite
  if v_invite.invited_by = v_user_id then
    raise exception 'Você não pode aceitar um convite criado por você mesmo.' using errcode = '22023';
  end if;

  -- 7. Validação de chave Pix se informada
  if p_pix_key_type is not null and p_pix_key_type not in ('cpf', 'email', 'phone', 'random') then
    raise exception 'Tipo de chave Pix inválido.' using errcode = '22023';
  end if;

  v_clean_pix_key := nullif(trim(coalesce(p_pix_key, '')), '');

  -- 8. Resolver display_name do membro
  v_clean_display_name := trim(coalesce(p_display_name, ''));
  if v_clean_display_name = '' then
    select coalesce(name, 'Membro') into v_clean_display_name from public.profiles where id = v_user_id;
  end if;

  -- 9. Inserir membro na família
  insert into public.family_members (
    family_id,
    user_id,
    role,
    display_name,
    pix_key,
    pix_key_type,
    split_ratio
  ) values (
    v_invite.family_id,
    v_user_id,
    v_invite.role,
    nullif(v_clean_display_name, ''),
    v_clean_pix_key,
    p_pix_key_type,
    0.5000
  );

  -- 10. Marcar convite como aceito
  update public.family_invites
  set status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'success', true,
    'family_id', v_invite.family_id,
    'role', v_invite.role
  );
end;
$$;

-- ===========================================================================
-- 4. RPC: leave_family
-- Remove o usuário da família ou dissolve a unidade (se proprietário).
-- Desvincula despesas e categorias pessoais para prevenir vazamentos (Zero Data Bleed).
-- ===========================================================================
create or replace function public.leave_family(
  p_family_id uuid default null,
  p_transfer_to_user_id uuid default null,
  p_disband boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_member record;
  v_family record;
  v_other_members_count int;
  v_disbanded boolean := false;
begin
  -- 1. Autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Localizar membresia
  if p_family_id is not null then
    select * into v_member
    from public.family_members
    where user_id = v_user_id and family_id = p_family_id;
  else
    select * into v_member
    from public.family_members
    where user_id = v_user_id
    limit 1;
  end if;

  if v_member is null then
    raise exception 'Usuário não pertence a esta família.' using errcode = '42501';
  end if;

  v_family_id := v_member.family_id;

  select * into v_family from public.families where id = v_family_id;

  -- Contagem de outros membros na família
  select count(*) into v_other_members_count
  from public.family_members
  where family_id = v_family_id and user_id != v_user_id;

  -- 3. Tratamento condicional para proprietário vs membro regular
  if v_member.role = 'owner' or v_family.owner_id = v_user_id then
    if v_other_members_count = 0 or p_disband = true then
      -- Dissolução completa da família:
      -- ON DELETE CASCADE remove members, invites e settlements.
      -- ON DELETE SET NULL desvincula family_id em expenses, incomes e categories.
      delete from public.families where id = v_family_id;
      v_disbanded := true;
    elsif p_transfer_to_user_id is not null then
      -- Validação do novo proprietário
      if not exists (
        select 1 from public.family_members
        where family_id = v_family_id and user_id = p_transfer_to_user_id
      ) then
        raise exception 'Novo proprietário deve ser membro da família.' using errcode = '22023';
      end if;

      -- Transfere a titularidade na tabela families
      update public.families
      set owner_id = p_transfer_to_user_id
      where id = v_family_id;

      -- Promove o novo membro a owner
      update public.family_members
      set role = 'owner'
      where family_id = v_family_id and user_id = p_transfer_to_user_id;

      -- Remove o usuário atual da membresia
      delete from public.family_members
      where family_id = v_family_id and user_id = v_user_id;

      -- Desvincula lançamentos do usuário que saiu
      update public.expenses
      set family_id = null, is_family = false
      where family_id = v_family_id and user_id = v_user_id;

      update public.incomes
      set family_id = null, is_family = false
      where family_id = v_family_id and user_id = v_user_id;

      update public.categories
      set family_id = null, is_family = false
      where family_id = v_family_id and user_id = v_user_id;
    else
      raise exception 'Como proprietário, você deve transferir a titularidade ou confirmar a dissolução da família.' using errcode = '22023';
    end if;
  else
    -- Membro comum ou admin saindo da família
    delete from public.family_members
    where family_id = v_family_id and user_id = v_user_id;

    -- Revoga convites pendentes criados por ele
    update public.family_invites
    set status = 'revoked'
    where family_id = v_family_id and invited_by = v_user_id and status = 'pending';

    -- Desvincula lançamentos do usuário que saiu
    update public.expenses
    set family_id = null, is_family = false
    where family_id = v_family_id and user_id = v_user_id;

    update public.incomes
    set family_id = null, is_family = false
    where family_id = v_family_id and user_id = v_user_id;

    update public.categories
    set family_id = null, is_family = false
    where family_id = v_family_id and user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'family_id', v_family_id,
    'disbanded', v_disbanded
  );
end;
$$;

-- ===========================================================================
-- 5. RPC: record_family_settlement
-- Registra acerto financeiro auditável do mês entre os parceiros da família.
-- ===========================================================================
create or replace function public.record_family_settlement(
  p_month text,
  p_payer_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_family_id uuid default null,
  p_payment_method text default 'pix',
  p_notes text default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_settlement_id uuid;
  v_clean_month text;
  v_clean_method text := coalesce(p_payment_method, 'pix');
begin
  -- 1. Autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Resolver family_id
  if p_family_id is not null then
    v_family_id := p_family_id;
  else
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'Família não encontrada.' using errcode = 'P0002';
  end if;

  -- 3. Validação de membresia do autor
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'Acesso negado: usuário não pertence à família especificada.' using errcode = '42501';
  end if;

  -- 4. Validação da competência (mês YYYY-MM)
  v_clean_month := trim(coalesce(p_month, ''));
  if v_clean_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (formato esperado: YYYY-MM).' using errcode = '22023';
  end if;

  -- 5. Validação de valor do acerto
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do acerto deve ser maior que zero.' using errcode = '22023';
  end if;

  -- 6. Validação de pagador e recebedor
  if p_payer_id = p_receiver_id then
    raise exception 'Pagador e recebedor devem ser membros diferentes.' using errcode = '22023';
  end if;

  if not public.is_family_member(v_family_id, p_payer_id) then
    raise exception 'Pagador não é membro da família.' using errcode = '22023';
  end if;

  if not public.is_family_member(v_family_id, p_receiver_id) then
    raise exception 'Recebedor não é membro da família.' using errcode = '22023';
  end if;

  -- 7. Autorização: quem pode registrar? Payer, Receiver ou Admin da família
  if v_user_id != p_payer_id and v_user_id != p_receiver_id and not public.is_family_admin(v_family_id, v_user_id) then
    raise exception 'Apenas o pagador, recebedor ou administrador podem registrar este acerto.' using errcode = '42501';
  end if;

  -- 8. Validação de método de pagamento
  if v_clean_method not in ('pix', 'transfer', 'cash', 'other') then
    raise exception 'Método de pagamento inválido.' using errcode = '22023';
  end if;

  -- 9. Inserção do acerto auditável na tabela family_settlements
  insert into public.family_settlements (
    family_id,
    month,
    payer_id,
    receiver_id,
    amount,
    settled_at,
    payment_method,
    notes,
    snapshot,
    created_by
  ) values (
    v_family_id,
    v_clean_month,
    p_payer_id,
    p_receiver_id,
    p_amount,
    now(),
    v_clean_method,
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_snapshot, '{}'::jsonb),
    v_user_id
  ) returning id into v_settlement_id;

  return v_settlement_id;
end;
$$;

-- ===========================================================================
-- 6. Concessão e Revogação Estrita de Privilégios PostgREST
-- Bloqueio total a acessos anônimos; liberação exclusiva a authenticated e service_role.
-- ===========================================================================
revoke execute on function public.create_family(text, numeric, text, text, text, text) from public, anon;
grant execute on function public.create_family(text, numeric, text, text, text, text) to authenticated, service_role;

revoke execute on function public.invite_family_member(uuid, text, text, text) from public, anon;
grant execute on function public.invite_family_member(uuid, text, text, text) to authenticated, service_role;

revoke execute on function public.accept_family_invite(text, text, text, text) from public, anon;
grant execute on function public.accept_family_invite(text, text, text, text) to authenticated, service_role;

revoke execute on function public.leave_family(uuid, uuid, boolean) from public, anon;
grant execute on function public.leave_family(uuid, uuid, boolean) to authenticated, service_role;

revoke execute on function public.record_family_settlement(text, uuid, uuid, numeric, uuid, text, text, jsonb) from public, anon;
grant execute on function public.record_family_settlement(text, uuid, uuid, numeric, uuid, text, text, jsonb) to authenticated, service_role;
