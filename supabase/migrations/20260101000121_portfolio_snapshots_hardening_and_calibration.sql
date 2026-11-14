-- Migration: 20260101000121_portfolio_snapshots_hardening_and_calibration.sql
-- Descrição: Blindagem de integridade, isolamento total de user_id, imutabilidade pós-fechamento e calibração manual não destrutiva para snapshots mensais de patrimônio.

-- 1. Expansão da tabela portfolio_snapshots para calibração não destrutiva e auditoria
alter table public.portfolio_snapshots
  add column if not exists auto_total_value numeric(18, 2),
  add column if not exists auto_total_cost numeric(18, 2),
  add column if not exists manual_total_value numeric(18, 2),
  add column if not exists manual_total_cost numeric(18, 2),
  add column if not exists is_manually_calibrated boolean not null default false,
  add column if not exists calibrated_at timestamptz;

comment on column public.portfolio_snapshots.auto_total_value is 'Valor original consolidado pelo fechamento oficial do mercado.';
comment on column public.portfolio_snapshots.auto_total_cost is 'Custo original consolidado pelo fechamento oficial do mercado.';
comment on column public.portfolio_snapshots.manual_total_value is 'Valor calibrado manualmente pelo usuário.';
comment on column public.portfolio_snapshots.manual_total_cost is 'Custo calibrado manualmente pelo usuário.';
comment on column public.portfolio_snapshots.is_manually_calibrated is 'Indica se o snapshot foi customizado por calibração manual do usuário.';
comment on column public.portfolio_snapshots.calibrated_at is 'Data/hora da última calibração manual do snapshot.';

-- 2. Backfill inicial dos snapshots históricos existentes
update public.portfolio_snapshots
set
  auto_total_value = total_value,
  auto_total_cost = total_cost
where auto_total_value is null;

-- 3. Trigger de salvaguarda de imutabilidade e integridade pós-fechamento
create or replace function public.check_portfolio_snapshot_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 3.1 Isolamento total de usuário: impede qualquer alteração ou transferência de user_id
  if old.user_id <> new.user_id then
    raise exception 'Violação de segurança: user_id do snapshot patrimonial é imutável.'
      using errcode = '42501';
  end if;

  -- 3.2 Imutabilidade do ciclo de vida: impede rebaixar um snapshot fechado para provisório
  if old.status = 'closed' and new.status = 'provisional' then
    raise exception 'Violação de integridade: um snapshot mensal fechado não pode ser revertido para provisório.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_portfolio_snapshot_immutability on public.portfolio_snapshots;
create trigger trg_portfolio_snapshot_immutability
  before update on public.portfolio_snapshots
  for each row
  execute function public.check_portfolio_snapshot_immutability();

-- 4. RPC de Calibração Manual Não Destrutiva de Snapshot
create or replace function public.calibrate_portfolio_snapshot(
  p_month text,
  p_total_value numeric,
  p_total_cost numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing record;
  v_result record;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado ao módulo de investimentos.' using errcode = '42501';
  end if;

  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM).' using errcode = '22023';
  end if;

  if p_total_value is null or p_total_value < 0 or p_total_cost is null or p_total_cost < 0 then
    raise exception 'Valor total e custo devem ser números maiores ou iguais a zero.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.portfolio_snapshots
  where user_id = v_user_id and month = p_month;

  if v_existing.id is not null then
    update public.portfolio_snapshots
    set
      manual_total_value = p_total_value,
      manual_total_cost = p_total_cost,
      total_value = p_total_value,
      total_cost = p_total_cost,
      is_manually_calibrated = true,
      calibrated_at = now(),
      status = 'closed',
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;
  else
    insert into public.portfolio_snapshots (
      user_id,
      month,
      total_value,
      total_cost,
      auto_total_value,
      auto_total_cost,
      manual_total_value,
      manual_total_cost,
      is_manually_calibrated,
      calibrated_at,
      status,
      updated_at
    ) values (
      v_user_id,
      p_month,
      p_total_value,
      p_total_cost,
      null,
      null,
      p_total_value,
      p_total_cost,
      true,
      now(),
      'closed',
      now()
    )
    returning * into v_result;
  end if;

  return json_build_object(
    'success', true,
    'snapshot', row_to_json(v_result)
  );
end;
$$;

