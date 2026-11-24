-- =============================================================================
-- Migration 0149: Retenção Tributária na Fonte (Autônomo & Simples Nacional)
-- =============================================================================
-- Fase 1 do Plano v2.1 (Refinamento e Blindagem Contábil do Modo Negócio):
--   1. Adiciona coluna `tax_withheld` em `incomes` (default 0).
--   2. Adiciona constraint `incomes_tax_withheld_check` (0 <= tax_withheld <= value).
--   3. Atualiza RPC `create_income_installments` com suporte a `p_tax_withheld`.
-- =============================================================================

alter table public.incomes
  add column if not exists tax_withheld numeric(12, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'incomes_tax_withheld_check') then
    alter table public.incomes
      add constraint incomes_tax_withheld_check
      check (tax_withheld >= 0 and tax_withheld <= value);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Atualização de create_income_installments com suporte a p_tax_withheld
-- -----------------------------------------------------------------------------
drop function if exists public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text
);
drop function if exists public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text, numeric
);

create or replace function public.create_income_installments(
  p_value numeric,
  p_date date,
  p_category_id uuid,
  p_receive_type text,
  p_description text,
  p_report_weight numeric,
  p_installments jsonb,
  p_is_family boolean default false,
  p_scope text default 'personal',
  p_tax_withheld numeric default 0
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
  v_family_id uuid := null;
  v_scope text := coalesce(nullif(p_scope, ''), 'personal');
  v_tax_withheld numeric := coalesce(p_tax_withheld, 0);
  v_parcel_tax numeric;
begin
  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: plano não permite operações de escrita no módulo transactions.';
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
  if v_scope not in ('personal', 'business') then
    raise exception 'Escopo inválido: %', v_scope;
  end if;
  if v_tax_withheld < 0 or v_tax_withheld > p_value then
    raise exception 'Valor retido na fonte inválido: deve estar entre 0 e o valor total da renda';
  end if;

  select type into v_cat_type
    from public.categories
   where id = p_category_id
     and (
       user_id = v_user_id
       or (
         is_family = true
         and family_id is not null
         and public.is_family_member(family_id, v_user_id)
       )
     );
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

  if coalesce(p_is_family, false) = true and v_scope = 'personal' then
    select fm.family_id into v_family_id
    from public.family_members fm
    where fm.user_id = v_user_id
    limit 1;
  end if;

  for v_parcela in select * from jsonb_array_elements(p_installments)
  loop
    v_i := v_i + 1;
    if (v_parcela ->> 'date')::date < date '2026-01-01' then
      raise exception 'Data de parcela anterior à data de início do app';
    end if;

    -- Se a parcela informa tax_withheld específico, usa-o; caso contrário, reparte proporcionalmente
    if v_parcela ? 'tax_withheld' then
      v_parcel_tax := (v_parcela ->> 'tax_withheld')::numeric;
    elsif v_tax_withheld > 0 and v_count > 0 then
      v_parcel_tax := round((v_tax_withheld / v_count)::numeric, 2);
    else
      v_parcel_tax := 0;
    end if;

    insert into public.incomes (
      user_id, value, date, category_id, receive_type, description,
      report_weight, installments_total, installment_number, installment_group_id,
      is_family, family_id, scope, tax_withheld
    ) values (
      v_user_id,
      (v_parcela ->> 'value')::numeric,
      (v_parcela ->> 'date')::date,
      p_category_id,
      p_receive_type,
      p_description,
      p_report_weight,
      v_count,
      v_i,
      v_group,
      case when v_scope = 'business' then false else coalesce(p_is_family, false) end,
      v_family_id,
      v_scope,
      v_parcel_tax
    )
    returning id into v_income_id;

    if v_first_id is null then
      v_first_id := v_income_id;
    end if;

    insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
    values (
      v_user_id, 'income', v_income_id::text, 'create',
      jsonb_build_object(
        'installment', v_i,
        'total', v_count,
        'value', v_parcela ->> 'value',
        'scope', v_scope,
        'tax_withheld', v_parcel_tax
      )
    );
  end loop;

  return v_first_id;
end;
$$;

revoke all on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text, numeric
) from public;
grant execute on function public.create_income_installments(
  numeric, date, uuid, text, text, numeric, jsonb, boolean, text, numeric
) to authenticated, service_role;
