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
| `src/api` | `src/data/` + `src/state/` | `data/` = integração remota (Supabase/RPC/R2); `state/` = contratos para a UI |
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
│   ├── favicon.ico
│   └── pwa/                       # Artefatos PWA — ver PWA_GUIDELINES.md
│       ├── manifest.webmanifest
│       ├── icons/                 # icon-192, icon-512, maskable-512, apple-touch-icon-180
│       ├── screenshots/           # 1280x800 (desktop) + 720x1280 (mobile)
│       └── offline.html           # Fallback offline (App Shell mínimo)
│
├── supabase/                      # Backend — ver ESPECIFICAÇÃO §2 (migrations versionadas)
│   └── migrations/                # 0001_schema.sql · 0002_rls.sql · 0003_functions.sql
│                                  # (schema, RLS por auth.uid(), triggers + RPCs transacionais)
│
└── src/
    ├── main.tsx                   # Entry point: ReactDOM + registerPWA()
    ├── app/                       # Bootstrap e orquestração (SEM lógica de negócio)
    │   ├── providers.tsx          # AuthProvider, QueryClientProvider, ThemeProvider
    │   ├── router.tsx             # <Routes> a partir de routes.ts
    │   ├── routes.ts              # Mapa de rotas + deep-links (?card=, ?month=, ?q=)
    │   └── pwa.ts                 # Registro SW (autoUpdate + toast) + stores de
    │                              #   instalação/atualização (PWA_GUIDELINES §6)
    │
    ├── components/
    │   ├── ui/                    # PRIMITIVOS genéricos (sem domínio): button, input,
    │   │   │                      #   card, badge, modal, tabs, skeleton, empty-state,
    │   │   │                      #   virtual-list (F5.5), toast, scroll-to-top-button (F11)…
    │   │   └── index.ts
    │   ├── modules/               # Componentes de DOMÍNIO reutilizáveis: kpi-card,
    │   │   │                      #   category-icon(+icons), month-picker, transaction-row,
    │   │   │                      #   budget-progress-bar, debt-status-badge,
    │   │   │                      #   invoice-status-badge, installment-badge,
    │   │   │                      #   onboarding-card, pwa-update-toast,
    │   │   │                      #   install-app-button (F5.6), smart-spending-pace-card,
    │   │   │                      #   smart-invoice-projection-card, smart-anomalies-card (F10),
    │   │   │                      #   floating-calculator, calculator-keypad (F11)…
    │   │   └── index.ts
    │   └── layout/                # Estrutura de página: sidebar (collapsible F9), bottom-nav (5 slots F9),
    │       │                      #   app-header, page-shell
    │       └── index.ts
    │
    ├── features/                  # ÁREAS funcionais — padrão interno em §5
    │   ├── overview/              #   Visão Geral (KPIs, fluxo diário, smart cards F10)
    │   ├── transactions/          #   Transações + wizard de lançamento
    │   ├── cards/                 #   Cartões (faturas, pagamentos, estornos)
    │   ├── debts/                 #   Dívidas (status, quitação integrada)
    │   ├── budgets/               #   Orçamentos (limites, realocação)
    │   ├── reports/               #   Relatórios
    │   ├── insights/              #   Insights, projeção e corte
    │   ├── reminders/             #   Lembretes (central de notificações)
    │   ├── settings/              #   Configurações (preferências, perfil)
    │   └── portfolio/             #   Carteira, metas, calculadora de aporte
    │
    ├── domain/                    # MOTORES DE CÁLCULO PUROS (sem React/Supabase)
    │   ├── onboarding/             #   checklist/progresso do primeiro uso (F5.4)
    │   ├── money/                 #   parcelamento em centavos, arredondamento, parsing
    │   ├── competence/            #   resolveBillCompetence, clampDay, overrides
    │   ├── debts/                 #   status derivado (overdue/due_today/due_soon/…)
    │   ├── cards/                 #   saldo de fatura, status da fatura (closed/open/near_due/overdue)
    │   ├── reports/               #   peso de relatório (base × weight)
    │   ├── insights/              #   alertas, assinaturas, recorrências, confiança
    │   ├── projection/            #   gasto disponível, ritmo, fim de mês, pendências
    │   ├── search/                #   busca global: normalização, scoring, bônus de recência
    │   ├── virtualization/        #   janela de renderização de listas (F5.5)
    │   ├── calculator/            #   motor puro de operações e divisão de parcelas (F11)
    │   └── portfolio/             #   ledger, custo médio, valoração, rebalanceamento
    │
    ├── data/                      # INTEGRAÇÃO REMOTA
    │   ├── client.ts              #   Cliente Supabase único (env centralizado)
    │   ├── repositories/          #   expenses.ts, incomes.ts, cards.ts, debts.ts,
    │   │                          #   budgets.ts, portfolio.ts, categories.ts,
    │   │                          #   onboarding.ts (contagens do primeiro uso)
    │   └── rpc.ts                 #   Wrappers tipados dos RPCs transacionais (D1)
    │
    ├── state/                     # CONTRATOS DE ESTADO para a UI
    │   ├── queries/               #   useExpenses({month}), useInvoices(cardId)…
    │   └── mutations.ts           #   useCreateExpense(), useDeleteInstallment()…
    │
    ├── hooks/                     # Hooks de UI reaproveitáveis (use-auth,
    │                              #   use-highlight-target, use-pwa-install,
    │                              #   use-draggable, use-scroll-position…)
    ├── services/                  # Apresentação + integrações
    │   ├── format/                #   moeda, datas, percentuais (pt-BR)
    │   ├── masks/                 #   máscaras de input
    │   ├── errors/                #   Gateway de erros: index.ts (classifyError +
    │   │                          #   getErrorMessage pt-BR) + index.test.ts
    │   ├── observability.ts       #   Sentry env-gated (F6.3): init/reportError/
    │   │                          #   setObservabilityUser — dynamic import, no-op sem DSN
    │   ├── storage/               #   Abstração Cloudflare R2 (presigned URLs)
    │   └── calculator-bridge.ts   #   Injeção contextual do valor da calculadora (F11)
    │
    ├── lib/                       # Constantes e utils genéricos
    │   ├── constants.ts           #   APP_START_DATE, faixas 85/90/95, limites…
    │   ├── labels.ts              #   Labels pt-BR compartilhados (formas de pagamento, recebimento)
    │   └── utils.ts               #   funções sem domínio financeiro (clamp, soma…)
    │
    ├── types/                     # Contratos de domínio TS (Receita, Despesa, Cartão…)
    ├── styles/                    # Design tokens (única fonte)
    │   ├── tokens.css             #   light / dark / oled
    │   └── globals.css            #   @theme (Tailwind v4) + base + .num/.display
    │
    └── tests/                     # Helpers, fixtures, setup do Vitest
