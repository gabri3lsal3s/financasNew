# Auditoria Principal de Segurança e Arquitetura — Áxis / Axir

- **Escopo Auditado:** Fluxo ponta a ponta entre Frontend (`src/hooks`, `src/state`, `src/data`, `src/app`, `src/components/routing`, `src/features/subscription`), Migrations SQL/RLS/RPCs (`supabase/migrations/20260101000001` a `20260101000159`) e Edge Functions Deno (`supabase/functions/*`).
- **Modo de Execução:** Somente leitura estrita sobre o código-fonte existente (zero arquivos modificados).
- **Critério de Inclusão:** Apenas vulnerabilidades e falhas arquiteturais reais, verificadas diretamente no código, com referência exata `arquivo:linha` e Prova de Conceito (PoC) reproduzível.

---

## Sumário Executivo e Matriz Consolidada de Achados

Foram identificados **16 achados reais** distribuídos nos três pilares auditados: **3 Críticos**, **5 Altos**, **6 Médios** e **2 Baixos**.

| ID | Pilar | Severidade | Componente Principal (`arquivo:linha`) | Resumo do Risco |
|---|---|---|---|---|
| **S01** | 1 · RLS & Superfície | **Crítico** | `supabase/migrations/20260101000065_create_public_shares_table.sql:27` | Qualquer cliente `anon` ou `authenticated` lista e baixa todos os compartilhamentos ativos (`payload` JSONB, `user_id`, `token`) de todos os usuários via PostgREST; escrita não valida conta ativa nem `read_only`. |
| **W01** | 2 · Assinatura & Webhooks | **Crítico** | `supabase/functions/asaas-checkout/index.ts:568` | Gerar QR Code PIX Anual durante `trial_scheduled` limpa `scheduled_plan_id` sem cancelar a assinatura de cartão no Asaas, causando cobrança dupla (PIX + cartão) ou cobrança oculta em conta expirada. |
| **W02** | 2 · Assinatura & Webhooks | **Crítico** | `supabase/functions/asaas-checkout/index.ts:839` | Gravação de lock em `billing_processed_payments` sem rollback em falha de `user_subscriptions.update` faz o `asaas-webhook` ignorar todos os retries como duplicados, travando cliente pagante em `read_only`. |
| **S02** | 1 · RLS & Superfície | **Alto** | `supabase/functions/admin-super-action/index.ts:92` | Superadmins sem TOTP cadastrado operam com `aal1` em ações destrutivas; `admin` comum altera catálogo global `public.plans`, exclui `access_invites` sem auditoria e concede `lifetime` sem cancelar Asaas. |
| **S03** | 1 · RLS & Superfície | **Alto** | `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:2121` | `restore_backup` (`SECURITY DEFINER`) insere UUIDs controlados pelo cliente diretamente em PKs globais e liga flags de bypass de triggers (`app.allow_pair_mutation`), criando oráculo cross-tenant (`23505`). |
| **W03** | 2 · Assinatura & Webhooks | **Alto** | `supabase/functions/_shared/asaas-webhook-logic.ts:296` | Deduplicação em `billing_webhook_logs` não interrompe replays; `PAYMENT_REFUNDED` (quando `asaas_payment_id` é `null`) e `PAYMENT_CHARGEBACK_REQUESTED` de cobrança antiga derrubam assinatura nova vigente. |
| **R01** | 3 · Resiliência | **Alto** | `src/hooks/use-auth.ts:193` | `resolveMfaState` ignora `error` do SDK Supabase Auth e retorna `mfaRequired: false, aalLevel: "aal1"` (*fail-open*), permitindo bypass dos guards de rota TOTP em falhas transitórias de rede. |
| **R02** | 3 · Resiliência | **Alto** | `src/data/repositories/access.ts:41` | `getMyFeatures()` captura falhas de RPC e retorna `{}` como sucesso; TanStack Query cacheia todas as features desligadas, `RequireFeature` expulsa o usuário da rota e o app Android limpa o listener bancário. |
| **S04** | 1 · RLS & Superfície | **Médio** | `supabase/migrations/20260101000060_support_tickets.sql:40` | Mutações diretas via PostgREST burlam `read_only` (`categories`, `user_preferences`, `audit_events`) e permitem que contas `banned`/`suspended` inundem `support_tickets` (+ spam Telegram) e `app_analytics_events`. |
| **W04** | 2 · Assinatura & Webhooks | **Médio** | `supabase/functions/asaas-manage/index.ts:391` | `billing_start_at` nunca é renovado em reativações pós-cancelamento (`asaas-checkout:865`, `asaas-webhook:461`), negando estorno legal de 7 dias (CDC Art. 49) em novas contratações. |
| **W05** | 2 · Assinatura & Webhooks | **Médio** | `supabase/functions/ai-financial-assistant/index.ts:555` | Checagem hardcoded exige `status === "active"` ou `"trialing"`, bloqueando com `403 read_only` assinantes `past_due` dentro do grace period de 7 dias / manual e overrides modulares. |
| **R03** | 3 · Resiliência | **Médio** | `src/state/queries/use-user-access.ts:127` | `CHANNEL_ERROR` ou `TIMED_OUT` no canal Realtime remove o canal singleton e zera `subscriberCount` sem reconectar, cegando revogações de acesso e atualizações de plano até reload completo. |
| **R04** | 3 · Resiliência | **Médio** | `src/hooks/use-device-session-sync.ts:68` | Flag global `isHandlingRemoteRevocation` não possui `finally` nem reset em `teardownSingleton()`, desativando registro e revogação remota de sessão se `RequireAuth` desmontar durante o `signOut`. |
| **R05** | 3 · Resiliência | **Médio** | `supabase/functions/asaas-manage/index.ts:729` | Falha na API do Asaas em `list-invoices` retorna HTTP 200 `{ invoices: [] }`, fazendo o frontend cachear histórico vazio como sucesso em vez de exibir erro com retry. |
| **W06** | 2 · Assinatura & Webhooks | **Baixo** | `supabase/functions/_shared/resend.ts:181` | Inexistência de webhook Resend (`email.bounced` / `email.complained`) aliada a `dedup_key` permanente registra bounces de cobrança como `sent` sem alerta ou reenvio. |
| **R06** | 3 · Resiliência | **Baixo** | `src/data/repositories/access.ts:52` | `checkInviteEligibility` consulta `public.access_invites` diretamente sem policy `SELECT` para não-admins (retornando sempre falso) e usa `.ilike()` sem escapar curingas `%` e `_`. |

