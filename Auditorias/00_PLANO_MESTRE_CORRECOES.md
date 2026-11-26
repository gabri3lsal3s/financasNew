# Plano Mestre de Correções — Axir (`00_PLANO_MESTRE_CORRECOES.md`)

> **Data de Consolidação:** 2026-11-26  
> **Base Git:** `cbe0c3c1` (`package.json` `v3.30.1`)  
> **Modo de Execução:** Somente leitura sobre o código-fonte (`src/` e `supabase/` intactos).  
> **Fontes Consolidadas:** `Auditorias/01_ASTRA_MOTOR_FINANCEIRO.md`, `02_ASTRA_ESTADO_PERFORMANCE.md`, `03_SOL_CONTRATOS_RESILIENCIA.md`, `4_GEMINI_AUDIT_SECURITY.md`, `05_NEON_UIUX_POLIMENTO.md`, `06_HYDROGEN_BUNDLE_HIGIENE.md`.  
> **Regras e Contratos de Referência:** `AGENTS.md` (Regras 1–36 e §1–§10) e `docs/DESIGN_RULES.md` (v3.1).

---

## Sumário Executivo, Validação no Código Real & Deduplicação

Todas as 6 auditorias foram cruzadas entre si e confrontadas diretamente com o código-fonte real em `src/` e `supabase/`. A consolidação resultou em **32 tarefas executáveis** distribuídas em **4 Ondas sequenciais** (`T1.1`–`T1.11`, `T2.1`–`T2.6`, `T3.1`–`T3.8`, `T4.1`–`T4.7`).

### Falsos Positivos Descartados e Ajustes de Evidência (Validados em `src/`)

| Item Original | Origem | Veredito na Validação Real | Ação no Plano |
|---|---|---|---|
| Foco programático incondicional na Command Palette (`⌘K`) | Audit 05 §3.1 (`command.tsx:63`) | **Falso positivo (já corrigido).** `src/components/ui/command.tsx:55–65` já protege `inputRef.current?.focus()` com `window.matchMedia("(pointer: fine)").matches`. | Descartado como bug; mantido apenas teste de regressão em `T4.3`. |
| `autoFocus` declarativo em produção | Audit 05 §3.1 | **Conforme (0 ocorrências).** Varredura em `src/` confirmou apenas comentários/testes documentando a proibição da Regra 20. | Mantida trava de regressão (ESLint/teste) em `T4.3`. |
| Caminho de `aporte-tab.tsx` | Audit 06 §1 | **Caminho ajustado.** O arquivo real é `src/features/investments/pages/aporte-tab.tsx:23` (não `components/aporte-tab.tsx`), onde `import { InvestmentWizard } from "../wizard"` de fato anula o `lazy()`. | Corrigido na referência de `T2.4`. |
| Contagem de `import * as ... from "@/state"` em produção | Audit 06 §1 | **Contagem real: `17` ocorrências** em arquivos de produção (`src/` excluindo `*.test.*`/`*.spec.*`), acima das `16` citadas. | Atualizado na meta de `T2.4`. |
| Caminho de `money-text.tsx` | Audit 05 §4.2 | **Confirmado em `src/components/ui/money-text.tsx:54`** (`portfolio: "text-portfolio"` em vez de `text-portfolio-strong`). | Mantido com caminho exato em `T4.4`. |

### Principais Deduplicações Entre as 6 Auditorias

1. **Faturas do Asaas retornando vazio em erro (`200 { invoices: [] }`):** unificados Audit 04 (`R05`, `asaas-manage/index.ts:729–735`) + Audit 03 (`billing.ts:191`) → **`T1.5`** (Edge) e **`T3.8`** (contrato cliente).
2. **Paginação truncada no limite de 1.000 linhas (`supabase/config.toml:18`):** unificados Audit 02 (`#10`, `portfolio.ts:614`) + Audit 03 (`portfolio.ts:862`) + Audit 06 (`.select("*")` em `portfolio.ts:621,869`) → **`T2.6`**.
3. **Enriquecimento histórico de cotações e SWR (re-leitura, fila serial, timeout `Promise.race`, corrida A→B→A, perda de falha parcial):** unificados Audit 02 (`#9`) + Audit 03 (`quotes.ts:376,398`, `use-market-quotes-swr.ts:279,336`) → **`T3.2`**.
4. **Busca global (reindexação por tecla, chave duplicada `["portfolio","assets"]` vs `["portfolio_assets"]`, bundle síncrono `cmdk` no `PageShell`):** unificados Audit 02 (`#3`, `#7`) + Audit 06 (`§1`) → **`T2.3`**.
5. **Notification Hub (múltiplas instâncias no shell + chunk síncrono de `303 KB` + `91 KB`):** unificados Audit 02 (`#2`) + Audit 06 (`§1`) → **`T2.2`**.
6. **Resolução dinâmica `import * as stateHooks` / `getOptionalStateHook`:** unificados Audit 03 (fallback fake-success em `pending-dividends-dialog.tsx:75,97` e `use-corporate-dividends.ts:51`) + Audit 06 (quebra de tree-shaking em `state-*.js`) → **`T2.4`** e **`T3.8`**.
7. **Autenticação, MFA, Realtime de acesso e sessão:** unificados Audit 04 (`R01`, `R02`, `R03`, `R04`) + Audit 02 (`#13`) → **`T1.5`** (segurança fail-closed) e **`T3.1`** (estabilidade assíncrona/Realtime).

---

## Onda 1 — Segurança, RLS, Webhooks & Motor Financeiro

> **Objetivo:** Eliminar vazamentos cross-tenant, cobranças duplas/locks órfãos de assinatura, bypasses de permissão/MFA e erros matemáticos críticos/altos em impostos, custódia, caixa, faturas e rentabilidade.

### T1.1 — Fechar vazamento cross-tenant em `public.public_shares` e blindar mutações
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `supabase/migrations/20260101000065_create_public_shares_table.sql:27,41,49,58,78`
  - `src/data/repositories/public-shares.ts:172,280,305,462`
- **Problema Consolidado:** `SELECT` direto está concedido a `anon, authenticated` com policy `USING (is_revoked = false AND (expires_at IS NULL OR expires_at > now()))`, permitindo que qualquer visitante liste todos os `token`, `user_id` e `payload` JSONB (famílias, metas, rachas) via PostgREST. Além disso, `INSERT`/`UPDATE`/`DELETE` não verificam `is_current_user_active()` nem `can_current_user_write()`.
- **Solução Técnica:** Criar migration revogando `SELECT` de `anon` em `public.public_shares`; restringir `public_shares_select` ao dono ativo (`(select auth.uid()) = user_id AND (select public.is_current_user_active())`); exigir `is_current_user_active()` e `can_current_user_write()` em `INSERT`/`UPDATE`/`DELETE`; expor leitura pública exclusivamente via RPC `SECURITY DEFINER` (`get_public_share_by_token(p_token text)`, com `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO anon, authenticated`, validação de `p_token` não vazio e sem expor `user_id`) com correspondência exata de token e atualizar `src/data/repositories/public-shares.ts` para consumi-la.
- **Critério de Aceite:** `GET /rest/v1/public_shares` como `anon` retorna `401/403` ou `0` linhas; RPC com token válido retorna apenas o registro correspondente; usuário `read_only` ou `suspended` recebe `42501` ao tentar publicar/editar share.

### T1.2 — Blindar governança Admin/Superadmin (AAL2 obrigatório) e RLS de tabelas auxiliares
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `supabase/functions/admin-super-action/index.ts:92,124`
  - `supabase/migrations/20260101000158_security_audit_remediation_v2.sql:134`
  - `supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql:725,743,750,761,783,800`
  - `supabase/migrations/20260101000128_harden_billing_idempotency_and_trial_lifecycle.sql:1777,1796,1843`
  - `supabase/migrations/20260101000060_support_tickets.sql:40,54,62,66,100`
  - `supabase/migrations/20260101000140_support_ticket_webhook_and_dedup.sql:90–118`
  - `supabase/functions/support-notify/index.ts:62–110`
  - `supabase/migrations/20260101000062_purge_legacy_cash_transactions.sql:112`
  - `supabase/migrations/20260101000136_user_push_subscriptions.sql:51`
  - `src/data/repositories/access.ts:52–76`
- **Problema Consolidado:** (1) Superadmin sem TOTP enrollado executa ações destrutivas com `aal1`; (2) `admin` comum edita `public.plans`, deleta `access_invites` sem auditoria e concede `lifetime` via `admin_set_user_subscription` sem cancelar recorrência Asaas; (3) contas `banned`/`suspended` podem inundar `support_tickets` (+ spam Telegram via trigger) e `app_analytics_events` (`user_id: null`), e contas `read_only` ainda escrevem em `categories`, `user_preferences` e `audit_events`; (4) `checkInviteEligibility` consulta `access_invites` direto sob RLS de admin (sempre falha para visitantes) e usa `.ilike()` sem escapar `%`/`_`.
- **Solução Técnica:** Tornar `v_has_verified_mfa = true AND aal = 'aal2'` incondicional em `assert_active_superadmin_aal2` e `admin-super-action`; revogar escrita direta de `authenticated` em `plans`, `access_invites` e `audit_events` (mantendo eventuais logs de auditoria do cliente via RPC `SECURITY DEFINER` com `user_id = auth.uid()`); mover alterações de `lifetime`/cancelamento Asaas para fluxo auditado de Superadmin; adicionar `is_current_user_active()` em `support_tickets` (bloqueando `DELETE` e `UPDATE` de `status` pelo usuário, validando status também em `support-notify`), `app_analytics_events` (exigindo `user_id = auth.uid()`) e `user_push_subscriptions`; adicionar `can_current_user_write()` em `categories`; criar RPC `SECURITY DEFINER` `validate_access_invite(p_code, p_email)` (`SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO anon, authenticated`) com comparação exata `upper(code) = upper(trim(p_code))` / `lower(trim(p_email))` e retorno mínimo uniforme sem vazar existência de e-mails.
- **Critério de Aceite:** Superadmin sem MFA verificado é bloqueado em `admin-super-action` e `admin_delete_user`; usuário `banned` não consegue inserir ticket nem disparar Telegram; `read_only` é bloqueado em `categories`/`audit_events`; visitante `anon` valida convite válido sem expor colunas internas e curedas `%`/`_` são tratados como literais.

