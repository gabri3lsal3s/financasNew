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
| PWA | vite-plugin-pwa (manifest + service worker) | App Shell com carregamento instantâneo; universal para iOS e web móvel |
| Android Nativo (Pro) | Capacitor 8+ · Java/Gradle · Keystore RSA 2048 | Automação em tempo real (Leitor Bancário), Biometria física e In-App Updater (ver `NATIVE_DISTRIBUTION_GUIDE.md`) |

---

### 1.1 O Tripé de Plataformas Áxis
O Áxis opera em um ecossistema unificado composto por três pilares sob a mesma conta:
1. **Web Desktop:** Experiência panorâmica com relatórios executivos, FIRE e conciliação bancária;
2. **Mobile PWA:** Acesso leve e instantâneo no iPhone (iOS Safari) e Android sem ocupar armazenamento;
3. **Android App Pro:** Aplicativo nativo com escuta passiva de notificações bancárias (Pix e compras em tempo real) e atualizações automáticas in-place sem desinstalação.

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
- `domain/` → **nenhuma dependência** além de `lib/` (constantes) e `types/`. Fórmulas e invariantes seguem estritamente `docs/FINANCIAL_MATH_SPEC.md`.
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
│   ├── FINANCIAL_MATH_SPEC.md     # Especificação canônica de engenharia e precisão matemática
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
    │   │   ├── button.tsx         #   Button, Input, MoneyInput, Select, Card, Badge, Modal,
    │   │   ├── index.ts           #   Tabs, Sheet, Dialog, Skeleton, EmptyState,
    │   │   └── …                  #   DataList, Progress, Stepper, Command (⌘K), Toast
    │   ├── modules/               # ⭐ COMPONENTES DE DOMÍNIO (reutilizáveis)
    │   │   ├── kpi-card.tsx       #   KpiCard, CashKpiCard, TransactionRow, BudgetProgressBar,
    │   │   ├── index.ts           #   DebtStatusBadge, InvoiceStatusBadge, CategoryIcon,
    │   │   └── …                  #   InstallmentBadge, MonthPicker, PositionTable, …
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
    │   ├── investments/           #   Investimentos (Hub 5 abas: Resumo, Proventos, Metas, Aporte, Relatórios & IR)
    │   └── landing/               #   Landing page pública e simulador FIRE
    │
    ├── domain/                    # ⭐ MOTORES DE CÁLCULO PUROS (testáveis, sem deps)
    │   ├── money/                 #   parcelamento em centavos, arredondamento, parsing
    │   ├── competence/            #   resolveBillCompetence, clampDay, overrides
    │   ├── debts/                 #   status derivado (overdue/due_today/due_soon/…)
    │   ├── recurrences/           #   F32: ocorrências por frequência (cliente calcula,
    │   │                          #     RPC valida) + modos de exclusão em grupo
    │   ├── cards/                 #   saldo de fatura, status da fatura
    │   ├── budgets/               #   regras por categoria, status/limites
    │   ├── overview/              #   computeOverview (KPIs), percentChange, buildDailyFlow
    │   ├── reports/               #   peso de relatório (weightedCents), detailed-close, Balanço Patrimonial 360° e DRE Pessoal
    │   ├── insights/              #   alertas, assinaturas, recorrências, confiança
    │   ├── savings/               #   F27: desafios de economia (média típica, corte discricionário)
    │   ├── reminders/             #   agregação de lembretes (conta/dívida) e preferências
    │   ├── accessibility/         #   F15: contraste AA (relativeLuminance/contrastRatio)
    │   ├── projection/            #   gasto disponível, ritmo, fim de mês, pendências
    │   ├── search/                #   busca global: normalização, scoring, bônus de recência
    │   ├── gestures/              #   F20: swipe (axis-lock, thresholds); overscroll removido (F26, 2026-08-16)
    │   ├── export/                #   F22: CSV pt-BR + backup versionado com Zod
    │   ├── charges/               #   agregação de natureza (juros, multas, impostos, taxas)
    │   ├── loans/                 #   sistemas de amortização (Price/SAC), saldo devedor e valor presente
    │   ├── cards/                 #   faturas, fechamento e refinanciamento sem double-counting
    │   ├── fire/                  #   F24: regra dos 4%, projeção e faixas de emergência
    │   └── portfolio/             #   ledger, custo médio, valoração, rebalanceamento,
    │                              #   proventos/YoC (snowball), apuração fiscal/DARF/IRPF (tax),
    │                              #   formatação de taxas de renda fixa (formatFixedIncomeRateLabel)
    │
    ├── data/                      # SERVIÇOS DE DADOS
    │   ├── client.ts              #   Cliente Supabase único (env centralizado)
    │   ├── query.ts               #   QueryResult<T> — contrato base data|error
    │   ├── auth.ts                #   Operações de autenticação
    │   ├── session.ts             #   currentUserId() — usuário autenticado (RLS)
    │   ├── repositories/          #   expenses.ts, incomes.ts, cards.ts, debts.ts, loans.ts,
    │   │                          #   budgets.ts, portfolio.ts, categories.ts,
    │   │                          #   recurrences.ts (F32: templates + materialização lazy)
    │   └── rpc.ts                 #   Wrappers tipados dos RPCs transacionais (D1)
    │
    ├── state/                     # CONTRATOS DE ESTADO
    │   ├── queries/               #   useExpenses({month}), useInvoices(cardId), …
    │   └── mutations/             #   useCreateExpense(), useDeleteInstallment(), …
    │
    ├── hooks/                     # Hooks de UI reaproveitáveis (useDebounce, useMedia, …)
    ├── services/                  # Apresentação + integrações
    │   ├── masks/                 #   máscaras de apresentação (moeda/percentual pt-BR)
    │   ├── errors/                #   Gateway getErrorMessage (classifyError + pt-BR)
    │   └── *.ts                   #   haptics, audio-fx, export-actions, observability…
    ├── lib/                       # utils genéricos (date, labels, env, cn)
    ├── types/                     # Contratos de domínio TS (schema.ts + database.ts)
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
| Constante global do domínio | `types/` | `APP_START_DATE` (schema.ts), faixas de atenção 85/90/95 |

