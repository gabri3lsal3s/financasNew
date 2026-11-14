-- ---------------------------------------------------------------------------
-- 20260101000069_update_get_shared_goal_tracker_rpc.sql
-- Módulo de Compartilhamento Público: Enriquecimento de Metas Coletivas
-- Suporte a status (ativo, concluído, arquivado), notas e contribuições
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_goal_tracker(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_title text;
  v_category_id uuid;
  v_target_cents bigint;
  v_incomes_cents bigint := 0;
  v_current_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_percentage int := 0;
  v_deadline date;
  v_days_remaining int := null;
  v_organizer_name text;
  v_organizer_city text;
  v_pix_key text;
  v_pix_key_type text;
  v_pix_br_code text;
  v_status text;
  v_notes text;
  v_contributions jsonb;
begin
  -- 1. Localizar o compartilhamento público ativo
  select *
  into v_share
  from public.public_shares
  where token = p_token
    and kind = 'goal_tracker'
    and is_revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_share is null then
    return null;
  end if;

  -- 2. Extrair metadados do payload
  v_title := coalesce(nullif(trim(v_share.payload->>'title'), ''), 'Meta Coletiva');
  
  if (v_share.payload ? 'category_id') and (v_share.payload->>'category_id' ~ '^[0-9a-fA-F-]{36}$') then
    v_category_id := (v_share.payload->>'category_id')::uuid;
  end if;

  v_target_cents := coalesce((v_share.payload->>'target_cents')::bigint, 0);

  if (v_share.payload ? 'deadline') and (v_share.payload->>'deadline' ~ '^\d{4}-\d{2}-\d{2}$') then
    v_deadline := (v_share.payload->>'deadline')::date;
    v_days_remaining := greatest(0, (v_deadline - current_date))::int;
  end if;

  v_organizer_name := coalesce(nullif(trim(v_share.payload->>'organizer_name'), ''), 'Organizador');
  v_organizer_city := coalesce(nullif(trim(v_share.payload->>'organizer_city'), ''), 'SAO PAULO');
  v_pix_key := coalesce(v_share.payload->>'pix_key', '');
  v_pix_key_type := coalesce(v_share.payload->>'pix_key_type', 'auto');
  v_pix_br_code := coalesce(v_share.payload->>'pix_br_code', '');
  v_status := coalesce(nullif(trim(v_share.payload->>'status'), ''), 'active');
  v_notes := nullif(trim(v_share.payload->>'notes'), '');
  v_contributions := coalesce(v_share.payload->'contributions', '[]'::jsonb);

  -- 3. Calcular arrecadação atual
  -- Se houver categoria vinculada, busca a soma real de depósitos/rendas registradas no app
  if v_category_id is not null then
    select coalesce(sum(round(i.value * 100)::bigint), 0)
    into v_incomes_cents
    from public.incomes i
    where i.user_id = v_share.user_id
      and i.category_id = v_category_id;
  end if;

  -- Valor atual combina receitas cadastradas com base declarada no payload
  v_current_cents := greatest(coalesce(v_incomes_cents, 0), coalesce((v_share.payload->>'current_cents')::bigint, 0));
  v_remaining_cents := greatest(0, v_target_cents - v_current_cents);

  if v_target_cents > 0 then
    v_percentage := round((v_current_cents::numeric / v_target_cents::numeric) * 100)::int;
  else
    v_percentage := 0;
  end if;

  -- 4. Montar e retornar o JSON consolidado
  return jsonb_build_object(
    'token', v_share.token,
    'title', v_title,
    'category_id', v_category_id,
    'target_cents', v_target_cents,
    'current_cents', v_current_cents,
    'remaining_cents', v_remaining_cents,
    'percentage', v_percentage,
    'deadline', case when v_deadline is not null then v_deadline::text else null end,
    'days_remaining', v_days_remaining,
    'organizer_name', v_organizer_name,
    'organizer_city', v_organizer_city,
    'pix_key', v_pix_key,
    'pix_key_type', v_pix_key_type,
    'pix_br_code', v_pix_br_code,
    'is_revoked', v_share.is_revoked,
    'expires_at', v_share.expires_at,
    'status', v_status,
    'notes', v_notes,
    'contributions', v_contributions
  );
end;
$$;

grant execute on function public.get_shared_goal_tracker(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 20260101000069_update_rpcs_with_is_family.sql
-- Módulo de Orçamento Familiar & Lançamento de Transações (Áxis Finance)
-- Atualiza as RPCs de criação de transações para suportar o parâmetro p_is_family
-- ---------------------------------------------------------------------------

-- 1. create_expense_with_debt
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text
);
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
  p_is_family boolean default false
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

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
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
      is_family
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
      coalesce(p_is_family, false)
    )
    returning id into v_expense_id;

    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;
      insert into public.debts (user_id, name, type, amount, due_date, expense_id, installment_group_id)
      values (
        v_user_id,
        coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, '')),
        v_debt_type,
        p_debt_amount,
        coalesce(p_debt_due_date, (v_parcela ->> 'date')::date),
        v_expense_id,
        case when v_count > 1 then v_group else null end
      );
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
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
) from public;
grant execute on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
) to authenticated;

-- 2. create_income_installments
drop function if exists public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb
);
drop function if exists public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean
);

