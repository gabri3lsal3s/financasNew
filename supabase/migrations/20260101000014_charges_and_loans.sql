-- ================================================================
-- 0014_charges_and_loans.sql — Encargos, Faturas e Financiamentos
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Natureza da Despesa / Encargo (charge_kind)
-- ----------------------------------------------------------------
alter table public.expenses
  add column if not exists charge_kind text not null default 'regular'
  check (charge_kind in ('regular', 'interest', 'fine', 'tax', 'bank_fee'));

alter table public.debts
  add column if not exists charge_kind text not null default 'regular'
  check (charge_kind in ('regular', 'interest', 'fine', 'tax', 'bank_fee'));

alter table public.recurrences
  add column if not exists charge_kind text not null default 'regular'
  check (charge_kind in ('regular', 'interest', 'fine', 'tax', 'bank_fee'));

-- ----------------------------------------------------------------
-- 2. Tabela de Empréstimos e Financiamentos
-- ----------------------------------------------------------------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  loan_type text not null default 'personal' check (loan_type in ('personal', 'financing', 'payroll', 'other')),
  principal_amount numeric(12, 2) not null check (principal_amount > 0),
  interest_rate_monthly numeric(6, 4) not null default 0 check (interest_rate_monthly >= 0),
  amortization_system text not null default 'price' check (amortization_system in ('price', 'sac', 'fixed_installment')),
  total_installments integer not null check (total_installments between 1 and 420),
  start_date date not null check (start_date >= date '2026-01-01'),
  installment_group_id uuid not null unique,
  created_at timestamptz not null default now()
);

alter table public.loans enable row level security;

drop policy if exists "loans_owner_all" on public.loans;
create policy "loans_owner_all"
  on public.loans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_loans_user on public.loans (user_id);
create index if not exists idx_loans_installment_group on public.loans (installment_group_id);

-- ----------------------------------------------------------------
-- 3. RPC: pay_debt — Quitação de dívida a pagar com suporte a encargos e descontos
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
  if v_user_id is null then
    raise exception 'Não autenticado';
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
   where id = p_debt_id;

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

-- ----------------------------------------------------------------
-- 4. RPC: create_loan_contract — Cria contrato de empréstimo e gera parcelas
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
  if v_user_id is null then
    raise exception 'Não autenticado';
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

-- ----------------------------------------------------------------
-- 5. RPC: early_amortize_loan — Amortização extraordinária com desconto
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
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
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

  -- Marca parcelas como quitadas
  update public.debts
     set paid_at = now()
   where id = any(p_debt_ids)
     and user_id = v_user_id
     and paid_at is null;

  if p_create_expense and p_total_paid > 0 then
    if p_expense_category_id is null then
      raise exception 'Categoria obrigatória ao criar despesa de amortização';
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

-- ----------------------------------------------------------------
-- 6. RPC: refinance_credit_card_bill — Parcelamento de fatura (juros adicionais)
-- ----------------------------------------------------------------
create or replace function public.refinance_credit_card_bill(
  p_card_id uuid,
  p_competence_month char(7),
  p_initial_payment_amount numeric,
  p_interest_installments jsonb,
  p_expense_category_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_group_id uuid := gen_random_uuid();
  v_card_name text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;
  if not found then
    raise exception 'Cartão não encontrado';
  end if;

  -- 1. Se houve entrada/pagamento inicial na competência
  if p_initial_payment_amount > 0 then
    insert into public.card_payments (
      user_id, card_id, competence_month, amount, date, note, is_refund
    ) values (
      v_user_id, p_card_id, p_competence_month, p_initial_payment_amount, current_date, 'Entrada de parcelamento de fatura', false
    );
  end if;

  -- 2. Insere as parcelas de juros adicionais nas competências futuras
  for v_item in select * from jsonb_array_elements(p_interest_installments)
  loop
    insert into public.expenses (
      user_id, value, date, category_id, payment_method, card_id,
      installments_total, installment_number, installment_group_id,
      bill_competence, report_weight, base_amount, description, charge_kind
    ) values (
      v_user_id,
      (v_item->>'amount')::numeric,
      (v_item->>'date')::date,
      p_expense_category_id,
      'credit_card',
      p_card_id,
      (v_item->>'installments_total')::integer,
      (v_item->>'installment_number')::integer,
      v_group_id,
      v_item->>'bill_competence',
      1,
      (v_item->>'amount')::numeric,
      format('Juros de parcelamento de fatura: %s', v_card_name),
      'interest'
    );
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'bill_refinance',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'initial_payment', p_initial_payment_amount,
      'installments_count', jsonb_array_length(p_interest_installments),
      'installment_group_id', v_group_id
    )
  );

  return true;
end;
$$;
