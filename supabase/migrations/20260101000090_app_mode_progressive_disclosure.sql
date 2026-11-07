-- ==============================================================================
-- Migration: 20260101000090_app_mode_progressive_disclosure.sql
-- Plano 07: Experiência Adaptativa, Divulgação Progressiva & Perfis de Visualização
-- (Modo Essencial vs Modo Investidor)
-- ==============================================================================

-- 1. Adicionar coluna app_mode à tabela user_preferences com default 'investor'
alter table public.user_preferences
  add column if not exists app_mode text not null default 'investor'
  check (app_mode in ('essential', 'investor'));

comment on column public.user_preferences.app_mode is 
  'Perfil de visualização da aplicação: essential (foco em contas/faturas) ou investor (carteira completa e aportes).';

-- 2. Atualizar handle_new_user() para respeitar a escolha do onboarding do cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_count integer;
  v_invite_code text;
  v_invite record;
  v_initial_role public.user_role := 'user'::public.user_role;
  v_initial_status public.user_status := 'active'::public.user_status;
  v_approved_at timestamptz := now();
  v_target_tier public.subscription_tier := 'trial'::public.subscription_tier;
  v_target_plan text := 'trial';
  v_trial_days integer := 30;
  v_trial_ends_at timestamptz := now() + interval '30 days';
  v_sub_status public.subscription_status := 'trialing'::public.subscription_status;
  v_module_key text;
  v_access_val text;
  v_app_mode text := 'investor';
begin
  select count(*) into v_user_count from public.profiles;

  -- Se for o primeiríssimo usuário do sistema, vira superadmin e recebe plano Vitalício
  if v_user_count = 0 then
    v_initial_role := 'superadmin'::public.user_role;
    v_initial_status := 'active'::public.user_status;
    v_approved_at := now();
    v_target_tier := 'lifetime'::public.subscription_tier;
    v_target_plan := 'lifetime';
    v_sub_status := 'active'::public.subscription_status;
    v_trial_ends_at := null;
  else
    -- Verifica se foi passado código de convite nos metadados
    v_invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));

    if v_invite_code <> '' then
      select * into v_invite
      from public.access_invites
      where upper(code) = upper(v_invite_code)
        and is_revoked = false
        and (expires_at is null or expires_at > now())
        and used_count < max_uses
      for update;

      if found then
        -- Validação de target_email se restrito
        if v_invite.target_email is null or lower(v_invite.target_email) = lower(new.email) then
          v_target_tier := v_invite.target_tier;
          v_target_plan := case
            when v_target_tier = 'lifetime'::public.subscription_tier then 'lifetime'
            when v_target_tier = 'pro_annual'::public.subscription_tier then 'pro_annual'
            when v_target_tier = 'pro_monthly'::public.subscription_tier then 'pro_monthly'
            else 'trial'
          end;

          if v_target_tier = 'lifetime'::public.subscription_tier or v_target_tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
            v_sub_status := 'active'::public.subscription_status;
            v_trial_ends_at := null;
          else
            v_trial_days := coalesce(v_invite.custom_trial_days, 30);
            v_trial_ends_at := now() + (v_trial_days || ' days')::interval;
            v_sub_status := 'trialing'::public.subscription_status;
          end if;

          -- Consome o uso do convite
          update public.access_invites
          set used_count = used_count + 1
          where id = v_invite.id;
        end if;
      end if;
    end if;
  end if;

  -- Determina app_mode a partir dos metadados de cadastro
  if (new.raw_user_meta_data ->> 'app_mode') in ('essential', 'investor') then
    v_app_mode := new.raw_user_meta_data ->> 'app_mode';
  end if;

  -- 1. Cria o perfil do usuário
  insert into public.profiles (id, name, email, role, status, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    v_initial_role,
    v_initial_status,
    v_approved_at
  )
  on conflict (id) do nothing;

  -- 2. Cria a assinatura associada
  insert into public.user_subscriptions (
    user_id,
    plan_id,
    tier,
    status,
    trial_ends_at
  )
  values (
    new.id,
    v_target_plan,
    v_target_tier,
    v_sub_status,
    v_trial_ends_at
  )
  on conflict (user_id) do nothing;

  -- 3. Aplica os overrides de módulos do convite (se houver)
  if v_invite.id is not null and v_invite.module_grants is not null and v_invite.module_grants <> '{}'::jsonb then
    for v_module_key, v_access_val in
      select key, value#>>'{}' from jsonb_each(v_invite.module_grants)
    loop
      if exists (select 1 from public.system_features where key = v_module_key) then
        insert into public.user_module_permissions (user_id, module_key, access_level)
        values (new.id, v_module_key, v_access_val::public.access_level)
        on conflict (user_id, module_key) do update
        set access_level = excluded.access_level;
      end if;
    end loop;
  end if;

  -- 4. Cria preferências padrões do usuário respeitando o modo de onboarding
  insert into public.user_preferences (user_id, app_mode)
  values (new.id, v_app_mode)
  on conflict (user_id) do nothing;

  -- 5. Seed das 11 categorias canônicas padrão brasileiras
  insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
  values
    -- Despesas Essenciais (Necessidades 50%)
    (new.id, 'expense', 'Alimentação', 'alimentacao', '#DDA726', false, true),
    (new.id, 'expense', 'Moradia', 'moradia', '#8B5CF6', false, true),
    (new.id, 'expense', 'Transporte', 'transporte', '#3B82F6', false, true),
    (new.id, 'expense', 'Saúde', 'saude', '#EF4444', false, true),
    (new.id, 'expense', 'Educação', 'educacao', '#2A9D8F', false, true),
    -- Despesas de Estilo de Vida (Desejos 30% / Assinaturas)
    (new.id, 'expense', 'Lazer', 'lazer', '#EC4899', false, true),
    (new.id, 'expense', 'Compras', 'compras', '#06B6D4', false, true),
    (new.id, 'expense', 'Assinaturas', 'assinaturas', '#6366F1', false, true),
    -- Receitas
    (new.id, 'income', 'Salário', 'salario', '#10B981', false, true),
    (new.id, 'income', 'Investimentos', 'investimentos', '#3B82F6', false, true),
    (new.id, 'income', 'Outras Rendas', 'salario', '#8B5CF6', false, true)
  on conflict (user_id, type, name) do nothing;

  return new;
