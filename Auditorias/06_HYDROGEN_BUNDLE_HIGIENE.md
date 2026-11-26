# Auditoria 06 — Build, Performance de Bundle, Queries, Assets & Higiene de Código

**26/11/2026 · Base Git `cbe0c3c1` · `package.json` `v3.30.1` · Escopo: Auditoria estritamente read-only (nenhum arquivo de código-fonte ou configuração alterado).**

Esta auditoria cobre a configuração de build e bundling (`vite.config.ts`, `package.json`, artefatos gerados em `dist/`), o grafo de importações síncronas e assíncronas em `src/`, todas as consultas `.select("*")` em `src/` e `supabase/functions/`, a higiene de mídia em `public/` e recursos inline, o carregamento de fontes críticas (LCP) e a detecção de código morto, dependências ociosas, duplicações funcionais e chamadas `console.*` residuais.

**Critério de severidade.**
- **P1 (Alto Impacto):** Impacta diretamente o TTI/LCP inicial, anula `lazy()` já existente, puxa megachunks no shell autenticado, multiplica payload de rede em consultas recorrentes de banco ou gera desperdício relevante de transferência/armazenamento.
- **P2 (Médio Impacto):** Aumenta chunks secundários de páginas/abas, mantém acoplamento por barrels ou duplicação de lógica de domínio, ou preserva código/assets mortos com custo de manutenção.
- **P3 (Baixo Impacto / Higiene):** Itens saneados parcialmente em tempo de build (`dropConsole`), shims pontuais ou melhorias incrementais de organização alinhadas ao `AGENTS.md`.

---

## Resumo Executivo

| Frente | Estado Atual Observado | Principais Gargalos |
|---|---|---|
| **1. Bundle & Code Splitting** | `dist/` soma `12.318.677 B`; `dist/assets/` possui `202` arquivos (`8.984.765 B` sendo `196` `.js` = `8.631.010 B`, `1` `.css` = `226.655 B`, `5` `.woff2` = `127.100 B`). Rotas, `unpdf`, `tesseract.js` e `@sentry/react` já são lazy. | `modules-*.js` (`827.069 B`) e `state-*.js` (`688.474 B`) inchados por barrels e `import * as`; `resumo-modals-host.tsx` e `aporte-tab.tsx` **anulam** o `lazy()` de `InvestmentWizard` e `CashFormDialog`; `PageShell` e `authenticated-providers.tsx` carregam `GlobalSearch`/`cmdk`, `notifications-*` (`303.811 B`), `bank-listener` (`120.391 B`) e `AppLockOverlay` (`55.009 B`) no boot autenticado; dezenas de modais e abas são síncronos. |
| **2. Queries, Assets & Fontes (LCP)** | Fontes locais em `.woff2` (`127.100 B`) usam `font-display: swap`; gráficos são SVGs enxutos sem lib externa pesada. | **72 ocorrências de `.select("*")`** (`70` em `src/` + `2` em Edge Functions), incluindo paginação histórica completa (`expenses.ts:82`, `incomes.ts:82`) e violação de camada em `split-sync.ts:61`; **72 arquivos de mídia sem referência em produção** em `public/` (`2.772.374 B` de `3.275.862 B`); `index.html` sem `<link rel="preload" as="font">` atrás de `index-*.css` (`226.655 B`); páginas offline consultam Google Fonts externos. |
| **3. Código Morto & Higiene** | `0` ocorrências de `console.log`/`info`/`debug`; `lucide-react` usa apenas named imports em `667` arquivos (`0` wildcard). | **5 arquivos de código morto efetivo** + **3 shims órfãos** (`8` arquivos não-barrel sem uso em prod); **36 barrels `index.ts` não consumidos** em prod; **5 exports mortos** em `src/app/`; `@capacitor/android` em `dependencies`; `11` duplicações reais de funções/constantes em `src/`; `14` chamadas `console.warn`/`console.error` ativas fora de testes. |

---

## 1. Bundle & Code Splitting

### 1.1 Inventário do Build Atual (`vite.config.ts` e `dist/`)

A configuração em [vite.config.ts](../vite.config.ts) (`Vite 8` / Rolldown) já aplica otimizações estruturais importantes: `build.modulePreload: false` (`:105`), `chunkSizeWarningLimit: 1700` (`:106`), `minify.compress: { dropConsole: true, dropDebugger: true }` (`:111`), precache PWA enxuto com 8 `globPatterns` (`:29-37`) ignorando `logo-full.png`, `pdfjs-*`, `vendor-sentry-*`, `admin-*` e `sw-push.js` (`:39-45`), além de 9 grupos em `manualChunks` (`:113-183`).

Os maiores artefatos observados em `dist/assets/` (`202` arquivos, `8.984.765 B`) evidenciam onde o código da aplicação ainda se concentra:

| Chunk / Asset em `dist/assets/` | Tamanho (bytes) | Natureza e Origem |
|---|---|---|
| `pdfjs-Byl6YQFQ.js` | `1.612.573 B` | Lazy sob demanda via `await import("unpdf")` |
| `modules-efWpxI6j.js` | `827.069 B` | Barrel `@/components/modules` (`194` linhas, `92` importadores prod) |
| `state-B19jC0ZY.js` | `688.474 B` | Barrel `@/state` (`454` linhas, `173` importadores prod, `16` com `import * as`) |
| `vendor-sentry-z1tT0dBb.js` | `472.969 B` | Lazy sob demanda via `await import("@sentry/react")` (`manualChunks`) |
| `components-D5DXOwz6.js` | `379.157 B` | Chunk agregado de componentes internos compartilhados |
| `notifications-DU0Gjp9Y.js` | `303.811 B` | Motor/componentes de notificações puxados pelo `PageShell` |
| `vendor-backend-bjXEuVkq.js` | `248.672 B` | `@supabase/*` + `@tanstack/react-query` (`manualChunks`) |
| `index-DBuTlvWC.css` | `226.655 B` | CSS global único (Tailwind v4 + `tokens.css` + `fonts.css`) |
| `vendor-react-BBQpm_td.js` | `214.300 B` | `react`, `react-dom`, `react-router`, `scheduler` (`manualChunks`) |
| `landing-page-B-GRzzQS.js` | `178.683 B` | Página pública `/` (todas as seções abaixo da dobra síncronas, exceto simulador) |
| `settings-page-CTcXGvYV.js` | `173.571 B` | Página `/configuracoes` (`AccountTab` + `SupportChatDialog` síncronos) |
| `vendor-ui-CtXft32P.js` | `161.671 B` | `@radix-ui/*`, `lucide-react`, `cva`, `clsx`, `tailwind-merge` (`manualChunks`) |
| `page-shell-BCJ6eALk.js` | `153.605 B` | Shell autenticado (`Sidebar`, `GlobalSearch`, `UpgradeDialog`, tours) |
| `statement-import-C5Lrgehj.js` | `149.475 B` | Modal lazy `StatementImportDialog` em Cartões |
| `admin-forensics-page-nRVuzPVb.js` | `147.558 B` | Rota admin lazy de auditoria forense |
| `components-BsGg8VW2.js` | `124.697 B` | Chunk compartilhado de componentes |
| `bank-listener-DLQSXd5j.js` | `120.391 B` | Serviço nativo puxado de forma síncrona no bootstrap autenticado |
| `family-page-Do6KYSFp.js` | `105.586 B` | Rota `/familia` com modais e dashboard síncronos |
| `reports-page-C-TtaeHE.js` | `100.833 B` | Rota `/relatorios` com todas as 4 abas síncronas |
| `insights-page-CM64HOnf.js` | `98.458 B` | Rota `/insights` com todas as abas e diálogos síncronos |
| `vendor-zod-ZzIYPgdg.js` | `92.298 B` | `zod` (`manualChunks`) |
| `use-notification-center-B7tFwu5W.js` | `91.189 B` | Hook síncrono no `PageShell` |
| `launch-wizard-Ck2Sizn1.js` | `84.684 B` | Lazy no `PageShell`, mas síncrono em `BusinessPage` |
| `cards-page-DiD27ugy.js` | `74.596 B` | Rota `/cartoes` com 9+ modais/views síncronos |
| `overview-page-CoCiT9oG.js` | `71.694 B` | Rota `/` autenticada com 8 modais síncronos |
| `ui-DDdSoYhU.js` | `64.777 B` | Primitivos `@/components/ui` |
| `investment-wizard-mT2eklgU.js` | `59.164 B` | Supostamente lazy em `InvestmentsPage`, mas puxado sincronamente |
| `index-CyejcA6m.js` | `58.719 B` | Entrypoint inicial da aplicação |
| `app-lock-BxusFQ4M.js` | `55.009 B` | `AppLockOverlay` síncrono em `authenticated-providers.tsx` |
| `vendor-cmdk-BI0YI0Lf.js` | `51.554 B` | `cmdk` puxado por `GlobalSearch` e reexportado por `@/components/ui` |
| `business-page-pnGylBC3.js` | `48.915 B` | Rota `/negocio` |
| `debts-page-DyNmQKhw.js` | `48.795 B` | Rota `/dividas` |
| `vendor-picker-CITyb5ma.js` | `45.936 B` | `react-day-picker` (`manualChunks`) |
| `pending-dividends-dialog-DHb4QTjh.js` | `34.539 B` | `PendingDividendsDialogHost` síncrono em `authenticated-providers.tsx` |
| `logo-icon-BKe4T84Q.js` | `30.988 B` | Inflado por `logo-inline-assets.ts` (`29.532 B` em WebP base64) |
| `vendor-date-D9nzNBiG.js` | `27.931 B` | `date-fns` (transitivo de `react-day-picker`, `manualChunks`) |
| `vendor-native-BuU2fWlK.js` | `22.713 B` | Plugins Capacitor (`manualChunks`) |
| `excel-export-vgYgUp_D.js` | `19.309 B` | Lazy export XML/XLS em `excel-export-card.tsx` |

### 1.2 O que já está corretamente sob demanda

