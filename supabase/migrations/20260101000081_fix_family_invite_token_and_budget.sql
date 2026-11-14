-- ---------------------------------------------------------------------------
-- 20260101000081_fix_family_invite_token_and_budget.sql
-- Correção da RPC invite_family_member:
-- 1. Inclusão de extensions no search_path para acesso ao pgcrypto (gen_random_bytes).
-- 2. Fallback resiliente com gen_random_uuid() caso pgcrypto não esteja disponível.
-- 3. Invariante de Negócio: Limite máximo de 6 participantes por família
--    (membros ativos + convites pendentes e não expirados).
-- ---------------------------------------------------------------------------

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
  v_active_members_count int;
  v_pending_invites_count int;
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

  -- 4. Invariante: Limite máximo de 6 participantes na família (membros ativos + convites pendentes válidos)
  select count(*) into v_active_members_count
  from public.family_members
  where family_id = v_family_id;

  select count(*) into v_pending_invites_count
  from public.family_invites
  where family_id = v_family_id and status = 'pending' and expires_at > now();

  if (v_active_members_count + v_pending_invites_count) >= 6 then
    raise exception 'A família já atingiu o limite máximo de 6 participantes.' using errcode = '22023';
  end if;

  -- 5. Validação de papel
  if v_role not in ('member', 'admin') then
    raise exception 'Papel de convite inválido (permitido apenas member ou admin).' using errcode = '22023';
  end if;

  -- 6. Validação de e-mail se fornecido
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

  -- 7. Geração de token à prova de falha
  if p_token is not null and trim(p_token) != '' then
    v_token := trim(p_token);
    if length(v_token) not between 6 and 64 or v_token !~ '^[a-zA-Z0-9_-]+$' then
      raise exception 'Formato de token de convite inválido.' using errcode = '22023';
    end if;
  else
    begin
      v_token := encode(extensions.gen_random_bytes(24), 'hex');
    exception when others then
      v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_token := substr(v_token, 1, 48);
    end;
  end if;

  -- 8. Inserir convite ativo
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

-- Migration 0081: Vinculação de Proventos ao Ativo Caixa (Liquidação e Estorno)
-- Adiciona colunas para rastrear se o provento alimentou o saldo de Caixa da carteira
-- e o valor exato em BRL creditado.

alter table public.portfolio_dividends
  add column if not exists sync_cash boolean not null default false,
  add column if not exists cash_amount numeric(12, 2);

comment on column public.portfolio_dividends.sync_cash is 'Indica se o provento foi creditado diretamente no ativo Caixa para reinvestimento.';
comment on column public.portfolio_dividends.cash_amount is 'Valor em BRL creditado no saldo de Caixa na data do provento.';
