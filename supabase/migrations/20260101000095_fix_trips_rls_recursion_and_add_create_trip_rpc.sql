-- ---------------------------------------------------------------------------
-- 20260101000095_fix_trips_rls_recursion_and_add_create_trip_rpc.sql
-- Correção de recursão infinita (42P17) nas políticas RLS do Modo Viagem
-- e criação da RPC atômica create_trip (Regra 5 AGENTS.md).
-- ---------------------------------------------------------------------------

-- 1. FUNÇÕES AUXILIARES COM SECURITY DEFINER (Previnem recursão entre trips e trip_members)

create or replace function public.is_trip_member(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = p_trip_id
      and user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.is_trip_host(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.trips
    where id = p_trip_id
      and host_user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.can_access_trip_expense(p_expense_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.trip_expenses te
    where te.id = p_expense_id
      and (
        public.is_trip_host(te.trip_id, coalesce(p_user_id, auth.uid()))
        or public.is_trip_member(te.trip_id, coalesce(p_user_id, auth.uid()))
      )
  );
$$;

grant execute on function public.is_trip_member(uuid, uuid) to authenticated, anon, service_role;
grant execute on function public.is_trip_host(uuid, uuid) to authenticated, anon, service_role;
grant execute on function public.can_access_trip_expense(uuid, uuid) to authenticated, anon, service_role;

-- 2. RECRIAR POLÍTICAS RLS LIVRES DE RECURSÃO

-- 2.1 public.trips
drop policy if exists "trips_select_policy" on public.trips;
create policy "trips_select_policy" on public.trips
  for select to authenticated
  using (
    host_user_id = (select auth.uid())
    or public.is_trip_member(id, (select auth.uid()))
  );

drop policy if exists "trips_insert_policy" on public.trips;
create policy "trips_insert_policy" on public.trips
  for insert to authenticated
  with check (host_user_id = (select auth.uid()));

drop policy if exists "trips_update_policy" on public.trips;
create policy "trips_update_policy" on public.trips
  for update to authenticated
  using (host_user_id = (select auth.uid()))
  with check (host_user_id = (select auth.uid()));

drop policy if exists "trips_delete_policy" on public.trips;
create policy "trips_delete_policy" on public.trips
  for delete to authenticated
  using (host_user_id = (select auth.uid()));

-- 2.2 public.trip_members
drop policy if exists "trip_members_select_policy" on public.trip_members;
create policy "trip_members_select_policy" on public.trip_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

drop policy if exists "trip_members_write_policy" on public.trip_members;
create policy "trip_members_write_policy" on public.trip_members
  for all to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
  );

-- 2.3 public.trip_expenses
drop policy if exists "trip_expenses_select_policy" on public.trip_expenses;
create policy "trip_expenses_select_policy" on public.trip_expenses
  for select to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

drop policy if exists "trip_expenses_write_policy" on public.trip_expenses;
create policy "trip_expenses_write_policy" on public.trip_expenses
  for all to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

-- 2.4 public.trip_expense_splits
drop policy if exists "trip_expense_splits_select_policy" on public.trip_expense_splits;
create policy "trip_expense_splits_select_policy" on public.trip_expense_splits
  for select to authenticated
  using (
    public.can_access_trip_expense(expense_id, (select auth.uid()))
  );

drop policy if exists "trip_expense_splits_write_policy" on public.trip_expense_splits;
create policy "trip_expense_splits_write_policy" on public.trip_expense_splits
  for all to authenticated
  using (
    public.can_access_trip_expense(expense_id, (select auth.uid()))
  )
  with check (
    public.can_access_trip_expense(expense_id, (select auth.uid()))
  );

-- 2.5 public.trip_settlements
drop policy if exists "trip_settlements_select_policy" on public.trip_settlements;
create policy "trip_settlements_select_policy" on public.trip_settlements
  for select to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

drop policy if exists "trip_settlements_write_policy" on public.trip_settlements;
create policy "trip_settlements_write_policy" on public.trip_settlements
  for all to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

-- 3. RPC ATÔMICA CREATE_TRIP

create or replace function public.create_trip(
  p_title text,
  p_destination text default null,
  p_start_date date default current_date,
  p_end_date date default current_date,
  p_currency text default 'BRL',
  p_cover_photo_url text default null,
  p_initial_members jsonb default '[]'::jsonb
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

  -- Insere o host como membro 'Você'
  insert into public.trip_members (
    trip_id,
    name,
    user_id,
    is_host
  ) values (
    v_trip.id,
    'Você',
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
      if v_member.name is not null and trim(v_member.name) <> '' and trim(v_member.name) <> 'Você' then
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

grant execute on function public.create_trip(text, text, date, date, text, text, jsonb) to authenticated, service_role;