---

## Controles Existentes Verificados (Sem Falsos Positivos)

Durante a varredura integral das migrations e funções, confirmou-se que os seguintes vetores já se encontram devidamente mitigados:

- **Isolamento RLS das tabelas financeiras centrais:** `incomes`, `expenses`, `cash_checkpoints`, `credit_cards`, `card_payments`, `card_competence_overrides`, `debts`, `loans`, `budgets`, `portfolio_assets`, `portfolio_transactions`, `portfolio_dividends`, `user_dividend_events` e `asset_prices` aplicam `(select auth.uid()) = user_id`, `public.is_current_user_active()` e `public.can_current_user_write_module(...)` (`supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:68` a `:719`, `20260101000142_global_market_quotes_engine.sql:150`, `20260101000143_automated_dividends_engine.sql:523`).
- **Ausência de Views inseguras:** Não há `CREATE VIEW` sem `security_invoker` em `supabase/migrations/`.
- **Proteção colunar de PII e imutabilidade de perfil:** `cpf`, `phone`, `postal_code` e `address_number` tiveram `SELECT` revogado de `anon, authenticated` em `profiles`, e `protect_profile_security_fields()` impede auto-promoção de `role`/`status` (`supabase/migrations/20260101000153_harden_billing_rls_pii_and_lifecycle.sql:30`, `20260101000139_security_audit_remediation_and_rls_hardening.sql:779`).
- **Viagens públicas com PIN:** `get_public_trip_ledger`, `add_public_trip_expense` e `claim_trip_member` já exigem hash bcrypt e rate-limit via `verify_trip_passcode_guarded` (`supabase/migrations/20260101000158_security_audit_remediation_v2.sql:15`).

---

## Pilar 1 — Superfície de Ataque & RLS

### [S01 · Crítico] Vazamento Cross-Tenant Integral em `public.public_shares` e Mutação sem Guardas de Conta/Assinatura

- **Arquivos e linhas:**
  - `supabase/migrations/20260101000065_create_public_shares_table.sql:27` (policy `"public_shares_select"`)
  - `supabase/migrations/20260101000065_create_public_shares_table.sql:41` (`"public_shares_insert"`), `:49` (`"public_shares_update"`), `:58` (`"public_shares_delete"`)
  - `supabase/migrations/20260101000065_create_public_shares_table.sql:78` (`grant select on public.public_shares to anon, authenticated;`)
- **Causa Raiz:**
  A tabela `public.public_shares` concede `SELECT` direto aos roles `anon` e `authenticated` via PostgREST (`0065:78`). A política `"public_shares_select"` (`0065:27`) autoriza a leitura de qualquer linha onde `is_revoked = false and (expires_at is null or expires_at > now())`, assumindo equivocadamente que o cliente sempre enviará `WHERE token = '...'`. Como o PostgreSQL avalia `USING (...)` linha a linha, uma consulta sem filtro retorna **todas** as linhas ativas da base, expondo `user_id`, `token` secreto e o `payload` JSONB completo (nomes de membros da família, orçamentos familiares, metas financeiras e participantes/valores de rachas). Adicionalmente, as políticas de `INSERT`, `UPDATE` e `DELETE` (`0065:41`–`:62`) checam apenas `(select auth.uid()) = user_id`, omitindo `public.is_current_user_active()` e `public.can_current_user_write()`.
- **Prova de Conceito (PoC):**
  ```bash
  # 1. Qualquer visitante não autenticado extrai todos os links públicos e dados financeiros compartilhados:
  curl -sS "${SUPABASE_URL}/rest/v1/public_shares?select=id,user_id,kind,token,payload,expires_at&limit=1000" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

  # 2. Usuário suspenso/banido ou com trial expirado (read_only) publica novos snapshots livremente:
  curl -sS -X POST "${SUPABASE_URL}/rest/v1/public_shares" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${EXPIRED_OR_SUSPENDED_USER_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"<uid>","kind":"split","token":"token-arbitrario-123","payload":{"items":[]}}'
  ```
- **Recomendação:**
  Revogar `SELECT` de `anon` na tabela `public.public_shares`, restringir `"public_shares_select"` exclusivamente ao proprietário autenticado ativo (`(select auth.uid()) = user_id and (select public.is_current_user_active())`), expor a leitura pública somente via RPC `SECURITY DEFINER` que exija `p_token text` com correspondência exata (`WHERE token = p_token AND is_revoked = false AND (expires_at IS NULL OR expires_at > now())`), e exigir `is_current_user_active()` + `can_current_user_write()` em `INSERT`/`UPDATE`.

---

### [S02 · Alto] Bypass Condicional de AAL2 para Superadmin sem TOTP e Escopo Excessivo de `admin` Comum (`plans`, `access_invites`, `user_subscriptions`)

- **Arquivos e linhas:**
  - `supabase/functions/admin-super-action/index.ts:92` (`if (hasVerifiedMfa)` antes de exigir `jwtPayload?.aal === "aal2"`)
  - `supabase/migrations/20260101000158_security_audit_remediation_v2.sql:134` (`assert_active_superadmin_aal2` exige `v_aal = 'aal2'` somente `IF v_has_verified_mfa THEN`)
  - `supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:783` (`"Admins gerenciam convites"` em `public.access_invites`) e `:800` (`"Admins gerenciam planos"` em `public.plans`)
  - `supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:1796` e `:1843` (`admin_set_user_subscription`)
- **Causa Raiz:**
  1. **MFA opcional para Superadmin:** Tanto `admin-super-action/index.ts:92` quanto `public.assert_active_superadmin_aal2` (`0158:134`) verificam `aal2` **apenas se** o superadmin possuir um fator `verified` em `auth.mfa_factors`. Caso um superadmin não tenha enrollado TOTP (ex.: conta recém-provisionada via `provision_user` com `role: "superadmin"` em `admin-super-action/index.ts:124`), um JWT `aal1` executa exclusão irreversível de contas (`admin_delete_user`), reset de MFA de terceiros (`admin_reset_user_mfa`) e criação de novos `superadmin`s.
  2. **Tabelas globais editáveis diretamente por `admin` comum sem auditoria:** A migration `0139:815` revogou escrita direta em `system_features` e `user_subscriptions`, mas esqueceu `public.plans` (`0051:800`) e `public.access_invites` (`0051:783`). Um `admin` comum pode adulterar preços/nomes em `public.plans` ou executar `DELETE` físico em `public.access_invites` via PostgREST sem gerar `audit_events`.
  3. **Auto-promoção financeira e dessincronização Asaas em `admin_set_user_subscription`:** Qualquer `admin` comum (`is_admin()`, `aal1`) pode invocar `admin_set_user_subscription` (`0128:1777`) para conceder `tier = 'lifetime'` a si mesmo ou alterar um assinante pagante para `lifetime`/`read_only` diretamente no banco (`0128:1843`), **sem** cancelar nem limpar `asaas_subscription_id` no Asaas — mantendo cobranças recorrentes ativas no cartão de um cliente já convertido/bloqueado.
