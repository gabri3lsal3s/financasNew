-- ================================================================
-- 0021_fix_reallocate_budget.sql — Correção de RPC reallocate_budget
--
-- Trata limites herdados, evita atribuição de NULL e respeita
-- a constraint limit > 0 no PostgreSQL.
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
  v_from_limit numeric := 0;
  v_to_limit numeric := 0;
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

  -- Limite efetivo de origem (busca no mês ou no histórico mais recente anterior)
  select coalesce(b."limit", 0) into v_from_limit
    from public.budgets b
   where b.user_id = v_user_id
     and b.category_id = p_from_category_id
     and b.month <= p_month
   order by b.month desc
   limit 1;

  v_from_limit := coalesce(v_from_limit, 0);

  if v_from_limit - p_amount < 0 then
    raise exception 'Origem não possui limite suficiente para transferir';
  end if;

  -- Limite efetivo de destino (busca no mês ou no histórico mais recente anterior)
  select coalesce(b."limit", 0) into v_to_limit
    from public.budgets b
   where b.user_id = v_user_id
     and b.category_id = p_to_category_id
     and b.month <= p_month
   order by b.month desc
   limit 1;

  v_to_limit := coalesce(v_to_limit, 0);

  -- Reduz origem: se zerou, remove do mês se existia; senão faz upsert
  if (v_from_limit - p_amount) > 0 then
    insert into public.budgets (user_id, category_id, month, "limit")
    values (v_user_id, p_from_category_id, p_month, v_from_limit - p_amount)
    on conflict (category_id, month)
    do update set "limit" = excluded."limit";
  else
    delete from public.budgets
     where category_id = p_from_category_id and month = p_month;
  end if;

  -- Aumenta destino (sempre > 0, pois v_to_limit >= 0 e p_amount >= 10)
  insert into public.budgets (user_id, category_id, month, "limit")
  values (v_user_id, p_to_category_id, p_month, v_to_limit + p_amount)
  on conflict (category_id, month)
  do update set "limit" = excluded."limit";

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'reallocate',
    jsonb_build_object('from', p_from_category_id, 'to', p_to_category_id, 'amount', p_amount)
  );
end;
$$;
