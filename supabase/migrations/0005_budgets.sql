-- ================================================================
-- 0005_budgets.sql — RPCs de orçamentos (Entrega 7, Fase 2)
--
-- Realocação automática (§3.5.2): categoria com maior excesso →
-- maior folga, transferindo min(excesso, folga) arredondado a R$ 10
-- (mínimo R$ 10). A operação mexe em DOIS limites — por isso é uma
-- função atômica (D1), nunca duas chamadas separadas da UI.
-- ================================================================

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
  v_from_limit numeric;
  v_to_limit numeric;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
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

  select coalesce(limit, 0) into v_from_limit
    from public.budgets
   where category_id = p_from_category_id and month = p_month;

  if v_from_limit - p_amount < 0 then
    raise exception 'Origem não pode ficar com limite negativo';
  end if;

  select coalesce(limit, 0) into v_to_limit
    from public.budgets
   where category_id = p_to_category_id and month = p_month;

  -- Reduz origem (nunca < 0) e aumenta destino — atômico.
  insert into public.budgets (user_id, category_id, month, limit)
  values (v_user_id, p_from_category_id, p_month, v_from_limit - p_amount)
  on conflict (category_id, month)
  do update set limit = excluded.limit;

  insert into public.budgets (user_id, category_id, month, limit)
  values (v_user_id, p_to_category_id, p_month, v_to_limit + p_amount)
  on conflict (category_id, month)
  do update set limit = excluded.limit;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'reallocate',
    jsonb_build_object('from', p_from_category_id, 'to', p_to_category_id, 'amount', p_amount)
  );
end;
$$;
