-- ----------------------------------------------------------------
-- Migração 20260101000033: Suporte a Setores e Segmentos de Ativos
-- ----------------------------------------------------------------

-- 1. Garante existência da tabela portfolio_assets se não existir
create table if not exists public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticker text not null,
  asset_class text,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  quantity numeric(18, 8) not null default 0 check (quantity >= 0),
  average_price numeric(18, 8) not null default 0 check (average_price >= 0),
  accumulated_dividends numeric(18, 2) not null default 0,
  estimated_monthly_dividend_per_share numeric(18, 4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

-- 2. Adiciona coluna sector à tabela portfolio_assets se ainda não existir
alter table public.portfolio_assets
  add column if not exists sector text;

-- 3. Habilita RLS na tabela
alter table public.portfolio_assets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'portfolio_assets' and policyname = 'portfolio_assets_all_own') then
    create policy "portfolio_assets_all_own" on public.portfolio_assets
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- 4. Cria índice de performance para consultas e agregações setoriais
create index if not exists idx_portfolio_assets_sector
  on public.portfolio_assets (user_id, sector);

-- 5. Força a recarga imediata do schema cache do PostgREST
notify pgrst, 'reload schema';
