# 🏛️ ARCHITECTURE.md — Arquitetura de Software

> **Status:** v1.0 — consolida as decisões das Etapas 1 e 2 (D1–D12) e define a estrutura técnica do código.
> **Docs de referência:** [`RECONSTRUCAO.md`](../RECONSTRUCAO.md) (fonte histórica) · [`ESPECIFICACAO_TECNICA.md`](../ESPECIFICACAO_TECNICA.md) (spec executável — regras de negócio, schema, UI/UX).

---

## 1. VISÃO GERAL E STACK

Aplicação **100% Online First** de gestão financeira pessoal + motor simplificado de rebalanceamento de carteira. A nuvem é a única fonte da verdade: sem sincronização offline complexa, sem filas de persistência local.

| Camada | Stack | Papel |
|---|---|---|
| Frontend | React 18+ (Vite) · TypeScript estrito · Tailwind CSS · shadcn/ui | UI 100% componentizada, desacoplada da lógica |
| Estado | TanStack Query (server state) + hooks/contexto | Contratos `data \| loading \| error \| CRUD \| refresh` |
| Dados | Supabase (Postgres + RLS + Auth) | Fonte única da verdade; RPCs transacionais |
| Integração externa | Yahoo Finance (via proxy/cache em servidor) | Cotações para valoração da carteira |
| PWA | vite-plugin-pwa (manifest + service worker) | App Shell com carregamento instantâneo; dados seguem Online First — SW nunca cacheia dados (ver `PWA_GUIDELINES.md`) |

---

## 2. PRINCÍPIOS ARQUITETURAIS

1. **Online First** — toda mutação é síncrona com a nuvem; erros explícitos com retry manual; sem cache local de dados de negócio.
2. **Integridade no servidor** — operações compostas são **RPCs transacionais** (D1): o cliente nunca orquestra multi-escrita.
3. **Desacoplamento UI × domínio** — motores de cálculo são **funções puras** sem import de UI/Supabase; qualquer interface pode consumi-los.
4. **DRY estrito para UI** — todo elemento reutilizado em 2+ lugares é extraído para `/components/ui` (primitivo) ou `/components/modules` (domínio). Variações via props/variants; proibida duplicação de JSX/estilos entre telas.
5. **Resiliência por contrato** — validação nas bordas (zod), gateway central de erros, estados de loading/erro/vazio explícitos.
6. **Escopo disciplinado** — nada de motores legados (B3, conciliação pesada, parsers); regras de negócio só mudam com instrução explícita.

---

## 3. CAMADAS E FLUXO DE DADOS

```
┌─────────────────────────────────────────────────────────────┐
│  UI  — features/ (telas) + components/modules + layout      │
│        consome contratos de estado, funções puras de        │
│        domain/ e serviços de apresentação. NUNCA chama      │
│        Supabase diretamente.                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ data | loading | error | CRUD | refresh
┌───────────────────────────▼─────────────────────────────────┐
│  STATE  — state/queries (TanStack Query) + state/mutations  │
│           orquestra dados + invalidação; derivados usam     │
│           os motores puros de domain/                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ chamadas tipadas
┌───────────────────────────▼─────────────────────────────────┐
│  DATA  — data/repositories (leitura) + data/rpc (escritas   │
│          transacionais) + data/client (cliente único)       │
│           valida payloads com zod (borda)                   │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
┌───────────────▼───────────────┐
│  Supabase (Postgres + RLS)    │
│  + funções RPC transacionais  │
└───────────────────────────────┘

  DOMAIN (motores puros, sem deps)  ← usado por state (derivados),
  money · competence · debts ·        data (validação) e testes.
  insights · projection · search ·    Nunca importa React/Supabase.
  portfolio
```

**Regras de dependência (enforced by convention):**

