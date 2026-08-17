-- ----------------------------------------------------------------
-- Migration 20260101000012: Suporte a dívidas 'receivable' vinculadas a despesas (create_expense_with_debt)
-- ----------------------------------------------------------------

-- Remove a versão anterior para evitar conflito de sobrecarga com default args
drop function if exists public.create_expense_with_debt(
  numeric,
  date,
  uuid,
  text,
  uuid,
  text,
  numeric,
  jsonb,
  text,
  numeric,
  date
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
  p_debt_type text default 'payable'
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

  -- Invariantes (servidor nunca confia no cliente — AGENTS §5)
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;
  if p_payment_method = 'credit_card' and p_card_id is null then
    raise exception 'Cartão obrigatório para pagamento no crédito';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> 'expense' then
    raise exception 'Categoria de despesa inválida';
  end if;

  -- Validação do tipo de dívida
  if v_debt_type not in ('payable', 'receivable') then
    raise exception 'Tipo de dívida inválido';
  end if;

  -- Parcelas: array 1..60, soma = valor original, datas válidas
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
      bill_competence, report_weight, base_amount, description
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_payment_method,
      p_card_id,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end,
      nullif(v_parcela ->> 'bill_competence', ''),
      p_report_weight,
      (v_parcela ->> 'value')::numeric,
      p_description
    )
    returning id into v_expense_id;

    -- Cobrança vinculada (uma por parcela — ESPECIFICAÇÃO §3.2.4)
    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;
      insert into public.debts (user_id, name, type, amount, due_date, expense_id, installment_group_id)
      values (
        v_user_id,
        coalesce(nullif(p_debt_name, ''), 'Cobrança integrada à despesa: ' || coalesce(p_description, '')),
        v_debt_type,
        p_debt_amount,
        coalesce(p_debt_due_date, (v_parcela ->> 'date')::date),
        v_expense_id,
        case when v_count > 1 then v_group else null end
      );
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'expense',
    v_expense_id::text,
    'create',
    jsonb_build_object(
      'installments_count', v_count,
      'has_debt', p_debt_amount is not null,
      'debt_type', case when p_debt_amount is not null then v_debt_type else null end,
      'payment_method', p_payment_method
    )
  );

  return v_expense_id;
end;
$$;
