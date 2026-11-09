-- ---------------------------------------------------------------------------
-- 20260101000102_harden_trip_expenses_delete_policy.sql
-- Plano 18 — Hardening de RLS em trip_expenses (SEC-05)
-- Substituição da política write "FOR ALL" por políticas granulares de INSERT, UPDATE e DELETE.
-- Impede que convidados excluam ou alterem despesas de outros participantes via REST direto.
-- ---------------------------------------------------------------------------

-- 1. Remove a política ampla anterior
drop policy if exists "trip_expenses_write_policy" on public.trip_expenses;
drop policy if exists "trip_expenses_insert_policy" on public.trip_expenses;
drop policy if exists "trip_expenses_update_policy" on public.trip_expenses;
drop policy if exists "trip_expenses_delete_policy" on public.trip_expenses;

-- 2. Política de INSERÇÃO: qualquer membro ou anfitrião da viagem pode registrar novas despesas
create policy "trip_expenses_insert_policy" on public.trip_expenses
  for insert to authenticated
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or public.is_trip_member(trip_id, (select auth.uid()))
  );

-- 3. Política de ATUALIZAÇÃO: restrita ao anfitrião da viagem ou ao titular pagador/criador
create policy "trip_expenses_update_policy" on public.trip_expenses
  for update to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or (select auth.uid()) in (
      select tm.user_id from public.trip_members tm 
      where tm.id in (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
    )
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or (select auth.uid()) in (
      select tm.user_id from public.trip_members tm 
      where tm.id in (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
    )
  );

-- 4. Política de EXCLUSÃO: restrita estritamente ao anfitrião da viagem ou ao titular criador/pagador
create policy "trip_expenses_delete_policy" on public.trip_expenses
  for delete to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or (select auth.uid()) in (
      select tm.user_id from public.trip_members tm 
      where tm.id in (trip_expenses.paid_by_member_id, trip_expenses.created_by_member_id)
    )
  );
