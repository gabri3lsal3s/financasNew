-- =============================================================================
-- Migration 0154: Ciclo de Vida de Faturas, Rolagens (Rotativo) & Integridade
-- =============================================================================
-- Consolida as correções e blindagens da Fase 1 do Plano Arquitetural v2:
--   1. Tabela `public.card_bill_rollovers` + `expenses.rollover_id` (ON DELETE CASCADE).
--   2. Helper SQL único `public.get_card_bill_open_balance(p_card_id, p_competence_month)`.
--   3. RPCs `rollover_card_bill` e `delete_card_bill_rollover` (com advisory locks,
--      validação de teto e proteção contra desfazer em cascata).
--   4. Consolidação canônica de `pay_card_bill_with_charges` (remove overloads 0146/0150).
--   5. Correção de `refinance_credit_card_bill` (quita principal na origem e lança em
--      `card_bill_rollovers` + juros com `rollover_id`).
--   6. Blindagem bidirecional de `recalculate_bill_competences`.
--   7. Validação completa de `create_refund`.
--   8. Proteção de parcelas em competências quitadas/roladas em
--      `delete_expense_installments` e `update_expense_installments_group`.
--   9. Inclusão de `card_bill_rollovers` e `expenses.rollover_id` em `restore_backup`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela public.card_bill_rollovers & FK em public.expenses
-- -----------------------------------------------------------------------------
create table if not exists public.card_bill_rollovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Sem ON DELETE CASCADE em card_id: impede exclusão definitiva de cartão com histórico
  card_id uuid not null references public.credit_cards(id),
  from_competence_month text not null check (from_competence_month ~ '^\d{4}-\d{2}$'),
  to_competence_month text not null check (to_competence_month ~ '^\d{4}-\d{2}$'),
  principal_amount numeric(12, 2) not null check (principal_amount > 0),
  kind text not null check (kind in ('rollover', 'refinance')),
  group_id uuid not null default gen_random_uuid(),
  note text,
  created_at timestamptz not null default now(),
  constraint card_bill_rollovers_month_order check (to_competence_month > from_competence_month)
);

create unique index if not exists uq_card_bill_rollovers_single_rollover
  on public.card_bill_rollovers (card_id, from_competence_month, to_competence_month)
  where kind = 'rollover';

create index if not exists idx_card_bill_rollovers_user_card
  on public.card_bill_rollovers (user_id, card_id, from_competence_month, to_competence_month);

alter table public.card_bill_rollovers enable row level security;

drop policy if exists "card_bill_rollovers_select_own" on public.card_bill_rollovers;
create policy "card_bill_rollovers_select_own"
  on public.card_bill_rollovers
  for select
  to authenticated
  using (user_id = (select auth.uid()));

alter table public.expenses
  add column if not exists rollover_id uuid references public.card_bill_rollovers(id) on delete cascade;

create index if not exists idx_expenses_rollover_id
  on public.expenses (rollover_id)
  where rollover_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Helper SQL Único (DRY): public.get_card_bill_open_balance
