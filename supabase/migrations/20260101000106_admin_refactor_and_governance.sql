-- ================================================================
-- 000106_admin_refactor_and_governance.sql
-- Refatoração do Módulo Administrativo:
-- 1. Controle do APK Nativo (Beta Fechado para Free e Pro)
-- 2. Coluna de Contato (phone) em profiles com sigilo/privacidade (LGPD)
-- 3. RPC admin_get_user_contact_details com auditoria compulsória
-- 4. Sistema de Notificações Push & Broadcast (admin_broadcast_notifications + user_notification_reads)
-- 5. Histórico e Registro de Backups da Plataforma (system_backups)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Feature Flags de Controle do APK Nativo Android
-- ----------------------------------------------------------------
insert into public.system_features (key, name, description, is_globally_enabled, default_enabled_for_new_users)
values
  ('apk_access_free', 'Acesso ao APK Nativo (Modo Free)', 'Habilita ou desabilita o acesso de contas no plano gratuito ao aplicativo Android nativo durante o beta fechado.', true, true),
  ('apk_access_pro', 'Acesso ao APK Nativo (Modo Pro)', 'Habilita ou desabilita o acesso de assinantes Pro ao aplicativo Android nativo durante o beta fechado.', true, true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

-- ----------------------------------------------------------------
-- 2. Coluna de Contato (Telefone/WhatsApp) em profiles com Proteção LGPD
-- ----------------------------------------------------------------
alter table public.profiles
  add column if not exists phone text;

-- Revoga leitura direta de phone para anon e authenticated (mesma proteção de CPF da migração 0058)
revoke select (phone) on table public.profiles from anon, authenticated;

comment on column public.profiles.phone is
  'PII (Telefone/WhatsApp). SELECT revogado de anon/authenticated — acesso operacional restrito a service_role ou via RPC admin_get_user_contact_details com trilha de auditoria.';

-- ----------------------------------------------------------------
-- 3. RPC para Consulta Auditada de Dados de Contato pelo Administrador
-- ----------------------------------------------------------------
create or replace function public.admin_get_user_contact_details(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_phone text;
  v_cpf text;
  v_email text;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  select name, email, cpf, phone
  into v_name, v_email, v_cpf, v_phone
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  -- Registro compulsório de auditoria para fins de compliance LGPD (Art. 18 / Menor Privilégio)
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'profile',
    p_user_id::text,
    'admin_view_user_contact',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'has_phone', v_phone is not null,
      'has_cpf', v_cpf is not null,
      'viewed_at', now()
    )
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'name', v_name,
    'email', v_email,
    'cpf', v_cpf,
    'masked_cpf', public.mask_cpf(v_cpf),
    'phone', v_phone
  );
end;
$$;

-- ----------------------------------------------------------------
-- 4. Sistema de Notificações Push & Broadcast
-- ----------------------------------------------------------------
create table if not exists public.admin_broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'critical', 'promotion', 'system')),
  action_url text,
  target_audience text not null default 'all' check (target_audience in ('all', 'pro', 'free', 'specific_users')),
  target_user_ids uuid[] default null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.admin_broadcast_notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  dismissed_at timestamptz,
  unique (user_id, notification_id)
);

create index if not exists idx_broadcast_created on public.admin_broadcast_notifications (created_at desc);
create index if not exists idx_user_notification_reads_user on public.user_notification_reads (user_id, notification_id);

alter table public.admin_broadcast_notifications enable row level security;
alter table public.user_notification_reads enable row level security;

-- Políticas de RLS para Notificações Broadcast
create policy broadcast_notifications_select on public.admin_broadcast_notifications
  for select to authenticated
  using (
    public.is_admin()
    or target_audience = 'all'
    or (target_audience = 'specific_users' and (auth.uid() = any(target_user_ids)))
    or (target_audience = 'pro' and exists (
      select 1 from public.user_subscriptions s
      where s.user_id = auth.uid() and s.status in ('active', 'trialing') and s.tier in ('pro', 'lifetime')
    ))
    or (target_audience = 'free' and not exists (
      select 1 from public.user_subscriptions s
      where s.user_id = auth.uid() and s.status in ('active', 'trialing') and s.tier in ('pro', 'lifetime')
    ))
  );

