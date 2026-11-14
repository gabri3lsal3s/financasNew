-- ==============================================================================
-- 20260101000122_fix_rpc_syntax_errors_and_foreign_key_indexes.sql
-- Saneamento Integral de Incongruências de Schema, RPCs e Índices no Supabase
--
-- 1. Correção de Erros de Sintaxe e Casts Inválidos em RPCs:
--    - reconcile_expired_subscriptions(): status 'read_only_expired'::public.subscription_status
--      (elimina erro 22P02 por enum 'expired' inexistente).
--    - import_bank_transactions(): remoção de casts para public.payment_method e public.receive_type
--      (elimina erro 42704, colunas são text).
--    - remove_family_member(): ajuste para is_family = false em portfolio_assets
--      (elimina erro 42703 por coluna is_family_shared inexistente).
--    - recalculate_bill_competences(): reescrita de junção no UPDATE com subquery escalar
--      (elimina erro 42P01 por referência inválida à tabela alvo e na cláusula FROM).
--    - delete_current_user_account(): remoção de linked_trip_expense_id e colunas inexistentes em incomes
--      (elimina erro 42703 no expurgo de contas LGPD).
--    - admin_delete_user(): limpeza de referências a tabelas inexistentes.
--    - Descontinuação de funções legadas quebradas: restore_user_backup e restore_user_data.
--
-- 2. Performance e Otimização de Locks:
--    - Criação de 18 índices B-tree cobrindo Foreign Keys anteriormente desindexadas.
--    - Ativação de FORCE ROW LEVEL SECURITY em tabelas de dados do usuário.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. reconcile_expired_subscriptions: uso correto do enum subscription_status
-- ------------------------------------------------------------------------------
create or replace function public.reconcile_expired_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated_count integer := 0;
  v_step_count integer := 0;
begin
  -- Expira assinaturas com cancelamento agendado cujo current_period_end já passou
  with expired_active as (
    update public.user_subscriptions
    set status = 'canceled'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        cancel_at_period_end = false,
        updated_at = now()
    where status = 'active'::public.subscription_status
      and cancel_at_period_end = true
      and current_period_end is not null
      and current_period_end <= now()
    returning id
  )
  select count(*) into v_step_count from expired_active;
  v_updated_count := v_updated_count + v_step_count;

  -- Expira trials vencidos que não possuem plano futuro agendado
  with expired_trials as (
    update public.user_subscriptions
    set status = 'read_only_expired'::public.subscription_status,
        tier = 'read_only'::public.subscription_tier,
        trial_consumed_at = coalesce(trial_consumed_at, now()),
        updated_at = now()
    where tier = 'trial'::public.subscription_tier
      and status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      and trial_ends_at is not null
      and trial_ends_at <= now()
      and scheduled_plan_id is null
    returning id
  )
  select count(*) into v_step_count from expired_trials;
  v_updated_count := v_updated_count + v_step_count;

  return v_updated_count;
end;
$$;

