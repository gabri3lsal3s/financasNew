-- =============================================================================
-- Migration 0143: Motor Unificado de Proventos Automatizados & Isolamento Contábil
-- =============================================================================
-- Bloco C do Plano Mestre (`docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md`):
--   1. Evolução de `public.corporate_dividends`:
--      - `payment_date` passa a ser anulável (`DROP NOT NULL`) para proventos
--        anunciados ainda sem data de pagamento definida;
--      - Metadados fiscais e de origem: `provider`, `tax_rate_pct`,
--        `is_type_uncertain` (fallback Yahoo B3 sem classificação JCP vs Dividendo),
--        `updated_at`;
--      - Chave única `UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date)`.
--   2. RPC `upsert_corporate_dividend_system` (`service_role` apenas):
--      - Verifica existência exata com `payment_date` antes de promover in-place
--        linha `payment_date IS NULL` (evita colisão em múltiplas parcelas, ex. PETR4);
--      - Nunca degrada fonte confiável (`is_type_uncertain = false`) com fonte incerta.
--   3. Tabela `public.user_dividend_events` + RLS InitPlan + migração de dispensas:
--      - Estados: `PROVISIONED`, `PENDING_CONFIRMATION`, `SETTLED`, `DISMISSED`.
--   4. Idempotência e efetivação transacional sem trava `< 2026-01-01`:
--      - `portfolio_dividends.source_event_id` + índice único parcial;
--      - `settle_user_dividend_event_system` (`service_role`);
--      - `confirm_user_dividend_events_atomic` (`authenticated` ativo);
--      - Atualização compatível de `approve_dividends_batch_atomic`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Evolução de `public.corporate_dividends`
-- -----------------------------------------------------------------------------
ALTER TABLE public.corporate_dividends
  ALTER COLUMN payment_date DROP NOT NULL;

ALTER TABLE public.corporate_dividends
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_type_uncertain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.corporate_dividends'::regclass
      AND conname = 'chk_corporate_dividends_tax_rate_pct'
  ) THEN
    ALTER TABLE public.corporate_dividends
      ADD CONSTRAINT chk_corporate_dividends_tax_rate_pct
      CHECK (tax_rate_pct >= 0 AND tax_rate_pct <= 100);
  END IF;
END
$$;

-- Atualiza alíquota padrão para linhas legadas de JCP caso ainda em 0
UPDATE public.corporate_dividends
SET
  tax_rate_pct = 15.00,
  provider = coalesce(provider, 'brapi')
WHERE type = 'JCP'
  AND tax_rate_pct = 0;

UPDATE public.corporate_dividends
SET
  provider = coalesce(provider, 'brapi')
WHERE provider IS NULL;

-- Garante ausência de duplicidades antes de recriar constraint com NULLS NOT DISTINCT
WITH ranked_corp AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY ticker, com_date, type, payment_date
      ORDER BY is_type_uncertain ASC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.corporate_dividends
)
DELETE FROM public.corporate_dividends cd
USING ranked_corp rc
WHERE cd.id = rc.id
  AND rc.rn > 1;

ALTER TABLE public.corporate_dividends
  DROP CONSTRAINT IF EXISTS uq_corporate_dividends;

ALTER TABLE public.corporate_dividends
  ADD CONSTRAINT uq_corporate_dividends
  UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date);

CREATE INDEX IF NOT EXISTS idx_corporate_dividends_ticker_com
  ON public.corporate_dividends (ticker, com_date DESC);

DROP INDEX IF EXISTS public.idx_corporate_dividends_payment;
CREATE INDEX idx_corporate_dividends_payment
  ON public.corporate_dividends (payment_date DESC NULLS LAST);

