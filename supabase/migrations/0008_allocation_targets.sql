-- ----------------------------------------------------------------
-- Metas de alocação (Fase 4 — entrega 3, §3.11.1)
--
-- O trigger `check_allocation_total` valida a soma POR LINHA, mas a
-- edição em lote é o fluxo principal (barra de soma ≤ 100%). Como o
-- trigger vê o estado por statement, 3 upserts de 40 cada passariam
-- individualmente. Estes RPCs aplicam o lote DENTRO de uma transação e
-- validam a soma FINAL — se exceder 100%, rollback total (nada salvo).
-- ----------------------------------------------------------------

-- Atualiza as metas por ativo em lote (substitui o conjunto do usuário).
create or replace function public.set_allocation_targets(p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_item jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Valida formato dos itens (asset_id + target 0–100) antes de tocar o banco.
  if p_targets is null then
    raise exception 'Metas de alocação inválidas';
  end if;
  for v_item in select * from jsonb_array_elements(p_targets) loop
    if v_item->>'asset_id' is null
       or (v_item->>'target_percentage')::numeric is null
       or (v_item->>'target_percentage')::numeric < 0
       or (v_item->>'target_percentage')::numeric > 100 then
      raise exception 'Metas de alocação inválidas';
    end if;
  end loop;

  -- Substitui o conjunto: remove metas não enviadas (target zero = remover).
  delete from public.allocation_targets
   where user_id = v_user
     and asset_id not in (
       select (item->>'asset_id')::uuid
         from jsonb_array_elements(p_targets) as item
        where (item->>'target_percentage')::numeric > 0
     );

  -- Upsert das metas enviadas (target > 0).
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         (item->>'target_percentage')::numeric
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric > 0
  on conflict (user_id, asset_id)
  do update set target_percentage = excluded.target_percentage;

  -- Validação FINAL da soma (após o lote — cobre o caso que o trigger
  -- por linha não vê). Excedeu → rollback total.
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;
end;
$$;

-- Upsert de meta de grupo (classe ou setor) — única por (user, group_type, nome).
create or replace function public.set_group_target(
  p_group_type text,
  p_name text,
  p_target numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido';
  end if;
  if p_target < 0 or p_target > 100 then
    raise exception 'Percentual de meta inválido';
  end if;

  if p_group_type = 'class' then
    insert into public.class_targets (user_id, group_type, name, target_percentage)
    values (v_user, p_group_type, p_name, p_target)
    on conflict (user_id, group_type, name)
    do update set target_percentage = excluded.target_percentage;
  else
    insert into public.sector_targets (user_id, group_type, name, target_percentage)
    values (v_user, p_group_type, p_name, p_target)
    on conflict (user_id, group_type, name)
    do update set target_percentage = excluded.target_percentage;
  end if;
end;
$$;

-- Remove uma meta de grupo (classe ou setor).
create or replace function public.remove_group_target(
  p_group_type text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido';
  end if;

  if p_group_type = 'class' then
    delete from public.class_targets
     where user_id = v_user and name = p_name;
  else
    delete from public.sector_targets
     where user_id = v_user and name = p_name;
  end if;
end;
$$;
