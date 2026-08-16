# 🗂️ PROJECT_STRUCTURE.md — Organização da Base de Código

> **Status:** v1.0 — Define a árvore de diretórios, a responsabilidade de cada pasta e **onde criar cada novo arquivo**.
> Complementa `ARCHITECTURE.md` (camadas e convenções) e vincula as regras do `AGENTS.md`.
> **PWA:** estrutura e requisitos em `PWA_GUIDELINES.md`.

---

## 1. PRINCÍPIOS

1. **Coesão** — cada diretório tem uma responsabilidade única e nome autoexplicativo; nada de "pasta coringa".
2. **Baixo acoplamento** — dependência unidirecional entre camadas (ver `ARCHITECTURE.md` §3): UI → state → data → Supabase; domain é puro.
3. **Escalabilidade por adição** — adicionar uma feature nova significa **criar uma pasta em `src/features/`**, nunca espalhar código em diretórios genéricos.
4. **DRY** — componente reutilizado em 2+ lugares vai para `components/ui` ou `components/modules` (ver `AGENTS.md` §4).
5. **Nada solto** — todo arquivo pertence a um diretório desta árvore; nada na raiz além de config.

---

## 2. MAPEAMENTO DE PREMISSAS → DECISÕES

| Premissa comum | Decisão deste projeto | Motivo |
|---|---|---|
| `src/pages` | `src/features/<área>/pages/` | Feature = área funcional coesa (páginas + componentes locais + hooks locais); páginas soltas criam acoplamento falso entre áreas |
| `src/core` | `src/domain/` | Motores de cálculo puros; "core" é ambíguo, "domain" comunica a intenção |
| `src/api` | `src/data/` + `src/state/` | `data/` = integração remota (Supabase/RPC); `state/` = contratos para a UI |
| `src/lib` | `src/lib/` (constantes/utils) **+** `src/services/` (formatação/máscaras/erros) | Separa utilitários genéricos de serviços de apresentação |
| `public/pwa` | `public/pwa/` | Manifest, ícones, service worker e splash (ver `PWA_GUIDELINES.md`) |

---

## 3. ÁRVORE DE DIRETÓRIOS (COMPLETA)

