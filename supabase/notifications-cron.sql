-- ============================================================================
-- CRON — Edge functions de Faturamento / Trial e Resumo Dominical Opt-In
-- ============================================================================
-- Agendamento automático das rotinas de notificação e ciclo de vida SaaS:
--   1) billing-lifecycle-daily : Todos os dias às 11:00 UTC (08:00 BRT)
--      Executa reconciliação de assinaturas, resync Asaas e envio de avisos
--      de encerramento de trial na janela segura de 48h–76h (idempotente).
--   2) sunday-digest-weekly   : Todos os domingos às 12:00 UTC (09:00 BRT)
--      Envia resumo semanal por e-mail via Resend (e push opcional) SOMENTE
--      para usuários que ativaram explicitamente `weekly_digest_enabled = true`.
--
-- PRÉ-REQUISITOS (EXTENSÕES):
--   Dashboard > Database > Extensions > Habilitar 'pg_cron' e 'pg_net'
--   (ou: create extension if not exists pg_cron; create extension if not exists pg_net;)
--
-- COMO GERAR COM CREDENCIAIS DO SEU .env:
--   npm run notifications:cron
--   (Usa CRON_SECRET do .env com fallback para SUPABASE_SERVICE_ROLE_KEY)
-- ============================================================================

-- 1) Hardening de permissões: revoga acesso ao schema cron para roles não administrativas
revoke all on schema cron from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;

-- 2) Remove agendamentos anteriores, se existirem (idempotente)
select cron.unschedule(jobname)
from cron.job
where jobname in ('billing-lifecycle-daily', 'sunday-digest-weekly');

-- 3) Agenda o cron diário de faturamento e avisos de expiração de trial (08:00 BRT)
select cron.schedule(
  'billing-lifecycle-daily',
  '0 11 * * *',
  $cron$
    select net.http_post(
      url := '<FUNCTION_BASE_URL>/billing-lifecycle-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CRON_AUTH_TOKEN>'
      ),
      body := '{}',
      timeout_milliseconds := 60000
    );
  $cron$
);

-- 4) Agenda o resumo dominical semanal opt-in (domingos 09:00 BRT)
select cron.schedule(
  'sunday-digest-weekly',
  '0 12 * * 0',
  $cron$
    select net.http_post(
      url := '<FUNCTION_BASE_URL>/sunday-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CRON_AUTH_TOKEN>'
      ),
      body := '{}',
      timeout_milliseconds := 60000
    );
  $cron$
);

-- ============================================================================
-- CONSULTAS DE AUDITORIA OPERACIONAL
-- ============================================================================
-- select jobid, jobname, schedule, active from cron.job order by jobid;
-- select r.runid, j.jobname, r.status, r.return_message, r.start_time, r.end_time
--   from cron.job_run_details r
--   join cron.job j on j.jobid = r.jobid
--   order by r.start_time desc limit 20;
-- select template_key, status, count(*) from public.transactional_email_logs group by 1, 2 order by 1;
-- select event_type, channel, status, count(*) from public.push_delivery_logs group by 1, 2, 3 order by 1;
