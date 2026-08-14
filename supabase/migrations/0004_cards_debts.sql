-- ================================================================
-- 0004_cards_debts.sql — RPCs de cartões (Entrega 5, Fase 2)
--
-- Auditados conforme ESPECIFICAÇÃO §1.5/D2: pagamentos de fatura e
-- alteração de regras de cartão. Exclusão hard de cartão também
-- audita (D2 — hard deletes). Tudo security definer + search_path
-- fixo + ownership via auth.uid().
-- ================================================================

-- ----------------------------------------------------------------
-- RPC: create_card_payment — pagamento de fatura (+ audit)
-- O estorno NÃO passa por aqui: usa create_refund (0003), que cria
-- a renda automática [REFUND] (ESPECIFICAÇÃO §3.3.3).
-- ----------------------------------------------------------------
create or replace function public.create_card_payment(
  p_card_id uuid,
  p_competence_month text,
  p_amount numeric,
  p_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not exists (
    select 1 from public.credit_cards
     where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Cartão inválido';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_competence_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida (esperado YYYY-MM)';
  end if;

  insert into public.card_payments (
    user_id, card_id, competence_month, amount, date, note, is_refund
  ) values (
    v_user_id, p_card_id, p_competence_month, p_amount, p_date, p_note, false
  )
  returning id into v_payment_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', v_payment_id::text, 'create',
    jsonb_build_object('card_id', p_card_id, 'competence_month', p_competence_month, 'amount', p_amount)
  );

  return v_payment_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: update_credit_card — alteração de regras do cartão (+ audit)
-- O recálculo de competências em lote é ação separada e explícita
-- (recalculate_bill_competences, 0003) com confirmação na UI (D3).
-- ----------------------------------------------------------------
create or replace function public.update_credit_card(
  p_card_id uuid,
  p_name text,
  p_brand text,
  p_credit_limit numeric,
  p_closing_day integer,
  p_due_day integer,
  p_color text,
  p_is_active boolean
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
  if v_user_id is null then
    raise exception 'Não autenticado';
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

  update public.credit_cards
     set name = p_name,
         brand = p_brand,
         credit_limit = p_credit_limit,
         closing_day = p_closing_day,
         due_day = p_due_day,
         color = p_color,
         is_active = coalesce(p_is_active, true)
   where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'update',
    jsonb_build_object(
      'closing_day', jsonb_build_object('from', v_old.closing_day, 'to', p_closing_day),
      'due_day', jsonb_build_object('from', v_old.due_day, 'to', p_due_day),
      'is_active', p_is_active
    )
  );
end;
$$;

-- ----------------------------------------------------------------
-- RPC: delete_credit_card — exclusão definitiva (+ audit, D2)
-- Bloqueada pelo banco quando há lançamentos/pagamentos vinculados
-- (FK). A ação primária da UI é desativar (is_active = false) —
-- desativar NÃO apaga histórico (ESPECIFICAÇÃO §3.3.1).
-- ----------------------------------------------------------------
create or replace function public.delete_credit_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not exists (
    select 1 from public.credit_cards
     where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Cartão não encontrado';
  end if;

  delete from public.credit_cards where id = p_card_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (v_user_id, 'credit_card', p_card_id::text, 'delete', '{}'::jsonb);
end;
$$;
