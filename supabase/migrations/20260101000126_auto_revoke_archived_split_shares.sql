-- ---------------------------------------------------------------------------
-- 20260101000126_auto_revoke_archived_split_shares.sql
-- Cancela automaticamente a página pública de rachas finalizados/arquivados
-- (payload->>'is_completed' = 'true') e a reativa automaticamente quando o racha
-- volta a ter pendências (is_completed = false).
-- ---------------------------------------------------------------------------

-- 1. Trigger de sincronização automática de is_revoked para shares do tipo 'split'
create or replace function public.sync_split_public_share_revocation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'split' then
    if coalesce((new.payload->>'is_completed')::boolean, false) then
      new.is_revoked := true;
    else
      new.is_revoked := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_split_public_share_revocation on public.public_shares;
create trigger trg_sync_split_public_share_revocation
  before insert or update on public.public_shares
  for each row
  execute function public.sync_split_public_share_revocation();

-- 2. Backfill de rachas já finalizados/arquivados que ainda estavam com página pública ativa
update public.public_shares
set
  is_revoked = true,
  updated_at = now()
where kind = 'split'
  and coalesce((payload->>'is_completed')::boolean, false) = true
  and is_revoked = false;

-- 3. Defesa em profundidade na RPC pública get_public_share_by_token
create or replace function public.get_public_share_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_token text;
  v_share record;
begin
  -- 1. Sanitização defensiva do token:
  v_clean_token := trim(coalesce(p_token, ''));
  v_clean_token := regexp_replace(v_clean_token, '[?#].*$', '');
  v_clean_token := regexp_replace(v_clean_token, '^/+|/+$', '', 'g');
  v_clean_token := regexp_replace(v_clean_token, '[\.,;:!\s/]+$', '');
  v_clean_token := regexp_replace(v_clean_token, '[^a-zA-Z0-9_-]', '', 'g');

  if v_clean_token = ''
     or length(v_clean_token) not between 6 and 64
     or not (v_clean_token ~ '^[a-zA-Z0-9_-]+$') then
    return null;
  end if;

  -- 2. Localizar compartilhamento válido, não revogado, não expirado e não arquivado
  select
    id,
    user_id,
    kind,
    token,
    payload,
    created_at,
    expires_at,
    is_revoked,
    updated_at
  into v_share
  from public.public_shares
  where token = v_clean_token
    and is_revoked = false
    and (expires_at is null or expires_at > now())
    and not (kind = 'split' and coalesce((payload->>'is_completed')::boolean, false) = true)
  limit 1;

  if not found or v_share is null then
    return null;
  end if;

  -- 3. Retornar estrutura JSON idêntica ao modelo PublicShare
  return jsonb_build_object(
    'id', v_share.id,
    'user_id', v_share.user_id,
    'kind', v_share.kind,
    'token', v_share.token,
    'payload', v_share.payload,
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at,
    'is_revoked', v_share.is_revoked,
    'updated_at', v_share.updated_at
  );
end;
$$;

comment on function public.get_public_share_by_token(text) is
  'Permite a leitura anônima e segura de um compartilhamento público válido pelo seu token, bloqueando links revogados, expirados ou rachas finalizados/arquivados.';

grant execute on function public.get_public_share_by_token(text) to anon, authenticated, service_role;