- `features/*` → importam `state/`, `domain/` (derivações locais de exibição — funções puras), `services/`, `components/`, `lib/`, `types/`. **Nunca** `data/` diretamente (só via `state/`).
- `components/*` → importam `services/` (formatação), `components/`, `lib/`, `types/`. **Nunca** `data/` nem `state/` (módulos recebem props e não tocam dados).
- `state/` → importa `data/`, `domain/` (derivados), `types/`.
- `data/` → importa `domain/` (validação), `types/`, `services/errors`.
- `domain/` → **nenhuma dependência** além de `lib/` (constantes) e `types/`.
- `services/` → apresentação (formatação) e integrações (erros); não conhece o domínio financeiro.

---

## 4. ESTRUTURA DE DIRETÓRIOS

```
/
├── AGENTS.md                      # Regras de governança do agente de IA (ler SEMPRE)
├── RECONSTRUCAO.md                # Spec funcional original (fonte histórica)
├── ESPECIFICACAO_TECNICA.md       # Spec executável: regras de negócio, schema, UI/UX
├── docs/                          # UPPER_SNAKE_CASE.md (ver PROJECT_STRUCTURE.md §7)
│   ├── ARCHITECTURE.md            # Camadas, dependências, convenções
│   ├── DESIGN_SYSTEM.md           # Identidade visual e design tokens
│   ├── PROJECT_STRUCTURE.md       # Árvore de pastas e onde criar arquivos
│   ├── PWA_GUIDELINES.md          # Requisitos PWA (manifest, SW, instalação)
│   └── ROADMAP.md                 # Roadmap executável com DoD por fase
├── public/                        # Assets estáticos (servidos na raiz)
│   └── pwa/                       # manifest, ícones, screenshots, offline.html (PWA)
└── src/
    ├── main.tsx                   # Entry point (ReactDOM + registerPWA)
    ├── app/                       # Bootstrap: providers, router, rotas, layout raiz
    │   ├── providers.tsx          # AuthProvider, QueryClientProvider, ThemeProvider
    │   ├── router.tsx
    │   ├── routes.ts              # Mapa de rotas + deep-links (?card=, ?month=, ?q=)
    │   └── pwa.ts                 # Registro SW (autoUpdate) + stores de instalação/atualização (F5.6)
    │
    ├── components/
    │   ├── ui/                    # ⭐ PRIMITIVOS GENÉRICOS (sem domínio)
    │   │   ├── button.tsx         #   Button, Input, Select, Card, Badge, Modal,
    │   │   ├── index.ts           #   Tabs, Sheet, Dialog, Skeleton, EmptyState,
    │   │   └── …                  #   DataList, Progress, Stepper, Command (⌘K), Toast
    │   ├── modules/               # ⭐ COMPONENTES DE DOMÍNIO (reutilizáveis)
    │   │   ├── kpi-card.tsx       #   KpiCard, TransactionRow, BudgetProgressBar,
    │   │   ├── index.ts           #   DebtStatusBadge, InvoiceStatusBadge, CategoryIcon,
    │   │   └── …                  #   InstallmentBadge, MonthPicker, …
    │   └── layout/                # Sidebar, BottomNav, AppHeader, PageShell
    │
    ├── features/                  # ÁREAS/PÁGINAS (composição fina de módulos + contratos)
    │   ├── overview/              #   Visão Geral (KPIs, fluxo diário)
    │   ├── transactions/          #   Transações (lista mês, wizard de lançamento)
    │   ├── cards/                 #   Cartões (faturas, pagamentos, estornos)
    │   ├── debts/                 #   Dívidas (status, quitação integrada)
    │   ├── budgets/               #   Orçamentos (limites, realocação)
    │   ├── reports/               #   Relatórios
    │   ├── insights/              #   Insights, projeção e corte
    │   ├── reminders/             #   Lembretes (central de notificações)
    │   ├── settings/              #   Configurações (preferências, perfil)
    │   └── portfolio/             #   Carteira, metas, calculadora de aporte
    │
    ├── domain/                    # ⭐ MOTORES DE CÁLCULO PUROS (testáveis, sem deps)
    │   ├── money/                 #   parcelamento em centavos, arredondamento, parsing
    │   ├── competence/            #   resolveBillCompetence, clampDay, overrides
    │   ├── debts/                 #   status derivado (overdue/due_today/due_soon/…)
    │   ├── insights/              #   alertas, assinaturas, recorrências, confiança
    │   ├── projection/            #   gasto disponível, ritmo, fim de mês, pendências
    │   ├── search/                #   busca global: normalização, scoring, bônus de recência
    │   └── portfolio/             #   ledger, custo médio, valoração, rebalanceamento
    │
    ├── data/                      # SERVIÇOS DE DADOS
    │   ├── client.ts              #   Cliente Supabase único (env centralizado)
    │   ├── repositories/          #   expenses.ts, incomes.ts, cards.ts, debts.ts,
    │   │                          #   budgets.ts, portfolio.ts, categories.ts
    │   └── rpc.ts                 #   Wrappers tipados dos RPCs transacionais (D1)
    │
    ├── state/                     # CONTRATOS DE ESTADO
    │   ├── queries/               #   useExpenses({month}), useInvoices(cardId), …
    │   └── mutations.ts           #   useCreateExpense(), useDeleteInstallment(), …
    │
    ├── hooks/                     # Hooks de UI reaproveitáveis (useDebounce, useMedia, …)
    ├── services/                  # Apresentação + integrações
    │   ├── format/                #   moeda, datas, percentuais (pt-BR)
    │   ├── masks/                 #   máscaras de input monetário/datas
    │   └── errors.ts              #   Gateway getErrorMessage (pt-BR)
    ├── lib/                       # utils, constantes (APP_START_DATE, faixas, limites)
    ├── types/                     # Contratos de domínio TS (Receita, Despesa, Cartão, …)
    ├── styles/                    # tokens (light/dark/oled), globals
    └── tests/                     # helpers, fixtures, setup do Vitest
```