-- 5. RPC de Restauração / Reset de Calibração Manual (Reversão Não Destrutiva ao Fechamento)
create or replace function public.reset_manual_snapshot_calibration(
  p_month text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing record;
  v_result record;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado ao módulo de investimentos.' using errcode = '42501';
  end if;

  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM).' using errcode = '22023';
  end if;

  select * into v_existing
  from public.portfolio_snapshots
  where user_id = v_user_id and month = p_month;

  if v_existing.id is null then
    return json_build_object(
      'success', false,
      'message', 'Snapshot não encontrado para a competência informada.'
    );
  end if;

  -- Se possui valor original gravado pelo fechamento oficial, restaura e limpa a calibração manual
  if v_existing.auto_total_value is not null then
    update public.portfolio_snapshots
    set
      total_value = v_existing.auto_total_value,
      total_cost = coalesce(v_existing.auto_total_cost, 0),
      manual_total_value = null,
      manual_total_cost = null,
      is_manually_calibrated = false,
      calibrated_at = null,
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;

    return json_build_object(
      'success', true,
      'action', 'restored_to_auto',
      'snapshot', row_to_json(v_result)
    );
  else
    -- Se foi criado exclusivamente manual sem fechamento automático prévio, remove o registro
    delete from public.portfolio_snapshots
    where id = v_existing.id;

    return json_build_object(
      'success', true,
      'action', 'deleted'
    );
  end if;
end;
$$;

-- 6. Atualização do RPC Atômico de Fechamento Mensal para Suportar Auto Values e Respeitar Calibrações
create or replace function public.commit_monthly_closing_atomic(
  p_month text,
  p_closing_date date,
  p_prices jsonb,
  p_total_value numeric,
  p_total_cost numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_ticker text;
  v_price numeric(18, 8);
  v_currency text;
  v_source text;
  v_prices_count integer := 0;
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado ao módulo de investimentos.' using errcode = '42501';
  end if;

  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM).' using errcode = '22023';
  end if;

  if p_total_value is null or p_total_value < 0 or p_total_cost is null or p_total_cost < 0 then
    raise exception 'Total e custo devem ser maiores ou iguais a zero.' using errcode = '22023';
  end if;

  -- Grava cotações mensais
  if p_prices is not null and jsonb_typeof(p_prices) = 'array' then
    for v_item in select * from jsonb_array_elements(p_prices)
    loop
      v_ticker := trim(upper(coalesce(v_item->>'ticker', '')));
      v_price := (v_item->>'price')::numeric;
      v_currency := upper(trim(coalesce(v_item->>'currency', 'BRL')));
      v_source := lower(trim(coalesce(v_item->>'source', 'api')));

      if v_ticker = '' then
        raise exception 'Ticker não informado em item de cotação.' using errcode = '22023';
      end if;

      if v_price is null or v_price <= 0 then
        raise exception 'Cotação inválida para o ativo %: %', v_ticker, v_price using errcode = '22023';
      end if;

      if v_currency not in ('BRL', 'USD') then
        v_currency := 'BRL';
      end if;

      if v_source not in ('api', 'manual', 'fallback') then
        v_source := 'api';
      end if;

      insert into public.portfolio_monthly_prices (
        user_id,
        ticker,
        month,
        price,
        currency,
        source,
        updated_at
      ) values (
        v_user_id,
        v_ticker,
        p_month,
        v_price,
        v_currency,
        v_source,
        now()
      )
      on conflict (user_id, ticker, month)
      do update set
        price = excluded.price,
        currency = excluded.currency,
        source = excluded.source,
        updated_at = now();

      v_prices_count := v_prices_count + 1;
    end loop;
  end if;

  -- Busca se já existe snapshot para a competência
  select * into v_existing
  from public.portfolio_snapshots
  where user_id = v_user_id and month = p_month;

  if v_existing.id is not null then
    update public.portfolio_snapshots
    set
      auto_total_value = p_total_value,
      auto_total_cost = p_total_cost,
      -- Preserva valor manual caso o usuário tenha calibrado este mês
      total_value = case when v_existing.is_manually_calibrated then v_existing.manual_total_value else p_total_value end,
      total_cost = case when v_existing.is_manually_calibrated then v_existing.manual_total_cost else p_total_cost end,
      status = 'closed',
      closing_date = coalesce(p_closing_date, v_existing.closing_date),
      closed_at = now(),
      updated_at = now()
    where id = v_existing.id;
  else
    insert into public.portfolio_snapshots (
      user_id,
      month,
      total_value,
      total_cost,
      auto_total_value,
      auto_total_cost,
      is_manually_calibrated,
      status,
      closing_date,
      closed_at,
      updated_at
    ) values (
      v_user_id,
      p_month,
      p_total_value,
      p_total_cost,
      p_total_value,
      p_total_cost,
      false,
      'closed',
      p_closing_date,
      now(),
      now()
    );
  end if;

  return json_build_object(
    'success', true,
    'month', p_month,
    'total_value', p_total_value,
    'total_cost', p_total_cost,
    'prices_count', v_prices_count
  );
end;
$$;

-- 7. Permissões de Execução
revoke all on function public.calibrate_portfolio_snapshot(text, numeric, numeric) from public;
grant execute on function public.calibrate_portfolio_snapshot(text, numeric, numeric) to authenticated;

revoke all on function public.reset_manual_snapshot_calibration(text) from public;
grant execute on function public.reset_manual_snapshot_calibration(text) to authenticated;
