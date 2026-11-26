#!/usr/bin/env python3
"""
Gerador do Relatório de Auditoria de Segurança — Axir (v3.30.0)
Gera gráficos de alta resolução (matplotlib) e compila o PDF A4 (ReportLab)
em docs/security-audit/relatorio-auditoria-seguranca.pdf.

Uso:
    .venv/bin/python docs/security-audit/generate_report.py
"""

from __future__ import annotations

import os
from pathlib import Path
from xml.sax.saxutils import escape

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Caminhos e Paleta Oficial
# ---------------------------------------------------------------------------
OUT_DIR = Path(__file__).resolve().parent
PDF_PATH = OUT_DIR / "relatorio-auditoria-seguranca.pdf"
CHART_DONUT_PATH = OUT_DIR / "_chart_severity_donut.png"
CHART_BAR_PATH = OUT_DIR / "_chart_category_bar.png"

HEX_CRITICAL = "#B91C1C"
HEX_HIGH = "#EA580C"
HEX_MEDIUM = "#D97706"
HEX_LOW = "#2563EB"
HEX_STRENGTH = "#059669"

HEX_INK = "#0F172A"
HEX_SLATE = "#334155"
HEX_MUTED = "#64748B"
HEX_BORDER = "#CBD5E1"
HEX_SURFACE = "#F8FAFC"
HEX_SURFACE_ALT = "#F1F5F9"
HEX_BRAND = "#142531"
HEX_ACCENT = "#1B6B62"

SEV_COLORS = {
    "Crítica": HEX_CRITICAL,
    "Alta": HEX_HIGH,
    "Média": HEX_MEDIUM,
    "Baixa": HEX_LOW,
}

# ---------------------------------------------------------------------------
# Dados Verificados da Auditoria
# ---------------------------------------------------------------------------
AUDIT_DATE = "25/11/2026"
PROJECT_NAME = "Axir"
PROJECT_VERSION = "3.30.0"

SEVERITY_COUNTS = {
    "Crítica": 0,
    "Alta": 2,
    "Média": 4,
    "Baixa": 5,
}

CATEGORY_BREAKDOWN = [
    ("1. Banco sem Tranca\n(RLS / Isolamento)", 0, 1, 0, 0),
    ("2. Permissão no\nNavegador", 0, 1, 1, 1),
    ("3. IDOR /\nObjetos por ID", 0, 0, 1, 1),
    ("4. Chaves Expostas\n(Hardcode / Git)", 0, 0, 1, 1),
    ("5. Inputs sem\nTratamento (XSS)", 0, 0, 1, 2),
]

STRENGTHS = [
    (
        "Cobertura total de RLS em todas as 69 tabelas ativas",
        "Verificação automatizada das 157 migrations confirmou ENABLE ROW LEVEL SECURITY em 100% das 69 tabelas ativas do schema public, sem nenhuma política USING (true) ou exposição de tabelas privadas a anon/public.",
    ),
    (
        "Isolamento anti-IDOR nas mutações financeiras e Edge Functions",
        "Todas as RPCs financeiras críticas (commit_statement_reconciliation, rollover_card_bill, delete_expense_installments, delete_category_migrate, renegotiate_loan_contract, unlink_trip_member) validam posse via auth.uid() e/ou is_trip_host/is_family_admin. A Edge Function support-notify (linhas 149-163) valida explicitamente ticket.user_id !== user.id.",
    ),
    (
        "Hardening dos helpers SECURITY DEFINER e funções *_system",
        "Helpers de autorização (get_user_module_access, is_family_member, is_family_admin, is_trip_member, is_trip_host, can_access_trip_expense) impedem consulta de outro p_user_id por usuários comuns (migrations 0139 e 0157). Todas as funções *_system e rate limits têm REVOKE ALL FROM PUBLIC, anon, authenticated e GRANT exclusivo a service_role.",
    ),
    (
        "Segurança de Webhook, Criptografia de Comparação e Bundle Limpo",
        "asaas-webhook, push-dispatcher, quotes, billing-lifecycle-cron, sunday-digest e support-notify usam comparação timing-safe via SHA-256 (timingSafeEqualString em _shared/http.ts:213). O bundle dist/assets/ contém apenas a chave pública anon do Supabase, sem segredos de servidor; .env e .env.migration permanecem fora do Git.",
    ),
    (
        "Proteção robusta contra XSS, CSP rigorosa e Templates Escapados",
        "Zero ocorrências de dangerouslySetInnerHTML, innerHTML em produção, document.write, eval ou new Function em src/. Todos os 9 templates HTML em _shared/email-templates.ts usam escapeHtmlText() e sanitizeSafeEmailUrl(); _shared/telegram.ts usa escapeTelegramHtml(); public/_headers impõe CSP estrita (object-src 'none', frame-ancestors 'none') e sw-push.js restringe navegação à mesma origem.",
    ),
]

WEAKNESSES = [
    "Inconsistência na verificação de status = 'active' para administradores: 6 políticas RLS em 5 tabelas e 2 RPCs de superadmin (admin_delete_user e admin_reset_user_mfa) verificam apenas a coluna role, permitindo que um operador suspenso ou banido mantenha privilégios diretos via PostgREST.",
    "Lacuna de MFA AAL2 em RPCs destrutivas de superadmin: enquanto a Edge Function admin-super-action e a RPC admin_get_user_contact_details exigem AAL2, as RPCs admin_delete_user e admin_reset_user_mfa aceitam sessões AAL1 diretamente no PostgREST.",
    "Validação incompleta de permissões de escrita e URLs em recursos recentes: blueprints de faturas (migration 0156) aceitam escrita de contas read_only; o atualizador (update-schema.ts / update-checker.ts) e a RPC pública de viagens (add_public_trip_expense) não validam o protocolo https:// em URLs externas.",
    "Defesa contra força bruta ausente em passcodes de viagens públicas (RPCs anon sem rate limit e com fallback legado em texto plano) e credencial histórica da keystore Android (guiafinanceiro123) ainda presente em commits antigos do Git.",
]

