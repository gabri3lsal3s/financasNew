-- ---------------------------------------------------------------------------
-- 20260101000094_create_trips_and_shared_ledger.sql
-- Módulo Modo Viagem: Finanças Compartilhadas Temporárias & Liquidação Mútua
-- Tabelas trips, trip_members, trip_expenses, trip_expense_splits, trip_settlements
-- RLS hermético e RPCs de leitura pública e lançamento seguro
-- ---------------------------------------------------------------------------

-- 1. TABELA PRINCIPAL DE VIAGENS
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(120) not null,
  destination varchar(120),
  start_date date not null,
  end_date date not null,
  status varchar(20) not null default 'active' check (status in ('planning', 'active', 'settling', 'completed', 'archived')),
  currency varchar(3) not null default 'BRL',
  public_token varchar(64) not null unique,
  passcode_hash varchar(128),
  cover_photo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. TABELA DE MEMBROS DA VIAGEM
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name varchar(80) not null,
  user_id uuid references auth.users(id) on delete set null,
  pix_key varchar(140),
  pix_key_type varchar(20) check (pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  is_host boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_trip_member_name unique (trip_id, name)
);

-- 3. VÍNCULO EM EXPENSES (DESPESAS PESSOAIS)
alter table public.expenses
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

-- 4. TABELA DE DESPESAS DA VIAGEM
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by_member_id uuid not null references public.trip_members(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  description varchar(140) not null,
  category_name varchar(60) not null default 'Geral',
  expense_date date not null,
  split_type varchar(20) not null default 'equal' check (split_type in ('equal', 'custom', 'shares')),
  receipt_url text,
  created_by_member_id uuid references public.trip_members(id) on delete set null,
  linked_personal_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 5. TABELA DE DIVISÃO DE COTAS (SPLITS)
create table if not exists public.trip_expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  share_cents integer not null check (share_cents >= 0),
  constraint uq_trip_split_member unique (expense_id, member_id)
);

-- 6. TABELA DE LIQUIDAÇÕES E ACERTOS (SETTLEMENTS)
create table if not exists public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member_id uuid not null references public.trip_members(id) on delete restrict,
  to_member_id uuid not null references public.trip_members(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  status varchar(20) not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_at timestamptz,
  pix_transaction_id varchar(100),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint chk_trip_settlement_distinct_members check (from_member_id <> to_member_id)
);

-- 7. ÍNDICES DE PERFORMANCE E INTEGRIDADE
create index if not exists idx_trips_host_user_id on public.trips (host_user_id);
create index if not exists idx_trips_public_token on public.trips (public_token);
create index if not exists idx_trip_members_trip_id on public.trip_members (trip_id);
create index if not exists idx_trip_members_user_id on public.trip_members (user_id);
create index if not exists idx_trip_expenses_trip_id on public.trip_expenses (trip_id);
create index if not exists idx_trip_expenses_paid_by on public.trip_expenses (paid_by_member_id);
create index if not exists idx_trip_expenses_linked_personal on public.trip_expenses (linked_personal_expense_id);
create index if not exists idx_trip_splits_expense_id on public.trip_expense_splits (expense_id);
create index if not exists idx_trip_splits_member_id on public.trip_expense_splits (member_id);
create index if not exists idx_trip_settlements_trip_id on public.trip_settlements (trip_id);
create index if not exists idx_expenses_trip_id on public.expenses (trip_id);

-- 8. TRIGGER DE UPDATED_AT
create or replace function public.set_trips_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.set_trips_updated_at();

drop trigger if exists trg_trip_expenses_updated_at on public.trip_expenses;
create trigger trg_trip_expenses_updated_at
  before update on public.trip_expenses
  for each row execute function public.set_trips_updated_at();

-- 9. HABILITAÇÃO DE RLS
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_expense_splits enable row level security;
alter table public.trip_settlements enable row level security;

