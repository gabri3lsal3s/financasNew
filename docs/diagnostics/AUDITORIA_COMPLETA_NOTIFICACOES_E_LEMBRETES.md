# Auditoria Completa, Arquitetura e Remediação do Ecossistema de Notificações e Lembretes (v3.16.0)

> **Data da Auditoria e Homologação:** 22 de novembro de 2026
> **Escopo:** Motor de Domínio (`Notification Hub`), Central de Lembretes (`/lembretes`), Sininho e Popover, Carrossel da Home (`DashboardAlertsCarousel`), Carrossel de Carteira (`PortfolioInsightsCarousel`), Preferências e Push Híbrido (Notificações Locais Android + Web Push VAPID + FCM), Assistente Passivo de Bancos (*Prominent Disclosure*), Painel Administrativo de Broadcasts, Banco de Dados Supabase (RLS/RPCs/Migrations `0001`–`0138`) e Edge Functions (`push-dispatcher`, `sunday-digest`, `billing-lifecycle-cron`, `support-notify`).

---

## 1. Visão Geral da Arquitetura Unificada

Todo evento que comunica, alerta ou solicita ação do usuário dentro ou fora do aplicativo segue uma arquitetura em camadas com fonte única de verdade e governança estrita (`AGENTS.md` §4 Regras 8, 11–15, 18, 19, 23, 28, 32 e 35):

```
+-----------------------------------------------------------------------------------+
|                        FONTES DE EVENTOS (DOMÍNIO & NUVEM)                        |
|  - Faturas de Cartão (competência x vencimento)                                   |
|  - Dívidas & Contas (payable vs receivable, dedup de Rachas e grupos de parcelas) |
|  - SmartAdvisor (recorrências, duplicidades, teto familiar, metas, compromissos)  |
|  - Sistema (Broadcasts Admin, Respostas de Suporte, Sinalizações Pix em Rachas)   |
|  - Assinatura & Ciclo de Vida (Trial, Past-Due, Resumo Dominical Opt-In)          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|               MOTOR PURO: NOTIFICATION HUB (src/domain/notifications/hub/)        |
|  - Classificação estrita de severidade:                                           |
|      P0_CRITICAL      -> Atrasos reais (overdue) e assinatura past_due/unpaid     |
|      P1_ACTION_NEEDED -> Vence hoje, Pix sinalizado em racha, suporte, orçamento, |
|                          duplicidade (dup:*), teto familiar, despesas ausentes    |
|      P2_ADVISORY      -> Vence em breve, faturas fechadas (opt-in), convites      |
|                          familiares, viagens encerradas, broadcasts informativos  |
|      P3_OPPORTUNITY   -> Economia em assinaturas, aportes e novidades (promotion) |
|  - Deduplicação por entityRefs sem colisão entre múltiplas faturas do mesmo cartão|
+-----------------------------------------------------------------------------------+
            |                            |                            |
            v                            v                            v
+-----------------------+    +-----------------------+    +-------------------------+
|  SUPERFÍCIES IN-APP   |    |  CARROSSÉIS (MAX 5)   |    |  CANAIS EXTERNOS OPT-IN |
| - Sininho (P0/P1/P2)  |    | - Home & Investimentos|    | - Local Push 7d (09:00) |
| - Popover (top 6)     |    | - Altura uniforme     |    | - Web Push VAPID / FCM  |
| - Badges de Navegação |    | - Dispensa 7d ou 30d  |    | - Quiet Hours (22h-08h) |
| - Central /lembretes  |    | - Zero whack-a-mole   |    | - Resumo Dominical Email|
+-----------------------+    +-----------------------+    +-------------------------+
```

---

## 2. Matriz de Achados e Correções Aplicadas (Waves 1 a 4)

### 2.1 Wave 1 — Segurança, Privacidade, Banco de Dados (`0138`), Edge Functions e Logout

