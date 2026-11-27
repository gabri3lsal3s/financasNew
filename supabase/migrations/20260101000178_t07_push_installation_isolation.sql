-- =============================================================================
-- Migration 0178: T07 — Isolamento de Push por Instalação e Versão de Destinatário
-- =============================================================================
-- Adiciona:
--   - installation_id: identificador estável da instalação/dispositivo
--   - recipient_version: versão monotônica de vínculo para invalidar payloads antigos
--   - multi_account_opt_in: opt-in explícito para múltiplas contas no mesmo aparelho
-- E cria função atômica public.bind_push_subscription_installation(...)
-- para vincular assinatura por instalação sem vazamento entre contas.
-- =============================================================================

alter table public.user_push_subscriptions
  add column if not exists installation_id text,
  add column if not exists recipient_version integer not null default 1,
  add column if not exists multi_account_opt_in boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_user_push_subs_recipient_version_positive'
      and conrelid = 'public.user_push_subscriptions'::regclass
  ) then
    alter table public.user_push_subscriptions
      add constraint chk_user_push_subs_recipient_version_positive
      check (recipient_version >= 1);
  end if;
end
$$;

create index if not exists idx_user_push_subs_installation_active
  on public.user_push_subscriptions (installation_id, is_active)
  where installation_id is not null and is_active = true;

create index if not exists idx_user_push_subs_user_installation_platform
  on public.user_push_subscriptions (user_id, installation_id, platform)
  where installation_id is not null;

-- -----------------------------------------------------------------------------
-- Função atômica de vinculação de push por instalação
-- -----------------------------------------------------------------------------
create or replace function public.bind_push_subscription_installation(
  p_platform text,
  p_installation_id text,
  p_endpoint text default null,
  p_p256dh text default null,
  p_auth text default null,
  p_fcm_token text default null,
  p_device_label text default null,
  p_user_agent text default null,
  p_multi_account_opt_in boolean default false
)
returns public.user_push_subscriptions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_installation_id text := nullif(btrim(coalesce(p_installation_id, '')), '');
  v_platform text := btrim(coalesce(p_platform, ''));
  v_endpoint text := nullif(btrim(coalesce(p_endpoint, '')), '');
  v_p256dh text := nullif(btrim(coalesce(p_p256dh, '')), '');
  v_auth text := nullif(btrim(coalesce(p_auth, '')), '');
  v_fcm_token text := nullif(btrim(coalesce(p_fcm_token, '')), '');
  v_multi_opt_in boolean := coalesce(p_multi_account_opt_in, false);
  v_now timestamptz := now();
  v_result public.user_push_subscriptions;
begin
  if v_user_id is null then
    raise exception 'Sessão autenticada obrigatória' using errcode = '42501';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Conta inativa ou não autorizada' using errcode = '42501';
  end if;

  if v_installation_id is null or char_length(v_installation_id) < 8 or char_length(v_installation_id) > 128 then
    raise exception 'installation_id inválido' using errcode = '22023';
  end if;

  if v_platform not in ('web_push', 'fcm') then
    raise exception 'Plataforma de push inválida' using errcode = '22023';
  end if;

  if v_platform = 'web_push' and (v_endpoint is null or v_p256dh is null or v_auth is null) then
    raise exception 'Campos obrigatórios de web_push ausentes' using errcode = '22023';
  end if;

  if v_platform = 'fcm' and v_fcm_token is null then
    raise exception 'fcm_token obrigatório para plataforma fcm' using errcode = '22023';
  end if;

  -- Serializa vinculações concorrentes para a mesma instalação
  perform pg_advisory_xact_lock(hashtext('push_install:' || v_installation_id));

  if v_endpoint is not null then
    perform pg_advisory_xact_lock(hashtext('push_endpoint:' || v_endpoint));
  end if;

  if v_fcm_token is not null then
    perform pg_advisory_xact_lock(hashtext('push_fcm:' || v_fcm_token));
  end if;

  -- Isolamento estrito por padrão: sem opt-in explícito de multi-conta,
  -- revoga vínculos ativos de outras contas nesta mesma instalação/canal
  -- e incrementa recipient_version para invalidar notificações pendentes.
  if not v_multi_opt_in then
    update public.user_push_subscriptions
    set
      is_active = false,
      recipient_version = recipient_version + 1,
      updated_at = v_now
    where user_id <> v_user_id
      and is_active = true
      and (
        installation_id = v_installation_id
        or (v_endpoint is not null and endpoint = v_endpoint)
        or (v_fcm_token is not null and fcm_token = v_fcm_token)
      );
  end if;

  if v_platform = 'web_push' then
    insert into public.user_push_subscriptions (
      user_id,
      platform,
      endpoint,
      p256dh,
      auth,
      fcm_token,
      device_label,
      user_agent,
      installation_id,
      recipient_version,
      multi_account_opt_in,
      is_active,
      last_used_at,
      updated_at
    )
    values (
      v_user_id,
      'web_push',
      v_endpoint,
      v_p256dh,
      v_auth,
      null,
      p_device_label,
      p_user_agent,
      v_installation_id,
      1,
      v_multi_opt_in,
      true,
      v_now,
      v_now
    )
    on conflict (user_id, endpoint) do update
    set
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      device_label = coalesce(excluded.device_label, public.user_push_subscriptions.device_label),
      user_agent = coalesce(excluded.user_agent, public.user_push_subscriptions.user_agent),
      installation_id = excluded.installation_id,
      multi_account_opt_in = excluded.multi_account_opt_in,
      recipient_version = case
        when public.user_push_subscriptions.is_active = false
          or public.user_push_subscriptions.installation_id is distinct from excluded.installation_id
        then public.user_push_subscriptions.recipient_version + 1
        else public.user_push_subscriptions.recipient_version
      end,
      is_active = true,
      last_used_at = v_now,
      updated_at = v_now
    returning * into v_result;
  else
    insert into public.user_push_subscriptions (
      user_id,
      platform,
      endpoint,
      p256dh,
      auth,
      fcm_token,
      device_label,
      user_agent,
      installation_id,
      recipient_version,
      multi_account_opt_in,
      is_active,
      last_used_at,
      updated_at
    )
    values (
      v_user_id,
      'fcm',
      null,
      null,
      null,
      v_fcm_token,
      coalesce(p_device_label, 'Android App'),
      p_user_agent,
      v_installation_id,
      1,
      v_multi_opt_in,
      true,
      v_now,
      v_now
    )
    on conflict (user_id, fcm_token) do update
    set
      device_label = coalesce(excluded.device_label, public.user_push_subscriptions.device_label),
      user_agent = coalesce(excluded.user_agent, public.user_push_subscriptions.user_agent),
      installation_id = excluded.installation_id,
      multi_account_opt_in = excluded.multi_account_opt_in,
      recipient_version = case
        when public.user_push_subscriptions.is_active = false
          or public.user_push_subscriptions.installation_id is distinct from excluded.installation_id
        then public.user_push_subscriptions.recipient_version + 1
        else public.user_push_subscriptions.recipient_version
      end,
      is_active = true,
      last_used_at = v_now,
      updated_at = v_now
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

revoke all on function public.bind_push_subscription_installation(
  text, text, text, text, text, text, text, text, boolean
) from public;

grant execute on function public.bind_push_subscription_installation(
  text, text, text, text, text, text, text, text, boolean
) to authenticated;
