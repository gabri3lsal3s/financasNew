-- ================================================================
-- 0001_schema.sql — Schema base (ESPECIFICAÇÃO_TECNICA §2)
-- Todas as tabelas com user_id + RLS (ver 0002). Valores monetários
-- em numeric(12,2); report_weight numeric(5,4) (0–1, 4 casas).
-- APP_START_DATE = 2026-01-01 (espelha src/types/schema.ts).
-- ================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------
-- Identidade
-- ----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'oled', 'system')),
  reminders_enabled boolean not null default true,
  reminder_days_before_debt integer not null default 3 check (reminder_days_before_debt >= 0),
  reminder_days_before_bill integer not null default 3 check (reminder_days_before_bill >= 0),
  report_weights_enabled boolean not null default true,
  max_sector_acoes numeric(5, 2),
  max_sector_fiis numeric(5, 2)
);

-- ----------------------------------------------------------------
-- Categorias
-- ----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  name text not null,
  icon text,
  color text,
  is_reserved boolean not null default false,
  is_active boolean not null default true,
  unique (user_id, type, name)
);

-- ----------------------------------------------------------------
-- Cartões de crédito
-- ----------------------------------------------------------------
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  brand text,
  credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  color text,
  is_active boolean not null default true
);

-- Overrides mensais de competência (prevalecem sobre o padrão do cartão).
create table public.card_competence_overrides (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.credit_cards (id) on delete cascade,
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  unique (card_id, month)
);

-- ----------------------------------------------------------------
-- Rendas
-- ----------------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  value numeric(12, 2) not null check (value > 0),
  date date not null check (date >= date '2026-01-01'),
  category_id uuid not null references public.categories (id),
  receive_type text not null check (receive_type in ('cash', 'pix', 'transfer', 'other')),
  description text,
  report_weight numeric(5, 4) not null default 1 check (report_weight between 0 and 1),
  source_ref text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Despesas
-- ----------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  value numeric(12, 2) not null check (value > 0),
  date date not null check (date >= date '2026-01-01'),
  category_id uuid not null references public.categories (id),
  payment_method text not null
    check (payment_method in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other')),
  card_id uuid references public.credit_cards (id),
  installments_total integer not null default 1 check (installments_total between 1 and 60),
  installment_number integer not null default 1 check (installment_number between 1 and installments_total),
  installment_group_id uuid,
  bill_competence char(7) check (bill_competence ~ '^\d{4}-\d{2}$'),
  report_weight numeric(5, 4) not null default 1 check (report_weight between 0 and 1),
  base_amount numeric(12, 2) not null,
  description text,
  created_at timestamptz not null default now(),
  -- Cartão obrigatório no crédito (ESPECIFICAÇÃO §3.2.1).
  check (payment_method <> 'credit_card' or card_id is not null),
  -- Grupo presente sse parcelado (ESPECIFICAÇÃO §2).
  check ((installments_total > 1) = (installment_group_id is not null))
);

-- ----------------------------------------------------------------
-- Pagamentos e estornos de fatura
-- ----------------------------------------------------------------
create table public.card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id),
  competence_month char(7) not null check (competence_month ~ '^\d{4}-\d{2}$'),
  amount numeric(12, 2) not null,
  date date not null check (date >= date '2026-01-01'),
  note text,
  is_refund boolean not null default false
);

-- ----------------------------------------------------------------
-- Dívidas (contas a pagar / receber)
-- ----------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null check (type in ('payable', 'receivable')),
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  -- NULL = pendente; preenchido = quitada (status derivado nunca é armazenado).
  paid_at timestamptz,
  expense_id uuid references public.expenses (id) on delete set null,
  installment_group_id uuid,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Orçamentos e metas de renda
-- ----------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  limit numeric(12, 2) not null check (limit > 0),
  unique (category_id, month)
);

create table public.income_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  expected numeric(12, 2) not null check (expected > 0),
  unique (category_id, month)
);

-- ----------------------------------------------------------------
-- Aprendizado de insights (FRAG-2)
-- ----------------------------------------------------------------
create table public.insight_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_key text not null,
  decision text not null check (decision in ('ignore', 'confirm')),
  created_at timestamptz not null default now(),
  unique (user_id, occurrence_key)
);

-- ----------------------------------------------------------------
-- Carteira / portfólio
-- ----------------------------------------------------------------
create table public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticker text not null,
  asset_class text,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  unique (user_id, ticker)
);

create table public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.portfolio_assets (id) on delete cascade,
  type text not null
    check (type in ('buy', 'sell', 'dividend', 'jcp', 'fii_yield', 'split', 'reverse_split', 'subscription')),
  date date not null check (date >= date '2026-01-01'),
  quantity numeric(18, 8) not null,
  price numeric(18, 8) not null,
  total numeric(18, 2) not null
);

-- Metas de alocação: soma por usuário ≤ 100 validada em trigger (0003).
create table public.allocation_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.portfolio_assets (id) on delete cascade,
  target_percentage numeric(5, 2) not null check (target_percentage between 0 and 100),
  unique (user_id, asset_id)
);

create table public.class_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_type text not null check (group_type in ('class', 'sector')),
  name text not null,
  target_percentage numeric(5, 2) not null check (target_percentage between 0 and 100),
  unique (user_id, group_type, name)
);

create table public.sector_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_type text not null check (group_type in ('class', 'sector')),
  name text not null,
  target_percentage numeric(5, 2) not null check (target_percentage between 0 and 100),
  unique (user_id, group_type, name)
);

-- ----------------------------------------------------------------
-- Cotações (cache servidor + override manual — FRAG-3)
-- ----------------------------------------------------------------
create table public.asset_prices (
  id uuid primary key default gen_random_uuid(),
  -- NULL = cache global escrito pela edge function; preenchido = override manual.
  user_id uuid references public.profiles (id) on delete cascade,
  ticker text not null,
  price numeric(18, 8) not null,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  source text not null check (source in ('api', 'fallback', 'manual')),
  manual_price numeric(18, 8),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Auditoria (imutável — D2)
-- ----------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Índices recomendados (ESPECIFICAÇÃO §2)
-- ----------------------------------------------------------------
create index idx_expenses_user_date on public.expenses (user_id, date desc);
create index idx_expenses_group on public.expenses (installment_group_id);
create index idx_incomes_user_date on public.incomes (user_id, date desc);
create index idx_debts_user_due on public.debts (user_id, due_date);
create index idx_card_payments_card_competence on public.card_payments (card_id, competence_month);
create index idx_budgets_user_month on public.budgets (user_id, month);
create index idx_income_goals_user_month on public.income_goals (user_id, month);
create index idx_competence_overrides_card on public.card_competence_overrides (card_id, month);
create index idx_portfolio_tx_asset_date on public.portfolio_transactions (asset_id, date);
create index idx_asset_prices_ticker on public.asset_prices (ticker, user_id);
create index idx_audit_events_user on public.audit_events (user_id, created_at desc);
