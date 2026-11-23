#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador do Relatório Executivo e Técnico de Auditoria de Segurança — Axir (FinançasNew)
Salva o PDF final em: docs/security-audit/relatorio-auditoria-seguranca.pdf

Uso (ambiente isolado .venv):
    .venv/bin/python docs/security-audit/generate_report.py
"""

from __future__ import annotations

import io
import os
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from xml.sax.saxutils import escape

# ---------------------------------------------------------------------------
# Paleta Oficial Solicitada na Auditoria
# ---------------------------------------------------------------------------
HEX_CRITICAL = "#B91C1C"
HEX_HIGH = "#EA580C"
HEX_MEDIUM = "#D97706"
HEX_LOW = "#2563EB"
HEX_STRENGTH = "#059669"

HEX_PRIMARY = "#0F172A"
HEX_SECONDARY = "#1E293B"
HEX_MUTED = "#475569"
HEX_LIGHT_BG = "#F8FAFC"
HEX_BORDER = "#CBD5E1"
HEX_ACCENT_TEAL = "#134E48"

COLOR_CRITICAL = colors.HexColor(HEX_CRITICAL)
COLOR_HIGH = colors.HexColor(HEX_HIGH)
COLOR_MEDIUM = colors.HexColor(HEX_MEDIUM)
COLOR_LOW = colors.HexColor(HEX_LOW)
COLOR_STRENGTH = colors.HexColor(HEX_STRENGTH)

COLOR_PRIMARY = colors.HexColor(HEX_PRIMARY)
COLOR_SECONDARY = colors.HexColor(HEX_SECONDARY)
COLOR_MUTED = colors.HexColor(HEX_MUTED)
COLOR_LIGHT_BG = colors.HexColor(HEX_LIGHT_BG)
COLOR_BORDER = colors.HexColor(HEX_BORDER)
COLOR_ACCENT_TEAL = colors.HexColor(HEX_ACCENT_TEAL)

SEVERITY_COLORS = {
    "CRÍTICA": COLOR_CRITICAL,
    "ALTA": COLOR_HIGH,
    "MÉDIA": COLOR_MEDIUM,
    "BAIXA": COLOR_LOW,
    "PONTO FORTE": COLOR_STRENGTH,
}

SEVERITY_HEX = {
    "CRÍTICA": HEX_CRITICAL,
    "ALTA": HEX_HIGH,
    "MÉDIA": HEX_MEDIUM,
    "BAIXA": HEX_LOW,
    "PONTO FORTE": HEX_STRENGTH,
}

REPORT_TITLE = "Relatório de Auditoria de Segurança — Axir (FinançasNew)"
REPORT_DATE = "22/11/2026"
PROJECT_VERSION = "v3.15.0"


# ---------------------------------------------------------------------------
# Dados Estruturados dos Achados Verificados
# ---------------------------------------------------------------------------
FINDINGS = [
    # Categoria 1: Banco Sem Tranca (Isolamento de Inquilino/Dono)
    {
        "id": "F-01",
        "category_num": 1,
        "category": "1. Banco Sem Tranca (RLS)",
        "severity": "CRÍTICA",
        "file_line": (
            "supabase/migrations/20260101000076_create_families_and_multi_account_collaboration.sql:231-240\n"
            "supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:562-598"
        ),
        "title": "Vazamento global, criação cruzada e adulteração de convites em public.family_invites",
        "description": (
            "A policy family_invites_select inclui a cláusula OR (status = 'pending' AND expires_at > now() "
            "AND (select auth.uid()) IS NOT NULL), permitindo a qualquer usuário autenticado listar todos os "
            "convites pendentes de todas as famílias do banco (expondo token secreto, family_id e invited_email). "
            "Na migração 0128, family_invites_insert usa ((SELECT auth.uid()) IS NOT NULL OR is_family_admin(...)), "
            "uma tautologia que permite a qualquer usuário autenticado criar convites (inclusive role='admin') "
            "para qualquer family_id alheia; e family_invites_update permite alterar qualquer convite pendente."
        ),
    },
    {
        "id": "F-02",
        "category_num": 1,
        "category": "1. Banco Sem Tranca (RLS)",
        "severity": "CRÍTICA",
        "file_line": (
            "supabase/migrations/20260101000076_create_families_and_multi_account_collaboration.sql:196-217\n"
            "supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:696-713"
        ),
        "title": "Auto-inserção arbitrária em famílias e viagens alheias (family_members e trip_members)",
        "description": (
            "A policy family_members_insert exige apenas WITH CHECK ((select auth.uid()) = user_id OR is_family_admin(...)), "
            "permitindo que qualquer usuário autenticado faça INSERT direto via PostgREST em qualquer family_id "
            "com role='owner' sem convite. A policy family_members_update permite que o próprio membro altere sua "
            "coluna role para 'owner'/'admin'. Analogamente, trip_members_write_policy (FOR ALL) permite "
            "WITH CHECK (user_id = auth.uid() OR is_trip_host(...)), possibilitando auto-inclusão como host (is_host=true) "
            "em qualquer trip_id e acesso integral às despesas e acertos da viagem."
        ),
    },
    {
        "id": "F-03",
        "category_num": 1,
        "category": "1. Banco Sem Tranca (RLS)",
        "severity": "MÉDIA",
        "file_line": "supabase/migrations/20260101000084_expand_family_modes_and_wealth_integration.sql:78-92",
        "title": "Vazamento de média de receitas pessoais privadas na RPC get_family_income_ratio_suggestion",
        "description": (
            "Diferente de get_family_consolidation (migração 0077:92-99), que filtra i.family_id = v_family_id "
            "AND i.is_family = true, a função SECURITY DEFINER get_family_income_ratio_suggestion faz LEFT JOIN "
            "public.incomes i ON i.user_id = fm.user_id sem filtrar i.is_family = true, expondo a média de todas "
            "as receitas pessoais privadas (average_monthly_income_cents) dos membros da família."
        ),
    },

    # Categoria 2: Permissão Definida no Navegador
    {
        "id": "F-04",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "CRÍTICA",
        "file_line": (
            "supabase/migrations/20260101000028_access_control_and_feature_flags.sql:158-200\n"
            "supabase/migrations/20260101000050_rls_subplan_caching_performance.sql:31-42"
        ),
        "title": "Bypass total do trigger protect_profile_security_fields() permite auto-promoção a superadmin",
        "description": (
            "A função de trigger protect_profile_security_fields() é declarada como SECURITY DEFINER (linha 161) "
            "e possui no início (linha 168): IF v_uid IS NULL OR current_user IN ('postgres', 'supabase_admin') "
            "OR coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF. No PostgreSQL, dentro de uma "
            "função SECURITY DEFINER, current_user é sempre o dono da função (postgres/supabase_admin). Assim, a "
            "condição avalia sempre para TRUE e retorna NEW na linha 169 sem executar as travas is_admin()/is_superadmin(). "
            "Além disso, o trigger só dispara BEFORE UPDATE (linha 198), não cobrindo INSERT (profiles_insert_own). "
            "Qualquer usuário autenticado pode enviar PATCH /rest/v1/profiles?id=eq.<uid> com role='superadmin' e status='active'."
        ),
    },
    {
        "id": "F-05",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "ALTA",
        "file_line": (
            "supabase/migrations/20260101000138_harden_notifications_broadcasts_and_lifecycle.sql:391-407\n"
            "supabase/migrations/20260101000129_harden_reconcile_and_cleanup_security.sql:82"
        ),
        "title": "Checagem current_user em SECURITY DEFINER anula trava admin de reconcile_expired_subscriptions()",
        "description": (
            "A RPC reconcile_expired_subscriptions() é SECURITY DEFINER (linha 394), possui GRANT EXECUTE TO authenticated "
            "(migração 0129:82) e valida: IF NOT (public.is_admin() OR auth.role() = 'service_role' OR "
            "current_user IN ('postgres', 'supabase_admin')). Como current_user dentro de SECURITY DEFINER é "
            "'postgres', a autorização é sempre satisfeita para qualquer usuário comum autenticado."
        ),
    },
    {
        "id": "F-06",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "ALTA",
        "file_line": (
            "supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:818-888\n"
            "supabase/migrations/20260101000028_access_control_and_feature_flags.sql:493-557\n"
            "src/features/admin/components/user-edit-dialog.tsx:89-92,184-194"
        ),
        "title": "Bypass de travas exclusivas de Superadmin e auditoria via escrita direta em tabelas RLS",
        "description": (
            "A UI (user-edit-dialog.tsx) e as RPCs (admin_toggle_global_feature, admin_set_user_subscription, "
            "admin_set_user_module_permission em 0128:1744-1965) restringem Kill-Switches globais e a edição de contas "
            "superadmin exclusivamente a superadmins. Porém, as tabelas system_features, user_feature_overrides, "
            "user_module_permissions e user_subscriptions possuem policies RLS FOR ALL USING ((select public.is_admin())) "
            "e GRANT INSERT, UPDATE, DELETE TO authenticated. Um admin comum pode alterar diretamente essas tabelas "
            "via PostgREST sem passar pelas RPCs, burlando o bloqueio de superadmin e omitindo logs em audit_events."
        ),
    },
    {
        "id": "F-07",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "MÉDIA",
        "file_line": (
            "supabase/migrations/20260101000094_create_trips_and_shared_ledger.sql:410-515\n"
            "supabase/migrations/20260101000095_fix_trips_rls_recursion_and_add_create_trip_rpc.sql:170-274\n"
            "supabase/migrations/20260101000036_security_remediation_and_hardening.sql:747-825"
        ),
        "title": "Sobrecargas SQL órfãs (add_public_trip_expense, create_trip, refinance_credit_card_bill)",
        "description": (
            "Três funções tiveram novas assinaturas criadas em migrações posteriores sem DROP FUNCTION da assinatura antiga: "
            "(1) add_public_trip_expense de 10 argumentos (0094:410) continua executável por anon sem exigir p_passcode; "
            "(2) create_trip de 7 argumentos (0095:170) não valida is_current_user_active() nem can_current_user_write_module('transactions'); "
            "(3) refinance_credit_card_bill de 5 argumentos (0036:747, chamada por src/data/rpc/cards.ts:86) não valida "
            "can_current_user_write_module('cards'), permitindo escrita em modo read_only."
        ),
    },
    {
        "id": "F-08",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "MÉDIA",
        "file_line": (
            "supabase/migrations/20260101000060_support_tickets.sql:47-60,100\n"
            "src/data/repositories/support-tickets.ts:105-121"
        ),
        "title": "Exposição de admin_notes e edição de campos administrativos pelo usuário em support_tickets",
        "description": (
            "A tabela public.support_tickets concede SELECT e UPDATE irrestritos em todas as colunas ao dono do chamado "
            "(USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)) e listMySupportTickets executa .select('*'). "
            "O usuário comum pode ler notas administrativas internas (admin_notes) e atualizar status, admin_reply e admin_id."
        ),
    },
    {
        "id": "F-09",
        "category_num": 2,
        "category": "2. Permissão no Navegador",
        "severity": "MÉDIA",
        "file_line": (
            "src/components/routing/require-admin-session.tsx:10-26\n"
            "supabase/functions/admin-super-action/index.ts:37-68\n"
            "src/components/modules/apk-beta-restricted-modal.tsx:12-28"
        ),
        "title": "Ausência de exigência de MFA (aal2) no painel/API Admin e restrição Beta APK apenas no cliente",
        "description": (
            "RequireAdminSession (linhas 10-26) não verifica mfaRequired && !mfaVerified (ao contrário de RequireAuth:107 "
            "e RequireActiveAccount:22), e a Edge Function admin-super-action não valida o nível AAL2 do JWT quando o "
            "superadmin possui fator TOTP ativo. Adicionalmente, o bloqueio de beta Android (ApkBetaRestrictedModal) "
            "ocorre apenas como modal sobreposto no cliente, enquanto AppDownloadModal:127 expõe o download direto do APK."
        ),
    },

    # Categoria 3: IDOR
    {
        "id": "F-10",
        "category_num": 3,
        "category": "3. IDOR",
        "severity": "ALTA",
        "file_line": "supabase/migrations/20260101000078_create_family_management_rpcs.sql:243-352",
        "title": "RPC accept_family_invite não valida correspondência com invited_email nem limite de membros",
        "description": (
            "Embora invite_family_member exija e armazene invited_email (linha 170), a RPC SECURITY DEFINER "
            "accept_family_invite(p_token) (linhas 281-306) busca o convite apenas pelo token e insere auth.uid() "
            "em family_members sem verificar se o e-mail do usuário autenticado corresponde a v_invite.invited_email, "
            "além de não validar o teto de 6 membros da família."
        ),
    },
    {
        "id": "F-11",
        "category_num": 3,
        "category": "3. IDOR",
        "severity": "MÉDIA",
        "file_line": (
            "supabase/migrations/20260101000087_portfolio_monthly_closing_and_corporate_dividends.sql:258-296\n"
            "supabase/migrations/20260101000127_unify_scoring_governance_and_sector_scope.sql:870-896\n"
            "supabase/migrations/20260101000099_harden_security_and_lgpd_cascade.sql:337-376\n"
            "supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:1653-1666"
        ),
        "title": "Referência cruzada de IDs (asset_id, expense_id, member_id) em 4 RPCs SECURITY DEFINER",
        "description": (
            "(1) approve_dividends_batch_atomic (0087:274) aceita v_item->>'asset_id' sem validar que o ativo pertence a v_user_id; "
            "(2) restore_backup (0127:893) vincula d.expense_id em public.debts sem validar posse do expense_id por v_uid; "
            "(3) add_public_trip_expense (0099:337-376) não valida que p_created_by_member_id e x.member_id pertencem a v_trip.id "
            "nem impede share_cents negativos; (4) record_trip_settlements (0128:1653) não valida que from_member_id e to_member_id "
            "pertencem a p_trip_id."
        ),
    },
    {
        "id": "F-12",
        "category_num": 3,
        "category": "3. IDOR",
        "severity": "BAIXA",
        "file_line": (
            "supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:285-393\n"
            "supabase/migrations/20260101000076_create_families_and_multi_account_collaboration.sql:102-131\n"
            "supabase/migrations/20260101000095_fix_trips_rls_recursion_and_add_create_trip_rpc.sql:9-55"
        ),
        "title": "Oráculo de enumeração cross-user em funções auxiliares SECURITY DEFINER com p_user_id arbitrário",
        "description": (
            "As funções SECURITY DEFINER get_user_module_access(p_user_id, p_module_key), is_family_member(p_family_id, p_user_id), "
            "is_family_admin(p_family_id, p_user_id), is_trip_member(p_trip_id, p_user_id) e is_trip_host(p_trip_id, p_user_id) "
            "são executáveis por qualquer usuário autenticado e não restringem p_user_id = auth.uid() OR public.is_admin(), "
            "permitindo sondar cargos ('admin', 'write', 'read', 'none') e vínculos de terceiros."
        ),
    },

    # Categoria 4: Chaves Expostas (Hardcode)
    {
        "id": "F-13",
        "category_num": 4,
        "category": "4. Chaves Expostas",
        "severity": "ALTA",
        "file_line": (
            "scripts/generate-play-protect-appeal.ts:47\n"
            "docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md:44-45\n"
            "Git commit 6520f08f (android/app/build.gradle:25,27 e scripts/build-apk.sh:16)"
        ),
        "title": "Senha real da Keystore de produção Android (guiafinanceiro123) hardcoded em código, doc e histórico Git",
        "description": (
            "A senha real da keystore de produção Android (android/app/release-key.keystore, SHA-256 B9:C1:4B:...) "
            "está hardcoded em scripts/generate-play-protect-appeal.ts:47 (-storepass guiafinanceiro123), documentada "
            "explicitamente em docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md:44 e presente no histórico Git (commits "
            "6520f08f, 62ed6921, bdfac1a8 como fallback default em android/app/build.gradle e scripts/build-apk.sh)."
        ),
    },
    {
        "id": "F-14",
        "category_num": 4,
        "category": "4. Chaves Expostas",
        "severity": "BAIXA",
        "file_line": (
            "android/app/build.gradle:23-31\n"
            "src/services/native/app-links.ts:24-25\n"
            "src/services/native/update-checker.ts:37\n"
            "scripts/build-apk.sh:154"
        ),
        "title": "Fallback silencioso de senha vazia no Gradle e URL direta do bucket público R2 hardcoded no bundle",
        "description": (
            "Em android/app/build.gradle:27-29, storePassword e keyPassword fazem fallback para string vazia ('') "
            "sem rejeitar senhas fracas/default conhecidas ('guiafinanceiro123') quando assembleRelease é executado diretamente. "
            "Além disso, a URL pública direta do bucket Cloudflare R2 (https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/...) "
            "está hardcoded no bundle cliente e nos scripts de release."
        ),
    },

    # Categoria 5: Inputs Sem Tratamento (XSS / Injection)
    {
        "id": "F-15",
        "category_num": 5,
        "category": "5. Inputs Sem Tratamento (XSS)",
        "severity": "BAIXA",
        "file_line": (
            "supabase/functions/asaas-webhook/index.ts:249-258\n"
            "scripts/notify-telegram.ts:76-79,170-175"
        ),
        "title": "Interpolação de dados de usuário sem escape em mensagens HTML do Telegram (parse_mode: HTML)",
        "description": (
            "No fluxo de antecipação acumulativa do asaas-webhook (linhas 249-258), profile?.name, profile?.email e "
            "payment.id são concatenados diretamente em mensagem enviada com parse_mode: 'HTML' sem chamar "
            "escapeTelegramHtml() (diferente de buildTelegramSaleMessage em _shared/telegram.ts:127-130). "
            "O mesmo ocorre em scripts/notify-telegram.ts:170-175 com args.message."
        ),
    },
    {
        "id": "F-16",
        "category_num": 5,
        "category": "5. Inputs Sem Tratamento (XSS)",
        "severity": "BAIXA",
        "file_line": (
            "public/_headers:2\n"
            "src/services/native/local-notifications.ts:517-523\n"
            "src/features/settings/components/subscription/invoice-history-card.tsx:93,137\n"
            "src/features/subscription/utils/checkout-submit.ts:121-123"
        ),
        "title": "Diretiva 'unsafe-eval' na CSP de produção e redirecionamentos/links sem validação estrita de protocolo",
        "description": (
            "A Content-Security-Policy em public/_headers:2 inclui 'unsafe-eval' em script-src (desnecessário quando "
            "'wasm-unsafe-eval' já está presente para WebAssembly/PDF.js). Além disso, local-notifications.ts:520 "
            "atribui window.location.href = options.url! sem validar mesma origem; invoice-history-card.tsx:137 renderiza "
            "href={receiptUrl} e checkout-submit.ts:122 redireciona para res.checkoutUrl sem validar protocolo https:."
        ),
    },
]


STRENGTHS = [
    {
        "category": "1. Banco Sem Tranca (RLS & Isolamento)",
        "file_line": (
            "supabase/migrations/20260101000001_schema.sql:551-676\n"
            "supabase/migrations/20260101000101_force_rls_critical_tables.sql:23-62\n"
            "supabase/migrations/20260101000138_harden_notifications_broadcasts_and_lifecycle.sql:25-60"
        ),
        "description": (
            "100% das 64 tabelas do schema public possuem Row Level Security habilitado (ENABLE ROW LEVEL SECURITY) "
            "e 25 tabelas financeiras/operacionais críticas possuem FORCE ROW LEVEL SECURITY ativo."
        ),
    },
    {
        "category": "1. Banco Sem Tranca (Isolamento em Repositórios & RPCs)",
        "file_line": (
            "src/data/repositories/expenses.ts:44-169\n"
            "src/data/repositories/incomes.ts:39-128\n"
            "supabase/migrations/20260101000041_saas_modular_write_lock_enforcement.sql:33-1460"
        ),
        "description": (
            "Todos os repositórios de finanças pessoais (expenses, incomes, cards, debts, budgets, recurrences, "
            "portfolio, preferences) e RPCs transacionais filtram estritamente por user_id = auth.uid()."
        ),
    },
    {
        "category": "2. Permissão no Servidor (Proteção de PII em Nível de Coluna)",
        "file_line": (
            "supabase/migrations/20260101000058_revoke_cpf_column_exposure.sql:7\n"
            "supabase/migrations/20260101000106_admin_refactor_and_governance.sql:29-85\n"
            "supabase/migrations/20260101000055_pci_lgpd_audit_payload_sanitization.sql:14-62"
        ),
        "description": (
            "Revogação explícita de leitura de PII sensível via REVOKE SELECT (cpf, phone) ON public.profiles FROM anon, "
            "authenticated. O acesso administrativo exige a RPC auditada admin_get_user_contact_details, e o trigger "
            "trg_sanitize_audit_events_payload mascara CPF e remove CVV/PAN de logs."
        ),
    },
    {
        "category": "2. Permissão no Servidor (Edge Functions & Superadmin)",
        "file_line": (
            "supabase/functions/admin-super-action/index.ts:37-68\n"
            "supabase/functions/push-dispatcher/index.ts:242-269\n"
            "supabase/functions/quotes/index.ts:340-358"
        ),
        "description": (
            "A Edge Function admin-super-action valida o JWT via userClient.auth.getUser() e confirma no banco "
            "(serviceClient) role === 'superadmin' && status === 'active'. push-dispatcher restringe broadcasts a admins "
            "ativos, e quotes impede que JWT de usuário comum grave no cache global asset_prices."
        ),
    },
    {
        "category": "3. Anti-IDOR & Autenticação Timing-Safe em Webhooks/Crons",
        "file_line": (
            "supabase/functions/_shared/http.ts:104-123\n"
            "supabase/functions/asaas-webhook/index.ts:35-48\n"
            "supabase/functions/support-notify/index.ts:149-163\n"
            "supabase/functions/asaas-manage/index.ts:75-126"
        ),
        "description": (
            "Comparação em tempo constante via SHA-256 + crypto.subtle.timingSafeEqual (timingSafeEqualString) "
            "protege asaas-webhook, billing-lifecycle-cron, sunday-digest e support-notify. support-notify valida "
            "ticket.user_id === user.id contra IDOR, e asaas-manage opera exclusivamente sobre o user.id do JWT."
        ),
    },
    {
        "category": "4. Gestão de Segredos no Bundle & Startup Check",
        "file_line": (
            "src/lib/env.ts:13-43\n"
            "supabase/functions/_shared/asaas.ts:9-29\n"
            "src/tests/security-audit.test.ts:276-320"
        ),
        "description": (
            "Validação de startup em src/lib/env.ts rejeita variáveis ausentes ou placeholders conhecidos. "
            "Inspeção do bundle de produção (dist/assets/*.js) confirmou zero vazamento de SUPABASE_SERVICE_ROLE_KEY, "
            "ASAAS_API_KEY, RESEND_API_KEY, TELEGRAM_BOT_TOKEN ou VAPID_PRIVATE_KEY."
        ),
    },
    {
        "category": "5. Defesa contra XSS, CSV/Formula Injection e E-mail HTML Injection",
        "file_line": (
            "supabase/functions/_shared/email-templates.ts:17-42\n"
            "src/services/excel-export.ts:110-136\n"
            "src/domain/reports/report-view-model.ts:95-115\n"
            "public/sw-push.js:36-51"
        ),
        "description": (
            "Zero uso de dangerouslySetInnerHTML, eval() ou new Function() no código de produção React (src/). "
            "Templates do Resend aplicam escapeHtmlText() e sanitizeSafeEmailUrl(); exportação Excel neutraliza "
            "Formula Injection (-=+@|) e escapa XML; e sw-push.js força resolveSameOriginUrl()."
        ),
    },
]


GITHUB_ISSUES = [
    {
        "number": 1,
        "title": "[Segurança] Bypass em protect_profile_security_fields() e reconcile_expired_subscriptions() por uso de current_user em funções SECURITY DEFINER",
        "labels": "security, severity:critical, database, rls",
        "problem": (
            "As funções SQL `public.protect_profile_security_fields()` (trigger de proteção da tabela `public.profiles`) "
            "e `public.reconcile_expired_subscriptions()` (RPC de expiração em lote de assinaturas) foram declaradas "
            "com `SECURITY DEFINER`, mas utilizam a condição `current_user IN ('postgres', 'supabase_admin')` para "
            "identificar chamadas privilegiadas de sistema.\n\n"
            "**Por que é explorável:** No PostgreSQL, dentro de qualquer função `SECURITY DEFINER`, o identificador "
            "`current_user` assume o papel do **dono da função** (`postgres` ou `supabase_admin`), e não o papel da "
            "sessão PostgREST (`authenticated`). Consequentemente:\n"
            "1. Em `protect_profile_security_fields()`, o bloco `if v_uid is null or current_user in ('postgres', 'supabase_admin') ... then return new; end if;` "
            "avalia **sempre para `TRUE`**, retornando `NEW` na linha 169 sem jamais executar as travas `if not public.is_admin()` "
            "(linha 173) e `if not public.is_superadmin()` (linha 188). Além disso, o trigger só está registrado `BEFORE UPDATE` (linha 198), "
            "não protegendo `BEFORE INSERT` sob a policy `profiles_insert_own`.\n"
            "2. Qualquer usuário autenticado (mesmo `pending_approval` ou `user`) pode enviar `PATCH /rest/v1/profiles?id=eq.<seu_uid>` "
            "com `{\"role\": \"superadmin\", \"status\": \"active\"}` e obter privilégio máximo no banco e na Edge Function `admin-super-action`.\n"
            "3. Em `reconcile_expired_subscriptions()`, qualquer usuário autenticado pode invocar a RPC diretamente porque possui "
            "`GRANT EXECUTE TO authenticated` e a cláusula `OR current_user IN ('postgres', 'supabase_admin')` é sempre verdadeira."
        ),
        "evidence": (
            "Arquivo 1: supabase/migrations/20260101000028_access_control_and_feature_flags.sql (linhas 158-200)\n"
            "```sql\n"
            "create or replace function public.protect_profile_security_fields()\n"
            "returns trigger\n"
            "language plpgsql\n"
            "security definer\n"
            "set search_path = public, pg_temp\n"
            "as $$\n"
            "declare\n"
            "  v_uid uuid := auth.uid();\n"
            "begin\n"
            "  if v_uid is null or current_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role' then\n"
            "    return new;\n"
            "  end if;\n"
            "```\n\n"
            "Arquivo 2: supabase/migrations/20260101000138_harden_notifications_broadcasts_and_lifecycle.sql (linhas 391-407)\n"
            "```sql\n"
            "  IF NOT (\n"
            "    public.is_admin()\n"
            "    OR auth.role() = 'service_role'\n"
            "    OR current_user IN ('postgres', 'supabase_admin')\n"
            "  ) THEN\n"
            "    RAISE EXCEPTION 'Acesso negado: privilégios administrativos requeridos para reconciliar assinaturas.';\n"
            "  END IF;\n"
            "```"
        ),
        "impact": (
            "Comprometimento total do sistema (Account Takeover Administrativo / Escalada Horizontal e Vertical para Superadmin). "
            "Um atacante autenticado assume `role = 'superadmin'` e `status = 'active'`, podendo listar e excluir usuários, "
            "consultar CPF/telefone via `admin_get_user_contact_details`, alterar planos e revogar acessos."
        ),
        "fix": (
            "1. Em funções `SECURITY DEFINER`, substituir `current_user IN ('postgres', 'supabase_admin')` por "
            "`session_user IN ('postgres', 'supabase_admin')` (e validar `coalesce(auth.role(), '') NOT IN ('authenticated', 'anon')`).\n"
            "2. Em `protect_profile_security_fields()`, registrar o trigger como `BEFORE INSERT OR UPDATE ON public.profiles`, "
            "forçando `NEW.role := 'user'` e `NEW.status := 'active'` quando um usuário não-admin insere seu próprio perfil.\n"
            "3. Revogar `EXECUTE` de `public.reconcile_expired_subscriptions()` para a role `authenticated` (`REVOKE EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() FROM PUBLIC, anon, authenticated;`)."
        ),
        "acceptance_criteria": [
            "Um usuário autenticado comum (`role = 'user'`) que executar `UPDATE public.profiles SET role = 'superadmin' WHERE id = auth.uid()` deve receber exceção SQL `Acesso negado`.",
            "Um usuário autenticado comum que executar `INSERT INTO public.profiles (id, email, role) VALUES (auth.uid(), 'x@y.com', 'superadmin')` deve ser bloqueado pelo trigger `BEFORE INSERT OR UPDATE`.",
            "Um usuário com `role = 'admin'` (não `superadmin`) não deve conseguir alterar `profiles.role` para `'admin'` ou `'superadmin'`.",
            "Um usuário autenticado comum não deve conseguir executar `SELECT public.reconcile_expired_subscriptions()`.",
        ],
    },
    {
        "number": 2,
        "title": "[Segurança] Isolamento multi-tenant furado em family_invites, family_members e trip_members permite invasão de famílias e viagens",
        "labels": "security, severity:critical, rls, multi-tenant",
        "problem": (
            "As políticas de Row Level Security (RLS) das tabelas `public.family_invites`, `public.family_members` e "
            "`public.trip_members` contêm condições permissivas que anulam o isolamento entre famílias e viagens:\n\n"
            "1. `family_invites_select` (`0076:231-240`): inclui `or (status = 'pending' and expires_at > now() and (select auth.uid()) is not null)`. "
            "Qualquer usuário autenticado pode executar `SELECT * FROM public.family_invites` e obter todos os tokens secretos de convites pendentes de todas as famílias.\n"
            "2. `family_invites_insert` (`0128:562-575`): inclui `AND ((SELECT auth.uid()) IS NOT NULL OR public.is_family_admin(family_id, (SELECT auth.uid())))`. "
            "Como `auth.uid() IS NOT NULL` é sempre verdadeiro para usuários logados, qualquer usuário pode criar convites (inclusive com `role = 'admin'`) para qualquer `family_id`.\n"
            "3. `family_invites_update` (`0128:579-598`): inclui `OR (status = 'pending' AND expires_at > now() AND (SELECT auth.uid()) IS NOT NULL)`, "
            "permitindo a qualquer usuário adulterar convites pendentes de qualquer família (ex.: trocar `role` para `'admin'`).\n"
            "4. `family_members_insert` e `family_members_update` (`0076:196-217`): exigem apenas `(select auth.uid()) = user_id`, permitindo "
            "que qualquer usuário faça `INSERT INTO public.family_members (family_id, user_id, role) VALUES ('<family_id_alvo>', auth.uid(), 'owner')` sem convite, "
            "ou promova seu próprio registro existente para `role = 'owner'`.\n"
            "5. `trip_members_write_policy` (`0128:696-713`): política `FOR ALL` com `WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_trip_host(trip_id, (SELECT auth.uid())))`, "
            "permitindo que qualquer usuário autenticado faça `INSERT INTO public.trip_members (trip_id, user_id, name, is_host) VALUES ('<trip_id_alvo>', auth.uid(), 'Intruso', true)`."
        ),
        "evidence": (
            "Arquivo 1: supabase/migrations/20260101000076_create_families_and_multi_account_collaboration.sql (linhas 196-240)\n"
            "```sql\n"
            "create policy family_members_insert on public.family_members\n"
            "  for insert to authenticated\n"
            "  with check ((select auth.uid()) = user_id or public.is_family_admin(family_id, (select auth.uid())));\n"
            "...\n"
            "create policy family_invites_select on public.family_invites\n"
            "  for select to authenticated\n"
            "  using (\n"
            "    public.is_family_member(family_id, (select auth.uid()))\n"
            "    or (status = 'pending' and expires_at > now() and (select auth.uid()) is not null)\n"
            "  );\n"
            "```\n\n"
            "Arquivo 2: supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql (linhas 562-598 e 696-713)\n"
            "```sql\n"
            "CREATE POLICY family_invites_insert ON public.family_invites\n"
            "  FOR INSERT TO authenticated\n"
            "  WITH CHECK (\n"
            "    public.is_current_user_active()\n"
            "    AND public.can_current_user_write_module('transactions')\n"
            "    AND ((SELECT auth.uid()) IS NOT NULL OR public.is_family_admin(family_id, (SELECT auth.uid())))\n"
            "  );\n"
            "```"
        ),
        "impact": (
            "Invasão de qualquer família ou viagem do sistema, leitura de despesas, orçamentos, metas e patrimônio familiar "
            "compartilhado (`get_family_consolidation`), sequestro de controle administrativo da família (`role = 'owner'`) "
            "e manipulação de despesas/acertos de viagens de terceiros."
        ),
        "fix": (
            "1. `family_invites_select`: restringir exclusivamente a `public.is_family_member(family_id, (SELECT auth.uid()))` "
            "ou `lower(invited_email) = lower((SELECT email FROM public.profiles WHERE id = (SELECT auth.uid())))` (o preview público por token já é atendido pela RPC `get_family_invite_preview`).\n"
            "2. `family_invites_insert` e `family_invites_update`: exigir estritamente `public.is_family_admin(family_id, (SELECT auth.uid()))` "
            "(o aceite do convite já ocorre dentro da RPC `SECURITY DEFINER` `accept_family_invite`).\n"
            "3. `family_members_insert` e `family_members_update`: exigir `public.is_family_admin(family_id, (SELECT auth.uid()))` "
            "(a criação da família e o aceite de convite já ocorrem via RPCs `create_family` e `accept_family_invite`).\n"
            "4. `trip_members_write_policy`: separar `INSERT`/`UPDATE`/`DELETE` exigindo `public.is_trip_host(trip_id, (SELECT auth.uid()))`, "
            "permitindo ao membro não-host apenas atualizar seu próprio `name` sem alterar `is_host` nem `trip_id`."
        ),
        "acceptance_criteria": [
            "Um usuário fora da família não consegue listar convites pendentes de outras famílias em `public.family_invites`.",
            "Um usuário fora da família não consegue executar `INSERT` ou `UPDATE` em `public.family_invites` nem `INSERT` direto em `public.family_members`.",
            "Um membro comum (`role = 'member'`) não consegue executar `UPDATE public.family_members SET role = 'owner'`.",
            "Um usuário fora da viagem não consegue executar `INSERT INTO public.trip_members` para um `trip_id` do qual não é host.",
        ],
    },
    {
        "number": 3,
        "title": "[Segurança] Validação de invited_email em accept_family_invite e filtro is_family em get_family_income_ratio_suggestion",
        "labels": "security, severity:high, idor, privacy",
        "problem": (
            "1. **IDOR / Bypass de Destinatário em `accept_family_invite(p_token)` (`0078:243-352`):** Quando um admin familiar "
            "emite um convite via `invite_family_member(p_email, p_role)`, o convite é vinculado a `invited_email`. Contudo, "
            "`accept_family_invite(p_token)` nunca verifica se o e-mail do usuário autenticado (`auth.uid()`) coincide com "
            "`v_invite.invited_email`, nem verifica o limite máximo de 6 membros por família.\n"
            "2. **Vazamento de Receitas Pessoais Privadas em `get_family_income_ratio_suggestion()` (`0084:78-92`):** A função "
            "`SECURITY DEFINER` agrega a tabela `public.incomes` de todos os membros da família (`LEFT JOIN public.incomes i ON i.user_id = fm.user_id`) "
            "sem filtrar `i.is_family = true` e `i.family_id = v_family_id`, expondo a média salarial/receitas estritamente privadas de cada membro."
        ),
        "evidence": (
            "Arquivo 1: supabase/migrations/20260101000078_create_family_management_rpcs.sql (linhas 281-306)\n"
            "```sql\n"
            "  select id, family_id, invited_email, role, status, expires_at\n"
            "  into v_invite\n"
            "  from public.family_invites\n"
            "  where token = trim(p_token)\n"
            "  for update;\n"
            "  -- Ausência de verificação: lower(v_invite.invited_email) = lower(v_caller_email)\n"
            "```\n\n"
            "Arquivo 2: supabase/migrations/20260101000084_expand_family_modes_and_wealth_integration.sql (linhas 78-92)\n"
            "```sql\n"
            "    select\n"
            "      fm.user_id,\n"
            "      coalesce(round(sum(i.amount)::numeric / 3.0), 0)::bigint as avg_income_cents\n"
            "    from public.family_members fm\n"
            "    left join public.incomes i\n"
            "      on i.user_id = fm.user_id\n"
            "      and i.date >= v_start_date\n"
            "      and i.date <= v_end_date\n"
            "    where fm.family_id = v_family_id\n"
            "    group by fm.user_id\n"
            "```"
        ),
        "impact": (
            "Qualquer portador de um token de convite pode ingressar na família mesmo que o convite tenha sido emitido "
            "para outro endereço de e-mail, e membros da família têm suas receitas pessoais não compartilhadas (`is_family = false`) "
            "expostas no cálculo de proporção."
        ),
        "fix": (
            "1. Em `accept_family_invite`, caso `nullif(trim(v_invite.invited_email), '') IS NOT NULL` e não seja um placeholder "
            "`convite-*@familia.local`, validar que `lower(v_caller_email) = lower(trim(v_invite.invited_email))`, além de validar `v_member_count < 6`.\n"
            "2. Em `get_family_income_ratio_suggestion`, adicionar `AND i.is_family = true AND i.family_id = v_family_id` no `LEFT JOIN public.incomes`."
        ),
        "acceptance_criteria": [
            "`accept_family_invite` rejeita o aceite quando `invited_email` está preenchido com um e-mail real e difere do e-mail do usuário autenticado.",
            "`accept_family_invite` respeita o limite máximo de 6 membros por família.",
            "`get_family_income_ratio_suggestion` contabiliza apenas receitas com `is_family = true` e `family_id = v_family_id`.",
        ],
    },
    {
        "number": 4,
        "title": "[Segurança] Bypass de governança Superadmin e auditoria via escrita direta em tabelas administrativas e support_tickets",
        "labels": "security, severity:high, authorization, rls",
        "problem": (
            "1. As tabelas `public.system_features`, `public.user_feature_overrides`, `public.user_module_permissions` e "
            "`public.user_subscriptions` possuem políticas RLS `FOR ALL USING ((select public.is_admin()))` (`0051:818-888`) "
            "e `GRANT INSERT, UPDATE, DELETE TO authenticated`. Isso permite que um usuário com papel `admin` (não `superadmin`) "
            "escreva diretamente via PostgREST nessas tabelas, contornando as travas das RPCs (`admin_toggle_global_feature`, "
            "`admin_set_user_subscription`, `admin_set_user_module_permission`) que exigem `public.is_superadmin()` para Kill-Switches "
            "globais, proíbem alteração de contas `superadmin` por `admin` comum e gravam trilha obrigatória em `public.audit_events`.\n"
            "2. As RPCs `admin_set_feature_override` e `admin_remove_feature_override` (`0028:493-557`) também não verificam se "
            "`p_user_id` pertence a um `superadmin` quando o chamador é apenas `admin`.\n"
            "3. Na tabela `public.support_tickets` (`0060:47-60,100`), o usuário comum tem permissão de `SELECT` sobre a coluna interna "
            "`admin_notes` (lida via `.select('*')` em `src/data/repositories/support-tickets.ts:108`) e permissão de `UPDATE` irrestrita "
            "para modificar `status`, `admin_notes`, `admin_reply` e `admin_id` de seus próprios chamados."
        ),
        "evidence": (
            "Arquivo 1: supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql (linhas 818-888)\n"
            "```sql\n"
            "create policy \"admins editam funcionalidades do sistema\" on public.system_features\n"
            "  for all using ((select public.is_admin())) with check ((select public.is_admin()));\n"
            "...\n"
            "create policy \"admins gerenciam assinaturas\" on public.user_subscriptions\n"
            "  for all using ((select public.is_admin())) with check ((select public.is_admin()));\n"
            "```\n\n"
            "Arquivo 2: supabase/migrations/20260101000060_support_tickets.sql (linhas 54-60)\n"
            "```sql\n"
            "create policy \"Users can update own support tickets\"\n"
            "  on public.support_tickets for update to authenticated\n"
            "  using (auth.uid() = user_id) with check (auth.uid() = user_id);\n"
            "```"
        ),
        "impact": (
            "Um `admin` comum pode desligar módulos globais do sistema (`system_features`), revogar a assinatura ou "
            "módulos de um `superadmin` sem gerar `audit_events`, e usuários finais podem ler anotações internas de suporte "
            "(`admin_notes`) ou adulterar respostas administrativas em seus chamados."
        ),
        "fix": (
            "1. Remover as policies `FOR ALL` para `is_admin()` em `system_features`, `user_feature_overrides`, `user_module_permissions` "
            "e `user_subscriptions`, mantendo apenas `FOR SELECT USING ((SELECT public.is_admin()))` e revogando `INSERT, UPDATE, DELETE` "
            "diretos para `authenticated` (forçando toda mutação a passar pelas RPCs `SECURITY DEFINER` auditadas).\n"
            "2. Adicionar trava `IF v_target_role = 'superadmin' AND NOT public.is_superadmin() THEN RAISE EXCEPTION ...` em "
            "`admin_set_feature_override` e `admin_remove_feature_override`.\n"
            "3. Em `public.support_tickets`, criar trigger `BEFORE UPDATE` impedindo que não-admins alterem `admin_notes`, `admin_reply`, "
            "`admin_id` e `resolved_at`, e omitir `admin_notes` para não-admins."
        ),
        "acceptance_criteria": [
            "Mutação direta via PostgREST (`PATCH /rest/v1/system_features` ou `user_subscriptions`) por um `admin` é negada; mutações ocorrem exclusivamente via RPCs auditadas.",
            "`admin_set_feature_override` e `admin_remove_feature_override` bloqueiam alterações em contas `superadmin` quando chamadas por um `admin` comum.",
            "Usuários não-admin não recebem `admin_notes` em `listMySupportTickets` e não conseguem alterar `admin_notes`/`admin_reply` via `UPDATE`.",
        ],
    },
    {
        "number": 5,
        "title": "[Segurança] Remoção de sobrecargas SQL órfãs e validação de FKs cross-tenant em RPCs SECURITY DEFINER",
        "labels": "security, severity:medium, database, idor",
        "problem": (
            "1. **Sobrecargas SQL órfãs:** As funções `public.add_public_trip_expense` (10 parâmetros, `0094:410`), "
            "`public.create_trip` (7 parâmetros, `0095:170`) e `public.refinance_credit_card_bill` (5 parâmetros, `0036:747`, "
            "invocada por `src/data/rpc/cards.ts:86`) permaneceram ativas no catálogo PostgreSQL quando novas assinaturas com "
            "1 parâmetro adicional foram criadas sem `DROP FUNCTION`. Isso permite: (a) lançar despesas em viagens públicas "
            "protegidas por senha sem informar `p_passcode`; e (b) criar viagens ou refinanciar faturas mesmo com assinatura "
            "expirada (`read_only`).\n"
            "2. **Validação de posse de IDs em RPCs `SECURITY DEFINER`:**\n"
            "   - `approve_dividends_batch_atomic` (`0087:274`): aceita `v_item->>'asset_id'` sem confirmar que o ativo pertence a `v_user_id`.\n"
            "   - `restore_backup` (`0127:893`): insere `d.expense_id` em `public.debts` sem validar que a despesa pertence a `v_uid`.\n"
            "   - `add_public_trip_expense` (`0099:337-376`): não valida que `p_created_by_member_id` e cada `x.member_id` em `p_splits` pertencem a `v_trip.id`, nem impede `share_cents < 0`.\n"
            "   - `record_trip_settlements` (`0128:1653`): não valida que `from_member_id` e `to_member_id` pertencem a `p_trip_id`.\n"
            "   - `get_user_module_access` (`0128:285`) e helpers `is_family_member`/`is_trip_member`: aceitam `p_user_id` de terceiros sem restringir a `auth.uid()` ou `is_admin()`."
        ),
        "evidence": (
            "Arquivo 1: supabase/migrations/20260101000094_create_trips_and_shared_ledger.sql (linha 410) vs 20260101000099 (linha 256)\n"
            "```sql\n"
            "-- 0094: assinatura de 10 args sem p_passcode continua ativa:\n"
            "create or replace function public.add_public_trip_expense(\n"
            "  p_token text, p_paid_by_member_id uuid, p_created_by_member_id uuid,\n"
            "  p_description text, p_amount_cents bigint, p_date date, p_category text,\n"
            "  p_split_mode text, p_splits jsonb, p_notes text default null\n"
            ")\n"
            "```\n\n"
            "Arquivo 2: supabase/migrations/20260101000087_portfolio_monthly_closing_and_corporate_dividends.sql (linhas 273-277)\n"
            "```sql\n"
            "    if v_item->>'asset_id' is not null and trim(v_item->>'asset_id') <> '' then\n"
            "      v_asset_id := (v_item->>'asset_id')::uuid;\n"
            "    else\n"
            "      select id into v_asset_id from public.portfolio_assets where user_id = v_user_id and ticker = v_ticker limit 1;\n"
            "    end if;\n"
            "```"
        ),
        "impact": (
            "Bypass de senha de colaboração em viagens compartilhadas, bypass de bloqueio de escrita SaaS (`read_only`) "
            "no refinanciamento de cartão e criação de viagens, e corrupção/referência cruzada de chaves estrangeiras em RPCs `SECURITY DEFINER`."
        ),
        "fix": (
            "1. Executar `DROP FUNCTION IF EXISTS` para as assinaturas legadas de 10 args de `add_public_trip_expense` e 7 args de `create_trip`, "
            "e atualizar a assinatura de 5 args de `refinance_credit_card_bill` para exigir `is_current_user_active()` e `can_current_user_write_module('cards')`.\n"
            "2. Validar `WHERE id = v_asset_id AND user_id = v_user_id` em `approve_dividends_batch_atomic`, `EXISTS (SELECT 1 FROM public.expenses WHERE id = d.expense_id AND user_id = v_uid)` em `restore_backup`, "
            "e pertencimento de todos os `member_id` a `v_trip.id` (com `share_cents >= 0`) nas RPCs de viagens.\n"
            "3. Em `get_user_module_access`, rejeitar chamadas onde `p_user_id <> auth.uid() AND NOT public.is_admin()`."
        ),
        "acceptance_criteria": [
            "A assinatura antiga `add_public_trip_expense` (10 args) e `create_trip` (7 args) não existem mais em `pg_proc`.",
            "`refinance_credit_card_bill` bloqueia usuários com assinatura expirada (`read_only`).",
            "`approve_dividends_batch_atomic`, `restore_backup`, `add_public_trip_expense` e `record_trip_settlements` rejeitam IDs pertencentes a outros usuários/viagens.",
        ],
    },
    {
        "number": 6,
        "title": "[Segurança] Exigir MFA (AAL2) em RequireAdminSession e admin-super-action quando TOTP estiver ativo",
        "labels": "security, severity:medium, auth, mfa, admin",
        "problem": (
            "O guardião de rotas administrativas `RequireAdminSession` (`src/components/routing/require-admin-session.tsx:10-26`) "
            "verifica apenas `!session` e `!isAdmin`, mas omite a verificação `if (mfaRequired && !mfaVerified)` que está presente "
            "em `RequireAuth` (`src/app/require-auth.tsx:107`) e `RequireActiveAccount` (`src/components/routing/require-active-account.tsx:22`). "
            "No backend, a Edge Function `admin-super-action` (`supabase/functions/admin-super-action/index.ts:37-68`) também não "
            "verifica se o superadmin possui fatores TOTP verificados exigindo claim `aal === 'aal2'` no JWT."
        ),
        "evidence": (
            "Arquivo: src/components/routing/require-admin-session.tsx (linhas 10-26)\n"
            "```tsx\n"
            "export function RequireAdminSession({ children }: { children?: React.ReactNode }) {\n"
            "  const { session, loading: authLoading } = useAuth();\n"
            "  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);\n"
            "  ...\n"
            "  if (!session) {\n"
            "    return <Navigate to=\"/admin/login\" state={{ from: location }} replace />;\n"
            "  }\n"
            "  if (!isAdmin) {\n"
            "    return <Navigate to=\"/\" replace />;\n"
            "  }\n"
            "  return children ? <>{children}</> : <Outlet />;\n"
            "```"
        ),
        "impact": (
            "Caso a senha de um administrador com MFA ativo seja comprometida, a sessão em nível `aal1` (antes do desafio TOTP) "
            "pode acessar `/admin` no navegador e invocar ações críticas na Edge Function `admin-super-action`."
        ),
        "fix": (
            "1. Em `RequireAdminSession`, importar `mfaRequired` e `mfaVerified` de `useAuth()` e renderizar `<MfaVerifyScreen />` "
            "(ou redirecionar para `/admin/login`) quando `mfaRequired && !mfaVerified`.\n"
            "2. Em `supabase/functions/admin-super-action/index.ts` e na função SQL `public.is_admin()`/`public.is_superadmin()`, "
            "verificar se o usuário possui fator MFA `verified` e exigir `(auth.jwt()->>'aal') = 'aal2'`."
        ),
        "acceptance_criteria": [
            "`RequireAdminSession` bloqueia o acesso às rotas `/admin/*` enquanto `mfaRequired && !mfaVerified` for verdadeiro.",
            "`admin-super-action` retorna HTTP 403 se o superadmin possuir fator MFA verificado e o JWT estiver em nível `aal1`.",
        ],
    },
    {
        "number": 7,
        "title": "[Segurança] Remover senha hardcoded da Keystore Android (guiafinanceiro123) e adicionar validação fail-fast no build",
        "labels": "security, severity:high, secrets, android",
        "problem": (
            "A senha real da keystore de produção Android (`android/app/release-key.keystore`, fingerprint SHA-256 `B9:C1:4B:...`) "
            "está exposta em texto claro (`guiafinanceiro123`) em três locais:\n"
            "1. `scripts/generate-play-protect-appeal.ts` (linha 47): `-storepass guiafinanceiro123`.\n"
            "2. `docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md` (linha 44): `- **Senha Padrão:** guiafinanceiro123`.\n"
            "3. Histórico Git (commits `6520f08f`, `62ed6921`, `bdfac1a8` em `android/app/build.gradle:25,27` e `scripts/build-apk.sh:16`).\n"
            "Além disso, `android/app/build.gradle` (linhas 27-29) faz fallback silencioso para `\"\"` e não rejeita a senha comprometida `guiafinanceiro123`."
        ),
        "evidence": (
            "Arquivo 1: scripts/generate-play-protect-appeal.ts (linhas 45-49)\n"
            "```ts\n"
            "    const output = execSync(\n"
            "      `LC_ALL=C keytool -list -v -keystore \"${KEYSTORE_PATH}\" -alias guiafinanceiro -storepass guiafinanceiro123`,\n"
            "      { encoding: \"utf-8\" },\n"
            "    );\n"
            "```\n\n"
            "Arquivo 2: docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md (linhas 42-45)\n"
            "```markdown\n"
            "- **Algoritmo:** RSA 2048 bits\n"
            "- **Alias:** `guiafinanceiro` (ou definido via `KEY_ALIAS`)\n"
            "- **Senha Padrão:** `guiafinanceiro123` (ou definida via `KEYSTORE_PASSWORD` e `KEY_PASSWORD`)\n"
            "```"
        ),
        "impact": (
            "Qualquer pessoa com acesso ao repositório (e à keystore caso vazada de backup/ambiente de build) conhece a senha "
            "da chave privada de assinatura do APK oficial (`com.guiafinanceiro.app`), permitindo assinar APKs maliciosos "
            "aceitos pelo atualizador in-app do Android."
        ),
        "fix": (
            "1. Remover imediatamente a senha hardcoded de `scripts/generate-play-protect-appeal.ts` (lendo `process.env.KEYSTORE_PASSWORD`) "
            "e de `docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md`.\n"
            "2. Alterar a senha da `release-key.keystore` (`keytool -storepasswd` e `keytool -keypasswd`) para um segredo forte "
            "gerado com alta entropia armazenado apenas no cofre de senhas e `.env.local`.\n"
            "3. Em `scripts/build-apk.sh` e `android/app/build.gradle`, falhar o build caso `KEYSTORE_PASSWORD` esteja vazia ou "
            "seja igual ao default comprometido `guiafinanceiro123`."
        ),
        "acceptance_criteria": [
            "`git grep guiafinanceiro123` retorna zero ocorrências na árvore atual do projeto.",
            "`scripts/generate-play-protect-appeal.ts` lê `KEYSTORE_PASSWORD` do ambiente (`.env.local`/`.env`) sem fallback hardcoded.",
            "`scripts/build-apk.sh` rejeita explicitamente `KEYSTORE_PASSWORD=guiafinanceiro123`.",
        ],
    },
    {
        "number": 8,
        "title": "[Segurança] Escapar HTML nas notificações Telegram, remover 'unsafe-eval' da CSP e validar URLs externas",
        "labels": "security, severity:low, xss, csp",
        "problem": (
            "1. **Injeção de HTML no Telegram (`asaas-webhook` e `notify-telegram.ts`):** Em `supabase/functions/asaas-webhook/index.ts:249-258`, "
            "`profile?.name`, `profile?.email` e `payment.id` são interpolados sem `escapeTelegramHtml()` em uma mensagem enviada com "
            "`parse_mode: 'HTML'`. Caracteres `<` ou `&` no nome do usuário permitem injetar tags HTML suportadas pelo Telegram ou "
            "causam erro HTTP 400 na API do Telegram. O mesmo ocorre em `scripts/notify-telegram.ts:170-175`.\n"
            "2. **Diretiva `'unsafe-eval'` na CSP (`public/_headers:2`):** A política `script-src` inclui `'unsafe-eval'` além de `'wasm-unsafe-eval'`, "
            "enfraquecendo a mitigação de XSS no navegador.\n"
            "3. **Validação de URLs em redirecionamentos/links:** `src/services/native/local-notifications.ts:520` atribui "
            "`window.location.href = options.url!` sem validar mesma origem; `invoice-history-card.tsx:137` e `checkout-submit.ts:122` "
            "não validam se `receiptUrl` e `res.checkoutUrl` iniciam estritamente com `https://`."
        ),
        "evidence": (
            "Arquivo 1: supabase/functions/asaas-webhook/index.ts (linhas 249-258)\n"
            "```ts\n"
            "const text = [\n"
            "  `<b>[AXIR] ANTECIPAÇÃO ACUMULATIVA CONFIRMADA</b>`,\n"
            "  `<b>Cliente:</b> ${profile?.name || \"Assinante\"} (${profile?.email || \"—\"})`,\n"
            "  ...\n"
            "].join(\"\\n\");\n"
            "await sendTelegramNotification({ botToken, chatId, text });\n"
            "```\n\n"
            "Arquivo 2: public/_headers (linha 2)\n"
            "```text\n"
            "Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' ...\n"
            "```"
        ),
        "impact": (
            "Injeção de marcação HTML/links falsos no canal de Telegram do fundador, enfraquecimento desnecessário da CSP "
            "no navegador e risco de redirecionamento aberto caso dados externos forneçam esquemas não-HTTPS."
        ),
        "fix": (
            "1. Aplicar `escapeTelegramHtml()` em `profile?.name`, `profile?.email` e `payment.id` em `asaas-webhook/index.ts:249-258` "
            "e sanitizar `args.message` em `scripts/notify-telegram.ts`.\n"
            "2. Remover `'unsafe-eval'` de `public/_headers:2`, mantendo apenas `'wasm-unsafe-eval'`.\n"
            "3. Validar mesma origem no `onclick` de `local-notifications.ts:520` e validar protocolo `https:` em `receiptUrl` e `res.checkoutUrl`."
        ),
        "acceptance_criteria": [
            "`asaas-webhook/index.ts` aplica `escapeTelegramHtml()` em todos os campos dinâmicos antes de `sendTelegramNotification`.",
            "`public/_headers` não contém `'unsafe-eval'` (apenas `'wasm-unsafe-eval'`).",
            "`local-notifications.ts`, `invoice-history-card.tsx` e `checkout-submit.ts` validam o protocolo/origem antes de abrir ou redirecionar URLs.",
        ],
    },
]


RECOMMENDATIONS = [
    (
        "P1 — Imediato (Bloqueadores Críticos — 24h)",
        HEX_CRITICAL,
        [
            "Corrigir imediatamente o trigger public.protect_profile_security_fields() e a RPC public.reconcile_expired_subscriptions() (Issue #1): remover current_user IN ('postgres', 'supabase_admin') de funções SECURITY DEFINER (substituindo por session_user e checagem explícita de auth.role()), estender o trigger para BEFORE INSERT OR UPDATE em public.profiles e revogar EXECUTE de reconcile_expired_subscriptions() para authenticated.",
            "Fechar as brechas de RLS em public.family_invites, public.family_members e public.trip_members (Issue #2): remover as cláusulas OR (select auth.uid()) IS NOT NULL e user_id = auth.uid() que permitem listagem global de tokens de convite e auto-inclusão arbitrária como owner/host em famílias e viagens de terceiros.",
        ],
    ),
    (
        "P2 — Alta Prioridade (Curto Prazo — 72h)",
        HEX_HIGH,
        [
            "Restringir escrita direta via PostgREST nas tabelas administrativas system_features, user_feature_overrides, user_module_permissions e user_subscriptions (Issue #4): substituir as policies FOR ALL USING (is_admin()) por FOR SELECT e forçar mutações exclusivamente via RPCs SECURITY DEFINER auditadas com proteção hierárquica de superadmin.",
            "Validar correspondência estrita de invited_email e teto de 6 membros na RPC accept_family_invite e filtrar i.is_family = true em get_family_income_ratio_suggestion (Issue #3).",
            "Rotacionar a senha da Keystore Android de produção (release-key.keystore), remover a senha hardcoded guiafinanceiro123 de scripts/generate-play-protect-appeal.ts e docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md, e adicionar validação fail-fast no build (Issue #7).",
        ],
    ),
    (
        "P3 — Média e Baixa Prioridade (Hardening Contínuo — 1 a 2 Semanas)",
        HEX_MEDIUM,
        [
            "Remover sobrecargas SQL órfãs (add_public_trip_expense de 10 args, create_trip de 7 args) e aplicar trava SaaS em refinance_credit_card_bill de 5 args; validar posse de asset_id, expense_id e member_id nas RPCs SECURITY DEFINER (Issue #5).",
            "Proteger a coluna interna admin_notes e bloquear edição de campos administrativos pelo usuário final em public.support_tickets (Issue #4).",
            "Exigir verificação MFA AAL2 em RequireAdminSession e na Edge Function admin-super-action quando o administrador possuir fator TOTP ativo (Issue #6).",
            "Aplicar escapeTelegramHtml() no fluxo de antecipação do asaas-webhook, remover 'unsafe-eval' da CSP em public/_headers e validar protocolo/origem em URLs dinâmicas (Issue #8).",
        ],
    ),
]


# ---------------------------------------------------------------------------
# Geração dos Gráficos com Matplotlib (Alta Resolução 300 DPI)
# ---------------------------------------------------------------------------
def build_donut_chart_by_severity() -> io.BytesIO:
    counts = {
        "Crítica": sum(1 for f in FINDINGS if f["severity"] == "CRÍTICA"),
        "Alta": sum(1 for f in FINDINGS if f["severity"] == "ALTA"),
        "Média": sum(1 for f in FINDINGS if f["severity"] == "MÉDIA"),
        "Baixa": sum(1 for f in FINDINGS if f["severity"] == "BAIXA"),
        "Pontos Fortes": len(STRENGTHS),
    }

    labels = [f"{k} ({v})" for k, v in counts.items()]
    values = list(counts.values())
    palette = [HEX_CRITICAL, HEX_HIGH, HEX_MEDIUM, HEX_LOW, HEX_STRENGTH]

    fig, ax = plt.subplots(figsize=(4.4, 3.3), dpi=300)
    wedges, texts, autotexts = ax.pie(
        values,
        labels=None,
        autopct=lambda pct: f"{pct:.0f}%" if pct >= 7 else "",
        pctdistance=0.77,
        startangle=140,
        colors=palette,
        wedgeprops={"width": 0.44, "edgecolor": "white", "linewidth": 2},
    )

    for autotext in autotexts:
        autotext.set_color("white")
        autotext.set_fontsize(8.5)
        autotext.set_fontweight("bold")

    total_vulns = sum(values[:-1])
    ax.text(
        0,
        0.07,
        f"{total_vulns}",
        ha="center",
        va="center",
        fontsize=18,
        fontweight="bold",
        color=HEX_PRIMARY,
    )
    ax.text(
        0,
        -0.16,
        "Achados\n(+7 Fortes)",
        ha="center",
        va="center",
        fontsize=7.5,
        color=HEX_MUTED,
    )

    ax.legend(
        wedges,
        labels,
        title="Distribuição",
        loc="center left",
        bbox_to_anchor=(0.94, 0.5),
        frameon=False,
        fontsize=8,
        title_fontsize=8.5,
    )
    ax.set_title("Achados por Severidade & Pontos Fortes", fontsize=10, fontweight="bold", color=HEX_PRIMARY, pad=8)
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=300, bbox_inches="tight", transparent=False, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf


def build_bar_chart_by_category() -> io.BytesIO:
    categories = [
        "1. Banco Sem\nTranca (RLS)",
        "2. Permissão\nno Navegador",
        "3. IDOR",
        "4. Chaves\nExpostas",
        "5. Inputs Sem\nTratamento (XSS)",
    ]

    severities = ["CRÍTICA", "ALTA", "MÉDIA", "BAIXA"]
    sev_labels = ["Crítica", "Alta", "Média", "Baixa"]
    sev_colors = [HEX_CRITICAL, HEX_HIGH, HEX_MEDIUM, HEX_LOW]

    matrix = {sev: [0] * 5 for sev in severities}
    for f in FINDINGS:
        idx = f["category_num"] - 1
        matrix[f["severity"]][idx] += 1

    fig, ax = plt.subplots(figsize=(4.8, 3.3), dpi=300)
    x = range(len(categories))
    bottoms = [0] * len(categories)

    for sev, label, color in zip(severities, sev_labels, sev_colors):
        vals = matrix[sev]
        bars = ax.bar(
            x,
            vals,
            bottom=bottoms,
            label=label,
            color=color,
            width=0.52,
            edgecolor="white",
            linewidth=1.0,
        )
        for i, (b, v) in enumerate(zip(bars, vals)):
            if v > 0:
                ax.text(
                    b.get_x() + b.get_width() / 2,
                    bottoms[i] + v / 2,
                    str(v),
                    ha="center",
                    va="center",
                    color="white",
                    fontsize=8,
                    fontweight="bold",
                )
        bottoms = [bottoms[i] + vals[i] for i in range(len(categories))]

    for i, total in enumerate(bottoms):
        ax.text(
            i,
            total + 0.15,
            f"Total: {total}",
            ha="center",
            va="bottom",
            color=HEX_PRIMARY,
            fontsize=7.5,
            fontweight="bold",
        )

    ax.set_xticks(list(x))
    ax.set_xticklabels(categories, fontsize=7.5, color=HEX_SECONDARY)
    ax.set_ylim(0, max(bottoms) + 1.3)
    ax.set_ylabel("Qtd. de Achados", fontsize=8, color=HEX_MUTED)
    ax.set_title("Achados por Categoria e Severidade", fontsize=10, fontweight="bold", color=HEX_PRIMARY, pad=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(HEX_BORDER)
    ax.spines["bottom"].set_color(HEX_BORDER)
    ax.yaxis.get_major_locator().set_params(integer=True)
    ax.grid(axis="y", linestyle="--", alpha=0.4, color=HEX_BORDER)
    ax.set_axisbelow(True)
    ax.legend(loc="upper right", frameon=True, facecolor="white", edgecolor=HEX_BORDER, fontsize=7.5)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=300, bbox_inches="tight", transparent=False, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Templates de Página A4 (~2cm de margem) com Cabeçalho e Rodapé
# ---------------------------------------------------------------------------
def draw_cover_canvas(canvas, doc):
    canvas.saveState()
    width, height = A4

    # Faixa superior institucional
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, height - 3.1 * cm, width, 3.1 * cm, stroke=0, fill=1)

    canvas.setFillColor(COLOR_ACCENT_TEAL)
    canvas.rect(0, height - 3.25 * cm, width, 0.15 * cm, stroke=0, fill=1)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(2.0 * cm, height - 1.35 * cm, "AUDITORIA DE SEGURANÇA DE APLICAÇÃO & BANCO DE DADOS (APPSEC / DEVSECOPS)")
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#94A3B8"))
    canvas.drawString(2.0 * cm, height - 2.05 * cm, f"Axir (FinançasNew) • Versão Auditada: {PROJECT_VERSION} • Classificação: Confidencial / Interno")
    canvas.drawRightString(width - 2.0 * cm, height - 2.05 * cm, f"Data: {REPORT_DATE}")

    # Rodapé da capa
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(2.0 * cm, 1.8 * cm, width - 2.0 * cm, 1.8 * cm)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawString(2.0 * cm, 1.25 * cm, REPORT_TITLE)
    canvas.drawRightString(width - 2.0 * cm, 1.25 * cm, f"Página {doc.page}")
    canvas.restoreState()


def draw_later_canvas(canvas, doc):
    canvas.saveState()
    width, height = A4

    # Cabeçalho
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(2.0 * cm, height - 1.55 * cm, width - 2.0 * cm, height - 1.55 * cm)

    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.drawString(2.0 * cm, height - 1.3 * cm, REPORT_TITLE)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawRightString(width - 2.0 * cm, height - 1.3 * cm, f"Data: {REPORT_DATE} • {PROJECT_VERSION}")

    # Rodapé
    canvas.line(2.0 * cm, 1.55 * cm, width - 2.0 * cm, 1.55 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawString(2.0 * cm, 1.1 * cm, "Auditoria Verificada Linha a Linha — RLS • Auth • IDOR • Secrets • XSS/CSP")
    canvas.drawRightString(width - 2.0 * cm, 1.1 * cm, f"Página {doc.page}")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Construção do Documento PDF
# ---------------------------------------------------------------------------
def build_styles():
    base = getSampleStyleSheet()
    styles = {}

    styles["CoverTitle"] = ParagraphStyle(
        "CoverTitle",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=23,
        textColor=COLOR_PRIMARY,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    styles["CoverSubtitle"] = ParagraphStyle(
        "CoverSubtitle",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13.5,
        textColor=COLOR_MUTED,
        alignment=TA_LEFT,
        spaceAfter=10,
    )
    styles["SectionH1"] = ParagraphStyle(
        "SectionH1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=17,
        textColor=COLOR_PRIMARY,
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True,
    )
    styles["SectionH2"] = ParagraphStyle(
        "SectionH2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13.5,
        textColor=COLOR_ACCENT_TEAL,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    styles["Body"] = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.4,
        textColor=COLOR_SECONDARY,
        alignment=TA_JUSTIFY,
        spaceAfter=5,
    )
    styles["BodyLeft"] = ParagraphStyle(
        "BodyLeft",
        parent=styles["Body"],
        alignment=TA_LEFT,
    )
    styles["Small"] = ParagraphStyle(
        "Small",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.5,
        textColor=COLOR_SECONDARY,
        alignment=TA_LEFT,
    )
    styles["MonoCell"] = ParagraphStyle(
        "MonoCell",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=7.0,
        leading=9.4,
        textColor=COLOR_PRIMARY,
        alignment=TA_LEFT,
        wordWrap="CJK",
    )
    styles["TableHeader"] = ParagraphStyle(
        "TableHeader",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.0,
        leading=10.0,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    styles["ChipText"] = ParagraphStyle(
        "ChipText",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=9.2,
        textColor=colors.white,
        alignment=TA_CENTER,
    )
    styles["IssueBlock"] = ParagraphStyle(
        "IssueBlock",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=6.8,
        leading=8.9,
        textColor=COLOR_PRIMARY,
        alignment=TA_LEFT,
    )
    return styles


def make_severity_chip(severity: str, styles) -> Table:
    bg = SEVERITY_COLORS.get(severity, COLOR_MUTED)
    chip_table = Table(
        [[Paragraph(escape(severity), styles["ChipText"])]],
        colWidths=[2.2 * cm],
        rowHeights=[0.55 * cm],
    )
    chip_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]
        )
    )
    return chip_table


def generate_pdf(output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()

    width, height = A4
    margin_x = 2.0 * cm
    margin_y = 2.0 * cm
    usable_w = width - 2 * margin_x

    cover_frame = Frame(
        margin_x,
        margin_y,
        usable_w,
        height - 3.65 * cm - margin_y,
        id="cover_frame",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    body_frame = Frame(
        margin_x,
        margin_y,
        usable_w,
        height - 2 * margin_y,
        id="body_frame",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=margin_x,
        rightMargin=margin_x,
        topMargin=margin_y,
        bottomMargin=margin_y,
        title=REPORT_TITLE,
        author="Auditoria Automatizada AppSec & DevSecOps",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover_canvas),
            PageTemplate(id="Body", frames=[body_frame], onPage=draw_later_canvas),
        ]
    )

    story = []

    # =========================================================================
    # a) CAPA: Título, Data, Escopo Auditado e Nota Metodológica
    # =========================================================================
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Relatório de Auditoria de Segurança — Axir (FinançasNew)", styles["CoverTitle"]))
    story.append(
        Paragraph(
            "Análise Exaustiva Linha a Linha: Isolamento Multi-Tenant (RLS), Controle de Acesso, "
            "IDOR, Gestão de Segredos e Sanitização de Inputs (XSS/CSP)",
            styles["CoverSubtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceBefore=2, spaceAfter=10))

    meta_data = [
        [
            Paragraph("<b>Projeto Auditado:</b> Axir (FinançasNew)", styles["Small"]),
            Paragraph(f"<b>Data da Auditoria:</b> {REPORT_DATE}", styles["Small"]),
            Paragraph(f"<b>Versão / Release:</b> {PROJECT_VERSION}", styles["Small"]),
        ],
        [
            Paragraph("<b>Banco &amp; Backend:</b> Supabase PostgreSQL 17 (64 tabelas, 138 migrações, 139 RPCs)", styles["Small"]),
            Paragraph("<b>Edge Runtime:</b> 9 Supabase Edge Functions (Deno 2) + 8 módulos _shared", styles["Small"]),
            Paragraph("<b>Frontend &amp; Mobile:</b> React 19.2 + Vite 8 + TS 6.0 + Capacitor 8 Android", styles["Small"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[usable_w / 3.0] * 3)
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph("1. Escopo Auditado", styles["SectionH1"]))
    story.append(
        Paragraph(
            "A auditoria percorreu 100% do código-fonte real do repositório, sem amostragem e sem especulação, cobrindo: "
            "<b>(i)</b> todas as 138 migrações SQL (<font face='Courier'>supabase/migrations/20260101000001_schema.sql</font> "
            "até <font face='Courier'>20260101000138_harden_notifications_broadcasts_and_lifecycle.sql</font>), totalizando "
            "64 tabelas em <font face='Courier'>public</font>, todas as políticas RLS, 28 triggers e 139 funções/RPCs SQL; "
            "<b>(ii)</b> todas as 9 Supabase Edge Functions (<font face='Courier'>admin-super-action</font>, "
            "<font face='Courier'>asaas-checkout</font>, <font face='Courier'>asaas-manage</font>, "
            "<font face='Courier'>asaas-webhook</font>, <font face='Courier'>billing-lifecycle-cron</font>, "
            "<font face='Courier'>push-dispatcher</font>, <font face='Courier'>quotes</font>, "
            "<font face='Courier'>sunday-digest</font>, <font face='Courier'>support-notify</font>) e módulos compartilhados; "
            "<b>(iii)</b> camada de roteamento, guardas de sessão/papel/MFA, repositórios PostgREST e RPCs no frontend React "
            "(<font face='Courier'>src/</font>); e <b>(iv)</b> scripts operacionais (<font face='Courier'>scripts/</font>), "
            "configurações Android/Gradle (<font face='Courier'>android/</font>), cabeçalhos HTTP/CSP "
            "(<font face='Courier'>public/_headers</font>), bundle compilado (<font face='Courier'>dist/</font>) e histórico Git.",
            styles["Body"],
        )
    )

    story.append(Paragraph("2. Nota Metodológica — Mapeamento das 5 Categorias para a Stack Detectada", styles["SectionH1"]))

    methodology_rows = [
        [
            Paragraph("<b>Categoria da Auditoria</b>", styles["TableHeader"]),
            Paragraph("<b>Equivalente na Stack Detectada (React 19 + Supabase Postgres/RLS + Deno Edge + Android)</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("<b>1. Banco Sem Tranca</b><br/>(Isolamento de Inquilino/Dono)", styles["Small"]),
            Paragraph(
                "Mecanismo primário: <b>Supabase Row Level Security (RLS)</b> + <font face='Courier'>FORCE ROW LEVEL SECURITY</font> "
                "nas 64 tabelas <font face='Courier'>public</font>, filtrando por <font face='Courier'>(SELECT auth.uid()) = user_id</font> "
                "ou funções de co-propriedade (<font face='Courier'>is_family_member</font>, <font face='Courier'>is_trip_member</font>), "
                "além de filtros explícitos de tenant dentro de RPCs declaradas como <font face='Courier'>SECURITY DEFINER</font>.",
                styles["Small"],
            ),
        ],
        [
            Paragraph("<b>2. Permissão Definida no Navegador</b>", styles["Small"]),
            Paragraph(
                "Cruzamento de cada gate do frontend (<font face='Courier'>RequireAdminSession</font>, <font face='Courier'>RequireActiveAccount</font>, "
                "<font face='Courier'>RequireFeature</font>, <font face='Courier'>ApkBetaRestrictedModal</font>, <font face='Courier'>useUserAccess</font>, "
                "<font face='Courier'>canManageRole</font>, <font face='Courier'>mfaRequired</font>) contra a validação equivalente no servidor: "
                "triggers (<font face='Courier'>protect_profile_security_fields</font>), policies RLS para <font face='Courier'>is_admin()</font>, "
                "travas <font face='Courier'>is_superadmin()</font> e <font face='Courier'>can_current_user_write_module()</font> nas RPCs e Edge Functions.",
                styles["Small"],
            ),
        ],
        [
            Paragraph("<b>3. IDOR</b><br/>(Insecure Direct Object Reference)", styles["Small"]),
            Paragraph(
                "Inspeção sistemática de todos os 9 handlers de Edge Functions, 139 funções/RPCs SQL e repositórios em "
                "<font face='Courier'>src/data/</font> que recebem IDs (<font face='Courier'>ticketId</font>, <font face='Courier'>p_user_id</font>, "
                "<font face='Courier'>p_family_id</font>, <font face='Courier'>p_trip_id</font>, <font face='Courier'>asset_id</font>, "
                "<font face='Courier'>expense_id</font>, <font face='Courier'>member_id</font>, <font face='Courier'>p_token</font>), "
                "verificando se validam posse/vínculo com o <font face='Courier'>auth.uid()</font> do chamador.",
                styles["Small"],
            ),
        ],
        [
            Paragraph("<b>4. Chaves Expostas</b><br/>(Hardcode &amp; Defaults)", styles["Small"]),
            Paragraph(
                "Varredura em arquivos <font face='Courier'>.env*</font>, <font face='Courier'>supabase/config.toml</font>, "
                "<font face='Courier'>scripts/*</font>, <font face='Courier'>android/app/build.gradle</font>, keystores, "
                "documentação técnica, validação de startup (<font face='Courier'>src/lib/env.ts</font>), bundle de produção "
                "(<font face='Courier'>dist/assets/*.js</font>) e histórico completo de commits do Git.",
                styles["Small"],
            ),
        ],
        [
            Paragraph("<b>5. Inputs Sem Tratamento</b><br/>(XSS &amp; HTML Injection)", styles["Small"]),
            Paragraph(
                "No frontend: busca por <font face='Courier'>dangerouslySetInnerHTML</font>, <font face='Courier'>innerHTML</font>, "
                "<font face='Courier'>eval</font>, URLs dinâmicas em <font face='Courier'>href</font>/<font face='Courier'>window.open</font>/"
                "<font face='Courier'>location.href</font>, Service Worker (<font face='Courier'>sw-push.js</font>), exportadores XML/Excel "
                "e CSP (<font face='Courier'>public/_headers</font>). No backend: templates de e-mail HTML (Resend) e mensagens HTML do Telegram.",
                styles["Small"],
            ),
        ],
    ]

    meth_table = Table(methodology_rows, colWidths=[4.3 * cm, usable_w - 4.3 * cm])
    meth_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_BG]),
                ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(meth_table)

    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # =========================================================================
    # b) RESUMO EXECUTIVO: Totais, Gráfico de Rosca e Gráfico de Barras
    # =========================================================================
    story.append(Paragraph("3. Resumo Executivo", styles["SectionH1"]))
    story.append(
        Paragraph(
            "Foram identificados e verificados no código real <b>16 achados de segurança</b> (distribuídos em "
            "<b>3 Críticos</b>, <b>4 Altos</b>, <b>5 Médios</b> e <b>4 Baixos</b>), além de <b>7 conjuntos de Pontos Fortes</b> "
            "comprovados com evidência de código. Os riscos mais severos concentram-se no uso de <font face='Courier'>current_user</font> "
            "dentro de funções PostgreSQL <font face='Courier'>SECURITY DEFINER</font> (que neutraliza o trigger de proteção de "
            "<font face='Courier'>public.profiles</font>, permitindo auto-promoção a <font face='Courier'>superadmin</font>) e em "
            "condições tautológicas nas políticas RLS de colaboração (<font face='Courier'>family_invites</font>, "
            "<font face='Courier'>family_members</font> e <font face='Courier'>trip_members</font>).",
            styles["Body"],
        )
    )

    kpi_rows = [
        [
            Paragraph("<b>CRÍTICA (#B91C1C)</b>", styles["ChipText"]),
            Paragraph("<b>ALTA (#EA580C)</b>", styles["ChipText"]),
            Paragraph("<b>MÉDIA (#D97706)</b>", styles["ChipText"]),
            Paragraph("<b>BAIXA (#2563EB)</b>", styles["ChipText"]),
            Paragraph("<b>PONTOS FORTES (#059669)</b>", styles["ChipText"]),
        ],
        [
            Paragraph("<font size='14'><b>3</b></font><br/><font size='7'>F-01, F-02, F-04</font>", styles["ChipText"]),
            Paragraph("<font size='14'><b>4</b></font><br/><font size='7'>F-05, F-06, F-10, F-13</font>", styles["ChipText"]),
            Paragraph("<font size='14'><b>5</b></font><br/><font size='7'>F-03, F-07, F-08, F-09, F-11</font>", styles["ChipText"]),
            Paragraph("<font size='14'><b>4</b></font><br/><font size='7'>F-12, F-14, F-15, F-16</font>", styles["ChipText"]),
            Paragraph("<font size='14'><b>7</b></font><br/><font size='7'>Controles Verificados</font>", styles["ChipText"]),
        ],
    ]
    kpi_table = Table(kpi_rows, colWidths=[usable_w / 5.0] * 5)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), COLOR_CRITICAL),
                ("BACKGROUND", (1, 0), (1, -1), COLOR_HIGH),
                ("BACKGROUND", (2, 0), (2, -1), COLOR_MEDIUM),
                ("BACKGROUND", (3, 0), (3, -1), COLOR_LOW),
                ("BACKGROUND", (4, 0), (4, -1), COLOR_STRENGTH),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.white),
                ("INNERGRID", (0, 0), (-1, -1), 1.5, colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 0.3 * cm))

    donut_buf = build_donut_chart_by_severity()
    bar_buf = build_bar_chart_by_category()

    donut_img = Image(donut_buf, width=8.1 * cm, height=5.8 * cm)
    bar_img = Image(bar_buf, width=8.5 * cm, height=5.8 * cm)

    charts_table = Table([[donut_img, bar_img]], colWidths=[8.3 * cm, usable_w - 8.3 * cm])
    charts_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(charts_table)
    story.append(Spacer(1, 0.35 * cm))

    # =========================================================================
    # c) PONTOS FORTES E PONTOS FRACOS
    # =========================================================================
    story.append(Paragraph("4. Pontos Fortes Verificados (O Que Está Protegido) &amp; Pontos Fracos Centrais", styles["SectionH1"]))
    story.append(
        Paragraph(
            "A tabela abaixo documenta os controles que foram auditados e estão <b>corretamente implementados</b> no código, "
            "comprovando a profundidade e cobertura da auditoria:",
            styles["Body"],
        )
    )

    strength_rows = [
        [
            Paragraph("<b>Status</b>", styles["TableHeader"]),
            Paragraph("<b>Domínio / Controle Verificado</b>", styles["TableHeader"]),
            Paragraph("<b>Evidência (Arquivo:Linha) &amp; Comprovação Técnica</b>", styles["TableHeader"]),
        ]
    ]
    for s in STRENGTHS:
        strength_rows.append(
            [
                make_severity_chip("PONTO FORTE", styles),
                Paragraph(f"<b>{escape(s['category'])}</b>", styles["Small"]),
                Paragraph(
                    f"<font face='Courier' size='7'>{escape(s['file_line']).replace(chr(10), '<br/>')}</font><br/>"
                    f"{escape(s['description'])}",
                    styles["Small"],
                ),
            ]
        )

    strength_table = Table(strength_rows, colWidths=[2.5 * cm, 4.1 * cm, usable_w - 6.6 * cm], repeatRows=1)
    strength_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_STRENGTH),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_BG]),
                ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(strength_table)
    story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("Síntese dos Pontos Fracos (Riscos Centrais):", styles["SectionH2"]))
    weaknesses_summary = [
        "<b>1. Semântica de <font face='Courier'>current_user</font> em funções <font face='Courier'>SECURITY DEFINER</font> (F-04, F-05):</b> O uso de <font face='Courier'>current_user IN ('postgres', 'supabase_admin')</font> dentro de funções <font face='Courier'>SECURITY DEFINER</font> avalia sempre como verdadeiro, desativando completamente o trigger <font face='Courier'>protect_profile_security_fields()</font> e permitindo auto-promoção para <font face='Courier'>superadmin</font>.",
        "<b>2. Condições RLS disjuntivas (<font face='Courier'>OR auth.uid() IS NOT NULL</font> / <font face='Courier'>user_id = auth.uid()</font>) em tabelas colaborativas (F-01, F-02):</b> As políticas de <font face='Courier'>family_invites</font>, <font face='Courier'>family_members</font> e <font face='Courier'>trip_members</font> permitem vazamento de convites e auto-inclusão não autorizada em famílias e viagens alheias.",
        "<b>3. Descompasso entre travas das RPCs Admin e políticas RLS das tabelas subjacentes (F-06, F-08):</b> As RPCs validam <font face='Courier'>is_superadmin()</font> e gravam auditoria, mas as tabelas permitem <font face='Courier'>FOR ALL USING (is_admin())</font> direto via PostgREST.",
        "<b>4. Higiene de migrações SQL com sobrecarga de parâmetros e credencial de Keystore em script/histórico (F-07, F-13):</b> Mudanças de assinatura de RPCs sem <font face='Courier'>DROP FUNCTION</font> deixaram versões antigas sem senha/trava SaaS ativas, e a senha da keystore Android (<font face='Courier'>guiafinanceiro123</font>) permaneceu em script e documentação.",
    ]
    for w_text in weaknesses_summary:
        story.append(Paragraph(f"• {w_text}", styles["BodyLeft"]))

    story.append(PageBreak())

    # =========================================================================
    # d) TABELA DE ACHADOS DETALHADOS POR CATEGORIA
    # =========================================================================
    story.append(Paragraph("5. Tabela de Achados Detalhados por Categoria", styles["SectionH1"]))
    story.append(
        Paragraph(
            "Todos os 16 achados abaixo foram verificados diretamente no código-fonte. Cada linha indica o chip colorido "
            "de severidade, o caminho exato do arquivo com número(s) de linha e a descrição técnica da falha e sua explorabilidade.",
            styles["Body"],
        )
    )

    cat_titles = {
        1: "Categoria 1 — BANCO SEM TRANCA (Isolamento de Inquilino / Dono / RLS)",
        2: "Categoria 2 — PERMISSÃO DEFINIDA NO NAVEGADOR (Bypass de Papel / Escalada no Servidor)",
        3: "Categoria 3 — IDOR (Insecure Direct Object Reference)",
        4: "Categoria 4 — CHAVES EXPOSTAS (Hardcode, Defaults Inseguros e Histórico Git)",
        5: "Categoria 5 — INPUTS SEM TRATAMENTO (XSS, Injeção HTML e Validação de URLs/CSP)",
    }

    for cat_num in range(1, 6):
        story.append(Paragraph(cat_titles[cat_num], styles["SectionH2"]))
        cat_findings = [f for f in FINDINGS if f["category_num"] == cat_num]

        rows = [
            [
                Paragraph("<b>Severidade</b>", styles["TableHeader"]),
                Paragraph("<b>Arquivo:Linha</b>", styles["TableHeader"]),
                Paragraph("<b>Descrição Verificada &amp; Explorabilidade</b>", styles["TableHeader"]),
            ]
        ]

        for f in cat_findings:
            file_html = "<br/>".join(escape(line) for line in f["file_line"].split("\n"))
            desc_html = f"<b>[{escape(f['id'])}] {escape(f['title'])}</b><br/>{escape(f['description'])}"
            rows.append(
                [
                    make_severity_chip(f["severity"], styles),
                    Paragraph(file_html, styles["MonoCell"]),
                    Paragraph(desc_html, styles["Small"]),
                ]
            )

        t = Table(rows, colWidths=[2.45 * cm, 5.55 * cm, usable_w - 8.0 * cm], repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_BG]),
                    ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 0.25 * cm))

    # =========================================================================
    # e) RECOMENDAÇÕES PRIORIZADAS (P1, P2, P3)
    # =========================================================================
    story.append(Paragraph("6. Recomendações Priorizadas (Plano de Remediação)", styles["SectionH1"]))
    for priority_title, priority_hex, items in RECOMMENDATIONS:
        p_color = colors.HexColor(priority_hex)
        rec_rows = [[Paragraph(f"<b>{escape(priority_title)}</b>", styles["TableHeader"])]]
        for idx, item in enumerate(items, start=1):
            rec_rows.append([Paragraph(f"<b>{idx}.</b> {escape(item)}", styles["Small"])])

        rec_table = Table(rec_rows, colWidths=[usable_w])
        rec_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), p_color),
                    ("BACKGROUND", (0, 1), (-1, -1), COLOR_LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.8, p_color),
                    ("INNERGRID", (0, 1), (-1, -1), 0.4, COLOR_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(KeepTogether([rec_table, Spacer(1, 0.22 * cm)]))

    story.append(PageBreak())

    # =========================================================================
    # f) SEÇÃO "ISSUES PARA O GITHUB" (Prontas para Copiar e Colar)
    # =========================================================================
    story.append(Paragraph("7. ISSUES PARA O GITHUB (Markdown Completo Pronto para Copiar e Colar)", styles["SectionH1"]))
    story.append(
        Paragraph(
            "Abaixo estão as <b>8 Issues acionáveis</b> (agrupando de forma coesa os 16 achados por causa-raiz para evitar spam), "
            "delimitadas individualmente entre <font face='Courier'>--- ISSUE n ---</font> e "
            "<font face='Courier'>--- FIM ISSUE n ---</font>:",
            styles["Body"],
        )
    )

    def wrap_md_chunk(chunk_text: str) -> str:
        wrapped = []
        for raw_line in chunk_text.split("\n"):
            if len(raw_line) <= 104:
                wrapped.append(raw_line)
            else:
                words = raw_line.split(" ")
                curr = ""
                for w in words:
                    if len(curr) + len(w) + 1 <= 104:
                        curr = f"{curr} {w}" if curr else w
                    else:
                        if curr:
                            wrapped.append(curr)
                        while len(w) > 104:
                            wrapped.append(w[:104])
                            w = w[104:]
                        curr = w
                if curr:
                    wrapped.append(curr)
        return "<br/>".join(escape(line).replace("  ", "&nbsp;&nbsp;") for line in wrapped)

    for issue in GITHUB_ISSUES:
        n = issue["number"]
        checklist_lines = "\n".join(f"- [ ] {c}" for c in issue["acceptance_criteria"])

        chunk_1 = (
            f"--- ISSUE {n} ---\n"
            f"# {issue['title']}\n\n"
            f"**Labels sugeridas:** `{issue['labels']}`\n\n"
            f"## Descrição do Problema e Explorabilidade\n"
            f"{issue['problem']}"
        )
        chunk_2 = (
            f"## Evidência (Arquivo:Linha e Trecho de Código)\n"
            f"{issue['evidence']}"
        )
        chunk_3 = (
            f"## Impacto\n"
            f"{issue['impact']}\n\n"
            f"## Sugestão de Correção\n"
            f"{issue['fix']}\n\n"
            f"## Critérios de Aceite\n"
            f"{checklist_lines}\n"
            f"--- FIM ISSUE {n} ---"
        )

        issue_table = Table(
            [
                [Paragraph(f"<b>ISSUE #{n} — {escape(issue['title'])}</b>", styles["TableHeader"])],
                [Paragraph(wrap_md_chunk(chunk_1), styles["IssueBlock"])],
                [Paragraph(wrap_md_chunk(chunk_2), styles["IssueBlock"])],
                [Paragraph(wrap_md_chunk(chunk_3), styles["IssueBlock"])],
            ],
            colWidths=[usable_w],
        )
        issue_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_SECONDARY),
                    ("BACKGROUND", (0, 1), (-1, -1), COLOR_LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.7, COLOR_BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.7, COLOR_SECONDARY),
                    ("TOPPADDING", (0, 0), (-1, 0), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                    ("TOPPADDING", (0, 1), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("NOSPLIT", (0, 0), (-1, 1)),
                ]
            )
        )
        story.append(issue_table)
        story.append(Spacer(1, 0.3 * cm))

    doc.build(story)


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[2]
    pdf_out = repo_root / "docs" / "security-audit" / "relatorio-auditoria-seguranca.pdf"
    generate_pdf(pdf_out)
    print(f"[OK] Relatório PDF gerado com sucesso em: {pdf_out} ({pdf_out.stat().st_size} bytes)")
