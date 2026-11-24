-- =============================================================================
-- Migration 0147: Fundação PF × PJ (scope), Checkpoints Isolados & Transferências Pareadas
-- =============================================================================
-- Fase 2A do Blueprint v2.1 (`docs/plans/PLANO_ENCARGOS_CARTAO_E_MODO_NEGOCIO_MEI.md`):
--   1. Adiciona coluna `scope` em expenses, incomes, recurrences, debts,
--      categories, credit_cards e cash_checkpoints (sempre default 'personal').
--   2. Adiciona colunas simétricas de transferência pareada e `is_tax_deductible`.
--   3. Cria índices compostos para consultas filtradas por scope/checkpoint/pair_id.
--   4. Cria trigger `guard_paired_transfer_mutation()` blindado via
--      `current_setting('app.allow_pair_mutation', true) = 'true'`.
--   5. Cria RPCs `create_internal_transfer_pair` e `delete_internal_transfer_pair`.
--   6. Atualiza `create_expense_with_debt`, `create_income_installments`,
--      `create_recurrence`, `materialize_recurrences`, `update_credit_card`,
--      `pay_debt`, `receive_debt`, `restore_backup`, `delete_current_user_account`
--      e `admin_delete_user`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Evolução de Schema (aditivo com defaults seguros -> zero impacto em legados)
-- -----------------------------------------------------------------------------
alter table public.expenses
  add column if not exists scope text not null default 'personal',
  add column if not exists is_internal_transfer boolean not null default false,
  add column if not exists transfer_pair_id uuid null,
  add column if not exists transfer_kind text null,
  add column if not exists is_tax_deductible boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_scope_check') then
    alter table public.expenses
      add constraint expenses_scope_check check (scope in ('personal', 'business'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_transfer_kind_check') then
    alter table public.expenses
      add constraint expenses_transfer_kind_check
      check (transfer_kind is null or transfer_kind in ('pro_labore', 'capital_injection', 'card_reimbursement'));
  end if;
end $$;

alter table public.incomes
  add column if not exists scope text not null default 'personal',
  add column if not exists is_internal_transfer boolean not null default false,
  add column if not exists transfer_pair_id uuid null,
  add column if not exists transfer_kind text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'incomes_scope_check') then
    alter table public.incomes
      add constraint incomes_scope_check check (scope in ('personal', 'business'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'incomes_transfer_kind_check') then
    alter table public.incomes
      add constraint incomes_transfer_kind_check
      check (transfer_kind is null or transfer_kind in ('pro_labore', 'capital_injection', 'card_reimbursement'));
  end if;
end $$;

alter table public.recurrences
  add column if not exists scope text not null default 'personal',
  add column if not exists is_tax_deductible boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurrences_scope_check') then
    alter table public.recurrences
      add constraint recurrences_scope_check check (scope in ('personal', 'business'));
  end if;
end $$;

alter table public.debts
  add column if not exists scope text not null default 'personal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debts_scope_check') then
    alter table public.debts
      add constraint debts_scope_check check (scope in ('personal', 'business'));
  end if;
end $$;

alter table public.categories
  add column if not exists scope text not null default 'personal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_scope_check') then
    alter table public.categories
      add constraint categories_scope_check check (scope in ('personal', 'business', 'both'));
  end if;
end $$;

alter table public.credit_cards
  add column if not exists scope text not null default 'personal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_cards_scope_check') then
    alter table public.credit_cards
      add constraint credit_cards_scope_check check (scope in ('personal', 'business', 'mixed'));
  end if;
end $$;

alter table public.cash_checkpoints
  add column if not exists scope text not null default 'personal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_checkpoints_scope_check') then
    alter table public.cash_checkpoints
      add constraint cash_checkpoints_scope_check check (scope in ('personal', 'business'));
  end if;
end $$;

-- Índices para performance em consultas escopadas e pares
create index if not exists idx_expenses_user_scope_date
  on public.expenses (user_id, scope, date desc);

create index if not exists idx_expenses_transfer_pair_id
  on public.expenses (transfer_pair_id)
  where transfer_pair_id is not null;

create index if not exists idx_incomes_user_scope_date
  on public.incomes (user_id, scope, date desc);

create index if not exists idx_incomes_transfer_pair_id
  on public.incomes (transfer_pair_id)
  where transfer_pair_id is not null;