---

## 5. ESTRATÉGIA DE ESTADO, CACHE E API

### 5.1 Estado de servidor — TanStack Query

- **Queries por domínio** com chaves estáveis e parametrizadas: `['expenses', { month }]`, `['invoices', { cardId, month }]`, `['portfolio', 'position']`.
- **Derivados nunca são cacheados como estado**: KPIs, séries e insights são funções puras de `domain/` aplicadas sobre a query base (fonte única).
- **Cotações (dados lentos)**: `staleTime` alto + *stale-while-revalidate*; a UI sempre lê do cache servidor (`asset_prices`), nunca da API externa em tempo de request.
- **Invalidação dirigida após mutações** (ex.: criar despesa invalida `['expenses']`, `['budgets']`, `['overview']`).
- **Política de retry e Calibração Global Anti-Storm (Online First & Alta Concorrência):**
  - `refetchOnWindowFocus: false`: erradica tempestades de requisições (*refetch storms*) ao alternar abas, janelas móveis ou retornar ao app;
  - `refetchOnReconnect: "always"`: revalidação garantida ao restabelecer a conexão de rede;
  - `staleTime: 60_000`: 1 minuto de frescor padrão global para dados transacionais;
  - `gcTime: 600_000`: 10 minutos de retenção de cache inativo em memória;
  - `retry: 1`: leituras com 1 tentativa com backoff curto, prevenindo acúmulo de requisições lentas em redes instáveis;
  - **Mutações NUNCA têm retry automático** (`mutations.retry: false`) — o estado `isPending` desabilita o botão e previne dupla submissão; falha de rede exige ação explícita do usuário ("Tentar novamente").
- **Cancelamento Cooperativo de Queries via `AbortSignal`:**
  - Repositórios com consultas por período dinâmico (`listExpenses`, `listIncomes`) aceitam opcionalmente `signal?: AbortSignal`.
  - Os hooks `useExpenses` e `useIncomes` conectam o `context.signal` do TanStack Query diretamente à chamada do repositório, que o injeta no cliente PostgREST via `.abortSignal(signal)`.
  - Ao alternar rapidamente entre filtros de data ou navegar para outra tela, qualquer requisição em trânsito é cancelada cooperativamente no cliente e na camada de rede, eliminando desperdício de banda e condições de corrida (*race conditions*).
- **Debounce Defensivo em Filtros de Intervalo (350 ms):**
  - Telas com filtros de intervalo dinâmicos (como a Central de Relatórios) utilizam debounce de 350 ms antes de disparar revalidações de query, prevenindo rajadas desnecessárias no banco enquanto o usuário ajusta datas.
- **Resolução Concorrente e Estabilidade de Memória:**
  - O pipeline de queries foi auditado e testado para suportar rajadas de 10+ queries simultâneas com resolução assíncrona concorrente, garantindo que o batching de atualizações do React não gere re-renderizações duplicadas e que múltiplos ciclos de montagem/desmontagem não deixem observers órfãos na memória.
- **Calibração de Stale Time Estendido para Dados Cadastrais e Estáticos (5 minutos / 300.000 ms):**
  - Queries de baixa frequência de alteração (`useCategories`, `useUserPreferences`, `useBudgets`, `useUserAccess`, `useUserSubscription`) utilizam explicitamente `staleTime: STALE_TIMES.static` (300.000 ms) e `gcTime: STATIC_GC_TIME` (1.800.000 ms / 30 min);
  - Assegura imunidade contra re-execuções desnecessárias em navegações internas, mantendo invalidação atômica e imediata após mutações locais (`queryClient.invalidateQueries`) e canais Supabase Realtime.

### 5.2 Escritas — RPCs transacionais (D1)

