# Áxis Finance

Aplicativo web **100% Online First** de **gestão financeira pessoal** (receitas, despesas, cartões, dívidas, orçamentos, relatórios, insights e projeção) + **motor de rebalanceamento de carteira** (metas e valor de aporte).

- **Stack:** React 18+ (Vite) · TypeScript estrito · Tailwind CSS · shadcn/ui · TanStack Query · Supabase (Postgres + RLS + Auth) · Capacitor (Android)
- **Idioma do produto e dos docs:** pt-BR

---

## Documentação oficial (leia antes de codar)

| Categoria | Documento | Papel |
|---|---|---|
| **Governança & Regras** | [`AGENTS.md`](AGENTS.md) | Regras de governança da workspace — vinculam qualquer agente/humano |
| **Arquitetura & Specs** | [`docs/architecture/ESPECIFICACAO_TECNICA.md`](docs/architecture/ESPECIFICACAO_TECNICA.md) | Spec executável: regras de negócio, schema, UI/UX, decisões D1–D12 |
| | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) | Camadas, dependências, convenções e estratégia de estado |
| | [`docs/architecture/PROJECT_STRUCTURE.md`](docs/architecture/PROJECT_STRUCTURE.md) | Árvore de pastas oficial e onde criar cada arquivo |
| | [`docs/architecture/FINANCIAL_MATH_SPEC.md`](docs/architecture/FINANCIAL_MATH_SPEC.md) | Especificação canônica de engenharia e precisão matemática financeira |
| | [`docs/architecture/DATA_MIGRATION_GUIDE.md`](docs/architecture/DATA_MIGRATION_GUIDE.md) | Guia de migração e batimento de dados legados |
| | [`docs/architecture/RECONSTRUCAO.md`](docs/architecture/RECONSTRUCAO.md) | Spec funcional original (fonte histórica) |
| **Design System** | [`docs/design/DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md) | Identidade visual, tokens de design e regras DRY de interface |
| **Plataformas & Deploy** | [`docs/platforms/DEPLOYMENT.md`](docs/platforms/DEPLOYMENT.md) | Deploy (Cloudflare Pages + Supabase), env vars e checklist de prontidão |
| | [`docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md`](docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md) | Distribuição Android Pro, keystore e in-app updater via Cloudflare R2 |
| | [`docs/platforms/PWA_GUIDELINES.md`](docs/platforms/PWA_GUIDELINES.md) | Requisitos PWA (manifest, service worker, instalação offline) |
| | [`docs/platforms/EMAIL_TEMPLATES.md`](docs/platforms/EMAIL_TEMPLATES.md) | Templates de e-mail transacionais responsivos e guia SMTP |
| **Operação & Negócio** | [`docs/operations/FOUNDER_RUNBOOK.md`](docs/operations/FOUNDER_RUNBOOK.md) | Manual operacional do fundador: suporte Telegram, admin, faturamento Asaas e incidentes |
| | [`docs/operations/SECURITY_GOVERNANCE.md`](docs/operations/SECURITY_GOVERNANCE.md) | Governança de segurança, criptografia, proteção de PII e LGPD |
| | [`docs/operations/PROJETO_SAAS.md`](docs/operations/PROJETO_SAAS.md) | Modelo de precificação SaaS, trial de 30 dias e conformidade CDC |
| **Roadmap & Releases** | [`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md) | Plano de execução canônico — fases, ordem e Definition of Done |
| | [`docs/roadmap/RELEASE.md`](docs/roadmap/RELEASE.md) | Checklist de release, versão e homologação |

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
| `npm run typecheck` | Verificação estrita de tipos (`tsc -b`) |
| `npm run lint` | ESLint (inclui regra `local/no-decorative-unicode`) |
| `npm run test` | Suíte completa de testes (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run build` | Build de produção (`tsc -b && vite build`) |
| `npm run preview` | Pré-visualização do build |
| `npm run preflight` | Diagnóstico pré-voo automatizado de prontidão operacional e produção (7 dimensões) |
| `npm run format` | Prettier |
| `npm run icons` | Regenera ícones PWA/brand a partir de `public/brand/` |
| `npm run quotes:deploy` | Deploy da edge function de cotações |
| `npm run quotes:cron` | Gera/aplica o cron da edge function de cotações |
| `npm run cap:sync` | Sincroniza assets web com o projeto nativo Android |
| `npm run cap:open` | Abre o projeto Android no Android Studio |
| `npm run cap:build` | Build web + sincronização Android |
| `npm run build:apk` | Pipeline automatizado de compilação de APKs em 1 comando |
| `npm run upload:apk` | Upload de APKs e version.json para o Cloudflare R2 |

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

Frontend no **Cloudflare Pages** + **Supabase** (Postgres + RLS + Auth). Guia completo, env vars e checklist de prontidão em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