```
/
├── AGENTS.md                      # Governança do agente de IA (ler SEMPRE)
├── RECONSTRUCAO.md                # Spec funcional original (fonte histórica)
├── ESPECIFICACAO_TECNICA.md       # Spec executável: regras de negócio, schema, UI/UX
├── docs/                          # Documentação — UPPER_SNAKE_CASE.md (ver §7)
│   ├── ARCHITECTURE.md            # Camadas, dependências, convenções
│   ├── DESIGN_SYSTEM.md           # Identidade visual e design tokens
│   ├── PROJECT_STRUCTURE.md       # Este documento
│   ├── PWA_GUIDELINES.md          # Requisitos PWA (manifest, SW, instalação)
│   └── ROADMAP.md                 # Fases de execução e Definition of Done
│
├── public/                        # Assets estáticos servidos na raiz (não processados)
│   ├── favicon.ico / favicon.svg  # Multi-resolução (16, 32, 48) e SVG transparente
│   ├── brand/                     # Assets oficiais da marca (logo.png, logo-128, favicon-32, favicon.svg, logo-full)
│   └── pwa/                       # Artefatos PWA — ver PWA_GUIDELINES.md
│       ├── manifest.webmanifest
│       ├── icons/                 # icon-192, icon-512 (transparente), maskable-192/512 (safe zone), apple-touch-icon-180
│       ├── screenshots/           # 1280x800 (desktop) + 720x1280 (mobile)
│       └── offline.html           # Fallback offline (App Shell mínimo)
│
├── supabase/                      # Backend — ver ESPECIFICAÇÃO §2 (migrations versionadas)
│   ├── migrations/                # 0001_schema.sql · 0002_rls.sql · 0003_functions.sql …
│   │                              # 0009_backfill_profiles.sql (schema, RLS por auth.uid(),
│   │                              # triggers + RPCs transacionais + backfill de perfis)
│   └── functions/                 # Edge functions (runtime Deno — fora do bundle Vite)
│       ├── _shared/quotes-core.ts #   Motor puro de cotações (F1.7) — TS sem I/O, testável
│       │                          #   em src/tests/quotes-core.test.ts
│       └── quotes/index.ts        #   Edge function de cotações: fetch Yahoo em cascata +
│                                  #   upsert do cache global asset_prices (auth por service role)
│
└── src/
    ├── main.tsx                   # Entry point: ReactDOM + registerPWA()
    ├── app/                       # Bootstrap e orquestração (SEM lógica de negócio)
    │   ├── providers.tsx          # AuthProvider, QueryClientProvider, ThemeProvider
    │   ├── router.tsx             # <Routes> a partir de routes.ts
    │   ├── routes.tsx             # Mapa de rotas + deep-links (?card=, ?month=, ?q=) +
    │   │                          #   redirect /carteira → /investments (unificação 2026-08-15)
    │   ├── pwa.ts                 # Registro SW (autoUpdate + toast) + stores de
    │   │                          #   instalação/atualização (PWA_GUIDELINES §6)
    │   └── theme-provider.tsx     # ThemeProvider — aplica tema/accent do usuário (F11)
    │
    ├── components/
    │   ├── ui/                    # PRIMITIVOS genéricos (sem domínio): button, input,
    │   │   │                      #   card, badge, modal, tabs, skeleton, empty-state,
    │   │   │                      #   virtual-list (F5.5), toast, toast-host (F30 —
    │   │   │                      #     assinante do bus de toasts imperativos),
    │   │   │                      #   pull-up-to-top-indicator (F26 — substitui o
    │   │   │                      #     scroll-to-top-button F9, removido),
    │   │   │                      #   number-ticker, sparkline (F8), color-picker,
    │   │   │                      #   icon-picker (pós-F10), live-pulse-beacon (F11),
    │   │   │                      #   tooltip (F25 — primitivo acessível, CSS puro),
    │   │   │                      #   number-stepper-input (pós-F25 — substitui o
    │   │   │                      #     input[type=number] nativo: botões −/+ com
    │   │   │                      #     long-press e min/max/step)…
    │   │   └── index.ts
    │   ├── modules/               # Componentes de DOMÍNIO reutilizáveis: kpi-card,
    │   │   │                      #   category-icon(+icons), month-picker, year-picker, transaction-row,
    │   │   │                      #   budget-progress-bar, debt-status-badge,
    │   │   │                      #   invoice-status-badge, installment-badge,
    │   │   │                      #   onboarding-card, pwa-update-toast, install-app-button (F5.6),
    │   │   │                      #   category-donut, daily-flow-chart (F8),
    │   │   │                      #   floating-calculator, calculator-keypad (F9),
    │   │   │                      #   credit-card-3d + credit-card-wallet (F13),
    │   │   │                      #   delta-hint (F14), highlight-row, projection-line,
    │   │   │                      #   month-swiper (F20 — swipe no MonthPicker),
    │   │   │                      #   prediction-suggestions (F21 — autopreenchimento preditivo),
    │   │   │                      #   export-data-hub (F22 — backup/CSV/restauração em Configurações),
    │   │   │                      #   monthly-close-print-view (F22 — fechamento mensal imprimível),
    │   │   │                      #   emergency-fund-gauge + fire-projection-chart + planning-section
    │   │   │                      #     (F24 — fundo de emergência e simulador FIRE no Insights),
    │   │   │                      #   pull-up-indicator (F26 — micro-indicador overscroll)…
    │   │   └── index.ts
    │   └── layout/                # Estrutura de página: sidebar (collapsible F7), bottom-nav (5 slots F7),
    │       │                      #   page-shell, more-menu, nav-items, brand-logo (F10),
    │       │                      #   privacy-toggle (F8), theme-toggle, calculator-button,
    │       │                      #   global-search (busca no header)
    │       └── index.ts           #   barrel (AGENTS.md §7 — importações externas via @/components/layout)
    │
    ├── features/                  # ÁREAS funcionais — padrão interno em §5
    │   ├── overview/              #   Visão Geral (KPIs com sparkline, fluxo com scrubbing, donut F8)
    │   ├── transactions/          #   Transações (swipe-to-action F8) + wizard de lançamento
    │   ├── cards/                 #   Cartões (faturas, pagamentos, estornos)
    │   ├── debts/                 #   Dívidas (status, quitação integrada)
    │   ├── budgets/               #   Orçamentos (limites, realocação)
    │   ├── reports/               #   Relatórios
    │   ├── insights/              #   Insights, projeção e corte
    │   ├── reminders/             #   Lembretes (central de notificações)
    │   ├── settings/              #   Configurações (preferências, densidade F8, perfil)
    │   ├── portfolio/             #   Carteira (portfólio) — componentes de operação
    │   │                          #   (targets/aporte tabs, reutilizados no hub; a antiga
    │   │                          #   página /carteira e a position-tab foram removidas na
    │   │                          #   F28 — /investments é o hub único desde a F17) +
    │   │                          #   CRUD completo (2026-08-15): asset-form-dialog,
    │   │                          #   transaction-form-dialog, transaction-list-dialog
    │   └── investments/           #   ÁREA ÚNICA de investimentos /investments (F17+unificação):
    │                              #     hub de abas (Resumo/Metas/Proventos/Aporte) —
    │                              #     pages/resumo-tab.tsx · pages/proventos-tab.tsx (F18)
    │
    ├── domain/                    # MOTORES DE CÁLCULO PUROS (sem React/Supabase)
    │   ├── onboarding/             #   checklist/progresso do primeiro uso (F5.4)
    │   ├── money/                 #   parcelamento em centavos, arredondamento, parsing
    │   ├── competence/            #   resolveBillCompetence, clampDay, overrides
    │   ├── debts/                 #   status derivado (overdue/due_today/due_soon/…)
    │   ├── expenses/              #   resolução dos modos de exclusão de despesa
    │   │                          #     (single/all/subsequent — resolveExpenseDeleteIds,
    │   │                          #     espelha o RPC p/ atualizações otimistas F30)
    │   ├── cards/                 #   saldo de fatura, status da fatura (closed/open/near_due/overdue)
    │   ├── budgets/               #   regras por categoria (CATEGORY_RULES), status/limites
    │   ├── overview/              #   computeOverview (KPIs), percentChange, buildDailyFlow
    │   ├── reports/               #   peso de relatório (base × weight) + detailed-close.ts
    │   │                          #     (F22 evolução — fechamento mensal em categoria → dia → gasto)
    │   ├── insights/              #   alertas, assinaturas, recorrências, confiança
    │   ├── savings/               #   F27: desafios de economia (média mensal típica, corte
    │   │                          #     discricionário 10/20/30% — typicalMonthlySpendCents)
    │   ├── reminders/             #   agregação de lembretes (conta/dívida) e preferências
    │   ├── accessibility/         #   F15: contraste AA — hexToRgb/relativeLuminance/
    │   │                          #     contrastRatio/isAANormalText/isAALargeText
    │   ├── projection/            #   gasto disponível, ritmo, fim de mês, pendências
    │   ├── search/                #   busca global: normalização, scoring, bônus de recência
    │   ├── virtualization/        #   janela de renderização de listas (F5.5)
    │   ├── calculator/            #   motor puro de operações e divisão de parcelas (F9)
    │   ├── predictions/           #   predição de entrada (F21): similaridade de descrição,
    │   │                          #     inferência de categoria/forma/cartão e habituais
    │   ├── gestures/              #   gestos puros: swipe.ts (F20), overscroll.ts (F26)
    │   ├── export/                #   F22: serialização CSV pt-BR (`;`/`,`/BOM — csv.ts)
    │   │                          #     e backup versionado com Zod + integridade
    │   │                          #     referencial (backup.ts, BACKUP_TABLE_KEYS)
    │   ├── fire/                  #   F24: regra dos 4% (meta = despesas × 25),
    │   │                          #     projeção anual determinística e faixas do
    │   │                          #     fundo de emergência (index.ts)
    │   └── portfolio/             #   ledger, custo médio, valoração, rebalanceamento,
    │                              #   summary.ts (F17: rentabilidade, alocação),
    │                              #   dividends.ts (F18: extrato e calendário de proventos)
    │
    ├── data/                      # INTEGRAÇÃO REMOTA
    │   ├── client.ts              #   Cliente Supabase único (env centralizado)
    │   ├── query.ts               #   QueryResult<T> — contrato base data\|error
    │   ├── auth.ts                #   Operações de autenticação (login/registro/recuperação)
    │   ├── session.ts             #   currentUserId() — usuário autenticado (RLS auth.uid())
    │   ├── repositories/          #   expenses.ts, incomes.ts, cards.ts, debts.ts,
    │   │                          #   budgets.ts, portfolio.ts, categories.ts,
    │   │                          #   export.ts (F22: fetchAllUserData + restoreBackup),
    │   │                          #   onboarding.ts (contagens do primeiro uso),
    │   │                          #   profiles.ts (auto-cura de perfis órfãos)
    │   └── rpc.ts                 #   Wrappers tipados dos RPCs transacionais (D1)
    │
    ├── state/                     # CONTRATOS DE ESTADO para a UI
    │   ├── cache-policy.ts        #   F23: STALE_TIMES/gcTime por tipo de dado
    │   │                          #     (estático 5 min, analítico, cotações, transacional)
    │   ├── queries/               #   useExpenses({month}), useInvoices(cardId)…
    │   └── mutations/             #   useCreateExpense(), useDeleteInstallment()…
    │                              #     (use-expense-mutations, use-card-mutations,
    │                              #      use-budget-mutations, use-debt-mutations,
    │                              #      use-category-mutations, use-income-mutations)
    │                              #   optimistic-cache.ts (F30 — helpers de snapshot/
    │                              #     rollback e updaters das listas em cache)
    │
    ├── hooks/                     # Hooks de UI reaproveitáveis (use-auth,
    │                              #   use-highlight-target, use-pwa-install,
    │                              #   use-sidebar-state, use-swipe-action,
    │                              #   use-privacy-mask, use-visual-customization (F11),
    │                              #   use-swipe-navigation (F20 — gesto horizontal),
    │                              #   use-route-prefetch (F23 — chunks das rotas vizinhas),
    │                              #   use-pull-up-to-top (F26 — overscroll vertical)…)
    ├── services/                  # Apresentação + integrações
    │   ├── masks/                 #   máscaras de apresentação (moeda, percentual pt-BR)
    │   │                          #   — barrel index.ts (fonte única DRY: formatCentsAsBRL,
    │   │                          #     formatPercent)
    │   ├── errors/                #   Gateway de erros: index.ts (classifyError +
    │   │                          #   getErrorMessage pt-BR) + index.test.ts
    │   ├── haptics.ts             #   Feedback háptico (navigator.vibrate) (F8)
    │   ├── toast.ts               #   F30: bus de toasts imperativos (pushToast/dismissToast
    │   │                          #     — pub/sub module-level p/ rollbacks otimistas)
    │   ├── audio-fx.ts            #   Feedback sonoro sintetizado via Web Audio (F11)
    │   ├── export-actions.ts      #   F22: downloadBlob/Csv/Json + shareText (Web Share
    │   │                          #     API com fallback clipboard — DOM glue)
    │    ├── observability.ts       #   Sentry env-gated (F6.3): init/reportError/
    │   │                          #   setObservabilityUser — dynamic import, no-op sem DSN
    │   ├── calculator-open.ts    #   Store compartilhado de abertura da calculadora
    │   │                          #     (header e modais abrem o mesmo painel — F9/pós-F25)
    │   └── calculator-bridge.ts   #   Injeção contextual do valor da calculadora (F9)
    │
    ├── lib/                       # Utils genéricos (sem regra financeira)
    │   ├── date.ts                #   mês YYYY-MM, ranges, currentMonth (com teste)
    │   ├── env.ts                 #   getSupabaseEnv — falha clara se VITE_* faltar
    │   ├── labels.ts              #   Labels pt-BR compartilhados (formas de pagamento, recebimento)
    │   └── utils.ts               #   cn() (clsx + tailwind-merge)
    │   # APP_START_DATE, faixas 85/90/95 → src/types/schema.ts (contrato de domínio)
    │
    ├── types/                     # Contratos de domínio TS (Receita, Despesa, Cartão…)
    ├── styles/                    # Design tokens (única fonte)
    │   ├── tokens.css             #   light / dark / oled
    │   └── globals.css            #   @theme (Tailwind v4) + base + .num/.display
    │
    └── tests/                     # Auditorias + setup do Vitest: fidelity (contratos
                                   #     db/schema/domain), axe-sanity + keyboard-navigation
                                   #     (a11y), accessibility-audit (contraste AA via
                                   #     domain/accessibility), pwa + pwa-audit, security-audit,
                                   #     quotes-core (edge de cotações), setup.ts
```