### T1.3 — Eliminar oráculo cross-tenant (`23505`) e bypass de triggers em `public.restore_backup`
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:2121–2490`
- **Problema Consolidado:** `restore_backup` (`SECURITY DEFINER`) insere UUIDs controlados pelo JSON do cliente diretamente como PKs globais (revelando existência de registros de outros tenants via erro `23505` e quebrando restauração entre contas) e habilita `app.allow_pair_mutation = 'true'` sem validar simetria de `transfer_pair_id`.
- **Solução Técnica:** Dentro de `restore_backup`, criar tabela temporária `pg_temp._id_map (old_id uuid primary key, new_id uuid not null) ON COMMIT DROP` (rejeitando `old_id` duplicado no JSON) gerando `gen_random_uuid()` para toda entidade importada e reescrevendo todas as PKs e FKs internas; validar integridade e simetria de `transfer_pair_id` (escopos PF/PJ e valores) antes de persistir, usando `set_config('app.allow_pair_mutation', 'true', true)` restrito à transação e resetado para `'false'` logo após o bloco de pares.
- **Critério de Aceite:** Restaurar backup contendo UUID de outro usuário não retorna `23505` nem revela existência; restaurar backup de uma conta em outra preserva 100% das relações internas com novos UUIDs; pares `transfer_pair_id` órfãos ou assimétricos são rejeitados.

### T1.4 — Corrigir integridade de checkout, webhooks, estorno/chargeback e ciclo de assinatura Asaas
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `supabase/functions/asaas-checkout/index.ts:568–576,705–761,839–886`
  - `supabase/functions/asaas-webhook/index.ts:138–146,220–232,461,491,502,533–540,879–947`
  - `supabase/functions/_shared/asaas-webhook-logic.ts:193,244,296–310,362–379`
  - `supabase/functions/asaas-manage/index.ts:180–206,391–397,729–735`
  - `supabase/functions/ai-financial-assistant/index.ts:547–566`
  - `supabase/functions/_shared/resend.ts:181–195` · `supabase/functions/billing-lifecycle-cron/index.ts:350–370`
- **Problema Consolidado:** (1) `W01`: gerar PIX Anual em `trial_scheduled` zera `scheduled_plan_id` sem cancelar `asaas_subscription_id` no Asaas (cobrança dupla ou cobrança oculta em conta expirada); (2) `W02`: falha em `user_subscriptions.update` após inserir em `billing_processed_payments` deixa lock órfão que faz o webhook ignorar todos os retries (`ignore_duplicate`) e cria assinaturas órfãs no Asaas; (3) `W03`: `billing_webhook_logs.insert` ignora `{ error }`, permitindo replay, e `PAYMENT_REFUNDED` (quando `asaas_payment_id` é `null`) / `PAYMENT_CHARGEBACK_REQUESTED` de cobrança antiga derrubam assinatura nova vigente sem cancelar no Asaas; (4) `W04`: reativação pós-cancelamento não renova `billing_start_at`, negando arrependimento de 7 dias (CDC Art. 49); (5) `W05`: `ai-financial-assistant` exige `status === 'active'|'trialing'`, bloqueando `past_due` em grace period e overrides modulares; (6) `R05`: `asaas-manage` `list-invoices` devolve `200 { invoices: [] }` em falha externa; (7) `W06`: Resend sem webhook de bounce/complaint.
- **Solução Técnica:** (1) Não limpar `scheduled_plan_id` na emissão de QR Code PIX pendente; no `asaas-webhook`, ao ativar pagamento avulso/PIX com qualquer `userSub.asaas_subscription_id` prévia, cancelar no Asaas (ou marcar `pending_resync`) e limpar `asaas_subscription_id`; (2) encapsular gravação de `billing_processed_payments` + `user_subscriptions` + `billing_intents` em RPC transacional atômica (preferencial ao delete-lock compensatório, evitando lock órfão em crash); (3) checar `{ error }` em `billing_webhook_logs` com coluna `processed_at`, exigir match estrito de `payment.id` ou `payment.subscription` não nulos em `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` (nunca derrubando assinatura vigente quando ambos forem nulos ou divergentes), e cancelar recorrência no Asaas em `mark_refunded`; (4) redefinir `billing_start_at = nowIso` em reativações a partir de estado encerrado (`read_only`/`canceled`/`read_only_expired`); (5) delegar autorização de `ai-financial-assistant` para `can_current_user_write_module('transactions')`; (6) retornar `502` em erro de `list-invoices`; (7) criar endpoint `resend-webhook` com validação Svix para atualizar `transactional_email_logs`.
- **Critério de Aceite:** Testes unitários de `asaas-webhook-logic.ts` e integração simulando `trial_scheduled` → PIX, falha de DB após pagamento `CONFIRMED`, replay de `provider_event_id`, estorno/chargeback antigo vs assinatura nova, reativação + cancelamento em ≤ 7 dias, `past_due` em grace period no assistente IA e erro `503` do Asaas em `list-invoices` propagando `502`.

### T1.5 — Eliminar *fail-open* em MFA (`resolveMfaState`) e silenciamento de erro em `getMyFeatures()`
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/hooks/use-auth.ts:193–226`
  - `src/data/repositories/access.ts:41–47`
  - `src/app/require-auth.tsx:56–60,160`
  - `src/components/routing/require-feature.tsx:25–28`
- **Problema Consolidado:** `resolveMfaState` ignora `aalResult.error` e `factorsResult.error`, retornando `{ mfaRequired: false, aalLevel: "aal1" }` em falhas de rede (bypass de guard TOTP). `getMyFeatures()` engole exceções retornando `{}`, fazendo o TanStack Query cachear todas as features desligadas, expulsar o usuário em `<RequireFeature>` e chamar `clearNativeBankMonitoring()` no Android.
- **Solução Técnica:** Em `resolveMfaState`, inspecionar `aal`/`amr` do JWT local como baseline e, se houver `error` em `getAuthenticatorAssuranceLevel` ou `listFactors` com `aal !== "aal2"`, retornar estado de erro (*fail-closed*) com tela de retry no `RequireAuth`. Em `getMyFeatures()`, remover o `try/catch` que retorna `{}` e propagar `AppError`, condicionando redirecionamentos em `RequireFeature` e `clearNativeBankMonitoring()` a `isSuccess` (nunca em `isError`).
- **Critério de Aceite:** Simular `502` em `/auth/v1/factors` não libera rotas autenticadas/superadmin em `aal1`; simular falha em `get_my_features` exibe erro com retry, não redireciona a rota e não chama `clearNativeBankMonitoring()`.

### T1.6 — Corrigir motor de DARF e Informe Anual (Compensação intrames, custos, ETF, câmbio USD e custódia histórica)
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `src/domain/portfolio/tax.ts:149,243,405,479,550–625,751`
  - `src/domain/portfolio/darf-reconstitution.ts:54,79`
  - `src/features/investments/components/portfolio-darf-monitor.tsx:31,125`
  - `src/features/reports/components/tax-facilitator-modal.tsx:50,52,58,68`
  - `src/features/reports/components/tax-facilitator/tax-facilitator-utils.ts:35,78,84`
- **Problema Consolidado:** (`T01`–`T06` da Audit 01) (1) `T01` Crítico: vendas com ganho e perda da mesma classe no mesmo mês tributam o ganho bruto e empurram a perda para o mês seguinte em vez de compensar no próprio mês; (2) `T02`: reconstituição ignora custos operacionais (`total` vs `qty * price`) no PM e nas perdas anteriores; (3) `T03`: sufixo `11` classifica ETF como FII (20%) antes da classe explícita (15%); (4) `T04`: vendas USD vão para o monitor sem conversão histórica para BRL, ocultando ganho cambial; (5) `T05`/`T06`: Tax Facilitator usa dólar atual e posição atual (perdendo ativos zerados no ano seguinte) e soma JCP (BRL) com dividendo USD como isentos.
- **Solução Técnica:** Compensar `grossProfitCents` contra `newLossCents` do próprio mês **dentro da mesma classe/bucket tributário** antes de aplicar prejuízo acumulado e alíquota em `tax.ts`; usar base de desembolso real (`total`) na reconstituição; priorizar `asset.asset_class` explícita sobre heurística de sufixo `11`; converter custo e alienação USD pelas taxas históricas segregando exterior; reconstruir custódia em 31/12 do ano-calendário com custo histórico em BRL e classificar proventos por tipo/moeda do evento independente da custódia atual.
- **Critério de Aceite:** Vetores em Vitest: FII +1.000 e −800 no mesmo mês → líquido 200, IR 40, prejuízo 0; FII comprado a 1.010 vendido a 1.100 → lucro 90, IR 18; ETF `ZZZZ11` → 15%; compra/venda US$ 100 câmbio 5→6 → ganho R$ 100 exterior; informe 2025 aberto em 2026 com posição zerada em 2026 preserva 10 cotas a R$ 500 e segrega JCP BRL de dividendo USD.

### T1.7 — Blindar custódia, custo fiscal USD, exclusão retroativa e atomicidade de ordens da carteira
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `src/state/mutations/portfolio/use-portfolio-order-mutations.ts:161,183,192,248,259,284,363,441,447,455`
  - `src/domain/portfolio/operations.ts:89,92,180,218,567`
  - `src/state/mutations/portfolio/use-portfolio-transaction-mutations.ts:106,230`
  - `src/domain/portfolio/aporte.ts:2144,2159` · `src/features/investments/wizard/wizard-selection-helpers.ts:166`