FINDINGS_BY_CATEGORY = [
    (
        "Categoria 1 — Banco sem Tranca (Isolamento de Inquilino / Dono)",
        [
            {
                "id": "F-01",
                "severity": "Alta",
                "location": (
                    "supabase/migrations/20260101000060_support_tickets.sql:69-77\n"
                    "supabase/migrations/20260101000062_purge_legacy_cash_transactions.sql:56-83, 122-131\n"
                    "supabase/migrations/20260101000104_billing_refinements_and_audit_logs.sql:22-30\n"
                    "supabase/migrations/20260101000115_billing_intents_and_notifications.sql:37-46"
                ),
                "summary": "6 políticas RLS administrativas em 5 tabelas não verificam status = 'active'",
                "detail": (
                    "As políticas em support_tickets (FOR ALL), admin_telegram_settings (SELECT/ALL), "
                    "app_analytics_events (SELECT), billing_webhook_logs (SELECT) e billing_intents (SELECT) "
                    "usam subquery inline checando apenas role IN ('admin', 'superadmin'), sem chamar "
                    "public.is_admin() (que exige status = 'active'). Um administrador suspenso ou banido "
                    "mantém leitura cross-tenant de faturamento/chamados e escrita em tickets e alertas do Telegram."
                ),
            },
        ],
    ),
    (
        "Categoria 2 — Permissão Definida no Navegador",
        [
            {
                "id": "F-02",
                "severity": "Alta",
                "location": (
                    "supabase/migrations/20260101000153_harden_billing_rls_pii_and_lifecycle.sql:711-735\n"
                    "supabase/migrations/20260101000111_security_hardening_audit.sql:10-29"
                ),
                "summary": "admin_delete_user e admin_reset_user_mfa não exigem status = 'active' nem MFA AAL2",
                "detail": (
                    "O frontend (RequireAdminSession em require-admin-session.tsx:33-35) e a Edge Function "
                    "admin-super-action (index.ts:77-116) exigem status ativo e MFA AAL2. Porém, as RPCs "
                    "SECURITY DEFINER admin_delete_user e admin_reset_user_mfa (ambas com GRANT EXECUTE TO authenticated) "
                    "consultam apenas profiles.role = 'superadmin'. Um superadmin suspenso ou token AAL1 vazado "
                    "pode apagar qualquer usuário (inclusive outro superadmin) ou resetar 2FA direto via PostgREST."
                ),
            },
            {
                "id": "F-03",
                "severity": "Média",
                "location": (
                    "supabase/migrations/20260101000156_statement_layout_blueprints.sql:222-254\n"
                    "supabase/migrations/20260101000156_statement_layout_blueprints.sql:455-483"
                ),
                "summary": "RPCs de blueprints de fatura permitem escrita por contas read_only",
                "detail": (
                    "A UI restringe a importação de faturas a contas com permissão de escrita em 'cards'. "
                    "Entretanto, upsert_statement_layout_blueprint e record_statement_blueprint_outcome "
                    "verificam apenas is_current_user_active(), omitindo can_current_user_write_module('cards') "
                    "(presente em commit_statement_reconciliation e rollover_card_bill), permitindo que contas "
                    "expiradas/canceladas criem blueprints e gravem votos no banco."
                ),
            },
            {
                "id": "F-04",
                "severity": "Baixa",
                "location": (
                    "src/app/router.tsx:365-377\n"
                    "src/features/admin/layouts/admin-shell.tsx:208\n"
                    "src/features/admin/layouts/admin-mobile-drawer.tsx:95"
                ),
                "summary": "Rota /admin/laboratorio-forense oculta para admin apenas no menu lateral",
                "detail": (
                    "O item de navegação do Laboratório Forense é condicionado a {isSuperAdmin && ...}, "
                    "mas a rota /admin/laboratorio-forense está protegida apenas por RequireAdminSession "
                    "(que autoriza role = 'admin'). Como o módulo executa simulações locais em memória sem "
                    "mutação direta de dados reais, o risco é baixo, mas há divergência entre UI e guarda de rota."
                ),
            },
        ],
    ),
    (
        "Categoria 3 — IDOR (Referência Direta Insegura a Objetos)",
        [
            {
                "id": "F-05",
                "severity": "Média",
                "location": (
                    "supabase/migrations/20260101000099_harden_security_and_lgpd_cascade.sql:163-175\n"
                    "supabase/migrations/20260101000139_security_audit_remediation_and_rls_hardening.sql:1695-1704\n"
                    "supabase/migrations/20260101000098_create_expense_with_debt_mode.sql:234-243"
                ),
                "summary": "Passcode de viagens públicas sem rate limit e com fallback em texto plano",
                "detail": (
                    "As RPCs get_public_trip_ledger, add_public_trip_expense (ambas acessíveis a anon) e "
                    "claim_trip_member (authenticated) não aplicam rate limiting ou lockout em tentativas "
                    "de p_passcode, além de manterem comparação não-constante em texto plano (else v_trip.passcode_hash <> p_passcode). "
                    "De posse do public_token, um atacante pode forçar PINs curtos para ler chaves Pix/despesas ou reivindicar participantes."
                ),
            },
            {
                "id": "F-06",
                "severity": "Baixa",
                "location": "supabase/functions/quotes/index.ts:2166-2219",
                "summary": "Oráculo cross-tenant de existência de tickers na Edge Function quotes",
                "detail": (
                    "Para usuários autenticados comuns (modo swr), a Edge Function consulta portfolio_assets "
                    "com service_role sem filtrar por user_id (linhas 2170-2177) para montar persistableSet "
                    "e descarta tickers ausentes (linhas 2202-2218). Isso permite sondar se algum usuário da "
                    "plataforma detém determinado ticker em carteira (retorna cotação vs. lista vazia)."
                ),
            },
        ],
    ),
    (
        "Categoria 4 — Chaves Expostas (Hardcode, Defaults e Histórico Git)",
        [
            {
                "id": "F-07",
                "severity": "Média",
                "location": (
                    "git commit 6520f08f..bdfac1a8 — scripts/build-apk.sh:15\n"
                    "git commit 6520f08f..bdfac1a8 — android/app/build.gradle:25, 27"
                ),
                "summary": "Senha padrão de keystore Android (guiafinanceiro123) exposta no histórico Git",
                "detail": (
                    "Commits anteriores ao hardening (a93d82e8) embutiram a senha padrão 'guiafinanceiro123' "
                    "como fallback em build-apk.sh e build.gradle. Embora o HEAD rejeite essa senha no startup, "
                    "ela permanece recuperável no histórico Git; se o arquivo release-key.keystore não teve "
                    "a senha rotacionada e for vazado, permite assinar APKs maliciosos como atualização oficial."
                ),
            },
            {
                "id": "F-08",
                "severity": "Baixa",
                "location": "scripts/deploy-quotes.mjs:70, 108, 125, 142, 159",
                "summary": "Script de agendamento pg_cron embute SUPABASE_SERVICE_ROLE_KEY em vez de CRON_SECRET",
                "detail": (
                    "Diferente de scripts/notifications-cron.mjs:41 (que prioriza CRON_SECRET), deploy-quotes.mjs "
                    "gera SQL de 4 jobs pg_cron embutindo SUPABASE_SERVICE_ROLE_KEY em texto plano nos headers "
                    "do net.http_post, embora a Edge Function quotes já aceite CRON_SECRET (quotes/index.ts:602, 613-615). "
                    "Qualquer exposição de cron.job ou backup SQL comprometeria a chave mestra do banco."
                ),
            },
        ],
    ),
    (
        "Categoria 5 — Inputs sem Tratamento (XSS, Protocolos e Exportação)",
        [
            {
                "id": "F-09",
                "severity": "Média",
                "location": (
                    "src/services/native/update-schema.ts:8\n"
                    "src/services/native/update-checker.ts:28-32, 222-229"
                ),
                "summary": "URL de atualização (apkUrl) sem validação de protocolo https:// em link.href e window.open",
                "detail": (
                    "AppVersionManifestSchema valida apkUrl apenas como z.string().min(1). Em triggerAppUpdate() "
                    "(linha 223) e AppUpdatePlugin.web.downloadAndInstall() (linha 30), a URL vinda do manifesto "
                    "remoto version.json é passada diretamente a link.href + link.click() e window.open(), "
                    "sem exigir https:// (contrariando o bloqueio contra javascript: já aplicado em AppDownloadModal)."
                ),
            },
            {
                "id": "F-10",
                "severity": "Baixa",
                "location": "src/features/admin/pages/admin-security-page.tsx:24-26, 47-63",
                "summary": "Ausência de neutralização de CSV Formula Injection na exportação de auditoria",
                "detail": (
                    "A função toCsvRow escapa apenas aspas duplas, sem neutralizar valores iniciados por "
                    "=, +, -, @, TAB ou CR. Como audit_events contém campos influenciados por usuários finais, "
                    "ao abrir o arquivo auditoria-YYYY-MM-DD.csv no Excel/Calc, fórmulas injetadas podem ser executadas."
                ),
            },
            {
                "id": "F-11",
                "severity": "Baixa",
                "location": "supabase/migrations/20260101000139_security_audit_remediation_and_rls_hardening.sql:1655, 1768",
                "summary": "RPC anônima add_public_trip_expense persiste p_receipt_url sem validar esquema https://",
                "detail": (
                    "Qualquer detentor do link público de viagem (anon) pode gravar strings arbitrárias "
                    "(ex.: javascript:... ou URLs externas) na coluna trip_expenses.receipt_url. Hoje a UI "
                    "não renderiza receipt_url como link clicável (mitigando exploração imediata), mas constitui "
                    "risco latente de Stored XSS caso um visualizador de comprovantes seja adicionado."
                ),
            },
        ],
    ),
]

