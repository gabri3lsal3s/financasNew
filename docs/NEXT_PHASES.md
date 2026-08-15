# 🧭 NEXT_PHASES.md — Proposta de Novas Fases do Roadmap

> **Status:** v1.19 — proposta oficial elaborada após auditoria completa da base de código (2026-08-15). **v1.19** registra a **conclusão da Fase 28 — Investimentos: Mobile Responsive & Organização** (2026-08-15 — ver `ROADMAP.md` §3): a posição vira **cards empilhados no mobile** (tabela completa só em `sm+`, com `PositionRowActions` compartilhado — DRY), KPIs em 2×2 (padrão do app), metas por classe empilham sem overflow e o código morto pós-F17 foi removido (`portfolio-page`/`position-tab` — o barrel `features/portfolio` agora exporta `TargetsTab`/`AporteTab`). **v1.18** registra a **conclusão da Fase 27 — Insights: Precisão, Deduplicação & Casos de Borda** (2026-08-15 — ver `ROADMAP.md` §3): desafios de economia agora usam a **média mensal real** (`typicalMonthlySpendCents` em `domain/savings` — média dos meses com gasto, sem diluir por mês vazio), `DiscretionaryChallenge` expõe `categoryCount` (a UI oculta a linha "30% em não essenciais" quando ela duplica o desafio individual de 1 categoria) e o diagnóstico de fim de semana trata `weekdayDaily <= 0` como **incomparável** ("—" + tom neutro + sem alerta "∞×"). **v1.17** registra a **conclusão da Fase 26** (2026-08-15 — ver `ROADMAP.md` §3): motor puro `domain/gestures/overscroll` (resistência elástica logarítmica, barreira de inércia, threshold — 10 testes), hook `usePullUpToTop` (FSM com cancelamento reversível, decisão por ref imune a closure stale, sem pointer capture para coexistir com o swipe-to-action — 7 testes), primitivo `PullUpToTopIndicator` (anel de progresso SVG `stroke-primary`, decorativo — 5 testes), integração no PageShell e **remoção** do `ScrollToTopButton`/`useScrollPosition` do roteador + regra CSS de diálogos. **v1.16** registra a **conclusão da Fase 25** (2026-08-15 — ver `ROADMAP.md` §3): hover-expand da sidebar em overlay (delay anti-disparo 120 ms), bottom sheets mobile com drag-to-close (threshold/fling/resistência/spring-back), primitivo `Tooltip` acessível nos botões do header e auditoria de elementos nativos (DatePicker com header centralizado + Chevron Lucide, `NumberStepperInput` substituindo `input[type=number]`, CSS global de spin buttons). **v1.15** registra a **conclusão da Fase 24** (2026-08-15 — ver `ROADMAP.md` §3): motor puro `domain/fire` (regra dos 4%: meta = despesas anuais × 25; projeção anual determinística com retorno real editável; `emergencyFundMonths` com faixas de saúde — 9 testes), módulos `EmergencyFundGauge` e `FireProjectionChart` (SVG sem libs, 6 testes), `PlanningSection` presentacional (4 testes) e aba **Planejamento** na InsightsPage com auditoria axe sem violações. **v1.14** registra a **conclusão da Fase 23** (2026-08-15 — ver `ROADMAP.md` §3): política de cache centralizada `state/cache-policy.ts` (estático 5 min + gcTime 30 min, analítico/cotações 60 s, transacional 30 s — aplicada nas 15 queries), pre-fetching discreto de chunks das rotas vizinhas (`pageLoaders` compartilhados + `prefetchPageChunks` + `useRoutePrefetch` com `requestIdleCallback`) e decisão documentada de **code-splitting 3D N/A** (sem Three.js/R3F — o 3D de cartões é CSS puro dentro do chunk lazy da rota `/cartoes`). **v1.13** registra a **conclusão da Fase 22** (2026-08-15 — ver `ROADMAP.md` §3): `domain/export` (CSV pt-BR `;`/`,`/BOM + backup versionado com Zod e integridade referencial, 16 testes), `fetchAllUserData`/`restoreBackup` (+ RPC transacional `restore_backup` na migração 0010 — wipe + insert com IDs originais forçando `user_id = auth.uid()`), hub `ExportDataHub` em `/configuracoes > Dados` (JSON completo, CSVs por mês/custom, restauração em 2 etapas), Fechamento Mensal imprimível em Relatórios (`MonthlyClosePrintView` + `@media print`/`.print-area`) e Web Share nos comprovantes (`shareText` com fallback clipboard). **v1.12** registra a **conclusão da Fase 21** (2026-08-15 — ver `ROADMAP.md` §3): motor preditivo `domain/predictions` (11 testes), `usePredictionHistory`, `PredictionSuggestions`, autopreenchimento no wizard (sugestões por descrição + Lançamentos Habituais) e repetição rápida nos diálogos de detalhe. **v1.11** registra a **conclusão da Fase 18** (2026-08-15 — ver `ROADMAP.md` §3): motor puro `dividends.ts` + aba Proventos no hub `/investments` (extrato mensal e calendário anual). **v1.10** adiciona o diagnóstico e especificação da **Fase 26 — Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX)** (Trilha A — Mobile Gesture UX), substituindo o botão flutuante de scroll-to-top por overscroll elástico discreto no final da página. **v1.9** registra a **unificação da carteira em área única** (decisão do produto, 2026-08-15 — ver `ROADMAP.md` §3, F17): `/investments` vira o hub de abas **Resumo/Metas/Aporte** (a F17 é absorvida pela aba Resumo, com reuso de `TargetsTab`/`AporteTab`) e `/carteira` vira redirect. **v1.8** registra a **conclusão da Fase 17** (2026-08-15 — ver `ROADMAP.md` §3): rota `/investments` com KPIs executivos, motores puros `portfolioReturnPct`/`dividendsInMonth`/`allocationByTicker` (`domain/portfolio/summary.ts`), donuts por classe e por ativo, e `PositionTable` com ordenação acessível (`sortable`). **v1.7** registra a **conclusão da Fase 16** (2026-08-15 — ver `ROADMAP.md` §3): KPI de investimentos real na Home (aportes líquidos do mês com sparkline e DeltaHint — decisão do produto), `KpiCard` com `onClick` acessível (deep-link `/carteira`), motor puro `allocationByClass` e módulo `AllocationDonut` integrado na aba Posição (decisão: sem widget na Home — o resumo permanece na Carteira). **v1.1** adicionou o diagnóstico de Insights (§1.4) e a **Fase 19** (Trilha A); **v1.2** adiciona o mapeamento de **Swipe Navigation** (§1.5) e a **Fase 20 — Sistema de Gestos & Navegação por Swipe (Mobile Gesture UX)** (Trilha A), com matriz de riscos e mitigação; **v1.3** registra a **conclusão da Fase 14** (2026-08-15 — ver `ROADMAP.md` §3); **v1.4** registra a **conclusão da Fase 15** (2026-08-15); **v1.5** registra a **conclusão da Fase 19** (2026-08-15): código morto F8 removido, fontes únicas de normalização/essencialidade, `numberToCents` canônico, reuso de motores na InsightsPage, tendência significativa nos Diagnósticos e investimentos reais nas projeções; **v1.6** registra a **conclusão da Fase 20** (2026-08-15): motor puro `domain/gestures/swipe.ts`, engine `useSwipeNavigation`, `MonthSwiper` nas 5 telas de mês, `Tabs swipeable` nas 6 telas de abas e isolamento (`data-swipe-nav-ignore` nos gráficos).
> Objetivos estratégicos:
> **1. Refinamento Máximo de UI/UX & Conforto Visual (Prioridade Principal)** — elevar usabilidade, fluidez, micro-interações, consistência de Design System e ergonomia em desktop e mobile.
> **2. Módulo de Carteira de Investimentos completo e integrado** — tirar o placeholder da Home do papel e entregar o ecossistema de investimentos.
>
> **As fases F14–F18 foram inseridas formalmente no `ROADMAP.md` §3 (2026-08-15)** com as decisões **default** de P1–P6 aplicadas (§4 abaixo); este documento permanece como fonte de detalhes, critérios de aceite e perguntas de alinhamento. Qualquer revisão de P1–P6 é ajustada em ambos os documentos.

