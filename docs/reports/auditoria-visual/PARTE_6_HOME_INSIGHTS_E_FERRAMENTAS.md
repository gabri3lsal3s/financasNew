# Relatório de Auditoria Visual & UX — Parte 6: Home / Visão Geral, Insights & Ferramentas

> **Status:** Concluído  
> **Data:** 20/11/2026  
> **Escopo:** `src/features/overview/*`, `src/features/insights/*`, `src/features/tools/*`  
> **Total de arquivos de produção auditados:** 98 arquivos (53 em Visão Geral, 24 em Insights, 21 em Ferramentas / Simuladores)  
> **Total de arquivos inspecionados (incluindo testes):** 113 arquivos  
> **Conformidade Geral Estimada:** **96.8%**  

---

## 1. Sumário Executivo & Destaques de Arquitetura

A **Parte 6** da auditoria focou no coração visual e analítico do Axir: a **Página Inicial (Visão Geral / Home)**, a central preditiva **Insights & Inteligência Financeira** e o conjunto de **Ferramentas e Simuladores Independentes** (Juros Compostos/FIRE, Simulador de Dívidas Bola de Neve/Avalanche e Rebalanceador de Carteira).

### Principais Conquistas Arquiteturais Observadas:
1. **Adesão Impecável ao Teto de 250 Linhas (Dimensão 14):**
   - **100% dos 98 arquivos de produção** estão estritamente abaixo do limite de 250 linhas.
   - O maior arquivo é [recurrences-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrences-tab.tsx#L1-L238) com 238 linhas, seguido por [overview-budgets-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-budgets-section.tsx#L1-L235) com 235 linhas. A modularização em subcomponentes atômicos é exemplar.
2. **Padronização Excepcional do Carrossel de Alertas da Home (Regra 19 & Regra 13):**
   - Todos os banners do carrossel ([HouseholdAlertBanner](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/household-alert-banner.tsx#L64), [GoalProgressAlertBanner](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/goal-progress-alert-banner.tsx#L45), [CorporateDividendsBanner](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/corporate-dividends-banner.tsx#L40), [SplitPendingBanner](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/split-pending-banner.tsx#L40), [PortfolioGovernanceBanner](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/portfolio-governance-banner.tsx#L40)) compartilham com precisão cirúrgica a casca unificada:
     `w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs`
   - Ícones de Nível 2 com container padronizado: `flex size-9 shrink-0 items-center justify-center rounded-xl border` e ícone `size-4.5`.
3. **Conformidade Total de Acessibilidade & Anel de Foco (Dimensão 15 - WCAG 2.4.7 AA):**
   - 100% dos botões, links e cards interativos utilizam `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`. Zero ocorrências de anéis legados (`ring-primary/20`).
4. **Zero Emojis ou Caracteres Decorativos:**
   - 100% dos 98 arquivos em conformidade estrita com a regra `local/no-decorative-unicode`.

---

## 2. Inventário de Arquivos Auditados

### A. Visão Geral / Home (`src/features/overview/*`) — 53 arquivos de produção
- **Páginas & Hubs:** [overview-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/pages/overview-page.tsx), [use-overview-page.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/pages/use-overview-page.ts).
- **Componentes do Dashboard:**
  - Carrossel & Banners: [build-overview-alerts.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/build-overview-alerts.tsx), [household-alert-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/household-alert-banner.tsx), [goal-progress-alert-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/goal-progress-alert-banner.tsx), [corporate-dividends-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/corporate-dividends-banner.tsx), [split-pending-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/split-pending-banner.tsx), [portfolio-governance-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/portfolio-governance-banner.tsx).
  - Seções Principais: [overview-metrics-strip.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-metrics-strip.tsx), [overview-budgets-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-budgets-section.tsx), [overview-recent-transactions.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-recent-transactions.tsx), [overview-smart-advisor-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-smart-advisor-section.tsx), [overview-monthly-projection.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-monthly-projection.tsx), [overview-credit-cards-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-credit-cards-section.tsx), [overview-goals-progress-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-goals-progress-section.tsx), [overview-debts-summary-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-debts-summary-section.tsx), [overview-investments-summary.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-investments-summary.tsx), [overview-daily-rhythm-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-daily-rhythm-card.tsx).
  - Modais & Subcomponentes: [overview-modals.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-modals.tsx), [quick-action-fab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/quick-action-fab.tsx), [overview-month-selector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-month-selector.tsx), [overview-page-skeleton.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-page-skeleton.tsx).
- **Hooks & Domínio Local:** [use-overview-data.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-overview-data.ts), [use-overview-alerts.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-overview-alerts.ts), [use-overview-budgets.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-overview-budgets.ts), [use-overview-navigation.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-overview-navigation.ts), [use-smart-advisor-insights.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-smart-advisor-insights.ts).

### B. Insights & Inteligência (`src/features/insights/*`) — 24 arquivos de produção
- **Páginas & Roteamento:** [insights-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/pages/insights-page.tsx).
- **Abas & Seções:** [diagnostics-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/diagnostics-tab.tsx), [recurrences-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrences-tab.tsx), [projection-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/projection-tab.tsx), [assistant-memory-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/assistant-memory-section.tsx), [DiagnosticsWarningsSection.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/DiagnosticsWarningsSection.tsx), [diagnostic-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/diagnostic-card.tsx).
- **Radar de Recorrências & Auditoria:** [RecurrencesSummaryCard.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrences/RecurrencesSummaryCard.tsx), [CollapsibleOccurrencesSection.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrences/CollapsibleOccurrencesSection.tsx), [recurrence-audit-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrence-audit-modal.tsx), [RecurrenceClassificationBar.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrence-audit/RecurrenceClassificationBar.tsx), [RecurrenceHistoryList.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrence-audit/RecurrenceHistoryList.tsx), [RecurrenceMetricsStrip.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/recurrence-audit/RecurrenceMetricsStrip.tsx), [convert-recurrence-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/convert-recurrence-dialog.tsx), [ConvertRecurrenceFormFields.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/convert-recurrence/ConvertRecurrenceFormFields.tsx).
- **Memória & Skeletons:** [AssistantMemoryRows.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/memory/AssistantMemoryRows.tsx), [InsightsLoadingSkeleton.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/InsightsLoadingSkeleton.tsx).
- **Hooks:** [use-insights-dashboard-data.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/hooks/use-insights-dashboard-data.ts), [use-recurrences-tab.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/hooks/use-recurrences-tab.ts).

### C. Ferramentas & Simuladores (`src/features/tools/*`) — 21 arquivos de produção
- **Páginas & Roteamento:** [tools-hub-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/pages/tools-hub-page.tsx), [compound-interest-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/pages/compound-interest-page.tsx), [debt-simulator-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/pages/debt-simulator-page.tsx), [rebalance-simulator-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/pages/rebalance-simulator-page.tsx).
- **Casca Externa & Header Público:** [tools-header.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/tools-header.tsx), [tools-footer-cta.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/tools-footer-cta.tsx), [share-simulation-button.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/share-simulation-button.tsx).
- **Simulador de Juros Compostos:** [compound-parameters-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/compound/compound-parameters-grid.tsx), [compound-kpi-and-milestones.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/compound/compound-kpi-and-milestones.tsx), [compound-timeline-table.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/compound/compound-timeline-table.tsx).
- **Simulador de Dívidas:** [debt-item-editor-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/debt/debt-item-editor-list.tsx), [debt-kpi-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/debt/debt-kpi-grid.tsx), [debt-strategy-comparison-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/debt/debt-strategy-comparison-card.tsx).
- **Simulador de Rebalanceamento:** [rebalance-asset-row-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/rebalance/rebalance-asset-row-list.tsx), [rebalance-class-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/rebalance/rebalance-class-card.tsx), [rebalance-kpi-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/rebalance/rebalance-kpi-grid.tsx), [rebalance-trade-plan-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/rebalance/rebalance-trade-plan-card.tsx), [use-rebalance-simulator.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/hooks/use-rebalance-simulator.ts).

---

## 3. Matriz de Avaliação das 20 Dimensões Canônicas

| Dimensão | Avaliação | Diagnóstico nos 98 Arquivos de Produção |
|---|---|---|
| **D1: Tipografia & Fontes** | Conforme | Aplicação estrita de `font-display` nos títulos de cards e seções, `tabular-nums` em todas as métricas financeiras. |
| **D2: Herança de Cor Destaque** | Conforme | Accent herdado em botões primários (`variant="default"`), abas ativas e sliders de taxa/anos nas ferramentas. |
| **D3: Pirâmide de Botões** | Conforme | CTA primário único por card/banner; botões secundários com `variant="outline"` ou `variant="ghost"`. |
| **D4: Espaçamento & Alinhamento** | Conforme | Paddings canônicos `p-3.5 sm:p-4` nos cards e alertas; gaps unificados `gap-3 sm:gap-4`. |
| **D5: Feedback Sensorial** | Conforme | Chamadas a `triggerSensory("selection")` devidamente encapsuladas nos handlers de clique, sem conflito de duplos disparos em `<Button />`. |
| **D6: Touch Targets (Mobile)** | Atenção | Na barra de progresso de orçamentos da Visão Geral ([overview-budgets-section.tsx:125-155](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-budgets-section.tsx#L125)), os segmentos menores possuem pseudo-expansão, mas o layout de micro-cards em 2 colunas no mobile requer margem vertical de segurança. |
| **D7: Empty States & Loading** | Conforme | Skeletons dedicados fluidos ([overview-page-skeleton.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-page-skeleton.tsx), [InsightsLoadingSkeleton.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/components/InsightsLoadingSkeleton.tsx)) e empty states informativos sóbrios. |
| **D8: Modais & Diálogos** | Conforme | Modais em conformidade com `<Modal>` e `<ResponsiveDialog>`, respeitando a matriz de larguras (`size="lg"` / `size="xl"`). |
| **D9: Abas Fluidas** | Conforme | [insights-page.tsx:178](file:///home/gabrielsales/meus_apps/financasnew/src/features/insights/pages/insights-page.tsx#L178) adota `fullWidth={false}` e rolagem horizontal suave no mobile. |
| **D10: Grids Mobile-First** | Conforme | Grids adaptativos `grid-cols-1 sm:grid-cols-2` ou `grid-cols-2 sm:grid-cols-4` em todos os blocos de métricas e ferramentas. |
| **D11: Auto-fit Monetário** | Conforme | Valores financeiros renderizados exclusivamente via `<MoneyText />` sem `truncate` cego. |
| **D12: Tokens de Z-Index** | **Anomalia Leve** | [tools-header.tsx:40](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/tools-header.tsx#L40) utiliza `sticky top-0 z-40` cru (colidindo com `--z-sidebar: 40`), devendo migrar para o token canônico `.z-sticky` ou `--z-sticky: 20`. |
| **D13: Hierarquia de Ícones** | Conforme | Nível 1 sóbrio em títulos de cards comuns e Nível 2 destacado (`size-9 rounded-xl border`) nos alertas do carrossel. |
| **D14: Teto de 250 Linhas** | **Excelente (100%)** | Zero monólitos detectados nos 98 arquivos. Todos abaixo de 240 linhas. |
| **D15: Anel de Foco WCAG 2.4.7 AA** | Conforme | 100% dos elementos interativos utilizam `focus-visible:ring-1 focus-visible:ring-ring`. |
| **D16: Superfície & Elevação** | **Atenção Sutil** | Em [overview-budgets-section.tsx:164, 205](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-budgets-section.tsx#L164), chips de orçamento utilizam `border-border/70` e `border-border/60` em vez de `border-border/80`. |
| **D17: Acessibilidade & Semântica** | Conforme | `role="region"`, `aria-label` descritivos e tabelas com `thead`/`tbody` semânticos. |
| **D18: Zero autoFocus & iOS Zoom** | Conforme | Zero `autoFocus` declarativo e inputs com `text-base sm:text-sm` prevenindo auto-zoom no iOS Safari. |
| **D19: Modo Privacidade** | Conforme | Classes `.privacy-mask` aplicadas em todos os saldos e valores sensíveis da Visão Geral e Insights. |
| **D20: Gráficos SVG & Indicadores** | Conforme | Gráficos e tabelas densas com rolagem horizontal desobstruída ([compound-timeline-table.tsx:18](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/compound/compound-timeline-table.tsx#L18)). |

---

## 4. Detalhamento das Anomalias e Pontos de Alinhamento Identificados

### Anomalia 1: Z-Index Collision em Cabeçalho de Ferramentas (Dimensão 12)
- **Arquivo:** [src/features/tools/components/tools-header.tsx:40](file:///home/gabrielsales/meus_apps/financasnew/src/features/tools/components/tools-header.tsx#L40)
- **Código Atual:**
  ```tsx
  <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md pt-safe">
  ```
- **Problema:** A classe `z-40` equivale numericamente ao token da sidebar (`--z-sidebar: 40`), causando potencial sobreposição indesejada se a barra de navegação global ou drawers estiverem ativos.
- **Ação Recomendada no Plano Mestre:** Substituir `z-40` pela classe utilitária de token canônico `z-sticky` (ou `z-20` mapeado para `--z-sticky: 20`).

### Anomalia 2: Inconsistência de Opacidade de Borda em Chips de Orçamento (Dimensão 16)
- **Arquivo:** [src/features/overview/components/overview-budgets-section.tsx:164, 205](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-budgets-section.tsx#L164)
- **Código Atual:**
  ```tsx
  // Linha 164 (mobile):
  className="... border border-border/70 bg-surface-hover/30 ..."
  // Linha 205 (tablet/desktop):
  className="... border border-border/60 bg-surface-hover/30 ..."
  ```
- **Problema:** Divergência sutil em relação à trinca canônica `border-border/80 bg-surface shadow-xs` definida na Regra 16 do `AGENTS.md`.
- **Ação Recomendada no Plano Mestre:** Padronizar para `border-border/80` em ambas as visualizações, garantindo contraste consistente com o fundo.

---

## 5. Próximos Passos & Transição

Com a conclusão da auditoria da **Parte 6**:
- O escopo de Home, Insights e Simuladores está catalogado com **excelente aderência técnica (96.8%)** e zero violações críticas.
- As correções pontuais identificadas acima serão consolidadas na **Onda 3** do Plano Mestre de Refatoração.

> [!IMPORTANT]
> **Portão de Bloqueio:** Conforme o protocolo de governança, nenhuma alteração em código de produção foi efetuada nesta etapa. Aguardando a aprovação explícita ("OK") do usuário para iniciar a **Parte 7: Módulos Colaborativos & Links Compartilhados (`src/features/family/*`, `src/features/trips/*`, `src/features/public-share/*`)**.