| ID | Camada | Achado da Auditoria | Correção Implementada |
|---|---|---|---|
| **W1-01** | Supabase SQL / RLS | `get_my_broadcast_notifications`, `mark_broadcast_as_read`, `dismiss_broadcast_notification` e `admin_send_broadcast_notification` não revogavam `PUBLIC, anon`; `broadcast_notifications_select` expunha linhas brutas a qualquer autenticado. | Criada migration `20260101000138_harden_notifications_broadcasts_and_lifecycle.sql` com `REVOKE EXECUTE FROM PUBLIC, anon`, guarda explícita `auth.uid() IS NOT NULL`, `FORCE ROW LEVEL SECURITY` em 5 tabelas e restrição de leitura direta da tabela de broadcasts a administradores. |
| **W1-02** | Supabase SQL | `admin_send_broadcast_notification` não recebia `p_expires_at` nem validava protocolo de `p_action_url`; `handle_new_user()` referenciava coluna legada; `reconcile_expired_subscriptions()` bloqueava `postgres`/`supabase_admin` em execuções via `pg_cron`. | Adicionado parâmetro `p_expires_at` e validação de `p_action_url` (`/` sem `//` ou `https://`), corrigido `handle_new_user()` para `custom_settings` e liberada execução para `postgres`/`supabase_admin`. |
| **W1-03** | RPC Client (`src/data/rpc/admin.ts`) | `unwrapRpc` lançava erro falso em RPCs `VOID` (`mark_broadcast_as_read`, `dismiss_broadcast_notification`) por retornarem `null`. | Passado `allowNull = true` (`unwrapRpc<null>(..., true)`) e adicionados handlers `onError` com feedback em `use-admin-mutations.ts`. |
| **W1-04** | Edge Functions (`_shared/resend.ts`, `email-templates.ts`) | Condição de corrida `SELECT` + `INSERT` no log de e-mail; ausência de escape HTML/URL em templates; remetente padrão genérico. | Substituído por `.upsert(..., { onConflict: "dedup_key" })` + header `Idempotency-Key`; aplicados `escapeHtmlText` e `sanitizeSafeEmailUrl` em todos os 8 templates; remetente padrão `"Axir <noreply@axir.com.br>"`; zero emojis. |
| **W1-05** | `sunday-digest` & `billing-lifecycle-cron` | Sem paginação acima de 1.000 usuários; janela de 7 dias com 8 dias inclusivos; `report_weight` ignorado; avisos enviados a trials com plano agendado ou perfis suspensos. | Paginação em lotes de 250; janela exata de 7 dias (`[hoje-6d, hoje]`, piso de atrasados `-30d`); ponderação por `report_weight`; filtros `.eq("status", "trialing")`, `.is("scheduled_plan_id", null)` e `.eq("profiles.status", "active")`. |
| **W1-06** | `push-dispatcher` & `support-notify` | Push remoto disparado sem checar `profile.status === "active"` ou opt-in estrito; falha de OAuth FCM bloqueava Web Push; tokens mortos (`400 INVALID_ARGUMENT`) não desativados; comparação de segredo não constante. | Verificação de perfil ativo, opt-in estrito `remotePushEnabled === true` (exceto `test_push`/`P0`), OAuth FCM isolado sob demanda, canal Android `"due_reminders"`, limpeza de tokens inválidos e `timingSafeEqualString` no `support-notify`. |
| **W1-07** | Logout & Troca de Conta (`use-sign-out.ts`, `providers.tsx`) | `signOut({ scope: "others" })` apagava estado local da sessão atual; logout não desinscrevia endpoint Web Push nem limpava notificações locais/monitoramento bancário em `SIGNED_OUT` externo. | Isolamento completo de `scope: "others"`; desinscrição do endpoint atual no navegador/banco (`deactivatePushSubscriptionByEndpoint`), cancelamento de notificações locais e limpeza de pacotes bancários antes do reset de sessão. |

### 2.2 Wave 2 — Motor do Notification Hub, Paridade de Superfícies e Cooldowns Multi-Dispositivo

