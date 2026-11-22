-- ---------------------------------------------------------------------------
-- 20260101000134_harden_split_expenses_sync_and_links.sql
-- Reestruturação Holística do Módulo de Racha (Despesa Compartilhada):
-- 1. Colunas relacionais (expense_id, installment_group_id, debt_id) + unicidade 1:1
-- 2. Trigger sync_split_public_share_revocation com suporte a pausa manual (public_page_paused)
-- 3. Hardening da RPC get_public_share_by_token (bloqueio de pausados + retorno de vínculos)
-- 4. Hardening da RPC signal_split_payment (bloqueia anfitrião, cotas já quitadas e suporta p_installment_ids)
-- 5. Atualização da RPC dismiss_split_payment_signal para desarmar múltiplas parcelas
-- ---------------------------------------------------------------------------

-- 1. Colunas relacionais opcionais em public.public_shares
alter table public.public_shares
  add column if not exists expense_id uuid references public.expenses(id) on delete set null,
  add column if not exists installment_group_id uuid,
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

-- 2. Backfill seguro a partir do payload JSONB com deduplicação prévia
do $$
declare
  v_uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  -- Backfill de expense_id mantendo apenas o registro mais relevante por (user_id, expense_id)
  with candidates as (
    select
      ps.id as share_id,
      (ps.payload->>'expense_id')::uuid as parsed_expense_id,
      row_number() over (
        partition by ps.user_id, (ps.payload->>'expense_id')::uuid
        order by ps.is_revoked asc, ps.updated_at desc, ps.created_at desc, ps.id desc
      ) as rn
    from public.public_shares ps
    where ps.kind = 'split'
      and ps.expense_id is null
      and coalesce(ps.payload->>'expense_id', '') ~ v_uuid_regex
      and exists (
        select 1
        from public.expenses e
        where e.id = (ps.payload->>'expense_id')::uuid
          and e.user_id = ps.user_id
      )
  )
  update public.public_shares ps
  set expense_id = c.parsed_expense_id
  from candidates c
  where ps.id = c.share_id
    and c.rn = 1;

  -- Backfill de installment_group_id mantendo apenas o registro mais relevante por (user_id, installment_group_id)
  with group_candidates as (
    select
      ps.id as share_id,
      (ps.payload->>'installment_group_id')::uuid as parsed_group_id,
      row_number() over (
        partition by ps.user_id, (ps.payload->>'installment_group_id')::uuid
        order by ps.is_revoked asc, ps.updated_at desc, ps.created_at desc, ps.id desc
      ) as rn
    from public.public_shares ps
    where ps.kind = 'split'
      and ps.installment_group_id is null
      and coalesce(ps.payload->>'installment_group_id', '') ~ v_uuid_regex
  )
  update public.public_shares ps
  set installment_group_id = gc.parsed_group_id
  from group_candidates gc
  where ps.id = gc.share_id
    and gc.rn = 1;

  -- Backfill de debt_id válido
  update public.public_shares ps
  set debt_id = (ps.payload->>'debt_id')::uuid
  where ps.kind = 'split'
    and ps.debt_id is null
    and coalesce(ps.payload->>'debt_id', '') ~ v_uuid_regex
    and exists (
      select 1
      from public.debts d
      where d.id = (ps.payload->>'debt_id')::uuid
        and d.user_id = ps.user_id
    );
end;
$$;

-- 3. Índices de busca e unicidade estrita 1:1 para rachas vinculados
create unique index if not exists uq_public_shares_split_expense_id
  on public.public_shares (user_id, expense_id)
  where kind = 'split' and expense_id is not null;

create unique index if not exists uq_public_shares_split_group_id
  on public.public_shares (user_id, installment_group_id)
  where kind = 'split' and installment_group_id is not null;

create index if not exists idx_public_shares_expense_id
  on public.public_shares (user_id, expense_id)
  where expense_id is not null;

