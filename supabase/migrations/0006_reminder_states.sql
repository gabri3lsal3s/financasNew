-- ================================================================
-- 0006_reminder_states.sql — Central de lembretes (ESPECIFICAÇÃO §3.10)
--
-- Estado persistido do usuário sobre cada lembrete (in-app):
--   • read    — marcado como lido (some da lista);
--   • snoozed — adiado até `snooze_until`; expira automaticamente
--               quando o item vence/atrasa (derivado no domínio).
-- Chave estável: tipo + entidade (ex.: `bill:{card_id}:{YYYY-MM}`,
-- `debt:{debt_id}`) — espelha o `occurrence_key` do insight_feedback.
-- ================================================================

create table public.reminder_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_key text not null,
  kind text not null check (kind in ('read', 'snoozed')),
  snooze_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, occurrence_key)
);

create index idx_reminder_states_user on public.reminder_states (user_id);

alter table public.reminder_states enable row level security;

create policy "reminder_states_all_own" on public.reminder_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
