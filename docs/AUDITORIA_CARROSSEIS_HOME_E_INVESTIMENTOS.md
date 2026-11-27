# Auditoria Arquitetural, Funcional e de UX — Carrosséis da Home e de Investimentos

> **Data:** 2026-11-27  
> **Papel do Documento:** Diagnóstico arquitetural e inventário inicial (referência histórica).  
> **Fonte Única de Verdade para Execução:** [`docs/plans/PLANO_MESTRE_CARROSSEIS_HOLISTICOS.md`](plans/PLANO_MESTRE_CARROSSEIS_HOLISTICOS.md).  
> **Nota de Precedência:** As seções §6, §7.1 (#6 quarentena), §7.2 e §9 deste documento foram refinadas e substituídas pelo Plano Mestre após verificação linha a linha no código-fonte (ex.: adoção de `src/domain/notifications/hub/` em vez de `src/domain/carousel/`, evolução in-place de `src/components/modules/`, remoção de clones do DOM, não uso de `updated_at/created_at` como data de quarentena e corte em Onda 1 + Onda 2). **Nunca executar a partir das §§6 e 9 abaixo; seguir exclusivamente o Plano Mestre.**
> **Escopo Auditado:** Carrossel da Visão Geral (`OverviewPage`), Carrossel de Investimentos (`InvestmentsPage`), sistema de dispensa temporária (`7d` / `1 mês` / `6 meses`), regras de truncamento, padronização de componentes e ponte bidirecional entre Home e Investimentos.

---

## 1. Sumário Executivo

A auditoria completa do código-fonte revelou que, embora a Home e a tela de Investimentos compartilhem o mesmo container visual (`DashboardAlertsCarousel`), **os dois ecossistemas evoluíram de forma desconectada** em quatro dimensões críticas:

1. **Fragmentação de Componentes (Violação DRY — `AGENTS.md §4`):** Investimentos possui um componente de slide reutilizável (`InsightSlide`), enquanto a Home replica manualmente a mesma casca JSX em **14 banners independentes** mais uma variante embutida do `SmartAdvisorCard`. Isso gerou divergências de espaçamento, hierarquia de headings (`h2`/`h3`/`h4`), alinhamento de botões e sobreposição no mobile.
2. **Truncamento Generalizado (Violação `AGENTS.md §4.23`):** 12 banners da Home e todos os 16 slides de Investimentos aplicam `truncate` em linha única nos títulos dividindo espaço com `<Badge>` e com o botão `X` absoluto no mobile, causando corte prematuro em telas `< 400px`. Além disso, `ActiveTripBanner` trunca metadados em 1 linha, e `title={description}` falha em mobile/touch e em descrições JSX (`ReactNode`).
3. **Múltiplos Bugs no Agendamento do "Dispensar" (7 dias / 1 mês):** O sistema atual possui **4 mecanismos paralelos e descoordenados** de persistência de dispensa (`dashboardAlertDismissals`, `portfolioAlertDismissals`, `advisorDismissals` + `advisorDecayMeta`, e flags booleanas soltas como `onboarding_dismissed` e `dismissedPermissionAlerts`). Essa fragmentação causa:
   - **Reaparição entre páginas:** dispensar Proventos ou Revisão de Teses na Home não dispensa em Investimentos (e vice-versa).
   - **Descompasso de prazo:** conflito entre a escolha explícita do usuário (`7d`/`30d`) e `advanceSmartDecay` (`7d -> 30d -> 90d`), furos silenciosos de cooldown (`shouldShowPaceAlert`, `shouldShowGoalAlert`), rótulo "Lembrar no próximo mês" calculado como `+30 dias corridos`, `mutate()` chamado dentro de `setState` em Investimentos, e `onMutate` sem atualização otimista quando `user_preferences` ainda é `null`.
   - **Ausência de opção de 6 meses (`180d`)** para alertas estruturais, de governança de longo prazo e convites recorrentes.
4. **Ponte Subaproveitada entre Home e Investimentos:** Hoje a ponte é unilateral, parcial e com bugs (ex.: rota legada `/investments?tab=metas` e texto duplicado em `PortfolioGovernanceBanner`). Sinais críticos de caixa da Home (Sobra de Aporte, Furo de Caixa) não chegam a Investimentos, e sinais patrimoniais relevantes (Caixa Ocioso, Risco Estrutural Crítico, Oportunidades em Desconto) ficam isolados em Investimentos.

---

## 2. Inventário Completo dos Carrosséis no App

### 2.1 Visão Geral dos Carrosséis Existentes

| Carrossel | Localização | Engine | `maxItems` Atual | Propósito |
|---|---|---|---|---|
| **Carrossel da Home** | `src/features/overview/components/overview-dashboard-content.tsx:138` | `DashboardAlertsCarousel` + `useAlertsCarousel` | `2` (ou `1` em modo crítico via `applyHomeCarouselAttentionBudget`) | Alertas contextuais, financeiros, metas, ponte patrimonial e sugestões do SmartAdvisor |
| **Carrossel de Investimentos** | `src/features/investments/components/portfolio-insights-carousel.tsx:282` | `DashboardAlertsCarousel` + `useAlertsCarousel` | `5` (sem Attention Budget) | Riscos estruturais, proventos, governança de teses, desvio de alocação e caixa ocioso |
| *Carteira de Cartões* *(fora do escopo de alertas)* | `src/components/modules/credit-card-wallet.tsx` | `useCardCarousel` | N/A | Navegação visual entre cartões de crédito |
| *Snapshots Mensais* *(fora do escopo de alertas)* | `src/features/investments/components/portfolio-snapshots-carousel.tsx` | Próprio | N/A | Cards históricos de snapshots mensais da carteira |

> **Incongruência de Governança:** `AGENTS.md §4.35` especifica `maxItems={5}` para `DashboardAlertsCarousel`, mas `OverviewDashboardContent` passa `maxItems={2}` e `applyHomeCarouselAttentionBudget` reduz ainda mais para `1` quando qualquer item tem `priority <= 1`. Já `PortfolioInsightsCarousel` usa `maxItems={5}`.

---

### 2.2 Inventário Completo — Cards do Carrossel da Home (`buildOverviewAlertItems`)

Fonte: `src/features/overview/components/build-overview-alerts.tsx`.

| # | ID do Slide | Componente / Arquivo | Prio | Objetivo Real | CTA Principal | Dispensa Atual | Persistência | Problemas / Incongruências |
|---|---|---|---|---|---|---|---|---|
| 1 | `subscription-past-due` | `SubscriptionPastDueBanner` (`src/components/modules/subscription/subscription-past-due-banner.tsx`) | `0` | Regularizar cobrança vencida/inadimplente | Regularizar assinatura | Não dispensável (P0) | N/A | OK no objetivo e `line-clamp-2` no título. Não usa componente base compartilhado. |
| 2 | `permissions-alert` | `PermissionsAlertBanner` (`src/components/modules/permissions-alert-banner.tsx`) | `1` | Reativar permissão Android (push ou listener bancário) | Configurar / Permitir | Botão `X` simples (**permanente**) | `deviceNotifications.dismissedPermissionAlerts` (boolean) + localStorage | **Fura padrão:** não usa `CarouselDismissPopover`; dispensa permanente sem reavaliação (ideal: `7d` / `30d` / `6 meses`). Título com `truncate`. Por ter `priority: 1`, ativa modo focado (esconde todos os outros cards da Home!). |
| 3 | `household-ceiling-exceeded` | `HouseholdAlertBanner` (`variant="ceiling_exceeded"`, `src/features/overview/components/household-alert-banner.tsx`) | `1` | Alertar estouro do teto familiar mensal | Ver família | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["household-ceiling-exceeded"]` | Título com `truncate`. Ativa modo focado (`priority: 1`). |
| 4 | `cash-gap-alert` | `CashGapAlert` (`src/components/modules/cash-gap-alert.tsx`) | `1` (crítico) / `2` | Alertar risco de furo de caixa nos próximos dias | Ver projeção + `CalculationMemoryModal` | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["cash-gap-alert"]` + `advanceDecayFamily("cash_gap")` | Título com `truncate`. Grava `advisorDecayMeta.cash_gap`, mas só lê `muted` (desconexão). **Alto valor como ponte para Investimentos.** |
| 5 | `onboarding-progress-banner` | `OnboardingCarouselBanner` (`src/components/modules/onboarding-carousel-banner.tsx`) | `2` | Retomar checklist inicial de configuração | Continuar configuração | Botão `X` simples (**365d + permanente local**) | `localStorage("financas:onboarding_dismissed")` + `cards["onboarding-progress-banner"]` (365d) | **Fura padrão:** não usa `CarouselDismissPopover`; `dismissOnboarding` faz spread da nuvem sem atualizar `localDismissalsOverride`. Título com `truncate`. Ideal oferecer `7d` / `30d` / `6 meses` (ou ocultar definitivo). |
| 6 | `active-trip-${trip.id}` | `ActiveTripBanner` (`src/features/trips/components/active-trip-banner.tsx`) | `2` | Atalho rápido para viagem em andamento | Acessar Viagem (`/viagens/:id`) | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["active-trip-${id}"]` | **Truncamento severo:** título com `truncate` + descrição em `flex` de 1 linha com `truncate` (não usa `line-clamp-2`). |
| 7 | `household-settlement-pending` | `HouseholdAlertBanner` (`variant="settlement_pending"`) | `2` | Lembrar acerto financeiro pendente da casa | Ver acerto | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["household-settlement-pending"]` | Título com `truncate`. Cumpre bem o objetivo. |
| 8 | `split-pending-banner` | `SplitPendingBanner` (`src/features/overview/components/split-pending-banner.tsx`) | `2` | Cobrar/acompanhar rachas a receber pendentes | Ver rachas | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["split-pending-banner"]` | Único banner além de Trial/PastDue sem `truncate` no título, mas sem `line-clamp-2`. Suprimido corretamente se há `PendingSplitSignalsCard`. |
| 9 | `pace-alert-banner` | `PaceAlertBanner` (`src/components/modules/pace-alert-banner.tsx`) | `2` (déficit) / `3` | Alertar ritmo de gastos acima do tempo decorrido | Ver projeção + `CalculationMemoryModal` | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.pace` + `advanceDecayFamily("pace")` | **Bug de furo de cooldown:** oscilação de `surplus >= 0` para `< 0` ignora `dismissedUntil` e reexibe no mesmo dia. Título com `truncate`. |
| 10 | `goal-progress-${share.id}` | `GoalProgressAlertBanner` (`src/features/overview/components/goal-progress-alert-banner.tsx`) | `3` | Celebrar meta batida (100%), reta final (>=80%) ou sugerir aporte com sobra | Depositar / Ver meta | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.goals[share.id]` | **Bug:** `handleDismissGoal` não persiste `status` no checkpoint; título com `truncate`; metas em estágio regular deveriam suportar `6 meses`. |
| 11 | `surplus-aporte-banner` | `SurplusAporteBanner` (`src/components/modules/surplus-aporte-banner.tsx`) | `4` | Indicar sobra real no ciclo para reserva ou aporte | Ver Reserva / Simular Aporte + `CalculationMemoryModal` | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.surplus` + `advanceDecayFamily("surplus")` | Título longo (`"Reforçar Reserva de Emergência"` / `"Capacidade de Aporte Estimada"`) com `truncate`. **Principal candidato a ponte bidirecional com Investimentos.** |
| 12 | `corporate-dividends-alert` | `CorporateDividendsBanner` (`src/features/overview/components/corporate-dividends-banner.tsx`) | `2` (disp.) / `3` (prov.) | Avisar proventos disponíveis para aprovar ou provisionados | Conferir (`openDividendReviewModal`) | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.cards["corporate-dividends-alert"]` | **Incongruência crítica:** chave de dispensa totalmente desconectada de Investimentos (`available-dividends-alert` / `projected-dividends-alert`). Casca sem `flex-1` e com `items-center` divergente. Título com `truncate`. |
| 13 | `portfolio-governance-review-alert` | `PortfolioGovernanceBanner` (`src/features/overview/components/portfolio-governance-banner.tsx`) | `3` | Avisar ativos com prazo de revisão de tese vencido | Revisar Teses (`/investments?tab=metas`) | `CarouselDismissPopover` (`7d` / `30d`) | `dashboardAlertDismissals.governance` | **3 bugs:** (1) chave de dispensa desconectada de `overdue-reviews-alert` em Investimentos; (2) rota legada `?tab=metas`; (3) **erro de texto:** `"passou do prazo de revisão da sua carteira"` repete `"da sua carteira"` duas vezes! Título com `truncate`. |
| 14 | `jit-device-alerts-invite` | `DeviceAlertsInviteBanner` (`src/features/overview/components/device-alerts-invite-banner.tsx`) | `5` | Convidar usuário a ativar lembretes de vencimento no dispositivo | Configurar alertas | Botão `X` simples (**hardcoded 30d**) | `dashboardAlertDismissals.cards["jit-device-alerts-invite"]` | **Fura padrão:** não usa `CarouselDismissPopover`; não oferece `6 meses` (ideal para convites). Título com `truncate`. |
| 15 | `trial-ending-banner` | `TrialEndingBanner` (`src/components/modules/subscription/trial-ending-banner.tsx`) | `2` (<=7d) / `4` | Avisar término do período de teste | Ver planos | `CarouselDismissPopover` (`7d` / `30d`) quando `> 3d`; bloqueado `<= 3d` | `dashboardAlertDismissals.cards["trial-ending"]` | Correto na regra de `<= 3d` e `line-clamp-2` no título. Não usa componente base compartilhado. |
| 16 | `smart-advisor-${insight.id}` | `SmartAdvisorCard` (`embeddedInCarousel`, `src/features/overview/components/smart-advisor/smart-advisor-card.tsx`) | `3.2` / `3.6` / `4.2` | Insights proativos (assinaturas, hábitos, recorrências, receitas/despesas a confirmar, cobranças no cartão) | Variável por insight + `CalculationMemoryModal` | `CarouselDismissPopover` (`7d` / `30d`) OU botão "Manter como essencial" | `advisorDismissals[themeKey]` + `advisorDecayMeta[family]` + `advisorLastDismissedDay` | **Conflito de dispensa:** `advanceSmartDecay` pode silenciar família por 30d/90d mesmo quando usuário pede 7d; botão "Dispensar" no footer pula popover; `isTopSavingsEssential` remove o popover; título com `truncate`. |

> **Banners Operacionais FORA do Carrossel da Home (apenas contexto):** `AutoRegisteredBanner`, `PendingSplitSignalsCard`, `PendingSuggestionsCard`, `DashboardPixClipboardCard` (controlados por `selectOperationalHomeBanner`, limite 1) e `ReadOnlyBanner` (modo leitura de assinatura). Estes **não devem** entrar no carrossel porque são filas operacionais imediatas ou estados globais da conta.

---

### 2.3 Inventário Completo — Slides do Carrossel de Investimentos (`PortfolioInsightsCarousel`)

Fonte: `src/features/investments/components/portfolio-insights-carousel.tsx` e `src/features/investments/components/insights-carousel/*`. Todos renderizam via `InsightSlide` (`insight-slide.tsx`) e persistem via `usePortfolioAlertDismissals` (`portfolioAlertDismissals`).

| # | ID do Slide | Builder / Origem | Prio | Objetivo Real | CTA Principal | Dispensa Atual | Problemas / Incongruências |
|---|---|---|---|---|---|---|---|---|
| 1 | `available-dividends-alert` | `build-dividend-insight-items.tsx` | `1` | Confirmar proventos já pagos no Caixa/Extrato | Ver detalhes + Aprovar no Caixa / Conferir e Aprovar | `7d` / `30d` | **Desconectado da Home** (`corporate-dividends-alert`). `InsightSlide` usa `truncate` no título e `title={undefined}` porque descrição é JSX. |
| 2 | `projected-dividends-alert` | `build-dividend-insight-items.tsx` | `2` | Mostrar proventos anunciados previstos no mês | Ver projeção (`openDividendReviewModal`) | `7d` / `30d` | **Desconectado da Home.** Descrição JSX sem tooltip; título com `truncate`. |
| 3 | `overdue-reviews-alert` | `build-governance-insight-items.tsx` | `3` | Reavaliar teses com prazo vencido | Confirmar nota (1 ativo) + Reavaliar Agora (abre fila) | `7d` / `30d` | **Desconectado da Home** (`portfolio-governance-review-alert`). `overdueFp` calculado mas ignorado pelo hook! |
| 4 | `upcoming-reviews-alert` | `build-governance-insight-items.tsx` | `4` | Antecipar revisão de ativos próximos do vencimento | Antecipar Revisão (abre fila) | `7d` / `30d` | `upcomingFp` calculado mas ignorado. Bom objetivo, mas concorre por 5 slots com itens mais críticos. |
| 5 | `allocation-drift-alert` | `build-allocation-insight-items.tsx` | `5` | Sinalizar classes fora da meta de alocação | Simular Rebalanceamento (`?tab=rebalancear&view=simulador`) | `7d` / `30d` | `driftFingerprint` ignorado. Descrição pode ser longa e truncar sem fallback touch. |
| 6 | `unscored-assets-alert` | `build-governance-insight-items.tsx` | `6` | Definir nota de convicção de ativos novos | Avaliar Agora (abre fila) | `7d` / `30d` | Deveria suportar **`6 meses`** (usuário pode manter ativo sem nota de propósito, ex.: reserva/caixa). |
| 7 | `invalid-targets-sum-alert` | `build-allocation-insight-items.tsx` | `7` | Corrigir soma das metas de classe != 100% | Ajustar Metas (`?tab=rebalancear&view=metas`) | `7d` / `30d` | Título longo (`"Soma das Metas Diferente de 100%"`) truncado no mobile! |
| 8 | `low-score-risk-alert` | `build-governance-risk-items.tsx` | `8` | Alertar exposição > 5% em ativos com nota <= 4 | Auditar Carteira (`?tab=rebalancear&view=metas&subtab=assets`) | `7d` / `30d` | Título longo (`"Concentração em Baixa Convicção"`) truncado no mobile. Deveria suportar **`6 meses`**. |
| 9 | `quarantine-governance-alert` | `build-governance-risk-items.tsx` | `9` | Lembrar ativos em quarentena com aporte bloqueado | Auditar Carteira | `7d` / `30d` | Deveria suportar **`6 meses`** (quarentena costuma durar trimestres). |
| 10 | `discount-opportunity-alert` | `build-governance-risk-items.tsx` | `10` | Destacar ativos nota >= 8 abaixo do Preço Teto | Simular Aporte (`?tab=rebalancear&view=simulador`) | `7d` / `30d` | **Excelente candidato a ponte com a Home** quando há sobra mensal (`surplusCapacity.hasSurplus`). |
| 11 | `idle-cash-alert` | `build-allocation-insight-items.tsx` | `11` | Avisar caixa parado >= R$ 100 na corretora | Simular Aporte (`?tab=rebalancear&view=simulador&usarCaixa=1`) | `7d` / `30d` | **Excelente candidato a ponte com a Home** (complementar à sobra do mês). |
| 12 | `single_asset_concentration` | `build-structural-risk-items.tsx` | Dinâmica (`evaluatePortfolioStructuralRisk`) | Risco de concentração excessiva em 1 ativo | Ver Detalhes / Simular Aporte | `7d` / `30d` | **Deve suportar `6 meses`** (investidor pode ter posição concentrada intencional). Se crítico, candidato a ponte na Home. |
| 13 | `private_issuer_fgc` | `build-structural-risk-items.tsx` | Dinâmica | Risco de emissor privado / teto FGC em RF | Ver Carteira (`?tab=posicao`) | `7d` / `30d` | **Deve suportar `6 meses`**. Se ultrapassar FGC (`exceedsFgc`), forte candidato a ponte na Home. |
| 14 | `macro_sector_concentration` | `build-structural-risk-items.tsx` | Dinâmica | Concentração em macro-setor de Ações | Simular Aporte | `7d` / `30d` | **Deve suportar `6 meses`**. |
| 15 | `low_diversification_nef` | `build-structural-risk-items.tsx` | Dinâmica | Baixa diversificação efetiva (`Nef`) na classe | Simular Aporte | `7d` / `30d` | **Deve suportar `6 meses`**. Badge `Nef = X` é jargão técnico sem explicação direta no card. |
| 16 | `benchmark_overlap` | `build-structural-risk-items.tsx` | Dinâmica | Sobreposição de ETFs do mesmo índice | Ver Carteira | `7d` / `30d` | **Deve suportar `6 meses`** (decisão estrutural de longo prazo). |

---

## 3. Diagnóstico Forense: Por que o "Dispensar" Não Agenda Corretamente?

A investigação linha a linha de todos os hooks, domínio e repositório identificou **8 causas raiz concretas** que explicam o comportamento errático relatado:

### Causa 1 — Desconexão Total de Chaves entre Home e Investimentos
Os mesmos eventos de domínio possuem **chaves e stores diferentes** dependendo da página onde o usuário clicou em dispensar:
- **Proventos:** na Home grava em `custom_settings.dashboardAlertDismissals.cards["corporate-dividends-alert"]`; em Investimentos lê/grava em `custom_settings.portfolioAlertDismissals["available-dividends-alert"]` e `["projected-dividends-alert"]`.
- **Revisão de Teses:** na Home grava em `custom_settings.dashboardAlertDismissals.governance`; em Investimentos lê/grava em `custom_settings.portfolioAlertDismissals["overdue-reviews-alert"]`.
- **Impacto:** o usuário dispensa por 30 dias na Home, navega para Investimentos e o mesmo aviso reaparece imediatamente (ou vice-versa), passando a impressão clara de que o agendamento falhou.

### Causa 2 — Furo Silencioso de Cooldown Antes do Prazo Escolhido
Em `src/domain/overview/alert-dismissals.ts`, duas funções verificam condições de variação **antes** de respeitar `checkpoint.dismissedUntil`:
- **`shouldShowPaceAlert` (linhas 150–155):** se `checkpoint.surplusCents >= 0` no momento do descarte e no mesmo dia um lançamento pequeno faz `current.surplusCents < 0`, a função retorna `true` **ignorando o `dismissedUntil` de 7 ou 30 dias**.
- **`shouldShowGoalAlert` (linhas 62–84):** mudanças de estágio (`final_stretch`, `completed`) furam o cooldown antes de checar `dismissedUntil`. Além disso, `handleDismissGoal` (`use-overview-modals.ts:149`) não inclui `status` no checkpoint, criando risco de divergência caso `status` passe a ser preenchido na leitura.
- **Impacto:** o card volta horas depois de o usuário escolher "Dispensar por 7 dias" ou "Lembrar no próximo mês".

### Causa 3 — Rótulo "Lembrar no próximo mês" vs. Cálculo `+30 dias corridos`
Em `src/components/modules/carousel-dismiss-popover.tsx:74`, a segunda opção exibe **"Lembrar no próximo mês"**, mas todos os consumidores (`createTimedDismissalCheckpoint`, `createPaceDismissalCheckpoint`, `createSurplusDismissalCheckpoint`, `usePortfolioAlertDismissals`, `useSmartAdvisorDismissals`) somam literalmente `30 * 24 * 60 * 60 * 1000` ms.
- Se o usuário clica em "Lembrar no próximo mês" no dia 28 de um mês, ele espera ver o card na virada do mês (ou após 1 mês exato de calendário), mas em meses de 31 dias ou fevereiro o comportamento é inconsistente com o rótulo.
- **Decisão necessária:** padronizar explicitamente as opções com rótulos inequívocos (ex.: **"7 dias"**, **"1 mês (30 dias)"** ou **"Próximo mês (dia 1º)"**, e **"6 meses"**), exibindo a data exata de retorno no subtítulo ou toast (ex.: *"Oculto até 27/12"*).

### Causa 4 — Conflito entre Prazo Escolhido e `advanceSmartDecay` no `SmartAdvisorCard`
Em `src/features/overview/hooks/use-smart-advisor-dismissals.ts:322-353`:
- Quando o usuário escolhe **7 dias** no `CarouselDismissPopover` de um card do `SmartAdvisor`, o hook grava `advisorDismissals[themeKey] = now + 7d`, **mas também executa `advanceSmartDecay(family)`**.
- Na 2ª dispensa da família, `advanceSmartDecay` fixa `dismissedUntil = now + 30d`; na 3ª, `now + 90d`. Como `filterAndRankAllAdvisorInsights` bloqueia via `isFamilyUnderDecay(familyRecord, nowMs)`, **a escolha explícita de 7 dias do usuário é silenciosamente sobrescrita por 30 ou 90 dias** (e bloqueia outros insights da mesma família).
- Complementarmente, no `SmartAdvisorCardFooter` há botão `Dispensar` direto que chama `onDismiss()` sem passar `days` (aplicando 30d fixos), e quando `isTopSavingsEssential === true`, o `CarouselDismissPopover` some completamente.

### Causa 5 — Anti-Pattern de `mutate()` Dentro de `setState`, Chave `anon` e Merge por `max(dismissedUntil)` em Investimentos
Em `src/hooks/use-portfolio-alert-dismissals.ts`:
1. **Linhas 103–114:** `updateCustomSettingsMutation.mutate({ portfolioAlertDismissals: next })` é disparado **dentro do callback de `setLocalState((prevState) => ...)`**. Em React StrictMode/Concurrent rendering, updaters funcionais devem ser puros e podem rodar 2x, gerando chamadas duplicadas e race conditions na fila de escrita.
2. **Linha 59:** usa `const userId = auth?.user?.id ?? "anon"`, enquanto a Home e `useUserPreferences` usam `getActiveUserId()`. Durante hidratação inicial, o cache local pode ler/gravar em `axir_portfolio_alert_dismissals:anon` em vez do `userId` real.
3. **Linha 44:** `mergePortfolioDismissalsByLatestExpiry` escolhe `l.dismissedUntil >= c.dismissedUntil ? l : c` em vez de comparar `dismissedAt` (timestamp da ação). Isso impede sobrescrever um prazo maior por um menor ou revogar uma dispensa.
4. **Linha 121 (`isAlertDismissed`):** recebe `currentFingerprint` de todos os builders (`overdueFp`, `driftFingerprint`, `cashFp`), mas faz `void currentFingerprint;`, descartando completamente a detecção de mudança relevante.

### Causa 6 — `onMutate` de `useUpdateCustomSettings` Ignora Cache Quando `previous === null`
Em `src/state/mutations/use-preference-mutations.ts:91-138`:
```ts
const previous = queryClient.getQueryData<UserPreferences | null>(targetKey);
if (previous) {
  queryClient.setQueryData(...);
}
```
Quando o usuário ainda não tem registro em `user_preferences` (ou antes da primeira carga completar), `previous` é `null`. O update otimista não escreve no cache do TanStack Query, e `onSettled` dispara `invalidateQueries` — gerando janela de inconsistência onde o estado da nuvem ainda não reflete a dispensa.

### Causa 7 — Cards que Contornam o `CarouselDismissPopover` e o Store de Dispensas
- **`OnboardingCarouselBanner` (`use-overview-data.ts:134-148`):** dispensa por **365 dias** na nuvem + `localStorage` booleano permanente sem oferecer `7d`/`30d`/`6 meses`, e faz `updateCustomSettingsMutation.mutate` direto sem passar por `updateAlertDismissals` (não atualizando `localDismissalsOverride`).
- **`DeviceAlertsInviteBanner` (`build-overview-alerts.tsx:375`):** dispensa com botão `X` simples hardcoded em **30 dias**, sem popover.
- **`PermissionsAlertBanner` (`use-overview-alerts.ts:216-238`):** dispensa com botão `X` simples **permanentemente** (`boolean: true`), sem data de expiração.

### Causa 8 — Autoplay Rotaciona Enquanto o Popover de Dispensa Está Aberto
O `CarouselDismissPopover` renderiza o menu em um **Radix Portal** (`document.body`), fora da árvore DOM da `<section>` do `DashboardAlertsCarousel`. Ao mover o ponteiro para o popover (desktop) ou após tocar no `X` (mobile, onde `onTouchEnd` faz `setIsPaused(false)`), o carrossel pode disparar o `setInterval` de 8s e girar para o próximo slide enquanto o usuário está escolhendo a duração da dispensa.

---

## 4. Auditoria de Truncamento, Layout e Comportamento do Carrossel

### 4.1 Problemas de Truncamento Identificados

| Origem | Padrão Atual (Problemático) | Consequência em Telas Estreitas (`360px–390px`) |
|---|---|---|
| **12 banners da Home** (`Pace`, `CashGap`, `Surplus`, `Household`, `GoalProgress`, `Onboarding`, `ActiveTrip`, `CorporateDividends`, `PortfolioGovernance`, `DeviceAlertsInvite`, `Permissions`, `SmartAdvisor` embedded) | `<h2 className="... truncate">` na mesma linha flex do `<Badge>` com `pr-6` reservado para `X` absoluto (`size-7` + `right-3` = `40px`) | Títulos médios/longos cortam com `...` (`"Capacidade de Aporte..."`, `"Revisão de Teses de..."`); `pr-6` (`24px`) é menor que os `40px` ocupados pelo botão `X`, podendo encostar no badge/título. |
| **Todos os 16 slides de Investimentos (`InsightSlide`)** | `<h4 className="... truncate min-w-0">` + `<p className="line-clamp-2" title={typeof description === "string" ? description : undefined}>` | Títulos como `"Concentração em Baixa Convicção"` e `"Soma das Metas Diferente de 100%"` truncam. Descrições com `<MoneyText />` (JSX) ficam sem `title`, e em mobile `title` nativo não abre. |
| **`ActiveTripBanner`** | Descrição usa `<div className="flex ..."><span className="truncate">` em vez de `<p className="line-clamp-2 break-words">` | Destino e total gasto competem em 1 linha única e truncam prematuramente. |
| **Descrições longas com `line-clamp-2`** | Textos de 130–180 caracteres em 2 linhas no mobile | Valores ou justificativas no final da 2ª linha somem atrás de `...` sem forma de ler o restante no toque. |

### 4.2 Problemas Estruturais do `DashboardAlertsCarousel`

1. **Clones do Loop Infinito Duplicam Árvores React (`dashboard-alerts-carousel.tsx:46-51`):** `extendedItems` renderiza `firstClone` e `lastClone` com o mesmo `item.content`. Qualquer slide com estado interno (popover, modal de memória de cálculo, loading de mutação) existe duplicado no DOM.
2. **Skeleton Duplicado:** `PortfolioInsightsCarousel` (linhas 260–274) reescreve manualmente o mesmo skeleton que já existe em `DashboardAlertsCarousel` (linhas 61–75), em vez de delegar via props `isLoading` + `presenceHintKey="portfolio_insights"`.
3. **Altura Esticada por `items-stretch`:** Quando um slide possui 2 botões de ação no mobile (ex.: `available-dividends-alert` ou `overdue-reviews-alert`) e outro possui apenas 1, todos os slides herdam a altura do maior, aumentando desnecessariamente o footprint vertical.
4. **Inconsistência de Semântica HTML e Estilo:** Banners da Home alternam entre `bg-surface`, `bg-critical/5`, `bg-warning/5`, `bg-portfolio/5`, `bg-gradient-to-r`, `h2`/`h3`/`h4`, e `px/pr` diferentes, enquanto `InsightSlide` usa sempre superfície limpa `bg-surface border-border/80` com cor concentrada no ícone Nível 2 e no badge.
5. **Erro de Copy e Rota Legada:**
   - `PortfolioGovernanceBanner`: `"1 ativo da sua carteira passou do prazo de revisão da sua carteira."` (redundância).
   - `OverviewPage:195`: navega para `/investments?tab=metas` em vez da rota canônica `/investments?tab=rebalancear&view=metas&subtab=assets`.

---

## 5. Arquitetura de Ponte Bidirecional: Home <-> Investimentos

Para transformar os dois carrosséis em uma **ponte real de utilidades** (sem duplicar código nem gerar fadiga visual), cada card deve declarar explicitamente sua **superfície de origem**, se possui **projeção-ponte** na outra página, e qual a **chave canônica única** de dispensa.

### 5.1 Matriz de Distribuição e Ponte de Utilidades

| Domínio / Card | Chave Canônica Única | Home (`/`) | Investimentos (`/investments`) | Papel da Ponte / Interatividade |
|---|---|---|---|---|
| **Assinatura em Atraso** | `billing.past_due` | Sim (P0) | Não *(já tem `ReadOnlyBanner`)* | Fluxo de regularização global |
| **Fim do Trial** | `billing.trial_ending` | Sim (P1/P3) | Não | Evitar repetição em todas as telas |
| **Permissões Android** | `device.permissions` | Sim (P2*) | Não | *Rebaixar de P1 para P2 para não acionar modo focado e esconder alertas financeiros reais!* |
| **Convite de Alertas JIT** | `device.alerts_invite` | Sim (P4) | Não | Configuração inicial de notificações |
| **Onboarding Checklist** | `onboarding.progress` | Sim (P2) | Não | Acolhimento inicial |
| **Teto Familiar / Acerto Casa** | `household.ceiling` / `household.settlement` | Sim (P1/P2) | Não | Contexto doméstico mensal |
| **Viagem Ativa / Rachas** | `trip.active:${id}` / `split.pending` | Sim (P2) | Não | Contexto operacional do mês |
| **Ritmo de Gastos (`Pace`)** | `cashflow.pace` | Sim (P2/P3) | Não | Gestão de consumo mensal |
| **Furo de Caixa (`CashGap`)** | `cashflow.cash_gap` | **Sim (P1)** | **Sim — Ponte (P1, somente `critical`)** | **Nova Ponte Home -> Investimentos:** evita que o usuário aporte dinheiro na corretora quando há furo crítico de caixa previsto nos próximos dias. CTA: *"Ver Projeção de Caixa"* (`/insights?aba=projection`). |
| **Sobra / Capacidade de Aporte** | `cashflow.surplus_aporte` | **Sim (P3)** | **Sim — Ponte (P2, se `allocationIntent === "invest"`)** | **Nova Ponte Home -> Investimentos:** mostra na tela de Investimentos a sobra real do orçamento do mês pronta para aportar. CTA em Investimentos: *"Simular com Sobra"* (pré-preenche o simulador de aporte com o valor da sobra!). |
| **Proventos Disponíveis** | `portfolio.dividends_available` | **Sim — Ponte (P2)** | **Sim (P1)** | **Unificação:** mesmo card, mesmo modal (`openDividendReviewModal`) e **mesma chave de dispensa** nas duas telas. |
| **Proventos Provisionados** | `portfolio.dividends_projected` | **Sim — Ponte (P3)** | **Sim (P2)** | **Unificação:** mesmo card e mesma chave de dispensa; só aparece na Home se não houver `dividends_available`. |
| **Revisão de Teses Vencidas** | `portfolio.reviews_overdue` | **Sim — Ponte (P3)** | **Sim (P2)** | **Unificação:** substitui `PortfolioGovernanceBanner` duplicado, corrige texto repetido, usa rota canônica `/investments?tab=rebalancear&view=metas&subtab=assets` e compartilha chave de dispensa. |
| **Caixa Ocioso na Corretora** | `portfolio.idle_cash` | **Sim — Ponte (P4, se >= R$ 500 ou combinado ao card de Aporte)** | **Sim (P3)** | **Nova Ponte Investimentos -> Home:** lembra na Home que há saldo parado na corretora pronto para rebalancear. CTA: *"Usar Caixa no Simulador"* (`/investments?tab=rebalancear&view=simulador&usarCaixa=1`). |
| **Risco Estrutural Crítico (FGC / Concentração Crítica)** | `portfolio.risk.${type}.${id}` | **Sim — Ponte (P2, apenas `tone === "critical"`)** | **Sim (P2/P4)** | **Nova Ponte Investimentos -> Home:** dá visibilidade executiva na Home apenas a violações críticas (ex.: teto FGC excedido), com dispensa de até **6 meses**. |
| **Oportunidade em Desconto** | `portfolio.discount_opportunity` | **Sim — Ponte (P4, somente se `surplusCapacity.hasSurplus`)** | **Sim (P4)** | **Nova Ponte Contextual:** só aparece na Home quando o usuário tem sobra financeira + ativos de alta convicção abaixo do Preço Teto. CTA: *"Simular Aporte"*. |
| **Metas Patrimoniais (`GoalProgress`)** | `goals.progress.${shareId}` | **Sim (P3)** | **Opcional — Ponte (se meta vinculada à carteira e `completed`/`final_stretch`)** | Conecta o progresso de metas patrimoniais diretamente à carteira de investimentos. |
| **Reavaliação Próxima / Sem Nota / Quarentena / Baixa Convicção / Desvio / Metas != 100% / Riscos Não-Críticos** | `portfolio.*` | Não | **Sim** | Mantidos exclusivos em Investimentos para preservar foco e limpeza cognitiva da Home. |
| **SmartAdvisor Insights** | `advisor.${themeKey}` | Sim (slots remanescentes) | Não | Recomendações proativas de orçamento/hábitos. |

---

## 6. Arquitetura Unificada Proposta

### 6.1 Nova Estrutura de Arquivos (`docs/architecture/PROJECT_STRUCTURE.md`)

```text
src/
├── domain/carousel/
│   ├── index.ts                        # Barrel
│   ├── types.ts                        # CarouselCardId, CarouselSurface, DismissPreset, CarouselCardPolicy, CarouselDismissalRecord
│   ├── dismissal-policy.ts             # Catálogo canônico de políticas por card (presets permitidos, regras de bypass)
│   ├── dismissal-engine.ts             # Cálculo exato de expiração (7d, 30d/next_month, 180d), avaliação e merge por updatedAt
│   └── dismissal-engine.test.ts        # Cobertura Vitest de prazos, virada de mês, 6 meses, merge e bypass
├── hooks/
│   └── use-carousel-dismissals.ts      # Hook ÚNICO (substitui useDashboardAlertDismissals + usePortfolioAlertDismissals)
└── components/modules/carousel/
    ├── index.ts                        # Barrel
    ├── alert-carousel.tsx              # Evolução do DashboardAlertsCarousel (pausa em overlay, skeleton único, sem clones com estado)
    ├── alert-carousel-card.tsx         # Card canônico ÚNICO (substitui InsightSlide e a casca duplicada dos 14 banners da Home)
    ├── carousel-dismiss-popover.tsx    # Popover v2 com presets dinâmicos (7d | 1 mês | 6 meses) + data prevista + callback onOpenChange
    └── use-alerts-carousel.ts          # Hook de navegação/swipe/autoplay com pause-lock por overlay
```

> **Compatibilidade:** Os wrappers existentes (`DashboardAlertsCarousel`, `CarouselDismissPopover`) podem re-exportar da nova pasta `components/modules/carousel/` durante a migração para evitar quebras em massa.

### 6.2 Política Canônica de Dispensa (`7 dias` | `1 mês` | `6 meses`)

Definir `DismissPreset = "7d" | "1m" | "6m"` (e opcionalmente `"permanent"` apenas para onboarding concluído/ignorado):

| Preset | Rótulo na UI | Cálculo Determinístico (`dismissal-engine.ts`) | Feedback no Toast (`AGENTS.md §4.32`) |
|---|---|---|---|
| `7d` | **Dispensar por 7 dias** | `now + 7 dias` (meia-noite local + 7d ou `nowMs + 7 * DAY_MS`, consistente) | *"Aviso oculto até DD/MM"* + botão **Desfazer** (5s) |
| `1m` | **Dispensar por 1 mês** *(ou "Lembrar em 30 dias" com subtítulo da data)* | `addMonthsLocal(now, 1)` (mesmo dia no mês seguinte, com clamp para fim de mês ex.: 31/01 -> 28/02) **OU** `30 dias` explícito — recomendação: **1 mês civil (`addMonthsLocal`)** exibindo a data exata `DD/MM` | *"Aviso oculto por 1 mês (até DD/MM)"* + botão **Desfazer** (5s) |
| `6m` | **Dispensar por 6 meses** | `addMonthsLocal(now, 6)` | *"Aviso oculto por 6 meses (até DD/MM/AA)"* + botão **Desfazer** (5s) |

#### Matriz de Presets Permitidos por Categoria de Card

| Categoria | Cards | Presets Permitidos | Pode Furar Cooldown? |
|---|---|---|---|
| **P0 Crítico Inadiável** | `billing.past_due`, `billing.trial_ending` (`<= 3d`) | **Nenhum** (sem botão `X`) | N/A |
| **Ciclo Mensal / Tático** | `cashflow.cash_gap`, `cashflow.pace`, `cashflow.surplus_aporte`, `household.*`, `split.pending`, `trip.active:*`, `portfolio.dividends_*`, `portfolio.reviews_overdue`, `portfolio.reviews_upcoming`, `portfolio.allocation_drift`, `portfolio.idle_cash`, `portfolio.discount_opportunity` | **`7d` · `1m`** | **Não por padrão.** Somente se ocorrer mudança de severidade grave explícita (ex.: `trial <= 3d`, meta atingiu `100%`), nunca por oscilação de centavos. |
| **Estrutural / Governança Longa / Setup** | `portfolio.risk.*` (FGC, concentração, setor, Nef, overlap ETFs), `portfolio.low_score_risk`, `portfolio.quarantine`, `portfolio.unscored_assets`, `portfolio.invalid_targets_sum`, `goals.progress.*` (estágio `regular`), `device.permissions`, `device.alerts_invite`, `onboarding.progress` | **`7d` · `1m` · `6m`** | **Não** (respeita rigorosamente a escolha do usuário até `dismissedUntil`, salvo revogação manual ou novo evento de ID distinto). |
| **SmartAdvisor (`advisor.*`)** | Insights proativos embutidos no carrossel | **`7d` · `1m` · `6m`** *(para recomendações recorrentes de hábitos/cortes)* | **Não.** `SmartDecay` só sugere "Pausar este tema" após 3 dispensas, mas **nunca sobrescreve** o `dismissedUntil` escolhido explicitamente pelo usuário! |

### 6.3 Contrato Único de Persistência (`custom_settings.carouselDismissals`)

```ts
export interface CarouselDismissalRecord {
  preset: "7d" | "1m" | "6m";
  dismissedAt: string;      // ISO timestamp — fonte da verdade para merge!
  dismissedUntil: number;   // Epoch ms local — fonte da verdade para expiração!
  revokedAt?: string;       // ISO timestamp para suportar "Desfazer" e revogação multi-dispositivo
  contextSnapshot?: Record<string, string | number | boolean>; // Apenas para telemetria/bypass estrito
}

export type CarouselDismissalsMap = Record<string, CarouselDismissalRecord>;
```

**Regras Obrigatórias da Camada de Persistência:**
1. **Fonte única de `userId`:** usar exclusivamente `getActiveUserId()` (eliminando o fallback `"anon"` divergente de `usePortfolioAlertDismissals`).
2. **Merge por `updatedAt` (`max(dismissedAt, revokedAt)`):** o evento mais recente sempre vence — permite encurtar prazo, estender para 6 meses ou acionar **Desfazer** sem que o registro antigo da nuvem sobrescreva o novo.
3. **Zero `mutate()` dentro de `setState`:** calcular `next` fora do updater e disparar `saveLocal` + `mutate` no handler do evento.
4. **Cache otimista resiliente em `useUpdateCustomSettings`:** suportar `previous === null` (sintetizando o objeto de preferências otimista ou mantendo store reativo via `useSyncExternalStore` compartilhado entre Home e Investimentos).
5. **Migração Retrocompatível (Read-Fallback):** durante a transição, `useCarouselDismissals` lê primeiro `carouselDismissals[canonicalId]` e faz fallback de leitura para as chaves legadas (`dashboardAlertDismissals.*` e `portfolioAlertDismissals.*`), gravando sempre no formato novo.

### 6.4 Anatomia Canônica do `AlertCarouselCard` (Fim do Truncamento e DRY Total)

Todo slide de carrossel (Home e Investimentos) passa a renderizar via `<AlertCarouselCard />`:

- **Container:** `relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs`
- **Superfície:** padrão limpo `border-border/80 bg-surface` (reservando tint sutil `border-critical/30 bg-critical/5` exclusivamente para `tone="critical"` P0/P1).
- **Ícone Nível 2:** `flex size-9 shrink-0 items-center justify-center rounded-xl border` + ícone `size-4.5` nas cores canônicas do `AGENTS.md §4.13`.
- **Bloco de Texto (Anti-Truncamento):**
  - Padding direito no mobile quando dispensável: **`pr-9 sm:pr-0`** (36px–40px livres para o botão `X` absoluto em `top-3 right-3`).
  - **Título:** sem `truncate` cego! Usar **`text-sm font-semibold tracking-tight text-foreground line-clamp-2 break-words`** (`AGENTS.md §4.23`).
  - **Linha de Cabeçalho:** `flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0` contendo Título + `<Badge size="xs" className="max-w-full truncate shrink-0" />` + opcional `<CalculationMemoryModal />`.
  - **Descrição:** `<p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">` com **orçamento estrito de copy** (título <= 38 chars; descrição <= 115 chars) para caber naturalmente em 2 linhas sem reticências.
- **Bloco de Ações:**
  - Máximo **1 CTA primário** (`size="sm"`) + opcional **1 ação secundária ghost** no desktop; no mobile, 2 botões distribuem-se em `grid grid-cols-2 gap-2` e 1 botão ocupa `w-full`.
  - Botão de dispensa (`CarouselDismissPopover`) sempre no mesmo slot (`absolute top-3 right-3 sm:static`), recebendo `onOpenChange` conectado ao **pause-lock** do `AlertCarousel`.

### 6.5 Comportamento Padronizado do `AlertCarousel`

1. **Pause-Lock em Overlays:** o carrossel expõe contexto (`CarouselPauseContext`) para que qualquer `CarouselDismissPopover` ou `CalculationMemoryModal` aberto congele o autoplay até ser fechado — no desktop e no mobile.
2. **Capacidade Coerente por Superfície:**
   - **Home:** `maxItems={3}` (elevando de 2 para 3 para acomodar 1 operacional + 1 ponte patrimonial + 1 SmartAdvisor sem sufocar alertas), e **modo focado (`1` slide) restrito exclusivamente a `priority === 0`** (`subscription-past-due`), não mais a `priority <= 1`.
   - **Investimentos:** `maxItems={5}` com ordenação determinística (P1 Crítico/Proventos -> P2 Ponte Caixa/Governança -> P3 Alocação/Caixa Ocioso -> P4 Estruturais/Oportunidades).
3. **Skeleton Único:** eliminar o skeleton duplicado de `PortfolioInsightsCarousel` e delegar 100% para `AlertCarousel` via `isLoading` + `presenceHintKey`.
4. **Prevenção de Estado Duplicado nos Clones:** slides clones (`clone-start`/`clone-end`) devem ser renderizados apenas como espelhos não-interativos (`inert`, `aria-hidden="true"`) e sem efeitos colaterais de montagem.

---

## 7. Auditoria de Precisão Funcional e Memória de Cálculo (`AGENTS.md §4.33`)

Além dos bugs de dispensa e truncamento, a auditoria do código-fonte revelou **imprecisões matemáticas reais** nos motores que alimentam os cards e uma **assimetria crítica de explicabilidade**: hoje apenas 4 cards da Home (`CashGapAlert`, `PaceAlertBanner`, `SurplusAporteBanner` e `SmartAdvisorCard`) exibem `CalculationMemoryModal`, enquanto **nenhum dos 16 slides de Investimentos possui memória de cálculo**.

### 7.1 Revisões Críticas de Funcionamento e Precisão Matemática

| # | Card(s) Afetado(s) | Origem no Código | Problema Identificado | Correção Obrigatória |
|---|---|---|---|---|
| **1** | `single_asset_concentration`, `private_issuer_fgc`, `macro_sector_concentration`, `low_diversification_nef`, `benchmark_overlap` | `src/domain/portfolio/portfolio-risk-policy.ts:106` e `src/domain/portfolio/diversification-metrics.ts:39` | Calcula valor dos ativos por `quantity * average_price` (**custo de aquisição**) em vez do **valor de mercado atual** (`position.rows[].valueBRL`) e ignora `cashBRL` no denominador. Se um ativo valorizou/caiu ou um CDB rendeu acima de R$ 250 mil, os pesos e limites divergem da aba Posição. | Aceitar `marketValueByAssetId` (ou `PortfolioPositionRow[]`) + `cashBRL` em `evaluatePortfolioStructuralRisk` e `calculatePortfolioDiversification`, com fallback para `average_price` apenas quando não houver cotação. |
| **2** | 4 cards de risco estrutural (concentração, FGC, macro-setor, sobreposição ETF) | `src/domain/portfolio/portfolio-risk-policy.ts:138,187,239,311` | Loops interrompem com `break` no **primeiro** item que viola a regra, sem ordenar por gravidade/exposição (pode alertar 26% e esconder 45%). Além disso, `single_asset_concentration` usa tetos hardcoded (`25%`/`50%`) divergentes de `PortfolioRiskPolicy` (`15%`/`40%`). | Coletar todos os violadores, ordenar do maior risco/valor para o menor, emitir o líder com contagem de extras (`e +N`) e ler tetos exclusivamente de `policy`. |
| **3** | Todos os 5 cards de risco estrutural | `src/domain/portfolio/portfolio-risk-policy.ts` e `src/features/investments/components/insights-carousel/build-structural-risk-items.tsx:54` | Descrições usam `.toFixed(1)` com ponto decimal (violando `AGENTS.md §4.28`); badge de `low_diversification_nef` formata `Nef` (número efetivo de ativos, não percentual) usando `formatPercent(nef)`. | Usar `formatPercent` (vírgula pt-BR) apenas para percentuais e formatador numérico dedicado (`Intl.NumberFormat("pt-BR")`) para `Nef`, com rótulo claro (`2,4 ativos equiv.`). |
| **4** | `invalid-targets-sum-alert` | `src/domain/portfolio/insights-carousel-drift.ts:87` e `build-allocation-insight-items.tsx` | `hasInvalidTargetsSum` está fixado em `false` (normalização automática ativa), tornando o card código morto. | Remover o slide zumbi e seus testes/referências mortas. |
| **5** | `allocation-drift-alert` | `src/domain/portfolio/insights-carousel-drift.ts:52-74` | `investablePortfolioBRL` soma todas as posições não-caixa, mas `driftItems` só inclui classes com meta cadastrada. Ativos em classes sem meta (ou `"Sem classe"`) distorcem os percentuais e o `diffPercent`. | Expor explicitamente `unallocatedClassesBRL` no modelo de drift (e na memória de cálculo) ou normalizar o denominador conforme a política do simulador de aportes, garantindo soma coerente a 100%. |
| **6** | `low-score-risk-alert`, `discount-opportunity-alert`, `quarantine-governance-alert` | `src/domain/portfolio/asset-governance-insights.ts:220-265` e `build-governance-risk-items.tsx` | O domínio calcula tickers, descontos, pesos e dias em quarentena, mas o card descarta os dados e mostra texto genérico só com a contagem. Há divergência de corte (`score <= 4` vs. `DEFAULT_PORTFOLIO_RISK_POLICY.lowScoreThreshold = 5`), e quarentena sem `last_reviewed_at` zera `daysInQuarantine` e nunca dispara. | Exibir os principais tickers diretamente na descrição (ex.: `PETR4, VALE3`), unificar o corte de nota baixa na `PortfolioRiskPolicy` e usar fallback `updated_at`/`created_at` quando `last_reviewed_at` for nulo na quarentena. |
| **7** | `idle-cash-alert` | `build-allocation-insight-items.tsx:7` | Limiar fixo de `R$ 100,00` gera ruído recorrente com sobras pequenas de dividendos. | Calibrar por superfície: `>= R$ 500,00` na Home (ponte) e `>= R$ 100,00` em Investimentos somente quando houver desvio de alocação ou meta ativa. |
| **8** | `HouseholdAlertBanner`, `GoalProgressAlertBanner`, `SmartAdvisorCard` | `build-overview-alerts.tsx`, `goal-progress-alert-banner.tsx`, `insights-breakdown.ts:52` | Variante `ceiling_warning` (80–99%) nunca é acionada e `spentPercentage` não usa `formatPercent`; `GoalProgressAlertBanner` não compara ritmo com prazo alvo; `buildSmartAdvisorBreakdown` reconstrói `oldCents` em reajustes de assinatura por divisão reversa aproximada. | Acionar `ceiling_warning` entre 85% e 99% com `formatPercent`; adicionar indicador de ritmo/prazo em metas com `target_date`; passar `previousValueCents` real no metadata do insight de reajuste. |

### 7.2 Matriz Completa de Memória de Cálculo por Card

#### A. Cards que Já Possuem Memória de Cálculo (Manter e Padronizar)

| Card | Builder Atual | Ação Necessária |
|---|---|---|
| `CashGapAlert` | `buildCashGapBreakdown` | Migrar gatilho para o slot `calculationBreakdown` do `AlertCarouselCard`. |
| `PaceAlertBanner` | `buildPaceProjectionBreakdown` | Migrar gatilho para o slot `calculationBreakdown` do `AlertCarouselCard`. |
| `SurplusAporteBanner` | `buildSurplusCapacityBreakdown` | Migrar gatilho para o slot `calculationBreakdown` do `AlertCarouselCard`. |
| `SmartAdvisorCard` | `buildSmartAdvisorBreakdown` | Corrigir arredondamento de `oldCents` em `price_adj` e padronizar slot no modo carrossel. |

#### B. Builders Já Existentes no Domínio (Conexão Imediata)

| Card | Builder Existente | Arquivo de Origem | Ganho para o Usuário |
|---|---|---|---|
| `HouseholdAlertBanner` (teto familiar) | `buildFamilyCeilingBreakdown` | `src/domain/calculation-memory/builders/family-breakdown.ts:131` | Detalha teto mensal, gasto consolidado, margem/excesso e contribuição por membro. |
| `HouseholdAlertBanner` (acerto pendente) | `buildFamilySettlementBreakdown` | `src/domain/calculation-memory/builders/family-breakdown.ts:32` | Explica exatamente o rateio e quem compensa quem via Pix. |
| `ActiveTripBanner` (viagem ativa com rateio) | `buildTripSettlementBreakdown` | `src/domain/calculation-memory/builders/trips-breakdown.ts:22` | Mostra total da viagem, divisão por participante e saldo a acertar. |

#### C. Novos Builders Puros Obrigatórios e Recomendados (`src/domain/calculation-memory/builders/`)

| Prioridade | Card(s) | Novo Builder Puro | Fórmula e Passos Auditáveis | Arquivo Destino |
|---|---|---|---|---|
| **Alta (§4.33)** | `low_diversification_nef` | `buildDiversificationNefBreakdown` | `HHI = Soma(w_i^2)` e `Nef = 1 / HHI`; tabela com top ações, peso `w_i` e contribuição `w_i^2`. | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `allocation-drift-alert` | `buildAllocationDriftBreakdown` | Patrimônio investível (sem caixa), tabela `Atual % vs. Meta % vs. Desvio p.p.`, banda `+-5 p.p.` e aporte sugerido. | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `single_asset_concentration` | `buildSingleAssetConcentrationBreakdown` | `Peso (%) = Valor de Mercado do Ativo / Patrimônio Total`, comparado ao teto aplicável (ativo comum vs. diversificado). | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `private_issuer_fgc` | `buildPrivateIssuerFgcBreakdown` | Lista todos os títulos privados do emissor (CDB/LCI/LCA), soma vs. teto FGC (`R$ 250.000,00`) e `% da Renda Fixa` vs. teto (`30%`). | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `macro_sector_concentration` | `buildMacroSectorConcentrationBreakdown` | Lista ativos do bloco macro, `% em Ações` (teto `45%`) e `% global` (teto `35%`). | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `low-score-risk-alert` | `buildLowScoreRiskBreakdown` | Lista cada ativo com nota baixa, nota individual, valor de mercado e `% do patrimônio` acima do limite (`5%`). | `portfolio-risk-breakdown.ts` |
| **Alta (§4.33)** | `discount-opportunity-alert` | `buildDiscountOpportunityBreakdown` | Lista ativos com `Nota >= 8`, cotação atual, Preço Teto e `Margem = (Preço Teto - Cotação) / Preço Teto` (`>= 15%`). | `portfolio-risk-breakdown.ts` |
| **Média** | `available-dividends-alert`, `projected-dividends-alert`, `CorporateDividendsBanner` | `buildDividendsAlertBreakdown` | Composição por ticker: `Qtd Data Com x Bruto - IR (0%/15%/30%) = Líquido`, sinalizando alíquotas incertas. | `portfolio-breakdown.ts` |
| **Média** | `benchmark_overlap` | `buildBenchmarkOverlapBreakdown` | Lista ETFs sobrepostos no mesmo índice, valores individuais, soma e `% do patrimônio` vs. teto (`30%`). | `portfolio-risk-breakdown.ts` |
| **Média** | `SplitPendingBanner` | `buildSplitPendingBreakdown` | Lista rachas abertos, total de despesas, cota individual e saldo líquido pendente (a receber vs. a pagar). | `overview-breakdown.ts` |
| **Média** | `GoalProgressAlertBanner` | `buildGoalProgressBreakdown` | Acumulado atual, valor alvo, faltante, `% alcançado` e sobra mensal disponível para aporte. | `budgets-breakdown.ts` |

#### D. Cards Dispensados de Memória de Cálculo (Operacionais / Administrativos)

Não requerem `CalculationMemoryModal` por não apresentarem métricas financeiras derivadas: `SubscriptionPastDueBanner`, `TrialEndingBanner`, `PermissionsAlertBanner`, `OnboardingCarouselBanner`, `DeviceAlertsInviteBanner`, `overdue-reviews-alert`, `upcoming-reviews-alert`, `unscored-assets-alert`, `quarantine-governance-alert`, `PortfolioGovernanceBanner` e `idle-cash-alert`. Para governança de teses e quarentena, a clareza vem da listagem direta dos tickers e prazos no card e no modal de avaliação.

### 7.3 Integração Padronizada no `AlertCarouselCard`

- O primitivo `AlertCarouselCard` deve expor a prop opcional `calculationBreakdown?: CalculationBreakdown`.
- Quando fornecida (e respeitando a preferência global `showCalculationMemory`), o card renderiza `<CalculationMemoryModal breakdown={calculationBreakdown} />` no cabeçalho ao lado do badge, conectado ao `CarouselPauseContext` para travar o autoplay enquanto o modal estiver aberto.

---

## 8. Regras de Governança Recomendadas (Atualização do `AGENTS.md` §4.19, §4.33 e §4.35)

1. **Zero Casca Duplicada em Carrosséis:** Todo card exibido em `AlertCarousel` (Home ou Investimentos) **DEVE** usar `<AlertCarouselCard />`; é proibido escrever markup próprio de card de carrossel.
2. **Zero `truncate` em Títulos de Carrossel:** Títulos de `AlertCarouselCard` usam obrigatoriamente `line-clamp-2 break-words` e `pr-9 sm:pr-0` quando dispensáveis.
3. **Orçamento de Copy e Formatação pt-BR:** Títulos <= 38 caracteres; descrições <= 115 caracteres; zero `.toFixed()` com ponto decimal (`AGENTS.md §4.28`).
4. **Dispensa Canônica com Presets Tipados e Undo:** Todo card dispensável usa exclusivamente `<CarouselDismissPopover />` com presets definidos em `src/domain/carousel/dismissal-policy.ts` (`7d`, `1m` calendário e `6m` calendário para alertas estruturais/setup/governança longa), sempre acompanhado de Toast com data de retorno e ação **Desfazer** (5s).
5. **Respeito Absoluto ao `dismissedUntil`:** Nenhuma heurística secundária (`SmartDecay`, variação de centavos de superávit, troca de tela) pode sobrescrever ou furar o prazo escolhido pelo usuário, exceto regras P0 explicitamente declaradas na política (`trial <= 3d`, `meta 100%`).
6. **Chave Única para Cards-Ponte:** Cards compartilhados entre Home e Investimentos usam obrigatoriamente o mesmo `CarouselCardId`, garantindo sincronização imediata de dispensa e deep-link canônico.
7. **Precisão a Valor de Mercado e Explicabilidade Obrigatória (§4.33):** Alertas de risco, alocação e governança de carteira devem operar sobre **valor de mercado atual** (nunca custo histórico) e todo card com métrica derivada deve fornecer `calculationBreakdown` puro de domínio com testes Vitest.

---

## 9. Plano de Implementação Detalhado (6 Fases)

### Fase 1 — Motor de Dispensa Unificado (`7d | 1m | 6m`) e Persistência Confiável
- **Objetivo:** Eliminar 100% dos bugs de agendamento de dispensa, unificar os 4 stores paralelos e suportar `6 meses` com Undo Toast de 5s.
- **Arquivos Alvo:**
  - Criar `src/domain/carousel/types.ts`, `src/domain/carousel/dismissal-policy.ts`, `src/domain/carousel/dismissal-engine.ts`, `src/domain/carousel/dismissal-engine.test.ts` e `src/domain/carousel/index.ts`.
  - Criar `src/hooks/use-carousel-dismissals.ts` e `src/hooks/use-carousel-dismissals.test.ts`.
  - Atualizar `src/state/mutations/use-preference-mutations.ts` (corrigir `onMutate` quando `previous === null`).
  - Atualizar `src/features/overview/hooks/use-smart-advisor-dismissals.ts` (desacoplar `advanceSmartDecay` de sobrescrever prazo explícito).
- **Tarefas Executáveis:**
  1. Implementar cálculo de calendário local (`addDaysLocal`, `addMonthsLocal`) para `7d`, `1m` e `6m` com formatação da data prevista de retorno.
  2. Definir `CAROUSEL_DISMISSAL_POLICIES` com `allowedPresets` por `CarouselCardId` e regras explícitas de override apenas para P0.
  3. Implementar merge determinístico por `max(dismissedAt, revokedAt)` com `getActiveUserId()` e read-fallback para chaves legadas (`dashboardAlertDismissals`, `portfolioAlertDismissals`).
  4. Remover qualquer chamada de `mutate()` dentro de updaters de `setState` e adicionar Toast com ação `Desfazer` (5s).
- **Critérios de Aceite:** Testes Vitest cobrindo `7d`, `1m`, `6m`, virada de mês/ano, undo, merge cross-device e ausência de bypass silencioso.

### Fase 2 — Precisão Matemática dos Motores e Builders de Memória de Cálculo
- **Objetivo:** Garantir precisão a valor de mercado nos alertas de carteira, eliminar código morto e cumprir integralmente `AGENTS.md §4.33`.
- **Arquivos Alvo:**
  - Atualizar `src/domain/portfolio/portfolio-risk-policy.ts` e `src/domain/portfolio/diversification-metrics.ts` (+ testes).
  - Atualizar `src/domain/portfolio/insights-carousel-drift.ts` e `src/domain/portfolio/asset-governance-insights.ts` (+ testes).
  - Criar `src/domain/calculation-memory/builders/portfolio-risk-breakdown.ts` (+ `portfolio-risk-breakdown.test.ts`).
  - Expandir `portfolio-breakdown.ts`, `overview-breakdown.ts`, `budgets-breakdown.ts` e `insights-breakdown.ts` (+ testes).
- **Tarefas Executáveis:**
  1. Migrar `evaluatePortfolioStructuralRisk` e `calculatePortfolioDiversification` para valor de mercado atual (`valueBRL`) + `cashBRL`, ordenar violadores por maior gravidade antes do corte, usar tetos da `PortfolioRiskPolicy` e formatação pt-BR.
  2. Remover `invalid-targets-sum-alert` (código morto), tratar classes sem meta no denominador do drift, unificar corte de nota baixa na `PortfolioRiskPolicy` e adicionar fallback de data na quarentena.
  3. Criar os 7 builders de Alta Prioridade (`Nef`, `Drift`, `Concentração Ativo`, `Emissor FGC`, `Macro-Setor`, `Baixa Convicção`, `Desconto Preço Teto`) e os 4 de Prioridade Média (`Proventos`, `Sobreposição ETF`, `Rachas Pendentes`, `Progresso de Meta`).
  4. Corrigir `buildSmartAdvisorBreakdown` para usar `previousValueCents` exato em reajustes de assinatura.
- **Critérios de Aceite:** 100% dos novos builders e correções cobertos por Vitest em `src/domain/` com `npm run verify` verde.

### Fase 3 — Primitivos Unificados de UI e Fim do Truncamento
- **Objetivo:** Padronizar casca visual, acessibilidade, pause-lock de overlays e suporte nativo a `6 meses` e `calculationBreakdown`.
- **Arquivos Alvo:**
  - Criar `src/components/modules/carousel/alert-carousel.tsx`, `alert-carousel-card.tsx`, `carousel-dismiss-popover.tsx`, `carousel-pause-context.ts` e `index.ts`.
- **Tarefas Executáveis:**
  1. Criar `CarouselPauseContext` travando autoplay sempre que `CarouselDismissPopover` ou `CalculationMemoryModal` estiver aberto (desktop e mobile).
  2. Tornar clones do loop infinito não-interativos (`inert`, `aria-hidden="true"`) e unificar o skeleton via `isLoading` + `presenceHintKey`.
  3. Construir `AlertCarouselCard` com título `line-clamp-2 break-words`, `pr-9 sm:pr-0`, slot `calculationBreakdown` e grid responsivo de ações.
  4. Evoluir `CarouselDismissPopover` para renderizar presets dinâmicos (`7 dias`, `1 mês`, `6 meses`) exibindo a data exata de retorno.
- **Critérios de Aceite:** Testes RTL de interação/pause-lock + verificação visual sem truncamento em `360px`, `768px` e `1280px`.

### Fase 4 — Migração dos Cards (Home e Investimentos) e Conexão das Memórias
- **Objetivo:** Migrar todos os cards existentes para `AlertCarouselCard` + `useCarouselDismissals` e conectar todos os breakdowns.
- **Arquivos Alvo:**
  - Home: `build-overview-alerts.tsx` e banners em `src/features/overview/components/` + `src/components/modules/`.
  - Investimentos: `portfolio-insights-carousel.tsx` e builders em `src/features/investments/components/insights-carousel/`.
- **Tarefas Executáveis:**
  1. Migrar todos os banners da Home para `AlertCarouselCard` + `useCarouselDismissals`, conectando `buildFamilyCeilingBreakdown`, `buildFamilySettlementBreakdown`, `buildTripSettlementBreakdown`, `buildSplitPendingBreakdown` e `buildGoalProgressBreakdown`.
  2. Ativar `ceiling_warning` (85–99%) no `HouseholdAlertBanner` com `formatPercent`, corrigir typo em `PortfolioGovernanceBanner` e corrigir rota legada `/investments?tab=metas` em `OverviewPage`.
  3. Migrar todos os slides de Investimentos para `AlertCarouselCard` + `useCarouselDismissals`, conectando os novos builders de risco/alocação/proventos e exibindo tickers explícitos nos cards consolidados de governança.
  4. Eliminar `InsightSlide`, o skeleton duplicado de `PortfolioInsightsCarousel` e os hooks legados após paridade validada.
- **Critérios de Aceite:** Zero casca duplicada, zero `truncate` em títulos de carrossel, `npm run verify` verde.

### Fase 5 — Ponte Bidirecional Home <-> Investimentos e Attention Budget
- **Objetivo:** Conectar as duas telas com utilidades cruzadas acionáveis e dispensa sincronizada por chave canônica.
- **Arquivos Alvo:**
  - `src/features/overview/components/build-overview-alerts.tsx`, `src/features/investments/components/portfolio-insights-carousel.tsx`, `src/domain/insights/attention-budget.ts`.
- **Tarefas Executáveis:**
  1. **Unificar cards compartilhados:** `portfolio.dividends_available`, `portfolio.dividends_projected` e `portfolio.reviews_overdue` com o mesmo `CarouselCardId` nas duas telas.
  2. **Home -> Investimentos:** exibir `cashflow.cash_gap` (crítico) e `cashflow.surplus_aporte` (quando `allocationIntent === "invest"`, pré-preenchendo o simulador de aporte).
  3. **Investimentos -> Home:** exibir `portfolio.idle_cash` (`>= R$ 500`), riscos estruturais críticos (com dispensa de `6m`) e `portfolio.discount_opportunity` (quando `hasSurplus`).
  4. Ajustar capacidade da Home para `maxItems={3}`, restringindo o modo focado de `1` slide exclusivamente a `priority === 0`.
- **Critérios de Aceite:** Dispensar card compartilhado na Home remove imediatamente em Investimentos (e vice-versa); deep-links abrem a aba/modal exato.

### Fase 6 — Governança, Documentação e Quality Gate Final
- **Objetivo:** Consolidar regras de engenharia, atualizar documentação estrutural e validar a entrega ponta a ponta.
- **Arquivos Alvo:**
  - `AGENTS.md` (§4.19, §4.33, §4.35), `docs/design/DESIGN_SYSTEM.md`, `docs/architecture/PROJECT_STRUCTURE.md`, `docs/roadmap/ROADMAP.md`, `package.json` (bump MINOR no fechamento).
- **Tarefas Executáveis:**
  1. Registrar a nova estrutura `src/domain/carousel/` e `src/components/modules/carousel/` em `PROJECT_STRUCTURE.md`.
  2. Atualizar `AGENTS.md` e `DESIGN_SYSTEM.md` com as regras canônicas de `AlertCarouselCard`, presets `7d | 1m | 6m` e memória de cálculo obrigatória.
  3. Executar `npm run verify:full` (typecheck + lint + Vitest + Playwright E2E smoke) e validar em viewports desktop e mobile.
- **Critérios de Aceite:** `npm run verify:full` 100% verde sem warnings nem regressões.

---

## 10. Referência ao Plano Mestre Executável

Todas as melhorias holísticas complementares — integração como vitrine ativa do Notification Hub (`investments_carousel`), governança por faixas semânticas (`P0` a `P3`), auto-resolução, novos cards de ponte multi-módulo, Quick Actions in-place e Central de Alertas Adiados em `/lembretes` — estão consolidadas no plano executável oficial em:

- `docs/plans/PLANO_MESTRE_CARROSSEIS_HOLISTICOS.md`
