-- ----------------------------------------------------------------
-- Migration: 20260101000109_plans_compatibility_and_aliases.sql
-- Objetivo: Garantir compatibilidade total na tabela public.plans
--           e evitar quebras de chave estrangeira ao vincular assinaturas.
-- ----------------------------------------------------------------

insert into public.plans (id, name, description, price_cents, billing_interval, is_publicly_available)
values
  ('trial', 'Teste Pro (30 dias)', 'Acesso irrestrito a todas as ferramentas por 30 dias.', 0, null, false),
  ('pro_monthly', 'Plano Pro Mensal', 'Assinatura recorrente mensal com acesso completo.', 1990, 'month', true),
  ('pro_annual', 'Plano Pro Anual', 'Assinatura anual com 25% de desconto.', 17880, 'year', true),
  ('lifetime', 'Plano Vitalício VIP', 'Acesso completo permanente sem expiração.', 0, null, false),
  ('free', 'Plano Gratuito / Trial', 'Acesso degustação gratuito padrão.', 0, null, false),
  ('lifetime_vip', 'Plano Vitalício VIP', 'Acesso permanente irrestrito.', 0, null, false)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    billing_interval = excluded.billing_interval,
    is_publicly_available = excluded.is_publicly_available;