create policy broadcast_notifications_write on public.admin_broadcast_notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Políticas de RLS para Leituras
create policy user_notification_reads_policy on public.user_notification_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RPC para envio de notificação pelo administrador
create or replace function public.admin_send_broadcast_notification(
  p_title text,
  p_message text,
  p_type text default 'info',
  p_action_url text default null,
  p_target_audience text default 'all',
  p_target_user_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_notification_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  insert into public.admin_broadcast_notifications (
    title,
    message,
    type,
    action_url,
    target_audience,
    target_user_ids,
    created_by
  ) values (
    trim(p_title),
    trim(p_message),
    p_type,
    nullif(trim(p_action_url), ''),
    p_target_audience,
    p_target_user_ids,
    v_admin_id
  )
  returning id into v_notification_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'broadcast_notification',
    v_notification_id::text,
    'admin_create_broadcast',
    jsonb_build_object(
      'title', p_title,
      'type', p_type,
      'target_audience', p_target_audience,
      'target_count', case when p_target_user_ids is not null then array_length(p_target_user_ids, 1) else null end
    )
  );

  return v_notification_id;
end;
$$;

-- RPC para buscar notificações do usuário atual com status de leitura
create or replace function public.get_my_broadcast_notifications(p_limit integer default 20)
returns table (
  id uuid,
  title text,
  message text,
  type text,
  action_url text,
  created_at timestamptz,
  is_read boolean,
  is_dismissed boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.title,
    b.message,
    b.type,
    b.action_url,
    b.created_at,
    (r.read_at is not null) as is_read,
    (r.dismissed_at is not null) as is_dismissed
  from public.admin_broadcast_notifications b
  left join public.user_notification_reads r
    on r.notification_id = b.id and r.user_id = auth.uid()
  where (
    b.target_audience = 'all'
    or (b.target_audience = 'specific_users' and (auth.uid() = any(b.target_user_ids)))
    or (b.target_audience = 'pro' and exists (
      select 1 from public.user_subscriptions s
      where s.user_id = auth.uid() and s.status in ('active', 'trialing') and s.tier in ('pro', 'lifetime')
    ))
    or (b.target_audience = 'free' and not exists (
      select 1 from public.user_subscriptions s
      where s.user_id = auth.uid() and s.status in ('active', 'trialing') and s.tier in ('pro', 'lifetime')
    ))
  )
  and (r.dismissed_at is null)
  order by b.created_at desc
  limit p_limit;
$$;

-- RPC para marcar notificação como lida
create or replace function public.mark_broadcast_as_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_notification_reads (user_id, notification_id, read_at)
  values (auth.uid(), p_notification_id, now())
  on conflict (user_id, notification_id)
  do update set read_at = coalesce(public.user_notification_reads.read_at, now());
end;
$$;

-- ----------------------------------------------------------------
-- 5. Histórico e Registro de Backups da Plataforma
-- ----------------------------------------------------------------
create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  backup_type text not null default 'manual' check (backup_type in ('manual', 'scheduled', 'pre_migration')),
  table_count integer not null default 0,
  record_count bigint not null default 0,
  file_size_bytes bigint not null default 0,
  checksum_sha256 text not null,
  status text not null default 'completed' check (status in ('in_progress', 'completed', 'failed')),
  notes text
);

alter table public.system_backups enable row level security;

create policy system_backups_admin_policy on public.system_backups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.admin_log_system_backup(
  p_backup_type text default 'manual',
  p_table_count integer default 0,
  p_record_count bigint default 0,
  p_file_size_bytes bigint default 0,
  p_checksum_sha256 text default '',
  p_status text default 'completed',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_backup_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: privilégios administrativos requeridos.';
  end if;

  insert into public.system_backups (
    created_by,
    backup_type,
    table_count,
    record_count,
    file_size_bytes,
    checksum_sha256,
    status,
    notes
  ) values (
    v_admin_id,
    p_backup_type,
    p_table_count,
    p_record_count,
    p_file_size_bytes,
    p_checksum_sha256,
    p_status,
    p_notes
  )
  returning id into v_backup_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_admin_id,
    'system_backup',
    v_backup_id::text,
    'admin_create_backup',
    jsonb_build_object(
      'backup_type', p_backup_type,
      'table_count', p_table_count,
      'record_count', p_record_count,
      'file_size_bytes', p_file_size_bytes,
      'checksum_sha256', p_checksum_sha256,
      'status', p_status
    )
  );

  return v_backup_id;
end;
$$;
