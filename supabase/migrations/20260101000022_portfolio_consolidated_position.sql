-- ----------------------------------------------------------------
-- Migração 20260101000022: Posição Consolidada e Snapshots de Investimentos
-- ----------------------------------------------------------------

-- 1. Extensão de portfolio_assets com campos de posição direta
alter table public.portfolio_assets
  add column if not exists quantity numeric(18, 8) not null default 0 check (quantity >= 0),
  add column if not exists average_price numeric(18, 8) not null default 0 check (average_price >= 0),
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- 2. Tabela de Snapshots Mensais de Patrimônio (Evolução histórica leve)
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  total_value numeric(18, 2) not null check (total_value >= 0),
  total_cost numeric(18, 2) not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- 3. Tabela de Contribuições / Aportes Mensais (Desacoplada para fluxo financeiro)
create table if not exists public.portfolio_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid references public.portfolio_assets (id) on delete set null,
  date date not null check (date >= date '2026-01-01'),
  amount numeric(12, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Tabela Direta de Proventos Recebidos
create table if not exists public.portfolio_dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.portfolio_assets (id) on delete cascade,
  date date not null check (date >= date '2026-01-01'),
  amount numeric(12, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 5. Habilitar RLS nas novas tabelas
alter table public.portfolio_snapshots enable row level security;
alter table public.portfolio_contributions enable row level security;
alter table public.portfolio_dividends enable row level security;

-- 6. Políticas de RLS (all_own)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'portfolio_snapshots' and policyname = 'portfolio_snapshots_all_own') then
    create policy "portfolio_snapshots_all_own" on public.portfolio_snapshots
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'portfolio_contributions' and policyname = 'portfolio_contributions_all_own') then
    create policy "portfolio_contributions_all_own" on public.portfolio_contributions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'portfolio_dividends' and policyname = 'portfolio_dividends_all_own') then
    create policy "portfolio_dividends_all_own" on public.portfolio_dividends
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- 7. Índices de performance
create index if not exists idx_portfolio_snapshots_user_month on public.portfolio_snapshots (user_id, month desc);
create index if not exists idx_portfolio_contributions_user_date on public.portfolio_contributions (user_id, date desc);
create index if not exists idx_portfolio_dividends_user_date on public.portfolio_dividends (user_id, date desc);
create index if not exists idx_portfolio_dividends_asset on public.portfolio_dividends (asset_id);

-- 8. Backfill automático a partir de transações legadas existentes
do $$
declare
  r record;
  v_qty numeric(18,8);
  v_total_cost numeric(18,8);
  v_avg_price numeric(18,8);
begin
  -- Backfill de proventos
  insert into public.portfolio_dividends (user_id, asset_id, date, amount, notes)
  select pt.user_id, pt.asset_id, pt.date, pt.total, 'Migrado do histórico de transações'
  from public.portfolio_transactions pt
  where pt.type in ('dividend', 'jcp', 'fii_yield')
  and not exists (
    select 1 from public.portfolio_dividends pd
    where pd.asset_id = pt.asset_id and pd.date = pt.date and pd.amount = pt.total
  );

  -- Backfill de contribuições / compras
  insert into public.portfolio_contributions (user_id, asset_id, date, amount, notes)
  select pt.user_id, pt.asset_id, pt.date, pt.total, 'Migrado do histórico de transações'
  from public.portfolio_transactions pt
  where pt.type in ('buy', 'subscription')
  and not exists (
    select 1 from public.portfolio_contributions pc
    where pc.asset_id = pt.asset_id and pc.date = pt.date and pc.amount = pt.total
  );

  -- Backfill de posição em portfolio_assets
  for r in select id, user_id from public.portfolio_assets loop
    select
      coalesce(sum(case when type in ('buy', 'subscription') then quantity when type = 'sell' then -quantity else 0 end), 0),
      coalesce(sum(case when type in ('buy', 'subscription') then total when type = 'sell' then -total else 0 end), 0)
    into v_qty, v_total_cost
    from public.portfolio_transactions
    where asset_id = r.id;

    if v_qty > 0 then
      v_avg_price := v_total_cost / v_qty;
      if v_avg_price < 0 then
        v_avg_price := 0;
      end if;
    else
      v_qty := 0;
      v_avg_price := 0;
    end if;

    update public.portfolio_assets
    set quantity = v_qty, average_price = v_avg_price
    where id = r.id and (quantity = 0 and average_price = 0);
  end loop;
end $$;
