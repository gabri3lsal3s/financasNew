-- ================================================================
-- 0035_cash_checkpoints.sql — Checkpoints de Saldo em Caixa Real (§F49)
--
-- Armazena as âncoras de aferição e conciliação de saldo em contas bancárias:
--   • Permite calibrar o saldo em 1 clique ("Bater com o Banco");
--   • RLS estrito: apenas o próprio usuário ativo pode ler e gravar;
--   • Índice cobridor temporal para busca imediata do último checkpoint.
-- ================================================================

create table if not exists public.cash_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade not null,
  date date not null default current_date,
  balance_cents bigint not null,
  notes text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.cash_checkpoints enable row level security;

create policy "cash_checkpoints_owner_policy"
  on public.cash_checkpoints
  for all
  using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- Índice de performance para busca rápida do último checkpoint
create index if not exists idx_cash_checkpoints_user_date
  on public.cash_checkpoints (user_id, date desc, created_at desc);

comment on table public.cash_checkpoints is 'Checkpoints de calibração do saldo bancário em regime de caixa (FASE 49).';