---

## 1. DIAGNÓSTICO CONSOLIDADO

### 1.1 O que JÁ EXISTE (não reconstruir — evoluir)

**Módulo de Carteira — Fase 4 concluída e funcional:**

| Camada | Entregue |
|---|---|
| Banco | `portfolio_assets`, `portfolio_transactions` (buy/sell/dividend/jcp/fii_yield/split/reverse_split/subscription), `allocation_targets`, `class_targets`, `sector_targets`, `asset_prices` (cache global + override manual) |
| Domínio puro | `domain/portfolio` (65 testes): ledger com custo médio/caixa derivado/proventos, valoração (manual → cache → fallback), metas com soma ≤ 100%, calculadora de aporte em 2 modos, travas setoriais |
| Estado | `usePortfolioPosition()` → `totalBRL`, `cashBRL`, `rows[]` com `averageCost`, `dividends`, `valueBRL`, `pct`, `source`; `useAssetPrices` (override manual) |
| Telas | `/carteira` com 3 abas (Posição / Metas / Aporte), `PositionTable`, `TargetEditor`, `AporteResult` |
| Cotações | Edge function `supabase/functions/quotes/` (F1.7, Yahoo em cascata + guardrail de spike) — deploy/cron pendentes de execução |

**UI/UX — Design System maduro (F10–F13):** 3 temas × 6 acentos com contraste AA auditado; `MoneyText` (hero/value/caption); `NumberTicker`; `Sparkline`; skeletons por contexto (`SkeletonList/Kpi/Chart/Table`); `EmptyState` com tons; micro-interações (ripple, spring, haptics, swipe-to-action, densidade, privacidade com tecla P, calculadora flutuante); axe em 10 telas P0; zero elementos nativos (primitivos próprios).

### 1.2 Placeholders / stubs de Investimentos (o que preencher)

| # | Local | Estado atual | O que deve virar |
|---|---|---|---|
| 1 | `src/features/overview/pages/overview-page.tsx` (KPI "Investimentos") | `<KpiCard ... cents={totals.investmentCents} hint="Carteira na Fase 4" />` — e `computeOverview(..., 0)` **sempre passa 0** | KPI real com `usePortfolioPosition().totalBRL` + mini-alocação por classe |
| 2 | Home — sem widget de carteira | Só o KPI stub | Card "Carteira em resumo" (patrimônio, caixa, nº ativos, donut de alocação) |
| 3 | `/carteira` — sem rentabilidade | `PositionTable` mostra preço/custo médio/valor, mas **não compara** `averageCost × priceBRL` | Colunas Lucro/Prejuízo não realizado e Rentabilidade % |
| 4 | Sem dashboard de investimentos | Só a tela operacional `/carteira` | Nova tela `/investments` (visão executiva) ou evolução da atual |
| 5 | Sem gráficos de alocação | `CategoryDonut` existe (categorias de despesa) — nada para ativos | Donut por classe de ativo e por ticker |
| 6 | Sem extrato de proventos | Ledger calcula `dividends` por ativo, mas **não há tela** | Extrato/calendário de proventos recebidos e provisionados |

### 1.3 Oportunidades de refinamento UI/UX (observadas na auditoria)

1. **Skeleton da carteira genérico** — `PositionTab` usa `Skeleton className="h-24 w-full"` / `h-48 w-full`; a F12 padronizou `SkeletonKpi/SkeletonTable` na Overview/Transações mas **não na carteira**. Inconsistência clara.
2. **Estado vazio rico** — `PositionTab` usa `EmptyState` padrão; dá para enriquecer com tom por contexto e CTA multi-ação (como feito nas demais telas).
3. **Hierarquia de dados na Posição** — sem destaque de rentabilidade; valores de patrimônio não têm comparativo (ex.: vs. mês anterior).
4. **Micro-interações pontuais** — feedback de conclusão de escrita (check animado) existe em algumas ações; falta uniformizar em transações de carteira.
5. **Mobile/a11y** — `inputMode="decimal"` só em `TargetEditor`; o formulário de transação da carteira (`TransactionFormDialog`) deve auditar teclado numérico (quantidade/preço), alvos de toque ≥ 44px e foco visível.
6. **Transições** — entradas/saídas de abas e rotas já existem (150ms), mas cards de valor não têm micro-transição de mudança (NumberTicker já cobre KPIs; estender à tabela de posição é opcional).
7. **Consistência de densidade** — `DataList` suporta densidade; `PositionTable`/`ReportTable` herdam? Validar propagação do toggle de densidade para a carteira.

### 1.4 Insights — diagnóstico funcional (2026-08-15)

**O que JÁ é sólido (não reconstruir — evoluir):** motores puros testáveis em `domain/insights` (alertas priorizados §3.7.1, assinaturas §3.7.2, recorrências §3.7.3, confiança §3.7.4, feedback persistido §3.7.4, diagnósticos §3.7.6) + `domain/savings` (§3.7.5) + `domain/projection` (§3.8) — ~100 testes; aprendizado ignorar/confirmar/restaurar persistido em `insight_feedback`; DRY já aplicado (`invoiceDueDate`, `percentChange` reexportado, `AlertCard` reusado, `MoneyText` na varredura F12).

**Problemas encontrados (repetições desnecessárias / inconsistências / lacunas):**

