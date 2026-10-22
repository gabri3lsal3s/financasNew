-- ================================================================
-- 0055_audit_events_sanitization.sql
-- Sanitização e Redação Automática de Trilha de Auditoria (§Fase 5.3)
--
-- Objetivos:
--   1. Blindar a tabela public.audit_events contra vazamento involuntário de
--      PII (CPF) ou segredos operacionais (senhas, tokens, api keys);
--   2. Implementar trigger function before insert em audit_events que:
--      - Mascara qualquer chave 'cpf' utilizando public.mask_cpf();
--      - Redige ('[REDACTED]') campos como password, token, api_key, cvv;
--   3. Conformidade LGPD com o princípio da minimização de dados.
-- ================================================================

create or replace function public.sanitize_audit_payload()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sanitized jsonb;
  v_key text;
  v_val text;
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_sanitized := new.payload;

  -- 1. Mascaramento de CPF se presente no payload
  if v_sanitized ? 'cpf' then
    v_val := v_sanitized ->> 'cpf';
    if v_val is not null and v_val <> '' then
      v_sanitized := jsonb_set(v_sanitized, '{cpf}', to_jsonb(public.mask_cpf(v_val)));
    end if;
  end if;

  -- 2. Redação de campos de alta sensibilidade (senhas, segredos e tokens de pagamento)
  foreach v_key in array array[
    'password', 'senha', 'token', 'secret', 'api_key', 'asaas_api_key',
    'access_token', 'refresh_token', 'auth_token', 'private_key', 'cvv'
  ] loop
    if v_sanitized ? v_key then
      v_sanitized := jsonb_set(v_sanitized, array[v_key], '"[REDACTED]"'::jsonb);
    end if;
  end loop;

  new.payload := v_sanitized;
  return new;
end;
$$;

comment on function public.sanitize_audit_payload() is
  'Higieniza automaticamente o payload de audit_events mascarando CPFs e redigindo tokens/senhas antes da persistência imutável.';

-- 3. Vincula trigger à tabela public.audit_events
drop trigger if exists trg_sanitize_audit_events_payload on public.audit_events;
create trigger trg_sanitize_audit_events_payload
  before insert on public.audit_events
  for each row
  execute function public.sanitize_audit_payload();
