-- ----------------------------------------------------------------
-- Migração 20260101000034: Permitir Metas de Alocação Zeradas (0%)
-- ----------------------------------------------------------------
--
-- O RPC `set_allocation_targets` filtrava `where (item->>'target_percentage')::numeric > 0`,
-- descartando registros de ativos com meta 0%. Isso fazia com que o app não soubesse
-- se o ativo tinha meta 0% ou se estava sem meta definida, causando sugestões indevidas
-- de aporte.
--
-- Esta migração atualiza o RPC para persistir registros com meta >= 0.
-- ----------------------------------------------------------------

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

  if p_targets is null then
    raise exception 'Metas de alocação inválidas';
  end if;

  -- Valida formato dos itens
  for v_item in select * from jsonb_array_elements(p_targets) loop
    if v_item->>'asset_id' is null
       or (v_item->>'target_percentage')::numeric is null
       or (v_item->>'target_percentage')::numeric < 0
       or (v_item->>'target_percentage')::numeric > 100 then
      raise exception 'Metas de alocação inválidas';
    end if;
  end loop;

  -- Limpa as metas atuais do usuário
  delete from public.allocation_targets
   where user_id = v_user;

  -- Insere o novo conjunto de metas (inclusive 0%)
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         round((item->>'target_percentage')::numeric, 2)
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric >= 0;

  -- Validação FINAL da soma após o lote
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100.001 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;

  notify pgrst, 'reload schema';
end;
$$;