| # | Problema | Evidência | Correção proposta |
|---|---|---|---|
| 1 | **Código morto F8 (4 módulos + teste)** | `SmartSpendingPaceCard`, `SmartInvoiceProjectionCard`, `SmartAnomaliesCard`, `SavingsHealthCard` — removidos do dashboard na F12 (widget `summary`), mas permanecem exportados no barrel com teste próprio (`smart-cards.test.tsx`); nenhuma tela os usa | Remover módulos + teste + exports do barrel |
| 2 | **Órfãos no domínio** | `runwayMonths` e `cumulativeBalance` (`domain/overview`) perderam consumidor após F11/F12 (DailyFlowChart virou linhas; `SavingsHealthCard` sai) — só testes os usam | Remover ou reaproveitar (`runwayMonths` como KPI de reserva na carteira F16/17) |
| 3 | **8 `toCents` locais divergentes** | `insights-page`, `budgets-page`, `overview-page`, `reports-page` (sem guarda) vs `position-tab`, `targets-tab`, `position-table`, `aporte-result` (com `isFinite`) — comportamento inconsistente para NaN/Infinity; nenhum helper canônico em `domain/money` | Criar `numberToCents` puro (com guarda) e substituir todos |
| 4 | **3 listas sobrepostas de categorias essenciais/agregadoras** | `ESSENTIAL_CATEGORIES` (3 itens) em `subscriptions.ts` · `AGGREGATING_CATEGORY_ICONS` (7) em `recurrences.ts` · `isEssentialIcon` (8 = união das duas, duplicada) na `InsightsPage` | Fonte única `ESSENTIAL_CATEGORY_ICONS` exportada do domínio |
| 5 | **Normalização duplicada** | `normalizeServiceName` (subscriptions) vs `normalizeKey` (recurrences) — mesma lógica de acentos/minúsculas com variações | Unificar em `normalizeText` |
| 6 | **Tolerância de valores duplicada** | `hasStableValue` (±5%) vs `hasValuesWithin` (tolerância param) — mesma verificação "todos dentro de X% do primeiro" | Unificar em `valuesWithinTolerance` (`hasStableValue` delega) |
| 7 | **Reuso de motores na página** | InsightsPage recalcula rendas/despesas/saldo/savings rate com reduces inline (peso de relatório) em vez de `computeOverview`; reimplementa bucketing de fim de semana manualmente (÷5/÷2) em vez de `aggregateByWeekday` (7 dias Monday-first já testado) | Reusar `computeOverview`/`aggregateByWeekday` |
| 8 | **Padrão repetido em 3 páginas** | Montagem de `limitsByCategory` + `spentByCategory` (peso de relatório) repetida em Overview, Budgets e Insights | Helpers puros compartilhados (`budgetLimitsByCategory`/`spentByCategoryMap`) em `domain/budgets` |
| 9 | **Lacuna de motor exibido** | `isSignificantTrend` (tendência > 15% vs mês anterior, §3.7.6) nunca é exibida no aba Diagnósticos — motor pronto e testado, tela não usa | Exibir no aba Diagnósticos |
| 10 | **O(n²) na montagem de recorrências** | `allExpenses` faz `.find` na lista de categorias **por despesa** (4 meses) | Pré-computar Map categoria → ícone |
| 11 | **Investimentos zerados nas projeções** | `dailyBudget`/`endOfMonthProjection` recebem `investmentsCents: 0` — mesmo stub da Home; inconsistente quando a carteira entrar (F16) | Usar `usePortfolioPosition` (já existe desde a F4) |
| 12 | **Labels locais** | `LEVEL_LABELS` (subscription/recurring/similar) na página — o hub DRY `lib/labels.ts` existe | Mover para `lib/labels.ts` |

### 1.5 Swipe Navigation — mapeamento e diagnóstico (2026-08-15)

**Casos de uso mapeados (onde o swipe agrega valor ergonômico real):**

| # | Alvo | Telas | Onde na base | Veredito |
|---|---|---|---|---|
| 1 | **Navegador de meses/períodos** | Visão Geral, Transações, Cartões, Orçamentos, Relatórios | `MonthPicker` (módulo único) nas 5 páginas | **Alta** — 5 telas, um ponto de integração (DRY) |
| 2 | **Sub-abas & filtros segmentados** | Insights (4 abas), Relatórios internos (categoria/forma/dia), Dívidas (2), Orçamentos (2), Carteira (3), Categorias (2) | primitivo `Tabs` (Radix) em `components/ui/tabs.tsx` | **Alta** — prop `swipeable` única no primitivo |
| 3 | **Faturas de cartões (competência)** | Cartões | `MonthPicker` na CardsPage (item 1) | ✅ Coberto pelo item 1 |
| 4 | **Trocar cartão na carteira 3D** | Cartões (`CreditCardWallet`) | seleção por tap + tilt 3D interativo | ⚠️ **Baixa** — conflita com tap/seleção e o modelo 3D; manter tap (postergar) |
| 5 | **Cards de metas/alocação** | Futuro dashboard de investimentos (F16/17) | a criar | 🔜 Adiar — a engine fica disponível para F16/17 |
| 6 | **Wizard de lançamento** | `/transacoes/novo` | 4 passos com formulários densos | ⛔ **Excluir** — isolamento de formulários |
| 7 | **Configurações** | `/configuracoes` | muitas abas + formulários | ⛔ **Excluir** — opt-out explícito |

**Matriz de riscos e diretrizes de mitigação:**

