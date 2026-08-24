-- ================================================================
-- 0032_governance_partitioning_and_retention.sql — Governança e Retenção (§F48)
--
-- Objetivos:
--   1. Rotina de Retenção e Expurgo de Logs de Auditoria:
--      Permite expurgo de eventos de auditoria históricos com mais de 365 dias (ou período configurado),
--      mantendo o banco enxuto e preservando performance.
--   2. RPC Administrativa Segura com Auditoria:
--      Apenas superadministradores ativos podem acionar ou alterar políticas de retenção.
-- ================================================================

-- 1. Índice para acelerar expurgo e leitura temporal de logs
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_events') then
    execute 'create index if not exists idx_audit_events_retention_date on public.audit_events (created_at asc);';
  end if;
end $$;

-- 2. Função de retenção e expurgo de logs antigos
create or replace function public.cleanup_old_audit_events(retention_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
  cutoff_date timestamptz;
begin
  if retention_days < 30 then
    raise exception 'Período de retenção mínimo permitido é de 30 dias.';
  end if;

  cutoff_date := now() - (retention_days || ' days')::interval;

  delete from public.audit_events
  where created_at < cutoff_date;

  get diagnostics deleted_count = row_count;

  -- Registra o próprio evento de expurgo no log
  insert into public.audit_events (user_id, action, entity_type, payload)
  values (
    (select auth.uid()),
    'SYSTEM_AUDIT_RETENTION',
    'audit_events',
    jsonb_build_object(
      'retention_days', retention_days,
      'cutoff_date', cutoff_date,
      'records_purged', deleted_count
    )
  );

  return deleted_count;
end;
$$;

-- 3. RPC administrativa exposta para superadmins
create or replace function public.admin_trigger_audit_retention(retention_days integer default 365)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purged_count integer;
begin
  -- Exige cargo superadmin ativo
  if not public.is_superadmin() then
    raise exception 'Apenas superadministradores podem executar rotinas de retenção de auditoria.';
  end if;

  purged_count := public.cleanup_old_audit_events(retention_days);

  return jsonb_build_object(
    'success', true,
    'records_purged', purged_count,
    'executed_at', now()
  );
end;
$$;
