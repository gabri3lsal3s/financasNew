-- =============================================================================
-- Migration 0146: Encargos de Cartão (charge_kind) & Pagamento com Encargos
-- =============================================================================
-- Fase 1 do Blueprint v2.1 (`docs/plans/PLANO_ENCARGOS_CARTAO_E_MODO_NEGOCIO_MEI.md`):
--   1. RPC `public.pay_card_bill_with_charges`: registra encargos (juros, multa,
--      IOF, tarifa) na competência atual ou seguinte e liquida a fatura
--      nominalmente ou integralmente sem gerar dívidas-fantasma no fluxo de caixa.
--   2. Atualização de `public.import_statement_expenses`: preserva `charge_kind`
--      ao importar despesas do extrato / OFX / PDF / CSV.
--   3. Atualização de `public.create_expense_with_debt`: aceita `p_charge_kind text default 'regular'`
--      preservando o tipo de encargo na despesa e na cobrança vinculada.
--   4. Atualização de `public.restore_backup`: restaura fielmente o campo
--      `charge_kind` em `public.expenses` e `public.debts`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RPC: pay_card_bill_with_charges (Módulo: cards)
-- -----------------------------------------------------------------------------
create or replace function public.pay_card_bill_with_charges(
  p_card_id uuid,
  p_competence_month text,
  p_nominal_amount numeric,
  p_charges jsonb default '[]'::jsonb,
  p_charge_competence_mode text default 'current',
  p_payment_date date default current_date,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card_name text;
  v_charge jsonb;
  v_charge_kind text;
  v_charge_val numeric;
  v_charge_desc text;
  v_cat_id uuid;
  v_fallback_cat_id uuid;
  v_charge_competence text;
  v_charges_total numeric := 0;
  v_total_paid numeric := 0;
  v_payment_id uuid;
  v_expense_id uuid;
  v_created_expense_ids jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if p_nominal_amount is null or p_nominal_amount <= 0 then
    raise exception 'Valor nominal da fatura deve ser maior que zero';
  end if;

  if p_payment_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;

  if p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  if p_charge_competence_mode not in ('current', 'next') then
    raise exception 'Modo de competência de encargos inválido (esperado current ou next)';
  end if;

  -- Validação de posse do cartão
  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;

  if not found then
    raise exception 'Cartão inválido ou não pertence ao usuário: %', p_card_id;
  end if;

  -- Determinação da competência de lançamento dos encargos
  if p_charge_competence_mode = 'current' then
    v_charge_competence := p_competence_month;
  else
    v_charge_competence := to_char((to_date(p_competence_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM');
  end if;

  -- Categoria fallback para despesas de encargos
  select id into v_fallback_cat_id
    from public.categories
   where user_id = v_user_id and type = 'expense'
   order by case when lower(name) in ('juros', 'multas', 'encargos', 'financeiro', 'outros') then 0 else 1 end, name asc
   limit 1;

  -- Inserção dos encargos detalhados
  if p_charges is not null and jsonb_typeof(p_charges) = 'array' and jsonb_array_length(p_charges) > 0 then
    for v_charge in select * from jsonb_array_elements(p_charges)
    loop
      v_charge_kind := coalesce(nullif(v_charge->>'charge_kind', ''), 'interest');
      if v_charge_kind not in ('interest', 'fine', 'tax', 'bank_fee') then
        raise exception 'Tipo de encargo inválido: %', v_charge_kind;
      end if;

      v_charge_val := (v_charge->>'amount')::numeric;
      if v_charge_val is null or v_charge_val <= 0 then
        raise exception 'Valor do encargo deve ser estritamente positivo';
      end if;

      v_cat_id := nullif(v_charge->>'category_id', '')::uuid;
      if v_cat_id is null or not exists (
        select 1 from public.categories where id = v_cat_id and user_id = v_user_id and type = 'expense'
      ) then
        v_cat_id := v_fallback_cat_id;
      end if;

      if v_cat_id is null then
        raise exception 'Nenhuma categoria de despesa disponível para registrar encargo';
      end if;

      v_charge_desc := coalesce(
        nullif(trim(v_charge->>'description'), ''),
        case v_charge_kind
          when 'interest' then 'Juros de Fatura'
          when 'fine' then 'Multa por Atraso'
          when 'tax' then 'IOF de Fatura'
          when 'bank_fee' then 'Tarifa Bancária'
          else 'Encargos de Fatura'
        end
      );

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
        installment_number
      ) values (
        v_user_id,
        p_card_id,
        v_cat_id,
        'credit_card',
        v_charge_val,
        v_charge_val,
        1.0,
        p_payment_date,
        v_charge_competence,
        v_charge_desc,
        v_charge_kind,
        1,
        1
      )
      returning id into v_expense_id;

      v_charges_total := v_charges_total + v_charge_val;
      v_created_expense_ids := v_created_expense_ids || jsonb_build_array(v_expense_id);
    end loop;
  end if;

  -- Cálculo do total pago no registro de pagamento de fatura:
  -- Se os encargos foram inseridos na competência atual ('current'), eles elevaram o saldo devedor
  -- da fatura atual em v_charges_total. O pagamento precisa cobrir nominal + charges para zerar o saldo.
  -- Se os encargos foram inseridos na próxima fatura ('next'), a fatura atual é quitada apenas pelo nominal,
  -- e os encargos serão pagos no vencimento seguinte.
  if p_charge_competence_mode = 'current' then
    v_total_paid := p_nominal_amount + v_charges_total;
  else
    v_total_paid := p_nominal_amount;
  end if;

  insert into public.card_payments (
    user_id, card_id, competence_month, amount, date, note, is_refund
  ) values (
    v_user_id, p_card_id, p_competence_month, v_total_paid, p_payment_date, p_note, false
  )
  returning id into v_payment_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', v_payment_id::text, 'pay_with_charges',
    jsonb_build_object(
      'card_id', p_card_id,
      'competence_month', p_competence_month,
      'nominal_amount', p_nominal_amount,
      'charges_amount', v_charges_total,
      'charge_competence_mode', p_charge_competence_mode,
      'charges_competence', v_charge_competence,
      'total_paid', v_total_paid,
      'charges_count', jsonb_array_length(v_created_expense_ids)
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'total_paid', v_total_paid,
    'nominal_amount', p_nominal_amount,
    'charges_amount', v_charges_total,
    'charges_competence', v_charge_competence,
    'created_expense_ids', v_created_expense_ids
  );
end;
$$;

revoke all on function public.pay_card_bill_with_charges from public;
grant execute on function public.pay_card_bill_with_charges to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Atualização de import_statement_expenses com suporte a charge_kind
-- -----------------------------------------------------------------------------
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

  -- Valida posse do cartão
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
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
      imported_from_statement
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
      true
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

revoke all on function public.import_statement_expenses from public;
grant execute on function public.import_statement_expenses to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Atualização de create_expense_with_debt com suporte a charge_kind
-- -----------------------------------------------------------------------------
drop function if exists public.create_expense_with_debt(
  numeric, date, uuid, text, uuid, text, numeric, jsonb, text, numeric, date, text, boolean, text
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
  p_charge_kind text default 'regular'
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
      charge_kind, is_family, family_id
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

      if v_mode <> 'single_total' or v_i = 1 then
        insert into public.debts (
          user_id, name, type, amount, due_date, expense_id, installment_group_id, charge_kind
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
          v_charge_kind
        );
      end if;
    end if;
  end loop;

  return coalesce(v_first_expense_id, v_expense_id);
end;
$$;

revoke all on function public.create_expense_with_debt from public;
grant execute on function public.create_expense_with_debt to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Atualização de restore_backup preservando charge_kind
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
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits
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

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories cat on cat.id = i.category_id
  where cat.user_id = v_uid;

  insert into public.expenses (
    id, user_id, value, date, category_id, payment_method, card_id,
    installments_total, installment_number, installment_group_id,
    bill_competence, report_weight, base_amount, description, created_at, charge_kind
  )
  select
    e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id,
    e.installments_total, e.installment_number, e.installment_group_id,
    e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at,
    coalesce(nullif(e.charge_kind, ''), 'regular')
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  where cat.user_id = v_uid and (e.card_id is null or cc.user_id = v_uid);

  insert into public.debts (
    id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at, charge_kind
  )
  select
    d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, d.expense_id, d.installment_group_id, d.created_at,
    coalesce(nullif(d.charge_kind, ''), 'regular')
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

  insert into public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at)
  select
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now())
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

-- -----------------------------------------------------------------------------
-- 5. Recarrega schema do PostgREST
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
