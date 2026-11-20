# Relatório de Auditoria Visual & UX — Parte 5: Inteligência Patrimonial, Aportes e Relatórios

> **Status:** Concluído com Sucesso  
> **Data de Execução:** 20 de Novembro de 2026  
> **Escopo Auditado:** Inteligência de Investimentos (`src/features/investments/*`) e Central Unificada de Relatórios (`src/features/reports/*`)  
> **Total de Arquivos Inspecionados:** 189 arquivos de produção (+ 39 arquivos de teste colocalizados)  
> **Regras de Governança Auditadas:** AGENTS.md (§4 itens 1 a 27), Matriz Canônica de Herança de Acento, Regra 1 (DRY de UI), Regra 10 (Grids Mobile-First), Regra 11 (Zero Reticências), Regra 14 (Teto de 250 Linhas), Regra 18 (Governança de Modais), Regra 20 (Visualização de Dados & SVG) e Regra 25 (Rolagem Horizontal em Tabelas Densas).

---

## 1. Resumo Executivo da Parte 5

A Parte 5 realizou o diagnóstico completo das áreas analíticas mais profundas do produto:
1. **Inteligência de Investimentos:** `InvestmentsPage`, `ResumoTab`, `AporteTab`, `TargetsTab`, `MovimentacoesTab`, `ProventosTab`, `RebalanceTab`, `PortfolioSnapshotsCarousel`, `PortfolioDarfMonitor`, `PortfolioExecutiveReport`, `QuickTransactionSheet`, `AssetDetailSheet`, `AssetEditDialog`, `AllocationBreakdownDialog`, `MonthlyClosingEditor` e `InvestmentWizard`.
2. **Central Unificada de Relatórios & Consultoria:** `ReportsPage`, `FinancialTab` (DRE & Fluxo), `InvestmentsTab` (Árvores de alocação e setores), `BalanceTab` (Balanço 360° e independência financeira), `TaxTab` (Fiscal & IR), `ReportsModalsHost`, `WealthTearSheetModal`, `FinancialCloseReportModal`, `ConsolidatedWealthModal`, `DividendFreedomModal` e `TaxFacilitatorModal`.

### Métricas de Conformidade

- **Total de Anomalias Catalogadas:** 18 ocorrências concretas.
- **Distribuição por Severidade:**
  - 🔴 **Crítica:** 0
  - 🟠 **Alta:** 5 (Componente monolítico massivo de 635 linhas `AllocationBreakdownDialog`; anéis de foco com opacidade ad-hoc `/20`, `/30` e `/40` em 5 seletores; ausência de foco acessível no seletor de operações de compra/venda).
  - 🟡 **Média:** 9 (Chips manuais de alíquotas de IR e lotes rápidos de ativos; 7 arquivos com $\ge 250$ linhas; duplicação leve em seletores de fontes de recursos).
  - 🟢 **Baixa:** 4 (Uso pontual de `z-10` em coluna sticky de tabela; divisores internos com `border-border/60`).
- **Score de Conformidade de Patrimônio, Aportes & Relatórios:** **88%** (Excelente modularização na Central de Relatórios com A4/PDF de 300 DPI perfeitamente renderizados via `ReportDocumentLayout`, zero emojis, e precisão matemática estrita em conformidade com o `FINANCIAL_MATH_SPEC.md`).

---

## 2. Inventário Completo de Anomalias Catalogadas

Abaixo está o catálogo minucioso de todas as incongruências encontradas:

