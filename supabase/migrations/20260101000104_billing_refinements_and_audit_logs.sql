-- ============================================================================
-- Migration: 20260101000104_billing_refinements_and_audit_logs.sql
-- Tabela de auditoria para webhooks de faturamento e grace period de 3 dias
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payment_id TEXT,
    subscription_id TEXT,
    customer_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS e permitir leitura apenas para administradores
ALTER TABLE public.billing_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores leem billing_webhook_logs" ON public.billing_webhook_logs;

CREATE POLICY "Apenas administradores leem billing_webhook_logs"
    ON public.billing_webhook_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
        )
    );

-- Criar índice para buscas rápidas por payment_id e timestamp
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_payment ON public.billing_webhook_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_created_at ON public.billing_webhook_logs (created_at DESC);

-- Atualização da função can_current_user_write com Grace Period de 3 dias para past_due
CREATE OR REPLACE FUNCTION public.can_current_user_write()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.user_subscriptions s ON s.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.status = 'active'::public.user_status
      AND (
        p.role IN ('superadmin'::public.user_role, 'admin'::public.user_role)
        OR s.tier = 'lifetime'::public.subscription_tier
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'active'::public.subscription_status
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        )
        -- Grace period de 3 dias para falhas temporárias de cartão na renovação
        OR (
          s.tier IN ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier)
          AND s.status = 'past_due'::public.subscription_status
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end + INTERVAL '3 days' > now()
        )
        OR (
          s.tier = 'trial'::public.subscription_tier
          AND s.status = 'trialing'::public.subscription_status
          AND (s.trial_ends_at IS NULL OR s.trial_ends_at > now())
        )
      )
  );
$$;

-- ================================================================
-- Migration: 20260101000104_fix_new_user_trigger_robustness.sql
-- Correção Definitiva: "Database error saving new user"
--
-- Causa Raiz Identificada:
-- Em PostgreSQL (PL/pgSQL), a variável `v_invite` era declarada como `record`
-- genérico. Quando um usuário se cadastrava sem informar código de convite
-- (ou com campo em branco), o bloco de busca do convite não era executado e
-- `v_invite` permanecia não-atribuída (unassigned).
--
-- Mais adiante, a condição:
--   if v_invite.id is not null and v_invite.module_grants is not null ...
-- tentava avaliar o atributo `.id` em um record cuja estrutura ainda não havia
-- sido determinada. O motor do PostgreSQL abortava imediatamente a transação com:
--   ERROR 55000: record "v_invite" is not assigned yet
--   The tuple structure of a not-yet-assigned record is indeterminate.
--
-- Como o trigger on_auth_user_created é AFTER INSERT em auth.users, esse erro
-- abortava a criação da conta no Supabase Auth e o GoTrue retornava:
--   "Database error saving new user".
--
-- Solução Aplicada:
-- 1. Declarar `v_invite` explicitamente como `public.access_invites%rowtype`
-- 2. Utilizar flag booleana `v_has_invite := false` para controlar com segurança
--    a verificação de permissões do convite
-- 3. Reseed idempotente dos planos canônicos
-- 4. Tratamento defensivo em cada bloco de inserção (perfil, assinatura, etc.)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Reseed dos planos canônicos (idempotente — garante integridade)
-- ----------------------------------------------------------------
insert into public.plans (id, name, description, price_cents, billing_interval, is_publicly_available)
values
  ('trial',       'Teste Pro (30 dias)',    'Acesso irrestrito a todas as ferramentas por 30 dias.',  0,     null,    false),
  ('pro_monthly', 'Plano Pro Mensal',       'Assinatura recorrente mensal com acesso completo.',       1990,  'month', true),
  ('pro_annual',  'Plano Pro Anual',        'Assinatura anual com 25% de desconto.',                   17880, 'year',  true),
  ('lifetime',    'Plano Vitalício VIP',    'Acesso completo permanente sem expiração.',               0,     null,    false)
on conflict (id) do update
set name                  = excluded.name,
    description           = excluded.description,
    price_cents           = excluded.price_cents,
    billing_interval      = excluded.billing_interval,
    is_publicly_available = excluded.is_publicly_available;

-- ----------------------------------------------------------------
-- 2. Atualizar handle_new_user() com tipagem correta de v_invite
-- ----------------------------------------------------------------
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
        raise warning 'Invite increment skipped: %', sqlerrm;
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

  -- 4. Cria preferencias padrão
  begin
    insert into public.user_preferences (user_id, app_mode)
    values (new.id, v_app_mode)
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