create index if not exists idx_cash_checkpoints_user_scope_date
  on public.cash_checkpoints (user_id, scope, date desc, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. Trigger Blindado de Integridade de Transferência Pareada
-- -----------------------------------------------------------------------------
create or replace function public.guard_paired_transfer_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('app.allow_pair_mutation', true), '') = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if old.transfer_pair_id is not null then
    if tg_op = 'DELETE' then
      raise exception 'Transferência pareada não pode ser excluída isoladamente. Use a ação de excluir transferência pareada.'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' then
      if new.value is distinct from old.value
         or new.date is distinct from old.date
         or new.scope is distinct from old.scope
         or new.is_internal_transfer is distinct from old.is_internal_transfer
         or new.transfer_pair_id is distinct from old.transfer_pair_id
         or new.transfer_kind is distinct from old.transfer_kind
      then
        raise exception 'Transferência pareada não pode ser alterada isoladamente. Exclua o par e lance novamente.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_paired_transfer_expenses on public.expenses;
create trigger trg_guard_paired_transfer_expenses
  before update or delete on public.expenses
  for each row execute function public.guard_paired_transfer_mutation();

drop trigger if exists trg_guard_paired_transfer_incomes on public.incomes;
create trigger trg_guard_paired_transfer_incomes
  before update or delete on public.incomes
  for each row execute function public.guard_paired_transfer_mutation();

-- -----------------------------------------------------------------------------
-- 3. RPCs Transacionais de Transferência Interna Pareada (PF <-> PJ)
-- -----------------------------------------------------------------------------
create or replace function public.create_internal_transfer_pair(
  p_transfer_kind text,
  p_amount numeric,
  p_date date,
  p_description text default null,
  p_expense_category_id uuid default null,
  p_income_category_id uuid default null,
  p_payment_method text default 'pix',
  p_receive_type text default 'pix',
  p_source_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_pair_id uuid := gen_random_uuid();
  v_exp_scope text;
  v_inc_scope text;
  v_exp_cat_id uuid;
  v_inc_cat_id uuid;
  v_expense_id uuid;
  v_income_id uuid;
  v_desc text;
  v_payment_method text := coalesce(nullif(trim(p_payment_method), ''), 'pix');
  v_receive_type text := coalesce(nullif(trim(p_receive_type), ''), 'pix');
  v_source_ref text := nullif(trim(p_source_ref), '');
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

  if p_transfer_kind not in ('pro_labore', 'capital_injection', 'card_reimbursement') then
    raise exception 'Tipo de transferência interna inválido: %', p_transfer_kind;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor da transferência deve ser maior que zero';
  end if;

  if p_date is null or p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;

  if v_payment_method = 'credit_card' then
    raise exception 'Transferência interna entre caixas não pode usar cartão de crédito como origem';
  end if;

  if p_transfer_kind in ('pro_labore', 'card_reimbursement') then
    v_exp_scope := 'business';
    v_inc_scope := 'personal';
  else
    -- capital_injection
    v_exp_scope := 'personal';
    v_inc_scope := 'business';
  end if;

  -- Categoria da perna de saída (expense)
  if p_expense_category_id is not null then
    select id into v_exp_cat_id
      from public.categories
     where id = p_expense_category_id and user_id = v_user_id and type = 'expense';
    if v_exp_cat_id is null then
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
    end if;
  else
    select id into v_exp_cat_id
      from public.categories
     where user_id = v_user_id and type = 'expense' and is_active = true
     order by case when is_reserved then 1 else 0 end, name asc
     limit 1;
    if v_exp_cat_id is null then
      raise exception 'Nenhuma categoria de despesa disponível para registrar a saída';
    end if;
  end if;

  -- Categoria da perna de entrada (income)
  if p_income_category_id is not null then
    select id into v_inc_cat_id
      from public.categories
     where id = p_income_category_id and user_id = v_user_id and type = 'income';
    if v_inc_cat_id is null then
      raise exception 'Categoria de receita inválida ou não pertence ao usuário';
    end if;
  else
    select id into v_inc_cat_id
      from public.categories
     where user_id = v_user_id and type = 'income' and is_active = true
     order by case when is_reserved then 1 else 0 end, name asc
     limit 1;
    if v_inc_cat_id is null then
      raise exception 'Nenhuma categoria de receita disponível para registrar a entrada';
    end if;
  end if;

  v_desc := coalesce(
    nullif(trim(p_description), ''),
    case p_transfer_kind
      when 'pro_labore' then 'Retirada de Pró-Labore (PJ para PF)'
      when 'capital_injection' then 'Aporte de Capital no Negócio (PF para PJ)'
      when 'card_reimbursement' then 'Reembolso de Fatura Mista (PJ para PF)'
      else 'Transferência Interna PF/PJ'
    end
  );

  insert into public.expenses (
    user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, report_weight, base_amount,
    description, scope, is_internal_transfer, transfer_pair_id, transfer_kind
  ) values (
    v_user_id, p_amount, p_date, v_exp_cat_id, v_payment_method, null,
    1, 1, 1.0, p_amount,
    v_desc, v_exp_scope, true, v_pair_id, p_transfer_kind
  )
  returning id into v_expense_id;

  insert into public.incomes (
    user_id, value, date, category_id, receive_type,
    description, report_weight, source_ref,
    scope, is_internal_transfer, transfer_pair_id, transfer_kind
  ) values (
    v_user_id, p_amount, p_date, v_inc_cat_id, v_receive_type,
    v_desc, 1.0, v_source_ref,
    v_inc_scope, true, v_pair_id, p_transfer_kind
  )
  returning id into v_income_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'internal_transfer', v_pair_id::text, 'create_pair',
    jsonb_build_object(
      'transfer_kind', p_transfer_kind,
      'amount', p_amount,
      'date', p_date,
      'expense_id', v_expense_id,
      'income_id', v_income_id,
      'source_ref', v_source_ref
    )
  );

  return jsonb_build_object(
    'transfer_pair_id', v_pair_id,
    'expense_id', v_expense_id,
    'income_id', v_income_id,
    'transfer_kind', p_transfer_kind,
    'amount', p_amount
  );