PRIORITIZED_RECS = [
    (
        "P1 — Imediato (Alta Severidade)",
        HEX_HIGH,
        [
            "Criar migration corretiva substituindo as 6 políticas RLS administrativas inline (support_tickets, admin_telegram_settings, app_analytics_events, billing_webhook_logs, billing_intents) por public.is_admin().",
            "Endurecer admin_delete_user e admin_reset_user_mfa com public.is_superadmin(), exigir auth.jwt() ->> 'aal' = 'aal2' (quando o operador possuir MFA verificado) e impedir que um superadmin exclua outro superadmin sem fluxo dedicado.",
        ],
    ),
    (
        "P2 — Curto Prazo (Média Severidade)",
        HEX_MEDIUM,
        [
            "Adicionar verificação public.can_current_user_write_module('cards') em upsert_statement_layout_blueprint e record_statement_blueprint_outcome.",
            "Implementar rate limiting por token/IP nas RPCs públicas de viagem com passcode e remover o fallback de comparação em texto plano após migrar eventuais hashes legados para bcrypt.",
            "Validar protocolo https:// (e allowlist de host R2/domínio próprio) em AppVersionManifestSchema.apkUrl, triggerAppUpdate() e AppUpdatePlugin.web.downloadAndInstall().",
            "Confirmar rotação da senha da keystore Android de produção (garantindo que 'guiafinanceiro123' não seja válida em nenhuma cópia da keystore) e avaliar limpeza de histórico com git-filter-repo se o repositório se tornar compartilhado.",
        ],
    ),
    (
        "P3 — Defesa em Profundidade (Baixa Severidade)",
        HEX_LOW,
        [
            "Atualizar scripts/deploy-quotes.mjs para priorizar CRON_SECRET (como notifications-cron.mjs) em vez de embutir SUPABASE_SERVICE_ROLE_KEY no pg_cron.",
            "Restringir persistableSet na Edge Function quotes aos tickers do próprio usuário (ou retornar cotação pública sem filtrar existência na base global) para eliminar o oráculo cross-tenant.",
            "Neutralizar CSV Formula Injection em AdminSecurityPage (prefixar com apóstrofo valores iniciados por =, +, -, @, TAB, CR), validar p_receipt_url com ^https:// em add_public_trip_expense e exigir isSuperAdmin na rota /admin/laboratorio-forense.",
        ],
    ),
]

