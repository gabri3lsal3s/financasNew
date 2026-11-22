-- =============================================================================
-- Migration 0136: User Push Subscriptions & Delivery Logs (Web Push VAPID + FCM)
-- =============================================================================

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('web_push', 'fcm')),
  endpoint text,
  p256dh text,
  auth text,
  fcm_token text,
  device_label text,
  user_agent text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_push_sub_platform_fields check (
    (platform = 'web_push' and endpoint is not null and p256dh is not null and auth is not null)
    or
    (platform = 'fcm' and fcm_token is not null)
  )
);

create unique index if not exists idx_user_push_subs_user_endpoint
  on public.user_push_subscriptions (user_id, endpoint);

create unique index if not exists idx_user_push_subs_user_fcm_token
  on public.user_push_subscriptions (user_id, fcm_token);

create index if not exists idx_user_push_subs_active_user
  on public.user_push_subscriptions (user_id)
  where is_active = true;

drop trigger if exists trg_user_push_subscriptions_updated_at on public.user_push_subscriptions;
create trigger trg_user_push_subscriptions_updated_at
  before update on public.user_push_subscriptions
  for each row execute function public.update_updated_at();

alter table public.user_push_subscriptions enable row level security;

drop policy if exists "user_push_subscriptions_select_own" on public.user_push_subscriptions;
create policy "user_push_subscriptions_select_own"
  on public.user_push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_push_subscriptions_insert_own" on public.user_push_subscriptions;
create policy "user_push_subscriptions_insert_own"
  on public.user_push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_push_subscriptions_update_own" on public.user_push_subscriptions;
create policy "user_push_subscriptions_update_own"
  on public.user_push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_push_subscriptions_delete_own" on public.user_push_subscriptions;
create policy "user_push_subscriptions_delete_own"
  on public.user_push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Logs de idempotência e auditoria de envio de Push Remoto (escrita service_role)
-- -----------------------------------------------------------------------------

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  idempotency_key text not null unique,
  channel text not null check (channel in ('web_push', 'fcm', 'mixed', 'none')),
  status text not null check (
    status in (
      'sent',
      'partial',
      'skipped_quiet_hours',
      'skipped_disabled',
      'skipped_no_subscription',
      'skipped_unconfigured',
      'failed'
    )
  ),
  error_detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_delivery_logs_user_created
  on public.push_delivery_logs (user_id, created_at desc);

alter table public.push_delivery_logs enable row level security;

drop policy if exists "push_delivery_logs_select_own" on public.push_delivery_logs;
create policy "push_delivery_logs_select_own"
  on public.push_delivery_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
