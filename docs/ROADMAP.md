# 🗺️ ROADMAP.md — Roadmap Executável de Desenvolvimento

> **Status:** v1.8 — **plano de execução canônico** do projeto (o `ESPECIFICACAO_TECNICA.md` §6 o referencia como resumo executivo). Foco em **ordem de execução**, **ordem de construção da UI (Design System primeiro)** e **Definition of Done (DoD)** por fase. **v1.52** registra a **simplificação ergonômica de transações e descontinuação do Swipe-to-Delete** (2026-08-17): **(1) Whole-Element Interaction em Transações**: remoção completa de gestos de arrasto lateral (`useSwipeAction`, handlers de ponteiro e contêineres ocultos de overflow) em `TransactionRow`; clique direto em qualquer ponto da linha aciona a abertura do diálogo de detalhes com feedback tátil (`triggerHaptic("light")`); **(2) Diálogos de Detalhes Simplificados**: `ExpenseDetailDialog` e `IncomeDetailDialog` refatorados com a remoção da prop `openDeleteConfirm` e do estado `deleteIntent`, centralizando a exclusão e confirmação modal diretamente nos botões internos de ação dos diálogos; **(3) Limpeza e Descontinuação**: remoção do hook `useSwipeAction` e testes associados, eliminando código morto e dependências não utilizadas. Suíte **1159 testes / 142 arquivos** (100% verde).
> **v1.51** registra a **modernização da experiência de carregamento e barra de título do PWA** (2026-08-17): **(1) HTML Splash Screen** — `<div id="app-splash">` inline em `index.html` com suporte aos 3 temas (`data-theme`), ícone 120px, animação pulse + barra de progresso teal; some via `#root:not(:empty)` (CSS puro, zero JS); **(2) Window Controls Overlay** — `display_override: ["window-controls-overlay", "standalone"]` no manifest + `<div id="app-titlebar">` arastável em `index.html` via `env(titlebar-area-*)`: barra de título do PWA pintada no tom do tema ativo (fundo + borda inferior, sem ícone/texto) com suporte aos 3 temas via `[data-theme]`; **(3) `background_color` do manifest** corrigido de `#FFFFFF` para `#0C1923` (elimina o flash branco ao abrir o PWA em tema escuro); **(4) `offline.html` redesenhado** — Inter, ícone 96px, botão discreto, suporte light/dark/OLED; **(5) `<title>` encurtado** — `"Guia Financeiro"` (sem o subtexto na aba/barra). `PWA_GUIDELINES.md` atualizado com §4.1 (WCO) e correções nas seções de splash e manifest. Validação: typecheck + lint verdes (sem alteração de TypeScript).
> **v1.50** registra a **auditoria de integridade, robustez de carregamento assíncrono e resiliência de ciclo de vida** (2026-08-16): **(1) Submissão nativa e autoFocus estendidos**: `CardFormContent`, `ExpenseEditForm` e `IncomeEditForm` encapsulados com `<form onSubmit={...}>` e botões `type="submit"` para salvar via tecla `Enter` e autoFocus imediato; **(2) Robustez de estados de loading e erro**: inclusão de todas as subqueries interdependentes nas condições de `loading` e `error` das páginas (`OverviewPage`, `ReportsPage`, `InsightsPage` e `RemindersPage`), prevenindo renderizações intermediárias com arrays vazios antes do término das consultas secundárias; **(3) Limpeza segura de timers**: `TargetsTab` com cancelamento explícito de `window.setTimeout` no desmonte de componente (`useEffect`), eliminando memory leaks. Suíte **1144 testes / 141 arquivos** (100% verde).
> **v1.49** registra o **pacote de usabilidade, conforto, micro-interações táteis e agilidade de entrada** (2026-08-16): **(1) DatePicker inteligente**: fechamento automático imediato ao selecionar um dia (`setOpen(false)` no `onSelect`) + botões de atalho rápido no rodapé ("Hoje" e "Ontem" em 1 clique) + micro-haptic de seleção (`triggerHaptic("light")`); **(2) Micro-interações táteis nos seletores**: `triggerHaptic("light")` integrado nas escolhas do `Select` e `RadioGroup` e `triggerHaptic("light")` no engajamento do `useSwipeAction`; **(3) Submissão rápida com tecla Enter e `autoFocus` inteligente**: formulários internos de modais (`CategoryFormContent`, `DebtFormContent`, `LimitDialogContent`, `PaymentDialogContent`, `SettleDialogContent`, `AssetFormContent`, `TransactionFormContent`) agrupados com `<form onSubmit={...}>` permitindo salvar diretamente pelo teclado (`Enter` no desktop e "Ir/Concluído" no mobile) e foco automático no 1º campo; **(4) Descarte instantâneo de toasts**: cartões de notificação descartáveis com toque/clique direto; **(5) Foco inicial seguro**: `ConfirmDialog` foca por padrão no botão neutro ("Cancelar") para prevenção de exclusões acidentais por repetição da tecla Enter. Suíte **1143 testes / 141 arquivos** (+3 testes novos).


**v1.35** registra a **auditoria de código (3ª passada — resíduos e exports mortos)** (2026-08-16, após v1.22 e v1.32): com `knip` + verificação por import, **removidos 26 exports mortos** — 6 re-exports de chaves de query no barrel `state` (`categoriesKey`, `creditCardsKey`, `cardPaymentsKey`, `cardExpensesKey`, `debtsKey`, `budgetsKey`), 10 chaves de query internas sem consumidores externos un-exportadas (`groupTargetsKey`, `sectorCapsKey`, `assetPricesKey`, `feedbackKey`, `onboardingKey`, `portfolioAssetsKey`, `portfolioTransactionsKey`, `allPortfolioTransactionsKey`, `reminderStatesKey`), 2 re-exports mortos nos barrels de features (`AuthShell` em `features/auth`, `TransactionListPage` em `features/transactions` — rotas importam as páginas por deep-path), e constantes/funções sem uso externo un-exportadas (`AXIS_LOCK_TANGENT` — totalmente morta, removida; `FLICK_*`/`ACTIVATION_*`/`BOUNDARY_RESISTANCE_FACTOR` em `domain/gestures`; `KNOWN_SERVICES`/`isKnownService`/`isSubscriptionCategory`/`tierOf`/`hasStableValue` em `domain/insights/subscriptions`; `HIGH_SPEND_THRESHOLD_PERCENT`/`REDUCE_*` em `domain/savings`; `ONBOARDING_STEP_IDS`; `PACE_MIN_ELAPSED_PERCENT`; `CSV_DELIMITER`). **Mantidos** (verificados individualmente): `vitest-axe.d.ts` (referenciado pelo setup), `supabase/functions/quotes/index.ts` (edge function deployada), exports de domínio consumidos por testes (convenção AGENTS.md §3) e `axe-core` (dependência de tipos do vitest-axe). Varreduras limpas: zero `console.log`/`debugger`, zero `.only`/`.skip`, zero TODOs/FIXME, zero helpers de data duplicados. Suíte **1134 testes / 139 arquivos** (sem regressões).
**v1.34** registra a **auditoria de fluxo do usuário (3ª passada) — lembretes navegáveis e feedback de pagamento** (2026-08-16): varredura ponta a ponta das jornadas confirmou as correções das auditorias anteriores (soft-locks, anti-duplo-clique, anti-perda, retry) e encontrou **2 fragilidades de navegação/feedback** — **(1) Lembretes sem saída**: o `ReminderItem` montava o `link` (deep-link de dívida/fatura) mas **nunca o usava** — os cards não eram clicáveis e o usuário ficava sem navegação para a dívida/fatura; o card agora é **clicável e acessível** (`role=button`, Enter/Espaço) e navega com o deep-link, incluindo o **destaque da dívida específica** (`/dividas?q=<id>`, mesmo padrão da busca global — antes `/dividas` sem contexto) e o destaque do cartão/mês nas faturas (+1 teste); **(2) Pagamento/estorno sem confirmação**: `useCreateCardPayment`/`useCreateRefund` fechavam o modal **sem nenhum feedback de sucesso** (o usuário não sabia se gravou) — agora exibem toast "Pagamento registrado"/"Estorno registrado" (padrão de feedback das demais ações). Fluxos revalidados sem ação: formulários CRUD com `pending` + erro inline + confirmação anti-perda (wizard), exclusões com rollback/toast, exportação com loading por ação, deep-links derivados da URL sem perda de contexto. Suíte **1134 testes / 139 arquivos**.
**v1.33** registra a **auditoria arquitetural da camada de dados — N+1, waterfalls e atomicidade** (2026-08-16): varredura completa de repositórios, hooks de estado e componentes. **Diagnóstico:** a camada de dados estava saudável — sem loops de fetch (único `Promise.all` em `map` é o backup `fetchAllUserData`, paralelo intencional), sem fetch por linha/card (posição da carteira usa `listAllPortfolioTransactions` + agrupamento em `Map`; `useAssetPosition` só roda ao abrir o diálogo do ativo), relacionamentos resolvidos por batch (`listAllExpenses` + categorias em `Map`, sem N+1 por lançamento), sem waterfalls (queries TanStack paralelas com `enabled` sob demanda e **chaves de cache compartilhadas** entre `useGlobalSearchEntries`/`usePredictionHistory`/overview — deduplicação automática, sem chamadas concorrentes duplicadas), sem race conditions (cache chaveado por mês/cartão — respostas fora de ordem são impossíveis; refetches só em "Tentar novamente") e payloads já seletivos (`asset_prices` com colunas explícitas, contagens com `head: true`). **Correção (1 fragilidade real):** `deleteCardPayment` (exclusão de pagamento/estorno) executava **2 DELETEs sequenciais no cliente** (renda automática `[REFUND]` e depois o pagamento) **sem transação** — violava AGENTS §5 (escritas compostas via RPC) e, se o 2º DELETE falhasse, a renda sumia e o pagamento permanecia (inconsistência). Corrigido com o **RPC transacional `delete_card_payment`** (migração `0011`): valida ownership, remove o pagamento e a renda `[REFUND]` associada num único passo atômico no servidor (com audit D2) — o repositório agora delega ao RPC (+1 teste de delegação; contrato `src/types/database.ts` atualizado). Suíte **1133 testes / 139 arquivos**.
**v1.32** registra a **auditoria de código — remoção de resíduos e DRY** (2026-08-16, 2ª passada após v1.22): com `knip` + verificação por import, removidos **74 exports mortos** — re-exports sem consumidores nos barrels `state` (18: `expensesKey`, `incomesKey`, `useAssetPrices`, `onboardingKey` etc.), `domain/export` (10: `formatCsvDecimal`, `validateIntegrity`, `BACKUP_VERSION`…), `domain/gestures` (9), `domain/insights` (12), `domain/money` (6) — e **funções/constantes sem uso** (`useSetManualPrice`/`useRemoveManualPrice`, `lastDayOfMonth`, `subscribeCalculatorTarget`, `sentryDsn`/`downloadBlob`/`subscribe*` un-exported, `CATEGORY_RULES`, `FIRE_*`, `CAT_DONUT_PALETTE`, `somaCents` do barrel…); removido o script one-off `scripts/migrate-legacy-data.mjs` (ETL legado já executado; guia `DATA_MIGRATION_GUIDE.md` mantém a versão TS de referência). **Bug corrigido:** snooze de lembretes gerava `snoozeUntil` "NaN-NaN-NaN" (o helper local recebia a CHAVE da ocorrência em vez de uma data) — lembrete adiado nunca mais voltava; agora usa `addDaysISO(today, 7)` (+1 teste). **DRY:** 3 helpers locais de soma de dias (`addDay`×2, `addDays`) consolidados no canônico `addDaysISO` de `domain/debts`. Suíte **1132 testes / 139 arquivos**.
> **Referências:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) (estrutura e convenções) · [`ESPECIFICACAO_TECNICA.md`](../ESPECIFICACAO_TECNICA.md) (regras de negócio, schema, UI/UX).

---

## 1. PRINCÍPIOS DE ORDENAÇÃO

1. **Biblioteca de componentes antes das telas:** primitivos (`components/ui`) → módulos de domínio (`components/modules`) → telas (`features`). Nenhuma tela é construída antes do primitivo que ela usa.
2. **Infra antes de regras:** schema, RLS e RPCs transacionais precedem qualquer cálculo/CRUD.
3. **Domínio puro antes da UI:** cada regra nasce como função pura testável em `domain/`, só então vira tela.
4. **Dependência topológica:** Fase N só começa quando a DoD da Fase N−1 está verde.
5. **Cada fase entrega valor testável** (não há fase "só de infra" sem verificação objetiva).

---

## 2. VISÃO GERAL DAS FASES

| Fase | Nome | Entrega central | UI entregue |
|---|---|---|---|
| **F0** | Fundação & Design System | Repo, CI, tokens (light/dark/oled), **primitivos de UI**, shell de navegação | Shell + primitivos |
| **F1** | Infraestrutura de Dados & Auth | Schema, RLS, audit_events, **RPCs transacionais**, contratos de estado, cotações | Auth |
| **F2** | Core de Finanças Pessoais | Domínio puro + CRUDs (receitas/despesas/cartões/dívidas/orçamentos) | Telas CRUD + wizard |
| **F3** | Análise, Projeção & Corte | Motor de insights, projeção, relatórios, lembretes | Telas de análise |
| **F4** | Carteira & Rebalanceamento | Ledger, valoração, metas, calculadora de aporte | Telas de carteira |
| **F5** | Experiência Transversal | Busca global, acessibilidade, temas, performance | Busca, polish |
| **F6** | Hardening & Lançamento | Prova de fidelidade, segurança, deploy | — |
| **F7** | Ergonomia de Navegação & Header | BottomNav 5 slots (com Cartões), Sidebar colapsável, Top Header & Search responsivo | Shell & Navegação |
| **F8** | Refinamento Premium & Dashboard Insights | Micro-interações, superfícies suaves, Cards inteligentes no Início (ritmo, faturas, alertas) | Dashboard & Design |
| **F9** | Utilitários Nativos & Gestos | Calculadora flutuante arrastável (FAB + injeção de valor) e Scroll-to-Top inteligente | Utilitários & Gestos |
| **F10** | Identidade Visual Oficial "Guia Financeiro" | Reestilização dos 3 temas (Petróleo + Teal + Ouro + Coral), BrandLogo, assets PWA e contraste AA | Brand & Identidade |
| **F11** | Centro de Personalização, Experiência Tátil & Micro-Interações Vivas | Acentos de cor, estilos de card, botões com ripple/spring, abas com sliding pill, hub /configuracoes e dashboard modular | Personalização & Micro-Interações |
| **F12** | Polimento de UI/UX, Design System & Experiência Visual | Superfícies/profundidade consistentes, hierarquia tipográfica de dados financeiros, empty states e skeletons por contexto, micro-interações de entrada/saída e feedback de escrita, harmonização claro/escuro/OLED | Polimento & Design System |
| **F13** | Hotfixes Mobile, Layout Fixo & Consistência | Header & BottomNav fixos com scroll interno no main, Scroll-to-Top unificado, salvaguarda de overflow, ícones dinâmicos de categoria e edição completa de despesas | Mobile Shell, Categorias & Edição |
| **F14** | Consistência de Estados & Ergonomia de Dados (Trilha A) | Skeletons por contexto na carteira, rentabilidade (lucro/prejuízo não realizado), densidade & teclado | Carteira refinada |
| **F15** | Micro-Interações & Conforto Visual (Trilha A) | Feedback de escrita uniforme, NumberTicker na Posição, hover/focus refinados | Polish financeiro |
| **F16** | Carteira na Home — KPI Real (Trilha B) | KPI de investimentos real + widget de alocação (elimina o stub da Home) | Home com carteira |
| **F17** | Dashboard de Investimentos `/investments` (Trilha B) | KPIs executivos, donuts de alocação (classe/ticker), posições com lucro/prejuízo | Dashboard investimentos |
| **F18** | Proventos: Extrato & Calendário (Trilha B) | Extrato mensal de proventos recebidos + calendário (escopo mínimo) | Proventos |
| **F19** | Inteligência & Consistência dos Insights (Trilha A) | Limpeza de código morto F8, fontes únicas (normalização/tolerância/essenciais), `numberToCents` único, reuso de motores na página, tendência nos Diagnósticos, investimentos reais nas projeções | Insights refinados |
| **F20** | Sistema de Gestos & Navegação por Swipe (Trilha A) | Engine `useSwipeNavigation` (axis-lock ±30°, thresholds/flick, isolamento, **edge inset 24px** + arming 1.5), `Tabs swipeable` nas 6 telas de abas, feedback elástico — swipe de meses `MonthSwiper` **removido** (2026-08-16, ver §3 F20) | Gesture UX mobile |
| **F21** | Inteligência de Entrada & Automações Preditivas | Inferência automática de categorias e métodos por descrição, templates de lançamentos rápidos e clonagem | Entrada preditiva |
| **F22** | Central de Exportação, Backup & Fechamento Mensal | Exportação CSV/JSON, backup e restauração em Configurações, relatório de fechamento mensal otimizado para impressão/PDF | Exportação e Relatório |
| **F23** | Engenharia de Performance & Code-Splitting 3D | Isolamento dinâmico de dependências 3D (Three.js), prefetching inteligente e sintonia fina de cache de queries | Otimização e Performance |
| **F24** | Planejamento Financeiro & Simulador FIRE | Motor de independência financeira (juros compostos, regra 4%, taxa de poupança), meta de reserva de emergência e projeção multi-anual | Planejamento FIRE |
| **F25** | Micro-interações, Feedback Visual & Ergonomia de Interface | Sidebar expand on hover com intent debounce e zero layout shift, Bottom Sheets no mobile, elevação tátil e tooltips | Micro-interações & Ergonomia |
| **F26** | Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX) | Descontinuação do botão flutuante e introdução de overscroll elástico no fim da página (bottom pull-up) com barreira de inércia, micro-indicador minimalista e cancelamento dinâmico — **gesto removido em 2026-08-16** (instável; ver §3, F26) | Gesture UX & Mobile Polish |

---

## 3. FASES DETALHADAS

### Fase 0 — Fundação & Design System

**Objetivo:** base técnica e visual; a biblioteca de primitivos nasce aqui e é pré-requisito para qualquer tela.

**Entregas (na ordem):**
1. Repo novo: Vite + React + TypeScript estrito, ESLint + Prettier, Vitest + Testing Library.
2. CI: typecheck + lint + testes em todo PR.
3. **Tokens dos 3 temas** (light/dark/oled) em `src/styles` + ThemeProvider + toggle + preferência do sistema.
4. **Primitivos de UI** (`components/ui`) — nesta ordem: Button → Input → **MoneyInput** → Select → Card → Badge → Skeleton → EmptyState → Modal/Dialog → Tabs → DataList → Progress → Stepper → Command (⌘K) → Toast. Variações via `cva`.
5. Shell de navegação (`components/layout`): Sidebar (desktop) + BottomNav (mobile) + PageShell; roteamento (react-router) + deep-links (`?card=`, `?month=`, `?q=`).
6. Adotar os tokens de `src/styles/tokens.css` + `globals.css` e carregar as Google Fonts (Inter, Sora, IBM Plex Mono) — identidade definida em `docs/DESIGN_SYSTEM.md`.
7. **PWA base:** `vite-plugin-pwa` + manifest + ícones + service worker de assets (App Shell) — ver `docs/PWA_GUIDELINES.md`.

**✅ DoD**
- CI verde (typecheck + lint + testes).
- 3 temas funcionando com toggle e persistência; contraste AA verificado.
- Primitivos listados existem, com stories/revisão visual em desktop + mobile.
- Shell responsivo navegando entre telas placeholder; deep-links parseados.

**Progresso — ciclo de implementação 1 (2026-08-13):**
- [x] Repo Vite + React + TS estrito · ESLint/Prettier · Vitest + Testing Library
- [x] CI (typecheck + lint + testes + build) — `.github/workflows/ci.yml`
- [x] Tokens dos 3 temas + ThemeProvider (system/light/dark/oled) com persistência (localStorage)
- [x] Primitivos core: Button, Input, **MoneyInput** (com testes), Card, Badge, Skeleton, EmptyState, Progress
- [x] **Primitivos restantes** (ciclo 2) — Select, Checkbox, RadioGroup, DatePicker, Slider, Accordion, Textarea, Dropzone, Modal, ConfirmDialog, Tabs, DataList, Stepper, Command (⌘K), Toast — todos com testes (32/32) e tokens do DESIGN_SYSTEM
- [x] Shell de navegação (Sidebar + BottomNav + PageShell) + rotas das 10 áreas + menu "Mais" + deep-link `?novo=`
- [x] PWA base: `vite-plugin-pwa` (generateSW, 9 entradas) + manifest + ícones placeholder + `offline.html`
- [x] Revisão visual no browser (desktop/mobile/3 temas) — concluída (2026-08-15)

**Progresso — ciclo de implementação 2 (2026-08-13):**
- [x] Primitivos interativos com Radix UI (base do shadcn, já declarada na arquitetura): Select, Checkbox, RadioGroup, Modal, ConfirmDialog, Tabs, Toast, Slider, Accordion, DatePicker (react-day-picker v10 com `getDefaultClassNames` + tokens), Command (⌘K via cmdk)
- [x] Primitivos próprios sem dependência: Textarea, Stepper, DataList (tabela com densidades), Dropzone (input file encapsulado, drag & drop)
- [x] Polyfills de teste (PointerEvent, ResizeObserver, hasPointerCapture) + 18 novos testes de interação (abrir/selecionar/toggle/confirmar) — suíte total 32/32
- [x] Animações dos primitivos registradas nos tokens (`animate-accordion-up/down`, `animate-toast-in/out`)
- [x] `Toaster` montado no shell (`app/providers.tsx`) — infra de feedback pronta para as fases de dados
- [x] Revisão visual no browser (desktop/mobile/3 temas) — concluída (2026-08-15)
- [x] Integrar `Command` (⌘K) global no shell com atalho de teclado (com as rotas reais — entregue na F5.1)

---

### Fase 1 — Infraestrutura de Dados & Autenticação

**Objetivo:** alicerce Online First — dados seguros, atômicos e auditáveis.

**Entregas (na ordem):**
1. Projeto Supabase + cliente único (`data/client.ts`) + módulo de env; estado de conexão/erro explícito. **`.env.example` documentado** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, proxy de cotações).
2. Auth: login, registro, recuperação de senha, sessão, perfil (`profiles` via trigger) + telas de auth (usando primitivos da F0).
3. **Schema completo** (ESPECIFICAÇÃO §2) com migrations versionadas: constraints (parcelas 1–60, card no crédito, pesos 0–1, soma de metas ≤ 100% via trigger) e índices.
4. **RLS** por `auth.uid()` em todas as tabelas; `audit_events` imutável (insert + select, sem update/delete).
5. **RPCs transacionais (D1):** `create_expense_with_debt`, `create_refund`, `delete_expense_installments`, `pay_debt`, `receive_debt`, `settle_integrated_receivable`, `delete_category_migrate`, `set_budget_limit`, `set_income_goal`, `recalculate_bill_competences` + wrappers tipados (`data/rpc.ts`). **Recebem parcelas calculadas no cliente (`domain/money`) e validam invariantes no servidor** (soma = total, 1–60, datas ≥ APP_START_DATE).
6. Gateway de erros (`services/errors`) + **contratos de estado** (`state/`) para os domínios-base.
7. Cotações: tabela `asset_prices` + edge function de atualização (cache em servidor) + fallback + suporte a **preço manual**.
8. ~~**Storage (D11):** abstração `services/storage` + endpoint de presigned URLs~~ — **REMOVIDO DO ESCOPO** (decisão do usuário, 2026-08-15): anexos/avatar ficam fora do fluxo financeiro core e nenhuma tela usa upload; o primitivo `Dropzone` permanece disponível caso a feature surja no futuro.

**✅ DoD**
- Teste de isolamento RLS (usuário A não lê dados de B).
- **Cada RPC com teste de transação**: falha no meio → rollback total, nada persistido.
- Contrato `data | loading | error | CRUD | refresh` disponível para os domínios-base.
- Mensagens do gateway cobertas por teste; telas de auth com estados de erro explícitos.
- **RPCs testados contra banco real (Supabase local):** pgTAP ou vitest + Postgres local — rollback verificado em falha no meio.

**Progresso — ciclo de implementação 1 (2026-08-13):**
- [x] `@supabase/supabase-js` + módulo de env validado (`src/lib/env.ts`, falha clara se faltar `VITE_*`) + cliente único lazy (`src/data/client.ts` tipado com `Database`)
- [x] **Tipos canônicos** (`src/types/schema.ts` + `database.ts`): enums espelhando os literais do schema §2, interfaces das 19 tabelas, `Table<T>` com `Relationships` (GenericSchema) e tipos dos RPCs
- [x] **Migrations versionadas** em `supabase/migrations/`: `0001_schema.sql` (19 tabelas + constraints: parcelas 1–60, cartão no crédito, peso 0–1, grupo sse parcelado, APP_START_DATE), `0002_rls.sql` (RLS `auth.uid()`, `audit_events` imutável, `asset_prices` global, overrides via cartão), `0003_functions.sql` (trigger profiles/preferências no signup, soma de alocação ≤ 100%, **10 RPCs transacionais** com validação de invariantes no servidor)
- [x] **Wrappers tipados** (`src/data/rpc.ts`): helper `callRpc` derivando Args/Returns do `Database` (fonte única) + `unwrapRpc` com erro normalizado via gateway
- [x] **Gateway de erros** (`src/services/errors`): `classifyError` + `getErrorMessage` (rate limit, e-mail não confirmado, credenciais, sessão expirada, rede, duplicado, validação) + 8 testes
- [x] **Auth**: `src/data/auth.ts` (login/registro/recuperação/signOut), `src/hooks/use-auth.ts` (sessão + `onAuthStateChange`, erro de config sem crash), telas `/entrar` `/cadastro` `/recuperar-senha` com primitivos da F0 + guard `RequireAuth` no router (redireciona preservando a rota)
- [x] Primitivo novo `Alert` (erro/sucesso/info/warning) — exigido pelo DRY das telas de formulário
- [x] **Cotações (F1.7)**: edge function `supabase/functions/quotes/` (Deno) — motor puro testável em `_shared/quotes-core.ts` (15 testes: normalização de ticker B3/cripto/internacional, parse da Yahoo Chart API v8, guardrail de spike, montagem do upsert) + handler com fetch em cascata (query1→query2, timeout 4s, tolerante a falha por ticker), auth por service role, upsert do cache global (`user_id NULL`, `source 'api'`, delete+insert por ticker) e `verify_jwt = false` no `config.toml`. **Operacional pronto:** `npm run quotes:deploy` (deploy) + `npm run quotes:cron` (gera o SQL do agendamento preenchido a partir do `.env`) + SQL versionado em `supabase/quotes-cron.sql` (ver DEPLOYMENT §7.1). **Falta apenas executar os comandos** (deploy + colar o SQL no SQL Editor)
- [ ] **Testes contra banco real (Supabase local)** — pgTAP/vitest + Postgres: isolamento RLS e rollback de RPCs (DoD; exige ambiente local com Docker — não disponível neste ambiente)
- [x] **Credenciais reais do Supabase** presentes no `.env` local (gitignored — VITE_SUPABASE_URL `https://lnsfcajcfofgvpvabwbi.supabase.co` + ANON_KEY; o Vite carrega `.env` da mesma forma que `.env.local`) e conectividade validada (auth/rest respondem 401 sem JWT = projeto ativo). Fluxo de auth de ponta a ponta (login/cadastro no browser) segue como validação manual — ver `RELEASE.md` §2

---

### Fase 2 — Core de Finanças Pessoais

**Objetivo:** CRUD fiel às regras do ESPECIFICAÇÃO §3.1–3.5, com domínio puro primeiro e telas por último.

**Entregas (na ordem):**
1. **Domínio puro** (`domain/`) com testes: `money` (parcelamento em centavos, parsing), `competence` (`resolveBillCompetence` + `clampDay` + overrides), `debts` (status derivado), saldo de fatura, peso de relatório.
2. **Módulos de domínio** (`components/modules`) derivados: `CategoryIcon`, `MonthPicker`, `TransactionRow`, `KpiCard`, `BudgetProgressBar`, `DebtStatusBadge`, `InvoiceStatusBadge`, `InstallmentBadge`.
3. Receitas e despesas: CRUD + listagem por mês + wizard de lançamento guiado (F0 primitivos + módulos).
4. Parcelamento (1–60x) + exclusão 3 modos via RPC com cascata de dívidas.
5. Cartões: CRUD, faturas, pagamentos, **estornos → renda automática** (somente-leitura), seleção automática de mês, saldo aberto.
6. Dívidas: CRUD, cobrança vinculada, quitação com criação de lançamento, recebimento integrado.
7. Categorias (sugestão por nome, migração na exclusão), orçamentos (herança, faixas 85/90/95%, realocação), metas de renda.
8. **Telas** (`features/`): Transações, Cartões, Dívidas, Orçamentos, Detalhe de lançamento, Categorias.

**Progresso — ciclo de implementação 1 (2026-08-13):**
- [x] **Entrega 1 — domínio puro com testes** (49 novos testes):
  - `domain/money/parcelar.ts` — `splitCents` (divisão exata em centavos, resto nas primeiras), `addMonthsClamped` (clamp fim de mês), `parcelar` (plano com datas mensais + número 1-based) — invariante soma = total (D12)
  - `domain/money/parse.ts` — `parseBRLToCents` (formatos pt-BR) + `centsToBRL`
  - `domain/competence/index.ts` — `clampDay`, `resolveBillCompetence` (dia ≥ closing → mês seguinte), overrides mensais, `dueDateOfCompetence` (D3)
  - `domain/debts/index.ts` — status derivado `paid/overdue/due_today/due_soon/pending` (nunca armazenado) + `todayISO`/`addDaysISO`
  - `domain/cards/index.ts` — `invoiceBalance` (max(0, previsto−pago)) + `invoiceStatus` (closed/open/near_due/overdue)
  - `domain/reports/index.ts` — `weightedCents`/`weightedSum` (peso 0–1 sobre base_amount)