- **Prova de Conceito (PoC):**
  ```bash
  # 1. Superadmin sem TOTP enrollado deleta qualquer usuário usando apenas sessão AAL1:
  curl -sS -X POST "${SUPABASE_URL}/rest/v1/rpc/admin_delete_user" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPERADMIN_AAL1_NO_TOTP_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"target_user_id":"<victim_uuid>"}'

  # 2. Admin comum (AAL1) altera catálogo global de planos direto via PostgREST sem audit_event:
  curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/plans?id=eq.pro_annual" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${REGULAR_ADMIN_AAL1_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"price_cents":0}'
  ```
- **Recomendação:**
  Tornar o cadastro de fator MFA verificado (`v_has_verified_mfa = true` **e** `aal = 'aal2'`) obrigatório de forma incondicional em `assert_active_superadmin_aal2` e em `admin-super-action`; revogar `INSERT, UPDATE, DELETE` direto de `authenticated` sobre `public.plans` e `public.access_invites` (forçando uso exclusivo de RPCs auditadas); e restringir `tier = 'lifetime'` / mutações manuais de assinatura que conflitem com `asaas_subscription_id` ativa a fluxo de Superadmin na Edge Function `admin-super-action` (cancelando antes a recorrência no Asaas).

---

### [S03 · Alto] Oráculo Cross-Tenant de Existência de UUID (`23505`) e Bypass de Triggers em `public.restore_backup`

- **Arquivos e linhas:**
  - `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:2121` (`CREATE OR REPLACE FUNCTION public.restore_backup` com `SECURITY DEFINER`)
  - `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:2149` (`set_config('app.allow_pair_mutation', 'true', true)`, `app.snapshot_rpc = 'on'`, `app.dividend_tracking_rpc = 'on'`)
  - `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:2186` a `:2490` (`INSERT` direto de `id` controlado pelo JSON do cliente em `categories`, `credit_cards`, `portfolio_assets`, `incomes`, `expenses`, `debts`, `portfolio_dividends`, `cash_checkpoints`)
- **Causa Raiz:**
  `restore_backup` executa com privilégios de proprietário (`SECURITY DEFINER`), suprime os gatilhos de proteção de integridade transacional na sessão (`app.allow_pair_mutation = 'true'`) e insere diretamente os valores de chave primária `id` enviados no JSON do cliente sem remapeamento para novos UUIDs (`gen_random_uuid()`).
  1. Como a PK `id` é global na tabela e a função roda fora de RLS, se o atacante informar um UUID existente pertencente a **outro tenant**, o banco aborta com `SQLSTATE 23505 (unique_violation)` revelando a existência do registro e de qual tabela ele faz parte (oráculo cross-tenant); caso não exista, retorna `{"success": true}`.
  2. Usuários legítimos que exportam um backup de uma conta e tentam restaurá-lo em outra conta na plataforma sofrem falha total (`23505`).
  3. Com `app.allow_pair_mutation = 'true'` ativo durante toda a função, um JSON artesanal injeta despesas/receitas com `transfer_pair_id` órfãos ou valores divergentes entre escopos PF/PJ, violando invariantes contábeis protegidas por trigger.
- **Prova de Conceito (PoC):**
  ```bash
  # Sonda se o cartão ou ativo <target_uuid> existe na carteira de qualquer outro usuário do sistema:
  curl -sS -X POST "${SUPABASE_URL}/rest/v1/rpc/restore_backup" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${ATTACKER_TRIAL_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"p_backup":{"data":{"categories":[{"id":"<target_uuid>","type":"expense","name":"Probe","icon":"tag","color":"#000000"}]}}}'
  # Retorno HTTP 409 / code "23505" => UUID pertence a outro usuário; HTTP 200 => UUID livre.
  ```
- **Recomendação:**
  Gerar um mapa temporário `old_id -> gen_random_uuid()` dentro de `restore_backup` (reescrevendo todas as PKs e FKs internas do backup para novos UUIDs exclusivos da restauração) e validar explicitamente a simetria de `transfer_pair_id` antes de habilitar `app.allow_pair_mutation`.

---

### [S04 · Médio] Bypass de Modo `read_only` e de Contas Suspensas/Banidas via PostgREST + Amplificação de Spam no Telegram

- **Arquivos e linhas:**
  - `supabase/migrations/20260101000060_support_tickets.sql:40` a `:66` e `:100` (`support_tickets` exige apenas `(select auth.uid()) = user_id`)
  - `supabase/migrations/20260101000140_support_ticket_webhook_and_dedup.sql:90` a `:118` (`trg_notify_support_ticket_webhook` dispara `net.http_post` em cada `INSERT`)
  - `supabase/functions/support-notify/index.ts:62` a `:110` (ramo webhook `payload.record` não valida `profiles.status === 'active'`)
  - `supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:725` (`categories_all_own`), `:743` (`preferences_insert_own`), `:750` (`preferences_update_own`), `:761` (`audit_events_insert_own`)
  - `supabase/migrations/20260101000062_purge_legacy_cash_transactions.sql:112` (`app_analytics_events` aceita `user_id is null` sem checar status da conta)
  - `supabase/migrations/20260101000136_user_push_subscriptions.sql:51` (`user_push_subscriptions` sem `is_current_user_active()`)