---

## 4. RESPONSABILIDADE POR DIRETÓRIO

| Diretório | Responsabilidade | O que NUNCA colocar | Exemplo de arquivo |
|---|---|---|---|
| `src/app/` | Bootstrap: providers, roteamento, registro PWA | Lógica de negócio, marcação visual extensa | `routes.tsx`, `pwa.ts` |
| `src/components/ui/` | Primitivos atômicos **agnósticos de domínio** | Regra financeira, fetch, formatação de moeda | `button.tsx`, `modal.tsx`, `money-input.tsx` |
| `src/components/modules/` | Componentes de **domínio financeiro** reutilizáveis | Fetch, lógica de cálculo (recebe props prontas) | `debt-status-badge.tsx` |
| `src/components/layout/` | Estrutura de página (sidebar/tabs/header) | Conteúdo de tela | `sidebar.tsx` |
| `src/features/` | Telas + orquestração por área funcional | Cálculo de negócio, chamada direta a `data/` | `transactions/` |
| `src/domain/` | **Motores de cálculo puros e testáveis** | Import de React/Supabase, formatação | `money/parcelar.ts` |
| `src/data/` | Integração remota (Supabase, RPCs) | Regra de negócio, estado de UI | `repositories/expenses.ts` |
| `src/state/` | Contratos `data\|loading\|error\|CRUD\|refresh` | Lógica de apresentação | `queries/useExpenses.ts` |
| `src/hooks/` | Hooks de UI reaproveitáveis (não de dados) | Fetch (isso é `state/`) | `useDebounce.ts` |
| `src/services/` | Formatação, máscaras, gateway de erros | Regra de negócio | `masks/money.ts` |
| `src/lib/` | Constantes e utils genéricos | Formatação pt-BR (é `services/`) | `date.ts` |
| `src/types/` | Tipos de domínio e contratos TS | Implementação | `expense.ts` |
| `src/styles/` | Design tokens e estilos globais | Cores hard-coded em componente | `tokens.css` |
| `public/pwa/` | Manifest, ícones, SW assets, offline | Código-fonte | `manifest.webmanifest` |
| `supabase/migrations/` | Schema, RLS e funções/RPCs versionados (fonte do banco) | Dados sensíveis/segredos | `0003_functions.sql` |
| `supabase/functions/` | Edge functions em runtime **Deno** (fora do bundle Vite; `_shared/` = motor puro compartilhado) | Segredos do servidor no corpo (só env da function); imports de `src/` | `quotes/index.ts` (F1.7) |
| `docs/` | Documentação viva (governança em §7) | Arquivos soltos de outra natureza | `PWA_GUIDELINES.md` |

