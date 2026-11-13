-- ============================================================================
-- Migration: 20260101000119_link_debt_settlement_transactions.sql
-- Descrição: Vinculação de expense_id e source_ref na quitação/recebimento de dívidas
--            para garantia de integridade contábil e eliminação de dupla dedução
--            no motor de regime de caixa (cash-ledger).
-- ============================================================================

-- 1. Atualizar RPC pay_debt para gravar expense_id em debts ao criar despesa
create or replace function public.pay_debt(
  p_debt_id uuid,
  p_create_expense boolean,
  p_expense_category_id uuid,
  p_fine_amount numeric default 0,
  p_interest_amount numeric default 0,
  p_discount_amount numeric default 0,
  p_total_paid numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_expense_id uuid := null;
  v_effective_total numeric(12, 2);
  v_fine numeric(12, 2) := coalesce(p_fine_amount, 0);
  v_interest numeric(12, 2) := coalesce(p_interest_amount, 0);
  v_discount numeric(12, 2) := coalesce(p_discount_amount, 0);
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  select * into v_debt
    from public.debts
   where id = p_debt_id and user_id = v_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if v_debt.type <> 'payable' then
    raise exception 'Dívida não é do tipo a pagar';
  end if;
  if v_debt.paid_at is not null then
    raise exception 'Dívida já quitada';
  end if;

  if p_total_paid is not null and p_total_paid > 0 then
    v_effective_total := p_total_paid;
  else
    v_effective_total := v_debt.amount + v_fine + v_interest - v_discount;
  end if;

  if v_effective_total < 0 then
    raise exception 'Valor total pago não pode ser negativo';
  end if;

  if p_create_expense and v_effective_total > 0 then
    if p_expense_category_id is null then
      raise exception 'Categoria obrigatória ao criar despesa';
    end if;
    if not exists (
      select 1 from public.categories
       where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria de despesa inválida';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method,
      installments_total, installment_number, report_weight, base_amount, description,
      charge_kind
    ) values (
      v_user_id, v_effective_total, coalesce(current_date, v_debt.due_date), p_expense_category_id, 'other',
      1, 1, 1, v_effective_total, v_debt.name,
      case when v_debt.charge_kind <> 'regular' then v_debt.charge_kind else 'regular' end
    )
    returning id into v_expense_id;
  end if;

  update public.debts
     set paid_at = now(),
         expense_id = v_expense_id
   where id = p_debt_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'pay',
    jsonb_build_object(
      'created_expense', coalesce(p_create_expense, false),
      'expense_id', v_expense_id,
      'original_amount', v_debt.amount,
      'fine_amount', v_fine,
      'interest_amount', v_interest,
      'discount_amount', v_discount,
      'total_paid', v_effective_total
    )
  );

  return p_debt_id;
end;
$$;

revoke all on function public.pay_debt from public;
grant execute on function public.pay_debt to authenticated;

-- 2. Atualizar RPC early_amortize_loan para gravar expense_id nas parcelas amortizadas
create or replace function public.early_amortize_loan(
  p_loan_id uuid,
  p_debt_ids uuid[],
  p_create_expense boolean,
  p_expense_category_id uuid,
  p_total_paid numeric,
  p_discount_total numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_expense_id uuid := null;
  v_updated_count integer := 0;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  select * into v_loan
    from public.loans
   where id = p_loan_id and user_id = v_user_id;
  if not found then
    raise exception 'Contrato de empréstimo não encontrado';
  end if;

  if array_length(p_debt_ids, 1) is null or array_length(p_debt_ids, 1) < 1 then
    raise exception 'Nenhuma parcela informada para amortização';
  end if;

  if p_create_expense and p_total_paid > 0 then
    if p_expense_category_id is null then
      raise exception 'Categoria obrigatória ao criar despesa de amortização';
    end if;

    if not exists (
      select 1 from public.categories
       where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
    end if;

    insert into public.expenses (
      user_id, value, date, category_id, payment_method,
      installments_total, installment_number, report_weight, base_amount,
      description, charge_kind
    ) values (
      v_user_id, p_total_paid, current_date, p_expense_category_id, 'other',
      1, 1, 1, p_total_paid,
      format('Amortização antecipada: %s (%s parcelas)', v_loan.name, array_length(p_debt_ids, 1)),
      'regular'
    )
    returning id into v_expense_id;
  end if;

  -- Marca parcelas como quitadas garantindo vínculo estrito com o contrato e vincula expense_id
  update public.debts
     set paid_at = now(),
         expense_id = v_expense_id
   where id = any(p_debt_ids)
     and user_id = v_user_id
     and installment_group_id = v_loan.installment_group_id
     and paid_at is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> array_length(p_debt_ids, 1) then
    raise exception 'Uma ou mais parcelas não pertencem a este contrato de empréstimo ou já foram quitadas.';
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'loan', p_loan_id::text, 'early_amortization',
    jsonb_build_object(
      'debt_ids', p_debt_ids,
      'total_paid', p_total_paid,
      'discount_total', p_discount_total,
      'expense_id', v_expense_id
    )
  );

  return true;
end;
$$;

revoke all on function public.early_amortize_loan from public;
grant execute on function public.early_amortize_loan to authenticated;

-- 3. Atualizar RPC receive_debt para marcar source_ref com [DEBT]{id}
create or replace function public.receive_debt(
  p_debt_id uuid,
  p_create_income boolean,
  p_income_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_income_id uuid := null;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  select * into v_debt
    from public.debts
   where id = p_debt_id and user_id = v_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if v_debt.type <> 'receivable' then
    raise exception 'Dívida não é do tipo a receber';
  end if;
  if v_debt.paid_at is not null then
    raise exception 'Dívida já recebida';
  end if;

  if p_create_income then
    if p_income_category_id is null then
      raise exception 'Categoria obrigatória ao criar renda';
    end if;
    if not exists (
      select 1 from public.categories
       where id = p_income_category_id and user_id = v_user_id and type = 'income'
    ) then
      raise exception 'Categoria de renda inválida';
    end if;

    insert into public.incomes (user_id, value, date, category_id, receive_type, description, source_ref)
    values (v_user_id, v_debt.amount, current_date, p_income_category_id, 'other', v_debt.name, '[DEBT]' || p_debt_id::text)
    returning id into v_income_id;
  end if;

  update public.debts
     set paid_at = now()
   where id = p_debt_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'receive',
    jsonb_build_object('created_income', coalesce(p_create_income, false), 'income_id', v_income_id)
  );

  return p_debt_id;
end;
$$;

revoke all on function public.receive_debt from public;
grant execute on function public.receive_debt to authenticated;

-- 4. Backfill de integridade para quitações passadas gravadas no audit_events
update public.debts d
   set expense_id = (a.payload->>'expense_id')::uuid
  from public.audit_events a
 where a.entity_type = 'debt'
   and a.action = 'pay'
   and a.entity_id = d.id::text
   and a.user_id = d.user_id
   and (a.payload->>'created_expense')::boolean = true
   and (a.payload->>'expense_id') is not null
   and d.expense_id is null;

update public.incomes i
   set source_ref = '[DEBT]' || a.entity_id
  from public.audit_events a
 where a.entity_type = 'debt'
   and a.action = 'receive'
   and (a.payload->>'income_id')::uuid = i.id
   and i.source_ref is null;
