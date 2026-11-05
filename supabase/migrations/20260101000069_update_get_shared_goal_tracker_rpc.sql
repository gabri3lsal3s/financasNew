-- ---------------------------------------------------------------------------
-- 20260101000069_update_get_shared_goal_tracker_rpc.sql
-- Módulo de Compartilhamento Público: Enriquecimento de Metas Coletivas
-- Suporte a status (ativo, concluído, arquivado), notas e contribuições
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_goal_tracker(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_title text;
  v_category_id uuid;
  v_target_cents bigint;
  v_incomes_cents bigint := 0;
  v_current_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_percentage int := 0;
  v_deadline date;
  v_days_remaining int := null;
  v_organizer_name text;
  v_organizer_city text;
  v_pix_key text;
  v_pix_key_type text;
  v_pix_br_code text;
  v_status text;
  v_notes text;
  v_contributions jsonb;
begin
  -- 1. Localizar o compartilhamento público ativo
  select *
  into v_share
  from public.public_shares
  where token = p_token
    and kind = 'goal_tracker'
    and is_revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_share is null then
    return null;
  end if;

  -- 2. Extrair metadados do payload
  v_title := coalesce(nullif(trim(v_share.payload->>'title'), ''), 'Meta Coletiva');
  
  if (v_share.payload ? 'category_id') and (v_share.payload->>'category_id' ~ '^[0-9a-fA-F-]{36}$') then
    v_category_id := (v_share.payload->>'category_id')::uuid;
  end if;

  v_target_cents := coalesce((v_share.payload->>'target_cents')::bigint, 0);

  if (v_share.payload ? 'deadline') and (v_share.payload->>'deadline' ~ '^\d{4}-\d{2}-\d{2}$') then
    v_deadline := (v_share.payload->>'deadline')::date;
    v_days_remaining := greatest(0, (v_deadline - current_date))::int;
  end if;

  v_organizer_name := coalesce(nullif(trim(v_share.payload->>'organizer_name'), ''), 'Organizador');
  v_organizer_city := coalesce(nullif(trim(v_share.payload->>'organizer_city'), ''), 'SAO PAULO');
  v_pix_key := coalesce(v_share.payload->>'pix_key', '');
  v_pix_key_type := coalesce(v_share.payload->>'pix_key_type', 'auto');
  v_pix_br_code := coalesce(v_share.payload->>'pix_br_code', '');
  v_status := coalesce(nullif(trim(v_share.payload->>'status'), ''), 'active');
  v_notes := nullif(trim(v_share.payload->>'notes'), '');
  v_contributions := coalesce(v_share.payload->'contributions', '[]'::jsonb);

  -- 3. Calcular arrecadação atual
  -- Se houver categoria vinculada, busca a soma real de depósitos/rendas registradas no app
  if v_category_id is not null then
    select coalesce(sum(round(i.value * 100)::bigint), 0)
    into v_incomes_cents
    from public.incomes i
    where i.user_id = v_share.user_id
      and i.category_id = v_category_id;
  end if;

  -- Valor atual combina receitas cadastradas com base declarada no payload
  v_current_cents := greatest(coalesce(v_incomes_cents, 0), coalesce((v_share.payload->>'current_cents')::bigint, 0));
  v_remaining_cents := greatest(0, v_target_cents - v_current_cents);

  if v_target_cents > 0 then
    v_percentage := round((v_current_cents::numeric / v_target_cents::numeric) * 100)::int;
  else
    v_percentage := 0;
  end if;

  -- 4. Montar e retornar o JSON consolidado
  return jsonb_build_object(
    'token', v_share.token,
    'title', v_title,
    'category_id', v_category_id,
    'target_cents', v_target_cents,
    'current_cents', v_current_cents,
    'remaining_cents', v_remaining_cents,
    'percentage', v_percentage,
    'deadline', case when v_deadline is not null then v_deadline::text else null end,
    'days_remaining', v_days_remaining,
    'organizer_name', v_organizer_name,
    'organizer_city', v_organizer_city,
    'pix_key', v_pix_key,
    'pix_key_type', v_pix_key_type,
    'pix_br_code', v_pix_br_code,
    'is_revoked', v_share.is_revoked,
    'expires_at', v_share.expires_at,
    'status', v_status,
    'notes', v_notes,
    'contributions', v_contributions
  );
end;
$$;

grant execute on function public.get_shared_goal_tracker(text) to anon, authenticated, service_role;
