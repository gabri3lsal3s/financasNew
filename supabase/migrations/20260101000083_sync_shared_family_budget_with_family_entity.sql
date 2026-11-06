-- ---------------------------------------------------------------------------
-- 20260101000083_sync_shared_family_budget_with_family_entity.sql
-- Módulo de Modo Família & Compartilhamento Público
-- Sincroniza get_shared_family_budget com a unidade familiar e membros ativos (F1/F2),
-- garantindo congruência absoluta entre o painel interno (/familia) e a página compartilhada (/orcamento-familiar/:token).
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_family_budget(
  p_token text,
  p_month text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_month text;
  v_start_date date;
  v_end_date date;
  v_owner_name text;
  v_monthly_ceiling_cents bigint := 0;
  v_total_spent_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_spent_percentage int := 0;
  v_expenses jsonb;
  v_family_id uuid := null;
  v_family record;
begin
  -- 1. Localizar o compartilhamento público ativo
  select *
  into v_share
  from public.public_shares
  where token = p_token
    and kind = 'family_budget'
    and is_revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_share is null then
    return null;
  end if;

  -- 2. Resolver a competência (mês YYYY-MM)
  if p_month is not null and p_month ~ '^\d{4}-\d{2}$' then
    v_month := p_month;
  else
    v_month := to_char(now(), 'YYYY-MM');
  end if;

  v_start_date := (v_month || '-01')::date;
  v_end_date := (date_trunc('month', v_start_date::timestamp) + interval '1 month - 1 day')::date;

  -- 3. Verificar se o criador do link pertence a uma unidade familiar (families / family_members)
  select fm.family_id
  into v_family_id
  from public.family_members fm
  where fm.user_id = v_share.user_id
  limit 1;

  if v_family_id is not null then
    select *
    into v_family
    from public.families f
    where f.id = v_family_id;
  end if;

  -- 4. Resolver o nome de exibição do titular / família
  if v_family is not null and v_family.name is not null and trim(v_family.name) <> '' then
    v_owner_name := v_family.name;
  else
    select coalesce(p.name, 'Família')
    into v_owner_name
    from public.profiles p
    where p.id = v_share.user_id;

    if v_owner_name is null or trim(v_owner_name) = '' then
      v_owner_name := 'Família';
    end if;
  end if;

  -- 5. Resolver o teto mensal
  -- Prioridade 1: teto explicitamente configurado no payload do link
  -- Prioridade 2: teto cadastrado na unidade familiar (families.monthly_budget em reais -> centavos)
  -- Prioridade 3: soma dos orçamentos mensais do criador no mês
  if (v_share.payload ? 'monthly_ceiling_cents') and ((v_share.payload->>'monthly_ceiling_cents')::bigint > 0) then
    v_monthly_ceiling_cents := (v_share.payload->>'monthly_ceiling_cents')::bigint;
  elsif v_family is not null and v_family.monthly_budget is not null and v_family.monthly_budget > 0 then
    v_monthly_ceiling_cents := round(v_family.monthly_budget * 100)::bigint;
  else
    select coalesce(sum(round(b."limit" * 100)::bigint), 0)
    into v_monthly_ceiling_cents
    from public.budgets b
    where b.user_id = v_share.user_id
      and b.month = v_month;
  end if;

  -- 6. Calcular o total gasto com despesas familiares no mês
  -- Se houver família cadastrada, consolida despesas com is_family = true da família inteira
  -- Caso contrário, calcula as despesas familiares individuais do criador
  if v_family_id is not null then
    select coalesce(sum(round(e.value * 100)::bigint), 0)
    into v_total_spent_cents
    from public.expenses e
    where (e.family_id = v_family_id or (e.user_id = v_share.user_id and e.family_id is null))
      and e.is_family = true
      and e.date >= v_start_date
      and e.date <= v_end_date;
  else
    select coalesce(sum(round(e.value * 100)::bigint), 0)
    into v_total_spent_cents
    from public.expenses e
    where e.user_id = v_share.user_id
      and e.is_family = true
      and e.date >= v_start_date
      and e.date <= v_end_date;
  end if;

  -- 7. Calcular saldo restante e porcentagem
  v_remaining_cents := v_monthly_ceiling_cents - v_total_spent_cents;

  if v_monthly_ceiling_cents > 0 then
    v_spent_percentage := round((v_total_spent_cents::numeric / v_monthly_ceiling_cents::numeric) * 100)::int;
  else
    v_spent_percentage := 0;
  end if;

  -- 8. Listar despesas familiares do mês enriquecidas com categoria e sanitizadas (sem dados bancários)
  if v_family_id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'description', coalesce(nullif(trim(e.description), ''), 'Despesa Familiar'),
          'date', e.date::text,
          'amount_cents', round(e.value * 100)::bigint,
          'category_name', coalesce(c.name, 'Geral'),
          'category_icon', c.icon,
          'category_color', c.color,
          'payer_name', coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Membro')
        )
        order by e.date desc, e.created_at desc
      ),
      '[]'::jsonb
    )
    into v_expenses
    from public.expenses e
    left join public.categories c on c.id = e.category_id
    left join public.family_members fm on fm.family_id = v_family_id and fm.user_id = e.user_id
    left join public.profiles p on p.id = e.user_id
    where (e.family_id = v_family_id or (e.user_id = v_share.user_id and e.family_id is null))
      and e.is_family = true
      and e.date >= v_start_date
      and e.date <= v_end_date;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'description', coalesce(nullif(trim(e.description), ''), 'Despesa Familiar'),
          'date', e.date::text,
          'amount_cents', round(e.value * 100)::bigint,
          'category_name', coalesce(c.name, 'Geral'),
          'category_icon', c.icon,
          'category_color', c.color,
          'payer_name', coalesce(nullif(trim(p.name), ''), 'Titular')
        )
        order by e.date desc, e.created_at desc
      ),
      '[]'::jsonb
    )
    into v_expenses
    from public.expenses e
    left join public.categories c on c.id = e.category_id
    left join public.profiles p on p.id = e.user_id
    where e.user_id = v_share.user_id
      and e.is_family = true
      and e.date >= v_start_date
      and e.date <= v_end_date;
  end if;

  -- 9. Retornar payload estruturado
  return jsonb_build_object(
    'token', v_share.token,
    'month', v_month,
    'owner_name', v_owner_name,
    'monthly_ceiling_cents', v_monthly_ceiling_cents,
    'total_spent_cents', v_total_spent_cents,
    'remaining_cents', v_remaining_cents,
    'spent_percentage', v_spent_percentage,
    'is_revoked', v_share.is_revoked,
    'expires_at', v_share.expires_at,
    'expenses', v_expenses
  );
end;
$$;

grant execute on function public.get_shared_family_budget(text, text) to anon, authenticated, service_role;
