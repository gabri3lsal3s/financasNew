-- Migration 20260101000096_add_joined_date_to_trip_members.sql
-- Adiciona joined_date para permitir controle temporal de quando um participante ingressou nas despesas da viagem.

alter table public.trip_members
  add column if not exists joined_date date default null;

comment on column public.trip_members.joined_date is
  'Data a partir da qual o membro participa dos rateios da viagem. Se nulo, participa desde o início.';

-- Atualiza a função pública get_public_trip_ledger para expor joined_date
create or replace function public.get_public_trip_ledger(
  p_token text,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip record;
  v_members jsonb;
  v_expenses jsonb;
  v_settlements jsonb;
begin
  select * into v_trip
  from public.trips
  where public_token = p_token
    and status not in ('archived');

  if not found then
    return null;
  end if;

  if v_trip.passcode_hash is not null then
    if p_passcode is null or crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash then
      return jsonb_build_object(
        'error', 'passcode_required',
        'has_passcode', true,
        'trip_id', v_trip.id,
        'title', v_trip.title
      );
    end if;
  end if;

  -- Membros (agora incluindo joined_date)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'is_host', m.is_host,
      'has_axis_account', (m.user_id is not null),
      'pix_key', m.pix_key,
      'pix_key_type', m.pix_key_type,
      'joined_date', m.joined_date
    ) order by m.is_host desc, m.name asc
  ), '[]'::jsonb) into v_members
  from public.trip_members m
  where m.trip_id = v_trip.id;

  -- Despesas com splits
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'paid_by_member_id', e.paid_by_member_id,
      'amount_cents', e.amount_cents,
      'description', e.description,
      'category_name', e.category_name,
      'expense_date', e.expense_date,
      'split_type', e.split_type,
      'receipt_url', e.receipt_url,
      'created_at', e.created_at,
      'splits', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'member_id', s.member_id,
            'share_cents', s.share_cents
          )
        )
        from public.trip_expense_splits s
        where s.expense_id = e.id
      ), '[]'::jsonb)
    ) order by e.expense_date desc, e.created_at desc
  ), '[]'::jsonb) into v_expenses
  from public.trip_expenses e
  where e.trip_id = v_trip.id;

  -- Settlements confirmados ou pendentes
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'from_member_id', s.from_member_id,
      'to_member_id', s.to_member_id,
      'amount_cents', s.amount_cents,
      'status', s.status,
      'confirmed_at', s.confirmed_at
    ) order by s.created_at asc
  ), '[]'::jsonb) into v_settlements
  from public.trip_settlements s
  where s.trip_id = v_trip.id;

  return jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'destination', v_trip.destination,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'status', v_trip.status,
      'currency', v_trip.currency,
      'public_token', v_trip.public_token,
      'cover_photo_url', v_trip.cover_photo_url,
      'has_passcode', (v_trip.passcode_hash is not null)
    ),
    'members', v_members,
    'expenses', v_expenses,
    'settlements', v_settlements
  );
end;
$$;