---

## 5. PADRÃO INTERNO DE UMA FEATURE

Toda feature em `src/features/<nome>/` segue o mesmo esqueleto:

```
src/features/transactions/
├── index.ts                    # Barrel público da feature (exports nomeados)
├── routes.ts                   # Rotas da feature (lazy-loaded)
├── pages/                      # Views finas — apenas composição + contratos de estado
│   ├── transaction-list-page.tsx
│   └── transaction-detail-page.tsx
├── components/                 # Componentes exclusivos da feature (se houver)
│   └── month-summary.tsx
├── wizard/                     # Fluxo guiado de lançamento (D10)
│   ├── launch-wizard.tsx
│   └── steps/
│       ├── amount-step.tsx
│       ├── category-step.tsx
│       ├── payment-step.tsx
│       └── details-step.tsx
└── hooks/                      # Hooks LOCAIS (não reutilizáveis fora da feature)
    └── use-transaction-filters.ts
```

**Regras do padrão:** pages finas (sem lógica pesada) · componentes locais só se exclusivos (senão → `components/modules`) · hooks locais só se não reutilizados (senão → `src/hooks` ou `src/state`).

---

## 6. ONDE CRIAR CADA NOVO ARQUIVO (TABELA DE DECISÃO)

| Preciso de… | Crio em… |
|---|---|
| Botão, input, card, modal, badge genérico | `src/components/ui/` |
| Componente de domínio usado em 2+ telas (ex.: status de dívida) | `src/components/modules/` |
| Estrutura de página (sidebar, tabs, header) | `src/components/layout/` |
| Tela de uma área (ex.: lista de faturas) | `src/features/<área>/pages/` |
| Fluxo/componente exclusivo de uma área | `src/features/<área>/components/` ou `…/wizard/` |
| Cálculo puro (parcelas, competência, rebalanceamento) | `src/domain/<módulo>/` |
| Chamada ao Supabase / RPC transacional | `src/data/` (repositories ou `rpc.ts`) |
| Hook que expõe dados à UI | `src/state/` |
| Hook de UI reaproveitável (debounce, media query) | `src/hooks/` |
| Formatação, máscara, mensagem de erro | `src/services/` (ex.: `masks/`) |
| Constante global de domínio (APP_START_DATE, faixas) | `src/types/schema.ts` (contratos de domínio) ou `src/lib/` |
| Tipo/contrato de domínio | `src/types/` |
| Cor, fonte, raio, sombra | `src/styles/tokens.css` — **nunca** em componente |
| Manifest, ícone, splash, offline | `public/pwa/` |
| Script operacional fora do bundle (deploy/cron de edge function) | `scripts/` (ex.: `deploy-quotes.mjs`) |
| SQL de operação manual (cron da edge function de cotações) | `supabase/quotes-cron.sql` |
| Nova documentação | `docs/<UPPER_SNAKE_CASE>.md` |
| Proposta oficial de próximas fases (F14–F20) | `docs/NEXT_PHASES.md` (Trilha A: UI/UX · Trilha B: Investimentos) |
| Motor puro de gestos (axis-lock, thresholds, flick, overscroll) | `src/domain/gestures/` (ex.: `swipe.ts` — F20 · `overscroll.ts` — F26) |
| Hook de navegação por gesto (swipe horizontal) | `src/hooks/use-swipe-navigation.ts` (F20) |
| Hook de pull-up / overscroll to top (FSM + barreira de inércia) | `src/hooks/use-pull-up-to-top.ts` (F26) |
| Navegador de mês com swipe (envole o `MonthPicker`) | `src/components/modules/month-swiper.tsx` (F20) |
| Script de manutenção/ETL fora do bundle (ex.: migração de dados legados) | `scripts/` (ver `docs/DATA_MIGRATION_GUIDE.md`) |

