# T00 — Baseline e Inventário de Superfícies (Multiconta e Isolamento de Sessões)

> **Plano:** [`PLANO_MESTRE_MULTICONTA_E_ISOLAMENTO_SESSOES.md`](../plans/PLANO_MESTRE_MULTICONTA_E_ISOLAMENTO_SESSOES.md)
> **Branch de execução observada:** `fix/asaas-billing-homologation` (mudanças pré-existentes preservadas)
> **Data do levantamento:** 2026-11-27

---

## 1. Inventário de Superfícies por Classe de Cliente

### 1.1 Auth e Gestão de Sessão no Cliente

| Superfície / Arquivo | Operação atual | Identidade esperada | Caminho legado / Risco | Transporte de destino (T03–T06) | Teste planejado |
|---|---|---|---|---|---|
| `src/data/client.ts` | `getSupabase()` (singleton, `persistSession: true`, `autoRefreshToken: true`, `flowType: "pkce"`) e `createIsolatedSupabaseClient()` | Titular único em `localStorage` | S01/S05: credenciais persistidas no storage padrão da origem; singleton global | Cookie opaco `__Host-axir_session` + contexto opaco por aba (`sessionStorage`) via `/api/sessions/v1/*` | T03, T04 |
| `src/data/auth.ts` | `getUser`, `mfa.getAuthenticatorAssuranceLevel`, `mfa.listFactors`, `mfa.enroll/challenge/verify/unenroll`, `signOut({ scope: "local" })`, `onAuthStateChange` | Usuário autenticado | S01/S02/S06: acoplado ao SDK no navegador | `/api/sessions/v1/bootstrap`, `mfa`, `logout` | T03, T04, T05 |
| `src/hooks/use-auth.ts` | `getSession`, `mfa.getAuthenticatorAssuranceLevel`, `listFactors`, `onAuthStateChange` | Usuário autenticado | S06: estado global de sessão/MFA compartilhado | Estado por geração de contexto de aba | T03, T04 |
| `src/hooks/use-sign-out.ts` | `signOut({ scope })` (`local`, `others`, `global`) + `resetAppState` | Titular da sessão | S06: limpeza ampla de storage; timeout silencioso em rede instável | `/api/sessions/v1/logout`, `logout-device`, `forget` | T01, T03, T06 |
| `src/services/session-policy.ts` | `SHARED_DEVICE_SESSION_KEY` em `sessionStorage`, `idle_logout_policy` em `user-storage` | Aba / dispositivo | S05: leitura assume modo pessoal em falha; cliente já inicia com `persistSession: true` | Política efêmera antes do bootstrap sem leitura pessoal | T01, T03, T06 |
| `src/services/auth-cleanup.ts` | `resetAppState()` (`queryClient.clear()`, `removeAllChannels()`, `sessionStorage.clear()`, `setActiveUserId`) | Isolamento de contexto | S06: limpezas assíncronas não cancelam mutações já aceitas | Isolamento por geração e limpeza seletiva por conta | T04 |
| `src/services/user-storage.ts` | Chaves `financas_${userId}_*` e espelho `financas_active_*` | Conta ativa | S06: espelho global `financas_active_*` pode vazar entre abas/contas | Chaves isoladas por conta sem credenciais; seleção por aba | T04, T06 |
| `src/data/repositories/profiles.ts` | `supabase.auth.updateUser(...)` | Titular autenticado | Depende do JWT no navegador | `/api/sessions/v1/*` ou `/api/data/v1/*` com revalidação | T03, T04 |
| `src/data/repositories/devices.ts` & `src/data/rpc/auth-sessions.ts` | `register_device_session`, `check_device_session_revoked`, `revoke_device_session`, `revoke_other_device_sessions` + CRUD `user_devices` | Titular / aparelho | S04: `auth_session_id` por par usuário/aparelho sobrescrito em múltiplas sessões; reativação por registro | Inventário + revogação server-side por `session_id` sem reativação de sessão revogada | T01, T03 |

### 1.2 Data API (`.from(...)` — 53 tabelas mapeadas em `src/`)