- **Causa Raiz:**
  - **Spam de tickets e Telegram por usuários banidos/suspensos:** Enquanto a chamada direta à Edge Function `support-notify/index.ts:194` bloqueia perfis inativos, o `INSERT` direto via PostgREST em `public.support_tickets` (`0060:40`) não exige `is_current_user_active()` nem rate-limit. Cada `INSERT` dispara `trg_notify_support_ticket_webhook` (`0140:115`), que chama `support-notify` autenticada com `x-webhook-secret` (`0140:94`), caindo no Cenário 1 (`support-notify/index.ts:62`) que envia a mensagem direto ao bot do Telegram do fundador sem checar `profile.status`. O usuário também pode deletar seus chamados (`0060:62`) ou alterar `status` para `'resolved'` (`0060:54`).
  - **Escrita em modo `read_only` e poluição de auditoria/telemetria:** As policies de `categories`, `user_preferences` e `audit_events` (`0051:725`–`:765`) verificam `is_current_user_active()`, mas **nunca `can_current_user_write()`**, permitindo que contas expiradas criem/excluam categorias e injetem entradas falsas em `audit_events`. Em `app_analytics_events` (`0062:112`), qualquer JWT (mesmo `banned`) pode inserir linhas com `user_id: null` (que nem `admin_delete_user` em `0158:272` consegue limpar).
- **Prova de Conceito (PoC):**
  ```bash
  # Conta com status = 'banned' inunda o banco e dispara webhooks reais no Telegram operacional:
  for i in $(seq 1 20); do
    curl -sS -X POST "${SUPABASE_URL}/rest/v1/support_tickets" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${BANNED_USER_JWT}" \
      -H "Content-Type: application/json" \
      -d "{\"user_id\":\"<banned_uid>\",\"type\":\"bug\",\"message\":\"Spam #$i\"}"
  done
  ```
- **Recomendação:**
  Exigir `(select public.is_current_user_active())` em `support_tickets` (bloqueando `DELETE` pelo usuário final e restringindo `UPDATE` de `status` a `is_admin()`), exigir `user_id = (select auth.uid()) and (select public.is_current_user_active())` em `app_analytics_events` e `user_push_subscriptions`, exigir `(select public.can_current_user_write())` para mutações em `categories`, e revogar `INSERT` direto de `authenticated` em `audit_events` (restringindo a triggers/RPCs).

---

## Pilar 2 — Integridade de Assinatura e Webhooks

### [W01 · Crítico] Geração de PIX Anual durante `trial_scheduled` Apaga Agendamento no Banco sem Cancelar Recorrência no Asaas (Cobrança Dupla ou Cobrança Oculta)

- **Arquivos e linhas:**
  - `supabase/functions/asaas-checkout/index.ts:568` (sobrescreve `scheduled_plan_id: null` e `scheduled_first_charge_at: null` na simples geração do QR Code PIX)
  - `supabase/functions/_shared/asaas-webhook-logic.ts:244` (`isUpgradeFromMonthly` exige `currentSub.tier === "pro_monthly" && currentSub.status === "active"`)
  - `supabase/functions/asaas-webhook/index.ts:502` e `:533` (só cancela e limpa `asaas_subscription_id` quando `decision.isUpgradeFromMonthly` é `true`)
  - `supabase/migrations/20260101000157_past_due_grace_and_reminders.sql:525` (`reconcile_expired_subscriptions` expira trials com `scheduled_plan_id IS NULL`)
- **Causa Raiz:**
  Quando um usuário em período de testes agenda um cartão de crédito (`asaas-checkout/index.ts:739`), o sistema cria uma assinatura recorrente real no Asaas (`asaas_subscription_id = "sub_trial"`) com `nextDueDate = trial_ends_at` e grava `scheduled_plan_id` no banco. Se, ainda durante o trial (`tier = 'trial'`, `status = 'trialing'`), o usuário clicar para gerar um QR Code PIX do Plano Anual (`asaas-checkout/index.ts:485`), o endpoint executa imediatamente (`568`–`576`) `scheduled_plan_id: null, scheduled_first_charge_at: null`, **sem cancelar `sub_trial` no Asaas**.
- **Prova de Conceito (PoC — 2 Cenários Reproduzíveis):**
  1. **Cenário A — Cobrança Dupla (PIX pago + Cartão debitado):**
     - Passo 1: Usuário em trial cadastra cartão Mensal (`asaas_subscription_id = "sub_trial"`, `tier = "trial"`, `status = "trialing"`).
     - Passo 2: Usuário decide aproveitar o desconto do Anual via PIX, gera o QR Code (`asaas-checkout:568` zera `scheduled_plan_id`) e paga o PIX.
     - Passo 3: `asaas-webhook` recebe `PAYMENT_RECEIVED` (sem `payment.subscription`). Em `asaas-webhook-logic.ts:244`, `isUpgradeFromMonthly` avalia `false` porque `currentSub.tier` era `"trial"` (e não `"pro_monthly"`).
     - Passo 4: Em `asaas-webhook/index.ts:502` e `:533`, `sub_trial` **não é cancelada no Asaas** e `user_subscriptions.asaas_subscription_id` permanece `"sub_trial"`. No fim dos 30 dias, o Asaas debita o cartão de um cliente que já pagou 1 ano adiantado via PIX.
  2. **Cenário B — Cobrança Oculta em Conta Bloqueada (PIX abandonado):**
     - Passo 1: Usuário em `trial_scheduled` gera QR Code PIX Anual apenas para consultar e fecha a tela sem pagar.
     - Passo 2: Como `scheduled_plan_id` virou `null`, a UI esconde o cartão agendado. No dia 30, `reconcile_expired_subscriptions` (`0157:525`) vê `scheduled_plan_id IS NULL` e bloqueia o usuário em `read_only_expired`, enquanto o Asaas cobra normalmente `sub_trial` no cartão.
- **Recomendação:**
  Em `asaas-checkout/index.ts:568`, **não** limpar `scheduled_plan_id` nem `scheduled_first_charge_at` na mera emissão de QR Code PIX pendente (persistir apenas na tabela `billing_intents`). No `asaas-webhook/index.ts:502` e `:535`, sempre que ativar um pagamento avulso (`!subscriptionId` / PIX Anual) e existir qualquer `userSub.asaas_subscription_id` prévia (seja `pro_monthly` ou `trial` agendado), cancelar `userSub.asaas_subscription_id` no Asaas (marcando `asaas_sync_status = 'pending_resync'` se a chamada HTTP falhar) e limpar `asaas_subscription_id: null`.

---

### [W02 · Crítico] Lock Órfão em `billing_processed_payments` no `asaas-checkout` Bloqueia Permanentemente Retries do Webhook e Deixa Assinaturas Órfãs no Gateway

