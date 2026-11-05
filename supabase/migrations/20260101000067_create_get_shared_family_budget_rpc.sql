-- ---------------------------------------------------------------------------
-- 20260101000067_create_get_shared_family_budget_rpc.sql
-- Módulo de Compartilhamento Público e Crescimento Orgânico (Áxis Finance)
-- RPC segura de leitura do Orçamento Familiar compartilhado (/orcamento-familiar/:token)
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
  v_monthly_ceiling_cents bigint;
  v_total_spent_cents bigint;
  v_remaining_cents bigint;
  v_spent_percentage int;
  v_expenses jsonb;
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

  -- 3. Obter o nome do titular
  select coalesce(p.name, 'Família')
  into v_owner_name
  from public.profiles p
  where p.id = v_share.user_id;

  if v_owner_name is null or trim(v_owner_name) = '' then
    v_owner_name := 'Família';
  end if;

  -- 4. Resolver o teto mensal
  -- Prioridade 1: teto explicitamente configurado no payload do link
  -- Prioridade 2: soma dos limites de orçamentos ativos do titular no mês
  if (v_share.payload ? 'monthly_ceiling_cents') and ((v_share.payload->>'monthly_ceiling_cents')::bigint > 0) then
    v_monthly_ceiling_cents := (v_share.payload->>'monthly_ceiling_cents')::bigint;
  else
    select coalesce(sum(round(b."limit" * 100)::bigint), 0)
    into v_monthly_ceiling_cents
    from public.budgets b
    where b.user_id = v_share.user_id
      and b.month = v_month;
  end if;

  -- 5. Calcular o total gasto com despesas familiares no mês
  select coalesce(sum(round(value * 100)::bigint), 0)
  into v_total_spent_cents
  from public.expenses
  where user_id = v_share.user_id
    and is_family = true
    and date >= v_start_date
    and date <= v_end_date;

  -- 6. Calcular saldo restante e porcentagem
  v_remaining_cents := v_monthly_ceiling_cents - v_total_spent_cents;

  if v_monthly_ceiling_cents > 0 then
    v_spent_percentage := round((v_total_spent_cents::numeric / v_monthly_ceiling_cents::numeric) * 100)::int;
  else
    v_spent_percentage := 0;
  end if;

  -- 7. Listar despesas familiares do mês (apenas id, descrição, data e valor em centavos; sem dados bancários)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'description', coalesce(nullif(trim(e.description), ''), 'Despesa Familiar'),
        'date', e.date::text,
        'amount_cents', round(e.value * 100)::bigint
      )
      order by e.date desc, e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_expenses
  from public.expenses e
  where e.user_id = v_share.user_id
    and e.is_family = true
    and e.date >= v_start_date
    and e.date <= v_end_date;

  -- 8. Montar e retornar o JSON consolidado
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

-- Privilégios PostgREST: anônimos e autenticados podem consultar via token seguro
grant execute on function public.get_shared_family_budget(text, text) to anon, authenticated, service_role;
