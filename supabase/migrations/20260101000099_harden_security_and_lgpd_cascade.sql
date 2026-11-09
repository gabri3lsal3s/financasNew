-- ---------------------------------------------------------------------------
-- 20260101000099_harden_security_and_lgpd_cascade.sql
-- Plano 17: Blindagem de Segurança, Defesa em Profundidade e Conformidade LGPD
-- 1. Blindagem de public_shares contra enumeração e dump desautenticado (G-01)
-- 2. Função de mascaramento de e-mail (public.mask_email)
-- 3. Mascaramento de PII em get_family_invite_preview (G-04)
-- 4. Blindagem de viagens: get_public_trip_ledger e add_public_trip_expense (G-02, G-03)
-- 5. Expurgo em cascata no Direito ao Esquecimento LGPD (G-05)
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. BLINDAGEM DE public_shares CONTRA ENUMERAÇÃO E DUMP (G-01)
-- ===========================================================================
drop policy if exists "public_shares_select" on public.public_shares;
create policy "public_shares_select"
  on public.public_shares
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. FUNÇÃO AUXILIAR DE MASCARAMENTO DE E-MAIL (LGPD / PII)
-- ===========================================================================
create or replace function public.mask_email(p_email text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_clean text;
  v_parts text[];
  v_user text;
  v_domain text;
begin
  v_clean := trim(coalesce(p_email, ''));
  if v_clean = '' or position('@' in v_clean) = 0 then
    return v_clean;
  end if;
  v_parts := string_to_array(v_clean, '@');
  v_user := v_parts[1];
  v_domain := v_parts[2];
  if length(v_user) <= 2 then
    return substr(v_user, 1, 1) || '***@' || v_domain;
  else
    return substr(v_user, 1, 1) || '***' || substr(v_user, length(v_user), 1) || '@' || v_domain;
  end if;
end;
$$;

comment on function public.mask_email(text) is
  'Mascara endereços de e-mail para exibição segura sem vazamento de PII (ex: g***s@exemplo.com).';

-- ===========================================================================
-- 3. MASCARAMENTO DE PII NA RPC get_family_invite_preview (G-04)
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
    'invited_email', public.mask_email(v_invite.invited_email),
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

revoke execute on function public.get_family_invite_preview(text) from public;
grant execute on function public.get_family_invite_preview(text) to anon, authenticated, service_role;

-- ===========================================================================
-- 4. BLINDAGEM DE VIAGENS COMPARTILHADAS (G-02 E G-03)
-- ===========================================================================
-- 4.1 get_public_trip_ledger com validação timing-safe e suporte a bcrypt
create or replace function public.get_public_trip_ledger(
  p_token text,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_trip record;
  v_members jsonb;
  v_expenses jsonb;
  v_settlements jsonb;
begin
  if p_token is null or trim(p_token) = '' then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;

  select * into v_trip
  from public.trips
  where public_token = p_token;

  if v_trip is null then
    return null;
  end if;

  -- Validação de passcode opcional / timing-safe
  if v_trip.passcode_hash is not null and v_trip.passcode_hash <> '' then
    if p_passcode is null or (
      case 
        when v_trip.passcode_hash like '$2%' then crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash
        else v_trip.passcode_hash <> p_passcode
      end
    ) then
      return jsonb_build_object(
        'requires_passcode', true,
        'trip_title', v_trip.title
      );
    end if;
  end if;

  -- Membros
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'is_host', m.is_host,
      'has_axis_account', (m.user_id is not null),
      'pix_key', m.pix_key,
      'pix_key_type', m.pix_key_type
    ) order by m.is_host desc, m.name asc
  ), '[]'::jsonb) into v_members
  from public.trip_members m
  where m.trip_id = v_trip.id;

  -- Despesas com splits
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'paid_by_member_id', e.paid_by_member_id,
      'amount_cents', e.amount_cents,
      'description', e.description,
      'category_name', e.category_name,
      'expense_date', e.expense_date,
      'split_type', e.split_type,
      'receipt_url', e.receipt_url,
      'created_at', e.created_at,
      'splits', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'member_id', s.member_id,
            'share_cents', s.share_cents
          )
        )
        from public.trip_expense_splits s
        where s.expense_id = e.id
      ), '[]'::jsonb)
    ) order by e.expense_date desc, e.created_at desc
  ), '[]'::jsonb) into v_expenses
  from public.trip_expenses e
  where e.trip_id = v_trip.id;

  -- Liquidações (settlements)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'from_member_id', s.from_member_id,
      'to_member_id', s.to_member_id,
      'amount_cents', s.amount_cents,
      'status', s.status,
      'confirmed_at', s.confirmed_at
    ) order by s.created_at asc
  ), '[]'::jsonb) into v_settlements
  from public.trip_settlements s
  where s.trip_id = v_trip.id;

  return jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'destination', v_trip.destination,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'status', v_trip.status,
      'currency', v_trip.currency,
      'public_token', v_trip.public_token,
      'cover_photo_url', v_trip.cover_photo_url,
      'has_passcode', (v_trip.passcode_hash is not null and v_trip.passcode_hash <> '')
    ),
    'members', v_members,
    'expenses', v_expenses,
    'settlements', v_settlements
  );