end;
$$;

revoke all on function public.create_internal_transfer_pair from public;
grant execute on function public.create_internal_transfer_pair to authenticated;

create or replace function public.delete_internal_transfer_pair(p_transfer_pair_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_exp_deleted integer := 0;
  v_inc_deleted integer := 0;
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

  if p_transfer_pair_id is null then
    raise exception 'Identificador da transferência pareada é obrigatório';
  end if;

  perform set_config('app.allow_pair_mutation', 'true', true);

  delete from public.expenses
   where user_id = v_user_id and transfer_pair_id = p_transfer_pair_id;
  get diagnostics v_exp_deleted = row_count;

  delete from public.incomes
   where user_id = v_user_id and transfer_pair_id = p_transfer_pair_id;
  get diagnostics v_inc_deleted = row_count;

  if v_exp_deleted = 0 and v_inc_deleted = 0 then
    raise exception 'Transferência pareada não encontrada ou não pertence ao usuário';
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'internal_transfer', p_transfer_pair_id::text, 'delete_pair',
    jsonb_build_object('expenses_deleted', v_exp_deleted, 'incomes_deleted', v_inc_deleted)
  );

  return jsonb_build_object(
    'deleted', true,
    'transfer_pair_id', p_transfer_pair_id
  );
end;
$$;

revoke all on function public.delete_internal_transfer_pair from public;
grant execute on function public.delete_internal_transfer_pair to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Atualização de create_expense_with_debt (adiciona p_scope e p_is_tax_deductible)
-- -----------------------------------------------------------------------------
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date
);
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text
);
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean
);
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
);
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text, text
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
  p_debt_installment_mode text default 'per_installment',
  p_charge_kind text default 'regular',
  p_scope text default 'personal',
  p_is_tax_deductible boolean default false
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
  v_charge_kind text := coalesce(nullif(p_charge_kind, ''), 'regular');
  v_scope text := coalesce(nullif(p_scope, ''), 'personal');
  v_deductible boolean := coalesce(p_is_tax_deductible, false);
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

  if v_charge_kind not in ('regular', 'interest', 'fine', 'tax', 'bank_fee') then
    raise exception 'Tipo de encargo inválido: %', v_charge_kind;
  end if;

  if v_scope not in ('personal', 'business') then
    raise exception 'Escopo inválido: %', v_scope;
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

  if coalesce(p_is_family, false) = true and v_scope = 'personal' then
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
      charge_kind, is_family, family_id, scope, is_tax_deductible
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
      v_charge_kind,
      case when v_scope = 'business' then false else coalesce(p_is_family, false) end,
      v_family_id,
      v_scope,
      case when v_scope = 'business' then v_deductible else false end
    )
    returning id into v_expense_id;

    if v_i = 1 then
      v_first_expense_id := v_expense_id;
    end if;

    if p_debt_amount is not null then
      if p_debt_amount <= 0 or p_debt_amount > p_value then
        raise exception 'Valor da cobrança deve ser maior que zero e menor ou igual ao valor da despesa';
      end if;

      if v_mode <> 'single_total' or v_i = 1 then
        insert into public.debts (
          user_id, name, type, amount, due_date, expense_id, installment_group_id, charge_kind, scope
        ) values (
          v_user_id,
          case
            when v_count > 1 and v_mode = 'per_installment'
              then coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, '')) || ' (' || v_i || '/' || v_count || ')'
            else coalesce(nullif(p_debt_name, ''), 'Cobrança integrada: ' || coalesce(p_description, ''))
          end,
          v_debt_type,
          case
            when v_count > 1 and v_mode = 'per_installment'
              then (v_parcela ->> 'value')::numeric
            else p_debt_amount
          end,
          case
            when v_count > 1 and v_mode = 'per_installment'
              then (v_parcela ->> 'date')::date
            else coalesce(p_debt_due_date, (v_parcela ->> 'date')::date)
          end,
          v_expense_id,
          case when v_count > 1 then v_group else null end,
          v_charge_kind,
          v_scope
        );
      end if;
    end if;
  end loop;

  return coalesce(v_first_expense_id, v_expense_id);