---

## 7. GOVERNANÇA DA DOCUMENTAÇÃO (`docs/`)

- **Padronização de nomes:** arquivos em `docs/` usam `UPPER_SNAKE_CASE.md` — `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `PROJECT_STRUCTURE.md`, `PWA_GUIDELINES.md`, `ROADMAP.md`.
- **Regra de atualização contínua:** nenhuma mudança estrutural de código (novo diretório, mudança de camada, feature major, novo serviço) pode ser concluída **sem atualizar o documento correspondente** em `docs/` — e `AGENTS.md` quando aplicável.
- **Antes de implementar, consulte:** `PROJECT_STRUCTURE.md` (onde criar) · `ARCHITECTURE.md` (como estruturar) · `ESPECIFICACAO_TECNICA.md` (regras de negócio) · `DESIGN_SYSTEM.md` (visual) · `PWA_GUIDELINES.md` (quando envolver PWA).

---

## 8. REGRAS DE OURO (NUNCA)

1. **Nada de pastas genéricas:** `utils/`, `helpers/`, `commons/`, `misc/`, `shared/` são proibidas — cada util vai para `lib/` ou `services/` com responsabilidade clara.
2. **Nada solto na raiz:** arquivos novos na raiz do projeto só com autorização explícita (config de build/CI/editor).
3. **Sem diretórios novos de topo** (`src/*` novo, novo segmento em `public/`) sem autorização — e sempre com atualização deste documento.
4. **Sem duplicação de UI:** componente reutilizado em 2+ lugares é extraído (ver `AGENTS.md` §4).
5. **Barrels:** toda pasta com `index.ts` e exports nomeados (sem `export default`).
6. **Cores/fontes/raios/sombras** sempre via tokens (`src/styles/tokens.css`) — nunca hex/fonte hard-coded em componente.
7. **Zero elementos nativos de controle** (DESIGN_SYSTEM §13): select, checkbox, radio, date, file, range, `alert/confirm/prompt` e `<dialog>` são substituídos por primitivos próprios em `components/ui/` seguindo a identidade. Inputs de texto só via `Input`/`MoneyInput`/`Textarea`.