- **Arquivos e linhas:**
  - `supabase/functions/asaas-checkout/index.ts:839` a `:886` (`upsert` em `billing_processed_payments` sem rollback caso `user_subscriptions.update` falhe na linha `:883`)
  - `supabase/functions/asaas-webhook/index.ts:138` a `:146` e `:491` (`processedPayment` faz `decideWebhookAction` retornar `ignore_duplicate` em `supabase/functions/_shared/asaas-webhook-logic.ts:193`)
  - `supabase/functions/asaas-checkout/index.ts:705` a `:761` (cria assinatura no Asaas sem compensação caso o `UPDATE` do banco falhe em `:758` ou `:883`)
  - `supabase/functions/asaas-manage/index.ts:180` a `:206` (`updateAsaasSubscriptionCycle` altera ciclo/valor no Asaas sem compensação caso o `UPDATE` falhe em `:203`)
- **Causa Raiz:**
  No checkout imediato por cartão (`asaas-checkout/index.ts:839`), quando a primeira cobrança já nasce `CONFIRMED`, a Edge Function insere `firstPaymentId` em `billing_processed_payments` **antes** de ativar `user_subscriptions` (`858`). Ao contrário do `asaas-webhook/index.ts:552` (que deleta `lockedRow.id` se o `UPDATE` subsequente falhar), `asaas-checkout` retorna HTTP 500 na linha `885` **mantendo o lock gravado em `billing_processed_payments`**. Quando o Asaas envia/retenta `PAYMENT_CONFIRMED`, `asaas-webhook/index.ts:138` encontra o `processedPayment`, `asaas-webhook-logic.ts:193` classifica como `ignore_duplicate` (`already_active`), e o webhook responde HTTP 200 sem ativar a conta — deixando o cliente que já pagou preso em `read_only`.
  Da mesma forma, se `schedUpdateErr` (`758`) ou `activeUpdateErr` (`883`) ocorrer após `createAsaasCreditCardSubscription` (`705`), a nova assinatura fica ativa e órfã no Asaas; uma segunda tentativa do usuário cria uma segunda recorrência paralela.
- **Prova de Conceito (PoC):**
  1. Usuário `read_only` submete cartão em `asaas-checkout`; Asaas aprova `sub_new` e `pay_001` (`CONFIRMED`).
  2. `asaas-checkout:839` grava `pay_001` em `billing_processed_payments`; em seguida `asaas-checkout:858` sofre timeout transitório do PostgREST e retorna HTTP 500 (`user_subscriptions` continua `tier = 'read_only'`).
  3. Asaas dispara `POST /functions/v1/asaas-webhook` com `event = 'PAYMENT_CONFIRMED'` e `payment.id = 'pay_001'`.
  4. `asaas-webhook` lê `billing_processed_payments`, vê `isPaymentAlreadyProcessed = true`, responde `200 {"received":true,"ignored":true,"reason":"already_active"}` e encerra os retries. O cliente foi cobrado no cartão e permanece permanentemente bloqueado.
- **Recomendação:**
  Encapsular a gravação de `billing_processed_payments` + `user_subscriptions` + `billing_intents` em uma única RPC transacional SQL (ou remover `billing_processed_payments.delete()` no `catch`/`if (activeUpdateErr)` em `asaas-checkout:883`), e executar rollback compensatório `cancelAsaasSubscription(subscription.id)` quando a persistência inicial da assinatura no banco falhar em `asaas-checkout:758`.

---

### [W03 · Alto] Desduplicação Inócua de `provider_event_id` e Revogação Indevida de Assinatura Ativa por Estorno/Chargeback de Cobrança Antiga

- **Arquivos e linhas:**
  - `supabase/functions/asaas-webhook/index.ts:220` a `:232` (`billing_webhook_logs.insert` sem verificar `{ error }` retornado pelo `supabase-js`)
  - `supabase/functions/_shared/asaas-webhook-logic.ts:296` a `:310` (`PAYMENT_CHARGEBACK_REQUESTED` sem correlação com pagamento/assinatura vigente)
  - `supabase/functions/_shared/asaas-webhook-logic.ts:362` a `:379` (`PAYMENT_REFUNDED` considera `matchesCurrentPayment = true` sempre que `currentSub.asaas_payment_id` é `null`)
  - `supabase/functions/asaas-webhook/index.ts:879` a `:947` (execução de `mark_refunded` e `mark_chargeback`)
- **Causa Raiz:**
  1. **Replay livre por `provider_event_id`:** Em `asaas-webhook/index.ts:221`, `await supabase.from("billing_webhook_logs").insert(...)` não verifica `error` (o cliente Supabase retorna `{ data, error }` sem lançar exceção em violação `23505`), e mesmo no `catch` apenas emite `console.warn` e segue o fluxo. Qualquer requisição repetida com o token estático `asaas-access-token` reexecuta a máquina de estados.
  2. **Estorno antigo derruba assinatura atual:** Em `asaas-webhook-logic.ts:362`, `matchesCurrentPayment` é definido como `!currentSub.asaas_payment_id || !payment?.id || payment.id === currentSub.asaas_payment_id`. Se `currentSub.asaas_payment_id` estiver `null` (ex.: assinatura criada via `asaas-checkout:879` antes da fatura inicial aparecer, ou plano atribuído via `admin_set_user_subscription`), um `PAYMENT_REFUNDED` referente a um pagamento antigo do mesmo `customer_id` avalia `!currentSub.asaas_payment_id === true` e cancela imediatamente a assinatura atual (`asaas-webhook:881`), limpando `asaas_subscription_id: null` no banco **sem cancelar a recorrência no Asaas**.
  3. **Chargeback antigo cancela assinatura nova:** Em `asaas-webhook-logic.ts:296`, `PAYMENT_CHARGEBACK_REQUESTED` não faz **nenhuma** checagem se `payment.id` ou `payment.subscription` pertence ao ciclo vigente — basta resolver o `userSub` por `customer_id` para cancelar a assinatura atual (`asaas-webhook:918` e `:932`).
- **Prova de Conceito (PoC):**
  ```json
  // Usuário possui nova assinatura ativa (asaas_subscription_id = "sub_nova", asaas_payment_id = null)
  // Chega webhook tardio ou replay de estorno/chargeback de cobrança antiga "pay_antigo_2025":
  {
    "id": "evt_old_refund_01",
    "event": "PAYMENT_REFUNDED",
    "payment": {
      "id": "pay_antigo_2025",
      "customer": "cus_mesmo_cliente",
      "subscription": "sub_antiga_cancelada",
      "value": 24.9
    }
  }
  // Resultado: matchesCurrentPayment === true (!currentSub.asaas_payment_id) -> tier vira 'read_only' e sub_nova fica zumbi no Asaas.
  ```
