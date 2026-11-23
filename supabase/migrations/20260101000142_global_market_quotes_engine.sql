-- =============================================================================
-- Migration 0142: Motor Global de Cotações (SWR + EOD/EOM), PTAX & Anti-Spam
-- =============================================================================
-- Bloco A do Plano Mestre (`docs/plans/PLANO_MOTOR_COTACOES_PROVENTOS.md`):
--   1. Multi-tenancy estrito em `public.asset_prices`:
--      - `user_id IS NULL`: linha global única por ticker (`source IN ('api', 'fallback')`), escrita apenas via `service_role`;
--      - `user_id IS NOT NULL`: override manual exclusivo do usuário (`source = 'manual'`).
--   2. Metadados de frescor e Spike Guardrail Split-Aware (`market_price_at`, `fetched_at`, `provider`, `pending_spike_*`).
--   3. RPC `upsert_global_asset_prices` com trava Never-Degrade SQL.
--   4. Atualização de `restore_backup` (snapshots históricos + compatibilidade com backups legados em `asset_prices`).
--   5. Histórico global `public.market_price_history` (90d EOD + EOM permanente).
--   6. Single-Flight Lock (`market_fetch_locks`) + Rate Limit por usuário (`quote_refresh_rate_limits`).
--   7. RPC `commit_monthly_closing_system` para fechamento oficial autônomo na nuvem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Expansão Estrutural e Saneamento Multi-Tenant de `public.asset_prices`
-- -----------------------------------------------------------------------------
ALTER TABLE public.asset_prices
  ADD COLUMN IF NOT EXISTS market_price_at timestamptz,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS pending_spike_price numeric(18, 8),
  ADD COLUMN IF NOT EXISTS pending_spike_at timestamptz;

-- Preserva eventuais linhas de usuário que possuíam `manual_price > 0` antes de limpar caches por-usuário legados
UPDATE public.asset_prices
SET
  source = 'manual',
  price = manual_price,
  updated_at = coalesce(updated_at, now())
WHERE user_id IS NOT NULL
  AND source <> 'manual'
  AND manual_price IS NOT NULL
  AND manual_price > 0;

-- Substitui constraint única legada ANTES de normalizar tickers (evita 23505 em legados mistos)
ALTER TABLE public.asset_prices
  DROP CONSTRAINT IF EXISTS asset_prices_ticker_user_id_key;

-- Remove caches de API/fallback gravados por usuário e linhas globais com source inválido
DELETE FROM public.asset_prices
WHERE (user_id IS NOT NULL AND source <> 'manual')
   OR (user_id IS NULL AND source NOT IN ('api', 'fallback'));

-- Normaliza ticker e remove linhas sem ticker válido ou preço não positivo
UPDATE public.asset_prices
SET ticker = upper(trim(ticker))
WHERE ticker <> upper(trim(ticker));

DELETE FROM public.asset_prices
WHERE coalesce(trim(ticker), '') = ''
  OR price IS NULL
  OR price = 'NaN'::numeric
  OR price <= 0;

-- Deduplica linhas globais (`user_id IS NULL`), preservando API válida mais recente
WITH ranked_global AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY ticker
      ORDER BY
        CASE WHEN source = 'api' AND price > 0 THEN 1 ELSE 0 END DESC,
        coalesce(market_price_at, updated_at) DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.asset_prices
  WHERE user_id IS NULL
)
DELETE FROM public.asset_prices ap
USING ranked_global rg
WHERE ap.id = rg.id
  AND rg.rn > 1;

-- Deduplica overrides manuais por `(user_id, ticker)`, preservando o mais recente
WITH ranked_user AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, ticker
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.asset_prices
  WHERE user_id IS NOT NULL
)
DELETE FROM public.asset_prices ap
USING ranked_user ru
WHERE ap.id = ru.id
  AND ru.rn > 1;

-- Normaliza campos de metadados nos registros legados remanescentes
UPDATE public.asset_prices
SET
  manual_price = coalesce(manual_price, price)
WHERE user_id IS NOT NULL
  AND manual_price IS NULL;

UPDATE public.asset_prices
SET
  fetched_at = coalesce(fetched_at, updated_at, now()),
  market_price_at = coalesce(market_price_at, updated_at),
  provider = coalesce(provider, CASE WHEN source = 'api' THEN 'cache' ELSE 'fallback' END)
