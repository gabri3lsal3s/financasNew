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
- [ ] Integrar `Command` (⌘K) global no shell com atalho de teclado (com as rotas reais, F1+)

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
3. Projeção (`domain/projection`): gasto disponível diário, ritmo de gastos (8º dia / ≥30%), fim de mês (dia ≥ 3), projeção de pendências.
4. Relatórios: dia/mês/ano, custom (≤ 366 dias), agregação por categoria/forma/dia da semana, comparativo, merge de dívidas pagas.
5. Central de lembretes: consolidação faturas/dívidas, marcar lido, snooze com expiração. **Decisão aberta:** push ou in-app.
6. **Telas:** Insights, Projeção e Corte, Relatórios, Lembretes (novos módulos de domínio quando necessário — ex.: `AlertCard`, `ProjectionLine`).

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


### Fase 4 — Carteira & Rebalanceamento

**Objetivo:** posição confiável + calculadora de aporte.

**Entregas (na ordem):**
1. **Ledger** (`domain/portfolio`): custo médio, caixa derivado, splits/proventos — testes de reconciliação.
2. Valoração: cache + fallback + **preço manual** (override marcado na UI) + guardrail de spike.
3. Metas por ativo/classe/setor com soma ≤ 100% (UI + banco) e travas setoriais.
4. **Calculadora de aporte**: `simulateSmartAporte` / `simulateRebalanceAporte` (2 modos) com log de roteamento.
5. **Telas:** Carteira (posição), Metas (edição em lote com barra de soma), Calculadora de aporte.

**✅ DoD**
- Ledger reconciliado com exemplos manuais (compras/vendas/custo médio/splits).
- Soma de metas > 100% bloqueada na UI e no banco.
- Simulação nunca aloca além do aporte informado; sobra vai para caixa.
- Preço manual prevalece sobre API/fallback e é exibido como "informado manualmente".

---

### Fase 5 — Experiência Transversal

**Objetivo:** polish, acessibilidade e busca.

**Entregas (na ordem):**
1. **Busca global** (⌘K): normalização, scoring, recência, limites por tipo, deep-link com destaque.
2. Tema OLED refinado (contraste/estados) + microinterações.
3. Auditoria de acessibilidade (axe, contraste AA, foco, teclado) em todas as telas.
4. Empty states completos + onboarding de primeiro uso.
5. Performance: bundle splitting, virtualização de listas, revisão de queries (N+1).
6. **PWA polish:** prompt de instalação (`beforeinstallprompt`), atualização automática com toast, splash/iOS, auditoria Lighthouse PWA.

**✅ DoD**
- Busca retorna tipos ordenados por score com destaque funcional (scroll + highlight).
- Auditoria a11y sem erros críticos; Lighthouse ≥ 90 (mobile).
- Navegação 100% por teclado nas telas P0.

---

### Fase 6 — Hardening & Lançamento

**Objetivo:** confiança, segurança e produção.

**Entregas (na ordem):**
1. **Prova de fidelidade:** suíte completa espelhando cada regra do ESPECIFICAÇÃO (regressão contra o app anterior).
2. Segurança: revisão final de RLS, rate limit, secrets/ambiente.
3. Observabilidade: logging de erros (**decisão aberta** — sugestão: Sentry) + métricas básicas.
4. Deploy: **hosting do frontend (decisão aberta** — sugestão: Vercel) + CI/CD de produção; env seguros (Supabase, proxy de cotações, R2).
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