- **Toda escrita composta** (despesa+cobrança, estorno→renda, exclusão em cascata, quitação integrada, recálculo de competência) via `data/rpc.ts` → função Postgres transacional. O cliente recebe `{ ok, data } | { ok: false, error }`.
- **Escritas simples** (1 registro, sem cascata) podem usar CRUD direto, ainda assim com validação nas bordas.
- **Optimistic updates** apenas para operações simples e de baixo risco; rollback automático em erro. Nunca para RPCs compostos.
- **Geração de parcelas:** o cliente calcula via `domain/money` (TS, testável) e envia as linhas; o RPC **valida invariantes no servidor** (soma = valor original, parcelas 1–60, datas ≥ APP_START_DATE) e persiste — sem duplicar a lógica de divisão em SQL.
- **Particionamento e Chunking de Extratos e Faturas (250 Itens por Lote):**
  - O utilitário puro `chunkArray` e `chunkBankStatementBatch` ([`src/domain/reconciliation/chunking.ts`](../src/domain/reconciliation/chunking.ts)) impõe teto rígido de 250 registros (`STATEMENT_CHUNK_SIZE = 250`) para inserções em lote em transações bancárias e conciliação de faturas de cartão.
  - Tanto o diálogo de extratos de contas (`BankStatementImportDialog`) quanto o de faturas de cartão (`StatementImportDialog`) despacham os lotes sequencialmente com feedback visual de progresso, prevenindo sobrecarga de payload HTTP (`413 Payload Too Large`), esgotamento de memória no navegador e timeouts no PostgREST mesmo em extratos densos de mais de 2.000 linhas.
- **Centralização de Cotações Server-Side (Zero Leque no Browser):**
  - A aplicação adota arquitetura de cotações 100% server-side: os clientes consomem exclusivamente a tabela `public.asset_prices` (`user_id is null`), eliminando leques de requisições concorrentes disparadas por navegadores individuais para APIs externas de mercado (Brapi, Yahoo, AwesomeAPI).
  - A atualização do cache global é delegada à Edge Function `quotes`, agendada de forma determinística via `pg_cron` e `pg_net` nos horários estratégicos do pregão da B3, garantindo resiliência e custo zero de cota.
- **Marco Zero e Linha do Tempo de Aportes Históricos do Bolso:** suporte a múltiplos marcos cronológicos com aportes (+) e resgates (-) na tabela `portfolio_contributions`. No domínio, retiradas do bolso (tag `[Resgate]`) são computadas pelo solver XIRR (`buildPortfolioCashFlows` e `calculateNetInjectedCapital`) como devolução antecipada de capital ao investidor, garantindo cálculo exato de Money-Weighted Return com suporte a importação em lote via Assistente de Extrato (`statement-parser.ts`, com deduplicação inteligente via `deduplicateStatementRows`) e o RPC `upsert_marco_zero` para modo rápido consolidado.
- **Motor TWR / Cotização por Cotas (Padrão ANBIMA / CVM):** motor puro (`domain/portfolio/twr.ts`) que calcula o Time-Weighted Return encadeando a variação percentual dos subperíodos mensais a partir de snapshots patrimoniais (`portfolio_snapshots`) e fluxos de caixa, neutralizando o efeito de timing de aportes e resgates externos. Inclui salvaguarda contra liquidação temporária (`balance === 0`), garantindo continuidade matemática da série histórica.


### 5.3 Estado de UI, autenticação e ciclo de vida de cache

