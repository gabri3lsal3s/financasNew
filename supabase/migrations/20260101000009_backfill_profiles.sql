-- ================================================================
-- 0009_backfill_profiles.sql — Auto-cura de contas órfãs (F11)
--
-- Contexto: o trigger `on_auth_user_created` (0003) cria a linha em
-- `public.profiles` no signup. Contas criadas ANTES desse trigger (ou
-- quando ele não existia no banco) ficam órfãs: toda escrita em tabelas
-- user-scoped falha na FK `user_id → profiles(id)` (código 23503,
-- exibido como "Dados inválidos" pelo gateway de erros).
--
-- Esta migração é idempotente (on conflict do nothing) e cobre:
--   • profiles — linha de identidade ausente;
--   • user_preferences — padrões do usuário ausentes.
-- O app também se auto-cura em runtime (ensureOwnProfile), para bancos
-- cujo backfill ainda não foi aplicado.
-- ================================================================

insert into public.profiles (id, name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', ''),
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select u.id
from auth.users u
where not exists (select 1 from public.user_preferences up where up.user_id = u.id)
on conflict (user_id) do nothing;