```

---

## 4. RESPONSABILIDADE POR DIRETÓRIO

| Diretório | Responsabilidade | O que NUNCA colocar | Exemplo de arquivo |
|---|---|---|---|
| `src/app/` | Bootstrap: providers, roteamento, registro PWA | Lógica de negócio, marcação visual extensa | `routes.ts`, `pwa.ts` |
| `src/components/ui/` | Primitivos atômicos **agnósticos de domínio** | Regra financeira, fetch, formatação de moeda | `button.tsx`, `modal.tsx`, `money-input.tsx` |
| `src/components/modules/` | Componentes de **domínio financeiro** reutilizáveis | Fetch, lógica de cálculo (recebe props prontas) | `debt-status-badge.tsx` |
| `src/components/layout/` | Estrutura de página (sidebar/tabs/header) | Conteúdo de tela | `sidebar.tsx` |
| `src/features/` | Telas + orquestração por área funcional | Cálculo de negócio, chamada direta a `data/` | `transactions/` |
| `src/domain/` | **Motores de cálculo puros e testáveis** | Import de React/Supabase, formatação | `money/parcelar.ts` |
| `src/data/` | Integração remota (Supabase, RPCs, R2) | Regra de negócio, estado de UI | `repositories/expenses.ts` |
| `src/state/` | Contratos `data\|loading\|error\|CRUD\|refresh` | Lógica de apresentação | `queries/useExpenses.ts` |
| `src/hooks/` | Hooks de UI reaproveitáveis (não de dados) | Fetch (isso é `state/`) | `useDebounce.ts` |
| `src/services/` | Formatação, máscaras, gateway de erros, storage | Regra de negócio | `format/money.ts` |
| `src/lib/` | Constantes e utils genéricos | Formatação pt-BR (é `services/`) | `constants.ts` |
| `src/types/` | Tipos de domínio e contratos TS | Implementação | `expense.ts` |
| `src/styles/` | Design tokens e estilos globais | Cores hard-coded em componente | `tokens.css` |
| `public/pwa/` | Manifest, ícones, SW assets, offline | Código-fonte | `manifest.webmanifest` |
| `supabase/migrations/` | Schema, RLS e funções/RPCs versionados (fonte do banco) | Dados sensíveis/segredos | `0003_functions.sql` |
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
| Formatação, máscara, mensagem de erro | `src/services/` |
| Constante global (APP_START_DATE, faixas) | `src/lib/constants.ts` |
| Tipo/contrato de domínio | `src/types/` |
| Cor, fonte, raio, sombra | `src/styles/tokens.css` — **nunca** em componente |
| Manifest, ícone, splash, offline | `public/pwa/` |
| Nova documentação | `docs/<UPPER_SNAKE_CASE>.md` |

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