- **Sessão & Singleton de Autenticação (`useAuth`):** gerenciado por um padrão Singleton reativo em memória (`globalSession`, `globalUser`, `globalLoading`) sincronizado via `supabase.auth.onAuthStateChange` e broadcast reativo para todos os componentes inscritos. A persistência de `activeUserId` em `localStorage` é blindada contra limpezas no cold reload, ocorrendo wipe apenas quando o carregamento é concluído com sessão confirmadamente nula (`!loading && !session`).
- **Ciclo de Vida Autenticado de Queries & Blindagem de Cold Start (`useUserAccess` & `useUserSubscription`):**
  - **Chaves de query parametrizadas por `userId`:** todas as consultas de perfil, features e assinatura utilizam chaves com namespace de usuário (`userAccessQueryKey(userId) = ["user_access", userId]`, `userFeaturesQueryKey(userId) = ["user_features", userId]` e `userSubscriptionQueryKey(userId) = ["user_subscription", userId]`). Isso impede vazamento e retenção indevida de dados entre sessões distintas no TanStack Query.
  - **Guarda `enabled: Boolean(userId)`:** requisições a `getMyProfile`, `getMyFeatures` e `getMySubscription` permanecem suspensas até que a sessão ativa seja confirmada (via `supabase.auth.getSession()` ou `subscribeActiveUserId`), eliminando chamadas prematuras anônimas com `auth.uid() = NULL` no instante zero do boot.
  - **Persistência Síncrona de `activeUserId` no Cold Boot (`user-storage.ts`):** `activeUserId` é persistido em `localStorage` sob a chave `financas_active_user_id` e inicializado de forma síncrona no módulo (`getInitialActiveUserId()`), garantindo que `getActiveUserId()` retorne o ID do usuário imediatamente no render inicial após recarregamento, reabertura do PWA ou lançamento nativo.
  - **Sincronização de Rota Inicial no `RequireAuth`:** o guard autenticado repassa explicitamente `session?.user?.id` para `useUserAccess` e retém o `<Outlet />` enquanto `isDataLoading` estiver ativo (`authLoading || (hasUser && (userAccess.isLoading || isAccessPending))`), impedindo que guards de rota filhos (`RequireFeature`) avaliem regras com perfil vazio e eliminando o falso redirecionamento para `/configuracoes`.
  - **Resolução Determinística de Rota Inicial (`resolveLandingPath`):** determina a primeira rota disponível priorizando a Home (`/` via feature `overview`) e, para contas modulares sem visão geral, seleciona a primeira rota funcional ativa segundo a ordem canônica (`/transacoes`, `/cartoes`, `/investments`, `/dividas`, `/orcamentos`, `/relatorios`, `/insights`, `/lembretes` ou `/admin`). Sanitização rigorosa no fluxo de login impede que destinos administrativos ou de configurações sejam herdados indevidamente.
  - **Invalidação Reativa no Login (`AuthQuerySync`):** ao identificar o evento `SIGNED_IN` ou alternância para um novo `userId` autenticado, o listener invalida atomicamente as chaves `USER_ACCESS_KEY`, `USER_FEATURES_KEY` e `USER_SUBSCRIPTION_KEY`, assegurando a carga imediata de dados frescos e autenticados.
  - **Política de Acesso e Resolução de Features (`hasFeature` & `RequireFeature`):** durante a inicialização/carregamento (`isLoading`) ou na ausência de autenticação (`!activeUserId`), opera em Fail-Closed (`false`). Quando resolvido, avalia o modelo de Whitelist caso a assinatura possua overrides modulares (`user_module_permissions`); na ausência de restrições personalizadas, adota as regras do plano e as Feature Flags do sistema (`features[featureKey] !== false`). A guarda `RequireFeature` mantém a `<LoadingScreen />` ativa durante o carregamento e redireciona imediatamente para o destino calculado por `resolveLandingPath(hasFeature, isAdmin)`, eliminando flashes visuais ou desvios indevidos para configurações.
- **Purge Atômico de Cache e Reset de Estado (`AuthQuerySync` & `resetAppState`):** em eventos `SIGNED_OUT` ou troca de usuário (`userId` distinto), o listener invoca `resetAppState` cancelando queries ativas (`cancelQueries`), limpando 100% da memória do TanStack Query (`queryClient.clear()`), resetando stores locais em memória (`visualCustomization`, `density`, `privacyMask`, `sidebarState`) e removendo atributos do DOM raiz (`data-accent`, `data-surface-style`, `data-motion`, `data-privacy`), prevenindo retenção ou vazamento de dados entre contas.
- **Isolamento de Armazenamento Local (`user-storage.ts`):** chaves do `localStorage` utilizam namespace obrigatório por usuário (`financas_${userId}_<chave>`). Chaves legadas ou despadronizadas sem namespace são purgadas automaticamente no boot/logout (`sanitizeLegacyStorage`).
- **Isolamento de Árvore e Anti-Flicker (`RequireAuth`):** rotas autenticadas usam `key={session.user.id}` para remontagem limpa e o hook `useMinimumLoading` (650ms) com a tela oficial `LoadingScreen` (barra de progresso dinâmica + log em tempo real), eliminando micro-flashes durante transições de rede ou sessão.
- **Persistência Híbrida de Preferências:**
  - **Nuvem (Supabase `user_preferences` + `custom_settings`):** lembretes, travas setoriais, densidade de tabelas, widgets do dashboard, atalhos do cabeçalho, animações, feedback sonoro/háptico e contadores animados são sincronizados multidispositivo via `useUserPreferences` e `useUpdateCustomSettings`.
  - **Dispositivo (Local por Usuário):** tema visual (`light`/`dark`/`oled`/`system`) e cor de destaque (`accent`) são mantidos isolados no `localStorage` por `userId`, respeitando as características físicas de cada tela/dispositivo.
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
- **Motor de Investimentos & Posição Consolidada (F36 / v1.75):**
  - Modelo de custódia direta em `portfolio_assets` (`quantity`, `average_price`), proporcionando valoração instantânea $O(1)$ (`calculatePositionSummary`) com conversão cambial USD/BRL e PnL não realizado.
  - Histórico patrimonial via snapshots mensais (`portfolio_snapshots`), gravados automaticamente e lidos em $O(1)$, dispensando o processamento de ledger transacional de ponta a ponta.
  - Aportes mensais (`portfolio_contributions`) e proventos (`portfolio_dividends`) desacoplados para integração direta com os fluxos da Overview e Insights.
  - **Rebalanceamento Hierárquico Unificado Classe $\rightarrow$ Ativo (`simulateCombinedAporte`):**
    1. *Nível Macro (Classe):* estabiliza primeiro as classes deficitárias com base no déficit relativo das metas de classe; classes com exposição atual igual ou superior à meta ($Atual \ge Alvo$) são travadas com gap zero e excluídas de aportes;
    2. *Nível Micro (Ativo):* a verba designada à classe é distribuída exclusivamente entre seus membros com base no gap das metas individuais ou equiponderação $1/N$;
    3. *Transbordamento & Fracionários:* sobras internas de classe retornam ao pool para atender a próxima classe; suporte nativo a cotas decimais em Cripto (até 8 casas) e painel diagnóstico de ativos não contemplados;
    4. *Gravação Atômica Transacional:* execução em 1-clique via RPC `execute_portfolio_batch_aporte`, atualizando posições em `portfolio_assets`, lançando compras individuais em `portfolio_transactions` e registrando a contribuição em `portfolio_contributions` numa única transação PostgreSQL.

