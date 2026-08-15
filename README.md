# Guia Financeiro

Aplicativo web **100% Online First** de **gestão financeira pessoal** (receitas, despesas, cartões, dívidas, orçamentos, relatórios, insights e projeção) + **motor de rebalanceamento de carteira** (metas e valor de aporte).

- **Stack:** React 18+ (Vite) · TypeScript estrito · Tailwind CSS · shadcn/ui · TanStack Query · Supabase (Postgres + RLS + Auth)
- **Idioma do produto e dos docs:** pt-BR

---

## Documentação oficial (leia antes de codar)

| Documento | Papel |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras de governança da workspace — vinculam qualquer agente/humano |
| [`ESPECIFICACAO_TECNICA.md`](ESPECIFICACAO_TECNICA.md) | Spec executável: regras de negócio, schema, UI/UX, decisões D1–D12 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Camadas, dependências, convenções e estratégia de estado |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Árvore de pastas e onde criar cada arquivo |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Identidade visual e design tokens |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Plano de execução canônico — fases, ordem e Definition of Done |
| [`docs/FASES_IMPLEMENTADAS.md`](docs/FASES_IMPLEMENTADAS.md) | Resumo de cada fase implementada (F0–F28): problema e solução |
| [`docs/NEXT_PHASES.md`](docs/NEXT_PHASES.md) | Propostas de novas fases (Trilha A: UI/UX · Trilha B: Investimentos) |
| [`docs/PWA_GUIDELINES.md`](docs/PWA_GUIDELINES.md) | Requisitos PWA (manifest, service worker, instalação) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploy (Vercel + Supabase), env vars e checklist de prontidão |

---

## Setup local

### Pré-requisitos

- Node.js 20+ · npm 10+
- Supabase CLI (para banco local, migrations e edge functions)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o ambiente

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
# (Supabase Dashboard > Project Settings > API)
```

> O `.env.example` é a referência oficial das variáveis — veja os comentários de cada uma. Variáveis de servidor (`SUPABASE_*`) são usadas apenas fora do bundle (CLI, edge functions, CI/CD).

### 3. Subir o banco local (opcional — necessário para migrations/RPCs)

```bash
npm run db:start
npm run db:push        # aplica migrations/ no banco local
npm run db:types       # regenera src/types/database.ts a partir do banco local
```

---

## Comandos

| Comando | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run typecheck` | Verificação de tipos (`tsc -b`) |
| `npm run lint` | ESLint (inclui regra `local/no-decorative-unicode`) |
| `npm run test` | Suíte completa de testes (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run build` | Build de produção (`tsc -b && vite build`) |
| `npm run preview` | Pré-visualização do build |
| `npm run format` | Prettier |
| `npm run icons` | Regenera ícones PWA/brand a partir de `identidadeVisual/` |
| `npm run quotes:deploy` | Deploy da edge function de cotações |
| `npm run quotes:cron` | Gera/aplica o cron da edge function de cotações |

---

## Estrutura resumida

```
src/
├── app/          # Router, providers, PWA, tema
├── components/   # ui/ (primitivos) + modules/ (domínio) + layout/
├── data/         # Repositórios Supabase/RPC (só importado por state/)
├── domain/       # Motores de cálculo PUROS (sem React/Supabase) + testes
├── features/     # Telas por domínio (pages/ + components/ + hooks/)
├── hooks/        # Hooks de UI reaproveitáveis
├── lib/          # Constantes e utils genéricos
├── services/     # Apresentação: máscaras, erros, haptics, export
├── state/        # TanStack Query (queries + mutations)
├── styles/       # globals.css + tokens.css
└── types/        # Contratos de domínio + Database (schema.ts, database.ts)
```

A árvore completa e as regras de criação de arquivos estão em [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

---

## Verificação antes de terminar

1. `npm run typecheck` — zero erros de tipo
2. `npm run lint` — zero erros (inclui bloqueio de emojis/caracteres decorativos em `src/`)
3. `npm run test` — suíte verde (inclui testes obrigatórios de `domain/`, RPCs e validações)
4. `npm run build` — bundle compila

---

## Deploy

Frontend na **Vercel** + **Supabase** (Postgres + RLS + Auth). Guia completo, env vars e checklist de prontidão em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
