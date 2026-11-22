-- =============================================================================
-- Migration 0135: Notification Hub — Broadcast Expiration & Dismissal
-- =============================================================================

alter table public.admin_broadcast_notifications
  add column if not exists expires_at timestamptz;

alter table public.user_notification_reads
  add column if not exists dismissed_at timestamptz;

drop function if exists public.get_my_broadcast_notifications(integer);

create or replace function public.get_my_broadcast_notifications(p_limit integer default 20)
returns table (
  id uuid,
  title text,
  message text,
  type text,
  action_url text,
  created_at timestamptz,
  expires_at timestamptz,
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
    b.expires_at,
    (r.read_at is not null) as is_read,
    (r.dismissed_at is not null) as is_dismissed
  from public.admin_broadcast_notifications b
  left join public.user_notification_reads r
    on r.notification_id = b.id and r.user_id = auth.uid()
  where (b.expires_at is null or b.expires_at > now())
    and (r.dismissed_at is null)
    and (
      b.target_audience = 'all'
      or (b.target_audience = 'specific_users' and (auth.uid() = any(b.target_user_ids)))
      or (b.target_audience = 'pro' and exists (
        select 1 from public.user_subscriptions s
        where s.user_id = auth.uid()
          and s.status in ('active', 'trialing')
          and s.tier in ('pro_monthly', 'pro_annual', 'lifetime')
      ))
      or (b.target_audience = 'free' and not exists (
        select 1 from public.user_subscriptions s
        where s.user_id = auth.uid()
          and s.status in ('active', 'trialing')
          and s.tier in ('pro_monthly', 'pro_annual', 'lifetime')
      ))
    )
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.get_my_broadcast_notifications(integer) to authenticated;

create or replace function public.dismiss_broadcast_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.user_notification_reads (user_id, notification_id, read_at, dismissed_at)
  values (v_uid, p_notification_id, now(), now())
  on conflict (user_id, notification_id)
  do update set
    dismissed_at = coalesce(public.user_notification_reads.dismissed_at, now()),
    read_at = coalesce(public.user_notification_reads.read_at, now());
end;
$$;

grant execute on function public.dismiss_broadcast_notification(uuid) to authenticated;