---

## 7. SERVIÇOS DE APRESENTAÇÃO E INTEGRAÇÕES

- `services/format`: moeda (`Intl.NumberFormat` pt-BR), datas (timezone local — nunca `toISOString` em ranges de mês), percentuais.
- `services/masks`: máscaras de input monetário (`inputMode=numeric`), datas.
- `services/errors`: **gateway único** `getErrorMessage` com mensagens pt-BR; casos especiais: rate limit, e-mail não confirmado, sessão expirada, rede indisponível.
- Cotações e Arquitetura Server-Side (D5 & Alta Concorrência): **edge function `supabase/functions/quotes/`** (F1.7, Deno — fetch em cascata Yahoo → Brapi/AwesomeAPI + upsert do cache global `asset_prices` com `source 'api'`; motor puro testado em `_shared/quotes-core.ts`) + fallback estático + **preço manual** (D5, override do usuário consolidado com precedência estrita sobre cache) + guardrail de spike > 50%/dia. **Desacoplamento client-side estrito (Fase 2):** a UI e a rotina `syncQuotesForAssets` operam exclusivamente via cache do banco (`asset_prices`) e Edge Function centralizada, eliminando disparos concorrentes do navegador para APIs externas (Brapi/Yahoo). Tickers sem cotação imediata preservam o último preço registrado ou exibem status de espera, prevenindo erros de rate limit (HTTP 429).

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
7. **Ciclo de vida de modais de formulário / edição (Modal Content with Key Pattern):** como a prop `open={true}` não dispara `onOpenChange` no Radix UI, todo formulário de edição/criação em modal deve isolar seu conteúdo interno em subcomponente montado condicionalmente com `key={item?.id ?? 'new'}` dentro de `{open ? <Content ... /> : null}`. Isso garante inicialização 100% determinística dos campos via `useState` no mount e descarte automático de rascunhos no unmount.
8. **Code Splitting de Rotas e Modais Executivos Densos (Regra de Ouro de Performance):**
   - **Rotas Públicas e de Autenticação (`src/app/router.tsx`):** todas as páginas públicas (Landing, Planos, Apresentação), autenticação (Login, Cadastro, Recuperar Senha) e checkout de assinatura utilizam `React.lazy()` sob demanda, envolvidas em `<Suspense fallback={<RouteSuspenseFallback />}>`. Isso impede que o peso dessas telas infle o bundle inicial de usuários já logados que acessam o App Shell diretamente.
   - **Modais Executivos e Assistentes Densos:** modais de grande complexidade técnica ou visual (ex.: `WealthTearSheetModal` com folhas A4 de impressão, `FinancialCloseReportModal` com DRE completa, e `RestoreWizardDialog` com cálculo criptográfico de checksum SHA-256 e parsing de backup) devem ser carregados dinamicamente via `React.lazy()` e condicionados à flag de abertura (`{isOpen && <Suspense fallback={null}><Modal ... /></Suspense>}`), preservando chunks enxutos em páginas de alta frequência.

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
| D13 — Hardening de Segurança & IDOR | 100% de validação de FKs em RPCs, RLS com `is_current_user_active()` e isolamento de Edge Functions (Migration 0036/0037) | Defesa em profundidade no Postgres e Deno |
| D14 — Backend Feature Flag Triggers & Governança | Triggers no Postgres (`enforce_feature_flag_trigger`), RLS em RPCs residuais (`delete_card_payment`) e isolamento no schema `cron` (Migration 0039) | Kill-Switch com bloqueio atômico na API e agendador blindado |
| D15 — SaaS Migration & Governança de Monetização | Modelagem de planos (`plans`, `user_subscriptions`, `user_module_permissions`), separação de RLS Leitura vs. Escrita (Modo Somente-Leitura), RPCs com `can_current_user_write_module()`, hook de domínio reativo `usePermission()` e convites modulares com trial de 30 dias (Migrations 0040 e 0041) | Monetização sustentável sem perda de dados e concessão modular no Admin |
| D16 — Gateway de Acesso Unificado & Whitelist Modular na Inicialização | Integração direta do `getMySubscription` em paralelo no hook de roteamento `useUserAccess` (sem waterfalls), modelo estrito de Whitelist em `get_user_module_access` no Postgres (Migration 0046) e em `hasFeature`/`usePermission`, bloqueando módulos não concedidos e garantindo carregamento fail-closed sem vazamento de rotas ou flashes | Blindagem completa de rotas, eliminação de vazamento de módulos restritos e consistência reativa no boot da aplicação |
| D17 — Code Splitting Global & Lazy Loading de Modais Executivos | `src/app/router.tsx` com `lazy()` em todas as rotas públicas, de autenticação e checkout de assinatura com fallback suave; `lazy()` sob demanda para relatórios complexos (`WealthTearSheetModal`, `FinancialCloseReportModal`) e assistente de restauração (`RestoreWizardDialog`) | Bundles iniciais enxutos (< 500 kB), eliminação de payloads ociosos no boot e carregamento assíncrono transparente |
| D18 — Parametrização de Chaves por Usuário e Fail-Closed no Cold Start | Chaves de query parametrizadas no formato `[...KEY, userId]`, guarda `enabled: Boolean(userId)` impedindo chamadas com `auth.uid()` nulo, invalidação atômica em `SIGNED_IN` no `AuthQuerySync` e `hasFeature` estritamente Fail-Closed (retornando `false` sem assinatura/autenticação confirmada) | Eliminação definitiva de vazamento de módulos restritos no boot, ausência de cache de dados anônimos e transição suave sem flashes visuais |
| D19 — Segurança Integral, RLS Multi-Tenant e Privacidade Mobile | 100% das 34 tabelas com RLS ativo por auth.uid(), 28 RPCs transacionais blindadas com search_path = public, pg_temp, is_current_user_active() e can_current_user_write_module() (Migration 0049), audit_events estritamente imutável, sanitização de borda Zod, neutralização de vazamento SQL no gateway de erros, Android FLAG_SECURE nativo e redaction automático de PII (CPF, cartões, senhas) no cliente Sentry | Defesa em profundidade estrita e proteção integral de dados sensíveis |
| D20 — Assistente Passivo Híbrido & Notificações Bancárias | Arquitetura híbrida Android + PWA: `BankNotificationListenerService` nativo (Android), `QuickExpenseTileService` (Quick Settings Tile), `useSuggestionsStore` com fusão temporal e deduplicação fuzzy, Web Share Target (`/share-target`) no manifest PWA, diálogo de fallback universal (`PasteReceiptDialog`) e motor puro de parsing em centavos (`bank-parser.ts`, `category-inference.ts`, `preferences.ts`) | Captura passiva e sem fricção de gastos bancários, Pix, cartões e aportes em corretoras |