end;
$$;

-- 3. Atualizar restore_user_data() para incluir app_mode na restauração de preferências
create or replace function public.restore_user_data(v_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select public.is_current_user_active()) then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  -- 1) Limpa dados prévios do usuário em ordem de dependência
  delete from public.split_signals where expense_id in (select id from public.expenses where user_id = v_uid);
  delete from public.signal_split_payments where signal_id in (
    select id from public.split_signals where expense_id in (select id from public.expenses where user_id = v_uid)
  );
  delete from public.public_shares where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.allocation_targets where user_id = v_uid;
  delete from public.portfolio_dividends where user_id = v_uid;
  delete from public.portfolio_contributions where user_id = v_uid;
  delete from public.portfolio_transactions where user_id = v_uid;
  delete from public.budget_limits where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.card_competence_overrides where card_id in (select id from public.credit_cards where user_id = v_uid);
  delete from public.debts where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- 2) Insere dados dos pais
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (id, user_id, ticker, asset_class, currency)
  select id, v_uid, ticker, asset_class, currency
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb));

  insert into public.user_preferences (
    user_id,
    theme,
    reminders_enabled,
    reminder_days_before_debt,
    reminder_days_before_bill,
    report_weights_enabled,
    max_sector_acoes,
    max_sector_fiis,
    app_mode,
    custom_settings
  )
  select
    v_uid,
    theme,
    reminders_enabled,
    reminder_days_before_debt,
    reminder_days_before_bill,
    report_weights_enabled,
    max_sector_acoes,
    max_sector_fiis,
    coalesce(app_mode, 'investor'),
    custom_settings
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select o.id, o.card_id, o.month, o.closing_day, o.due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  join public.credit_cards c on c.id = o.card_id
  where c.user_id = v_uid;

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories c on c.id = i.category_id
  where c.user_id = v_uid;

  insert into public.expenses (id, user_id, value, date, category_id, card_id, invoice_month, payment_method, description, report_weight, created_at)
  select e.id, v_uid, e.value, e.date, e.category_id, e.card_id, e.invoice_month, e.payment_method, e.description, e.report_weight, e.created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories c on c.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  where c.user_id = v_uid and (e.card_id is null or cc.user_id = v_uid);

  insert into public.debts (id, user_id, name, amount, due_date, status, notes)
  select d.id, v_uid, d.name, d.amount, d.due_date, d.status, d.notes
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d;

  insert into public.budgets (id, user_id, category_id, month, limit_cents)
  select b.id, v_uid, b.category_id, b.month, b.limit_cents
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  join public.categories c on c.id = b.category_id
  where c.user_id = v_uid;

  insert into public.income_goals (id, user_id, month, target_cents)
  select g.id, v_uid, g.month, g.target_cents
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) g;

  insert into public.budget_limits (id, user_id, month, limit_cents)
  select l.id, v_uid, l.month, l.limit_cents
  from jsonb_populate_recordset(null::public.budget_limits, coalesce(v_data -> 'budget_limits', '[]'::jsonb)) l;

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, fees, notes, currency, exchange_rate)
  select t.id, v_uid, t.asset_id, t.type, t.date, t.quantity, t.price, t.fees, t.notes, t.currency, t.exchange_rate
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) t
  join public.portfolio_assets a on a.id = t.asset_id
  where a.user_id = v_uid;

  insert into public.portfolio_contributions (id, user_id, date, amount, currency)
  select ct.id, v_uid, ct.date, ct.amount, ct.currency
  from jsonb_populate_recordset(null::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) ct;

  insert into public.portfolio_dividends (id, user_id, asset_id, date, amount, type)
  select dv.id, v_uid, dv.asset_id, dv.date, dv.amount, dv.type
  from jsonb_populate_recordset(null::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) dv
  join public.portfolio_assets a on a.id = dv.asset_id
  where a.user_id = v_uid;

  insert into public.allocation_targets (id, user_id, asset_id, target_percentage)
  select atg.id, v_uid, atg.asset_id, atg.target_percentage
  from jsonb_populate_recordset(null::public.allocation_targets, coalesce(v_data -> 'allocation_targets', '[]'::jsonb)) atg
  join public.portfolio_assets a on a.id = atg.asset_id
  where a.user_id = v_uid;

  insert into public.insight_feedback (id, user_id, insight_key, is_helpful, dismissed_at)
  select ifb.id, v_uid, ifb.insight_key, ifb.is_helpful, ifb.dismissed_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb)) ifb;

  insert into public.reminder_states (id, user_id, reminder_type, target_id, is_dismissed, snooze_until)
  select rs.id, v_uid, rs.reminder_type, rs.target_id, rs.is_dismissed, rs.snooze_until
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb)) rs;

  -- 4) Retorna sumário dos registros restaurados
  select jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid),
    'user_preferences', (select count(*) from public.user_preferences where user_id = v_uid),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'budgets', (select count(*) from public.budgets where user_id = v_uid),
    'income_goals', (select count(*) from public.income_goals where user_id = v_uid),
    'budget_limits', (select count(*) from public.budget_limits where user_id = v_uid),
    'portfolio_transactions', (select count(*) from public.portfolio_transactions where user_id = v_uid),
    'portfolio_contributions', (select count(*) from public.portfolio_contributions where user_id = v_uid),
    'portfolio_dividends', (select count(*) from public.portfolio_dividends where user_id = v_uid),
    'allocation_targets', (select count(*) from public.allocation_targets where user_id = v_uid),
    'insight_feedback', (select count(*) from public.insight_feedback where user_id = v_uid),
    'reminder_states', (select count(*) from public.reminder_states where user_id = v_uid)
  ) into v_counts;

  return v_counts;
end;
$$;