- **Recomendação:**
  Verificar `{ error }` no `insert` de `billing_webhook_logs` (retornando `200 { duplicate: true }` apenas após confirmar que o evento anterior concluiu com sucesso, usando coluna `processed_at`), remover `!currentSub.asaas_payment_id` de `matchesCurrentPayment` (exigindo igualdade explícita `Boolean(payment?.id && currentSub.asaas_payment_id && payment.id === currentSub.asaas_payment_id)`), cancelar a recorrência no Asaas também em `mark_refunded`, e exigir correlação de `payment.id` ou `payment.subscription` antes de derrubar uma assinatura ativa em `PAYMENT_CHARGEBACK_REQUESTED` (limitando-se a gravar `chargeback_flagged_at` + alerta administrativo quando o chargeback for de contrato anterior já encerrado).

---

### [W04 · Médio] Reativação de Ex-Assinante Não Renova `billing_start_at` e Bloqueia Direito de Arrependimento de 7 Dias (CDC Art. 49)

- **Arquivos e linhas:**
  - `supabase/functions/asaas-checkout/index.ts:865` (`billing_start_at: userSub.billing_start_at || nowIso`)
  - `supabase/functions/asaas-webhook/index.ts:461` e `:540` (`isFirstPaidCharge = !userSub.billing_start_at || userSub.tier === "trial"`)
  - `supabase/functions/asaas-manage/index.ts:391` a `:397` (`isWithin7Days` medido exclusivamente a partir de `userSub.billing_start_at`)
- **Causa Raiz:**
  Um usuário que assinou no passado, cancelou, expirou para `tier = 'read_only'` (`status = 'canceled'` ou `'read_only_expired'`) e meses depois decide contratar novamente o Plano Pro Anual ou Mensal mantém o `billing_start_at` original da primeira assinatura histórica (`userSub.billing_start_at || nowIso`). Quando solicita o cancelamento em menos de 7 dias da nova compra (`asaas-manage/index.ts:391`), `Date.now() - billingStartTime <= SEVEN_DAYS_MS` resulta `false`, negando o reembolso integral automático exigido pelo Art. 49 do CDC.
- **Prova de Conceito (PoC):**
  1. Usuário assinou em `2026-01-10` (`billing_start_at = 2026-01-10`), cancelou em fevereiro e ficou em `tier = 'read_only'`, `status = 'canceled'`.
  2. Em `2026-11-26`, contrata um novo Plano Pro Anual (R$ 178,80) via cartão ou PIX; `billing_start_at` permanece `2026-01-10`.
  3. No mesmo dia (`2026-11-26`), aciona `POST /functions/v1/asaas-manage` com `{"action":"cancel"}`.
  4. `isWithin7Days` dá `false` (320 dias > 7 dias) e o sistema recusa o estorno, agendando apenas `cancel_at_period_end` para `2027-11-26`.
- **Recomendação:**
  Redefinir `billing_start_at = nowIso` sempre que a transição de ativação partir de um estado encerrado/sem vigência ativa (`userSub.tier === 'read_only'` ou `['canceled', 'read_only_expired'].includes(userSub.status)` e `(!userSub.current_period_end || Date.parse(userSub.current_period_end) <= now.getTime())`), preservando uma flag separada `cdc_refund_used_at` caso se deseje evitar abuso repetitivo de estornos seguidos.

---

### [W05 · Médio] Bloqueio Inconsistente em `ai-financial-assistant` Ignora Grace Period de `past_due` e Overrides de `user_module_permissions`

- **Arquivos e linhas:**
  - `supabase/functions/ai-financial-assistant/index.ts:555` a `:566`
  - `supabase/migrations/20260101000157_past_due_grace_and_reminders.sql:207` a `:228` (`resolve_user_module_access`)
- **Causa Raiz:**
  A função SQL canônica `resolve_user_module_access` (`0157:207`) garante acesso de escrita (`'write'`) para assinantes em `status = 'past_due'` durante os 7 dias de tolerância automática (`past_due_grace_mode = 'auto'`), durante tolerância manual (`past_due_block_at > NOW()`), para trials com `status = 'active'` (`0157:225`) e para usuários com permissão explícita em `user_module_permissions`. Contudo, `ai-financial-assistant/index.ts:555` ignora o RPC do banco e exige manualmente `sub?.status === "active"` (Pro) ou `sub?.status === "trialing"` (Trial).
- **Prova de Conceito (PoC):**
  1. Renovação do cartão de um assinante Pro falha hoje; `asaas-webhook` marca `status = 'past_due'` com 7 dias de grace period (`canWrite === true` em toda a UI).
  2. O usuário abre a importação de fatura/comprovante habilitada na tela e aciona a categorização/extração por IA.
  3. `ai-financial-assistant` rejeita com HTTP `403 {"error":"Assinatura em modo somente leitura."}`.
- **Recomendação:**
  Substituir a checagem manual em `ai-financial-assistant/index.ts:547`–`:566` por uma chamada autenticada a `userClient.rpc("can_current_user_write_module", { p_module_key: "transactions" })` (mantendo a distinção de cota `pro` vs `trial` apenas para limites de uso).

---

### [W06 · Baixo] Cegueira de Entregabilidade no Resend (Sem Webhook de Bounce/Complaint) com `dedup_key` Permanente

- **Arquivos e linhas:**
  - `supabase/functions/_shared/resend.ts:181` a `:195`
  - `supabase/functions/billing-lifecycle-cron/index.ts:350` a `:370`
- **Causa Raiz:**
  `sendTransactionalEmail` marca `transactional_email_logs.status = "sent"` imediatamente após o HTTP 200 de enfileiramento no Resend, gravando `dedup_key` permanente, e não existe Edge Function receptora de webhooks do Resend (`email.bounced`, `email.complained`, `email.delivery_delayed`). Em `billing-lifecycle-cron/index.ts:361`, `past_due_reminder_count` é incrementado mesmo quando a caixa de e-mail do cliente rejeita a mensagem assincronamente.
- **Prova de Conceito (PoC):**
  1. Assinante com erro de digitação ou caixa cheia entra em `past_due`.
  2. `billing-lifecycle-cron` chama Resend (HTTP 200 queued), grava `dedup_key = past_due_weekly_<uid>_<week>` com `status = 'sent'` e incrementa `past_due_reminder_count`.
  3. Segundos depois, o servidor SMTP de destino retorna `550 5.1.1 User unknown` (hard bounce no Resend), mas o Axir nunca toma ciência nem alerta o usuário in-app sobre e-mail inválido.
