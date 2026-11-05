-- ================================================================
-- 0073_delete_debt_installments_and_loan_rpcs.sql
-- RPCs para exclusão em lote de parcelas de dívidas e exclusão
-- de contratos de crédito com remoção em cascata de parcelas
-- ================================================================

-- ----------------------------------------------------------------
-- 1. RPC: delete_debt_installments (Módulo: debts)
-- ----------------------------------------------------------------
create or replace function public.delete_debt_installments(
  p_debt_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  select * into v_debt
    from public.debts
   where id = p_debt_id and user_id = v_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;

  if p_mode = 'single' or v_debt.installment_group_id is null then
    delete from public.debts where id = p_debt_id and user_id = v_user_id;
    v_deleted := 1;
  elsif p_mode = 'all' then
    delete from public.debts
     where user_id = v_user_id and installment_group_id = v_debt.installment_group_id;
    get diagnostics v_deleted = row_count;

    -- Se o grupo pertence a um contrato de empréstimo, remove o contrato também para não deixar órfão
    delete from public.loans
     where user_id = v_user_id and installment_group_id = v_debt.installment_group_id;
  elsif p_mode = 'subsequent' then
    delete from public.debts
     where user_id = v_user_id
       and installment_group_id = v_debt.installment_group_id
       and due_date >= v_debt.due_date;
    get diagnostics v_deleted = row_count;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'debt', p_debt_id::text, 'delete',
    jsonb_build_object(
      'mode', p_mode,
      'deleted', v_deleted,
      'installment_group_id', v_debt.installment_group_id
    )
  );

  return v_deleted;
end;
$$;

revoke all on function public.delete_debt_installments(uuid, text) from public;
grant execute on function public.delete_debt_installments(uuid, text) to authenticated;

-- ----------------------------------------------------------------
-- 2. RPC: delete_loan_contract (Módulo: debts)
-- ----------------------------------------------------------------
create or replace function public.delete_loan_contract(
  p_loan_id uuid,
  p_delete_debts boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_deleted_debts integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo debts.';
  end if;

  select * into v_loan
    from public.loans
   where id = p_loan_id and user_id = v_user_id;
  if not found then
    raise exception 'Contrato de empréstimo não encontrado';
  end if;

  if coalesce(p_delete_debts, true) then
    delete from public.debts
     where user_id = v_user_id and installment_group_id = v_loan.installment_group_id;
    get diagnostics v_deleted_debts = row_count;
  end if;

  delete from public.loans
   where id = p_loan_id and user_id = v_user_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'loan', p_loan_id::text, 'delete',
    jsonb_build_object(
      'name', v_loan.name,
      'deleted_debts', v_deleted_debts,
      'installment_group_id', v_loan.installment_group_id
    )
  );

  return true;
end;
$$;

revoke all on function public.delete_loan_contract(uuid, boolean) from public;
grant execute on function public.delete_loan_contract(uuid, boolean) to authenticated;