end;
$$;

revoke all on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text, text, text, boolean
) from public;
grant execute on function public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text, text, text, boolean
) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Atualização de create_income_installments (adiciona p_scope)
-- -----------------------------------------------------------------------------
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
  p_is_family boolean default false,
  p_scope text default 'personal'
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
  v_family_id uuid := null;
  v_scope text := coalesce(nullif(p_scope, ''), 'personal');
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
  if v_scope not in ('personal', 'business') then
    raise exception 'Escopo inválido: %', v_scope;
  end if;

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

  if coalesce(p_is_family, false) = true and v_scope = 'personal' then
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

    insert into public.incomes (
      user_id, value, date, category_id, receive_type, description,
      report_weight, installments_total, installment_number, installment_group_id,
      is_family, family_id, scope
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      v_count,
      v_i,
      v_group,
      case when v_scope = 'business' then false else coalesce(p_is_family, false) end,
      v_family_id,
      v_scope
    )
    returning id into v_income_id;

    if v_first_id is null then
      v_first_id := v_income_id;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'income', v_income_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value', 'scope', v_scope)
    );
  end loop;

  return v_first_id;
end;
$$;

revoke all on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text
) from public;
grant execute on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Atualização de create_recurrence & materialize_recurrences
-- -----------------------------------------------------------------------------
drop function if exists public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric
);
drop function if exists public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean
);

create or replace function public.create_recurrence(
  p_kind text,
  p_frequency text,
  p_value numeric,
  p_category_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_occurrences_total integer default null,
  p_payment_method text default null,
  p_card_id uuid default null,
  p_receive_type text default null,
  p_description text default null,
  p_report_weight numeric default 1,
  p_is_family boolean default false,
  p_scope text default 'personal',
  p_charge_kind text default 'regular',
  p_is_tax_deductible boolean default false
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
  v_family_id uuid := null;
  v_scope text := coalesce(nullif(p_scope, ''), 'personal');
  v_charge_kind text := coalesce(nullif(p_charge_kind, ''), 'regular');
  v_deductible boolean := coalesce(p_is_tax_deductible, false);
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo inválido: esperado expense ou income';
  end if;
  if p_frequency not in ('monthly', 'weekly', 'quarterly', 'yearly') then
    raise exception 'Frequência inválida';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor deve ser maior que zero';
  end if;
  if p_start_date is null or p_start_date < date '2026-01-01' then
    raise exception 'Data inicial anterior à data de início do app (2026-01-01)';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data final anterior à data inicial';
  end if;
  if p_occurrences_total is not null and p_occurrences_total <= 0 then
    raise exception 'Número de ocorrências deve ser maior que zero';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;
  if v_scope not in ('personal', 'business') then
    raise exception 'Escopo inválido: %', v_scope;
  end if;
  if v_charge_kind not in ('regular', 'interest', 'fine', 'tax', 'bank_fee') then
    raise exception 'Tipo de encargo inválido: %', v_charge_kind;
  end if;

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
  else
    if p_receive_type is null then
      raise exception 'Forma de recebimento obrigatória para receita recorrente';
    end if;
  end if;

  if coalesce(p_is_family, false) = true and v_scope = 'personal' then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  insert into public.recurrences (
    user_id, kind, frequency, value, category_id, start_date,
    end_date, occurrences_total, payment_method, card_id, receive_type,
    description, report_weight, is_active, is_family, family_id,
    scope, charge_kind, is_tax_deductible
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total, p_payment_method,
    case when p_kind = 'expense' and p_payment_method = 'credit_card' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight, true,
    case when v_scope = 'business' then false else coalesce(p_is_family, false) end,
    v_family_id,
    v_scope,
    case when p_kind = 'expense' then v_charge_kind else 'regular' end,
    case when p_kind = 'expense' and v_scope = 'business' then v_deductible else false end
  )
  returning id into v_recurrence_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'create',
    jsonb_build_object('kind', p_kind, 'frequency', p_frequency, 'value', p_value, 'scope', v_scope)
  );

  return v_recurrence_id;
