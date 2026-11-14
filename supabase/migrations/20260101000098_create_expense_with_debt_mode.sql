-- ===========================================================================
-- Migration 20260101000098: Suporte ao modo de rateio parcelado em create_expense_with_debt
-- Permite escolher entre cobrança única ('single_total') ou por parcela ('per_installment')
-- ===========================================================================

-- Remove a versão anterior para evitar conflito de assinatura de função
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
);

create or replace function public.create_expense_with_debt(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_payment_method text,
  p_card_id uuid,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb,
  p_debt_name text,
  p_debt_amount numeric,
  p_debt_due_date date,
  p_debt_type text default 'payable',
  p_is_family boolean default false,
  p_debt_installment_mode text default 'per_installment'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_group uuid := gen_random_uuid();
  v_expense_id uuid;
  v_count integer;
  v_sum numeric;
  v_parcela jsonb;
  v_i integer := 0;
  v_debt_type text := coalesce(p_debt_type, 'payable');
  v_family_id uuid := null;
  v_mode text := coalesce(p_debt_installment_mode, 'per_installment');
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_debt_amount is not null and not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  if p_payment_method = 'credit_card' then
    if p_card_id is null then
      raise exception 'Cartão obrigatório para pagamento no crédito';
    end if;
    if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  -- Validação de categoria: pertence ao próprio usuário OU é categoria compartilhada da sua família
  select type into v_cat_type
    from public.categories
   where id = p_category_id
     and (
       user_id = v_user_id
       or (
         is_family = true
         and family_id is not null
         and public.is_family_member(family_id, v_user_id)
       )
     );
  if v_cat_type is null or v_cat_type <> 'expense' then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;

  if v_debt_type not in ('payable', 'receivable') then
    raise exception 'Tipo de dívida inválido';
  end if;

  if jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count > 60 then
    raise exception 'Máximo de 60 parcelas';
  end if;

  select coalesce(sum((parcela ->> 'value')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_installments) parcela;
  if v_sum <> p_value then
    raise exception 'Soma das parcelas (%s) difere do valor original (%s)', v_sum, p_value;
  end if;

  if coalesce(p_is_family, false) = true then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method, card_id,
      installments_total, installment_number, installment_group_id,
      bill_competence, report_weight, base_amount, description,
      is_family, family_id
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_payment_method,
      case when p_payment_method = 'credit_card' then p_card_id else null end,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end,
      nullif(v_parcela ->> 'bill_competence', ''),
      p_report_weight,
      (v_parcela ->> 'value')::numeric,
      p_description,
      coalesce(p_is_family, false),
      v_family_id
    )
    returning id into v_expense_id;

    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;

      -- Se for 'single_total', insere a dívida apenas uma vez (na primeira parcela v_i = 1)
      -- Se for 'per_installment', insere para cada parcela
      if v_mode <> 'single_total' or v_i = 1 then
        insert into public.debts (user_id, name, type, amount, due_date, expense_id, installment_group_id)
        values (
          v_user_id,
          case 
            when v_count > 1 and v_mode = 'per_installment'
              then coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, '')) || ' (' || v_i || '/' || v_count || ')'
            else coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, ''))
          end,
          v_debt_type,
          p_debt_amount,
          case
            when v_mode = 'single_total' then coalesce(p_debt_due_date, (v_parcela ->> 'date')::date)
            else coalesce((v_parcela ->> 'date')::date, p_debt_due_date)
          end,
          v_expense_id,
          case when v_count > 1 then v_group else null end
        );
      end if;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'expense', v_expense_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value')
    );
  end loop;

  return v_expense_id;
end;
$$;

revoke all on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
) from public;

grant execute on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
) to authenticated;

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
set search_path = public, pg_temp, extensions
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