WHERE user_id IS NULL;

-- Índices únicos parciais por tenant
DROP INDEX IF EXISTS public.uq_asset_prices_global_ticker;
CREATE UNIQUE INDEX uq_asset_prices_global_ticker
  ON public.asset_prices (ticker)
  WHERE user_id IS NULL;

DROP INDEX IF EXISTS public.uq_asset_prices_user_manual_ticker;
CREATE UNIQUE INDEX uq_asset_prices_user_manual_ticker
  ON public.asset_prices (user_id, ticker)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_prices_ticker_updated
  ON public.asset_prices (ticker, updated_at DESC);

-- Garante invariante estrito de origem por tenant e preço estritamente positivo
ALTER TABLE public.asset_prices
  DROP CONSTRAINT IF EXISTS chk_asset_prices_tenant_source;
ALTER TABLE public.asset_prices
  ADD CONSTRAINT chk_asset_prices_tenant_source
  CHECK (
    (user_id IS NULL AND source IN ('api', 'fallback'))
    OR (user_id IS NOT NULL AND source = 'manual')
  );

ALTER TABLE public.asset_prices
  DROP CONSTRAINT IF EXISTS chk_asset_prices_positive_price;
ALTER TABLE public.asset_prices
  ADD CONSTRAINT chk_asset_prices_positive_price
  CHECK (price > 0);

-- Endurece RLS de `asset_prices`: `authenticated` só escreve seus próprios registros manuais
DROP POLICY IF EXISTS "asset_prices_select" ON public.asset_prices;
CREATE POLICY "asset_prices_select"
  ON public.asset_prices
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
    AND (SELECT public.is_current_user_active())
  );

DROP POLICY IF EXISTS "asset_prices_insert_own" ON public.asset_prices;
CREATE POLICY "asset_prices_insert_own"
  ON public.asset_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND source = 'manual'
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "asset_prices_update_own" ON public.asset_prices;
CREATE POLICY "asset_prices_update_own"
  ON public.asset_prices
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND source = 'manual'
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND source = 'manual'
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

DROP POLICY IF EXISTS "asset_prices_delete_own" ON public.asset_prices;
CREATE POLICY "asset_prices_delete_own"
  ON public.asset_prices
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND source = 'manual'
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_write_module('investments'))
  );