end;
$$;

revoke all on function public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean, text, text, boolean
) from public;
grant execute on function public.create_recurrence(
  text, text, numeric, uuid, date, date, integer, text, uuid, text, text, numeric, boolean, text, text, boolean
) to authenticated;

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
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: permissão de escrita em Transações requerida.' using errcode = '42501';
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
      r.description,
      coalesce(r.is_family, false) as is_family,
      r.family_id,
      coalesce(r.scope, 'personal') as scope,
      coalesce(r.charge_kind, 'regular') as charge_kind,
      coalesce(r.is_tax_deductible, false) as is_tax_deductible
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
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family, family_id, scope, charge_kind, is_tax_deductible
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      payment_method, card_id, installments_total, installment_number,
      installment_group_id, bill_competence, report_weight, base_amount,
      description, is_family, family_id, scope, charge_kind, is_tax_deductible
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
      r.description,
      coalesce(r.report_weight, 1) as report_weight,
      coalesce(r.is_family, false) as is_family,
      r.family_id,
      coalesce(r.scope, 'personal') as scope
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
      receive_type, description, report_weight, is_family, family_id, scope
    )
    select
      user_id, recurrence_id, occurrence_number, value, date, category_id,
      receive_type, description, report_weight, is_family, family_id, scope
    from valid_incomes
    returning 1
  )
  select count(*) into v_income_count from inserted_incomes;

  return v_expense_count + v_income_count;
end;
$$;

revoke all on function public.materialize_recurrences(jsonb) from public;
grant execute on function public.materialize_recurrences(jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Atualização de update_credit_card, pay_debt e receive_debt com suporte a scope
-- -----------------------------------------------------------------------------
drop function if exists public.update_credit_card(
  uuid, text, text, numeric, integer, integer, text, boolean
);
drop function if exists public.update_credit_card(
  uuid, text, text, numeric, integer, integer, text, boolean, varchar
);

create or replace function public.update_credit_card(
  p_card_id uuid,
  p_name text,
  p_brand text,
  p_credit_limit numeric,
  p_closing_day integer,
  p_due_day integer,
  p_color text,
  p_is_active boolean,
  p_last_four_digits varchar(4) default null,
  p_scope text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.credit_cards%rowtype;
  v_scope text;
begin
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
  if p_last_four_digits is not null and p_last_four_digits !~ '^[0-9]{4}$' then
    raise exception 'Os últimos dígitos devem conter exatamente 4 números';
  end if;

  v_scope := coalesce(nullif(trim(p_scope), ''), v_old.scope, 'personal');
  if v_scope not in ('personal', 'business', 'mixed') then
    raise exception 'Escopo de cartão inválido: %', v_scope;
  end if;

  update public.credit_cards
     set name = p_name,
         brand = p_brand,
         credit_limit = p_credit_limit,
         closing_day = p_closing_day,
         due_day = p_due_day,
         color = p_color,
         is_active = coalesce(p_is_active, true),
         last_four_digits = p_last_four_digits,
         scope = v_scope
   where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'update',
    jsonb_build_object(
      'closing_day', jsonb_build_object('from', v_old.closing_day, 'to', p_closing_day),
      'due_day', jsonb_build_object('from', v_old.due_day, 'to', p_due_day),
      'is_active', p_is_active,
      'last_four_digits', p_last_four_digits,
      'scope', v_scope
    )
  );
end;
$$;

revoke all on function public.update_credit_card(
  uuid, text, text, numeric, integer, integer, text, boolean, varchar, text
) from public;
grant execute on function public.update_credit_card(
  uuid, text, text, numeric, integer, integer, text, boolean, varchar, text
) to authenticated;

drop function if exists public.pay_debt(
  uuid, boolean, uuid
);

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
      charge_kind, scope
    ) values (
      v_user_id, v_effective_total, coalesce(current_date, v_debt.due_date), p_expense_category_id, 'other',
      1, 1, 1, v_effective_total, v_debt.name,
      case when v_debt.charge_kind <> 'regular' then v_debt.charge_kind else 'regular' end,
      coalesce(v_debt.scope, 'personal')
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
      'total_paid', v_effective_total,
      'scope', coalesce(v_debt.scope, 'personal')
    )
  );

  return p_debt_id;