- **Recomendação:**
  Adicionar um endpoint verificado via assinatura Svix (`resend-webhook`) para atualizar `transactional_email_logs.status` (`bounced` / `complained`) e sinalizar o perfil para revisão cadastral.

---

## Pilar 3 — Resiliência e Falhas Silenciosas

### [R01 · Alto] `resolveMfaState` Opera em *Fail-Open* (`aal1`) quando `getAuthenticatorAssuranceLevel` ou `listFactors` Falham na Rede

- **Arquivos e linhas:**
  - `src/hooks/use-auth.ts:193` a `:226` (`resolveMfaState`)
  - `src/hooks/use-auth.ts:249` (`initGlobalAuth`) e `:272` (`onAuthStateChange`)
  - `src/app/require-auth.tsx:160`, `src/components/routing/require-admin-session.tsx:33`, `src/components/routing/require-super-admin.tsx:26`
- **Causa Raiz:**
  Em `src/hooks/use-auth.ts:193`, `resolveMfaState` chama `supabase.auth.mfa.getAuthenticatorAssuranceLevel(...)` e `supabase.auth.mfa.listFactors()`. O SDK `@supabase/auth-js` não lança exceção em falhas de rede ou HTTP 5xx do GoTrue — retorna `{ data: null, error }`. O código ignora `aalResult.error` e `factorsResult.error`, interpreta `data: null` como ausência de fatores TOTP (`hasVerifiedTotp = false`, `currentLevel = "aal1"`) e retorna `{ mfaRequired: false, mfaVerified: false, aalLevel: "aal1" }` (mesmo retorno do `catch` na linha `:225`).
- **Prova de Conceito (PoC):**
  1. Usuário (ou `superadmin`) com TOTP `verified` faz login com e-mail/senha (recebendo sessão `aal1`) ou abre o app com token `aal1` salvo.
  2. No instante em que `listFactors()` e `getAuthenticatorAssuranceLevel()` disparam (`/auth/v1/factors`), a rede oscila ou o endpoint retorna `502 Bad Gateway`.
  3. `resolveMfaState` retorna `mfaRequired: false`; `RequireAuth` (`src/app/require-auth.tsx:160`) e `RequireSuperAdmin` (`src/components/routing/require-super-admin.tsx:26`) **não** redirecionam para `/entrar?desafio=totp` e liberam o painel completo sob sessão `aal1` (onde ações subsequentes protegidas por AAL2 no banco falharão de forma opaca com erro `42501`/`403`).
- **Recomendação:**
  Inspecionar o claim `amr` / `aal` diretamente do JWT da sessão local como baseline e, caso `aalResult.error` ou `factorsResult.error` esteja presente enquanto `aal !== 'aal2'`, adotar postura *fail-closed* (exibir estado de erro de conexão com botão de retry no boot de autenticação, nunca liberando `mfaRequired: false` cegamente).

---

### [R02 · Alto] `getMyFeatures()` Engole Falhas de Rede Retornando `{}`, Cacheia Features Desligadas, Redireciona Rotas e Desativa Monitoramento Bancário Nativo

- **Arquivos e linhas:**
  - `src/data/repositories/access.ts:41` a `:47` (`try { return await getMyFeaturesRpc(); } catch { return {}; }`)
  - `src/components/routing/require-feature.tsx:25` a `:28` (`if (!hasFeature(featureKey)) return <Navigate to={target} replace />`)
  - `src/app/require-auth.tsx:56` a `:60` (`if (isNativePlatform() && !isBankListenerAllowed) void clearNativeBankMonitoring();`)
- **Causa Raiz:**
  Quando a RPC `get_my_features` falha por oscilação de rede ou erro 5xx, `getMyFeatures()` captura a exceção e devolve `{}` sem propagar `AppError`. Para o TanStack Query, a query resolveu com **sucesso** (`status: 'success'`), portanto não há `retry` automático e o objeto vazio `{}` fica cacheado.
- **Prova de Conceito (PoC):**
  1. Usuário Android ou Web abre diretamente uma rota protegida por `<RequireFeature>` (ou recarrega o app em túnel/4G instável); `getMyProfile` passa (ou vem do cache), mas `get_my_features` sofre timeout.
  2. `getMyFeatures()` retorna `{}`.
  3. `RequireFeature` (`src/components/routing/require-feature.tsx:25`) avalia `hasFeature(...) === false` e redireciona silenciosamente o usuário para fora da tela sem qualquer aviso de erro. Simultaneamente, no APK Android, `NativeIntegrationsHandler` (`src/app/require-auth.tsx:57`) vê `isBankListenerAllowed === false` e executa `clearNativeBankMonitoring()`, desligando permanentemente a captura nativa de notificações bancárias do aparelho.
- **Recomendação:**
  Remover o `try/catch` silencioso em `src/data/repositories/access.ts:41`, deixando a exceção classificada subir para o TanStack Query (habilitando `retry`, preservando `previousData` em revalidações de background e impedindo que efeitos colaterais destrutivos rodem enquanto a query estiver em `isError`).

---

### [R03 · Médio] Timeout ou Erro no Canal Realtime de `useUserAccess` Destrói o Singleton sem Reconexão e Dessincroniza `subscriberCount`

- **Arquivos e linhas:**
  - `src/state/queries/use-user-access.ts:127` a `:158`
- **Causa Raiz:**
  No callback `.subscribe((status) => ...)` (`src/state/queries/use-user-access.ts:130`), qualquer `CHANNEL_ERROR` ou `TIMED_OUT` (comum ao suspender notebook ou alternar Wi-Fi/4G no celular) executa `sb.removeChannel(activeChannel)` e reseta `activeChannel = null`, `activeUserId = null` e `subscriberCount = 0`. Como os componentes consumidores (`RequireAuth`, `SubscriptionProvider`, páginas) continuam montados, nenhum `useEffect` volta a registrar o canal, extinguindo toda sincronização em tempo real de `profiles`, `user_subscriptions`, `user_feature_overrides` e `user_module_permissions` pelo resto da sessão, além de deixar `subscriberCount` negativo quando os componentes montados eventualmente desmontarem (`subscriberCount--` na linha `:146`).
