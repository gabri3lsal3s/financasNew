# Auditoria de Performance Frontend — Axir

> **Escopo:** Auditoria arquitetural read-only do estado atual do repositório (`React 19`, `TypeScript`, `Vite 8 / Rolldown`, `Tailwind CSS v4`, `TanStack Query v5`, `Supabase`).
> **Nota:** Nenhum arquivo de código-fonte foi alterado durante esta auditoria. Os tamanhos de bundle abaixo refletem os artefatos compilados atualmente presentes em `dist/assets/`.

---

## Resumo Executivo

A base já conta com uma fundação sólida em pontos críticos: **todas as rotas** em [src/app/routes.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/routes.tsx) e [src/app/router.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/router.tsx) usam `React.lazy`, bibliotecas pesadas de extração (`unpdf` / `pdfjs` com ~1.61 MB, `tesseract.js`, `@sentry/react`) são carregadas via `import()` dinâmico, gráficos são SVGs nativos leves (sem `recharts`/`echarts`), fontes são self-hosted com `font-display: swap` e `<img>` possuem dimensões explícitas.

Contudo, a inspeção do build e dos fluxos de dados revela **quatro gargalos principais** que degradam o TTI (Time to Interactive), o consumo de memória e a latência percebida nas páginas mais pesadas (`OverviewPage`, `InvestmentsPage`, `CardsPage`, `ReportsPage` e `TransactionListPage`):

1. **Barrel Files gigantes anulando o tree-shaking entre chunks:** `modules-*.js` (**827 KB**) e `state-*.js` (**498 KB**) são puxados por quase todas as páginas via imports de barris ([src/components/modules/index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/index.ts) e [src/state/index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/state/index.ts)).
2. **Modais e abas pesados importados estaticamente nas páginas e no `PageShell`:** abas secundárias de Investimentos, hosts de modais de Visão Geral/Cartões/Transações/Dívidas/Orçamentos e overlays globais do `PageShell` aumentam o chunk inicial autenticado.
3. **Tempestade de queries + `select("*")` + waterfalls no Supabase:** `useOverviewData` dispara **22+ queries** na montagem (incluindo históricos completos sem filtro temporal como `useAllCardExpenses`, `useAllCardPayments` e `useAllCardBillRollovers`), quase todos os repositórios usam `select("*")` e `families.ts` executa cadeias sequenciais de `await`.
4. **Ausência de virtualização em listas longas e transformações sem `useMemo` em hooks globais:** `use-search.ts` remapeia todo o histórico de despesas sem memoização a cada renderização, e feeds extensos renderizam todos os nós no DOM.

---

## 1. Bundle & Code Splitting

### 1.1 Mapa Atual de Chunks (`dist/assets/`)

| Chunk | Tamanho | Observação |
|---|---:|---|
| `pdfjs-*.js` | **1,612 KB** | Isolado sob demanda via `await import("unpdf")` (bom) |
| `modules-*.js` | **827 KB** | **Crítico:** barril único puxado em quase todas as rotas |
| `state-*.js` | **498 KB** | **Crítico:** barril único de queries/mutations/stores |
| `notifications-*.js` | **480 KB** | Puxado no App Shell autenticado via `useNotificationCenter` |
| `vendor-sentry-*.js` | **473 KB** | Isolado em `manualChunks` e importado dinamicamente (bom) |
| `components-*.js` | **377 KB** | Componentes compartilhados acoplados |
| `vendor-backend-*.js` | **249 KB** | `@supabase/*` + `@tanstack/react-query` |
| `index-*.css` | **226 KB** | CSS global Tailwind v4 |
| `vendor-react-*.js` | **214 KB** | React + React DOM + React Router |
| `landing-page-*.js` | **179 KB** | Landing page pública |
| `settings-page-*.js` | **171 KB** | Abas lazy, mas página base pesada |
| `investments-page-*.js` | **154 KB** | Abas e diálogos estáticos |
| `page-shell-*.js` | **154 KB** | Shell autenticado + modais/overlays estáticos |

