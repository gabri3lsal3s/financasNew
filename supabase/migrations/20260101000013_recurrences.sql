-- ================================================================
-- Migration 20260101000013 — Fase 32: Recorrências, Rendas Parceladas
-- & Operações em Grupo (proposta aprovada 2026-08-17)
--
--   • Tabela `recurrences` (template — fonte da verdade) + `recurrence_skips`
--     (ocorrência excluída individualmente não regenera);
--   • `expenses` += recurrence_id/occurrence_number (avulso XOR parcela XOR
--     recorrência); `incomes` += parcelamento (espelho de expenses) +
--     recorrência;
--   • RPCs transacionais (D1) com validação de invariantes no servidor:
--     create_recurrence, materialize_recurrences, delete_recurrence_occurrences,
--     update_recurrence_occurrences, create_income_installments,
--     delete_income_installments, update_income_installments_group,
--     update_expense_installments_group.
-- ================================================================

-- ----------------------------------------------------------------
-- Recurrences (template)
-- ----------------------------------------------------------------
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  frequency text not null check (frequency in ('monthly', 'weekly', 'quarterly', 'yearly')),
  value numeric(12, 2) not null check (value > 0),
  category_id uuid not null references public.categories (id),
  start_date date not null check (start_date >= date '2026-01-01'),
  -- Fim sempre definido: exatamente um entre end_date e occurrences_total.
  end_date date check (end_date is null or end_date >= start_date),
  occurrences_total integer check (occurrences_total is null or occurrences_total >= 1),
  check ((end_date is null) <> (occurrences_total is null)),
  payment_method text check (payment_method in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other')),
  card_id uuid references public.credit_cards (id),
  receive_type text check (receive_type in ('cash', 'pix', 'transfer', 'other')),
  description text,
  report_weight numeric(5, 4) not null default 1 check (report_weight between 0 and 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Consistência por tipo: despesa tem forma (+ cartão no crédito); renda tem tipo de recebimento.
  check (
    (kind = 'expense' and payment_method is not null and receive_type is null)
    or (kind = 'income' and receive_type is not null and payment_method is null)
  ),
  check (payment_method <> 'credit_card' or card_id is not null)
);

-- Ocorrência excluída individualmente (não regenera na materialização).
create table public.recurrence_skips (
  recurrence_id uuid not null references public.recurrences (id) on delete cascade,
  occurrence_date date not null,
  primary key (recurrence_id, occurrence_date)
);

-- ----------------------------------------------------------------
-- Expenses += recorrência
-- ----------------------------------------------------------------
alter table public.expenses add column recurrence_id uuid references public.recurrences (id) on delete cascade;
alter table public.expenses add column occurrence_number integer check (occurrence_number is null or occurrence_number >= 1);
alter table public.expenses add constraint expenses_recurrence_pair check ((recurrence_id is null) = (occurrence_number is null));
alter table public.expenses add constraint expenses_group_exclusive check (
  (installment_group_id is null and recurrence_id is null)
  or (installment_group_id is not null and recurrence_id is null)
  or (installment_group_id is null and recurrence_id is not null)
);
create unique index idx_expenses_recurrence_date on public.expenses (recurrence_id, date) where recurrence_id is not null;

-- ----------------------------------------------------------------
-- Incomes += parcelamento + recorrência (espelho de expenses)
-- ----------------------------------------------------------------
alter table public.incomes add column installments_total integer not null default 1 check (installments_total between 1 and 60);
alter table public.incomes add column installment_number integer not null default 1 check (installment_number between 1 and installments_total);
alter table public.incomes add column installment_group_id uuid;
alter table public.incomes add column recurrence_id uuid references public.recurrences (id) on delete cascade;
alter table public.incomes add column occurrence_number integer check (occurrence_number is null or occurrence_number >= 1);
alter table public.incomes add constraint incomes_group_present check ((installments_total > 1) = (installment_group_id is not null));
alter table public.incomes add constraint incomes_recurrence_pair check ((recurrence_id is null) = (occurrence_number is null));
alter table public.incomes add constraint incomes_group_exclusive check (
  (installment_group_id is null and recurrence_id is null)
  or (installment_group_id is not null and recurrence_id is null)
  or (installment_group_id is null and recurrence_id is not null)
);
create unique index idx_incomes_recurrence_date on public.incomes (recurrence_id, date) where recurrence_id is not null;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.recurrences enable row level security;
alter table public.recurrence_skips enable row level security;

create policy "recurrences_all_own" on public.recurrences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recurrence_skips_all_own" on public.recurrence_skips
  for all using (
    exists (select 1 from public.recurrences r where r.id = recurrence_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.recurrences r where r.id = recurrence_id and r.user_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- RPC: create_recurrence — cria o template (não materializa; sob demanda)
-- ----------------------------------------------------------------
create or replace function public.create_recurrence(
  p_kind text,
  p_frequency text,
  p_value numeric,
  p_category_id uuid,
  p_start_date date,
  p_end_date date,
  p_occurrences_total integer,
  p_payment_method text,
  p_card_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_recurrence_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_kind not in ('expense', 'income') then
    raise exception 'Tipo de recorrência inválido';
  end if;
  if p_frequency not in ('monthly', 'weekly', 'quarterly', 'yearly') then
    raise exception 'Frequência inválida';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da recorrência deve ser maior que zero';
  end if;
  if p_start_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  -- Fim sempre definido: exatamente um entre data e nº de ocorrências.
  if (p_end_date is null) = (p_occurrences_total is null) then
    raise exception 'Defina exatamente um limite: data de fim ou número de ocorrências';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data de fim anterior à data de início da recorrência';
  end if;
  if p_occurrences_total is not null and p_occurrences_total < 1 then
    raise exception 'Número de ocorrências deve ser maior que zero';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> p_kind then
    raise exception 'Categoria de % inválida', p_kind;
  end if;

  if p_kind = 'expense' then
    if p_payment_method is null then
      raise exception 'Forma de pagamento obrigatória para despesa recorrente';
    end if;
    if p_payment_method = 'credit_card' and p_card_id is null then
      raise exception 'Cartão obrigatório para pagamento no crédito';
    end if;
  elsif p_receive_type is null then
    raise exception 'Tipo de recebimento obrigatório para renda recorrente';
  end if;

  insert into public.recurrences (
    user_id, kind, frequency, value, category_id, start_date, end_date,
    occurrences_total, payment_method, card_id, receive_type, description, report_weight
  ) values (
    v_user_id, p_kind, p_frequency, p_value, p_category_id, p_start_date,
    p_end_date, p_occurrences_total,
    case when p_kind = 'expense' then p_payment_method else null end,
    case when p_kind = 'expense' then p_card_id else null end,
    case when p_kind = 'income' then p_receive_type else null end,
    p_description, p_report_weight
  )
  returning id into v_recurrence_id;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'create',
    jsonb_build_object('kind', p_kind, 'frequency', p_frequency, 'value', p_value)
  );

  return v_recurrence_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: materialize_recurrences — insere ocorrências faltantes (D12:
-- cliente calcula as datas com domain/recurrences; servidor valida e
-- insere de forma idempotente, respeitando recurrence_skips).
-- ----------------------------------------------------------------
create or replace function public.materialize_recurrences(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_recurrence public.recurrences%rowtype;
  v_inserted integer := 0;
  v_occurrence_number integer;
  v_value numeric;
  v_date date;
  v_bill_competence text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Itens de materialização inválidos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_recurrence
      from public.recurrences
     where id = (v_item ->> 'recurrence_id')::uuid and user_id = v_user_id and is_active;
    if not found then
      continue; -- recorrência inativa/ausente não bloqueia o lote
    end if;

    v_date := (v_item ->> 'date')::date;
    v_occurrence_number := (v_item ->> 'occurrence_number')::integer;
    v_value := (v_item ->> 'value')::numeric;
    v_bill_competence := nullif(v_item ->> 'bill_competence', '');

    if v_date < date '2026-01-01' then
      raise exception 'Data de ocorrência anterior à data de início do app';
    end if;
    if v_occurrence_number is null or v_occurrence_number < 1 then
      raise exception 'Número de ocorrência inválido';
    end if;
    -- Valor deve espelhar o template (o cliente calcula a partir dele).
    if v_value is null or v_value <> v_recurrence.value then
      raise exception 'Valor da ocorrência difere do template da recorrência';
    end if;
    if v_recurrence.end_date is not null and v_date > v_recurrence.end_date then
      raise exception 'Ocorrência fora da janela da recorrência (data fim)';
    end if;
    if v_recurrence.occurrences_total is not null and v_occurrence_number > v_recurrence.occurrences_total then
      raise exception 'Ocorrência fora da janela da recorrência (número)';
    end if;
    if exists (
      select 1 from public.recurrence_skips
       where recurrence_id = v_recurrence.id and occurrence_date = v_date
    ) then
      continue; -- ocorrência excluída individualmente — não regenera
    end if;
    if v_recurrence.kind = 'expense' then
      if exists (select 1 from public.expenses where recurrence_id = v_recurrence.id and date = v_date) then
        continue; -- idempotência
      end if;
      insert into public.expenses (
        user_id, value, date, category_id, payment_method, card_id,
        installments_total, installment_number, installment_group_id,
        bill_competence, report_weight, base_amount, description,
        recurrence_id, occurrence_number
      ) values (
        v_user_id, v_value, v_date, v_recurrence.category_id,
        v_recurrence.payment_method, v_recurrence.card_id,
        1, 1, null,
        case when v_recurrence.payment_method = 'credit_card' then v_bill_competence else null end,
        v_recurrence.report_weight, v_value, v_recurrence.description,
        v_recurrence.id, v_occurrence_number
      );
    else
      if exists (select 1 from public.incomes where recurrence_id = v_recurrence.id and date = v_date) then
        continue;
      end if;
      insert into public.incomes (
        user_id, value, date, category_id, receive_type, description,
        report_weight, source_ref, installments_total, installment_number,
        installment_group_id, recurrence_id, occurrence_number
      ) values (
        v_user_id, v_value, v_date, v_recurrence.category_id,
        v_recurrence.receive_type, v_recurrence.description,
        v_recurrence.report_weight, null, 1, 1, null,
        v_recurrence.id, v_occurrence_number
      );
    end if;
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted > 0 then
    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (v_user_id, 'recurrence', '', 'materialize', jsonb_build_object('inserted', v_inserted));
  end if;

  return v_inserted;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: delete_recurrence_occurrences — 3 modos + cascata de dívidas
-- pendentes + truncamento do template (single/all/subsequent)
-- ----------------------------------------------------------------
create or replace function public.delete_recurrence_occurrences(
  p_occurrence_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recurrence_id uuid;
  v_occurrence_number integer;
  v_date date;
  v_kind text;
  v_table text;
  v_deleted integer := 0;
  v_recurrence public.recurrences%rowtype;
  v_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  -- Localiza a ocorrência (expense ou income) e o template.
  select recurrence_id, occurrence_number, date, 'expense'
    into v_recurrence_id, v_occurrence_number, v_date, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;

  if not found then
    select recurrence_id, occurrence_number, date, 'income'
      into v_recurrence_id, v_occurrence_number, v_date, v_kind
      from public.incomes
     where id = p_occurrence_id and user_id = v_user_id;
  end if;

  if v_recurrence_id is null then
    raise exception 'Ocorrência não encontrada';
  end if;

  select * into v_recurrence
    from public.recurrences
   where id = v_recurrence_id and user_id = v_user_id;
  if not found then
    raise exception 'Recorrência não encontrada';
  end if;

  -- single: remove a linha + grava skip (não regenera na materialização).
  if p_mode = 'single' then
    if v_kind = 'expense' then
      delete from public.debts where user_id = v_user_id and expense_id = p_occurrence_id and paid_at is null;
      delete from public.expenses where id = p_occurrence_id;
    else
      delete from public.incomes where id = p_occurrence_id;
    end if;
    insert into public.recurrence_skips (recurrence_id, occurrence_date)
    values (v_recurrence_id, v_date);
    v_deleted := 1;
  -- all: apaga o template (cascata nas linhas + skips) e dívidas pendentes.
  elsif p_mode = 'all' then
    if v_kind = 'expense' then
      delete from public.debts
       where user_id = v_user_id
         and expense_id in (select id from public.expenses where recurrence_id = v_recurrence_id)
         and paid_at is null;
      delete from public.expenses where recurrence_id = v_recurrence_id;
      get diagnostics v_deleted = row_count;
    else
      delete from public.incomes where recurrence_id = v_recurrence_id;
      get diagnostics v_deleted = row_count;
    end if;
    delete from public.recurrences where id = v_recurrence_id;
  -- subsequent: remove da ocorrência em diante + trunca o template.
  else
    if v_kind = 'expense' then
      delete from public.debts
       where user_id = v_user_id
         and expense_id in (
           select id from public.expenses
            where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number
         )
         and paid_at is null;
      delete from public.expenses
       where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number;
    else
      delete from public.incomes
       where recurrence_id = v_recurrence_id and occurrence_number >= v_occurrence_number;
    end if;
    get diagnostics v_deleted = row_count;

    -- Trunca o template preservando o CHECK (end_date XOR occurrences_total).
    if v_occurrence_number = 1 then
      -- Removeu tudo — apaga o template por completo.
      delete from public.recurrences where id = v_recurrence_id;
    elsif v_recurrence.end_date is not null then
      update public.recurrences
         set end_date = v_date - 1
       where id = v_recurrence_id;
    else
      update public.recurrences
         set occurrences_total = v_occurrence_number - 1
       where id = v_recurrence_id;
    end if;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'delete_occurrence',
    jsonb_build_object('mode', p_mode, 'deleted', v_deleted, 'date', v_date::text)
  );

  return v_deleted;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: update_recurrence_occurrences — edição em grupo (single/all/
-- subsequent) + sincronização do template. Campos: value, category_id,
-- description, report_weight, payment_method, card_id, receive_type,
-- bill_competence.
-- ----------------------------------------------------------------
create or replace function public.update_recurrence_occurrences(
  p_occurrence_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recurrence_id uuid;
  v_occurrence_number integer;
  v_kind text;
  v_ids uuid[];
  v_updated integer;
  v_value numeric;
  v_category_id uuid;
  v_payment_method text;
  v_card_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select recurrence_id, occurrence_number, 'expense'
    into v_recurrence_id, v_occurrence_number, v_kind
    from public.expenses
   where id = p_occurrence_id and user_id = v_user_id;
  if not found then
    select recurrence_id, occurrence_number, 'income'
      into v_recurrence_id, v_occurrence_number, v_kind
      from public.incomes
     where id = p_occurrence_id and user_id = v_user_id;
  end if;
  if v_recurrence_id is null then
    raise exception 'Ocorrência não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = v_kind) then
      raise exception 'Categoria de % inválida', v_kind;
    end if;
  end if;
  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method is not null and v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  end if;

  -- Ids afetados pelo modo.
  if p_mode = 'single' then
    v_ids := array[p_occurrence_id];
  elsif v_kind = 'expense' then
    select array_agg(id) into v_ids
      from public.expenses
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  else
    select array_agg(id) into v_ids
      from public.incomes
     where recurrence_id = v_recurrence_id
       and (p_mode = 'all' or occurrence_number >= v_occurrence_number);
  end if;

  if v_ids is not null then
    if v_kind = 'expense' then
      update public.expenses e
         set value = case when p_fields ? 'value' then v_value else e.value end,
             base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
             category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
             payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
             card_id = case
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
               else e.card_id
             end,
             bill_competence = case
               when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
               when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
               else e.bill_competence
             end
       where e.id = any(v_ids);
      get diagnostics v_updated = row_count;
    else
      update public.incomes i
         set value = case when p_fields ? 'value' then v_value else i.value end,
             category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
             description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
             report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
             receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end
       where i.id = any(v_ids);
      get diagnostics v_updated = row_count;
    end if;
  else
    v_updated := 0;
  end if;

  -- Sincroniza o template (all/subsequent — a regra muda para as próximas).
  if p_mode <> 'single' then
    update public.recurrences r
       set value = case when p_fields ? 'value' then v_value else r.value end,
           category_id = case when p_fields ? 'category_id' then v_category_id else r.category_id end,
           description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else r.description end,
           report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else r.report_weight end,
           payment_method = case when p_fields ? 'payment_method' then v_payment_method else r.payment_method end,
           card_id = case
             when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
             when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
             else r.card_id
           end,
           receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else r.receive_type end
     where r.id = v_recurrence_id;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'recurrence', v_recurrence_id::text, 'update_occurrences',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: create_income_installments — renda parcelada (espelho do
-- create_expense_with_debt; D12 — parcelas calculadas no cliente)
-- ----------------------------------------------------------------
create or replace function public.create_income_installments(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cat_type text;
  v_group uuid := gen_random_uuid();
  v_count integer;
  v_sum numeric;
  v_parcela jsonb;
  v_i integer := 0;
  v_income_id uuid;
  v_first_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Valor da renda deve ser maior que zero';
  end if;
  if p_date < date '2026-01-01' then
    raise exception 'Data anterior à data de início do app (2026-01-01)';
  end if;
  if p_report_weight is null or p_report_weight < 0 or p_report_weight > 1 then
    raise exception 'Peso de relatório deve estar entre 0 e 1';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id and user_id = v_user_id;
  if v_cat_type is null or v_cat_type <> 'income' then
    raise exception 'Categoria de renda inválida';
  end if;

  if jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count > 60 then
    raise exception 'Máximo de 60 parcelas';
  end if;

  select coalesce(sum((parcela ->> 'value')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_installments) parcela;
  if v_sum <> p_value then
    raise exception 'Soma das parcelas (%s) difere do valor original (%s)', v_sum, p_value;
  end if;

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    insert into public.incomes (
      user_id, value, date, category_id, receive_type, description,
      report_weight, source_ref, installments_total, installment_number, installment_group_id
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      null,
      v_count,
      v_i,
      case when v_count > 1 then v_group else null end
    )
    returning id into v_income_id;

    if v_first_id is null then
      v_first_id := v_income_id;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'income', v_income_id::text, 'create',
      jsonb_build_object('installment', v_i, 'total', v_count, 'value', v_parcela ->> 'value')
    );
  end loop;

  return v_first_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: delete_income_installments — exclusão 3 modos (sem cascata de
-- dívidas; rendas automáticas source_ref são somente-leitura)
-- ----------------------------------------------------------------
create or replace function public.delete_income_installments(
  p_income_id uuid,
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_income public.incomes%rowtype;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de exclusão inválido';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;
  if v_income.source_ref is not null then
    raise exception 'Renda automática é somente leitura';
  end if;

  if p_mode = 'single' then
    delete from public.incomes where id = p_income_id;
    v_deleted := 1;
  elsif p_mode = 'all' and v_income.installment_group_id is not null then
    delete from public.incomes
     where user_id = v_user_id and installment_group_id = v_income.installment_group_id;
    get diagnostics v_deleted = row_count;
  elsif p_mode = 'subsequent' and v_income.installment_group_id is not null then
    delete from public.incomes
     where user_id = v_user_id
       and installment_group_id = v_income.installment_group_id
       and installment_number >= v_income.installment_number;
    get diagnostics v_deleted = row_count;
  else
    -- sem grupo em all/subsequent: exclui a própria
    delete from public.incomes where id = p_income_id;
    v_deleted := 1;
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income', p_income_id::text, 'delete',
    jsonb_build_object('mode', p_mode, 'deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: update_income_installments_group — edição em grupo de renda
-- parcelada (single/all/subsequent). Campos: value, category_id,
-- description, report_weight, receive_type.
-- ----------------------------------------------------------------
create or replace function public.update_income_installments_group(
  p_income_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_income public.incomes%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_category_id uuid;
  v_value numeric;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select * into v_income
    from public.incomes
   where id = p_income_id and user_id = v_user_id;
  if not found then
    raise exception 'Renda não encontrada';
  end if;
  if v_income.source_ref is not null then
    raise exception 'Renda automática é somente leitura';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'income') then
      raise exception 'Categoria de renda inválida';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_income_id];
  elsif v_income.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.incomes
     where user_id = v_user_id
       and installment_group_id = v_income.installment_group_id
       and (p_mode = 'all' or installment_number >= v_income.installment_number);
  else
    v_ids := array[p_income_id];
  end if;

  update public.incomes i
     set value = case when p_fields ? 'value' then v_value else i.value end,
         category_id = case when p_fields ? 'category_id' then v_category_id else i.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else i.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else i.report_weight end,
         receive_type = case when p_fields ? 'receive_type' then p_fields ->> 'receive_type' else i.receive_type end
   where i.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'income', p_income_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: update_expense_installments_group — edição em grupo de despesa
-- parcelada (single/all/subsequent). Campos: value (atualiza base_amount
-- junto — invariante de auditoria), category_id, description,
-- report_weight, payment_method, card_id, bill_competence.
-- ----------------------------------------------------------------
create or replace function public.update_expense_installments_group(
  p_expense_id uuid,
  p_mode text,
  p_fields jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_category_id uuid;
  v_value numeric;
  v_payment_method text;
  v_card_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode not in ('single', 'all', 'subsequent') then
    raise exception 'Modo de edição inválido';
  end if;
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'Campos de edição inválidos';
  end if;

  select * into v_expense
    from public.expenses
   where id = p_expense_id and user_id = v_user_id;
  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  if p_fields ? 'value' then
    v_value := (p_fields ->> 'value')::numeric;
    if v_value is null or v_value <= 0 then
      raise exception 'Valor deve ser maior que zero';
    end if;
  end if;
  if p_fields ? 'category_id' then
    v_category_id := (p_fields ->> 'category_id')::uuid;
    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id and type = 'expense') then
      raise exception 'Categoria de despesa inválida';
    end if;
  end if;
  if p_fields ? 'payment_method' then
    v_payment_method := p_fields ->> 'payment_method';
    if v_payment_method is not null and v_payment_method = 'credit_card' then
      v_card_id := nullif(p_fields ->> 'card_id', '')::uuid;
      if v_card_id is null then
        raise exception 'Cartão obrigatório para pagamento no crédito';
      end if;
    elsif v_payment_method is not null and v_payment_method not in ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other') then
      raise exception 'Forma de pagamento inválida';
    end if;
  end if;

  if p_mode = 'single' then
    v_ids := array[p_expense_id];
  elsif v_expense.installment_group_id is not null then
    select array_agg(id) into v_ids
      from public.expenses
     where user_id = v_user_id
       and installment_group_id = v_expense.installment_group_id
       and (p_mode = 'all' or installment_number >= v_expense.installment_number);
  else
    v_ids := array[p_expense_id];
  end if;

  update public.expenses e
     set value = case when p_fields ? 'value' then v_value else e.value end,
         base_amount = case when p_fields ? 'value' then v_value else e.base_amount end,
         category_id = case when p_fields ? 'category_id' then v_category_id else e.category_id end,
         description = case when p_fields ? 'description' then nullif(p_fields ->> 'description', '') else e.description end,
         report_weight = case when p_fields ? 'report_weight' then (p_fields ->> 'report_weight')::numeric else e.report_weight end,
         payment_method = case when p_fields ? 'payment_method' then v_payment_method else e.payment_method end,
         card_id = case
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           when p_fields ? 'card_id' then nullif(p_fields ->> 'card_id', '')::uuid
           else e.card_id
         end,
         bill_competence = case
           when p_fields ? 'bill_competence' then nullif(p_fields ->> 'bill_competence', '')
           when p_fields ? 'payment_method' and v_payment_method <> 'credit_card' then null
           else e.bill_competence
         end
   where e.id = any(v_ids);
  get diagnostics v_updated = row_count;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expense', p_expense_id::text, 'update_group',
    jsonb_build_object('mode', p_mode, 'updated', v_updated, 'fields', p_fields)
  );

  return v_updated;
end;
$$;