- [x] **Entrega 2 — módulos de domínio** (`components/modules`, todos com testes de interação): `CategoryIcon` (+ `category-icons.ts` com o map lucide, arquivo separado para react-refresh), `MonthPicker` (navegação mensal sem select nativo), `TransactionRow` (sinal/cor por tipo, click), `BudgetProgressBar` (percent + excedido), `DebtStatusBadge`, `InvoiceStatusBadge`, `InstallmentBadge` — barrel atualizado
- [x] **Entregas 3–4 — CRUD de receitas/despesas + listagem por mês + wizard de 4 passos + exclusão 3 modos**:
  - Camada de dados real: `lib/date.ts` (monthRangeISO/shiftMonthISO), `data/repositories/` (categories, incomes, expenses, credit-cards) com conversão de borda numeric→number, `data/query.ts` (helper de resolução com cast controlado) e `data/session.ts`
  - Camada `state/`: queries (`useCategories` por tipo, `useExpenses`/`useIncomes` por mês, `useActiveCreditCards`) + mutations (`useCreateExpense` via RPC `create_expense_with_debt` com parcelas client-side, `useCreateIncome`, exclusão 3 modos single/all/subsequent) com invalidação dirigida
  - `TransactionListPage` com dados reais: MonthPicker, KPIs (receitas/despesas/saldo do mês), seções separadas, Skeleton/EmptyState/erro via gateway + `ExpenseDetailDialog` (exclusão com ConfirmDialog + seletor de modo, cascata)
  - **Wizard de 4 passos em tela cheia (D10)** — `features/transactions/wizard/`: valor (MoneyInput + parcelas via Stepper), categoria (CategoryIcon), detalhes (data/forma de pagamento/cartão/descrição/peso no relatório/cobrança vinculada), revisão (parcelas calculadas com `domain/money` + competência snapshot) — navegável por teclado, validação por etapa (`canProceed`)
  - Rota `/transacoes/novo` fora do PageShell (tela cheia) + guard de auth
  - 14 novos testes: repositories (mock do cliente), `wizard-state` (lógica pura D12), fluxo completo do wizard e listagem (103/103 no total)
- [x] **Entrega 5 — Cartões**: migration `0004_cards_debts.sql` com RPCs auditados (`create_card_payment`, `update_credit_card`, `delete_credit_card` — D2) + tipos no `database.ts`; repository completo (`credit-cards.ts` CRUD com conversão de borda, `card-payments.ts` delegando pagamento/estorno aos RPCs); queries (`useCreditCards`, `useCardPayments`, `useCardExpenses`) e mutations (`useCreateCard`, `useUpdateCard`, `useDeleteCard`, `useCreateCardPayment`, `useCreateRefund`); **CardsPage** com seletor de cartão, **seleção automática de mês** (`autoSelectBillMonth` — §3.3.3), KPIs previsto/pago/saldo aberto (`buildCompetenceSummaries` com peso aplicado + estornos à parte), lista de despesas da competência e pagamentos/estornos, diálogos de pagamento/estorno (renda automática [REFUND]) e formulário de cartão
- [x] **Entrega 6 — Dívidas**: repository (`debts.ts` list/create/update/delete), queries `useDebts` + `useExpense` (para o integrado), mutations `useCreateDebt`/`useUpdateDebt`/`useDeleteDebt`/`usePayDebt`/`useReceiveDebt`/`useSettleIntegratedReceivable` (RPCs transacionais D1); **DebtsPage** com abas a pagar/receber, status derivado (`domain/debts`), cadastro/edição, quitação com opção de criar lançamento (categoria) e **recebimento integrado** (resultado editável com sugestão automática = base_amount − dívida)
- [x] Primitivo novo `NumberStepper` (incremento +/−) — extraído do wizard (DRY) e reutilizado no formulário de cartão
- [x] **Entrega 7 — Categorias, orçamentos e metas de renda**:
  - Domínio puro `domain/budgets` (23 testes): sugestão inteligente por nome (`suggestCategory` — ícone/cor/% da renda por palavra-chave, com normalização de acentos), `suggestLimitCents` (arredondado a R$ 10, min R$ 10), faixas `budgetStatus` (85/90/95/excedido), `globalUsedPercent` (fallback para rendas), `progressTone`, herança `resolveEffectiveLimit`/`isInheritedLimit` (por categoria), `reallocationSuggestion` (maior excesso → maior folga) e `incomeGoalStatus`
  - Migration `0005_budgets.sql`: RPC `reallocate_budget` **atômico** (D1 — dois upserts + audit) + tipo no `database.ts` + wrapper
  - Repositories: `categories.ts` (CRUD + `getCategoryUsage`), `budgets.ts` (list/remove; upsert via RPC), `income-goals.ts` (list/remove; upsert via RPC) + queries (`useBudgets`, `useIncomeGoals`, `useAllCategories`, `useCategoryUsage`) e mutations (limites, metas, categorias com migração, realocação)
  - **BudgetsPage**: abas Limites/Metas, KPIs (total de limites, % global usado com `Progress`), progresso por categoria com herança e faixa, diálogo de limite com sugestão por % da renda, card de realocação com confirmação, metas de renda com realizado × esperado
  - **CategoriesPage** (`/categorias`, novo item de nav): CRUD com sugestão inteligente por nome (ícone/cor), exclusão com **migração obrigatória** quando há lançamentos (RPC `delete_category_migrate`) e categorias reservadas protegidas
- [x] **Entrega 8 — Visão Consolidada (Overview)**:
  - Domínio puro `domain/overview` (12 testes): `computeOverview` (KPIs com peso de relatório: rendas, despesas, investimentos, saldo = rendas−despesas−investimentos, savingsRate = saldo÷rendas), `percentChange` (comparativo), `accountsNet` (receber − pagar − faturas em aberto), `openInvoicesTotal` (saldo da competência auto-selecionada por cartão — §3.3.3) e `buildDailyFlow` (barras empilhadas por dia)
  - Repositories/queries: `listAllCardExpenses`/`listAllCardPayments` + `useAllCardExpenses`/`useAllCardPayments` (faturas em aberto sem hook em loop — agregação pura por cartão)
  - **OverviewPage**: MonthPicker, 4 KPIs com comparativo vs mês anterior (cores por sinal), taxa de poupança com feedback, **saldo líquido de contas** (pendentes do mês + faturas em aberto), **fluxo diário** com barras empilhadas (rendas/despesas), orçamentos compactos (progresso global, lista de atenção, **realocação com confirmação** via RPC) e EmptyState sem lançamentos
  - `KpiCard.hint` agora aceita ReactNode (comparativos formatados pt-BR com vírgula decimal)
- [x] **Fase 2 — Core de Finanças Pessoais concluída**: entregas 1–8 verdes (domínio puro, módulos, CRUDs, wizard, cartões, dívidas, orçamentos/metas, visão consolidada)

**✅ DoD**
- Suíte de testes espelhando centavos, competência snapshot e status derivado.
- Cascata de exclusão verificada com rollback (falha → nada excluído); audit_events gravados.
- Estorno gera renda `[REFUND]` somente-leitura; recebimento integrado reduz despesa no relatório.
- Parcelas calculadas no cliente (`domain/money`, centavos) e validadas no servidor (soma = valor original, 1–60).
- CRUDs com Skeleton/EmptyState/erro via gateway; wizard completo de 4 passos navegável por teclado.

---

### Fase 3 — Análise, Projeção & Corte de Gastos

**Objetivo:** inteligência sobre os dados, sempre como motores puros testáveis.

**Entregas (na ordem):**
1. ✅ **Motor de insights** (`domain/insights`): alertas críticos priorizados, assinaturas (3 sinais + tiers), recorrências (3 níveis), confiança + aprendizado (ignorar/confirmar/restaurar).
2. ✅ Desafios de economia (10/20/30%, limite dinâmico, máx. 4) e sugestões de limite (máx. 3/mês).
3. ✅ Projeção (`domain/projection`): gasto disponível diário, ritmo de gastos (8º dia / ≥30%), fim de mês (dia ≥ 3), projeção de pendências.
4. ✅ Relatórios: dia/mês/ano, custom (≤ 366 dias), agregação por categoria/forma/dia da semana, comparativo, merge de dívidas pagas.
5. ✅ Central de lembretes: consolidação faturas/dívidas, marcar lido, snooze com expiração. **Decisão:** **in-app** (spec §2.10 — push fica opcional/futuro).
6. ✅ **Telas:** Insights, Projeção e Corte, Relatórios, Lembretes (novos módulos: `AlertCard`, `InsightList`, `ProjectionLine`, `ReminderItem`, `ReportTable`).

**✅ DoD**
- Testes dos alertas priorizados (ordem correta) e da fórmula de confiança.
- Projeções conferidas contra cálculo manual de referência.
- Relatórios com peso de relatório e merge de dívidas pagas validados por testes.
- Snooze expira ao vencer; ordenação atrasados primeiro.

---

**Progresso da entrega 1:**
- `domain/insights/alerts.ts` — alertas críticos priorizados (§3.7.1): ritmo > 5% acima, limites estourados, burn rate > 85%, déficit projetado, elogio por poupança ≥ 20%; ordenação por prioridade, emissão apenas dos verdadeiros.
- `domain/insights/subscriptions.ts` — catálogo `KNOWN_SERVICES` (~38 serviços com tiers) + 3 sinais (nome, categoria, valor ±5%) + árvore de decisão 0.40–0.98 (§3.7.2); essenciais nunca cortáveis.
- `domain/insights/recurrences.ts` — recorrências em 3 níveis (§3.7.3): `subscription` (valor estável ±5%), `recurring` (mesma descrição), `estimated` (mesma categoria); filtros mínimos e janela de meses.
- `domain/insights/confidence.ts` — `confidenceScore` com bônus não-linear por histórico (2m:+0.05, 5m:+0.28) e penalidade de variância (0.3× subscription, 0.8× recurring) (§3.7.4).
- `domain/insights/feedback.ts` — `applyFeedback`: ignoradas saem da lista, confirmadas ganham flag; `occurrence_key` estável persistida em `insight_feedback`.
- `domain/insights/diagnostics.ts` — concentração de renda (>60% alerta), gastos de fim de semana (ratio > 1.5), tendência significativa (>15%), saúde da poupança (§3.7.6).
- Persistência: `src/data/repositories/insight-feedback.ts` (list/upsert/delete-restaurar) + `useFeedback`/`useSetFeedback` (TanStack Query).
- **29 testes verdes** (25 domínio + 4 repository).

**Progresso da entrega 2:**
- `domain/savings` — motores puros de §3.7.5, sem persistência própria (aplicar = `set_budget_limit` existente):
  - `dynamicMinLimitCents` — limite mínimo dinâmico `max(R$ 20, 0,5% da renda)`.
  - `buildChallengeOptions` + `pickTopChallenges` — desafios por categoria de alto gasto não essencial (≥ 10% da renda), 3 intensidades (10/20/30%), meta respeitando o piso dinâmico, máx. 4 simultâneos com priorização por impacto.
  - `discretionaryChallenge` — desafio "30% em não essenciais" (soma de categorias discricionárias de alto gasto).
  - `buildLimitSuggestions` — estouro → aumento `max(excesso, 15% do limite)`; uso < 50% com folga > R$ 50 → redução mantendo 30% de margem (arredondada a R$ 10, respeitando o piso); máx. 3/mês priorizadas por impacto.
- **17 testes verdes** (domínio puro).

**Progresso da entrega 3:**
- `domain/projection` — motores puros de §3.8 (recebem a data por parâmetro — determinísticos):
  - `dailyBudget` — gasto disponível diário: atual `max(0, líquido ÷ diasRestantes)` com `diasRestantes` incluindo hoje; futuro `max(0, (rendas − invest) ÷ diasNoMês)`; encerrado sem valor diário (resultado real).
  - `spendingPace` — ritmo de gastos ativo só a partir do 8º dia E fração decorrida ≥ 30% (evita alarme falso); gap em pontos vs fração esperada.
  - `endOfMonthProjection` — exige dia ≥ 3; `burnRate = despesas ÷ diasDecorridos`, `projeção = burnRate × diasNoMês`, `superávit = rendas − invest − projeção`, `noTrilho = superávit ≥ 0`; passado → reais, futuro → não aplicável.
  - `pendingProjection` — saldo projetado de pendências = recebíveis − pagáveis.
- **16 testes verdes** conferidos contra cálculo manual de referência (DoD).

**Progresso da entrega 4:**
- `domain/reports` estendido (mantém `weightedCents`/`weightedSum` do peso de relatório):
  - `aggregateByCategory` / `aggregateByPaymentMethod` — agregações ponderadas ordenadas por total desc (§3.6);
  - `aggregateByWeekday` — 7 dias sempre presentes, Monday-first `(getDay()+6)%7` (§4.1), totais ponderados;
  - `mergePaidDebts` — recebíveis → rendas, pagáveis → despesas (pelo mês do vencimento), saldo recalculado (§4.3);
  - `validateCustomPeriod` — datas válidas, início ≤ fim e máximo de 366 dias;
  - `percentChange` reexportado do overview (comparativo — DRY, sem duplicação).
- **17 testes verdes** (agregações, merge, validação de período, comparativo).

**Progresso da entrega 5:**
- `domain/reminders` — motores puros de §3.10 (in-app; push fica fora do escopo atual):
  - `billReminder` / `debtReminder` — alertas de fatura (overdue/near_due com saldo aberto, reutiliza `invoiceStatus`) e dívida (vencida/hoje/em breve dentro da janela configurável, reutiliza `debtStatus`);
  - `applyReminderState` + `isSnoozeExpired` — lido sai da lista; snooze oculta até a data e **expira ao vencer/atrasar** (o alerta volta);
  - `sortReminders` — atrasados primeiro, depois por vencimento;
  - `buildReminders` — consolidação completa (faturas + dívidas), com preferência desabilitada → lista vazia;
  - `invoiceDueDate` extraído em `domain/cards` (DRY — reutilizado por `invoiceStatus` e lembretes).
- Persistência: migration `0006_reminder_states.sql` (tabela com unique user+occurrence_key, RLS) + `src/data/repositories/reminder-states.ts` + `useReminderStates`/`useSetReminderState`.
- **18 testes verdes** (14 domínio + 4 repository).

**Progresso da entrega 6 (Fase 3 completa ✅):**
- Queries de range: `listExpensesByRange`/`listIncomesByRange` + `useExpensesByRange`/`useIncomesByRange` (período custom ≤ 366 dias).
- Módulos F3: `AlertCard` (prioridade 1–6 com tons), `InsightList` (assinaturas/recorrências com confiança + ignorar/confirmar/restaurar), `ProjectionLine` (diário/projeção/superávit/trilha + ritmo), `ReminderItem` (status + lido/snooze/restaurar), `ReportTable` (agregações com participação e total).
- **InsightsPage** (`/insights`): abas Alertas (§3.7.1), Assinaturas & recorrências (§3.7.2/.3 com aprendizado persistido), Projeção & corte (§3.8 + pendências + desafios/sugestões de limite §3.7.5) e Diagnósticos (§3.7.6).
- **ReportsPage** (`/relatorios`): período por mês ou custom (máx. 366 dias), resumo com merge de dívidas pagas (§4.3) + comparativo, agregações por categoria/forma/dia da semana.
- **RemindersPage** (`/lembretes`): consolida faturas (competência auto-selecionada por cartão) e dívidas pendentes com ações lido/snooze(7d)/restaurar persistidas.
- Correção no motor: nível `similar` de recorrência usa rótulo de categoria (evita nome duplicado da primeira despesa).
- **8 testes de página novos** (insights/reports/reminders).

**Progresso da entrega 1 (Fase 4):**
- `domain/portfolio` — motor puro do ledger (§3.11.2):
  - `computeLedger` — posição derivada em ordem cronológica (custo médio, custo total, proventos separados, **caixa derivado nunca armazenado**); compras/subscrições debitam, vendas/proventos creditam, splits/reverse splits não movimentam caixa;
  - `applyOperation` — unitário por tipo (venda reduz proporcionalmente pelo custo médio; proventos não alteram custo/posição; split soma cotas preservando custo total);
  - `valuePosition` / `allocationGap` (pctAtual, gapPct, gapFinanceiro) / `convertToBRL` (USD→BRL com fallback 5,25).
- **15 testes de reconciliação** com exemplos manuais (DoD) + 5 do repository.
- Infra: `src/data/repositories/portfolio.ts` (assets + transações, conversão de borda numeric→number) + `usePortfolioAssets`/`useAssetPosition` (ledger derivado no hook)/`useCreatePortfolioAsset`/`useCreatePortfolioTransaction`.
- Schema já existia (migrations 0001): `portfolio_assets`, `portfolio_transactions`, metas e `asset_prices` — sem migration nova.

**Progresso da entrega 2 (Fase 4):**
- `domain/portfolio/valuation.ts` — motor puro de valoração (§1.6 D5 + §3.11.2):
  - `resolvePrice` — pipeline manual → cache (`api`) → fallback estático (USD 5,25); preço manual prevalece;
  - `applySpikeGuardrail` — variação > 50% em 1 dia mantém o último preço válido (dado corrompido);
  - `fallbackPriceFor` / `inferCurrencyFromTicker` — fallback por moeda e moeda inferida pelo padrão do ticker (2–5 letras sem números = USD);
  - `valueAssetPosition` — valor de mercado convertido para BRL com a fonte repassada (manual/api/fallback) para marcação na UI.
- Persistência: migration `0007_asset_price_override.sql` (unique parcial `(ticker, user_id)` para overrides) + `src/data/repositories/asset-prices.ts` (list: cache global + override do usuário; set/remove manual com moeda inferida) + `useAssetPrices`/`useSetManualPrice`/`useRemoveManualPrice`.
- **21 testes verdes** (16 domínio + 5 repository).

**Progresso da entrega 3 (Fase 4):**
- `domain/portfolio/allocation.ts` — motor puro de metas (§3.11.1):
  - `targetsSum` / `validateTargetsSum` — soma ≤ 100% (UI: barra de soma; servidor: RPC valida após o lote);
  - `clampTargetPercentage` / `parseTargetInput` — clamp 0–100 e parsing de entrada com vírgula pt-BR;
  - `sectorExposure` / `validateSectorCaps` — exposição por setor vs travas `max_sector_acoes`/`max_sector_fiis` (§3.11.3.5).
- Migration `0008_allocation_targets.sql` — RPCs transacionais (D1): `set_allocation_targets` (substitui o conjunto em lote e **valida a soma FINAL ≤ 100% após o lote** — o trigger por linha não cobre lote: 3×40 passariam individualmente), `set_group_target` / `remove_group_target` (classe/setor).
- Repositories: `allocation-targets.ts` (list, save lote, group targets) + `user-preferences.ts` (travas setoriais) + wrappers tipados em `data/rpc.ts`.
- State: `useAllocationTargets`/`useSaveAllocationTargets`/`useGroupTargets`/`useSaveGroupTarget`/`useRemoveGroupTarget`/`useSectorCaps`/`useUpdateSectorCaps`.
- **19 testes verdes** (13 domínio + 6 repository).

**Progresso da entrega 4 (Fase 4):**
- `domain/portfolio/aporte.ts` — motor puro da calculadora (§3.11.3):
  - `simulateSmartAporte` (por meta individual de ativo) / `simulateRebalanceAporte` (por meta de classe — déficit da classe distribuído proporcionalmente ao valor atual dos membros);
  - Defasagem macro por classe (déficit relativo = (alvo − atual) ÷ alvo), elegibilidade (meta > 0, gap > 0, preço > 0), ordenação gap desc respeitando a classe;
  - Distribuição com **quantidades inteiras** (preço × quantidade ≤ alocado; excedente vai ao próximo ativo);
  - **Travas setoriais** (`classCapsFromSectorCaps` — mapeia `max_sector_acoes`/`max_sector_fiis` para as classes Ações/FIIs, insensível a caixa/acento) impedem alocação acima do teto;
  - **Sobra** (teto/trava/arredondamento) → caixa/reserva; log de roteamento por ativo (alvo, atual, aporte, quantidade, preço);
  - Invariantes (DoD): soma dos aportes nunca excede o aporte informado; ativo sem meta não recebe; aporte só com gap > 0.
- `domain/portfolio/valuation.ts` estendido: `usdRateFromPrices` (USDBRL=X com fallback 5,25), `isCashAssetClass` (caixa/reserva 1:1) e `normalizeClassName` (DRY com as travas).
- **16 testes novos** de domínio (exemplos manuais — DoD) + 6 de valoração. **Total: 65 testes no domínio portfolio.**

**Progresso da entrega 5 (Fase 4 — Fase 4 completa ✅):**
- Repository: `listAllPortfolioTransactions` (posição consolidada sem N+1) + teste.
- State: `useAllPortfolioTransactions` + **`usePortfolioPosition`** (posição valorada: ledger por ativo + pipeline de preço manual → cache → fallback, caixa 1:1, pct do patrimônio) + exports no barrel.
- Módulos F4 (§4.2): **`PositionTable`** (preço com fonte marcada — "manual" destacado, DoD), **`TargetEditor`** (barra de soma ≤ 100% com erro/bloqueio), **`AporteResult`** (resumo + log de roteamento).
- **PortfolioPage** (`/carteira`) com 3 abas:
  - **Posição**: KPIs (patrimônio total, caixa derivado do ledger, ativos), PositionTable, cadastro de ativo (ticker/classe/moeda) e registro de transações (8 tipos, data, quantidade/preço ou provento/fator);
  - **Metas**: edição em lote por ativo com barra de soma (valida ≤ 100% na UI e no banco via RPC `set_allocation_targets`), metas por classe (upsert/remove) e **travas setoriais** (max_sector_acoes/fiis);
  - **Aporte**: MoneyInput de valor + modo (meta de ativo/classe via RadioGroup) + simulação local pura com `simulateSmartAporte`/`simulateRebalanceAporte` e log de roteamento (sobra para caixa);
  - Estados loading (Skeleton) / vazio (EmptyState) / erro (gateway + "Tentar novamente").
- **3 testes de página novos** (posição com preço manual marcado, metas com barra de soma, calculadora com sobra).

### Fase 4 — Carteira & Rebalanceamento

**Objetivo:** posição confiável + calculadora de aporte.

**Entregas (na ordem):**
1. ✅ **Ledger** (`domain/portfolio`): custo médio, caixa derivado, splits/proventos — testes de reconciliação.
2. ✅ Valoração: cache + fallback + **preço manual** (override marcado na UI) + guardrail de spike.
3. ✅ Metas por ativo/classe/setor com soma ≤ 100% (UI + banco) e travas setoriais.
4. ✅ **Calculadora de aporte**: `simulateSmartAporte` / `simulateRebalanceAporte` (2 modos) com log de roteamento.
5. ✅ **Telas:** Carteira (posição), Metas (edição em lote com barra de soma), Calculadora de aporte.

**✅ DoD**
- Ledger reconciliado com exemplos manuais (compras/vendas/custo médio/splits).
- Soma de metas > 100% bloqueada na UI e no banco.
- Simulação nunca aloca além do aporte informado; sobra vai para caixa.
- Preço manual prevalece sobre API/fallback e é exibido como "informado manualmente".

**✅ Fase 4 concluída** (entregas 1–5 verdes): ledger, valoração com override manual, metas com barra de soma + travas setoriais, calculadora de aporte em 2 modos com log de roteamento e telas completas.

---

### Fase 5 — Experiência Transversal

**Objetivo:** polish, acessibilidade e busca.

**Entregas (na ordem):**
1. ✅ **Busca global** (⌘K): normalização, scoring, recência, limites por tipo, deep-link com destaque.
2. ✅ **Tema OLED refinado** (contraste/estados) + microinterações.
3. ✅ **Auditoria de acessibilidade** (axe, contraste AA, foco, teclado) em todas as telas.
4. ✅ **Empty states completos** + onboarding de primeiro uso.
5. ✅ **Performance**: bundle splitting, virtualização de listas, revisão de queries (N+1).
6. ✅ **PWA polish:** prompt de instalação (`beforeinstallprompt`), atualização automática com toast, splash/iOS, auditoria PWA (instalabilidade).

**Progresso — Fase 5, entrega 1 (busca global §3.9):**
- `domain/search` — motor puro com testes (14): `normalizeSearch` (acentos/minúsculas), `matchScore` (igual 100/prefixo 85/contém 60), `numericMatchScore` (valor 30), status de dívida 40, `recencyBonus` logarítmico (0m +25 … 12m+ +0), `monthsBetween`, `scoreSearchEntry` e `searchGlobal` (máx. 5/tipo, 12 total, score desc).
- **Deep-link com destaque:** `useHighlightTarget` (id derivado do param `?q=`/`?card=`, removido da URL após 2,6s via replace) + módulo `HighlightRow` (anel + scrollIntoView) nas telas-alvo — Transações (`?month=` + `?q=`), Dívidas (`?type=` + `?q=`), Cartões (`?card=` seleciona + `?q=` destaca), Categorias (`?type=` + `?q=`). Estado **derivado da URL** (sem setState em effect/render — compatível com as regras React Compiler do lint).
- `GlobalSearch` montado no shell: atalho `Ctrl+K`/`⌘K` + botão no header; grupos por tipo (Despesas/Rendas/Dívidas/Cartões/Categorias) com ícones; navega via deep-link e fecha a paleta. Primitivo `Command` evoluído: input controlado + grupos rotulados (sem quebrar o contrato anterior).
- Dados: `listAllExpenses`/`listAllIncomes` (repositórios) + `useGlobalSearchEntries` (queries habilitadas só com a paleta aberta) — com join de categoria, labels de forma/recebimento, status derivado de dívida e deep-links.
- DRY: `src/lib/labels.ts` (`PAYMENT_METHOD_LABELS`/`RECEIVE_TYPE_LABELS`) — remove as 3 duplicatas de `PAYMENT_LABELS` (relatórios, wizard, detalhe).
- **22 testes novos** (14 domínio + 1 repository + 4 paleta + 3 deep-link). Atalho exibido como "Ctrl+K" na UI (a regra `local/no-decorative-unicode` bloqueia o glifo ⌘ em strings).

**Progresso — Fase 5, entrega 2 (OLED refinado + microinterações):**
- **Tokens OLED refinados** (`tokens.css`): sobre true black, hover `9%`/pressed `13%` (estados perceptíveis), borda `14%` + input `18%` (elevação por borda, sem sombra), `--muted-foreground` `50%` (AA 5.3:1) — §6 do DESIGN_SYSTEM.
- **Tokens novos nos 3 temas:** `--overlay` (40/60/70%) para modais/command palette — substitui o `bg-black/50` hard-coded no `Modal` e `Command`; `--scrollbar-thumb`/`--scrollbar-track` com scrollbars estilizadas em `globals.css` (WebKit + Firefox) — §13.
- **Microinterações:** `Button` ganha press `active:scale-[0.98]` + `transition` 150ms (DESIGN_SYSTEM §7); transições de hover padronizadas nos botões de ação de insights/lembretes; `prefers-reduced-motion: reduce` desativa animações (a11y).

**Progresso — Fase 5, entrega 5 (performance):**
- **Bundle splitting:** rotas lazy por página (`routes.tsx` com `React.lazy` + `Suspense`/Skeleton no router) — cada feature vira chunk próprio carregado no primeiro acesso; shell principal em ~223 kB (gzip 69 kB) e páginas 5–24 kB cada.
- **Virtualização de listas:** `domain/virtualization` (puro, 5 testes — `computeVirtualWindow` com overscan e espaçadores) + primitivo `VirtualList` (3 testes) com fallback plano para listas pequenas (≤ 60) e medição por evento de scroll (sem acesso a ref durante render — compatível com as regras React Compiler do lint); aplicado na lista de transações (receitas/despesas, itemHeight fixo 64px, `key={month}` zera rolagem sem efeitos).
- **Revisão de queries (N+1):** em relatórios, as queries de período custom (`useExpensesByRange`/`useIncomesByRange`) agora rodam **apenas no modo custom** (`enabled`) — antes duplicavam o fetch do mês no modo mês; mensais permanecem com `staleTime` para troca instantânea de aba.

**Progresso — Fase 5, entrega 4 (empty states + onboarding):**
- **Auditoria de empty states:** todas as telas com EmptyState dedicado (DESIGN_SYSTEM §11) — transações (receitas/despesas), cartões (sem cartão/fatura/pagamento), dívidas, orçamentos, categorias, relatórios, insights, lembretes, carteira (posição/metas/aporte) e wizard — tom "Nenhum/Nenhuma/Sem + substantivo" com descrição imperativa e ícone lucide contextual.
- **Onboarding de primeiro uso (§5.7):** `domain/onboarding` (puro, 9 testes) — checklist de 4 passos (categorias de despesa/renda, cartão, primeiro lançamento) com progresso e conclusão derivados das contagens; `getOnboardingCounts` (repositório, 3 testes) com contagens leves em paralelo (head: true, is_reserved = false) + `useOnboardingCounts`.
- **OnboardingCard** na Visão Geral (módulo + 5 testes, axe incluso): progresso `n/4`, passos done com check, CTAs "Configurar" com deep-link (`/categorias?type=`, `/cartoes`, `/transacoes/novo`); some automaticamente quando o setup completa (Online First — derivação por dados, sem persistência local).

**Progresso — Fase 5, entrega 6 (PWA polish):**
- **Instalação (`beforeinstallprompt`):** `pwa.ts` guarda o evento (preventDefault) e expõe store externa (`subscribePWAInstall`/`getCanInstallPWA`/`promptPWAInstall`); hook `usePWAInstall` (useSyncExternalStore — sem setState em effect/render) + módulo `InstallAppButton` no menu "Mais" (nunca popup intrusivo — §6); some ao instalar (`appinstalled`) ou quando o app roda em standalone (`display-mode`/`navigator.standalone`).
- **Atualização automática com toast:** com `registerType: autoUpdate`, o `onNeedReload` intercepta o reload automático e notifica a store (`notifyPWAUpdate`/`consumePWAUpdate`) — o `PWAUpdateToast` global (montado no `Toaster` em `providers.tsx`) anuncia "Nova versão disponível" com ação "Atualizar" (reload explícito, sem perda de estado) e fecha consumindo o anúncio (re-anuncia em nova versão). `Toast` ganhou prop `action` (Radix Action) e o primitivo `Toaster` foi corrigido (os children — os toasts — agora são renderizados dentro do Provider; antes eram descartados pelo spread `{...props}`).
- **Splash/iOS:** meta tags completas no `index.html` (theme-color light/dark, apple-mobile-web-app-*, apple-touch-icon, viewport-fit=cover) + manifest com `theme_color` por media — já vigentes, agora auditados.
- **Auditoria PWA automatizada:** `tests/pwa-audit.test.ts` (4 testes) — manifest válido (campos obrigatórios + ícones 192/512/maskable), ícones em disco, meta tags PWA/iOS e fluxo do SW (autoUpdate + onNeedReload + beforeinstallprompt). Proxy dos checks de instalabilidade do Lighthouse; a auditoria completa (≥ 90) exige app servido em HTTPS — ver `PWA_GUIDELINES.md` §7.
- **Testes de fluxo** (`tests/pwa.test.tsx`): botão de instalação (oculto → beforeinstallprompt → visível → clique consome o evento) e toast de atualização (anuncia → fechar consome → nova versão re-anuncia → "Atualizar" recarrega).
- **F5.6 concluída ✅** — Fase 5 completa.

