-- ----------------------------------------------------------------
-- Migração 20260101000024: Correção do Trigger de Metas de Alocação
-- ----------------------------------------------------------------
--
-- O trigger por linha `trg_allocation_targets_check` executava `BEFORE DELETE`
-- e `BEFORE INSERT/UPDATE` consultando `SELECT SUM(target_percentage) FROM allocation_targets`.
-- Quando o banco ficava temporariamente com soma > 100%, o trigger bloqueava
-- qualquer operação de DELETE ou UPDATE, impedindo o usuário de corrigir ou salvar
-- novas metas.
--
-- Esta migração:
-- 1. Remove o trigger quebrado `trg_allocation_targets_check` e sua função.
-- 2. Redefine o RPC `set_allocation_targets` para fazer substituição limpa
--    (DELETE total das metas do usuário + INSERT das novas) e validação
--    da soma final <= 100% no encerramento da transação.
-- ----------------------------------------------------------------

-- 1. Remove o trigger quebrado
drop trigger if exists trg_allocation_targets_check on public.allocation_targets;
drop function if exists public.check_allocation_total();

-- 2. Redefine set_allocation_targets com substituição atômica
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

  -- Insere o novo conjunto de metas (> 0)
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         round((item->>'target_percentage')::numeric, 2)
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric > 0;

  -- Validação FINAL da soma após o lote
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100.001 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;
end;
$$;