create index if not exists idx_public_shares_debt_id
  on public.public_shares (user_id, debt_id)
  where debt_id is not null;

-- 4. Trigger aprimorado: sincroniza colunas relacionais e revogação sem atropelar pausa manual
create or replace function public.sync_split_public_share_revocation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_raw_exp text;
  v_raw_grp text;
  v_raw_debt text;
  v_is_completed boolean;
  v_is_paused boolean;
  v_was_completed boolean := false;
  v_was_paused boolean := false;
begin
  if new.kind = 'split' then
    -- Sincroniza vínculos a partir do payload apenas na criação ou quando o payload mudar
    if tg_op = 'INSERT' or (new.payload is distinct from old.payload) then
      if new.expense_id is null then
        v_raw_exp := coalesce(new.payload->>'expense_id', '');
        if v_raw_exp ~ v_uuid_regex and exists (
          select 1 from public.expenses e where e.id = v_raw_exp::uuid and e.user_id = new.user_id
        ) then
          new.expense_id := v_raw_exp::uuid;
        end if;
      end if;

      if new.installment_group_id is null then
        v_raw_grp := coalesce(new.payload->>'installment_group_id', '');
        if v_raw_grp ~ v_uuid_regex then
          new.installment_group_id := v_raw_grp::uuid;
        end if;
      end if;

      if new.debt_id is null then
        v_raw_debt := coalesce(new.payload->>'debt_id', '');
        if v_raw_debt ~ v_uuid_regex and exists (
          select 1 from public.debts d where d.id = v_raw_debt::uuid and d.user_id = new.user_id
        ) then
          new.debt_id := v_raw_debt::uuid;
        end if;
      end if;
    end if;

    v_is_completed := coalesce((new.payload->>'is_completed')::boolean, false);
    v_is_paused := coalesce((new.payload->>'public_page_paused')::boolean, false);

    if tg_op = 'UPDATE' then
      v_was_completed := coalesce((old.payload->>'is_completed')::boolean, false);
      v_was_paused := coalesce((old.payload->>'public_page_paused')::boolean, false);
    end if;

    if v_is_completed or v_is_paused then
      new.is_revoked := true;
    elsif tg_op = 'UPDATE' and (v_was_completed or v_was_paused) then
      -- Reativação automática quando o racha é reaberto ou despausado
      new.is_revoked := false;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_split_public_share_revocation on public.public_shares;
create trigger trg_sync_split_public_share_revocation
  before insert or update on public.public_shares
  for each row
  execute function public.sync_split_public_share_revocation();

-- 5. RPC pública get_public_share_by_token atualizada
create or replace function public.get_public_share_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_token text;
  v_share record;
begin
  v_clean_token := trim(coalesce(p_token, ''));
  v_clean_token := regexp_replace(v_clean_token, '[?#].*$', '');
  v_clean_token := regexp_replace(v_clean_token, '^/+|/+$', '', 'g');
  v_clean_token := regexp_replace(v_clean_token, '[\.,;:!\s/]+$', '');
  v_clean_token := regexp_replace(v_clean_token, '[^a-zA-Z0-9_-]', '', 'g');

  if v_clean_token = ''
     or length(v_clean_token) not between 6 and 64
     or not (v_clean_token ~ '^[a-zA-Z0-9_-]+$') then
    return null;
  end if;

  select
    id,
    user_id,
    kind,
    token,
    payload,
    created_at,
    expires_at,
    is_revoked,
    updated_at,
    expense_id,
    installment_group_id,
    debt_id
  into v_share
  from public.public_shares
  where token = v_clean_token
    and is_revoked = false
    and (expires_at is null or expires_at > now())
    and not (
      kind = 'split'
      and (
        coalesce((payload->>'is_completed')::boolean, false) = true
        or coalesce((payload->>'public_page_paused')::boolean, false) = true
      )
    )
  limit 1;

  if not found or v_share is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_share.id,
    'user_id', v_share.user_id,
    'kind', v_share.kind,
    'token', v_share.token,
    'payload', v_share.payload,
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at,
    'is_revoked', v_share.is_revoked,
    'updated_at', v_share.updated_at,
    'expense_id', v_share.expense_id,
    'installment_group_id', v_share.installment_group_id,
    'debt_id', v_share.debt_id
  );
