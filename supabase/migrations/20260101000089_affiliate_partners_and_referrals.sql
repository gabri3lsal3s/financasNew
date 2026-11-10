-- ---------------------------------------------------------------------------
-- 20260101000089_affiliate_partners_and_referrals.sql
-- Módulo de Crescimento B2B2C: Parceiros Afiliados e Atribuição de Indicações
-- Implementa rastreamento seguro de cupons, comissão recorrente de 30% e
-- governança de repasses com chave Pix.
-- ---------------------------------------------------------------------------

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null unique,
  commission_rate numeric not null default 0.30,
  pix_key text,
  pix_key_type text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_partners(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  attributed_at timestamptz not null default now(),
  status text not null default 'active'
);

-- Habilita RLS
alter table public.affiliate_partners enable row level security;
alter table public.referral_attributions enable row level security;

-- Políticas de affiliate_partners
drop policy if exists affiliate_partners_select_own on public.affiliate_partners;
create policy affiliate_partners_select_own on public.affiliate_partners
  for select
  using (auth.uid() = user_id);

drop policy if exists affiliate_partners_update_own on public.affiliate_partners;
create policy affiliate_partners_update_own on public.affiliate_partners
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Políticas de referral_attributions (o parceiro vê os seus indicados)
drop policy if exists referral_attributions_select_affiliate on public.referral_attributions;
create policy referral_attributions_select_affiliate on public.referral_attributions
  for select
  using (
    exists (
      select 1 from public.affiliate_partners ap
      where ap.id = referral_attributions.affiliate_id
        and ap.user_id = auth.uid()
    )
  );

-- Índices de performance
create index if not exists idx_affiliate_partners_user_id on public.affiliate_partners(user_id);
create index if not exists idx_affiliate_partners_code on public.affiliate_partners(upper(referral_code));
create index if not exists idx_referral_attributions_affiliate_id on public.referral_attributions(affiliate_id);
create index if not exists idx_referral_attributions_referred_user on public.referral_attributions(referred_user_id);

-- RPC: Obter ou Criar Perfil de Afiliado do Usuário Autenticado
create or replace function public.get_or_create_affiliate_partner(
  p_pix_key text default null,
  p_pix_key_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_partner record;
  v_code text;
  v_suffix text;
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select * into v_partner
  from public.affiliate_partners
  where user_id = v_caller_id;

  if v_partner is null then
    -- Gera código amigável determinístico único: AXIR-XXXXXX
    v_suffix := upper(substr(replace(v_caller_id::text, '-', ''), 1, 6));
    v_code := 'AXIR-' || v_suffix;

    -- Em caso de colisão rara, anexa caracteres aleatórios
    while exists(select 1 from public.affiliate_partners where referral_code = v_code) loop
      v_code := 'AXIR-' || upper(substr(md5(random()::text), 1, 6));
    end loop;

    insert into public.affiliate_partners (
      user_id,
      referral_code,
      commission_rate,
      pix_key,
      pix_key_type,
      status
    )
    values (
      v_caller_id,
      v_code,
      0.30,
      nullif(trim(p_pix_key), ''),
      nullif(trim(p_pix_key_type), ''),
      'active'
    )
    returning * into v_partner;
  else
    if p_pix_key is not null or p_pix_key_type is not null then
      update public.affiliate_partners
      set
        pix_key = coalesce(nullif(trim(p_pix_key), ''), pix_key),
        pix_key_type = coalesce(nullif(trim(p_pix_key_type), ''), pix_key_type)
      where id = v_partner.id
      returning * into v_partner;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_partner.id,
    'referral_code', v_partner.referral_code,
    'commission_rate', v_partner.commission_rate,
    'pix_key', v_partner.pix_key,
    'pix_key_type', v_partner.pix_key_type,
    'status', v_partner.status,
    'created_at', v_partner.created_at
  );
end;
$$;

-- RPC: Atualizar Chave Pix do Afiliado
create or replace function public.update_affiliate_pix(
  p_pix_key text,
  p_pix_key_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  update public.affiliate_partners
  set
    pix_key = nullif(trim(p_pix_key), ''),
    pix_key_type = nullif(trim(p_pix_key_type), '')
  where user_id = v_caller_id;

  return found;
end;
$$;

-- RPC: Atribuir Indicação a um Novo Usuário
create or replace function public.attribute_referral(
  p_referral_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_affiliate record;
begin
  if v_caller_id is null then
    return false;
  end if;

  if p_referral_code is null or trim(p_referral_code) = '' then
    return false;
  end if;

  -- Localiza parceiro ativo pelo código (case insensitive)
  select * into v_affiliate
  from public.affiliate_partners
  where upper(referral_code) = upper(trim(p_referral_code))
    and status = 'active';

  if v_affiliate is null then
    return false;
  end if;

  -- Previne auto-indicação
  if v_affiliate.user_id = v_caller_id then
    return false;
  end if;

  -- Insere atribuição idempotente (se já atribuído, ignora)
  insert into public.referral_attributions (
    affiliate_id,
    referred_user_id,
    status
  )
  values (
    v_affiliate.id,
    v_caller_id,
    'active'
  )
  on conflict (referred_user_id) do nothing;

  return true;
end;
$$;

-- RPC: Obter Dados do Painel de Afiliado
create or replace function public.get_affiliate_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_partner record;
  v_total_count integer := 0;
  v_active_pro_count integer := 0;
  v_estimated_commission_cents integer := 0;
  v_standard_pro_price_cents integer := 2990; -- R$ 29,90 / mês
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select * into v_partner
  from public.affiliate_partners
  where user_id = v_caller_id;

  if v_partner is null then
    return null;
  end if;

  -- Contagem total de indicados
  select count(*) into v_total_count
  from public.referral_attributions
  where affiliate_id = v_partner.id;

  -- Contagem de indicados com assinatura Pro ativa
  select count(*) into v_active_pro_count
  from public.referral_attributions ra
  join public.user_subscriptions s on s.user_id = ra.referred_user_id
  where ra.affiliate_id = v_partner.id
    and s.status in ('active', 'trialing')
    and s.plan_id in ('pro_monthly', 'pro_annual');

  -- Estimativa de comissão (30% do plano Pro mensal por usuário ativo)
  v_estimated_commission_cents := round(v_active_pro_count * v_standard_pro_price_cents * v_partner.commission_rate);

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_partner.id,
      'referral_code', v_partner.referral_code,
      'commission_rate', v_partner.commission_rate,
      'pix_key', v_partner.pix_key,
      'pix_key_type', v_partner.pix_key_type,
      'status', v_partner.status,
      'created_at', v_partner.created_at
    ),
    'metrics', jsonb_build_object(
      'total_referred_users', v_total_count,
      'active_pro_users', v_active_pro_count,
      'estimated_commission_cents', v_estimated_commission_cents
    )
  );
end;
$$;
