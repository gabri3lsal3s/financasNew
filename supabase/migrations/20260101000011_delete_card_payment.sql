-- ================================================================
-- 0011_delete_card_payment.sql — RPC transacional de exclusão de
-- pagamento/estorno de fatura
--
-- Motivação (auditoria arquitetural — camada de dados):
--   • Antes, o cliente executava 2 DELETEs sequenciais (renda [REFUND]
--     e depois o pagamento) sem transação — se o segundo falhasse, a
--     renda do estorno sumia e o pagamento permanecia (inconsistência).
--   • AGENTS §5: escritas compostas devem usar RPC transacional.
--   • O servidor valida ownership (auth.uid()) antes de apagar.
--   • Auditado conforme D2 (hard deletes).
-- ================================================================

create or replace function public.delete_card_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.card_payments%rowtype;
  v_income_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_payment
    from public.card_payments
   where id = p_payment_id and user_id = v_user_id;
  if not found then
    raise exception 'Pagamento não encontrado';
  end if;

  -- Estorno → remove a renda automática correspondente ([REFUND]{id}).
  -- Pagamento normal não gera renda; a exclusão é inofensiva (0 linhas).
  delete from public.incomes
   where user_id = v_user_id
     and source_ref = '[REFUND]' || p_payment_id::text;
  get diagnostics v_income_deleted = row_count;

  delete from public.card_payments
   where id = p_payment_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'card_payment', p_payment_id::text, 'delete',
    jsonb_build_object(
      'is_refund', v_payment.is_refund,
      'income_deleted', v_income_deleted
    )
  );
end;
$$;