end;
$$;

grant execute on function public.get_public_share_by_token(text) to anon, authenticated, service_role;

-- 6. Hardening de signal_split_payment: impede sinalização do anfitrião ou cota já quitada e suporta múltiplas parcelas
drop function if exists public.signal_split_payment(text, text, integer, text, text);

create or replace function public.signal_split_payment(
  p_token text,
  p_participant_name text,
  p_amount_cents integer,
  p_participant_id text default null,
  p_installment_id text default null,
  p_installment_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_payload jsonb;
  v_signals jsonb;
  v_participants jsonb;
  v_updated_participants jsonb := '[]'::jsonb;
  v_installments jsonb;
  v_updated_installments jsonb := '[]'::jsonb;
  v_new_signal jsonb;
  v_elem jsonb;
  v_inst jsonb;
  v_participant_matched boolean := false;
  v_installment_matched boolean := false;
  v_signal_id text;
  v_clean_token text;
  v_clean_participant_name text;
  v_clean_participant_id text;
  v_clean_installment_id text;
  v_target_inst_ids text[] := '{}';
  v_raw_inst_id text;
  v_is_recent boolean;
  v_matched_is_host boolean := false;
  v_matched_is_settled boolean := false;
  v_has_pending_target_inst boolean := false;
  v_overlap boolean := false;
begin
  -- 1. Sanitização e validações estritas de entrada
  v_clean_token := trim(p_token);
  v_clean_participant_name := trim(p_participant_name);
  v_clean_participant_id := nullif(trim(p_participant_id), '');
  v_clean_installment_id := nullif(trim(p_installment_id), '');

  if v_clean_installment_id is not null then
    v_target_inst_ids := array_append(v_target_inst_ids, v_clean_installment_id);
  end if;

  if p_installment_ids is not null then
    foreach v_raw_inst_id in array p_installment_ids
    loop
      v_raw_inst_id := nullif(trim(v_raw_inst_id), '');
      if v_raw_inst_id is not null and not (v_raw_inst_id = any(v_target_inst_ids)) then
        v_target_inst_ids := array_append(v_target_inst_ids, v_raw_inst_id);
      end if;
    end loop;
  end if;

  if v_clean_token is null
     or length(v_clean_token) not between 6 and 64
     or not (v_clean_token ~ '^[a-zA-Z0-9_-]+$') then
    raise exception 'Token de compartilhamento inválido.' using errcode = '22023';
  end if;

  if v_clean_participant_name is null
     or not (length(v_clean_participant_name) between 1 and 80) then
    raise exception 'Nome do participante inválido. Deve conter entre 1 e 80 caracteres.' using errcode = '22023';
  end if;

  if p_amount_cents is null
     or not (p_amount_cents > 0 and p_amount_cents <= 1000000000) then
    raise exception 'Valor de pagamento inválido. Deve ser maior que zero e até R$ 10.000.000,00.' using errcode = '22023';
  end if;

  -- 2. Localizar compartilhamento público ativo
  select *
  into v_share
  from public.public_shares
  where token = v_clean_token
    and kind = 'split';

  if not found then
    raise exception 'Compartilhamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_share.is_revoked is true or not (v_share.is_revoked = false) then
    raise exception 'Este link de compartilhamento foi revogado.' using errcode = 'P0003';
  end if;

  if v_share.expires_at is not null and v_share.expires_at < now() then
    raise exception 'Este link de compartilhamento expirou.' using errcode = 'P0004';
  end if;

  v_payload := coalesce(v_share.payload, '{}'::jsonb);

  if coalesce((v_payload->>'is_completed')::boolean, false) = true
     or coalesce((v_payload->>'public_page_paused')::boolean, false) = true then
    raise exception 'Este link de compartilhamento foi encerrado ou pausado pelo anfitrião.' using errcode = 'P0003';
  end if;

  v_signals := case
    when jsonb_typeof(v_payload->'payment_signals') = 'array' then v_payload->'payment_signals'
    else '[]'::jsonb
  end;
  v_participants := case
    when jsonb_typeof(v_payload->'participants') = 'array' then v_payload->'participants'
    else '[]'::jsonb
  end;
  v_installments := case
    when jsonb_typeof(v_payload->'participant_installments') = 'array' then v_payload->'participant_installments'
    else '[]'::jsonb
  end;

  -- 2.1 Bloquear sinalização do anfitrião ou participante já quitado
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_clean_participant_id is not null and (v_elem->>'id') = v_clean_participant_id)
         or (v_clean_participant_id is null and lower(trim(coalesce(v_elem->>'name', ''))) = lower(v_clean_participant_name)) then
        v_matched_is_host := coalesce((v_elem->>'is_host')::boolean, false);
        v_matched_is_settled := coalesce((v_elem->>'is_settled')::boolean, false);
        exit;
      end if;
    end loop;
  end if;

  if v_matched_is_host then
    raise exception 'O anfitrião não pode sinalizar pagamento para si mesmo.' using errcode = '22023';
  end if;

  if v_matched_is_settled and coalesce(array_length(v_target_inst_ids, 1), 0) = 0 then
    raise exception 'Esta cota já foi confirmada pelo anfitrião.' using errcode = '22023';
  end if;

  if coalesce(array_length(v_target_inst_ids, 1), 0) > 0 and jsonb_array_length(v_installments) > 0 then
    for v_inst in select * from jsonb_array_elements(v_installments)
    loop
      if (v_inst->>'id') = any(v_target_inst_ids) and coalesce((v_inst->>'is_settled')::boolean, false) = false then
        v_has_pending_target_inst := true;
        exit;
      end if;
    end loop;
    if not v_has_pending_target_inst then
      raise exception 'As parcelas selecionadas já foram confirmadas.' using errcode = '22023';
    end if;
  end if;

  -- 3. Deduplicação inteligente nos últimos 10 minutos
  if jsonb_array_length(v_signals) > 0 then
    for v_elem in select * from jsonb_array_elements(v_signals)
    loop
      if coalesce(v_elem->>'status', 'pending') = 'pending' then
        v_is_recent := false;
        if (v_elem->>'created_at') is not null then
          begin
            if ((v_elem->>'created_at')::timestamptz) >= (now() - interval '10 minutes') then
              v_is_recent := true;
            end if;
          exception when others then
            v_is_recent := false;
          end;
        end if;

        if v_is_recent then
          if coalesce(array_length(v_target_inst_ids, 1), 0) > 0 then
            v_overlap := (v_elem->>'installment_id') = any(v_target_inst_ids)
              or (
                jsonb_typeof(v_elem->'installment_ids') = 'array'
                and exists (
                  select 1
                  from jsonb_array_elements_text(v_elem->'installment_ids') as x(id)
                  where x.id = any(v_target_inst_ids)
                )
              );
            if v_overlap then
              return jsonb_build_object(
                'success', true,
                'deduplicated', true,
                'signal_id', v_elem->>'id',
                'participant_matched', true
              );
            end if;
          elsif (
            (v_clean_participant_id is not null and (v_elem->>'participant_id') = v_clean_participant_id)
            or (lower(trim(coalesce(v_elem->>'participant_name', ''))) = lower(v_clean_participant_name))
          ) then
            return jsonb_build_object(
              'success', true,
              'deduplicated', true,
              'signal_id', v_elem->>'id',
              'participant_matched', true
            );
          end if;
        end if;
      end if;
    end loop;
  end if;

  -- 4. Trava contra DoS: teto de no máximo 50 sinais
  if jsonb_array_length(v_signals) >= 50 then
    raise exception 'Limite de sinalizações atingido para este link' using errcode = '54000';
  end if;

  -- 5. Montar novo objeto de sinalização
  v_signal_id := gen_random_uuid()::text;
  v_new_signal := jsonb_build_object(
    'id', v_signal_id,
    'participant_id', v_clean_participant_id,
    'installment_id', v_clean_installment_id,
    'installment_ids', case when coalesce(array_length(v_target_inst_ids, 1), 0) > 0 then to_jsonb(v_target_inst_ids) else null end,
    'participant_name', v_clean_participant_name,
    'amount_cents', p_amount_cents,
    'status', 'pending',
    'created_at', now()
  );

  -- 6. Atualizar has_payment_signal no participante correspondente (apenas convidados)
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if coalesce((v_elem->>'is_host')::boolean, false) = false
         and (
           (v_clean_participant_id is not null and (v_elem->>'id') = v_clean_participant_id)
           or (v_clean_participant_id is null and lower(trim(coalesce(v_elem->>'name', ''))) = lower(v_clean_participant_name))
         ) then
        v_elem := v_elem || jsonb_build_object(
          'has_payment_signal', true,
          'payment_signaled_at', now()
        );
        v_participant_matched := true;
      end if;
      v_updated_participants := v_updated_participants || jsonb_build_array(v_elem);
    end loop;
  else
    v_updated_participants := v_participants;
  end if;

  -- 7. Atualizar signal_status nas parcelas correspondentes
  if jsonb_array_length(v_installments) > 0 then
    for v_inst in select * from jsonb_array_elements(v_installments)
    loop
      if (coalesce(array_length(v_target_inst_ids, 1), 0) > 0 and (v_inst->>'id') = any(v_target_inst_ids))
         or (
           coalesce(array_length(v_target_inst_ids, 1), 0) = 0
           and v_clean_participant_id is not null
           and (v_inst->>'participant_id') = v_clean_participant_id
           and coalesce((v_inst->>'is_settled')::boolean, false) = false
           and not v_installment_matched
         ) then
        v_inst := v_inst || jsonb_build_object(
          'signal_status', 'pending_confirmation',
          'signaled_at', now(),
          'signal_at', now()
        );
        v_installment_matched := true;
      end if;
      v_updated_installments := v_updated_installments || jsonb_build_array(v_inst);
    end loop;
  else
    v_updated_installments := v_installments;
  end if;

  -- 8. Persistir payload atualizado
  v_signals := v_signals || jsonb_build_array(v_new_signal);

  v_payload := v_payload || jsonb_build_object(
    'payment_signals', v_signals,
    'participants', v_updated_participants,
    'participant_installments', v_updated_installments
  );

  update public.public_shares
  set payload = v_payload,
      updated_at = now()
  where id = v_share.id;

  return jsonb_build_object(
    'success', true,
    'signal_id', v_signal_id,
    'participant_matched', v_participant_matched,
    'installment_matched', v_installment_matched
  );