-- Políticas trips
drop policy if exists "trips_select_policy" on public.trips;
create policy "trips_select_policy" on public.trips
  for select to authenticated
  using (
    host_user_id = auth.uid()
    or exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trips.id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "trips_insert_policy" on public.trips;
create policy "trips_insert_policy" on public.trips
  for insert to authenticated
  with check (host_user_id = auth.uid());

drop policy if exists "trips_update_policy" on public.trips;
create policy "trips_update_policy" on public.trips
  for update to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

drop policy if exists "trips_delete_policy" on public.trips;
create policy "trips_delete_policy" on public.trips
  for delete to authenticated
  using (host_user_id = auth.uid());

-- Políticas trip_members
drop policy if exists "trip_members_select_policy" on public.trip_members;
create policy "trip_members_select_policy" on public.trip_members
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

drop policy if exists "trip_members_write_policy" on public.trip_members;
create policy "trip_members_write_policy" on public.trip_members
  for all to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.host_user_id = auth.uid()
    )
  );

-- Políticas trip_expenses
drop policy if exists "trip_expenses_select_policy" on public.trip_expenses;
create policy "trip_expenses_select_policy" on public.trip_expenses
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

drop policy if exists "trip_expenses_write_policy" on public.trip_expenses;
create policy "trip_expenses_write_policy" on public.trip_expenses
  for all to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

-- Políticas trip_expense_splits
drop policy if exists "trip_expense_splits_select_policy" on public.trip_expense_splits;
create policy "trip_expense_splits_select_policy" on public.trip_expense_splits
  for select to authenticated
  using (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_splits.expense_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

drop policy if exists "trip_expense_splits_write_policy" on public.trip_expense_splits;
create policy "trip_expense_splits_write_policy" on public.trip_expense_splits
  for all to authenticated
  using (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_splits.expense_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

-- Políticas trip_settlements
drop policy if exists "trip_settlements_select_policy" on public.trip_settlements;
create policy "trip_settlements_select_policy" on public.trip_settlements
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_settlements.trip_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

drop policy if exists "trip_settlements_write_policy" on public.trip_settlements;
create policy "trip_settlements_write_policy" on public.trip_settlements
  for all to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_settlements.trip_id
      and (
        t.host_user_id = auth.uid()
        or exists (select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid())
      )
    )
  );

-- Permissões básicas
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
grant select, insert, update, delete on public.trip_expenses to authenticated;
grant select, insert, update, delete on public.trip_expense_splits to authenticated;
grant select, insert, update, delete on public.trip_settlements to authenticated;

grant select, insert, update, delete on public.trips to service_role;
grant select, insert, update, delete on public.trip_members to service_role;
grant select, insert, update, delete on public.trip_expenses to service_role;
grant select, insert, update, delete on public.trip_expense_splits to service_role;
grant select, insert, update, delete on public.trip_settlements to service_role;

-- 10. RPCs COM SECURITY DEFINER

