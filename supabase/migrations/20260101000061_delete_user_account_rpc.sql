-- ---------------------------------------------------------------------------
-- 20260101000061_delete_user_account_rpc.sql
-- Expurgo definitivo de conta de usuário (LGPD Art. 18, VI - Direito ao Esquecimento)
-- Procedimento transacional public.delete_current_user_account()
-- Limpeza profunda em cascata e em ordem topológica reversa em todas as tabelas e em auth.users
-- ---------------------------------------------------------------------------

-- 1. Procedimento de autoexclusão da conta pelo próprio usuário autenticado
create or replace function public.delete_current_user_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  -- 1. Investimentos e Portfólio (filhos antes dos pais)
  delete from public.portfolio_monthly_prices where user_id = v_user_id;
  delete from public.portfolio_transactions where user_id = v_user_id;
  delete from public.portfolio_contributions where user_id = v_user_id;
  delete from public.portfolio_dividends where user_id = v_user_id;
  delete from public.portfolio_snapshots where user_id = v_user_id;
  delete from public.allocation_presets where user_id = v_user_id;
  delete from public.allocation_targets where user_id = v_user_id;
  delete from public.class_targets where user_id = v_user_id;
  delete from public.sector_targets where user_id = v_user_id;
  delete from public.asset_prices where user_id = v_user_id;
  delete from public.cash_checkpoints where user_id = v_user_id;
  delete from public.portfolio_assets where user_id = v_user_id;

  -- 2. Cartões, Lançamentos, Empréstimos e Recorrências
  delete from public.card_competence_overrides where card_id in (select id from public.credit_cards where user_id = v_user_id);
  delete from public.card_payments where card_id in (select id from public.credit_cards where user_id = v_user_id);
  delete from public.recurrence_skips where recurrence_id in (select id from public.recurrences where user_id = v_user_id);
  delete from public.expenses where user_id = v_user_id;
  delete from public.incomes where user_id = v_user_id;
  delete from public.recurrences where user_id = v_user_id;
  delete from public.debts where user_id = v_user_id;
  delete from public.loans where user_id = v_user_id;
  delete from public.budgets where user_id = v_user_id;
  delete from public.income_goals where user_id = v_user_id;
  delete from public.credit_cards where user_id = v_user_id;
  delete from public.categories where user_id = v_user_id;

  -- 3. Extratos bancários, Lembretes, Feedbacks, Suporte e Telemetria
  if to_regclass('public.bank_statement_import_batches') is not null then
    if to_regclass('public.bank_statement_import_items') is not null then
      execute 'delete from public.bank_statement_import_items where batch_id in (select id from public.bank_statement_import_batches where user_id = $1)' using v_user_id;
    end if;
    execute 'delete from public.bank_statement_import_batches where user_id = $1' using v_user_id;
  end if;
  delete from public.reminder_states where user_id = v_user_id;
  delete from public.insight_feedback where user_id = v_user_id;
  delete from public.support_tickets where user_id = v_user_id;
  update public.support_tickets set admin_id = null where admin_id = v_user_id;
  delete from public.app_analytics_events where user_id = v_user_id;

  -- 4. Preferências, Permissões, Assinatura, Configurações e Auditoria
  delete from public.user_preferences where user_id = v_user_id;
  delete from public.user_feature_overrides where user_id = v_user_id;
  update public.user_feature_overrides set granted_by = null where granted_by = v_user_id;
  delete from public.user_module_permissions where user_id = v_user_id;
  update public.user_module_permissions set granted_by = null where granted_by = v_user_id;
  delete from public.user_subscriptions where user_id = v_user_id;
  delete from public.audit_events where user_id = v_user_id;
  update public.access_invites set created_by = null where created_by = v_user_id;
  update public.access_invites set approved_by = null where approved_by = v_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = v_user_id;

  -- 5. Perfil e Raiz em auth.users (liberação imediata de credenciais e e-mail)
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_current_user_account() from public;
grant execute on function public.delete_current_user_account() to authenticated;

comment on function public.delete_current_user_account() is
  'Exclui integralmente a conta do usuário autenticado e todos os seus dados em ordem topológica reversa (LGPD Art. 18, VI - Direito ao Esquecimento).';