-- -----------------------------------------------------------------------------
create or replace function public.get_card_bill_open_balance(
  p_card_id uuid,
  p_competence_month text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_month text;
  v_carryover_cents bigint := 0;
  v_previsto_cents bigint := 0;
  v_rolado_recebido_cents bigint := 0;
  v_rolado_enviado_cents bigint := 0;
  v_pago_cents bigint := 0;
  v_estorno_cents bigint := 0;
  v_total_fatura_cents bigint := 0;
  v_abatimentos_cents bigint := 0;
  v_saldo_cents bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if p_competence_month is null or p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  if not exists (
    select 1 from public.credit_cards
     where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;

  for v_month in
    select m from (
      select e.bill_competence as m
        from public.expenses e
       where e.user_id = v_user_id
         and e.card_id = p_card_id
         and e.bill_competence is not null
         and e.bill_competence <= p_competence_month
      union
      select cp.competence_month::text as m
        from public.card_payments cp
       where cp.user_id = v_user_id
         and cp.card_id = p_card_id
         and cp.competence_month <= p_competence_month
      union
      select r.from_competence_month as m
        from public.card_bill_rollovers r
       where r.user_id = v_user_id
         and r.card_id = p_card_id
         and r.from_competence_month <= p_competence_month
      union
      select r.to_competence_month as m
        from public.card_bill_rollovers r
       where r.user_id = v_user_id
         and r.card_id = p_card_id
         and r.to_competence_month <= p_competence_month
      union
      select p_competence_month as m
    ) months
    order by m asc
  loop
    select coalesce(sum(round(e.value * 100)::bigint), 0)
      into v_previsto_cents
      from public.expenses e
     where e.user_id = v_user_id
       and e.card_id = p_card_id
       and e.bill_competence = v_month;

    select coalesce(sum(round(r.principal_amount * 100)::bigint), 0)
      into v_rolado_recebido_cents
      from public.card_bill_rollovers r
     where r.user_id = v_user_id
       and r.card_id = p_card_id
       and r.to_competence_month = v_month;

    select coalesce(sum(round(r.principal_amount * 100)::bigint), 0)
      into v_rolado_enviado_cents
      from public.card_bill_rollovers r
     where r.user_id = v_user_id
       and r.card_id = p_card_id
       and r.from_competence_month = v_month;

    select
      coalesce(sum(case when not cp.is_refund and cp.amount > 0 then round(cp.amount * 100)::bigint else 0 end), 0),
      coalesce(sum(case when cp.is_refund or cp.amount < 0 then abs(round(cp.amount * 100)::bigint) else 0 end), 0)
      into v_pago_cents, v_estorno_cents
      from public.card_payments cp
     where cp.user_id = v_user_id
       and cp.card_id = p_card_id
       and cp.competence_month = v_month;

    v_total_fatura_cents := v_previsto_cents + v_rolado_recebido_cents;
    v_abatimentos_cents := v_pago_cents + v_estorno_cents + v_carryover_cents + v_rolado_enviado_cents;
    v_saldo_cents := greatest(0::bigint, v_total_fatura_cents - v_abatimentos_cents);

    v_carryover_cents := greatest(
      0::bigint,
      (v_pago_cents + v_estorno_cents + v_carryover_cents)
        - greatest(0::bigint, v_total_fatura_cents - v_rolado_enviado_cents)
    );
  end loop;

  return (v_saldo_cents::numeric / 100.0);
end;
$$;

revoke all on function public.get_card_bill_open_balance(uuid, text) from public, anon;
grant execute on function public.get_card_bill_open_balance(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RPC: rollover_card_bill (Módulo: cards)
-- -----------------------------------------------------------------------------
create or replace function public.rollover_card_bill(
  p_card_id uuid,
  p_from_competence_month text,
  p_to_competence_month text,
  p_principal_amount numeric,
  p_charges jsonb default '[]'::jsonb,
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
  v_open_balance numeric;
  v_rollover_id uuid;
  v_group_id uuid;
  v_reserved_cat_id uuid;
  v_cat_id uuid;
  v_charge jsonb;
  v_charge_kind text;
  v_charge_val numeric;
  v_charge_desc text;
  v_charge_date date;
  v_charges_total numeric := 0;
  v_expense_id uuid;
  v_created_expense_ids jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if p_from_competence_month is null or p_from_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência de origem inválida (esperado YYYY-MM)';
  end if;

  if p_to_competence_month is null or p_to_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência de destino inválida (esperado YYYY-MM)';
  end if;

  if p_to_competence_month <= p_from_competence_month then
    raise exception 'A competência de destino deve ser posterior à competência de origem';
  end if;

  if p_principal_amount is null or p_principal_amount <= 0 then
    raise exception 'Valor da rolagem deve ser maior que zero';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;

  if not found then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;

  -- Lock de concorrência por cartão + competência de origem
  perform pg_advisory_xact_lock(hashtext('card_bill:' || p_card_id::text || ':' || p_from_competence_month));

  v_open_balance := public.get_card_bill_open_balance(p_card_id, p_from_competence_month);
  if round(p_principal_amount * 100)::bigint > round(v_open_balance * 100)::bigint then
    raise exception 'Valor da rolagem (%) excede o saldo em aberto da fatura (%).', p_principal_amount, v_open_balance;
  end if;

  insert into public.card_bill_rollovers (
    user_id, card_id, from_competence_month, to_competence_month,
    principal_amount, kind, note
  ) values (
    v_user_id, p_card_id, p_from_competence_month, p_to_competence_month,
    p_principal_amount, 'rollover', nullif(trim(coalesce(p_note, '')), '')
  )
  returning id, group_id into v_rollover_id, v_group_id;

  if p_charges is not null and jsonb_typeof(p_charges) = 'array' and jsonb_array_length(p_charges) > 0 then
    select id into v_reserved_cat_id
      from public.categories
     where user_id = v_user_id and type = 'expense' and name = 'Tarifas e Encargos' and is_reserved;

    if v_reserved_cat_id is null then
      insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
      values (v_user_id, 'expense', 'Tarifas e Encargos', 'taxas', '#64748B', true, true)
      returning id into v_reserved_cat_id;
    end if;

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
        v_cat_id := v_reserved_cat_id;
      end if;

      v_charge_desc := coalesce(
        nullif(trim(v_charge->>'description'), ''),
        case v_charge_kind
          when 'interest' then 'Juros de Rotativo'
          when 'fine' then 'Multa por Atraso'
          when 'tax' then 'IOF de Rotativo'
          when 'bank_fee' then 'Tarifa Bancária'
          else 'Encargos de Fatura'
        end
      );

      v_charge_date := greatest(
        date '2026-01-01',
        coalesce(
          nullif(v_charge->>'date', '')::date,
          to_date(p_to_competence_month || '-01', 'YYYY-MM-DD')
        )
      );

      insert into public.expenses (
        user_id, card_id, category_id, payment_method,
        value, base_amount, date, bill_competence,
        description, charge_kind, installments_total, installment_number,
        report_weight, rollover_id
      ) values (
        v_user_id, p_card_id, v_cat_id, 'credit_card',
        v_charge_val, v_charge_val, v_charge_date, p_to_competence_month,
        v_charge_desc, v_charge_kind, 1, 1,
        1, v_rollover_id
      )
      returning id into v_expense_id;

      v_charges_total := v_charges_total + v_charge_val;
      v_created_expense_ids := v_created_expense_ids || to_jsonb(v_expense_id);
    end loop;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_bill_rollover', v_rollover_id::text, 'create_rollover',
    jsonb_build_object(
      'card_id', p_card_id,
      'from_competence_month', p_from_competence_month,
      'to_competence_month', p_to_competence_month,
      'principal_amount', p_principal_amount,
      'charges_amount', v_charges_total,
      'created_expense_ids', v_created_expense_ids
    )
  );

  return jsonb_build_object(
    'rollover_id', v_rollover_id,
    'group_id', v_group_id,
    'from_competence_month', p_from_competence_month,
    'to_competence_month', p_to_competence_month,
    'principal_amount', p_principal_amount,
    'charges_amount', v_charges_total,
    'created_expense_ids', v_created_expense_ids
  );
end;
$$;

revoke all on function public.rollover_card_bill(uuid, text, text, numeric, jsonb, text) from public, anon;
grant execute on function public.rollover_card_bill(uuid, text, text, numeric, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC: delete_card_bill_rollover (Módulo: cards)
-- -----------------------------------------------------------------------------
create or replace function public.delete_card_bill_rollover(p_rollover_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rollover public.card_bill_rollovers%rowtype;
  v_target_month text;
  v_deleted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  select * into v_rollover
    from public.card_bill_rollovers
   where id = p_rollover_id and user_id = v_user_id;

  if not found then
    raise exception 'Rolagem ou parcelamento não encontrado';
  end if;

  perform pg_advisory_xact_lock(hashtext('card_bill:' || v_rollover.card_id::text));

  for v_target_month in
    select distinct to_competence_month
      from public.card_bill_rollovers
     where group_id = v_rollover.group_id
       and user_id = v_user_id
     order by to_competence_month asc
  loop
    if exists (
      select 1 from public.card_payments cp
       where cp.card_id = v_rollover.card_id
         and cp.user_id = v_user_id
         and cp.competence_month = v_target_month
    ) or exists (
      select 1 from public.card_bill_rollovers r2
       where r2.card_id = v_rollover.card_id
         and r2.user_id = v_user_id
         and r2.from_competence_month = v_target_month
    ) then
      raise exception 'Não é possível desfazer esta rolagem porque a fatura de destino (%) já possui pagamento ou nova rolagem registrada. Estorne a operação da fatura posterior primeiro.', v_target_month;
    end if;
  end loop;

  delete from public.card_bill_rollovers
   where group_id = v_rollover.group_id
     and user_id = v_user_id;
  get diagnostics v_deleted_count = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_bill_rollover', p_rollover_id::text, 'delete_rollover',
    jsonb_build_object(
      'group_id', v_rollover.group_id,
      'card_id', v_rollover.card_id,
      'deleted_count', v_deleted_count
    )
  );

  return jsonb_build_object(
    'deleted_count', v_deleted_count,
    'group_id', v_rollover.group_id,
    'card_id', v_rollover.card_id
  );
end;
$$;

revoke all on function public.delete_card_bill_rollover(uuid) from public, anon;
grant execute on function public.delete_card_bill_rollover(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPC: pay_card_bill_with_charges — Consolidação Canônica (remove overloads)
-- -----------------------------------------------------------------------------
drop function if exists public.pay_card_bill_with_charges(uuid, text, numeric, jsonb, text, date, text);
drop function if exists public.pay_card_bill_with_charges(uuid, text, numeric, date, text, jsonb, text);

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
  v_charge_competence text;
  v_charge jsonb;
  v_charge_kind text;
  v_charge_val numeric;
  v_charge_desc text;
  v_cat_id uuid;
  v_reserved_cat_id uuid;
  v_charges_total numeric := 0;
  v_total_paid numeric := 0;
  v_payment_id uuid;
  v_expense_id uuid;
  v_created_expense_ids jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
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

  if p_payment_date is null or p_payment_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;

  if p_competence_month is null or p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  if p_charge_competence_mode not in ('current', 'next') then
    raise exception 'Modo de competência de encargos inválido (esperado current ou next)';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;

  if not found then
    raise exception 'Cartão inválido ou não pertence ao usuário: %', p_card_id;
  end if;

  if p_charge_competence_mode = 'current' then
    v_charge_competence := p_competence_month;
  else
    v_charge_competence := to_char((to_date(p_competence_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM');
  end if;

  if p_charges is not null and jsonb_typeof(p_charges) = 'array' and jsonb_array_length(p_charges) > 0 then
    select id into v_reserved_cat_id
      from public.categories
     where user_id = v_user_id and type = 'expense' and name = 'Tarifas e Encargos' and is_reserved;

    if v_reserved_cat_id is null then
      insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
      values (v_user_id, 'expense', 'Tarifas e Encargos', 'taxas', '#64748B', true, true)
      returning id into v_reserved_cat_id;
    end if;

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
        v_cat_id := v_reserved_cat_id;
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
        user_id, card_id, category_id, payment_method,
        value, base_amount, date, bill_competence,
        description, charge_kind, installments_total, installment_number, report_weight
      ) values (
        v_user_id, p_card_id, v_cat_id, 'credit_card',
        v_charge_val, v_charge_val, p_payment_date, v_charge_competence,
        v_charge_desc, v_charge_kind, 1, 1, 1
      )
      returning id into v_expense_id;

      v_charges_total := v_charges_total + v_charge_val;
      v_created_expense_ids := v_created_expense_ids || to_jsonb(v_expense_id);
    end loop;
  end if;

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

  insert into public.audit_events (
    user_id, action, entity_type, entity_id, payload
  ) values (
    v_user_id, 'pay_card_bill_with_charges', 'credit_card', p_card_id::text,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'competence_month', p_competence_month,
      'nominal_amount', p_nominal_amount,
      'charges_amount', v_charges_total,
      'total_paid', v_total_paid,
      'charge_competence_mode', p_charge_competence_mode,
      'charges_competence', v_charge_competence,
      'charge_expense_ids', v_created_expense_ids
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

revoke all on function public.pay_card_bill_with_charges(uuid, text, numeric, jsonb, text, date, text) from public, anon;
grant execute on function public.pay_card_bill_with_charges(uuid, text, numeric, jsonb, text, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. RPC: refinance_credit_card_bill — Quita principal na origem via rollovers
-- -----------------------------------------------------------------------------
drop function if exists public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid);
drop function if exists public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid, jsonb);

create or replace function public.refinance_credit_card_bill(
  p_card_id uuid,
  p_competence_month char(7),
  p_initial_payment_amount numeric,
  p_interest_installments jsonb,
  p_expense_category_id uuid,
  p_principal_installments jsonb default null
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
  v_open_balance numeric;
  v_open_cents bigint;
  v_init_cents bigint;
  v_to_finance_cents bigint;
  v_n integer;
  v_idx integer := 0;
  v_base_principal_cents bigint;
  v_rem_principal_cents bigint;
  v_curr_principal_cents bigint;
  v_sum_principal_cents bigint := 0;
  v_target_comp text;
  v_rollover_id uuid;
  v_interest_amount numeric;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Conta inativa ou pendente de aprovação.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso somente-leitura no módulo de cartões: ative sua assinatura Pro.'
      using errcode = '42501';
  end if;

  if p_competence_month is null or p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  if p_initial_payment_amount is null or p_initial_payment_amount < 0 then
    raise exception 'Entrada do parcelamento não pode ser negativa';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;
  if not found then
    raise exception 'Cartão não encontrado ou não pertence ao usuário';
  end if;

  if p_expense_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_expense_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;

  perform pg_advisory_xact_lock(hashtext('card_bill:' || p_card_id::text || ':' || p_competence_month::text));

  v_open_balance := public.get_card_bill_open_balance(p_card_id, p_competence_month::text);
  v_open_cents := round(v_open_balance * 100)::bigint;
  v_init_cents := round(p_initial_payment_amount * 100)::bigint;

  if v_init_cents > v_open_cents then
    raise exception 'Entrada (%) excede o saldo em aberto da fatura (%).', p_initial_payment_amount, v_open_balance;
  end if;

  v_to_finance_cents := greatest(0::bigint, v_open_cents - v_init_cents);

  if p_initial_payment_amount > 0 then
    insert into public.card_payments (
      user_id, card_id, competence_month, amount, date, note, is_refund
    ) values (
      v_user_id, p_card_id, p_competence_month, p_initial_payment_amount,
      greatest(date '2026-01-01', current_date), 'Entrada de parcelamento de fatura', false
    );
  end if;

  v_n := coalesce(jsonb_array_length(p_interest_installments), 0);
  if v_n > 0 then
    v_base_principal_cents := floor(v_to_finance_cents::numeric / v_n)::bigint;
    v_rem_principal_cents := v_to_finance_cents - (v_base_principal_cents * v_n);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_interest_installments, '[]'::jsonb))
  loop
    v_idx := v_idx + 1;
    v_target_comp := v_item->>'bill_competence';

    if p_principal_installments is not null and jsonb_typeof(p_principal_installments) = 'array' then
      v_curr_principal_cents := coalesce(
        round(((p_principal_installments -> (v_idx - 1))->>'amount')::numeric * 100)::bigint,
        0
      );
    else
      v_curr_principal_cents := v_base_principal_cents + (case when v_idx = 1 then v_rem_principal_cents else 0 end);
    end if;

    v_sum_principal_cents := v_sum_principal_cents + v_curr_principal_cents;
    if v_sum_principal_cents > v_to_finance_cents then
      raise exception 'Soma do principal parcelado excede o saldo a financiar';
    end if;

    v_rollover_id := null;
    if v_curr_principal_cents > 0 then
      insert into public.card_bill_rollovers (
        user_id, card_id, from_competence_month, to_competence_month,
        principal_amount, kind, group_id, note
      ) values (
        v_user_id, p_card_id, p_competence_month::text, v_target_comp,
        (v_curr_principal_cents::numeric / 100.0), 'refinance', v_group_id,
        format('Parcelamento de fatura (%s/%s)', v_idx, v_n)
      )
      returning id into v_rollover_id;
    end if;

    v_interest_amount := coalesce((v_item->>'amount')::numeric, 0);
    if v_interest_amount > 0 then
      insert into public.expenses (
        user_id, value, date, category_id, payment_method, card_id,
        installments_total, installment_number, installment_group_id,
        bill_competence, report_weight, base_amount, description, charge_kind, rollover_id
      ) values (
        v_user_id,
        v_interest_amount,
        greatest(date '2026-01-01', (v_item->>'date')::date),
        p_expense_category_id,
        'credit_card',
        p_card_id,
        (v_item->>'installments_total')::integer,
        (v_item->>'installment_number')::integer,
        v_group_id,
        v_target_comp,
        1,
        v_interest_amount,
        format('Juros de parcelamento de fatura: %s', v_card_name),
        'interest',
        v_rollover_id
      );
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'bill_refinance',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'initial_payment', p_initial_payment_amount,
      'principal_financed', (v_sum_principal_cents::numeric / 100.0),
      'installments_count', v_n,
      'group_id', v_group_id
    )
  );

  return true;
end;
$$;

revoke all on function public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.refinance_credit_card_bill(uuid, char(7), numeric, jsonb, uuid, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. RPC: recalculate_bill_competences — Blindagem Bidirecional
-- -----------------------------------------------------------------------------
create or replace function public.recalculate_bill_competences(
  p_card_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;

  with computed as (
    select
      e.id,
      to_char(
        case
          when e.date >= public.resolve_competence_boundary(
            e.date,
            coalesce(
              (
                select ov.closing_day
                  from public.card_competence_overrides ov
                 where ov.card_id = c.id
                   and ov.month = to_char(e.date, 'YYYY-MM')
                 limit 1
              ),
              c.closing_day
            )
          )
          then (date_trunc('month', e.date) + interval '1 month')::date
          else date_trunc('month', e.date)::date
        end,
        'YYYY-MM'
      ) as new_competence
    from public.expenses e
    join public.credit_cards c on c.id = e.card_id
    where e.user_id = v_user_id
      and e.card_id = p_card_id
      and e.statement_hash is null
      and e.rollover_id is null
  )
  update public.expenses e
     set bill_competence = comp.new_competence
    from computed comp
   where e.id = comp.id
     and e.bill_competence is distinct from comp.new_competence
     -- Protege competência de ORIGEM contra saída de fatura com pagamento/rolagem
     and not exists (
       select 1 from public.card_payments cp
        where cp.card_id = p_card_id
          and cp.user_id = v_user_id
          and cp.competence_month = e.bill_competence
     )
     and not exists (
       select 1 from public.card_bill_rollovers r
        where r.card_id = p_card_id
          and r.user_id = v_user_id
          and (r.from_competence_month = e.bill_competence or r.to_competence_month = e.bill_competence)
     )
     -- Protege competência de DESTINO contra entrada em fatura já paga/rolada/reconciliada
     and not exists (
       select 1 from public.card_payments cp2
        where cp2.card_id = p_card_id
          and cp2.user_id = v_user_id
          and cp2.competence_month = comp.new_competence
     )
     and not exists (
       select 1 from public.card_bill_rollovers r2
        where r2.card_id = p_card_id
          and r2.user_id = v_user_id
          and (r2.from_competence_month = comp.new_competence or r2.to_competence_month = comp.new_competence)
     )
     and not exists (
       select 1 from public.expenses e2
        where e2.card_id = p_card_id
          and e2.user_id = v_user_id
          and e2.bill_competence = comp.new_competence
          and e2.statement_hash is not null
     );

  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'recalculate_competences',
    jsonb_build_object('updated', v_updated)
  );

  return v_updated;
end;
$$;

revoke all on function public.recalculate_bill_competences(uuid) from public, anon;
grant execute on function public.recalculate_bill_competences(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. RPC: create_refund — Validação completa de competência e piso APP_START_DATE
-- -----------------------------------------------------------------------------
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
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
  end if;

  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido';
  end if;

  if p_competence_month is null or p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do estorno deve ser maior que zero';
  end if;

  if p_date is null or p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;

  select id into v_refund_category
    from public.categories
   where user_id = v_user_id and type = 'income' and name = 'Estorno' and is_reserved;

  if v_refund_category is null then
    insert into public.categories (user_id, type, name, is_reserved)
    values (v_user_id, 'income', 'Estorno', true)
    returning id into v_refund_category;
  end if;

  insert into public.card_payments (user_id, card_id, competence_month, amount, date, note, is_refund)
  values (v_user_id, p_card_id, p_competence_month, -p_amount, p_date, p_note, true)
  returning id into v_payment_id;

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
    jsonb_build_object('card_id', p_card_id, 'competence_month', p_competence_month, 'amount', p_amount, 'note', p_note)
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_refund(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.create_refund(uuid, text, numeric, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Proteção de Parcelas em Competências Quitadas/Roladas
-- -----------------------------------------------------------------------------
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
  v_is_locked boolean := false;
begin
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

  if p_mode = 'single' or v_expense.installment_group_id is null then
    if v_expense.card_id is not null and v_expense.bill_competence is not null then
      v_is_locked :=
        exists (
          select 1 from public.card_bill_rollovers r
           where r.card_id = v_expense.card_id
             and r.user_id = v_user_id
             and r.from_competence_month = v_expense.bill_competence
        )
        or (
          exists (
            select 1 from public.card_payments cp
             where cp.card_id = v_expense.card_id
               and cp.user_id = v_user_id
               and cp.competence_month = v_expense.bill_competence
          )
          and public.get_card_bill_open_balance(v_expense.card_id, v_expense.bill_competence) = 0
        );

      if v_is_locked then
        raise exception 'Esta parcela pertence a uma fatura já quitada ou rolada. Para ajustar valores, registre um estorno na fatura atual.';
      end if;
    end if;

    delete from public.debts
     where user_id = v_user_id and expense_id = p_expense_id and paid_at is null;
    delete from public.expenses where id = p_expense_id;
    v_deleted := 1;
  else
    with deletable as (
      select e.id
        from public.expenses e
       where e.user_id = v_user_id
         and e.installment_group_id = v_expense.installment_group_id
         and (p_mode = 'all' or e.installment_number >= v_expense.installment_number)
         and not (
           e.card_id is not null
           and e.bill_competence is not null
           and (
             exists (
               select 1 from public.card_bill_rollovers r
                where r.card_id = e.card_id
                  and r.user_id = v_user_id
                  and r.from_competence_month = e.bill_competence
             )
             or (
               exists (
                 select 1 from public.card_payments cp
                  where cp.card_id = e.card_id
                    and cp.user_id = v_user_id
                    and cp.competence_month = e.bill_competence
               )
               and public.get_card_bill_open_balance(e.card_id, e.bill_competence) = 0
             )
           )
         )
    ),
    deleted_debts as (
      delete from public.debts d
       where d.user_id = v_user_id
         and d.paid_at is null
         and d.expense_id in (select id from deletable)
    )
    delete from public.expenses e
     where e.id in (select id from deletable);

    get diagnostics v_deleted = row_count;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'delete_' || p_mode,
    jsonb_build_object('deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

revoke all on function public.delete_expense_installments(uuid, text) from public, anon;
grant execute on function public.delete_expense_installments(uuid, text) to authenticated;

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
  v_updated integer := 0;
  v_category_id uuid;
  v_value numeric;
  v_payment_method text;
  v_card_id uuid;
  v_touches_financial_fields boolean := false;
  v_is_locked boolean := false;
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

  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  v_touches_financial_fields :=
    (p_fields ? 'value')
    or (p_fields ? 'payment_method')
    or (p_fields ? 'card_id')
    or (p_fields ? 'bill_competence');

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

  if p_mode = 'single' or v_expense.installment_group_id is null then
    if v_touches_financial_fields and v_expense.card_id is not null and v_expense.bill_competence is not null then
      v_is_locked :=
        exists (
          select 1 from public.card_bill_rollovers r
           where r.card_id = v_expense.card_id
             and r.user_id = v_user_id
             and r.from_competence_month = v_expense.bill_competence
        )
        or (
          exists (
            select 1 from public.card_payments cp
             where cp.card_id = v_expense.card_id
               and cp.user_id = v_user_id
               and cp.competence_month = v_expense.bill_competence
          )
          and public.get_card_bill_open_balance(v_expense.card_id, v_expense.bill_competence) = 0
        );

      if v_is_locked then
        raise exception 'Esta parcela pertence a uma fatura já quitada ou rolada. Alterações de valor ou competência estão bloqueadas.';
      end if;
    end if;
    v_ids := array[p_expense_id];
  else
    select array_agg(e.id) into v_ids
      from public.expenses e
     where e.user_id = v_user_id
       and e.installment_group_id = v_expense.installment_group_id
       and (p_mode = 'all' or e.installment_number >= v_expense.installment_number)
       and (
         not v_touches_financial_fields
         or not (
           e.card_id is not null
           and e.bill_competence is not null
           and (
             exists (
               select 1 from public.card_bill_rollovers r
                where r.card_id = e.card_id
                  and r.user_id = v_user_id
                  and r.from_competence_month = e.bill_competence
             )
             or (
               exists (
                 select 1 from public.card_payments cp
                  where cp.card_id = e.card_id
                    and cp.user_id = v_user_id
                    and cp.competence_month = e.bill_competence
               )
               and public.get_card_bill_open_balance(e.card_id, e.bill_competence) = 0
             )
           )
         )
       );
  end if;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
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
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

revoke all on function public.update_expense_installments_group(uuid, text, jsonb) from public, anon;
grant execute on function public.update_expense_installments_group(uuid, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. RPC: restore_backup — Inclui card_bill_rollovers e expenses.rollover_id
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
  delete from public.card_bill_rollovers where user_id = v_uid;
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

  insert into public.card_bill_rollovers (
    id, user_id, card_id, from_competence_month, to_competence_month,
    principal_amount, kind, group_id, note, created_at
  )
  select
    r.id,
    v_uid,
    r.card_id,
    r.from_competence_month,
    r.to_competence_month,
    r.principal_amount,
    coalesce(nullif(r.kind, ''), 'rollover'),
    coalesce(r.group_id, gen_random_uuid()),
    r.note,
    coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.card_bill_rollovers, coalesce(v_data -> 'card_bill_rollovers', '[]'::jsonb)) r
  join public.credit_cards cc on cc.id = r.card_id
  where cc.user_id = v_uid;

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
    charge_kind, scope, is_internal_transfer, transfer_pair_id, transfer_kind, is_tax_deductible,
    rollover_id
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
    coalesce(e.is_tax_deductible, false),
    case when r.id is not null then e.rollover_id else null end
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  left join public.card_bill_rollovers r on r.id = e.rollover_id and r.user_id = v_uid
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
    'card_bill_rollovers', (select count(*) from public.card_bill_rollovers where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'class_targets', (select count(*) from public.class_targets where user_id = v_uid),
    'sector_targets', (select count(*) from public.sector_targets where user_id = v_uid)
  ) into v_counts;

  return jsonb_build_object('success', true, 'counts', v_counts);
end;
$$;

revoke all on function public.restore_backup(jsonb) from public, anon;
grant execute on function public.restore_backup(jsonb) to authenticated;