| # | Risco / problemática | Detalhe do problema | Mitigação projetada |
|---|---|---|---|
| R1 | **Disparo acidental durante scroll vertical (Thumb Drift)** | O arco natural do polegar na rolagem vertical gera deslocamento horizontal involuntário | **Axis-Locking** com ângulo estrito de **±30° no eixo X** (`\|dy\| ≤ \|dx\|·tan(30°) ≈ 0.577·\|dx\|`) + **descarte imediato** se o vetor inicial dominar vertical (`\|dy\| > \|dx\|` no ponto de lock, ~8px); após o lock, `setPointerCapture` (o gesto é dono do pointer — drift no meio do swipe não cancela); `touch-action: pan-y` no contêiner (scroll vertical livre, pan horizontal bloqueado) |
| R2 | **Falsos positivos em toques curtos / ajustes finos / gestos lentos** | Taps e micro-ajustes não devem alternar mês/aba | **Threshold de distância** `\|dx\| ≥ max(60px, 15% da viewport)` **OU** **flick** (`velocity > 0.3 px/ms` com `\|dx\| ≥ 30px`); lock só após ~8px de movimento; decisão final no `pointerup` |
| R3 | **Colisão com Swipe-to-Action existente (exclusão/edição de despesas)** | `TransactionRow` + `useSwipeAction` capturam o pointer; o arrasto lateral da linha não pode trocar o mês do extrato | **Isolamento estrito no engine** (`ignoreSelectors` inclui `.swipeable-item`/`[data-swipe-action]`) — engine desacoplado, **sem alterar** `useSwipeAction`; teste de coexistência dedicado |
| R4 | **Isolamento de áreas interativas** | Inputs, sliders, gráficos com scrub/tooltip e modais/drawers abertos não podem navegar | `ignoreSelectors`: `input, textarea, select, [role="dialog"], [data-swipe-nav-ignore], .no-swipe-nav`; `DailyFlowChart`/`CategoryDonut` (scrub) e o FAB da calculadora (arrastável) ganham `data-swipe-nav-ignore`; modais Radix são **portais** (isolamento natural — o overlay cobre a página e não propaga ao contêiner) |
| R5 | **Falta de feedback de continuidade (elastic drag)** | Sem micro-transição, o usuário não percebe o progresso do gesto antes do gatilho | **Rubber-banding**: `translateX` com resistência crescente durante o arrasto (`onDragProgress`), spring-back animado ao soltar; haptic `light` no lock e `warning` na borda (início/fim de dados) |
| R6 | **Conflito com scroll horizontal existente** | `Tabs.List` tem `overflow-x-auto` (abas roláveis) | Swipe detectado na **área de conteúdo** (não no List); se o alvo estiver em contêiner com scroll horizontal, ignora |
| R7 | **Navegação assíncrona de dados** | Slide fake de dados que ainda não carregaram (refetch do mês) | Sem slide de página completa: apenas translate durante o arrasto + fade-in do conteúdo novo (TanStack refetch com skeletons existentes) |
| R8 | **Acessibilidade / teclado** | Gesto exclusivo exclui usuários de teclado/leitores | Gestos são **adicionais**: `MonthPicker` (botões) e `Tabs` (Radix, teclado) permanecem; `prefers-reduced-motion`/`data-motion` desligam animações; aria-live opcional na mudança |
| R9 | **Desktop / mouse** | Arrasto com mouse navegaria acidentalmente (seleção de texto, drag de janela) | Restrito a `pointerType === "touch" | "pen"`; mouse **ignorado** (botões existentes cobrem desktop) |

### 1.6 Pull-up / Overscroll to Top — Diagnóstico e Arquitetura (2026-08-15)

**Problema:** O botão flutuante `ScrollToTopButton` atual permanece sobreposto no canto inferior direito das telas longas (Dashboard, Transações, Relatórios), poluindo visualmente a interface móvel e conflitando ergonomicamente com os cards de rodapé e o layout limpo ("Obsidian Glass").

**Solução Projetada:** Substituição por um gesto nativo de **Pull-up / Overscroll to Top** disparado no final da rolagem, com:
1. **Máquina de Estados Finita:** `IDLE → AT_BOTTOM → PULLING → THRESHOLD_REACHED → TRIGGERED / CANCELLED`.
2. **Barreira de Inércia (Dois Tempos):** Fling ou rolagem rápida (*momentum scrolling*) que apenas atinge o rodapé **nunca** arma o gatilho. O gesto exige parada estática (`scrollTop + clientHeight >= scrollHeight - 2px`) e um segundo toque/arrasto intencional para cima.
3. **Resistência Elástica (Rubber-banding):** Curva logarítmica com limiar deliberado (`threshold = 80px`).
4. **Cancelamento Reversível:** Se o usuário empurrar o dedo de volta antes do `touchend`, o gatilho é desarmado sem executar scroll. O scroll suave ao topo só roda ao soltar o dedo com o threshold sustentado.
5. **Micro-Indicador Minimalista:** Micro-componente SVG integrado aos tokens do tema (`text-primary`, `stroke-primary`), renderizado no fluxo de rolagem do `main`, abaixo da BottomNav fixa e respeitando a `safe-area-bottom`.

---

## 2. TRILHA A — REFINAMENTO UI/UX & CONFORTO VISUAL (PRIORITÁRIA)

> Princípios: **evoluir, não reconstruir** — reutilizar primitivos existentes (`components/ui`, `components/modules`), sem libs novas de animação (Decisão A mantida), respeitando `prefers-reduced-motion`/`data-motion` e contraste AA.

### Fase 14 — Consistência de Estados & Ergonomia de Dados

**Objetivo:** eliminar as inconsistências de loading/vazio/erro da carteira e elevar a leitura rápida de dados financeiros.

**Entregas:**
1. **Skeletons por contexto na carteira** — substituir os blocos genéricos de `PositionTab` por `SkeletonKpi` (3 KPIs) + `SkeletonTable` (linhas da PositionTable) — zero Layout Shift.
2. **Empty states ricos** — `PositionTab`, `TargetsTab` e `AporteTab` com `EmptyState` por contexto (tom primary/portfolio) e CTA multi-ação (adicionar ativo / registrar transação).
3. **Rentabilidade na Posição** — novas colunas/estatísticas derivadas no domínio: `unrealizedPnl` (valor − custo), `unrealizedPct` (÷ custo), exibidas com `MoneyText` + tom semântico (positive/negative) — **lógica pura em `domain/portfolio` com testes**, UI só recebe valores (regra de ouro).
4. **Hierarquia de patrimônio** — KPI "Patrimônio total" com comparativo (Δ vs. mês anterior via série mensal derivada) usando o padrão `DeltaHint` da Overview.
5. **Densidade & teclado** — propagar o toggle de densidade à `PositionTable`; audit `inputMode` (numeric/decimal) nos formulários de ativo/transação; alvos de toque ≥ 44px em ações de linha.

**Arquivos:** `src/domain/portfolio/` (+ testes) · `src/features/portfolio/pages/position-tab.tsx` · `src/components/modules/position-table.tsx` · `src/features/portfolio/components/transaction-form-dialog.tsx` · `src/features/portfolio/components/asset-form-dialog.tsx`.

**✅ DoD (critérios de aceite):**
- `PositionTab` sem blocos `h-24`/`h-48` genéricos — skeletons por contexto em todas as abas.
- Rentabilidade (não realizada e %) calculada em `domain/portfolio` (função pura) com testes de reconciliação (ex.: compra 10 × 100 → preço 120 ⇒ +R$ 200 / +20%).
- Colunas de lucro/prejuízo com tom semântico correto (negativo nunca vira "R$ 0,00" — `MoneyText`).
- `inputMode` correto em todos os campos numéricos da carteira; axe sem violações nas 3 abas.
- Suíte 100% verde; revisão desktop + mobile nos 3 temas.

### Fase 15 — Micro-Interações, Feedback & Conforto Visual

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: feedback de escrita uniforme (haptic `success` + áudio em `TransactionFormDialog`, `AssetFormDialog` e `TargetsTab`), NumberTicker no Patrimônio da Posição (via `valueCents`, respeitando o toggle), hover/focus herdados do padrão `Card interactive` e conforto visual revisado.

**Objetivo:** elevar a sensação de acabamento nas telas financeiras com micro-interações de feedback e leitura confortável.