| ID | Camada | Achado da Auditoria | Correção Implementada |
|---|---|---|---|
| **W2-01** | `build-notification-center.ts` | `extractReminderEntityRefs` incluía `card:${cardId}`, fazendo a 1ª fatura aberta suprimir a 2ª fatura aberta do mesmo cartão; `due_today`, `household:ceiling_exceeded` e `dup:*` inflavam `P0_CRITICAL`. | Removido `card:${cardId}` de `entityRefs` (usando `activeBillCardIds` separado apenas para suprimir insights redundantes do Advisor); recalibrados `due_today`, `household:ceiling_exceeded` e `dup:*` para `P1_ACTION_NEEDED`, convites/viagens passivas para `P2_ADVISORY` e `promotion` para `P3_OPPORTUNITY`. |
| **W2-02** | Sininho, Popover, Sidebar e `/lembretes` | Contagens divergentes entre Sininho, Popover e Sidebar; comunicados sem `action_url` sumiam ao expandir; ausência de Undo ao adiar/arquivar. | Unificadas todas as superfícies em `totalBellCount`, `totalRemindersPageCount`, `criticalCount` e `actionNeededCount` do Hub; ordenação `P0 -> P1 -> P2/P3`; botão explícito de marcar como lido em comunicados sem link; Toast Undo de 5s. |
| **W2-03** | Agendamento Web/Android (`schedule.ts`, `local-notifications.ts`) | Web ignorava Horário Silencioso e usava horizonte fixo de 7d em vez das preferências `billDaysBefore`/`debtDaysBefore`; `ACTION_SNOOZE` tinha o agendamento futuro cancelado pelo próximo `syncDueReminderNotifications`. | `buildDueNotificationSchedule` retorna `[]` na Web durante `quietHours`; `RemindersNotificationSyncInner` usa `scheduledPayableItems` apenas no nativo; criado registro `KEY_SNOOZED_DUE_NOTIFS` (`preserveSnoozed: true`) preservando lembretes adiados por 3 dias. |
| **W2-04** | Dedup de Rachas & Cooldowns (`reminders/index.ts`, `overview-page.tsx`) | Dívidas parceladas de racha sem prefixo na 2ª parcela escapavam da deduplicação; dispensar `SurplusAporteBanner` fazia `aporte:rebalance` surgir imediatamente (*whack-a-mole*); chaves de dispensa no `localStorage` sem escopo por `userId`. | `isDebtLinkedToSplit` resolve `installment_group_id` irmão via `allDebts` e regex de palavra inteira `racha`; `overview-page.tsx` mantém `aporte:rebalance`/`aporte:habit` suprimidos durante dispensa ativa do `SurplusAporteBanner`; chaves escopadas por `userId` e mescladas pelo maior `dismissedUntil`. |

### 2.3 Wave 3 — Conformidade UI/UX (`AGENTS.md`) e Estabilidade do Motor de Toasts