### 1.2 O que já está bem isolado
- **Rotas:** Todas as rotas protegidas, públicas, legais, ferramentas e admin em [src/app/routes.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/routes.tsx) e [src/app/router.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/router.tsx) usam `lazy()`. O [vite.config.ts](file:///home/gabrielsales/meus_apps/financasnew/vite.config.ts#L105) desabilita `modulePreload: false` para não baixar chunks autenticados na landing.
- **Parsers pesados (PDF / OCR / Planilhas):**
  - `unpdf` (`pdfjs`) é importado dinamicamente em [spatial-pdf-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/spatial-pdf-extractor.ts#L775), [pdf-session.ts](file:///home/gabrielsales/meus_apps/financasnew/src/services/pdf-session.ts#L108) e [receipt-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/services/native/receipt-extractor.ts#L152).
  - `tesseract.js` é importado dinamicamente em [web-ocr.ts](file:///home/gabrielsales/meus_apps/financasnew/src/services/native/web-ocr.ts#L374).
  - Parsers `.xlsx` / `.xls` ([xlsx-parser.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/portfolio/xlsx-parser.ts), [spreadsheet-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/spreadsheet-extractor.ts)) são código TS puro sobre `DecompressionStream` nativo, sem dependência de `xlsx`/`exceljs`.
- **Gráficos:** Não há `recharts`, `echarts` ou `chart.js`. Todos os gráficos (`Sparkline`, `DonutRing`, `ReportDonutChart`, `ReportDividendSparkline`, `FireInteractiveSvgChart`, `SnapshotsEvolutionChart`) são SVGs diretos e leves.
- **Modais já lazy:** `InvestmentWizard` em [investments-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/investments-page.tsx#L10), `StatementImportDialog` em [cards-page-modals.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/cards-page-modals.tsx#L27), os 5 modais de relatórios em [reports-modals-host.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/components/reports-modals-host.tsx#L21-L33), `LaunchWizard` em [page-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/page-shell.tsx#L38) e as 5 abas de [settings-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/pages/settings-page.tsx#L20-L28).

### 1.3 Gargalos de Bundle & Splitting Identificados
1. **Barris monolíticos (`@/components/modules` e `@/state`):**
   - [src/components/modules/index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/index.ts) (11.5 KB) e [src/state/index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/state/index.ts) (14.4 KB) reexportam dezenas de módulos pesados e hooks. Quando `InvestmentsPage` importa apenas `ReadOnlyBanner` e `UpgradeDialog` de `@/components/modules` ou `useMarketQuotesSwr` de `@/state`, o bundler agrupa código de outros domínios nos chunks compartilhados `modules` (827 KB) e `state` (498 KB).
2. **Abas e diálogos estáticos em `InvestmentsPage`:**
   - [investments-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/investments-page.tsx#L8-L14) importa `MovimentacoesTab`, `ProventosTab`, `RebalanceTab`, `ResumoTab`, `CashFormDialog` e `UpgradeDialog` estaticamente. Apenas a aba inicial (`ResumoTab`) é necessária no primeiro paint.
3. **Hosts de Modais estáticos em páginas principais:**
   - **Visão Geral:** [overview-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/pages/overview-page.tsx#L21) importa estaticamente `OverviewModalsHost` ([overview-modals-host.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-modals-host.tsx)), que por sua vez importa estaticamente `DemoTrackSelectModal`, `OnboardingChecklistModal`, `CashCheckpointDialog`, `AddContributionDialog`, `CategoryBreakdownDialog`, `InitialPreferencesModal`, `OtherBudgetsDialog` e `OtherCategoriesDialog`.
   - **Cartões:** [cards-page-modals.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/cards-page-modals.tsx#L3-L25) importa estaticamente `CardInvoicePrintView`, `ReportDocumentLayout`, `ReportInsufficientDataModal`, `UpgradeDialog`, `InternalTransferDialog`, `ExpenseDetailDialog`, `BatchInvoicePaymentDialog`, `BillRolloverDialog`, `CardChargeDialog`, `CardFormDialog` e `PaymentDialog`.
   - **Transações / Dívidas / Orçamentos:** [transaction-list-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/pages/transaction-list-page.tsx#L14-L18) importa `TransactionListModals` e `TransactionEducationalGuideModal` estaticamente; [debts-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/debts/pages/debts-page.tsx#L8-L12) importa `DebtFormDialog`, `LoanFormDialog`, `SettleDialog` estaticamente; [budgets-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/budgets/pages/budgets-page.tsx#L7) importa `BudgetsDialogs` estaticamente.
4. **`PageShell` autenticado carregando overlays raramente usados na montagem:**
   - [page-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/page-shell.tsx#L8-L20) importa estaticamente `GlobalSearch` (puxa `cmdk` + `use-search.ts`), `UpgradeDialog`, `DemoTourSpotlight` e `NativeOnboardingDialog`, além de `useNotificationCenter` (contribuindo para `notifications-*.js` de 480 KB).
5. **Exportação Excel estática em Relatórios:**
   - [excel-export-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/components/excel-export-card.tsx#L5) importa `exportMultiSheetExcel` de `@/services/excel-export` estaticamente; deveria ser importado sob demanda dentro do handler de clique (`onClick`).
6. **Landing Page:**
   - [landing-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/pages/landing-page.tsx#L18-L23) já adia o simulador com `DeferredWealthSimulator`, mas importa `PlatformComparison`, `ToolsShowcase`, `PricingSection`, `FaqSection`, `CtaBanner` e `LandingFooter` estaticamente (chunk `landing-page` de 179 KB).

---

## 2. Data Fetching & Waterfalls

### 2.1 Configuração Global de Cache (`QueryClient`)
Em [src/app/providers.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/providers.tsx#L97-L108):
- `staleTime: 60_000` (1 min), `gcTime: 600_000` (10 min), `refetchOnWindowFocus: false`, `refetchOnReconnect: "always"`, `retry: 1`.
- Para dados quase estáticos (categorias, cartões, metas de alocação, preferências), `staleTime` de 60s é curto e gera revalidação frequente ao navegar entre abas/rotas.

### 2.2 Uso Massivo de `select("*")` nos Repositórios
Quase todos os repositórios em `src/data/repositories/` fazem `select("*")` em vez de projetar apenas as colunas usadas pelo domínio/UI:
- `expenses.ts` (linhas 34, 60, 82, 106, 135, 161, 192) e `incomes.ts` (linhas 34, 60, 82)
- `portfolio.ts` (9 ocorrências: linhas 99, 248, 396, 537, 599, 616, 828, 849, 1040)
- `credit-cards.ts` (25, 37), `card-payments.ts` (32, 56), `card-bill-rollovers.ts` (61, 95)
- `debts.ts` (21), `budgets.ts` (20), `income-goals.ts` (19), `loans.ts` (21, 33), `categories.ts` (29, 45), `recurrences.ts` (48)
- `families.ts` (185, 206, 226, 244, 495, 545), `trips.ts` (115, 130, 146, 180, 551)
- `admin.ts` (43, 62, 81, 115, 150, 170), `public-shares.ts` (172, 280, 305, 462), `cash-checkpoints.ts` (29, 54)

Isso aumenta o payload JSON trafegado, o tempo de serialização no PostgREST e a pressão de memória no cliente (especialmente em colunas `jsonb` ou textos longos como `notes`/`metadata`/`custom_settings`).

### 2.3 Waterfalls Sequenciais (`await` em série)
1. **Famílias ([src/data/repositories/families.ts](file:///home/gabrielsales/meus_apps/financasnew/src/data/repositories/families.ts)):**
   - Linhas 175–245: executa `currentUserId()` $\rightarrow$ `await memberData` $\rightarrow$ `await familyData` $\rightarrow$ `await allMembersData` $\rightarrow$ `await invitesData` (4–5 round-trips sequenciais!). Assim que `memberData.family_id` é obtido, `familyData`, `allMembersData` e `invitesData` são independentes e podem rodar em `Promise.all`.
   - Linhas 492–520: executa `await inviteData` $\rightarrow$ `await familyData` $\rightarrow$ `await inviterProfile`. `familyData` e `inviterProfile` podem rodar em `Promise.all`.
2. **Viagens ([src/data/repositories/trips.ts](file:///home/gabrielsales/meus_apps/financasnew/src/data/repositories/trips.ts)):**
   - `createTrip` (linhas 218–270) e `deleteTripExpense` (linhas 459–480) encadeiam queries sequenciais que podem ser consolidadas em RPC único ou paralelizadas onde não há dependência.
3. **Paginação por cursor em série ([src/data/query.ts](file:///home/gabrielsales/meus_apps/financasnew/src/data/query.ts#L22-L43)):**
   - `readAllPages` busca páginas de 500 registros sequencialmente (`for (;;)` com `await fetchPage`) para `listAllExpenses`, `listAllIncomes`, etc. Quando chamado em `use-search.ts` (`listAllExpenses`, `listAllIncomes`), usuários com milhares de lançamentos sofrem múltiplos round-trips sequenciais.

### 2.4 Tempestade de Queries & Falta de Escopo Temporal
- **Visão Geral ([src/features/overview/hooks/use-overview-data.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/hooks/use-overview-data.ts#L68-L130)):**
  - Dispara **22+ hooks `useQuery` simultaneamente** na montagem da Home (`incomes`, `expenses`, `prevIncomes`, `prevExpenses`, `creditCards`, `budgets`, `categories`, `debts`, `useAllCardExpenses`, `useAllCardPayments`, `useAllCardBillRollovers`, `portfolioContributions`, `splitShares`, `goalShares`, `trips`, `myFamily`, `familyConsolidation`, `realCashBalance`, `portfolioPosition`, `userPreferences`, `onboardingCounts`, `corporateDividends`, `userSubscription`).
  - `useAllCardExpenses()`, `useAllCardPayments()` e `useAllCardBillRollovers()` carregam **todo o histórico** do usuário sem recorte temporal na query, mesmo quando a Home só precisa das competências recentes/abertas.
- **Busca Global ([src/state/queries/use-search.ts](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-search.ts#L48-L95)):**
  - Quando habilitada, dispara **8 queries globais sem limite temporal** (`listAllExpenses`, `listAllIncomes`, `listDebts`, `listCreditCards`, `listAllCategories`, `listPortfolioAssets`, `listBudgets`, `listRecurrences`).

---

## 3. Renderização & Estado

### 3.1 Contextos Globais
- [src/state/subscription-context.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/state/subscription-context.tsx#L28) e [src/app/theme-provider.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/theme-provider.tsx#L242) já memoizam seus objetos `value` com `useMemo` — bom ponto positivo.
- Porém, [src/app/authenticated-providers.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/authenticated-providers.tsx#L33-L100) monta `CloudPreferencesSyncInner`, `DynamicBrandSync` e efeitos de sincronização de `localStorage`/nativo diretamente no topo da árvore autenticada; qualquer atualização de `preferences.custom_settings` dispara re-execução de efeitos síncronos no wrapper raiz.

### 3.2 Cálculos Pesados sem Memoização
- **Crítico — [src/state/queries/use-search.ts](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-search.ts#L97-L115):**
  - `categoryById`, `categoryNameById`, `cardNameById` e o `.map()` completo sobre `expensesQuery.data` (invocando `findLearnedMerchant` item a item!) são recalculados **em toda renderização** sem `useMemo`. Como `GlobalSearch` fica montado no `PageShell`, qualquer mudança de estado no shell ou na busca refaz o mapeamento inteiro.
- **Modais de Visão Geral ([src/features/overview/components/overview-modals-host.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/overview-modals-host.tsx#L39-L58)):**
  - `spentByCategoryMap([...prevExpenses])` e `expenses.filter(...)` rodam inline no corpo do componente quando `selectedCategoryId !== null`, sem `useMemo`.
- **Orquestradores densos:** `useReportsData` ([use-reports-data.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/hooks/use-reports-data.ts)) usa `useMemo` corretamente nos agregadores principais, mas recalcula `consolidatedBalance`, `financialDRE` e `freedomAnalysis` sempre que qualquer dependência financeira ou de investimentos muda.

### 3.3 Listas Longas sem Virtualização
- A busca por `useVirtualizer`, `react-window`, `react-virtualized` ou `content-visibility` retornou **0 ocorrências** no projeto.
- Telas com potencial de centenas/milhares de linhas DOM renderizadas de uma vez:
  - Feed de transações em [src/features/transactions/pages/transaction-list-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/pages/transaction-list-page.tsx)
  - Extrato de movimentações em [src/features/investments/pages/movimentacoes-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/movimentacoes-tab.tsx)
  - Faturas de cartão com muitos lançamentos em `CardsPage` e tabelas administrativas em `AdminUsersPage`.

---

## 4. Assets & LCP

### 4.1 Imagens
- Todas as tags `<img>` em produção foram verificadas e **possuem `width` e `height` explícitos** (prevenindo CLS):
  - [logo-icon.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/logo-icon.tsx#L98-L108): `<picture>` com WebP inline + fallback PNG `width={128} height={128}`, `loading="eager"`, `decoding="sync"` e `fetchPriority={priority ? "high" : undefined}`.
  - [pix-renewal-checkout-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/pix-renewal-checkout-modal.tsx#L60-L66): `width={208} height={208}`.
  - [pix-qr-waiting-panel.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/pix-qr-waiting-panel.tsx#L34-L40): `width={176} height={176}`.
- Atenção: `public/brand/logo-full.png` (~5 MB, citado no comentário do [vite.config.ts](file:///home/gabrielsales/meus_apps/financasnew/vite.config.ts#L38)) já está excluído do precache do Service Worker, mas deve ser auditado para garantir que não seja referenciado em nenhuma tela ou OG tag sem compressão.

### 4.2 Fontes
- [src/styles/fonts.css](file:///home/gabrielsales/meus_apps/financasnew/src/styles/fonts.css) carrega `Inter`, `Sora` e `IBM Plex Mono` localmente em `.woff2` com `font-display: swap` (zero bloqueio de renderização por Google Fonts externos).
- **Oportunidade de LCP:** `Inter` e `Sora` não possuem `<link rel="preload" as="font" crossorigin>` no `index.html`, o que pode gerar um leve FOUT (*Flash of Unstyled Text*) no primeiro paint da Landing Page.

### 4.3 Scripts & CSS no `index.html`
- [index.html](file:///home/gabrielsales/meus_apps/financasnew/index.html#L150-L230) contém um `<script>` inline síncrono para aplicar `data-theme` antes do primeiro paint (evita FOUC) e JSON-LD estático. Não há scripts externos bloqueantes de terceiros.
- O CSS único `index-*.css` tem **226 KB** (~35–45 KB gzip), carregado no shell inicial; não há code splitting de CSS específico para páginas administrativas/relatórios A4 de impressão.

---

## Plano de Otimização em 3 Ondas

Ordenado por **maior ganho de velocidade vs. menor risco de regressão**, em tarefas atômicas prontas para execução.

### Onda 1 — Ganhos Rápidos & Risco Mínimo (Code Splitting Cirúrgico + Memoização)
*Foco: Reduzir o payload JS inicial sem alterar contratos de API ou banco de dados.*

1. **Memoizar `useSearchIndex` em [src/state/queries/use-search.ts](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-search.ts):**
   - Envolver `categoryById`, `cardNameById`, `expenses.map(...)` e demais arrays derivados em `useMemo`.
   - *Ganho:* Elimina travamentos de CPU na digitação e navegação do `PageShell`. *Risco:* Nulo.
2. **Importação dinâmica de `exportMultiSheetExcel` em [src/features/reports/components/excel-export-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/components/excel-export-card.tsx):**
   - Mover `import { exportMultiSheetExcel } from "@/services/excel-export"` para `await import("@/services/excel-export")` dentro do handler de clique.
   - *Ganho:* Remove gerador XML/Excel do bundle da tela de Relatórios até o clique. *Risco:* Nulo.
3. **Lazy-loading das abas secundárias em [src/features/investments/pages/investments-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/investments-page.tsx):**
   - Converter `MovimentacoesTab`, `RebalanceTab`, `ProventosTab` e `CashFormDialog` para `lazy()` + `<Suspense fallback={<ContentLoading />}>`.
   - *Ganho:* Reduz o chunk `investments-page` (~154 KB) carregando apenas `ResumoTab` na entrada. *Risco:* Baixo.
4. **Lazy-loading de overlays do `PageShell` ([src/components/layout/page-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/page-shell.tsx)):**
   - Lazy-load de `GlobalSearch` (só montar/baixar quando aberto via atalho ou clique), `DemoTourSpotlight` (só quando `isDemoMode`), `NativeOnboardingDialog` e `UpgradeDialog` (só quando `open`).
   - *Ganho:* Reduz `page-shell-*.js` (154 KB) e adia o download de `cmdk` + `use-search`. *Risco:* Baixo.
5. **Preload da fonte principal (`inter.woff2`) no [index.html](file:///home/gabrielsales/meus_apps/financasnew/index.html):**
   - Adicionar `<link rel="preload" href="..." as="font" type="font/woff2" crossorigin>` para `Inter` (ou manter gerenciado pelo Vite).
   - *Ganho:* Melhora LCP e elimina FOUT. *Risco:* Nulo.

### Onda 2 — Otimização de Rede, Cache & Quebra de Barris (Médio Impacto / Baixo Risco)
*Foco: Eliminar waterfalls no Supabase, diminuir payloads JSON e quebrar os chunks `modules` (827 KB) e `state` (498 KB).*

1. **Paralelizar waterfalls em [src/data/repositories/families.ts](file:///home/gabrielsales/meus_apps/financasnew/src/data/repositories/families.ts):**
   - Substituir os `await` em série (`familyData` $\rightarrow$ `allMembersData` $\rightarrow$ `invitesData` e `familyData` $\rightarrow$ `inviterProfile`) por `Promise.all`.
   - *Ganho:* Reduz latência de carregamento do Modo Família em ~50–65%. *Risco:* Baixo.
2. **Lazy-loading dos Hosts de Modais pesados:**
   - Converter `OverviewModalsHost` ([overview-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/pages/overview-page.tsx)), `TransactionListModals` + `TransactionEducationalGuideModal` ([transaction-list-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/pages/transaction-list-page.tsx)), diálogos de [debts-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/debts/pages/debts-page.tsx), `BudgetsDialogs` ([budgets-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/budgets/pages/budgets-page.tsx)) e diálogos secundários de [cards-page-modals.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/cards-page-modals.tsx) para `lazy()` condicional ao estado `open`.
   - *Ganho:* Reduz drasticamente o JS parseado na abertura de Home, Transações, Cartões, Dívidas e Orçamentos. *Risco:* Baixo.
3. **Ajuste granular de `staleTime` por domínio no TanStack Query:**
   - Elevar `staleTime` para `5–10 min` em queries de baixa mutabilidade (`categories`, `credit_cards`, `allocation_targets`, `user_preferences`, `user_subscription`), mantendo `60s` nas transacionais.
   - *Ganho:* Menos refetches redundantes ao alternar entre rotas. *Risco:* Baixo (invalidações explícitas em mutations continuam funcionando).
4. **Substituir `select("*")` por projeções explícitas nos repositórios mais trafegados:**
   - Começar por `expenses.ts`, `incomes.ts`, `portfolio.ts`, `credit-cards.ts`, `card-payments.ts` e `categories.ts`.
   - *Ganho:* Reduz tráfego de rede e parsing JSON. *Risco:* Baixo/Médio (exige validar que nenhum campo consumido pelo domínio foi omitido; testável via `npm run verify`).

### Onda 3 — Arquitetura de Longo Prazo (Alto Ganho / Maior Esforço)
*Foco: Resolver a raiz dos chunks monolíticos, da tempestade de queries na Home e da escalabilidade de listas.*

1. **Eliminar imports via barris `@/components/modules` e `@/state` nas páginas e hooks:**
   - Migrar gradualmente imports de rotas para subpaths diretos (ex.: `@/components/modules/subscription/upgrade-dialog`, `@/state/queries/use-expenses`) e habilitar lint/regra contra imports de barril em `features/`.
   - *Ganho:* Quebra os monolitos `modules-*.js` (**827 KB**) e `state-*.js` (**498 KB**) em chunks específicos por feature. *Risco:* Médio (refatoração ampla de imports).
2. **Consolidar e paginar queries da Home (`useOverviewData`):**
   - Criar endpoint/RPC agregado (ex.: `get_overview_bootstrap`) ou limitar `useAllCardExpenses`/`useAllCardPayments`/`useAllCardBillRollovers` a uma janela de competências relevantes na Home (em vez de todo o histórico).
   - *Ganho:* Reduz de 22+ requisições simultâneas para ~3–5 na abertura da Home. *Risco:* Médio/Alto (requer cuidado com invariantes de saldo de cartão e cache do TanStack Query).
3. **Virtualização de listas extensas (`@tanstack/react-virtual` ou CSS `content-visibility: auto`):**
   - Aplicar virtualização ou paginação real no servidor/UI em `TransactionListPage`, `MovimentacoesTab` e `AdminUsersPage`.
   - *Ganho:* Mantém 60fps de scroll mesmo com 2.000+ lançamentos. *Risco:* Médio (atenção a acessibilidade, foco de teclado e impressão).
