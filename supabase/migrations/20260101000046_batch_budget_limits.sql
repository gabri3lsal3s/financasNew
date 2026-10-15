-- ================================================================
-- 0046_batch_budget_limits.sql — RPC de ajuste em lote de orçamentos (§Tarefa 09)
--
-- Permite atualização atômica e transacional dos limites de múltiplas
-- categorias para um dado mês, com auditoria centralizada.
-- ================================================================

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

    if v_limit = 0 then
      delete from public.budgets
       where user_id = v_user_id
         and category_id = v_category_id
         and month = p_month;
    else
      insert into public.budgets (user_id, category_id, month, "limit")
      values (v_user_id, v_category_id, p_month, v_limit)
      on conflict (category_id, month)
      do update set "limit" = excluded."limit";
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'budget', p_month, 'batch_upsert',
    jsonb_build_object('month', p_month, 'count', jsonb_array_length(p_items))
  );
end;
$$;

grant execute on function public.set_batch_budget_limits(text, jsonb) to authenticated;
