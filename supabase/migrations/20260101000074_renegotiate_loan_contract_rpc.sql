-- ================================================================
-- 0074_renegotiate_loan_contract_rpc.sql
-- RPC para edição, recálculo e repactuação de contratos de crédito
-- com suporte a amortização sobre saldo restante ou reset geral
-- ================================================================

create or replace function public.renegotiate_loan_contract(
  p_loan_id uuid,
  p_name text,
  p_loan_type text,
  p_principal_amount numeric,
  p_interest_rate_monthly numeric,
  p_amortization_system text,
  p_total_installments integer,
  p_start_date date,
  p_strategy text,
  p_installments jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_item jsonb;
  v_new_count integer := 0;
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

  if p_principal_amount <= 0 or p_total_installments < 1 then
    raise exception 'Valores inválidos para contrato de empréstimo';
  end if;

  if p_strategy not in ('amortize_remaining', 'reset') then
    raise exception 'Estratégia de edição inválida';
  end if;

  select * into v_loan
    from public.loans
   where id = p_loan_id and user_id = v_user_id;
  if not found then
    raise exception 'Contrato de empréstimo não encontrado';
  end if;

  -- 1. Trata as parcelas existentes
  if p_strategy = 'reset' then
    -- Exclui todas as parcelas do contrato (reset geral)
    delete from public.debts
     where user_id = v_user_id and installment_group_id = v_loan.installment_group_id;
  else
    -- 'amortize_remaining': exclui apenas as parcelas pendentes (mantém as já pagas/recebidas)
    delete from public.debts
     where user_id = v_user_id
       and installment_group_id = v_loan.installment_group_id
       and paid_at is null;

    -- Atualiza o sufixo de numeração das parcelas quitadas mantidas para o novo total p_total_installments
    -- Por exemplo: 'Financiamento (1/10)' -> 'Financiamento (1/15)'
    update public.debts
       set name = regexp_replace(name, '\((\d+)/\d+\)', format('(\1/%s)', p_total_installments::text))
     where user_id = v_user_id
       and installment_group_id = v_loan.installment_group_id
       and paid_at is not null;
  end if;

  -- 2. Insere as novas parcelas recebidas
  for v_item in select * from jsonb_array_elements(p_installments)
  loop
    insert into public.debts (
      user_id, name, type, amount, due_date,
      installment_group_id, charge_kind
    ) values (
      v_user_id,
      format('%s (%s/%s)', p_name, (v_item->>'installment_number')::text, p_total_installments::text),
      'payable',
      (v_item->>'amount')::numeric,
      (v_item->>'due_date')::date,
      v_loan.installment_group_id,
      'regular'
    );
    v_new_count := v_new_count + 1;
  end loop;

  -- 3. Atualiza os dados mestre do contrato
  update public.loans
     set name = p_name,
         loan_type = p_loan_type,
         principal_amount = p_principal_amount,
         interest_rate_monthly = p_interest_rate_monthly,
         amortization_system = p_amortization_system,
         total_installments = p_total_installments,
         start_date = p_start_date
   where id = p_loan_id and user_id = v_user_id;

  -- 4. Registra evento de auditoria
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'loan', p_loan_id::text, 'renegotiate',
    jsonb_build_object(
      'name', p_name,
      'strategy', p_strategy,
      'principal_amount', p_principal_amount,
      'interest_rate_monthly', p_interest_rate_monthly,
      'total_installments', p_total_installments,
      'new_installments_count', v_new_count
    )
  );

  return true;
end;
$$;

revoke all on function public.renegotiate_loan_contract(uuid, text, text, numeric, numeric, text, integer, date, text, jsonb) from public;
grant execute on function public.renegotiate_loan_contract(uuid, text, text, numeric, numeric, text, integer, date, text, jsonb) to authenticated;