**Progresso — Fase 5, entrega 3 (auditoria a11y):**
- **Axe automatizado:** `vitest-axe` + `axe-core` (devDeps) com matcher `toHaveNoViolations` no setup; auditoria de **10 telas P0** (auth ×3, overview, transações, cartões, dívidas, orçamentos, wizard + fluxo de diálogo) — todas sem violações; teste de sanidade garante que o matcher detecta violações reais.
- **Contraste AA como regra de domínio:** `domain/accessibility` (puro, 16 testes) — `relativeLuminance`/`contrastRatio`/`isAANormalText`(4.5:1)/`isAALargeText`(3:1) validando os tokens dos 3 temas (§2.1/2.3) e as regras `-strong` do DESIGN_SYSTEM §2.2 (positive base ~2.4:1 não serve para texto no light; dark/oled passam AA).
- **Teclado (DoD):** testes de navegação por `Tab`/`Enter`/setas nas telas P0 — ordem de foco do login (e-mail → senha → entrar), abas Radix com roving tabindex (dívidas/orçamentos), controles de mês e links alcançáveis por teclado.

**✅ DoD**
- Busca retorna tipos ordenados por score com destaque funcional (scroll + highlight).
- OLED com estados perceptíveis e contraste AA no texto secundário; modais/scrollbars com tokens próprios.
- Microinterações com press nos botões e suporte a `prefers-reduced-motion`.
- Auditoria a11y sem erros críticos (axe em 10 telas P0, zero violações; contraste AA validado por regra de domínio).
- Navegação por teclado testada nas telas P0 (Tab/Enter/setas).

---

### Fase 6 — Hardening & Lançamento

**Objetivo:** confiança, segurança e produção.

