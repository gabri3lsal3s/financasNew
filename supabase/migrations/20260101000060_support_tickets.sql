-- ---------------------------------------------------------------------------
-- 20260101000060_support_tickets.sql
-- Tabela e políticas RLS para canal nativo de suporte ao cliente e chamados (SaaS)
-- ---------------------------------------------------------------------------

-- 1. Enums de tipos e status dos chamados de suporte
do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_ticket_type') then
    create type public.support_ticket_type as enum ('doubt', 'bug', 'suggestion', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_ticket_status') then
    create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
  end if;
end $$;

-- 2. Tabela de chamados de suporte
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.support_ticket_type not null default 'doubt',
  status public.support_ticket_status not null default 'open',
  subject text,
  message text not null,
  user_email text,
  user_name text,
  app_version text,
  current_route text,
  device_info jsonb default '{}'::jsonb,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Habilitação mandatória de Row Level Security
alter table public.support_tickets enable row level security;

-- 4. Políticas RLS (Subplan Caching / InitPlan conforme AGENTS.md e Architecture §12)
drop policy if exists "Users can insert own support tickets" on public.support_tickets;
create policy "Users can insert own support tickets"
  on public.support_tickets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own support tickets" on public.support_tickets;
create policy "Users can view own support tickets"
  on public.support_tickets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own support tickets" on public.support_tickets;
create policy "Users can update own support tickets"
  on public.support_tickets
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own support tickets" on public.support_tickets;
create policy "Users can delete own support tickets"
  on public.support_tickets
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view and manage all support tickets" on public.support_tickets;
create policy "Admins can view and manage all support tickets"
  on public.support_tickets
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'superadmin')
    )
  );

-- 5. Índices cobridores para performance em alta concorrência
create index if not exists idx_support_tickets_user_date
  on public.support_tickets (user_id, created_at desc);

create index if not exists idx_support_tickets_status_date
  on public.support_tickets (status, created_at desc);

-- 6. Trigger automático para atualização da coluna updated_at
drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.update_updated_at();

-- 7. Privilégios PostgREST
grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.support_tickets to service_role;

-- 8. Comentários para documentação do schema do banco
comment on table public.support_tickets is 'Chamados de suporte técnico, dúvidas, sugestões e reporte de bugs enviados pelos usuários.';
comment on column public.support_tickets.type is 'Categoria do chamado: doubt (dúvida), bug (problema), suggestion (sugestão), other (outro).';
comment on column public.support_tickets.status is 'Status operacional: open (aberto), in_progress (em atendimento), resolved (resolvido), closed (encerrado).';
comment on column public.support_tickets.device_info is 'Metadados técnicos do cliente: plataforma (Web/PWA/Android), resolução, versão do app e User-Agent.';
