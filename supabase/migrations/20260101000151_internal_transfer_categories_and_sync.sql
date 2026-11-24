-- ----------------------------------------------------------------------------
-- Migration 0151: Categoria Reservada para Transferências Internas (PF/PJ)
-- ----------------------------------------------------------------------------
-- 1. Garante que as categorias reservadas de 'Transferência Interna' (expense e income)
--    sejam provisionadas para todos os usuários com is_reserved = true.
-- 2. Atualiza a RPC create_internal_transfer_pair para usar deterministicamente
--    essas categorias de sistema quando nenhuma categoria for explicitamente informada,
--    eliminando a seleção indevida de categorias comerciais (ex.: Consultoria).
-- 3. Backfill retroativo: atualiza movimentações internas existentes (is_internal_transfer = true)
--    que estavam vinculadas a categorias comerciais para apontar para a categoria reservada.
-- ----------------------------------------------------------------------------

-- 1. Provisionamento idempotente da categoria de despesa
insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
select
  p.id,
  'expense',
  'Transferência Interna',
  'transferencia',
  '#6366F1',
  true,
  true
from public.profiles p
where not exists (
  select 1
    from public.categories c
   where c.user_id = p.id
     and c.type = 'expense'
     and c.name = 'Transferência Interna'
);

-- Provisionamento idempotente da categoria de receita
insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
select
  p.id,
  'income',
  'Transferência Interna',
  'transferencia',
  '#10B981',
  true,
  true
from public.profiles p
where not exists (
  select 1
    from public.categories c
   where c.user_id = p.id
     and c.type = 'income'
     and c.name = 'Transferência Interna'
);

-- 2. Atualização da RPC create_internal_transfer_pair com resolução inteligente de categoria de sistema
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

  -- Resolução da categoria de despesa (saída)
  if p_expense_category_id is not null then
    select id into v_exp_cat_id
      from public.categories
     where id = p_expense_category_id and user_id = v_user_id and type = 'expense';
    if v_exp_cat_id is null then
      raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
    end if;
  else
    -- 1º: Tenta categoria reservada de sistema 'Transferência Interna'
    select id into v_exp_cat_id
      from public.categories
     where user_id = v_user_id and type = 'expense' and name = 'Transferência Interna'
     limit 1;

    -- 2º: Fallback se ainda não existir: cria sob demanda
    if v_exp_cat_id is null then
      insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
      values (v_user_id, 'expense', 'Transferência Interna', 'transferencia', '#6366F1', true, true)
      returning id into v_exp_cat_id;
    end if;
  end if;

  -- Resolução da categoria de receita (entrada)
  if p_income_category_id is not null then
    select id into v_inc_cat_id
      from public.categories
     where id = p_income_category_id and user_id = v_user_id and type = 'income';
    if v_inc_cat_id is null then
      raise exception 'Categoria de receita inválida ou não pertence ao usuário';
    end if;
  else
    -- 1º: Tenta categoria reservada de sistema 'Transferência Interna'
    select id into v_inc_cat_id
      from public.categories
     where user_id = v_user_id and type = 'income' and name = 'Transferência Interna'
     limit 1;

    -- 2º: Fallback se ainda não existir: cria sob demanda
    if v_inc_cat_id is null then
      insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
      values (v_user_id, 'income', 'Transferência Interna', 'transferencia', '#10B981', true, true)
      returning id into v_inc_cat_id;
    end if;
  end if;

  v_desc := coalesce(
    nullif(trim(p_description), ''),
    case p_transfer_kind
      when 'pro_labore' then 'Retirada de Pró-Labore (PJ para PF)'
      when 'capital_injection' then 'Aporte de Capital no Negócio (PF para PJ)'
      when 'card_reimbursement' then 'Reembolso de Despesas (PJ para PF)'
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
    'pair_id', v_pair_id,
    'expense_id', v_expense_id,
    'income_id', v_income_id,
    'transfer_kind', p_transfer_kind,
    'amount', p_amount,
    'date', p_date
  );
end;
$$;

revoke all on function public.create_internal_transfer_pair from public;
grant execute on function public.create_internal_transfer_pair to authenticated;

-- 3. Backfill retroativo: atualiza receitas e despesas que foram criadas como transferência interna pareada
do $$
declare
  r record;
  v_target_income_cat uuid;
  v_target_expense_cat uuid;
begin
  -- Habilita temporariamente a alteração das transações pareadas no contexto de migração
  perform set_config('app.allow_pair_mutation', 'true', true);

  for r in (select distinct user_id from public.incomes where is_internal_transfer = true union select distinct user_id from public.expenses where is_internal_transfer = true)
  loop
    -- Localiza categoria de receita 'Transferência Interna'
    select id into v_target_income_cat
      from public.categories
     where user_id = r.user_id and type = 'income' and name = 'Transferência Interna'
     limit 1;

    if v_target_income_cat is not null then
      update public.incomes
         set category_id = v_target_income_cat
       where user_id = r.user_id
         and is_internal_transfer = true
         and (category_id is distinct from v_target_income_cat);
    end if;

    -- Localiza categoria de despesa 'Transferência Interna'
    select id into v_target_expense_cat
      from public.categories
     where user_id = r.user_id and type = 'expense' and name = 'Transferência Interna'
     limit 1;

    if v_target_expense_cat is not null then
      update public.expenses
         set category_id = v_target_expense_cat
       where user_id = r.user_id
         and is_internal_transfer = true
         and (category_id is distinct from v_target_expense_cat);
    end if;
  end loop;
end;
$$;
