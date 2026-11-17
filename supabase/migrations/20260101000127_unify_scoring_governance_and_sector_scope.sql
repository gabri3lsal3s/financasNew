-- ==============================================================================
-- Migração 20260101000127: Unificação da Governança por Notas, Escopo Setorial
-- por Classe, Aporte Composto, Exclusão Atômica e Backup/Restore Integral
-- (Plano 42 / v3.10.0)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Escopo por Classe em public.sector_targets (evita colisões entre classes)
-- ------------------------------------------------------------------------------
alter table public.sector_targets
  add column if not exists class_name text not null default 'Ações';

-- Infere class_name a partir dos ativos já cadastrados do usuário quando possível
update public.sector_targets st
set class_name = coalesce(
  (
    select coalesce(nullif(trim(pa.asset_class), ''), 'Ações')
    from public.portfolio_assets pa
    where pa.user_id = st.user_id
      and lower(trim(coalesce(pa.sector, ''))) = lower(trim(st.name))
    order by pa.ticker
    limit 1
  ),
  'Ações'
)
where st.class_name = 'Ações';

alter table public.sector_targets
  drop constraint if exists sector_targets_user_id_group_type_name_key,
  drop constraint if exists sector_targets_user_id_name_key,
  drop constraint if exists sector_targets_user_class_name_key;

alter table public.sector_targets
  add constraint sector_targets_user_class_name_key unique (user_id, class_name, name);

create index if not exists idx_sector_targets_user_class
  on public.sector_targets (user_id, class_name);

-- ------------------------------------------------------------------------------
-- 2. Conversão Não-Destrutiva do Legado allocation_targets -> class_targets + score
-- ------------------------------------------------------------------------------
do $$
declare
  v_has_alloc_table boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'allocation_targets'
  ) into v_has_alloc_table;

  if v_has_alloc_table then
    -- 2.1 Deriva class_targets para usuários que tinham metas por ativo e ainda não configuraram classes
    with user_class_sums as (
      select
        at.user_id,
        coalesce(nullif(trim(pa.asset_class), ''), 'Ações') as class_name,
        sum(at.target_percentage) as raw_pct
      from public.allocation_targets at
      join public.portfolio_assets pa on pa.id = at.asset_id
      where at.target_percentage > 0
        and lower(coalesce(pa.asset_class, '')) <> 'caixa'
        and upper(pa.ticker) <> 'CAIXA'
        and not exists (
          select 1 from public.class_targets ct where ct.user_id = at.user_id
        )
      group by at.user_id, coalesce(nullif(trim(pa.asset_class), ''), 'Ações')
    ),
    user_totals as (
      select user_id, sum(raw_pct) as total_pct
      from user_class_sums
      group by user_id
      having sum(raw_pct) > 0
    )
    insert into public.class_targets (user_id, group_type, name, target_percentage)
    select
      ucs.user_id,
      'class',
      ucs.class_name,
      least(100, round((ucs.raw_pct / ut.total_pct) * 100, 2))
    from user_class_sums ucs
    join user_totals ut on ut.user_id = ucs.user_id
    on conflict (user_id, group_type, name) do nothing;

    -- 2.2 Converte target_percentage dos ativos sem nota em score (1..10) ou status neutral
    with group_max as (
      select
        at.user_id,
        coalesce(nullif(trim(pa.asset_class), ''), 'Ações') as class_name,
        coalesce(nullif(trim(pa.sector), ''), 'Geral') as sector_name,
        max(at.target_percentage) as max_pct
      from public.allocation_targets at
      join public.portfolio_assets pa on pa.id = at.asset_id
      group by
        at.user_id,
        coalesce(nullif(trim(pa.asset_class), ''), 'Ações'),
        coalesce(nullif(trim(pa.sector), ''), 'Geral')
    )
    update public.portfolio_assets pa
    set
      score = case
        when at.target_percentage <= 0 then 5
        when gm.max_pct > 0 then greatest(1, least(10, round((at.target_percentage / gm.max_pct) * 10)))::smallint
        else 5
      end,
      allocation_status = case
        when at.target_percentage <= 0 and pa.allocation_status = 'active' then 'neutral'
        else pa.allocation_status
      end,
      last_reviewed_at = coalesce(pa.last_reviewed_at, now())
    from public.allocation_targets at
    join group_max gm
      on gm.user_id = at.user_id
    where at.asset_id = pa.id
      and pa.score is null
      and lower(coalesce(pa.asset_class, '')) <> 'caixa'
      and upper(pa.ticker) <> 'CAIXA'
      and gm.class_name = coalesce(nullif(trim(pa.asset_class), ''), 'Ações')
      and gm.sector_name = coalesce(nullif(trim(pa.sector), ''), 'Geral');
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 3. Saneamento de last_reviewed_at em ativos nunca avaliados (corrige migração 125)
-- ------------------------------------------------------------------------------
update public.portfolio_assets
set last_reviewed_at = null
where score is null
  and thesis_summary is null
  and (score_criteria is null or score_criteria = '{}'::jsonb);

