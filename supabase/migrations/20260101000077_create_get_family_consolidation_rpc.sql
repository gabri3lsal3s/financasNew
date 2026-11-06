-- ---------------------------------------------------------------------------
-- 20260101000077_create_get_family_consolidation_rpc.sql
-- Módulo de Modo Família Colaborativo Multi-Contas & Consolidação Orçamentária
-- RPC Transacional get_family_consolidation (Tarefa 1.2 / DoD Fase 1)
-- Blindagem RLS (D4), Sanitização de Colunas Bancárias (F3) e Alerta Pós-Acerto (F5).
-- ---------------------------------------------------------------------------

create or replace function public.get_family_consolidation(
  p_family_id uuid default null,
  p_month text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_family record;
  v_month text;
  v_start_date date;
  v_end_date date;
  v_monthly_ceiling_cents bigint := 0;
  v_total_spent_cents bigint := 0;
  v_total_income_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_spent_percentage int := 0;
  v_members jsonb;
  v_expenses jsonb;
  v_settlement record;
  v_settlement_json jsonb := null;
  v_is_settled boolean := false;
  v_has_post_settlement boolean := false;
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

    -- Se o usuário não pertence a nenhuma família, retorna null de forma segura
    if v_family_id is null then
      return null;
    end if;
  end if;

  -- 3. Obter metadados da família
  select *
  into v_family
  from public.families f
  where f.id = v_family_id;

  if v_family is null then
    return null;
  end if;

  -- 4. Resolver a competência (mês YYYY-MM)
  if p_month is not null and p_month ~ '^\d{4}-\d{2}$' then
    v_month := p_month;
  else
    v_month := to_char(now(), 'YYYY-MM');
  end if;

  v_start_date := (v_month || '-01')::date;
  v_end_date := (date_trunc('month', v_start_date::timestamp) + interval '1 month - 1 day')::date;

  -- 5. Calcular teto mensal em centavos
  v_monthly_ceiling_cents := round(coalesce(v_family.monthly_budget, 0) * 100)::bigint;

  -- 6. Calcular total gasto conjunto na competência (em centavos)
  select coalesce(sum(round(e.value * 100)::bigint), 0)
  into v_total_spent_cents
  from public.expenses e
  where e.family_id = v_family_id
    and e.is_family = true
    and e.date >= v_start_date
    and e.date <= v_end_date;

  -- 7. Calcular total de receitas conjuntas na competência (em centavos)
  select coalesce(sum(round(i.value * 100)::bigint), 0)
  into v_total_income_cents
  from public.incomes i
  where i.family_id = v_family_id
    and i.is_family = true
    and i.date >= v_start_date
    and i.date <= v_end_date;

  -- 8. Calcular saldo restante e porcentagem de consumo do teto
  v_remaining_cents := v_monthly_ceiling_cents - v_total_spent_cents;

  if v_monthly_ceiling_cents > 0 then
    v_spent_percentage := round((v_total_spent_cents::numeric / v_monthly_ceiling_cents::numeric) * 100)::int;
  else
    v_spent_percentage := 0;
  end if;

  -- 9. Listar participantes da família com fatias de contribuição
  with member_spending as (
    select
      fm.user_id,
      fm.role,
      coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Participante') as display_name,
      fm.pix_key,
      fm.pix_key_type,
      fm.split_ratio,
      coalesce(sum(round(e.value * 100)::bigint), 0) as spent_cents
    from public.family_members fm
    left join public.profiles p on p.id = fm.user_id
    left join public.expenses e
      on e.user_id = fm.user_id
      and e.family_id = v_family_id
      and e.is_family = true
      and e.date >= v_start_date
      and e.date <= v_end_date
    where fm.family_id = v_family_id
    group by fm.user_id, fm.role, fm.display_name, p.name, fm.pix_key, fm.pix_key_type, fm.split_ratio, fm.created_at
    order by fm.created_at asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', ms.user_id,
        'role', ms.role,
        'display_name', ms.display_name,
        'pix_key', ms.pix_key,
        'pix_key_type', ms.pix_key_type,
        'split_ratio', ms.split_ratio,
        'spent_cents', ms.spent_cents,
        'percentage_of_total', case
          when v_total_spent_cents > 0 then round((ms.spent_cents::numeric / v_total_spent_cents::numeric) * 100)::int
          else 0
        end
      )
    ),
    '[]'::jsonb
  )
  into v_members
  from member_spending ms;

  -- 10. Listar despesas familiares do mês enriquecidas com categoria e nome do pagador
  -- (Sanitização Estrita F3: omitindo cartões, contas e dados bancários)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'description', coalesce(nullif(trim(e.description), ''), 'Despesa Familiar'),
        'date', e.date::text,
        'amount_cents', round(e.value * 100)::bigint,
        'category_id', e.category_id,
        'category_name', coalesce(c.name, 'Geral'),
        'category_icon', c.icon,
        'category_color', c.color,
        'user_id', e.user_id,
        'payer_name', coalesce(nullif(trim(fm.display_name), ''), nullif(trim(p.name), ''), 'Participante'),
        'is_own', (e.user_id = v_user_id),
        'created_at', e.created_at
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
  where e.family_id = v_family_id
    and e.is_family = true
    and e.date >= v_start_date
    and e.date <= v_end_date;

  -- 11. Obter status do acerto de contas do mês
  select
    fs.id,
    fs.month,
    fs.payer_id,
    coalesce(nullif(trim(payer_fm.display_name), ''), nullif(trim(payer_p.name), ''), 'Pagador') as payer_name,
    fs.receiver_id,
    coalesce(nullif(trim(rec_fm.display_name), ''), nullif(trim(rec_p.name), ''), 'Recebedor') as receiver_name,
    round(fs.amount * 100)::bigint as amount_cents,
    fs.settled_at,
    fs.payment_method,
    fs.notes,
    fs.created_at
  into v_settlement
  from public.family_settlements fs
  left join public.family_members payer_fm on payer_fm.family_id = v_family_id and payer_fm.user_id = fs.payer_id
  left join public.profiles payer_p on payer_p.id = fs.payer_id
  left join public.family_members rec_fm on rec_fm.family_id = v_family_id and rec_fm.user_id = fs.receiver_id
  left join public.profiles rec_p on rec_p.id = fs.receiver_id
  where fs.family_id = v_family_id
    and fs.month = v_month
  order by fs.settled_at desc
  limit 1;

  if v_settlement is not null then
    v_is_settled := true;
    v_settlement_json := jsonb_build_object(
      'id', v_settlement.id,
      'month', v_settlement.month,
      'payer_id', v_settlement.payer_id,
      'payer_name', v_settlement.payer_name,
      'receiver_id', v_settlement.receiver_id,
      'receiver_name', v_settlement.receiver_name,
      'amount_cents', v_settlement.amount_cents,
      'settled_at', v_settlement.settled_at,
      'payment_method', v_settlement.payment_method,
      'notes', v_settlement.notes,
      'created_at', v_settlement.created_at
    );

    -- F5: Verifica se foram adicionadas novas despesas após a data do acerto
    select exists (
      select 1
      from public.expenses e
      where e.family_id = v_family_id
        and e.is_family = true
        and e.date >= v_start_date
        and e.date <= v_end_date
        and e.created_at > v_settlement.settled_at
    )
    into v_has_post_settlement;
  end if;

  -- 12. Retorno consolidado estruturado
  return jsonb_build_object(
    'family', jsonb_build_object(
      'id', v_family.id,
      'name', v_family.name,
      'owner_id', v_family.owner_id,
      'monthly_budget_cents', v_monthly_ceiling_cents,
      'split_rule', v_family.split_rule
    ),
    'month', v_month,
    'monthly_ceiling_cents', v_monthly_ceiling_cents,
    'total_spent_cents', v_total_spent_cents,
    'total_income_cents', v_total_income_cents,
    'remaining_cents', v_remaining_cents,
    'spent_percentage', v_spent_percentage,
    'members', v_members,
    'expenses', v_expenses,
    'is_settled', v_is_settled,
    'settlement', v_settlement_json,
    'has_post_settlement_expenses', v_has_post_settlement
  );
end;
$$;

-- Privilégios PostgREST: apenas usuários autenticados e service_role
revoke execute on function public.get_family_consolidation(uuid, text) from public, anon;
grant execute on function public.get_family_consolidation(uuid, text) to authenticated, service_role;