---

## 11. DECISÕES EM ABERTO E RESOLVIDAS

- ~~Cor primária e identidade da marca~~ — **RESOLVIDA** em `docs/DESIGN_SYSTEM.md` (tokens em `src/styles/tokens.css`).
- ~~Hosting do frontend~~ — **RESOLVIDA**: **Cloudflare Pages** (`public/_redirects` com SPA fallback, `public/_headers` com headers de segurança e cache PWA, Git integration nativa sem GitHub Actions).
- ~~Backend e banco de dados~~ — **RESOLVIDA**: **Supabase** (Postgres 17 + RLS + Auth + Migrations versionadas em `supabase/migrations/`).
- ~~Notificações~~ — **RESOLVIDA**: in-app centralizado (`/lembretes`).
- ~~Observabilidade/erros~~ — **RESOLVIDA**: **Sentry** (F6.3) — SDK `@sentry/react` com **dynamic import** env-gated por `VITE_SENTRY_DSN` (no-op sem DSN; Web Vitals LCP/INP/CLS via `browserTracingIntegration`; `reportError`/`setObservabilityUser` em `services/observability`).
- ~~Monetização & Modelo SaaS~~ — **RESOLVIDA**: **Arquitetura SaaS Modular** (Fase 76) — Trial gratuito de 30 dias sem cartão, modo somente-leitura preservado pós-período sem paywall bloqueante, planos Pro Mensal (R$ 19,90) e Pro Anual (R$ 14,90/mês), e controle granular de permissões modulares no painel administrativo.

---

## 12. GOVERNANÇA DE SEGURANÇA INTEGRAL, RLS E PRIVACIDADE (FASE 5)

A governança de segurança do aplicativo segue o princípio de **Defesa em Profundidade** (*Defense in Depth*) e **Isolamento Lógico Estrito Multi-Tenant** fundamentado na identidade criptográfica do Supabase Auth (`auth.uid()`).