| Classe de Cliente | Tabelas | Validação / Grants atuais | Consumidores principais | Transporte de destino | Teste planejado |
|---|---|---|---|---|---|
| **Usuário Comum (RLS `auth.uid()`)** | `expenses`, `incomes`, `categories`, `credit_cards`, `card_payments`, `card_bill_rollovers`, `budgets`, `income_goals`, `debts`, `loans`, `cash_checkpoints`, `recurrences`, `reminder_states`, `insight_feedback`, `statement_layout_blueprints`, `portfolio_assets`, `portfolio_contributions`, `portfolio_transactions`, `portfolio_snapshots`, `portfolio_dividends`, `portfolio_monthly_prices`, `portfolio_dividend_dismissals`, `user_dividend_events`, `user_preferences`, `user_devices`, `user_push_subscriptions`, `user_subscriptions`, `user_ai_quotas`, `user_module_permissions`, `user_feature_overrides`, `profiles`, `support_tickets`, `app_analytics_events`, `public_shares` | RLS por `auth.uid()` (e `FORCE ROW LEVEL SECURITY` em sensíveis) | `src/data/repositories/*`, `src/data/auth.ts` | `POST /api/data/v1/:operation` (Worker valida contexto e usa JWT da conta vinculada) | T02, T04, T09 |
| **Famílias & Viagens (RLS colaborativo)** | `families`, `family_members`, `family_invites`, `family_settlements`, `trips`, `trip_members`, `trip_expenses`, `trip_expense_splits`, `trip_settlements` | RLS por membro/dono + RPCs `SECURITY DEFINER` | `src/data/repositories/families.ts`, `trips.ts` | `POST /api/data/v1/:operation` | T04, T09 |
| **Catálogo / Mercado (Leitura autenticada/pública)** | `plans`, `system_features`, `asset_prices`, `market_price_history`, `corporate_dividends` | Grants de leitura e RLS específicos | `src/data/repositories/billing.ts`, `access.ts`, `asset-prices.ts`, `portfolio.ts` | Separar leitura pública legítima vs. `/api/data/v1/*` | T04 |
| **Admin / Superadmin (`is_admin()`)** | `audit_events`, `system_backups`, `admin_broadcast_notifications`, `admin_telegram_settings`, `access_invites` | RLS via `is_admin()` (S02: falta exigência uniforme de AAL2 + vínculo `session_id`) | `src/data/repositories/admin.ts`, `telegram-settings.ts` | Portal isolado `admin.axir.com.br` + concessão server-side + AAL2 | T01, T05 |

### 1.3 RPCs (`src/data/rpc/` e `src/data/repositories/categories.ts`)

- **Transações e Orçamentos (`src/data/rpc/transactions.ts`, `categories.ts`):** `create_expense_with_debt`, `create_refund`, `delete_expense_installments`, `create_recurrence`, `materialize_recurrences`, `delete_recurrence_occurrences`, `update_recurrence_occurrences`, `create_income_installments`, `delete_income_installments`, `update_income_installments_group`, `update_expense_installments_group`, `delete_category_migrate`, `seed_default_categories`, `set_budget_limit`, `set_batch_budget_limits`, `set_income_goal`, `reallocate_budget`, `import_statement_expenses`, `import_bank_transactions`, `get_statement_reconciliation_receipts`, `commit_statement_reconciliation_batch`, `commit_statement_reconciliation`.
- **Cartões, Dívidas e Negócio (`cards.ts`, `debts.ts`, `business.ts`):** `pay_card_bill_with_charges`, `create_card_payment`, `update_credit_card`, `delete_credit_card`, `delete_card_payment`, `refinance_credit_card_bill`, `rollover_card_bill`, `delete_card_bill_rollover`, `pay_debt`, `create_loan_contract`, `renegotiate_loan_contract`, `early_amortize_loan`, `receive_debt`, `settle_integrated_receivable`, `delete_debt_installments`, `delete_loan_contract`, `create_internal_transfer_pair`, `delete_internal_transfer_pair`.
- **Investimentos (`portfolio.ts`):** `set_group_target`, `remove_group_target`, `save_portfolio_hierarchy_targets`, `execute_portfolio_batch_aporte`, `revert_portfolio_batch_aporte`, `delete_portfolio_transaction_atomic`, `commit_monthly_closing_atomic`, `import_portfolio_atomic`, `save_pocket_cost_milestone_atomic`, `approve_dividends_batch_atomic`, `confirm_user_dividend_events_atomic`, `revert_confirmed_dividend_events_atomic`, `dismiss_user_dividend_event_atomic`, `dismiss_user_dividend_events_atomic`, `set_dividend_tracking_atomic`, `allocate_goal_deposit`, `calibrate_portfolio_snapshot`, `reset_manual_snapshot_calibration`, `create_historical_contribution`, `set_manual_asset_price`, `upsert_marco_zero`.
- **Família e Viagens (`family.ts`, `trips.ts`):** `get_public_share_by_token` (público por token), `get_shared_family_budget`, `get_shared_goal_tracker`, `signal_split_payment`, `dismiss_split_payment_signal`, `get_family_consolidation`, `create_family`, `invite_family_member`, `get_family_invite_preview`, `accept_family_invite`, `leave_family`, `remove_family_member`, `record_family_settlement`, `get_family_income_ratio_suggestion`, `get_family_portfolio_summary`, `get_public_trip_ledger` (público/passcode), `add_public_trip_expense`, `record_trip_settlements`, `create_trip`, `claim_trip_member`, `unlink_trip_member`, `delete_trip_expense_sync`.
- **Sessão e Conta (`auth-sessions.ts`, `admin.ts`):** `register_device_session`, `check_device_session_revoked`, `revoke_device_session`, `revoke_other_device_sessions`, `get_my_features`, `get_my_subscription`, `get_my_billing_contact`, `delete_current_user_account`, `get_my_broadcast_notifications`, `mark_broadcast_as_read`, `dismiss_broadcast_notification`.
- **Admin (`admin.ts`):** `admin_list_users`, `admin_update_user_status`, `admin_set_user_role`, `admin_set_feature_override`, `admin_remove_feature_override`, `admin_toggle_global_feature`, `admin_create_invite`, `admin_revoke_invite`, `admin_get_metrics`, `admin_set_user_subscription`, `admin_set_user_module_permission`, `admin_remove_user_module_permission`, `admin_create_modular_invite`, `admin_delete_user`, `admin_get_user_contact_details`, `admin_send_broadcast_notification`, `admin_log_system_backup`, `admin_list_past_due_subscriptions`, `restore_backup`.