- **Rotas:** Todas as rotas autenticadas, públicas, legais, ferramentas e admin usam `React.lazy()` em [src/app/router.tsx](../src/app/router.tsx#L19-L173) e [src/app/routes.tsx](../src/app/routes.tsx#L12-L35).
- **Leitura de PDF (`unpdf` / `pdfjs`):** Carregamento dinâmico via `await import("unpdf")` em [src/services/native/receipt-extractor.ts](../src/services/native/receipt-extractor.ts#L152), [src/services/pdf-session.ts](../src/services/pdf-session.ts#L108) e [src/domain/reconciliation/extractors/spatial-pdf-extractor.ts](../src/domain/reconciliation/extractors/spatial-pdf-extractor.ts#L775).
- **OCR (`tesseract.js`):** Carregamento dinâmico via `await import("tesseract.js")` em [src/services/native/web-ocr.ts](../src/services/native/web-ocr.ts#L374).
- **Observabilidade (`@sentry/react`):** Carregamento dinâmico em [src/services/observability.ts](../src/services/observability.ts#L80), [L140](../src/services/observability.ts#L140) e [L155](../src/services/observability.ts#L155).
- **Exportação Excel e Simulador Landing:** `await import("@/services/excel-export")` em [src/features/reports/components/excel-export-card.tsx](../src/features/reports/components/excel-export-card.tsx#L30) (implementação XML própria, sem biblioteca `xlsx`) e `lazy` para `MinimalWealthSimulator` em [src/features/landing/components/deferred-wealth-simulator.tsx](../src/features/landing/components/deferred-wealth-simulator.tsx#L4).
- **Gráficos e Ícones:** Não há `recharts` nem bibliotecas terceiras de gráficos (`0` ocorrências no repositório); os gráficos são SVGs nativos compactos (`<= 16 KB` por componente). `lucide-react` é importado nominalmente em `667` arquivos de produção (`0` imports `import *`).

### 1.3 Importações Síncronas Críticas, `React.lazy` Anulados e Oportunidades de Splitting

#### P1 · `InvestmentWizard` e `CashFormDialog` têm `React.lazy` anulado por imports síncronos internos
- **Evidência:** [src/features/investments/pages/investments-page.tsx](../src/features/investments/pages/investments-page.tsx#L10-L11) declara `lazy(() => import("../wizard/investment-wizard"))` e `lazy(() => import("../components/cash-form-dialog"))`. Porém, [src/features/investments/components/resumo/resumo-modals-host.tsx](../src/features/investments/components/resumo/resumo-modals-host.tsx#L8-L21) importa estaticamente `CashFormDialog` (via `".."`) e `InvestmentWizard` (via `"../../wizard"`), e [src/features/investments/pages/aporte-tab.tsx](../src/features/investments/pages/aporte-tab.tsx#L23) também importa estaticamente `InvestmentWizard`.
- **Impacto:** Como `ResumoTab` é síncrono na aba padrão de `/investments`, `investment-wizard` (`59.164 B`) e `CashFormDialog` são acoplados ao carregamento inicial da rota.
- **Recomendação:** Converter as instâncias dentro de `resumo-modals-host.tsx` e `aporte-tab.tsx` para `lazy()` + `Suspense` com renderização condicional quando `open` for `true`.

#### P1 · `BusinessPage` importa `LaunchWizard` sincronamente, duplicando a fronteira lazy do `PageShell`
- **Evidência:** [src/components/layout/page-shell.tsx](../src/components/layout/page-shell.tsx#L38-L40) isola `LaunchWizard` (`84.684 B`) com `lazy()`, mas [src/features/business/pages/business-page.tsx](../src/features/business/pages/business-page.tsx#L60-L72) importa estaticamente `LaunchWizard`, `ExpenseDetailDialog`, `IncomeDetailDialog`, `BusinessDreCard`, `BusinessProfileDialog`, `EducationalGuideModal`, `InternalTransferDialog`, `MeiCeilingCard` e `TaxShieldCard`.
- **Recomendação:** Usar `lazy()` para `LaunchWizard` e para os modais/cards sob demanda em `business-page.tsx`, ou acionar o `LaunchWizard` unificado via query/evento do `PageShell`.

#### P1 · Bootstrap e `PageShell` carregam módulos pesados antes de qualquer interação
- **Evidência:**
  - [src/app/providers.tsx](../src/app/providers.tsx#L11-L16) importa estaticamente `initAppLockListener`, `clearNativeBankMonitoring`, `cancelDailyReminder`, `clearAllDueNotifications`, `unregisterNativeFcmPush` e `unsubscribeBrowserWebPush` no entry global (inclusive na Landing Page pública).
  - [src/app/authenticated-providers.tsx](../src/app/authenticated-providers.tsx#L5-L7) e [L18-L21](../src/app/authenticated-providers.tsx#L18-L21) importam estaticamente `NativeUpdateToast`, `AppLockOverlay` (`55.009 B`), `PendingDividendsDialogHost` (`34.539 B`), `local-notifications` e `bank-listener` (`120.391 B`).
  - [src/app/authenticated-root.tsx](../src/app/authenticated-root.tsx#L4-L6) importa estaticamente `PageShell`, `RequireActiveAccount` e `RequireAuth` no mesmo módulo do `AuthenticatedHome`.
  - [src/components/layout/page-shell.tsx](../src/components/layout/page-shell.tsx#L16-L23) importa estaticamente `UpgradeDialog` (`8.535 B`), `GlobalSearch` (puxando `vendor-cmdk` `51.554 B`), `DemoTourSpotlight`, `NativeOnboardingDialog` e `useNotificationCenter` (puxando `notifications-*` `303.811 B` + `use-notification-center-*` `91.189 B`).
- **Recomendação:** Carregar `GlobalSearch` apenas quando aberto (ou após `Cmd/Ctrl+K` / clique na busca), mover `PendingDividendsDialogHost`, `AppLockOverlay` (quando bloqueado/configurado), `DemoTourSpotlight`, `NativeOnboardingDialog` e `UpgradeDialog` para `React.lazy`, e usar `import()` dinâmico para utilitários de limpeza/nativos em `providers.tsx` e `authenticated-providers.tsx` (atrasando `bank-listener` apenas para plataforma nativa/habilitada).

#### P1 · Barris gigantes (`@/components/modules`, `@/state`, `@/components/ui`) e 16 imports `import * as` em `@/state`
- **Evidência:** [src/components/modules/index.ts](../src/components/modules/index.ts) (`194` linhas, `92` importadores prod → `modules-efWpxI6j.js` de `827.069 B`), [src/state/index.ts](../src/state/index.ts) (`454` linhas, `173` importadores prod → `state-B19jC0ZY.js` de `688.474 B`) e [src/components/ui/index.ts](../src/components/ui/index.ts) (`141` linhas, `570` importadores prod, reexportando `Command`/`cmdk` em `:68-69`, `QrCodeCanvas`/`uqr` em `:102-103` e `Accordion` em `:120-132`). Além disso, **16 arquivos de produção** usam namespace wildcard em estado (`15` com `import * as ... from "@/state"`, como [src/app/require-auth.tsx](../src/app/require-auth.tsx#L14) e [src/hooks/use-notification-center.ts](../src/hooks/use-notification-center.ts#L11), e `1` em `@/state/selectors` em [use-smart-advisor-insights.ts](../src/features/overview/hooks/use-smart-advisor-insights.ts#L17)).
- **Impacto:** Qualquer rota que acesse um hook simples de `@/state` ou um módulo de `@/components/modules` tende a consolidar código em megachunks compartilhados (`~1,5 MB` somando `modules` + `state`), além de impedir o bundler de descartar símbolos quando há acesso dinâmico via namespace (`getOptionalHook(stateHooks, ...)`).
- **Recomendação:** Substituir os `16` `import * as` por imports nomeados diretos dos arquivos específicos (`@/state/queries/...`), remover `Command` e `QrCodeCanvas` do barrel raiz `@/components/ui` (mantendo import direto para preservar splitting de `cmdk` e `uqr`), e avaliar `manualChunks` por domínio de estado ou sub-barrels (`@/state/queries`, `@/state/mutations`, `@/components/modules/reports`, etc.).

#### P2 · Abas e hosts de modais importados de forma síncrona nas páginas principais

| Arquivo / Linha | Símbolos Síncronos Pesados | Ação Recomendada |
|---|---|---|
| [src/features/overview/components/overview-modals-host.tsx](../src/features/overview/components/overview-modals-host.tsx#L2-L15) | 8 modais (`DemoTrackSelectModal`, `OnboardingChecklistModal`, `CashCheckpointDialog`, `AddContributionDialog`, `CategoryBreakdownDialog`, `InitialPreferencesModal`, `OtherBudgetsDialog`, `OtherCategoriesDialog`) | `React.lazy` condicionado ao estado `open` de cada modal |
| [src/features/cards/components/cards-page-modals.tsx](../src/features/cards/components/cards-page-modals.tsx#L3-L25) | `CardInvoicePrintView`, `ReportDocumentLayout`, `ReportInsufficientDataModal`, `UpgradeDialog`, `InternalTransferDialog`, `ExpenseDetailDialog`, `BatchInvoicePaymentDialog`, `BillRolloverDialog`, `CardChargeDialog`, `CardFormDialog`, `PaymentDialog` | Estender padrão de `StatementImportDialog` (`:27-31`) aos demais modais e visão de impressão |
| [src/features/cards/pages/cards-page.tsx](../src/features/cards/pages/cards-page.tsx#L21) & [transaction-list-page.tsx](../src/features/transactions/pages/transaction-list-page.tsx#L14) | `TransactionEducationalGuideModal` (`16` ícones Lucide) | `React.lazy` ao abrir o guia educacional |
| [src/features/transactions/components/list/transaction-list-modals.tsx](../src/features/transactions/components/list/transaction-list-modals.tsx#L2-L6) | `ManageSplitDialog`, `SplitExpenseDialog`, `SplitPreviewMockupCard`, `UpgradeDialog`, `ExpenseDetailDialog`, `IncomeDetailDialog` | `React.lazy` nos diálogos de racha e detalhe |
| [src/features/reports/pages/reports-page.tsx](../src/features/reports/pages/reports-page.tsx#L6-L12) | Todas as 4 abas (`BalanceTab`, `FinancialTab`, `InvestmentsTab`, `TaxTab`) + `ReportsModalsHost` | `React.lazy` para abas não ativas na abertura (`InvestmentsTab`, `BalanceTab`, `TaxTab`) |
| [src/features/reports/components/reports-modals-host.tsx](../src/features/reports/components/reports-modals-host.tsx#L16-L23) | `ReportInsufficientDataModal`, `ExpenseDetailDialog`, `PortfolioDarfMonitor`, `ReportDetailDialog` | Migrar `PortfolioDarfMonitor` e `ReportDetailDialog` para `lazy()`, alinhando aos outros 5 modais do host |
| [src/features/insights/pages/insights-page.tsx](../src/features/insights/pages/insights-page.tsx#L6-L11) | `EmergencyFundConfigDialog`, `DiagnosticsTab`, `MonthlyClosingCard`, `ProjectionTab`, `RecurrencesTab` | `React.lazy` nas abas `RecurrencesTab` e `ProjectionTab` e no diálogo de reserva |
| [src/features/debts/pages/debts-page.tsx](../src/features/debts/pages/debts-page.tsx#L4-L13) | `UpgradeDialog`, `DebtFormDialog`, `LoanFormDialog`, `SettleDialog`, `LoansTabContent` | `React.lazy` em `LoansTabContent` e nos 3 diálogos |
| [src/features/budgets/pages/budgets-page.tsx](../src/features/budgets/pages/budgets-page.tsx#L6-L12) & [budgets-dialogs.tsx](../src/features/budgets/components/budgets-dialogs.tsx#L2-L17) | `BudgetsGoalsTab`, `BudgetsLimitsTab`, `AddContributionDialog`, `GoalCompositionDialog`, `ManageContributionsDialog`, `ShareGoalDialog`, `BudgetAdjustDialog`, `CategoryFormDialog`, `CategoryKitsModal`, `IncomeGoalDialog`, `LimitDialog` | `React.lazy` na aba secundária e no bloco de diálogos de metas/categorias |
| [src/features/family/pages/family-page.tsx](../src/features/family/pages/family-page.tsx#L20-L26) | `FamilyCreateModal`, `FamilySettingsDialog`, `FamilySettlementDialog`, `FamilyShareAssetsDialog`, `FamilyConsolidationDashboard` | `React.lazy` nos 4 modais de gestão familiar |
| [src/features/settings/pages/settings-page.tsx](../src/features/settings/pages/settings-page.tsx#L14) & [security-tab.tsx](../src/features/settings/components/tabs/security-tab.tsx#L26-L27) | `SupportChatDialog`, `MfaModal`, `PinSetupDialog` | `React.lazy` para os 3 modais |
| [src/features/landing/pages/landing-page.tsx](../src/features/landing/pages/landing-page.tsx#L3-L25) | `PlatformComparison`, `ToolsShowcase`, `PricingSection`, `FaqSection`, `CtaBanner`, `LandingFooter` (`178.683 B` no chunk único) | `React.lazy` nas seções abaixo da dobra com `Suspense` discreto |

#### P3 · `manualChunks` do Vite (`vite.config.ts:113-183`)
- **Observação:** `uqr` (usado em [src/domain/pix/qr-code.ts](../src/domain/pix/qr-code.ts#L8) para QR Code Pix) não possui regra própria em `manualChunks`, e `vendor-date` (`27.931 B`) existe mesmo sem nenhum import direto de `date-fns` no código do app (apenas dependência transitiva de `react-day-picker`).
- **Recomendação:** Isolar `uqr` em chunk próprio (ou garantir import dinâmico apenas no modal de QR Code) e avaliar agrupamento de `date-fns` junto a `vendor-picker`, já que nenhum outro código consome `date-fns`.

---

## 2. Otimização de Queries, Assets & Fontes (LCP)

### 2.1 Inventário Completo de `.select("*")` (`72` ocorrências)

Foram encontradas **`72` chamadas `.select("*")`** (ou com relacionamento expandido): **`70` em `src/`** (`69` em `src/data/repositories/*` e `1` em `src/services/split-sync.ts:61`) e **`2` em `supabase/functions/`**.

#### P1 · Consultas críticas de alto volume, paginação completa ou violação de camada

| Arquivo e Linha | Tabela / Origem | Função / Contexto e Risco |
|---|---|---|
| [src/data/repositories/expenses.ts](../src/data/repositories/expenses.ts#L82) | `expenses` | `listAllExpenses` — lê **toda a tabela** em páginas de 500 via `readAllPages` sem lista de colunas |
| [src/data/repositories/expenses.ts](../src/data/repositories/expenses.ts#L34), [L60](../src/data/repositories/expenses.ts#L60), [L106](../src/data/repositories/expenses.ts#L106), [L135](../src/data/repositories/expenses.ts#L135), [L161](../src/data/repositories/expenses.ts#L161), [L192](../src/data/repositories/expenses.ts#L192) | `expenses` | `listExpensesByMonth`, `listExpensesByRange`, `listExpensesByCard`, `listAllCardExpenses`, `getExpense`, `listExpensesByInstallmentGroup` — alta frequência em Home, Transações e Cartões |
| [src/data/repositories/incomes.ts](../src/data/repositories/incomes.ts#L34), [L60](../src/data/repositories/incomes.ts#L60), [L82](../src/data/repositories/incomes.ts#L82) | `incomes` | `listIncomesByMonth`, `listIncomesByRange`, `listAllIncomes` (cursor completo sem projeção) |
| [src/services/split-sync.ts](../src/services/split-sync.ts#L61) | `expenses` | Consulta direta ao Supabase na camada `services/` — **viola `AGENTS.md §3`** (`src/data/` é a única camada que acessa o cliente) |
| [src/data/repositories/trips.ts](../src/data/repositories/trips.ts#L163) | `trip_expenses` + `trip_expense_splits` | `.select("*, splits:trip_expense_splits(*)")` em `getTripExpenses` — dupla wildcard com join aninhado |
| [src/data/repositories/portfolio.ts](../src/data/repositories/portfolio.ts#L104), [L253](../src/data/repositories/portfolio.ts#L253), [L401](../src/data/repositories/portfolio.ts#L401), [L542](../src/data/repositories/portfolio.ts#L542), [L604](../src/data/repositories/portfolio.ts#L604), [L621](../src/data/repositories/portfolio.ts#L621), [L869](../src/data/repositories/portfolio.ts#L869), [L1061](../src/data/repositories/portfolio.ts#L1061) | `portfolio_assets`, `portfolio_snapshots`, `portfolio_contributions`, `portfolio_dividends`, `portfolio_transactions`, `user_dividend_events`, `portfolio_dividend_dismissals` | `8` queries em `portfolio.ts` incluindo histórico integral (`listAllPortfolioTransactions` em `:621` e `listPortfolioSnapshots` em `:253`) |
| [src/data/repositories/admin.ts](../src/data/repositories/admin.ts#L115), [L150](../src/data/repositories/admin.ts#L150) | `audit_events`, `system_backups` | `listAuditEvents` e `listSystemBackups` — tabelas potencialmente grandes de auditoria e snapshot sem projeção explícita |

#### Demais ocorrências de `.select("*")` mapeadas (P2 / P3)

| Arquivo e Linhas | Tabela(s) | Qtd | Classificação |
|---|---|---:|---|
| [src/data/repositories/export.ts](../src/data/repositories/export.ts#L21), [L29](../src/data/repositories/export.ts#L29) | `BACKUP_TABLE_KEYS`, `card_bill_rollovers` | 2 | Justificável (backup completo em `fetchAllUserData`) |
| [src/data/repositories/families.ts](../src/data/repositories/families.ts#L185), [L209](../src/data/repositories/families.ts#L209), [L216](../src/data/repositories/families.ts#L216), [L224](../src/data/repositories/families.ts#L224), [L494](../src/data/repositories/families.ts#L494), [L544](../src/data/repositories/families.ts#L544) | `family_members`, `families`, `family_invites`, `family_settlements` | 6 | P2 — especificar colunas consumidas pelos DTOs |
| [src/data/repositories/trips.ts](../src/data/repositories/trips.ts#L115), [L130](../src/data/repositories/trips.ts#L130), [L146](../src/data/repositories/trips.ts#L146), [L180](../src/data/repositories/trips.ts#L180), [L551](../src/data/repositories/trips.ts#L551) | `trips`, `trip_members`, `trip_settlements` | 5 | P2 — especificar colunas (além de `:163` já listado acima) |
| [src/data/repositories/admin.ts](../src/data/repositories/admin.ts#L43), [L62](../src/data/repositories/admin.ts#L62), [L81](../src/data/repositories/admin.ts#L81), [L170](../src/data/repositories/admin.ts#L170) | `system_features`, `user_feature_overrides`, `access_invites`, `admin_broadcast_notifications` | 4 | P3 — admin (além de `:115,150`) |
| [src/data/repositories/public-shares.ts](../src/data/repositories/public-shares.ts#L172), [L280](../src/data/repositories/public-shares.ts#L280), [L305](../src/data/repositories/public-shares.ts#L305), [L462](../src/data/repositories/public-shares.ts#L462) | `public_shares` | 4 | P2 — `payload` JSONB pode ser pesado na listagem `:305` |
| [src/data/repositories/push-subscriptions.ts](../src/data/repositories/push-subscriptions.ts#L29), [L69](../src/data/repositories/push-subscriptions.ts#L69), [L108](../src/data/repositories/push-subscriptions.ts#L108) | `user_push_subscriptions` | 3 | P3 — retornos de upsert e listagem |
| [src/data/repositories/card-bill-rollovers.ts](../src/data/repositories/card-bill-rollovers.ts#L61), [L95](../src/data/repositories/card-bill-rollovers.ts#L95) | `card_bill_rollovers` | 2 | P2 — tabela usada na Home/Cartões |
| [src/data/repositories/card-payments.ts](../src/data/repositories/card-payments.ts#L32), [L56](../src/data/repositories/card-payments.ts#L56) | `card_payments` | 2 | P2 — tabela usada na Home/Cartões |
| [src/data/repositories/cash-checkpoints.ts](../src/data/repositories/cash-checkpoints.ts#L29), [L54](../src/data/repositories/cash-checkpoints.ts#L54) | `cash_checkpoints` | 2 | P2 — carregado no cálculo de saldo real |
| [src/data/repositories/categories.ts](../src/data/repositories/categories.ts#L29), [L45](../src/data/repositories/categories.ts#L45) | `categories` | 2 | P2 — carregado globalmente |
| [src/data/repositories/credit-cards.ts](../src/data/repositories/credit-cards.ts#L25), [L37](../src/data/repositories/credit-cards.ts#L37) | `credit_cards` | 2 | P2 — carregado globalmente |
| [src/data/repositories/loans.ts](../src/data/repositories/loans.ts#L21), [L33](../src/data/repositories/loans.ts#L33) | `loans` | 2 | P3 |
| [src/data/repositories/support-tickets.ts](../src/data/repositories/support-tickets.ts#L83), [L110](../src/data/repositories/support-tickets.ts#L110) | `support_tickets` | 2 | P3 |
| [src/data/repositories/access.ts](../src/data/repositories/access.ts#L65) | `access_invites` | 1 | P3 |
| [src/data/repositories/allocation-targets.ts](../src/data/repositories/allocation-targets.ts#L28) | `class_targets` / `sector_targets` | 1 | P3 |
| [src/data/repositories/budgets.ts](../src/data/repositories/budgets.ts#L20) | `budgets` | 1 | P2 |
| [src/data/repositories/debts.ts](../src/data/repositories/debts.ts#L21) | `debts` | 1 | P2 |
| [src/data/repositories/devices.ts](../src/data/repositories/devices.ts#L61) | `user_devices` | 1 | P3 |
| [src/data/repositories/income-goals.ts](../src/data/repositories/income-goals.ts#L19) | `income_goals` | 1 | P3 |
| [src/data/repositories/portfolio-monthly-prices.ts](../src/data/repositories/portfolio-monthly-prices.ts#L22) | `portfolio_monthly_prices` | 1 | P2 |
| [src/data/repositories/recurrences.ts](../src/data/repositories/recurrences.ts#L48) | `recurrences` | 1 | P2 |
| [src/data/repositories/telegram-settings.ts](../src/data/repositories/telegram-settings.ts#L34) | `admin_telegram_settings` | 1 | P3 |
| [src/data/repositories/user-preferences.ts](../src/data/repositories/user-preferences.ts#L30) | `user_preferences` | 1 | P2 — carregado em toda sessão autenticada |
| [supabase/functions/asaas-checkout/index.ts](../supabase/functions/asaas-checkout/index.ts#L148) | `user_subscriptions` | 1 | P3 — Edge Function |
| [supabase/functions/support-notify/index.ts](../supabase/functions/support-notify/index.ts#L140) | `support_tickets` | 1 | P3 — Edge Function |

### 2.2 Assets em `public/`, Base64 Inline e SVGs

- **Peso total em `public/`:** `112` arquivos somando **`3.275.862 B` (~3,12 MiB)**.
- **P1 · `72` arquivos de mídia sem referência em código de produção, HTML, manifest ou Edge Functions (`2.772.374 B` / ~84,6% do peso de `public/`):**
  - **`public/brand/` (`61` arquivos, `2.247.151 B`):** Inclui masters sem tamanho (`logo-teal-light.png` `273.741 B`, `logo-teal-dark.png` `269.044 B`, `logo-amber-dark.png` `267.174 B`, `logo-amber-light.png` `246.295 B`), suas versões `.webp` mestras (`74 KB`–`93 KB`), `logo.png` (`108.136 B`), e toda a grade não utilizada `-{16,32,64,192,256,512}.{png,webp}` + `-{128}.webp`. Conforme verificado em [src/components/layout/logo-icon.tsx](../src/components/layout/logo-icon.tsx#L74) e [L99-L100](../src/components/layout/logo-icon.tsx#L99-L100), o app só referencia dinamicamente `-128.png` e `-256.png`; e [supabase/functions/_shared/email-templates.ts](../supabase/functions/_shared/email-templates.ts#L97-L98) só referencia `logo-{amber,teal}-light-128.png`. Adicionalmente, `logo-full.webp` (`10.948 B`) não tem uso em produção (e o comentário de `vite.config.ts:38` cita `logo-full.png (~5 MB)`, porém o arquivo atual mede `29.719 B`).
  - **`public/pwa/icons/` (`11` arquivos, `525.223 B`):** Duplicatas e ícones legados (`icon-pro-512.png` `99.772 B`, `icon-pro-192.png` `21.837 B`, `icon-transparent-512.png` `108.136 B`, `pwa-512x512.png` `108.136 B`, `icon-maskable-512.png` `54.237 B`, `pwa-maskable-512x512.png` `54.237 B`, `icon-transparent-192.png` `20.196 B`, `pwa-192x192.png` `20.196 B`, `icon-maskable-192.png` `10.514 B`, `pwa-maskable-192x192.png` `10.514 B`, `apple-touch-icon.png` `17.448 B`) fora de [index.html](../index.html) e [public/pwa/manifest.webmanifest](../public/pwa/manifest.webmanifest#L19-L24) (que consomem apenas `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png` e `apple-touch-icon-180.png`).
- **P2 · Imagens WebP Base64 inline:**
  - [index.html](../index.html#L411) e [L421](../index.html#L421) embutem 2 ícones do splash (`14.918 B` ao todo, elevando `dist/index.html` para `33.627 B`). Justificável pelo paint imediato pré-JS, mas deve ser mantido sob teto rígido.
  - [src/components/layout/logo-inline-assets.ts](../src/components/layout/logo-inline-assets.ts#L12-L15) embute 4 variantes WebP em base64 (`29.532 B` brutos → `logo-icon-BKe4T84Q.js` de `30.988 B`), o que neutraliza cache HTTP independente e infla o chunk do shell/header.
- **SVGs em `src/`:** Nenhum SVG gigante ou não otimizado encontrado; os maiores arquivos `.tsx` com `<svg>` são gráficos de dados (`concentric-allocation-donut.tsx` `16.177 B`, `interactive-target-donut.tsx` `11.575 B`, `daily-flow-chart.tsx` `8.736 B`, `performance-svg-bars.tsx` `8.658 B`).

### 2.3 Fontes e Bloqueio de LCP

- **P1 · Descoberta tardia das fontes locais atrás do CSS único (`226.655 B`):**
  - [src/styles/fonts.css](../src/styles/fonts.css#L1-L39) declara 5 arquivos `.woff2` (`inter.woff2` `48.256 B`, `sora.woff2` `33.628 B`, `ibm-plex-mono-{400,500,600}.woff2` `14.708 B` / `14.888 B` / `15.620 B`; total `127.100 B`) com `font-display: swap`.
  - Como `fonts.css` é importado em [src/styles/globals.css](../src/styles/globals.css#L1) (compilado em `index-DBuTlvWC.css`, `226.655 B`) e [index.html](../index.html) **não possui `<link rel="preload" as="font">`** (nem `@font-face` inline crítico), o navegador precisa baixar e parsear todo o CSS antes de descobrir `inter.woff2` e `sora.woff2`, criando cadeia crítica sequencial e risco de FOUT/LCP tardio.
- **P2 · Fontes externas em páginas de fallback offline:**
  - [public/offline.html](../public/offline.html#L7-L10) e [public/pwa/offline.html](../public/pwa/offline.html#L7-L10) carregam `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap`. Em offline frio (sem visita prévia ao domínio Google Fonts em cache), o fallback depende de fonte do sistema e dispara requisição fadada a falha.

---

## 3. Código Morto & Higiene

### 3.1 Arquivos Órfãos Não Importados em Produção (`8` não-barrel + `36` barrels)

#### Arquivos de código morto efetivo (`0` importações em `src/` produção e `0` em testes)

| Arquivo | Linhas | Tipo / Observação |
|---|---:|---|
| [src/features/investments/components/resumo/portfolio-indicators-guide-modal.tsx](../src/features/investments/components/resumo/portfolio-indicators-guide-modal.tsx) | 221 | Modal guia completo nunca montado no fluxo atual de investimentos |
| [src/features/investments/components/aporte/aporte-input-card.tsx](../src/features/investments/components/aporte/aporte-input-card.tsx) | 173 | Card legado de entrada de aporte substituído pelo cockpit |
| [src/features/transactions/components/split/split-manage-helpers.ts](../src/features/transactions/components/split/split-manage-helpers.ts) | 108 | Helpers puros de transição (`applyParticipantFullSettle`, etc.) sem consumidor |
| [src/features/debts/hooks/use-export-debts-csv.ts](../src/features/debts/hooks/use-export-debts-csv.ts) | 61 | Hook de exportação CSV de dívidas/empréstimos sem uso |
| [src/features/investments/components/resumo/portfolio-concentration-alert.tsx](../src/features/investments/components/resumo/portfolio-concentration-alert.tsx) | 29 | Alerta visual antigo substituído pelo carrossel de insights |

#### Shims de retrocompatibilidade órfãos em produção (`3` arquivos)
- [src/domain/budgets/kits.ts](../src/domain/budgets/kits.ts) (`6L`, `0` usos em prod; ainda importado apenas em testes de retrocompatibilidade).
- [src/features/budgets/components/category-form-fields.tsx](../src/features/budgets/components/category-form-fields.tsx) (`2L`, `0` usos em prod e `0` em testes).
- [src/features/budgets/components/use-category-form.ts](../src/features/budgets/components/use-category-form.ts) (`2L`, `0` usos em prod e `0` em testes).

#### Exports mortos em `src/app/` (`5` símbolos)
- `publicLegalLoaders`, `publicLegalRoutes`, `publicToolsLoaders` e `publicToolsRoutes` em [src/app/routes.tsx](../src/app/routes.tsx#L54-L86): consumidos apenas por `src/app/routes.test.ts`; [src/app/router.tsx](../src/app/router.tsx#L96-L138) redeclara os mesmos `lazy()` inline.
- `AuthenticatedRoot` em [src/app/authenticated-root.tsx](../src/app/authenticated-root.tsx#L45): `0` referências em produção e `0` em testes.

#### `36` Barrels `index.ts` sem importação em produção
Embora `AGENTS.md §3/§7` recomende `index.ts` por pasta, `36` barrels não possuem nenhum importador na árvore de produção (`2` deles são usados apenas em testes: `src/features/landing/index.ts` e `src/features/legal/index.ts`). Lista completa:
- `src/components/routing/index.ts`, `src/domain/gestures/index.ts`, `src/domain/navigation/index.ts`, `src/services/analytics/index.ts`
- `src/features/admin/index.ts`, `src/features/admin/forensics/index.ts`, `src/features/admin/forensics/core/engine/index.ts`, `src/features/admin/forensics/core/journeys/index.ts`
- `src/features/auth/index.ts`, `src/features/budgets/index.ts`, `src/features/budgets/pages/index.ts`, `src/features/business/index.ts`, `src/features/cards/index.ts`, `src/features/categories/index.ts`, `src/features/debts/index.ts`, `src/features/demo-tour/index.ts`, `src/features/family/index.ts`, `src/features/insights/index.ts`, `src/features/insights/pages/index.ts`, `src/features/investments/index.ts`, `src/features/investments/pages/index.ts`, `src/features/landing/index.ts`, `src/features/landing/components/index.ts`, `src/features/landing/hooks/index.ts`, `src/features/landing/pages/index.ts`, `src/features/legal/index.ts`, `src/features/onboarding/index.ts`, `src/features/overview/index.ts`, `src/features/public-share/index.ts`, `src/features/reports/index.ts`, `src/features/settings/index.ts`, `src/features/settings/pages/index.ts`, `src/features/subscription/index.ts`, `src/features/tools/index.ts`, `src/features/transactions/wizard/index.ts`, `src/features/trips/index.ts`.

### 3.2 Dependências no `package.json`

| Pacote | Grupo em `package.json` | Situação Verificada |
|---|---|---|
| `@capacitor/android` (`^8.5.3`) | `dependencies` | `0` imports em `src/`, `scripts/` ou `e2e/` — pacote nativo de CLI/plataforma que pertence a `devDependencies` |
| `@testing-library/dom` (`^10.4.1`) | `devDependencies` | `0` imports diretos no repositório (mantido apenas como peer dependency implícita de `@testing-library/react`) |
| `date-fns` | *Transitiva* (não declarada no `package.json`) | `0` imports diretos no código; entra via `react-day-picker` e gera `vendor-date-D9nzNBiG.js` (`27.931 B`) |

### 3.3 Funções e Constantes Exportadas Duplicadas (`11` ocorrências reais)

| Símbolo(s) | Ocorrência A | Ocorrência B | Risco / Divergência |
|---|---|---|---|
| `cleanCPF`, `formatCPF`, `isValidCPF` | [src/domain/validation/cpf.ts](../src/domain/validation/cpf.ts#L7-L23) | [src/services/masks/cpf.ts](../src/services/masks/cpf.ts#L9-L49) | Implementações duplicadas com diferença em `null`/`undefined` e corte de 11 dígitos; `masks/cpf.ts` é reexportado em `services/masks/index.ts` sem uso direto em prod |
| `shiftMonth` | [src/lib/date.ts](../src/lib/date.ts#L14) | [src/domain/cards/index.ts](../src/domain/cards/index.ts#L135) | Código idêntico linha a linha |
| `todayISO` | [src/lib/date.ts](../src/lib/date.ts#L36) | [src/domain/debts/index.ts](../src/domain/debts/index.ts#L16) | Duas implementações distintas para a data local `YYYY-MM-DD` |
| `invoiceClosingDate` | [src/domain/cards/index.ts](../src/domain/cards/index.ts#L79) | [src/domain/notifications/hub/event-detectors.ts](../src/domain/notifications/hub/event-detectors.ts#L63) | Função idêntica duplicada no hub de notificações |
| `normalizeText` | [src/domain/insights/shared.ts](../src/domain/insights/shared.ts#L31) | [src/domain/predictions/index.ts](../src/domain/predictions/index.ts#L65) | Divergência sutil: `shared.ts` colapsa espaços internos (`\s+` → `" "`), `predictions` apenas aplica `trim()` |
| `medianOf` | [src/domain/insights/recurrences.ts](../src/domain/insights/recurrences.ts#L538) | [src/domain/predictions/index.ts](../src/domain/predictions/index.ts#L250) | Divergência numérica: `recurrences.ts` arredonda com `Math.round`, `predictions` mantém valor fracionário |
| `isWeekend` | [src/domain/portfolio/business-days.ts](../src/domain/portfolio/business-days.ts#L113) | [src/domain/predictions/index.ts](../src/domain/predictions/index.ts#L122) | Regra de fim de semana duplicada |
| `getTransactionIntradayWeight` | [src/domain/portfolio/canonical-normalizer.ts](../src/domain/portfolio/canonical-normalizer.ts#L1053) | [src/domain/portfolio/tax.ts](../src/domain/portfolio/tax.ts#L661) | `canonical-normalizer` reconhece aliases em PT-BR (`compra`, `venda`, `resgate`, `subscricao`); `tax.ts` só aceita chaves em inglês |
| `formatFixedIncomeRateLabel` | [src/domain/portfolio/fixed-income.ts](../src/domain/portfolio/fixed-income.ts#L413) | [src/domain/portfolio/position-grouping.ts](../src/domain/portfolio/position-grouping.ts#L230) | Lógica de formatação de SELIC/CDI duplicada com assinaturas distintas |
| `THEME_PREFERENCES` | [src/domain/theme/theme-resolver.ts](../src/domain/theme/theme-resolver.ts#L3) | [src/types/schema.ts](../src/types/schema.ts#L100) | Constante idêntica duplicada entre domínio e schema |
| `REPORT_WEIGHT_PRESETS` | [src/features/transactions/components/report-weight-constants.ts](../src/features/transactions/components/report-weight-constants.ts#L2) | [src/features/transactions/wizard/wizard-schemas.ts](../src/features/transactions/wizard/wizard-schemas.ts#L6) | Lista de presets idêntica duplicada dentro da própria feature |

### 3.4 Chamadas `console.*` em Código de Produção (`src/` excluindo testes)

- **`console.log` / `console.info` / `console.debug`:** **`0` ocorrências**.
- **`console.warn` (`13`) e `console.error` (`1`):** **`14` ocorrências totais**. Embora o minifier do Rolldown remova chamadas `console.*` no build de produção (`vite.config.ts:111`, `dropConsole: true`), elas permanecem ativas em desenvolvimento/testes e ignoram o gateway estruturado (`observability.ts` / `errors.ts`):
  - `console.error` (`1`): [src/hooks/use-pending-split-expense.ts](../src/hooks/use-pending-split-expense.ts#L83)
  - `console.warn` (`13`): [src/hooks/use-pending-split-expense.ts](../src/hooks/use-pending-split-expense.ts#L72), [src/services/split-sync.ts](../src/services/split-sync.ts#L316), [L350](../src/services/split-sync.ts#L350), [L379](../src/services/split-sync.ts#L379), [src/state/mutations/use-split-sync-mutations.ts](../src/state/mutations/use-split-sync-mutations.ts#L168), [src/features/public-share/hooks/use-public-split-actions.ts](../src/features/public-share/hooks/use-public-split-actions.ts#L121), [src/features/public-share/components/use-split-onboarding.ts](../src/features/public-share/components/use-split-onboarding.ts#L102), [src/data/rpc/admin.ts](../src/data/rpc/admin.ts#L359), [src/data/repositories/card-bill-rollovers.ts](../src/data/repositories/card-bill-rollovers.ts#L81), [L114](../src/data/repositories/card-bill-rollovers.ts#L114), [src/data/repositories/public-shares.ts](../src/data/repositories/public-shares.ts#L165), [src/data/repositories/analytics.ts](../src/data/repositories/analytics.ts#L42), [src/data/repositories/support-tickets.ts](../src/data/repositories/support-tickets.ts#L68).

---

## 4. Plano de Ação Priorizado (Sem Quebra de Arquitetura `AGENTS.md`)

1. **Onda 1 — Ganhos Imediatos de Boot, LCP e Splitting (P1):**
   - Adicionar `<link rel="preload" as="font" type="font/woff2" crossorigin>` para `inter.woff2` e `sora.woff2` em `index.html`, e trocar Google Fonts em `offline.html` / `pwa/offline.html` por fonte local ou stack do sistema.
   - Restaurar o `lazy()` real de `InvestmentWizard` e `CashFormDialog` removendo os imports síncronos em `resumo-modals-host.tsx` e `aporte-tab.tsx`; aplicar `lazy()` em `LaunchWizard` na `BusinessPage` e nos diálogos/abas pesadas de `Overview`, `Cards`, `Reports`, `Insights` e `PageShell` (`GlobalSearch`, `AppLockOverlay`, `PendingDividendsDialogHost`).
   - Remover os `16` `import * as` de `@/state` e retirar `Command` (`cmdk`) e `QrCodeCanvas` (`uqr`) do barrel raiz `@/components/ui/index.ts`.
2. **Onda 2 — Redução de Payload de Rede, Banco e `public/` (P1/P2):**
   - Mover a consulta de `src/services/split-sync.ts:61` para `src/data/repositories/expenses.ts` (conformidade `AGENTS.md §3`) e substituir `.select("*")` por projeções explícitas de colunas nas tabelas de maior tráfego (`expenses`, `incomes`, `portfolio`, `trips`, `public_shares`, `admin`).
   - Expurgar os `72` assets sem referência em `public/brand/` e `public/pwa/icons/` (`~2,64 MiB`), mantendo apenas os tamanhos consumidos por `logo-icon.tsx`, `email-templates.ts`, `index.html` e `manifest.webmanifest`, além de avaliar servir `logo-inline-assets.ts` via asset estático cacheável.
3. **Onda 3 — Higiene de Código, Dependências e Duplicações (P2/P3):**
   - Remover os `5` arquivos de código morto efetivo e os `3` shims órfãos (atualizando testes de `kits.ts` para `@/domain/categories`), consolidar `routes.tsx` vs `router.tsx` e remover `AuthenticatedRoot`.
   - Mover `@capacitor/android` para `devDependencies` e consolidar as `11` funções/constantes duplicadas (`cpf`, `shiftMonth`, `todayISO`, `invoiceClosingDate`, `getTransactionIntradayWeight`, `THEME_PREFERENCES`, `REPORT_WEIGHT_PRESETS`).
   - Encaminhar os `14` `console.warn`/`console.error` relevantes para `captureException`/`observability.ts` ou remover ruído redundante.
