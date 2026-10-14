-- ================================================================
-- 0045_saas_asaas_and_default_categories.sql
-- Integração Asaas (CPF, IDs de Gateway) e Seed de Categorias Padrão
-- ================================================================

-- 1. CPF no perfil do usuário (solicitado no checkout para conformidade BACEN/Asaas)
alter table public.profiles
  add column if not exists cpf text;

create index if not exists idx_profiles_cpf on public.profiles(cpf);

-- 2. Identificadores do Asaas nas assinaturas do usuário
alter table public.user_subscriptions
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_payment_id text;

create index if not exists idx_user_subscriptions_asaas_cust on public.user_subscriptions(asaas_customer_id);
create index if not exists idx_user_subscriptions_asaas_sub on public.user_subscriptions(asaas_subscription_id);

-- 3. Função handle_new_user() atualizada para pré-popular categorias padrão brasileiras
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

  -- 5. Seed de categorias padrão brasileiras (onboarding sem fricção)
  insert into public.categories (user_id, type, name, icon, color)
  values
    -- Despesas
    (new.id, 'expense', 'Alimentação', 'alimentacao', '#DDA726'),
    (new.id, 'expense', 'Moradia', 'moradia', '#8B5CF6'),
    (new.id, 'expense', 'Transporte', 'transporte', '#3B82F6'),
    (new.id, 'expense', 'Saúde', 'saude', '#EF4444'),
    (new.id, 'expense', 'Lazer', 'lazer', '#EC4899'),
    (new.id, 'expense', 'Educação', 'educacao', '#2A9D8F'),
    (new.id, 'expense', 'Compras', 'compras', '#06B6D4'),
    (new.id, 'expense', 'Assinaturas', 'assinaturas', '#6366F1'),
    -- Receitas
    (new.id, 'income', 'Salário', 'salario', '#10B981'),
    (new.id, 'income', 'Investimentos', 'investimentos', '#3B82F6'),
    (new.id, 'income', 'Outras Rendas', 'salario', '#8B5CF6')
  on conflict (user_id, type, name) do nothing;

  return new;
end;
$$;