- **Problema Consolidado:** (`I01`–`I06`, `I11` da Audit 01) (1) `I01` Crítico: venda parcial de ativo USD grava `remainingQuantity * remainingAveragePrice` (USD) em `total_cost_brl`, corrompendo permanentemente o custo fiscal em BRL; (2) `I02` Crítico: excluir venda retroativa em `operations.ts:567` soma cotas ao PM atual (ou PM zero) em vez de reprocessar o ledger; (3) `I03`: gravação de ordem, posição e caixa ocorre em múltiplas chamadas sequenciais sem RPC atômico nem idempotência; (4) `I04`: venda BRL grava valor de alienação em `tx.total_cost_brl` fazendo relatórios apurarem lucro zero; (5) `I05`/`I06`: arredondamento independente na baixa cria centavos fantasmas (1,13 + 1,13 = 2,26 sobre 2,25) e proporção `0.9999` zera saldo remanescente em valor total; (6) `I11`: radar de setor força piso de 1 unidade mesmo com caixa inferior ao preço da ação.
- **Solução Técnica:** Baixar `total_cost_brl` proporcionalmente ao custo fiscal anterior em BRL (`remainingCostBrl = totalCostBrl - realizedCostBrl`, garantindo `realizedCostBrl + remainingCostBrl === totalCostBrl` sem centavos fantasmas e zerando apenas na liquidação integral); reprocessar cronologicamente as transações sobreviventes ao excluir qualquer venda; criar RPC transacional idempotente para ordem + posição + caixa + fluxo; separar `gross_amount`/`sale_value` de `realized_cost_brl`; remover piso forçado de 1 cota quando `Math.floor(cash / price) === 0`.
- **Critério de Aceite:** Vetores Vitest: compra 10 US$ 10 câmbio 5 (R$ 500) → vende 4 → resta US$ 60 e R$ 300; compra 10@10 → vende 10 → compra 10@30 → exclui venda → 20 cotas, custo 400, PM 20; 2 cotas custo 2,25 vende 1 → baixa 1,13 + remanescente 1,12 = 2,25; resgate de 999.900 sobre 1.000.000 conserva 100 brutos e 90 de custo; caixa 40 com ação a 100 sugere 0 executáveis.

### T1.8 — Corrigir resgates de Renda Fixa (IOF, IR, prejuízo negativo e estimativas)
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/domain/portfolio/fixed-income-redemption-preview.ts:264,269,310,314,357–380`
  - `src/domain/reports/period-redemptions.ts:114,136,142,146,151,154,173,196,218,232,246,250`
- **Problema Consolidado:** (`I07`–`I10` da Audit 01) Relatório de resgates ignora IOF e líquido registrado ao ler notas; serialização de lucro negativo (`"R$ -10.00"`) falha no parser que espera sinal antes de `R$` e limita custo ao valor bruto (ocultando perdas); IR explícito `0` é sobrescrito por estimativa de 22,5%; ausência de data de aquisição infere 721 dias (15%) arbitrariamente pelo retorno de 15%.
- **Solução Técnica:** Persistir custo realizado, IOF, IR e líquido em colunas numéricas estruturadas (com fallback legível para ambos formatos de sinal em registros legados); permitir `cost > gross`; diferenciar `irCents === 0` (explicitamente isento/zerado) de `null` (desconhecido); nunca inferir faixa regressiva por percentual de retorno — sinalizar prazo indeterminado quando faltar data de aquisição.
- **Critério de Aceite:** Vetores Vitest: bruto 1.100, custo 1.000, IOF 60, IR 9 → líquido 1.031, ganho líquido 31; bruto 990, custo 1.000 → resultado −10, IR 0; snapshot com IR = 0 preserva líquido 1.100; sem data de aquisição não assume 721 dias.

### T1.9 — Corrigir motor de Caixa Real, checkpoints, timezone, competência de ciclo e Balanço Patrimonial
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/domain/cash/cash-ledger.ts:132,135,188,202,239,264,281`
  - `src/domain/cash/cycle-obligations.ts:114,157,174,179,197`
  - `src/state/queries/use-real-cash-balance.ts:63,67,186,221` · `src/state/queries/use-cash-checkpoints.ts:30`
  - `src/domain/business/derived-cash.ts:42` · `src/domain/overview/build-overview-metrics.ts:557,575` · `src/domain/projection/cash-gap.ts:277`
  - `src/features/insights/hooks/use-insights-dashboard-data.ts:249` · `src/domain/insights/monthly-closing.ts:57`
  - `src/features/reports/hooks/use-reports-data.ts:75,77,86` · `src/features/reports/hooks/use-finance-report-data.ts:75,146,169,215,248` · `src/domain/reports/consolidated-balance.ts:76,100`
- **Problema Consolidado:** (`C01`–`C12` da Audit 01) (1) `C01`: resgates negativos (`-200`) são descartados pelo caixa e reinvestimentos internos geram saída fictícia; (2) `C02`/`C10`: checkpoint posterior ao corte é usado em consultas passadas, e balanço passado usa caixa de hoje e omite parcelas futuras de cartão; (3) `C03`/`C04`: pagamento de fatura no dia do checkpoint perde desempate por falta de timestamp, e dívida paga às 22h30 BRT vira dia seguinte em UTC; (4) `C05`: fim de mês inclusivo puxa vencimentos do dia 1º do mês seguinte; (5) `C06`/`C07`: fechamento de Insights usa listas sem filtro de escopo PF/PJ e elimina receita analítica de estorno; (6) `C08`/`C09`: balanço inclui dívidas/recebíveis já quitados e eleva saldo bancário negativo a zero; (7) `C11`: reserva PJ parte de zero após checkpoint compartilhado; (8) `C12`: radar de déficit reinsere receita de hoje já contabilizada no saldo.
- **Solução Técnica:** Classificar fluxos de investimento (aporte externo vs resgate bancário vs reinvestimento interno); selecionar checkpoint com `date <= cutoffDate` incluindo o corte na query key; propagar instante de pagamento e converter `paid_at` para data civil local; usar fim exclusivo de mês em `cycle-obligations.ts`; aplicar `scope-filter` e convenção de estorno §3.3.3 no fechamento de Insights; filtrar dívidas pelo saldo residual aberto no corte; preservar sinal negativo de caixa (ou classificar como passivo bancário) e incluir passivo total de parcelas futuras no balanço patrimonial; preservar composição PF/PJ no checkpoint; excluir eventos já liquidados hoje no radar `cash-gap`.
- **Critério de Aceite:** Todos os 12 cenários reproduzíveis (`C01`–`C12`) cobertos por testes unitários em `src/domain/` retornando os saldos exatos especificados (ex.: `C01` 1.200, `C02` 800, `C03` 700, `C08` 1.000, `C09` 800, `C10` 400/500, `C12` alerta −50).

### T1.10 — Corrigir parcelamentos de cartão, overrides de fechamento, arredondamento ponderado e refinanciamento
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/transactions/wizard/wizard-builders.ts:91` · `src/features/transactions/wizard/use-launch-wizard-submit.ts:178`
  - `src/domain/cards/index.ts:220,609,611` · `src/domain/competence/index.ts:59,74`
  - `src/domain/cards/refinancing.ts:66,99` · `src/features/cards/components/bill-refinance-dialog.tsx:59`
  - `src/features/cards/components/invoice-kpis-section.tsx:47` · `src/domain/calculation-memory/builders/invoice-breakdown.ts:139,179,217`
- **Problema Consolidado:** (`F01`–`F05` da Audit 01) Compra em 30/01 (fechamento 31) em 3x gera competências Jan/Mar/Mar (pulando Fev); LaunchWizard ignora `card_competence_overrides`; refinanciamento sem juros de 100 em 3x exibe total `99,99` com parcelas somando `100,00`; ponderação em `cards/index.ts:220` multiplica em reais (14¢) divergindo de `totals.ts:43` (15¢); expressão da memória de cálculo de fatura diverge dos passos quando há rolagem ou pagamento excedente.
- **Solução Técnica:** Resolver a competência inicial efetiva consultando `card_competence_overrides` e avançar `+1` mês de competência por parcela; derivar total do refinanciamento pela soma das parcelas em centavos; unificar arredondamento ponderado em centavos via `totals.ts`; alinhar fórmula impressa em `invoice-breakdown.ts` com o motor real evidenciando crédito remanescente.
- **Critério de Aceite:** Vetores Vitest: compra 30/01 em 3x → Jan/Fev/Mar; override dia 15 em junho para compra em 17/06 persiste julho; refinanciamento 100 em 3x sem juros → total 100,00; peso 0,5 sobre 0,29 → 15¢ em ambos os motores; memória de fatura reconcilia 100%.

### T1.11 — Corrigir TWR/TIR, fluxos históricos, câmbio realizado e reconciliação de memórias de cálculo
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/domain/portfolio/twr.ts:185,263,279` · `src/domain/portfolio/summary.ts:374,407,428` · `src/domain/portfolio/canonical-types.ts:1294`
  - `src/domain/portfolio/irr.ts:386,410,420` · `src/domain/portfolio/canonical-returns.ts:292`
  - `src/domain/reports/period-investment-flow.ts:57,71,154,185` · `src/features/reports/hooks/use-investment-report-data.ts:96,100,106,190,206,221`
  - `src/features/investments/components/resumo/portfolio-kpi-strip.tsx:46` · `src/domain/calculation-memory/builders/portfolio-breakdown.ts:39,58`
  - `src/features/investments/components/asset-detail/use-asset-detail-metrics.ts:57,99` · `src/domain/calculation-memory/builders/performance-breakdown.ts:357,405,473`
  - `src/features/reports/components/tear-sheet/TearSheetMethodologyGrid.tsx:53,211` · `src/domain/reports/consolidated-balance.ts:65,103,109` · `src/domain/portfolio/projection.ts:124,135`
- **Problema Consolidado:** (`R01`–`R11` da Audit 01) TWR trata fluxo externo `0` explícito como ausente (inferindo aporte por variação de custo) e agrupa aportes perdendo o peso diário; TIR inclui aportes posteriores à data de corte; relatório de fluxo compensa aportes/saques em líquido e mistura volume negociado com fluxo externo; relatório histórico com período vazio cai para posições atuais; vendas USD encerradas usam dólar de fechamento em vez da taxa da ordem; memória de cálculo exibe PTAX hardcoded `5,25`, mistura USD e BRL em YoC/DY, mostra `0+0+0=300` no TearSheet, exibe `0%` para divisão por zero e soma inconsistente em projeção real descontada pela inflação.
- **Solução Técnica:** Preservar `0` conhecido em `twr.ts` e repassar eventos datados ao gráfico/extrato; filtrar fluxos `<= cutoffDate` antes do solver XIRR; separar entradas brutas, saídas brutas e volume negociado; tratar fechamento histórico vazio como estado válido; usar taxa cambial da ordem em vendas encerradas e propagar taxa/origem reais para `portfolio-breakdown.ts`; alinhar moeda em YoC/DY; passar os 3 componentes reais de P&L ao TearSheet; retornar `null` (não `0%`) para denominador zero; reconciliar perda inflacionária em `projection.ts`.
- **Critério de Aceite:** Todos os vetores `R01`–`R11` validados em Vitest (`R01` 0%, `R02` 5%, `R03` +10%, `R06` R$ 500, `R08` DY=YoC=10%, `R10` `null`, `R11` soma dos componentes igual ao saldo projetado).

