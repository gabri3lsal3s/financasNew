-- =============================================================================
-- Suite pgTAP S1: Calibração de Corte, Revisão, Proteção de Preferências e Restore
-- =============================================================================
BEGIN;

SELECT plan(13);

-- Setup de dois titulares isolados e ativo/evento corporativo
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('00000000-0000-0000-0000-000000000011', 's1_user_a@example.com', '{"provider":"email"}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000012', 's1_user_b@example.com', '{"provider":"email"}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, status)
VALUES
  ('00000000-0000-0000-0000-000000000011', 's1_user_a@example.com', 'active'),
  ('00000000-0000-0000-0000-000000000012', 's1_user_b@example.com', 'active')
ON CONFLICT (id) DO UPDATE SET status = 'active';

INSERT INTO public.corporate_dividends (
  id, ticker, type, com_date, payment_date, rate, net_rate, tax_rate_pct, currency
) VALUES (
  '00000000-0000-0000-0000-00000000c001',
  'PETR4',
  'DIVIDENDO',
  DATE '2026-06-15',
  DATE '2026-07-01',
  1.00,
  1.00,
  0,
  'BRL'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.portfolio_assets (
  id, user_id, ticker, asset_class, currency, quantity, average_price, accumulated_dividends, dividends_start_date, created_at
) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000011', 'PETR4', 'Ações', 'BRL', 100, 30, 500, NULL, '2026-01-01T10:00:00Z'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000011', 'PETR4F', 'Ações', 'BRL', 10, 30, 0, DATE '2026-01-01', '2026-01-01T10:00:00Z'),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000012', 'VALE3', 'Ações', 'BRL', 50, 60, 0, NULL, '2026-01-01T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_dividend_events (
  id, user_id, corporate_dividend_id, asset_id, ticker, type, status, com_date, payment_date,
  quantity_on_com_date, gross_rate, net_rate, tax_rate_pct, gross_amount, net_amount, currency, is_manual, manual_review_required
) VALUES (
  '00000000-0000-0000-0000-00000000e001',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-00000000c001',
  '00000000-0000-0000-0000-00000000a001',
  'PETR4',
  'DIVIDENDO',
  'PENDING_CONFIRMATION',
  DATE '2026-06-15',
  DATE '2026-07-01',
  110,
  1.00,
  1.00,
  0,
  110.00,
  110.00,
  'BRL',
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Teste 1: Trigger de revisão incrementa automaticamente em UPDATE
UPDATE public.user_dividend_events
SET notes = 'bump check'
WHERE id = '00000000-0000-0000-0000-00000000e001';

SELECT is(
  (SELECT revision FROM public.user_dividend_events WHERE id = '00000000-0000-0000-0000-00000000e001'),
  2,
  'UPDATE em user_dividend_events incrementa revision automaticamente'
);

-- Teste 2: set_dividend_tracking_atomic calibra em lote e zera evento obsoleto misto na mesma transação
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000011';

SELECT is(
  (
    SELECT (public.set_dividend_tracking_atomic(
      DATE '2026-07-10',
      jsonb_build_array(
        jsonb_build_object(
          'asset_id', '00000000-0000-0000-0000-00000000a001',
          'expected_start', NULL,
          'start_date', '2026-07-10'
        )
      ),
      NULL
    ) -> 'updated_assets_count')::int
  ),
  1,
  'set_dividend_tracking_atomic calibra PETR4 e retorna contagem exata'
);

SELECT is(
  (SELECT net_amount FROM public.user_dividend_events WHERE id = '00000000-0000-0000-0000-00000000e001'),
  0.00::numeric(14,2),
  'Saneamento transacional zera evento obsoleto antes de deixar valor antigo ativo'
);

-- Teste 3: Repetição idempotente com estado final idêntico retorna sucesso
SELECT is(
  (
    SELECT (public.set_dividend_tracking_atomic(
      DATE '2026-07-10',
      jsonb_build_array(
        jsonb_build_object(
          'asset_id', '00000000-0000-0000-0000-00000000a001',
          'expected_start', NULL,
          'start_date', '2026-07-10'
        )
      ),
      NULL
    ) ->> 'success')::boolean
  ),
  true,
  'Repetição idempotente com o mesmo estado final é aceita sem conflito'
);

-- Teste 4: Conflito real em expected_start lança 40001
SELECT throws_ok(
  $$
    SELECT public.set_dividend_tracking_atomic(
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'asset_id', '00000000-0000-0000-0000-00000000a001',
          'expected_start', '2026-05-01',
          'start_date', '2026-08-01'
        )
      ),
      NULL
    );
  $$,
  '40001',
  NULL,
  'Conflito real de expected_start aborta transação com 40001'
);