grant execute on function public.reconcile_expired_subscriptions() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. import_bank_transactions: remoção de casts para tipos inexistentes
-- ------------------------------------------------------------------------------
create or replace function public.import_bank_transactions(
  p_expenses jsonb default '[]'::jsonb,
  p_incomes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_exp_inserted int := 0;
  v_exp_skipped int := 0;
  v_inc_inserted int := 0;
  v_inc_skipped int := 0;
  v_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_exp_cat_id uuid;
  v_fallback_inc_cat_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: permissão de escrita em Transações requerida.';
  end if;

  -- Fallbacks defensivos de categoria
  select id into v_fallback_exp_cat_id
  from public.categories
  where user_id = v_user_id and type = 'expense'
  order by name asc limit 1;

  select id into v_fallback_inc_cat_id
  from public.categories
  where user_id = v_user_id and type = 'income'
  order by name asc limit 1;

  -- 1. Importar despesas à vista
  if p_expenses is not null and jsonb_array_length(p_expenses) > 0 then
    for v_item in select * from jsonb_array_elements(p_expenses)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      if v_date is null or v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      end if;

      if v_val is null or v_val <= 0 then
        raise exception 'Valor de despesa deve ser estritamente positivo: %', v_val;
      end if;

      v_cat_id := nullif(v_item->>'category_id', '')::uuid;
      if v_cat_id is null or not exists (
        select 1 from public.categories where id = v_cat_id and user_id = v_user_id
      ) then
        v_cat_id := v_fallback_exp_cat_id;
      end if;

      if v_cat_id is null then
        raise exception 'Nenhuma categoria de despesa disponível para associação.';
      end if;

      insert into public.expenses (
        user_id,
        category_id,
        payment_method,
        value,
        base_amount,
        report_weight,
        date,
        description,
        installments_total,
        installment_number,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        v_cat_id,
        coalesce(nullif(v_item->>'payment_method', ''), 'pix'),
        v_val,
        v_val,
        coalesce((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        coalesce(v_item->>'description', 'Despesa importada'),
        1,
        1,
        nullif(v_item->>'statement_hash', ''),
        true
      )
      on conflict (user_id, statement_hash) where card_id is null and statement_hash is not null
      do nothing
      returning id into v_id;

      if v_id is not null then
        v_exp_inserted := v_exp_inserted + 1;
      else
        v_exp_skipped := v_exp_skipped + 1;
      end if;
    end loop;
  end if;

  -- 2. Importar receitas à vista
  if p_incomes is not null and jsonb_array_length(p_incomes) > 0 then
    for v_item in select * from jsonb_array_elements(p_incomes)
    loop
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      if v_date is null or v_date < '2026-01-01'::date then
        raise exception 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      end if;

      if v_val is null or v_val <= 0 then
        raise exception 'Valor de receita deve ser estritamente positivo: %', v_val;
      end if;

      v_cat_id := nullif(v_item->>'category_id', '')::uuid;
      if v_cat_id is null or not exists (
        select 1 from public.categories where id = v_cat_id and user_id = v_user_id
      ) then
        v_cat_id := v_fallback_inc_cat_id;
      end if;

      if v_cat_id is null then
        raise exception 'Nenhuma categoria de receita disponível para associação.';
      end if;

      insert into public.incomes (
        user_id,
        category_id,
        receive_type,
        value,
        date,
        description,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        v_cat_id,
        coalesce(nullif(v_item->>'receive_type', ''), 'pix'),
        v_val,
        v_date,
        coalesce(v_item->>'description', 'Receita importada'),
        nullif(v_item->>'statement_hash', ''),
        true
      )
      on conflict (user_id, statement_hash) where statement_hash is not null
      do nothing
      returning id into v_id;

      if v_id is not null then
        v_inc_inserted := v_inc_inserted + 1;
      else
        v_inc_skipped := v_inc_skipped + 1;
      end if;
    end loop;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'transactions',
    v_user_id::text,
    'import_bank_statement',
    jsonb_build_object(
      'expenses_inserted', v_exp_inserted,
      'expenses_skipped', v_exp_skipped,
      'incomes_inserted', v_inc_inserted,
      'incomes_skipped', v_inc_skipped
    )
  );

  return jsonb_build_object(
    'success', true,
    'expenses_inserted', v_exp_inserted,
    'expenses_skipped', v_exp_skipped,
    'incomes_inserted', v_inc_inserted,
    'incomes_skipped', v_inc_skipped
  );
end;
$$;

grant execute on function public.import_bank_transactions(jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. remove_family_member: correção do nome da coluna para is_family
-- ------------------------------------------------------------------------------
create or replace function public.remove_family_member(
  p_family_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_member record;
  v_target_member record;
  v_family record;
begin
  -- 1. Autenticação fail-closed
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Usuário inativo ou não autorizado.' using errcode = '42501';
  end if;

  -- 2. Validação de parâmetros
  if p_family_id is null or p_target_user_id is null then
    raise exception 'family_id e target_user_id são obrigatórios.' using errcode = '22023';
  end if;

  -- 3. O titular não pode remover a si mesmo por esta função
  if v_caller_id = p_target_user_id then
    raise exception 'O titular não pode remover a si mesmo. Para dissolver a família, use a exclusão de família.' using errcode = '22023';
  end if;

  -- 4. Verificar se a família existe
  select * into v_family
  from public.families
  where id = p_family_id;

  if v_family is null then
    raise exception 'Família não encontrada.' using errcode = 'P0002';
  end if;

  -- 5. Verificar se quem está chamando é o titular (role = 'owner' ou owner_id)
  select * into v_caller_member
  from public.family_members
  where family_id = p_family_id and user_id = v_caller_id;

  if v_caller_member is null or (v_caller_member.role <> 'owner' and v_family.owner_id <> v_caller_id) then
    raise exception 'Apenas o titular da família tem permissão para remover membros.' using errcode = '42501';
  end if;

  -- 6. Verificar se o membro alvo pertence a esta família
  select * into v_target_member
  from public.family_members
  where family_id = p_family_id and user_id = p_target_user_id;

  if v_target_member is null then
    raise exception 'O usuário especificado não é membro desta família.' using errcode = '42501';
  end if;

  -- 7. Remover o participante da família
  delete from public.family_members
  where family_id = p_family_id and user_id = p_target_user_id;

  -- 8. Revogar convites pendentes que o membro alvo tenha emitido
  update public.family_invites
  set status = 'revoked'
  where family_id = p_family_id and invited_by = p_target_user_id and status = 'pending';

  -- 9. Desvincular ativos compartilhados mantidos pelo membro que foi removido (is_family)
  update public.portfolio_assets
  set family_id = null, is_family = false
  where family_id = p_family_id and user_id = p_target_user_id;

  -- 10. Desvincular despesas e receitas familiares do membro removido
  update public.expenses
  set is_family = false, family_id = null
  where family_id = p_family_id and user_id = p_target_user_id;

  update public.incomes
  set is_family = false, family_id = null
  where family_id = p_family_id and user_id = p_target_user_id;

  -- 11. Registrar evento de auditoria
  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_caller_id,
    'family',
    p_family_id::text,
    'member_removed',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'removed_by', v_caller_id,
      'family_id', p_family_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'family_id', p_family_id,
    'removed_user_id', p_target_user_id
  );
end;
$$;

grant execute on function public.remove_family_member(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. recalculate_bill_competences: reescrita de junção no UPDATE
-- ------------------------------------------------------------------------------
create or replace function public.recalculate_bill_competences(
  p_card_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo cards.';
  end if;

  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão inválido ou não pertence ao usuário';
  end if;

  update public.expenses e
     set bill_competence = to_char(
       case
         when e.date >= public.resolve_competence_boundary(
           e.date,
           coalesce(
             (
               select ov.closing_day
               from public.card_competence_overrides ov
               where ov.card_id = c.id
                 and ov.month = to_char(e.date, 'YYYY-MM')
               limit 1
             ),
             c.closing_day
           )
         )
         then e.date + interval '1 month'
         else e.date
       end,
       'YYYY-MM'
     )
    from public.credit_cards c
   where e.user_id = v_user_id
     and e.card_id = p_card_id
     and c.id = e.card_id;

  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'credit_card', p_card_id::text, 'recalculate_competences',
    jsonb_build_object('updated', v_updated)
  );

  return v_updated;
end;
$$;

grant execute on function public.recalculate_bill_competences(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. delete_current_user_account: remoção de colunas inexistentes e limpeza robusta
-- ------------------------------------------------------------------------------
create or replace function public.delete_current_user_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_host_trip_ids uuid[];
  v_owner_family_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Acesso não autenticado.';
  end if;

  -- 0. Desvincular despesas pessoais conectadas a viagens
  update public.expenses
  set trip_id = null
  where user_id = v_user_id and trip_id is not null;

  -- 1. Viagens onde o usuário é o ANFITRIÃO (host_user_id): expurgo integral
  select array_agg(id) into v_host_trip_ids
  from public.trips
  where host_user_id = v_user_id;

  if v_host_trip_ids is not null and array_length(v_host_trip_ids, 1) > 0 then
    delete from public.trip_settlements where trip_id = any(v_host_trip_ids);
    delete from public.trip_expense_splits where expense_id in (
      select id from public.trip_expenses where trip_id = any(v_host_trip_ids)
    );
    delete from public.trip_expenses where trip_id = any(v_host_trip_ids);
    delete from public.trip_members where trip_id = any(v_host_trip_ids);
    delete from public.trips where id = any(v_host_trip_ids);
  end if;

  -- Viagens onde o usuário é apenas PARTICIPANTE: desvincular PII do membro
  update public.trip_members
  set user_id = null, pix_key = null, pix_key_type = null
  where user_id = v_user_id;

  -- 2. Famílias onde o usuário é o PROPRIETÁRIO (owner_id): expurgo integral
  select array_agg(id) into v_owner_family_ids
  from public.families
  where owner_id = v_user_id;

  if v_owner_family_ids is not null and array_length(v_owner_family_ids, 1) > 0 then
    delete from public.family_settlements where family_id = any(v_owner_family_ids);
    delete from public.family_invites where family_id = any(v_owner_family_ids);
    delete from public.family_members where family_id = any(v_owner_family_ids);
    delete from public.families where id = any(v_owner_family_ids);
  end if;

  -- Famílias onde o usuário era apenas membro ou convidado
  delete from public.family_invites where invited_by = v_user_id or accepted_by = v_user_id;
  delete from public.family_members where user_id = v_user_id;

  -- 3. Compartilhamentos Públicos (public_shares)
  delete from public.public_shares where user_id = v_user_id;

  -- 4. Investimentos e Portfólio (filhos antes dos pais)
  delete from public.portfolio_dividend_dismissals where user_id = v_user_id;
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

  -- 5. Cartões, Lançamentos, Empréstimos e Recorrências
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

  -- 6. Lembretes, Feedbacks, Suporte e Telemetria
  delete from public.reminder_states where user_id = v_user_id;
  delete from public.insight_feedback where user_id = v_user_id;
  delete from public.support_tickets where user_id = v_user_id;
  update public.support_tickets set admin_id = null where admin_id = v_user_id;
  delete from public.app_analytics_events where user_id = v_user_id;

  -- 7. Preferências, Permissões, Assinatura, Configurações e Auditoria
  delete from public.user_preferences where user_id = v_user_id;
  delete from public.user_feature_overrides where user_id = v_user_id;
  update public.user_feature_overrides set granted_by = null where granted_by = v_user_id;
  delete from public.user_module_permissions where user_id = v_user_id;
  update public.user_module_permissions set granted_by = null where granted_by = v_user_id;
  delete from public.user_subscriptions where user_id = v_user_id;
  delete from public.audit_events where user_id = v_user_id;
  update public.access_invites set created_by = null where created_by = v_user_id;
  update public.profiles set approved_by = null where approved_by = v_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = v_user_id;

  -- 8. Perfil e Raiz em auth.users (liberação imediata de credenciais e e-mail)
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function public.delete_current_user_account() to authenticated;

-- ------------------------------------------------------------------------------
-- 6. admin_delete_user: saneamento de expurgo administrativo
-- ------------------------------------------------------------------------------
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
  delete from public.portfolio_dividend_dismissals where user_id = target_user_id;
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

  -- 3. Lembretes, Feedbacks, Suporte e Telemetria
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
  update public.profiles set approved_by = null where approved_by = target_user_id;
  update public.admin_telegram_settings set updated_by = null where updated_by = target_user_id;

  -- 5. Perfil e Raiz em auth.users
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. Descontinuação de funções legadas obsoletas
-- ------------------------------------------------------------------------------
drop function if exists public.restore_user_backup(jsonb);
drop function if exists public.restore_user_data(jsonb);

-- ------------------------------------------------------------------------------
-- 8. Índices B-tree em Foreign Keys para mitigação de Sequential Scans e Locks
-- ------------------------------------------------------------------------------
create index if not exists idx_credit_cards_user_id on public.credit_cards (user_id);
create index if not exists idx_recurrences_card_id on public.recurrences (card_id) where card_id is not null;
create index if not exists idx_portfolio_contributions_asset_id on public.portfolio_contributions (asset_id) where asset_id is not null;
create index if not exists idx_user_subscriptions_plan_id on public.user_subscriptions (plan_id) where plan_id is not null;
create index if not exists idx_user_subscriptions_scheduled_plan_id on public.user_subscriptions (scheduled_plan_id) where scheduled_plan_id is not null;
create index if not exists idx_billing_intents_plan_id on public.billing_intents (plan_id) where plan_id is not null;
create index if not exists idx_support_tickets_admin_id on public.support_tickets (admin_id) where admin_id is not null;
create index if not exists idx_app_analytics_events_user_id on public.app_analytics_events (user_id) where user_id is not null;
create index if not exists idx_trip_expenses_created_by_member on public.trip_expenses (created_by_member_id) where created_by_member_id is not null;
create index if not exists idx_trip_settlements_from_member on public.trip_settlements (from_member_id) where from_member_id is not null;
create index if not exists idx_trip_settlements_to_member on public.trip_settlements (to_member_id) where to_member_id is not null;
create index if not exists idx_user_module_permissions_granted_by on public.user_module_permissions (granted_by) where granted_by is not null;
create index if not exists idx_admin_broadcast_notifications_created_by on public.admin_broadcast_notifications (created_by) where created_by is not null;
create index if not exists idx_access_invites_created_by on public.access_invites (created_by) where created_by is not null;
create index if not exists idx_system_backups_created_by on public.system_backups (created_by) where created_by is not null;
create index if not exists idx_admin_telegram_settings_updated_by on public.admin_telegram_settings (updated_by) where updated_by is not null;
create index if not exists idx_profiles_approved_by on public.profiles (approved_by) where approved_by is not null;
create index if not exists idx_user_feature_overrides_granted_by on public.user_feature_overrides (granted_by) where granted_by is not null;

-- ------------------------------------------------------------------------------
-- 9. Ativação de FORCE ROW LEVEL SECURITY em tabelas de dados do usuário
-- ------------------------------------------------------------------------------
alter table public.portfolio_assets force row level security;
alter table public.portfolio_dividends force row level security;
alter table public.portfolio_contributions force row level security;
alter table public.portfolio_monthly_prices force row level security;
alter table public.user_preferences force row level security;
alter table public.recurrences force row level security;
alter table public.card_payments force row level security;
alter table public.support_tickets force row level security;
alter table public.trips force row level security;
alter table public.trip_members force row level security;
alter table public.trip_expenses force row level security;
alter table public.families force row level security;
alter table public.family_members force row level security;
