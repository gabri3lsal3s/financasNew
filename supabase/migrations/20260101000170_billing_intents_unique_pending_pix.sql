-- ============================================================================
-- Migration: 20260101000170_billing_intents_unique_pending_pix.sql
-- Descrição: Garante unicidade de no máximo 1 cobrança PIX avulsa pendente por
--            usuário em public.billing_intents e índice parcial para limpeza
--            automática de cobranças PIX expiradas no cron.
-- ============================================================================

-- 1. Deduplicação segura de eventuais intents PIX pendentes anteriores,
--    preservando apenas a mais recente de cada usuário.
WITH ranked_pending_pix AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.billing_intents
  WHERE method = 'pix' AND status = 'pending'
)
UPDATE public.billing_intents AS bi
SET
  status = 'canceled',
  updated_at = NOW(),
  metadata = COALESCE(bi.metadata, '{}'::jsonb) || jsonb_build_object('superseded_by_migration', '0170')
FROM ranked_pending_pix AS r
WHERE bi.id = r.id
  AND r.rn > 1;

-- 2. Unicidade: no máximo 1 cobrança PIX avulsa em status 'pending' por usuário.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_intents_one_pending_pix_per_user
  ON public.billing_intents (user_id)
  WHERE method = 'pix' AND status = 'pending';

-- 3. Índice parcial de higiene para expiração automática no billing-lifecycle-cron.
CREATE INDEX IF NOT EXISTS idx_billing_intents_pending_pix_cleanup
  ON public.billing_intents (expires_at, created_at)
  WHERE method = 'pix' AND status = 'pending';