end;
$$;

grant execute on function public.signal_split_payment(text, text, integer, text, text, text[]) to anon, authenticated, service_role;

-- 7. Atualizar dismiss_split_payment_signal para desarmar múltiplas parcelas (installment_ids)
create or replace function public.dismiss_split_payment_signal(
  p_share_id uuid,
  p_signal_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_payload jsonb;
  v_signals jsonb;
  v_updated_signals jsonb := '[]'::jsonb;
  v_participants jsonb;
  v_updated_participants jsonb := '[]'::jsonb;
  v_installments jsonb;
  v_updated_installments jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_inst jsonb;
  v_target_participant_id text := null;
  v_target_participant_name text := null;
  v_target_installment_id text := null;
  v_target_installment_ids text[] := '{}';
  v_has_other_pending_signal boolean := false;
begin
  select *
  into v_share
  from public.public_shares
  where id = p_share_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Compartilhamento não encontrado ou acesso não autorizado.' using errcode = 'P0002';
  end if;

  v_payload := coalesce(v_share.payload, '{}'::jsonb);
  v_signals := case
    when jsonb_typeof(v_payload->'payment_signals') = 'array' then v_payload->'payment_signals'
    else '[]'::jsonb
  end;
  v_participants := case
    when jsonb_typeof(v_payload->'participants') = 'array' then v_payload->'participants'
    else '[]'::jsonb
  end;
  v_installments := case
    when jsonb_typeof(v_payload->'participant_installments') = 'array' then v_payload->'participant_installments'
    else '[]'::jsonb
  end;

  for v_elem in select * from jsonb_array_elements(v_signals)
  loop
    if (v_elem->>'id') = p_signal_id then
      v_target_participant_id := v_elem->>'participant_id';
      v_target_participant_name := v_elem->>'participant_name';
      v_target_installment_id := v_elem->>'installment_id';
      if v_target_installment_id is not null then
        v_target_installment_ids := array_append(v_target_installment_ids, v_target_installment_id);
      end if;
      if jsonb_typeof(v_elem->'installment_ids') = 'array' then
        select array_cat(
          v_target_installment_ids,
          coalesce(array_agg(x.id), '{}')
        )
        into v_target_installment_ids
        from jsonb_array_elements_text(v_elem->'installment_ids') as x(id);
      end if;
      v_elem := v_elem || jsonb_build_object(
        'status', 'dismissed',
        'dismissed_at', now()
      );
    end if;
    v_updated_signals := v_updated_signals || jsonb_build_array(v_elem);
  end loop;

  -- Verifica se o participante ainda possui outro sinal pendente antes de limpar has_payment_signal
  for v_elem in select * from jsonb_array_elements(v_updated_signals)
  loop
    if coalesce(v_elem->>'status', 'pending') = 'pending' and (
      (v_target_participant_id is not null and (v_elem->>'participant_id') = v_target_participant_id)
      or (v_target_participant_name is not null and lower(trim(coalesce(v_elem->>'participant_name', ''))) = lower(trim(v_target_participant_name)))
    ) then
      v_has_other_pending_signal := true;
      exit;
    end if;
  end loop;

  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_target_participant_id is not null and (v_elem->>'id') = v_target_participant_id)
         or (v_target_participant_id is null and v_target_participant_name is not null and lower(trim(v_elem->>'name')) = lower(trim(v_target_participant_name))) then
        if not v_has_other_pending_signal then
          v_elem := v_elem || jsonb_build_object('has_payment_signal', false);
        end if;
      end if;
      v_updated_participants := v_updated_participants || jsonb_build_array(v_elem);
    end loop;
  else
    v_updated_participants := v_participants;
  end if;

  if jsonb_array_length(v_installments) > 0 then
    for v_inst in select * from jsonb_array_elements(v_installments)
    loop
      if (coalesce(array_length(v_target_installment_ids, 1), 0) > 0 and (v_inst->>'id') = any(v_target_installment_ids))
         or (
           coalesce(array_length(v_target_installment_ids, 1), 0) = 0
           and v_target_participant_id is not null
           and (v_inst->>'participant_id') = v_target_participant_id
           and (v_inst->>'signal_status') = 'pending_confirmation'
         ) then
        v_inst := v_inst || jsonb_build_object('signal_status', 'none');
      end if;
      v_updated_installments := v_updated_installments || jsonb_build_array(v_inst);
    end loop;
  else
    v_updated_installments := v_installments;
  end if;

  v_payload := v_payload || jsonb_build_object(
    'payment_signals', v_updated_signals,
    'participants', v_updated_participants,
    'participant_installments', v_updated_installments
  );

  update public.public_shares
  set payload = v_payload,
      updated_at = now()
  where id = v_share.id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.dismiss_split_payment_signal(uuid, text) to authenticated, service_role;