### 1.4 Edge Functions, Storage, Realtime e Push

| Categoria | Alvo | Auth / Validação atual | Risco / Observação |
|---|---|---|---|
| **Edge — Usuário** | `asaas-checkout`, `asaas-manage`, `support-notify` (modo usuário), `ai-financial-assistant`, `quotes` (autenticado) | `userClient.auth.getUser()` via `Authorization: Bearer <jwt>` (`ai-assistant.ts` lê `getSession().access_token` diretamente via `fetch`) | Migrar chamadas autenticadas para `/api/data/v1/*` sem expor JWT no navegador |
| **Edge — Admin** | `admin-super-action` | `getUser()` + `profiles.role === 'superadmin'` + MFA `listFactors` + AAL2 | **S03:** `adminClient.auth.admin.signOut(targetUserId, "global")` passa UUID do usuário ao invés de JWT da sessão; **S08:** gera `action_link` portador |
| **Edge — Webhooks / Cron** | `asaas-webhook` (`ASAAS_WEBHOOK_TOKEN`), `resend-webhook` (HMAC Svix `RESEND_WEBHOOK_SECRET`), `support-notify` (`WEBHOOK_SECRET`), `billing-lifecycle-cron` (`CRON_SECRET`), `sunday-digest` (`CRON_SECRET`), `push-dispatcher` (`WEBHOOK_SECRET`/`CRON_SECRET`/JWT), `quotes` (`CRON_SECRET`/JWT) | Segredos dedicados e verificação criptográfica (Svix/timingSafeEqual) | `admin-super-action` L672 ainda admite fallback `CRON_SECRET \|\| supabaseServiceKey` |
| **Realtime** | `user-access-${userId}` (`src/state/queries/use-user-access.ts`), `user-devices-${userId}` (`src/hooks/use-device-session-sync.ts`) | Canal por `userId` no cliente + `removeAllChannels()` no cleanup | S04/S06: substituir/isolar por geração e revalidação sem depender do SDK persistente no cliente |
| **Web Push / FCM / Local** | `public/sw-push.js`, `src/services/push/web-push.ts`, `src/data/repositories/push-subscriptions.ts`, `src/services/native/local-notifications.ts`, `push-dispatcher` | Assinatura indexada por `user_id`; SW roteia para primeira janela da origem | **S07:** risco de entrega cruzada e payload na tela bloqueada; desativado em multiconta até T07 |
| **Storage** | Sem chamadas `supabase.storage` no cliente (`src/`) | Assets via Pages e APK via R2 (`update-checker.ts`) | Nenhuma superfície autenticada de Supabase Storage no cliente |