GITHUB_ISSUES = [
    {
        "num": 1,
        "title": "[Segurança] Exigir status = 'active' (public.is_admin()) nas políticas RLS administrativas de 5 tabelas",
        "labels": "security, high, database, rls",
        "body": """### Título
[Segurança] Exigir status = 'active' (public.is_admin()) nas políticas RLS administrativas de 5 tabelas

### Labels sugeridas
`security`, `high`

### Descrição do problema e explorabilidade
Seis políticas RLS administrativas em cinco tabelas verificam apenas `profiles.role IN ('admin', 'superadmin')` via subquery inline, sem checar `profiles.status = 'active'` (ao contrário de `public.is_admin()`). Caso uma conta administrativa seja suspensa ou banida sem rebaixamento prévio de `role`, o operador mantém acesso direto via PostgREST para ler e modificar `support_tickets` de todos os usuários, alterar `admin_telegram_settings` (inclusive ativar `silent_mode`) e consultar `billing_webhook_logs`, `billing_intents` e `app_analytics_events` de toda a base.

### Evidência
- `supabase/migrations/20260101000060_support_tickets.sql:69-77`
- `supabase/migrations/20260101000062_purge_legacy_cash_transactions.sql:56-83, 122-131`
- `supabase/migrations/20260101000104_billing_refinements_and_audit_logs.sql:22-30`
- `supabase/migrations/20260101000115_billing_intents_and_notifications.sql:37-46`

```sql
-- Exemplo em 20260101000060_support_tickets.sql:69-77
create policy "Admins can view and manage all support tickets"
  on public.support_tickets for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'superadmin')
    )
  )
```

### Impacto
Vazamento de dados financeiros/suporte cross-tenant e alteração não autorizada de chamados e alertas do fundador por administradores suspensos ou banidos.

### Sugestão de correção
Criar uma nova migration substituindo as 6 políticas para utilizar `(select public.is_admin())` (que exige `role IN ('admin', 'superadmin') AND status = 'active'`).

### Critérios de aceite
- [ ] Nova migration recria as 6 políticas em `support_tickets`, `admin_telegram_settings`, `app_analytics_events`, `billing_webhook_logs` e `billing_intents` usando `(select public.is_admin())`.
- [ ] Teste SQL/integração confirma que um usuário com `role = 'admin'` e `status = 'suspended'` recebe 0 linhas em SELECT e erro de RLS em UPDATE/DELETE nessas 5 tabelas.
- [ ] Administradores com `status = 'active'` continuam operando normalmente no console `/admin`.""",
    },
    {
        "num": 2,
        "title": "[Segurança] Exigir status ativo e MFA AAL2 em admin_delete_user e admin_reset_user_mfa",
        "labels": "security, high, database, auth",
        "body": """### Título
[Segurança] Exigir status ativo e MFA AAL2 em admin_delete_user e admin_reset_user_mfa

### Labels sugeridas
`security`, `high`

### Descrição do problema e explorabilidade
O frontend (`RequireAdminSession`) e a Edge Function `admin-super-action` exigem conta ativa e MFA AAL2 para ações de superadmin. Entretanto, as RPCs `SECURITY DEFINER` `admin_delete_user` e `admin_reset_user_mfa` estão expostas a `authenticated` no PostgREST e verificam apenas `profiles.role = 'superadmin'`, sem checar `status = 'active'` e sem exigir `auth.jwt() ->> 'aal' = 'aal2'`. Um superadmin suspenso ou um atacante com token AAL1 (antes do 2FA) pode invocar essas RPCs diretamente para excluir contas (inclusive outros superadmins) ou remover fatores 2FA de qualquer usuário.

### Evidência
- `supabase/migrations/20260101000153_harden_billing_rls_pii_and_lifecycle.sql:711-735` (`admin_delete_user`)
- `supabase/migrations/20260101000111_security_hardening_audit.sql:10-29` (`admin_reset_user_mfa`)

```sql
-- 20260101000153_harden_billing_rls_pii_and_lifecycle.sql:727-730
SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
IF v_caller_role IS DISTINCT FROM 'superadmin' THEN
  RAISE EXCEPTION 'Apenas superadministradores podem excluir contas de outros usuários.';
END IF;
```

### Impacto
Exclusão irreversível de contas (incluindo outros superadmins) ou remoção de 2FA sem verificação de segundo fator ou por conta administrativa suspensa.

### Sugestão de correção
1. Substituir a verificação manual por `IF NOT public.is_superadmin() THEN RAISE EXCEPTION ...`.
2. Validar MFA AAL2 (`coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'`) sempre que o superadmin possuir fator verificado em `auth.mfa_factors` (ou exigir AAL2 incondicionalmente, seguindo `admin_get_user_contact_details`).
3. Em `admin_delete_user`, bloquear exclusão quando o alvo possuir `role = 'superadmin'`.
4. Corrigir a chamada em `supabase/functions/admin-super-action/index.ts:323` (que hoje chama `admin_reset_user_mfa` via `adminClient` onde `auth.uid()` é nulo).

### Critérios de aceite
- [ ] `admin_delete_user` e `admin_reset_user_mfa` chamam `public.is_superadmin()` e validam MFA AAL2.
- [ ] `admin_delete_user` rejeita exclusão de outro `superadmin`.
- [ ] Chamada direta via PostgREST com token AAL1 ou superadmin suspenso falha com erro `42501`.""",
    },
    {
        "num": 3,
        "title": "[Segurança] Exigir permissão de escrita 'cards' nas RPCs de blueprints e restringir rota forense",
        "labels": "security, medium, authorization",
        "body": """### Título
[Segurança] Exigir permissão de escrita 'cards' nas RPCs de blueprints e restringir rota forense

### Labels sugeridas
`security`, `medium`

### Descrição do problema e explorabilidade
1. As RPCs `upsert_statement_layout_blueprint` e `record_statement_blueprint_outcome` validam apenas `is_current_user_active()`, omitindo `can_current_user_write_module('cards')`. Enquanto a UI bloqueia importação de faturas para contas `read_only` (trial expirado/cancelado), um usuário `read_only` pode chamar essas RPCs diretamente e gravar linhas em `statement_layout_blueprints` e `statement_layout_blueprint_votes`.
2. A rota `/admin/laboratorio-forense` é ocultada de `admin` comum apenas no menu (`admin-shell.tsx:208`), mas `router.tsx:375` usa `RequireAdminSession` (que libera `admin` e `superadmin`).

### Evidência
- `supabase/migrations/20260101000156_statement_layout_blueprints.sql:247-254, 476-483`
- `src/app/router.tsx:365-377` e `src/features/admin/layouts/admin-shell.tsx:208`

```sql
-- 20260101000156_statement_layout_blueprints.sql:251-253
IF NOT public.is_current_user_active() THEN
  RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
END IF;
-- Ausente: IF NOT public.can_current_user_write_module('cards') THEN ...
```

### Impacto
Bypass do modo somente-leitura (`read_only`) com escrita persistente no banco de dados e inconsistência de controle de acesso no console administrativo.

### Sugestão de correção
Adicionar `IF NOT public.can_current_user_write_module('cards') THEN RAISE EXCEPTION ...` em ambas as RPCs de blueprints e criar guarda `RequireSuperAdmin` (ou checagem de `isSuperAdmin`) na rota `/admin/laboratorio-forense`.

### Critérios de aceite
- [ ] Contas `read_only` recebem erro de permissão ao chamar `upsert_statement_layout_blueprint` e `record_statement_blueprint_outcome`.
- [ ] Acesso direto à URL `/admin/laboratorio-forense` por usuário `admin` (não `superadmin`) redireciona para `/admin/dashboard`.""",
    },
    {
        "num": 4,
        "title": "[Segurança] Adicionar rate limiting e remover fallback plaintext em passcodes de viagens públicas",
        "labels": "security, medium, idor, auth",
        "body": """### Título
[Segurança] Adicionar rate limiting e remover fallback plaintext em passcodes de viagens públicas

### Labels sugeridas
`security`, `medium`

### Descrição do problema e explorabilidade
As RPCs `get_public_trip_ledger`, `add_public_trip_expense` (acessíveis a `anon`) e `claim_trip_member` (`authenticated`) validam `p_passcode` sem nenhum controle de taxa (rate limit/lockout) e mantêm fallback de comparação direta em texto plano (`else v_trip.passcode_hash <> p_passcode`). De posse do `public_token` da viagem, um atacante pode executar força bruta de PINs curtos sem restrição para acessar chaves Pix/despesas dos membros, inserir despesas ou reivindicar um participante.

### Evidência
- `supabase/migrations/20260101000099_harden_security_and_lgpd_cascade.sql:163-175`
- `supabase/migrations/20260101000139_security_audit_remediation_and_rls_hardening.sql:1695-1704`
- `supabase/migrations/20260101000098_create_expense_with_debt_mode.sql:234-243`

```sql
when v_trip.passcode_hash like '$2%' then crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash
else v_trip.passcode_hash <> p_passcode
```

### Impacto
Quebra por força bruta da proteção por senha em viagens compartilhadas, expondo chaves Pix e histórico de gastos e permitindo escrita/reivindicação indevida.

### Sugestão de correção
1. Migrar eventuais `passcode_hash` sem prefixo `$2` para bcrypt (`crypt(val, gen_salt('bf', 10))`) e remover o ramo `else` plaintext.
2. Implementar tabela/RPC de rate limiting por `(trip_id, janela)` bloqueando após N tentativas falhas (ex.: 5 tentativas / 15 minutos).

### Critérios de aceite
- [ ] Nenhum registro em `trips.passcode_hash` armazenado em texto plano; ramo `else` plaintext removido das 3 RPCs.
- [ ] Após 5 tentativas inválidas de `p_passcode`, as RPCs retornam erro de limite excedido temporário.""",
    },
    {
        "num": 5,
        "title": "[Segurança] Higiene de segredos: credencial histórica de keystore no Git e SERVICE_ROLE em deploy-quotes.mjs",
        "labels": "security, medium, secrets",
        "body": """### Título
[Segurança] Higiene de segredos: credencial histórica de keystore no Git e SERVICE_ROLE em deploy-quotes.mjs

### Labels sugeridas
`security`, `medium`

### Descrição do problema e explorabilidade
1. A senha padrão antiga da keystore Android (`guiafinanceiro123`) foi commitada em `scripts/build-apk.sh:15` e `android/app/build.gradle:25,27` nos commits `6520f08f` até `bdfac1a8`. Embora o HEAD rejeite essa senha, ela segue exposta no histórico Git.
2. O script `scripts/deploy-quotes.mjs` (linhas 70, 108, 125, 142, 159) gera SQL de 4 jobs `pg_cron` embutindo `SUPABASE_SERVICE_ROLE_KEY` em texto plano em vez de priorizar `CRON_SECRET` (já aceito por `supabase/functions/quotes/index.ts:613-615`).

### Evidência
- Histórico Git (`git show 6520f08f:scripts/build-apk.sh` linha 15; `android/app/build.gradle` linhas 25, 27)
- `scripts/deploy-quotes.mjs:70, 108, 125, 142, 159`

```js
// scripts/deploy-quotes.mjs:70
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || "";
// ...
'Authorization', 'Bearer ${serviceRole}'
```

### Impacto
Exposição de credencial de assinatura Android (caso a keystore não tenha sido rotacionada) e ampliação desnecessária da superfície de vazamento da chave mestra `service_role` do Supabase nos metadados do `pg_cron`.

### Sugestão de correção
1. Confirmar que a keystore de produção usa senha forte rotacionada (e limpar o histórico com `git-filter-repo` se o repo for compartilhado).
2. Atualizar `scripts/deploy-quotes.mjs` para usar `env.CRON_SECRET` (com erro explícito se ausente, ou fallback documentado) e reaplicar os jobs `pg_cron` em produção.

### Critérios de aceite
- [ ] `scripts/deploy-quotes.mjs` utiliza `CRON_SECRET` nos headers `Authorization` / `x-cron-secret`.
- [ ] Jobs `pg_cron` de produção atualizados sem `SUPABASE_SERVICE_ROLE_KEY` em `cron.job.command`.
- [ ] Senha da keystore de produção confirmada como rotacionada e distinta de `guiafinanceiro123`.""",
    },
    {
        "num": 6,
        "title": "[Segurança] Validar protocolo https:// em apkUrl do atualizador e em p_receipt_url de viagens",
        "labels": "security, medium, xss",
        "body": """### Título
[Segurança] Validar protocolo https:// em apkUrl do atualizador e em p_receipt_url de viagens

### Labels sugeridas
`security`, `medium`

### Descrição do problema e explorabilidade
1. `AppVersionManifestSchema` (`src/services/native/update-schema.ts:8`) aceita qualquer string não vazia em `apkUrl`. Em `triggerAppUpdate()` (`update-checker.ts:223`) e `AppUpdatePlugin.web.downloadAndInstall()` (`update-checker.ts:30`), a URL vinda do manifesto remoto `version.json` é passada diretamente para `link.href` + `link.click()` e `window.open()`, permitindo execução de `javascript:` caso o manifesto remoto seja comprometido.
2. A RPC pública `add_public_trip_expense` (`migration 0139:1655, 1768`) aceita `p_receipt_url` de usuários `anon` sem validar esquema `https://`, criando risco latente de Stored XSS caso o campo seja exibido como link no futuro.

### Evidência
- `src/services/native/update-schema.ts:8`
- `src/services/native/update-checker.ts:28-32, 222-229`
- `supabase/migrations/20260101000139_security_audit_remediation_and_rls_hardening.sql:1655, 1768`

```ts
// src/services/native/update-checker.ts:222-228
const link = document.createElement("a");
link.href = manifest.apkUrl;
link.download = "axir-pro.apk";
link.click();
```

### Impacto
Execução de JavaScript arbitrário no contexto da aplicação (XSS) ou redirecionamento malicioso via manifesto adulterado ou comprovante injetado por usuário anônimo.

### Sugestão de correção
1. Restringir `apkUrl` no schema Zod e em `triggerAppUpdate()`/`downloadAndInstall()` a URLs `https://` de hosts permitidos (ex.: `*.r2.dev`, `axir.com.br`) ou caminho relativo seguro `/releases/...`.
2. Em `add_public_trip_expense`, rejeitar `p_receipt_url` não nulo que não comece com `https://` (e limitar comprimento máximo).

### Critérios de aceite
- [ ] `AppVersionManifestSchema.safeParse({ ..., apkUrl: "javascript:alert(1)" })` retorna `success: false`.
- [ ] `triggerAppUpdate` e `AppUpdatePlugin.web.downloadAndInstall` rejeitam qualquer URL fora de `https://` ou path relativo seguro.
- [ ] `add_public_trip_expense` rejeita `p_receipt_url` com protocolo diferente de `https://`.""",
    },
    {
        "num": 7,
        "title": "[Segurança] Eliminar oráculo cross-tenant de tickers na Edge Function quotes",
        "labels": "security, low, idor",
        "body": """### Título
[Segurança] Eliminar oráculo cross-tenant de tickers na Edge Function quotes

### Labels sugeridas
`security`, `low`

### Descrição do problema e explorabilidade
Quando um usuário autenticado comum solicita cotações em `POST /functions/v1/quotes` com `mode: "swr"` e uma lista de `tickers`, a função consulta `portfolio_assets` via `service_role` sem filtrar por `user_id` para montar `persistableSet` e descarta tickers que não existam na tabela global. Assim, um usuário pode sondar se algum outro cliente da plataforma possui um ticker específico em carteira observando se o endpoint retorna cotação ou array vazio.

### Evidência
- `supabase/functions/quotes/index.ts:2166-2219`

```ts
// supabase/functions/quotes/index.ts:2170-2177
const { data: validAssets } = await supabase
  .from("portfolio_assets")
  .select("ticker")
  .in("ticker", tickerChunk);
```

### Impacto
Vazamento indireto de informação cross-tenant (oráculo de existência de ativos na base de clientes).

### Sugestão de correção
Para chamadores não-`service_role`, filtrar `portfolio_assets` por `.eq("user_id", callerUserId)` ao validar tickers elegíveis para atualização global, ou tratar tickers fora da carteira do próprio usuário como `preview` (sem revelar se existem na carteira de terceiros).

### Critérios de aceite
- [ ] `quotes` filtra `portfolio_assets` por `user_id = callerUserId` para requisições autenticadas de usuários comuns.
- [ ] A resposta para um ticker não pertencente ao chamador é idêntica independentemente de outro usuário da base possuí-lo.""",
    },
    {
        "num": 8,
        "title": "[Segurança] Neutralizar CSV Formula Injection na exportação de logs de auditoria",
        "labels": "security, low, xss",
        "body": """### Título
[Segurança] Neutralizar CSV Formula Injection na exportação de logs de auditoria

### Labels sugeridas
`security`, `low`

### Descrição do problema e explorabilidade
A função `toCsvRow` em `AdminSecurityPage` escapa apenas aspas duplas, sem neutralizar células iniciadas por caracteres interpretados como fórmula por planilhas (`=`, `+`, `-`, `@`, `\t`, `\r`). Como `audit_events` inclui dados influenciados por usuários finais, um registro contendo payload malicioso pode disparar execução de fórmulas quando um administrador abrir o CSV exportado no Excel ou LibreOffice Calc.

### Evidência
- `src/features/admin/pages/admin-security-page.tsx:24-26, 47-63`

```ts
function toCsvRow(values: string[]): string {
  return values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
}
```

### Impacto
Execução de fórmulas/payloads DDE na estação de trabalho do administrador ao abrir o CSV exportado.

### Sugestão de correção
Prefixar com apóstrofo (`'`) qualquer célula cujo primeiro caractere (após trim opcional ou direto) pertença a `[=+\\-@\\t\\r]` antes do escape de aspas.

### Critérios de aceite
- [ ] `toCsvRow(["=cmd|' /C calc'!A0"])` gera `"'=cmd|' /C calc'!A0"`.
- [ ] Teste unitário cobre prefixos `=`, `+`, `-`, `@`, `\t` e `\r`.""",
    },
]


