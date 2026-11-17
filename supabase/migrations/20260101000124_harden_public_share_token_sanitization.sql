-- ---------------------------------------------------------------------------
-- 20260101000124_harden_public_share_token_sanitization.sql
-- RPC segura de leitura de compartilhamento público com sanitização defensiva
-- Tolera pontuações de final de mensagem (WhatsApp/Telegram: '.', ',', ';', ':', '!')
-- e barras acidentais ('/'), garantindo consulta anônima e autenticada confiável.
-- ---------------------------------------------------------------------------

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
  --    Remove espaços, remove query strings e hashes anexados, remove barras e pontuações finais
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

  -- 2. Localizar compartilhamento válido, não revogado e não expirado
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
  'Permite a leitura anônima e segura de um compartilhamento público válido pelo seu token, com sanitização defensiva contra pontuações de mensageiros.';

grant execute on function public.get_public_share_by_token(text) to anon, authenticated, service_role;