---

## Onda 2 — Performance de Carregamento, Bundle & Queries

> **Objetivo:** Reduzir TTI/LCP, desbloquear o primeiro conteúdo útil da Home, eliminar reconstruções redundantes no shell, restaurar `lazy()` quebrados, enxugar payloads `.select("*")` e limpar `~2,77 MiB` de assets mortos.

### T2.1 — Desbloquear o primeiro conteúdo útil da Visão Geral (Home)
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/overview/components/overview-dashboard-content.tsx:99–115`
  - `src/features/overview/hooks/use-overview-data.ts:188`
  - `src/state/queries/use-real-cash-balance.ts:63` · `src/data/query.ts:22` · `src/data/repositories/onboarding.ts:67`
- **Problema Consolidado:** No mês corrente, `data.loading` aguarda `realCashData.isLoading` (que pagina todo o histórico desde 1970 sem checkpoint) e 9 contagens exatas de onboarding, segurando o esqueleto da página inteira mesmo com receitas/despesas do mês já prontas.
- **Solução Técnica:** Desacoplar o carregamento do resumo mensal (`incomesQuery` + `expensesQuery`) do carregamento do saldo real histórico e do onboarding; renderizar os cards mensais assim que prontos, exibindo skeleton/retry local apenas no `RealCashHeroCard` e widgets dependentes; manter decisão de `VirginAccountHero` pendente até concluir contagens (segurando o bloco enquanto `isVirginAccount` não resolver em contas sem lançamentos no mês para evitar flash com `R$ 0,00`, conforme Regra 30; depende de `T1.9` em `use-real-cash-balance.ts`).
- **Critério de Aceite:** Atrasar artificialmente o fetch de histórico de caixa não impede a pintura imediata do resumo mensal da Home; contas virgens não piscam dashboard vazio antes das contagens.

### T2.2 — Centralizar o Notification Hub em provider único com seletores estáveis
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/components/layout/page-shell.tsx:125` · `src/components/layout/sidebar.tsx:41` · `src/components/layout/bottom-nav.tsx:28`
  - `src/hooks/use-notification-center.ts:262,487`
- **Problema Consolidado:** `PageShell`, `Sidebar`, `BottomNav`, sino, menu e `/lembretes` instanciam `useNotificationCenter()` separadamente, duplicando observadores e reexecutando o builder completo a cada alteração de despesa, além de puxar `395 KB` (`notifications-*.js` + `use-notification-center-*.js`) sincronamente no boot.
- **Solução Técnica:** Elevar a computação do Notification Hub para um único provider/store na sessão autenticada com seletores estáveis (`useUnreadNotificationCount`, `useNotificationItems`, `useNotificationActions`), evitando recriação de referências e carregando UI do popover/lista sob demanda, mantendo `unreadCount` e a computação base síncronos/estáveis para garantir 100% de paridade numérica com `Sidebar` e `BottomNav` (Regra 35).
- **Critério de Aceite:** No React Profiler, criar/editar uma despesa com o sino fechado executa o builder do hub exatamente 1 vez; contagens entre sino, `Sidebar`, `BottomNav` e `/lembretes` permanecem 100% idênticas.

### T2.3 — Otimizar Busca Global: memoização do índice, chave canônica de ativos e carregamento lazy
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/components/layout/page-shell.tsx` (mount de `GlobalSearch`)
  - `src/state/queries/use-search.ts:72–88`
  - `src/state/mutations/portfolio/portfolio-keys.ts:11` · `src/state/mutations/portfolio/use-portfolio-asset-mutations.ts:30`
- **Problema Consolidado:** Digitar na busca reexecuta `useGlobalSearchEntries`, reconstruindo mapas e formatações a cada tecla; a busca usa chave divergente `["portfolio","assets"]` (enquanto a carteira usa `["portfolio_assets"]`), causando refetch duplicado e dados obsoletos após edição; `GlobalSearch` e `cmdk` (`51,5 KB`) são importados sincronamente no `PageShell`; `portfolio-keys.ts` invalida tanto a raiz quanto a filha de transações em paralelo.
- **Solução Técnica:** Montar `GlobalSearch` via `React.lazy` apenas ao abrir (`Cmd/Ctrl+K` ou clique, mantendo o listener de `Cmd/Ctrl+K` no shell leve `page-shell.tsx` para não perder o primeiro acionamento); separar construção do índice (memoizada por fontes/permissões/data) da filtragem do termo digitado; reutilizar o hook canônico `["portfolio_assets"]`; invalidar `["portfolio_transactions"]` apenas uma vez pela raiz.
- **Critério de Aceite:** `vendor-cmdk` não carrega no boot inicial; digitar 10 caracteres com fontes estáveis reconstrói o índice `0` vezes; criar/editar/excluir ativo na carteira reflete imediatamente na busca em `< 60s` sem refetch duplicado.

### T2.4 — Restaurar Code Splitting, eliminar `import * as` de `@/state` e quebrar megachunks
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/investments/components/resumo/resumo-modals-host.tsx:1–30` · `src/features/investments/pages/aporte-tab.tsx:23`
  - `src/features/business/pages/business-page.tsx` (`LaunchWizard` síncrono)
  - `src/app/authenticated-providers.tsx` (`AppLockOverlay`, `PendingDividendsDialogHost`, `bank-listener`)
  - `src/components/ui/index.ts` (`Command`, `QrCodeCanvas`) · `vite.config.ts:113–183`
  - 17 arquivos em `src/` com `import * as ... from "@/state"` (incluindo `src/app/require-auth.tsx:14`, `src/hooks/use-notification-center.ts:11`, `resumo-modals-host.tsx:5`)
  - Hosts de modais/abas síncronos: `overview-modals-host.tsx`, `cards-page-modals.tsx`, `transaction-list-modals.tsx`, `reports-page.tsx`, `reports-modals-host.tsx`, `insights-page.tsx`, `debts-page.tsx`, `budgets-page.tsx`, `budgets-dialogs.tsx`, `family-page.tsx`, `settings-page.tsx`, `security-tab.tsx`, `landing-page.tsx`
- **Problema Consolidado:** `modules-*.js` (`827 KB`) e `state-*.js` (`688 KB`) somam `~1,5 MB`; `resumo-modals-host.tsx` e `aporte-tab.tsx` anulam o `lazy()` de `InvestmentWizard` e `CashFormDialog`; `authenticated-providers.tsx` puxa `bank-listener` (`120 KB`), `AppLockOverlay` (`55 KB`) e `PendingDividendsDialogHost` (`34,5 KB`) no boot; 17 `import * as` impedem tree-shaking; modais/abas secundárias são síncronos.
- **Solução Técnica:** Substituir todos os 17 `import * as` de `@/state` por imports nomeados diretos; remover `Command` e `QrCodeCanvas` do barrel `@/components/ui/index.ts` (atualizando todos os imports existentes para os arquivos diretos); converter `InvestmentWizard`, `CashFormDialog`, `LaunchWizard` (em `BusinessPage`), `AppLockOverlay`, `PendingDividendsDialogHost`, `DemoTourSpotlight`, `UpgradeDialog` e modais/abas secundárias listados para `React.lazy()` montados sob demanda com `<Suspense fallback={<ContentLoading />}>` (Regra 34, evitando `fallback={null}`); carregar `bank-listener` via `import()` dinâmico apenas em plataforma nativa; isolar `uqr` e avaliar agrupamento de `date-fns` com `vendor-picker` em `vite.config.ts`.
- **Critério de Aceite:** `rg 'import \* as .* from "@/state' src/ -g '!*.test.*'` retorna `0`; build `dist/assets/` comprova redução material do boot inicial e chunks lazy efetivos para wizards, modais e abas secundárias.

### T2.5 — Otimizar LCP de Fontes, páginas offline e expurgar 72 assets mortos em `public/`
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `index.html` (`<head>`) · `src/styles/fonts.css:1–39`
  - `public/offline.html:7–10` · `public/pwa/offline.html:7–10`
  - `public/brand/` (61 arquivos sem uso, `2.247.151 B`) · `public/pwa/icons/` (11 arquivos sem uso, `525.223 B`)
  - `src/components/layout/logo-inline-assets.ts:12–15`
- **Problema Consolidado:** Fontes locais `.woff2` (`inter.woff2`, `sora.woff2`) só são descobertas após baixar/parsear `226 KB` de CSS; páginas offline fazem request externo para Google Fonts; `72` arquivos em `public/` (`2,77 MiB`, 84,6% da pasta) não possuem nenhuma referência em produção; `logo-inline-assets.ts` embute `29,5 KB` de WebP base64 no chunk do shell.
- **Solução Técnica:** Adicionar `<link rel="preload" as="font" type="font/woff2" crossorigin>` para `inter.woff2` e `sora.woff2` em `index.html`; trocar Google Fonts em `offline.html` e `pwa/offline.html` por stack de sistema/fonte local; remover os 72 arquivos sem referência em `public/brand/` e `public/pwa/icons/` (preservando os consumidos por `logo-icon.tsx`, `email-templates.ts`, `supabase/functions/`, `public/offline.html`, `public/pwa/offline.html`, `index.html`, `manifest.webmanifest` e tags `og:image`); avaliar troca de `logo-inline-assets.ts` por asset estático cacheável.
- **Critério de Aceite:** `dist/public` perde `~2,77 MiB` sem quebrar nenhum ícone de PWA, e-mail ou header; Lighthouse/Network mostra preload imediato de `inter.woff2`/`sora.woff2` e zero chamadas externas em `offline.html`.

