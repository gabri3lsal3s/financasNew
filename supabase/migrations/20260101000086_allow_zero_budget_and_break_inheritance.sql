-- ================================================================
-- 20260101000086_allow_zero_budget_and_break_inheritance.sql
--
-- Permite limites orçamentários >= 0 na tabela budgets e atualiza
-- os RPCs set_budget_limit e set_batch_budget_limits para aceitar 0,
-- viabilizando o 'zero explícito' que interrompe herança de meses
-- anteriores e define categoria como 'sem limite / livre' (§3.5.2).
-- ================================================================

-- 1. Atualiza constraint de verificação da tabela budgets
alter table public.budgets drop constraint if exists budgets_limit_check;
alter table public.budgets add constraint budgets_limit_check check ("limit" >= 0);

-- 2. Atualiza RPC set_budget_limit (Módulo: budgets)
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

  if not public.can_current_user_write_module('budgets') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo budgets.';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido (esperado YYYY-MM)';
  end if;

  if not exists (
    select 1 from public.categories
     where id = p_category_id and user_id = v_user_id and type = 'expense'
  ) then
    raise exception 'Categoria de despesa inválida ou não pertence ao usuário';
  end if;

  if p_limit is null or p_limit < 0 then
    raise exception 'Limite não pode ser negativo';
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

-- 3. Atualiza RPC set_batch_budget_limits (Módulo: budgets)
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
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

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

    insert into public.budgets (user_id, category_id, month, "limit")
    values (v_user_id, v_category_id, p_month, v_limit)
    on conflict (category_id, month)
    do update set "limit" = excluded."limit";
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
