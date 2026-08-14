# 🚀 DEPLOYMENT.md — Guia de Deploy e Pleno Funcionamento

> **Status:** guia validado contra o código atual (Fase 5 concluída — commit `d47c938`).
> Stack: **Vercel** (frontend Vite/React) + **Supabase** (Postgres + RLS + Auth + RPCs) + **Cloudflare R2** (storage, futuro).
> O app é **100% Online First**: dados vivem na nuvem; o PWA cacheia apenas o App Shell e assets estáticos.

---

## 1. VISÃO GERAL DA ARQUITETURA DE PRODUÇÃO

```
┌─────────────────┐        ┌──────────────────────────────┐
│  Vercel (Vite)  │ ─────► │  Supabase (Postgres 17)     │
│  / (SPA + PWA)  │  HTTPS │  ├─ Auth (email/senha)       │
│  /pwa/*         │        │  ├─ RLS (todas as tabelas)   │
└─────────────────┘        │  ├─ RPCs transacionais (D1)  │
        │                  │  └─ Migrations versionadas   │
        └──► (futuro) Cloudflare R2 (presigned URLs)
```

- **Frontend:** Vercel — `vercel.json` já configurado (SPA rewrites, headers de segurança, cache PWA).
- **Backend:** Supabase — migrations em `supabase/migrations/` (0001–0008: schema, RLS, RPCs, overrides, metas).
- **Auth:** Supabase Auth (email/senha) + trigger `handle_new_user` (cria `profiles` e `user_preferences` automaticamente).
- **Cotações:** tabela `asset_prices` com cache global (`user_id NULL`) + override manual do usuário. O cache global é escrito por uma **edge function** (pendente — ver §7).

---

## 2. PRÉ-REQUISITOS

| Item | Versão | Observação |
|---|---|---|
| Node.js | ≥ 20.11 | definido em `engines` do `package.json` |
| Conta Vercel | — | plano gratuito suficiente |
| Projeto Supabase | — | criar em `supabase.com` (região próxima dos usuários) |
| Supabase CLI (opcional) | ≥ 2.114 | `npm run db:*` — requer `supabase/config.toml` local |

---

## 3. PASSOS DE DEPLOY — PASSO A PASSO

### 3.1 Supabase: criar o projeto e aplicar o schema

