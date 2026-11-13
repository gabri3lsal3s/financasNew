-- ----------------------------------------------------------------
-- Migração 20260101000120: Blindagem Canônica de execute_portfolio_batch_aporte
--
-- Corrige a divergência de parâmetros e tipos introduzida na migração 41:
-- 1. Remove sobrecargas obsoletas com parâmetros integer;
-- 2. Restaura assinatura canônica com suporte a decimais numeric(18, 8) e numeric(18, 2);
-- 3. Restaura parâmetro p_notes com valor default null;
-- 4. Mantém validações estritas de segurança RLS (active check e can_current_user_write_module);
-- 5. Aplica lock pessimista 'for update' para prevenir race conditions no recálculo de preço médio.
-- ----------------------------------------------------------------

-- Remove sobrecargas antigas/conflitantes
drop function if exists public.execute_portfolio_batch_aporte(date, integer, jsonb);
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text);
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric);

create or replace function public.execute_portfolio_batch_aporte(
  p_items jsonb,
  p_date date,
  p_total_amount numeric,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_asset record;
  v_new_qty numeric(18, 8);
  v_new_avg_price numeric(18, 8);
  v_current_qty numeric(18, 8);
  v_current_avg_price numeric(18, 8);
  v_item_qty numeric(18, 8);
  v_item_price numeric(18, 8);
  v_item_total numeric(18, 2);
  v_sum_total numeric(18, 2) := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: permissão de escrita em Investimentos requerida.' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhum ativo informado para o lote de aporte.' using errcode = '22023';
  end if;

  if p_date is null or p_date < date '2026-01-01' then
    raise exception 'Data de aporte inválida (deve ser >= 2026-01-01).' using errcode = '22023';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Valor total do aporte deve ser positivo.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(
    asset_id uuid,
    quantity numeric,
    price numeric,
    total numeric
  )
  loop
    v_item_qty := coalesce(v_item.quantity, 0);
    v_item_price := coalesce(v_item.price, 0);
    v_item_total := coalesce(v_item.total, round(v_item_qty * v_item_price, 2));

    if v_item.asset_id is null or v_item_qty <= 0 or v_item_price < 0 or v_item_total < 0 then
      raise exception 'Item de aporte com valor ou quantidade inválida: asset_id=%, qty=%, price=%', v_item.asset_id, v_item_qty, v_item_price using errcode = '22023';
    end if;

    select id, quantity, average_price into v_asset
      from public.portfolio_assets
     where id = v_item.asset_id and user_id = v_user_id
       for update;

    if not found then
      raise exception 'Ativo não encontrado ou não pertence ao usuário: %', v_item.asset_id using errcode = 'P0002';
    end if;

    v_current_qty := coalesce(v_asset.quantity, 0);
    v_current_avg_price := coalesce(v_asset.average_price, 0);

    v_new_qty := v_current_qty + v_item_qty;
    if v_new_qty > 0 then
      v_new_avg_price := round(((v_current_qty * v_current_avg_price) + (v_item_qty * v_item_price)) / v_new_qty, 8);
    else
      v_new_avg_price := 0;
    end if;

    -- 1. Atualiza portfolio_assets
    update public.portfolio_assets
       set quantity = v_new_qty,
           average_price = v_new_avg_price,
           updated_at = now()
     where id = v_item.asset_id and user_id = v_user_id;

    -- 2. Insere portfolio_transactions
    insert into public.portfolio_transactions (
      user_id,
      asset_id,
      type,
      date,
      quantity,
      price,
      total
    ) values (
      v_user_id,
      v_item.asset_id,
      'buy',
      p_date,
      v_item_qty,
      v_item_price,
      v_item_total
    );

    v_sum_total := v_sum_total + v_item_total;
  end loop;

  -- 3. Inserir portfolio_contributions
  insert into public.portfolio_contributions (
    user_id,
    asset_id,
    date,
    amount,
    notes
  ) values (
    v_user_id,
    null,
    p_date,
    p_total_amount,
    coalesce(p_notes, 'Aporte inteligente')
  );

  -- 4. Registrar auditoria (D2)
  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_user_id,
    'portfolio',
    v_user_id::text,
    'execute_batch_aporte',
    jsonb_build_object(
      'date', p_date,
      'total_amount', p_total_amount,
      'items_count', jsonb_array_length(p_items)
    )
  );

  return true;
end;
$$;

revoke all on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text) from public;
grant execute on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text) to authenticated;
