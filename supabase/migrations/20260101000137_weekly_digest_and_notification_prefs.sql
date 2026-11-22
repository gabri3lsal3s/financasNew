-- Migration 0137: Preferência explícita de resumo semanal dominical (opt-in, padrão false)
-- Parte da Fase 4 da Auditoria e Reorganização do Sistema de Notificações (Decisão D-N4).

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS weekly_digest_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_preferences.weekly_digest_enabled IS
  'Ativa o recebimento do resumo financeiro dominical por e-mail via Resend (opt-in explícito, padrão false).';

CREATE INDEX IF NOT EXISTS idx_user_preferences_weekly_digest_enabled
  ON public.user_preferences (user_id)
  WHERE weekly_digest_enabled = true;