end;
$$;

revoke all on function public.pay_debt(
  uuid, boolean, uuid, numeric, numeric, numeric, numeric
) from public;
grant execute on function public.pay_debt(
  uuid, boolean, uuid, numeric, numeric, numeric, numeric
) to authenticated;

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

    insert into public.incomes (user_id, value, date, category_id, receive_type, description, source_ref, scope)
    values (
      v_user_id, v_debt.amount, current_date, p_income_category_id, 'other',
      v_debt.name, '[DEBT]' || p_debt_id::text, coalesce(v_debt.scope, 'personal')
    )
    returning id into v_income_id;
  end if;

  update public.debts
     set paid_at = now()
   where id = p_debt_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'receive',
    jsonb_build_object(
      'created_income', coalesce(p_create_income, false),
      'income_id', v_income_id,
      'scope', coalesce(v_debt.scope, 'personal')
    )
  );

  return p_debt_id;
end;
$$;

revoke all on function public.receive_debt(
  uuid, boolean, uuid
) from public;
grant execute on function public.receive_debt(
  uuid, boolean, uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Atualização de restore_backup, delete_current_user_account e admin_delete_user
--    com `app.allow_pair_mutation = 'true'` e `coalesce` para backups legados
-- -----------------------------------------------------------------------------
create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write() then
    raise exception 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.' using errcode = '42501';
  end if;

  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'Backup inválido: campo "data" ausente ou malformado.' using errcode = '22023';
  end if;

  -- Permite exclusão/restauração em lote de linhas com transfer_pair_id neste RPC
  perform set_config('app.allow_pair_mutation', 'true', true);

  -- 1) Apaga os dados atuais do usuário (ordem segura de dependências FK)
  delete from public.portfolio_transactions pt
    using public.portfolio_assets a
    where pt.asset_id = a.id and a.user_id = v_uid;
  delete from public.portfolio_dividends where user_id = v_uid;
  delete from public.portfolio_contributions where user_id = v_uid;
  delete from public.portfolio_snapshots where user_id = v_uid;
  delete from public.class_targets where user_id = v_uid;
  delete from public.sector_targets where user_id = v_uid;
  delete from public.cash_checkpoints where user_id = v_uid;
  delete from public.card_competence_overrides o
    using public.credit_cards c
    where o.card_id = c.id and c.user_id = v_uid;
  delete from public.card_payments cp
    using public.credit_cards c
    where cp.card_id = c.id and c.user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.asset_prices where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- 2) Insere tabelas pais
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active, scope)
  select
    id, v_uid, type, name, icon, color, is_reserved, is_active,
    coalesce(nullif(scope, ''), 'personal')
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits, scope)
  select
    id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits,
    coalesce(nullif(scope, ''), 'personal')
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary
  )
  select
    pa.id,
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    coalesce(pa.accumulated_dividends, 0),
    coalesce(pa.estimated_monthly_dividend_per_share, 0),
    pa.fixed_income_metadata,
    case when f.id is not null and public.is_family_member(f.id, v_uid) then coalesce(pa.is_family, false) else false end,
    case when f.id is not null and public.is_family_member(f.id, v_uid) then pa.family_id else null end,
    coalesce(nullif(pa.family_share_mode, ''), 'full'),
    coalesce(pa.family_share_percentage, 100),
    pa.notes,
    pa.score,
    coalesce(nullif(pa.allocation_status, ''), 'active'),
    coalesce(pa.score_criteria, '{}'::jsonb),
    pa.last_reviewed_at,
    coalesce(pa.review_frequency_months, 6),
    pa.thesis_summary
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  left join public.families f on f.id = pa.family_id;

  insert into public.user_preferences (
    user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill,
    report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings, app_mode
  )
  select
    v_uid,
    coalesce(nullif(theme, ''), 'system'),
    coalesce(reminders_enabled, true),
    coalesce(reminder_days_before_debt, 3),
    coalesce(reminder_days_before_bill, 3),
    coalesce(report_weights_enabled, false),
    coalesce(max_sector_acoes, 25),
    coalesce(max_sector_fiis, 25),
    coalesce(custom_settings, '{}'::jsonb),
    coalesce(nullif(app_mode, ''), 'investor')
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select o.id, o.card_id, o.month, o.closing_day, o.due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  join public.credit_cards c on c.id = o.card_id
  where c.user_id = v_uid;

  insert into public.incomes (
    id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at,
    scope, is_internal_transfer, transfer_pair_id, transfer_kind
  )
  select
    i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at,
    coalesce(nullif(i.scope, ''), 'personal'),
    coalesce(i.is_internal_transfer, false),
    i.transfer_pair_id,
    i.transfer_kind
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories cat on cat.id = i.category_id
  where cat.user_id = v_uid;

  insert into public.expenses (
    id, user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at,
    charge_kind, scope, is_internal_transfer, transfer_pair_id, transfer_kind, is_tax_deductible
  )
  select
    e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id,
    e.installments_total, e.installment_number, e.installment_group_id,
    e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at,
    coalesce(nullif(e.charge_kind, ''), 'regular'),
    coalesce(nullif(e.scope, ''), 'personal'),
    coalesce(e.is_internal_transfer, false),
    e.transfer_pair_id,
    e.transfer_kind,
    coalesce(e.is_tax_deductible, false)
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  where cat.user_id = v_uid and (e.card_id is null or cc.user_id = v_uid);

  insert into public.debts (
    id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at,
    charge_kind, scope
  )
  select
    d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, d.expense_id, d.installment_group_id, d.created_at,
    coalesce(nullif(d.charge_kind, ''), 'regular'),
    coalesce(nullif(d.scope, ''), 'personal')
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d;

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  select cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  join public.credit_cards cc on cc.id = cp.card_id
  where cc.user_id = v_uid;

  insert into public.budgets (id, user_id, category_id, month, "limit")
  select b.id, v_uid, b.category_id, b.month, b."limit"
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  join public.categories cat on cat.id = b.category_id
  where cat.user_id = v_uid;

  insert into public.income_goals (id, user_id, category_id, month, expected)
  select ig.id, v_uid, ig.category_id, ig.month, ig.expected
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  join public.categories cat on cat.id = ig.category_id
  where cat.user_id = v_uid;

  insert into public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  select id, v_uid, occurrence_key, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  select id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  select pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  join public.portfolio_assets pa on pa.id = pt.asset_id
  where pa.user_id = v_uid;

  insert into public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  select
    ps.id,
    v_uid,
    ps.month,
    ps.total_value,
    ps.total_cost,
    ps.auto_total_value,
    ps.auto_total_cost,
    ps.manual_total_value,
    ps.manual_total_cost,
    coalesce(ps.is_manually_calibrated, false),
    ps.calibrated_at,
    coalesce(nullif(ps.status, ''), 'closed'),
    ps.closing_date,
    ps.closed_at,
    coalesce(ps.created_at, now()),
    coalesce(ps.updated_at, now())
  from jsonb_populate_recordset(null::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps;

  insert into public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, created_at)
  select
    pc.id,
    v_uid,
    case when pa.id is not null then pc.asset_id else null end,
    pc.date,
    pc.amount,
    pc.notes,
    coalesce(pc.created_at, now())
  from jsonb_populate_recordset(null::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  left join public.portfolio_assets pa on pa.id = pc.asset_id and pa.user_id = v_uid;

  insert into public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, created_at)
  select
    pd.id,
    v_uid,
    case when pa.id is not null then pd.asset_id else null end,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    coalesce(pd.created_at, now())
  from jsonb_populate_recordset(null::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  left join public.portfolio_assets pa on pa.id = pd.asset_id and pa.user_id = v_uid;

  insert into public.class_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, coalesce(nullif(group_type, ''), 'class'), name, target_percentage
  from jsonb_populate_recordset(null::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb))
  where lower(trim(coalesce(name, ''))) <> 'caixa';

  insert into public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  select
    id,
    v_uid,
    coalesce(nullif(group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(class_name, '')), ''), 'Ações'),
    name,
    target_percentage
  from jsonb_populate_recordset(null::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  insert into public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, updated_at)
  select
    ap.id,
    v_uid,
    ap.ticker,
    ap.price,
    coalesce(nullif(ap.currency, ''), 'BRL'),
    coalesce(nullif(ap.source, ''), 'manual'),
    ap.manual_price,
    coalesce(ap.updated_at, now())
  from jsonb_populate_recordset(null::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  where ap.user_id = v_uid
  on conflict (ticker, user_id) do update
  set price = excluded.price,
      currency = excluded.currency,
      source = excluded.source,
      manual_price = excluded.manual_price,
      updated_at = excluded.updated_at;

  insert into public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at, scope)
  select
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now()),
    coalesce(nullif(cc.scope, ''), 'personal')
  from jsonb_populate_recordset(null::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  select jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'class_targets', (select count(*) from public.class_targets where user_id = v_uid),
    'sector_targets', (select count(*) from public.sector_targets where user_id = v_uid)
  ) into v_counts;

  return jsonb_build_object('success', true, 'counts', v_counts);