# ---------------------------------------------------------------------------
# Geração dos Gráficos (Matplotlib)
# ---------------------------------------------------------------------------
def generate_charts() -> None:
    plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Arial", "sans-serif"]
    plt.rcParams["axes.edgecolor"] = HEX_BORDER
    plt.rcParams["axes.linewidth"] = 0.8

    # 1. Gráfico de Rosca por Severidade
    fig, ax = plt.subplots(figsize=(5.4, 3.6), dpi=220)
    labels = ["Crítica", "Alta", "Média", "Baixa"]
    values = [SEVERITY_COUNTS[k] for k in labels]
    palette = [HEX_CRITICAL, HEX_HIGH, HEX_MEDIUM, HEX_LOW]

    nonzero_labels = [l for l, v in zip(labels, values) if v > 0]
    nonzero_values = [v for v in values if v > 0]
    nonzero_colors = [c for c, v in zip(palette, values) if v > 0]

    wedges, _ = ax.pie(
        nonzero_values,
        colors=nonzero_colors,
        startangle=90,
        counterclock=False,
        wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 2.2},
    )

    total = sum(values)
    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=26, fontweight="bold", color=HEX_INK)
    ax.text(0, -0.18, "achados\nverificados", ha="center", va="center", fontsize=9, color=HEX_MUTED)

    legend_labels = [f"{l}: {SEVERITY_COUNTS[l]}" for l in labels]
    legend_handles = [
        plt.Line2D([0], [0], marker="o", color="w", markerfacecolor=c, markersize=9)
        for c in palette
    ]
    ax.legend(
        legend_handles,
        legend_labels,
        loc="center left",
        bbox_to_anchor=(0.95, 0.5),
        frameon=False,
        fontsize=9.5,
        labelcolor=HEX_SLATE,
    )
    ax.set_title("Distribuição por Severidade", fontsize=11.5, fontweight="bold", color=HEX_INK, pad=10)
    plt.tight_layout()
    fig.savefig(CHART_DONUT_PATH, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    # 2. Gráfico de Barras Empilhadas por Categoria
    fig, ax = plt.subplots(figsize=(6.4, 3.6), dpi=220)
    cats = [c[0] for c in CATEGORY_BREAKDOWN]
    crit = np.array([c[1] for c in CATEGORY_BREAKDOWN])
    high = np.array([c[2] for c in CATEGORY_BREAKDOWN])
    med = np.array([c[3] for c in CATEGORY_BREAKDOWN])
    low = np.array([c[4] for c in CATEGORY_BREAKDOWN])
    x = np.arange(len(cats))
    width = 0.52

    ax.bar(x, crit, width, label="Crítica", color=HEX_CRITICAL)
    ax.bar(x, high, width, bottom=crit, label="Alta", color=HEX_HIGH)
    ax.bar(x, med, width, bottom=crit + high, label="Média", color=HEX_MEDIUM)
    ax.bar(x, low, width, bottom=crit + high + med, label="Baixa", color=HEX_LOW)

    totals = crit + high + med + low
    for xi, tot in zip(x, totals):
        ax.text(xi, tot + 0.12, str(int(tot)), ha="center", va="bottom", fontsize=9.5, fontweight="bold", color=HEX_INK)

    ax.set_xticks(x)
    ax.set_xticklabels(cats, fontsize=8, color=HEX_SLATE)
    ax.set_ylim(0, max(totals) + 1.1)
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.tick_params(axis="y", labelsize=8.5, colors=HEX_MUTED)
    ax.grid(axis="y", linestyle="--", alpha=0.45, color=HEX_BORDER)
    ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_title("Achados por Categoria de Auditoria", fontsize=11.5, fontweight="bold", color=HEX_INK, pad=10)
    ax.legend(loc="upper right", frameon=False, fontsize=8.5, ncol=4)
    plt.tight_layout()
    fig.savefig(CHART_BAR_PATH, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


# ---------------------------------------------------------------------------
# Cabeçalho / Rodapé de Páginas (A4, margens ~2cm)
# ---------------------------------------------------------------------------
def on_later_pages(canvas, doc) -> None:
    canvas.saveState()
    page_w, page_h = A4
    # Linha fina superior
    canvas.setStrokeColor(colors.HexColor(HEX_BORDER))
    canvas.setLineWidth(0.6)
    canvas.line(2 * cm, page_h - 1.55 * cm, page_w - 2 * cm, page_h - 1.55 * cm)
    # Cabeçalho
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor(HEX_BRAND))
    canvas.drawString(2 * cm, page_h - 1.35 * cm, f"Relatório de Auditoria de Segurança — {PROJECT_NAME} (v{PROJECT_VERSION})")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(HEX_MUTED))
    canvas.drawRightString(page_w - 2 * cm, page_h - 1.35 * cm, f"Auditoria {AUDIT_DATE}")
    # Rodapé
    canvas.line(2 * cm, 1.55 * cm, page_w - 2 * cm, 1.55 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(HEX_MUTED))
    canvas.drawString(2 * cm, 1.15 * cm, "Documento confidencial de engenharia — Revisão de Segurança em 5 Categorias")
    canvas.drawRightString(page_w - 2 * cm, 1.15 * cm, f"Página {doc.page}")
    canvas.restoreState()