-- -----------------------------------------------------------------------------
-- 2. RPC `upsert_corporate_dividend_system` (`service_role`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_corporate_dividend_system(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_item jsonb;
  v_ticker text;
  v_type text;
  v_com_date date;
  v_payment_date date;
  v_rate numeric(16, 8);
  v_net_rate numeric(16, 8);
  v_currency text;
  v_provider text;
  v_tax_rate_pct numeric(5, 2);
  v_is_type_uncertain boolean;
  v_existing record;
  v_null_candidate record;
  v_confirmed_exists boolean;
  v_upserted integer := 0;
  v_promoted integer := 0;
  v_skipped integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: ingestão global de proventos é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('success', true, 'upserted', 0, 'promoted', 0, 'skipped', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
    v_type := upper(trim(coalesce(v_item->>'type', 'DIVIDENDO')));
    v_com_date := NULLIF(trim(coalesce(v_item->>'com_date', '')), '')::date;
    v_payment_date := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'payment_date', '')), '') IS NOT NULL
      THEN (v_item->>'payment_date')::date
      ELSE NULL
    END;
    v_rate := NULLIF(trim(coalesce(v_item->>'rate', '')), '')::numeric;
    v_currency := upper(trim(coalesce(v_item->>'currency', 'BRL')));
    v_provider := coalesce(NULLIF(trim(coalesce(v_item->>'provider', '')), ''), 'brapi');
    v_tax_rate_pct := coalesce(NULLIF(trim(coalesce(v_item->>'tax_rate_pct', '')), '')::numeric, CASE WHEN v_type = 'JCP' THEN 15.0 ELSE 0.0 END);
    v_net_rate := coalesce(
      NULLIF(trim(coalesce(v_item->>'net_rate', '')), '')::numeric,
      round(v_rate * (1.0 - v_tax_rate_pct / 100.0), 8)
    );
    v_is_type_uncertain := coalesce((v_item->>'is_type_uncertain')::boolean, false);

    IF v_ticker = '' OR v_com_date IS NULL OR v_rate IS NULL OR v_rate <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_type NOT IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN
      v_type := 'OUTROS';
    END IF;

    IF v_currency NOT IN ('BRL', 'USD') THEN
      v_currency := 'BRL';
    END IF;

    v_tax_rate_pct := greatest(0, least(100, v_tax_rate_pct));
    v_net_rate := greatest(0, v_net_rate);

    IF v_payment_date IS NOT NULL THEN
      -- 1) Verifica primeiro se já existe registro com essa `payment_date` exata
      --    (impede colisão de chave única em múltiplas parcelas na mesma data-com).
      SELECT id, is_type_uncertain
      INTO v_existing
      FROM public.corporate_dividends
      WHERE ticker = v_ticker
        AND com_date = v_com_date
        AND type = v_type
        AND payment_date = v_payment_date
      LIMIT 1;

      IF v_existing.id IS NOT NULL THEN
        IF v_existing.is_type_uncertain = false AND v_is_type_uncertain = true THEN
          v_skipped := v_skipped + 1;
        ELSE
          UPDATE public.corporate_dividends
          SET
            rate = v_rate,
            net_rate = v_net_rate,
            currency = v_currency,
            provider = v_provider,
            tax_rate_pct = v_tax_rate_pct,
            is_type_uncertain = v_is_type_uncertain,
            updated_at = now()
          WHERE id = v_existing.id;
          v_upserted := v_upserted + 1;
        END IF;
        CONTINUE;
      END IF;

      -- 2) Tenta promover in-place uma linha `payment_date IS NULL` de taxa compatível (±0.005)
      SELECT id, is_type_uncertain
      INTO v_null_candidate
      FROM public.corporate_dividends
      WHERE ticker = v_ticker
        AND com_date = v_com_date
        AND type = v_type
        AND payment_date IS NULL
        AND abs(rate - v_rate) <= 0.005
      ORDER BY created_at ASC, id ASC
      LIMIT 1;

      IF v_null_candidate.id IS NOT NULL THEN
        IF NOT (v_null_candidate.is_type_uncertain = false AND v_is_type_uncertain = true) THEN
          UPDATE public.corporate_dividends
          SET
            payment_date = v_payment_date,
            rate = v_rate,
            net_rate = v_net_rate,
            currency = v_currency,
            provider = v_provider,
            tax_rate_pct = v_tax_rate_pct,
            is_type_uncertain = v_is_type_uncertain,
            updated_at = now()
          WHERE id = v_null_candidate.id;
          v_promoted := v_promoted + 1;
          CONTINUE;
        END IF;
      END IF;

      -- 3) Caso contrário, insere nova parcela confirmada
      INSERT INTO public.corporate_dividends (
        ticker,
        type,
        com_date,
        payment_date,
        rate,
        net_rate,
        currency,
        provider,
        tax_rate_pct,
        is_type_uncertain,
        updated_at
      ) VALUES (
        v_ticker,
        v_type,
        v_com_date,
        v_payment_date,
        v_rate,
        v_net_rate,
        v_currency,
        v_provider,
        v_tax_rate_pct,
        v_is_type_uncertain,
        now()
      )
      ON CONFLICT (ticker, com_date, type, payment_date) DO UPDATE
      SET
        rate = CASE
          WHEN public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true
          THEN public.corporate_dividends.rate
          ELSE EXCLUDED.rate
        END,
        net_rate = CASE
          WHEN public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true
          THEN public.corporate_dividends.net_rate
          ELSE EXCLUDED.net_rate
        END,
        provider = CASE
          WHEN public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true
          THEN public.corporate_dividends.provider
          ELSE EXCLUDED.provider
        END,
        tax_rate_pct = CASE
          WHEN public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true
          THEN public.corporate_dividends.tax_rate_pct
          ELSE EXCLUDED.tax_rate_pct
        END,
        is_type_uncertain = public.corporate_dividends.is_type_uncertain AND EXCLUDED.is_type_uncertain,
        updated_at = now();

      v_upserted := v_upserted + 1;
    ELSE
      -- Pagamento ainda sem data definida (`payment_date IS NULL`):
      -- se já existe parcela confirmada compatível, não cria duplicata com data nula.
      SELECT exists (
        SELECT 1
        FROM public.corporate_dividends
        WHERE ticker = v_ticker
          AND com_date = v_com_date
          AND type = v_type
          AND payment_date IS NOT NULL
          AND abs(rate - v_rate) <= 0.005
      ) INTO v_confirmed_exists;

      IF v_confirmed_exists THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.corporate_dividends (
        ticker,
        type,
        com_date,
        payment_date,
        rate,
        net_rate,
        currency,
        provider,
        tax_rate_pct,
        is_type_uncertain,
        updated_at
      ) VALUES (
        v_ticker,
        v_type,
        v_com_date,
        NULL,
        v_rate,
        v_net_rate,
        v_currency,
        v_provider,
        v_tax_rate_pct,
        v_is_type_uncertain,
        now()
      )
      ON CONFLICT (ticker, com_date, type, payment_date) DO UPDATE
      SET
        rate = EXCLUDED.rate,
        net_rate = EXCLUDED.net_rate,
        currency = EXCLUDED.currency,
        provider = EXCLUDED.provider,
        tax_rate_pct = EXCLUDED.tax_rate_pct,
        is_type_uncertain = public.corporate_dividends.is_type_uncertain AND EXCLUDED.is_type_uncertain,
        updated_at = now()
      WHERE NOT (public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true);

      v_upserted := v_upserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'upserted', v_upserted,
    'promoted', v_promoted,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_corporate_dividend_system(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_corporate_dividend_system(jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Tabela `public.user_dividend_events` & RLS InitPlan
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_dividend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  corporate_dividend_id uuid REFERENCES public.corporate_dividends (id) ON DELETE SET NULL,
  asset_id uuid NOT NULL REFERENCES public.portfolio_assets (id) ON DELETE CASCADE,
  ticker text NOT NULL,
  type text NOT NULL CHECK (type IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS')),
  status text NOT NULL CHECK (status IN ('PROVISIONED', 'PENDING_CONFIRMATION', 'SETTLED', 'DISMISSED')),
  com_date date NOT NULL,
  payment_date date,
  quantity_on_com_date numeric(18, 8) NOT NULL DEFAULT 0 CHECK (quantity_on_com_date >= 0),
  gross_rate numeric(16, 8) NOT NULL DEFAULT 0 CHECK (gross_rate >= 0),
  net_rate numeric(16, 8) NOT NULL DEFAULT 0 CHECK (net_rate >= 0),
  tax_rate_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate_pct >= 0 AND tax_rate_pct <= 100),
  gross_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  net_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  fx_rate_applied numeric(12, 6),
  settled_dividend_id uuid REFERENCES public.portfolio_dividends (id) ON DELETE SET NULL,
  is_manual boolean NOT NULL DEFAULT false,
  is_type_uncertain boolean NOT NULL DEFAULT false,
  dismiss_reason text CHECK (dismiss_reason IS NULL OR dismiss_reason IN ('already_received', 'not_applicable', 'manual_ignore')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_dividend_events_corp
  ON public.user_dividend_events (user_id, corporate_dividend_id)
  WHERE corporate_dividend_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_dividend_events_user_status
  ON public.user_dividend_events (user_id, status, payment_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_user_dividend_events_asset
  ON public.user_dividend_events (asset_id, com_date DESC);

ALTER TABLE public.user_dividend_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_dividend_events_select_own" ON public.user_dividend_events;
CREATE POLICY "user_dividend_events_select_own"
  ON public.user_dividend_events
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_read_module('investments'))
  );

DROP POLICY IF EXISTS "user_dividend_events_insert_own" ON public.user_dividend_events;
CREATE POLICY "user_dividend_events_insert_own"
  ON public.user_dividend_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "user_dividend_events_update_own" ON public.user_dividend_events;
CREATE POLICY "user_dividend_events_update_own"
  ON public.user_dividend_events
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "user_dividend_events_delete_own" ON public.user_dividend_events;
CREATE POLICY "user_dividend_events_delete_own"
  ON public.user_dividend_events
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

-- Migra dispensas legadas de `portfolio_dividend_dismissals` para `user_dividend_events`
INSERT INTO public.user_dividend_events (
  user_id,
  corporate_dividend_id,
  asset_id,
  ticker,
  type,
  status,
  com_date,
  payment_date,
  quantity_on_com_date,
  gross_rate,
  net_rate,
  tax_rate_pct,
  gross_amount,
  net_amount,
  currency,
  is_manual,
  is_type_uncertain,
  dismiss_reason,
  created_at,
  updated_at
)
SELECT DISTINCT ON (d.user_id, d.corporate_dividend_id)
  d.user_id,
  cd.id,
  pa.id,
  cd.ticker,
  cd.type,
  'DISMISSED',
  cd.com_date,
  cd.payment_date,
  greatest(coalesce(pa.quantity, 0), 0),
  cd.rate,
  cd.net_rate,
  cd.tax_rate_pct,
  0,
  0,
  cd.currency,
  false,
  cd.is_type_uncertain,
  d.reason,
  coalesce(d.dismissed_at, now()),
  coalesce(d.dismissed_at, now())
FROM public.portfolio_dividend_dismissals d
JOIN public.corporate_dividends cd ON cd.id = d.corporate_dividend_id
JOIN public.portfolio_assets pa
  ON pa.user_id = d.user_id AND upper(trim(pa.ticker)) = upper(trim(cd.ticker))
ON CONFLICT (user_id, corporate_dividend_id) WHERE corporate_dividend_id IS NOT NULL DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Evolução de `public.portfolio_dividends` para Idempotência `source_event_id`
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolio_dividends
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.user_dividend_events (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_dividends_user_source_event
  ON public.portfolio_dividends (user_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. RPC `settle_user_dividend_event_system` (`service_role` / cron)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_user_dividend_event_system(
  p_event_id uuid,
  p_sync_cash boolean DEFAULT true,
  p_fx_rate numeric DEFAULT NULL,
  p_override_net_amount numeric DEFAULT NULL,
  p_override_payment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_event public.user_dividend_events%ROWTYPE;
  v_amount numeric(14, 2);
  v_date date;
  v_fx numeric(12, 6);
  v_cash_credit_brl numeric(14, 2);
  v_notes text;
  v_new_div_id uuid;
  v_cash_asset_id uuid;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: liquidação sistêmica de proventos é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event
  FROM public.user_dividend_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de provento não encontrado: %.', p_event_id USING ERRCODE = 'P0002';
  END IF;

  IF v_event.status = 'SETTLED' OR v_event.settled_dividend_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'event_id', v_event.id,
      'dividend_id', v_event.settled_dividend_id,
      'cash_credit_brl', 0
    );
  END IF;

  v_amount := round(coalesce(p_override_net_amount, v_event.net_amount), 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor líquido de provento inválido para liquidação: %.', v_amount USING ERRCODE = '22023';
  END IF;

  v_date := coalesce(
    p_override_payment_date,
    v_event.payment_date,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  IF v_date < date '1990-01-01' THEN
    RAISE EXCEPTION 'Data de pagamento inválida: %.', v_date USING ERRCODE = '22023';
  END IF;

  IF v_event.currency = 'USD' THEN
    IF p_fx_rate IS NOT NULL AND p_fx_rate > 0 THEN
      v_fx := p_fx_rate;
    ELSIF v_event.fx_rate_applied IS NOT NULL AND v_event.fx_rate_applied > 0 THEN
      v_fx := v_event.fx_rate_applied;
    ELSE
      SELECT price INTO v_fx
      FROM public.asset_prices
      WHERE user_id IS NULL
        AND ticker = 'USDBRL=X'
        AND price > 0
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
      v_fx := coalesce(v_fx, 5.25);
    END IF;
    v_cash_credit_brl := round(v_amount * v_fx, 2);
  ELSE
    v_fx := NULL;
    v_cash_credit_brl := v_amount;
  END IF;

  v_notes := coalesce(
    nullif(trim(p_notes), ''),
    nullif(trim(v_event.notes), ''),
    'Provento automático (' || v_event.type || ')'
  );

  INSERT INTO public.portfolio_dividends (
    user_id,
    asset_id,
    ticker,
    date,
    amount,
    notes,
    sync_cash,
    cash_amount,
    source_event_id
  ) VALUES (
    v_event.user_id,
    v_event.asset_id,
    v_event.ticker,
    v_date,
    v_amount,
    v_notes,
    coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0,
    CASE WHEN coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN v_cash_credit_brl ELSE NULL END,
    v_event.id
  )
  ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_new_div_id;

  IF v_new_div_id IS NULL THEN
    SELECT id INTO v_new_div_id
    FROM public.portfolio_dividends
    WHERE user_id = v_event.user_id
      AND source_event_id = v_event.id
    LIMIT 1;

    UPDATE public.user_dividend_events
    SET
      status = 'SETTLED',
      settled_dividend_id = v_new_div_id,
      updated_at = now()
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'event_id', v_event.id,
      'dividend_id', v_new_div_id,
      'cash_credit_brl', 0
    );
  END IF;

  IF coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_event.user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_event.user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_cash_credit_brl,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_cash_credit_brl,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  UPDATE public.user_dividend_events
  SET
    status = 'SETTLED',
    settled_dividend_id = v_new_div_id,
    net_amount = v_amount,
    payment_date = v_date,
    fx_rate_applied = coalesce(v_fx, fx_rate_applied),
    notes = v_notes,
    updated_at = now()
  WHERE id = v_event.id;

  IF v_event.corporate_dividend_id IS NOT NULL THEN
    INSERT INTO public.portfolio_dividend_dismissals (
      user_id,
      corporate_dividend_id,
      reason,
      dismissed_at
    ) VALUES (
      v_event.user_id,
      v_event.corporate_dividend_id,
      'already_received',
      now()
    )
    ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'event_id', v_event.id,
    'dividend_id', v_new_div_id,
    'cash_asset_id', v_cash_asset_id,
    'cash_credit_brl', CASE WHEN coalesce(p_sync_cash, false) THEN v_cash_credit_brl ELSE 0 END,
    'fx_rate_applied', v_fx
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_user_dividend_event_system(uuid, boolean, numeric, numeric, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_user_dividend_event_system(uuid, boolean, numeric, numeric, date, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. RPC `confirm_user_dividend_events_atomic` (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_user_dividend_events_atomic(
  p_items jsonb,
  p_sync_cash boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_event_id uuid;
  v_corp_div_id uuid;
  v_asset_id uuid;
  v_found_asset_id uuid;
  v_found_ticker text;
  v_found_currency text;
  v_event public.user_dividend_events%ROWTYPE;
  v_ticker text;
  v_type text;
  v_com_date date;
  v_date date;
  v_amount numeric(14, 2);
  v_tax_rate_pct numeric(5, 2);
  v_currency text;
  v_fx numeric(12, 6);
  v_cash_credit_brl numeric(14, 2);
  v_notes text;
  v_new_div_id uuid;
  v_cash_asset_id uuid;
  v_total_cash_brl numeric(14, 2) := 0;
  v_inserted_count integer := 0;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_settled_event_ids uuid[] := ARRAY[]::uuid[];
  v_default_fx numeric(12, 6) := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nenhum provento informado para confirmação.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_event_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'event_id', '')), '') IS NOT NULL
      THEN (v_item->>'event_id')::uuid
      ELSE NULL
    END;
    v_corp_div_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'corporate_dividend_id', '')), '') IS NOT NULL
      THEN (v_item->>'corporate_dividend_id')::uuid
      ELSE NULL
    END;
    v_asset_id := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'asset_id', '')), '') IS NOT NULL
      THEN (v_item->>'asset_id')::uuid
      ELSE NULL
    END;

    v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
    v_type := upper(trim(coalesce(v_item->>'type', 'DIVIDENDO')));
    IF v_type NOT IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN
      v_type := 'OUTROS';
    END IF;

    v_date := coalesce(
      NULLIF(trim(coalesce(v_item->>'date', '')), '')::date,
      NULLIF(trim(coalesce(v_item->>'payment_date', '')), '')::date,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date
    );
    IF v_date < date '1990-01-01' THEN
      RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
    END IF;

    v_amount := round(NULLIF(trim(coalesce(v_item->>'amount', '')), '')::numeric, 2);
    v_tax_rate_pct := CASE
      WHEN NULLIF(trim(coalesce(v_item->>'tax_rate_pct', '')), '') IS NOT NULL
      THEN greatest(0, least(100, (v_item->>'tax_rate_pct')::numeric))
      ELSE NULL
    END;
    v_notes := NULLIF(trim(coalesce(v_item->>'notes', '')), '');

    IF v_event_id IS NOT NULL THEN
      SELECT * INTO v_event
      FROM public.user_dividend_events
      WHERE id = v_event_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Evento de provento não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;

      IF v_event.status = 'SETTLED' AND v_event.settled_dividend_id IS NOT NULL THEN
        CONTINUE;
      END IF;

      v_asset_id := v_event.asset_id;
      v_corp_div_id := coalesce(v_corp_div_id, v_event.corporate_dividend_id);
      v_ticker := v_event.ticker;
      v_type := CASE WHEN v_item ? 'type' THEN v_type ELSE v_event.type END;
      v_amount := coalesce(v_amount, v_event.net_amount);
      v_tax_rate_pct := coalesce(v_tax_rate_pct, v_event.tax_rate_pct);
      v_currency := v_event.currency;
    ELSE
      -- Valida posse do ativo (cross-tenant hardening)
      v_found_asset_id := NULL;
      v_found_ticker := NULL;
      v_found_currency := NULL;

      IF v_asset_id IS NOT NULL THEN
        SELECT id, ticker, currency
        INTO v_found_asset_id, v_found_ticker, v_found_currency
        FROM public.portfolio_assets
        WHERE id = v_asset_id
          AND user_id = v_user_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
        END IF;
      ELSIF v_ticker <> '' THEN
        SELECT id, ticker, currency
        INTO v_found_asset_id, v_found_ticker, v_found_currency
        FROM public.portfolio_assets
        WHERE user_id = v_user_id
          AND upper(ticker) = v_ticker
        LIMIT 1;
      END IF;

      IF v_found_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
      END IF;

      v_asset_id := v_found_asset_id;
      v_ticker := upper(trim(v_found_ticker));
      v_currency := upper(trim(coalesce(v_item->>'currency', v_found_currency, 'BRL')));
      IF v_currency NOT IN ('BRL', 'USD') THEN
        v_currency := 'BRL';
      END IF;

      -- Verifica se já existe `user_dividend_events` para `(user_id, corporate_dividend_id)`
      IF v_corp_div_id IS NOT NULL THEN
        SELECT * INTO v_event
        FROM public.user_dividend_events
        WHERE user_id = v_user_id
          AND corporate_dividend_id = v_corp_div_id
        FOR UPDATE;

        IF FOUND THEN
          IF v_event.status = 'SETTLED' AND v_event.settled_dividend_id IS NOT NULL THEN
            CONTINUE;
          END IF;
          v_event_id := v_event.id;
          v_amount := coalesce(v_amount, v_event.net_amount);
          v_tax_rate_pct := coalesce(v_tax_rate_pct, v_event.tax_rate_pct);
        END IF;
      END IF;

      IF v_event_id IS NULL THEN
        v_com_date := coalesce(NULLIF(trim(coalesce(v_item->>'com_date', '')), '')::date, v_date);
        INSERT INTO public.user_dividend_events (
          user_id,
          corporate_dividend_id,
          asset_id,
          ticker,
          type,
          status,
          com_date,
          payment_date,
          quantity_on_com_date,
          gross_rate,
          net_rate,
          tax_rate_pct,
          gross_amount,
          net_amount,
          currency,
          is_manual,
          is_type_uncertain,
          notes
        ) VALUES (
          v_user_id,
          v_corp_div_id,
          v_asset_id,
          v_ticker,
          v_type,
          'PENDING_CONFIRMATION',
          v_com_date,
          v_date,
          coalesce(NULLIF(trim(coalesce(v_item->>'quantity_on_com_date', '')), '')::numeric, 0),
          coalesce(NULLIF(trim(coalesce(v_item->>'gross_rate', '')), '')::numeric, 0),
          coalesce(NULLIF(trim(coalesce(v_item->>'net_rate', '')), '')::numeric, 0),
          coalesce(v_tax_rate_pct, 0),
          coalesce(v_amount, 0),
          coalesce(v_amount, 0),
          v_currency,
          v_corp_div_id IS NULL,
          false,
          v_notes
        )
        RETURNING id INTO v_event_id;
      END IF;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_currency = 'USD' THEN
      IF NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '') IS NOT NULL AND (v_item->>'fx_rate')::numeric > 0 THEN
        v_fx := (v_item->>'fx_rate')::numeric;
      ELSE
        IF v_default_fx IS NULL THEN
          SELECT price INTO v_default_fx
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_default_fx := coalesce(v_default_fx, 5.25);
        END IF;
        v_fx := v_default_fx;
      END IF;
      v_cash_credit_brl := round(v_amount * v_fx, 2);
    ELSE
      v_fx := NULL;
      v_cash_credit_brl := v_amount;
    END IF;

    INSERT INTO public.portfolio_dividends (
      user_id,
      asset_id,
      ticker,
      date,
      amount,
      notes,
      sync_cash,
      cash_amount,
      source_event_id
    ) VALUES (
      v_user_id,
      v_asset_id,
      v_ticker,
      v_date,
      v_amount,
      coalesce(v_notes, 'Provento confirmado (' || v_type || ')'),
      coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0,
      CASE WHEN coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN v_cash_credit_brl ELSE NULL END,
      v_event_id
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_new_div_id;

    IF v_new_div_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.user_dividend_events
    SET
      type = v_type,
      status = 'SETTLED',
      payment_date = v_date,
      net_amount = v_amount,
      tax_rate_pct = coalesce(v_tax_rate_pct, tax_rate_pct),
      fx_rate_applied = coalesce(v_fx, fx_rate_applied),
      settled_dividend_id = v_new_div_id,
      is_type_uncertain = false,
      notes = coalesce(v_notes, notes),
      updated_at = now()
    WHERE id = v_event_id
      AND user_id = v_user_id;

    IF v_corp_div_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) VALUES (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
    END IF;

    v_inserted_ids := array_append(v_inserted_ids, v_new_div_id);
    v_settled_event_ids := array_append(v_settled_event_ids, v_event_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash_brl := v_total_cash_brl + v_cash_credit_brl;
  END LOOP;

  IF coalesce(p_sync_cash, false) AND v_total_cash_brl > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash_brl,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_total_cash_brl,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash_brl,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids,
    'settled_event_ids', v_settled_event_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_user_dividend_events_atomic(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_user_dividend_events_atomic(jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Atualização compatível de `approve_dividends_batch_atomic`
--    (remove trava < 2026-01-01 e suporta USD -> BRL no Caixa mantendo API legada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_dividends_batch_atomic(
  p_dividends jsonb,
  p_sync_cash boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_asset_id uuid;
  v_ticker text;
  v_date date;
  v_amount numeric(12, 2);
  v_cash_credit_brl numeric(12, 2);
  v_asset_currency text;
  v_fx numeric(12, 6);
  v_default_fx numeric(12, 6) := NULL;
  v_notes text;
  v_corp_div_id uuid;
  v_total_cash numeric(12, 2) := 0;
  v_inserted_count integer := 0;
  v_cash_asset_id uuid;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_dividends IS NULL OR jsonb_typeof(p_dividends) <> 'array' OR jsonb_array_length(p_dividends) = 0 THEN
    RAISE EXCEPTION 'Nenhum provento informado para aprovação.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dividends)
  LOOP
    v_ticker := trim(upper(coalesce(v_item->>'ticker', '')));
    v_date := (v_item->>'date')::date;
    v_amount := (v_item->>'amount')::numeric;
    v_notes := v_item->>'notes';

    IF v_item->>'corporate_dividend_id' IS NOT NULL AND trim(v_item->>'corporate_dividend_id') <> '' THEN
      v_corp_div_id := (v_item->>'corporate_dividend_id')::uuid;
    ELSE
      v_corp_div_id := NULL;
    END IF;

    IF v_item->>'asset_id' IS NOT NULL AND trim(v_item->>'asset_id') <> '' THEN
      SELECT id, currency INTO v_asset_id, v_asset_currency
      FROM public.portfolio_assets
      WHERE id = (v_item->>'asset_id')::uuid
        AND user_id = v_user_id;

      IF v_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;
    ELSE
      v_asset_id := NULL;
      v_asset_currency := NULL;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_date IS NULL OR v_date < date '1990-01-01' THEN
      RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
    END IF;

    IF v_asset_id IS NULL AND v_ticker <> '' THEN
      SELECT id, currency INTO v_asset_id, v_asset_currency
      FROM public.portfolio_assets
      WHERE user_id = v_user_id AND upper(ticker) = v_ticker
      LIMIT 1;
    END IF;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
    END IF;

    IF upper(coalesce(v_item->>'currency', v_asset_currency, 'BRL')) = 'USD' THEN
      IF NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '') IS NOT NULL AND (v_item->>'fx_rate')::numeric > 0 THEN
        v_fx := (v_item->>'fx_rate')::numeric;
      ELSE
        IF v_default_fx IS NULL THEN
          SELECT price INTO v_default_fx
          FROM public.asset_prices
          WHERE user_id IS NULL AND ticker = 'USDBRL=X' AND price > 0
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1;
          v_default_fx := coalesce(v_default_fx, 5.25);
        END IF;
        v_fx := v_default_fx;
      END IF;
      v_cash_credit_brl := round(v_amount * v_fx, 2);
    ELSE
      v_cash_credit_brl := round(v_amount, 2);
    END IF;

    INSERT INTO public.portfolio_dividends (
      user_id,
      asset_id,
      ticker,
      date,
      amount,
      notes,
      sync_cash,
      cash_amount
    ) VALUES (
      v_user_id,
      v_asset_id,
      nullif(v_ticker, ''),
      v_date,
      v_amount,
      v_notes,
      coalesce(p_sync_cash, false),
      CASE WHEN coalesce(p_sync_cash, false) THEN v_cash_credit_brl ELSE NULL END
    )
    RETURNING id INTO v_new_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
    v_inserted_count := v_inserted_count + 1;
    v_total_cash := v_total_cash + v_cash_credit_brl;

    IF v_corp_div_id IS NOT NULL THEN
      INSERT INTO public.portfolio_dividend_dismissals (
        user_id,
        corporate_dividend_id,
        reason,
        dismissed_at
      ) VALUES (
        v_user_id,
        v_corp_div_id,
        'already_received',
        now()
      )
      ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

      UPDATE public.user_dividend_events
      SET
        status = 'SETTLED',
        settled_dividend_id = v_new_id,
        updated_at = now()
      WHERE user_id = v_user_id
        AND corporate_dividend_id = v_corp_div_id
        AND status <> 'SETTLED';
    END IF;
  END LOOP;

  IF coalesce(p_sync_cash, false) AND v_total_cash > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1;

    IF v_cash_asset_id IS NULL THEN
      INSERT INTO public.portfolio_assets (
        user_id,
        ticker,
        asset_class,
        currency,
        quantity,
        average_price,
        notes
      ) VALUES (
        v_user_id,
        'CAIXA',
        'Caixa',
        'BRL',
        v_total_cash,
        1.00,
        'Caixa / Saldo em Corretora'
      )
      RETURNING id INTO v_cash_asset_id;
    ELSE
      UPDATE public.portfolio_assets
      SET
        quantity = quantity + v_total_cash,
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'total_cash', v_total_cash,
    'cash_asset_id', v_cash_asset_id,
    'inserted_ids', v_inserted_ids
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