alter table public.portfolio_assets
  alter column last_reviewed_at drop default;

-- ------------------------------------------------------------------------------
-- 4. Descomissionamento Limpo de allocation_targets (mantém políticas no histórico)
-- ------------------------------------------------------------------------------
drop function if exists public.set_allocation_targets(jsonb);
drop trigger if exists trg_allocation_targets_check on public.allocation_targets;
drop function if exists public.check_allocation_total();
drop function if exists public.check_allocation_targets_sum();
drop table if exists public.allocation_targets cascade;

-- ------------------------------------------------------------------------------
-- 5. RPCs de Metas Hierárquicas (Classe -> Setor opcional por Classe)
-- ------------------------------------------------------------------------------
drop function if exists public.set_group_target(text, text, numeric);
drop function if exists public.set_group_target(text, text, numeric, text);

create or replace function public.set_group_target(
  p_group_type text,
  p_name text,
  p_target numeric,
  p_class_name text default 'Ações'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_clean_name text := trim(coalesce(p_name, ''));
  v_clean_class text := coalesce(nullif(trim(coalesce(p_class_name, '')), ''), 'Ações');
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.' using errcode = '42501';
  end if;

  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido.' using errcode = '22023';
  end if;

  if v_clean_name = '' then
    raise exception 'Nome do grupo é obrigatório.' using errcode = '22023';
  end if;

  if p_target is null or p_target < 0 or p_target > 100 then
    raise exception 'Percentual de meta inválido (deve estar entre 0 e 100).' using errcode = '22023';
  end if;

  if p_group_type = 'class' then
    if lower(v_clean_name) = 'caixa' then
      raise exception 'Caixa não participa das metas percentuais de alocação.' using errcode = '22023';
    end if;

    insert into public.class_targets (user_id, group_type, name, target_percentage)
    values (v_user, 'class', v_clean_name, round(p_target, 2))
    on conflict (user_id, group_type, name)
    do update set target_percentage = excluded.target_percentage;
  else
    insert into public.sector_targets (user_id, group_type, class_name, name, target_percentage)
    values (v_user, 'sector', v_clean_class, v_clean_name, round(p_target, 2))
    on conflict (user_id, class_name, name)
    do update set target_percentage = excluded.target_percentage;
  end if;
end;
$$;

revoke all on function public.set_group_target(text, text, numeric, text) from public;
grant execute on function public.set_group_target(text, text, numeric, text) to authenticated;

drop function if exists public.remove_group_target(text, text);
drop function if exists public.remove_group_target(text, text, text);

create or replace function public.remove_group_target(
  p_group_type text,
  p_name text,
  p_class_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_clean_name text := trim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.' using errcode = '42501';
  end if;

  if p_group_type not in ('class', 'sector') then
    raise exception 'Tipo de grupo inválido.' using errcode = '22023';
  end if;

  if p_group_type = 'class' then
    delete from public.class_targets
    where user_id = v_user and name = v_clean_name;
  else
    if p_class_name is not null and trim(p_class_name) <> '' then
      delete from public.sector_targets
      where user_id = v_user
        and class_name = trim(p_class_name)
        and name = v_clean_name;
    else
      delete from public.sector_targets
      where user_id = v_user and name = v_clean_name;
    end if;
  end if;
end;
$$;

revoke all on function public.remove_group_target(text, text, text) from public;
grant execute on function public.remove_group_target(text, text, text) to authenticated;

create or replace function public.save_portfolio_hierarchy_targets(
  p_classes jsonb,
  p_sectors jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_class_sum numeric := 0;
  v_sector_overflow record;
  v_item jsonb;
  v_name text;
  v_class_name text;
  v_pct numeric;
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo investments.' using errcode = '42501';
  end if;

  if p_classes is null or jsonb_typeof(p_classes) <> 'array' then
    raise exception 'Lista de metas por classe inválida.' using errcode = '22023';
  end if;

  if p_sectors is null or jsonb_typeof(p_sectors) <> 'array' then
    raise exception 'Lista de metas por setor inválida.' using errcode = '22023';
  end if;

  -- Validação de classes (exclui Caixa e exige soma <= 100%)
  for v_item in select * from jsonb_array_elements(p_classes)
  loop
    v_name := trim(coalesce(v_item->>'name', ''));
    v_pct := round(coalesce((v_item->>'target_percentage')::numeric, 0), 2);
    if v_name = '' or lower(v_name) = 'caixa' then
      continue;
    end if;
    if v_pct < 0 or v_pct > 100 then
      raise exception 'Percentual inválido para a classe %: %', v_name, v_pct using errcode = '22023';
    end if;
    v_class_sum := v_class_sum + v_pct;
  end loop;

  if v_class_sum > 100.01 then
    raise exception 'A soma das metas de classes (% %%) excede 100%%.', round(v_class_sum, 2) using errcode = '22023';
  end if;

  -- Validação de setores por classe (cada classe deve somar <= 100%)
  for v_item in select * from jsonb_array_elements(p_sectors)
  loop
    v_class_name := coalesce(nullif(trim(coalesce(v_item->>'class_name', '')), ''), 'Ações');
    v_name := trim(coalesce(v_item->>'name', ''));
    v_pct := round(coalesce((v_item->>'target_percentage')::numeric, 0), 2);
    if v_name = '' then
      continue;
    end if;
    if v_pct < 0 or v_pct > 100 then
      raise exception 'Percentual inválido para o setor % (%): %', v_name, v_class_name, v_pct using errcode = '22023';
    end if;
  end loop;

  select s.cls, sum(s.pct) as total_pct
  into v_sector_overflow
  from (
    select
      coalesce(nullif(trim(coalesce(item->>'class_name', '')), ''), 'Ações') as cls,
      round(coalesce((item->>'target_percentage')::numeric, 0), 2) as pct
    from jsonb_array_elements(p_sectors) as item
    where trim(coalesce(item->>'name', '')) <> ''
  ) s
  group by s.cls
  having sum(s.pct) > 100.01
  limit 1;

  if found then
    raise exception 'A soma dos setores da classe % excede 100%%.', v_sector_overflow.cls using errcode = '22023';
  end if;

  -- Substituição atômica
  delete from public.class_targets where user_id = v_user;
  insert into public.class_targets (user_id, group_type, name, target_percentage)
  select
    v_user,
    'class',
    trim(item->>'name'),
    round(coalesce((item->>'target_percentage')::numeric, 0), 2)
  from jsonb_array_elements(p_classes) as item
  where trim(coalesce(item->>'name', '')) <> ''
    and lower(trim(item->>'name')) <> 'caixa'
    and round(coalesce((item->>'target_percentage')::numeric, 0), 2) > 0;

  delete from public.sector_targets where user_id = v_user;
  insert into public.sector_targets (user_id, group_type, class_name, name, target_percentage)
  select
    v_user,
    'sector',
    coalesce(nullif(trim(coalesce(item->>'class_name', '')), ''), 'Ações'),
    trim(item->>'name'),
    round(coalesce((item->>'target_percentage')::numeric, 0), 2)
  from jsonb_array_elements(p_sectors) as item
  where trim(coalesce(item->>'name', '')) <> ''
    and round(coalesce((item->>'target_percentage')::numeric, 0), 2) > 0;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user,
    'portfolio_hierarchy_targets',
    v_user::text,
    'save_batch',
    jsonb_build_object(
      'classes_count', jsonb_array_length(p_classes),
      'sectors_count', jsonb_array_length(p_sectors)
    )
  );

  return true;
end;
$$;

revoke all on function public.save_portfolio_hierarchy_targets(jsonb, jsonb) from public;
grant execute on function public.save_portfolio_hierarchy_targets(jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Aporte em Lote Composto (Dinheiro Novo + Abatimento Atômico de Caixa)
-- ------------------------------------------------------------------------------
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text);
drop function if exists public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric);

create or replace function public.execute_portfolio_batch_aporte(
  p_items jsonb,
  p_date date,
  p_total_amount numeric,
  p_notes text default null,
  p_cash_used numeric default 0
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
      notes
    ) values (
      v_user_id,
      null,
      p_date,
      v_pocket_amount,
      coalesce(p_notes, 'Aporte inteligente')
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
    p_date::text,
    'execute',
    jsonb_build_object(
      'items_count', jsonb_array_length(p_items),
      'total_amount', p_total_amount,
      'pocket_amount', v_pocket_amount,
      'cash_used', v_cash_used,
      'sum_total', v_sum_total
    )
  );

  return true;
end;
$$;

revoke all on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric) from public;
grant execute on function public.execute_portfolio_batch_aporte(jsonb, date, numeric, text, numeric) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. Exclusão Atômica de Transação da Carteira (com estorno de caixa e custódia)
-- ------------------------------------------------------------------------------
create or replace function public.delete_portfolio_transaction_atomic(
  p_transaction_id uuid,
  p_reverse_cash boolean default false,
  p_usd_rate numeric default 5.25,
  p_reconciled_quantity numeric default null,
  p_reconciled_avg_price numeric default null,
  p_reconciled_fi_metadata jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tx record;
  v_asset record;
  v_cash_asset record;
  v_deleted_contrib_id uuid;
  v_rate numeric := case when coalesce(p_usd_rate, 0) > 0 then p_usd_rate else 5.25 end;
  v_total_brl numeric(18, 2);
  v_next_qty numeric(18, 8);
  v_next_avg numeric(18, 8);
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

  select * into v_tx
  from public.portfolio_transactions
  where id = p_transaction_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Movimentação não encontrada ou não pertence ao usuário.' using errcode = 'P0002';
  end if;

  select * into v_asset
  from public.portfolio_assets
  where id = v_tx.asset_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Ativo vinculado não encontrado.' using errcode = 'P0002';
  end if;

  if p_reconciled_quantity is not null and p_reconciled_quantity < 0 then
    raise exception 'Quantidade reconciliada não pode ser negativa.' using errcode = '22023';
  end if;

  if p_reconciled_avg_price is not null and p_reconciled_avg_price < 0 then
    raise exception 'Preço médio reconciliado não pode ser negativo.' using errcode = '22023';
  end if;

  -- Remove a transação
  delete from public.portfolio_transactions
  where id = v_tx.id and user_id = v_user_id;

  -- Remove provento ou aporte vinculado quando aplicável
  if v_tx.type in ('dividend', 'jcp', 'fii_yield') then
    delete from public.portfolio_dividends
    where id in (
      select id from public.portfolio_dividends
      where user_id = v_user_id
        and asset_id = v_tx.asset_id
        and date = v_tx.date
        and abs(amount - v_tx.total) <= 0.05
      limit 1
    );
  elsif v_tx.type = 'buy' then
    delete from public.portfolio_contributions
    where id in (
      select id from public.portfolio_contributions
      where user_id = v_user_id
        and asset_id = v_tx.asset_id
        and date = v_tx.date
      order by abs(amount - v_tx.total) asc
      limit 1
    )
    returning id into v_deleted_contrib_id;
  end if;

  -- Atualiza custódia do ativo
  if p_reconciled_quantity is not null then
    v_next_qty := p_reconciled_quantity;
    v_next_avg := coalesce(p_reconciled_avg_price, v_asset.average_price);
  elsif v_tx.type = 'sell' then
    v_next_qty := coalesce(v_asset.quantity, 0) + coalesce(v_tx.quantity, 0);
    v_next_avg := v_asset.average_price;
  elsif v_tx.type in ('buy', 'subscription') then
    v_next_qty := greatest(0, coalesce(v_asset.quantity, 0) - coalesce(v_tx.quantity, 0));
    v_next_avg := case when v_next_qty > 0 then v_asset.average_price else 0 end;
  else
    v_next_qty := v_asset.quantity;
    v_next_avg := v_asset.average_price;
  end if;

  update public.portfolio_assets
  set
    quantity = v_next_qty,
    average_price = v_next_avg,
    fixed_income_metadata = case
      when p_reconciled_fi_metadata is not null then p_reconciled_fi_metadata
      else fixed_income_metadata
    end,
    updated_at = now()
  where id = v_asset.id and user_id = v_user_id;

  -- Estorno opcional do Caixa da corretora
  if p_reverse_cash and v_tx.total > 0 then
    v_total_brl := round(v_tx.total * (case when v_asset.currency = 'USD' then v_rate else 1 end), 2);
    if v_total_brl > 0 then
      select id, quantity into v_cash_asset
      from public.portfolio_assets
      where user_id = v_user_id
        and (lower(coalesce(asset_class, '')) = 'caixa' or upper(ticker) = 'CAIXA')
      order by updated_at desc
      limit 1
      for update;

      if found then
        if v_tx.type = 'buy' and v_deleted_contrib_id is null then
          update public.portfolio_assets
          set quantity = round(coalesce(quantity, 0) + v_total_brl, 2),
              average_price = 1,
              updated_at = now()
          where id = v_cash_asset.id and user_id = v_user_id;
        elsif v_tx.type = 'sell' then
          update public.portfolio_assets
          set quantity = greatest(0, round(coalesce(quantity, 0) - v_total_brl, 2)),
              average_price = 1,
              updated_at = now()
          where id = v_cash_asset.id and user_id = v_user_id;
        end if;
      end if;
    end if;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'portfolio_transaction',
    p_transaction_id::text,
    'delete_atomic',
    jsonb_build_object(
      'asset_id', v_tx.asset_id,
      'type', v_tx.type,
      'total', v_tx.total,
      'reverse_cash', p_reverse_cash
    )
  );

  return true;