---

## 2. Conferência de Ambiente, Cabeçalhos e Cadeia de Build

### 2.1 Limites de Acesso ao Ambiente neste Checkout

- **Ferramentas ausentes neste host:** `wrangler`, `deno`, `docker` e `gradle` não estão instalados no PATH atual; `npx supabase status` retornou ausência do container local `supabase_db_financasnew`.
- **Cloudflare & Supabase Cloud:** verificação efetiva de bindings, Durable Objects, JWT/MFA/Turnstile Cloud, redirects e rate limits em produção/prévia requer credenciais e CLI autorizados (etapa de provisionamento em T02 e matriz T09).

### 2.2 Configurações Locais Auditadas

- **`supabase/config.toml`:** `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`, `enable_signup = true`, `enable_anonymous_sign_ins = false`, `enable_manual_linking = false`, `minimum_password_length = 6`. Rate limits locais configurados (`email_sent = 2`, `token_refresh = 150`, `sign_in_sign_ups = 30`, `token_verifications = 30`).
- **`public/_headers`:** `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. **S11:** CSP global permite `wasm-unsafe-eval` e origens externas de OCR (`cdn.jsdelivr.net/npm/tesseract.js*`) e cotações (`brapi.dev`, `economia.awesomeapi.com.br`, `api.bcb.gov.br`, `*.r2.dev`).
- **`android/app/src/main/AndroidManifest.xml`:** **S10:** `android:allowBackup="true"` ativo; `android:usesCleartextTraffic="false"` e `networkSecurityConfig` configurados.
- **Observabilidade (`src/services/observability.ts`):** `scrubSensitiveData` cobre CPF, cartão, Bearer e query params selecionados, mas **S09:** precisa ampliar cobertura para chaves/fluxos de Auth multiconta e transações de tracing.

### 2.3 Triagem de Dependências (`npm audit`)

- **`npm audit --omit=dev`:** **0 vulnerabilidades** em dependências de produção.
- **`npm audit` (lockfile completo):** **12 vulnerabilidades de severidade moderada** restritas à cadeia de desenvolvimento e build:
  - `glob` (`9.0.0 - 14.0.1`, GHSA-3g3m-2fjr-6pw4) via `workbox-build` → `vite-plugin-pwa` (build-time; não empacotado no runtime do cliente; `npm audit fix --force` faria downgrade breaking para `vite-plugin-pwa@1.1.0`).
  - `minimatch` (`7.0.0 - 11.0.0`, GHSA-g3hv-75wg-m249) via `eslint`, `@eslint/config-array` e `@typescript-eslint/*` (lint-time; zero impacto no bundle distribuído).

---

## 3. Baseline de Testes Executados

| Comando / Suíte | Resultado | Observações e Divergências |
|---|---|---|
| `npm run verify` (`tsc -b`, `eslint .`, `vitest run src/domain/`) | **Passou** (exit 0) | Typecheck limpo; Lint com 0 erros e 10 avisos (`react-refresh/only-export-components` em `scripts/sample-reports-entry.tsx` e `src/app/router.tsx`); **288 arquivos / 3.674 testes** de domínio verdes. |
| Suíte focada de Segurança, Auth e PWA (10 arquivos) | **9 passaram, 1 falhou** (214/215 testes) | `src/data/auth.test.ts`, `client.test.ts`, `security-rls.test.ts`, `devices.test.ts`, `push-subscriptions.test.ts`, `security-headers.test.ts`, `cross-tenant-penetration.test.ts`, `pwa-audit.test.ts`, `pwa.test.tsx` verdes. **Falha observada:** `src/tests/security-audit.test.ts` (`apply_cumulative_renewal_from_payment` em `20260101000171_billing_hardening_card_lock_and_cumulative_rpc.sql`, alteração não-relacionada já presente na branch `fix/asaas-billing-homologation`, sem `auth.uid()` no corpo). |
| pgTAP (`supabase/tests/database/*.sql`), Worker/Miniflare, Android APK e Cloud | **Pendente de ambiente** | Registrados na matriz de T01/T02/T08/T09 (requerem Docker/Supabase local, Wrangler/Cloudflare, Gradle/dispositivo e contas sintéticas A/B/operador provisionadas). |