### T2.6 — Eliminar `.select("*")` críticos, corrigir violação de camada e otimizar queries de Cartões e Carteira
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/services/split-sync.ts:61` (violação `AGENTS.md §3`: consulta Supabase fora de `src/data/`)
  - `src/data/repositories/expenses.ts:34,60,82,101,106,135,161,192` · `src/data/repositories/incomes.ts:34,60,82`
  - `src/data/repositories/portfolio.ts:104,246,253,394,401,535,542,604,614,621,862,869,1061`
  - `src/data/repositories/trips.ts:115,130,146,163,180,551` · `src/data/repositories/public-shares.ts:305` · `src/data/repositories/admin.ts:115,150` (e demais repositórios mapeados na Audit 06)
  - `src/features/cards/hooks/use-cards-page-state.ts:44` · `src/state/queries/use-card-payments.ts:47` · `src/state/queries/use-overview.ts:29`
  - `src/state/queries/use-portfolio-position.ts:201` · `src/data/session.ts:5`
  - `src/features/investments/components/portfolio-activity-panel.tsx:113`
- **Problema Consolidado:** (1) `72` ocorrências de `.select("*")`, incluindo paginação completa de `expenses`/`incomes` e join duplo em `trips.ts:163`; (2) `split-sync.ts:61` acessa `getSupabase()` diretamente da camada `services/`; (3) `CardsPage` refaz 3 SELECTs por cartão mesmo com as coleções globais da Home já frescas em cache; (4) `usePortfolioPosition` dispara 4 chamadas paralelas a `currentUserId()` (`supabase.auth.getUser()`); (5) `listAllPortfolioTransactions` (`portfolio.ts:614`) e `listUserDividendEvents` (`portfolio.ts:862`) não paginam, truncando contas com `> 1.000` registros, e `portfolio-activity-panel.tsx` monta todas as linhas no DOM.
- **Solução Técnica:** Mover query de `split-sync.ts:61` para `src/data/repositories/expenses.ts`; substituir `.select("*")` por projeções explícitas de colunas nas tabelas de alto volume (incluindo os campos exigidos por `T1.7`, `T1.9` [`paid_at`] e `T3.7` [`revision`, `manual_review_required`], mantendo apenas `export.ts` para backup integral); derivar subconjunto do cartão selecionado a partir das coleções globais frescas quando janelas/escopos forem equivalentes; passar `userId` autenticado da sessão para os repositórios de `usePortfolioPosition`; paginar `listAllPortfolioTransactions` e `listUserDividendEvents` via cursor (`readAllPages`) e paginar/virtualizar a listagem visual em `portfolio-activity-panel.tsx`.
- **Critério de Aceite:** Zero chamadas ao Supabase em `src/services/`; projeções explícitas nos repositórios críticos; navegação Home → Cartões → troca de cartão reaproveita cache global sem SELECTs redundantes; `usePortfolioPosition` não repete `getUser()`; conta sintética com `1.200` transações/proventos lê 100% sem truncamento.

---

## Onda 3 — Estado Assíncrono, Parsers & Contratos TypeScript

> **Objetivo:** Eliminar condições de corrida em sessão/caches/cotações, blindar parsers de faturas/CSV/XLSX/OFX/feeds externos, garantir atomicidade em lotes e tipagem estrita em runtime nas fronteiras.

### T3.1 — Corrigir corridas de sessão/Auth, reconexão Realtime, revogação remota e ciclo de cache
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/hooks/use-auth.ts:107,242` · `src/app/providers.tsx:66`
  - `src/state/queries/use-user-access.ts:127–158,184`
  - `src/hooks/use-device-session-sync.ts:35,68–83,90,137–156,176–181`
  - `src/state/queries/use-expenses.ts:10` · `src/state/queries/use-incomes.ts` · `src/data/repositories/expenses.ts:26`
  - `src/state/mutations/use-expense-mutations.ts:31,151` · `src/state/mutations/use-income-mutations.ts:28` · `src/state/mutations/optimistic-cache.ts:14`
  - `src/features/reports/hooks/use-reports-data.ts:53` · `src/features/reports/hooks/use-finance-report-data.ts:124,218` · `src/features/reports/hooks/use-investment-report-data.ts:230` · `src/state/queries/use-portfolio-position.ts:240`
- **Problema Consolidado:** (1) `useAuth` não tem número de geração (resolução lenta antiga sobrescreve evento recente) e `SIGNED_IN` repetido invalida todas as queries; (2) cada consumidor de `useUserAccess()` registra listener próprio e erro/timeout Realtime destrói o canal singleton zerando `subscriberCount` sem reconectar; (3) `isHandlingRemoteRevocation` sem `finally` desativa sincronização de dispositivo após unmount durante `signOut`; (4) queries mensais de receitas/despesas ignoram `AbortSignal`; (5) criar/excluir primeira/última transação não invalida `["onboarding"]` (Home fica presa no estado de conta virgem); (6) rollback otimista restaura snapshot integral e apaga mutação B ainda em voo; (7) retry de Relatórios refaz queries em duplicidade e ignora falhas do ano anterior e de aportes.
- **Solução Técnica:** Adicionar contador de geração em `useAuth` e restringir invalidação de `SIGNED_IN` a troca de identidade/sessão ou elevação de nível MFA (`aal1` → `aal2` de `T1.5`); centralizar listener em `useUserAccess` e implementar reconexão Realtime com *exponential backoff* + `window.online` preservando `subscriberCount`; resetar `isHandlingRemoteRevocation = false` em `finally` e `teardownSingleton()`; propagar `signal` nas consultas mensais após materialização; atualizar/invalidar `["onboarding"]` apenas em mutações que alteram cardinalidade; aplicar rollback otimista por entidade/versão (tratando criação/exclusão concorrente pelo ID da operação); unificar loading/erro/retry de Relatórios sobre a lista exata de fontes ativas retornando `Promise` aguardável.
- **Critério de Aceite:** Testes automatizados validando: evento de auth mais novo prevalece sobre bootstrap lento; reconexão Realtime após `TIMED_OUT`; `isHandlingRemoteRevocation` resetado após unmount; navegação A→B→C cancela páginas obsoletas; criar primeira receita sai imediatamente do `VirginAccountHero`; falha em mutação A preserva mutação B; 1 clique no retry de Relatórios recupera falhas isoladas de ano anterior e aportes.

### T3.2 — Corrigir corrida A→B→A, concorrência e falha parcial no histórico de cotações e SWR
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/state/queries/use-portfolio-monthly-position.ts:76,155,211`
  - `src/services/quotes.ts:376–400` · `src/data/repositories/asset-prices.ts:354`
  - `src/state/queries/use-market-quotes-swr.ts:279,336`
- **Problema Consolidado:** Enriquecimento histórico relê o fechamento mensal do banco, envia lotes de 50 em série, usa `Promise.race` sem cancelar transporte, sofre corrida A→B→A que deixa o mês A permanentemente estimado, e perde contexto de falha parcial tanto no histórico quanto no SWR.
- **Solução Técnica:** Reusar o histórico já carregado em memória; indexar enriquecimento por `(month, sortedTickers)` com `AbortController` real no timeout e na troca de mês (tratando aborto intencional como cancelamento limpo, sem contar como falha parcial nem acionar backoff no SWR); disparar lotes independentes com concorrência limitada via `Promise.allSettled`; retornar resultado estruturado por ticker (preço, origem, erro/retryável) e liberar apenas tickers pendentes para backoff no SWR.
- **Critério de Aceite:** Teste A→B→A com resposta atrasada entrega os preços corretos ao mês A; carteira com `> 100` tickers faz 1 única leitura inicial de banco e processa lotes em ondas paralelas limitadas; falha parcial em 1 ticker preserva os demais e permite retry isolado.

### T3.3 — Blindar parsers de Faturas, CSV/XLSX da Carteira, OFX, Extratos e Encoding
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/domain/reconciliation/extractors/type-sniffer.ts:291,364`
  - `src/domain/portfolio/import-parser.ts:145,176,335,562,691,752` · `src/domain/portfolio/xlsx-parser.ts:16,40,149,180`
  - `src/features/investments/components/import-dialog/use-portfolio-csv-import.ts:82,89`
  - `src/domain/reconciliation/extractors/ofx-extractor.ts:60,135` · `src/domain/reconciliation/quality-gate.ts:148`
  - `src/domain/reconciliation/extractors/csv-extractor.ts:185,200` · `src/domain/reconciliation/extractors/index.ts:251`
  - `src/features/cards/components/statement-import/statement-import-pipeline.ts:347,362,425,428,461` · `statement-ingestion-runner.ts:103`
  - `src/domain/portfolio/statement-parser.ts:94,200,256`
- **Problema Consolidado:** (1) `type-sniffer.ts` perde o sinal em `R$ -20,00` e aceita lixo como `1,23,45`; (2) `import-parser.ts` quebra CSV com aspas (`"LOJA;FILIAL"`), converte `$1,234.56` em `1.23456`, aceita `123XYZ`, aceita `31/02/2026` e transforma serial Excel `46000` ou data vazia em `todayISO()`; (3) `.xls` binário cai em `parseXlsxToCsv` (esperando ZIP) e XLSX escolhe apenas 1 aba ignorando falhas de descompressão; (4) OFX perde sinal negativo de `BALAMT` e silencia blocos rejeitados; (5) caminhos de importação decodificam UTF-16/Windows-1252 de formas incompatíveis; (6) blueprint aprendido recebe confiança `100` vencendo inferência melhor por contagem bruta; (7) `statement-parser.ts` elimina células vazias deslocando colunas numéricas.
- **Solução Técnica:** Validar gramática numérica integral (sem `parseFloat` permissivo), extrair sinal após normalizar símbolo monetário e checar `Number.isSafeInteger`; reusar leitor CSV com RFC-4180 (aspas/multilinha, resolvendo ambiguidade de separador decimal `1.234` vs `1,234` pelo padrão detectado por arquivo/coluna) e leitor de workbook multi-formato/multi-aba da conciliação (com tratamento explícito para `.xls` binário BIFF sem tentar descompressão ZIP); validar datas civis com ida-e-volta e converter seriais Excel pela época do workbook (sem fallback silencioso para hoje); decodificar bytes uma única vez por sessão com detecção de BOM/UTF-16/UTF-8 estrito/Windows-1252; preservar `BALAMT` assinado e contagem de rejeições OFX; avaliar blueprint e inferência pela mesma métrica de qualidade; preservar colunas vazias em `statement-parser.ts`.
- **Critério de Aceite:** Suíte Vitest cobrindo: `R$ -20,00` → `-2000¢`; `1,23,45` e `123XYZ` rejeitados; `"LOJA;FILIAL"` em 1 célula; `$1,234.56` → `1234.56`; `31/02/2026` rejeitado; serial `46000` convertido corretamente; UTF-16 BOM sem NULs; `BALAMT=-123.45` preservado negativo.