end;
$$;

revoke all on function public.delete_portfolio_transaction_atomic(uuid, boolean, numeric, numeric, numeric, jsonb) from public;
grant execute on function public.delete_portfolio_transaction_atomic(uuid, boolean, numeric, numeric, numeric, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 8. RPC restore_backup Completo (preserva notas, teses, quarentena e metas)
-- ------------------------------------------------------------------------------
create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' using errcode = '42501';
  end if;

  if not public.can_current_user_write() then
    raise exception 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.' using errcode = '42501';
  end if;

  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'Backup inválido: campo "data" ausente ou malformado.' using errcode = '22023';
  end if;

  -- 1) Apaga os dados atuais do usuário (ordem segura de dependências FK)
  delete from public.portfolio_transactions pt
    using public.portfolio_assets a
    where pt.asset_id = a.id and a.user_id = v_uid;
  delete from public.portfolio_dividends where user_id = v_uid;
  delete from public.portfolio_contributions where user_id = v_uid;
  delete from public.portfolio_snapshots where user_id = v_uid;
  delete from public.class_targets where user_id = v_uid;
  delete from public.sector_targets where user_id = v_uid;
  delete from public.cash_checkpoints where user_id = v_uid;
  delete from public.card_competence_overrides o
    using public.credit_cards c
    where o.card_id = c.id and c.user_id = v_uid;
  delete from public.card_payments cp
    using public.credit_cards c
    where cp.card_id = c.id and c.user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.asset_prices where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- 2) Insere tabelas pais
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary
  )
  select
    pa.id,
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    coalesce(pa.accumulated_dividends, 0),
    coalesce(pa.estimated_monthly_dividend_per_share, 0),
    pa.fixed_income_metadata,
    case when f.id is not null and public.is_family_member(f.id, v_uid) then coalesce(pa.is_family, false) else false end,
    case when f.id is not null and public.is_family_member(f.id, v_uid) then pa.family_id else null end,
    coalesce(nullif(pa.family_share_mode, ''), 'full'),
    coalesce(pa.family_share_percentage, 100),
    pa.notes,
    pa.score,
    coalesce(nullif(pa.allocation_status, ''), 'active'),
    coalesce(pa.score_criteria, '{}'::jsonb),
    pa.last_reviewed_at,
    coalesce(pa.review_frequency_months, 6),
    pa.thesis_summary
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  left join public.families f on f.id = pa.family_id;

  insert into public.user_preferences (
    user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill,
    report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings, app_mode
  )
  select
    v_uid,
    coalesce(nullif(theme, ''), 'system'),
    coalesce(reminders_enabled, true),
    coalesce(reminder_days_before_debt, 3),
    coalesce(reminder_days_before_bill, 3),
    coalesce(report_weights_enabled, false),
    coalesce(max_sector_acoes, 25),
    coalesce(max_sector_fiis, 25),
    coalesce(custom_settings, '{}'::jsonb),
    coalesce(nullif(app_mode, ''), 'investor')
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select o.id, o.card_id, o.month, o.closing_day, o.due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  join public.credit_cards c on c.id = o.card_id
  where c.user_id = v_uid;

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories cat on cat.id = i.category_id
  where cat.user_id = v_uid;

  insert into public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  select e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id, e.installments_total, e.installment_number, e.installment_group_id, e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  where cat.user_id = v_uid and (e.card_id is null or cc.user_id = v_uid);

  insert into public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  select d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, d.expense_id, d.installment_group_id, d.created_at
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d;

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  select cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  join public.credit_cards cc on cc.id = cp.card_id
  where cc.user_id = v_uid;

  insert into public.budgets (id, user_id, category_id, month, "limit")
  select b.id, v_uid, b.category_id, b.month, b."limit"
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  join public.categories cat on cat.id = b.category_id
  where cat.user_id = v_uid;

  insert into public.income_goals (id, user_id, category_id, month, expected)
  select ig.id, v_uid, ig.category_id, ig.month, ig.expected
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  join public.categories cat on cat.id = ig.category_id
  where cat.user_id = v_uid;

  insert into public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  select id, v_uid, occurrence_key, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  select id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  select pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  join public.portfolio_assets pa on pa.id = pt.asset_id
  where pa.user_id = v_uid;

  insert into public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  select
    ps.id,
    v_uid,
    ps.month,
    ps.total_value,
    ps.total_cost,
    ps.auto_total_value,
    ps.auto_total_cost,
    ps.manual_total_value,
    ps.manual_total_cost,
    coalesce(ps.is_manually_calibrated, false),
    ps.calibrated_at,
    coalesce(nullif(ps.status, ''), 'closed'),
    ps.closing_date,
    ps.closed_at,
    coalesce(ps.created_at, now()),
    coalesce(ps.updated_at, now())
  from jsonb_populate_recordset(null::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps;

  insert into public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, created_at)
  select
    pc.id,
    v_uid,
    case when pa.id is not null then pc.asset_id else null end,
    pc.date,
    pc.amount,
    pc.notes,
    coalesce(pc.created_at, now())
  from jsonb_populate_recordset(null::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  left join public.portfolio_assets pa on pa.id = pc.asset_id and pa.user_id = v_uid;

  insert into public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, created_at)
  select
    pd.id,
    v_uid,
    case when pa.id is not null then pd.asset_id else null end,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    coalesce(pd.created_at, now())
  from jsonb_populate_recordset(null::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  left join public.portfolio_assets pa on pa.id = pd.asset_id and pa.user_id = v_uid;

  insert into public.class_targets (id, user_id, group_type, name, target_percentage)
  select id, v_uid, coalesce(nullif(group_type, ''), 'class'), name, target_percentage
  from jsonb_populate_recordset(null::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb))
  where lower(trim(coalesce(name, ''))) <> 'caixa';

  insert into public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  select
    id,
    v_uid,
    coalesce(nullif(group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(class_name, '')), ''), 'Ações'),
    name,
    target_percentage
  from jsonb_populate_recordset(null::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  insert into public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, updated_at)
  select
    ap.id,
    v_uid,
    ap.ticker,
    ap.price,
    coalesce(nullif(ap.currency, ''), 'BRL'),
    coalesce(nullif(ap.source, ''), 'manual'),
    ap.manual_price,
    coalesce(ap.updated_at, now())
  from jsonb_populate_recordset(null::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  where ap.user_id = v_uid
  on conflict (ticker, user_id) do update
  set price = excluded.price,
      currency = excluded.currency,
      source = excluded.source,
      manual_price = excluded.manual_price,
      updated_at = excluded.updated_at;

  insert into public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at)
  select
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now())
  from jsonb_populate_recordset(null::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  select jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'class_targets', (select count(*) from public.class_targets where user_id = v_uid),
    'sector_targets', (select count(*) from public.sector_targets where user_id = v_uid)
  ) into v_counts;

  return jsonb_build_object('success', true, 'counts', v_counts);
end;
$$;

revoke all on function public.restore_backup(jsonb) from public;
grant execute on function public.restore_backup(jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 9. Notifica o PostgREST para recarga de schema imediata
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
