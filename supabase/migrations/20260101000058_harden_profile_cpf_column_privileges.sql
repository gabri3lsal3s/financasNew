-- ================================================================
-- 0058_harden_profile_cpf_column_privileges.sql
-- 1) PII: impede que roles de API (anon/authenticated) leiam profiles.cpf
-- 2) Status de assinatura pendente de confirmação do provedor (checkout)
-- ================================================================

revoke select (cpf) on table public.profiles from anon, authenticated;

comment on column public.profiles.cpf is
  'PII (CPF). SELECT revogado de anon/authenticated — acesso apenas via service_role ou funções SECURITY DEFINER. Persistido sanitizado (11 dígitos); UI usa mask_cpf.';

-- Pagamento iniciado mas ainda não confirmado pelo Asaas (cartão pendente / anti-fraude).
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'subscription_status'
      and e.enumlabel = 'incomplete'
  ) then
    alter type public.subscription_status add value 'incomplete';
  end if;
end
$$;