| ID | Camada | Achado da Auditoria | Correção Implementada |
|---|---|---|---|
| **W3-01** | Prominent Disclosure & Assistente Bancário | `passiveCaptureEnabled` iniciava `true` por padrão; banner de permissão na Home chamava `requestNotificationListener()` direto sem exibir o *Prominent Disclosure* e mesmo com `monitoredBanks: []`. | `DEFAULT_BANK_ASSISTANT_PREFERENCES.passiveCaptureEnabled = false` (opt-in); `isBankListenerMissing` exige `monitoredBanks.length > 0`; clique no banner da Home navega para `/configuracoes?tab=notifications`. |
| **W3-02** | Carrosséis da Home e Investimentos (Regras 13 e 19) | `SmartAdvisorCard` embutido no carrossel usava layout vertical com botão `size="xs"`; `PortfolioInsightsCarousel` não limitava `maxItems={5}`; `TrialEndingBanner` aplicava `line-clamp` em container flex; slides informativos usavam `role="alert"`. | Layout horizontal Nível 2 (`size-9 rounded-xl border`) no `SmartAdvisorCard` (`embeddedInCarousel`), botões `size="sm"` (`h-8`), `CarouselDismissPopover` (7d/30d) com área de toque expandida no mobile, `maxItems={5}` na Carteira e `role="region"` em slides não críticos. |
| **W3-03** | Tipografia Monetária, Percentuais, Badges e Modais (Regras 11, 15, 18, 23, 28) | Parágrafos com `<MoneyText />` tinham classe `truncate`; `build-structural-risk-items.tsx` usava `.toFixed(1)` com ponto; `ProminentDisclosureModal` usava rodapé manual; `RemindersSettingsModal` usava `size="md"`. | Removido `truncate` sobre `<MoneyText />` em 5 banners; adotado `formatPercent` (vírgula pt-BR); adicionado `max-w-full truncate` ao primitivo `<Badge />`; adotado `<ModalFooter borderless>` e `size="lg"`. |
| **W3-04** | Motor de Toasts & Undo de 5s (Regra 32) | `ToastHostItem` recebia função inline `onDismiss={() => handleDismiss(item.id)}`, reiniciando o timer a cada re-render; `pushToast` com `action` sem `duration` explícito fechava em 3000ms. | `handleDismiss` estabilizado com `useCallback`; `pushToast` aplica `duration: 5000` automaticamente sempre que `request.action` está presente; `confirmIncome` padronizado com `variant: "success"` e `duration: 5000`. |

### 2.4 Wave 4 — Painel Admin Broadcasts, Copy Pt-BR, Rollout e Verificação

| ID | Camada | Achado da Auditoria | Correção Implementada |
|---|---|---|---|
| **W4-01** | Admin Broadcasts (`BroadcastComposerForm`, `BroadcastHistoryList`) | Formulário admin não expunha seletor de expiração (`expires_at`), não validava `actionUrl`, não pedia confirmação antes do disparo em massa e o preview era estático. | Adicionado seletor `<Select>` de validade (`Sem expiração`, `7d`, `14d`, `30d`), validação de URL (`/` sem `//` ou `https://`), `<ConfirmDialog>` com resumo pré-envio, `try/catch` preservando preenchimento, preview dinâmico por categoria e badge de expiração/público no histórico. |
| **W4-02** | Harmonização Textual Pt-BR | Erro gramatical `"Toda domingo"` em `extended-periodicity.ts`; títulos excessivamente técnicos em `CashGapAlert`, `PortfolioGovernanceBanner` e `QualifiedDismissPopover`. | Corrigido para `"Todo domingo"`, `"Atenção: saldo pode ficar negativo"` / `"Fluxo de caixa apertado"`, `"passou do prazo de revisão da sua carteira"` e microcopy claro sem jargão de motor. |

---

## 3. Verificação e Homologação em Produção

1. **Banco de Dados Remoto (`lnsfcajcfofgvpvabwbi`):**
   - Migration `20260101000138_harden_notifications_broadcasts_and_lifecycle.sql` aplicada via `supabase db push` e confirmada em `supabase migration list` (`0001` a `0138` sincronizadas local/remoto).
2. **Edge Functions (9 funções ativas com `--no-verify-jwt --use-api`):**
   - `asaas-checkout`, `asaas-manage`, `asaas-webhook`, `support-notify`, `quotes`, `billing-lifecycle-cron`, `push-dispatcher`, `sunday-digest`, `admin-super-action`.
   - Smoke tests HTTP ao vivo confirmaram bloqueio `401` sem credenciais, bloqueio `401`/`403` para chamadas `anon` à RPC `get_my_broadcast_notifications` e respostas `200`/`400` autenticadas via `CRON_SECRET`.
3. **Suíte Automatizada & Build Mobile:**
   - `npm run typecheck` (`tsc -b`): 0 erros.
   - `npm run lint` (`eslint .` incluindo `local/no-decorative-unicode`): 0 erros.
   - Suítes unitárias, de componentes e de domínio (Vitest) + E2E (Playwright) + compilação do APK Android v3.16.0 (Build 103) concluídas com sucesso.