create or replace function public.create_income_installments(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb,
  p_is_family boolean default false
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
  v_count integer;
  v_sum numeric;
  v_parcela jsonb;
  v_i integer := 0;
  v_income_id uuid;
  v_first_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Valor da renda deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> 'income' then
    raise exception 'Categoria de renda inválida';
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

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    insert into public.incomes (
      user_id, value, date, category_id, receive_type,
      description, report_weight, source_ref,
      is_family
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      case when v_count > 1 then v_group::text else null end,
      coalesce(p_is_family, false)
    )
    returning id into v_income_id;

    if v_first_id is null then
      v_first_id := v_income_id;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'income', v_income_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value')
    );
  end loop;

  return v_first_id;
end;
$$;

revoke all on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean
) from public;
grant execute on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean
) to authenticated;

-- 3. update_expense_installments_group (atualizar is_family se fornecido em p_fields)
create or replace function public.update_expense_installments_group(
  p_expense_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
  v_payment_method text;
  v_card_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;

  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'expense') then
      raise exception 'Categoria inválida ou não pertence ao usuário';
    end if;
  end if;

  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        v_card_id := v_expense.card_id;
      end if;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  elsif p_fields ? 'card_id' then
    v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
    if v_card_id is not null and not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_expense_id];
  elsif v_expense.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.expenses
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and (p_mode = 'all' or installment_number >= v_expense.installment_number);
  else
    v_ids := array[p_expense_id];
  end if;

  update public.expenses e
     set value = case when p_fields ? 'value' then v_value else e.value end,
         base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
         category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
         payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
         card_id = case
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
           else e.card_id
         end,
         bill_competence = case
           when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           else e.bill_competence
         end,
         is_family = case
           when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
           else e.is_family
         end
   where e.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_expense_installments_group from public;
grant execute on function public.update_expense_installments_group to authenticated;

-- 4. update_income_installments_group (atualizar is_family se fornecido em p_fields)
create or replace function public.update_income_installments_group(
  p_income_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_income public.incomes%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;

  if v_income.source_ref is not null then
    raise exception 'Rendas automáticas vinculadas a estornos são somente-leitura';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;

  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'income') then
      raise exception 'Categoria de renda inválida';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_income_id];
  elsif v_income.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.incomes
     where user_id = v_user_id
       and installment_group_id = v_income.installment_group_id
       and (p_mode = 'all' or installment_number >= v_income.installment_number);
  else
    v_ids := array[p_income_id];
  end if;

  update public.incomes i
     set value = case when p_fields ? 'value' then v_value else i.value end,
         category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
         receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end,
         is_family = case
           when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
           else i.is_family
         end
   where i.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income', p_income_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_income_installments_group from public;
grant execute on function public.update_income_installments_group to authenticated;

-- 5. update_recurrence_occurrences (atualizar is_family se fornecido em p_fields)
create or replace function public.update_recurrence_occurrences(
  p_occurrence_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recurrence_id uuid;
  v_occurrence_number integer;
  v_kind text;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
  v_payment_method text;
  v_card_id uuid;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;

  -- Localiza a ocorrência em despesas ou rendas
  select recurrence_id, occurrence_number, 'expense'
    into v_recurrence_id, v_occurrence_number, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;

  if v_recurrence_id is null then
    select recurrence_id, occurrence_number, 'income'
      into v_recurrence_id, v_occurrence_number, v_kind
      from public.incomes
     where id = p_occurrence_id and user_id = v_user_id;
  end if;
  if v_recurrence_id is null then
    raise exception 'Ocorrência não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = v_kind) then
      raise exception 'Categoria de % inválida ou não pertence ao usuário', v_kind;
    end if;
  end if;
  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method is not null and v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  elsif p_fields ? 'card_id' then
    v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
    if v_card_id is not null and not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
      raise exception 'Cartão inválido ou não pertence ao usuário';
    end if;
  end if;

  -- Ids afetados pelo modo
  if p_mode = 'single' then
    v_ids := array[p_occurrence_id];
  elsif v_kind = 'expense' then
    select array_agg(id) into v_ids
      from public.expenses
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  else
    select array_agg(id) into v_ids
      from public.incomes
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  end if;

  if v_ids is not null then
    if v_kind = 'expense' then
      update public.expenses e
         set value = case when p_fields ? 'value' then v_value else e.value end,
             base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
             category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
             payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
             card_id = case
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
               else e.card_id
             end,
             bill_competence = case
               when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               else e.bill_competence
             end,
             is_family = case
               when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
               else e.is_family
             end
       where e.id = any(v_ids);
      get diagnostics v_updated = row_count;
    else
      update public.incomes i
         set value = case when p_fields ? 'value' then v_value else i.value end,
             category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
             receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end,
             is_family = case
               when p_fields ? 'is_family' then coalesce((p_fields ->> 'is_family')::boolean, false)
               else i.is_family
             end
       where i.id = any(v_ids);
      get diagnostics v_updated = row_count;
    end if;
  else
    v_updated := 0;
  end if;

  if p_mode <> 'single' then
    update public.recurrences r
       set value = case when p_fields ? 'value' then v_value else r.value end,
           category_id = case when p_fields ? 'category_id' then v_category_id else r.category_id end,
           description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else r.description end,
           report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else r.report_weight end,
           payment_method = case when p_fields ? 'payment_method' then v_payment_method else r.payment_method end,
           card_id = case
             when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
             when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
             else r.card_id
           end,
           receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else r.receive_type end
     where r.id = v_recurrence_id and r.user_id = v_user_id;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', p_occurrence_id::text, 'update_occurrences',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_recurrence_occurrences from public;
grant execute on function public.update_recurrence_occurrences to authenticated;
