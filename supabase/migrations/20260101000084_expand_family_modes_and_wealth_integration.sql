-- ---------------------------------------------------------------------------
-- 20260101000084_expand_family_modes_and_wealth_integration.sql
-- Módulo de Modo Família:
-- 1. Suporte à modalidade 'combined' (Finanças Conjuntas / Caixa Único)
-- 2. Compartilhamento patrimonial em nível de membro (share_all_portfolio e shared_asset_classes)
-- 3. RPC get_family_income_ratio_suggestion para assistente de rateio por histórico de receitas
-- 4. RPC get_family_portfolio_summary para consolidação patrimonial e reserva da família
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Atualizar constraint de split_rule em public.families
-- ===========================================================================
alter table public.families drop constraint if exists families_split_rule_check;
alter table public.families add constraint families_split_rule_check
  check (split_rule in ('equal', 'proportional', 'combined'));

-- ===========================================================================
-- 2. Adicionar colunas de compartilhamento patrimonial em public.family_members
-- ===========================================================================
alter table public.family_members
  add column if not exists share_all_portfolio boolean not null default false,
  add column if not exists shared_asset_classes text[] default null;

-- ===========================================================================
-- 3. RPC get_family_income_ratio_suggestion
-- Calcula a média de receitas dos últimos meses de cada membro para sugestão de rateio
-- ===========================================================================
create or replace function public.get_family_income_ratio_suggestion(
  p_family_id uuid default null,
  p_lookback_months int default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_months int := coalesce(p_lookback_months, 3);
  v_start_date date;
  v_total_avg_cents bigint := 0;
  v_result jsonb;
begin
  -- 1. Verificação de autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if v_months < 1 then
    v_months := 1;
  elsif v_months > 12 then
    v_months := 12;
  end if;

  -- 2. Resolução e validação da família
  if p_family_id is not null then
    v_family_id := p_family_id;
    if not public.is_family_member(v_family_id, v_user_id) then
      raise exception 'Acesso negado: usuário não pertence à família especificada.' using errcode = '42501';
    end if;
  else
    select fm.family_id
    into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;

    if v_family_id is null then
      return '[]'::jsonb;
    end if;
  end if;

  -- 3. Janela de corte (últimos N meses a partir do 1º dia do mês corrente)
  v_start_date := (date_trunc('month', current_date) - ((v_months || ' months')::interval))::date;

  -- 4. Agregar média de receitas por membro
  with member_incomes as (
    select
      fm.user_id,
      coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Participante') as display_name,
      coalesce(sum(round(i.value * 100)::bigint), 0) as total_income_cents
    from public.family_members fm
    left join public.profiles p on p.id = fm.user_id
    left join public.incomes i
      on i.user_id = fm.user_id
      and i.date >= v_start_date
      and i.date < date_trunc('month', current_date)::date
    where fm.family_id = v_family_id
    group by fm.user_id, fm.display_name, p.name, fm.created_at
    order by fm.created_at asc
  ),
  member_averages as (
    select
      mi.user_id,
      mi.display_name,
      round(mi.total_income_cents::numeric / v_months::numeric)::bigint as avg_cents
    from member_incomes mi
  )
  select
    coalesce(sum(ma.avg_cents), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', ma.user_id,
          'display_name', ma.display_name,
          'average_monthly_income_cents', ma.avg_cents
        )
      ),
      '[]'::jsonb
    )
  into v_total_avg_cents, v_result
  from member_averages ma;

  -- 5. Calcular porcentagem proporcional segura para cada membro
  if v_total_avg_cents > 0 then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', elem->>'user_id',
          'display_name', elem->>'display_name',
          'average_monthly_income_cents', (elem->>'average_monthly_income_cents')::bigint,
          'suggested_percentage', round(((elem->>'average_monthly_income_cents')::numeric / v_total_avg_cents::numeric) * 100)::int
        )
      ),
      '[]'::jsonb
    )
    into v_result
    from jsonb_array_elements(v_result) as elem;
  else
    -- Fallback igualitário caso não haja histórico de receitas nos meses anteriores
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', elem->>'user_id',
          'display_name', elem->>'display_name',
          'average_monthly_income_cents', 0,
          'suggested_percentage', round(100.0 / nullif(jsonb_array_length(v_result), 0))::int
        )
      ),
      '[]'::jsonb
    )
    into v_result
    from jsonb_array_elements(v_result) as elem;
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_family_income_ratio_suggestion(uuid, int) to authenticated;