### 12.1 Matriz de RLS e Multi-Tenancy (34 Tabelas)
1. **Cobertura Universal:** 100% das 34 tabelas do banco de dados possuem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
2. **Propriedade e Isolamento com Caching Escalar (InitPlan):** Todas as tabelas de domínio (`expenses`, `incomes`, `credit_cards`, `debts`, `budgets`, `portfolio_assets`, `portfolio_transactions`, `recurrences`, etc.) filtram exclusivamente por `(select auth.uid()) = user_id` (Migration `0050_rls_subplan_caching_performance.sql`).
3. **Imutabilidade de Trilha de Auditoria (D2):** A tabela `audit_events` possui apenas políticas de `INSERT` e `SELECT` para o usuário proprietário e administradores. Mutações (`UPDATE`) e exclusões (`DELETE`) são terminantemente bloqueadas via RLS no banco.
4. **Catálogo Público de Planos e Features:** A tabela `plans` e a tabela `system_features` permitem leitura aos usuários autenticados, enquanto mutações são restritas à verificação `is_admin()`.
5. **Otimização de RLS Subplan Caching (`InitPlan`):** Chamadas diretas como `auth.uid() = user_id` são tratadas como voláteis pelo planejador do PostgreSQL, forçando a re-execução da função para cada linha escaneada no heap. Ao utilizar a subquery escalar `(select auth.uid())`, o PostgreSQL a promove a um nó `InitPlan`, avaliado exatamente uma vez no início da consulta e reutilizado em memória para todas as linhas, gerando uma redução de até 90% no consumo de CPU sob alta concorrência.
6. **Suíte Automatizada de Penetração Cross-Tenant:** Implementada em [`src/tests/cross-tenant-penetration.test.ts`](../src/tests/cross-tenant-penetration.test.ts) com 37 testes automatizados que simulam ativamente ataques de IDOR (Insecure Direct Object Reference) em operações de `SELECT`, `INSERT`, `UPDATE`, `DELETE` e execução de RPCs entre tenants distintos, comprovando o isolamento rígido entre usuários e a política fail-closed em sessões anônimas (`auth.uid() = NULL`).
7. **Índices Compostos Cobridores de Alta Concorrência:** Criação do índice cobridor `idx_portfolio_tx_user_asset_date` (`portfolio_transactions (user_id, asset_id, date desc)` na Migration `0052`), combinando o predicado multi-tenant `user_id = (select auth.uid())`, o filtro de ativo `asset_id` e a ordenação `date desc` em um único Index Scan direto, eliminando sequential scans e ordenações em memória no PostgreSQL.

### 12.2 Hardening de Procedimentos Armazenados (RPCs)
1. **Fixação de Search Path:** 100% das funções com `SECURITY DEFINER` possuem explicitamente a cláusula `SET search_path = public, pg_temp;`, neutralizando ataques de injeção de schema via tabelas temporárias.
2. **Validação de Conta Ativa:** Toda função transacional de escrita valida se o chamador possui conta com status ativo (`public.is_current_user_active()`), rejeitando operações de contas suspensas ou pendentes.
3. **Controle de Escrita Modular SaaS:** A partir da Migration `0049_rpc_write_permission_and_active_user_hardening.sql`, todas as 28 RPCs de mutação de usuário validam a concessão de escrita no respectivo módulo via `public.can_current_user_write_module(p_module_key)`, garantindo que usuários com assinatura expirada ou módulos não concedidos no modo Whitelist operem estritamente em modo Somente-Leitura.
4. **Revogação de Acesso Público:** Todas as RPCs transacionais revogam permissões de execução do papel `public` (`REVOKE ALL ON FUNCTION ... FROM public;`) e concedem estritamente ao papel `authenticated`.
5. **Encapsulamento Escalar das Checagens Modulares SaaS:** A partir da Migration `0051`, chamadas de autorização como `(select public.is_current_user_active())` e `(select public.can_current_user_read_module('...'))` são avaliadas como subqueries escalares nas policies RLS, permitindo que o PostgreSQL as promova a nós `InitPlan` executados uma única vez por consulta.

### 12.3 Sanitização de Borda e Prevenção de Injeção / XSS
1. **Sanitização de Strings Livres:** O helper puro `sanitizeString` ([`src/domain/validation/sanitization.ts`](../src/domain/validation/sanitization.ts)) remove caracteres nulos (`\u0000`), caracteres de controle C1 perigosos e tags HTML/XML (`<[^>]*>`), eliminando vetores de XSS armazenado.
2. **Schemas Zod Defensivos:** Formulários e mutações utilizam `cleanTextSchema` e `moneyCentsSchema`/`moneyAmountSchema` que impõem limites rígidos de caracteres e tetos monetários contra overflow aritmético (`MAX_MONEY_CENTS = 99_999_999_99`).
3. **Neutralização de Vazamento de Esquema e Mapeamento Resiliente no Gateway de Erros:** O gateway central de erros ([`src/services/errors/index.ts`](../src/services/errors/index.ts)) conta com sanitizador ativo contra vazamento técnico (`containsTechnicalLeak`), interceptando detalhes de baixo nível do PostgreSQL (ex.: `relation "..." does not exist`, `column "..." does not exist`, `syntax error at or near`, `function "..." does not exist`, `violates foreign key constraint`, `invalid input syntax for type`, stack traces `at async` ou referências a migrações SQL) e substituindo-os pela mensagem segura `"Algo deu errado. Tente novamente em instantes."`. Além disso, mapeia graciosamente códigos HTTP de limitação de tráfego e manutenção:
   - **HTTP 429 (Rate Limit):** `"Muitas requisições simultâneas. Aguarde alguns instantes e tente novamente."`
   - **HTTP 503 (Service Unavailable):** `"Serviço temporariamente indisponível para manutenção. Aguarde alguns instantes e tente novamente."`

