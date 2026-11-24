-- =============================================================================
-- Migration 0148: Herança de Escopo PJ e Dedutibilidade Fiscal em Faturas/Extratos
--
-- 1. Atualiza `public.import_statement_expenses`:
--    - Herda automaticamente o escopo 'business' quando o cartão importado for PJ
--    - Persiste 'is_tax_deductible' quando aplicável
--    - Executa backfill em despesas importadas de cartões corporativos
-- 2. Atualiza `public.import_bank_transactions`:
--    - Suporta 'scope' e 'is_tax_deductible' em despesas à vista importadas
--    - Suporta 'scope' em receitas importadas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Atualização de public.import_statement_expenses
-- -----------------------------------------------------------------------------
drop function if exists public.import_statement_expenses(uuid, text, jsonb);

create or replace function public.import_statement_expenses(
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count integer := 0;
  v_skipped_count integer := 0;
  v_expense_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_cat_id uuid;
  v_charge_kind text;
  v_card_scope text;
  v_scope text;
  v_is_deductible boolean;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.';
  end if;

  -- Valida posse do cartão e obtém escopo cadastrado
  select coalesce(scope, 'personal') into v_card_scope
  from public.credit_cards
  where id = p_card_id and user_id = v_user_id;

  if v_card_scope is null then
    raise exception 'Cartão de crédito não encontrado ou não pertence ao usuário: %', p_card_id;
  end if;

  select id into v_fallback_cat_id
  from public.categories
  where user_id = v_user_id and type = 'expense'
  order by name asc
  limit 1;

  for v_item in select * from jsonb_array_elements(p_expenses)
  loop
    v_date := (v_item->>'date')::date;
    v_val := (v_item->>'value')::numeric;

    if v_date is null or v_date < '2026-01-01'::date then
      raise exception 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
    end if;

    if v_val is null or v_val <= 0 then
      raise exception 'Valor de despesa deve ser estritamente positivo: %', v_val;
    end if;

    v_cat_id := nullif(v_item->>'category_id', '')::uuid;

    if v_cat_id is null or not exists (
      select 1 from public.categories where id = v_cat_id and user_id = v_user_id
    ) then
      v_cat_id := v_fallback_cat_id;
    end if;

    if v_cat_id is null then
      raise exception 'Nenhuma categoria de despesa disponível para associação.';
    end if;

    v_charge_kind := coalesce(nullif(v_item->>'charge_kind', ''), 'regular');
    if v_charge_kind not in ('regular', 'interest', 'fine', 'tax', 'bank_fee') then
      v_charge_kind := 'regular';
    end if;

    -- Herança do escopo: item explícito > cartão business > default personal
    v_scope := coalesce(nullif(v_item->>'scope', ''), case when v_card_scope = 'business' then 'business' else 'personal' end);
    if v_scope not in ('personal', 'business') then
      v_scope := 'personal';
    end if;

    v_is_deductible := case
      when v_scope = 'business' then coalesce((v_item->>'is_tax_deductible')::boolean, false)
      else false
    end;

    insert into public.expenses (
      user_id,
      card_id,
      category_id,
      payment_method,
      value,
      base_amount,
      report_weight,
      date,
      bill_competence,
      description,
      charge_kind,
      installments_total,
      installment_number,
      statement_hash,
      imported_from_statement,
      scope,
      is_tax_deductible
    ) values (
      v_user_id,
      p_card_id,
      v_cat_id,
      'credit_card',
      v_val,
      v_val,
      coalesce((v_item->>'report_weight')::numeric, 1.0),
      v_date,
      p_competence_month,
      coalesce(v_item->>'description', 'Despesa importada'),
      v_charge_kind,
      coalesce((v_item->>'installments_total')::integer, 1),
      coalesce((v_item->>'installment_number')::integer, 1),
      nullif(v_item->>'statement_hash', ''),
      true,
      v_scope,
      v_is_deductible
    )
    on conflict (user_id, card_id, statement_hash) where statement_hash is not null
    do nothing
    returning id into v_expense_id;

    if v_expense_id is not null then
      v_inserted_count := v_inserted_count + 1;
    else
      v_skipped_count := v_skipped_count + 1;
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expenses', p_card_id::text, 'import_statement',
    jsonb_build_object(
      'card_id', p_card_id,
      'competence_month', p_competence_month,
      'inserted_count', v_inserted_count,
      'skipped_count', v_skipped_count,
      'card_scope', v_card_scope,
      'total_received', jsonb_array_length(p_expenses)
    )
  );

  return jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'skipped_count', v_skipped_count
  );
end;
$$;