- **Prova de Conceito (PoC):**
  1. Usuário autenticado coloca o celular em modo avião por 30s; o WebSocket emite `TIMED_OUT` e `use-user-access.ts:130` destrói `activeChannel` e zera `subscriberCount = 0`.
  2. Usuário reconecta à internet e paga um PIX ou tem sua conta suspensa por um administrador.
  3. Nenhum evento Postgres Changes chega até que o usuário force um reload completo (`F5`) ou troque o foco da janela.
- **Recomendação:**
  Não zerar `subscriberCount` de assinantes vivos nem abandonar definitivamente o canal em `TIMED_OUT`/`CHANNEL_ERROR`; agendar reconexão com *exponential backoff* (e re-tentativa imediata no evento `window.online`) enquanto `subscriberCount > 0`, acompanhada de `invalidateQueries` ao reconectar.

---

### [R04 · Médio] `isHandlingRemoteRevocation` sem `finally` Desativa Permanentemente Sincronização e Revogação de Sessão Após Desmontagem no `signOut`

- **Arquivos e linhas:**
  - `src/hooks/use-device-session-sync.ts:35`, `:68` a `:83`, `:90`, `:137` a `:156`, `:176` a `:181`
  - `src/hooks/use-sign-out.ts:84` a `:113` (até 4,5s de espera somando `NATIVE_CLEANUP_TIMEOUT_MS` + `SUPABASE_SIGN_OUT_TIMEOUT_MS` antes de `clearGlobalAuthSession()`)
- **Causa Raiz:**
  `handleRemoteRevocation` (`src/hooks/use-device-session-sync.ts:69`) define `isHandlingRemoteRevocation = true`, dispara imediatamente o toast `"Sessão encerrada"` (`:74`) e aguarda `await signOut({ scope: "local" })` (`:79`), sem bloco `finally` para limpar `isHandlingRemoteRevocation` e sem reset em `teardownSingleton()` (`:137`). O único reset em produção fica no `useEffect` da linha `:177` (`if (!userId && !authLoading)`). Se o usuário clicar para ir a `/entrar` ou `/` durante os até 4,5s em que `signOut` aguarda timeouts de push/rede (`use-sign-out.ts:102`–`:105`), `RequireAuth` desmonta enquanto `userId` ainda não é `null`. Quando `clearGlobalAuthSession()` finalmente executa, `useDeviceSessionSync` já está desmontado; no login seguinte, `RequireAuth` já monta com `userId` preenchido e `isHandlingRemoteRevocation` permanece `true` até fechar a aba.
- **Prova de Conceito (PoC):**
  1. Dispositivo A revoga a sessão do Dispositivo B (com rede lenta/offline parcial).
  2. Dispositivo B recebe o evento, exibe o toast `"Sessão encerrada"` (`:74`) e entra nos timeouts de `signOut` (até 4,5s); o usuário navega imediatamente para `/entrar`.
  3. Usuário faz novo login na mesma aba: `runSyncCycle` (`:90`) e `handleRemoteRevocation` (`:68`) batem em `if (isHandlingRemoteRevocation) return;` e abortam silenciosamente — o aparelho nunca mais aparece em `user_devices` nem pode ser desconectado remotamente.
- **Recomendação:**
  Resetar `isHandlingRemoteRevocation = false` dentro de um bloco `finally` ao término de `handleRemoteRevocation` e também em `teardownSingleton()`.

---

### [R05 · Médio] `asaas-manage` (`list-invoices`) Converte Falha Externa do Asaas em HTTP 200 `{ invoices: [] }`

- **Arquivos e linhas:**
  - `supabase/functions/asaas-manage/index.ts:729` a `:735`
- **Causa Raiz:**
  Na ação `list-invoices`, qualquer erro lançado por `listAsaasCustomerPayments` (timeout, HTTP 429 ou indisponibilidade 5xx do Asaas) é capturado e respondido com `jsonResponse(req, { invoices: [] })` (status HTTP 200). O TanStack Query trata a resposta como sucesso legítimo, armazena `[]` em cache e renderiza tela vazia de faturas para clientes pagantes, suprimindo o estado de erro e o botão de nova tentativa.
- **Prova de Conceito (PoC):**
  1. Asaas retorna HTTP `503` ou timeout temporário durante a abertura da aba Assinatura.
  2. `asaas-manage` devolve `200 OK` com `{"invoices":[]}`.
  3. O assinante vê que não possui nenhuma fatura emitida e o dado vazio permanece em cache até expirar o `staleTime`.
- **Recomendação:**
  Retornar `safeErrorResponse(req, 502, "Não foi possível consultar o histórico de faturas no momento. Tente novamente.")` no `catch` de `list-invoices`, permitindo tratamento explícito de erro e retry no cliente.

---

### [R06 · Baixo] `checkInviteEligibility` Falha Sempre para Não-Admins sob RLS de `access_invites` e Usa `.ilike()` sem Escape de Curingas

- **Arquivos e linhas:**
  - `src/data/repositories/access.ts:52` a `:76`
  - `supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:783` a `:790`
- **Causa Raiz:**
  `checkInviteEligibility` executa `supabase.from("access_invites").select("*").ilike("code", cleanCode).maybeSingle()` diretamente do cliente. Porém, `public.access_invites` possui RLS ativo e **apenas** a policy `"Admins gerenciam convites"` (`public.is_admin()`). Para qualquer visitante `anon` ou usuário comum validando um convite antes/durante o cadastro, o Postgres filtra 0 linhas silenciosamente (`data = null, error = null`), fazendo `validateInvite(null)` rejeitar convites válidos. Adicionalmente, `.ilike("code", cleanCode)` não escapa `%` nem `_`: um input como `"___"` ou `"%"` (em contexto com leitura liberada) casa múltiplos convites e estoura erro `PGRST116` no `.maybeSingle()`.
- **Prova de Conceito (PoC):**
  1. Administrador cria convite válido `AXIR2026`.
  2. Visitante não-admin invoca `checkInviteEligibility("AXIR2026")`.
  3. PostgREST retorna HTTP 200 (`null`) por RLS; a função retorna `{ valid: false }` para um convite ativo.
- **Recomendação:**
  Substituir a query direta em `public.access_invites` por uma RPC `SECURITY DEFINER` dedicada (`validate_access_invite(p_code text, p_email text)`) com rate-limit por IP/sessão, comparação exata `upper(code) = upper(trim(p_code))` e retorno booleano mínimo (sem expor colunas administrativas como `created_by`, `used_count` ou `target_email`).