1. Crie o projeto em [supabase.com/dashboard](https://supabase.com/dashboard) (anote `Project URL` e `anon key` em **Settings → API**).
2. Aplique as migrations **na ordem** (0001 → 0008). Duas opções:
   - **Dashboard (SQL Editor):** cole o conteúdo de cada `supabase/migrations/*.sql` em ordem.
   - **CLI (recomendado):**
     ```bash
     # liga o repositório local ao projeto remoto (uma vez)
     npx supabase link --project-ref <PROJECT_REF>
     # aplica as migrations pendentes
     npx supabase db push
     ```
3. **Importante — RLS:** as migrations 0002 e 0006 já criam todas as policies (`*_all_own` por `auth.uid()`). Nenhuma leitura cross-user é possível. Não desative o RLS.
4. **Auth — configurar URLs de redirect** (Settings → Auth → URL Configuration):
   - `Site URL`: `https://<SEU-DOMINIO-VERCEL>` (ex.: `https://financas.vercel.app`)
   - `Redirect URLs`: adicionar `https://<SEU-DOMINIO-VERCEL>/**` (o app usa `emailRedirectTo`/`redirectTo` no signup e reset de senha).
   - Os valores locais já estão no `supabase/config.toml` (`additional_redirect_urls`).
5. **Auth — e-mail de confirmação:** o cadastro exige confirmação de e-mail (`needsEmailConfirmation`). Configure o provedor de SMTP em **Settings → Auth → SMTP** (ou use o e-mail padrão do Supabase em ambiente de teste — com limite baixo).
6. **Verifique:** `npm run db:status` ou abra o SQL Editor e confirme as 19 tabelas + RPCs.

### 3.2 Vercel: importar e configurar o projeto

1. Vá em [vercel.com/new](https://vercel.com/new), importe o repositório `financasNew`.
2. O `vercel.json` já define: framework Vite, `buildCommand: npm run build`, `outputDirectory: dist`, SPA rewrites e headers.
3. **Variáveis de ambiente** (Project Settings → Environment Variables) — as **únicas obrigatórias**:

   | Variável | Valor | Onde obter |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → Settings → API → Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon public key |

   > ⚠️ Use a **anon key** (pública). A `service_role` NUNCA vai para o cliente (RLS depende disso).
   > Outras variáveis do `.env.example` (`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_*`, `SUPABASE_FUNCTION_URL`, `QUOTES_CRON_SCHEDULE`) são **só de servidor/CLI/edge functions** — não necessárias para o frontend funcionar hoje.
   > **Opcional — Sentry (F6.3):** crie um projeto em [sentry.io](https://sentry.io), copie o DSN (Settings → Projects → Client Keys) e adicione `VITE_SENTRY_DSN`. Sem essa variável o app funciona normalmente (o SDK nem entra no bundle); com ela, erros de produção + Web Vitals (LCP/INP/CLS) são reportados e correlacionados ao usuário logado.

4. Clique em **Deploy**. O build roda `tsc -b && vite build` (typecheck + bundle com code-splitting + geração do Service Worker PWA).

### 3.3 Verificação pós-deploy

1. Abra `https://<SEU-DOMINIO>/entrar` → crie uma conta → o trigger cria `profiles` + `user_preferences`.
2. Crie categorias, um cartão e um lançamento (o onboarding guia — F5.4).
3. Confirme o PWA: abra o app no Chrome, instale (ícone na barra de endereço) e verifique offline (App Shell via Service Worker).
4. Rode o Lighthouse (mobile) em produção — baseline F5: alvo ≥ 90 (performance/PWA/a11y).

---

## 4. VARIÁVEIS DE AMBIENTE — REFERÊNCIA COMPLETA

| Variável | Onde é usada | Obrigatória p/ produção? |
|---|---|---|
| `VITE_SUPABASE_URL` | Cliente (bundle) — `src/lib/env.ts` | ✅ **Sim** |
| `VITE_SUPABASE_ANON_KEY` | Cliente (bundle) — `src/lib/env.ts` | ✅ **Sim** |
| `VITE_SENTRY_DSN` | Observabilidade (F6.3) — `src/services/observability.ts` | ❌ opcional (sem DSN = sem Sentry) |
| `SUPABASE_DB_URL` | CLI/CI/edge functions (fora do bundle) | ❌ só p/ CLI/migrações |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor/edge functions (fora do bundle) | ❌ só p/ edge functions |
| `SUPABASE_FUNCTION_URL` | Edge functions de cotações (futuro) | ❌ pendente (§7) |
| `QUOTES_CRON_SCHEDULE` | Cron da edge function de cotações | ❌ pendente (§7) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Storage (futuro — presigned URLs) | ❌ não usado no código atual |

---

## 5. COMANDOS ÚTEIS (LOCAL)

```bash
npm install          # instala dependências
cp .env.example .env.local   # preencha VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

npm run dev          # dev server (Vite)
npm run typecheck    # tsc -b (valida TODO o projeto, inclusive testes)
npm run lint         # eslint (0 erros esperado)
npm run test         # vitest — 453 testes (65 arquivos)
npm run build        # tsc -b && vite build (gera dist/ + Service Worker)
npm run preview      # serve dist/ localmente (testa o build de produção)

# Supabase local (opcional)
npx supabase start   # sobe Postgres local
npx supabase db reset  # aplica migrations + seed
```

---

## 6. O QUE JÁ ESTÁ PRONTO (auditado)

- ✅ **Migrations completas:** 0001 schema (19 tabelas), 0002 RLS (policies por usuário), 0003 RPCs transacionais (parcelamento, dívidas, cartões, orçamentos, categorias), 0004–0008 (cartões/dívidas, budgets, lembretes, override de preço, metas de alocação).
- ✅ **Auth funcional:** login/cadastro/recuperação + trigger `handle_new_user` (profiles + preferências) + RLS.
- ✅ **Build de produção:** `tsc -b` limpo, `vite build` ok, code-splitting por página, SW gerado (43 entradas precached).
- ✅ **PWA:** manifest (`/pwa/manifest.webmanifest`), ícones (192/512/maskable/apple-touch), `offline.html`, registro `autoUpdate`.
- ✅ **Segurança:** headers no `vercel.json` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy), cache imutável para assets.
- ✅ **Testes:** 453 verdes (domínio puro, RPCs, telas, a11y com axe, teclado, deep-links).
- ✅ **Erros de rede:** gateway único (`getErrorMessage` pt-BR) + retry manual em todas as telas.

---

## 7. ITENS PENDENTES PARA PLENO FUNCIONAMENTO

> O app **funciona** sem estes itens, mas com limitações. Ordem sugerida de prioridade:

| # | Item | Impacto se ausente | Onde implementar |
|---|---|---|---|
| 1 | **Edge function de cotações** (atualiza `asset_prices` com `user_id NULL` + cron) | Ativos sem preço manual ficam com **fallback** (`0` p/ BRL, `5,25` p/ USD) e badge "referência". O usuário pode digitar preço manual na carteira como contorno. | `supabase/functions/quotes/` (leitura de API de cotações + upsert em lote + cron pg_cron ou Supabase Cron) |
| 2 | **Storage R2** (`src/services/storage/`) | Nenhuma tela usa upload hoje — apenas documentado no env. | `src/services/storage/` + edge function de presigned URLs |
| 3 | **F5.6 — PWA polish** | PWA instalável, mas sem prompt `beforeinstallprompt` customizado e sem toast de atualização automática. | `src/app/pwa.ts` + UI (ROADMAP F5.6) |
| 4 | **CI/CD de produção** | Deploy manual via Vercel (git push já dispara; sem gates de testes no CI). | GitHub Actions: `npm ci && typecheck && lint && test` antes do deploy |
| 5 | ~~Observabilidade (Sentry)~~ | **✅ Feito (F6.3)** — SDK env-gated por `VITE_SENTRY_DSN` (bundle separado, Web Vitals + erros + usuário). | basta configurar o DSN na Vercel |
| 6 | **Testes contra banco real** | RPCs testados via mocks; sem prova de RLS/rollback em Postgres real. | vitest + Supabase local (ROADMAP F6.1) |

---

## 8. CHECKLIST RÁPIDO DE PRONTIDÃO

```markdown
[ ] Projeto Supabase criado e migrations 0001–0008 aplicadas (19 tabelas + RPCs)
[ ] RLS ativo com policies por usuário (Settings → Database → RLS)
[ ] Auth: Site URL e Redirect URLs apontando para o domínio Vercel
[ ] Auth: SMTP configurado (confirmação de e-mail no cadastro)
[ ] Vercel: repo importado, buildCommand `npm run build`, output `dist`
[ ] Vercel: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY configuradas
[ ] Deploy verde: typecheck + lint + 453 testes + build
[ ] Login/cadastro/recuperação funcionando em produção
[ ] Onboarding guiado (criar categorias/cartão/lançamento) funcional
[ ] PWA instalável + App Shell offline
[ ] Lighthouse mobile ≥ 90 (baseline)
[ ] (Futuro) Edge function de cotações + R2 storage + CI/CD · [ ] Sentry: adicionar `VITE_SENTRY_DSN` na Vercel quando quiser ativar
```

---

## 9. TROUBLESHOOTING COMUM

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Configuração incompleta: VITE_SUPABASE_URL...` na tela | Env vars não setadas no Vercel | Adicionar as 2 variáveis (§3.2) e redeploy |
| Erro de auth no signup (`redirect_to` não permitido) | Redirect URL não na allowlist | Settings → Auth → URL Configuration |
| Cadastro não entra (tela de confirmação) | Confirmação de e-mail pendente | Configurar SMTP ou confirmar via link do e-mail |
| Carteira mostra preço "referência" (0/5,25) | Edge function de cotações não criada | Implementar §7.1 ou usar preço manual |
| 403/`new row violates row-level security` | RLS bloqueando operação | Verificar policies em 0002/0006 (não desativar RLS) |
| PWA não instala | HTTPS + manifest válido exigidos | Publicar em HTTPS (Vercel já provê) |