-- -----------------------------------------------------------------------------
-- 2. RPC `upsert_global_asset_prices` (service_role + trava Never-Degrade SQL)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_global_asset_prices(
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
  v_price numeric(18, 8);
  v_currency text;
  v_source text;
  v_market_price_at timestamptz;
  v_fetched_at timestamptz;
  v_provider text;
  v_pending_spike_price numeric(18, 8);
  v_pending_spike_at timestamptz;
  v_updated_at timestamptz;
  v_count integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: upsert global de cotações é exclusivo do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('success', true, 'processed', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
    v_price := NULLIF(trim(coalesce(v_item->>'price', '')), '')::numeric;
    v_currency := upper(trim(coalesce(v_item->>'currency', 'BRL')));
    v_source := lower(trim(coalesce(v_item->>'source', 'api')));
    v_provider := NULLIF(trim(coalesce(v_item->>'provider', '')), '');
    v_market_price_at := CASE
      WHEN nullif(trim(coalesce(v_item->>'market_price_at', '')), '') IS NOT NULL
      THEN (v_item->>'market_price_at')::timestamptz
      ELSE NULL
    END;
    v_fetched_at := CASE
      WHEN nullif(trim(coalesce(v_item->>'fetched_at', '')), '') IS NOT NULL
      THEN (v_item->>'fetched_at')::timestamptz
      ELSE now()
    END;
    v_pending_spike_price := CASE
      WHEN nullif(trim(coalesce(v_item->>'pending_spike_price', '')), '') IS NOT NULL
      THEN (v_item->>'pending_spike_price')::numeric
      ELSE NULL
    END;
    IF v_pending_spike_price = 'NaN'::numeric OR v_pending_spike_price <= 0 THEN
      v_pending_spike_price := NULL;
    END IF;
    v_pending_spike_at := CASE
      WHEN v_pending_spike_price IS NOT NULL AND nullif(trim(coalesce(v_item->>'pending_spike_at', '')), '') IS NOT NULL
      THEN (v_item->>'pending_spike_at')::timestamptz
      ELSE NULL
    END;
    v_updated_at := CASE
      WHEN nullif(trim(coalesce(v_item->>'updated_at', '')), '') IS NOT NULL
      THEN (v_item->>'updated_at')::timestamptz
      ELSE now()
    END;

    IF v_ticker = '' OR v_price IS NULL OR v_price = 'NaN'::numeric OR v_price <= 0 THEN
      CONTINUE;
    END IF;

    IF v_currency NOT IN ('BRL', 'USD') THEN
      v_currency := 'BRL';
    END IF;

    IF v_source NOT IN ('api', 'fallback') THEN
      v_source := 'api';
    END IF;

    INSERT INTO public.asset_prices (
      user_id,
      ticker,
      price,
      currency,
      source,
      manual_price,
      market_price_at,
      fetched_at,
      provider,
      pending_spike_price,
      pending_spike_at,
      updated_at
    ) VALUES (
      NULL,
      v_ticker,
      v_price,
      v_currency,
      v_source,
      NULL,
      v_market_price_at,
      v_fetched_at,
      v_provider,
      v_pending_spike_price,
      v_pending_spike_at,
      v_updated_at
    )
    ON CONFLICT (ticker) WHERE user_id IS NULL DO UPDATE
    SET
      price = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.price
        ELSE public.asset_prices.price
      END,
      currency = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.currency
        ELSE public.asset_prices.currency
      END,
      source = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.source
        ELSE public.asset_prices.source
      END,
      market_price_at = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN coalesce(EXCLUDED.market_price_at, public.asset_prices.market_price_at)
        ELSE public.asset_prices.market_price_at
      END,
      provider = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN coalesce(EXCLUDED.provider, public.asset_prices.provider)
        ELSE public.asset_prices.provider
      END,
      updated_at = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN greatest(public.asset_prices.updated_at, EXCLUDED.updated_at)
        ELSE public.asset_prices.updated_at
      END,
      fetched_at = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR EXCLUDED.pending_spike_price IS NOT NULL
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN greatest(coalesce(public.asset_prices.fetched_at, '-infinity'::timestamptz), coalesce(EXCLUDED.fetched_at, now()))
        ELSE public.asset_prices.fetched_at
      END,
      pending_spike_price = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR EXCLUDED.pending_spike_price IS NOT NULL
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.pending_spike_price
        ELSE public.asset_prices.pending_spike_price
      END,
      pending_spike_at = CASE
        WHEN (
          public.asset_prices.source <> 'api'
          OR public.asset_prices.price <= 0
          OR EXCLUDED.pending_spike_price IS NOT NULL
          OR (
            EXCLUDED.price > 0
            AND EXCLUDED.source = 'api'
            AND (
              public.asset_prices.market_price_at IS NULL
              OR (EXCLUDED.market_price_at IS NOT NULL AND EXCLUDED.market_price_at >= public.asset_prices.market_price_at)
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.asset_prices.provider, '') <> 'bcb_ptax'
                AND EXCLUDED.market_price_at IS NOT NULL
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.asset_prices.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.pending_spike_at
        ELSE public.asset_prices.pending_spike_at
      END;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_global_asset_prices(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_global_asset_prices(jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Atualização do `restore_backup` (snapshots históricos + backups legados)
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

  -- Habilita restauração de snapshots mensais históricos sob trg_portfolio_snapshot_immutability
  PERFORM set_config('app.snapshot_rpc', 'on', true);

  -- 1) Apaga os dados atuais do usuário
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

  -- 2) Insere tabelas pais
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

  -- 3) Insere filhos com validação estrita de posse
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

  INSERT INTO public.portfolio_dividends (id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, created_at)
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
    coalesce(pd.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.portfolio_dividends, coalesce(v_data -> 'portfolio_dividends', '[]'::jsonb)) pd
  LEFT JOIN public.portfolio_assets pa ON pa.id = pd.asset_id AND pa.user_id = v_uid;

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

  -- Restaura exclusivamente overrides manuais válidos (filtra linhas globais/legadas `source <> 'manual'` de backups antigos e deduplica por ticker)
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

-- -----------------------------------------------------------------------------
-- 4. Histórico Global de Cotações `public.market_price_history`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_price_history (
  ticker text NOT NULL,
  reference_date date NOT NULL,
  price numeric(18, 8) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  provider text,
  market_price_at timestamptz,
  month char(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  is_month_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, reference_date)
);

CREATE INDEX IF NOT EXISTS idx_market_price_history_month_eom
  ON public.market_price_history (month, is_month_end);

CREATE INDEX IF NOT EXISTS idx_market_price_history_ticker_month_date
  ON public.market_price_history (ticker, month DESC, reference_date DESC);

ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_price_history_select_authenticated" ON public.market_price_history;
CREATE POLICY "market_price_history_select_authenticated"
  ON public.market_price_history
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_read_module('investments'))
  );

CREATE OR REPLACE FUNCTION public.upsert_market_price_history(
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
  v_ref_date date;
  v_price numeric(18, 8);
  v_currency text;
  v_provider text;
  v_market_price_at timestamptz;
  v_month text;
  v_is_month_end boolean;
  v_count integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: escrita em market_price_history é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('success', true, 'processed', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
    v_ref_date := NULLIF(trim(coalesce(v_item->>'reference_date', '')), '')::date;
    v_price := NULLIF(trim(coalesce(v_item->>'price', '')), '')::numeric;
    v_currency := upper(trim(coalesce(v_item->>'currency', 'BRL')));
    v_provider := NULLIF(trim(coalesce(v_item->>'provider', '')), '');
    v_market_price_at := CASE
      WHEN nullif(trim(coalesce(v_item->>'market_price_at', '')), '') IS NOT NULL
      THEN (v_item->>'market_price_at')::timestamptz
      ELSE NULL
    END;
    v_month := coalesce(nullif(trim(coalesce(v_item->>'month', '')), ''), to_char(v_ref_date, 'YYYY-MM'));
    v_is_month_end := coalesce(NULLIF(trim(coalesce(v_item->>'is_month_end', '')), '')::boolean, false);

    IF v_ticker = '' OR v_ref_date IS NULL OR v_price IS NULL OR v_price = 'NaN'::numeric OR v_price <= 0 OR v_month !~ '^\d{4}-\d{2}$' THEN
      CONTINUE;
    END IF;

    IF v_currency NOT IN ('BRL', 'USD') THEN
      v_currency := 'BRL';
    END IF;

    INSERT INTO public.market_price_history (
      ticker,
      reference_date,
      price,
      currency,
      provider,
      market_price_at,
      month,
      is_month_end,
      updated_at
    ) VALUES (
      v_ticker,
      v_ref_date,
      v_price,
      v_currency,
      v_provider,
      v_market_price_at,
      v_month,
      v_is_month_end,
      now()
    )
    ON CONFLICT (ticker, reference_date) DO UPDATE
    SET
      price = CASE
        WHEN EXCLUDED.price > 0 AND (
          public.market_price_history.market_price_at IS NULL
          OR (
            EXCLUDED.market_price_at IS NOT NULL
            AND (
              EXCLUDED.market_price_at >= public.market_price_history.market_price_at
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.market_price_history.provider, '') <> 'bcb_ptax'
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.market_price_history.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.price
        ELSE public.market_price_history.price
      END,
      currency = CASE
        WHEN EXCLUDED.price > 0 AND (
          public.market_price_history.market_price_at IS NULL
          OR (
            EXCLUDED.market_price_at IS NOT NULL
            AND (
              EXCLUDED.market_price_at >= public.market_price_history.market_price_at
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.market_price_history.provider, '') <> 'bcb_ptax'
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.market_price_history.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN EXCLUDED.currency
        ELSE public.market_price_history.currency
      END,
      provider = CASE
        WHEN EXCLUDED.price > 0 AND (
          public.market_price_history.market_price_at IS NULL
          OR (
            EXCLUDED.market_price_at IS NOT NULL
            AND (
              EXCLUDED.market_price_at >= public.market_price_history.market_price_at
              OR (
                EXCLUDED.ticker = 'USDBRL=X'
                AND coalesce(EXCLUDED.provider, '') = 'bcb_ptax'
                AND coalesce(public.market_price_history.provider, '') <> 'bcb_ptax'
                AND (EXCLUDED.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date >= (public.market_price_history.market_price_at AT TIME ZONE 'America/Sao_Paulo')::date
              )
            )
          )
        )
        THEN coalesce(EXCLUDED.provider, public.market_price_history.provider)
        ELSE public.market_price_history.provider
      END,
      market_price_at = nullif(
        greatest(
          coalesce(public.market_price_history.market_price_at, '-infinity'::timestamptz),
          coalesce(EXCLUDED.market_price_at, '-infinity'::timestamptz)
        ),
        '-infinity'::timestamptz
      ),
      month = EXCLUDED.month,
      is_month_end = public.market_price_history.is_month_end OR EXCLUDED.is_month_end,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_market_price_history(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_market_price_history(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_old_eod_market_price_history(
  p_keep_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_deleted integer := 0;
  v_cutoff date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - greatest(30, coalesce(p_keep_days, 90));
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: rotina exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.market_price_history
  WHERE is_month_end = false
    AND reference_date < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_eod_market_price_history(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_eod_market_price_history(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Single-Flight Lock (`public.market_fetch_locks`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_fetch_locks (
  ticker text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  locked_by text NOT NULL DEFAULT 'quotes-edge',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_fetch_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_fetch_locks_admin_select" ON public.market_fetch_locks;
CREATE POLICY "market_fetch_locks_admin_select"
  ON public.market_fetch_locks
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

CREATE OR REPLACE FUNCTION public.try_acquire_quote_locks(
  p_tickers text[],
  p_ttl_seconds integer DEFAULT 45,
  p_owner text DEFAULT 'quotes-edge'
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_ttl integer := greatest(5, least(coalesce(p_ttl_seconds, 45), 300));
  v_owner text := coalesce(nullif(trim(p_owner), ''), 'quotes-edge');
  v_acquired text[];
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: locks de cotações são exclusivos do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.market_fetch_locks
  WHERE locked_until < now() - interval '5 minutes';

  WITH sorted_tickers AS (
    SELECT DISTINCT upper(trim(t)) AS ticker
    FROM unnest(coalesce(p_tickers, '{}'::text[])) AS t
    WHERE nullif(trim(t), '') IS NOT NULL
    ORDER BY 1
  ),
  acquired AS (
    INSERT INTO public.market_fetch_locks (ticker, locked_until, locked_by, updated_at)
    SELECT
      st.ticker,
      now() + make_interval(secs => v_ttl),
      v_owner,
      now()
    FROM sorted_tickers st
    ON CONFLICT (ticker) DO UPDATE
    SET
      locked_until = EXCLUDED.locked_until,
      locked_by = EXCLUDED.locked_by,
      updated_at = now()
    WHERE public.market_fetch_locks.locked_until <= now()
    RETURNING ticker
  )
  SELECT coalesce(array_agg(ticker ORDER BY ticker), '{}'::text[])
  INTO v_acquired
  FROM acquired;

  RETURN coalesce(v_acquired, '{}'::text[]);
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_quote_locks(text[], integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_quote_locks(text[], integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_quote_locks(
  p_tickers text[],
  p_owner text DEFAULT 'quotes-edge'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_owner text := nullif(trim(coalesce(p_owner, '')), '');
  v_deleted integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: liberação de locks de cotações é exclusiva do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tickers IS NULL OR cardinality(p_tickers) = 0 OR v_owner IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.market_fetch_locks
  WHERE locked_by = v_owner
    AND ticker = ANY (
      SELECT upper(trim(t))
      FROM unnest(p_tickers) AS t
      WHERE nullif(trim(t), '') IS NOT NULL
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.release_quote_locks(text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_quote_locks(text[], text) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Rate Limit por Usuário (`public.quote_refresh_rate_limits`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_refresh_rate_limits (
  user_id uuid NOT NULL,
  bucket_kind text NOT NULL CHECK (bucket_kind IN ('minute', 'hour')),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, bucket_kind, window_start)
);

ALTER TABLE public.quote_refresh_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_refresh_rate_limits_admin_select" ON public.quote_refresh_rate_limits;
CREATE POLICY "quote_refresh_rate_limits_admin_select"
  ON public.quote_refresh_rate_limits
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
  );

CREATE OR REPLACE FUNCTION public.check_quote_refresh_rate_limit(
  p_user_id uuid,
  p_max_per_min integer DEFAULT 10,
  p_max_per_hour integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_max_min integer := greatest(1, coalesce(p_max_per_min, 10));
  v_max_hour integer := greatest(1, coalesce(p_max_per_hour, 60));
  v_min_start timestamptz := date_trunc('minute', now());
  v_hour_start timestamptz := date_trunc('hour', now());
  v_min_hits integer := 0;
  v_hour_hits integer := 0;
  v_allowed boolean := false;
  v_retry_after integer := 0;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: rate limit é exclusivo do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'minute_hits', 0, 'hour_hits', 0, 'retry_after_seconds', 60);
  END IF;

  DELETE FROM public.quote_refresh_rate_limits
  WHERE window_start < (now() - interval '2 hours');

  INSERT INTO public.quote_refresh_rate_limits (user_id, bucket_kind, window_start, hits)
  VALUES (p_user_id, 'minute', v_min_start, 1)
  ON CONFLICT (user_id, bucket_kind, window_start) DO UPDATE
  SET hits = public.quote_refresh_rate_limits.hits + 1
  RETURNING hits INTO v_min_hits;

  IF v_min_hits > v_max_min THEN
    SELECT coalesce(hits, 0) INTO v_hour_hits
    FROM public.quote_refresh_rate_limits
    WHERE user_id = p_user_id AND bucket_kind = 'hour' AND window_start = v_hour_start;

    v_retry_after := greatest(1, ceil(extract(epoch FROM ((v_min_start + interval '1 minute') - now())))::integer);

    RETURN jsonb_build_object(
      'allowed', false,
      'minute_hits', v_min_hits,
      'hour_hits', coalesce(v_hour_hits, 0),
      'retry_after_seconds', v_retry_after
    );
  END IF;

  INSERT INTO public.quote_refresh_rate_limits (user_id, bucket_kind, window_start, hits)
  VALUES (p_user_id, 'hour', v_hour_start, 1)
  ON CONFLICT (user_id, bucket_kind, window_start) DO UPDATE
  SET hits = public.quote_refresh_rate_limits.hits + 1
  RETURNING hits INTO v_hour_hits;

  v_allowed := v_hour_hits <= v_max_hour;

  IF NOT v_allowed THEN
    v_retry_after := greatest(1, ceil(extract(epoch FROM ((v_hour_start + interval '1 hour') - now())))::integer);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'minute_hits', v_min_hits,
    'hour_hits', v_hour_hits,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_quote_refresh_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_quote_refresh_rate_limit(uuid, integer, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. RPC `commit_monthly_closing_system` (Fechamento Oficial EOM na Nuvem)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_monthly_closing_system(
  p_user_id uuid,
  p_month text,
  p_closing_date date,
  p_prices jsonb,
  p_total_value numeric DEFAULT NULL,
  p_total_cost numeric DEFAULT NULL
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
  v_price numeric(18, 8);
  v_currency text;
  v_source text;
  v_prices_count integer := 0;
  v_existing record;
  v_snapshot_closed boolean := false;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: fechamento sistêmico é exclusivo do serviço interno.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_month IS NULL OR p_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida (esperado YYYY-MM).' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.snapshot_rpc', 'on', true);

  -- Hidrata `portfolio_monthly_prices` preservando overrides manuais do usuário
  IF p_prices IS NOT NULL AND jsonb_typeof(p_prices) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_prices)
    LOOP
      v_ticker := upper(trim(coalesce(v_item->>'ticker', '')));
      v_price := NULLIF(trim(coalesce(v_item->>'price', '')), '')::numeric;
      v_currency := upper(trim(coalesce(v_item->>'currency', 'BRL')));
      v_source := lower(trim(coalesce(v_item->>'source', 'api')));

      IF v_ticker = '' OR v_price IS NULL OR v_price = 'NaN'::numeric OR v_price <= 0 THEN
        CONTINUE;
      END IF;

      IF v_currency NOT IN ('BRL', 'USD') THEN
        v_currency := 'BRL';
      END IF;

      IF v_source NOT IN ('api', 'fallback') THEN
        v_source := 'api';
      END IF;

      INSERT INTO public.portfolio_monthly_prices (
        user_id,
        ticker,
        month,
        price,
        currency,
        source,
        updated_at
      ) VALUES (
        p_user_id,
        v_ticker,
        p_month,
        v_price,
        v_currency,
        v_source,
        now()
      )
      ON CONFLICT (user_id, ticker, month) DO UPDATE
      SET
        price = excluded.price,
        currency = excluded.currency,
        source = excluded.source,
        updated_at = now()
      WHERE public.portfolio_monthly_prices.source <> 'manual';

      v_prices_count := v_prices_count + 1;
    END LOOP;
  END IF;

  -- Fecha o snapshot diretamente apenas quando os totais oficiais foram informados
  -- e o snapshot ainda não estiver fechado (`status <> 'closed'`)
  IF p_total_value IS NOT NULL
     AND p_total_cost IS NOT NULL
     AND p_total_value <> 'NaN'::numeric
     AND p_total_cost <> 'NaN'::numeric
     AND p_total_value >= 0
     AND p_total_cost >= 0 THEN
    INSERT INTO public.portfolio_snapshots (
      user_id,
      month,
      total_value,
      total_cost,
      auto_total_value,
      auto_total_cost,
      is_manually_calibrated,
      status,
      closing_date,
      closed_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_month,
      p_total_value,
      p_total_cost,
      p_total_value,
      p_total_cost,
      false,
      'closed',
      p_closing_date,
      now(),
      now()
    )
    ON CONFLICT (user_id, month) DO UPDATE
    SET
      auto_total_value = EXCLUDED.auto_total_value,
      auto_total_cost = EXCLUDED.auto_total_cost,
      total_value = CASE
        WHEN public.portfolio_snapshots.is_manually_calibrated
        THEN coalesce(public.portfolio_snapshots.manual_total_value, public.portfolio_snapshots.total_value, EXCLUDED.total_value)
        ELSE EXCLUDED.total_value
      END,
      total_cost = CASE
        WHEN public.portfolio_snapshots.is_manually_calibrated
        THEN coalesce(public.portfolio_snapshots.manual_total_cost, public.portfolio_snapshots.total_cost, EXCLUDED.total_cost)
        ELSE EXCLUDED.total_cost
      END,
      status = 'closed',
      closing_date = coalesce(p_closing_date, public.portfolio_snapshots.closing_date),
      closed_at = coalesce(public.portfolio_snapshots.closed_at, now()),
      updated_at = now()
    WHERE public.portfolio_snapshots.status <> 'closed';

    v_snapshot_closed := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'month', p_month,
    'prices_count', v_prices_count,
    'snapshot_closed', v_snapshot_closed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_monthly_closing_system(uuid, text, date, jsonb, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_monthly_closing_system(uuid, text, date, jsonb, numeric, numeric) TO service_role;

-- -----------------------------------------------------------------------------
-- 8. RPC Atômica `set_manual_asset_price` (`authenticated`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_manual_asset_price(
  p_ticker text,
  p_price numeric,
  p_currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticker text := upper(trim(coalesce(p_ticker, '')));
  v_currency text;
  v_now timestamptz := now();
  v_row public.asset_prices%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() OR NOT public.can_current_user_write_module('investments') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de investimentos.' USING ERRCODE = '42501';
  END IF;

  IF v_ticker = '' THEN
    RAISE EXCEPTION 'Ticker inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_price IS NULL OR p_price = 'NaN'::numeric OR p_price <= 0 THEN
    RAISE EXCEPTION 'Preço manual deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;

  v_currency := upper(trim(coalesce(p_currency, '')));
  IF v_currency NOT IN ('BRL', 'USD') THEN
    SELECT ap.currency INTO v_currency
    FROM public.asset_prices ap
    WHERE ap.user_id IS NULL
      AND ap.ticker = v_ticker
    LIMIT 1;
    v_currency := CASE WHEN upper(trim(coalesce(v_currency, 'BRL'))) = 'USD' THEN 'USD' ELSE 'BRL' END;
  END IF;

  INSERT INTO public.asset_prices (
    user_id,
    ticker,
    price,
    currency,
    source,
    manual_price,
    provider,
    market_price_at,
    updated_at
  ) VALUES (
    v_uid,
    v_ticker,
    p_price,
    v_currency,
    'manual',
    p_price,
    'manual',
    v_now,
    v_now
  )
  ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE
  SET
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    source = 'manual',
    manual_price = EXCLUDED.manual_price,
    provider = 'manual',
    market_price_at = EXCLUDED.market_price_at,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.set_manual_asset_price(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_asset_price(text, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
