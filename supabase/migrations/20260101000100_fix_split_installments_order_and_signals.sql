-- ===========================================================================
-- Migration 20260101000100: Correção da ordem de retorno de parcelas e sinalização de pagamento por parcela
-- 1. Garante que create_expense_with_debt retorne o ID da PRIMEIRA parcela (v_i = 1)
-- 2. Atualiza signal_split_payment para aceitar p_installment_id e registrar status na parcela
-- ===========================================================================

-- 1. Atualização de create_expense_with_debt
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
  v_first_expense_id uuid := null;
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

    if v_i = 1 then
      v_first_expense_id := v_expense_id;
    end if;

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

  return coalesce(v_first_expense_id, v_expense_id);
end;
$$;

revoke all on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
) from public;

grant execute on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
) to authenticated;

-- 2. Atualização de signal_split_payment com p_installment_id
drop function if exists public.signal_split_payment(text, text, integer, text);

create or replace function public.signal_split_payment(
  p_token text,
  p_participant_name text,
  p_amount_cents integer,
  p_participant_id text default null,
  p_installment_id text default null
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
  v_is_recent boolean;
begin
  -- 1. Sanitização e validações estritas de entrada
  v_clean_token := trim(p_token);
  v_clean_participant_name := trim(p_participant_name);
  v_clean_participant_id := nullif(trim(p_participant_id), '');
  v_clean_installment_id := nullif(trim(p_installment_id), '');

  -- Validação de Token: alfanumérico seguro (entre 6 e 64 caracteres)
  if v_clean_token is null
     or length(v_clean_token) not between 6 and 64
     or not (v_clean_token ~ '^[a-zA-Z0-9_-]+$') then
    raise exception 'Token de compartilhamento inválido.' using errcode = '22023';
  end if;

  -- Validação de Nome: obrigatório entre 1 e 80 caracteres
  if v_clean_participant_name is null
     or not (length(v_clean_participant_name) between 1 and 80) then
    raise exception 'Nome do participante inválido. Deve conter entre 1 e 80 caracteres.' using errcode = '22023';
  end if;

  -- Validação de Valor: estritamente maior que 0 e até R$ 10.000.000,00
  if p_amount_cents is null
     or not (p_amount_cents > 0 and p_amount_cents <= 1000000000) then
    raise exception 'Valor de pagamento inválido. Deve ser maior que zero e até R$ 10.000.000,00.' using errcode = '22023';
  end if;

  -- 2. Localizar o compartilhamento público ativo
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
  v_signals := coalesce(v_payload->'payment_signals', '[]'::jsonb);
  v_participants := coalesce(v_payload->'participants', '[]'::jsonb);
  v_installments := coalesce(v_payload->'participant_installments', '[]'::jsonb);

  -- 3. Deduplicação Inteligente (Idempotência Segura nos últimos 10 minutos)
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
          if v_clean_installment_id is not null and (v_elem->>'installment_id') = v_clean_installment_id then
            return jsonb_build_object(
              'success', true,
              'deduplicated', true,
              'signal_id', v_elem->>'id',
              'participant_matched', true
            );
          elsif v_clean_installment_id is null and (
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

  -- 5. Montar o novo objeto de sinalização
  v_signal_id := gen_random_uuid()::text;
  v_new_signal := jsonb_build_object(
    'id', v_signal_id,
    'participant_id', v_clean_participant_id,
    'installment_id', v_clean_installment_id,
    'participant_name', v_clean_participant_name,
    'amount_cents', p_amount_cents,
    'status', 'pending',
    'created_at', now()
  );

  -- 6. Atualizar has_payment_signal no participante correspondente
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_clean_participant_id is not null and (v_elem->>'id') = v_clean_participant_id)
         or (v_clean_participant_id is null and lower(trim(coalesce(v_elem->>'name', ''))) = lower(v_clean_participant_name)) then
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

  -- 7. Atualizar signal_status na parcela correspondente (se existir)
  if jsonb_array_length(v_installments) > 0 then
    for v_inst in select * from jsonb_array_elements(v_installments)
    loop
      if (v_clean_installment_id is not null and (v_inst->>'id') = v_clean_installment_id)
         or (
           v_clean_installment_id is null
           and v_clean_participant_id is not null
           and (v_inst->>'participant_id') = v_clean_participant_id
           and coalesce((v_inst->>'is_settled')::boolean, false) = false
           and not v_installment_matched
         ) then
        v_inst := v_inst || jsonb_build_object(
          'signal_status', 'pending_confirmation',
          'signal_at', now()
        );
        v_installment_matched := true;
      end if;
      v_updated_installments := v_updated_installments || jsonb_build_array(v_inst);
    end loop;
  else
    v_updated_installments := v_installments;
  end if;

  -- 8. Persistir novo payload com sinais, participantes e parcelas sincronizadas
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

grant execute on function public.signal_split_payment(text, text, integer, text, text) to anon, authenticated, service_role;

-- 3. Atualização de dismiss_split_payment_signal para desarmar signal_status nas parcelas
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
  v_signals := coalesce(v_payload->'payment_signals', '[]'::jsonb);
  v_participants := coalesce(v_payload->'participants', '[]'::jsonb);
  v_installments := coalesce(v_payload->'participant_installments', '[]'::jsonb);

  for v_elem in select * from jsonb_array_elements(v_signals)
  loop
    if (v_elem->>'id') = p_signal_id then
      v_target_participant_id := v_elem->>'participant_id';
      v_target_participant_name := v_elem->>'participant_name';
      v_target_installment_id := v_elem->>'installment_id';
      v_elem := v_elem || jsonb_build_object(
        'status', 'dismissed',
        'dismissed_at', now()
      );
    end if;
    v_updated_signals := v_updated_signals || jsonb_build_array(v_elem);
  end loop;

  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_target_participant_id is not null and (v_elem->>'id') = v_target_participant_id)
         or (v_target_participant_id is null and v_target_participant_name is not null and lower(trim(v_elem->>'name')) = lower(trim(v_target_participant_name))) then
        v_elem := v_elem || jsonb_build_object(
          'has_payment_signal', false
        );
      end if;
      v_updated_participants := v_updated_participants || jsonb_build_array(v_elem);
    end loop;
  else
    v_updated_participants := v_participants;
  end if;

  if jsonb_array_length(v_installments) > 0 then
    for v_inst in select * from jsonb_array_elements(v_installments)
    loop
      if (v_target_installment_id is not null and (v_inst->>'id') = v_target_installment_id)
         or (
           v_target_installment_id is null
           and v_target_participant_id is not null
           and (v_inst->>'participant_id') = v_target_participant_id
           and (v_inst->>'signal_status') = 'pending_confirmation'
         ) then
        v_inst := v_inst || jsonb_build_object(
          'signal_status', 'none'
        );
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
