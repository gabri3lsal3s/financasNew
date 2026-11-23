-- ============================================================================
-- CRON — Motor Global de Cotações EOD/EOM & Proventos Automatizados (Blocos A–C)
-- ============================================================================
-- AUDITORIA DE QUOTAS & DIMENSIONAMENTO (Plano Gratuito: 500.000 invocações/mês):
--   • Eliminação dos crons intradiários legados (`0 11,14,17,20 * * 1-5`):
--     durante o pregão aberto, o cliente usa SWR compartilhado sob demanda (15 min)
--     exclusivamente para tickers vencidos com pregão ativo;
--   • Na nuvem, apenas 4 agendamentos (~100 invocações/mês no total, < 0,03% da
--     cota mensal de 500.000 invocações) garantem histórico diário (90d), fechamento
--     mensal oficial (EOM permanente), coleta global B3+EUA e efetivação diária;
--   • Todas as chamadas definem `timeout_milliseconds := 60000` (60s) para
--     comportar retries externos e paginação em lote no `pg_net`.
--
-- Jobs ativos (Produção):
--   1. 'quotes-eod-close'       ('0 22 * * 1-5'  → 19:00 BRT seg–sex): action = 'eod_close'
--   2. 'quotes-eom-close'       ('30 22 * * 1-5' → 19:30 BRT seg–sex): action = 'close_month_global' (auto-healing nos 3 primeiros dias úteis)
--   3. 'dividends-sync-global'  ('0 10 * * *'    → 07:00 BRT diário):  action = 'sync_corporate_dividends'
--   4. 'dividends-process-user' ('30 11 * * *'   → 08:30 BRT diário):  action = 'process_user_dividends'
--
-- Substitua os placeholders antes de executar manualmente (ou gere via `npm run quotes:cron`):
--   <FUNCTION_URL>      https://<SEU_REF>.supabase.co/functions/v1/quotes
--   <SERVICE_ROLE_KEY>  Supabase Dashboard > Settings > API > service_role (secret)
-- ============================================================================

-- 1) Hardening de permissões: revoga acesso ao schema cron para roles públicas/não-admin
revoke all on schema cron from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;

-- 2) Remove agendamentos anteriores (idempotente — substitui cron intradiário legado 4x/dia)
select cron.unschedule(jobname)
from cron.job
where jobname in (
  'quotes-cron',
  'quotes-6h',
  'quotes-eod-close',
  'quotes-eom-close',
  'dividends-sync-global',
  'dividends-process-user'
);

-- 3) Âncora EOD pós-fechamento B3 + NYSE + PTAX oficial (22:00 UTC = 19:00 BRT, seg–sex)
select cron.schedule(
  'quotes-eod-close',
  '0 22 * * 1-5',
  $cron$
    select net.http_post(
      url := '<FUNCTION_URL>',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object('action', 'eod_close'),
      timeout_milliseconds := 60000
    );
  $cron$
);

-- 4) Fechamento Mensal Global EOM + Auto-Healing 3 dias úteis (22:30 UTC = 19:30 BRT, seg–sex)
select cron.schedule(
  'quotes-eom-close',
  '30 22 * * 1-5',
  $cron$
    select net.http_post(
      url := '<FUNCTION_URL>',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object('action', 'close_month_global'),
      timeout_milliseconds := 60000
    );
  $cron$
);

-- 5) Coleta Global de Proventos B3 (Brapi + fallback Yahoo) & EUA (Yahoo 30% IR) (10:00 UTC = 07:00 BRT, diário)
select cron.schedule(
  'dividends-sync-global',
  '0 10 * * *',
  $cron$
    select net.http_post(
      url := '<FUNCTION_URL>',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object('action', 'sync_corporate_dividends'),
      timeout_milliseconds := 60000
    );
  $cron$
);

-- 6) Materialização Data COM, Anti-Flood, Efetivação & Push de Proventos por Usuário (11:30 UTC = 08:30 BRT, diário)
select cron.schedule(
  'dividends-process-user',
  '30 11 * * *',
  $cron$
    select net.http_post(
      url := '<FUNCTION_URL>',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object('action', 'process_user_dividends'),
      timeout_milliseconds := 60000
    );
  $cron$
);

-- ============================================================================
-- CONSULTAS DE DIAGNÓSTICO E AUDITORIA OPERACIONAL
-- ============================================================================
-- select jobid, jobname, schedule, active from cron.job order by jobid;
-- select r.runid, r.jobid, j.jobname, r.status, r.return_message, r.start_time, r.end_time
-- from cron.job_run_details r join cron.job j on j.jobid = r.jobid
-- order by r.start_time desc limit 15;
-- select ticker, price, currency, source, provider, market_price_at, fetched_at
-- from public.asset_prices where user_id is null order by fetched_at desc nulls last;
-- select ticker, reference_date, price, provider, is_month_end
-- from public.market_price_history order by reference_date desc, ticker limit 30;