-- ===========================================================================
-- 4. RPC get_family_portfolio_summary
-- Consolida o patrimônio e a reserva de emergência compartilhados com a família
-- ===========================================================================
create or replace function public.get_family_portfolio_summary(
  p_family_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_total_invested_cents bigint := 0;
  v_total_cash_cents bigint := 0;
  v_dividends_12m_cents bigint := 0;
  v_assets jsonb;
begin
  -- 1. Verificação de autenticação fail-closed
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  -- 2. Resolução e validação da família
  if p_family_id is not null then
    v_family_id := p_family_id;
    if not public.is_family_member(v_family_id, v_user_id) then
      raise exception 'Acesso negado: usuário não pertence à família especificada.' using errcode = '42501';
    end if;
  else
    select fm.family_id
    into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;

    if v_family_id is null then
      return null;
    end if;
  end if;

  -- 3. Identificar ativos compartilhados pelos membros da família
  -- Critérios:
  -- A. O membro marcou share_all_portfolio = true
  -- B. OU a classe do ativo está em fm.shared_asset_classes
  -- C. OU o ativo possui is_family = true explicitamente
  with shared_assets as (
    select
      pa.id,
      pa.user_id,
      pa.ticker,
      coalesce(pa.asset_class, 'Outros') as asset_class,
      pa.quantity,
      pa.average_price,
      pa.currency,
      coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Membro') as owner_name,
      round(
        (pa.quantity * coalesce(
          (select coalesce(ap.manual_price, ap.price)
           from public.asset_prices ap
           where ap.ticker = pa.ticker and (ap.user_id = pa.user_id or ap.user_id is null)
           order by (ap.user_id is not null) desc limit 1),
          pa.average_price,
          0
        )) * 100
      )::bigint as total_value_cents,
      case
        when lower(coalesce(pa.asset_class, '')) in ('caixa', 'reserva', 'reserva de emergência')
          or upper(pa.ticker) = 'CAIXA'
          or lower(pa.ticker) like '%selic%'
          or lower(pa.ticker) like '%cdi%'
        then true
        else false
      end as is_cash_like
    from public.portfolio_assets pa
    join public.family_members fm on fm.user_id = pa.user_id and fm.family_id = v_family_id
    left join public.profiles p on p.id = pa.user_id
    where (
      fm.share_all_portfolio = true
      or (fm.shared_asset_classes is not null and pa.asset_class = any(fm.shared_asset_classes))
      or (pa.is_family = true and (pa.family_id = v_family_id or pa.family_id is null))
    )
    and pa.quantity > 0
  )
  select
    coalesce(sum(sa.total_value_cents), 0),
    coalesce(sum(case when sa.is_cash_like then sa.total_value_cents else 0 end), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', sa.id,
          'user_id', sa.user_id,
          'ticker', sa.ticker,
          'asset_class', sa.asset_class,
          'quantity', sa.quantity,
          'total_value_cents', sa.total_value_cents,
          'owner_name', sa.owner_name,
          'is_cash_like', sa.is_cash_like
        )
        order by sa.total_value_cents desc
      ),
      '[]'::jsonb
    )
  into v_total_invested_cents, v_total_cash_cents, v_assets
  from shared_assets sa;

  -- 4. Estimar dividendos dos últimos 12 meses dos ativos compartilhados
  select coalesce(sum(round(pd.amount * 100)::bigint), 0)
  into v_dividends_12m_cents
  from public.portfolio_dividends pd
  join public.family_members fm on fm.user_id = pd.user_id and fm.family_id = v_family_id
  where pd.date >= (current_date - interval '12 months')
    and exists (
      select 1 from public.portfolio_assets pa
      where pa.user_id = pd.user_id
        and pa.ticker = pd.ticker
        and (
          fm.share_all_portfolio = true
          or (fm.shared_asset_classes is not null and pa.asset_class = any(fm.shared_asset_classes))
          or (pa.is_family = true and (pa.family_id = v_family_id or pa.family_id is null))
        )
    );

  return jsonb_build_object(
    'family_id', v_family_id,
    'total_invested_cents', v_total_invested_cents,
    'total_cash_cents', v_total_cash_cents,
    'dividends_12m_cents', v_dividends_12m_cents,
    'assets_count', jsonb_array_length(v_assets),
    'assets', v_assets
  );
end;
$$;

grant execute on function public.get_family_portfolio_summary(uuid) to authenticated;
