-- ----------------------------------------------------------------------------
-- Migration 0150: Categoria Reservada de Sistema para Tarifas e Encargos
-- ----------------------------------------------------------------------------
-- 1. Garante que 'Tarifas e Encargos' seja provisionada para novos e atuais usuários
--    com is_reserved = true (bloqueada contra exclusão acidental).
-- 2. Atualiza a RPC seed_default_categories() incluindo a categoria canônica.
-- 3. Atualiza pay_card_bill_with_charges para vincular encargos automaticamente
--    à categoria reservada 'Tarifas e Encargos' quando category_id não for informado.
-- ----------------------------------------------------------------------------

-- 1. Seed idempotente da categoria para todos os usuários existentes
insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
select
  p.id,
  'expense',
  'Tarifas e Encargos',
  'taxas',
  '#64748B',
  true,
  true
from public.profiles p
where not exists (
  select 1
    from public.categories c
   where c.user_id = p.id
     and c.type = 'expense'
     and c.name = 'Tarifas e Encargos'
);

-- 2. Atualização de seed_default_categories()
create or replace function public.seed_default_categories()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_inserted integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Insere as 12 categorias canônicas (9 despesas e 3 receitas)
  insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
  values
    -- Despesas Essenciais (Necessidades 50%)
    (v_user_id, 'expense', 'Alimentação', 'alimentacao', '#DDA726', false, true),
    (v_user_id, 'expense', 'Moradia', 'moradia', '#8B5CF6', false, true),
    (v_user_id, 'expense', 'Transporte', 'transporte', '#3B82F6', false, true),
    (v_user_id, 'expense', 'Saúde', 'saude', '#EF4444', false, true),
    (v_user_id, 'expense', 'Educação', 'educacao', '#2A9D8F', false, true),
    -- Despesas de Estilo de Vida (Desejos 30% / Assinaturas)
    (v_user_id, 'expense', 'Lazer', 'lazer', '#EC4899', false, true),
    (v_user_id, 'expense', 'Compras', 'compras', '#06B6D4', false, true),
    (v_user_id, 'expense', 'Assinaturas', 'assinaturas', '#6366F1', false, true),
    -- Despesas Financeiras e Encargos (Reservada de Sistema)
    (v_user_id, 'expense', 'Tarifas e Encargos', 'taxas', '#64748B', true, true),
    -- Receitas
    (v_user_id, 'income', 'Salário', 'salario', '#10B981', false, true),
    (v_user_id, 'income', 'Investimentos', 'investimentos', '#3B82F6', false, true),
    (v_user_id, 'income', 'Outras Rendas', 'salario', '#8B5CF6', false, true)
  on conflict (user_id, type, name) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.seed_default_categories() from public;
grant execute on function public.seed_default_categories() to authenticated;

-- 3. Atualização de pay_card_bill_with_charges com fallback automático na categoria reservada
create or replace function public.pay_card_bill_with_charges(
  p_card_id uuid,
  p_competence_month text,
  p_nominal_amount numeric,
  p_payment_date date,
  p_payment_note text default null,
  p_charges jsonb default '[]'::jsonb,
  p_charge_competence_mode text default 'current'
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

  -- Categoria de sistema reservada para encargos (cria sob demanda se ainda não existir)
  select id into v_reserved_cat_id
    from public.categories
   where user_id = v_user_id and type = 'expense' and name = 'Tarifas e Encargos' and is_reserved;

  if v_reserved_cat_id is null then
    insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
    values (v_user_id, 'expense', 'Tarifas e Encargos', 'taxas', '#64748B', true, true)
    returning id into v_reserved_cat_id;
  end if;

  -- 1. Inserção do pagamento da fatura (card_payments)
  insert into public.card_payments (
    user_id,
    card_id,
    competence_month,
    amount,
    date,
    note,
    is_refund
  ) values (
    v_user_id,
    p_card_id,
    p_competence_month,
    p_nominal_amount,
    p_payment_date,
    p_payment_note,
    false
  ) returning id into v_payment_id;

  -- 2. Inserção dos encargos detalhados
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
        user_id,
        card_id,
        category_id,
        payment_method,
        value,
        base_amount,
        date,
        bill_competence,
        description,
        charge_kind,
        installments_total,
        installment_number,
        report_weight
      ) values (
        v_user_id,
        p_card_id,
        v_cat_id,
        'credit_card',
        v_charge_val,
        v_charge_val,
        p_payment_date,
        v_charge_competence,
        v_charge_desc,
        v_charge_kind,
        1,
        1,
        1
      ) returning id into v_expense_id;

      v_created_expense_ids := v_created_expense_ids || to_jsonb(v_expense_id);
    end loop;
  end if;

  -- 3. Auditoria estruturada
  insert into public.audit_events (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_user_id,
    'pay_card_bill_with_charges',
    'credit_card',
    p_card_id,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'competence_month', p_competence_month,
      'nominal_amount', p_nominal_amount,
      'charges_competence', v_charge_competence,
      'charges_count', jsonb_array_length(v_created_expense_ids),
      'charge_expense_ids', v_created_expense_ids
    )
  );

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'card_id', p_card_id,
    'card_name', v_card_name,
    'nominal_amount', p_nominal_amount,
    'charges_competence', v_charge_competence,
    'created_expense_ids', v_created_expense_ids
  );
end;
$$;

revoke all on function public.pay_card_bill_with_charges(uuid, text, numeric, date, text, jsonb, text) from public;
grant execute on function public.pay_card_bill_with_charges(uuid, text, numeric, date, text, jsonb, text) to authenticated;
