-- ---------------------------------------------------------------------------
-- 20260101000092_drop_affiliates_and_quick_tokens.sql
-- Erradicação de módulos não solicitados e fora do escopo canônico do produto:
-- 1. Remoção do programa de afiliados e atribuições de indicação B2B2C
-- 2. Remoção do módulo de tokens de atalhos rápidos iOS e webhooks externos
-- ---------------------------------------------------------------------------

-- 1. Remoção de RPCs e tabelas de Atalhos Rápidos (Quick Tokens)
drop function if exists public.create_user_quick_token(text, text, text, text[]);
drop function if exists public.create_user_quick_token(text, text, text);
drop function if exists public.revoke_user_quick_token(uuid);
drop function if exists public.list_user_quick_tokens();

drop table if exists public.user_quick_tokens cascade;

-- 2. Remoção de RPCs e tabelas de Parceiros Afiliados e Indicações
drop function if exists public.get_or_create_affiliate_partner(text, text);
drop function if exists public.get_or_create_affiliate_partner();
drop function if exists public.update_affiliate_pix(text, text);
drop function if exists public.attribute_referral(text);
drop function if exists public.get_affiliate_dashboard_data();

drop table if exists public.referral_attributions cascade;
drop table if exists public.affiliate_partners cascade;