### Onde cada coisa mora (tabela de decisão)

| Se é… | Vai para… | Exemplo |
|---|---|---|
| Primitivo genérico sem domínio | `components/ui/` | `Button`, `Modal`, `Badge`, `MoneyInput` |
| Elemento de domínio reutilizado em 2+ telas | `components/modules/` | `TransactionRow`, `BudgetProgressBar`, `InvoiceStatusBadge` |
| Estrutura de página (sidebar/tabs/header) | `components/layout/` | `Sidebar`, `BottomNav`, `PageShell` |
| Tela/área do app | `features/<area>/` | `features/transactions/` |
| Cálculo/regra de negócio pura | `domain/` | `parcelar(valor, n)`, `resolveBillCompetence(...)` |
| Chamada a Supabase/RPC | `data/` | `repositories/expenses.ts`, `rpc.ts` |
| Hook que expõe dados à UI | `state/` | `useExpenses({ month })` |
| Formatação/máscara/apresentação | `services/` | `formatBRL()`, `moneyMask()` |
| Constante global do domínio | `lib/` | `APP_START_DATE`, faixas de atenção 85/90/95 |

---

## 5. ESTRATÉGIA DE ESTADO, CACHE E API

### 5.1 Estado de servidor — TanStack Query

- **Queries por domínio** com chaves estáveis e parametrizadas: `['expenses', { month }]`, `['invoices', { cardId, month }]`, `['portfolio', 'position']`.
- **Derivados nunca são cacheados como estado**: KPIs, séries e insights são funções puras de `domain/` aplicadas sobre a query base (fonte única).
- **Cotações (dados lentos)**: `staleTime` alto + *stale-while-revalidate*; a UI sempre lê do cache servidor (`asset_prices`), nunca da API externa em tempo de request.
- **Invalidação dirigida após mutações** (ex.: criar despesa invalida `['expenses']`, `['budgets']`, `['overview']`).
- **Política de retry (Online First):** leituras com retry automático **limitado** (2 tentativas com backoff curto) + `staleTime` por domínio; **mutações nunca têm retry automático** — estado `isPending` desabilita o botão e previne dupla submissão; falha de rede exige ação explícita do usuário ("Tentar novamente").

### 5.2 Escritas — RPCs transacionais (D1)