end;
$$;

revoke all on function public.get_public_trip_ledger(text, text) from public;
grant execute on function public.get_public_trip_ledger(text, text) to anon, authenticated, service_role;

-- 4.2 add_public_trip_expense com validação de senha e travas anti-DoS
create or replace function public.add_public_trip_expense(
  p_token text,
  p_paid_by_member_id uuid,
  p_amount_cents int,
  p_description text,
  p_category_name text,
  p_expense_date date,
  p_split_type text,
  p_splits jsonb,
  p_receipt_url text default null,
  p_created_by_member_id uuid default null,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_trip record;
  v_expense_id uuid;
  v_split record;
  v_total_split_cents integer := 0;
  v_expense_count integer := 0;
begin
  -- 1. Validações preliminares e teto monetário anti-DoS
  if p_token is null or trim(p_token) = '' then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'O valor deve ser positivo e não exceder R$ 1.000.000,00.' using errcode = '22023';
  end if;

  if p_description is null or trim(p_description) = '' or length(trim(p_description)) > 140 then
    raise exception 'A descrição é obrigatória e deve ter no máximo 140 caracteres.' using errcode = '22023';
  end if;

  -- 2. Localizar viagem
  select * into v_trip
  from public.trips
  where public_token = p_token;

  if v_trip is null then
    raise exception 'Viagem não encontrada.' using errcode = 'P0002';
  end if;

  if v_trip.status in ('completed', 'archived') then
    raise exception 'Esta viagem já foi finalizada ou arquivada.' using errcode = '42501';
  end if;

  -- Validação estrita de senha se a viagem possuir proteção
  if v_trip.passcode_hash is not null and v_trip.passcode_hash <> '' then
    if p_passcode is null or (
      case 
        when v_trip.passcode_hash like '$2%' then crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash
        else v_trip.passcode_hash <> p_passcode
      end
    ) then
      raise exception 'INVALID_PASSCODE: Código de acesso incorreto ou ausente.' using errcode = '42501';
    end if;
  end if;

  -- Trava defensiva contra DoS (máximo 500 despesas ativas por viagem)
  select count(*) into v_expense_count
  from public.trip_expenses
  where trip_id = v_trip.id;

  if v_expense_count >= 500 then
    raise exception 'LIMIT_REACHED: A viagem atingiu o limite máximo de 500 despesas.' using errcode = '22023';
  end if;

  -- 3. Validar se o membro pagador pertence à viagem
  if not exists (
    select 1 from public.trip_members
    where id = p_paid_by_member_id and trip_id = v_trip.id
  ) then
    raise exception 'Membro pagador não pertence a esta viagem.' using errcode = '22023';
  end if;

  -- 4. Validar soma das cotas
  for v_split in select * from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents int)
  loop
    v_total_split_cents := v_total_split_cents + v_split.share_cents;
  end loop;

  if v_total_split_cents <> p_amount_cents then
    raise exception 'A soma das cotas (%) deve ser exatamente igual ao valor total (%)', v_total_split_cents, p_amount_cents using errcode = '22023';
  end if;

  -- 5. Inserir despesa
  insert into public.trip_expenses (
    trip_id,
    paid_by_member_id,
    amount_cents,
    description,
    category_name,
    expense_date,
    split_type,
    receipt_url,
    created_by_member_id
  ) values (
    v_trip.id,
    p_paid_by_member_id,
    p_amount_cents,
    trim(p_description),
    coalesce(nullif(trim(p_category_name), ''), 'Geral'),
    coalesce(p_expense_date, current_date),
    coalesce(p_split_type, 'equal'),
    p_receipt_url,
    p_created_by_member_id
  ) returning id into v_expense_id;

  -- 6. Inserir splits
  insert into public.trip_expense_splits (expense_id, member_id, share_cents)
  select
    v_expense_id,
    x.member_id,
    x.share_cents
  from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents int);

  return jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id
  );
end;
$$;

revoke all on function public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid, text) from public;
grant execute on function public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid, text) to anon, authenticated, service_role;