**Entregas:**
1. **Feedback de escrita uniforme** — check animado após concluir transações da carteira (registrar compra/venda/provento, definir meta) — mesmo padrão das ações de conclusão existentes.
2. **Transições de dados** — estender `NumberTicker` aos valores dinâmicos da Posição (patrimônio/rentabilidade ao trocar dados) respeitando o toggle "Contagem Numérica Animada".
3. **Hover/focus refinados** — linhas da `PositionTable` com hover elevado e `focus-visible` ring (padrão `Card interactive`); destaque do ticker com preço manual ("informado manualmente") já existente — manter.
4. **Cards de investimento na Home** — micro-transição de entrada (fade + slide sutil, já existente nas rotas) ao montar o widget de carteira.
5. **Conforto visual** — revisar densidade do dashboard (KPIs, cards de resumo), respiro vertical (`gap`) e contraste de rótulos secundários nas telas de carteira.

**Arquivos:** `src/components/modules/position-table.tsx` · `src/components/modules/kpi-card.tsx` (reuso) · `src/features/overview/pages/overview-page.tsx` · `src/components/ui/number-ticker.tsx` (reuso).

**✅ DoD:**
- Toda ação de escrita da carteira com feedback visual/háptico; `prefers-reduced-motion`/`data-motion` respeitados.
- NumberTicker ativo nos valores principais da posição quando habilitado; desliga sem quebra de layout.
- Hover/focus unificados (mesma linguagem das demais telas — zero classes soltas novas).
- Suíte 100% verde; auditoria axe na carteira sem violações.

### Fase 19 — Inteligência & Consistência dos Insights (Trilha A)

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: smart cards F8 e órfãos do domínio removidos; `normalizeText`/`valuesWithinTolerance`/`ESSENTIAL_CATEGORY_ICONS` como fontes únicas; `numberToCents` canônico substituindo os 8 `toCents` locais; InsightsPage reusa `computeOverview`/`aggregateByWeekday`/helpers compartilhados; tendência significativa exibida nos Diagnósticos; projeções usam o aporte líquido real da carteira.

> **Origem:** auditoria funcional de Insights (2026-08-15) — ver diagnóstico §1.4. Fase de **evolução** (sem reconstruir motores): unifica fontes de verdade, remove repetições/código morto e fecha lacunas entre motores e UI. **Trilha A** (refinamento/consistência) — pode ser executada antes ou depois da Trilha B (P6 = A primeiro; a entrega 6 não depende da F16, `usePortfolioPosition` existe desde a F4).

**Objetivo:** tornar os insights mais inteligentes, precisos, organizados e consistentes — uma única implementação para cada regra, zero código morto e motores 100% aproveitados pela UI.

**Entregas (na ordem):**
1. **Limpeza de código morto F8** — remover `SmartSpendingPaceCard`, `SmartInvoiceProjectionCard`, `SmartAnomaliesCard`, `SavingsHealthCard` + `smart-cards.test.tsx` + exports do barrel (a F12 já os substituiu pelo widget `summary`); remover ou reaproveitar os órfãos `runwayMonths`/`cumulativeBalance` (`runwayMonths` pode virar KPI de meses de reserva na F16/17).
2. **Fonte única de normalização e essencialidade** — `normalizeText` (unifica `normalizeServiceName`/`normalizeKey`), `valuesWithinTolerance` (unifica `hasStableValue`/`hasValuesWithin`; `hasStableValue` delega) e `ESSENTIAL_CATEGORY_ICONS` (essencial ∪ agregadoras — elimina as 3 listas sobrepostas: página, subscriptions, recurrences) em `domain/insights`, com testes de unificação (mesmos resultados dos motores anteriores).
3. **Helper canônico de centavos** — `numberToCents(value)` puro em `domain/money` (com guarda `isFinite`, contrato único); substituir os ~8 `toCents` locais divergentes de features (comportamento consistente para NaN/Infinity).
4. **Reuso de motores na InsightsPage** — `computeOverview` para rendas/despesas/saldo/savings rate (em vez dos reduces inline); `aggregateByWeekday` para o diagnóstico de fim de semana (em vez do bucketing manual ÷5/÷2); helpers `budgetLimitsByCategory`/`spentByCategoryMap` compartilhados com Overview/Budgets; Map de categorias pré-computado (O(n²) → O(n)).
5. **Fechar lacuna de diagnóstico** — exibir tendência significativa (`isSignificantTrend`, §3.7.6 — gastos vs mês anterior > 15%) no aba Diagnósticos (motor pronto, tela não usa).
6. **Consistência com a carteira** — projeções (`dailyBudget`/`endOfMonthProjection`) passam a receber investimentos reais de `usePortfolioPosition` (hoje hardcoded 0), alinhando Insights à Home pós-F16.
7. **Organização de labels** — mover `LEVEL_LABELS` (subscription/recurring/similar) para `src/lib/labels.ts` (hub DRY existente); mensagens de motivo de sugestão de limite via constantes (sem strings soltas).

**Arquivos:** `src/domain/insights/*` (normalize/tolerance/essentials) · `src/domain/savings/index.ts` · `src/domain/money/parse.ts` (+ `numberToCents`) · `src/domain/overview/index.ts` (limpeza de órfãos) · `src/domain/budgets` (helpers compartilhados) · `src/features/insights/pages/insights-page.tsx` · `src/features/budgets/pages/budgets-page.tsx` · `src/features/overview/pages/overview-page.tsx` · remoções em `src/components/modules/` (`smart-*-card.tsx`, `savings-health-card.tsx`, `smart-cards.test.tsx`) + barrel.

**✅ DoD (critérios de aceite):**
- Zero código morto F8: módulos removidos, barrel limpo (nenhum export órfão); `runwayMonths`/`cumulativeBalance` removidos ou reutilizados.
- Uma única implementação de normalização, tolerância de valores e lista de categorias essenciais — verificada por testes de unificação.
- `numberToCents` único em `domain/money` com testes; nenhum `toCents` local restante em features.
- InsightsPage reusa `computeOverview`/`aggregateByWeekday`/helpers compartilhados — sem reduces/bucketing inline duplicados; sem `.find` por item (Map).
- Diagnósticos exibem tendência significativa; projeções usam investimentos reais (consistente com F16).
- Suíte 100% verde (motores unificados + página + auditoria axe); typecheck/lint/build limpos.

### Fase 20 — Sistema de Gestos & Navegação por Swipe (Mobile Gesture UX) (Trilha A)

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: motor puro `src/domain/gestures/swipe.ts` (axis-lock ±30°, flick, activation, boundary resistance — 20 testes); engine `useSwipeNavigation` (máquina idle→tracking→locked→settled, ignoreSelectors, touch/pen + isPrimary, haptics — 13 testes); `MonthSwiper` nas 5 telas de mês (DRY); `Tabs` com prop `swipeable` nas 6 telas de abas; isolamento com `data-swipe-nav-ignore` nos gráficos com scrub (DailyFlowChart, CategoryDonut).