-- 2. Aliases de compatibilidade: delete_own_account() e delete_user_account()
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.delete_current_user_account();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Alias para public.delete_current_user_account() garantindo retrocompatibilidade.';

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.delete_current_user_account();
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;

comment on function public.delete_user_account() is
  'Alias para public.delete_current_user_account() conforme Founder Runbook LGPD.';

-- 3. Procedimento de exclusão administrativa com suporte a todas as tabelas
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  select role into v_caller_role from public.profiles where id = v_caller_id;
  if v_caller_role is distinct from 'superadmin' then
    raise exception 'Apenas superadministradores podem excluir contas de outros usuários.';
  end if;

  if target_user_id = v_caller_id then
    raise exception 'Para excluir sua própria conta, utilize o fluxo de autoexclusão.';
  end if;

  -- 1. Investimentos e Portfólio (filhos antes dos pais)
  delete from public.portfolio_monthly_prices where user_id = target_user_id;
  delete from public.portfolio_transactions where user_id = target_user_id;
  delete from public.portfolio_contributions where user_id = target_user_id;
  delete from public.portfolio_dividends where user_id = target_user_id;
  delete from public.portfolio_snapshots where user_id = target_user_id;
  delete from public.allocation_presets where user_id = target_user_id;
  delete from public.allocation_targets where user_id = target_user_id;
  delete from public.class_targets where user_id = target_user_id;
  delete from public.sector_targets where user_id = target_user_id;
  delete from public.asset_prices where user_id = target_user_id;
  delete from public.cash_checkpoints where user_id = target_user_id;
  delete from public.portfolio_assets where user_id = target_user_id;

  -- 2. Cartões, Lançamentos, Empréstimos e Recorrências
  delete from public.card_competence_overrides where card_id in (select id from public.credit_cards where user_id = target_user_id);
  delete from public.card_payments where card_id in (select id from public.credit_cards where user_id = target_user_id);
  delete from public.recurrence_skips where recurrence_id in (select id from public.recurrences where user_id = target_user_id);
  delete from public.expenses where user_id = target_user_id;
  delete from public.incomes where user_id = target_user_id;
  delete from public.recurrences where user_id = target_user_id;
  delete from public.debts where user_id = target_user_id;
  delete from public.loans where user_id = target_user_id;
  delete from public.budgets where user_id = target_user_id;
  delete from public.income_goals where user_id = target_user_id;
  delete from public.credit_cards where user_id = target_user_id;
  delete from public.categories where user_id = target_user_id;

  -- 3. Extratos bancários, Lembretes, Feedbacks, Suporte e Telemetria
  if to_regclass('public.bank_statement_import_batches') is not null then
    if to_regclass('public.bank_statement_import_items') is not null then
      execute 'delete from public.bank_statement_import_items where batch_id in (select id from public.bank_statement_import_batches where user_id = $1)' using target_user_id;
    end if;
    execute 'delete from public.bank_statement_import_batches where user_id = $1' using target_user_id;
  end if;
  delete from public.reminder_states where user_id = target_user_id;
  delete from public.insight_feedback where user_id = target_user_id;
  delete from public.support_tickets where user_id = target_user_id;
  update public.support_tickets set admin_id = null where admin_id = target_user_id;
  delete from public.app_analytics_events where user_id = target_user_id;

  -- 4. Preferências, Permissões, Assinatura, Configurações e Auditoria
  delete from public.user_preferences where user_id = target_user_id;
  delete from public.user_feature_overrides where user_id = target_user_id;
  update public.user_feature_overrides set granted_by = null where granted_by = target_user_id;
  delete from public.user_module_permissions where user_id = target_user_id;
  update public.user_module_permissions set granted_by = null where granted_by = target_user_id;
  delete from public.user_subscriptions where user_id = target_user_id;
  delete from public.audit_events where user_id = target_user_id;
  update public.access_invites set created_by = null where created_by = target_user_id;
  update public.access_invites set approved_by = null where approved_by = target_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = target_user_id;

  -- 5. Perfil e Raiz em auth.users
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

comment on function public.admin_delete_user(uuid) is
  'Permite a superadministradores excluir permanentemente contas de usuários da tabela auth.users com limpeza em cascata.';
