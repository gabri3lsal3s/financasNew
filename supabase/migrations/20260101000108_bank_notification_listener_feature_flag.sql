-- ================================================================
-- 00108_bank_notification_listener_feature_flag.sql
-- Catálogo de Feature Flags: Registro do Assistente de Notificações Bancárias (Beta)
--
-- Permite ao SuperAdmin restringir a funcionalidade de leitura passiva de
-- notificações bancárias no Android nativo apenas a beta-testers autorizados,
-- mantendo o APK aberto, seguro e sem alertas intrusivos de permissão do SO.
-- ================================================================

insert into public.system_features (key, name, description, is_globally_enabled, default_enabled_for_new_users)
values (
  'bank_notification_listener',
  'Assistente de Notificações Bancárias (Beta)',
  'Captura passiva em segundo plano de notificações de compras de cartões e Pix no Android nativo.',
  true,
  false -- Desativado por padrão para novos usuários (requer liberação pelo SuperAdmin)
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;
