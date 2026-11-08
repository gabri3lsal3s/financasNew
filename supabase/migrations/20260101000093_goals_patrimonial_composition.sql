-- ---------------------------------------------------------------------------
-- 20260101000093_goals_patrimonial_composition.sql
-- Expansão e Automação de Metas Financeiras (§Plano 12):
-- 1. Teto de integridade de no máximo 5 metas ativas por usuário
-- 2. Suporte a composição patrimonial (composition_config)
-- 3. RPC transacional de aporte direto em metas (allocate_goal_deposit)
-- ---------------------------------------------------------------------------

-- 1. Trigger de Integridade: Teto de 5 Metas Ativas Simultâneas
create or replace function public.check_max_active_goals_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
  v_status text;
begin
  -- Aplica apenas a compartilhamentos do tipo goal_tracker
  if NEW.kind <> 'goal_tracker' then
    return NEW;
  end if;

  v_status := coalesce(NEW.payload->>'status', 'active');

  -- Metas arquivadas ou revogadas não consomem o teto de ativas
  if v_status = 'archived' or NEW.is_revoked = true then
    return NEW;
  end if;

  select count(*)
  into v_active_count
  from public.public_shares
  where user_id = NEW.user_id
    and kind = 'goal_tracker'
    and is_revoked = false
    and coalesce(payload->>'status', 'active') <> 'archived'
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_active_count >= 5 then
    raise exception 'Limite maximo de 5 metas ativas simultaneas atingido. Conclua ou arquive uma meta existente antes de abrir uma nova.'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_check_max_active_goals on public.public_shares;
create trigger trigger_check_max_active_goals
  before insert or update on public.public_shares
  for each row
  execute function public.check_max_active_goals_limit();

-- 2. RPC Transacional: Aporte Direto em Meta (allocate_goal_deposit)
create or replace function public.allocate_goal_deposit(
  p_share_id uuid,
  p_amount_cents bigint,
  p_contributor_name text default 'Você',
  p_source_account_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_share record;
  v_current_cents bigint;
  v_target_cents bigint;
  v_new_current_cents bigint;
  v_contributions jsonb;
  v_new_contribution jsonb;
  v_today text;
  v_updated_payload jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Valor do aporte deve ser maior que zero.' using errcode = '22003';
  end if;

  select *
  into v_share
  from public.public_shares
  where id = p_share_id
    and user_id = v_uid
    and kind = 'goal_tracker'
  for update;

  if v_share is null then
    raise exception 'Meta nao encontrada ou acesso nao autorizado.' using errcode = 'P0002';
  end if;

  v_today := to_char(current_date, 'YYYY-MM-DD');
  v_current_cents := coalesce((v_share.payload->>'current_cents')::bigint, 0);
  v_target_cents := coalesce((v_share.payload->>'target_cents')::bigint, 0);
  v_new_current_cents := v_current_cents + p_amount_cents;

  v_contributions := coalesce(v_share.payload->'contributions', '[]'::jsonb);
  v_new_contribution := jsonb_build_object(
    'id', gen_random_uuid(),
    'amount_cents', p_amount_cents,
    'contributor_name', coalesce(nullif(trim(p_contributor_name), ''), 'Você'),
    'date', v_today,
    'created_at', now()
  );

  v_contributions := v_contributions || jsonb_build_array(v_new_contribution);

  v_updated_payload := v_share.payload || jsonb_build_object(
    'current_cents', v_new_current_cents,
    'contributions', v_contributions
  );

  if v_target_cents > 0 and v_new_current_cents >= v_target_cents then
    v_updated_payload := v_updated_payload || jsonb_build_object('status', 'completed');
  end if;

  update public.public_shares
  set payload = v_updated_payload,
      updated_at = now()
  where id = p_share_id;

  return jsonb_build_object(
    'success', true,
    'share_id', p_share_id,
    'new_current_cents', v_new_current_cents,
    'target_cents', v_target_cents,
    'is_completed', (v_target_cents > 0 and v_new_current_cents >= v_target_cents)
  );
end;
$$;

grant execute on function public.allocate_goal_deposit(uuid, bigint, text, uuid, text) to authenticated;