-- Teste 5: Cross-tenant em set_dividend_tracking_atomic é rejeitado com 42501
SELECT throws_ok(
  $$
    SELECT public.set_dividend_tracking_atomic(
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'asset_id', '00000000-0000-0000-0000-00000000b001',
          'expected_start', NULL,
          'start_date', '2026-08-01'
        )
      ),
      NULL
    );
  $$,
  '42501',
  NULL,
  'set_dividend_tracking_atomic bloqueia ativo de outro titular com rollback integral'
);

-- Teste 6: Update comum de user_preferences preserva trackingStartDate gravado
UPDATE public.user_preferences
SET custom_settings = jsonb_set(
  coalesce(custom_settings, '{}'::jsonb),
  '{dividendAutomation}',
  jsonb_build_object('settlementMode', 'auto', 'trackingStartDate', '2005-01-01')
)
WHERE user_id = '00000000-0000-0000-0000-000000000011';

SELECT is(
  (
    SELECT custom_settings->'dividendAutomation'->>'trackingStartDate'
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-000000000011'
  ),
  '2026-07-10',
  'Trigger preserva trackingStartDate contra sobrescrita por cache de outra aba'
);

-- Teste 7: confirm_user_dividend_events_atomic recusa evento sem data de pagamento válida
RESET ROLE;
UPDATE public.user_dividend_events
SET
  payment_date = NULL,
  quantity_on_com_date = 100,
  net_amount = 100,
  manual_review_required = true
WHERE id = '00000000-0000-0000-0000-00000000e001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000011';

SELECT throws_ok(
  $$
    SELECT public.confirm_user_dividend_events_atomic(
      jsonb_build_array(
        jsonb_build_object(
          'event_id', '00000000-0000-0000-0000-00000000e001',
          'ticker', 'PETR4',
          'type', 'DIVIDENDO',
          'amount', 100
        )
      ),
      true
    );
  $$,
  '22023',
  NULL,
  'confirm_user_dividend_events_atomic exige data real de pagamento (sem fallback today)'
);

-- Teste 8: > 0,02 de divergência protege linha legada marcando manual_review_required sem zerar
RESET ROLE;
INSERT INTO public.corporate_dividends (
  id, ticker, type, com_date, payment_date, rate, net_rate, tax_rate_pct, currency
) VALUES (
  '00000000-0000-0000-0000-00000000c002',
  'PETR4',
  'DIVIDENDO',
  DATE '2026-06-20',
  NULL,
  1.00,
  1.00,
  0,
  'BRL'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_dividend_events (
  id, user_id, corporate_dividend_id, asset_id, ticker, type, status, com_date, payment_date,
  quantity_on_com_date, gross_rate, net_rate, tax_rate_pct, gross_amount, net_amount, currency, is_manual, manual_review_required
) VALUES (
  '00000000-0000-0000-0000-00000000e002',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-00000000c002',
  '00000000-0000-0000-0000-00000000a001',
  'PETR4',
  'DIVIDENDO',
  'PROVISIONED',
  DATE '2026-06-20',
  NULL,
  100,
  1.00,
  1.00,
  0,
  100.00,
  105.00,
  'BRL',
  false,
  false
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000011';

SELECT is(
  (
    SELECT (public.set_dividend_tracking_atomic(
      DATE '2026-07-15',
      '[]'::jsonb,
      DATE '2026-07-10'
    ) ->> 'protected_events_count')::int
  ),
  1,
  'Linha legada com divergência > 0,02 é protegida com manual_review_required e preservada'
);

RESET ROLE;

SELECT is(
  public.normalize_dividend_ticker_key('AAPL1F', 'USD'),
  'AAPL1F',
  'normalize_dividend_ticker_key preserva sufixo F de ticker USD'
);

SELECT is(
  public.normalize_dividend_ticker_key('PETR4F', 'BRL'),
  'PETR4',
  'normalize_dividend_ticker_key normaliza fracionário B3'
);

-- Teste 11: Check constraint bloqueia dividends_start_date anterior a 2000-01-01
SELECT throws_ok(
  $$
    UPDATE public.portfolio_assets
    SET dividends_start_date = DATE '1999-12-31'
    WHERE id = '00000000-0000-0000-0000-00000000a001';
  $$,
  '23514',
  NULL,
  'CHECK chk_portfolio_assets_dividends_start_date rejeita corte anterior a 2000-01-01'
);

-- Teste 12: Trigger bloqueia dividends_start_date distante no futuro
SELECT throws_ok(
  $$
    UPDATE public.portfolio_assets
    SET dividends_start_date = ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2)
    WHERE id = '00000000-0000-0000-0000-00000000a001';
  $$,
  '22023',
  NULL,
  'Trigger rejeita corte futuro além de amanhã em São Paulo'
);

SELECT * FROM finish();
ROLLBACK;
