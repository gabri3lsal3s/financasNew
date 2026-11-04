-- ================================================================
-- 0064_sync_profile_email_on_auth_change.sql
-- Sincronização automática de e-mail entre auth.users e public.profiles
-- ================================================================

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.email is distinct from new.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

comment on function public.handle_user_email_updated() is
  'Sincroniza automaticamente a coluna email de public.profiles quando o e-mail for atualizado e confirmado em auth.users.';

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_updated();