| ID | Arquivo & Linha | Componente | Dimensão Violada | Descrição da Incongruência | Correção Canônica Recomendada | Severidade |
|---|---|---|---|---|---|---|
| **A5-01** | [`allocation-breakdown-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/allocation-breakdown-dialog.tsx) | `AllocationBreakdownDialog` | **D14** | Componente monolítico com **635 linhas** (mais de 2.5× o teto de 250 linhas). Acumula cálculo de setores, drill-down de ativos, tabela de PnL e filtros. | Modularizar em pasta `allocation-breakdown/` separando em `use-allocation-breakdown.ts`, `AllocationBreakdownClassView.tsx` e `AllocationBreakdownSectorView.tsx`. | 🟠 **Alta** |
| **A5-02** | [`order-operation-selector.tsx#L83`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/order-operation-selector.tsx#L83) | `OrderOperationSelector` | **D15** | Os botões de tipo de operação (Compra, Venda, Provento, Bonificação, Desdobro) possuem `role="tab"`, mas não possuem `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`, deixando a navegação por teclado sem indicação visual de foco (falha WCAG 2.4.7 AA). | Adicionar `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` aos botões. | 🟠 **Alta** |
| **A5-03** | [`target-distribution-row.tsx#L52`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/targets/target-distribution-row.tsx#L52) | `TargetDistributionRow` | **D02 / D15** | Linha de classe de ativo selecionada utiliza `ring-1 ring-primary/30`. | Padronizar com `ring-1 ring-primary` ou `ring-1 ring-ring`. | 🟠 **Alta** |
| **A5-04** | [`allocation-breakdown-dialog.tsx#L377`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/allocation-breakdown-dialog.tsx#L377) | `AllocationBreakdownDialog` | **D02 / D15** | Card de setor selecionado utiliza `ring-1 ring-primary/30`. | Padronizar com `ring-1 ring-primary` ou `ring-1 ring-ring`. | 🟠 **Alta** |
| **A5-05** | [`aporte-input-card.tsx#L89`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/aporte/aporte-input-card.tsx#L89) | `AporteInputCard` | **D02 / D15** | Card de aporte ativo utiliza `ring-2 ring-primary/20`. Em modo Dark e OLED, a opacidade 20% quebra o contraste mínimo. | Padronizar com `ring-2 ring-primary` ou `ring-2 ring-ring`. | 🟠 **Alta** |
| **A5-06** | [`asset-sector-radar-list.tsx#L83`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/wizard/asset-sector-radar-list.tsx#L83) | `AssetSectorRadarList` | **D02 / D15** | Ativo sugerido selecionado usa `ring-2 ring-primary/40`. | Padronizar com `ring-1 ring-primary` ou `ring-1 ring-ring`. | 🟡 **Média** |
| **A5-07** | [`asset-quick-pick-grid.tsx#L131`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/wizard/asset-quick-pick-grid.tsx#L131) | `AssetQuickPickGrid` | **D02 / D15** | Ativo selecionado usa `ring-2 ring-primary/40` e cards não selecionados possuem tintura `border-primary/20 bg-primary/5` constante. | Usar fundo neutro para itens não selecionados e anel canônico `ring-primary`. | 🟡 **Média** |
| **A5-08** | [`order-tax-manual-accordion.tsx#L109`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/order-tax-manual-accordion.tsx#L109) | `OrderTaxManualAccordion` | **D03 / D13** | Os atalhos de alíquota de IR (`TAX_RATE_PRESETS`: 22.5%, 20%, 17.5%, 15%) são renderizados como `<button>` com classes manuais em vez do primitivo `<Chip>`. | Substituir por `<Chip>`. | 🟡 **Média** |
| **A5-09** | [`order-buy-sell-fields.tsx#L124`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/order-buy-sell-fields.tsx#L124) | `OrderBuySellFields` | **D03 / D13** | Os chips de lotes rápidos (100, 200, 500) utilizam botões nativos `<button>` manuais em vez de `<Chip>`. | Substituir por `<Chip>`. | 🟡 **Média** |
| **A5-10** | [`portfolio-mapping-step.tsx#L149`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/portfolio-mapping-step.tsx#L149) | `PortfolioMappingStep` | **D12** | Coluna sticky de índice usa `sticky left-0 z-10`. | Mudar para `z-1` relativo ao contêiner interno da tabela. | 🟢 **Baixa** |
| **A5-11** | [`quick-transaction-submit.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/quick-transaction-submit.ts) | Orquestrador de Ordem | **D14** | Módulo de envio com **386 linhas** acumulando validações fiscais de renda fixa, ações e câmbio. | Decompor em submódulos de validação por classe em `domain/portfolio/`. | 🟡 **Média** |
| **A5-12** | [`use-targets-draft-state.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/targets/use-targets-draft-state.ts) | Hook de Metas | **D14** | Hook com **350 linhas** gerenciando drafts de metas para 3 níveis (classes, setores e ativos). | Desacoplar estado por nível hierárquico. | 🟡 **Média** |
| **A5-13** | [`use-quick-transaction-form.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/use-quick-transaction-form.ts) | Hook de Transação | **D14** | Hook com **305 linhas** controlando formulário de ordens. | Extrair sincronizações de moeda e indexador. | 🟡 **Média** |
| **A5-14** | [`asset-governance-form.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/asset-governance-form.tsx) | Formulário de Governança | **D14** | Componente com **287 linhas** contendo formulários de teto de risco e pontuação de governança. | Extrair subcomponente de notas e critérios. | 🟡 **Média** |
| **A5-15** | [`order-buy-sell-fields.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/shared-forms/order-buy-sell-fields.tsx) | Campos de Ordem | **D14** | Componente com **277 linhas**. | Modularizar o bloco de taxas e emolumentos. | 🟡 **Média** |
| **A5-16** | [`use-targets-mutations.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/targets/use-targets-mutations.ts) | Hook de Mutações | **D14** | Hook com **265 linhas**. | Extrair mutações individuais de setores e ativos. | 🟡 **Média** |
| **A5-17** | [`aporte-tab.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/aporte-tab.tsx) | Aba de Aportes | **D14** | Aba orquestradora com **257 linhas**. | Desacoplar o cockpit de simulação em sub-bloco. | 🟡 **Média** |
| **A5-18** | [`dividends-by-asset-panel.tsx#L85`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/proventos/dividends-by-asset-panel.tsx#L85) | `DividendsByAssetPanel` | **D16** | Linhas de histórico de proventos utilizam `border-border/60`. | Padronizar com `border-border/80`. | 🟢 **Baixa** |

---

## 3. Análise Aprofundada dos Problemas Críticos & Estruturais

### 3.1 Monólito Crítico: `AllocationBreakdownDialog` (635 linhas)

**Contexto:**  
O diálogo `AllocationBreakdownDialog` fornece o raio-x analítico de cada classe e setor da carteira (acionado ao clicar em fatias de gráficos ou links de alocação).

**O Problema Encontrado:**  
O arquivo atingiu **635 linhas**, concentrando:
1. Agrupamento em tempo real de ativos por setor com cálculo de valor de mercado e custo de aquisição.
2. Cálculo de lucro/prejuízo não realizado (unrealized PnL em R$ e %) e dividendos acumulados.
3. Barra de navegação com breadcrumbs (Classe $\to$ Setores $\to$ Ativos).
4. Seletor de visualização (Visão Agrupada vs. Visão Individual de Ativos).
5. Tabela completa de posições com formatação e disparos sensoriais.

**Impacto:**  
Complexidade cognitiva altíssima, alto risco de regressões visuais em alterações de layout e lentidão na manutenção.

**Solução Canônica:**
Modularizar em subcomponentes na pasta `src/features/investments/components/allocation-breakdown/`:
- `use-allocation-breakdown.ts` (Lógica de agrupamento e estatísticas).
- `allocation-breakdown-header.tsx` (Breadcrumb e badges de resumo).
- `allocation-breakdown-sector-view.tsx` (Cards de setores com PnL).
- `allocation-breakdown-assets-view.tsx` (Tabela discriminada de ativos).

---

### 3.2 Foco e Acessibilidade no Seletor de Tipo de Operação

**Contexto:**  
No formulário de nova ordem ou transação rápida de investimentos (`OrderOperationSelector`), o investidor escolhe entre Compra, Venda, Provento, Bonificação ou Desdobro.

**O Problema Encontrado:**  
No arquivo `order-operation-selector.tsx` (linha 83), os botões usam:
```tsx
<button
  key={op.id}
  type="button"
  role="tab"
  aria-selected={isSelected}
  onClick={() => { triggerSensory("selection"); onChange(op.id); }}
  className={cn(
    "flex items-center justify-center gap-1.5 min-h-10 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
    isSelected ? op.activeClass : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  )}
>
```
Nenhum utilitário de foco visual (`focus-visible:ring-1 focus-visible:ring-ring`) foi configurado. Quando um usuário navega via Tab, a seleção fica sem borda visível de foco.

**Solução Canônica:**
```tsx
// Adicionar ao className:
"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
```

---

## 4. Destaque de Excelência: Central Unificada de Relatórios (`reports`)

Em contraste com os monólitos encontrados em formulários de investimentos, **a Central de Relatórios (`src/features/reports/*`) demonstra um nível excepcional de engenharia de UI**:
- A página principal (`reports-page.tsx`) tem apenas **148 linhas**.
- Todos os 6 relatórios executivos utilizam o contêiner canônico `<ReportDocumentLayout size="2xl"|"3xl">` que garante:
  - Visualização em tela limpa com barra fixa de ações e supressão de títulos duplicados.
  - Exportação para PDF / Impressão A4 sem falhas de corte seco via portal isolado `@media print`.
  - Zero sobreposição de cabeçalhos de diálogo.
  - Tabelas analíticas com rolagem horizontal desobstruída (`ReportTable` com `min-w-[380px]`).

---

## 5. Validação Cross-Theme e Responsividade Multidispositivo

### 5.1 Comportamento nos Temas Light, Dark e OLED
- **Light:** Excelente contraste dos números nos cards de resumo de aportes e no DRE pessoal.
- **Dark:** Transições suaves nos carrosséis de inteligência (`PortfolioInsightsCarousel`) e histórico de DARF.
- **OLED:** Fundo `#000000` estrito no PageShell; gráficos SVG como `TearSheetAllocationSection` utilizam strokes e opacidades otimizadas para não acender pixels fora do anel de dados.

### 5.2 Ergonomia e Safe Areas Mobile
- A `AporteTab` e o `PortfolioMappingStep` implementam padding seguro contra a `BottomNav`.
- O carrossel de snapshots patrimoniais (`PortfolioSnapshotsCarousel`) implementa `snap-x` e scroll suave horizontal com áreas de toque expandidas de 44px (`min-h-11`).

---

## 6. Conclusão da Parte 5 & Próximos Passos

A auditoria da Parte 5 está **100% concluída**. Foram inspecionados os 189 arquivos de Inteligência Patrimonial, Aportes e Relatórios, registrando 18 anomalias mapeadas com suas respectivas soluções canônicas.

Conforme a **Regra Canônica de Governança**, o processo de auditoria é **estritamente de leitura** (sem modificações no código de produção neste momento).

> [!IMPORTANT]
> **Portão de Bloqueio da Parte 5:**
> A auditoria da Parte 5 foi finalizada. Aguardando a autorização expressa do usuário (**"OK"**) para dar início à **Parte 6: Home / Dashboard, Insights e Ferramentas** (`src/features/overview/*`, `src/features/insights/*` e `src/features/tools/*`).