- **Toda escrita composta** (despesa+cobrança, estorno→renda, exclusão em cascata, quitação integrada, recálculo de competência) via `data/rpc.ts` → função Postgres transacional. O cliente recebe `{ ok, data } | { ok: false, error }`.
- **Escritas simples** (1 registro, sem cascata) podem usar CRUD direto, ainda assim com validação nas bordas.
- **Optimistic updates** apenas para operações simples e de baixo risco; rollback automático em erro. Nunca para RPCs compostos.
- **Geração de parcelas:** o cliente calcula via `domain/money` (TS, testável) e envia as linhas; o RPC **valida invariantes no servidor** (soma = valor original, parcelas 1–60, datas ≥ APP_START_DATE) e persiste — sem duplicar a lógica de divisão em SQL.

### 5.3 Estado de UI e autenticação

- **Sessão:** contexto do Supabase Auth (AuthProvider).
- **Tema e preferências:** contexto local + persistência em `user_preferences` (não passa por TanStack Query).
- **Estado de tela** (wizard, modais, filtros): hooks locais de `features/`. **Sem** store global de dados de negócio — dados de negócio vivem no servidor, nunca em memória de cliente.
- **Sessão expirada (401):** redirect para login **preservando a rota pretendida** (retorno pós-login); mensagem via gateway.

### 5.4 Storage de arquivos (~~D11~~ — REMOVIDO DO ESCOPO)

> **Decisão do usuário (2026-08-15):** storage de arquivos (Cloudflare R2) foi **removido do escopo** — nenhuma tela usa upload e anexos não participam dos cálculos financeiros. O primitivo `Dropzone` (`components/ui`) permanece disponível caso a feature seja retomada.

---

## 6. MOTORES DE CÁLCULO (DOMAIN)

- **Funções puras**, sem efeitos colaterais, sem import de React/Supabase; dependência apenas de `lib/` e `types/`.
- **Moeda em centavos (inteiro)** dentro dos motores — divisão exata de parcelas sem erro de ponto flutuante; conversão para `numeric(12,2)` na borda (data/UI).
- **Testes obrigatórios** (Vitest, colocalizados `*.test.ts`): parcelamento, competência, status derivado, projeções, insights, ledger e rebalanceamento.
- Assinatura típica: `f(entradaTipada) → saídaTipada`, sem estado global.
- **Cálculo no cliente, validação no servidor:** derivados gerados em TS (ex.: parcelas) são enviados prontos ao RPC, que valida invariantes (constraints/checks) antes de persistir — a lógica de cálculo não é duplicada em SQL.

---

## 7. SERVIÇOS DE APRESENTAÇÃO E INTEGRAÇÕES

- `services/format`: moeda (`Intl.NumberFormat` pt-BR), datas (timezone local — nunca `toISOString` em ranges de mês), percentuais.
- `services/masks`: máscaras de input monetário (`inputMode=numeric`), datas.
- `services/errors`: **gateway único** `getErrorMessage` com mensagens pt-BR; casos especiais: rate limit, e-mail não confirmado, sessão expirada, rede indisponível.
- Cotações: **edge function `supabase/functions/quotes/`** (F1.7, Deno — fetch Yahoo em cascata + upsert do cache global `asset_prices` com `source 'api'`; motor puro testado em `_shared/quotes-core.ts`) + fallback estático + **preço manual** (D5) + guardrail de spike > 50%/dia. A UI nunca chama a API externa — sempre lê o cache do servidor.

---

## 8. CONVENÇÕES DE CÓDIGO

| Tema | Convenção |
|---|---|
| TypeScript | **Estrito**; `noUncheckedIndexedAccess`; sem `any` (usar `unknown` + narrowing) |
| Naming | Arquivos kebab-case; componentes PascalCase; hooks `useX`; funções puras camelCase; RPCs snake_case (Postgres) |
| Exports | Barrel `index.ts` por pasta; exports nomeados (sem default) |
| Tipos | Contratos de domínio em `src/types`; payloads de borda validados com **zod** |
| Testes | Colocalizados (`*.test.ts`); Vitest + Testing Library; domínio testado sem renderizar |
| Imports | Alias `@/` para `src/`; ordem: React → libs → `@/` |
| Estados de UI | Toda tela com `Skeleton` (loading) · `EmptyState` (vazio) · erro via gateway (retry manual) |
| Mensagens | pt-BR, via gateway ou constantes de `lib/` — nunca strings soltas duplicadas |
| Validação | **Nas bordas**: entrada de API (zod), formulários (zod), e reforço no servidor (constraints/checks) |

