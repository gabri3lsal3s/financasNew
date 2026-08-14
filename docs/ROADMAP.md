# 🗺️ ROADMAP.md — Roadmap Executável de Desenvolvimento

> **Status:** v1.1 — **plano de execução canônico** do projeto (o `ESPECIFICACAO_TECNICA.md` §6 o referencia como resumo executivo). Foco em **ordem de execução**, **ordem de construção da UI (Design System primeiro)** e **Definition of Done (DoD)** por fase.
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
| **F1** | Infraestrutura de Dados & Auth | Schema, RLS, audit_events, **RPCs transacionais**, contratos de estado, cotações, R2 | Auth |
| **F2** | Core de Finanças Pessoais | Domínio puro + CRUDs (receitas/despesas/cartões/dívidas/orçamentos) | Telas CRUD + wizard |
| **F3** | Análise, Projeção & Corte | Motor de insights, projeção, relatórios, lembretes | Telas de análise |
| **F4** | Carteira & Rebalanceamento | Ledger, valoração, metas, calculadora de aporte | Telas de carteira |
| **F5** | Experiência Transversal | Busca global, acessibilidade, temas, performance | Busca, polish |
| **F6** | Hardening & Lançamento | Prova de fidelidade, segurança, deploy | — |

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
- [ ] Revisão visual no browser (desktop/mobile/3 temas) — pendente

**Progresso — ciclo de implementação 2 (2026-08-13):**
- [x] Primitivos interativos com Radix UI (base do shadcn, já declarada na arquitetura): Select, Checkbox, RadioGroup, Modal, ConfirmDialog, Tabs, Toast, Slider, Accordion, DatePicker (react-day-picker v10 com `getDefaultClassNames` + tokens), Command (⌘K via cmdk)
- [x] Primitivos próprios sem dependência: Textarea, Stepper, DataList (tabela com densidades), Dropzone (input file encapsulado, drag & drop)
- [x] Polyfills de teste (PointerEvent, ResizeObserver, hasPointerCapture) + 18 novos testes de interação (abrir/selecionar/toggle/confirmar) — suíte total 32/32
- [x] Animações dos primitivos registradas nos tokens (`animate-accordion-up/down`, `animate-toast-in/out`)
- [x] `Toaster` montado no shell (`app/providers.tsx`) — infra de feedback pronta para as fases de dados
- [ ] Revisão visual no browser (desktop/mobile/3 temas) — pendente
- [x] Integrar `Command` (⌘K) global no shell com atalho de teclado (com as rotas reais — entregue na F5.1)

---

### Fase 1 — Infraestrutura de Dados & Autenticação

**Objetivo:** alicerce Online First — dados seguros, atômicos e auditáveis.

**Entregas (na ordem):**
1. Projeto Supabase + cliente único (`data/client.ts`) + módulo de env; estado de conexão/erro explícito. **`.env.example` documentado** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, proxy de cotações, R2).
2. Auth: login, registro, recuperação de senha, sessão, perfil (`profiles` via trigger) + telas de auth (usando primitivos da F0).
3. **Schema completo** (ESPECIFICAÇÃO §2) com migrations versionadas: constraints (parcelas 1–60, card no crédito, pesos 0–1, soma de metas ≤ 100% via trigger) e índices.
4. **RLS** por `auth.uid()` em todas as tabelas; `audit_events` imutável (insert + select, sem update/delete).
5. **RPCs transacionais (D1):** `create_expense_with_debt`, `create_refund`, `delete_expense_installments`, `pay_debt`, `receive_debt`, `settle_integrated_receivable`, `delete_category_migrate`, `set_budget_limit`, `set_income_goal`, `recalculate_bill_competences` + wrappers tipados (`data/rpc.ts`). **Recebem parcelas calculadas no cliente (`domain/money`) e validam invariantes no servidor** (soma = total, 1–60, datas ≥ APP_START_DATE).
6. Gateway de erros (`services/errors`) + **contratos de estado** (`state/`) para os domínios-base.
7. Cotações: tabela `asset_prices` + edge function de atualização (cache em servidor) + fallback + suporte a **preço manual**.
8. **Storage (D11):** abstração `services/storage` + endpoint de presigned URLs (Cloudflare R2).

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
- [ ] Cotações: edge function + cache `asset_prices` (exige deploy/config — F1.7)
- [ ] Storage R2: `services/storage` + endpoint de presigned URLs (F1.8)
- [ ] **Testes contra banco real (Supabase local)** — pgTAP/vitest + Postgres: isolamento RLS e rollback de RPCs (DoD; exige ambiente local)
- [ ] Configurar `.env.local` com credenciais reais do projeto Supabase para validar o fluxo de auth de ponta a ponta

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
1. **Prova de fidelidade:** suíte completa espelhando cada regra do ESPECIFICAÇÃO (regressão contra o app anterior).
2. Segurança: revisão final de RLS, rate limit, secrets/ambiente.
3. Observabilidade: logging de erros (**decisão aberta** — sugestão: Sentry) + métricas básicas.
4. Deploy: **hosting do frontend = Vercel** (`vercel.json` com SPA rewrites, headers de segurança e cache PWA) + backend/banco = **Supabase** (Postgres + RLS + Auth + migrations em `supabase/`); pendente CI/CD de produção e env seguros (Supabase, proxy de cotações, R2).
5. QA final multi-dispositivo + documento de release.

**✅ DoD**
- Suíte de fidelidade 100% verde.
- Revisão RLS auditada (nenhuma leitura cross-user).
- Deploy de produção funcional com variáveis protegidas.
- Checklist de QA aprovado em desktop + mobile nos 3 temas.

---

## 4. ORDEM DE CONSTRUÇÃO DA BIBLIOTECA DE UI

**Regra absoluta:** primitivo antes do módulo, módulo antes da tela. Se uma tela precisar de algo que não existe, **pare e extraia** — não duplique.

### 4.1 Primitivos (Fase 0) — `components/ui`
`Button → Input → MoneyInput → Select → Card → Badge → Skeleton → EmptyState → Progress → Modal/Dialog → ConfirmDialog → Tabs → DataList → Stepper → Command → Toast → Checkbox → RadioGroup → DatePicker → Slider → Accordion → Textarea → Dropzone`
(+ Sheet para mobile. **Regra:** nenhum elemento nativo de controle é usado cru em tela — sempre um primitivo do app, DESIGN_SYSTEM §13.)

### 4.2 Módulos de domínio (por fase) — `components/modules`
- **F0/F2:** `MoneyInput` é primitivo de UI (Fase 0); `CategoryIcon`, `MonthPicker`, `TransactionRow`, `KpiCard`, `BudgetProgressBar`, `DebtStatusBadge`, `InvoiceStatusBadge`, `InstallmentBadge`, `WizardShell`.
- **F3:** `AlertCard`, `InsightList`, `ProjectionLine`, `ReminderItem`, `ReportTable`.
- **F4:** `PositionTable`, `TargetEditor` (barra de soma), `AporteResult`.
- **F5:** `GlobalSearch` (⌘K), `HighlightRow`, `OnboardingCard`, `VirtualList` (primitivo, `components/ui`).

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
