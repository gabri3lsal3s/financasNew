-- ================================================================
-- Migration: 20260101000105_default_family_mode_for_new_users.sql
-- Ativação por padrão do Modo Família para novos usuários
--
-- 1. Altera o valor padrão da coluna custom_settings em user_preferences
--    para conter '{"familyModeEnabled": true}'::jsonb.
-- 2. Atualiza handle_new_user() para persistir explicitamente
--    custom_settings = '{"familyModeEnabled": true}'::jsonb ao criar preferências.
-- ================================================================

-- 1. Altera default da coluna custom_settings
alter table public.user_preferences
  alter column custom_settings set default '{"familyModeEnabled": true}'::jsonb;

-- 2. Atualiza handle_new_user()
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_count     integer;
  v_invite_code    text;
  v_invite         public.access_invites%rowtype;
  v_has_invite     boolean := false;
  v_initial_role   public.user_role := 'user'::public.user_role;
  v_initial_status public.user_status := 'active'::public.user_status;
  v_approved_at    timestamptz := now();
  v_target_tier    public.subscription_tier := 'trial'::public.subscription_tier;
  v_target_plan    text := 'trial';
  v_trial_days     integer := 30;
  v_trial_ends_at  timestamptz := now() + interval '30 days';
  v_sub_status     public.subscription_status := 'trialing'::public.subscription_status;
  v_module_key     text;
  v_access_val     text;
  v_app_mode       text := 'investor';
begin
  -- Contagem de usuários existentes (auth.users não tem RLS)
  select count(*) - 1 into v_user_count from auth.users;

  -- Primeiro usuário do sistema é superadmin com plano Vitalício
  if v_user_count <= 0 then
    v_initial_role   := 'superadmin'::public.user_role;
    v_initial_status := 'active'::public.user_status;
    v_approved_at    := now();
    v_target_tier    := 'lifetime'::public.subscription_tier;
    v_target_plan    := 'lifetime';
    v_sub_status     := 'active'::public.subscription_status;
    v_trial_ends_at  := null;
  else
    v_invite_code := trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));

    if v_invite_code <> '' then
      begin
        select * into v_invite
        from public.access_invites
        where upper(code) = upper(v_invite_code)
          and is_revoked = false
          and (expires_at is null or expires_at > now())
          and used_count < max_uses
        for update;

        if found then
          if v_invite.target_email is null or lower(v_invite.target_email) = lower(new.email) then
            v_has_invite := true;
            v_target_tier := v_invite.target_tier;
            v_target_plan := case
              when v_target_tier = 'lifetime'::public.subscription_tier    then 'lifetime'
              when v_target_tier = 'pro_annual'::public.subscription_tier  then 'pro_annual'
              when v_target_tier = 'pro_monthly'::public.subscription_tier then 'pro_monthly'
              else 'trial'
            end;

            if v_target_tier = 'lifetime'::public.subscription_tier
               or v_target_tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
              v_sub_status    := 'active'::public.subscription_status;
              v_trial_ends_at := null;
            else
              v_trial_days    := coalesce(v_invite.custom_trial_days, 30);
              v_trial_ends_at := now() + (v_trial_days || ' days')::interval;
              v_sub_status    := 'trialing'::public.subscription_status;
            end if;

            update public.access_invites
            set used_count = used_count + 1
            where id = v_invite.id;
          end if;
        end if;
      exception when others then
        null;
      end;
    end if;
  end if;

  if (new.raw_user_meta_data ->> 'app_mode') in ('essential', 'investor') then
    v_app_mode := new.raw_user_meta_data ->> 'app_mode';
  end if;

  -- 1. Cria perfil
  begin
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
  exception when others then
    raise warning '[handle_new_user] Erro ao criar perfil para %: %', new.id, sqlerrm;
  end;

  -- 2. Cria assinatura
  begin
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
  exception when others then
    raise warning '[handle_new_user] Erro ao criar assinatura para %: %', new.id, sqlerrm;
  end;

  -- 3. Aplica overrides de módulos do convite se houver convite atribuído
  if v_has_invite then
    if v_invite.module_grants is not null and v_invite.module_grants <> '{}'::jsonb then
      begin
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
      exception when others then
        raise warning '[handle_new_user] Erro ao aplicar modulos do convite para %: %', new.id, sqlerrm;
      end;
    end if;
  end if;

  -- 4. Cria preferencias padrão com Modo Família ativo por padrão
  begin
    insert into public.user_preferences (user_id, app_mode, custom_settings)
    values (new.id, v_app_mode, '{"familyModeEnabled": true}'::jsonb)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning '[handle_new_user] Erro ao criar preferencias para %: %', new.id, sqlerrm;
  end;

  -- 5. Seed das 11 categorias padrão brasileiras
  begin
    insert into public.categories (user_id, type, name, icon, color, is_reserved, is_active)
    values
      (new.id, 'expense', 'Alimentação',  'alimentacao', '#DDA726', false, true),
      (new.id, 'expense', 'Moradia',      'moradia',     '#8B5CF6', false, true),
      (new.id, 'expense', 'Transporte',   'transporte',  '#3B82F6', false, true),
      (new.id, 'expense', 'Saúde',        'saude',       '#EF4444', false, true),
      (new.id, 'expense', 'Educação',     'educacao',    '#2A9D8F', false, true),
      (new.id, 'expense', 'Lazer',        'lazer',       '#EC4899', false, true),
      (new.id, 'expense', 'Compras',      'compras',     '#06B6D4', false, true),
      (new.id, 'expense', 'Assinaturas',  'assinaturas', '#6366F1', false, true),
      (new.id, 'income',  'Salário',      'salario',     '#10B981', false, true),
      (new.id, 'income',  'Investimentos','investimentos','#3B82F6', false, true),
      (new.id, 'income',  'Outras Rendas','salario',     '#8B5CF6', false, true)
    on conflict (user_id, type, name) do nothing;
  exception when others then
    raise warning '[handle_new_user] Erro ao criar categorias padrao para %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
