-- ============================================================================
-- CRON — Edge function de cotações (F1.7 · ESPECIFICAÇÃO §1.6 D5)
-- ============================================================================
-- Agendamento do cache global de preços (asset_prices com user_id NULL).
--
-- COMO USAR:
--   Opção A (recomendada): gera o SQL preenchido com os valores do seu .env:
--     npm run quotes:cron
--     → cole a saída no SQL Editor do Supabase (Dashboard > SQL Editor) e execute.
--   Opção B (manual): substitua os 3 placeholders abaixo e execute no SQL Editor:
--     <CRON_SCHEDULE>    ex.: 0 */6 * * *   (padrão do .env: QUOTES_CRON_SCHEDULE)
--     <FUNCTION_URL>     https://<SEU_REF>.supabase.co/functions/v1/quotes
--     <SERVICE_ROLE_KEY> Settings > API > service_role (nunca no cliente!)
--
-- REQUISITOS:
--   • Extensões pg_cron e pg_net habilitadas:
--     Dashboard > Database > Extensions > habilitar pg_cron e pg_net
--     (ou: create extension if not exists pg_cron; create extension if not exists pg_net;)
-- ============================================================================

-- 1) Hardening de permissões: revoga acesso ao schema cron para roles públicas/não-admin
revoke all on schema cron from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;

-- 2) Remove agendamento anterior, se existir (idempotente — permite re-rodar).
select cron.unschedule('quotes-6h')
where exists (select 1 from cron.job where jobname = 'quotes-6h');

-- 3) Agenda a atualização a cada 6h (ou o intervalo de <CRON_SCHEDULE>).
select cron.schedule(
  'quotes-6h',                  -- nome do job (identificador)
  '<CRON_SCHEDULE>',            -- expressão cron (ex.: 0 */6 * * *)
  $cron$
    select net.http_post(
      url := '<FUNCTION_URL>',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'
    );
  $cron$
);

-- 4) Verificação: lista os jobs agendados.
-- select jobid, jobname, schedule, active from cron.job order by jobid;