### T3.4 — Corrigir validação de moeda em cotações, periodicidade BCB e datas de proventos Brapi
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `supabase/functions/_shared/quotes-core.ts:602,999,1043,1067` · `supabase/functions/quotes/index.ts:423,1374,1433`
  - `src/services/quotes.ts:71,236,423` · `src/domain/portfolio/quotes.ts:285` · `src/state/queries/use-macro-indicators.ts:35`
  - `src/tests/quotes-core.test.ts:293`
- **Problema Consolidado:** Yahoo/Edge assume `BRL` quando `currency` vem ausente (mesmo para ativo USD como `AAPL`); BCB anualiza qualquer taxa `< 0,2` como diária e substitui IPCA `<= 0` por `4%` com TTL compartilhado; Brapi atribui `trust_tier: official` a datas impossíveis (`2026-02-31`) e marca ticker como coberto mesmo com array descartado; cron de ativos vendidos ignora erro em `data` e omite proventos pós-venda.
- **Solução Técnica:** Exigir correspondência entre moeda retornada e `asset.currency` (moeda de negociação/custódia, não geografia do emissor, preservando BDRs/ETFs da B3 cotados em BRL, e avançando na cascata em ausência); declarar unidade explícita por série BCB, permitir IPCA zero/negativo e aplicar TTL individual por série; validar data civil real em `quotes-core.ts` e separar por ticker ausência confirmada vs dados inválidos (acionando fallback Yahoo); tratar erro por lote no cron marcando execução parcial; atualizar `quotes-core.test.ts:293` ao contrato vigente de proveniência.
- **Critério de Aceite:** Cotação sem moeda para `AAPL` não vira BRL; IPCA de `0,1%` ou `-0,2%` é preservado sem anualização diária nem fallback `4%`; provento Brapi com `2026-02-31` é rejeitado e não bloqueia fallback Yahoo; `quotes-core.test.ts` passa 100%.

### T3.5 — Garantir atomicidade e idempotência em importação da carteira, marcos históricos e conciliação de fatura
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/investments/components/import-dialog/use-portfolio-import-confirm.ts:29,45,64`
  - `src/features/investments/components/pocket-cost/use-pocket-cost-manual.ts:137,164,190`
  - `src/domain/reconciliation/chunking.ts:69` · `src/features/cards/components/statement-import/use-statement-commit.ts:106` · `use-statement-import.ts:325` · `supabase/migrations/20260101000155_commit_statement_reconciliation_rpc.sql:22`
- **Problema Consolidado:** Importação da carteira grava ativos antes das transações (falha posterior deixa posição sem ledger e toast pode reportar sucesso parcial); marco histórico + snapshot mensal executam 2 commits independentes (retry duplica aporte); conciliação de fatura em múltiplos chunks mantém o cursor de retomada apenas em estado React (perda de resposta/sessão deixa commit parcial sem recibo consultável).
- **Solução Técnica:** Criar RPC transacional idempotente para importação da carteira (ativos + transações com validação de invariantes no SQL e cálculos em `domain/` conforme `AGENTS.md §3`); criar RPC atômico idempotente para marco de aporte + snapshot mensal; adicionar identificador de importação + recibos idempotentes por lote no servidor em `commit_statement_reconciliation` com retomada consultável.
- **Critério de Aceite:** Falha simulada no último passo de importação da carteira ou marco+snapshot faz rollback integral (zero registros órfãos); reenvio com mesma chave idempotente não duplica registros.

### T3.6 — Corrigir corrida de PTAX na ordem rápida e resiliência da importação de faturas/OCR
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/investments/components/shared-forms/use-quick-transaction-form.ts:182` · `src/services/quotes.ts:116,145`
  - `src/features/cards/components/statement-import/statement-vision-runner.ts:164,179` · `statement-import-pipeline.ts:160`
  - `src/features/cards/components/statement-import/statement-import-dialog.tsx:213` · `use-statement-import.ts:142,185,214,296`
  - `src/features/cards/components/statement-import/use-statement-commit.ts:70,128` · `statement-categorization-stage.ts:215`
  - `src/data/repositories/support-tickets.ts:49,62`
- **Problema Consolidado:** PTAX em `use-quick-transaction-form.ts` dispara com `targetAsset` indefinido e sobrescreve taxa editada manualmente com resposta antiga; `Promise.all` no OCR derruba a onda inteira por falha em 1 página; troca de competência na conciliação descarta promise causando `unhandledrejection`; falhas de blueprint/categorização e `functions.invoke` de `support-tickets` (campo `error` não lido) passam sem telemetria.
- **Solução Técnica:** Guardar consulta PTAX por `targetAsset?.currency === "USD"`, cancelar com `AbortController`, separar estado `manualFxRate` de `suggestedFxRate` (garantindo que troca de data/ativo nunca sobrescreva `manualFxRate` já digitado pelo usuário) e validar data retornada pelo BCB; migrar ondas de OCR para `Promise.allSettled` preservando páginas válidas e oferecendo retry só das falhas; tratar rejeições e limpar status em `finally` na troca de competência; checar `{ error }` em `support-tickets.ts` e registrar telemetria estruturada sem PII nas etapas não bloqueantes.
- **Critério de Aceite:** Trocar data rapidamente ou digitar câmbio manual nunca é sobrescrito por resposta PTAX atrasada; falha em 1 página de PDF preserva as demais; troca de competência com erro nunca gera `unhandledrejection`.

### T3.7 — Alinhar contratos de banco (`Row`/`Insert`/`Update`) e DTOs de confirmação de proventos
- **Prioridade:** P2 (Média)
- **Arquivos/Linhas:**
  - `src/types/database.ts:83,135,154` · `src/types/schema.ts:1064,1102,1150,1331`
  - `src/data/repositories/portfolio.ts:770,785,878`
  - `src/data/query.ts:17` · `src/data/rpc/client.ts:16,23`
  - `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql:64,1719,2100`
- **Problema Consolidado:** `UserDividendEvent` usa o mesmo tipo para leitura/escrita marcando colunas `NOT NULL` (`revision`, `manual_review_required`) como opcionais e sintetizando `revision = 1` no mapper; DTOs de confirmação de proventos omitem `already_settled_dividend_ids` retornado pelo SQL; `resolveQuery<T>` e `unwrapRpc(..., true)` ocultam nulabilidade e incompatibilidades de seleção.
- **Solução Técnica:** Separar `Row`, `Insert` e `Update` para `user_dividend_events` (tratando compatibilidade legada na borda sem forjar `revision`); adicionar `already_settled_dividend_ids: string[]` aos DTOs de confirmação/aprovação com validação de UUIDs; expor nulabilidade explícita em `unwrapRpc` e validar projeções críticas nas bordas.
- **Critério de Aceite:** `npm run typecheck` passa sem casts duplos novos; testes de primeira confirmação e repetição idempotente distinguem novos IDs de `already_settled_dividend_ids`.