> **Origem:** mapeamento arquitetural e diagnóstico (2026-08-15) — ver §1.5. Navegação horizontal fluida no mobile (meses/períodos e sub-abas) com **rigor técnico absoluto** para evitar falsos positivos e quebra de componentes interativos existentes (Swipe-to-Action de despesas, gráficos com scrub, formulários, modais). **Trilha A** (refinamento mobile-first).

**Objetivo:** engine unificada de gestos reutilizável + integração em navegadores de mês (5 telas) e sub-abas (6 telas), com feedback elástico e isolamento estrito de áreas interativas — **sem regressão** no Swipe-to-Action existente.

**Entregas (na ordem):**
1. **Motor puro de gestos** — `src/domain/gestures/swipe.ts` (funções puras testáveis): `resolveSwipeIntent` (direção/distância/velocidade/flick), `isHorizontalLock(dx, dy, degrees = 30)` (axis-lock ±30°: `|dy| ≤ |dx|·tan(30°)` + saída se `|dy| > |dx|`), `isFlick(velocity > 0.3 px/ms, |dx| ≥ 30px)`, `activationDistance(vw)` (`max(60px, 15% viewport)`) e `boundaryResistance` (elastic overscroll).
2. **Engine unificada `useSwipeNavigation`** — `src/hooks/use-swipe-navigation.ts`: máquina de estado `idle → tracking → locked → settled` com `setPointerCapture` após o lock; `ignoreSelectors` (`input, textarea, select, [role="dialog"], [data-swipe-nav-ignore], .no-swipe-nav, .swipeable-item`); `pointerType` só `touch`/`pen` + `event.isPrimary`; `touch-action: pan-y` no contêiner; callbacks `onDragProgress(offsetPx)`/`onNavigate(previous|next)`/`onBoundary()`; limites `canGoPrevious`/`canGoNext`; haptics (`light` no lock, `warning` na borda) e respeito a `prefers-reduced-motion`/`data-motion`.
3. **Navegação temporal horizontal (`MonthSwiper`)** — módulo `src/components/modules/month-swiper.tsx` que envolve o `MonthPicker` com o swipe (esquerda = próximo mês, direita = anterior), aplicado nas **5 telas** com seletor (Visão Geral, Transações, Cartões, Orçamentos, Relatórios — DRY, uma integração reusada). Borda inferior `month > APP_START_DATE (2026-01)` (spec §4.1); `canGoNext` configurável (padrão: sem limite — paridade com os botões). Transição: translate do conteúdo durante o arrasto + fade-in do novo conteúdo (sem slide fake de dados assíncronos).
4. **Navegação entre sub-abas e filtros** — primitivo `Tabs` ganha prop `swipeable?: boolean` (uma implementação, DRY): swipe na **área de conteúdo** (não no List com `overflow-x-auto`) alterna abas com translate elástico. Aplicado em Insights (4), Relatórios internos (3), Dívidas (2), Orçamentos (2), Carteira (3), Categorias (2). **Desabilitado** em Configurações e no wizard (formulários densos — isolamento).
5. **Proteção e isolamento de componentes de ação rápida** — coexistência garantida com o Swipe-to-Action de despesas (`TransactionRow`/`useSwipeAction`): o engine ignora gestos iniciados em `.swipeable-item`/`[data-swipe-action]` (sem alterar o `useSwipeAction` — engine desacoplado); `data-swipe-nav-ignore` nos gráficos com scrub (`DailyFlowChart`, `CategoryDonut`) e no FAB da calculadora (arrastável); modais Radix são portais (isolamento natural pelo overlay).
6. **Micro-interações de feedback tátil** — elastic drag (rubber-banding com resistência crescente + spring-back animado), haptic `light` ao travar e `warning` na borda (início/fim de dados), `select-none` durante o arrasto (sem seleção de texto), aria-live opcional na mudança de mês/aba.

**Arquivos:** `src/domain/gestures/swipe.ts` (+ testes) · `src/hooks/use-swipe-navigation.ts` (+ testes) · `src/components/modules/month-swiper.tsx` (+ testes) · `src/components/ui/tabs.tsx` (prop `swipeable`) · integrações em `src/features/{overview,transactions,cards,budgets,reports,insights,debts,portfolio,categories}/pages/*` · `data-swipe-nav-ignore` em `daily-flow-chart.tsx`, `category-donut.tsx`, `floating-calculator.tsx`.

**✅ DoD (critérios de aceite):**
- Motor puro com testes: axis-lock ±30° (incl. saída por dominância vertical), thresholds (60px / 15% vw), flick > 0.3 px/ms, boundary/resistência, filtro de ignore selectors.
- Hook com testes de integração (Pointer Events + capture): swipe horizontal → `onNavigate` 1x; rolagem vertical → não navega; swipe sobre `.swipeable-item` (TransactionRow), `input` e modal → não navega; overscroll na borda → spring-back **sem** navegação.
- `MonthSwiper` nas 5 telas de mês (uma integração reusada — DRY); `Tabs swipeable` nas 6 telas de abas; Configurações/wizard sem swipe (isolamento verificado).
- **Zero regressão** no Swipe-to-Action: testes existentes de `useSwipeAction` verdes + novo teste de coexistência.
- `prefers-reduced-motion`/`data-motion` respeitados; axe sem violações; typecheck/lint/build limpos; suíte 100% verde.
- Revisão manual em dispositivo real (iOS Safari + Chrome Android): thumb drift em scroll rápido, coexistência com exclusão de despesas e bordas de mês — matriz em `RELEASE.md`.

### Fase 26 — Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX) (Trilha A) — ✅ Concluída (2026-08-15)

> **Origem:** diagnóstico arquitetural (2026-08-15) — ver §1.6. Substituição do botão lateral flutuante legado (`ScrollToTopButton`) por gesto de overscroll vertical no final da rolagem, garantindo zero interferência visual na interface móvel e eliminação de disparos involuntários. **Status:** implementada e verificada (ver `ROADMAP.md` §3, F26 — progresso).

**Objetivo:** engine de overscroll no rodapé (`usePullUpToTop`) com curva de resistência elástica, barreira estrita contra inércia/momentum scrolling, máquina de estados finitos com cancelamento dinâmico e micro-indicador minimalista integrado ao tema ativo.

**Entregas (na ordem):**
1. **Motor puro de física e overscroll (`src/domain/gestures/overscroll.ts`):** `computePullDistance` (curva elástica logarítmica com damping), `isAtScrollBottom` (tolerância de 2px) e `evaluatePullIntent` (threshold de 80px).
2. **Engine gestual `usePullUpToTop` (`src/hooks/use-pull-up-to-top.ts`):** listeners Touch/Pointer sobre o contêiner `main`; barreira de dois tempos (repouso estático obrigatório no rodapé antes de iniciar o overscroll); cancelamento dinâmico ao recuar o dedo antes de soltar (`touchend`); disparo suave `main.scrollTo({ top: 0, behavior: 'smooth' })`.
3. **Micro-indicador visual `PullUpToTopIndicator` (`src/components/ui/pull-up-to-top-indicator.tsx`):** micro-componente vetorial sutil no rodapé (seta + arco de progresso SVG), estilizado exclusivamente com tokens (`stroke-primary`/`text-primary`), decorativo (`pointer-events-none` + `aria-hidden`) e posicionado com `z-sticky` acima da BottomNav fixa.
4. **Feedback háptico & transição:** pulso tátil leve (`light`) no disparo do threshold; suporte estrito a `prefers-reduced-motion` e `data-motion`.
5. **Descontinuação do botão flutuante legado:** remoção de `<ScrollToTopButton />` de `src/app/router.tsx`, limpeza de seletores CSS em `src/styles/globals.css`.

