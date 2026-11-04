-- ---------------------------------------------------------------------------
-- 20260101000061_support_replies_and_analytics.sql
-- Expansão do suporte bidirecional (respostas de admin e leitura do usuário),
-- configurações programáveis da central do Telegram e telemetria leve de uso.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Expansão da tabela public.support_tickets para suporte a respostas
-- ===========================================================================
alter table public.support_tickets
  add column if not exists admin_reply text,
  add column if not exists admin_replied_at timestamptz,
  add column if not exists user_read_at timestamptz,
  add column if not exists admin_id uuid references public.profiles(id) on delete set null;

comment on column public.support_tickets.admin_reply is 'Resposta oficial enviada pelo administrador/suporte ao usuário.';
comment on column public.support_tickets.admin_replied_at is 'Data e hora em que a resposta da administração foi enviada.';
comment on column public.support_tickets.user_read_at is 'Data e hora em que o usuário abriu ou marcou a resposta como lida no app.';
comment on column public.support_tickets.admin_id is 'Identificador do perfil do administrador que atendeu o chamado.';

-- Índice para busca rápida de chamados respondidos pendentes de leitura pelo usuário
create index if not exists idx_support_tickets_user_unread_reply
  on public.support_tickets (user_id, admin_replied_at)
  where admin_reply is not null and user_read_at is null;

-- ===========================================================================
-- 2. Tabela de Configurações Programáveis do Bot Telegram (Admin Settings)
-- ===========================================================================
create table if not exists public.admin_telegram_settings (
  id text primary key default 'global',
  notify_support boolean not null default true,
  notify_git boolean not null default true,
  notify_deploys boolean not null default true,
  notify_analytics boolean not null default false,
  notify_new_users boolean not null default true,
  silent_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Habilita RLS estrito
alter table public.admin_telegram_settings enable row level security;

-- Política RLS: Apenas admins e superadmins podem ler e gerenciar as configurações do bot
drop policy if exists "Admins can view telegram settings" on public.admin_telegram_settings;
create policy "Admins can view telegram settings"
  on public.admin_telegram_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'superadmin')
    )
  );

drop policy if exists "Admins can update telegram settings" on public.admin_telegram_settings;
create policy "Admins can update telegram settings"
  on public.admin_telegram_settings
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

-- Garante existência da linha padrão 'global'
insert into public.admin_telegram_settings (id, notify_support, notify_git, notify_deploys, notify_analytics, notify_new_users, silent_mode)
values ('global', true, true, true, false, true, false)
on conflict (id) do nothing;

grant select, insert, update on public.admin_telegram_settings to authenticated;
grant select, insert, update, delete on public.admin_telegram_settings to service_role;

comment on table public.admin_telegram_settings is 'Controle programável de canais e eventos notificados ao bot do Telegram do fundador.';

-- ===========================================================================
-- 3. Tabela de Telemetria Leve e Métricas de Uso de Funcionalidades
-- ===========================================================================
create table if not exists public.app_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event_name text not null,
  module text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Habilita RLS estrito
alter table public.app_analytics_events enable row level security;

-- Usuários autenticados podem apenas INSERIR eventos de suas próprias sessões
drop policy if exists "Users can insert own analytics events" on public.app_analytics_events;
create policy "Users can insert own analytics events"
  on public.app_analytics_events
  for insert
  to authenticated
  with check (
    user_id is null or user_id = (select auth.uid())
  );

-- Apenas administradores podem ler eventos analíticos para gerar rankings e métricas
drop policy if exists "Admins can view analytics events" on public.app_analytics_events;
create policy "Admins can view analytics events"
  on public.app_analytics_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'superadmin')
    )
  );

-- Índices cobridores para agregação analítica eficiente
create index if not exists idx_analytics_module_date
  on public.app_analytics_events (module, created_at desc);

create index if not exists idx_analytics_event_date
  on public.app_analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_created_at
  on public.app_analytics_events (created_at desc);

grant select, insert on public.app_analytics_events to authenticated;
grant select, insert, delete on public.app_analytics_events to service_role;

comment on table public.app_analytics_events is 'Eventos agregados e anônimos de utilização de funcionalidades e abertura de módulos (sem dados financeiros confidenciais).';
