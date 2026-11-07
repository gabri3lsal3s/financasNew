-- ---------------------------------------------------------------------------
-- 20260101000088_quick_expense_tokens.sql
-- Módulo de Captura Rápida Universal: Tokens de Atalhos iOS / Webhook
-- Armazena exclusivamente o hash criptográfico (SHA-256) dos tokens gerados,
-- garantindo segurança em repouso e autenticação fail-closed.
-- ---------------------------------------------------------------------------

create table if not exists public.user_quick_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  name text not null default 'Atalho iOS',
  scopes text[] not null default array['expense:write'],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Habilita RLS
alter table public.user_quick_tokens enable row level security;

-- Políticas de segurança fail-closed
drop policy if exists user_quick_tokens_select_own on public.user_quick_tokens;
create policy user_quick_tokens_select_own on public.user_quick_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists user_quick_tokens_insert_own on public.user_quick_tokens;
create policy user_quick_tokens_insert_own on public.user_quick_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists user_quick_tokens_update_own on public.user_quick_tokens;
create policy user_quick_tokens_update_own on public.user_quick_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_quick_tokens_delete_own on public.user_quick_tokens;
create policy user_quick_tokens_delete_own on public.user_quick_tokens
  for delete
  using (auth.uid() = user_id);

-- Índices de performance
create index if not exists idx_user_quick_tokens_user_id on public.user_quick_tokens(user_id);
create index if not exists idx_user_quick_tokens_hash on public.user_quick_tokens(token_hash) where revoked_at is null;

-- RPC: Criação de Token Rápido
create or replace function public.create_user_quick_token(
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_scopes text[] default array['expense:write']
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_new_record record;
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Hash de token inválido.' using errcode = '22023';
  end if;

  if p_token_prefix is null or length(p_token_prefix) < 4 then
    raise exception 'Prefixo de token inválido.' using errcode = '22023';
  end if;

  insert into public.user_quick_tokens (
    user_id,
    token_hash,
    token_prefix,
    name,
    scopes
  )
  values (
    v_caller_id,
    p_token_hash,
    p_token_prefix,
    coalesce(nullif(trim(p_name), ''), 'Atalho iOS'),
    coalesce(p_scopes, array['expense:write'])
  )
  returning id, user_id, token_prefix, name, scopes, created_at into v_new_record;

  return jsonb_build_object(
    'id', v_new_record.id,
    'token_prefix', v_new_record.token_prefix,
    'name', v_new_record.name,
    'scopes', v_new_record.scopes,
    'created_at', v_new_record.created_at
  );
end;
$$;

-- RPC: Revogação de Token
create or replace function public.revoke_user_quick_token(
  p_token_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_rows_affected integer;
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if p_token_id is null then
    raise exception 'ID do token é obrigatório.' using errcode = '22023';
  end if;

  update public.user_quick_tokens
  set revoked_at = now()
  where id = p_token_id
    and user_id = v_caller_id
    and revoked_at is null;

  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;

-- RPC: Listagem de Tokens do Usuário
create or replace function public.list_user_quick_tokens()
returns table (
  id uuid,
  token_prefix text,
  name text,
  scopes text[],
  last_used_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    t.id,
    t.token_prefix,
    t.name,
    t.scopes,
    t.last_used_at,
    t.created_at
  from public.user_quick_tokens t
  where t.user_id = auth.uid()
    and t.revoked_at is null
  order by t.created_at desc;
$$;