**Arquivos:** `src/domain/gestures/overscroll.ts` (+ testes) · `src/hooks/use-pull-up-to-top.ts` (+ testes) · `src/components/ui/pull-up-to-top-indicator.tsx` (+ testes) · `src/components/layout/page-shell.tsx` · `src/app/router.tsx` · `src/styles/globals.css`.

**✅ DoD (critérios de aceite):**
- Motor puro com testes unitários cobrindo curva de resistência, detecção de rodapé e threshold.
- Inércia rápida (fling) no final da página verificada: não arma o gatilho sem segundo toque estático intencional.
- Cancelamento dinâmico verificado: retrair o dedo desfaz o gatilho sem rolar a página.
- Micro-indicador visual integrado ao tema ativo, sem overflow nem colisão com BottomNav fixa.
- Suíte 100% verde; typecheck e lint limpos.

---

## 3. TRILHA B — MÓDULO DE CARTEIRA DE INVESTIMENTOS (INTEGRAÇÃO COMPLETA)

> Base: Fase 4 já entregou ledger, valoração, metas e calculadora. A Trilha B **integra a carteira ao restante do app** e entrega o dashboard executivo. **Backend:** sem migrations novas para 90% do escopo — `portfolio_transactions` já suporta proventos e a posição é derivada; modelagem extra apenas para "proventos provisionados" (§3.3).

### Fase 16 — Carteira na Home (KPI real + widget de alocação)

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: KPI "Investimentos" real (aportes líquidos do mês, sparkline + DeltaHint) com deep-link acessível; motor puro `allocationByClass` (4 testes) e `AllocationDonut` (2 testes) — **decisão do produto: sem widget na Home**; o donut foi integrado na aba Posição da Carteira e fica pronto para a F17.

**Objetivo:** eliminar o stub "Carteira na Fase 4" e dar visibilidade imediata do investimento no Início.

**Entregas:**
1. **KPI "Investimentos" real** — `usePortfolioPosition().totalBRL` no lugar de `totals.investmentCents` (0); sparkline de patrimônio (série mensal derivada, F8 padrão) e hint contextual (nº de ativos / fonte dos preços).
2. **Widget "Carteira em resumo"** na Home (gated por `dashboardWidgets` — F11): patrimônio total, caixa derivado, nº de ativos e **mini-donut de alocação por classe** (reuso do padrão `CategoryDonut` → novo módulo `AllocationDonut` genérico de ativos).
3. **Deep-link** — clique no KPI/widget → `/investments` (ou `/carteira`).
4. **Estados** — loading (SkeletonKpi), vazio (EmptyState "Sem investimentos" com CTA "Adicionar ativo" → wizard/`/carteira`), erro (gateway + retry) — Online First.

**Arquivos:** `src/features/overview/pages/overview-page.tsx` · `src/components/modules/allocation-donut.tsx` (novo) · `src/domain/overview` (extensão pura p/ série de patrimônio, + testes).

**✅ DoD:**
- Nenhum texto "Fase 4"/stub de carteira na Home — KPI com valor real e estados completos.
- Donut de alocação por classe com paleta da marca (AA) e legenda acessível; axe sem violações.
- Série de patrimônio (para sparkline) é função pura testada (derivada do ledger + preços).
- Widget respeita a modulação do dashboard (Configurações > Dashboard).

### Fase 17 — Dashboard de Investimentos (`/investments`)

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: rota `/investments` (lazy + `nav-items`) com KPIs executivos (patrimônio com Δ, rentabilidade ponderada, proventos do mês, ativos), donuts por classe e por ativo (DRY sobre `AllocationDonut`/`CategoryDonut`), tabela de posições com ordenação acessível (`aria-sort`) e estados loading/vazio/erro completos (axe sem violações).

> **Unificação da Carteira (decisão do produto, 2026-08-15):** a área de investimentos virou **área única** — `/investments` é o **hub** com abas **Resumo** (consolidação executiva + operação: KPIs, donuts, tabela, cadastro de ativo e movimentação — absorve a página F17), **Metas** e **Aporte** (reuso de `TargetsTab`/`AporteTab`). `/carteira` virou **redirect** para `/investments` (deep-links preservados) e o item "Carteira" saiu da navegação. A exportação geral de dados (antiga "aba Relatório" da carteira) foi entregue na **F22** (✅ Concluída — ver `ROADMAP.md` §3).

> **CRUD completo de ativos e lançamentos (2026-08-15):** usuário com controle total — **editar/excluir** ativos (cascata de transações/metas no banco) e lançamentos (extrato `TransactionListDialog` com edição/exclusão por linha), via `update/deletePortfolioAsset`/`Transaction` (repository + state) e `AssetFormDialog`/`TransactionFormDialog` em modo edição com `ConfirmDialog` — ver `ROADMAP.md` §3 (F17).

**Objetivo:** área única de consolidação de investimentos — colocar ativos, verificar limites (metas), rebalancear (aporte) e acompanhar a posição (resumo), organizada por abas internas.

**Entregas:**
1. **Rota `/investments`** — nova página no `appRoutes` + item de navegação (nav-items; slot no menu "Mais" se necessário).
2. **KPIs executivos** — Patrimônio Total, Rentabilidade da Carteira (ponderada pelo valor, derivada dos unrealizedPct por ativo), Proventos no mês (recebidos) e Alocação por Classe (top classes).
3. **Gráfico de distribuição patrimonial** — donut/rosca **por classe de ativo** e **por ticker** (SVG próprio, padrão `CategoryDonut` — sem libs novas).
4. **Tabela de posições avançada** — PM (custo médio), quantidade, valor de mercado, **Lucro/Prejuízo não realizado (R$ e %)**, fonte do preço (manual/api/fallback com badge) e peso na carteira — com ordenação e densidade.
5. **Acessos rápidos** — botões para ir a `/carteira` (registrar transação, metas, aporte).

**Arquivos:** `src/features/investments/` (novo — `pages/`, `components/`, `index.ts` seguindo o padrão de feature do `PROJECT_STRUCTURE.md` §5) · `src/app/routes.ts` · `src/components/layout/nav-items.tsx` · `src/domain/portfolio` (motores de agregados puros + testes).

