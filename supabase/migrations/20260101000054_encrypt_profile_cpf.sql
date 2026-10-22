-- ================================================================
-- 0054_encrypt_profile_cpf.sql
-- Blindagem de PII (CPF) e Funções de Mascaramento (§Fase 5.3)
--
-- Objetivos:
--   1. Criar função utilitária pura de mascaramento public.mask_cpf(text)
--      para proteção visual e anti-vazamento (padrão ***.***.789-**).
--   2. Adicionar trigger de integridade e sanitização em public.profiles:
--      - Remove formatações acidentais e mantém estritamente 11 dígitos numéricos;
--      - Valida que o CPF fornecido atenda aos requisitos de dígitos da Receita Federal.
--   3. Garantir 'set search_path = public, pg_temp' em todas as funções criadas.
-- ================================================================

-- 1. Função pura para mascaramento de CPF no banco
create or replace function public.mask_cpf(p_cpf text)
returns text
language plpgsql
immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_digits text;
begin
  if p_cpf is null or trim(p_cpf) = '' then
    return null;
  end if;

  v_digits := regexp_replace(p_cpf, '\D', '', 'g');

  if length(v_digits) < 11 then
    return '***.***.***-**';
  end if;

  return '***.***.' || substr(v_digits, 7, 3) || '-**';
end;
$$;

comment on function public.mask_cpf(text) is
  'Mascara um CPF brasileiro preservando a privacidade (anti-shoulder surfing) no formato ***.***.789-**';

-- 2. Trigger function de validação e sanitização estrita de CPF em profiles
create or replace function public.sanitize_profile_cpf()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_digits text;
  v_sum integer := 0;
  v_rem integer := 0;
  v_first_check integer := 0;
  v_second_check integer := 0;
  v_i integer;
begin
  if new.cpf is null or trim(new.cpf) = '' then
    new.cpf := null;
    return new;
  end if;

  v_digits := regexp_replace(new.cpf, '\D', '', 'g');

  if length(v_digits) <> 11 then
    raise exception 'CPF inválido: deve conter exatamente 11 dígitos numéricos.';
  end if;

  -- Rejeita sequências de dígitos idênticos (00000000000, 11111111111, etc.)
  if v_digits in (
    '00000000000', '11111111111', '22222222222', '33333333333', '44444444444',
    '55555555555', '66666666666', '77777777777', '88888888888', '99999999999'
  ) then
    raise exception 'CPF inválido: sequência homogênea não permitida.';
  end if;

  -- Primeiro dígito verificador
  v_sum := 0;
  for v_i in 1..9 loop
    v_sum := v_sum + (substr(v_digits, v_i, 1)::integer * (11 - v_i));
  end loop;
  v_rem := 11 - (v_sum % 11);
  if v_rem >= 10 then
    v_first_check := 0;
  else
    v_first_check := v_rem;
  end if;

  if v_first_check <> substr(v_digits, 10, 1)::integer then
    raise exception 'CPF inválido: primeiro dígito verificador incorreto.';
  end if;

  -- Segundo dígito verificador
  v_sum := 0;
  for v_i in 1..10 loop
    v_sum := v_sum + (substr(v_digits, v_i, 1)::integer * (12 - v_i));
  end loop;
  v_rem := 11 - (v_sum % 11);
  if v_rem >= 10 then
    v_second_check := 0;
  else
    v_second_check := v_rem;
  end if;

  if v_second_check <> substr(v_digits, 11, 1)::integer then
    raise exception 'CPF inválido: segundo dígito verificador incorreto.';
  end if;

  -- Atribui apenas os dígitos normalizados e validados
  new.cpf := v_digits;
  return new;
end;
$$;

-- 3. Vincula trigger à tabela public.profiles
drop trigger if exists trg_sanitize_profile_cpf on public.profiles;
create trigger trg_sanitize_profile_cpf
  before insert or update on public.profiles
  for each row
  execute function public.sanitize_profile_cpf();