### 12.4 Privacidade em Clientes Móveis e Telemetria Segura
1. **Android FLAG_SECURE (Privacy Shield) & Ciclo de Vida Resiliente:** O serviço nativo [`src/services/native/privacy-shield.ts`](../src/services/native/privacy-shield.ts) e o gateway [`src/services/native/app-lock.ts`](../src/services/native/app-lock.ts) gerenciam a flag `WindowManager.LayoutParams.FLAG_SECURE` na janela Android.
   - **Controle Explícito do Container:** O plugin `@capacitor-community/privacy-screen` é configurado com `enable: false` em `capacitor.config.ts`, permitindo que o ciclo de vida JavaScript controle determinísticamente a aplicação ou remoção do `FLAG_SECURE`.
   - **Persistência na Nuvem:** A preferência é armazenada e sincronizada via Supabase na coluna `user_preferences.custom_settings.privacyShieldEnabled`.
   - **Resiliência no Cold Start:** No dispositivo, o valor é espelhado em `financas_active_privacy_shield_enabled` no `localStorage`, garantindo que no boot nativo (antes da resolução da sessão de autenticação) `syncPrivacyShield()` despache ativamente `enablePrivacyShield()` ou `disablePrivacyShield()`, sem reter bloqueios indevidos de tela caso o usuário tenha desabilitado o escudo.
2. **Redaction Automático de PII no Sentry:** O cliente de observabilidade [`src/services/observability.ts`](../src/services/observability.ts) aplica sanitização recursiva (`scrubSensitiveData`) e gancho `beforeSend`, redigindo chaves confidenciais (`password`, `senha`, `secret`, `token`, `account_number`) e mascarando padrões de CPF (`[REDACTED_CPF]`) e cartões de crédito (`[REDACTED_CARD]`) antes de transmitir qualquer evento à telemetria.

---

## 13. ARQUITETURA DO ASSISTENTE PASSIVO HÍBRIDO & NOTIFICAÇÕES (D20)

O Assistente Passivo opera em modelo híbrido entre o cliente Android nativo e o PWA instalado:

### 13.1 Camada Nativa Android (`android/app/src/main/java/com/guiafinanceiro/app/`)
1. **`BankNotificationListenerService.java`**:
   - Herda de `NotificationListenerService`;
   - Monitora notificações de bancos e corretoras autorizados pelo usuário;
   - Aplica filtros rigorosos anti-spam e anti-publicidade (`hasValidTransactionSignal`);
   - Armazena transações capturadas em buffer de segundo plano em `SharedPreferences` quando o app está fechado;
   - Despacha notificações interativas com ação rápida `"Conferir e Salvar"` (`novo=expense` ou `novo=income`).
2. **`BankNotificationPlugin.java`**:
   - Expõe ao frontend os métodos Capacitor para verificação de permissão, leitura e esvaziamento do buffer de background e sincronização dos pacotes monitorados selecionados pelo usuário.
3. **`QuickExpenseTileService.java`**:
   - `TileService` da barra de configurações rápidas do Android;
   - Exibe bloco `"Lançar Despesa"`;
   - Ao ser acionado, desbloqueia a tela e redireciona diretamente para a tela de transações com wizard de despesa aberto (`/transacoes?novo=despesa`).

### 13.2 Camada Web e PWA (`src/features/transactions/pages/`, `src/components/modules/`)
1. **Web Share Target (`/share-target` — `ShareTargetPage`)**:
   - Declarado no `manifest.webmanifest`;
   - Recebe compartilhamento de texto direto de apps bancários (comprovantes Pix);
   - Analisa via `bank-parser.ts`, adiciona como sugestão e redireciona à tela inicial.
2. **Área Universal de Colar Comprovante (`PasteReceiptDialog`)**:
   - Interface acessível para desktop e iOS colarem comprovantes ou alertas SMS/notificações copiados da área de transferência;
   - Converte instantaneamente em sugestão estruturada.

### 13.3 Camada de Domínio Puro (`src/domain/notifications/`)
1. **`bank-parser.ts`**:
   - Parser puro em TypeScript sem dependências externas;
   - Suporte a 20+ instituições: bancos digitais, tradicionais, carteiras digitais, corretoras (BTG, XP, Rico), cripto (Binance) e contas globais (Nomad, Wise);
   - Aritmética inteira estrita em centavos (`amountCents`);
   - Detecção de natureza (despesa, receita, investimento/aporte/resgate).
2. **`category-inference.ts`**:
   - Mapeamento determinístico de estabelecimentos e palavras-chave para categorias canônicas do sistema.
3. **`preferences.ts`**:
   - Modelagem de preferências de notificações, deduplicação temporal e persistência segura.

### 13.4 Gestão de Estado & Deduplicação (`src/services/native/suggestions-store.ts`)
- Store reativa de sugestões pendentes;
- **Fusão temporal e deduplicação fuzzy**: janelas de 120 segundos para unificar notificações de carteiras (Google Wallet/Samsung Pay) com as notificações emitidas pelo app emissor do cartão bancário, evitando lançamentos duplicados de uma mesma compra física;
- Ações rápidas de 1-clique para aceitar e persistir via RPCs transacionais do Supabase ou editar no modal de transações.



