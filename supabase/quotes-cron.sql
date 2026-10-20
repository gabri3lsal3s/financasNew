-- ============================================================================
-- CRON — Edge function de cotações (F1.7 · ESPECIFICAÇÃO §1.6 D5)
-- ============================================================================
-- Agendamento do cache global de preços (asset_prices com user_id NULL).
--
-- 1. AUDITORIA DE QUOTAS & ARQUITETURA SERVER-SIDE:
--    • O Supabase Free Tier concede até 500.000 invocações de Edge Functions/mês.
--    • Provedores externos (Brapi, Yahoo Finance, AwesomeAPI) impõem limites de taxa (rate limits).
--    • Para blindar o frontend contra erros HTTP 429 sob concorrência, o cliente
--      nunca dispara requisições em lote para serviços externos; ele lê exclusivamente
--      do cache global consolidado na tabela `asset_prices`.
--    • Com agendamento a cada 4 ou 6 horas em dias úteis (~4 a 6 execuções/dia),
--      consomem-se apenas ~120 a 180 invocações de Edge Function por mês (< 0,04% da cota)
--      e um número mínimo e previsível de consultas a provedores externos.
--
-- 2. OPÇÕES DE AGENDAMENTO RECOMENDADAS (<CRON_SCHEDULE>):
--    • Opção A (Recomendada — Pregão B3 em dias úteis):
--      '0 11,14,17,20 * * 1-5'
--      Dispara às 11h, 14h, 17h e 20h UTC de segunda a sexta (4x/dia útil).
--      Economiza 100% de chamadas durante a madrugada e finais de semana.
--
--    • Opção B (A cada 6 horas todos os dias — 24/7):
--      '0 */6 * * *'
--      Dispara às 00h, 06h, 12h e 18h UTC todos os dias (4x/dia).
--      Ideal quando há carteiras ativas com Criptoativos ou Mercado Internacional.
--
--    • Opção C (A cada 4 horas em dias úteis):
--      '0 */4 * * 1-5'
--      Dispara a cada 4 horas de segunda a sexta-feira.
--
-- 3. COMO USAR:
--    Opção 1 (Automatizada via CLI — recomendada):
--      npm run quotes:cron
--      → Gera o script SQL com os valores do seu .env prontos para colar no SQL Editor.
--
--    Opção 2 (Manual):
--      Substitua os 3 placeholders abaixo e execute no SQL Editor do Supabase:
--      <CRON_SCHEDULE>    ex.: 0 */6 * * * ou 0 11,14,17,20 * * 1-5
--      <FUNCTION_URL>     https://<SEU_REF>.supabase.co/functions/v1/quotes
--      <SERVICE_ROLE_KEY> Supabase Dashboard > Settings > API > service_role (secret)
--
-- 4. PRÉ-REQUISITOS (EXTENSÕES):
--    Dashboard > Database > Extensions > Habilitar 'pg_cron' e 'pg_net'
--    (ou execute: create extension if not exists pg_cron; create extension if not exists pg_net;)
-- ============================================================================

-- 1) Hardening de permissões: revoga acesso ao schema cron para roles públicas/não-admin
revoke all on schema cron from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;

-- 2) Remove agendamentos anteriores, se existirem (idempotente — permite re-execuções sem erro)
select cron.unschedule(jobname)
from cron.job
where jobname in ('quotes-cron', 'quotes-6h');

-- 3) Agenda a atualização periódica do cache global de cotações
select cron.schedule(
  'quotes-cron',
  '<CRON_SCHEDULE>',
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

-- ============================================================================
-- 5. CONSULTAS DE DIAGNÓSTICO E AUDITORIA OPERACIONAL
-- ============================================================================
-- Listar jobs agendados ativos:
-- select jobid, jobname, schedule, active from cron.job order by jobid;

-- Auditar histórico de execuções recentes do cron e status HTTP retornado:
-- select
--   r.runid,
--   r.jobid,
--   j.jobname,
--   r.status,
--   r.return_message,
--   r.start_time,
--   r.end_time
-- from cron.job_run_details r
-- join cron.job j on j.jobid = r.jobid
-- order by r.start_time desc
-- limit 10;

-- Auditar o cache global gravado:
-- select ticker, price, currency, updated_at
-- from public.asset_prices
-- where user_id is null
-- order by updated_at desc;