### T3.8 — Validar contratos em runtime com Zod em Cotações, Billing e remover fallbacks falsos de hooks
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/services/quotes.ts:203,226,408`
  - `src/data/repositories/billing.ts:110,134,191` · `src/types/billing.ts:93`
  - `src/features/investments/components/pending-dividends-dialog.tsx:75,97` · `src/state/queries/use-corporate-dividends.ts:51`
- **Problema Consolidado:** Envelopes de `quotes` confiam em genéricos TS sem validação runtime (permitindo `ticker` numérico, coerção booleana e `NaN`); `billing.ts` faz cast cego para `CheckoutSessionResult` e converte erro de `listInvoices` em `[]`; `getOptionalStateHook` em `pending-dividends-dialog.tsx` e `use-corporate-dividends.ts` devolve `{ success: true }` ou `data: null` silenciosamente se o export mudar.
- **Solução Técnica:** Validar envelopes e itens de `quotes.ts` individualmente com schemas Zod (descartando itens corrompidos como resposta parcial); criar schema Zod discriminado por modalidade de checkout em `billing.ts` e propagar `AppError` em `listInvoices`; substituir `getOptionalStateHook` por imports nomeados estáticos.
- **Critério de Aceite:** Payload malformado de cotação (item `null`, ticker numérico ou preço booleano) não quebra o lote válido; `listInvoices` com erro `502` aciona estado de erro + retry na UI; erro de export em hooks de proventos quebra em tempo de compilação.

---

## Onda 4 — UI/UX sem Truncamento em Cards, Botões Adaptativos Progressivos, `autoFocus` Mobile e Higiene

> **Objetivo:** Cumprir 100% das Regras 10–28 e 34 do `AGENTS.md` e do `docs/DESIGN_RULES.md`, eliminar truncamento de valores/títulos em 360px, implementar botões adaptativos em 3 níveis (Texto Completo → Palavra Única → Ícone Lucide), consolidar ergonomia mobile e limpar código morto/duplicações.

### T4.1 — Eliminar truncamento em cards, grids rígidos (`grid-cols-3`) e formatação fora do padrão pt-BR
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `src/components/modules/aporte-result/aporte-cockpit-command-card.tsx:399–445`
  - `src/components/modules/aporte-result/aporte-summary-section.tsx:78–113,123`
  - `src/components/modules/reports/report-kpi-grid.tsx:68,86,90`
  - `src/components/modules/transaction-row.tsx:114–156`
  - `src/features/business/pages/business-page.tsx:465–476`
  - `src/components/modules/credit-card-3d.tsx:136–150,190–228`
  - `src/features/reminders/components/notifications/SystemNotificationRows.tsx:116,205,256,264,303,353,360,415,488,571,663`
  - `src/features/reminders/components/notifications/ReminderNotificationRows.tsx:102,128,198` · `src/components/modules/reminder-item.tsx:139` · `src/features/insights/components/diagnostic-card.tsx:45`
  - `src/components/modules/real-cash-hero-card.tsx:173–178`
- **Problema Consolidado:** `aporte-cockpit-command-card` e `aporte-summary-section` usam `grid-cols-3` rígido com `truncate` direto em `<MoneyText />` (violando Regras 10 e 11) e `.toFixed(1)` com ponto decimal (violando Regra 28); `report-kpi-grid` combina `line-clamp-1 truncate`; `transaction-row` esmaga o título entre até 3 badges inline em 360px; `business-page` usa `CardHeader flex-row` rígido com `truncate`; `credit-card-3d` trunca nome do cartão e desalinha rodapé; notificações usam `line-clamp-1` cortando valores/datas; `real-cash-hero-card` tem ternário redundante.
- **Solução Técnica:** Trocar `grid-cols-3` por `grid-cols-2 sm:grid-cols-3` (com 3º item `col-span-2 sm:col-span-1` no mobile) e remover `truncate` de todos os `<MoneyText />` usando `p-3` no mobile e escala adaptativa da Regra 24 (`whitespace-nowrap tabular-nums` + `deemphasizeCents`) para valores `>= R$ 100.000,00`; formatar NEF com `Intl.NumberFormat("pt-BR")`; promover títulos/descrições de KPIs, cards e notificações para `line-clamp-2 break-words` com `title={...}`; mover badges de `TransactionRow` para sub-linha `flex-wrap` no mobile; aplicar `flex-col sm:flex-row` no `CardHeader` de `business-page` e corrigir os 3 degraus de escala em `real-cash-hero-card`.
- **Critério de Aceite:** Em 360px e 390px com valores `>= R$ 100.000,00`, zero reticências (`...`) em `<MoneyText />`, zero corte de títulos em 1 linha nos cards/notificações, e 100% dos decimais formatados com vírgula pt-BR.

### T4.2 — Implementar Botões Adaptativos Progressivos (Texto Completo → Palavra Única → Ícone Lucide) e corrigir `ModalFooter`
- **Prioridade:** P0 (Crítica)
- **Arquivos/Linhas:**
  - `src/components/ui/button.tsx` (novo utilitário DRY `ResponsiveLabel` em `src/components/ui/`)
  - `src/components/ui/modal-footer.tsx:20–24`
  - `src/features/cards/components/invoice-competence-toolbar.tsx:127–162`
  - `src/components/ui/confirm-dialog.tsx:44–57` · `src/components/ui/modal.tsx:106–124`
  - `src/features/cards/components/statement-import/statement-import-dialog.tsx:100–102,312–313` · `statement-mapping-fallback.tsx:372–375`
  - `src/features/transactions/wizard/launch-wizard-footer.tsx:28–64` · `launch-wizard-modals.tsx:59`
  - `src/components/modules/reports/report-document-layout.tsx:158` · `src/features/settings/components/tabs/appearance-tab.tsx:220` · `active-devices-card.tsx:339` · `asset-detail-sheet.tsx:147` · `portfolio-snapshots-dialog.tsx:284` · `activity-delete-dialog.tsx:52`
  - `src/components/layout/page-header.tsx:70–84,124–128` · `cards-page.tsx:77–95` · `transaction-list-page.tsx:40–62` · `debts-page.tsx:25–43`
  - `src/components/modules/quick-aporte-card.tsx:190–200`
- **Problema Consolidado:** `buttonVariants` impõe `whitespace-nowrap`, fazendo rótulos de 18–24 caracteres (`"Registrar pagamento"`, `"Avançar para conferência"`, `"Continuar conferindo"`, `"Importar fatura"`) estourarem `grid-cols-2`/`grid-cols-3` em 360px. Além disso, `ModalFooter` usa `Children.count(children)` (que conta `null`/`false` e trata `<Fragment>` como 1), quebrando o layout `grid-cols-2`.
- **Solução Técnica:** Criar primitivo DRY `<ResponsiveLabel full="..." short="..." />` seguindo a escada **Nível 1 (`sm:`):** Ícone + Texto Completo → **Nível 2 (`min-[380px]:` até `< sm`):** Ícone + Palavra Única → **Nível 3 (`< 380px` / barra densa):** Somente Ícone Lucide centralizado com `aria-label`, `title` e alvo mínimo `44×44px`; estender `ConfirmDialogProps` com `confirmShortLabel`, `cancelShortLabel` e `confirmIcon`; portar `countActionChildren` (recursivo, ignorando `null`/`boolean`/`Fragment`) para `ModalFooter`; aplicar nos 16 pontos listados (incluindo `invoice-competence-toolbar`, `PageHeader` em conformidade com a Regra 21 — `Button size="sm"` e `grid-cols-2` no mobile — e `QuickAporteCard`).
- **Critério de Aceite:** Em 320px, 360px, 390px e 1280px, zero overflow horizontal em toolbars, `PageHeader`, `ConfirmDialog` e `ModalFooter`; 2 botões reais dentro de `<Fragment>` ou renderização condicional sempre ativam `grid-cols-2` no mobile.

### T4.3 — Ergonomia Mobile, isolamento de scroll em modais, tabelas roláveis, alinhamento de `Input` e guarda de `autoFocus`
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/components/modules/split-charge/split-charge-installments.tsx:78` · `split-charge-participants.tsx:26`
  - `src/components/modules/aporte-result/allocation-drift-bars.tsx:361` · `src/features/demo-tour/spotlight-step-card.tsx:80`
  - `src/features/reports/components/consolidated-wealth/ConsolidatedBalanceSection.tsx:136–137` · `src/features/reports/components/tax-facilitator/TaxBensDireitosSection.tsx:176–177`
  - `src/components/ui/input.tsx:14`
  - `src/components/ui/command.tsx:55–65` (já conforme — cobrir com teste de regressão)
- **Problema Consolidado:** 4 componentes aplicam `overflow-y-auto` / `max-h-*` aninhados dentro de modais/cards (violando Regra 26); 2 tabelas financeiras densas usam `overflow-hidden` sem `overflow-x-auto` (violando Regra 25); `Input` usa `px-4 text-base shadow-sm` divergindo de `Select`/`Textarea`/`MoneyInput` (`px-3.5 text-base sm:text-sm shadow-xs`). (`autoFocus` declarativo já está zerado e `command.tsx` já protege `.focus()` com `(pointer: fine)`).
- **Solução Técnica:** Remover `max-h-* overflow-y-auto` nos filhos de modal em `split-charge-*` e `allocation-drift-bars` (delegando ao `scrollRef` do modal ou expansão progressiva); trocar `42vh` por `42dvh overscroll-contain` em `spotlight-step-card.tsx`; envolver tabelas de `ConsolidatedBalanceSection` e `TaxBensDireitosSection` em `w-full overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible` (compatível com as classes `print:` de `T4.4`) com `min-w-[420px] sm:min-w-full`; alinhar `input.tsx:14` a `px-3.5 py-2 text-base sm:text-sm shadow-xs`; adicionar teste de regressão garantindo zero `autoFocus` e guarda `(pointer: fine)` em `command.tsx`.
- **Critério de Aceite:** Zero scroll duplo dentro de modais no mobile; tabelas de DRE e Bens e Direitos roláveis horizontalmente sem corte em 360px e íntegras na impressão A4; `Input` alinhado 1:1 com `Select`/`MoneyInput` no desktop.

### T4.4 — Corrigir governança sensorial, contraste WCAG AA, cores hardcoded e micro-tipografia `< 10px`
- **Prioridade:** P1 (Alta)
- **Arquivos/Linhas:**
  - `src/features/settings/components/tabs/appearance-tab.tsx:132–138,216–224` · `src/features/goals/components/goal-card.tsx:55–58,124–132`
  - `src/components/ui/money-text.tsx:54` · `src/components/modules/kpi-card.tsx:35,96`
  - `src/components/layout/notifications-button.tsx:56,58` · `src/components/modules/reports/report-risk-gauge.tsx:71,76` · `src/components/modules/credit-card/credit-card-parts.tsx:50–76`
  - `ConsolidatedBalanceSection.tsx:130`, `TaxBensDireitosSection.tsx:160,166,170,184,198`, `dividend-freedom-modal.tsx:194`, `snapshots-ledger-table.tsx:68–100`, `report-equity-class-table.tsx:214,221`, `report-header.tsx:233`
  - `aporte-desktop-table.tsx:148`, `household-wealth-card.tsx:221`, `snowball-action-card.tsx:55`
- **Problema Consolidado:** `appearance-tab.tsx` gera duplo disparo sensorial e toca áudio/vibração mesmo vindo do modo `"discreet"` no reset; `MoneyText` e `KpiCard` usam `text-portfolio` em vez de `text-portfolio-strong` (falha AA no Light Mode); `KpiCard` estático tem hover enganoso (`hover:border-border`); cores hardcoded (`text-white`, `border-white`, paleta Tailwind) violam `DESIGN_RULES.md §1.5`; 6 arquivos usam micro-fontes `text-[8.5px]`/`text-[9px]` em tela (incluindo `grid-cols-5` rígido em `dividend-freedom-modal.tsx:194`); badges/bordas ad-hoc violam Regras 14 e 16.
- **Solução Técnica:** Remover `triggerSensory("action")` de `handleResetDefaults` em `appearance-tab.tsx`; migrar pill `"Pública"` de `goal-card.tsx` para `<Chip />`; alterar `text-portfolio` para `text-portfolio-strong` em `money-text.tsx:54` e `kpi-card.tsx:35`; condicionar hover de `KpiCard` a `Boolean(onClick)`; substituir cores hardcoded por tokens semânticos (movendo bandeiras para `credit-card-gradient.ts`); elevar fontes de tela para `>= text-[10px]` (restringindo `< 10px` a `print:`) e trocar `grid-cols-5` por `grid-cols-2 sm:grid-cols-5`; normalizar badges e `border-border/80`.
- **Critério de Aceite:** Reset de aparência no modo `"discreet"` emite `0` disparos sensoriais extras; contraste `>= 4.5:1` em Light/Dark/OLED; `rg 'text-\[(8|8\.5|9|9\.5)px\]' src/` retorna apenas classes com prefixo `print:`.

