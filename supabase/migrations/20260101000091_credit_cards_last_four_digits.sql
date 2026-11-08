-- ============================================================================
-- Migração: 20260101000091_credit_cards_last_four_digits.sql
-- Plano 09: Inteligência Adaptativa Multi-Bancos & Resolução de Cartões (§1)
-- Adiciona a coluna last_four_digits na tabela credit_cards e atualiza o RPC update_credit_card
-- ============================================================================

-- 1. Adição da coluna last_four_digits com constraint segura
alter table public.credit_cards
  add column if not exists last_four_digits varchar(4);

-- Assegura que apenas 4 dígitos numéricos sejam aceitos quando preenchido
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_cards_last_four_digits_check'
  ) then
    alter table public.credit_cards
      add constraint credit_cards_last_four_digits_check
      check (last_four_digits is null or last_four_digits ~ '^[0-9]{4}$');
  end if;
end $$;

comment on column public.credit_cards.last_four_digits is
  'Últimos 4 dígitos opcionais do cartão para reconhecimento automático em notificações e carteiras digitais (§11.4).';

-- 2. Atualização da função RPC update_credit_card com suporte a p_last_four_digits
-- Removemos a assinatura anterior (8 parâmetros) para evitar erro de ambiguidade (42725)
drop function if exists public.update_credit_card(
  uuid,
  text,
  text,
  numeric,
  integer,
  integer,
  text,
  boolean
);

create or replace function public.update_credit_card(
  p_card_id uuid,
  p_name text,
  p_brand text,
  p_credit_limit numeric,
  p_closing_day integer,
  p_due_day integer,
  p_color text,
  p_is_active boolean,
  p_last_four_digits varchar(4) default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.credit_cards%rowtype;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  select * into v_old
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;
  if not found then
    raise exception 'Cartão não encontrado';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Nome do cartão é obrigatório';
  end if;
  if p_closing_day is null or p_closing_day not between 1 and 31 then
    raise exception 'Dia de fechamento deve estar entre 1 e 31';
  end if;
  if p_due_day is null or p_due_day not between 1 and 31 then
    raise exception 'Dia de vencimento deve estar entre 1 e 31';
  end if;
  if p_credit_limit is not null and p_credit_limit < 0 then
    raise exception 'Limite não pode ser negativo';
  end if;
  if p_last_four_digits is not null and p_last_four_digits !~ '^[0-9]{4}$' then
    raise exception 'Os últimos dígitos devem conter exatamente 4 números';
  end if;

  update public.credit_cards
     set name = p_name,
         brand = p_brand,
         credit_limit = p_credit_limit,
         closing_day = p_closing_day,
         due_day = p_due_day,
         color = p_color,
         is_active = coalesce(p_is_active, true),
         last_four_digits = p_last_four_digits
   where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'update',
    jsonb_build_object(
      'closing_day', jsonb_build_object('from', v_old.closing_day, 'to', p_closing_day),
      'due_day', jsonb_build_object('from', v_old.due_day, 'to', p_due_day),
      'is_active', p_is_active,
      'last_four_digits', p_last_four_digits
    )
  );
end;
$$;

revoke all on function public.update_credit_card(uuid, text, text, numeric, integer, integer, text, boolean, varchar) from public;
grant execute on function public.update_credit_card(uuid, text, text, numeric, integer, integer, text, boolean, varchar) to authenticated;