**Entregas (na ordem):**
1. ✅ **Prova de fidelidade:** suíte espelhando cada regra do ESPECIFICAÇÃO (regressão contra o app anterior).
2. ✅ Segurança: revisão final de RLS, rate limit, secrets/ambiente.
3. ✅ Observabilidade: logging de erros (**decisão: Sentry**) + métricas básicas (Web Vitals).
4. ✅ **Deploy funcional em produção:** frontend no Vercel (domínio `*.vercel.app`, env vars `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configuradas — confirmado pelo usuário, 2026-08-15) + backend/banco no Supabase (migrations aplicadas). **CI/CD `deploy.yml` criado** (gates de qualidade obrigatórios + deploy condicional na Vercel e da edge function `quotes` quando os secrets existirem); resta apenas a confirmação do deploy da edge function de cotações e o agendamento do cron (ver `DEPLOYMENT.md` §7.1).
5. QA final multi-dispositivo + documento de release: **`docs/RELEASE.md` criado** (checklist QA desktop/mobile × 3 temas × 6 acentos, matriz de fluxos críticos, corte/rollback e template de registro) — pendente apenas a execução manual do QA.

**Progresso — Fase 6, entrega 4 (deploy):**
- **✅ Deploy de produção funcional (confirmado pelo usuário, 2026-08-15):** frontend publicado no Vercel e consumindo o projeto Supabase remoto (`https://lnsfcajcfofgvpvabwbi.supabase.co`); env vars de produção configuradas. **F6.4 concluída.**
- Pendência residual: **deploy da edge function `quotes`** (F1.7) no Supabase remoto + cron de atualização — status a confirmar; a função está implementada e testada (15 testes) e o passo a passo está em `DEPLOYMENT.md` §7.1.

**Progresso — Fase 6, entrega 2 (segurança — auditoria RLS, rate limit, secrets):**
- **Auditoria RLS automatizada** (`src/tests/security-audit.test.ts`, 9 testes — roda no CI, impede regressão):
  - **Cobertura total:** toda tabela criada nas migrations (20) tem `enable row level security`;
  - **Zero leitura cross-user:** toda policy referencia `auth.uid()` no using/with check (D4); nenhuma policy aberta com `true`/`1=1`/`to public`;
  - **`audit_events` imutável (D2):** nenhuma policy de update/delete;
  - **RPCs endurecidos (D1):** toda function `security definer` fixa `search_path = public, pg_temp` (sem risco de hijack); toda escrita composta valida `auth.uid()` no corpo (exceção documentada: triggers `returns trigger` — o dono é definido pelo evento);
  - **Segredos:** nenhum `.env` rastreado além do `.env.example` (placeholders); nenhum padrão de chave real (sk_live_, ghp_, service_role eyJ…) nos arquivos rastreados.
- **Revisão manual concluída:** 20 tabelas (0001 + reminder_states em 0006) todas com RLS; `asset_prices` com leitura global (cache NULL) + escrita só do dono; `card_competence_overrides` via ownership do cartão (exists); `handle_new_user` cria perfil + preferências no signup; RPCs transacionais com validação de invariantes no servidor (D12).
- **Rate limit:** Supabase Auth aplica rate limiting nativo (email/senha: 30 req/h por IP + limites de SMTP/OAuth) — sem camada extra no cliente; o gateway de erros já classifica `429`/`rate_limit` com mensagem pt-BR (`services/errors`, testado).
- **F6.2 concluída ✅.**

**Progresso — Fase 6, entrega 3 (observabilidade — decisão: Sentry):**
- **`src/services/observability.ts`** — serviço env-gated por `VITE_SENTRY_DSN` (definido só em produção):
  - **Zero bundle impact sem DSN:** o SDK `@sentry/react` é carregado com **dynamic import** — sem DSN (dev/testes) todas as funções são no-op e o Sentry vira chunk lazy separado (verificado no build: shell principal permanece ~223 kB/gzip 69 kB; SDK ~475 kB isolado em `esm-*.js`, carregado apenas quando o DSN existe);
  - **Erros (crash/unexpected):** `reportError(error, context?)` → `captureException` com `extra`; handlers globais de `error`/`unhandledrejection` instalados pelo próprio SDK após o init — o gateway `services/errors` continua sendo a fonte das mensagens pt-BR (erros esperados — validação/rede/401 — não poluem o plano gratuito);
  - **Métricas básicas (Web Vitals):** `browserTracingIntegration` captura **LCP/INP/CLS** + spans de navegação, com `tracesSampleRate: 0.1` (amostragem para o free tier);
  - **Correlação de usuário:** `setObservabilityUser` chamado pelo `useAuth` (id + e-mail) — no-op sem DSN.
- **5 testes** (`services/observability.test.ts`): sem DSN → no-op total; com DSN → init com DSN + tracing; init idempotente; `reportError` com contexto; `setObservabilityUser`/null.
- **Deploy:** `VITE_SENTRY_DSN` documentado no `.env.example` + `docs/DEPLOYMENT.md` (§3.2 opcional e §4).
- **F6.3 concluída ✅** — decisão registrada em `ARCHITECTURE.md` §11 e `ESPECIFICACAO_TECNICA.md` (DECISÕES EM ABERTO nº 3 → RESOLVIDA).

**Progresso — Fase 6, entregas 4–5 (deploy + release):**
- **CI/CD de produção (`deploy.yml`):** gates `quality` (typecheck + lint + test + build) obrigatórios em todo push em `main`; jobs `deploy-vercel` (Vercel production) e `deploy-supabase-functions` (edge function `quotes`) condicionais à existência dos secrets (`VERCEL_*`, `SUPABASE_*`) — sem credenciais o deploy é pulado e o CI continua verde (não quebra).
- **Documento de release (`docs/RELEASE.md`):** QA final multi-dispositivo (matriz de 16 fluxos críticos em desktop/mobile × 3 temas × 6 acentos), QA visual/a11y (contraste AA, overflow, teclado, axe, Lighthouse ≥ 90), consistência de dados (parcelamento, competência, cascata, audit_events), corte de release (tag semântica → CI/CD → pós-deploy), rollback e template de registro.

**Progresso — Fase 6, entrega 1 (prova de fidelidade):**
- **`src/tests/fidelity.test.ts`** — **63 testes** espelhando as regras do ESPECIFICAÇÃO §1.3–§4.5: um teste por regra com exemplo representativo, organizado por seção da spec, verificando a **invariante central** (soma de parcelas = original, saldo = rendas − despesas − investimentos, competência ≥ closing → mês seguinte, prioridade dos alertas 1–6, tetos setoriais, guardrail de spike, limites da busca, etc.). Complementa (não duplica) a cobertura profunda dos testes colocalizados de cada motor.
- **Matriz de fidelidade (seção da spec → cobertura):**

  | Spec | Regra central | Cobertura (testes colocalizados) |
  |---|---|---|
  | §1.3 D1 | RPCs transacionais (rollback, invariantes) | `supabase/migrations/0003` + `data/repositories/*.test.ts` |
  | §1.4 D2 | Auditoria + hard delete | migrations + repositories |
  | §1.5 D3 | Competência de fatura (snapshot + overrides) | `domain/competence/index.test.ts` |
  | §3.1/3.2 | Receitas, despesas, parcelamento 1–60x (D12) | `domain/money/parcelar.test.ts` + `wizard-state.test.ts` |
  | §3.3 | Cartões: fatura, estorno, seleção de mês | `domain/cards/index.test.ts` |
  | §3.4 | Dívidas: status derivado + merge de pagas | `domain/debts` + `domain/reports/index.test.ts` |
  | §3.5 | Categorias, orçamentos, metas de renda | `domain/budgets/index.test.ts` |
  | §3.6 | Visão consolidada (KPIs, saldo de contas, fluxo) | `domain/overview/index.test.ts` |
  | §3.7 | Insights (alertas, assinaturas, recorrências, desafios) | `domain/insights/*.test.ts` + `domain/savings/index.test.ts` |
  | §3.8 | Projeção (diário, ritmo, fim de mês, pendências) | `domain/projection/index.test.ts` |
  | §3.9 | Busca global (scoring, recência, limites) | `domain/search/index.test.ts` |
  | §3.10 | Lembretes (lido/snooze com expiração) | `domain/reminders/index.test.ts` |
  | §3.11 | Carteira (metas, ledger, valoração, aporte) | `domain/portfolio/*.test.ts` (65 testes) |
  | §4.1 | Datas/calendário (ranges de mês locais) | `src/lib/date.test.ts` (novo, 6 testes) |
  | §4.2 | Moeda pt-BR e arredondamento | `domain/money/parse.test.ts` + `services/masks/money.test.ts` |
  | §4.4 | Ordenações padrão | `domain/reminders` + `domain/reports/index.test.ts` |
  | §4.5 | Validações de formulário (pt-BR) | `fidelity.test.ts` + `wizard-state.test.ts` |

- **Lacuna fechada:** `lib/date.ts` (monthRange/shiftMonth/isValidMonth) não tinha testes — novos 6 testes cobrindo §4.1 (ranges [start, end) em timezone local, sem `toISOString`).
- **Total:** 63 testes de fidelidade + 6 de data = **69 testes novos**; suíte total **528 testes**. F6.1 concluída ✅.

**✅ DoD**
- Suíte de fidelidade 100% verde.
- Revisão RLS auditada (nenhuma leitura cross-user).
- Deploy de produção funcional com variáveis protegidas — ✅ **confirmado** (2026-08-15).
- Checklist de QA aprovado em desktop + mobile nos 3 temas — pendente (manual).

---

### Fase 7 — Ergonomia de Navegação, Responsividade & Header Adaptativo

**Objetivo:** aperfeiçoar a experiência de uso contínuo no mobile e desktop com navegação refinada, acesso rápido a cartões e header responsivo inteligente, mantendo **zero dependências extras de animação** (transições nativas CSS/Tailwind v4 com suporte a `prefers-reduced-motion`).

**Decisões Técnicas Alinhadas:**
- **Zero libs extras de animação (Decisão A):** Transições de largura (`w-64` ↔ `w-20`), colapso/expansão e expansão de busca via classes utilitárias CSS (`transition-all duration-200 ease-out`) e variáveis de estado locais, sem sobrecarga no bundle.

**Entregas (na ordem):**
1. **Mobile Bottom Navigation (5 slots com FAB central):**
   - Arquivo: `src/components/layout/bottom-nav.tsx`.
   - Grid de 5 posições simétrico: `[ Início (/) ] | [ Transações (/transacoes) ] | [ + Novo (Central Elevado - /transacoes?novo=despesa) ] | [ Cartões (/cartoes) ] | [ Mais (/mais) ]`.
   - Migração de **Relatórios** para o menu/drawer "Mais", liberando slot nobre para **Cartões**.
   - Garantia de área de toque mínima acessível de 44×44px por slot e classe `.active` com destaque semântico.
2. **Desktop Collapsible Sidebar:**
   - Arquivos: `src/components/layout/sidebar.tsx` + `src/hooks/use-sidebar-state.ts` (ou store leve de estado).
   - Menu lateral retrátil com alternância entre **Modo Expandido** (logo, texto e ícones, `w-64`) e **Modo Compacto** (apenas ícones centralizados com tooltips/labels acessíveis, `w-20`).
   - Persistência imediata no `localStorage` (`financas_sidebar_collapsed`) e transições suaves de layout.
   - Ajuste sincronizado do espaçamento à esquerda no container `PageShell` (`lg:pl-64` ↔ `lg:pl-20`).
3. **Top Header & Search Responsivo:**
   - Arquivos: `src/components/layout/page-shell.tsx` + `src/components/layout/global-search.tsx`.
   - Header fluido com padding adaptável (`px-4 lg:px-8`), sticky com `backdrop-blur` refinado.
   - Busca responsiva no mobile: ícone trigger que abre input fluido ou modal compacto ocupando a largura disponível sem quebras de layout ou overflow horizontal.

**✅ DoD**
- BottomNav mobile navegando entre Início, Transações, FAB Novo, Cartões e Mais sem erros.
- Sidebar desktop com toggle funcional, persistência no `localStorage` e transição visual suave.
- `PageShell` ajusta dinamicamente a margem de conteúdo conforme o estado expandido/compactado da sidebar.
- Header e busca funcionais e acessíveis em breakpoints `<640px` (mobile), `768px` (tablet) e `≥1024px` (desktop).
- Suíte de testes unitários e de integração de layout 100% verde.

**Progresso — Fase 7 (ciclo de implementação 2026-08-14):**
- [x] **Entrega 1 — BottomNav 5 slots com FAB central** (`bottom-nav.tsx`): grid simétrico `Início | Transações | FAB Novo | Cartões | Mais` (ordem exata do roadmap), **Relatórios migrado** para o menu "Mais" (já listava todas as áreas) liberando o slot nobre para Cartões; FAB elevado com `ring-background` + `active:scale-95`; ícone `Ellipsis` lucide no slot Mais (substitui os spans decorativos — regra de ícones); **área de toque mínima 44×44px** (`min-h-11`) em todos os slots + destaque semântico do ativo; slots resolvidos da fonte única `nav-items` (`requiredSlot` — sem duplicação de rotas).
- [x] **Entrega 2 — Sidebar colapsável** (`sidebar.tsx` + `use-sidebar-state.ts`): modo expandido (`w-64`, logo + texto + ícones) ↔ compacto (`w-20`, só ícones centralizados com `aria-label`/`title`); toggle no rodapé da sidebar (ChevronLeft/Right) com **persistência imediata** em `localStorage` (`financas_sidebar_collapsed`); transição nativa `transition-[width] duration-200 ease-out` com `motion-reduce:transition-none` (Decisão A — zero libs de animação); **estado elevado no PageShell** (fonte única — Sidebar é controlada via props `isCollapsed`/`onToggle`); axe sem violações nos dois modos.
- [x] **Entrega 3 — PageShell dinâmico + header adaptativo** (`page-shell.tsx` + `command.tsx`): margem esquerda acompanha a sidebar em tempo real (`lg:pl-64` ↔ `lg:pl-20` com transição); header sticky fluido (`px-4 lg:px-8`, `bg-surface/80` + `backdrop-blur` — DESIGN_SYSTEM §6); busca responsiva: a paleta `Command` agora posiciona `top-4` no mobile (abaixo do header sticky) e `sm:top-[15%]`, com `max-h-[85dvh]` e largura `w-[calc(100vw-2rem)]` sem overflow horizontal.
- [x] **Testes de layout (DoD)**: `use-sidebar-state.test.ts` (default/persistência/toggle), `bottom-nav.test.tsx` (5 slots na ordem, FAB `?novo=despesa`, Relatórios fora, toque 44px, ativo), `sidebar.test.tsx` (modos, aria-labels, callback, axe), `page-shell.test.tsx` (montagem completa com router real + margem dinâmica + persistência integrada).
- [x] Revisão visual no browser (desktop/mobile/3 temas) — concluída (2026-08-15, confirmada pelo usuário)

**Fase 7 concluída ✅** — entregas 1–3 verdes: BottomNav 5 slots, Sidebar colapsável persistida e PageShell/Header adaptativos; suíte completa **558 testes** verde + typecheck/lint/build sem erros.

---

### Fase 8 — Refinamento Visual Premium & Dashboard de Insights

**Objetivo:** elevar o padrão estético para nível fintech premium com micro-interações táteis, animação fluida de dados, gráficos avançados, privacidade e transformar a Visão Geral em um centro dinâmico de inteligência financeira contextual.

**Decisões e Recursos Premium Alinhados:**
- **Number Ticker (Decisão 1):** Primitivo `NumberTicker` em `src/components/ui/number-ticker.tsx` para transição animada de valores monetários e percentuais nos KPIs ao trocar mês/filtro (interpolação suave em ~300ms via `requestAnimationFrame` mantendo tabulação fixa e fonte mono, desativável com `prefers-reduced-motion`).
- **Swipe-to-Action Mobile (Decisão 2):** Hook `useSwipeAction` em `src/hooks/use-swipe-action.ts` integrado ao `TransactionRow` no mobile, permitindo deslizar a linha para revelar ações rápidas (Editar / Excluir com confirmação e haptics).
- **Feedback Háptico Tátil (Decisão 3):** Serviço leve `src/services/haptics.ts` com `triggerHaptic('light' | 'medium' | 'success' | 'warning')` via `navigator.vibrate` em ações-chave (FAB, calculadora, confirmações de mutação).
- **Toggle de Densidade (Decisão 4):** Alternância entre densidade **Confortável** (padrão, 48px) e **Compacta** (38px) persistida em preferências/storage e aplicada globalmente em tabelas, DataList e listas de transações.
- **Modo Privacidade / Ocultar Valores (Decisão 5):** Toggle de visibilidade no Header (`PrivacyToggle`) e atalho de teclado que ofusca instantaneamente todos os valores monetários (`blur-sm` ou máscara `••••••`) para uso seguro em locais públicos.

**Entregas (na ordem):**
1. **Evolução do Design System, Micro-interações, Haptics & Privacidade:**
   - Arquivos: `src/styles/tokens.css`, `src/styles/globals.css`, `src/services/haptics.ts`, `src/components/ui/number-ticker.tsx`, `src/components/ui/sparkline.tsx`, `src/components/layout/privacy-toggle.tsx`, `src/hooks/use-swipe-action.ts`, `src/hooks/use-privacy-mask.ts`, `src/components/ui/skeleton.tsx`, `src/components/ui/card.tsx`.
   - Tipografia e hierarquia refinadas (Sora para títulos, Inter para interface, IBM Plex Mono com `.num` e transição `NumberTicker`).
   - Modo de privacidade com ofuscação reativa em todos os componentes de valor (`MoneyInput`, `KpiCard`, `TransactionRow`).
   - Superfícies em camadas com elevação suave (`--shadow-sm`/`--shadow-md`), bordas translúcidas sutis e shimmer aprimorado nos Skeleton loaders.
   - Micro-interações táteis calibradas (`active:scale-[0.98]` com curva `cubic-bezier(0.2, 0.8, 0.2, 1)`), transições suaves de rota no `PageShell` e feedback háptico sutil.
   - Suporte a swipe-to-action em `TransactionRow` no mobile e toggle de densidade em listas/tabelas.
2. **Dashboard com Insights Financeiros & Visualizações Avançadas:**
   - Arquivos: `src/components/modules/smart-spending-pace-card.tsx`, `src/components/modules/smart-invoice-projection-card.tsx`, `src/components/modules/smart-anomalies-card.tsx`, `src/components/modules/category-donut.tsx`, `src/components/modules/savings-health-card.tsx`, `src/components/modules/daily-flow-chart.tsx` + integração em `src/features/overview/pages/overview-page.tsx`.
   - **KpiCards com Micro-Sparklines:** Linhas de tendência dos últimos meses nos 4 KPIs centrais.
   - **Gráfico de Fluxo Diário Avançado:** Curva de saldo acumulado, linha guia de meta diária e scrubbing tátil com tooltip flutuante.
   - **Card Donut de Categorias:** Distribuição visual com foco e percentual das principais categorias de despesa.
   - **Card Hero de Runway & Saúde:** Meses de reserva disponíveis e feedback contextual de poupança.
   - **Cards Inteligentes de Ritmo, Faturas e Anomalias:** Motores puros de `domain/projection` e `domain/insights` conectados diretamente ao topo da Visão Geral.
   - Fallback gracioso com EmptyStates e OnboardingCard para novos usuários.

**✅ DoD**
- Todos os KPIs utilizam `NumberTicker` e micro-sparklines de tendência.
- Toggle de privacidade ofusca e desofusca valores monetários no app inteiro sem quebras de layout.
- Linhas de transação no mobile suportam swipe-to-action com feedback tátil em dispositivos compatíveis.
- Gráfico de fluxo diário suporta scrubbing fluido e curva de saldo acumulado.
- Módulo `CategoryDonut` renderiza com a paleta de 10 cores e legenda acessível.
- Transições de rota operam com fluidez (150ms) e respeitam `prefers-reduced-motion`.
- Visual nos 3 temas (light/dark/oled) consistente, com contraste AA validado em todas as combinações e zero quebras de a11y (auditoria axe 100% sem violações).
- Suíte de testes unitários para todos os componentes novos e testes de integração da página Overview.

**Progresso — Fase 8, entrega 1 (Design System, micro-interações, haptics & privacidade):**
- **Haptics (Decisão 3):** `services/haptics.ts` — `triggerHaptic('light|medium|success|warning')` com padrões calibrados via `navigator.vibrate`, no-op sem suporte (nunca lança) + 3 testes.
- **NumberTicker (Decisão 1):** primitivo `ui/number-ticker.tsx` — interpolação rAF ~300ms (ease-out cúbico), `.num` (mono + tabular), **sem setState síncrono em effect** (lint React Compiler) e `prefers-reduced-motion` renderiza o valor direto + 3 testes.
- **Sparkline:** primitivo `ui/sparkline.tsx` — SVG viewBox com escala automática, `vectorEffect="non-scaling-stroke"`, preenchimento translúcido por classe + 5 testes.
- **Modo Privacidade (Decisão 5):** store externa `hooks/use-privacy-mask.ts` (useSyncExternalStore, padrão pwa.ts — sessão, não persistido) + `layout/privacy-toggle.tsx` no header com **atalho de teclado P** (ignora inputs) e `aria-pressed` + 5 testes; máscara `blur-sm select-none` aplicada em **KpiCard**, **TransactionRow** e **MoneyInput** (aria-hidden no valor mascarado).
- **Swipe-to-Action (Decisão 2):** `hooks/use-swipe-action.ts` — pointer events nativos com `setPointerCapture`, gesto vertical ignorado (scroll nativo), snap por limiar, estado `dragging` (transição só no settle) + **`TransactionRow`** ganha `swipeActions` (camada `inert` quando fechada — sem violação aria-hidden; haptic "light" ao abrir); listagem de transações expõe **Excluir** (reusa o diálogo de detalhe com cascata/modos) + 4 testes.
- **Densidade (Decisão 4):** store `hooks/use-density.ts` persistida (`financas_density`) + `layout/density-toggle.tsx` no header (`aria-pressed`) aplicada em **TransactionRow** (padding) e **DataList** (prop `density` já existente).
- **Polish:** `Skeleton` com **shimmer** (`--animate-shimmer`, gradiente com tokens); transição de rota no `PageShell` (`--animate-route-in` 150ms, `prefers-reduced-motion` global desativa); `Card` com `transition-shadow hover:shadow-md`; haptic "success" no **ConfirmDialog** e "light" no **FAB** da BottomNav.
- **Testes:** 23 novos (haptics, ticker, sparkline, privacidade, densidade, swipe, privacy-toggle) — suíte **581 testes** verde.
- [x] Revisão visual no browser (desktop/mobile/3 temas) — concluída (2026-08-15, confirmada pelo usuário)

**Progresso — Fase 8, entrega 2 (Dashboard com insights financeiros):**
- **Domínio puro** (`domain/overview` + 10 testes): `monthlySeries` (totais mensais dos últimos meses p/ sparklines), `cumulativeBalance` (curva de saldo acumulado dia a dia) e `runwayMonths` (meses de reserva = renda ÷ despesas; null sem despesas).
- **Módulos novos** (`components/modules`, 12 testes no total): `CategoryDonut` (anel SVG com paleta de 10 cores `stroke-cat-*` + legenda com participação/valor + empty state + axe), `DailyFlowChart` (barras empilhadas + curva de saldo acumulado + linha guia da meta diária tracejada + **scrubbing tátil** com tooltip flutuante + axe), `SavingsHealthCard` (runway + feedback via `savingsHealth`), `SmartSpendingPaceCard` (ritmo ativo a partir do 8º dia + disponível hoje), `SmartInvoiceProjectionCard` (saldo/quantidade/próximo vencimento — mesmo critério da Central de Lembretes), `SmartAnomaliesCard` (reusa **AlertCard** — DRY com a tela de Insights).
- **Integração na Visão Geral:** KPIs com **NumberTicker** (valueCents) + **micro-sparklines** (6 meses via `useExpensesByRange`/`useIncomesByRange`); seção de **cards inteligentes** (ritmo/faturas/anomalias) no topo; donut de categorias (top 5 do mês); fluxo diário substituído pelo `DailyFlowChart`; alertas críticos (mesmos insumos da InsightsPage: paceRatio, orçamentos estourados, burn rate, déficit projetado).
- **Títulos dos cards em `<h2>`** (heading-order axe: h1 → h2 no topo da página) — sem violações na auditoria P0 (10/10).
- **Testes:** 23 novos (10 domínio + 12 módulos + 2 página) — suíte **605 testes** verde; lint 0 erros; build OK.
- [x] Revisão visual no browser (desktop/mobile/3 temas) — concluída (2026-08-15, confirmada pelo usuário)

**✅ Fase 8 concluída** (entregas 1 e 2 verdes): design system premium, haptics, privacidade, densidade, swipe-to-action, ticker/sparklines, donut, fluxo avançado e cards inteligentes na Visão Geral.

---

### Fase 9 — Utilitários Nativos (Calculadora Flutuante & Gestos de Navegação/Scroll)

**Objetivo:** oferecer utilitários operacionais integrados para agilidade em lançamentos e navegação rápida por gestos/scroll.

**Decisões Técnicas Alinhadas:**
- **Vanilla Pointer Events (Decisão B - Opção 1):** Hook `useDraggable` em `src/hooks/use-draggable.ts` usando eventos nativos (`pointerdown`, `pointermove`, `pointerup` com `setPointerCapture`), garantindo arrasto fluido em mouse/touch com zero dependências externas e snap às bordas da tela.
- **Injeção Contextual ("Usar Valor") (Decisão C):** Store/emissor leve `src/services/calculator-bridge.ts` com `injectCalculatedValue(cents)`. O `MoneyInput` / `useCurrencyInput` se subscreve para receber o valor calculado e atualizar o campo ativo com 1 toque.
- **Scroll-to-Top Inteligente (Decisão D):** Hook `useScrollPosition` com `requestAnimationFrame` + primitivo `ScrollToTopButton` com rolagem suave (`window.scrollTo({ top: 0, behavior: 'smooth' })`) e posicionamento seguro acima da BottomNav.

**Entregas (na ordem):**
1. **Calculadora Flutuante (Floating Calculator Widget):**
   - Arquivos: `src/domain/calculator/` (motor puro de cálculo e divisão de parcelas), `src/hooks/use-draggable.ts`, `src/services/calculator-bridge.ts`, `src/components/modules/floating-calculator.tsx`, `src/components/modules/calculator-keypad.tsx`.
   - Botão flutuante arrastável (FAB) com suporte a arrastar e soltar (drag & drop), mantendo a posição preferida na tela.
   - Painel retrátil compacto com display numérico, operações básicas (+, −, ×, ÷), histórico de operações recentes e botão dedicado de divisão de parcelas (ex: valor ÷ N parcelas em centavos exatos).
   - Botão de ação rápida **"Usar Valor"**: despacha o valor calculado em centavos diretamente para o campo numérico em foco ou formulário ativo (`MoneyInput`).
2. **Utilitário de Retorno Rápido ao Topo (Scroll/Gesture UX):**
   - Arquivos: `src/hooks/use-scroll-position.ts` + `src/components/ui/scroll-to-top-button.tsx`.
   - Detecção de rolagem inteligente (visível suavemente quando `scrollY > 300px`).
   - Clique/toque executa rolagem suave de volta ao topo da página.
   - Posicionamento adaptativo com safe-area no mobile (acima da BottomNav) e no desktop (canto inferior direito).

**✅ DoD**
- Motor da calculadora (`domain/calculator`) coberto por testes unitários (operações aritméticas, divisão exata em centavos, histórico).
- Widget flutuante arrastável com funcionamento verificado em mouse (desktop) e touch (mobile).
- Injeção contextual transfere valores calculados com precisão para o `MoneyInput` sem corromper o estado do formulário.
- Botão Scroll-to-Top funcional em todas as telas com rolagem longa, respeitando `prefers-reduced-motion`.

**Progresso — Fase 9 (2026-08-14):**
- [x] Motor puro `domain/calculator` (operações +, −, ×, ÷, vírgula, backspace, limpar, igual, histórico e divisão exata em parcelas 1–60 com resto na 1ª) + 15 testes
- [x] `useDraggable` (pointer events nativos com `setPointerCapture`, FAB arrastável com snap à borda mais próxima) + teste
- [x] `services/calculator-bridge.ts` (registro do campo em foco + `injectCalculatedValue` em centavos) + teste
- [x] `CalculatorKeypad` (layout clássico, '=' único com `row-span-2`, labels acessíveis sem conflito com o botão de parcelas) + `FloatingCalculator` (FAB + painel com display, histórico, parcelas e "Usar valor") + testes
- [x] `MoneyInput` se registra no bridge ao focar (injeção contextual por 1 toque)
- [x] `useScrollPosition` (rAF, visível após 300px) + `ScrollToTopButton` (rolagem suave, respeita `prefers-reduced-motion`) + testes
- [x] `FloatingCalculator` e `ScrollToTopButton` montados no nível autenticado do roteador (cobrem o wizard de lançamento)
- [x] Typecheck, lint (0 erros), build e suíte completa verdes (90 arquivos / 640 testes)

**✅ Fase 9 concluída:** calculadora flutuante arrastável com injeção contextual e scroll-to-top inteligente em todas as telas autenticadas.

---

### Fase 10 — Identidade Visual Oficial "Guia Financeiro" & Reestilização de Temas

**Objetivo:** aplicar a identidade visual oficial da marca ("Guia Financeiro — Azul Petróleo, Teal Vital, Ouro Âmbar e Coral Suave"), modernizar os 3 temas visuais e atualizar os assets de marca/PWA com contraste WCAG AA certificado.

**Entregas (na ordem):**
1. **Reestruturação dos Tokens Globais:**
   - Atualização de `src/styles/tokens.css` para os 3 temas:
     - **Light ("Vital Petróleo & Ouro"):** Fundo ardósia off-white (`#F4F7F9`), superfícies brancas com bordas ardósia-teal, primária Teal Petróleo (`#2A9D8F`), acentos em Ouro Âmbar (`#DDA726`) e texto em Azul Petróleo Profundo (`#142531`).
     - **Dark ("Abissal Teal"):** Fundo Abissal (`#0C1923`), superfícies em ardósia escuro (`#162836`), primária em Teal vivo (`#2DD4BF`) e acentos dourados (`#F3C352`).
     - **OLED ("True Black + Órbitas Douradas"):** Fundo `#000000` com relevo em bordas ardósia (`#1C2E3D`) e acentos luminosos.
   - Harmonização das semânticas financeiras (Receita: Teal `#2A9D8F` / `#2DD4BF`, Despesa: Coral Suave `#E76F51` / `#FB7185`, Atenção/Metas: Ouro Âmbar `#E9C46A` / `#F59E0B`, Investimentos: Sky Petróleo `#1B3A4B` / `#38BDF8`).
2. **Brand Assets & Componente de Logo Oficial:**
   - Criação do componente vetorial `BrandLogo` em `src/components/layout/brand-logo.tsx` (ícone da carteira orbital + tipografia "Guia Financeiro").
   - Atualização de Favicon, ícones PWA (`public/pwa/icons/`), splash screens e metadados no `index.html`.
3. **Harmonização dos Módulos de Domínio & Categorias:**
   - Alinhamento dos ícones de categorias (`CategoryIcon`), badges de status (`DebtStatusBadge`, `InvoiceStatusBadge`) e gráficos de progresso com a nova paleta.
4. **Auditoria de Acessibilidade & Contraste:**
   - Validação da suíte de contraste matemático (`domain/accessibility`) e testes de renderização visual em desktop e mobile.

**✅ DoD**
- 3 temas funcionando com a nova identidade nos padrões WCAG AA verificados por teste automatizado.
- Logo oficial integrado na Sidebar, Header, PWA e tela de Login/Auth.
- Zero classes com cores soltas ou contrastes fora da escala.
- Suíte de testes 100% verde.

**Progresso — Fase 10 (2026-08-14):**
- [x] **Tokens reestruturados** (`src/styles/tokens.css`): Light "Vital Petróleo & Ouro" (fundo `#F4F7F9`, primária Teal `#2A9D8F`, ouro `#DDA726`, texto `#142531`), Dark "Abissal Teal" (fundo `#0C1923`, superfícies `#162836`, teal vivo `#2DD4BF`, dourado `#F3C352`) e OLED "True Black + Órbitas Douradas" (fundo `#000`, bordas ardósia `#1C2E3D`, acentos luminosos)
- [x] **Semânticas financeiras harmonizadas:** receita Teal `#2A9D8F`/`#2DD4BF` · despesa Coral Suave `#E76F51`/`#FB7185` · atenção Ouro Âmbar `#E9C46A`/`#F59E0B` · investimentos Sky Petróleo `#1B3A4B`/`#38BDF8` (accent agora é o ouro; portfolio segue sky, desacoplados)
- [x] **BrandLogo** (`src/components/layout/brand-logo.tsx`): carteira orbital vetorial refinada com o design de referência `identidadeVisual/` (esfera teal com gradiente, faixas orbitais douradas, núcleo petróleo e satélite dourado, 100% tokens) + tipografia "Guia Financeiro"; integrado na Sidebar, Header (mobile) e AuthShell
- [x] **Assets PWA:** `scripts/generate-icons.mjs` reescrito com a marca (fundo petróleo, moeda teal, órbita ouro; maskable em 72% da zona segura), ícones regenerados, manifest e `index.html` com a marca + theme-colors novos, `offline.html` rebranded
- [x] **Harmonização de categorias:** sugestões de cor de `domain/budgets` alinhadas (educação → Teal `#2A9D8F`; alimentação → Ouro `#DDA726`); badges e gráficos seguem os tokens (positivo/negativo/atenção/portfolio)
- [x] **Auditoria de contraste:** `domain/accessibility` validado para os 3 temas + novos checks (texto sobre ouro, portfolio light/dark) — 21 testes verdes
- [x] Typecheck, lint (0 erros), build e suíte completa verdes (91 arquivos / 648 testes)

**✅ Fase 10 concluída:** identidade visual oficial "Guia Financeiro" aplicada nos 3 temas, com BrandLogo integrado (Sidebar/Header/Auth/PWA) e contraste AA certificado por teste.

**Correções & UX pós-F10 (2026-08-14):**
- [x] **Correção do erro "Dados inválidos" em TODAS as escritas (F11 hotfix):** causa raiz = conta órfã sem linha em `public.profiles` (trigger de signup criado depois da conta). Toda escrita (categorias, cartões, lançamentos, RPCs) falhava na FK `user_id → profiles(id)` (23503 → rótulo "Dados inválidos" do gateway).
  - Migração `20260101000009_backfill_profiles.sql`: backfill idempotente de `profiles` + `user_preferences` para todas as contas órfãs (`on conflict do nothing`).
  - Auto-cura em runtime: `ensureOwnProfile()` (`src/data/repositories/profiles.ts`) disparado 1x por sessão no `useAuth` — cobre bancos ainda não migrados (insere com `ignoreDuplicates`, RLS `profiles_insert_own`).
- [x] **ColorPicker** (`components/ui/color-picker.tsx`): popover com paleta de marca harmonizada (18 swatches Teal/Ouro/Coral/Sky/neutros), hex custom validado (`#RGB`/`#RRGGBB`, normalizado) e limpar — substitui o input hex cru nos formulários de categoria e cartão.
- [x] **IconPicker** (`components/ui/icon-picker.tsx`): grade de ícones `lucide-react` com busca e estado vazio, agnóstico de domínio (opções com ícones injetadas pelas telas a partir de `CATEGORY_ICON_MAP`) — substitui o select textual de ícone no formulário de categoria.
- [x] **Botões discretos (sem fundo sólido):** variantes `default`/`destructive`/`positive` do `Button` reestilizadas para **borda de cor + texto colorido** com hover de tinta suave e sem sombra; `secondary` em tinta 15%; FABs (BottomNav e calculadora flutuante) em círculo `background/95` + borda teal. Botões "Nova transação/categoria/cartão", CTAs de auth e confirmações herdam automaticamente.
- [x] **Calculadora no header + acessível em modais:** novo `CalculatorButton` (mesmo visual ghost/ícone dos botões do header, substitui o `DensityToggle` — densidade segue em Configurações) abrindo o painel via store compartilhado `calculator-open` (botão e FAB abrem o mesmo painel); `Modal` ganha variante `elevated` (z-70) e o FAB da calculadora sobe para z-60, ficando **visível acima de modais de formulário** para cálculo e injeção via bridge.
- [x] **Header alinhado à página:** conteúdo centralizado num container `max-w-5xl` (mesmos limites do conteúdo); a **busca vira barra inline responsiva** (`GlobalSearch` com `flex-1`, um único elemento) tomando a largura excedente entre o limite esquerdo da página e os botões, que ficam alinhados ao limite direito da página — **no mobile e no desktop** (chip Ctrl+K só no desktop).
- [x] **Modo privacidade GLOBAL (todos os valores sensíveis):** a máscara deixou de ser por-componente e passou a ser via CSS — `html[data-privacy="masked"]` (sincronizado pelo `PrivacyToggle`) ofusca **todos** os `.num` (58 usos: listas, cards, tabelas, orçamentos, donut, KPIs…) e `.privacy-mask` (MoneyInput + valores inline em frases: resumo da overview, parcelas do wizard, sugestão de limite, tooltip do fluxo, meta de corte de gastos). A máscara por-componente foi removida (KpiCard/TransactionRow/MoneyInput), mantendo `aria-hidden` no TransactionRow p/ leitores de tela.
- [x] **Scrollbars ocultas:** a barra de scroll visual (que quebrava o layout em algumas páginas) foi removida globalmente — `scrollbar-width: none` (Firefox), `::-webkit-scrollbar { display: none }` (WebKit) e `-ms-overflow-style: none` (Edge legado). O **scroll continua funcional** (wheel, toque, teclado e foco); proibido usar `overflow: hidden` (desativaria a rolagem).
- [x] **FAB da calculadora contextual:** o botão flutuante deixou de aparecer nas páginas comuns — fica **apenas o ícone no header** (`CalculatorButton`). O FAB aparece **quando há um MoneyInput montado** (modal de formulário aberto ou wizard) e some no unmount (modal fechado) — o `MoneyInput` registra um **alvo estável** no mount (setter via ref, sempre atual), re-registrado no foco (campo em uso); o `calculator-bridge` expõe `subscribeCalculatorTarget` para a UI reagir.
- [x] **Bugfix — FAB persistia após fechar o modal:** o `MoneyInput` registrava o campo no focus mas nunca desregistrava; ao fechar o modal (campo desmonta), o `activeTarget` permanecia e o FAB ficava visível na página. Corrigido com registro no **mount** + cleanup no **unmount** (alvo estável via `useCallback`, `unregisterCalculatorTarget` no efeito) — **sem** desregistrar no blur, para preservar o fluxo "Usar valor" (o foco sai do campo quando o painel da calculadora abre). + testes dedicados (mount e unmount).
- [x] **Visão Geral reorganizada (menos sobrecarga visual):** a pilha vertical de cards em largura total virou uma hierarquia equilibrada — KPIs (2/4 cols) → cards inteligentes (3 cols) → **Resumo financeiro** (`md:2 / xl:3` cols): Taxa de poupança, Saldo líquido de contas e Saúde da poupança como cards compactos com o mesmo padrão visual (ícone + título + número + legenda; ícones `PiggyBank`/`Wallet`) → **Análises do período** (`lg:2` cols): Fluxo diário e Distribuição por categoria **lado a lado** (cada um em largura total quando o outro está oculto) → Orçamentos (largura total). Mantém os gates de `dashboardWidgets` da F11 e todos os estados loading/vazio/erro.
- [x] **Ordenação da Visão Geral alinhada à spec §3.6:** a nova ordem da página é **KPIs → Resumo financeiro → Cards inteligentes → Análises → Orçamentos** — a posição de caixa (Saldo líquido de contas) sobe para logo após os KPIs (ordem dos KPIs da spec: totais → saldo líquido) e, dentro do resumo, **Saldo líquido de contas vem primeiro** (depois Taxa de poupança e Saúde da poupança); os cards inteligentes (ritmo/faturas/anomalias) ficam como camada de atenção logo abaixo do resumo.
- [x] **DailyFlowChart como gráfico de linhas (a pedido do usuário):** removidas as barras empilhadas, a curva de saldo acumulado e a linha de meta — o fluxo diário virou um **gráfico de linhas limpo** com **Receitas (verde) × Despesas (vermelho)** por dia do mês na **mesma escala** (SVG `h-40`), pontos finais em cada linha, scrub com **linha guia vertical**, **pontos do dia** nas duas linhas e tooltip (data, entradas, saídas e saldo do dia); legenda da overview atualizada (marcadores de linha, sem "Saldo acumulado").
- [x] **Configurações com largura padrão:** a página era a única com `max-w-4xl mx-auto` próprio, ficando mais estreita que as demais — removido para herdar a largura padrão do shell (`max-w-5xl` do `main`), igual a todas as outras páginas.
- [x] **Guia e script de migração de dados (FinançasAPP → FinançasNew):** `docs/DATA_MIGRATION_GUIDE.md` (ETL passo a passo: mapeamento de entidades, invariantes de parcelamento, `base_amount`, estornos, sanity checks SQL e rollback) + `scripts/migrate-legacy-data.mjs` (Node ESM idempotente, 8 etapas, `.env.migration` com Service Role). Revisado contra o schema real (colunas e constraints conferem) e registrado na tabela de decisão do `PROJECT_STRUCTURE`.
- [x] **Auditoria de personalização visual (F11) — consistência app-wide:** revisadas todas as personalizações de aparência contra o uso real em todo o app. **Correções:** (1) **toggle "Contagem Numérica Animada" estava morto** — `numberTickerEnabled` não era lido por nenhum componente; agora o `NumberTicker` o respeita (valor exibido direto, sem interpolação); (2) **nível "Econômica" (eco) não fazia nada** — agora aplica `data-motion="eco"` e o CSS desliga shimmer/pulso/spring (ripple só no nível `fluid`, via `Button`); (3) **`data-motion="reduced"` não tinha CSS** — o nível "Reduzida/A11y" agora zera animações/transições app-wide (mesmo tratamento do `prefers-reduced-motion`); (4) **estilo "Glass" não existia no app** — o `variant="glass"` do Card era inédito e tudo era opaco; agora o glass vale para o **chrome** (modais, paleta ⌘K, painéis flutuantes: `surface/82` + blur 12px) com **gradiente de fundo tintado pelo acento** no conteúdo (cards de dados continuam opacos — regra §8 do DESIGN_SYSTEM).
- [x] **Wizard de lançamento como modal centralizado no desktop:** `/transacoes/novo` deixou de ser uma coluna estreita grudada no topo de página vazia — no **mobile** mantém o fluxo em tela cheia (D10, topo, sem bordas); no **desktop** (`md+`) vira **painel centralizado vertical e horizontalmente** (borda + `bg-surface` + sombra, `max-h` com scroll interno e fundo `bg-muted/30` para o painel se destacar).
- [x] Typecheck, lint (0 erros), build e suíte completa verdes (689 testes)

---

### Fase 11 — Centro de Personalização Avançada, Experiência Tátil & Micro-Interações Vivas

**Objetivo:** transformar a experiência visual e sensorial do app em nível fintech ultra-premium, com hub completo de configurações, temas com múltiplos acentos de cor, estilos de superfície, botões com efeito ripple e física elástica, transições de abas fluidas e dashboard modular.

**Entregas (na ordem):**
1. **Motor de Acentos & Estilos de Superfície:**
   - Variáveis de acento dinâmicas (`--accent-theme`: teal, emerald, gold, sapphire, violet, rose) e estilos de superfície (`glass`, `flat`, `elevated`) persistidos em preferências e aplicados instantaneamente via tokens CSS.
2. **Biblioteca de Micro-Interações & Botões Vivos:**
   - Primitivo `Button` com efeito ripple radial dinâmico, física elástica spring press e loading morfológico sem layout-shift.
   - Componente `Tabs` e `SegmentedControl` com indicador deslizante fluido (*sliding active pill*).
   - Badges com ponto de pulso vivo (`LivePulseBeacon`) para status urgentes.
   - Síntese de áudio ultraleve opcional via Web Audio API (`services/audio-fx.ts`) para feedback tátil/auditivo de alta precisão.
3. **Hub Completo de Configurações (`/configuracoes`):**
   - Abas temáticas: **Perfil**, **Aparência & Temas**, **Movimento & Animações**, **Experiência Sensorial**, **Dashboard Modular** e **Lembretes & Dados**.
   - Interface com seletores visuais de temas, acentos com swatches interativos, prévias em tempo real e toggles de widgets do Início.
4. **Visão Geral Modular & Personalizável:**
   - Adaptação do `OverviewPage` para respeitar as preferências de visibilidade de cards e widgets selecionados pelo usuário.
5. **Auditoria de Acessibilidade, Contraste WCAG AA e Testes:**
   - Validação de contraste AA para todas as 6 novas variações de cor de acento nos 3 temas.
   - Suíte de testes unitários e de integração cobrindo o novo motor de preferências visuais e a página de configurações.

**✅ DoD**
- 6 paletas de acento funcionando com contraste WCAG AA testado nos 3 temas.
- 3 estilos de superfície (glass, flat, elevated) aplicados dinamicamente.
- Botões com física spring press, ripple pontual e loading morfológico.
- Indicador deslizante funcional em `Tabs`.
- Tela de configurações completa com abas funcionais e persistência.
- Visão Geral renderizando os widgets conforme seleção do usuário.
- Suíte de testes 100% verde (incluindo testes de configurações e áudio).

**Progresso — Fase 11 (2026-08-14, parcial — falta fechar o DoD):**
- [x] **Motor de personalização visual** (`src/hooks/use-visual-customization.ts`): acento, estilo de superfície, nível de movimento e som persistidos em `localStorage` (`financas_*`) e aplicados no root via `data-accent`, `data-surface-style` e `data-motion`
- [x] **6 paletas de acento** em `tokens.css` (`data-accent`): teal (padrão), emerald, gold, rose, sapphire, violet — aplicadas nas variantes `--primary`/`--ring` dos 3 temas
- [x] **Estilos de superfície**: `glass` (padrão, `.glass-panel`), `flat` e `elevated` via `data-surface-style`
- [x] **Micro-interações**: `Button` com ripple radial (`animate-ripple`, respeita `prefers-reduced-motion`/`data-motion`), loading morfológico e feedback háptico/auditivo (`services/audio-fx.ts`, Web Audio opcional); `LivePulseBeacon` (ponto de pulso vivo) e `Tabs` refinadas
- [x] **Z-index tokenizado**: `--z-sticky: 20`, `--z-floating-tools: 60` (FAB da calculadora acima de modais z-50) etc.
- [x] **Centro de Configurações** (`/configuracoes` → `settings-page.tsx`): abas Perfil/Aparência & Temas/Movimento & Sensorial/Dashboard/Conta/Backup com seletores de tema e acento, toggles de som/densidade e modulação do dashboard
- [x] **Visão Geral modular**: widgets da overview (KPIs, cards inteligentes, donut, fluxo, orçamentos, saúde) gated por `dashboardWidgets`
- [x] Testes da página de configurações e do motor (`settings-page.test.tsx`, `use-visual-customization.test.ts`, `audio-fx.test.ts`) + suíte completa verde
- [x] **DoD fechado (F12):** auditoria de contraste AA das 6 paletas de acento nos 3 temas (`domain/accessibility`, 18 combinações) + validação final desktop/mobile — ver Fase 12

---

### Fase 12 — Polimento de UI/UX, Design System & Experiência Visual

**Objetivo:** elevar a sensação de acabamento do app — eliminando a percepção de interface "genérica" — com consistência de superfícies e profundidade, hierarquia tipográfica voltada ao escaneamento de dados financeiros, micro-interações de entrada/saída e feedback tátil/visual refinados, e harmonização fina dos 3 temas. **Mantém rigorosamente a identidade visual oficial (F10):** Teal Petróleo + Ouro Âmbar + Coral Suave, tokens em `tokens.css`, contraste AA e regras do `DESIGN_SYSTEM.md`.

**Entregas (na ordem):**
1. **Consistência de Superfícies & Profundidade:**
   - Auditoria e padronização de raios (`--radius-*`), sombras sutis (`--shadow-sm/md/lg`) e bordas suaves nos ~51 painéis `rounded-xl bg-surface` espalhados — centralizar o padrão em variantes do `Card`/utilitário de superfície, eliminando classes soltas duplicadas (DRY — regra de ouro §4).
   - **Empty States** com variantes por contexto: ícone temático da marca em círculo tintado (`bg-primary/8` + `text-primary-strong`), micro-texto acolhedor e CTA opcional — evoluir o `EmptyState` genérico atual (borda tracejada + ícone cinza).
   - **Skeleton Loaders adaptados** ao formato real dos componentes: variantes `list` (linhas), `kpi` (cards), `chart` (bloco de gráfico) e `table` (linhas de tabela) — substituir os blocos genéricos `h-24 w-full` usados hoje.
2. **Hierarquia Tipográfica & Leitura de Dados:**
   - Primitivo de valor monetário (`MoneyText` em `components/ui`): variantes `hero` (KPI), `value` (lista) e `caption` (resumo) com `.num` + cor semântica automática (receita `positive`, despesa `negative`, saldo condicional) e sinal `+`/`−` explícito — substitui a formatação ad-hoc (`formatCentsAsBRL` + classes soltas) e padroniza o escaneamento rápido.
   - **Badges de status** com ícone/ponto de estado (dot colorido) e **tags de categoria** consistentes (`CategoryIcon` + cor da categoria com contraste AA no texto da tag).
   - Contraste calibrado entre rótulos secundários (`text-xs muted-foreground`), valores principais e destaque de saldos/limites de cartão.
3. **Micro-interações & Feedback Tátil/Visual:**
   - Animações de **entrada/saída padronizadas**: `data-state` (enter/exit) do Radix para modais, dropdowns, tooltips e toasts; transição de rota já existente (150ms) mantida; nova entrada de item na lista (fade + slide sutil) ao criar lançamento.
   - **Feedback de escrita**: check animado em ações de conclusão (marcar dívida/cartão como pago, concluir lançamento), mantendo haptics/áudio existentes (`services/haptics.ts`, `services/audio-fx.ts`).
   - **Hover/focus/active unificados**: press `scale(0.98)` em todos os clicáveis, hover de cards clicáveis com elevação sutil + borda `primary/40` (padrão `Card interactive`), focus-visible 2px `ring` já existente — tudo respeitando `data-motion`/`prefers-reduced-motion` (F11).
4. **Harmonização Claro / Escuro / OLED:**
   - Ajuste fino do **OLED** (evitar preto puro duro): bordas ardósia como principal elevação, redução de glow/sombras fortes e verificação de `muted-foreground` (5.3:1 mínimo).
   - Revisão de contraste em **light** (inputs, `muted-foreground`, estados de feedback) e **dark** (superfícies `#162836`, sem cinzas apagados).
   - Fechar o **pendente do DoD da F11**: auditoria de contraste AA das 6 paletas de acento nos 3 temas (`domain/accessibility`) + validação visual final desktop/mobile.

**✅ DoD**
- Raios/sombras/bordas auditados e centralizados — zero valores soltos de superfície em telas.
- `EmptyState` e `Skeleton` com variantes por contexto usadas em todas as telas (3+ estados: loading/vazio/erro padronizados).
- `MoneyText` + badges/tags com hierarquia consistente em todas as telas financeiras (receitas, despesas, saldos, limites).
- Animações de entrada/saída padronizadas (Radix `data-state`) + feedback de escrita (check animado) em todas as ações de conclusão.
- Hover/focus/active unificados em botões, abas e cards clicáveis, com acessibilidade preservada.
- Contraste AA auditado (3 temas × 6 acentos) e validação final desktop/mobile documentada.
- Suíte de testes 100% verde (incluindo testes dos novos primitivos `MoneyText` e variantes de EmptyState/Skeleton).

**Progresso — Fase 12, ciclo de implementação 1 (2026-08-14):**
- [x] **EmptyState com variantes por contexto (entrega 1):** prop `tone` (`default`/`primary`/`positive`/`negative`/`warning`) — círculo do ícone na marca (`bg-primary/10` + `ring-primary/20`) ou na semântica do estado (vazio positivo em receitas/lembretes, negativo em despesas); padrão `primary`. Aplicado nas telas já auditadas (transações, insights, lembretes) + 4 testes.
- [x] **Skeleton loaders por contexto (entrega 1):** `SkeletonList` (linhas ícone+texto+valor), `SkeletonKpi` (card de KPI), `SkeletonChart` (bloco de gráfico) e `SkeletonTable` (cabeçalho+linhas) — todos herdam o shimmer base; substituem os blocos genéricos `h-24 w-full`. Aplicados na Visão Geral (grade de KPIs + chart) e na listagem de transações + 4 testes.
- [x] **`MoneyText` (entrega 2 — hierarquia tipográfica):** primitivo de valor monetário em `components/ui` com variantes `hero` (KPI) / `value` (lista) / `caption` (resumo), `.num` (mono + tabular — coberto pela máscara de privacidade global), cor semântica `auto` (positivo → positive, negativo → negative, zero → default) ou forçada (`positive`/`negative`/`default`/`portfolio` — ex.: despesa sempre negative) e sinal `explicit` (+/−) / `auto` (só −) / `none`. Substitui a formatação ad-hoc (`formatCentsAsBRL` + classes soltas). **Aplicado** em `TransactionRow` (receita + verde, despesa − vermelho) e no card "Saldo líquido de contas" da Visão Geral — que **corrige um bug**: saldo negativo era exibido como "R$ 0,00" (a máscara `formatCentsAsBRL` zerava negativos) e agora aparece "−R$ …" em vermelho. + 7 testes.
- [x] **DoD pendente da F11 fechado (entrega 4):** auditoria de contraste AA das **6 paletas de acento × 3 temas** em `domain/accessibility` (18 combinações × 3 regras): `primary-strong` sobre o fundo ≥ 4.5:1 (texto de botões/links pós-F10, que são borda + texto colorido), `primary-foreground` sobre `primary-strong` ≥ 4.5:1 (Stepper/DatePicker selecionados) e `primary` sobre o fundo ≥ 3:1 (não-texto: ring de foco/progresso/checkmark). **Ajustes finos de tokens** apontados pela auditoria: emerald light `primary` 160 84 39 → **33%** (#0D9B6C, 3.32:1), gold light `primary` 42 73 51 → **40%** (#B0841C, 3.19:1) + `primary-strong` 38 92 38 → **30%** (#935F06, 5.07:1 no fundo / 5.41:1 com foreground branco; o brilho dourado decorativo permanece via `--accent` #DDA726) e violet dark/oled 258 90 66 → **258 92 72** (#9D76F9, 5.47:1 / 4.61:1). + 18 testes.
- [x] **Blindagem do teste de segurança (F6.2):** `security-audit.test.ts` lia arquivos rastreados pelo `git ls-files` (índice) sem checar existência em disco — a renomeação `routes.tsx` → `routes.ts` (não staged) quebrava a suíte com ENOENT; agora arquivos ausentes no working tree são ignorados (o teste valida apenas o que existe).
- [x] **Visão Geral "dashboard limpo e objetivo" (consolidação de widgets):** a modulação do Início foi simplificada — os widgets `pace`/`invoices`/`anomalies`/`savingsHealth` (cards inteligentes F8) deram lugar a um único widget `summary` (Saldo Líquido de Contas & Poupança); os cards inteligentes e a realocação de orçamento saem do dashboard (continuam completos em Insights/Orçamentos — DRY, sem duplicação); o gradiente glass saiu do `main` e passou ao `body` com `background-attachment: fixed` (cor de acento ancorada à janela, não à coluna de conteúdo). Config `DashboardWidgetsConfig` e página de Configurações atualizadas em conjunto.
- [x] Typecheck, lint (0 erros), build e suíte completa verdes (102 arquivos / **759 testes**).
- [x] Revisão visual no browser (desktop/mobile/3 temas × 6 acentos) — concluída (2026-08-15, confirmada pelo usuário)

**Progresso — Fase 12, ciclo de implementação 2 (2026-08-14) — ergonomia de navegação:**
- [x] **Sem headers nas páginas com seletor de mês:** Visão Geral, Transações, Cartões, Orçamentos e Relatórios não exibem mais o cabeçalho de título (h1 visual + botões) — o app mostra **direto o seletor de mês/período** no topo. O título permanece apenas como `h1 sr-only` (leitores de tela + ordem de heading preservada na auditoria axe). Em Transações, o botão "Nova transação" fica ao lado do seletor **só no desktop** (`hidden sm:inline-flex`).
- [x] **FAB da BottomNav contextual por página:** o `+` agora abre a criação do contexto atual — Início/Transações → wizard de lançamento (`/transacoes/novo`); Cartões → formulário de cartão (`/cartoes?novo=cartao`); Dívidas → formulário de dívida (`?novo=divida`); Categorias → formulário de categoria (`?novo=categoria`); demais páginas caem no wizard de lançamento (fallback). Implementado com o hook reutilizável `useCreateDeepLink` (`?novo=<key>` — estado derivado da URL, sem setState em effect; fechar limpa o parâmetro com replace) + aria-label dinâmico do FAB. + 5 testes do hook + 3 de alvo por rota.
- [x] **Botões de criação removidos no mobile:** "Nova transação", "Novo cartão", "Nova dívida" e "Nova categoria" ficam ocultos no mobile (`hidden sm:inline-flex`) — no celular quem cria é o FAB da navegação, sem duplicação de ações.
- [x] Testes atualizados (BottomNav FAB contextual, keyboard-nav sem header em Transações, deep-link de cartão) — suíte completa **103 arquivos / 767 testes** verde + typecheck/lint/build sem erros.
- [x] **Espaçamento consistente das listas (correção visual):** as linhas de lançamento em Transações estavam **coladas** — o modo plano do `VirtualList` era `flex flex-col` sem gap e as despesas tinham superfície só por causa do swipe (receitas transparentes). O `VirtualList` ganhou a prop `gap` (aplicada nos dois modos — plano via `style.gap`; janela via passo `itemHeight + gap` com `padding-bottom`, sem sobrepor linhas) e o `TransactionRow` agora usa `bg-surface` em **todas** as linhas (receitas e despesas com o mesmo card de superfície). Auditoria das demais listas: dívidas, categorias, cartões, lembretes, insights, orçamentos e metas já usam `gap-2`/cards com borda; tabelas (PositionTable/ReportTable) usam `DataList` — sem o mesmo problema. + 3 testes (gap nos dois modos + superfície consistente).
- [x] **Ícones sem fundo (a pedido do usuário):** removidos todos os chips/círculos coloridos atrás de ícones decorativos do app — `TransactionRow` (ícone de categoria), `AlertCard`, `InsightList`, cards inteligentes (Ritmo/Faturas/Anomalias/Saúde), `ReminderItem`, `OnboardingCard`, `EmptyState` (o círculo tonal da F12 virou só cor do ícone), resumo/análises/orçamentos da Visão Geral e seletor de categoria do wizard. Os contêineres seguem para preservar alinhamento (`flex size-* justify-center`), mas sem `bg-*`/`ring-*` — apenas a cor tonal do ícone. Auditoria: os demais `rounded+bg` restantes são controles funcionais (inputs, modais, seletores, swatches, pickers, FABs) e foram mantidos. Teste do EmptyState atualizado (sem fundo).
- [x] **Peso no relatório com valor personalizado (a pedido do usuário):** o wizard de lançamento (passo Detalhes) ganhou a opção "Personalizado…" no seletor de peso, com input de percentual em pt-BR (vírgula/ponto/sufixo %). Lógica pura em `wizard-state` (com testes): `CUSTOM_WEIGHT_VALUE` (sentinela não-preset), `parsePercentInput`, `isValidPercent`, `percentToWeight`/`weightToPercentText`, `isPresetWeight`, `reportWeightLabel` e `effectiveReportWeight` (resolve o percentual digitado → fração 0–1 persistida, invariante do schema). `canProceed` exige percentual válido (0–100) antes de avançar; a revisão exibe a linha "Peso no relatório" com o valor resolvido (ex.: 37,5%); ao voltar a um preset o texto custom é limpo. + 11 testes unitários e 1 integração (fluxo completo via Select Radix: 37,5 → `reportWeight: 0.375` no submit).
- [x] **MoneyText estendido às demais telas financeiras (entrega 2.2):** o primitivo agora cobre Cartões, Dívidas, Orçamentos, Relatórios e Carteira, eliminando a formatação ad-hoc restante (`formatCentsAsBRL` + classes soltas) — **KpiCard** ganhou a prop `cents` (renderiza `MoneyText` hero com o tom forte — `positive/negative-strong` — preservando o NumberTicker F8 via `valueCents` e o fallback `value` string; tons dos KPIs unificados nos fortes); KPIs de Cartões/Transações/Visão Geral/Carteira migrados para `cents`; valor de **Dívidas** (tonal por tipo); **Orçamentos** (hero "Total de limites", sugestão de realocação, realizado/meta e `BudgetProgressBar` com "X de Y"); **Relatórios** (`SummaryCard` com `cents` + tons semânticos — Rendas positiva, Despesas negativa, Saldo condicional — e `ReportTable` nas células/total); **Carteira** (`PositionTab` com `cents` — corrige o bug do sinal ASCII "-" que virava "R$ 0,00" no negativo, agora "−R$ …" — e `PositionTable` nas células de preço/custo médio/valor). + 4 testes do KpiCard. Suíte completa **783 testes** verde (antes 779); typecheck/lint/build sem erros.
- [x] **MoneyText — varredura final (entrega 2.3, a pedido do usuário — "deixe tudo funcional e organizado, sem bugs"):** migrados os pontos restantes de formatação ad-hoc em **Visão Geral** (resumo A receber/A pagar/Faturas, linha "X de Y" de orçamentos e linhas de atenção), **Insights** (pendências com tons semânticos — saldo negativo deixa de zerar para "R$ 0,00" e vira "−R$ …" vermelho —, desafios com sinal explícito via cents invertidos, sugestões de limite em par), **Lembretes**, **diálogos** (detalhe da despesa, limite com sugestão) e **wizard** (revisão com Row tipado e parcelas, preview de parcela no passo valor), além dos módulos de gráficos (`DailyFlowChart` — corrige o saldo líquido do dia que zerava quando negativo —, `CategoryDonut`, `ProjectionLine`) e **Carteira** (`AporteResult` com `cents`/`ResultStat`). **Bugs corrigidos na varredura:** (1) calculadora exibia "R$ 0,00" para resultados negativos (ex.: "5 − 10 =") — display e histórico agora usam MoneyText e mostram "−R$ …"; (2) saldo projetado de pendências e saldo líquido do dia zeravam negativos. Usos restantes de `formatCentsAsBRL` são legítimos: templates de string (mensagem de diálogo, detail de linha), format do NumberTicker, máscara de input e a máscara em si. Suíte completa **783 testes** verde; typecheck/lint/build sem erros.
- [x] **Identidade visual & assets oficiais padronizados:** pipeline de geração em `scripts/generate-icons.mjs` conectado aos assets da pasta `identidadeVisual/` (fundo branco puro para PWA e transparência vetorial para marca/logos em `public/brand/` e `public/pwa/icons/`), integrado com alta nitidez no `BrandLogo`, Header, Sidebar e AuthShell.
- [x] **Paleta de alto contraste para categorias e CategoryDonut:** tokens `--cat-1..10` atualizados nos 3 temas com saturação e contraste aprimorados para perfeita diferenciação cromática; `CategoryDonut` refinado com trilha limpa, tipografia de alta legibilidade e barras de progresso com contraste destacado.
- [x] **DailyFlowChart sem sombras/gradientes:** remoção de áreas sombreadas sob as linhas do fluxo diário, preservando exclusivamente as curvas Bézier suaves e linhas guias horizontais limpas para estética minimalista e profissional.

**Progresso — Fase 13 (2026-08-15) — Hotfixes de Layout Mobile, Overflow, Consistência de Dados e Edição de Despesas:**
- [x] **Fixação da Estrutura de Navegação & Viewport Mobile:** `PageShell` atualizado com contêiner `h-dvh flex flex-col overflow-hidden text-foreground`. Header fixo (`shrink-0`), área de conteúdo isolada no `<main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-28 pt-6">` e `BottomNav` fixa com z-index seguro.
- [x] **Unificação do Scroll-to-Top:** `useScrollPosition` atualizado para monitorar o container `main` além da `window`. Botão de rolagem ao topo unificado na lateral com rolagem suave (`smooth`), sem duplicidades e sem sobrepor o FAB central da navegação.
- [x] **Auditoria & Correção de Overflows no Mobile:**
  - `globals.css`: adicionada salvaguarda global `html, body { overflow-x: hidden; max-width: 100vw; }`.
  - `Modal`: adicionado `max-h-[90dvh] overflow-y-auto` preventivo em `DialogPrimitive.Content`.
  - `BudgetProgressBar`: ajuste com `flex-wrap`, `min-w-0` e quebra segura de números e porcentagens.
  - `BudgetsPage`: `IncomeGoalRow` reestruturado com `flex-col sm:flex-row sm:items-end justify-between gap-2.5` e `MoneyInput` fluido.
  - `OverviewPage`: header de "Orçamentos do mês" responsivo com `flex-col sm:flex-row`.
  - `ProjectionLine`, `InsightsPage` e `ReportsPage`: grades e cards com `min-w-0`, `flex-wrap` e quebras responsivas (`grid-cols-1 sm:grid-cols-3` / `sm:grid-cols-4`).
  - `InsightList`: botões de ação ("Confirmar", "Ignorar", "Restaurar") tornados compactos no mobile (apenas ícones com `aria-label` e `title`).
- [x] **Consistência de Ícones de Categoria & Cores Customizadas:**
  - `CategoryDonut`: adicionado suporte para `icon` e `color` nos arcos SVG e nas fatias da legenda, integrando com `CategoryIcon`.
  - `TransactionListPage`: integrado com `useCategories()`, mapeando e repassando `icon` e `iconColor` para `ExpenseRow` e `IncomeRow`.
  - `CardsPage`: integrado com `useCategories("expense")`, repassando `icon` e `iconColor` para as despesas da fatura.
- [x] **Edição Completa de Despesas (`ExpenseDetailDialog`):**
  - Adicionado formulário de edição completo (`ExpenseEditForm` sem efeitos cascata) com campos de Descrição (`Input`), Valor (`MoneyInput`), Data (`DatePicker`), Categoria (`Select`), Forma de Pagamento (`Select`) e Cartão de Crédito (`Select` condicional).
  - Persistência e invalidação integradas via mutação `useUpdateExpense`.
- [x] **Validação & Qualidade:**
  - 104 arquivos de teste / 797 testes automatizados 100% verdes (`npm test`).
  - Typecheck estrito TypeScript 100% verde (`npx tsc --noEmit`).
  - ESLint 100% verde com 0 erros e 0 warnings (`npm run lint`).

**Correções pós-F13 (2026-08-15):**
- [x] **Bloqueio estrito de orientação mobile (portrait only):**
  - **Manifest** (`public/pwa/manifest.webmanifest`): `orientation: "portrait"` + `display: "standalone"` (PWA instalado respeita a trava do sistema).
  - **JS** (`src/services/orientation-lock.ts`): `lockPortrait()` com `screen.orientation.lock("portrait-primary")`/`lock("portrait")` no bootstrap e no **primeiro gesto do usuário** (pointerdown/touchstart/click — exigência de ativação por interação de navegadores mobile), reaplicação em `visibilitychange`/`fullscreenchange`/rotação, prefixos legados (`lockOrientation`/`mozLockOrientation`/`msLockOrientation`) e no-op silencioso onde não há suporte. O overlay de fallback "Gire o dispositivo" foi **removido** (decisão do usuário, 2026-08-15 — o bloqueio fica por conta do manifest + API; sem bloqueio visual em paisagem).
  - **Testes:** cobertura do serviço (lock no-op/com API, ativação por gesto, reaplicação em eventos, prefixos legados, reset).

---

### Fase 14 — Consistência de Estados & Ergonomia de Dados (Trilha A — prioritária)

**Objetivo:** eliminar as inconsistências de loading/vazio/erro da carteira (F4) e elevar a leitura rápida de dados financeiros. **Trilha A — Refinamento Máximo de UI/UX & Conforto Visual (prioridade principal).**

**Entregas (na ordem):**
1. **Skeletons por contexto na carteira** — substituir os blocos genéricos (`h-24 w-full` / `h-48 w-full`) de `PositionTab` por `SkeletonKpi` (3 KPIs) + `SkeletonTable` (linhas da `PositionTable`) — zero Layout Shift (padrão F12).
2. **Empty states ricos** — `PositionTab`, `TargetsTab` e `AporteTab` com `EmptyState` por contexto (tom primary/portfolio) e CTA multi-ação (adicionar ativo / registrar transação).
3. **Rentabilidade na Posição** — colunas/estatísticas derivadas no domínio: `unrealizedPnl` (valor − custo) e `unrealizedPct` (÷ custo) — **função pura em `domain/portfolio` com testes de reconciliação** (regra de ouro: UI só recebe valores), exibidas com `MoneyText` + tom semântico (positive/negative).
4. **Hierarquia de patrimônio** — KPI "Patrimônio total" com comparativo (Δ vs. mês anterior via série mensal derivada) no padrão `DeltaHint` da Overview.
5. **Densidade & teclado** — propagar o toggle de densidade à `PositionTable`; auditar `inputMode` (numeric/decimal) nos formulários de ativo/transação; alvos de toque ≥ 44px em ações de linha.

**Arquivos:** `src/domain/portfolio/` (+ testes) · `src/features/portfolio/pages/position-tab.tsx` · `src/components/modules/position-table.tsx` · `src/features/portfolio/components/transaction-form-dialog.tsx` · `src/features/portfolio/components/asset-form-dialog.tsx`.

**✅ DoD (critérios de aceite)**
- `PositionTab` sem blocos `h-24`/`h-48` genéricos — skeletons por contexto em todas as abas.
- Rentabilidade (não realizada e %) calculada em `domain/portfolio` (função pura) com testes de reconciliação (ex.: compra 10 × R$ 100 → preço R$ 120 ⇒ +R$ 200 / +20%).
- Colunas de lucro/prejuízo com tom semântico correto (negativo nunca vira "R$ 0,00" — `MoneyText`).
- `inputMode` correto em todos os campos numéricos da carteira; axe sem violações nas 3 abas.
- Suíte 100% verde; revisão desktop + mobile nos 3 temas.

**Progresso — F14 (2026-08-15):**
- [x] **Rentabilidade não realizada no domínio** — `positionPnl(valueBRL, totalCost)` → `{ unrealizedPnl, unrealizedPct }` (pct `null` sem custo — caixa) em `domain/portfolio` com **8 testes de reconciliação** (DoD: compra 10 × R$ 100 → preço R$ 120 ⇒ +R$ 200 / +20%; prejuízo negativo; sem custo; arredondamentos).
- [x] **Série mensal derivada** — `portfolioMonthlySeries` (função pura: ledger acumulado até o fim de cada mês, valorado aos preços atuais — aproximação documentada) com **4 testes**; exposta em `usePortfolioPosition.monthlySeries` (últimos 6 meses) para o comparativo e a sparkline da F16.
- [x] **Skeletons por contexto na carteira** — `PositionTab` (3× `SkeletonKpi` + `SkeletonTable rows={5}`), `TargetsTab` (`SkeletonList` + `SkeletonTable`), `AporteTab` (`SkeletonKpi` + `SkeletonChart`) — **zero blocos genéricos `h-24`/`h-48`** (padrão F12).
- [x] **Empty states ricos** — as 3 abas com `EmptyState` contextual: tom `portfolio` (novo tone no primitivo) + CTA (Posição: "Adicionar ativo"; Metas/Aporte: "Ir para Posição" via callback de troca de aba) + `headingLevel` (`h2` direto sob o `h1` — ordem de headings válida, a11y).
- [x] **Hierarquia de patrimônio** — KPI "Patrimônio total" com comparativo **Δ vs. mês anterior** (`DeltaHint` — módulo compartilhado extraído da Overview, DRY §4) alimentado pela série mensal.
- [x] **Colunas de Lucro/Prejuízo e Rentab.** — `PositionTable` com `MoneyText` (tom semântico `auto` + sinal explícito — negativo nunca vira "R$ 0,00") e % com cor; caixa exibido como em-dash; densidade propagada via `useDensity`; ação de linha com alvo de toque ≥ 44px (`min-h-11`).
- [x] **Teclado/inputMode auditados** — todos os campos numéricos da carteira já usavam `inputMode="decimal"` (quantidade/preço/fator, metas, travas); sem mudanças necessárias.
- [x] **A11y** — axe sem violações nas **3 abas** (teste dedicado); `TargetEditor` com `h2` (ordem de heading sob o `h1` da página); `EmptyState` com `headingLevel` configurável.
- [x] **Testes** — 8 novos de `positionPnl` (reconciliação DoD) + 4 de `portfolioMonthlySeries` + 4 do `DeltaHint` + 1 axe nas 3 abas; página com assertions das novas colunas. Suíte completa verde; typecheck/lint/build limpos.
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 15 — Micro-Interações, Feedback & Conforto Visual (Trilha A)

**Objetivo:** elevar a sensação de acabamento nas telas financeiras com micro-interações de feedback e leitura confortável.

**Entregas (na ordem):**
1. **Feedback de escrita uniforme** — check animado após concluir transações da carteira (comprar/vender/provento, definir meta) — mesmo padrão das ações de conclusão existentes (F12).
2. **Transições de dados** — estender `NumberTicker` aos valores dinâmicos da Posição (patrimônio/rentabilidade ao trocar dados), respeitando o toggle "Contagem Numérica Animada" (F11).
3. **Hover/focus refinados** — linhas da `PositionTable` com hover elevado e `focus-visible` ring (padrão `Card interactive`); manter o destaque de preço manual ("informado manualmente").
4. **Cards de investimento na Home** — micro-transição de entrada (fade + slide sutil, já existente nas rotas) ao montar o widget de carteira (F16).
5. **Conforto visual** — revisar densidade do dashboard (KPIs, cards de resumo), respiro vertical (`gap`) e contraste de rótulos secundários nas telas de carteira.

**Arquivos:** `src/components/modules/position-table.tsx` · `src/components/modules/kpi-card.tsx` (reuso) · `src/features/overview/pages/overview-page.tsx` · `src/components/ui/number-ticker.tsx` (reuso).

**✅ DoD (critérios de aceite)**
- Toda ação de escrita da carteira com feedback visual/háptico; `prefers-reduced-motion`/`data-motion` respeitados.
- NumberTicker ativo nos valores principais da posição quando habilitado; desliga sem quebra de layout.
- Hover/focus unificados (mesma linguagem das demais telas — zero classes soltas novas).
- Suíte 100% verde; auditoria axe na carteira sem violações.

**Progresso — F15 concluída (2026-08-15):**
- [x] **Feedback de escrita uniforme (entrega 1)** — haptic `success` + áudio de confirmação (`playSound("success", …)` no padrão F12) em todas as ações de escrita da carteira: `TransactionFormDialog` (registrar compra/venda/provento), `AssetFormDialog` (adicionar ativo) e `TargetsTab` (salvar metas por ativo, por classe, remover meta e salvar travas setoriais).
- [x] **Transições de dados (entrega 2)** — KPI "Patrimônio total" da Posição passa a usar `valueCents` (NumberTicker animado F8/F11, respeitando o toggle "Contagem Numérica Animada" e `prefers-reduced-motion` internamente); Caixa derivado mantém `cents` (pode ser negativo — format BRL não aplicável).
- [x] **Hover/focus refinados (entrega 3)** — herdados do padrão `Card interactive`/`DataList` já vigentes na `PositionTable` (hover elevado + `focus-visible` ring) e no `Button` (press `active:scale` + transição) — zero classes soltas novas; destaque de preço manual preservado.
- [x] **Cards de investimento na Home (entrega 4)** — **adiada para a F16** (o widget ainda não existe; a micro-transição de entrada já é herdada das rotas).
- [x] **Conforto visual (entrega 5)** — gaps/contraste de rótulos da carteira revisados (seções com `gap-4`/`gap-6` consistentes, `muted-foreground` em labels secundários, densidade propagada); formulários com `inputMode="decimal"` (auditado).
- [x] **Testes** — 2 novos por diálogo (`TransactionFormDialog`, `AssetFormDialog`): feedback dispara no submit válido e **não** dispara com formulário inválido (mock de `haptics`/`audio-fx`); ticker da Posição coberto pelo `kpi-card.test.tsx` (valueCents) + página. Suíte completa verde; typecheck (`tsc -b`)/lint limpos.
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 16 — Carteira na Home: KPI Real & Widget de Alocação (Trilha B)

**Objetivo:** eliminar o stub "Carteira na Fase 4" da Visão Geral e dar visibilidade imediata do investimento no Início. **Trilha B — Módulo de Carteira de Investimentos completo e integrado.**

**Entregas (na ordem):**
1. **KPI "Investimentos" real** — `usePortfolioPosition().totalBRL` no lugar de `totals.investmentCents` (hoje sempre 0); sparkline de patrimônio (série mensal derivada — padrão F8) e hint contextual (nº de ativos / fonte dos preços).
2. **Widget "Carteira em resumo"** na Home (gated por `dashboardWidgets` — F11): patrimônio total, caixa derivado, nº de ativos e **mini-donut de alocação por classe** — novo módulo `AllocationDonut` (genérico de ativos, padrão `CategoryDonut`, SVG próprio).
3. **Deep-link** — clique no KPI/widget → `/investments` (F17).
4. **Estados** — loading (`SkeletonKpi`), vazio (`EmptyState` "Sem investimentos" com CTA → `/carteira`), erro (gateway + retry) — Online First.

**Arquivos:** `src/features/overview/pages/overview-page.tsx` · `src/components/modules/allocation-donut.tsx` (novo) · `src/domain/overview` (extensão pura para série de patrimônio + testes).

**✅ DoD (critérios de aceite)**
- Nenhum texto "Fase 4"/stub de carteira na Home — KPI com valor real e estados completos.
- Donut de alocação por classe com paleta da marca (AA) e legenda acessível; axe sem violações.
- Série de patrimônio (para sparkline) é função pura testada (derivada do ledger + preços).
- Widget respeita a modulação do dashboard (Configurações > Dashboard).

**Progresso — F16 concluída (2026-08-15):**
- [x] **KPI "Investimentos" real (entrega 1)** — decisão alinhada com o dono do produto: o KPI da Visão Geral exibe **aportes líquidos do mês** (compras + subscrições − vendas, via `useAllPortfolioTransactions`), com sparkline de 6 meses e comparativo `DeltaHint` — coerente com o `investmentCents` do balanço mensal (`saldo = rendas − despesas − investimentos`); **não** é o patrimônio total (que distorceria o saldo do mês).
- [x] **Deep-link (entrega 3)** — `KpiCard` ganhou prop `onClick` **acessível** (role button, tabIndex 0, Enter/Espaço, variante interactive — 3 testes); o KPI de investimentos navega para `/carteira` (a rota `/investments` da F17 assume o deep-link quando existir).
- [x] **Motor puro `allocationByClass`** (`domain/portfolio`, 4 testes) — agrega a posição por classe de ativo (valor + peso no patrimônio), base do donut de alocação.
- [x] **`AllocationDonut`** (módulo novo — contrato próprio de ativos, delega ao `CategoryDonut`/DRY, 2 testes + axe na Posição) — **decisão do produto: sem widget na Home** (o resumo permanece na Carteira); o donut foi integrado na **aba Posição** (`position-tab.tsx`, WIP do dono) e fica pronto para a F17.
- [ ] Estados loading/vazio/erro do widget — **fora de escopo** (sem widget na Home; o KPI herda o skeleton global e o deep-link já existe).

---

### Fase 17 — Dashboard de Investimentos (`/investments`) (Trilha B)

**Objetivo:** visão executiva da carteira com gráficos, rentabilidade e posições — tela de **leitura** separada da operação (`/carteira` mantém cadastro/metas/aporte).

**Entregas (na ordem):**
1. **Rota `/investments`** — nova página em `appRoutes` + item de navegação (fonte única `nav-items`; slot no menu "Mais").
2. **KPIs executivos** — Patrimônio Total, Rentabilidade da Carteira (ponderada pelo valor, derivada dos `unrealizedPct` por ativo), Proventos no mês (recebidos) e Alocação por Classe.
3. **Gráficos de distribuição patrimonial** — donut/rosca **por classe de ativo** e **por ticker** (SVG próprio, padrão `CategoryDonut` — sem libs novas).
4. **Tabela de posições avançada** — PM (custo médio), quantidade, valor de mercado, **Lucro/Prejuízo não realizado (R$ e %)** (motor da F14), fonte do preço (badge manual/api/fallback) e peso na carteira — com ordenação e densidade.
5. **Acessos rápidos** — botões para `/carteira` (registrar transação, metas, aporte).

**Arquivos:** `src/features/investments/` (novo — `pages/` + `components/` + `index.ts`, padrão do `PROJECT_STRUCTURE.md` §5) · `src/app/routes.ts` · `src/components/layout/nav-items.tsx` · `src/domain/portfolio` (motores de agregados puros + testes).

**✅ DoD (critérios de aceite)**
- `/investments` com KPIs, 2 donuts (classe e ticker), tabela com lucro/prejuízo e rentabilidade — todos derivados no domínio (funções puras testadas).
- Deep-link da Home chega à tela correta; navegação (sidebar/bottom/menu Mais) consistente — sem rotas duplicadas (fonte única `nav-items`).
- Estados loading/vazio/erro completos; axe sem violações; 3 temas × acentos consistentes.
- Suíte 100% verde (incl. testes dos motores de agregado).

**Progresso — F17 concluída (2026-08-15):**
- [x] **Motores puros (entregas 2–4)** — `src/domain/portfolio/summary.ts` (novo, 7 testes): `portfolioReturnPct` (rentabilidade ponderada pelo valor, Σ pct×valor ÷ Σ valor — ignora caixa/sem custo), `dividendsInMonth` (proventos recebidos no mês — dividend/jcp/fii_yield) e `allocationByTicker` (mesmo padrão de `allocationByClass`).
- [x] **Rota `/investments` (entrega 1)** — página em `appRoutes` (lazy) + item de navegação `ChartLine` na fonte única `nav-items` (sidebar + menu Mais automático; BottomNav preserva slots fixos).
- [x] **Página `InvestmentsPage`** (`src/features/investments/`, barrel + página + 3 testes): KPIs executivos (Patrimônio total com Δ vs mês anterior, Rentabilidade ponderada com tom semântico, Proventos do mês, Ativos), donuts **por classe** (`AllocationDonut`, F16) e **por ativo** (`CategoryDonut`), tabela de posições com ordenação e acessos rápidos para `/carteira`.
- [x] **Ordenação acessível (entrega 4)** — `PositionTable` ganha prop `sortable` (uma implementação, DRY): cabeçalhos clicáveis com `aria-sort` e ícone de direção (3 testes dedicados); a Posição existente permanece sem ordenação (padrão).
- [x] **Estados completos (entrega 5)** — loading (SkeletonKpi ×4 + SkeletonChart ×2 + SkeletonTable), vazio (EmptyState "Sem investimentos" com CTA `/carteira`), erro (gateway + retry via `position.refetch`) — Online First; axe sem violações (auditoria P0 inclui a tela).
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

**Atualização — Unificação da Carteira (decisão do produto, 2026-08-15):** a separação `/carteira` (operação) × `/investments` (leitura) foi **eliminada** em favor de uma **área única de Investimentos** em `/investments`, organizada por **abas internas** — o padrão de consolidação do app:
- **`/investments`** agora é o **hub** com abas: **Resumo** (consolidação executiva + operação: KPIs, donuts de alocação por classe/ativo, tabela com ordenação, cadastro de ativo e movimentação), **Metas** (reuso de `TargetsTab`) e **Aporte** (reuso de `AporteTab`) — DRY, zero telas paralelas.
- **`/carteira` vira redirect** para `/investments` (`RedirectToInvestments` em `routes.tsx`) — deep-links antigos (Home, FAB, favoritos, busca) continuam funcionando; o item "Carteira" saiu da navegação (fonte única `nav-items` mantém apenas "Investimentos").
- **Arquivos:** `src/features/investments/pages/resumo-tab.tsx` (novo — absorve a página F17 como aba) · `src/features/investments/pages/investments-page.tsx` (hub de abas) · `src/app/routes.tsx` (redirect) · `src/components/layout/nav-items.tsx`.
- Nada se perde: os motores puros (`summary.ts`), `AllocationDonut`, `PositionTable` sortable e os testes da F17 foram absorvidos pela aba **Resumo**.
- **Fora de escopo nesta rodada:** aba "Relatório" da carteira (fica para a **F22** — exportação geral, decisão do produto).

**Atualização — CRUD completo de ativos e lançamentos (2026-08-15):** o usuário tem controle total da carteira — adicionar, **editar** e **excluir** ativos e lançamentos:
- **Repository** (`src/data/repositories/portfolio.ts`): `updatePortfolioAsset` / `deletePortfolioAsset` (cascata de transações e metas via banco) / `updatePortfolioTransaction` / `deletePortfolioTransaction` — 6 testes novos (update/delete + erro classificado).
- **State** (`src/state/queries/use-portfolio.ts`): `useUpdatePortfolioAsset` / `useDeletePortfolioAsset` (invalida ativos, transações e metas — ledger recalculado) / `useUpdatePortfolioTransaction` / `useDeletePortfolioTransaction` — exportados no barrel.
- **`AssetFormDialog`** com modo edição (formulário preenchido, `Salvar` via update) + **exclusão com `ConfirmDialog`** (aviso de cascata) — 2 testes novos.
- **`TransactionFormDialog`** com modo edição (campos pré-preenchidos conforme o tipo) + **exclusão com `ConfirmDialog`** — 2 testes novos. Sincronização de estado na abertura via "ajuste durante render" (padrão oficial React — sem setState em effect).
- **`TransactionListDialog`** (novo, `src/features/portfolio/components/`) — extrato cronológico dos lançamentos do ativo (reuso de `useAssetPosition`), com **editar** (abre o formulário preenchido) e **excluir** por lançamento, além de "Novo lançamento" — 4 testes.
- **`PositionTable`** ganha ações por linha (opcionais): **Movimentar** (existente), **Lançamentos** (ícone `List`), **Editar** (`Pencil`) e **Excluir** (`Trash2`, tom negativo) — DRY, sem quebrar os usos existentes.
- **`ResumoTab`** conecta tudo: editar/excluir ativo e abrir lançamentos direto da tabela de posições; labels de tipo de transação em fonte única (`src/lib/labels.ts` → `PORTFOLIO_TX_LABELS`).

---

### Fase 18 — Proventos: Extrato & Calendário (Trilha B)

**Objetivo:** dar visibilidade total dos rendimentos da carteira — **recebidos** (escopo mínimo; provisionados ficam para ajuste futuro sob demanda).

**Entregas (na ordem):**
1. **Extrato de proventos recebidos** — agregação de `portfolio_transactions` (`dividend`/`jcp`/`fii_yield`) por mês e por ativo (o ledger já separa `dividends`); lista com valores, datas e totais.
2. **Calendário de proventos** — visão mensal (reuso de `MonthPicker` + lista ordenada); destaque do mês atual.
3. **Provisionados — fora do escopo inicial** (decisão default: apenas recebidos; estimativa por histórico ou migration ficam como ajuste futuro — P4 em aberto para revisão).
4. **Integração com o app** — proventos ficam **só na carteira**, fora do fluxo financeiro core (D11 preservado — sem lançamento automático [PROVENTO] na Home/Relatórios).

**Arquivos:** `src/domain/portfolio/dividends.ts` (motor puro + testes) · `src/features/investments/` (aba "Proventos").

**✅ DoD (critérios de aceite)**
- Extrato mensal correto (soma por mês = transações de provento, reconciliado por teste).
- Calendário com navegação mensal e estado vazio acolhedor.
- Suíte 100% verde; axe sem violações.

**Progresso — F18 concluída (2026-08-15):**
- [x] **Motor puro (entregas 1–2)** — `src/domain/portfolio/dividends.ts` (novo, 7 testes): `isDividendType` (dividend/jcp/fii_yield), `dividendsInMonth` (**movido de `summary.ts` — fonte única**, DRY com a F17), `dividendExtractForMonth` (extrato do mês com ticker, ordenado por data desc, reconciliado: soma = `dividendsInMonth`) e `dividendsByYear` (12 meses do ano, zero quando vazio — calendário).
- [x] **Aba "Proventos" no hub `/investments`** (`proventos-tab.tsx` novo, barrel + 4 testes): **MonthPicker** (navegação mensal reusada), KPIs (Recebido no mês + Total no ano), **Extrato do mês** (lista com ticker, data e tipo via `PORTFOLIO_TX_LABELS`) e **Calendário anual** (12 botões de mês clicáveis com `aria-pressed`, destaque do mês ativo e navegação direta) — todos derivados no domínio (funções puras).
- [x] **Estados completos (entrega 4)** — loading (`SkeletonTable`), vazio (`EmptyState` "Sem proventos ainda"), erro (gateway + retry) — Online First.
- [x] **Integração (entrega 3/4)** — proventos **só na carteira** (D11 preservado: sem lançamento automático [PROVENTO] no fluxo financeiro core); escopo mínimo — provisionados fora (decisão F18).
- [x] **Acessibilidade** — aba Proventos com extrato no auditoria axe (12 testes, sem violações); navegação mensal e calendário clicáveis por teclado.
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 19 — Inteligência & Consistência dos Insights (Trilha A)

**Objetivo:** tornar a funcionalidade de insights mais inteligente, precisa, organizada e consistente — **sem repetições desnecessárias**: uma única implementação para cada regra, zero código morto e motores 100% aproveitados pela UI. Fase de **evolução** (sem reconstruir motores) originada da auditoria funcional de Insights (2026-08-15) — diagnóstico completo em `NEXT_PHASES.md` §1.4.

**Entregas (na ordem):**
1. **Limpeza de código morto F8** — remover `SmartSpendingPaceCard`, `SmartInvoiceProjectionCard`, `SmartAnomaliesCard`, `SavingsHealthCard` + `smart-cards.test.tsx` + exports do barrel (a F12 já os substituiu pelo widget `summary`); remover ou reaproveitar os órfãos `runwayMonths`/`cumulativeBalance` (`runwayMonths` pode virar KPI de meses de reserva na F16/17).
2. **Fonte única de normalização e essencialidade** — `normalizeText` (unifica `normalizeServiceName`/`normalizeKey`), `valuesWithinTolerance` (unifica `hasStableValue`/`hasValuesWithin`; `hasStableValue` delega) e `ESSENTIAL_CATEGORY_ICONS` (essencial ∪ agregadoras — elimina as 3 listas sobrepostas: `isEssentialIcon` da página, `ESSENTIAL_CATEGORIES` de subscriptions, `AGGREGATING_CATEGORY_ICONS` de recurrences) em `domain/insights`, com testes de unificação.
3. **Helper canônico de centavos** — `numberToCents(value)` puro em `domain/money` (com guarda `isFinite`, contrato único); substituir os ~8 `toCents` locais divergentes de features (hoje alguns sem guarda — comportamento inconsistente para NaN/Infinity).
4. **Reuso de motores na InsightsPage** — `computeOverview` para rendas/despesas/saldo/savings rate (em vez dos reduces inline com peso de relatório); `aggregateByWeekday` para o diagnóstico de fim de semana (em vez do bucketing manual ÷5/÷2); helpers `budgetLimitsByCategory`/`spentByCategoryMap` compartilhados com Overview/Budgets (padrão repetido em 3 páginas); Map de categorias pré-computado (O(n²) → O(n)).
5. **Fechar lacuna de diagnóstico** — exibir tendência significativa (`isSignificantTrend`, §3.7.6 — gastos vs mês anterior > 15%) no aba Diagnósticos (motor pronto e testado, tela não usa).
6. **Consistência com a carteira** — projeções (`dailyBudget`/`endOfMonthProjection`) passam a receber investimentos reais de `usePortfolioPosition` (hoje `investmentsCents: 0`, mesmo stub da Home) — sem dependência da F16 (`usePortfolioPosition` existe desde a F4), mas alinhado a ela.
7. **Organização de labels** — mover `LEVEL_LABELS` (subscription/recurring/similar) para `src/lib/labels.ts` (hub DRY existente); mensagens de motivo de sugestão de limite via constantes (sem strings soltas).

**Arquivos:** `src/domain/insights/*` (normalize/tolerance/essentials) · `src/domain/savings/index.ts` · `src/domain/money/parse.ts` (+ `numberToCents`) · `src/domain/overview/index.ts` (limpeza de órfãos) · `src/domain/budgets` (helpers compartilhados) · `src/features/insights/pages/insights-page.tsx` · `src/features/budgets/pages/budgets-page.tsx` · `src/features/overview/pages/overview-page.tsx` · remoções em `src/components/modules/` (`smart-*-card.tsx`, `savings-health-card.tsx`, `smart-cards.test.tsx`) + barrel.

**✅ DoD (critérios de aceite)**
- Zero código morto F8: módulos removidos, barrel limpo (nenhum export órfão); `runwayMonths`/`cumulativeBalance` removidos ou reutilizados.
- Uma única implementação de normalização, tolerância de valores e lista de categorias essenciais — verificada por testes de unificação (mesmos resultados dos motores anteriores).
- `numberToCents` único em `domain/money` com testes; nenhum `toCents` local restante em features.
- InsightsPage reusa `computeOverview`/`aggregateByWeekday`/helpers compartilhados — sem reduces/bucketing inline duplicados; sem `.find` por item (Map).
- Diagnósticos exibem tendência significativa; projeções usam investimentos reais (consistente com F16).
- Suíte 100% verde (motores unificados + página + auditoria axe); typecheck/lint/build limpos.

**Progresso — F19 concluída (2026-08-15):**
- [x] **Limpeza de código morto F8 (entrega 1)** — removidos `SmartSpendingPaceCard`, `SmartInvoiceProjectionCard`, `SmartAnomaliesCard`, `SavingsHealthCard` + `smart-cards.test.tsx` + exports do barrel (substituídos pelo widget `summary` desde a F12); removidos os órfãos `runwayMonths`/`cumulativeBalance` (+ `CumulativePoint`) de `domain/overview` com seus testes — zero código morto.
- [x] **Fontes únicas (entrega 2)** — novo `domain/insights/shared.ts` com `normalizeText` (unifica `normalizeServiceName`/`normalizeKey`; `normalizeServiceKey` para o catálogo), `valuesWithinTolerance` (unifica `hasStableValue`/`hasValuesWithin` — `hasStableValue` delega com ±5%) e `ESSENTIAL_CATEGORY_ICONS` (essenciais ∪ agregadoras, 8 itens — elimina as 3 listas sobrepostas: `isEssentialIcon` da página, `ESSENTIAL_CATEGORIES` de subscriptions, `AGGREGATING_CATEGORY_ICONS` de recurrences); barrel exporta apenas as fontes únicas. **Testes de unificação** (7): mesmos resultados dos motores anteriores.
- [x] **`numberToCents` canônico (entrega 3)** — `domain/money/parse.ts` com guarda `isFinite` (NaN/Infinity → 0) + 2 testes; substituídos os **8 `toCents` locais divergentes** (insights, budgets, overview, reports, position-tab, targets-tab, position-table, aporte-result) — nenhum restante em features/módulos.
- [x] **Reuso de motores na InsightsPage (entrega 4)** — `computeOverview` (rendas/despesas/saldo/savings rate com peso, sem reduces inline); `aggregateByWeekday` para o diagnóstico de fim de semana (médias diárias ÷5/÷2 derivadas do agregador, sem bucketing manual); helpers `budgetLimitsByCategory`/`spentByCategoryMap` em `domain/budgets` (2 testes) agora usados nas **3 páginas** (Overview, Budgets, Insights — DRY); Map de categorias pré-computado (O(n²) → O(n)).
- [x] **Tendência significativa nos Diagnósticos (entrega 5)** — nova célula "Tendência de gastos" com `isSignificantTrend` (variação vs mês anterior, ±) + Alert warning (subida) / success (queda) quando > 15%; teste na página.
- [x] **Investimentos reais nas projeções (entrega 6)** — `usePortfolioPosition` expõe **`monthlyContributionCents`** (aporte líquido do mês: compras + subscrições − vendas — saída mensal real, não o patrimônio, que distorceria o superávit); `dailyBudget`/`endOfMonthProjection`/`computeOverview` da página usam o valor (alinhado à F16, sem depender dela).
- [x] **Labels organizados (entrega 7)** — `RECURRENCE_LEVEL_LABELS` movido para `src/lib/labels.ts` (hub DRY, tipado por `RecurrenceKind`); motivos de sugestão de limite via `increaseReason`/`reduceReason` (constantes com template — sem strings soltas em `domain/savings`).
- [x] **Testes** — 12 novos (7 unificação + 2 `numberToCents` + 2 helpers budgets + 1 tendência na página) e 7 removidos (smart-cards + órfãos); suíte completa verde; typecheck/lint limpos.
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 20 — Sistema de Gestos & Navegação por Swipe (Mobile Gesture UX) (Trilha A)

**Objetivo:** navegação horizontal fluida no mobile (meses/períodos e sub-abas) com **rigor técnico absoluto** — zero falsos positivos e coexistência com componentes interativos existentes (Swipe-to-Action de despesas, gráficos com scrub, formulários, modais). Mapeamento arquitetural e matriz de riscos em `NEXT_PHASES.md` §1.5.

**Entregas (na ordem):**
1. **Motor puro de gestos** — `src/domain/gestures/swipe.ts` (funções puras testáveis): `resolveSwipeIntent` (direção/distância/velocidade/flick), `isHorizontalLock` (axis-lock **±30°**: `|dy| ≤ |dx|·tan(30°)` + **descarte imediato** se `|dy| > |dx|` no ponto de lock — Thumb Drift), `isFlick` (`velocity > 0.3 px/ms` com `|dx| ≥ 30px`), `activationDistance(vw)` (`max(60px, 15% viewport)`) e `boundaryResistance` (elastic overscroll).
2. **Engine unificada `useSwipeNavigation`** — `src/hooks/use-swipe-navigation.ts`: máquina de estado `idle → tracking → locked → settled` com `setPointerCapture` após o lock (o gesto é dono do pointer — drift no meio do swipe não cancela); `ignoreSelectors` (`input, textarea, select, [role="dialog"], [data-swipe-nav-ignore], .no-swipe-nav, .swipeable-item`); `pointerType` só `touch`/`pen` + `event.isPrimary` (mouse desabilitado — desktop usa botões); `touch-action: pan-y` no contêiner (scroll vertical livre, pan horizontal bloqueado); callbacks `onDragProgress(offsetPx)`/`onNavigate(previous|next)`/`onBoundary()`; limites `canGoPrevious`/`canGoNext`; haptics (`light` no lock, `warning` na borda).
3. **Navegação temporal horizontal (`MonthSwiper`)** — módulo `src/components/modules/month-swiper.tsx` que envolve o `MonthPicker` com o swipe (esquerda = próximo mês, direita = anterior), aplicado nas **5 telas** com seletor de mês (Visão Geral, Transações, Cartões, Orçamentos, Relatórios — DRY, uma integração reusada). Borda inferior `month > APP_START_DATE (2026-01)` (spec §4.1); `canGoNext` configurável (padrão: sem limite — paridade com os botões). Transição: translate do conteúdo durante o arrasto + fade-in do novo conteúdo (sem slide fake de dados assíncronos — refetch com skeletons existentes).
4. **Navegação entre sub-abas e filtros** — primitivo `Tabs` ganha prop `swipeable?: boolean` (uma implementação, DRY): swipe na **área de conteúdo** (não no List com `overflow-x-auto`) alterna abas com translate elástico. Aplicado em Insights (4 abas), Relatórios internos (categoria/forma/dia), Dívidas (a pagar/a receber), Orçamentos (limites/metas), Carteira (posição/metas/aporte), Categorias (tipos). **Desabilitado** em Configurações e no wizard de lançamento (formulários densos — isolamento).
5. **Proteção e isolamento de componentes de ação rápida** — coexistência garantida com o Swipe-to-Action de despesas (`TransactionRow`/`useSwipeAction`): o engine ignora gestos iniciados em `.swipeable-item`/`[data-swipe-action]` (engine desacoplado — **sem alterar** `useSwipeAction`); `data-swipe-nav-ignore` nos gráficos com scrub (`DailyFlowChart`, `CategoryDonut`) e no FAB da calculadora (arrastável); modais Radix são portais (isolamento natural pelo overlay).
6. **Micro-interações de feedback tátil** — elastic drag (rubber-banding com resistência crescente + spring-back animado), haptic `light` ao travar e `warning` na borda (início/fim de dados — elastic overscroll), `select-none` durante o arrasto, aria-live opcional na mudança de mês/aba.

**Arquivos:** `src/domain/gestures/swipe.ts` (+ testes) · `src/hooks/use-swipe-navigation.ts` (+ testes) · `src/components/modules/month-swiper.tsx` (+ testes) · `src/components/ui/tabs.tsx` (prop `swipeable`) · integrações em `src/features/{overview,transactions,cards,budgets,reports,insights,debts,portfolio,categories}/pages/*` · `data-swipe-nav-ignore` em `daily-flow-chart.tsx`, `category-donut.tsx`, `floating-calculator.tsx`.

**✅ DoD (critérios de aceite)**
- Motor puro com testes: axis-lock ±30° (incl. saída por dominância vertical), thresholds (60px / 15% vw), flick > 0.3 px/ms, boundary/resistência, filtro de ignore selectors.
- Hook com testes de integração (Pointer Events + capture): swipe horizontal → `onNavigate` 1x; rolagem vertical → **não** navega (scroll preservado); swipe sobre `.swipeable-item` (TransactionRow), `input` e modal → não navega; overscroll na borda → spring-back **sem** navegação.
- `MonthSwiper` nas 5 telas de mês (uma integração reusada — DRY); `Tabs swipeable` nas 6 telas de abas; Configurações/wizard sem swipe (isolamento verificado).
- **Zero regressão** no Swipe-to-Action: testes existentes de `useSwipeAction` verdes + novo teste de coexistência.
- `prefers-reduced-motion`/`data-motion` respeitados; axe sem violações; typecheck/lint/build limpos; suíte 100% verde.
- Revisão manual em dispositivo real (iOS Safari + Chrome Android): thumb drift em scroll rápido, coexistência com exclusão de despesas e bordas de mês — matriz em `RELEASE.md`.

**Progresso — F20 concluída (2026-08-15):**
- [x] **Motor puro de gestos (entrega 1)** — `src/domain/gestures/swipe.ts` com `isHorizontalLock` (axis-lock ±30° via `tan(30°)`, descarte imediato se `|dy| > |dx|` — Thumb Drift, rejeita deslocamento nulo), `isFlick` (> 0.3 px/ms e ≥ 30px), `activationDistance` (`max(60px, 15% vw)`), `boundaryResistance` (rubber-banding com fator 0.35), `directionOf` e `resolveSwipeIntent` (lock → flick → threshold → direção). **20 testes** (cones, drift, flick, piso/15%, resistência, decisão final).
- [x] **Engine `useSwipeNavigation` (entrega 2)** — `src/hooks/use-swipe-navigation.ts`: máquina `idle → tracking → locked → settled` com `setPointerCapture` no lock; `ignoreSelectors` (`input, textarea, select, [role="dialog"], [data-swipe-nav-ignore], .no-swipe-nav, .swipeable-item, [data-swipe-action]`); `pointerType` só `touch`/`pen` + `isPrimary` (mouse desabilitado); `touch-action: pan-y`; callbacks `onDragProgress`/`onNavigate`/`onBoundary`; limites `canGoPrevious`/`canGoNext`; haptics `light` no lock e `warning` na borda. **13 testes de integração** (navega 1x, scroll vertical não navega, isolamento de `.swipeable-item`/`input`/`[data-swipe-nav-ignore]`, borda com spring-back, gesto curto, multi-touch, cancel).
- [x] **MonthSwiper (entrega 3)** — `src/components/modules/month-swiper.tsx` envolve o `MonthPicker` (botões continuam — gesto é adicional, a11y): esquerda = próximo mês, direita = anterior; borda inferior em `APP_START_DATE` (2026-01) com resistência elástica; `canGoNext` configurável; translate do conteúdo durante o arrasto + spring-back. Aplicado nas **5 telas de mês** (Visão Geral, Transações, Cartões, Orçamentos, Relatórios) — DRY, uma integração reusada. **4 testes** (avança/volta, borda APP_START_DATE não navega, botões seguem funcionando).
- [x] **Tabs swipeable (entrega 4)** — primitivo `Tabs` ganha prop `swipeable?: boolean` (default false): swipe na **área de conteúdo** (não no List com `overflow-x-auto`) alterna abas com translate elástico e haptic `light`; bordas (primeira/última aba) não navegam. Aplicado nas **6 telas de abas** (Insights, Relatórios internos categoria/forma/dia, Dívidas, Orçamentos, Carteira, Categorias). **Desabilitado** em Configurações e no wizard (formulários densos — isolamento). **3 testes novos** no primitivo (alterna, borda, sem handlers quando off).
- [x] **Proteção e isolamento (entrega 5)** — coexistência com o Swipe-to-Action de despesas via `ignoreSelectors` (engine desacoplado, **sem alterar** `useSwipeAction`); `data-swipe-nav-ignore` adicionado nos gráficos com scrub (`DailyFlowChart`, `CategoryDonut`); modais Radix (incl. calculadora) são portais — isolamento natural pelo overlay + `[role="dialog"]` no ignoreSelectors (o FAB arrastável foi removido em fase anterior — a calculadora é modal).
- [x] **Micro-interações de feedback (entrega 6)** — rubber-banding com resistência crescente + spring-back animado (`transition: transform 0.25s ease-out`, desligada durante o arrasto), haptic `light` no lock e `warning` na borda, `touch-action: pan-y` (scroll vertical livre), `select-none` herdado dos componentes.
- [x] **Testes** — 40 novos (20 motor + 13 hook + 4 MonthSwiper + 3 Tabs swipeable); suíte completa verde; typecheck/lint limpos (o único erro de `tsc -b` é o arquivo WIP do usuário `report-detail-dialog.test.tsx`).
- [x] **Remoção do swipe de meses (2026-08-16)** — `MonthSwiper` (entrega 3) **removido** por instabilidade na navegação temporal; as 5 telas de mês voltaram ao `MonthPicker` por botões; arquivo `month-swiper.tsx` + 4 testes removidos; `useSwipeNavigation` e `Tabs swipeable` seguem intactos.
- [ ] Revisão manual em dispositivo real (iOS Safari + Chrome Android): thumb drift, coexistência com exclusão de despesas e bordas de mês — matriz em `RELEASE.md`.

---

### Fase 21 — Inteligência de Entrada & Automações Preditivas (Smart Flow)

**Objetivo:** reduzir a fricção e o tempo no registro de lançamentos por meio de heurísticas preditivas locais e atalhos rápidos baseados no histórico do usuário.

**Entregas (na ordem):**
1. **Motor preditivo de descrições (`domain/predictions/`):** funções puras testáveis para inferência de Categoria, Forma de Pagamento e Cartão a partir de similaridade de texto (tokenização, normalização e frequência ponderada por recência).
2. **Autopreenchimento no Wizard e Diálogos de Lançamento:** ao digitar a descrição, sugestões contextuais aparecem de forma sutil e não obstrutiva, permitindo aceitação por 1 toque ou teclado.
3. **Lançamentos Favoritos & Templates:** criação e seleção de despesas e receitas habituais com valores e categorias pré-preenchidos.
4. **Ação de Repetição/Clonagem Rápida:** opção na listagem de transações (`TransactionRow` / menu de detalhe) para "Repetir lançamento" no mês atual com data ajustada.

**Arquivos:** `src/domain/predictions/` (+ testes) · `src/features/transactions/wizard/` · `src/features/transactions/components/` · `src/features/transactions/pages/transaction-list-page.tsx`.

**✅ DoD (critérios de aceite)**
- Motor de predição puro com testes de acurácia contra descrições conhecidas e tolerância a variações.
- Sugestões operam estritamente no cliente (zero latência e zero chamadas extras de API).
- Atalhos de repetição preservam as invariantes financeiras e geram novos IDs/audit_events no envio.
- Acessibilidade e suporte a teclado (Tab/Enter/Setas) mantidos no autopreenchimento.

**Progresso — F21 concluída (2026-08-15):**
- [x] **Motor preditivo puro (entrega 1)** — `src/domain/predictions/` (novo, 11 testes): `normalizeText`/`tokenize` (acentos, tokens ≥ 2 chars), `jaccardTokens` (similaridade 0–1), `recencyFactor` (janela de ~90 dias), `predictFromHistory` (agrupa histórico por categoria+forma+cartão, similaridade × frequência × recência, top 3) e `buildHabitualEntries` (favoritos por frequência com valor mais recente, top 5).
- [x] **Refatoração do motor de sugestões (2026-08-16)** — `domain/predictions` reescrito: `buildHabitualEntries` agora aplica **ranking temporal ponderado** (janela de ±5–10 dias do mês — `dayWindowWeight`), **limite estrito de 3 itens** (era 5) e ordena por **relevância temporal × frequência × recência** (não mais contagem bruta); novo `buildDescriptionSuggestions` — **sugestões de descrição pura** (agrupa por descrição normalizada, **filtra nomes de categoria** e derivações do tipo "Alimentação"/"Supermercado", aplica score por recência/frequência/afinidade com o texto digitado, top 2–3 chips). `predictFromHistory`/`PredictionSuggestion` e o módulo `PredictionSuggestions` (código morto) foram **removidos** — a Etapa 2 passou a usar chips que atualizam **apenas `description`**, preservando 100% do `amount`/`date` preenchidos na Etapa 1 (bug de sobrescrita corrigido).
- [x] **Histórico preditivo no state (entrega 2)** — `usePredictionHistory` (`src/state/queries/use-prediction-history.ts`): despesas + rendas + categorias no contrato do motor, queries habilitadas sob demanda (`enabled` — zero custo fora do wizard).
- [x] **`PredictionSuggestions`** (novo módulo `components/modules/`, 4 testes): listbox acessível (role listbox/option, foco + clique, sem emojis), rótulos por valor (forma/cartão/recebimento), aplicação por 1 toque.
- [x] **Autopreenchimento no wizard (entrega 2)** — `StepDetails` exibe sugestões ao digitar descrição (≥ 3 chars) e `onApplySuggestion` preenche categoria/forma/cartão/valor; `StepValue` mostra **Lançamentos Habituais** (entrega 3 — templates derivados do histórico, 1 toque). 2 testes de fluxo no wizard.
- [x] **Repetição rápida (entrega 4)** — botões "Repetir no mês atual" nos diálogos de detalhe (`ExpenseDetailDialog`/`IncomeDetailDialog`): clona com data ajustada para hoje, novos IDs/audit_events, invariantes preservadas (peso, cartão, competência) — 2 testes.
- [x] **Acessibilidade** — sugestões por teclado (Tab + Enter) e axe sem violações (LaunchWizard na auditoria P0).
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 22 — Central de Exportação, Backup & Fechamento Mensal

**Objetivo:** assegurar a portabilidade total dos dados financeiros do usuário e oferecer visões de fechamento de período prontas para conferência, arquivamento e impressão.

**Entregas (na ordem):**
1. **Motor de serialização e exportação (`domain/export/`):** conversão estruturada de transações, faturas de cartão e posições de investimento para formato CSV (padrão pt-BR com vírgula e UTF-8 BOM para compatibilidade com Excel) e backup integral JSON.
2. **Hub de Exportação e Dados (`/configuracoes > Dados`):** interface para download de extratos filtrados por período, download de backup completo e restauração validada por Zod.
3. **Visão de Fechamento Mensal Imprimível:** página/modal de resumo executivo do mês (balanço, despesas por categoria, faturas quitadas e taxa de poupança) com folha de estilo de impressão limpa (`@media print` sem chrome de navegação).
4. **Compartilhamento de Comprovantes:** integração com Web Share API (`navigator.share`) para envio rápido de resumo de transações e comprovantes de quitação.

**Arquivos:** `src/domain/export/` (+ testes) · `src/features/settings/pages/settings-page.tsx` · `src/features/reports/components/` · `src/styles/globals.css`.

**✅ DoD (critérios de aceite)**
- Exportação CSV validada com abertura correta em planilhas sem corrupção de caracteres pt-BR ou valores numéricos.
- Backup JSON com validação de integridade antes da importação.
- Layout de impressão com visual profissional sem elementos de navegação ou controles de UI.
- Testes unitários para serializadores e componentes da tela de configurações.

**Decisões registradas (F22):**
- **CSV pt-BR/Excel:** delimitador `;` + separador decimal `,` + BOM UTF-8 (abertura correta em planilhas sem corrupção de acentos/valores). Datas `dd/mm/aaaa`; valores sempre em reais (não ponderados pelo peso de relatório — coluna extra "Valor p/ relatório" quando diverge).
- **Período dos extratos:** por mês (padrão, `MonthPicker`) ou intervalo customizado (`DatePicker` de início/fim, fim exclusivo).
- **Restauração substitui TUDO** (decisão validada com o usuário): RPC transacional `restore_backup` (migração 0010) — wipe dos dados atuais em ordem FK + insert com IDs originais, forçando `user_id = auth.uid()` (defesa contra injeção via security definer). Confirmação em 2 etapas (validação Zod + resumo + `ConfirmDialog` destrutivo).
- **Sem R2/storage** (decisão anterior do usuário): backup e exportação são download/upload de arquivos locais.
- **Web Share:** `navigator.share` com fallback para clipboard e silêncio no `AbortError` (usuário cancelou).
- **Fechamento mensal:** valores REAIS (sem peso de relatório); impressão via truque `visibility` + `.print-area` (esconde todo o chrome) com cores claras fixas (`@media print` em `globals.css`).

**Progresso — F22 concluída (2026-08-15):**
- [x] **Motor de serialização (entrega 1)** — `src/domain/export/` (novo, 16 testes): `csv.ts` (`escapeCsvField`, `toCsv` `;`/CRLF, `csvWithBom`, `formatCsvDecimal/Float/Date`, serializers `serializeExpenses/Incomes/Invoices/PositionsCsv` com BOM) e `backup.ts` (payload versionado `BACKUP_VERSION=1`, schema Zod + **integridade referencial**: categorias/cartões/ativos referenciados existem no backup; `BACKUP_TABLE_KEYS` canônico, ordem FK).
- [x] **Repositório de exportação (entrega 1)** — `src/data/repositories/export.ts` (+4 testes): `fetchAllUserData` (lê as 18 tabelas sob RLS em paralelo, monta o payload) e `restoreBackup` (RPC `restore_backup`, 4 testes).
- [x] **RPC transacional (entrega 2)** — migração `20260101000010_backup_restore.sql`: `restore_backup(jsonb)` `security definer` — wipe em ordem FK (16 tabelas, joins para tabelas sem `user_id`) + insert com IDs originais forçando `user_id = auth.uid()` + `audit_events` (D2) + resumo de contagens.
- [x] **Hub de Exportação e Dados (entrega 2)** — `ExportDataHub` (novo módulo `components/modules/`, 6 testes): backup JSON (substitui o botão legado que consultava tabelas inexistentes `transactions`/`accounts` — código morto), extratos CSV por mês/custom (Despesas, Receitas, Faturas, Posições) e restauração em 2 etapas (Dropzone → validação Zod + resumo → `ConfirmDialog` destrutivo → RPC → invalidação de queries).
- [x] **Fechamento Mensal imprimível (entrega 3)** — `MonthlyClosePrintView` (novo módulo, 4 testes) + botão "Fechamento do mês" na página de Relatórios (modal max-w-2xl): KPIs (rendas/despesas/saldo/taxa de poupança via `computeOverview`), despesas por categoria (valores reais + %), faturas quitadas do mês, `@media print` com `.print-area` (esconde chrome, cores claras fixas, `@page` 12mm) e botão "Imprimir / Salvar PDF" (`window.print()`, `print:hidden` nos controles).
- [x] **Web Share (entrega 4)** — `src/services/export-actions.ts` (`downloadBlob/downloadCsv/downloadJson` + `shareText` com fallback clipboard, 4 testes) e botões "Compartilhar" em `ReportDetailDialog` (resumo com itens + totais), `ExpenseDetailDialog` e `IncomeDetailDialog` (comprovante da transação).
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

**Evolução pós-F22 — Fechamento DETALHADO (2026-08-15, a pedido do usuário):**
- [x] **Motor puro `domain/reports/detailed-close.ts`** (+4 testes) — `buildDetailedMonthlyClose(expenses, resolvers)`: agrupa as despesas do mês em **categoria → dia → gasto** (ordenação determinística: categoria por total desc, dias por data asc, gastos por valor desc); cada gasto carrega descrição, rótulo de método de pagamento, nome do cartão e parcela ("2/3" — null para avulsos); rótulos injetados por resolvers (sem import de Supabase/UI).
- [x] **`MonthlyClosePrintView` com seção "Despesas em detalhe"** (+2 testes): por categoria (nome + total), por dia (data curta + dia da semana + subtotal) e por gasto (descrição, método · cartão, parcela, valor — `MoneyText` com tom negativo); `break-inside-avoid` na impressão; a seção só aparece quando há dados detalhados.
- [x] **Integração na página de Relatórios** (modo mês): `closeDetailedCategories` montado com `buildDetailedMonthlyClose` (rótulos via `PAYMENT_METHOD_LABELS`/`activeCardName`/`WEEKDAY_LABELS` Monday-first) e passado ao documento; modal ampliado para `max-w-3xl` com descrição atualizada.
- [x] Suíte completa **1079 testes / 140 arquivos** verde; typecheck/lint/build limpos.

**Evolução pós-F22 — Fechamento completo em qualquer período + impressão multi-página (2026-08-16, a pedido do usuário):**
- [x] **Bug crítico corrigido — exportação incompleta:** o documento de fechamento imprimia **somente a primeira página** com os lançamentos incompletos. **Causa raiz:** a folha de impressão vivia dentro do modal (`position: fixed` com `overflow-y: auto`); mesmo neutralizando os ancestrais com `position: absolute` + `:has()`, o Chrome **corta elementos absolutos na 1ª página** na impressão (validado em Chrome headless + CDP). **Solução:** novo primitivo **`PrintSheet`** (`components/ui/print-sheet.tsx` + 2 testes) — portal em nível `body` (irmão do `#root`) com **fluxo normal de documento** e `display: none` na tela; no `@media print`, o app inteiro é escondido por `body > :not(.print-sheet) { display: none !important }` e a folha vira o documento completo — **paginação multi-página real** (validado com 186 lançamentos → **9 páginas** no PDF, todos os 31 dias presentes, zero vazamento do app).
- [x] **Visual profissional dos PDFs (2026-08-16):** o documento herdava o tema ativo do app — no dark/oled os PDFs saíam com **fundos escuros** (`bg-surface`/`bg-muted/40` sem override), **cores despadronizadas** (`text-positive-strong`/`text-negative-strong`/`text-primary-strong` nas versões brilhantes do dark) e **fontes variadas** (`.num` mono + `font-display` Sora). **Solução** na folha `@media print` do `globals.css`: **redefinição das variáveis de tema** (`--surface`, `--foreground`, `--border`, `--muted`, `--positive-strong`, `--negative-strong`, `--primary-strong`, …) para a **paleta clara fixa** com `!important` (vence temas/accentos de maior especificidade) — como as utilitárias compilam para `hsl(var(--…))` em runtime, a cobertura é total e à prova de utilitárias futuras; **tipografia única** (`.print-sheet * { font-family: sans }` + `.num` mantendo `tabular-nums`); `@page { size: A4; margin: 14mm }`; `tr { break-inside: avoid }` e `thead { display: table-header-group }` (cabeçalho repete por página). **Validação em Chrome real + CDP (media print):** fundo `#fff`, texto `#142531`, bordas/acentos fixos **idênticos em light/dark/oled e accent gold**, `.num` em Inter, app `display:none` e folha visível; PDF multi-página íntegro (6 páginas, dataset 72 lançamentos).
- [x] **Períodos além do mês:** o fechamento agora aceita **mês, ano e intervalo personalizado** — motor renomeado `buildDetailedMonthlyClose` → **`buildDetailedClose(expenses, resolvers, periodLabel)`** (período-agnóstico; rótulo injetado pelo caller); `MonthlyClosePrintView` ganhou a prop `periodLabel` (cabeçalho do documento) e o botão "Fechamento do período" na página de Relatórios aplica o período ativo (mês/ano/custom ≤ 366 dias), com KPIs do período (`computeOverview` sobre o range) e seção detalhada em **categoria → dia → gasto**.
- [x] Suíte completa **1135 testes / 144 arquivos** verde; typecheck/lint/build limpos; impressão validada em Chrome real (PDF de 9 páginas).

---

### Fase 23 — Engenharia de Performance & Code-Splitting 3D

**Objetivo:** otimizar o tempo de carregamento inicial (*First Contentful Paint* e *Time to Interactive*) e a fluidez de navegação em conexões móveis através de empacotamento sob demanda e sintonia fina de cache.

**Entregas (na ordem):**
1. **Code-splitting das bibliotecas 3D:** encapsulamento do Three.js e React Three Fiber em chunk lazy dinâmico, carregado exclusivamente quando a visualização 3D de cartões for ativada pelo usuário.
2. **Sintonia fina de cache e refetch:** calibração de `staleTime` e `gcTime` no TanStack Query por tipo de dado (estático, analítico, cotações e transacional), eliminando requisições repetidas em trocas rápidas de abas.
3. **Pre-fetching de rotas vizinhas:** pré-carregamento discreto dos chunks de código e queries das rotas adjacentes ao interagir com a navegação (BottomNav/Sidebar), sem competir com o primeiro paint.

**Decisões registradas (F23):**
- **Entrega 1 — N/A (sem WebGL):** o projeto **não possui Three.js/React Three Fiber** — a "carteira 3D" de cartões é CSS puro (`credit-card-3d.tsx`/`credit-card-wallet.tsx`, zero dependências WebGL) e a `CardsPage` inteira já é um chunk lazy por rota (F5.5). Não há biblioteca pesada para dividir; o lazy por rota é o boundary correto (o wallet é renderizado incondicionalmente na página).
- **Cache (entrega 2):** política centralizada em `src/state/cache-policy.ts` (fonte única) — **estático** (categorias, cartões, pagamentos, metas de alocação, preferências): `staleTime` 5 min + `gcTime` 30 min; **analítico** (overview, busca, portfolio/ledger, feedback, lembretes): 60 s; **cotações** (asset_prices): 60 s; **transacional** (despesas, receitas, dívidas, orçamentos): 30 s. Consistência garantida por invalidação por mutação (não por refetch de foco).
- **Pre-fetch (entrega 3):** apenas **chunks de código** (não queries) — `prefetchPageChunks` em `routes.tsx` (loaders compartilhados com o `lazy`) + hook `useRoutePrefetch` no `RequireAuth`: no primeiro idle pré-carrega as rotas primárias da BottomNav (/, /transacoes, /cartoes, /relatorios, /investments) e a cada navegação os vizinhos (anterior/próximo) da rota atual; idempotente e silencioso (falha de rede ignorada).

**✅ DoD (critérios de aceite)**
- Zero bibliotecas 3D/WebGL no bundle; a visualização 3D de cartões carrega junto do chunk lazy da rota (sem custo fora dela).
- Política de cache centralizada e aplicada a todas as queries; trocas rápidas de aba sem refetch redundante de dados estáticos.
- Chunks das rotas vizinhas pré-carregados no idle sem competir com o primeiro paint; falhas de rede silenciosas (retry natural na navegação).
- Suíte completa de testes 100% verde; typecheck e lint limpos.

**Progresso — F23 concluída (2026-08-15):**
- [x] **Política de cache (entrega 2)** — `src/state/cache-policy.ts` (novo): `STALE_TIMES` por tipo (estático 5 min / analítico 60 s / cotações 60 s / transacional 30 s) + `STATIC_GC_TIME` 30 min; aplicada nas 15 queries de estado (categorias, cartões, pagamentos, metas de alocação, lembretes e feedback → estático com gcTime longo; overview/busca/portfolio → analítico; asset_prices → cotações; despesas/receitas/dívidas/orçamentos → transacional). `useCategoryUsage` mantém `staleTime: 0` (contagem on-demand do fluxo de exclusão — intencional).
- [x] **Pre-fetching de rotas (entrega 3)** — `src/app/routes.tsx` refatorado: `pageLoaders` como fonte única (compartilhados entre `lazy` e `prefetchPageChunks`); novo hook `src/hooks/use-route-prefetch.ts` (3 testes) no `RequireAuth`: primárias da BottomNav no primeiro idle + vizinhos por navegação, via `requestIdleCallback` (fallback `setTimeout` 1 s), cancelável.
- [x] **Entrega 1 (code-splitting 3D)** — **N/A documentado**: sem Three.js/R3F no projeto; 3D CSS dentro do chunk lazy da rota `/cartoes` (ver Decisões).
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 24 — Planejamento Financeiro & Simulador FIRE

**Objetivo (Trilha C — Estratégia):** planejamento financeiro de longo prazo com projeção de independência financeira (FIRE), fundo de emergência e metas de aporte — apoiado pelos dados do mês (saldo e despesas do Insights).

**Decisões registradas (F24):**
- **Motor determinístico e conservador** (`domain/fire/`): regra dos 4% (meta = despesas anuais × 25), projeção anual `capital = (capital + aporte × 12) × (1 + retorno real)`, retorno real padrão 5% a.a. (editável), horizonte máx. 40 anos. Sem Monte Carlo — um norte simples e auditável (filosofia do app).
- **Local:** seção/aba **Planejamento** na página de Insights (DRY — reuso dos dados e hooks já carregados; sem rota/nav nova). Fundo de emergência usa o **saldo líquido do mês** como proxy do caixa (premissa exposta na UI).
- **UI sem libs de gráfico:** `EmergencyFundGauge` (anel SVG com faixas crítico/baixo/adequado/saudável) e `FireProjectionChart` (polilinha SVG capital × anos + linha da meta) — mesmo padrão dos donuts existentes.

**✅ DoD (critérios de aceite)**
- Projetor FIRE com premissas transparentes e editáveis (aporte, despesa e retorno real).
- Gauge de fundo de emergência com faixas de saúde e cor por faixa.
- Testes do motor puro (`domain/fire/`) cobrindo a aritmética da projeção e as faixas.
- Auditoria de acessibilidade (axe) sem violações na aba Planejamento; suíte completa verde.

**Progresso — F24 concluída (2026-08-15):**
- [x] **Motor puro** — `src/domain/fire/` (novo, 9 testes): `fireTargetCents` (×25), `fireProjection` (série anual ano 0..40, `yearsToFire`, `reached`), `emergencyFundMonths` (meses + faixas de saúde) e constantes (`FIRE_TARGET_MULTIPLE`, `FIRE_WITHDRAWAL_RATE`, `DEFAULT_REAL_RETURN_RATE`, `FIRE_MAX_YEARS`).
- [x] **Módulos SVG** — `EmergencyFundGauge` (4 testes) e `FireProjectionChart` (2 testes) em `components/modules/`, sem libs de gráfico, com `role="img"` + aria-label.
- [x] **`PlanningSection`** (novo módulo, 4 testes): cards de fundo de emergência (gauge + saldo/despesa + faixas) e simulador FIRE (inputs de aporte/despesa/retorno com defaults do mês + meta, tempo até a meta e gráfico), 100% presentacional (motores puros).
- [x] **Integração** — aba **Planejamento** na InsightsPage (entre Projeção & corte e Diagnósticos), com swipe; auditoria axe sem violações (heading order h1→h2).
- [ ] Revisão visual desktop + mobile nos 3 temas (QA manual — `RELEASE.md`).

---

### Fase 25 — Micro-interações, Feedback Visual & Ergonomia

**Objetivo (Trilha A / Refinamento):** elevar o polimento das micro-interações (sidebar por hover, bottom sheets fluidas no mobile, feedback de sucesso) respeitando `prefers-reduced-motion` e os modos de movimento do app (F7/F12). Especificação detalhada a ser consolidada na execução da fase.

**✅ DoD (critérios de aceite)**
- Sidebar expande suavemente por hover no desktop sem deslocar os elementos da página; zero disparos acidentais com mouse rápido; botão de toggle manual e persistência funcionando perfeitamente.
- Modais no mobile comportam-se como Bottom Sheets fluidas com fechamento por arrasto.
- Micro-interações respeitam estritamente `prefers-reduced-motion` e as configurações de `data-motion` (desligando efeitos nos modos "Econômica" e "Reduzida").
- Auditoria de acessibilidade (`axe-core`) com 0 violações nas novas superfícies e tooltips.
- Suíte completa de testes 100% verde (incluindo testes de integração da Sidebar e Bottom Sheets).

**Decisões registradas (F25):**
- **Hover-expand em overlay:** a expansão por hover acontece **por cima** do conteúdo (a sidebar é `fixed`, com `shadow-2xl` no estado flutuante) — a margem da página (`lg:pl-*`) só muda com o toggle **persistido** (`useSidebarState`), então o hover **nunca desloca a página**.
- **Atraso anti-disparo:** `HOVER_EXPAND_DELAY_MS = 120` na entrada e na saída — mouse rápido que apenas cruza a sidebar não expande (testado com fake timers).
- **Bottom Sheet com drag-to-close:** no mobile o `Modal` vira folha inferior (`inset-x-0 bottom-0`, cantos superiores arredondados, slide-up `sheet-in` 250ms). O fechamento por arrasto usa pointer events nativos (touch/pena — nunca mouse), engaja **apenas** com `scrollTop === 0` e fora de elementos interativos (`INTERACTIVE_SELECTOR`), com resistência elástica (100px + fator 0.35), threshold de fechamento 96px, fling > 0.5px/ms e spring-back. Em `prefers-reduced-motion` o rubber-band é desligado (sem transform visual) e o reset do transform vive no handler (`onOpenChange`), não em effect (React Compiler).
- **Tooltip primitivo (`ui/tooltip.tsx`):** CSS puro (group-hover/focus-within), `role="tooltip"` + `aria-describedby` injetado via `useId`/`cloneElement`; substituiu os `title` nativos dos botões do header (tema, privacidade, calculadora) — com `z-tooltip` e transição 150ms respeitando `prefers-reduced-motion`.
- **Gating de movimento:** `sheet-in` é um fade (mantido no nível "Econômica"), zerado no "Reduzida"/`prefers-reduced-motion` pelas regras globais existentes; nenhuma lib nova de animação (Decisão A mantida).

**Progresso — F25 concluída (2026-08-15):**
- [x] Sidebar com hover-expand (overlay + delay 120ms anti-disparo + toggle persistido intacto) + testes (expansão, mouse rápido)
- [x] Modal como bottom sheet mobile: alça (`lg:hidden`), slide-up `sheet-in` e drag-to-close (threshold, fling, resistência, spring-back) + testes (arrasto fecha, arrasto curto não fecha, mouse ignora)
- [x] Primitivo `Tooltip` (axe 0 violações) aplicado nos botões do header (ThemeToggle, PrivacyToggle, CalculatorButton) + testes
- [x] Suíte completa verde; typecheck/lint/build limpos

**Auditoria de elementos nativos do navegador (pós-F25):**
- [x] **DatePicker refatorado:** `navLayout="around"` com **header topo compacto** — `.month` vira coluna (`relative flex flex-col`) com as setas (`Lucide ChevronLeft/ChevronRight` via `Chevron` customizado) posicionadas **absolutamente nas extremidades** (`left-1`/`right-1`, `top-1`) e o seletor Mês/Ano centralizado (`flex h-8 items-center justify-center px-12`); dia selecionado com gradiente da cor primária ativa (`bg-gradient-to-b from-primary to-primary/90` + `text-primary-foreground` + `shadow-sm`); dia atual com **dot indicator** (`after:bg-primary`); foco tátil `ring-2` mantido (**hotfix 2026-08-16:** grade `table-fixed w-full` + botões de dia `aspect-square w-full max-w-9` e popover `w-[calc(100vw-1.5rem)] max-w-sm max-h-[85dvh]` — ver nota pós-F29)
- [x] **NumberStepperInput (`ui/number-stepper-input.tsx`):** substitui `input[type="number"]` nativo — spin buttons ocultos via CSS global (`::-webkit-outer/inner-spin-button` + `-moz-appearance: textfield`); botões `+`/`−` (Lucide) com feedback tátil, respeito a `min`/`max`/`step`, **long-press com repetição contínua** (delay 400ms + intervalo 100ms, ref espelhado do valor) e anti-double-fire; digitação manual livre (`inputMode="decimal"`) — 7 testes
- [x] **Substituições aplicadas (zero `type="number"` no app):** `TargetEditor` (metas por ativo), `TargetsTab` (metas por classe + travas setoriais Ações/FIIs) e `TransactionFormDialog` (quantidade, preço unitário, fator de desdobramento)
- [x] **Auditoria geral:** selects/checkboxes/radios já são primitivos Radix; range/date/file/textarea já têm `Slider`/`DatePicker`/`Dropzone`/`Textarea`; nenhum `window.confirm/alert/prompt` em uso (ConfirmDialog/Toast); zero inputs crus fora de `components/ui/`; scrollbars ocultas por decisão pós-F10 (não reestilizadas para não reintroduzir layout shift)

---

### Fase 26 — Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX)

**Objetivo:** eliminar a poluição visual do botão flutuante lateral de "Rolar para o Topo" no mobile, substituindo-o por um mecanismo gestual discreto e natural de **Pull-up / Overscroll to Top** (arrasto vertical no fim da página) inspirado em padrões nativos (como o pull-down de arquivadas), implementado com rigor matemático absoluto contra disparos involuntários e inércia de rolagem.

**Decisões Técnicas Alinhadas:**
- **Remoção do Botão Flutuante Legado:** Descontinuação do botão lateral flutuante `ScrollToTopButton` no mobile, liberando o campo de visão móvel e eliminando colisões com cartões, listas e FAB central.
- **Engine de Overscroll no Rodapé (`usePullUpToTop`):** Hook gestual dedicado conectado ao contêiner `main` com listeners Pointer/Touch nativos, rastreando o final estático do scroll e aplicando resistência elástica com barreira contra inércia de rolagem rápida (*momentum scrolling*).
- **Máquina de Estados Finita e Cancelamento Dinâmico:** Ciclo de vida `IDLE → AT_BOTTOM → PULLING → THRESHOLD_REACHED → TRIGGERED / CANCELLED`. Cancelamento imediato e reversível caso o usuário recue o dedo antes do `touchend`.
- **Micro-Indicador Minimalista:** Elemento visual sutil (seta minimalista com rotação suave e anel de progresso em arco) posicionado no rodapé da área rolável, respeitando `safe-area-bottom` e renderizado abaixo da Bottom Navigation Bar.

**Entregas (na ordem):**
1. **Motor Puro de Física e Overscroll (`src/domain/gestures/overscroll.ts`):**
   - Funções puras testáveis: `computePullDistance(rawDeltaY, maxPull, resistanceFactor)` (resistência elástica logarítmica), `isAtScrollBottom(scrollTop, clientHeight, scrollHeight, tolerance = 2)` e `evaluatePullIntent(pullDistance, threshold, isStaticBottom)`.
   - Limiar configurável (`threshold = 80px` efetivos, com piso de segurança).
2. **Engine Gestual `usePullUpToTop` (`src/hooks/use-pull-up-to-top.ts`):**
   - Hook gestual conectado ao contêiner `main` com listeners Pointer/Touch nativos (`touchstart`, `touchmove`, `touchend`, `touchcancel`).
   - **Barreira de Inércia de Dois Tempos:** O overscroll só acumula se o contêiner já estiver em repouso estático no final (`scrollTop + clientHeight >= scrollHeight - 2px`); flings rápidos que batem no rodapé são ignorados.
   - **Cancelamento Reversível:** Reduzir o arrasto desfaz o threshold em tempo real; rolagem suave ao topo (`scrollTo({ top: 0, behavior: 'smooth' })`) dispara estritamente ao soltar o dedo (`touchend`) com o threshold sustentado.
3. **Micro-Indicador Visual `PullUpToTopIndicator` (`src/components/modules/pull-up-indicator.tsx`):**
   - Micro-componente vetorial sutil no rodapé da página: seta minimalista com rotação de 180° e arco de progresso SVG, estilizado 100% com tokens do tema ativo (`text-primary`, `stroke-primary`).
   - Z-Index seguro e sem overflow: renderizado no final do fluxo de conteúdo rolável do `main`, com margem inferior segura (`pb-28` / `safe-area-bottom`), sem colisão visual com a BottomNav fixa.
4. **Feedback Háptico & Transição:**
   - Vibração tátil sutil (`navigator.vibrate(10)` / `triggerHaptic('light')`) disparada no instante em que o threshold é atingido (*armed state*).
   - Rolagem fluida e suave até o topo (`behavior: 'smooth'`), respeitando `prefers-reduced-motion` e `data-motion`.
5. **Descontinuação do Botão Legado e Limpeza do Shell:**
   - Remoção de `<ScrollToTopButton />` de `src/app/router.tsx` e descontinuação em `src/components/ui/scroll-to-top-button.tsx`.
   - Limpeza das regras CSS específicas de body modal para scroll-to-top em `src/styles/globals.css`.

**Arquivos:** `src/domain/gestures/overscroll.ts` (+ testes) · `src/hooks/use-pull-up-to-top.ts` (+ testes) · `src/components/ui/pull-up-to-top-indicator.tsx` (+ testes) · `src/components/layout/page-shell.tsx` · `src/app/router.tsx` · `src/styles/globals.css`.

**✅ DoD (critérios de aceite)**
- Botão flutuante legado removido da interface móvel, eliminando sobreposições com listas e FABs.
- Motor puro de física coberto por testes unitários (curva elástica, tolerância de rodapé, disparo por threshold).
- Barreira contra momentum scrolling verificada: inércia de rolagem rápida que atinge o rodapé não aciona o gesto sem um segundo toque estático intencional.
- Cancelamento dinâmico verificado: puxar até armar e empurrar o dedo de volta desfaz o gatilho sem executar scroll.
- Micro-indicador visual integrado ao tema ativo, sem ultrapassar a barra de navegação ou gerar scrollbar horizontal.
- Rolagem suave executada com sucesso ao soltar o dedo no threshold armado; suporte a `prefers-reduced-motion` (rolagem instantânea).
- Suíte completa de testes 100% verde; typecheck e lint limpos.

**Progresso — F26 concluída (2026-08-15):**
- [x] Motor puro `domain/gestures/overscroll.ts`: `computePullDistance` (resistência elástica logarítmica — 1:1 nos primeiros px, assíntota em `maxPull` 140px), `isAtScrollBottom` (tolerância 2px) e `evaluatePullIntent` (trigger exige threshold E rodapé estático) + 10 testes
- [x] **Correção — Pull-up instável/aleatório (2026-08-16, F26 evolução):** o gesto falhava na maioria das tentativas por três causas: (1) **subpixel** — telas DPI alto reportam `scrollTop` fracionário (899.4) e a tolerância de 2px falhava o fim do scroll → `isAtScrollBottom` agora usa `Math.ceil(scrollTop + clientHeight) >= scrollHeight − 8` (`SCROLL_BOTTOM_TOLERANCE_PX` 2 → 8); (2) **âncora só no `pointerdown`** — rolar até o fim e puxar no mesmo gesto era ignorado → o hook agora **engaja e re-ancora `startY` no `pointermove`** quando o scroll atinge o rodapé no meio do toque (pull conta dali); (3) **overscroll nativo competindo** — o contêiner ganha `overscroll-behavior-y: contain` e um listener nativo `touchmove` **não-passivo** (anexado no `currentTarget` do `pointerdown`, removido ao fim do gesto) que chama `preventDefault()` apenas quando engajado puxando para baixo. Threshold de disparo calibrado 80 → **60px** (mais confortável). **Testes:** +2 no domínio (subpixel/ceil/tolerância 8, limiar 60) e +5 no hook (engajamento no meio do gesto com re-âncora, subpixel engaja, `touchmove` nativo prevenido quando puxando / liberado fora do gesto, `overscroll-behavior` aplicado e restaurado) — `use-pull-up-to-top.test.ts` renomeado para `.tsx` (harness real com `<main>`).
- [x] Hook `usePullUpToTop`: FSM `idle → at_bottom → pulling → threshold_reached → triggered/cancelled`; barreira de inércia revalidada a cada movimento (momentum desarma); cancelamento reversível (recuar o dedo desfaz o threshold — `triggeredRef` resetado); decisão de soltura por **ref** (imune a closure stale); sem `setPointerCapture` (coexistência com o swipe-to-action das linhas — arrasto horizontal mantém dy ≈ 0); engaja só com conteúdo rolável (`scrollHeight > clientHeight`) + 7 testes
- [x] Primitivo `PullUpToTopIndicator` (`components/ui/`): seta + anel de progresso SVG (`stroke-primary`, dashoffset pelo progresso; completo e com seta primária no estado armado), decorativo (`pointer-events-none` + `aria-hidden`), `z-sticky` acima da BottomNav + 5 testes
- [x] Integração no `PageShell` (handlers no `main` + indicador fixo) e **remoção** do `ScrollToTopButton` + `useScrollPosition` do roteador; regra CSS de trava de diálogos (`[data-scroll-to-top]`) removida (o indicador é decorativo e não intercepta interação)
- [x] Wizard `/transacoes/novo` continua sem gesto (fora do PageShell — mesmo comportamento do botão antigo)
- [x] Suíte completa verde; typecheck/lint/build limpos
- [x] **Remoção do gesto de pull-up to top (2026-08-16, decisão de produto):** o gesto continuou instável em dispositivos reais mesmo após as correções — **removido** `usePullUpToTop` (hook), `PullUpToTopIndicator` (indicador) e o motor puro `domain/gestures/overscroll` (+ testes); `page-shell.tsx` volta a ser contêiner de scroll simples (sem handlers de pointer); comentário F26 removido de `globals.css`. A rolagem nativa do `main` segue intacta (o `overscroll-behavior-y: contain` global permanece — comportamento independente do gesto).

### Fase 27 — Insights: Precisão, Deduplicação & Casos de Borda

**Objetivo (Trilha A / Inteligência):** refinar o módulo de Insights para ser **mais preciso, consistente e sem repetições desnecessárias** (direção do produto 2026-08-15): bases de cálculo corretas, mensagens coerentes em casos de borda e eliminação de recomendações duplicadas. Sem novas features — só precisão do que já existe.

**Problemas corrigidos:**
- **`monthlyAvgCents` dos desafios usava só o mês atual** (rotulado "média mensal") — mês parcial/atípico distorcia as metas de corte. Agora a UI alimenta o motor com a **média real dos últimos meses com gasto** (novo `typicalMonthlySpendCents` em `domain/savings`): mês sem consumo não dilui a referência.
- **Linha "30% em não essenciais" duplicava o desafio individual** quando havia 1 única categoria elegível (mesma base, mesmo número). `DiscretionaryChallenge` agora expõe `categoryCount` e a UI oculta a linha agregada com `categoryCount < 2` — ela só aparece quando realmente agrega (2+ categorias).
- **`weekendRatio` sem dados de dia útil renderizava "∞×" e alerta "gastos ∞× maiores"** — mensagem sem sentido. A UI agora trata `weekdayDaily <= 0` como **incomparável**: exibe "—" com tom neutro e não dispara o alerta (o motor puro continua devolvendo `Infinity`/`0` — comportamento documentado em teste).

**Arquivos:** `src/domain/savings/index.ts` (+ testes) · `src/features/insights/pages/insights-page.tsx` · `src/features/insights/pages/insights-page.test.tsx` · `src/domain/insights/index.test.ts`.

**✅ DoD (critérios de aceite)**
- Desafios usam média mensal real (meses com gasto); teste cobre mês vazio, mês parcial e mês único.
- Linha "30% em não essenciais" some com 1 categoria elegível e aparece com 2+ (testes de página para ambos).
- Card de fim de semana mostra "—" sem dados de dia útil, sem alerta absurdo; razão comparável segue exibindo `X.X×` com tom semântico.
- Suíte completa 100% verde; typecheck/lint/build limpos.

**Progresso — F27 concluída (2026-08-15):**
- [x] `typicalMonthlySpendCents` em `domain/savings` (média dos meses com gasto; 0 sem base) + 4 testes
- [x] `DiscretionaryChallenge.categoryCount` (base do corte) + teste de dedup
- [x] `InsightsPage`: `spentByMonth` (4 mapas) → média real nos desafios; `showDiscretionary = categoryCount >= 2`; guarda `weekendComparable` ("—" + sem alerta + tom neutro)
- [x] Testes de página: razão comparável sem alerta; dedup da linha agregada (1 categoria); exibição com 2+ categorias; domínio: `weekendSpendingRatio` Infinity/0 documentado
- [x] Suíte completa **1075 testes / 140 arquivos** verde; typecheck/lint/build limpos

### Fase 28 — Investimentos: Mobile Responsive & Organização

**Objetivo (Trilha A / Mobile Polish):** deixar a área de investimentos (`/investments`) **responsiva e organizada como o restante do app** no mobile — o hub estava com KPIs em 1 coluna (o app usa 2×2), tabela de posição larga com scroll horizontal (8+ colunas) e linhas de metas por classe estourando a largura da tela.

**Problemas corrigidos:**
- **KPIs em 1 coluna no mobile** — `ResumoTab` usava `grid-cols-1`; o padrão do app (ex.: Home) é 2×2 no mobile → `grid-cols-2 lg:grid-cols-4` (skeleton alinhado).
- **PositionTable larga com scroll horizontal** — no mobile a tabela vira **cards empilhados** (`sm:hidden`): cada posição mostra ticker/classe, rentabilidade %, valor + lucro/prejuízo (tone semântico), linha de detalhes (qtd · preço com fonte · custo médio) e as ações (Movimentar/Lançamentos/Editar/Excluir — extraídas em `PositionRowActions` compartilhado, DRY com a tabela). A tabela completa permanece em `sm+` com a mesma ordenação (`aria-sort` intacta).
- **Linhas de metas por classe estourando a tela** — `flex` em linha com stepper fixo (`w-44`) + 2 botões não cabiam no mobile: agora empilham (nome + controles) e retomam a linha em `sm+` (`flex-col sm:flex-row`).
- **Header do Resumo sem responsividade** — descrição longa + CTA lado a lado no mobile: empilham (`flex-col sm:flex-row`), botão ocupa a largura no mobile.
- **Código morto removido (pós-F17):** `portfolio-page.tsx` + `position-tab.tsx` + `portfolio-page.test.tsx` (a unificação F17 fez `/carteira` virar redirect — as páginas antigas não eram montadas). O barrel `features/portfolio` passou a exportar as páginas vivas (`TargetsTab`/`AporteTab`) e o hub importa pelo barrel.

**Arquivos:** `src/components/modules/position-table.tsx` (+ testes) · `src/features/investments/pages/resumo-tab.tsx` · `src/features/portfolio/pages/targets-tab.tsx` · `src/features/investments/pages/investments-page.tsx` · `src/features/portfolio/index.ts` · remoção de `src/features/portfolio/pages/{portfolio-page,position-tab}.tsx` + teste.

**✅ DoD (critérios de aceite)**
- Mobile: posições legíveis sem scroll horizontal (cards), KPIs 2×2 e metas por classe sem overflow; desktop inalterado (tabela completa com ordenação).
- Mesmas ações disponíveis nos cards e na tabela (componente único `PositionRowActions`).
- Zero código morto da carteira antiga; barrel do feature consistente.
- Suíte completa 100% verde; typecheck/lint/build limpos.

**Progresso — F28 concluída (2026-08-15):**
- [x] `PositionTable` com cards mobile (`sm:hidden` + `hidden sm:block`) e `PositionRowActions` extraído (DRY) + 3 testes novos (cards com valor/lucro/rentab, ações nos cards, vazio nos cards)
- [x] `ResumoTab`: header empilhado no mobile + KPIs `grid-cols-2 lg:grid-cols-4` (skeleton alinhado)
- [x] `TargetsTab`: metas por classe empilham no mobile (`flex-col sm:flex-row`), stepper flexível
- [x] Dead code removido (`portfolio-page`/`position-tab` + teste) e barrel `features/portfolio` corrigido (hub importa `TargetsTab`/`AporteTab` pelo barrel)
- [x] Suíte completa **1073 testes / 139 arquivos** verde; typecheck/lint/build limpos

---

**F29 — Insights: Inteligência de Recorrências, Alertas & Diagnósticos unificados e Polish do Planejamento (2026-08-15):**
- [x] **Assinaturas/recorrências mais inteligentes (`domain/insights`):** nome conhecido no catálogo (ou categoria de assinatura) passou a emitir SEMPRE a ocorrência como `subscription` — a variância de preço (reajuste/troca de plano) só reduz a confiança, em vez de descartar (antes, variação > ±50% fazia a assinatura sumir do extrato); nível `recurring` agora usa tolerância ±50% relativa à **mediana** (faturas variáveis como água/luz `[80, 130, 95]` não somem); catálogo expandido (+20 serviços: globoplay, starplus, crunchyroll, deezer, alura, xbox, nordvpn, uberone…); nível `similar` também passa a usar a mediana
- [x] **Abas unificadas:** "Alertas" + "Diagnósticos" → uma única aba **"Alertas & Diagnósticos"** em primeiro lugar (alertas críticos em destaque → KPIs de diagnóstico → avisos contextuais), removendo a duplicação de leitura entre duas abas
- [x] **Polish do Planejamento (F24):** cards empilhados **uma linha cada** (`flex-col`, largura cheia) com headers consistentes (título + subtítulo), gauge do fundo de emergência em linha com os stats (Caixa/Despesa em chips `bg-muted/30`), inputs FIRE em 3 colunas no desktop e `FireProjectionChart` sem distorção (`preserveAspectRatio="none"` removido — texto dos eixos proporcional, largura limitada a 460px)
- [x] Testes: +3 no domínio (reajuste > 50% ainda é assinatura, mediana para faturas variáveis, novos serviços do catálogo) e aba unificada na página — **1087 testes / 140 arquivos** verdes; typecheck/lint/build limpos (após os hotfixes de 2026-08-16 — DatePicker responsivo e Seletor de Pesos em modais: **1093 testes / 140 arquivos**)

**Ajuste pós-F29 (2026-08-15, decisão de produto):** os botões do header (tema, privacidade, calculadora) voltaram ao atributo nativo `title` — o primitivo `Tooltip` permanece na biblioteca (`ui/tooltip.tsx`, exportado no barrel e listado em §4.1) para uso pontual quando necessário; `brand-logo` ganhou `whitespace-nowrap` + animação `fade-slide-in` no wordmark (token novo em `globals.css`) para o colapso da sidebar não quebrar linha. Testes dos botões atualizados para o `title`.

**Hotfix — DatePicker responsivo (2026-08-16, correção prioritária de layout):** o calendário estourava a largura no mobile (grade cortava sáb/dom), as setas renderizavam ao lado da grade (não no topo) e faltava limite de altura. **Causa raiz:** a CSS base do react-day-picker **não é importada** no app — com `navLayout="around"` e `.month` como `flex` em linha, a `<table>` da grade virava **item de linha do flex** ao lado das setas/caption, forçando overflow horizontal. **Correções em `src/components/ui/date-picker.tsx`:** (1) header no topo — `.month` `relative flex flex-col`, setas absolutas nas extremidades (`left-1`/`right-1 top-1`) e caption centralizado (`h-8 items-center justify-center px-12`); (2) grade 100% responsiva — `month_grid` `w-full table-fixed` (7 colunas iguais, sem overflow) e botões de dia `aspect-square w-full max-w-9` (36px, quadrados, proporcionais à coluna); (3) container — popover `w-[calc(100vw-1.5rem)] max-w-sm max-h-[85dvh] overflow-y-auto` (cabe no viewport e dentro de modais). **Validação real** (Chrome headless + CDP em 320px e 390px): zero overflow horizontal, 7 colunas iguais (36,3px em 320px), botões 36×36px, setas no topo (esq./dir.) e mês centralizado exato; foco visível no dia selecionado mantido (`ring-2` + `data-selected`). Testes do DatePicker ampliados de 4 → 8. Suíte **1091 testes / 140 arquivos** verde; typecheck/lint/build limpos.

**Hotfix — Seletor de Pesos (Select dentro de modais, 2026-08-16, interação):** no fluxo do **wizard** (tela cheia) o seletor de peso no relatório respondia normalmente, mas dentro dos **modais de edição** (despesa/receita — e no relatório, com `ReportDetailDialog` → `ExpenseDetailDialog` aninhados) o dropdown **renderizava sem responder aos cliques**. **Causa raiz:** o `Modal` do app é um **Dialog Radix modal** — ele aplica `pointer-events: none` no `<body>` e reativa apenas a camada interna do portal; o **wrapper `position: fixed` do popper** (`[data-radix-popper-content-wrapper]`) fica entre o body e a camada do Select **herdando `none` sem estilo próprio** — padrão que em navegadores/versões com hit-testing inconsistente (WebKit) deixa o dropdown "renderizado mas inerte". O Select também usava `position="item-aligned"` (posiciona pelo item selecionado — frágil dentro do bottom sheet com `transform`/`overflow`). **Correções:** (1) `src/components/ui/select.tsx` — `position="popper"` + `sideOffset={4}` + `align="start"` (config padrão shadcn para Select em dialogs: colisão de viewport, independente do item selecionado) + `min-w-[var(--radix-select-trigger-width)]` e `max-h-72 overflow-y-auto` (dropdown nunca estoura a tela); (2) `src/styles/globals.css` — regra `[data-radix-popper-content-wrapper] { pointer-events: auto }` que reativa explicitamente a camada intermediária do portal. **Validação** (Chrome headless + CDP, mouse e touch, 390px e 1280px): fluxo completo de edição — abrir detalhe sobre o modal pai → Editar → DatePicker → Select de peso → 75% → Personalizado → digitar valor — cliques reais registram (contador/trigger atualizam). Testes novos no `expense-detail-dialog.test.tsx` (preset 75% e Personalizado persistem a fração no payload). Suíte **1093 testes / 140 arquivos** verde; typecheck/lint/build limpos.

**Atualizações Otimistas em Edição/Exclusão de lançamentos (2026-08-16, F30):** editar ou excluir uma despesa/receita/pagamento deixava a lista visual desatualizada até a próxima navegação/recarga — sensação de falha e risco de edições duplicadas. **Padrão implementado** (React Query `onMutate`/`onError`/`onSettled`) em `src/state/mutations/` para `useUpdateExpense`/`useDeleteExpense`/`useUpdateIncome`/`useDeleteIncome`/`useDeleteCardPayment`:
- **Exclusão instantânea** — o item some da lista na hora (cache filtrado); modo de parcelas resolvido por motor puro novo `src/domain/expenses/` (`resolveExpenseDeleteIds` — single/all/subsequent espelhando o RPC, +7 testes).
- **Edição instantânea** — patch mesclado no cache em todas as listas (`expenses` mês/range, `card_expenses` por cartão, `incomes`) e na query singular; **modal fecha na hora** (dialogs e `cards-page` passaram a disparar a mutação e fechar imediatamente).
- **Recálculo otimista de totais** — Extrato (Receitas/Despesas/Saldo), KPIs e faturas derivam das listas em cache → recalculam instantaneamente com a edição/exclusão (incluindo estorno: a renda automática `[REFUND]{id}` sai do cache junto).
- **Rollback seguro + toast** — snapshot em `onMutate` (`snapshotQueries`/`restoreQueries` em `src/state/mutations/optimistic-cache.ts`, +5 testes), restaurado em `onError` com **toast de erro** via novo bus de toasts imperativos (`src/services/toast.ts` + `src/components/ui/toast-host.tsx`, +3 testes); sincronização silenciosa em `onSettled` (invalidação dos agregados).
- Testes de hook cobrindo o ciclo completo (otimista → sucesso / otimista → rollback + toast; modos single/all/subsequent) em `use-expense-mutations.test.tsx` (+6). Suíte **1114 testes / 143 arquivos** verde; typecheck/lint/build limpos.

**Correção — conflito do Swipe Navigation com os edge swipes nativos do sistema (2026-08-16, F20 evolução):** em dispositivos com navegação por gestos nativa (Android/iOS), o swipe interno do app competia com o edge swipe de voltar — o toque iniciado na borda física era interceptado pelo SO, impedindo a navegação interna de meses/abas. **Causa:** a engine não tinha zona de exclusão de borda — qualquer `clientX` era aceito, inclusive nas extremidades do display. **Correções:** (1) **Edge Inset** — novas funções puras em `src/domain/gestures/swipe.ts`: `EDGE_INSET_PX` (24px) e `isEdgeZoneTouch(clientX, vw, inset)`; o hook `useSwipeNavigation` (opção nova `edgeInsetPx`, default 24) **ignora toques com `clientX ≤ 24` ou `clientX ≥ innerWidth − 24`** no `onPointerDown` — o gesto de voltar do sistema permanece reservado nas extremidades, o app opera na **área central segura**; (2) **Arming com dominância 1.5** — nova função pura `isHorizontalDominant(dx, dy, ratio = 1.5)` (`|dx| > 1.5·|dy|`): o rastreio só arma se o eixo X for claramente dominante logo no início — rolagem vertical com leve desvio horizontal é descartada imediatamente (o cone ±30° continua como decisão final no `resolveSwipeIntent`); (3) **Container-scoped + `touch-action: pan-y`** — já vigentes (handlers espalhados nos containers `MonthSwiper`/`Tabs`, sem listeners em window/body; `pan-y` preserva o scroll vertical — confirmado, sem mudanças). **Testes:** +7 no domínio (`isEdgeZoneTouch` — bordas esq./dir., zona segura, inset custom, viewport não medido; `isHorizontalDominant` — razão 1.5, custom, nulo) e +5 no hook (borda esquerda/direita não navega, `edgeInsetPx=0` desativa a zona, scroll com leve drift não arma, dominância arma mas o cone final decide). Suíte **1126 testes / 143 arquivos** verde; typecheck/lint/build limpos.

---

## 4. ORDEM DE CONSTRUÇÃO DA BIBLIOTECA DE UI

**Regra absoluta:** primitivo antes do módulo, módulo antes da tela. Se uma tela precisar de algo que não existe, **pare e extraia** — não duplique.

### 4.1 Primitivos (Fase 0 e extensões) — `components/ui`
`Button → Input → MoneyInput → Select → Card → Badge → Skeleton → EmptyState → Progress → Modal/Dialog → ConfirmDialog → Tabs → DataList → Stepper → Command → Toast → Checkbox → RadioGroup → DatePicker → Slider → Accordion → Textarea → Dropzone`
(+ `VirtualList`, `NumberTicker`, `Sparkline`, `DraggableFab`, `Sheet`/Drawer, `ColorPicker`, `IconPicker` (pós-F10), `LivePulseBeacon` (F11), `Tooltip` (F25). *Nota:* `PullUpToTopIndicator` (F26) e o `ScrollToTopButton` (F9) foram removidos — o primeiro em 2026-08-16 (gesto instável) e o segundo na F26. **Regra:** nenhum elemento nativo de controle é usado cru em tela — sempre um primitivo do app, DESIGN_SYSTEM §13.)

### 4.2 Módulos de domínio (por fase) — `components/modules`
- **F0/F2:** `MoneyInput` é primitivo de UI (Fase 0); `CategoryIcon`, `MonthPicker`, `TransactionRow`, `KpiCard`, `BudgetProgressBar`, `DebtStatusBadge`, `InvoiceStatusBadge`, `InstallmentBadge`, `WizardShell`.
- **F3:** `AlertCard`, `InsightList`, `ProjectionLine`, `ReminderItem`, `ReportTable`.
- **F4:** `PositionTable`, `TargetEditor` (barra de soma), `AporteResult`.
- **F5:** `GlobalSearch` (⌘K), `HighlightRow`, `OnboardingCard`.
- **F7:** `CollapsibleSidebar`, `AdaptiveHeader`, `MobileBottomNav5Slot`.
- **F8:** `CategoryDonut`, `DailyFlowChart`, `PrivacyToggle` — `SmartSpendingPaceCard`, `SmartInvoiceProjectionCard`, `SmartAnomaliesCard` e `SavingsHealthCard` foram substituídos pelo widget `summary` (F12) e removidos na F19 (código morto).
- **F9:** `FloatingCalculator`, `CalculatorKeypad`, `ScrollToTop`.
- **F10:** `BrandLogo`, `BrandIcon`.
- **F16:** `AllocationDonut` (genérico de ativos — padrão `CategoryDonut`, SVG próprio).
- **F20:** `MonthSwiper` (envolve `MonthPicker` com swipe) — primitivo `Tabs` ganha `swipeable` (navegação por gesto em sub-abas).
- **F21:** `SmartPredictionSuggest`, `TransactionTemplateSelector`.
- **F22:** `MonthlyClosePrintView`, `ExportDataHub`, `PrintSheet`.
- **F24:** `FireProjectionChart`, `EmergencyFundGauge`.
- **F25:** `HoverExpandSidebar`, `BottomSheetShell`, `SuccessPulseFeedback`.
- **F26:** `PullUpToTopIndicator` (micro-indicador minimalista de overscroll to top) — **removido em 2026-08-16** (gesto instável em dispositivos reais; rolagem nativa mantida).

### 4.3 Telas (por fase) — `features/`
Sempre composição fina: layout (`components/layout`) + módulos (`components/modules`) + contratos (`state/`). Sem JSX duplicado entre telas — qualquer repetição vira módulo novo.

---

## 5. CRITÉRIOS DE PRONTO GLOBAIS (TODAS AS FASES)

- Typecheck estrito + lint + testes verdes no CI.
- Regra DRY de UI respeitada: zero JSX/estilos duplicados; variações via props/variants.
- Regras de negócio apenas em `domain/` (funções puras) — nada de cálculo em componente.
- Toda tela com estados loading (Skeleton) / vazio (EmptyState) / erro (gateway + retry).
- Mensagens pt-BR via gateway ou constantes — sem strings soltas.
- Revisão visual em desktop + mobile nos temas aplicáveis.
- Sem reintrodução de escopo legado (B3, conciliação pesada, parsers) — ver `AGENTS.md`.
- **Zero elementos nativos de controle** (select/checkbox/date/file/range/alert/dialog) — sempre primitivos do app (DESIGN_SYSTEM §13).

---

## 6. PRÓXIMAS FASES (PROPOSTA OFICIAL — INSERIDAS)

> **Auditoria concluída (2026-08-15):** as fases F0–F15, F19 e F20 estão implementadas e testadas. A proposta oficial com o diagnóstico completo, fases da Trilha B e novas fases de evolução está registrada neste roadmap e em `docs/NEXT_PHASES.md`.
>
> **Decisões default aplicadas:**
> - **P1 = (a)** cotações: edge function (F1.7/Yahoo) + preço manual como fonte primária — deploy/cron da F1.7 é pré-requisito da F16.
> - **P2 = (a)** gráficos: SVG próprio (padrão `CategoryDonut`) — sem libs novas.
> - **P3 = (a)** rota nova `/investments` (leitura), mantendo `/carteira` para operação — **SUPERADA (2026-08-15):** decisão do produto de **área única** — `/investments` é o hub (abas Resumo/Metas/Aporte) e `/carteira` vira redirect.
> - **P4 = (a)** proventos: apenas recebidos (escopo mínimo — sem migration).
> - **P5 = (b)** proventos ficam só na carteira (fora do fluxo financeiro core — D11 preservado).
> - **P6 = (a)** ordem: Trilha A (F14–F15, F19 e F20) antes da Trilha B (F16–F18), seguida pelas fases de inteligência, refinamento e escala (F21–F26).

### 6.1 Ordem de execução das próximas fases (status 2026-08-15)

> **F14, F15, F16, F19 e F20 concluídas (2026-08-15)** — ver progresso na seção §3. As demais fases estão **formais e priorizadas sequencialmente**:

| Ordem | Fase | Trilha | Depende de | Status |
|---|---|---|---|---|
| 1 | **F14** — Consistência de Estados & Ergonomia de Dados | A | — | ✅ Concluída (2026-08-15) |
| 2 | **F15** — Micro-Interações & Conforto Visual | A | F14 | ✅ Concluída (2026-08-15) |
| 3 | **F19** — Inteligência & Consistência dos Insights | A | F15 | ✅ Concluída (2026-08-15) |
| 4 | **F20** — Swipe Navigation & Gesture UX | A | F15/F19 | ✅ Concluída (2026-08-15) |
| 5 | **F16** — Carteira na Home (KPI real + donut de alocação) | B | F14 | ✅ Concluída (2026-08-15) — KPI de aportes com deep-link; `AllocationDonut` na Posição (decisão: sem widget na Home) |
| 6 | **F17** — Dashboard `/investments` | B | F16 · F14 | ✅ Concluída (2026-08-15) — **unificada em área única** (decisão 2026-08-15): `/carteira` virou redirect e `/investments` é o hub de abas Resumo/Metas/Aporte |
| 7 | **F18** — Proventos (extrato & calendário) | B | F17 | ✅ Concluída (2026-08-15) — motor `dividends.ts` + aba Proventos no hub `/investments` (extrato mensal + calendário anual) |
| 8 | **F21** — Inteligência de Entrada & Automações Preditivas | C (Inteligência) | F2 | ✅ Concluída (2026-08-15) — motor `domain/predictions`, autopreenchimento no wizard + habituals + repetição nos diálogos; refatorado 2026-08-16 (ranking temporal ±5–10 dias, limite 3, chips de descrição pura sem sobrescrita de valor) |
| 9 | **F22** — Central de Exportação, Backup & Fechamento Mensal | C (Dados & Relatórios) | F3 | ✅ Concluída (2026-08-15) — `domain/export` (CSV pt-BR + backup versionado Zod), hub em `/configuracoes > Dados` (JSON + CSVs por período + restauração 2 etapas via RPC `restore_backup`), Fechamento Mensal imprimível em Relatórios e Web Share nos comprovantes |
| 10 | **F23** — Engenharia de Performance & Code-Splitting 3D | C (Infra & Performance) | F7/F13 | ✅ Concluída (2026-08-15) — política de cache centralizada `state/cache-policy.ts` (estático 5 min + gcTime 30 min / analítico / cotações / transacional), pre-fetching de chunks das rotas vizinhas (`prefetchPageChunks` + `useRoutePrefetch`) e decisão: 3D CSS sem Three.js (code-splitting WebGL N/A — lazy por rota já existente) |
| 11 | **F24** — Planejamento Financeiro & Simulador FIRE | C (Estratégia) | F16/F17 | ✅ Concluída (2026-08-15) — motor puro `domain/fire` (regra 4%, projeção anual, fundo de emergência), `PlanningSection` com gauge + simulador na aba Planejamento do Insights (inputs editáveis, gráfico SVG sem libs) |
| 12 | **F25** — Micro-interações, Feedback Visual & Ergonomia | A / Refinamento | F7/F12 | ✅ Concluída (2026-08-15) — hover-expand da sidebar em overlay (delay anti-disparo), bottom sheets mobile com drag-to-close (threshold/fling/resistência), primitivo Tooltip acessível nos botões do header |
| 13 | **F26** — Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX) | A / Mobile Gesture | F7/F13/F20 | ✅ Concluída (2026-08-15) — motor puro `domain/gestures/overscroll` (resistência elástica + barreira de inércia + threshold), hook `usePullUpToTop` (FSM com cancelamento reversível, decisão por ref, sem pointer capture para coexistir com swipe-to-action), primitivo `PullUpToTopIndicator` (anel SVG `stroke-primary`), integração no PageShell e remoção do `ScrollToTopButton`/`useScrollPosition` do roteador + regra CSS de diálogos · **removida em 2026-08-16** (gesto instável em dispositivos reais mesmo após as correções; rolagem nativa mantida) |
| 14 | **F27** — Insights: Precisão, Deduplicação & Casos de Borda | A / Inteligência | F19 | ✅ Concluída (2026-08-15) — média mensal real nos desafios (`typicalMonthlySpendCents`), `categoryCount` no discricionário (linha "30% em não essenciais" oculta com 1 categoria — sem repetição) e guarda de `weekendRatio` incomparável ("—" sem alerta absurdo) |
| 15 | **F28** — Investimentos: Mobile Responsive & Organização | A / Mobile Polish | F17 | ✅ Concluída (2026-08-15) — cards de posição no mobile (sem scroll horizontal) com `PositionRowActions` compartilhado, KPIs 2×2 (padrão do app), metas por classe empilháveis e remoção do código morto pós-F17 (`portfolio-page`/`position-tab`) |
| 16 | **F30** — Importação e Reconciliação Inteligente de Faturas de Cartão | A / Cartões & Inteligência | F2/F21/F22 | 📋 Pronta para Execução |
| 17 | **F31** — Modernização de Micro-Interações "Obsidian Glass" & Feedback Tátil | A / UI & Micro-Interações | F8/F11/F15 | ✅ Concluída (2026-08-17) — morphing action buttons, checklist de aportes, alertas pulsantes de orçamento e transições suaves nos controles globais |

### Fase 31 — Modernização de Micro-Interações "Obsidian Glass" & Feedback Tátil

**Objetivo:** modernizar e enriquecer a experiência do usuário com micro-interações táteis e visuais elegantes, consistentes e respeitosas das preferências de movimento (`fluid`, `eco`, `reduced`), seguindo o padrão Obsidian Glass e os princípios DRY.

**Entregas Realizadas (2026-08-17):**
1. **Morphing Action Buttons em Assinaturas & Recorrências (`InsightList`):**
   - Unificação das ações de confirmação e ignorar com transição imediata e remoção de badges duplicados.
   - Animação física `animate-spring-pop` ao confirmar e feedback háptico imediato.
2. **Micro-interações no Módulo de Dívidas (`DebtsPage` & `SettleDialog`):**
   - Transição visual no status de quitação de dívidas com ícone `CheckCircle2` animado (`animate-spring-pop`).
   - Feedback háptico tátil (`triggerHaptic("light")`) em botões de ação e `triggerHaptic("success")` na conclusão de quitação via `SettleDialog`.
3. **Transição Contínua em Orçamentos (`BudgetProgressBar` & `Progress`):**
   - Barra de progresso com transição CSS suave de preenchimento (`transition-[width,background-color] duration-300 ease-out`).
   - Destaque semântico nítido com `text-critical` para o indicador "Excedido".
4. **Transições Suaves nos Controles Globais (`PrivacyToggle` & `MonthPicker`):**
   - Micro-rotação elástica no ícone de privacidade com disparo háptico calibrado por estado.
   - Transição deslizante suave `animate-fade-slide-in` no label do seletor mensal e feedback háptico na navegação.
5. **Checklist Interativo de Aportes (`AporteResult`):**
   - Botão de alternância de execução ("Pendente" ↔ "Feito") por ativo sugerido com feedback háptico e animação elástica.
   - Contagem dinâmica de ativos executados no KPI "Alocado em ativos" e esmaecimento suave de linhas concluídas.
   - Cobertura completa de testes unitários (`aporte-result.test.tsx`).

**✅ DoD (critérios de aceite):**
- Micro-interações respeitam os 3 níveis de movimento configurados pelo usuário (`fluid`, `eco`, `reduced`).
- Zero dependências externas de animação adicionadas (utilitários CSS centralizados e nativos).
- Feedback sensorial calibrado via `triggerHaptic` em ações táteis.
- Suíte completa de testes (143 arquivos / 1.160 testes) e build de produção 100% verdes.

### Fase 30 — Importação e Reconciliação Inteligente de Faturas de Cartão

**Objetivo (Trilha A / Cartões & Inteligência):** permitir a importação de faturas de cartão de crédito de qualquer instituição financeira (CSV com auto-encoding Latin-1/UTF-8, XLSX/XLS sob demanda, OFX SGML/XML bancário nativo ou Quick-Paste de texto copiado), processando 100% no cliente (privacidade absoluta), com reconciliação heurística contra despesas existentes, autopreenchimento preditivo de categorias e gravação transacional idempotente no Supabase.

**Organização da Implementação em 4 Etapas:**
1. **Etapa 30.1 — Motores Puros de Domínio (`src/domain/reconciliation/`):**
   - Tipos e esquemas Zod (`types.ts`).
   - Sanitização de ruído de adquirentes e extração de parcelas embutidas (`clean.ts`, `installments.ts`).
   - Geração de hash SHA-256 ordinal anti-colisão (`hash.ts`).
   - Motor de scoring multidimensional 0–100 (50% valor centesimal + 25% proximidade temporal + 25% similaridade textual Jaccard reusando `src/domain/predictions/`) em `scorer.ts`.
   - Hub de parsers resilientes: `csv-parser.ts` (`PapaParse` com fallback de encoding), `ofx-parser.ts` (SGML/XML nativo em TS), `excel-parser.ts` (import dinâmico de `exceljs`), `text-parser.ts` (Quick-Paste de texto corrido) e `type-sniffer.ts` (inferência orientada ao conteúdo).
   - Testes unitários puros com Vitest (`reconciliation.test.ts`).
2. **Etapa 30.2 — Infraestrutura de Dados & RPC Transacional:**
   - Migration `supabase/migrations/20260101000011_statement_import.sql`: colunas `statement_hash` e `imported_from_statement` na tabela `expenses` + índice condicional único `idx_expenses_user_card_statement_hash`.
   - RPC PostgreSQL `import_statement_expenses`: validação de `APP_START_DATE` (`>= 2026-01-01`), valor estritamente positivo, inserção atômica em lote com idempotência e registro em `audit_events`.
   - Wrapper em `src/data/rpc.ts` e atualização de tipos em `src/types/schema.ts`.
3. **Etapa 30.3 — Componentes de Interface & Diálogo de Reconciliação:**
   - `StatementImportDialog` em `src/features/cards/components/` com stepper de 3 passos:
     - *Passo 1 (Upload):* Tabs com `Dropzone` de arquivos e `Textarea` para Quick-Paste.
     - *Passo 2 (Mapeamento):* Prévia das 5 primeiras linhas e seletores assistidos (quando houver ambiguidade).
     - *Passo 3 (Reconciliação):* Tabela de conferência com filtros rápidos (Todos / Novos / Sugestões / Conciliados), seleção em lote, badges semânticos Obsidian Glass, `MoneyText` e seletor de categorias com sugestão preditiva.
4. **Etapa 30.4 — Integração na Tela de Cartões & Validação de Qualidade:**
   - Botão de ação primário "Importar Fatura" na `CardsPage` (`src/features/cards/pages/cards-page.tsx`).
   - Invalidação seletiva de cache no TanStack Query (`useCardExpenses`, `useCards`).
   - Testes de integração de UI e auditoria de acessibilidade (`vitest-axe`).

**Arquivos:** `src/domain/reconciliation/*` (+ testes) · `supabase/migrations/20260101000011_statement_import.sql` · `src/data/rpc.ts` · `src/types/schema.ts` · `src/features/cards/components/statement-import-dialog.tsx` · `src/features/cards/components/statement-*-step.tsx` · `src/features/cards/pages/cards-page.tsx`.

**✅ DoD (critérios de aceite):**
- Motores puros com cobertura de testes unitários para múltiplos layouts bancários (Nubank, Itaú, Bradesco, Inter, OFX SGML/XML e Quick-Paste).
- Parsing e deduplicação ocorrem 100% no cliente sem envio de extratos bancários para servidores externos.
- Idempotência verificada: reimportar o mesmo extrato resulta em 0 duplicatas no banco; compras legítimas de mesmo valor/data no mesmo dia são preservadas pelo índice ordinal.
- Parcelas embutidas (`01/10`) extraídas e despesas com status de conciliado identificadas automaticamente.
- Categorias dos novos lançamentos pré-preenchidas pelo motor preditivo de histórico (`domain/predictions`).
- Interface 100% responsiva (Desktop e Mobile), sem emojis e com auditoria axe sem violações.
- Suíte completa de testes (`npm run test`, `npm run typecheck`, `npm run lint`) 100% verde.

---

**Auditoria de limpeza de código (2026-08-15):**
- **Dead code removido:** `hooks/use-draggable.ts` (+teste) — órfão desde a remoção do FAB flutuante; `layout/placeholder-page.tsx` — página placeholder de versões antigas sem uso; `layout/density-toggle.tsx` — toggle não montado (a densidade vive em `/configuracoes` via `useDensity`); `centsToBRL` de `domain/money/parse.ts` — duplicata exata de `services/masks/money.formatCentsAsBRL` (DRY).
- **Dependências:** todas as deps de `package.json` são necessárias (as aparentemente "sem uso" são peer deps de RTL/jest-dom ou types do Node usados no `vite.config.ts`/`tsconfig`).
- **DRY — `toISODate`:** cópias locais removidas de `wizard-state.ts` e `payment-dialog.tsx`; fonte única `domain/money/parcelar.toISODate`.
- **DRY — `formatPercent`:** consolidadas 2 cópias idênticas (`delta-hint.tsx`, `overview-page.tsx`) no canônico `services/masks/percent.ts` (+teste).
- **Barrels criados:** `domain/money/index.ts`, `domain/gestures/index.ts`, `services/masks/index.ts` (padrão AGENTS.md §7) — 36+ arquivos migrados de imports profundos para `@/` (barrel).
- **Verificação:** 1135 testes / 144 arquivos · lint 0 erros · typecheck e build limpos.

**Regra do ciclo (AGENTS.md §9):** a cada fase implementada — atualizar o status acima + seção detalhada (§3) + `NEXT_PHASES.md`, rodar typecheck/lint/testes/build e commitar antes de avançar para a próxima.

