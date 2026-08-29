-- ================================================================
-- 0039_security_fixes_and_feature_flag_triggers.sql — Remediações de Segurança e Triggers de Feature Flags
--
-- Objetivos de Segurança:
--   1. Blindagem de Status Ativo na RPC delete_card_payment (P1 - Issue 1):
--      - Adiciona verificação com public.is_current_user_active() para impedir
--        que contas pendentes, suspensas ou banidas excluam pagamentos via RPC.
--   2. Backend Enforcement de Feature Flags via Triggers (P2 - Issue 2):
--      - Garante que a desativação de funcionalidades sensíveis (ex.: 'investments',
--        'loans', 'budgets') bloqueie mutações diretas no PostgreSQL via REST.
--   3. Hardening de Permissões no Schema cron (P3 - Issue 3):
--      - Revoga permissões de leitura/escrita do schema cron para roles públicas.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Blindagem de Status Ativo na RPC delete_card_payment (0011)
-- ----------------------------------------------------------------
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

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
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


-- ----------------------------------------------------------------
-- 2. Trigger Genérica de Validação de Feature Flags no PostgreSQL
-- ----------------------------------------------------------------
create or replace function public.enforce_feature_flag_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_feature_key text := TG_ARGV[0];
begin
  if v_feature_key is not null and not public.is_feature_enabled(v_feature_key) then
    raise exception 'Funcionalidade "%" está temporariamente desativada no sistema.', v_feature_key;
  end if;
  return new;
end;
$$;

-- Aplica trigger em portfolio_assets e portfolio_transactions (flag: 'investments')
drop trigger if exists trg_enforce_feature_investments_assets on public.portfolio_assets;
create trigger trg_enforce_feature_investments_assets
  before insert or update on public.portfolio_assets
  for each row execute function public.enforce_feature_flag_trigger('investments');

drop trigger if exists trg_enforce_feature_investments_transactions on public.portfolio_transactions;
create trigger trg_enforce_feature_investments_transactions
  before insert or update on public.portfolio_transactions
  for each row execute function public.enforce_feature_flag_trigger('investments');

-- Aplica trigger em loans (flag: 'loans')
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'loans') then
    drop trigger if exists trg_enforce_feature_loans on public.loans;
    create trigger trg_enforce_feature_loans
      before insert or update on public.loans
      for each row execute function public.enforce_feature_flag_trigger('loans');
  end if;
end $$;

-- Aplica trigger em budgets (flag: 'budgets')
drop trigger if exists trg_enforce_feature_budgets on public.budgets;
create trigger trg_enforce_feature_budgets
  before insert or update on public.budgets
  for each row execute function public.enforce_feature_flag_trigger('budgets');


-- ----------------------------------------------------------------
-- 3. Hardening de Permissões no Schema cron (se a extensão existir)
-- ----------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    execute 'revoke all on schema cron from public, anon, authenticated;';
    if exists (select 1 from information_schema.tables where table_schema = 'cron' and table_name = 'job') then
      execute 'revoke all on table cron.job from public, anon, authenticated;';
    end if;
    if exists (select 1 from information_schema.tables where table_schema = 'cron' and table_name = 'job_run_details') then
      execute 'revoke all on table cron.job_run_details from public, anon, authenticated;';
    end if;
  end if;
end $$;
