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
-- 0. Coluna `created_at` segura em `portfolio_assets` e `portfolio_transactions`
--    (preserva NULL em registros legados para não mascarar custódia Data COM)
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolio_assets
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.portfolio_assets
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.portfolio_transactions
  ALTER COLUMN created_at SET DEFAULT now();

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
  v_raw_net_rate numeric;
  v_raw_tax numeric;
  v_currency text;
  v_provider text;
  v_tax_rate_pct numeric(5, 2);
  v_is_type_uncertain boolean;
  v_rate_tol numeric;
  v_existing record;
  v_null_candidate record;
  v_uncertain_row record;
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
    v_raw_tax := coalesce(NULLIF(trim(coalesce(v_item->>'tax_rate_pct', '')), '')::numeric, CASE WHEN v_type = 'JCP' THEN 15.0 ELSE 0.0 END);
    IF v_raw_tax = 'NaN'::numeric THEN
      v_raw_tax := CASE WHEN v_type = 'JCP' THEN 15.0 ELSE 0.0 END;
    END IF;
    v_tax_rate_pct := greatest(0, least(100, v_raw_tax))::numeric(5, 2);

    v_raw_net_rate := NULLIF(trim(coalesce(v_item->>'net_rate', '')), '')::numeric;
    IF v_raw_net_rate = 'NaN'::numeric THEN
      v_raw_net_rate := NULL;
    END IF;
    v_is_type_uncertain := coalesce(NULLIF(trim(coalesce(v_item->>'is_type_uncertain', '')), '')::boolean, false);

    IF v_ticker = '' OR v_com_date IS NULL OR v_rate IS NULL OR v_rate = 'NaN'::numeric OR v_rate <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_type NOT IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN
      v_type := 'OUTROS';
    END IF;

    IF v_currency NOT IN ('BRL', 'USD') THEN
      v_currency := 'BRL';
    END IF;

    v_net_rate := greatest(0, coalesce(v_raw_net_rate, round(v_rate * (1.0 - v_tax_rate_pct / 100.0), 8)));
    v_rate_tol := greatest(0.002, v_rate * 0.03);

    IF v_payment_date IS NOT NULL THEN
      -- 1) Verifica primeiro se já existe registro com essa `payment_date` exata
      SELECT id, is_type_uncertain
      INTO v_existing
      FROM public.corporate_dividends
      WHERE ticker = v_ticker
        AND com_date = v_com_date
        AND type = v_type
        AND payment_date = v_payment_date
      LIMIT 1
      FOR UPDATE;

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

      -- 1b) Se chegou registro confiável (ex.: Brapi JCP), verifica se há fallback Yahoo incerto compatível (mesma com_date e outro type)
      IF v_is_type_uncertain = false THEN
        SELECT id, type
        INTO v_uncertain_row
        FROM public.corporate_dividends
        WHERE ticker = v_ticker
          AND com_date = v_com_date
          AND is_type_uncertain = true
          AND (payment_date IS NULL OR payment_date = v_payment_date)
          AND abs(rate - v_rate) <= v_rate_tol
        ORDER BY (payment_date = v_payment_date) DESC NULLS LAST, created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE;

        IF v_uncertain_row.id IS NOT NULL THEN
          BEGIN
            UPDATE public.corporate_dividends
            SET
              type = v_type,
              payment_date = v_payment_date,
              rate = v_rate,
              net_rate = v_net_rate,
              currency = v_currency,
              provider = v_provider,
              tax_rate_pct = v_tax_rate_pct,
              is_type_uncertain = false,
              updated_at = now()
            WHERE id = v_uncertain_row.id;
            v_promoted := v_promoted + 1;
            CONTINUE;
          EXCEPTION WHEN unique_violation THEN
            DELETE FROM public.corporate_dividends WHERE id = v_uncertain_row.id;
          END;
        END IF;
      END IF;

      -- 2) Tenta promover in-place uma linha `payment_date IS NULL` de taxa compatível
      SELECT id, is_type_uncertain
      INTO v_null_candidate
      FROM public.corporate_dividends
      WHERE ticker = v_ticker
        AND com_date = v_com_date
        AND type = v_type
        AND payment_date IS NULL
        AND abs(rate - v_rate) <= v_rate_tol
      ORDER BY created_at ASC, id ASC
      LIMIT 1
      FOR UPDATE;

      IF v_null_candidate.id IS NOT NULL THEN
        IF v_null_candidate.is_type_uncertain = false AND v_is_type_uncertain = true THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;

        BEGIN
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
        EXCEPTION WHEN unique_violation THEN
          -- Outra parcela exata já existe; cairá no ON CONFLICT abaixo com segurança
          NULL;
        END;
      END IF;

      -- 3) Caso contrário, insere ou atualiza parcela confirmada sem degradar fonte confiável
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
        currency = CASE
          WHEN public.corporate_dividends.is_type_uncertain = false AND EXCLUDED.is_type_uncertain = true
          THEN public.corporate_dividends.currency
          ELSE EXCLUDED.currency
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
          AND (type = v_type OR (v_is_type_uncertain = true) OR is_type_uncertain = false)
          AND payment_date IS NOT NULL
          AND abs(rate - v_rate) <= v_rate_tol
      ) INTO v_confirmed_exists;

      IF v_confirmed_exists THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF v_is_type_uncertain = false THEN
        SELECT id INTO v_uncertain_row
        FROM public.corporate_dividends
        WHERE ticker = v_ticker
          AND com_date = v_com_date
          AND payment_date IS NULL
          AND is_type_uncertain = true
          AND abs(rate - v_rate) <= v_rate_tol
        ORDER BY created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE;

        IF v_uncertain_row.id IS NOT NULL THEN
          BEGIN
            UPDATE public.corporate_dividends
            SET
              type = v_type,
              rate = v_rate,
              net_rate = v_net_rate,
              currency = v_currency,
              provider = v_provider,
              tax_rate_pct = v_tax_rate_pct,
              is_type_uncertain = false,
              updated_at = now()
            WHERE id = v_uncertain_row.id;
            v_upserted := v_upserted + 1;
            CONTINUE;
          EXCEPTION WHEN unique_violation THEN
            DELETE FROM public.corporate_dividends WHERE id = v_uncertain_row.id;
          END;
        END IF;
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

      IF FOUND THEN
        v_upserted := v_upserted + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
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
  settlement_origin text CHECK (settlement_origin IS NULL OR settlement_origin IN ('auto', 'manual', 'dedup')),
  manual_review_required boolean NOT NULL DEFAULT false,
  dismiss_reason text CHECK (dismiss_reason IS NULL OR dismiss_reason IN ('already_received', 'not_applicable', 'manual_ignore')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dividend_events
  ADD COLUMN IF NOT EXISTS settlement_origin text CHECK (settlement_origin IS NULL OR settlement_origin IN ('auto', 'manual', 'dedup')),
  ADD COLUMN IF NOT EXISTS manual_review_required boolean NOT NULL DEFAULT false;

-- Constraint UNIQUE padrão (permite múltiplos corporate_dividend_id NULL e suporta PostgREST ON CONFLICT)
ALTER TABLE public.user_dividend_events
  DROP CONSTRAINT IF EXISTS uq_user_dividend_events_corp;
DROP INDEX IF EXISTS public.uq_user_dividend_events_corp;
ALTER TABLE public.user_dividend_events
  ADD CONSTRAINT uq_user_dividend_events_corp UNIQUE (user_id, corporate_dividend_id);

CREATE INDEX IF NOT EXISTS idx_user_dividend_events_user_status
  ON public.user_dividend_events (user_id, status, payment_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_user_dividend_events_asset
  ON public.user_dividend_events (asset_id, com_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_dividend_events_settled_dividend
  ON public.user_dividend_events (settled_dividend_id)
  WHERE settled_dividend_id IS NOT NULL;

ALTER TABLE public.user_dividend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dividend_events FORCE ROW LEVEL SECURITY;

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
    AND EXISTS (
      SELECT 1 FROM public.portfolio_assets pa
      WHERE pa.id = asset_id AND pa.user_id = (SELECT auth.uid())
    )
    AND (
      settled_dividend_id IS NULL OR EXISTS (
        SELECT 1 FROM public.portfolio_dividends pd
        WHERE pd.id = settled_dividend_id AND pd.user_id = (SELECT auth.uid())
      )
    )
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
    AND EXISTS (
      SELECT 1 FROM public.portfolio_assets pa
      WHERE pa.id = asset_id AND pa.user_id = (SELECT auth.uid())
    )
    AND (
      settled_dividend_id IS NULL OR EXISTS (
        SELECT 1 FROM public.portfolio_dividends pd
        WHERE pd.id = settled_dividend_id AND pd.user_id = (SELECT auth.uid())
      )
    )
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
  ON pa.user_id = d.user_id
 AND regexp_replace(regexp_replace(upper(trim(pa.ticker)), '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1') = upper(trim(cd.ticker))
ORDER BY d.user_id, d.corporate_dividend_id, pa.quantity DESC, pa.id ASC
ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Evolução de `public.portfolio_dividends` para Idempotência `source_event_id`
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolio_dividends
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.user_dividend_events (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_dividends_user_source_event
  ON public.portfolio_dividends (user_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_dividends_source_event_fk
  ON public.portfolio_dividends (source_event_id)
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

  IF v_event.status = 'DISMISSED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped_dismissed', true,
      'event_id', v_event.id,
      'cash_credit_brl', 0
    );
  END IF;

  IF p_override_net_amount IS NOT NULL AND p_override_net_amount = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Valor líquido de provento inválido (NaN).' USING ERRCODE = '22023';
  END IF;

  v_amount := round(coalesce(p_override_net_amount, v_event.net_amount), 2);
  IF v_amount IS NULL OR v_amount = 'NaN'::numeric OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor líquido de provento inválido para liquidação: %.', v_amount USING ERRCODE = '22023';
  END IF;

  v_date := coalesce(
    p_override_payment_date,
    v_event.payment_date,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  IF v_date < date '2000-01-01' THEN
    RAISE EXCEPTION 'Data de pagamento inválida: %.', v_date USING ERRCODE = '22023';
  END IF;

  IF v_event.currency = 'USD' THEN
    IF p_fx_rate IS NOT NULL AND p_fx_rate <> 'NaN'::numeric AND p_fx_rate > 0 THEN
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
      settlement_origin = coalesce(settlement_origin, 'auto'),
      manual_review_required = false,
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
    LIMIT 1
    FOR UPDATE;

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
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
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
    settlement_origin = 'auto',
    manual_review_required = false,
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
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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
  v_has_valid_type boolean;
  v_com_date date;
  v_date_input date;
  v_date date;
  v_raw_amount numeric;
  v_amount numeric(14, 2);
  v_raw_tax numeric;
  v_tax_rate_pct numeric(5, 2);
  v_gross_amount numeric(14, 2);
  v_currency text;
  v_raw_fx numeric;
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
  v_owns_asset boolean := false;
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
    v_has_valid_type := NULLIF(trim(coalesce(v_item->>'type', '')), '') IS NOT NULL;
    v_type := upper(trim(coalesce(v_item->>'type', 'DIVIDENDO')));
    IF v_type NOT IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN
      v_type := 'OUTROS';
    END IF;

    v_date_input := coalesce(
      NULLIF(trim(coalesce(v_item->>'date', '')), '')::date,
      NULLIF(trim(coalesce(v_item->>'payment_date', '')), '')::date
    );

    v_raw_amount := NULLIF(trim(coalesce(v_item->>'amount', '')), '')::numeric;
    IF v_raw_amount = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Valor de provento inválido (NaN).' USING ERRCODE = '22023';
    END IF;
    v_amount := CASE WHEN v_raw_amount IS NOT NULL THEN round(v_raw_amount, 2) ELSE NULL END;

    v_raw_tax := NULLIF(trim(coalesce(v_item->>'tax_rate_pct', '')), '')::numeric;
    IF v_raw_tax = 'NaN'::numeric THEN
      v_raw_tax := NULL;
    END IF;
    v_tax_rate_pct := CASE
      WHEN v_raw_tax IS NOT NULL
      THEN greatest(0, least(100, v_raw_tax))::numeric(5, 2)
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

      SELECT exists (
        SELECT 1
        FROM public.portfolio_assets pa
        WHERE pa.id = v_event.asset_id
          AND pa.user_id = v_user_id
      ) INTO v_owns_asset;

      IF NOT v_owns_asset THEN
        RAISE EXCEPTION 'Ativo do evento não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;

      IF v_event.status = 'SETTLED' AND v_event.settled_dividend_id IS NOT NULL THEN
        CONTINUE;
      END IF;

      v_asset_id := v_event.asset_id;
      v_corp_div_id := v_event.corporate_dividend_id;
      v_ticker := v_event.ticker;
      v_type := CASE WHEN v_has_valid_type THEN v_type ELSE v_event.type END;
      v_date := coalesce(v_date_input, v_event.payment_date, v_today_br);
      v_amount := coalesce(v_amount, v_event.net_amount);
      v_tax_rate_pct := coalesce(v_tax_rate_pct, v_event.tax_rate_pct);
      v_currency := v_event.currency;

      IF v_date IS NULL OR v_date < date '2000-01-01' THEN
        RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
      END IF;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
      END IF;
    ELSE
      v_date := coalesce(v_date_input, v_today_br);
      IF v_date IS NULL OR v_date < date '2000-01-01' THEN
        RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
      END IF;

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
          AND (
            upper(trim(ticker)) = v_ticker
            OR regexp_replace(regexp_replace(upper(trim(ticker)), '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1')
               = regexp_replace(regexp_replace(v_ticker, '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1')
          )
        ORDER BY quantity DESC NULLS LAST, id ASC
        LIMIT 1;
      END IF;

      IF v_found_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
      END IF;

      v_asset_id := v_found_asset_id;
      v_ticker := upper(trim(v_found_ticker));
      v_currency := upper(trim(coalesce(NULLIF(trim(coalesce(v_item->>'currency', '')), ''), v_found_currency, 'BRL')));
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
          v_date := coalesce(v_date_input, v_event.payment_date, v_today_br);
          v_type := CASE WHEN v_has_valid_type THEN v_type ELSE v_event.type END;
        END IF;
      END IF;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
      END IF;

      IF v_event_id IS NULL THEN
        v_com_date := coalesce(NULLIF(trim(coalesce(v_item->>'com_date', '')), '')::date, v_date);
        v_gross_amount := CASE
          WHEN coalesce(v_tax_rate_pct, 0) > 0 AND coalesce(v_tax_rate_pct, 0) < 100
          THEN round(v_amount / (1.0 - v_tax_rate_pct / 100.0), 2)
          ELSE v_amount
        END;

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
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'quantity_on_com_date', '')), '')::numeric, 0)),
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'gross_rate', '')), '')::numeric, 0)),
          greatest(0, coalesce(NULLIF(trim(coalesce(v_item->>'net_rate', '')), '')::numeric, 0)),
          coalesce(v_tax_rate_pct, 0),
          v_gross_amount,
          v_amount,
          v_currency,
          v_corp_div_id IS NULL,
          false,
          v_notes
        )
        ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
        SET
          type = EXCLUDED.type,
          payment_date = EXCLUDED.payment_date,
          tax_rate_pct = EXCLUDED.tax_rate_pct,
          gross_amount = EXCLUDED.gross_amount,
          net_amount = EXCLUDED.net_amount,
          notes = coalesce(EXCLUDED.notes, public.user_dividend_events.notes),
          updated_at = now()
        RETURNING id INTO v_event_id;
      END IF;
    END IF;

    IF v_currency = 'USD' THEN
      v_raw_fx := NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '')::numeric;
      IF v_raw_fx IS NOT NULL AND v_raw_fx <> 'NaN'::numeric AND v_raw_fx > 0 THEN
        v_fx := v_raw_fx;
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
      coalesce(v_notes, nullif(trim(v_event.notes), ''), 'Provento confirmado (' || v_type || ')'),
      coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0,
      CASE WHEN coalesce(p_sync_cash, false) AND v_cash_credit_brl > 0 THEN v_cash_credit_brl ELSE NULL END,
      v_event_id
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_new_div_id;

    IF v_new_div_id IS NULL THEN
      SELECT id INTO v_new_div_id
      FROM public.portfolio_dividends
      WHERE user_id = v_user_id
        AND source_event_id = v_event_id
      LIMIT 1;

      UPDATE public.user_dividend_events
      SET
        status = 'SETTLED',
        settled_dividend_id = v_new_div_id,
        settlement_origin = coalesce(settlement_origin, 'manual'),
        manual_review_required = false,
        updated_at = now()
      WHERE id = v_event_id
        AND user_id = v_user_id;

      CONTINUE;
    END IF;

    v_gross_amount := CASE
      WHEN coalesce(v_tax_rate_pct, 0) > 0 AND coalesce(v_tax_rate_pct, 0) < 100
      THEN round(v_amount / (1.0 - v_tax_rate_pct / 100.0), 2)
      ELSE v_amount
    END;

    UPDATE public.user_dividend_events
    SET
      type = v_type,
      status = 'SETTLED',
      settlement_origin = 'manual',
      manual_review_required = false,
      payment_date = v_date,
      gross_amount = CASE WHEN is_manual OR v_tax_rate_pct IS NOT NULL THEN v_gross_amount ELSE gross_amount END,
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
    LIMIT 1
    FOR UPDATE;

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
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
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
  v_found_ticker text;
  v_date date;
  v_raw_amount numeric;
  v_amount numeric(12, 2);
  v_cash_credit_brl numeric(12, 2);
  v_asset_currency text;
  v_raw_fx numeric;
  v_fx numeric(12, 6);
  v_default_fx numeric(12, 6) := NULL;
  v_notes text;
  v_corp_div_id uuid;
  v_existing_event public.user_dividend_events%ROWTYPE;
  v_source_event_id uuid;
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
    v_date := NULLIF(trim(coalesce(v_item->>'date', '')), '')::date;
    v_raw_amount := NULLIF(trim(coalesce(v_item->>'amount', '')), '')::numeric;
    IF v_raw_amount = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Valor de provento inválido (NaN).' USING ERRCODE = '22023';
    END IF;
    v_amount := CASE WHEN v_raw_amount IS NOT NULL THEN round(v_raw_amount, 2) ELSE NULL END;
    v_notes := NULLIF(trim(coalesce(v_item->>'notes', '')), '');

    IF v_item->>'corporate_dividend_id' IS NOT NULL AND trim(v_item->>'corporate_dividend_id') <> '' THEN
      v_corp_div_id := (v_item->>'corporate_dividend_id')::uuid;
    ELSE
      v_corp_div_id := NULL;
    END IF;

    IF v_item->>'asset_id' IS NOT NULL AND trim(v_item->>'asset_id') <> '' THEN
      SELECT id, ticker, currency INTO v_asset_id, v_found_ticker, v_asset_currency
      FROM public.portfolio_assets
      WHERE id = (v_item->>'asset_id')::uuid
        AND user_id = v_user_id;

      IF v_asset_id IS NULL THEN
        RAISE EXCEPTION 'Ativo não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
      END IF;
      IF v_ticker = '' THEN
        v_ticker := upper(trim(v_found_ticker));
      END IF;
    ELSE
      v_asset_id := NULL;
      v_asset_currency := NULL;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de provento inválido: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_date IS NULL OR v_date < date '2000-01-01' THEN
      RAISE EXCEPTION 'Data de provento inválida: %', v_date USING ERRCODE = '22023';
    END IF;

    IF v_asset_id IS NULL AND v_ticker <> '' THEN
      SELECT id, ticker, currency INTO v_asset_id, v_found_ticker, v_asset_currency
      FROM public.portfolio_assets
      WHERE user_id = v_user_id
        AND (
          upper(trim(ticker)) = v_ticker
          OR regexp_replace(regexp_replace(upper(trim(ticker)), '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1')
             = regexp_replace(regexp_replace(v_ticker, '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1')
        )
      ORDER BY quantity DESC NULLS LAST, id ASC
      LIMIT 1;
      IF v_asset_id IS NOT NULL THEN
        v_ticker := upper(trim(v_found_ticker));
      END IF;
    END IF;

    IF v_asset_id IS NULL THEN
      RAISE EXCEPTION 'Ativo não encontrado para o provento com ticker %.', v_ticker USING ERRCODE = 'P0002';
    END IF;

    v_source_event_id := NULL;
    IF v_corp_div_id IS NOT NULL THEN
      SELECT * INTO v_existing_event
      FROM public.user_dividend_events
      WHERE user_id = v_user_id
        AND corporate_dividend_id = v_corp_div_id
      FOR UPDATE;

      IF FOUND THEN
        IF v_existing_event.status = 'SETTLED' AND v_existing_event.settled_dividend_id IS NOT NULL THEN
          CONTINUE;
        END IF;
        v_source_event_id := v_existing_event.id;
      END IF;
    END IF;

    IF upper(coalesce(NULLIF(trim(coalesce(v_item->>'currency', '')), ''), v_asset_currency, 'BRL')) = 'USD' THEN
      v_raw_fx := NULLIF(trim(coalesce(v_item->>'fx_rate', '')), '')::numeric;
      IF v_raw_fx IS NOT NULL AND v_raw_fx <> 'NaN'::numeric AND v_raw_fx > 0 THEN
        v_fx := v_raw_fx;
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
      cash_amount,
      source_event_id
    ) VALUES (
      v_user_id,
      v_asset_id,
      nullif(v_ticker, ''),
      v_date,
      v_amount,
      v_notes,
      coalesce(p_sync_cash, false),
      CASE WHEN coalesce(p_sync_cash, false) THEN v_cash_credit_brl ELSE NULL END,
      v_source_event_id
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NULL AND v_source_event_id IS NOT NULL THEN
      CONTINUE;
    END IF;

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
        settlement_origin = 'manual',
        manual_review_required = false,
        settled_dividend_id = v_new_id,
        fx_rate_applied = coalesce(v_fx, fx_rate_applied),
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
    LIMIT 1
    FOR UPDATE;

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
      ON CONFLICT (user_id, ticker) DO UPDATE
      SET
        quantity = public.portfolio_assets.quantity + EXCLUDED.quantity,
        updated_at = now()
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

REVOKE ALL ON FUNCTION public.approve_dividends_batch_atomic(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_dividends_batch_atomic(jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. RPCs Atômicas de Reversão (Undo) e Dispensa Segura de Eventos (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_confirmed_dividend_events_atomic(
  p_dividend_ids uuid[],
  p_event_ids uuid[] DEFAULT NULL,
  p_corporate_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_deleted_div_ids uuid[];
  v_source_event_ids uuid[];
  v_target_event_ids uuid[];
  v_linked_corp_ids uuid[];
  v_cash_to_revert numeric(14, 2) := 0;
  v_cash_asset_id uuid;
  v_reverted_events integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  WITH deleted_divs AS (
    DELETE FROM public.portfolio_dividends
    WHERE user_id = v_user_id
      AND id = ANY(coalesce(p_dividend_ids, ARRAY[]::uuid[]))
    RETURNING id, sync_cash, cash_amount, amount, source_event_id
  )
  SELECT
    coalesce(array_agg(id), ARRAY[]::uuid[]),
    coalesce(array_agg(source_event_id) FILTER (WHERE source_event_id IS NOT NULL), ARRAY[]::uuid[]),
    coalesce(sum(CASE WHEN sync_cash THEN coalesce(cash_amount, amount, 0) ELSE 0 END), 0)
  INTO v_deleted_div_ids, v_source_event_ids, v_cash_to_revert
  FROM deleted_divs;

  IF v_cash_to_revert > 0 THEN
    SELECT id INTO v_cash_asset_id
    FROM public.portfolio_assets
    WHERE user_id = v_user_id AND upper(ticker) = 'CAIXA'
    LIMIT 1
    FOR UPDATE;

    IF v_cash_asset_id IS NOT NULL THEN
      UPDATE public.portfolio_assets
      SET
        quantity = greatest(0, quantity - v_cash_to_revert),
        updated_at = now()
      WHERE id = v_cash_asset_id;
    END IF;
  END IF;

  SELECT coalesce(array_agg(DISTINCT ev_id), ARRAY[]::uuid[])
  INTO v_target_event_ids
  FROM unnest(coalesce(p_event_ids, ARRAY[]::uuid[]) || coalesce(v_source_event_ids, ARRAY[]::uuid[])) AS ev_id
  WHERE ev_id IS NOT NULL;

  WITH restored AS (
    UPDATE public.user_dividend_events u
    SET
      status = CASE
        WHEN u.payment_date IS NULL OR u.payment_date > v_today_br THEN 'PROVISIONED'
        ELSE 'PENDING_CONFIRMATION'
      END,
      settled_dividend_id = NULL,
      fx_rate_applied = NULL,
      settlement_origin = NULL,
      manual_review_required = true,
      updated_at = now()
    WHERE u.user_id = v_user_id
      AND (
        u.id = ANY(v_target_event_ids)
        OR u.settled_dividend_id = ANY(coalesce(v_deleted_div_ids, ARRAY[]::uuid[]))
      )
    RETURNING u.corporate_dividend_id
  )
  SELECT coalesce(array_agg(DISTINCT cid) FILTER (WHERE cid IS NOT NULL), ARRAY[]::uuid[])
  INTO v_linked_corp_ids
  FROM restored;

  GET DIAGNOSTICS v_reverted_events = ROW_COUNT;

  DELETE FROM public.portfolio_dividend_dismissals
  WHERE user_id = v_user_id
    AND corporate_dividend_id = ANY(
      coalesce(p_corporate_ids, ARRAY[]::uuid[]) || coalesce(v_linked_corp_ids, ARRAY[]::uuid[])
    );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_dividends', coalesce(array_length(v_deleted_div_ids, 1), 0),
    'reverted_events', v_reverted_events,
    'reverted_cash_brl', v_cash_to_revert
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revert_confirmed_dividend_events_atomic(uuid[], uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_confirmed_dividend_events_atomic(uuid[], uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_user_dividend_event_atomic(
  p_event_id uuid DEFAULT NULL,
  p_corporate_dividend_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'manual_ignore'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reason text := CASE
    WHEN p_reason IN ('already_received', 'not_applicable', 'manual_ignore') THEN p_reason
    ELSE 'manual_ignore'
  END;
  v_corp public.corporate_dividends%ROWTYPE;
  v_corp_div_id uuid := p_corporate_dividend_id;
  v_asset_id uuid := NULL;
  v_resolved_event_id uuid := p_event_id;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF p_event_id IS NOT NULL THEN
    UPDATE public.user_dividend_events
    SET
      status = 'DISMISSED',
      dismiss_reason = v_reason,
      manual_review_required = true,
      updated_at = now()
    WHERE id = p_event_id
      AND user_id = v_user_id
    RETURNING id, corporate_dividend_id INTO v_resolved_event_id, v_corp_div_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Evento não encontrado ou não pertence ao usuário.' USING ERRCODE = '42501';
    END IF;

    v_corp_div_id := coalesce(v_corp_div_id, p_corporate_dividend_id);
  ELSIF p_corporate_dividend_id IS NOT NULL THEN
    SELECT * INTO v_corp
    FROM public.corporate_dividends
    WHERE id = p_corporate_dividend_id;

    IF FOUND THEN
      IF p_asset_id IS NOT NULL THEN
        SELECT id INTO v_asset_id
        FROM public.portfolio_assets
        WHERE id = p_asset_id AND user_id = v_user_id;
      END IF;

      IF v_asset_id IS NULL THEN
        SELECT id INTO v_asset_id
        FROM public.portfolio_assets
        WHERE user_id = v_user_id
          AND regexp_replace(regexp_replace(upper(trim(ticker)), '\.SA$', ''), '^([A-Z][A-Z0-9]{3}[0-9]{1,2})F$', '\1')
              = upper(trim(v_corp.ticker))
        ORDER BY quantity DESC NULLS LAST, id ASC
        LIMIT 1;
      END IF;

      IF v_asset_id IS NOT NULL THEN
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
          manual_review_required,
          dismiss_reason
        ) VALUES (
          v_user_id,
          v_corp.id,
          v_asset_id,
          v_corp.ticker,
          v_corp.type,
          'DISMISSED',
          v_corp.com_date,
          v_corp.payment_date,
          0,
          v_corp.rate,
          v_corp.net_rate,
          v_corp.tax_rate_pct,
          0,
          0,
          v_corp.currency,
          false,
          v_corp.is_type_uncertain,
          true,
          v_reason
        )
        ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
        SET
          status = 'DISMISSED',
          dismiss_reason = EXCLUDED.dismiss_reason,
          manual_review_required = true,
          updated_at = now()
        RETURNING id INTO v_resolved_event_id;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Informe event_id ou corporate_dividend_id para dispensar.' USING ERRCODE = '22023';
  END IF;

  IF v_corp_div_id IS NOT NULL THEN
    INSERT INTO public.portfolio_dividend_dismissals (
      user_id,
      corporate_dividend_id,
      reason,
      dismissed_at
    ) VALUES (
      v_user_id,
      v_corp_div_id,
      v_reason,
      now()
    )
    ON CONFLICT (user_id, corporate_dividend_id) DO UPDATE
    SET
      reason = EXCLUDED.reason,
      dismissed_at = EXCLUDED.dismissed_at;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_resolved_event_id,
    'corporate_dividend_id', v_corp_div_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_user_dividend_event_atomic(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_user_dividend_event_atomic(uuid, uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Atualização de `restore_backup` para preservar `user_dividend_events`,
--    `portfolio_dividend_dismissals` e `portfolio_dividends.source_event_id`
--    (mantendo 100% compatibilidade com backups antigos sem essas chaves)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_current_user_write() THEN
    RAISE EXCEPTION 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(v_data) <> 'object' THEN
    RAISE EXCEPTION 'Backup inválido: campo "data" ausente ou malformado.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.snapshot_rpc', 'on', true);

  DELETE FROM public.user_dividend_events WHERE user_id = v_uid;
  DELETE FROM public.portfolio_dividend_dismissals WHERE user_id = v_uid;
  DELETE FROM public.portfolio_transactions pt
    USING public.portfolio_assets a
    WHERE pt.asset_id = a.id AND a.user_id = v_uid;
  DELETE FROM public.portfolio_dividends WHERE user_id = v_uid;
  DELETE FROM public.portfolio_contributions WHERE user_id = v_uid;
  DELETE FROM public.portfolio_snapshots WHERE user_id = v_uid;
  DELETE FROM public.class_targets WHERE user_id = v_uid;
  DELETE FROM public.sector_targets WHERE user_id = v_uid;
  DELETE FROM public.cash_checkpoints WHERE user_id = v_uid;
  DELETE FROM public.card_competence_overrides o
    USING public.credit_cards c
    WHERE o.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.card_payments cp
    USING public.credit_cards c
    WHERE cp.card_id = c.id AND c.user_id = v_uid;
  DELETE FROM public.debts WHERE user_id = v_uid;
  DELETE FROM public.expenses WHERE user_id = v_uid;
  DELETE FROM public.incomes WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.income_goals WHERE user_id = v_uid;
  DELETE FROM public.insight_feedback WHERE user_id = v_uid;
  DELETE FROM public.reminder_states WHERE user_id = v_uid;
  DELETE FROM public.asset_prices WHERE user_id = v_uid;
  DELETE FROM public.portfolio_assets WHERE user_id = v_uid;
  DELETE FROM public.credit_cards WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  DELETE FROM public.user_preferences WHERE user_id = v_uid;

  INSERT INTO public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  SELECT id, v_uid, type, name, icon, color, is_reserved, is_active
  FROM jsonb_populate_recordset(NULL::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  INSERT INTO public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits)
  SELECT id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active, last_four_digits
  FROM jsonb_populate_recordset(NULL::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  INSERT INTO public.portfolio_assets (
    id, user_id, ticker, asset_class, sector, currency, quantity, average_price,
    total_cost_brl, average_cost_brl, fx_rate_at_purchase,
    ceiling_price, ceiling_method, ceiling_metadata,
    accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata,
    is_family, family_id, family_share_mode, family_share_percentage, notes,
    score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary
  )
  SELECT
    pa.id,
    v_uid,
    pa.ticker,
    pa.asset_class,
    pa.sector,
    coalesce(nullif(pa.currency, ''), 'BRL'),
    coalesce(pa.quantity, 0),
    coalesce(pa.average_price, 0),
    pa.total_cost_brl,
    pa.average_cost_brl,
    pa.fx_rate_at_purchase,
    pa.ceiling_price,
    pa.ceiling_method,
    pa.ceiling_metadata,
    coalesce(pa.accumulated_dividends, 0),
    coalesce(pa.estimated_monthly_dividend_per_share, 0),
    pa.fixed_income_metadata,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN coalesce(pa.is_family, false) ELSE false END,
    CASE WHEN f.id IS NOT NULL AND public.is_family_member(f.id, v_uid) THEN pa.family_id ELSE NULL END,
    coalesce(nullif(pa.family_share_mode, ''), 'full'),
    coalesce(pa.family_share_percentage, 100),
    pa.notes,
    pa.score,
    coalesce(nullif(pa.allocation_status, ''), 'active'),
    coalesce(pa.score_criteria, '{}'::jsonb),
    pa.last_reviewed_at,
    coalesce(pa.review_frequency_months, 6),
    pa.thesis_summary
  FROM jsonb_populate_recordset(NULL::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb)) pa
  LEFT JOIN public.families f ON f.id = pa.family_id;

  INSERT INTO public.user_preferences (
    user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill,
    report_weights_enabled, max_sector_acoes, max_sector_fiis, custom_settings, app_mode
  )
  SELECT
    v_uid,
    coalesce(nullif(theme, ''), 'system'),
    coalesce(reminders_enabled, true),
    coalesce(reminder_days_before_debt, 3),
    coalesce(reminder_days_before_bill, 3),
    coalesce(report_weights_enabled, false),
    coalesce(max_sector_acoes, 25),
    coalesce(max_sector_fiis, 25),
    coalesce(custom_settings, '{}'::jsonb),
    coalesce(nullif(app_mode, ''), 'investor')
  FROM jsonb_populate_recordset(NULL::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  INSERT INTO public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  SELECT o.id, o.card_id, o.month, o.closing_day, o.due_day
  FROM jsonb_populate_recordset(NULL::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  JOIN public.credit_cards c ON c.id = o.card_id
  WHERE c.user_id = v_uid;

  INSERT INTO public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  SELECT i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  FROM jsonb_populate_recordset(NULL::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  JOIN public.categories cat ON cat.id = i.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  SELECT e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id, e.installments_total, e.installment_number, e.installment_group_id, e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at
  FROM jsonb_populate_recordset(NULL::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  JOIN public.categories cat ON cat.id = e.category_id
  LEFT JOIN public.credit_cards cc ON cc.id = e.card_id
  WHERE cat.user_id = v_uid AND (e.card_id IS NULL OR cc.user_id = v_uid);

  INSERT INTO public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  SELECT d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, e.id, d.installment_group_id, d.created_at
  FROM jsonb_populate_recordset(NULL::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d
  LEFT JOIN public.expenses e ON e.id = d.expense_id AND e.user_id = v_uid
  WHERE d.expense_id IS NULL OR e.id IS NOT NULL;

  INSERT INTO public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  SELECT cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  FROM jsonb_populate_recordset(NULL::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  JOIN public.credit_cards cc ON cc.id = cp.card_id
  WHERE cc.user_id = v_uid;

  INSERT INTO public.budgets (id, user_id, category_id, month, "limit")
  SELECT b.id, v_uid, b.category_id, b.month, b."limit"
  FROM jsonb_populate_recordset(NULL::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  JOIN public.categories cat ON cat.id = b.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.income_goals (id, user_id, category_id, month, expected)
  SELECT ig.id, v_uid, ig.category_id, ig.month, ig.expected
  FROM jsonb_populate_recordset(NULL::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  JOIN public.categories cat ON cat.id = ig.category_id
  WHERE cat.user_id = v_uid;

  INSERT INTO public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  SELECT id, v_uid, occurrence_key, decision, created_at
  FROM jsonb_populate_recordset(NULL::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  INSERT INTO public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  SELECT id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  INSERT INTO public.portfolio_transactions (
    id, user_id, asset_id, type, date, quantity, price, total,
    total_cost_brl, fx_rate, notes, batch_id
  )
  SELECT
    pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total,
    pt.total_cost_brl, pt.fx_rate, pt.notes, pt.batch_id
  FROM jsonb_populate_recordset(NULL::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  JOIN public.portfolio_assets pa ON pa.id = pt.asset_id
  WHERE pa.user_id = v_uid;

  INSERT INTO public.portfolio_snapshots (
    id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost,
    manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at,
    status, closing_date, closed_at, created_at, updated_at
  )
  SELECT
    ps.id,
    v_uid,
    ps.month,
    ps.total_value,
    ps.total_cost,
    ps.auto_total_value,
    ps.auto_total_cost,
    ps.manual_total_value,
    ps.manual_total_cost,
    coalesce(ps.is_manually_calibrated, false),
    ps.calibrated_at,
    coalesce(nullif(ps.status, ''), 'closed'),
    ps.closing_date,
    ps.closed_at,
    coalesce(ps.created_at, now()),
    coalesce(ps.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_snapshots, coalesce(v_data -> 'portfolio_snapshots', '[]'::jsonb)) ps;

  INSERT INTO public.portfolio_contributions (id, user_id, asset_id, date, amount, notes, batch_id, created_at)
  SELECT
    pc.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pc.asset_id ELSE NULL END,
    pc.date,
    pc.amount,
    pc.notes,
    pc.batch_id,
    coalesce(pc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_contributions, coalesce(v_data -> 'portfolio_contributions', '[]'::jsonb)) pc
  LEFT JOIN public.portfolio_assets pa ON pa.id = pc.asset_id AND pa.user_id = v_uid;

  -- 1º passo circular: insere portfolio_dividends com source_event_id = NULL
  INSERT INTO public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, source_event_id, created_at)
  SELECT
    pd.id,
    v_uid,
    CASE WHEN pa.id IS NOT NULL THEN pd.asset_id ELSE NULL END,
    pd.ticker,
    pd.date,
    pd.amount,
    pd.notes,
    coalesce(pd.sync_cash, false),
    pd.cash_amount,
    NULL,
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN public.portfolio_assets pa ON pa.id = pd.asset_id AND pa.user_id = v_uid;

  -- 2º passo circular: restaura user_dividend_events vinculados a portfolio_assets e portfolio_dividends do usuário
  IF jsonb_typeof(v_data -> 'user_dividend_events') = 'array' THEN
    INSERT INTO public.user_dividend_events (
      id, user_id, corporate_dividend_id, asset_id, ticker, type, status,
      com_date, payment_date, quantity_on_com_date, gross_rate, net_rate, tax_rate_pct,
      gross_amount, net_amount, currency, fx_rate_applied, settled_dividend_id,
      is_manual, is_type_uncertain, settlement_origin, manual_review_required,
      dismiss_reason, notes, created_at, updated_at
    )
    SELECT
      coalesce(ude.id, gen_random_uuid()),
      v_uid,
      cd.id,
      pa.id,
      coalesce(nullif(upper(trim(ude.ticker)), ''), upper(trim(pa.ticker))),
      CASE WHEN ude.type IN ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'SOBRA', 'AMORTIZACAO', 'OUTROS') THEN ude.type ELSE 'OUTROS' END,
      CASE WHEN ude.status IN ('PROVISIONED', 'PENDING_CONFIRMATION', 'SETTLED', 'DISMISSED') THEN ude.status ELSE 'PENDING_CONFIRMATION' END,
      ude.com_date,
      ude.payment_date,
      greatest(0, coalesce(ude.quantity_on_com_date, 0)),
      greatest(0, coalesce(ude.gross_rate, 0)),
      greatest(0, coalesce(ude.net_rate, 0)),
      greatest(0, least(100, coalesce(ude.tax_rate_pct, 0))),
      greatest(0, coalesce(ude.gross_amount, 0)),
      greatest(0, coalesce(ude.net_amount, 0)),
      CASE WHEN upper(trim(coalesce(ude.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
      ude.fx_rate_applied,
      pd.id,
      coalesce(ude.is_manual, false),
      coalesce(ude.is_type_uncertain, false),
      CASE WHEN ude.settlement_origin IN ('auto', 'manual', 'dedup') THEN ude.settlement_origin ELSE NULL END,
      coalesce(ude.manual_review_required, false),
      CASE WHEN ude.dismiss_reason IN ('already_received', 'not_applicable', 'manual_ignore') THEN ude.dismiss_reason ELSE NULL END,
      ude.notes,
      coalesce(ude.created_at, now()),
      coalesce(ude.updated_at, now())
    FROM jsonb_populate_recordset(NULL::public.user_dividend_events, v_data -> 'user_dividend_events') ude
    JOIN public.portfolio_assets pa ON pa.id = ude.asset_id AND pa.user_id = v_uid
    LEFT JOIN public.corporate_dividends cd ON cd.id = ude.corporate_dividend_id
    LEFT JOIN public.portfolio_dividends pd ON pd.id = ude.settled_dividend_id AND pd.user_id = v_uid
    ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;

    -- 3º passo circular: reconecta source_event_id válido em portfolio_dividends
    UPDATE public.portfolio_dividends pd
    SET source_event_id = ude.id
    FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd_raw
    JOIN public.user_dividend_events ude ON ude.id = pd_raw.source_event_id AND ude.user_id = v_uid
    WHERE pd.id = pd_raw.id
      AND pd.user_id = v_uid;
  END IF;

  IF jsonb_typeof(v_data -> 'portfolio_dividend_dismissals') = 'array' THEN
    INSERT INTO public.portfolio_dividend_dismissals (id, user_id, corporate_dividend_id, reason, dismissed_at)
    SELECT
      coalesce(pdd.id, gen_random_uuid()),
      v_uid,
      cd.id,
      CASE WHEN pdd.reason IN ('already_received', 'not_applicable', 'manual_ignore') THEN pdd.reason ELSE 'manual_ignore' END,
      coalesce(pdd.dismissed_at, now())
    FROM jsonb_populate_recordset(NULL::public.portfolio_dividend_dismissals, v_data -> 'portfolio_dividend_dismissals') pdd
    JOIN public.corporate_dividends cd ON cd.id = pdd.corporate_dividend_id
    ON CONFLICT (user_id, corporate_dividend_id) DO NOTHING;
  END IF;

  INSERT INTO public.class_targets (id, user_id, group_type, name, target_percentage)
  SELECT id, v_uid, coalesce(nullif(group_type, ''), 'class'), name, target_percentage
  FROM jsonb_populate_recordset(NULL::public.class_targets, coalesce(v_data -> 'class_targets', '[]'::jsonb))
  WHERE lower(trim(coalesce(name, ''))) <> 'caixa';

  INSERT INTO public.sector_targets (id, user_id, group_type, class_name, name, target_percentage)
  SELECT
    id,
    v_uid,
    coalesce(nullif(group_type, ''), 'sector'),
    coalesce(nullif(trim(coalesce(class_name, '')), ''), 'Ações'),
    name,
    target_percentage
  FROM jsonb_populate_recordset(NULL::public.sector_targets, coalesce(v_data -> 'sector_targets', '[]'::jsonb));

  INSERT INTO public.asset_prices (id, user_id, ticker, price, currency, source, manual_price, provider, market_price_at, updated_at)
  SELECT DISTINCT ON (upper(trim(ap.ticker)))
    coalesce(ap.id, gen_random_uuid()),
    v_uid,
    upper(trim(ap.ticker)),
    coalesce(ap.manual_price, ap.price),
    CASE WHEN upper(trim(coalesce(ap.currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END,
    'manual',
    coalesce(ap.manual_price, ap.price),
    'manual',
    coalesce(ap.market_price_at, ap.updated_at, now()),
    coalesce(ap.updated_at, now())
  FROM jsonb_populate_recordset(NULL::public.asset_prices, coalesce(v_data -> 'asset_prices', '[]'::jsonb)) ap
  WHERE ap.user_id IS NOT NULL
    AND nullif(trim(coalesce(ap.ticker, '')), '') IS NOT NULL
    AND (ap.source = 'manual' OR ap.manual_price IS NOT NULL)
    AND coalesce(ap.manual_price, ap.price, 0) > 0
  ORDER BY upper(trim(ap.ticker)), coalesce(ap.updated_at, now()) DESC
  ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE
  SET price = excluded.price,
      currency = excluded.currency,
      source = 'manual',
      manual_price = excluded.manual_price,
      provider = 'manual',
      market_price_at = excluded.market_price_at,
      updated_at = excluded.updated_at;

  INSERT INTO public.cash_checkpoints (id, user_id, date, balance_cents, notes, created_at)
  SELECT
    cc.id,
    v_uid,
    cc.date,
    cc.balance_cents,
    cc.notes,
    coalesce(cc.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.cash_checkpoints, coalesce(v_data -> 'cash_checkpoints', '[]'::jsonb)) cc;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (v_uid, 'backup', v_uid::text, 'restore', jsonb_build_object('restoredAt', now()));

  SELECT jsonb_build_object(
    'categories', (SELECT count(*) FROM public.categories WHERE user_id = v_uid),
    'credit_cards', (SELECT count(*) FROM public.credit_cards WHERE user_id = v_uid),
    'incomes', (SELECT count(*) FROM public.incomes WHERE user_id = v_uid),
    'expenses', (SELECT count(*) FROM public.expenses WHERE user_id = v_uid),
    'debts', (SELECT count(*) FROM public.debts WHERE user_id = v_uid),
    'portfolio_assets', (SELECT count(*) FROM public.portfolio_assets WHERE user_id = v_uid),
    'class_targets', (SELECT count(*) FROM public.class_targets WHERE user_id = v_uid),
    'sector_targets', (SELECT count(*) FROM public.sector_targets WHERE user_id = v_uid)
  ) INTO v_counts;

  RETURN jsonb_build_object('success', true, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
