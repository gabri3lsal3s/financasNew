-- Migration: 20260101000087_portfolio_monthly_closing_and_corporate_dividends.sql
-- Descrição: Infraestrutura para fechamento mensal autônomo, proventos corporativos B3 e aprovação atômica em lote com UPSERT de Caixa.

-- 1. Expansão da tabela portfolio_snapshots para auditoria e status de fechamento
alter table public.portfolio_snapshots
  add column if not exists status text not null default 'closed' check (status in ('provisional', 'closed')),
  add column if not exists closing_date date,
  add column if not exists closed_at timestamptz;

comment on column public.portfolio_snapshots.status is 'Status do snapshot: provisional (em aberto/estimado) ou closed (fechamento oficial consolidado).';
comment on column public.portfolio_snapshots.closing_date is 'Data efetiva do último dia útil do mercado no fechamento mensal.';
comment on column public.portfolio_snapshots.closed_at is 'Data/hora exata do processamento do fechamento.';

-- 2. Tabela global de Proventos Corporativos (B3 e internacionais)
create table if not exists public.corporate_dividends (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  type text not null check (type in ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS')),
  com_date date not null,
  payment_date date not null,
  rate numeric(16, 8) not null check (rate >= 0),
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  net_rate numeric(16, 8) not null check (net_rate >= 0),
  created_at timestamptz not null default now(),
  constraint uq_corporate_dividends unique (ticker, com_date, type, payment_date)
);

-- RLS hermético: Leitura pública autenticada, escrita restrita ao service_role
alter table public.corporate_dividends enable row level security;

drop policy if exists "corporate_dividends_select" on public.corporate_dividends;
create policy "corporate_dividends_select" on public.corporate_dividends
  for select to authenticated using (
    (select auth.uid()) is not null
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

create index if not exists idx_corporate_dividends_ticker_com
  on public.corporate_dividends (ticker, com_date desc);

create index if not exists idx_corporate_dividends_payment
  on public.corporate_dividends (payment_date desc);

-- 3. Tabela de Dispensas de Proventos do Usuário
create table if not exists public.portfolio_dividend_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  corporate_dividend_id uuid not null references public.corporate_dividends (id) on delete cascade,
  reason text not null check (reason in ('already_received', 'not_applicable', 'manual_ignore')),
  dismissed_at timestamptz not null default now(),
  constraint uq_portfolio_dividend_dismissals unique (user_id, corporate_dividend_id)
);

alter table public.portfolio_dividend_dismissals enable row level security;

drop policy if exists "portfolio_dividend_dismissals_select_own" on public.portfolio_dividend_dismissals;
create policy "portfolio_dividend_dismissals_select_own" on public.portfolio_dividend_dismissals
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_dividend_dismissals_write_own" on public.portfolio_dividend_dismissals;
create policy "portfolio_dividend_dismissals_write_own" on public.portfolio_dividend_dismissals
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

create index if not exists idx_portfolio_dividend_dismissals_user
  on public.portfolio_dividend_dismissals (user_id, corporate_dividend_id);

-- 4. RPC Atômico de Fechamento Mensal (Cotações + Snapshot)
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

  -- Grava o snapshot consolidado com status 'closed'
  insert into public.portfolio_snapshots (
    user_id,
    month,
    total_value,
    total_cost,
    status,
    closing_date,
    closed_at,
    updated_at
  ) values (
    v_user_id,
    p_month,
    p_total_value,
    p_total_cost,
    'closed',
    p_closing_date,
    now(),
    now()
  )
  on conflict (user_id, month)
  do update set
    total_value = excluded.total_value,
    total_cost = excluded.total_cost,
    status = 'closed',
    closing_date = coalesce(excluded.closing_date, portfolio_snapshots.closing_date),
    closed_at = now(),
    updated_at = now();

  return json_build_object(
    'success', true,
    'month', p_month,
    'total_value', p_total_value,
    'total_cost', p_total_cost,
    'prices_count', v_prices_count
  );
end;
$$;

-- 5. RPC Atômico de Aprovação em Lote com Salvaguarda de Caixa (UPSERT)
create or replace function public.approve_dividends_batch_atomic(
  p_dividends jsonb,
  p_sync_cash boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_asset_id uuid;
  v_ticker text;
  v_date date;
  v_amount numeric(12, 2);
  v_notes text;
  v_corp_div_id uuid;
  v_total_cash numeric(12, 2) := 0;
  v_inserted_count integer := 0;
  v_cash_asset_id uuid;
  v_inserted_ids uuid[] := array[]::uuid[];
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado ao módulo de investimentos.' using errcode = '42501';
  end if;

  if p_dividends is null or jsonb_typeof(p_dividends) <> 'array' or jsonb_array_length(p_dividends) = 0 then
    raise exception 'Nenhum provento informado para aprovação.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_dividends)
  loop
    v_ticker := trim(upper(coalesce(v_item->>'ticker', '')));
    v_date := (v_item->>'date')::date;
    v_amount := (v_item->>'amount')::numeric;
    v_notes := v_item->>'notes';

    if v_item->>'corporate_dividend_id' is not null and trim(v_item->>'corporate_dividend_id') <> '' then
      v_corp_div_id := (v_item->>'corporate_dividend_id')::uuid;
    else
      v_corp_div_id := null;
    end if;

    if v_item->>'asset_id' is not null and trim(v_item->>'asset_id') <> '' then
      v_asset_id := (v_item->>'asset_id')::uuid;
    else
      v_asset_id := null;
    end if;

    if v_amount is null or v_amount <= 0 then
      raise exception 'Valor de provento inválido: %', v_amount using errcode = '22023';
    end if;

    if v_date is null or v_date < date '2026-01-01' then
      raise exception 'Data de provento inválida: %', v_date using errcode = '22023';
    end if;

    -- Se asset_id não foi informado diretamente, localiza o ativo pelo ticker do usuário
    if v_asset_id is null and v_ticker <> '' then
      select id into v_asset_id
      from public.portfolio_assets
      where user_id = v_user_id and upper(ticker) = v_ticker;
    end if;

    if v_asset_id is null then
      raise exception 'Ativo não encontrado para o provento com ticker %.', v_ticker using errcode = 'P0002';
    end if;

    -- Insere o provento em portfolio_dividends
    insert into public.portfolio_dividends (
      user_id,
      asset_id,
      date,
      amount,
      notes,
      sync_cash,
      cash_amount
    ) values (
      v_user_id,
      v_asset_id,
      v_date,
      v_amount,
      v_notes,
      coalesce(p_sync_cash, false),
      case when coalesce(p_sync_cash, false) then v_amount else null end
    )
    returning id into v_new_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash := v_total_cash + v_amount;

    -- Se associado a evento corporativo, registra dispensa para evitar re-sugestão
    if v_corp_div_id is not null then
      insert into public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) values (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      on conflict (user_id, corporate_dividend_id) do nothing;
    end if;
  end loop;

  -- Se p_sync_cash = true, garante a existência do ativo CAIXA (UPSERT)
  if coalesce(p_sync_cash, false) and v_total_cash > 0 then
    select id into v_cash_asset_id
    from public.portfolio_assets
    where user_id = v_user_id and upper(ticker) = 'CAIXA';

    if v_cash_asset_id is null then
      insert into public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) values (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      returning id into v_cash_asset_id;
    else
      update public.portfolio_assets
      set quantity = quantity + v_total_cash,
          updated_at = now()
      where id = v_cash_asset_id;
    end if;
  end if;

  return json_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids
  );
end;
$$;

-- 6. Recarga do schema cache
notify pgrst, 'reload schema';