revoke all on function public.import_statement_expenses(uuid, text, jsonb) from public;
grant execute on function public.import_statement_expenses(uuid, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Atualização de public.import_bank_transactions
-- -----------------------------------------------------------------------------
drop function if exists public.import_bank_transactions(jsonb, jsonb);

create or replace function public.import_bank_transactions(
  p_expenses jsonb default '[]'::jsonb,
  p_incomes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_exp_inserted int := 0;
  v_exp_skipped int := 0;
  v_inc_inserted int := 0;
  v_inc_skipped int := 0;
  v_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_exp_cat_id uuid;
  v_fallback_inc_cat_id uuid;
  v_scope text;
  v_is_deductible boolean;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: permissão de escrita em Transações requerida.';
  end if;

  -- Fallbacks defensivos de categoria
  select id into v_fallback_exp_cat_id
  from public.categories
  where user_id = v_user_id and type = 'expense'
  order by name asc limit 1;

  select id into v_fallback_inc_cat_id
  from public.categories
  where user_id = v_user_id and type = 'income'
  order by name asc limit 1;

  -- 1. Importar despesas à vista
  if p_expenses is not null and jsonb_array_length(p_expenses) > 0 then
    for v_item in select * from jsonb_array_elements(p_expenses)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      if v_date is null or v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      end if;

      if v_val is null or v_val <= 0 then
        raise exception 'Valor de despesa deve ser estritamente positivo: %', v_val;
      end if;

      v_cat_id := nullif(v_item->>'category_id', '')::uuid;
      if v_cat_id is null or not exists (
        select 1 from public.categories where id = v_cat_id and user_id = v_user_id
      ) then
        v_cat_id := v_fallback_exp_cat_id;
      end if;

      if v_cat_id is null then
        raise exception 'Nenhuma categoria de despesa disponível para associação.';
      end if;

      v_scope := coalesce(nullif(v_item->>'scope', ''), 'personal');
      if v_scope not in ('personal', 'business') then
        v_scope := 'personal';
      end if;

      v_is_deductible := case
        when v_scope = 'business' then coalesce((v_item->>'is_tax_deductible')::boolean, false)
        else false
      end;

      insert into public.expenses (
        user_id,
        category_id,
        payment_method,
        value,
        base_amount,
        report_weight,
        date,
        description,
        installments_total,
        installment_number,
        statement_hash,
        imported_from_statement,
        scope,
        is_tax_deductible
      ) values (
        v_user_id,
        v_cat_id,
        coalesce(nullif(v_item->>'payment_method', ''), 'pix'),
        v_val,
        v_val,
        coalesce((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        coalesce(v_item->>'description', 'Despesa importada'),
        1,
        1,
        nullif(v_item->>'statement_hash', ''),
        true,
        v_scope,
        v_is_deductible
      )
      on conflict (user_id, statement_hash) where card_id is null and statement_hash is not null
      do nothing
      returning id into v_id;

      if v_id is not null then
        v_exp_inserted := v_exp_inserted + 1;
      else
        v_exp_skipped := v_exp_skipped + 1;
      end if;
    end loop;
  end if;

  -- 2. Importar receitas à vista
  if p_incomes is not null and jsonb_array_length(p_incomes) > 0 then
    for v_item in select * from jsonb_array_elements(p_incomes)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      if v_date is null or v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      end if;

      if v_val is null or v_val <= 0 then
        raise exception 'Valor de receita deve ser estritamente positivo: %', v_val;
      end if;

      v_cat_id := nullif(v_item->>'category_id', '')::uuid;
      if v_cat_id is null or not exists (
        select 1 from public.categories where id = v_cat_id and user_id = v_user_id
      ) then
        v_cat_id := v_fallback_inc_cat_id;
      end if;

      if v_cat_id is null then
        raise exception 'Nenhuma categoria de receita disponível para associação.';
      end if;

      v_scope := coalesce(nullif(v_item->>'scope', ''), 'personal');
      if v_scope not in ('personal', 'business') then
        v_scope := 'personal';
      end if;

      insert into public.incomes (
        user_id,
        category_id,
        receive_type,
        value,
        base_amount,
        report_weight,
        date,
        description,
        statement_hash,
        imported_from_statement,
        scope
      ) values (
        v_user_id,
        v_cat_id,
        coalesce(nullif(v_item->>'receive_type', ''), 'pix'),
        v_val,
        v_val,
        coalesce((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        coalesce(v_item->>'description', 'Receita importada'),
        nullif(v_item->>'statement_hash', ''),
        true,
        v_scope
      )
      on conflict (user_id, statement_hash) where statement_hash is not null
      do nothing
      returning id into v_id;

      if v_id is not null then
        v_inc_inserted := v_inc_inserted + 1;
      else
        v_inc_skipped := v_inc_skipped + 1;
      end if;
    end loop;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'transactions', v_user_id::text, 'import_bank_transactions',
    jsonb_build_object(
      'exp_inserted', v_exp_inserted,
      'exp_skipped', v_exp_skipped,
      'inc_inserted', v_inc_inserted,
      'inc_skipped', v_inc_skipped
    )
  );

  return jsonb_build_object(
    'success', true,
    'expenses_inserted', v_exp_inserted,
    'expenses_skipped', v_exp_skipped,
    'incomes_inserted', v_inc_inserted,
    'incomes_skipped', v_inc_skipped
  );
end;
$$;

revoke all on function public.import_bank_transactions(jsonb, jsonb) from public;
grant execute on function public.import_bank_transactions(jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Backfill seguro de despesas importadas de cartões PJ
-- -----------------------------------------------------------------------------
update public.expenses e
set scope = 'business'
from public.credit_cards c
where e.card_id = c.id
  and c.scope = 'business'
  and e.scope = 'personal'
  and e.imported_from_statement = true;