def on_cover_page(canvas, doc) -> None:
    canvas.saveState()
    page_w, page_h = A4
    # Faixa superior institucional (comporta kicker + título + subtítulo com folga)
    canvas.setFillColor(colors.HexColor(HEX_BRAND))
    canvas.rect(0, page_h - 5.5 * cm, page_w, 5.5 * cm, fill=1, stroke=0)
    # Filete de acento
    canvas.setFillColor(colors.HexColor(HEX_ACCENT))
    canvas.rect(0, page_h - 5.68 * cm, page_w, 0.18 * cm, fill=1, stroke=0)
    # Rodapé discreto da capa
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(HEX_MUTED))
    canvas.drawString(2 * cm, 1.2 * cm, f"Axir v{PROJECT_VERSION} · Auditoria Estática de Código, RLS, Edge Functions e Histórico Git")
    canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, "Página 1")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Construção do PDF
# ---------------------------------------------------------------------------
def build_pdf() -> None:
    generate_charts()

    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.1 * cm,
        bottomMargin=2.0 * cm,
        title=f"Relatório de Auditoria de Segurança — {PROJECT_NAME}",
        author="Auditoria de Segurança de Código",
    )

    base = getSampleStyleSheet()
    usable_w = A4[0] - 4.0 * cm  # ~17 cm

    styles = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            textColor=colors.HexColor("#99F6E4"),
            spaceAfter=6,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=27,
            textColor=colors.white,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#E2E8F0"),
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            textColor=colors.HexColor(HEX_BRAND),
            spaceBefore=6,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor(HEX_ACCENT),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=13.5,
            textColor=colors.HexColor(HEX_SLATE),
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.3,
            leading=11.5,
            textColor=colors.HexColor(HEX_SLATE),
        ),
        "mono_cell": ParagraphStyle(
            "mono_cell",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=7.2,
            leading=9.8,
            textColor=colors.HexColor(HEX_INK),
            wordWrap="CJK",
        ),
        "chip": ParagraphStyle(
            "chip",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=9.5,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "issue_code": ParagraphStyle(
            "issue_code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=7.3,
            leading=9.8,
            textColor=colors.HexColor(HEX_INK),
            backColor=colors.HexColor(HEX_SURFACE),
            borderColor=colors.HexColor(HEX_BORDER),
            borderWidth=0.6,
            borderPadding=7,
            spaceBefore=4,
            spaceAfter=10,
        ),
    }

    story = []

    # =========================================================================
    # A) CAPA
    # =========================================================================
    story.append(Paragraph("AUDITORIA DE SEGURANÇA DE CÓDIGO · 5 CATEGORIAS CRÍTICAS", styles["cover_kicker"]))
    story.append(Paragraph(f"Relatório de Auditoria de Segurança — {PROJECT_NAME}", styles["cover_title"]))
    story.append(
        Paragraph(
            f"Revisão sistemática de isolamento de dados (RLS), autorização frontend/backend, IDOR, "
            f"exposição de segredos e sanitização de inputs (XSS) · Versão auditada: v{PROJECT_VERSION} · Data: {AUDIT_DATE}",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 1.1 * cm))

    # Metadados da stack e escopo
    meta_rows = [
        [Paragraph("<b>Projeto / Versão</b>", styles["small"]), Paragraph(f"{PROJECT_NAME} (package.json: axir · v{PROJECT_VERSION})", styles["small"])],
        [Paragraph("<b>Data da Auditoria</b>", styles["small"]), Paragraph(AUDIT_DATE, styles["small"])],
        [Paragraph("<b>Stack Detectada</b>", styles["small"]), Paragraph("React 19 + TypeScript 6 + Vite 8 + Tailwind CSS v4 + TanStack Query + Capacitor 8 (Android) + Supabase (PostgreSQL 17, RLS, PostgREST, Auth/MFA, 10 Edge Functions Deno)", styles["small"])],
        [Paragraph("<b>Infra / Deploy</b>", styles["small"]), Paragraph("Cloudflare Pages (public/_headers com CSP/HSTS), Cloudflare R2 (scripts/upload-r2.mjs), Android Gradle (android/app/build.gradle, scripts/build-apk.sh), pg_cron/pg_net", styles["small"])],
        [Paragraph("<b>Escopo Auditado</b>", styles["small"]), Paragraph("157 migrations SQL (69 tabelas ativas, 143 funções SECURITY DEFINER), 10 Edge Functions + 9 módulos _shared, frontend src/ (rotas, admin, repositórios, exportações, serviços nativos), scripts/, bundle dist/assets/ e histórico Git.", styles["small"])],
    ]
    meta_tbl = Table(meta_rows, colWidths=[3.8 * cm, usable_w - 3.8 * cm])
    meta_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(HEX_SURFACE_ALT)),
                ("BACKGROUND", (1, 0), (1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(HEX_BORDER)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(HEX_BORDER)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta_tbl)
    story.append(Spacer(1, 0.65 * cm))

    story.append(Paragraph("Nota Metodológica — Mapeamento para a Stack Supabase + React/Vite", styles["h2"]))
    meth_rows = [
        [Paragraph("<b>Categoria</b>", styles["small"]), Paragraph("<b>Mapeamento Técnico Aplicado ao Axir</b>", styles["small"])],
        [Paragraph("<b>1. Banco sem Tranca</b>", styles["small"]), Paragraph("Auditoria exaustiva de ENABLE/FORCE ROW LEVEL SECURITY e políticas finais ativas nas 69 tabelas criadas ao longo das 157 migrations, verificando isolamento por auth.uid(), vínculo familiar/viagem e status ativo de operadores.", styles["small"])],
        [Paragraph("<b>2. Permissão no Navegador</b>", styles["small"]), Paragraph("Cruzamento de todos os gates de papel e plano no React (RequireAdminSession, isAdmin, isSuperAdmin, usePermission/read_only) contra as políticas RLS, RPCs admin_* e Edge Functions.", styles["small"])],
        [Paragraph("<b>3. IDOR</b>", styles["small"]), Paragraph("Inspeção sistemática de todas as 10 Edge Functions (implantadas com --no-verify-jwt) e das 143 funções SECURITY DEFINER que recebem IDs ou tokens (user_id, target_user_id, card_id, expense_id, trip_id, ticketId).", styles["small"])],
        [Paragraph("<b>4. Chaves Expostas</b>", styles["small"]), Paragraph("Varredura em código-fonte, scripts, Gradle, configs, bundle de produção dist/assets/ e histórico Git completo por chaves de API, JWTs, chaves privadas, senhas e defaults inseguros.", styles["small"])],
        [Paragraph("<b>5. Inputs sem Tratamento</b>", styles["small"]), Paragraph("Varredura de sinks DOM (dangerouslySetInnerHTML, innerHTML, eval, href/src/window.open), exportações CSV/Excel e templates HTML no backend (Resend e Telegram Bot API).", styles["small"])],
    ]
    meth_tbl = Table(meth_rows, colWidths=[4.2 * cm, usable_w - 4.2 * cm])
    meth_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(HEX_BRAND)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(HEX_SURFACE)]),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(HEX_BORDER)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(HEX_BORDER)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    # Fix header text color inside Paragraphs
    meth_rows[0][0] = Paragraph("<font color='white'><b>Categoria</b></font>", styles["small"])
    meth_rows[0][1] = Paragraph("<font color='white'><b>Mapeamento Técnico Aplicado ao Axir</b></font>", styles["small"])
    meth_tbl = Table(meth_rows, colWidths=[4.2 * cm, usable_w - 4.2 * cm])
    meth_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(HEX_BRAND)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(HEX_SURFACE)]),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(HEX_BORDER)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(HEX_BORDER)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(meth_tbl)
    story.append(PageBreak())

    # =========================================================================
    # B) RESUMO EXECUTIVO + GRÁFICOS
    # =========================================================================
    story.append(Paragraph("1. Resumo Executivo", styles["h1"]))
    story.append(
        Paragraph(
            "A auditoria verificou o código real da plataforma <b>Axir (v3.30.0)</b> em toda a superfície "
            "web, mobile (Capacitor), Edge Functions Deno e banco PostgreSQL/Supabase. O projeto demonstra "
            "maturidade de segurança acima da média — com histórico claro de rodadas anteriores de hardening "
            "(migrations 0111, 0128, 0134, 0138, 0139, 0152 e 0153), RLS ativo em 100% das 69 tabelas, "
            "zero vulnerabilidades <b>Críticas</b> e zero pontos de injeção XSS clássica no React. "
            "Ainda assim, foram identificados <b>11 achados verificados</b> (2 Altos, 4 Médios e 5 Baixos) "
            "concentrados principalmente em lacunas de revogação/MFA em políticas e RPCs administrativas, "
            "controle de taxa em passcodes públicos, validação de protocolo de URL e higiene de segredos.",
            styles["body"],
        )
    )

    # Cards de KPI por severidade
    kpi_data = [
        [
            Paragraph(f"<font color='white' size='16'><b>{SEVERITY_COUNTS['Crítica']}</b></font><br/><font color='white' size='8'>CRÍTICA</font>", styles["chip"]),
            Paragraph(f"<font color='white' size='16'><b>{SEVERITY_COUNTS['Alta']}</b></font><br/><font color='white' size='8'>ALTA</font>", styles["chip"]),
            Paragraph(f"<font color='white' size='16'><b>{SEVERITY_COUNTS['Média']}</b></font><br/><font color='white' size='8'>MÉDIA</font>", styles["chip"]),
            Paragraph(f"<font color='white' size='16'><b>{SEVERITY_COUNTS['Baixa']}</b></font><br/><font color='white' size='8'>BAIXA</font>", styles["chip"]),
            Paragraph(f"<font color='white' size='16'><b>{len(STRENGTHS)}</b></font><br/><font color='white' size='8'>PONTOS FORTES</font>", styles["chip"]),
        ]
    ]
    kpi_tbl = Table(kpi_data, colWidths=[usable_w / 5.0] * 5)
    kpi_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(HEX_CRITICAL)),
                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(HEX_HIGH)),
                ("BACKGROUND", (2, 0), (2, 0), colors.HexColor(HEX_MEDIUM)),
                ("BACKGROUND", (3, 0), (3, 0), colors.HexColor(HEX_LOW)),
                ("BACKGROUND", (4, 0), (4, 0), colors.HexColor(HEX_STRENGTH)),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("INNERGRID", (0, 0), (-1, -1), 3, colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.white),
            ]
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(kpi_tbl)
    story.append(Spacer(1, 0.5 * cm))

    # Gráficos lado a lado
    img_donut = Image(str(CHART_DONUT_PATH), width=7.9 * cm, height=5.2 * cm)
    img_bar = Image(str(CHART_BAR_PATH), width=8.9 * cm, height=5.2 * cm)
    charts_tbl = Table([[img_donut, img_bar]], colWidths=[8.0 * cm, 9.0 * cm])
    charts_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(HEX_BORDER)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(charts_tbl)
    story.append(Spacer(1, 0.5 * cm))

    # =========================================================================
    # C) PONTOS FORTES E PONTOS FRACOS
    # =========================================================================
    story.append(Paragraph("2. Pontos Fortes e Pontos Fracos", styles["h1"]))
    story.append(Paragraph("Pontos Fortes Verificados (Evidências de Cobertura)", styles["h2"]))

    str_rows = []
    for title, desc in STRENGTHS:
        badge = Paragraph("<font color='white'><b>OK</b></font>", styles["chip"])
        txt = Paragraph(f"<b>{escape(title)}:</b> {escape(desc)}", styles["small"])
        str_rows.append([badge, txt])

    str_tbl = Table(str_rows, colWidths=[1.3 * cm, usable_w - 1.3 * cm])
    str_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(HEX_STRENGTH)),
                ("ROWBACKGROUNDS", (1, 0), (1, -1), [colors.HexColor("#ECFDF5"), colors.white]),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#A7F3D0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1FAE5")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(str_tbl)
    story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph("Pontos Fracos Centrais (Riscos Prioritários)", styles["h2"]))
    weak_rows = []
    for idx, w in enumerate(WEAKNESSES, 1):
        weak_rows.append(
            [
                Paragraph(f"<font color='white'><b>R{idx}</b></font>", styles["chip"]),
                Paragraph(escape(w), styles["small"]),
            ]
        )
    weak_tbl = Table(weak_rows, colWidths=[1.3 * cm, usable_w - 1.3 * cm])
    weak_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(HEX_HIGH)),
                ("ROWBACKGROUNDS", (1, 0), (1, -1), [colors.HexColor("#FFF7ED"), colors.white]),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#FED7AA")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#FFEDD5")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(weak_tbl)
    story.append(Spacer(1, 0.55 * cm))

    # =========================================================================
    # D) TABELA DE ACHADOS DETALHADOS POR CATEGORIA
    # =========================================================================
    story.append(Paragraph("3. Achados Detalhados por Categoria", styles["h1"]))
    story.append(
        Paragraph(
            "Todos os achados abaixo foram verificados diretamente no código-fonte, migrations SQL, "
            "Edge Functions ou histórico Git do repositório. Nenhum item especulativo foi incluído.",
            styles["body"],
        )
    )

    for cat_title, items in FINDINGS_BY_CATEGORY:
        story.append(Paragraph(escape(cat_title), styles["h2"]))
        rows = [
            [
                Paragraph("<font color='white'><b>Severidade</b></font>", styles["small"]),
                Paragraph("<font color='white'><b>Arquivo : Linha</b></font>", styles["small"]),
                Paragraph("<font color='white'><b>Descrição e Explorabilidade</b></font>", styles["small"]),
            ]
        ]
        row_sev_colors = []
        for f in items:
            sev = f["severity"]
            row_sev_colors.append(SEV_COLORS[sev])
            chip = Paragraph(f"<font color='white'><b>{f['id']}<br/>{sev.upper()}</b></font>", styles["chip"])
            loc_html = "<br/>".join(escape(line) for line in f["location"].splitlines())
            loc_p = Paragraph(loc_html, styles["mono_cell"])
            desc_p = Paragraph(
                f"<b>{escape(f['summary'])}</b><br/>{escape(f['detail'])}",
                styles["small"],
            )
            rows.append([chip, loc_p, desc_p])

        t = Table(rows, colWidths=[2.0 * cm, 6.2 * cm, usable_w - 8.2 * cm], repeatRows=1)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(HEX_BRAND)),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(HEX_BORDER)),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(HEX_BORDER)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("VALIGN", (0, 1), (0, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]
        for idx, c_hex in enumerate(row_sev_colors, start=1):
            style_cmds.append(("BACKGROUND", (0, idx), (0, idx), colors.HexColor(c_hex)))
            bg = colors.white if idx % 2 == 1 else colors.HexColor(HEX_SURFACE)
            style_cmds.append(("BACKGROUND", (1, idx), (2, idx), bg))

        t.setStyle(TableStyle(style_cmds))
        story.append(t)
        story.append(Spacer(1, 0.35 * cm))

    # =========================================================================
    # E) RECOMENDAÇÕES PRIORIZADAS (P1, P2, P3)
    # =========================================================================
    story.append(Paragraph("4. Recomendações Priorizadas", styles["h1"]))
    for prio_title, prio_color, bullets in PRIORITIZED_RECS:
        block = []
        hdr_tbl = Table(
            [[Paragraph(f"<font color='white'><b>{escape(prio_title)}</b></font>", styles["small"])]],
            colWidths=[usable_w],
        )
        hdr_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(prio_color)),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        block.append(hdr_tbl)
        body_lines = "<br/>".join(f"&bull; {escape(b)}" for b in bullets)
        body_tbl = Table([[Paragraph(body_lines, styles["small"])]], colWidths=[usable_w])
        body_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(HEX_SURFACE)),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(HEX_BORDER)),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        block.append(body_tbl)
        block.append(Spacer(1, 0.3 * cm))
        story.append(KeepTogether(block))

    # =========================================================================
    # F) ISSUES PARA O GITHUB (PRONTAS PARA COPIAR E COLAR)
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("5. Issues para o GitHub", styles["h1"]))
    story.append(
        Paragraph(
            "Os blocos abaixo contêm o texto completo em Markdown pronto para copiar e colar na abertura "
            "de issues no GitHub. Achados relacionados foram agrupados em 8 issues acionáveis para evitar ruído.",
            styles["body"],
        )
    )

    for issue in GITHUB_ISSUES:
        n = issue["num"]
        wrapped = (
            f"--- ISSUE {n} ---\n"
            f"{issue['body']}\n"
            f"--- FIM ISSUE {n} ---"
        )
        # Quebra manual de linhas muito longas para garantir legibilidade em A4 sem estouro horizontal
        safe_lines = []
        max_cols = 96
        for raw_line in wrapped.splitlines():
            if len(raw_line) <= max_cols:
                safe_lines.append(raw_line)
            else:
                words = raw_line.split(" ")
                cur = ""
                for w in words:
                    if not cur:
                        cur = w
                    elif len(cur) + 1 + len(w) <= max_cols:
                        cur += " " + w
                    else:
                        safe_lines.append(cur)
                        cur = w
                if cur:
                    safe_lines.append(cur)
        final_text = "\n".join(safe_lines)

        issue_hdr = Paragraph(f"Issue #{n} — {escape(issue['title'])}", styles["h2"])
        pre = Preformatted(final_text, styles["issue_code"])
        box = Table([[pre]], colWidths=[usable_w])
        box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(HEX_SURFACE)),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(HEX_BORDER)),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(KeepTogether([issue_hdr, box, Spacer(1, 0.25 * cm)]))

    doc.build(story, onFirstPage=on_cover_page, onLaterPages=on_later_pages)

    # Limpa PNGs temporários dos gráficos
    for tmp in (CHART_DONUT_PATH, CHART_BAR_PATH):
        if tmp.exists():
            tmp.unlink()

    print(f"PDF gerado com sucesso em: {PDF_PATH} ({PDF_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    build_pdf()
