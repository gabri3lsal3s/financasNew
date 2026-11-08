-- Migration 20260101000097_allow_custom_host_name_in_trip.sql
-- Atualiza a função create_trip para aceitar o nome customizado do anfitrião (ou buscar o nome real da tabela profiles)

create or replace function public.create_trip(
  p_title text,
  p_destination text default null,
  p_start_date date default current_date,
  p_end_date date default current_date,
  p_currency text default 'BRL',
  p_cover_photo_url text default null,
  p_initial_members jsonb default '[]'::jsonb,
  p_host_name text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_trip public.trips;
  v_token text;
  v_member record;
  v_host_name text;
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if p_title is null or trim(p_title) = '' then
    raise exception 'O título da viagem é obrigatório.' using errcode = '22023';
  end if;

  if p_end_date < p_start_date then
    raise exception 'A data de término não pode ser anterior à data de início.' using errcode = '22023';
  end if;

  begin
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
  exception when others then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_token := substr(v_token, 1, 48);
  end;

  -- Resolve o nome do anfitrião
  if p_host_name is not null and trim(p_host_name) <> '' then
    v_host_name := trim(p_host_name);
  else
    select nullif(trim(name), '') into v_host_name
    from public.profiles
    where id = v_caller_id;

    if v_host_name is null then
      v_host_name := 'Organizador';
    end if;
  end if;

  insert into public.trips (
    host_user_id,
    title,
    destination,
    start_date,
    end_date,
    currency,
    cover_photo_url,
    public_token
  ) values (
    v_caller_id,
    trim(p_title),
    nullif(trim(p_destination), ''),
    p_start_date,
    p_end_date,
    coalesce(nullif(trim(p_currency), ''), 'BRL'),
    nullif(trim(p_cover_photo_url), ''),
    v_token
  ) returning * into v_trip;

  -- Insere o host com seu nome real
  insert into public.trip_members (
    trip_id,
    name,
    user_id,
    is_host
  ) values (
    v_trip.id,
    v_host_name,
    v_caller_id,
    true
  );

  -- Insere membros adicionais se informados
  if p_initial_members is not null and jsonb_array_length(p_initial_members) > 0 then
    for v_member in select * from jsonb_to_recordset(p_initial_members) as x(
      name text,
      pix_key text,
      pix_key_type text
    )
    loop
      if v_member.name is not null and trim(v_member.name) <> '' and trim(v_member.name) <> v_host_name and trim(v_member.name) <> 'Você' then
        insert into public.trip_members (
          trip_id,
          name,
          pix_key,
          pix_key_type,
          is_host
        ) values (
          v_trip.id,
          trim(v_member.name),
          nullif(trim(v_member.pix_key), ''),
          nullif(trim(v_member.pix_key_type), ''),
          false
        ) on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_trip;
end;
$$;

grant execute on function public.create_trip(text, text, date, date, text, text, jsonb, text) to authenticated, service_role;