**✅ DoD:**
- `/investments` com KPIs, 2 donuts (classe e ticker), tabela com lucro/prejuízo e rentabilidade — todos derivados no domínio (funções puras testadas).
- Deep-link da Home chega à tela correta; navegação (sidebar/bottom/menu Mais) consistente — sem rotas duplicadas (fonte única `nav-items`).
- Estados loading/vazio/erro completos; axe sem violações; 3 temas × acentos consistentes.
- Suíte 100% verde (incl. testes dos motores de agregado).

### Fase 18 — Proventos: Extrato, Calendário & Provisionados

> **Status: ✅ concluída (2026-08-15)** — ver progresso detalhado no `ROADMAP.md` §3. Resumo: motor puro `domain/portfolio/dividends.ts` (7 testes — `isDividendType`, `dividendsInMonth` movido de `summary.ts` como fonte única, `dividendExtractForMonth` reconciliado, `dividendsByYear`), aba **Proventos** no hub `/investments` (MonthPicker, KPIs mês/ano, extrato mensal com ticker/data/tipo, calendário anual clicável com `aria-pressed`, estados loading/vazio/erro; axe sem violações). **Provisionados fora do escopo** (decisão F18 — ajuste futuro sob demanda).

**Objetivo:** dar visibilidade total dos rendimentos da carteira — recebidos e esperados.

**Entregas:**
1. **Extrato de proventos recebidos** — agregação de `portfolio_transactions` (`dividend`/`jcp`/`fii_yield`) por mês e por ativo (o ledger já separa `dividends`); lista com valores, datas e totais.
2. **Calendário de proventos** — visão mensal (reuso de `MonthPicker` + lista ordenada); destaque do mês atual.
3. **Proventos provisionados (modelagem)** — decisão de escopo: estimativa por histórico (ex.: média dos últimos 3 meses por ativo) ou campo opcional de provento futuro no ativo. **Requere migration nova** (ex.: coluna `projected_dividend_monthly` em `portfolio_assets` ou tabela `dividend_schedule`) — **sujeito ao §4-P4**.
4. **Integração com o app** — opcional: proventos recebidos aparecerem como renda [PROVENTO] no fluxo financeiro (decisão §4-P5; fora do fluxo financeiro core hoje).

**Arquivos:** `src/domain/portfolio/dividends.ts` (motor puro + testes) · `src/features/investments/` (aba "Proventos") · migration condicional (§4-P4).

**✅ DoD:**
- Extrato mensal correto (soma por mês = transações de provento, reconciliado por teste).
- Calendário com navegação mensal e estado vazio acolhedor.
- Provisionados (se aprovado): estimativa/marcação explícita na UI com rótulo "provisionado" e fonte dos dados.
- Suíte 100% verde; axe sem violações.

---

## 4. PERGUNTAS DE ALINHAMENTO TÉCNICO

> Respostas definem detalhes das fases 16–18 antes da inserção no ROADMAP.

| # | Pergunta | Opções | Impacto |
|---|---|---|---|
| P1 | **Cotações:** a edge function (F1.7, Yahoo) + preço manual já cobrem a valoração. Manter esse pipeline como fonte primária? | a) Sim — edge function + manual (recomendado) · b) Só manual | Determina se F1.7 (deploy/cron) é pré-requisito da F16 |
| P2 | **Gráficos:** o projeto usa SVG próprio (`Sparkline`, `CategoryDonut`, `DailyFlowChart`) sem libs. Manter SVG próprio no dashboard de investimentos ou adotar lib (ex.: Recharts)? | a) SVG próprio (recomendado — DRY, zero bundle) · b) Recharts/visx | Define o padrão dos donuts da F16/17 |
| P3 | **Rota:** `/investments` como tela nova de leitura, mantendo `/carteira` para operação (cadastro/metas/aporte)? | a) Nova `/investments` (recomendado) · b) Unificar tudo em `/carteira` | Define arquitetura da F17 e navegação — **SUPERADA (2026-08-15):** decisão de **área única** — `/investments` é o hub (abas Resumo/Metas/Aporte) e `/carteira` virou redirect |
| P4 | **Proventos provisionados (F18):** modelar estimativa no banco (migration) ou apenas exibir recebidos? | a) Apenas recebidos (escopo mínimo) · b) Estimar por histórico (sem migration) · c) Campo/tabela de provisionados (migration) | Define se há migration nova e o escopo da F18 |
| P5 | **Integração financeira:** proventos recebidos devem entrar como renda no fluxo mensal (Home/Relatórios)? | a) Sim, lançamento automático [PROVENTO] · b) Não, ficam só na carteira (recomendado — fora do fluxo financeiro core, D11 preservado) | Escopo e RPCs envolvidos |
| P6 | **Prioridade de execução:** trilha A (F14–15) antes da B (F16–18)? | a) Sim, A primeiro (conforme estratégia) · b) Intercalar (ex.: F14 → F16 → F15 → …) | Ordem das fases no ROADMAP |

---

## 5. ORDEM SUGERIDA E MAPEAMENTO

```
F14 (Consistência de Estados & Ergonomia)  ← Trilha A — PRIORITÁRIA (✅ Concluída)
F15 (Micro-Interações & Conforto Visual)   ← Trilha A (✅ Concluída)
F19 (Inteligência & Consistência dos Insights) ← Trilha A (✅ Concluída)
F20 (Swipe Navigation & Gesture UX)        ← Trilha A (✅ Concluída)
F16 (Carteira na Home — KPI real)          ← Trilha B (✅ Concluída)
F17 (Dashboard /investments)               ← Trilha B (✅ Concluída)
F18 (Proventos)                            ← Trilha B — depende de P4/P5 (✅ Concluída)
F21 (Inteligência de Entrada)              ← Trilha C (✅ Concluída)
F22 (Central de Exportação & Backup)       ← Trilha C (✅ Concluída)
F23 (Engenharia de Performance 3D)         ← Trilha C (✅ Concluída)
F24 (Planejamento Financeiro FIRE)         ← Trilha C (✅ Concluída)
F25 (Micro-interações & Ergonomia)         ← Trilha A (✅ Concluída)
F26 (Pull-up Overscroll to Top)            ← Trilha A / Gesture UX (✅ Concluída)
F27 (Insights: Precisão & Deduplicação)    ← Trilha A / Inteligência (✅ Concluída)
F28 (Investimentos Mobile Responsive)      ← Trilha A / Mobile Polish (✅ Concluída)
```

**Pré-requisitos transversais:** suíte 1084 testes verde + typecheck/lint/build (CI `ci.yml`) · deploy F1.7 (edge function + cron) se P1 = (a) · sem migrations obrigatórias fora de P4 = (c).

**Referências:** `docs/ROADMAP.md` (F0–F13, F14–F26) · `docs/ARCHITECTURE.md` (camadas) · `docs/PROJECT_STRUCTURE.md` (onde criar) · `docs/DESIGN_SYSTEM.md` (visual) · `docs/RELEASE.md` (QA/corte).