end;
$$;

revoke all on function public.restore_backup(jsonb) from public;
grant execute on function public.restore_backup(jsonb) to authenticated;

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

  -- Libera o trigger de transferências pareadas para exclusão integral LGPD
  perform set_config('app.allow_pair_mutation', 'true', true);

  -- 0. Desvincular despesas pessoais conectadas a viagens
  update public.expenses
  set trip_id = null
  where user_id = v_user_id and trip_id is not null;

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

  -- 6. Lembretes, Feedbacks, Suporte e Telemetria
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
  update public.profiles set approved_by = null where approved_by = v_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = v_user_id;

  -- 8. Perfil e Raiz em auth.users
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_current_user_account() from public;
grant execute on function public.delete_current_user_account() to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  select role into v_caller_role from public.profiles where id = v_caller_id;
  if v_caller_role is distinct from 'superadmin' then
    raise exception 'Apenas superadministradores podem excluir contas de outros usuários.';
  end if;

  if target_user_id = v_caller_id then
    raise exception 'Para excluir sua própria conta, utilize o fluxo de autoexclusão.';
  end if;

  -- Libera o trigger de transferências pareadas para expurgo administrativo
  perform set_config('app.allow_pair_mutation', 'true', true);

  -- 1. Investimentos e Portfólio (filhos antes dos pais)
  delete from public.portfolio_dividend_dismissals where user_id = target_user_id;
  delete from public.portfolio_monthly_prices where user_id = target_user_id;
  delete from public.portfolio_transactions where user_id = target_user_id;
  delete from public.portfolio_contributions where user_id = target_user_id;
  delete from public.portfolio_dividends where user_id = target_user_id;
  delete from public.portfolio_snapshots where user_id = target_user_id;
  delete from public.allocation_presets where user_id = target_user_id;
  delete from public.allocation_targets where user_id = target_user_id;
  delete from public.class_targets where user_id = target_user_id;
  delete from public.sector_targets where user_id = target_user_id;
  delete from public.asset_prices where user_id = target_user_id;
  delete from public.cash_checkpoints where user_id = target_user_id;
  delete from public.portfolio_assets where user_id = target_user_id;

  -- 2. Cartões, Lançamentos, Empréstimos e Recorrências
  delete from public.card_competence_overrides where card_id in (select id from public.credit_cards where user_id = target_user_id);
  delete from public.card_payments where card_id in (select id from public.credit_cards where user_id = target_user_id);
  delete from public.recurrence_skips where recurrence_id in (select id from public.recurrences where user_id = target_user_id);
  delete from public.expenses where user_id = target_user_id;
  delete from public.incomes where user_id = target_user_id;
  delete from public.recurrences where user_id = target_user_id;
  delete from public.debts where user_id = target_user_id;
  delete from public.loans where user_id = target_user_id;
  delete from public.budgets where user_id = target_user_id;
  delete from public.income_goals where user_id = target_user_id;
  delete from public.credit_cards where user_id = target_user_id;
  delete from public.categories where user_id = target_user_id;

  -- 3. Lembretes, Feedbacks, Suporte e Telemetria
  delete from public.reminder_states where user_id = target_user_id;
  delete from public.insight_feedback where user_id = target_user_id;
  delete from public.support_tickets where user_id = target_user_id;
  update public.support_tickets set admin_id = null where admin_id = target_user_id;
  delete from public.app_analytics_events where user_id = target_user_id;

  -- 4. Preferências, Permissões, Assinatura, Configurações e Auditoria
  delete from public.user_preferences where user_id = target_user_id;
  delete from public.user_feature_overrides where user_id = target_user_id;
  update public.user_feature_overrides set granted_by = null where granted_by = target_user_id;
  delete from public.user_module_permissions where user_id = target_user_id;
  update public.user_module_permissions set granted_by = null where granted_by = target_user_id;
  delete from public.user_subscriptions where user_id = target_user_id;
  delete from public.audit_events where user_id = target_user_id;
  update public.access_invites set created_by = null where created_by = target_user_id;
  update public.profiles set approved_by = null where approved_by = target_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = target_user_id;

  -- 5. Perfil e Raiz em auth.users
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Recarrega schema do PostgREST
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
