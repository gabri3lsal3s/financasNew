-- ---------------------------------------------------------------------------
-- 20260101000066_add_is_family_to_transactions.sql
-- Módulo de Orçamento Familiar & Crescimento Orgânico (Áxis Finance)
-- Adiciona a coluna is_family e índice parcial para separação entre despesas
-- pessoais e despesas compartilhadas da casa/família.
-- ---------------------------------------------------------------------------

-- 1. Adicionar coluna is_family na tabela public.expenses (despesas)
alter table public.expenses
  add column if not exists is_family boolean not null default false;

-- 2. Adicionar coluna is_family na tabela public.incomes (rendas) para consistência
alter table public.incomes
  add column if not exists is_family boolean not null default false;

-- 3. Adicionar coluna is_family na tabela public.categories para sugestão automática
alter table public.categories
  add column if not exists is_family boolean not null default false;

-- 4. Índices parciais de alta performance para consultas do painel familiar
-- O índice idx_transactions_user_family atende ao contrato canônico de transações
create index if not exists idx_transactions_user_family
  on public.expenses (user_id, date)
  where is_family = true;

create index if not exists idx_expenses_user_family
  on public.expenses (user_id, date)
  where is_family = true;

create index if not exists idx_incomes_user_family
  on public.incomes (user_id, date)
  where is_family = true;
