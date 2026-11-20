-- ============================================================================
-- Migration: 20260101000132_portfolio_batch_aporte_batch_id_and_undo.sql
-- Descrição: Adiciona coluna batch_id uuid em portfolio_transactions e
--            portfolio_contributions, atualiza execute_portfolio_batch_aporte
--            para registrar snapshots pré-lote e cria revert_portfolio_batch_aporte
--            com reversão atômica e proteção de integridade contra movimentações posteriores.
-- ============================================================================

-- 1. Coluna batch_id em portfolio_transactions
alter table public.portfolio_transactions
  add column if not exists batch_id uuid default null;

create index if not exists idx_portfolio_transactions_batch_id
  on public.portfolio_transactions(batch_id)
  where batch_id is not null;

comment on column public.portfolio_transactions.batch_id is
  'Identificador único do lote de aporte inteligente para auditoria e reversão atômica (Undo).';

-- 2. Coluna batch_id em portfolio_contributions
alter table public.portfolio_contributions
  add column if not exists batch_id uuid default null;

create index if not exists idx_portfolio_contributions_batch_id
  on public.portfolio_contributions(batch_id)
  where batch_id is not null;

comment on column public.portfolio_contributions.batch_id is
  'Identificador único do lote de aporte inteligente vinculado à contribuição financeira.';

-- 3. Atualização de execute_portfolio_batch_aporte com suporte a p_batch_id e snapshots pré-lote
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text);
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric);
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric, uuid);

create or replace function public.execute_portfolio_batch_aporte(
  p_items jsonb,
  p_date date,
  p_total_amount numeric,
  p_notes text default null,
  p_cash_used numeric default 0,
  p_batch_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid := coalesce(p_batch_id, gen_random_uuid());
  v_item record;
  v_asset record;
  v_cash_asset record;
  v_new_qty numeric(18, 8);
  v_new_avg_price numeric(18, 8);
  v_current_qty numeric(18, 8);
  v_current_avg_price numeric(18, 8);
  v_item_qty numeric(18, 8);
  v_item_price numeric(18, 8);
  v_item_total numeric(18, 2);
  v_sum_total numeric(18, 2) := 0;
  v_cash_used numeric(18, 2) := greatest(0, coalesce(p_cash_used, 0));
  v_pocket_amount numeric(18, 2);
  v_snapshots jsonb := '[]'::jsonb;
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

    -- Grava snapshot do estado pré-lote para reversão perfeita sem erro de arredondamento
    v_snapshots := v_snapshots || jsonb_build_object(
      'asset_id', v_asset.id,
      'prev_quantity', v_current_qty,
      'prev_average_price', v_current_avg_price
    );

    v_new_qty := v_current_qty + v_item_qty;
    if v_new_qty > 0 then
      v_new_avg_price := round(((v_current_qty * v_current_avg_price) + (v_item_qty * v_item_price)) / v_new_qty, 8);
    else
      v_new_avg_price := 0;
    end if;

    update public.portfolio_assets
    set quantity = v_new_qty,
        average_price = v_new_avg_price,
        updated_at = now()
    where id = v_item.asset_id and user_id = v_user_id;

    insert into public.portfolio_transactions (
      user_id,
      asset_id,
      type,
      date,
      quantity,
      price,
      total,
      batch_id
    ) values (
      v_user_id,
      v_item.asset_id,
      'buy',
      p_date,
      v_item_qty,
      v_item_price,
      v_item_total,
      v_batch_id
    );

    v_sum_total := v_sum_total + v_item_total;
  end loop;

  -- Abate atomicamente o saldo de Caixa utilizado (se Aporte Composto)
  if v_cash_used > 0 then
    select id, quantity into v_cash_asset
    from public.portfolio_assets
    where user_id = v_user_id
      and (lower(coalesce(asset_class, '')) = 'caixa' or upper(ticker) = 'CAIXA')
    order by updated_at desc
    limit 1
    for update;

    if found then
      if v_cash_used > coalesce(v_cash_asset.quantity, 0) + 0.01 then
        raise exception 'Saldo em caixa insuficiente para cobrir o valor selecionado.' using errcode = '22023';
      end if;

      update public.portfolio_assets
      set quantity = greatest(0, round(coalesce(quantity, 0) - v_cash_used, 2)),
          average_price = 1,
          updated_at = now()
      where id = v_cash_asset.id and user_id = v_user_id;
    else
      v_cash_used := 0;
    end if;
  end if;

  -- Registra em portfolio_contributions apenas a parcela de dinheiro novo do bolso (preserva exatidão da TIR)
  v_pocket_amount := greatest(0, round(p_total_amount - v_cash_used, 2));
  if v_pocket_amount > 0 then
    insert into public.portfolio_contributions (
      user_id,
      asset_id,
      date,
      amount,
      notes,
      batch_id
    ) values (
      v_user_id,
      null,
      p_date,
      v_pocket_amount,
      coalesce(p_notes, 'Aporte inteligente'),
      v_batch_id
    );
  end if;

  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_user_id,
    'portfolio_batch_aporte',
    v_batch_id::text,
    'execute',
    jsonb_build_object(
      'batch_id', v_batch_id,
      'items_count', jsonb_array_length(p_items),
      'total_amount', p_total_amount,
      'pocket_amount', v_pocket_amount,
      'cash_used', v_cash_used,
      'cash_asset_id', case when v_cash_asset.id is not null then v_cash_asset.id else null end,
      'snapshots', v_snapshots,
      'sum_total', v_sum_total,
      'date', p_date
    )
  );

  return true;