---

## 9. COMPONENTIZAÇÃO DRY (REGRAS DE OURO)

1. **Extrair cedo:** elemento usado em 2+ telas **deve** virar componente (primitivo ou módulo). Proibido copiar JSX/estilos entre arquivos.
2. **Variações via props/variants:** use `cva`/variants (shadcn) para variantes visuais; props booleanas só para variações semânticas simples.
3. **Componente derivado explícito:** se uma tela precisa de comportamento substancialmente diferente, crie um componente derivado/composto em `modules/` ou `features/` — **nunca** condicionais complexas dentro do componente base.
4. **Módulos não tocam dados:** `components/modules` recebem props tipadas e formatam via `services/`; nunca fazem fetch nem importam `data/`.
5. **Propagação global:** alterações em um primitivo/módulo refletem em todas as telas por construção — é o payoff da regra 1.
6. **Layout fora do conteúdo:** `components/layout` é o único lugar com estrutura de página (sidebar/tabs/header).

---

## 10. MAPA DE DECISÕES (REFERÊNCIA)

| Decisão | Onde está implementada |
|---|---|
| D1 — RPCs transacionais | `data/rpc.ts` + funções Postgres (catálogo no ESPECIFICAÇÃO §1.3) |
| D2 — Hard delete + audit_events | `data/repositories` + tabela `audit_events` (imutável) |
| D3 — Competência snapshot + recálculo | `domain/competence` + RPC `recalculate_bill_competences` |
| D4 — Multiusuário isolado | RLS `auth.uid()` em todas as tabelas |
| D5 — Cotações resilientes | `data/repositories/portfolio` + tabela `asset_prices` + cache/fallback/preço manual (§1.6) |
| D6 — React (Vite) + Tailwind + shadcn | `src/` inteiro |
| D7 — Filosofia fintech | tokens em `src/styles`, `components/ui` |
| D8 — Sidebar + bottom tabs | `components/layout` |
| D9 — Temas light/dark/oled | `src/styles` (tokens) + ThemeProvider |
| D10 — Wizard guiado | `features/transactions/wizard` |
| ~~D11~~ — ~~Cloudflare R2~~ | ~~`services/storage` + endpoint de presigned URLs~~ — **REMOVIDO DO ESCOPO** (decisão do usuário, 2026-08-15) |
| D12 — Parcelamento | Cliente calcula (`domain/money`) + servidor valida invariantes | Lógica única em TS; SQL só valida |

---

## 11. DECISÕES EM ABERTO E RESOLVIDAS

- ~~Cor primária e identidade da marca~~ — **RESOLVIDA** em `docs/DESIGN_SYSTEM.md` (tokens em `src/styles/tokens.css`).
- ~~Hosting do frontend~~ — **RESOLVIDA**: **Vercel** (`vercel.json` configurado com SPA rewrites, headers de segurança e cache PWA).
- ~~Backend e banco de dados~~ — **RESOLVIDA**: **Supabase** (Postgres 17 + RLS + Auth + Migrations versionadas em `supabase/migrations/`).
- ~~Notificações~~ — **RESOLVIDA**: in-app centralizado (`/lembretes`).
- ~~Observabilidade/erros~~ — **RESOLVIDA**: **Sentry** (F6.3) — SDK `@sentry/react` com **dynamic import** env-gated por `VITE_SENTRY_DSN` (no-op sem DSN; Web Vitals LCP/INP/CLS via `browserTracingIntegration`; `reportError`/`setObservabilityUser` em `services/observability`).