### T4.5 — Completar Skeletons de rota, `<ContentLoading />`, trava de duplo clique e CTAs em Empty States
- **Prioridade:** P2 (Média)
- **Arquivos/Linhas:**
  - `src/components/layout/route-skeletons/route-skeleton-fallback.tsx:29–72` · `src/features/settings/components/mfa-modal.tsx:170–173`
  - `src/components/ui/confirm-dialog.tsx:45–56` · `statement-import-dialog.tsx:100` · `statement-mapping-fallback.tsx:372` · `quick-aporte-card.tsx:190` · `launch-wizard-footer.tsx:32–34,51–53`
  - `statement-reconcile-step.tsx:279` · `household-clustering-ranking.tsx:51` · `household-comparison-card.tsx:104` · `asset-transactions-timeline.tsx:77` · `allocation-breakdown-dialog.tsx:349,489`
- **Problema Consolidado:** `/negocio` e `/assinatura` caem em `<OverviewSkeleton />` gerando CLS; `mfa-modal.tsx` usa spinner manual em vez de `<ContentLoading />`; `ConfirmDialog` e 4 formulários não travam Cancelar/Submit com `loading` + `aria-busy` durante mutações; 5 `EmptyState`s acionáveis não oferecem botão CTA de recuperação.
- **Solução Técnica:** Mapear `/negocio` (`/business`) e `/assinatura` em `RouteSkeletonFallback`; trocar spinner manual de `mfa-modal.tsx` por `<ContentLoading />`; passar `disabled={pending}` e `loading={pending}` nos botões de confirmação/submit (e `disabled={aporteCents <= 0}` no `QuickAporteCard`); adicionar CTAs objetivos (`"Limpar busca"`, `"Registrar operação"`, etc.) nos 5 `EmptyState`s mantendo `tone="default"` no texto e reservando a cor de destaque apenas para o botão (Regra 14).
- **Critério de Aceite:** Navegar para `/negocio` e `/assinatura` renderiza skeleton compatível; duplo clique rápido em `ConfirmDialog`/submits dispara no máximo 1 mutação; todos os 5 empty states oferecem ação direta.

### T4.6 — Remover código morto, consolidar roteamento, corrigir `package.json` e deduplicar utilitários
- **Prioridade:** P2 (Média)
- **Arquivos/Linhas:**
  - **Dead files (`5`):** `src/features/investments/components/resumo/portfolio-indicators-guide-modal.tsx`, `src/features/investments/components/aporte/aporte-input-card.tsx`, `src/features/transactions/components/split/split-manage-helpers.ts`, `src/features/debts/hooks/use-export-debts-csv.ts`, `src/features/investments/components/resumo/portfolio-concentration-alert.tsx`
  - **Shims órfãos (`3`):** `src/domain/budgets/kits.ts`, `src/features/budgets/components/category-form-fields.tsx`, `src/features/budgets/components/use-category-form.ts`
  - **Exports mortos (`src/app/`):** `src/app/authenticated-root.tsx:45` (`AuthenticatedRoot`), `src/app/routes.tsx:54–86` vs `src/app/router.tsx:96–138`
  - **Dependência:** `package.json:50` (`@capacitor/android` em `dependencies`)
  - **Duplicações (`11`):** `cpf.ts` (`domain/validation` vs `services/masks`), `shiftMonth`, `todayISO`, `invoiceClosingDate`, `normalizeText`, `medianOf`, `isWeekend`, `getTransactionIntradayWeight`, `formatFixedIncomeRateLabel`, `THEME_PREFERENCES`, `REPORT_WEIGHT_PRESETS`
- **Problema Consolidado:** Código morto acumula carga de manutenção e confunde buscas; `routes.tsx` e `router.tsx` duplicam definições de rotas públicas; `@capacitor/android` está listado em `dependencies` sem uso em runtime; 11 funções/constantes duplicadas já apresentam divergências sutis (ex.: `medianOf` arredondando vs fracionário, `getTransactionIntradayWeight` em PT-BR vs inglês).
- **Solução Técnica:** Excluir os 5 arquivos mortos, os 3 shims órfãos (migrando testes de `kits.ts` para `@/domain/categories`) e `AuthenticatedRoot`; fazer `router.tsx` consumir `routes.tsx` como fonte única; mover `@capacitor/android` para `devDependencies`; unificar as 11 duplicações em suas fontes canônicas (`src/lib/date.ts`, `src/domain/*`, `src/types/schema.ts`); revisar os 36 barrels não importados decidindo manter apenas os exigidos pela árvore em `docs/architecture/PROJECT_STRUCTURE.md`.
- **Critério de Aceite:** `npm run verify:full` verde após remoção/unificação; zero divergência entre implementações de CPF, datas, `medianOf` e `getTransactionIntradayWeight`.

### T4.7 — Encaminhar `console.warn` / `console.error` residuais para o gateway de observabilidade
- **Prioridade:** P3 (Baixa)
- **Arquivos/Linhas:**
  - `src/hooks/use-pending-split-expense.ts:72,83`
  - `src/services/split-sync.ts:316,350,379` · `src/state/mutations/use-split-sync-mutations.ts:168`
  - `src/features/public-share/hooks/use-public-split-actions.ts:121` · `src/features/public-share/components/use-split-onboarding.ts:102`
  - `src/data/rpc/admin.ts:359` · `src/data/repositories/card-bill-rollovers.ts:81,114` · `public-shares.ts:165` · `analytics.ts:42` · `support-tickets.ts:68`
- **Problema Consolidado:** Existem `14` chamadas diretas a `console.warn`/`console.error` fora de testes; embora o Rolldown remova `console.*` em produção (`dropConsole: true`), falhas operacionais reais se perdem em vez de passarem por `observability.ts` / `errors.ts`.
- **Solução Técnica:** Encaminhar erros operacionais relevantes para `captureException` / logger estruturado de `src/services/observability.ts` (sem PII) e remover logs de ruído redundantes.
- **Critério de Aceite:** `rg 'console\.(log|warn|error|info|debug)' src/ -g '!*.test.*' -g '!*.spec.*'` retorna `0` fora do próprio módulo de observabilidade.

---

## Sequenciamento e Quality Gates (`AGENTS.md §10`)

| Onda | Classificação | Quality Gate Obrigatório | Validação Adicional |
|---|---|---|---|
| **Onda 1** | Fluxo Completo (Migrations/RPCs/Domínio) | `npm run verify:full` | Testes unitários dos vetores financeiros (`C01`–`C12`, `F01`–`F05`, `I01`–`I11`, `R01`–`R11`, `T01`–`T06`) e PoCs de RLS/Webhook em staging |
| **Onda 2** | Fluxo Completo (Arquitetura/Bundle/Queries) | `npm run verify:full` | Comparativo antes/depois de `dist/assets/`, React Profiler (Home + Notification Hub) e contagem de requests no Network |
| **Onda 3** | Fluxo Completo (Estado/Parsers/Contratos) | `npm run verify:full` | Suíte dedicada de parsers (CSV/XLSX/OFX/PDF/Brapi/BCB), testes de corrida assíncrona e idempotência de RPCs |
| **Onda 4** | Fluxo Completo (UI/UX + Higiene) | `npm run verify:full` | Inspeção visual em `320px`, `360px`, `390px`, `768px` e `1280px` nos temas **Light**, **Dark** e **OLED** |

### Dependências, Ordem Intra-Onda (Anti-Conflito) e Fechamento (`AGENTS.md §10.5`)

- **Dependências Entre Ondas:** `T1.5` → `T3.1` (elevação MFA); `T1.7` e `T1.9` → `T2.1` e `T2.6` (`use-real-cash-balance.ts` e projeções `paid_at`/custódia); `T3.7` → `T2.6` (colunas `revision` e `manual_review_required`).
- **Onda 1:** Executar `T1.2` antes de `T1.5` (`src/data/repositories/access.ts`), `T1.7` antes de `T1.6` (dependência de `total_cost_brl`/`realized_cost_brl` no ledger de custódia) e `T1.9` antes de `T1.11` (`src/domain/reports/consolidated-balance.ts`).
- **Onda 2:** `T2.6` deve preservar as queries já migradas para RPC em `public-shares.ts` por `T1.1`, manter `revision` e `manual_review_required` na projeção de `listUserDividendEvents` (`T3.7`) e coordenar `use-portfolio-position.ts` com `T3.1`. Serializar `T2.4` → `T2.2` → `T2.3` (`page-shell.tsx` e `use-notification-center.ts`).
- **Onda 3:** Executar `T3.7` antes de `T3.8` (`already_settled_dividend_ids` nos hooks de proventos), serializar `T3.8` → `T3.4` → `T3.2` → `T3.6` em `src/services/quotes.ts`, e `T3.3` → `T3.6` → `T3.5` nos arquivos de `statement-import/`.
- **Onda 4:** Serializar `T4.2` ↔ `T4.5` (`confirm-dialog.tsx`, `statement-import-dialog.tsx`, `statement-mapping-fallback.tsx`, `launch-wizard-footer.tsx`, `quick-aporte-card.tsx`), `T4.3` ↔ `T4.4` (`ConsolidatedBalanceSection.tsx`, `TaxBensDireitosSection.tsx`) e `T4.2` ↔ `T4.4` (`appearance-tab.tsx`). Executar `T4.1`–`T4.5` antes de `T4.6` (remoção de código morto/barrels e atualização de `docs/architecture/PROJECT_STRUCTURE.md` se aplicável), e `T4.7` por último.
- **Fechamento e Governança (`AGENTS.md §8` e `§10.5`):** Executar cada onda em branch de trabalho (`develop` ou `bot/<tarefa>`) com `npm run verify:full` verde antes do merge na `main`; ao concluir o plano, aplicar bump `MINOR` no `package.json`, atualizar `docs/roadmap/ROADMAP.md` e arquivar o plano em `docs/plans/completed/`.