-- ===========================================================================
-- 5. EXPURGO EM CASCATA NO DIREITO AO ESQUECIMENTO LGPD (G-05)
-- ===========================================================================
create or replace function public.delete_current_user_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_host_trip_ids uuid[];
  v_owner_family_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  -- 0. Desvincular despesas e rendas pessoais conectadas a viagens
  update public.expenses
  set trip_id = null, linked_trip_expense_id = null
  where user_id = v_user_id;

  update public.incomes
  set trip_id = null, linked_settlement_id = null
  where user_id = v_user_id;

  -- 1. Viagens onde o usuário é o ANFITRIÃO (host_user_id): expurgo integral
  select array_agg(id) into v_host_trip_ids
  from public.trips
  where host_user_id = v_user_id;

  if v_host_trip_ids is not null and array_length(v_host_trip_ids, 1) > 0 then
    delete from public.trip_settlements where trip_id = any(v_host_trip_ids);
    delete from public.trip_expense_splits where expense_id in (
      select id from public.trip_expenses where trip_id = any(v_host_trip_ids)
    );
    delete from public.trip_expenses where trip_id = any(v_host_trip_ids);
    delete from public.trip_members where trip_id = any(v_host_trip_ids);
    delete from public.trips where id = any(v_host_trip_ids);
  end if;

  -- Viagens onde o usuário é apenas PARTICIPANTE: desvincular PII do membro
  update public.trip_members
  set user_id = null, pix_key = null, pix_key_type = null
  where user_id = v_user_id;

  -- 2. Famílias onde o usuário é o PROPRIETÁRIO (owner_id): expurgo integral
  select array_agg(id) into v_owner_family_ids
  from public.families
  where owner_id = v_user_id;

  if v_owner_family_ids is not null and array_length(v_owner_family_ids, 1) > 0 then
    delete from public.family_settlements where family_id = any(v_owner_family_ids);
    delete from public.family_invites where family_id = any(v_owner_family_ids);
    delete from public.family_members where family_id = any(v_owner_family_ids);
    delete from public.families where id = any(v_owner_family_ids);
  end if;

  -- Famílias onde o usuário era apenas membro ou convidado
  delete from public.family_invites where invited_by = v_user_id or accepted_by = v_user_id;
  delete from public.family_members where user_id = v_user_id;

  -- 3. Compartilhamentos Públicos (public_shares)
  delete from public.public_shares where user_id = v_user_id;

  -- 4. Investimentos e Portfólio (filhos antes dos pais)
  delete from public.portfolio_dividend_dismissals where user_id = v_user_id;
  delete from public.portfolio_monthly_prices where user_id = v_user_id;
  delete from public.portfolio_transactions where user_id = v_user_id;
  delete from public.portfolio_contributions where user_id = v_user_id;
  delete from public.portfolio_dividends where user_id = v_user_id;
  delete from public.portfolio_snapshots where user_id = v_user_id;
  delete from public.allocation_presets where user_id = v_user_id;
  delete from public.allocation_targets where user_id = v_user_id;
  delete from public.class_targets where user_id = v_user_id;
  delete from public.sector_targets where user_id = v_user_id;
  delete from public.asset_prices where user_id = v_user_id;
  delete from public.cash_checkpoints where user_id = v_user_id;
  delete from public.portfolio_assets where user_id = v_user_id;

  -- 5. Cartões, Lançamentos, Empréstimos e Recorrências
  delete from public.card_competence_overrides where card_id in (select id from public.credit_cards where user_id = v_user_id);
  delete from public.card_payments where card_id in (select id from public.credit_cards where user_id = v_user_id);
  delete from public.recurrence_skips where recurrence_id in (select id from public.recurrences where user_id = v_user_id);
  delete from public.expenses where user_id = v_user_id;
  delete from public.incomes where user_id = v_user_id;
  delete from public.recurrences where user_id = v_user_id;
  delete from public.debts where user_id = v_user_id;
  delete from public.loans where user_id = v_user_id;
  delete from public.budgets where user_id = v_user_id;
  delete from public.income_goals where user_id = v_user_id;
  delete from public.credit_cards where user_id = v_user_id;
  delete from public.categories where user_id = v_user_id;

  -- 6. Extratos bancários, Lembretes, Feedbacks, Suporte e Telemetria
  if to_regclass('public.bank_statement_import_batches') is not null then
    if to_regclass('public.bank_statement_import_items') is not null then
      execute 'delete from public.bank_statement_import_items where batch_id in (select id from public.bank_statement_import_batches where user_id = $1)' using v_user_id;
    end if;
    execute 'delete from public.bank_statement_import_batches where user_id = $1' using v_user_id;
  end if;
  delete from public.reminder_states where user_id = v_user_id;
  delete from public.insight_feedback where user_id = v_user_id;
  delete from public.support_tickets where user_id = v_user_id;
  update public.support_tickets set admin_id = null where admin_id = v_user_id;
  delete from public.app_analytics_events where user_id = v_user_id;

  -- 7. Preferências, Permissões, Assinatura, Configurações e Auditoria
  delete from public.user_preferences where user_id = v_user_id;
  delete from public.user_feature_overrides where user_id = v_user_id;
  update public.user_feature_overrides set granted_by = null where granted_by = v_user_id;
  delete from public.user_module_permissions where user_id = v_user_id;
  update public.user_module_permissions set granted_by = null where granted_by = v_user_id;
  delete from public.user_subscriptions where user_id = v_user_id;
  delete from public.audit_events where user_id = v_user_id;
  update public.access_invites set created_by = null where created_by = v_user_id;
  update public.access_invites set approved_by = null where approved_by = v_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = v_user_id;

  -- 8. Perfil e Raiz em auth.users (liberação imediata de credenciais e e-mail)
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_current_user_account() from public;
grant execute on function public.delete_current_user_account() to authenticated, service_role;