-- 10.1 Leitura Pública Sanitizada da Viagem
create or replace function public.get_public_trip_ledger(
  p_token text,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip record;
  v_members jsonb;
  v_expenses jsonb;
  v_settlements jsonb;
begin
  if p_token is null or trim(p_token) = '' then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;

  select * into v_trip
  from public.trips
  where public_token = p_token;

  if v_trip is null then
    return null;
  end if;

  -- Validação de passcode opcional
  if v_trip.passcode_hash is not null and (p_passcode is null or v_trip.passcode_hash <> p_passcode) then
    return jsonb_build_object(
      'requires_passcode', true,
      'trip_title', v_trip.title
    );
  end if;

  -- Membros
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'is_host', m.is_host,
      'has_axis_account', (m.user_id is not null),
      'pix_key', m.pix_key,
      'pix_key_type', m.pix_key_type
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

  -- Liquidações (settlements)
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

grant execute on function public.get_public_trip_ledger(text, text) to anon, authenticated, service_role;

-- 10.2 Inclusão Pública de Despesa na Viagem
create or replace function public.add_public_trip_expense(
  p_token text,
  p_paid_by_member_id uuid,
  p_amount_cents int,
  p_description text,
  p_category_name text,
  p_expense_date date,
  p_split_type text,
  p_splits jsonb,
  p_receipt_url text default null,
  p_created_by_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip record;
  v_expense_id uuid;
  v_split record;
  v_total_split_cents integer := 0;
begin
  -- 1. Validações preliminares
  if p_token is null or trim(p_token) = '' then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'O valor deve ser maior que zero.' using errcode = '22023';
  end if;

  if p_description is null or trim(p_description) = '' then
    raise exception 'A descrição é obrigatória.' using errcode = '22023';
  end if;

  -- 2. Localizar viagem
  select * into v_trip
  from public.trips
  where public_token = p_token;

  if v_trip is null then
    raise exception 'Viagem não encontrada.' using errcode = 'P0002';
  end if;

  if v_trip.status in ('completed', 'archived') then
    raise exception 'Esta viagem já foi finalizada ou arquivada.' using errcode = '42501';
  end if;

  -- 3. Validar se o membro pagador pertence à viagem
  if not exists (
    select 1 from public.trip_members
    where id = p_paid_by_member_id and trip_id = v_trip.id
  ) then
    raise exception 'Membro pagador não pertence a esta viagem.' using errcode = '22023';
  end if;

  -- 4. Validar soma das cotas
  for v_split in select * from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents int)
  loop
    v_total_split_cents := v_total_split_cents + v_split.share_cents;
  end loop;

  if v_total_split_cents <> p_amount_cents then
    raise exception 'A soma das cotas (%) deve ser exatamente igual ao valor total (%)', v_total_split_cents, p_amount_cents using errcode = '22023';
  end if;

  -- 5. Inserir despesa
  insert into public.trip_expenses (
    trip_id,
    paid_by_member_id,
    amount_cents,
    description,
    category_name,
    expense_date,
    split_type,
    receipt_url,
    created_by_member_id
  ) values (
    v_trip.id,
    p_paid_by_member_id,
    p_amount_cents,
    trim(p_description),
    coalesce(nullif(trim(p_category_name), ''), 'Geral'),
    coalesce(p_expense_date, current_date),
    coalesce(p_split_type, 'equal'),
    p_receipt_url,
    p_created_by_member_id
  ) returning id into v_expense_id;

  -- 6. Inserir splits
  insert into public.trip_expense_splits (expense_id, member_id, share_cents)
  select
    v_expense_id,
    x.member_id,
    x.share_cents
  from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents int);

  return jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id
  );
end;
$$;

grant execute on function public.add_public_trip_expense(text, uuid, int, text, text, date, text, jsonb, text, uuid) to anon, authenticated, service_role;

-- 10.3 Registro de Liquidação / Gravação de Acertos
create or replace function public.record_trip_settlements(
  p_trip_id uuid,
  p_settlements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_trip record;
begin
  if v_caller_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id;

  if v_trip is null then
    raise exception 'Viagem não encontrada.' using errcode = 'P0002';
  end if;

  if v_trip.host_user_id <> v_caller_id and not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_trip.id and tm.user_id = v_caller_id
  ) then
    raise exception 'Permissão negada para liquidar esta viagem.' using errcode = '42501';
  end if;

  -- Limpar pendências anteriores se re-calculando
  delete from public.trip_settlements
  where trip_id = p_trip_id and status = 'pending';

  -- Gravar novos settlements
  insert into public.trip_settlements (
    trip_id,
    from_member_id,
    to_member_id,
    amount_cents,
    status
  )
  select
    p_trip_id,
    x.from_member_id,
    x.to_member_id,
    x.amount_cents,
    'pending'
  from jsonb_to_recordset(p_settlements) as x(from_member_id uuid, to_member_id uuid, amount_cents int);

  -- Atualizar status da viagem para 'settling'
  update public.trips
  set status = 'settling', updated_at = timezone('utc'::text, now())
  where id = p_trip_id and status in ('planning', 'active');

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.record_trip_settlements(uuid, jsonb) to authenticated, service_role;
