-- =============================================================================
-- Migration 0145: Infraestrutura de Micro-IA Híbrida (FinOps, Cotas & Cache LGPD)
-- =============================================================================
-- Fase D do Plano Mestre (`planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md`):
--   1. `public.user_ai_quotas`: contabilidade de cotas em 2 baldes independentes
--      (`receipt_calls` e `batch_calls`) com `FORCE ROW LEVEL SECURITY` e escrita
--      restrita a `service_role`.
--   2. `public.receipt_extractions_cache`: cache estruturado por `(user_id, sha256, mode)`
--      em estrita conformidade LGPD (jamais armazena imagem nem texto bruto), com
--      `FORCE ROW LEVEL SECURITY`.
--   3. RPC atômica `public.increment_user_ai_quota_atomic` com reset conjunto de ambos
--      os contadores diários ao virar `period_day` (BRT America/Sao_Paulo).
--   4. Registro da feature flag global `ai_extraction` em `public.system_features`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de Cotas por Usuário (`public.user_ai_quotas`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_ai_quotas (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  period_month text NOT NULL CHECK (period_month ~ '^\d{4}-\d{2}$'),
  period_day text NOT NULL CHECK (period_day ~ '^\d{4}-\d{2}-\d{2}$'),
  receipt_calls_month integer NOT NULL DEFAULT 0 CHECK (receipt_calls_month >= 0),
  receipt_calls_day integer NOT NULL DEFAULT 0 CHECK (receipt_calls_day >= 0),
  batch_calls_month integer NOT NULL DEFAULT 0 CHECK (batch_calls_month >= 0),
  batch_calls_day integer NOT NULL DEFAULT 0 CHECK (batch_calls_day >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_month)
);

ALTER TABLE public.user_ai_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_quotas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own AI quotas" ON public.user_ai_quotas;
CREATE POLICY "Users read own AI quotas"
  ON public.user_ai_quotas
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_ai_quotas FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_ai_quotas FROM authenticated;
GRANT SELECT ON TABLE public.user_ai_quotas TO authenticated;
GRANT ALL ON TABLE public.user_ai_quotas TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Cache Estruturado LGPD (`public.receipt_extractions_cache`)
--    Regra: guarda apenas `(user_id, sha256, mode, extracted_json, created_at)`
--    Jamais persiste imagem, base64 ou texto bruto de comprovante/fatura.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_extractions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mode text NOT NULL CHECK (mode IN ('single_receipt', 'statement_pdf_rows', 'categorize_batch')),
  extracted_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sha256, mode)
);

CREATE INDEX IF NOT EXISTS idx_receipt_extractions_cache_created_at
  ON public.receipt_extractions_cache (created_at);

ALTER TABLE public.receipt_extractions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_extractions_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own extraction cache" ON public.receipt_extractions_cache;
CREATE POLICY "Users read own extraction cache"
  ON public.receipt_extractions_cache
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own extraction cache" ON public.receipt_extractions_cache;
CREATE POLICY "Users delete own extraction cache"
  ON public.receipt_extractions_cache
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.receipt_extractions_cache FROM PUBLIC, anon;
REVOKE INSERT, UPDATE ON TABLE public.receipt_extractions_cache FROM authenticated;
GRANT SELECT, DELETE ON TABLE public.receipt_extractions_cache TO authenticated;
GRANT ALL ON TABLE public.receipt_extractions_cache TO service_role;

-- -----------------------------------------------------------------------------
-- 3. RPC Atômica de Incremento Pós-Validação (`increment_user_ai_quota_atomic`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_user_ai_quota_atomic(
  p_user_id uuid,
  p_bucket text,
  p_period_month text,
  p_period_day text
)
RETURNS public.user_ai_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_role text := coalesce(auth.role(), '');
  v_row public.user_ai_quotas;
BEGIN
  IF NOT (
    v_auth_role = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') AND v_auth_role NOT IN ('authenticated', 'anon'))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: incremento de cota de IA é exclusivo do backend.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  IF p_bucket NOT IN ('receipt_calls', 'batch_calls') THEN
    RAISE EXCEPTION 'Balde de cota inválido: %', coalesce(p_bucket, '<null>')
      USING ERRCODE = '22023';
  END IF;

  IF p_period_month IS NULL OR p_period_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'p_period_month inválido (esperado YYYY-MM).'
      USING ERRCODE = '22023';
  END IF;

  IF p_period_day IS NULL OR p_period_day !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'p_period_day inválido (esperado YYYY-MM-DD).'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_ai_quotas (
    user_id,
    period_month,
    period_day,
    receipt_calls_month,
    receipt_calls_day,
    batch_calls_month,
    batch_calls_day,
    updated_at
  )
  VALUES (
    p_user_id,
    p_period_month,
    p_period_day,
    CASE WHEN p_bucket = 'receipt_calls' THEN 1 ELSE 0 END,
    CASE WHEN p_bucket = 'receipt_calls' THEN 1 ELSE 0 END,
    CASE WHEN p_bucket = 'batch_calls' THEN 1 ELSE 0 END,
    CASE WHEN p_bucket = 'batch_calls' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, period_month) DO UPDATE SET
    receipt_calls_month = public.user_ai_quotas.receipt_calls_month
      + CASE WHEN p_bucket = 'receipt_calls' THEN 1 ELSE 0 END,
    batch_calls_month = public.user_ai_quotas.batch_calls_month
      + CASE WHEN p_bucket = 'batch_calls' THEN 1 ELSE 0 END,
    receipt_calls_day = CASE
      WHEN public.user_ai_quotas.period_day <> p_period_day THEN
        CASE WHEN p_bucket = 'receipt_calls' THEN 1 ELSE 0 END
      ELSE
        public.user_ai_quotas.receipt_calls_day
        + CASE WHEN p_bucket = 'receipt_calls' THEN 1 ELSE 0 END
    END,
    batch_calls_day = CASE
      WHEN public.user_ai_quotas.period_day <> p_period_day THEN
        CASE WHEN p_bucket = 'batch_calls' THEN 1 ELSE 0 END
      ELSE
        public.user_ai_quotas.batch_calls_day
        + CASE WHEN p_bucket = 'batch_calls' THEN 1 ELSE 0 END
    END,
    period_day = p_period_day,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_ai_quota_atomic(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_ai_quota_atomic(uuid, text, text, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Catálogo de Feature Flag Global (`ai_extraction`)
-- -----------------------------------------------------------------------------
INSERT INTO public.system_features (
  key,
  name,
  description,
  is_globally_enabled,
  default_enabled_for_new_users
)
VALUES (
  'ai_extraction',
  'Leitura Assistida por Micro-IA (Comprovantes & Faturas)',
  'Camada opcional de fallback com IA leve para comprovantes difíceis, PDFs desalinhados e categorização em lote com cotas FinOps e cache LGPD.',
  true,
  true
)
ON CONFLICT (key) DO UPDATE
SET name = excluded.name,
    description = excluded.description;

COMMENT ON TABLE public.user_ai_quotas IS
  'Contadores FinOps em 2 baldes (receipt_calls e batch_calls) por usuario e mes (reset diario 00:00 BRT). Escrita exclusiva service_role.';

COMMENT ON TABLE public.receipt_extractions_cache IS
  'Cache LGPD por (user_id, sha256, mode): armazena exclusivamente JSON estruturado; nunca persiste imagem, base64 ou texto bruto.';
