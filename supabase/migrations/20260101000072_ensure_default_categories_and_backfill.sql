-- ================================================================
-- 0072_ensure_default_categories_and_backfill.sql
-- Auto-cura de categorias padrão, RPC idempotente e backfill de contas órfãs
-- ================================================================

-- 1. RPC segura para inicializar categorias padrão brasileiras sob demanda
create or replace function public.seed_default_categories()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_inserted integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Insere as 11 categorias canônicas (8 despesas e 3 receitas)
  insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
  values
    -- Despesas Essenciais (Necessidades 50%)
    (v_user_id, 'expense', 'Alimentação', 'alimentacao', '#DDA726', false, true),
    (v_user_id, 'expense', 'Moradia', 'moradia', '#8B5CF6', false, true),
    (v_user_id, 'expense', 'Transporte', 'transporte', '#3B82F6', false, true),
    (v_user_id, 'expense', 'Saúde', 'saude', '#EF4444', false, true),
    (v_user_id, 'expense', 'Educação', 'educacao', '#2A9D8F', false, true),
    -- Despesas de Estilo de Vida (Desejos 30% / Assinaturas)
    (v_user_id, 'expense', 'Lazer', 'lazer', '#EC4899', false, true),
    (v_user_id, 'expense', 'Compras', 'compras', '#06B6D4', false, true),
    (v_user_id, 'expense', 'Assinaturas', 'assinaturas', '#6366F1', false, true),
    -- Receitas
    (v_user_id, 'income', 'Salário', 'salario', '#10B981', false, true),
    (v_user_id, 'income', 'Investimentos', 'investimentos', '#3B82F6', false, true),
    (v_user_id, 'income', 'Outras Rendas', 'salario', '#8B5CF6', false, true)
  on conflict (user_id, type, name) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.seed_default_categories() from public;
grant execute on function public.seed_default_categories() to authenticated;

-- 2. Atualizar handle_new_user() garantindo a execução integral do seed
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

  -- 4. Cria preferências padrões do usuário
  insert into public.user_preferences (user_id)
  values (new.id)
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

-- 3. Backfill imediato para contas órfãs (usuários que foram criados sem categorias padrão)
-- Insere as categorias canônicas para qualquer perfil que possua 0 categorias não-reservadas
do $$
declare
  r_user record;
begin
  for r_user in
    select p.id
    from public.profiles p
    where not exists (
      select 1
      from public.categories c
      where c.user_id = p.id
        and c.is_reserved = false
    )
  loop
    insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
    values
      (r_user.id, 'expense', 'Alimentação', 'alimentacao', '#DDA726', false, true),
      (r_user.id, 'expense', 'Moradia', 'moradia', '#8B5CF6', false, true),
      (r_user.id, 'expense', 'Transporte', 'transporte', '#3B82F6', false, true),
      (r_user.id, 'expense', 'Saúde', 'saude', '#EF4444', false, true),
      (r_user.id, 'expense', 'Educação', 'educacao', '#2A9D8F', false, true),
      (r_user.id, 'expense', 'Lazer', 'lazer', '#EC4899', false, true),
      (r_user.id, 'expense', 'Compras', 'compras', '#06B6D4', false, true),
      (r_user.id, 'expense', 'Assinaturas', 'assinaturas', '#6366F1', false, true),
      (r_user.id, 'income', 'Salário', 'salario', '#10B981', false, true),
      (r_user.id, 'income', 'Investimentos', 'investimentos', '#3B82F6', false, true),
      (r_user.id, 'income', 'Outras Rendas', 'salario', '#8B5CF6', false, true)
    on conflict (user_id, type, name) do nothing;
  end loop;
end;
$$;
