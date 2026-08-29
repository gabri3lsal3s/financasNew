-- ================================================================
-- 0038_security_hardening_tables_and_rpcs.sql — Hardening de RLS e RPCs Residuais
--
-- Objetivos de Segurança:
--   1. Homogeneização de RLS em tabelas secundárias:
--      - class_targets, sector_targets e insight_feedback passam a usar
--        ((select auth.uid()) = user_id and public.is_current_user_active()).
--   2. Blindagem de Status Ativo em RPCs legadas de cartões e categorias:
--      - create_card_payment, update_credit_card, delete_credit_card;
--      - settle_integrated_receivable, delete_category_migrate, set_budget_limit,
--        set_income_goal, recalculate_bill_competences.
--   3. Helper no banco para Feature Flags (Backend Governance):
--      - public.is_feature_enabled(p_feature_key text) para verificação atômica.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Hardening de RLS em Tabelas Secundárias
-- ----------------------------------------------------------------

-- class_targets
drop policy if exists "class_targets_all_own" on public.class_targets;
create policy "class_targets_all_own" on public.class_targets
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- sector_targets
drop policy if exists "sector_targets_all_own" on public.sector_targets;
create policy "sector_targets_all_own" on public.sector_targets
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- insight_feedback
drop policy if exists "insight_feedback_all_own" on public.insight_feedback;
create policy "insight_feedback_all_own" on public.insight_feedback
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());


-- ----------------------------------------------------------------
-- 2. Helper de Verificação de Feature Flags no PostgreSQL
-- ----------------------------------------------------------------
create or replace function public.is_feature_enabled(p_feature_key text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_globally_enabled boolean;
  v_user_override boolean;
  v_default_enabled boolean;
begin
  select is_globally_enabled, default_enabled_for_new_users
    into v_globally_enabled, v_default_enabled
    from public.system_features
   where key = p_feature_key;

  if not found then
    return true; -- Se não cadastrada, padrão liberado
  end if;

  if v_globally_enabled = false then
    return false; -- Kill-Switch global ativado
  end if;

  if v_uid is not null then
    select is_enabled into v_user_override
      from public.user_feature_overrides
     where user_id = v_uid and feature_key = p_feature_key;

    if v_user_override is not null then
      return v_user_override;
    end if;
  end if;

  return v_default_enabled;
end;
$$;


-- ----------------------------------------------------------------
-- 3. Blindagem de Status Ativo em RPCs de Cartões e Pagamentos (0004)
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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

create or replace function public.delete_credit_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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


-- ----------------------------------------------------------------
-- 4. Blindagem de Status Ativo em RPCs de Categorias e Orçamentos (0003)
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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
