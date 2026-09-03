-- ----------------------------------------------------------------
-- Migração 20260101000034: Metadados de Renda Fixa e Metas de Alocação Zeradas
-- ----------------------------------------------------------------
-- 1. Suporte a títulos de Renda Fixa privada e Tesouro Direto com
--    parametrização de Marco Zero (D₀), taxa acordada, indexador,
--    vencimento, data original de aplicação e isenção tributária.
-- 2. Atualização do RPC set_allocation_targets para persistir registros
--    com meta >= 0 (metas zeradas explicitamente).
-- ----------------------------------------------------------------

alter table public.portfolio_assets
  add column if not exists fixed_income_metadata jsonb default null;

comment on column public.portfolio_assets.fixed_income_metadata is
  'Metadados de títulos de renda fixa (rate_type, rate_value, base_date, initial_investment_date, maturity_date, is_tax_exempt).';

-- Índice para consultas filtradas por ativos com parametrização de renda fixa
create index if not exists idx_portfolio_assets_fixed_income
  on public.portfolio_assets using gin (fixed_income_metadata)
  where fixed_income_metadata is not null;

-- RPC set_allocation_targets permitindo metas zeradas (>= 0)
create or replace function public.set_allocation_targets(p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_item jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_targets is null then
    raise exception 'Metas de alocação inválidas';
  end if;

  -- Valida formato dos itens
  for v_item in select * from jsonb_array_elements(p_targets) loop
    if v_item->>'asset_id' is null
       or (v_item->>'target_percentage')::numeric is null
       or (v_item->>'target_percentage')::numeric < 0
       or (v_item->>'target_percentage')::numeric > 100 then
      raise exception 'Metas de alocação inválidas';
    end if;
  end loop;

  -- Limpa as metas atuais do usuário
  delete from public.allocation_targets
   where user_id = v_user;

  -- Insere o novo conjunto de metas (inclusive 0%)
  insert into public.allocation_targets (user_id, asset_id, target_percentage)
  select v_user,
         (item->>'asset_id')::uuid,
         round((item->>'target_percentage')::numeric, 2)
    from jsonb_array_elements(p_targets) as item
   where (item->>'target_percentage')::numeric >= 0;

  -- Validação FINAL da soma após o lote
  select coalesce(sum(target_percentage), 0)
    into v_total
    from public.allocation_targets
   where user_id = v_user;

  if v_total > 100.001 then
    raise exception 'Soma das metas de alocação excede 100%% (atual: %)', v_total;
  end if;

  notify pgrst, 'reload schema';
end;
$$;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
notify pgrst, 'reload schema';
