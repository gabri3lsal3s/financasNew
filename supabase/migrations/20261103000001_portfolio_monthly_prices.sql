-- Migration: 20261103000001_portfolio_monthly_prices.sql
-- Descrição: Tabela para persistência de cotações de fechamento histórico por ativo e competência (Fase 2)

create table if not exists public.portfolio_monthly_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticker text not null,
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  price numeric(18, 8) not null check (price >= 0),
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  source text not null check (source in ('api', 'manual', 'fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_portfolio_monthly_prices_user_ticker_month unique (user_id, ticker, month)
);

-- Habilitar Row Level Security (RLS)
alter table public.portfolio_monthly_prices enable row level security;

-- Políticas RLS com isolamento por usuário ativo e autorização modular
drop policy if exists "portfolio_monthly_prices_select_own" on public.portfolio_monthly_prices;
create policy "portfolio_monthly_prices_select_own" on public.portfolio_monthly_prices
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_monthly_prices_write_own" on public.portfolio_monthly_prices;
create policy "portfolio_monthly_prices_write_own" on public.portfolio_monthly_prices
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Índices de consulta e alta performance
create index if not exists idx_portfolio_monthly_prices_user_month
  on public.portfolio_monthly_prices (user_id, month desc);

create index if not exists idx_portfolio_monthly_prices_lookup
  on public.portfolio_monthly_prices (user_id, month, ticker);