end;
$$;

revoke all on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric, uuid) from public;
grant execute on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric, uuid) to authenticated;

-- 4. Função RPC revert_portfolio_batch_aporte para reversão atômica (Undo)
create or replace function public.revert_portfolio_batch_aporte(
  p_batch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_audit record;
  v_snapshot jsonb;
  v_asset_id uuid;
  v_prev_qty numeric(18, 8);
  v_prev_avg_price numeric(18, 8);
  v_cash_used numeric(18, 2);
  v_cash_asset_id uuid;
  v_subsequent_count integer;
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

  if p_batch_id is null then
    raise exception 'Identificador do lote (batch_id) é obrigatório.' using errcode = '22023';
  end if;

  -- 1. Verifica se existem transações vinculadas ao lote
  perform 1
  from public.portfolio_transactions
  where batch_id = p_batch_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Lote de aporte não encontrado ou já revertido: %', p_batch_id using errcode = 'P0002';
  end if;

  -- 2. Salvaguarda de Integridade: Bloqueia reversão se houver qualquer movimentação posterior em ativos do lote
  select count(*) into v_subsequent_count
  from public.portfolio_transactions pt
  join (
    select asset_id, min(date) as min_date, min(created_at) as min_created_at
    from public.portfolio_transactions
    where batch_id = p_batch_id and user_id = v_user_id
    group by asset_id
  ) b on pt.asset_id = b.asset_id
  where pt.user_id = v_user_id
    and (pt.batch_id is null or pt.batch_id <> p_batch_id)
    and (pt.date > b.min_date or (pt.date = b.min_date and pt.created_at > b.min_created_at));

  if v_subsequent_count > 0 then
    raise exception 'Não é possível desfazer o lote: foram detectadas operações posteriores em ativos deste aporte. Gerencie as movimentações individualmente pelo extrato.' using errcode = '22023';
  end if;

  -- 3. Busca o snapshot pré-lote gravado em audit_events
  select * into v_audit
  from public.audit_events
  where user_id = v_user_id
    and entity_type = 'portfolio_batch_aporte'
    and action = 'execute'
    and entity_id = p_batch_id::text
  order by created_at desc
  limit 1;

  if v_audit.id is not null and (v_audit.payload->'snapshots') is not null then
    -- Restaura cada ativo exatamente para seu estado pré-lote
    for v_snapshot in select * from jsonb_array_elements(v_audit.payload->'snapshots')
    loop
      v_asset_id := (v_snapshot->>'asset_id')::uuid;
      v_prev_qty := (v_snapshot->>'prev_quantity')::numeric;
      v_prev_avg_price := (v_snapshot->>'prev_average_price')::numeric;

      update public.portfolio_assets
      set quantity = v_prev_qty,
          average_price = v_prev_avg_price,
          updated_at = now()
      where id = v_asset_id and user_id = v_user_id;
    end loop;

    -- Restaura saldo de Caixa se houve cash_used
    v_cash_used := coalesce((v_audit.payload->>'cash_used')::numeric, 0);
    v_cash_asset_id := (v_audit.payload->>'cash_asset_id')::uuid;

    if v_cash_used > 0 then
      if v_cash_asset_id is not null then
        update public.portfolio_assets
        set quantity = quantity + v_cash_used,
            average_price = 1,
            updated_at = now()
        where id = v_cash_asset_id and user_id = v_user_id;
      else
        update public.portfolio_assets
        set quantity = quantity + v_cash_used,
            average_price = 1,
            updated_at = now()
        where user_id = v_user_id
          and (lower(coalesce(asset_class, '')) = 'caixa' or upper(ticker) = 'CAIXA');
      end if;
    end if;
  else
    -- Fallback defensivo: subtrai as compras do lote de cada ativo
    for v_asset_id in select distinct asset_id from public.portfolio_transactions where batch_id = p_batch_id and user_id = v_user_id
    loop
      update public.portfolio_assets pa
      set quantity = greatest(0, pa.quantity - coalesce((
            select sum(pt.quantity)
            from public.portfolio_transactions pt
            where pt.batch_id = p_batch_id and pt.asset_id = v_asset_id and pt.user_id = v_user_id
          ), 0)),
          updated_at = now()
      where pa.id = v_asset_id and pa.user_id = v_user_id;
    end loop;
  end if;

  -- 4. Remove as contribuições financeiras vinculadas ao lote
  delete from public.portfolio_contributions
  where batch_id = p_batch_id and user_id = v_user_id;

  -- 5. Remove as transações de compra vinculadas ao lote
  delete from public.portfolio_transactions
  where batch_id = p_batch_id and user_id = v_user_id;

  -- 6. Registra o evento de reversão no log de auditoria
  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_user_id,
    'portfolio_batch_aporte',
    p_batch_id::text,
    'revert',
    jsonb_build_object(
      'batch_id', p_batch_id,
      'reverted_at', now()
    )
  );

  return true;
end;
$$;

revoke all on function public.revert_portfolio_batch_aporte(uuid) from public;
grant execute on function public.revert_portfolio_batch_aporte(uuid) to authenticated;
