-- ============================================================================
-- Migration 20260101000113: theme schedule e preferências de modo escuro
-- ============================================================================
-- Atualiza a restrição de verificação em public.user_preferences.theme para
-- permitir o novo modo 'schedule' (programação por horário do dia).

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check
  check (theme in ('light', 'dark', 'oled', 'system', 'schedule'));
