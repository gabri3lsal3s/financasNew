-- ================================================================
-- Migration: 20260101000049_rpc_write_permission_and_active_user_hardening.sql
-- Descrição: Hardening integral de segurança em 100% das RPCs de mutação de usuário (Fase 5.2).
--            Garante que todas as RPCs transacionais:
--            1. Fixem search_path = public, pg_temp;
--            2. Verifiquem explicitamente se a conta está ativa via public.is_current_user_active();
--            3. Verifiquem permissão de escrita modular via public.can_current_user_write_module(p_module_key).
-- ================================================================

-- ----------------------------------------------------------------
-- RPC: create_card_payment (Módulo: cards)
-- ----------------------------------------------------------------
create or replace function public.create_card_payment(
  p_card_id uuid,
  p_competence_month text,
  p_amount numeric,
  p_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment_id uuid;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if not exists (
    select 1 from public.credit_cards
     where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  insert into public.card_payments (
    user_id, card_id, competence_month, amount, date, note, is_refund
  ) values (
    v_user_id, p_card_id, p_competence_month, p_amount, p_date, p_note, false
  )
  returning id into v_payment_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', v_payment_id::text, 'create',
    jsonb_build_object('card_id', p_card_id, 'competence_month', p_competence_month, 'amount', p_amount)
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_card_payment from public;
grant execute on function public.create_card_payment to authenticated;

-- ----------------------------------------------------------------
-- RPC: update_credit_card (Módulo: cards)
-- ----------------------------------------------------------------
create or replace function public.update_credit_card(
  p_card_id uuid,
  p_name text,
  p_brand text,
  p_credit_limit numeric,
  p_closing_day integer,
  p_due_day integer,
  p_color text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.credit_cards%rowtype;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  select * into v_old
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;
  if not found then
    raise exception 'Cartão não encontrado';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Nome do cartão é obrigatório';
  end if;
  if p_closing_day is null or p_closing_day not between 1 and 31 then
    raise exception 'Dia de fechamento deve estar entre 1 e 31';
  end if;
  if p_due_day is null or p_due_day not between 1 and 31 then
    raise exception 'Dia de vencimento deve estar entre 1 e 31';
  end if;
  if p_credit_limit is not null and p_credit_limit < 0 then
    raise exception 'Limite não pode ser negativo';
  end if;

  update public.credit_cards
     set name = p_name,
         brand = p_brand,
         credit_limit = p_credit_limit,
         closing_day = p_closing_day,
         due_day = p_due_day,
         color = p_color,
         is_active = coalesce(p_is_active, true)
   where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'update',
    jsonb_build_object(
      'closing_day', jsonb_build_object('from', v_old.closing_day, 'to', p_closing_day),
      'due_day', jsonb_build_object('from', v_old.due_day, 'to', p_due_day),
      'is_active', p_is_active
    )
  );
end;
$$;

revoke all on function public.update_credit_card from public;
grant execute on function public.update_credit_card to authenticated;

-- ----------------------------------------------------------------
-- RPC: delete_credit_card (Módulo: cards)
-- ----------------------------------------------------------------
create or replace function public.delete_credit_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if not exists (
    select 1 from public.credit_cards
     where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Cartão não encontrado';
  end if;

  delete from public.credit_cards where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (v_user_id, 'credit_card', p_card_id::text, 'delete', '{}'::jsonb);
end;
$$;

revoke all on function public.delete_credit_card from public;
grant execute on function public.delete_credit_card to authenticated;

-- ----------------------------------------------------------------
-- RPC: delete_card_payment (Módulo: cards)
-- ----------------------------------------------------------------
create or replace function public.delete_card_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.card_payments%rowtype;
  v_income_deleted integer;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  select * into v_payment
    from public.card_payments
   where id = p_payment_id and user_id = v_user_id;
  if not found then
    raise exception 'Pagamento não encontrado';
  end if;

  -- Estorno → remove a renda automática correspondente ([REFUND]{id}).
  -- Pagamento normal não gera renda; a exclusão é inofensiva (0 linhas).
  delete from public.incomes
   where user_id = v_user_id
     and source_ref = '[REFUND]' || p_payment_id::text;
  get diagnostics v_income_deleted = row_count;

  delete from public.card_payments
   where id = p_payment_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', p_payment_id::text, 'delete',
    jsonb_build_object(
      'is_refund', v_payment.is_refund,
      'income_deleted', v_income_deleted
    )
  );
end;
$$;

revoke all on function public.delete_card_payment from public;
grant execute on function public.delete_card_payment to authenticated;

-- ----------------------------------------------------------------
-- RPC: recalculate_bill_competences (Módulo: cards)
-- ----------------------------------------------------------------
create or replace function public.recalculate_bill_competences(p_card_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;

  update public.expenses e
     set bill_competence = to_char(
       case
         when e.date >= public.resolve_competence_boundary(e.date, coalesce(ov.closing_day, c.closing_day))
         then e.date + interval '1 month'
         else e.date
       end,
       'YYYY-MM'
     )
    from public.credit_cards c
    left join public.card_competence_overrides ov
      on ov.card_id = c.id and ov.month = to_char(e.date, 'YYYY-MM')
   where e.user_id = v_user_id
     and e.card_id = p_card_id
     and c.id = e.card_id;

  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'recalculate_competences',
    jsonb_build_object('updated', v_updated)
  );

  return v_updated;
end;
$$;

revoke all on function public.recalculate_bill_competences from public;
grant execute on function public.recalculate_bill_competences to authenticated;

-- ----------------------------------------------------------------
-- RPC: pay_debt (Módulo: debts)
-- ----------------------------------------------------------------
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
  v_expense_id uuid;
  v_effective_total numeric(12, 2);
  v_fine numeric(12, 2) := coalesce(p_fine_amount, 0);
  v_interest numeric(12, 2) := coalesce(p_interest_amount, 0);
  v_discount numeric(12, 2) := coalesce(p_discount_amount, 0);
begin
  

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
     set paid_at = now()
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

-- ----------------------------------------------------------------
-- RPC: receive_debt (Módulo: debts)
-- ----------------------------------------------------------------
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
  v_income_id uuid;
begin
  

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

    insert into public.incomes (user_id, value, date, category_id, receive_type, description)
    values (v_user_id, v_debt.amount, current_date, p_income_category_id, 'other', v_debt.name)
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

-- ----------------------------------------------------------------
-- RPC: early_amortize_loan (Módulo: debts)
-- ----------------------------------------------------------------
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
  v_expense_id uuid;
  v_updated_count integer := 0;
begin
  

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

  -- Marca parcelas como quitadas garantindo vínculo estrito com o contrato
  update public.debts
     set paid_at = now()
   where id = any(p_debt_ids)
     and user_id = v_user_id
     and installment_group_id = v_loan.installment_group_id
     and paid_at is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> array_length(p_debt_ids, 1) then
    raise exception 'Uma ou mais parcelas não pertencem a este contrato de empréstimo ou já foram quitadas.';
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

-- ----------------------------------------------------------------
-- RPC: create_loan_contract (Módulo: debts)
-- ----------------------------------------------------------------
create or replace function public.create_loan_contract(
  p_name text,
  p_loan_type text,
  p_principal_amount numeric,
  p_interest_rate_monthly numeric,
  p_amortization_system text,
  p_total_installments integer,
  p_start_date date,
  p_installments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  if p_principal_amount <= 0 or p_total_installments < 1 then
    raise exception 'Valores inválidos para contrato de empréstimo';
  end if;

  insert into public.loans (
    user_id, name, loan_type, principal_amount, interest_rate_monthly,
    amortization_system, total_installments, start_date, installment_group_id
  ) values (
    v_user_id, p_name, p_loan_type, p_principal_amount, p_interest_rate_monthly,
    p_amortization_system, p_total_installments, p_start_date, v_group_id
  )
  returning id into v_loan_id;

  for v_item in select * from jsonb_array_elements(p_installments)
  loop
    insert into public.debts (
      user_id, name, type, amount, due_date,
      installment_group_id, charge_kind
    ) values (
      v_user_id,
      format('%s (%s/%s)', p_name, (v_item->>'installment_number')::text, p_total_installments::text),
      'payable',
      (v_item->>'amount')::numeric,
      (v_item->>'due_date')::date,
      v_group_id,
      'regular'
    );
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'loan', v_loan_id::text, 'create',
    jsonb_build_object(
      'name', p_name,
      'principal_amount', p_principal_amount,
      'total_installments', p_total_installments,
      'installment_group_id', v_group_id
    )
  );

  return v_loan_id;
end;
$$;

revoke all on function public.create_loan_contract from public;
grant execute on function public.create_loan_contract to authenticated;

-- ----------------------------------------------------------------
-- RPC: settle_integrated_receivable (Módulo: debts)
-- ----------------------------------------------------------------
create or replace function public.settle_integrated_receivable(
  p_debt_id uuid,
  p_result numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
begin
  

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
    raise exception 'Dívida já quitada';
  end if;
  if v_debt.expense_id is null then
    raise exception 'Dívida sem despesa vinculada';
  end if;

  if p_result < 0 then
    raise exception 'Resultado não pode ser negativo';
  end if;

  update public.expenses
     set report_weight = greatest(
           0,
           least(1, p_result / nullif(base_amount, 0))
         )
   where id = v_debt.expense_id and user_id = v_user_id;

  update public.debts set paid_at = now() where id = p_debt_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'settle_integrated_receivable',
    jsonb_build_object('result', p_result, 'expense_id', v_debt.expense_id)
  );
end;
$$;

revoke all on function public.settle_integrated_receivable from public;
grant execute on function public.settle_integrated_receivable to authenticated;

-- ----------------------------------------------------------------
-- RPC: delete_category_migrate (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.delete_category_migrate(
  p_category_id uuid,
  p_migrate_to uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat public.categories%rowtype;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  select * into v_cat
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if not found then
    raise exception 'Categoria não encontrada';
  end if;
  if v_cat.is_reserved then
    raise exception 'Categoria reservada não pode ser excluída';
  end if;

  if p_migrate_to is not null then
    if not exists (
      select 1 from public.categories
       where id = p_migrate_to and user_id = v_user_id and type = v_cat.type
    ) then
      raise exception 'Categoria de destino inválida (mesmo usuário e tipo)';
    end if;

    update public.expenses set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.incomes set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.budgets set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
    update public.income_goals set category_id = p_migrate_to where category_id = p_category_id and user_id = v_user_id;
  end if;

  delete from public.categories where id = p_category_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'category', p_category_id::text, 'delete',
    jsonb_build_object('migrate_to', p_migrate_to)
  );
end;
$$;

revoke all on function public.delete_category_migrate from public;
grant execute on function public.delete_category_migrate to authenticated;

-- ----------------------------------------------------------------
-- RPC: set_budget_limit (Módulo: budgets)
-- ----------------------------------------------------------------
create or replace function public.set_budget_limit(
  p_category_id uuid,
  p_month text,
  p_limit numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('budgets') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo budgets.';
  end if;

  if not exists (
    select 1 from public.categories
     where id = p_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'Limite deve ser maior que zero';
  end if;

  insert into public.budgets (user_id, category_id, month, "limit")
  values (v_user_id, p_category_id, p_month, p_limit)
  on conflict (category_id, month)
  do update set "limit" = excluded."limit";

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_category_id::text || ':' || p_month, 'upsert',
    jsonb_build_object('limit', p_limit)
  );
end;
$$;

revoke all on function public.set_budget_limit from public;
grant execute on function public.set_budget_limit to authenticated;

-- ----------------------------------------------------------------
-- RPC: set_batch_budget_limits (Módulo: budgets)
-- ----------------------------------------------------------------
create or replace function public.set_batch_budget_limits(
  p_month text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_category_id uuid;
  v_limit numeric;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('budgets') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo budgets.';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido (esperado YYYY-MM)';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Lista de limites inválida';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := (v_item->>'categoryId')::uuid;
    v_limit := (v_item->>'limit')::numeric;

    if not exists (
      select 1 from public.categories
       where id = v_category_id and user_id = v_user_id and type = 'expense'
    ) then
      raise exception 'Categoria % inválida ou não pertence ao usuário', v_category_id;
    end if;

    if v_limit is null or v_limit < 0 then
      raise exception 'Limite não pode ser negativo';
    end if;

    if v_limit = 0 then
      delete from public.budgets
       where user_id = v_user_id
         and category_id = v_category_id
         and month = p_month;
    else
      insert into public.budgets (user_id, category_id, month, "limit")
      values (v_user_id, v_category_id, p_month, v_limit)
      on conflict (category_id, month)
      do update set "limit" = excluded."limit";
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'batch_upsert',
    jsonb_build_object('month', p_month, 'count', jsonb_array_length(p_items))
  );
end;
$$;

revoke all on function public.set_batch_budget_limits from public;
grant execute on function public.set_batch_budget_limits to authenticated;

-- ----------------------------------------------------------------
-- RPC: set_income_goal (Módulo: budgets)
-- ----------------------------------------------------------------
create or replace function public.set_income_goal(
  p_category_id uuid,
  p_month text,
  p_expected numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('budgets') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo budgets.';
  end if;

  if not exists (
    select 1 from public.categories
     where id = p_category_id and user_id = v_user_id and type = 'income'
  ) then
    raise exception 'Categoria de renda inválida ou não pertence ao usuário';
  end if;
  if p_expected is null or p_expected <= 0 then
    raise exception 'Meta deve ser maior que zero';
  end if;

  insert into public.income_goals (user_id, category_id, month, expected)
  values (v_user_id, p_category_id, p_month, p_expected)
  on conflict (category_id, month)
  do update set expected = excluded.expected;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income_goal', p_category_id::text || ':' || p_month, 'upsert',
    jsonb_build_object('expected', p_expected)
  );
end;
$$;

revoke all on function public.set_income_goal from public;
grant execute on function public.set_income_goal to authenticated;

-- ----------------------------------------------------------------
-- RPC: reallocate_budget (Módulo: budgets)
-- ----------------------------------------------------------------
create or replace function public.reallocate_budget(
  p_from_category_id uuid,
  p_to_category_id uuid,
  p_month text,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_from_limit numeric := 0;
  v_to_limit numeric := 0;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('budgets') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo budgets.';
  end if;
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido (esperado YYYY-MM)';
  end if;
  if p_amount is null or p_amount < 10 then
    raise exception 'Valor de realocação deve ser de pelo menos R$ 10';
  end if;
  if p_from_category_id = p_to_category_id then
    raise exception 'As categorias de origem e destino devem ser diferentes';
  end if;

  -- Categorias de despesa do dono (origem e destino)
  if not exists (
    select 1 from public.categories
     where id = p_from_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de origem inválida';
  end if;
  if not exists (
    select 1 from public.categories
     where id = p_to_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de destino inválida';
  end if;

  -- Limite efetivo de origem (busca no mês ou no histórico mais recente anterior)
  select coalesce(b."limit", 0) into v_from_limit
    from public.budgets b
   where b.user_id = v_user_id
     and b.category_id = p_from_category_id
     and b.month <= p_month
   order by b.month desc
   limit 1;

  v_from_limit := coalesce(v_from_limit, 0);

  if v_from_limit - p_amount < 0 then
    raise exception 'Origem não possui limite suficiente para transferir';
  end if;

  -- Limite efetivo de destino (busca no mês ou no histórico mais recente anterior)
  select coalesce(b."limit", 0) into v_to_limit
    from public.budgets b
   where b.user_id = v_user_id
     and b.category_id = p_to_category_id
     and b.month <= p_month
   order by b.month desc
   limit 1;

  v_to_limit := coalesce(v_to_limit, 0);

  -- Reduz origem: se zerou, remove do mês se existia; senão faz upsert
  if (v_from_limit - p_amount) > 0 then
    insert into public.budgets (user_id, category_id, month, "limit")
    values (v_user_id, p_from_category_id, p_month, v_from_limit - p_amount)
    on conflict (category_id, month)
    do update set "limit" = excluded."limit";
  else
    delete from public.budgets
     where category_id = p_from_category_id and month = p_month;
  end if;

  -- Aumenta destino (sempre > 0, pois v_to_limit >= 0 e p_amount >= 10)
  insert into public.budgets (user_id, category_id, month, "limit")
  values (v_user_id, p_to_category_id, p_month, v_to_limit + p_amount)
  on conflict (category_id, month)
  do update set "limit" = excluded."limit";

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'reallocate',
    jsonb_build_object('from', p_from_category_id, 'to', p_to_category_id, 'amount', p_amount)
  );
end;
$$;

revoke all on function public.reallocate_budget from public;
grant execute on function public.reallocate_budget to authenticated;

-- ----------------------------------------------------------------
-- RPC: create_refund (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.create_refund(
  p_card_id uuid,
  p_competence_month text,
  p_amount numeric,
  p_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_refund_category uuid;
  v_payment_id uuid;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do estorno deve ser maior que zero';
  end if;

  -- Categoria reservada "Estorno" (cria se ainda não existir)
  select id into v_refund_category
    from public.categories
   where user_id = v_user_id and type = 'income' and name = 'Estorno' and is_reserved;

  if v_refund_category is null then
    insert into public.categories (user_id, type, name, is_reserved)
    values (v_user_id, 'income', 'Estorno', true)
    returning id into v_refund_category;
  end if;

  -- Estorno = pagamento com valor negativo + is_refund (ESPECIFICAÇÃO §3.3.3)
  insert into public.card_payments (user_id, card_id, competence_month, amount, date, note, is_refund)
  values (v_user_id, p_card_id, p_competence_month, -p_amount, p_date, p_note, true)
  returning id into v_payment_id;

  -- Renda automática somente-leitura (source_ref [REFUND]{id do pagamento})
  insert into public.incomes (user_id, value, date, category_id, receive_type, description, source_ref, report_weight)
  values (
    v_user_id, p_amount, p_date, v_refund_category, 'other',
    coalesce(p_note, 'Estorno de cartão'),
    '[REFUND]' || v_payment_id::text,
    1
  );

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', v_payment_id::text, 'refund',
    jsonb_build_object('amount', p_amount, 'note', p_note)
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_refund from public;
grant execute on function public.create_refund to authenticated;

-- ----------------------------------------------------------------
-- RPC: delete_expense_installments (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.delete_expense_installments(
  p_expense_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_deleted integer := 0;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  -- Cascata: remove apenas dívidas PENDENTES vinculadas; pagas nunca são tocadas (§3.2.2)
  if p_mode = 'single' then
    delete from public.debts
     where user_id = v_user_id and expense_id = p_expense_id and paid_at is null;
    delete from public.expenses where id = p_expense_id;
    v_deleted := 1;
  elsif p_mode = 'all' and v_expense.installment_group_id is not null then
    delete from public.debts
     where user_id = v_user_id and installment_group_id = v_expense.installment_group_id and paid_at is null;
    delete from public.expenses
     where user_id = v_user_id and installment_group_id = v_expense.installment_group_id;
    get diagnostics v_deleted = row_count;
  elsif p_mode = 'subsequent' and v_expense.installment_group_id is not null then
    delete from public.debts
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and paid_at is null
       and expense_id in (
         select id from public.expenses
          where installment_group_id = v_expense.installment_group_id
            and installment_number >= v_expense.installment_number
       );
    delete from public.expenses
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and installment_number >= v_expense.installment_number;
    get diagnostics v_deleted = row_count;
  else
    -- sem grupo (parcela única) em modo all/subsequent: exclui a própria
    delete from public.debts
     where user_id = v_user_id and expense_id = p_expense_id and paid_at is null;
    delete from public.expenses where id = p_expense_id;
    v_deleted := 1;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'delete_' || p_mode,
    jsonb_build_object('deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

revoke all on function public.delete_expense_installments from public;
grant execute on function public.delete_expense_installments to authenticated;

-- ----------------------------------------------------------------
-- RPC: update_expense_installments_group (Módulo: transactions)
-- ----------------------------------------------------------------
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
  v_category_id uuid;
  v_value numeric;
  v_payment_method text;
  v_card_id uuid;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
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
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
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

-- ----------------------------------------------------------------
-- RPC: create_income_installments (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.create_income_installments(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb
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
  

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
      user_id, value, date, category_id, receive_type, description,
      report_weight, source_ref, installments_total, installment_number, installment_group_id
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      null,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end
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

revoke all on function public.create_income_installments from public;
grant execute on function public.create_income_installments to authenticated;

-- ----------------------------------------------------------------
-- RPC: update_income_installments_group (Módulo: transactions)
-- ----------------------------------------------------------------
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
  v_category_id uuid;
  v_value numeric;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;
  if v_income.source_ref is not null then
    raise exception 'Renda automática é somente leitura';
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
         receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end
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

-- ----------------------------------------------------------------
-- RPC: delete_income_installments (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.delete_income_installments(
  p_income_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_income public.incomes%rowtype;
  v_deleted integer := 0;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;
  if v_income.source_ref is not null then
    raise exception 'Renda automática é somente leitura';
  end if;

  if p_mode = 'single' then
    delete from public.incomes where id = p_income_id;
    v_deleted := 1;
  elsif p_mode = 'all' and v_income.installment_group_id is not null then
    delete from public.incomes
     where user_id = v_user_id and installment_group_id = v_income.installment_group_id;
    get diagnostics v_deleted = row_count;
  elsif p_mode = 'subsequent' and v_income.installment_group_id is not null then
    delete from public.incomes
     where user_id = v_user_id
       and installment_group_id = v_income.installment_group_id
       and installment_number >= v_income.installment_number;
    get diagnostics v_deleted = row_count;
  else
    -- sem grupo em all/subsequent: exclui a própria
    delete from public.incomes where id = p_income_id;
    v_deleted := 1;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income', p_income_id::text, 'delete',
    jsonb_build_object('mode', p_mode, 'deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

revoke all on function public.delete_income_installments from public;
grant execute on function public.delete_income_installments to authenticated;

-- ----------------------------------------------------------------
-- RPC: create_recurrence (Módulo: reminders)
-- ----------------------------------------------------------------
create or replace function public.create_recurrence(
  p_kind text,
  p_frequency text,
  p_value numeric,
  p_category_id uuid,
  p_start_date date,
  p_end_date date,
  p_occurrences_total integer,
  p_payment_method text,
  p_card_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_recurrence_id uuid;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('reminders') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo reminders.';
  end if;

  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo de recorrência inválido';
  end if;
  if p_frequency not in ('monthly', 'weekly', 'quarterly', 'yearly') then
    raise exception 'Frequência inválida';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da recorrência deve ser maior que zero';
  end if;
  if p_start_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if (p_end_date is null) = (p_occurrences_total is null) then
    raise exception 'Defina exatamente um limite: data de fim ou número de ocorrências';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data de fim anterior à data de início da recorrência';
  end if;
  if p_occurrences_total is not null and p_occurrences_total < 1 then
    raise exception 'Número de ocorrências deve ser maior que zero';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> p_kind then
    raise exception 'Categoria de % inválida ou não pertence ao usuário', p_kind;
  end if;

  if p_kind = 'expense' then
    if p_payment_method is null then
      raise exception 'Forma de pagamento obrigatória para despesa recorrente';
    end if;
    if p_payment_method = 'credit_card' then
      if p_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
      if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
        raise exception 'Cartão inválido ou não pertence ao usuário';
      end if;
    end if;
  elsif p_receive_type is null then
    raise exception 'Tipo de recebimento obrigatório para renda recorrente';
  end if;

  insert into public.recurrences (
    user_id, kind, frequency, value, category_id, start_date, end_date,
    occurrences_total, payment_method, card_id, receive_type, description, report_weight
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total,
    case when p_kind = 'expense' then p_payment_method else null end,
    case when p_kind = 'expense' and p_payment_method = 'credit_card' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight
  )
  returning id into v_recurrence_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'create',
    jsonb_build_object('kind', p_kind, 'frequency', p_frequency, 'value', p_value)
  );

  return v_recurrence_id;
end;
$$;

revoke all on function public.create_recurrence from public;
grant execute on function public.create_recurrence to authenticated;

-- ----------------------------------------------------------------
-- RPC: update_recurrence_occurrences (Módulo: reminders)
-- ----------------------------------------------------------------
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
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('reminders') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo reminders.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select recurrence_id, occurrence_number, 'expense'
    into v_recurrence_id, v_occurrence_number, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;
  if not found then
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
             end
       where e.id = any(v_ids);
      get diagnostics v_updated = row_count;
    else
      update public.incomes i
         set value = case when p_fields ? 'value' then v_value else i.value end,
             category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
             receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end
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
     where r.id = v_recurrence_id;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'update_occurrences',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_recurrence_occurrences from public;
grant execute on function public.update_recurrence_occurrences to authenticated;

-- ----------------------------------------------------------------
-- RPC: delete_recurrence_occurrences (Módulo: reminders)
-- ----------------------------------------------------------------
create or replace function public.delete_recurrence_occurrences(
  p_occurrence_id uuid,
  p_mode text
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
  v_date date;
  v_kind text;
  v_table text;
  v_deleted integer := 0;
  v_recurrence public.recurrences%rowtype;
  v_remaining integer;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('reminders') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo reminders.';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  -- Localiza a ocorrência (expense ou income) e o template.
  select recurrence_id, occurrence_number, date, 'expense'
    into v_recurrence_id, v_occurrence_number, v_date, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;

  if not found then
    select recurrence_id, occurrence_number, date, 'income'
      into v_recurrence_id, v_occurrence_number, v_date, v_kind
      from public.incomes
     where id = p_occurrence_id and user_id = v_user_id;
  end if;

  if v_recurrence_id is null then
    raise exception 'Ocorrência não encontrada';
  end if;

  select * into v_recurrence
    from public.recurrences
   where id = v_recurrence_id and user_id = v_user_id;
  if not found then
    raise exception 'Recorrência não encontrada';
  end if;

  -- single: remove a linha + grava skip (não regenera na materialização).
  if p_mode = 'single' then
    if v_kind = 'expense' then
      delete from public.debts where user_id = v_user_id and expense_id = p_occurrence_id and paid_at is null;
      delete from public.expenses where id = p_occurrence_id;
    else
      delete from public.incomes where id = p_occurrence_id;
    end if;
    insert into public.recurrence_skips (recurrence_id, occurrence_date)
    values (v_recurrence_id, v_date);
    v_deleted := 1;
  -- all: apaga o template (cascata nas linhas + skips) e dívidas pendentes.
  elsif p_mode = 'all' then
    if v_kind = 'expense' then
      delete from public.debts
       where user_id = v_user_id
         and expense_id in (select id from public.expenses where recurrence_id = v_recurrence_id)
         and paid_at is null;
      delete from public.expenses where recurrence_id = v_recurrence_id;
      get diagnostics v_deleted = row_count;
    else
      delete from public.incomes where recurrence_id = v_recurrence_id;
      get diagnostics v_deleted = row_count;
    end if;
    delete from public.recurrences where id = v_recurrence_id;
  -- subsequent: remove da ocorrência em diante + trunca o template.
  else
    if v_kind = 'expense' then
      delete from public.debts
       where user_id = v_user_id
         and expense_id in (
           select id from public.expenses
            where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number
         )
         and paid_at is null;
      delete from public.expenses
       where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number;
    else
      delete from public.incomes
       where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number;
    end if;
    get diagnostics v_deleted = row_count;

    -- Trunca o template preservando o CHECK (end_date XOR occurrences_total).
    if v_occurrence_number = 1 then
      -- Removeu tudo — apaga o template por completo.
      delete from public.recurrences where id = v_recurrence_id;
    elsif v_recurrence.end_date is not null then
      update public.recurrences
         set end_date = v_date - 1
       where id = v_recurrence_id;
    else
      update public.recurrences
         set occurrences_total = v_occurrence_number - 1
       where id = v_recurrence_id;
    end if;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'delete_occurrence',
    jsonb_build_object('mode', p_mode, 'deleted', v_deleted, 'date', v_date::text)
  );

  return v_deleted;
end;
$$;

revoke all on function public.delete_recurrence_occurrences from public;
grant execute on function public.delete_recurrence_occurrences to authenticated;

-- ----------------------------------------------------------------
-- RPC: materialize_recurrences (Módulo: transactions)
-- ----------------------------------------------------------------
create or replace function public.materialize_recurrences(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_count integer := 0;
  v_income_count integer := 0;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;

  -- 1) Inserção em lote de ocorrências de DESPESAS (set-based)
  with incoming as (
    select
      (item->>'recurrence_id')::uuid as recurrence_id,
      (item->>'date')::date as occurrence_date,
      (item->>'occurrence_number')::integer as occurrence_number,
      (item->>'value')::numeric as occurrence_value,
      nullif(item->>'bill_competence', '') as bill_competence
    from jsonb_array_elements(p_items) as item
  ),
  valid_expenses as (
    select
      v_user_id as user_id,
      r.id as recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date as date,
      r.category_id,
      r.payment_method,
      r.card_id,
      1 as installments_total,
      1 as installment_number,
      null::uuid as installment_group_id,
      i.bill_competence,
      r.report_weight,
      r.value as base_amount,
      r.description
    from incoming i
    join public.recurrences r
      on r.id = i.recurrence_id
     and r.user_id = v_user_id
     and r.is_active = true
     and r.kind = 'expense'
    where i.occurrence_date >= date '2026-01-01'
      and i.occurrence_number >= 1
      and (r.end_date is null or i.occurrence_date <= r.end_date)
      and (r.occurrences_total is null or i.occurrence_number <= r.occurrences_total)
      and not exists (
        select 1 from public.recurrence_skips s
         where s.recurrence_id = r.id and s.occurrence_date = i.occurrence_date
      )
      and not exists (
        select 1 from public.expenses e
         where e.recurrence_id = r.id and e.date = i.occurrence_date
      )
  ),
  inserted_expenses as (
    insert into public.expenses (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount, description
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount, description
    from valid_expenses
    returning 1
  )
  select count(*) into v_expense_count from inserted_expenses;

  -- 2) Inserção em lote de ocorrências de RENDAS (set-based)
  with incoming as (
    select
      (item->>'recurrence_id')::uuid as recurrence_id,
      (item->>'date')::date as occurrence_date,
      (item->>'occurrence_number')::integer as occurrence_number,
      (item->>'value')::numeric as occurrence_value
    from jsonb_array_elements(p_items) as item
  ),
  valid_incomes as (
    select
      v_user_id as user_id,
      r.id as recurrence_id,
      i.occurrence_number,
      r.value,
      i.occurrence_date as date,
      r.category_id,
      r.receive_type,
      r.description
    from incoming i
    join public.recurrences r
      on r.id = i.recurrence_id
     and r.user_id = v_user_id
     and r.is_active = true
     and r.kind = 'income'
    where i.occurrence_date >= date '2026-01-01'
      and i.occurrence_number >= 1
      and (r.end_date is null or i.occurrence_date <= r.end_date)
      and (r.occurrences_total is null or i.occurrence_number <= r.occurrences_total)
      and not exists (
        select 1 from public.recurrence_skips s
         where s.recurrence_id = r.id and s.occurrence_date = i.occurrence_date
      )
      and not exists (
        select 1 from public.incomes inc
         where inc.recurrence_id = r.id and inc.date = i.occurrence_date
      )
  ),
  inserted_incomes as (
    insert into public.incomes (
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description
    from valid_incomes
    returning 1
  )
  select count(*) into v_income_count from inserted_incomes;

  return v_expense_count + v_income_count;
end;
$$;

revoke all on function public.materialize_recurrences from public;
grant execute on function public.materialize_recurrences to authenticated;

-- ----------------------------------------------------------------
-- RPC: set_allocation_targets (Módulo: investments)
-- ----------------------------------------------------------------
create or replace function public.set_allocation_targets(p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_item jsonb;
  v_asset_id uuid;
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.';
  end if;

  if p_targets is null then
    raise exception 'Metas de alocação inválidas';
  end if;

  -- Valida formato dos itens e checa se cada asset pertence ao usuário (IDOR)
  for v_item in select * from jsonb_array_elements(p_targets) loop
    v_asset_id := (v_item->>'asset_id')::uuid;
    if v_asset_id is null
       or (v_item->>'target_percentage')::numeric is null
       or (v_item->>'target_percentage')::numeric < 0
       or (v_item->>'target_percentage')::numeric > 100 then
      raise exception 'Metas de alocação inválidas';
    end if;

    if not exists (select 1 from public.portfolio_assets where id = v_asset_id and user_id = v_user) then
      raise exception 'Ativo inválido ou não pertence ao usuário: %', v_asset_id;
    end if;
  end loop;

  -- Limpa as metas atuais do usuário
  delete from public.allocation_targets
   where user_id = v_user;

  -- Insere o novo conjunto de metas (inclusive 0%)
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         round((item->>'target_percentage')::numeric, 2)
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric >= 0;

  -- Validação FINAL da soma após o lote
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100.001 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;

  notify pgrst, 'reload schema';
end;
$$;

revoke all on function public.set_allocation_targets from public;
grant execute on function public.set_allocation_targets to authenticated;

-- ----------------------------------------------------------------
-- RPC: set_group_target (Módulo: investments)
-- ----------------------------------------------------------------
create or replace function public.set_group_target(
  p_group_type text,
  p_name text,
  p_target numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.';
  end if;
  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido';
  end if;
  if p_target < 0 or p_target > 100 then
    raise exception 'Percentual de meta inválido';
  end if;

  if p_group_type = 'class' then
    insert into public.class_targets (user_id, group_type, name, target_percentage)
    values (v_user, p_group_type, p_name, p_target)
    on conflict (user_id, group_type, name)
    do update set target_percentage = excluded.target_percentage;
  else
    insert into public.sector_targets (user_id, group_type, name, target_percentage)
    values (v_user, p_group_type, p_name, p_target)
    on conflict (user_id, group_type, name)
    do update set target_percentage = excluded.target_percentage;
  end if;
end;
$$;

revoke all on function public.set_group_target from public;
grant execute on function public.set_group_target to authenticated;

-- ----------------------------------------------------------------
-- RPC: remove_group_target (Módulo: investments)
-- ----------------------------------------------------------------
create or replace function public.remove_group_target(
  p_group_type text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.';
  end if;
  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido';
  end if;

  if p_group_type = 'class' then
    delete from public.class_targets
     where user_id = v_user and name = p_name;
  else
    delete from public.sector_targets
     where user_id = v_user and name = p_name;
  end if;
end;
$$;

revoke all on function public.remove_group_target from public;
grant execute on function public.remove_group_target to authenticated;
