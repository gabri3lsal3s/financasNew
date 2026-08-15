# 🚀 DEPLOYMENT.md — Guia de Deploy e Pleno Funcionamento

> **Status:** guia validado contra o código atual (Fase 5 concluída — commit `d47c938`).
> Stack: **Vercel** (frontend Vite/React) + **Supabase** (Postgres + RLS + Auth + RPCs).
> O app é **100% Online First**: dados vivem na nuvem; o PWA cacheia apenas o App Shell e assets estáticos.

---

## 1. VISÃO GERAL DA ARQUITETURA DE PRODUÇÃO

```
┌─────────────────┐        ┌──────────────────────────────┐
│  Vercel (Vite)  │ ─────► │  Supabase (Postgres 17)     │
│  / (SPA + PWA)  │  HTTPS │  ├─ Auth (email/senha)       │
│  /pwa/*         │        │  ├─ RLS (todas as tabelas)   │
└─────────────────┘        │  ├─ RPCs transacionais (D1)  │
                           │  └─ Migrations versionadas   │
                           └──────────────────────────────┘
```

- **Frontend:** Vercel — `vercel.json` já configurado (SPA rewrites, headers de segurança, cache PWA).
- **Backend:** Supabase — migrations em `supabase/migrations/` (0001–0010: schema, RLS, RPCs, overrides, metas, metas de alocação, backfill de perfis, restauração de backup F22).
- **Auth:** Supabase Auth (email/senha) + trigger `handle_new_user` (cria `profiles` e `user_preferences` automaticamente).
- **Cotações:** tabela `asset_prices` com cache global (`user_id NULL`) + override manual do usuário. O cache global é escrito pela **edge function `quotes`** (implementada em `supabase/functions/quotes/` — F1.7; falta deploy + cron — ver §7.1).

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
2. Aplique as migrations **na ordem** (0001 → 0010). Duas opções:
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
   > Outras variáveis do `.env.example` (`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_FUNCTION_URL`, `QUOTES_CRON_SCHEDULE`) são **só de servidor/CLI/edge functions** — não necessárias para o frontend funcionar hoje.
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
| `SUPABASE_FUNCTION_URL` | Edge functions de cotações (futuro) | ✅ definida — consumida pelos scripts `quotes:deploy`/`quotes:cron` (§7.1) |
| `QUOTES_CRON_SCHEDULE` | Cron da edge function de cotações | ✅ definida — consumida pelo `quotes:cron` (§7.1) |

---

## 5. COMANDOS ÚTEIS (LOCAL)

```bash
npm install          # instala dependências
cp .env.example .env.local   # preencha VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

npm run dev          # dev server (Vite)
npm run typecheck    # tsc -b (valida TODO o projeto, inclusive testes)
npm run lint         # eslint (0 erros esperado)
npm run test         # vitest — 1079 testes (140 arquivos)
npm run build        # tsc -b && vite build (gera dist/ + Service Worker)
npm run preview      # serve dist/ localmente (testa o build de produção)

# Supabase local (opcional)
npx supabase start   # sobe Postgres local
npx supabase db reset  # aplica migrations + seed
```

---

## 6. O QUE JÁ ESTÁ PRONTO (auditado)

- ✅ **Migrations completas:** 0001 schema (19 tabelas), 0002 RLS (policies por usuário), 0003 RPCs transacionais (parcelamento, dívidas, cartões, orçamentos, categorias), 0004–0008 (cartões/dívidas, budgets, lembretes, override de preço, metas de alocação), 0009 (backfill idempotente de `profiles` + `user_preferences`), 0010 (`restore_backup` — restauração integral de backup F22).
- ✅ **Auth funcional:** login/cadastro/recuperação + trigger `handle_new_user` (profiles + preferências) + RLS.
- ✅ **Build de produção:** `tsc -b` limpo, `vite build` ok, code-splitting por página, SW gerado (50 entradas precached).
- ✅ **PWA:** manifest (`/pwa/manifest.webmanifest`), ícones (192/512/maskable/apple-touch), `offline.html`, registro `autoUpdate`, **prompt de instalação** (`beforeinstallprompt` via `InstallAppButton` no menu "Mais") e **toast de atualização automática** (F5.6) — auditoria PWA automatizada em `tests/pwa-audit.test.ts`.
- ✅ **Segurança:** headers no `vercel.json` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy), cache imutável para assets.
- ✅ **Testes:** 1079 verdes (domínio puro, RPCs, telas, a11y com axe, teclado, deep-links, auditorias).
- ✅ **Erros de rede:** gateway único (`getErrorMessage` pt-BR) + retry manual em todas as telas.

---

## 7. ITENS PENDENTES PARA PLENO FUNCIONAMENTO

> O app **funciona** sem estes itens, mas com limitações. Ordem sugerida de prioridade:

| # | Item | Impacto se ausente | Onde implementar |
|---|---|---|---|
| 1 | ~~**Edge function de cotações**~~ | **✅ Implementada (F1.7)** — `supabase/functions/quotes/` (Deno) + motor puro testado (15 testes). **Falta apenas deploy + cron.** | deploy: `supabase functions deploy quotes --project-ref <ref>`; agendar: pg_cron (abaixo) ou Supabase Cron |
| 2 | ~~**Deploy de produção**~~ | **✅ Funcional (confirmado 2026-08-15)** — frontend no Vercel + Supabase remoto; env vars configuradas. `deploy.yml` pronto para o CI/CD automatizado (gates + deploy condicional quando os secrets GitHub existirem). | GitHub → Settings → Secrets: `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID` |
| 3 | ~~Observabilidade (Sentry)~~ | **✅ Feito (F6.3)** — SDK env-gated por `VITE_SENTRY_DSN` (bundle separado, Web Vitals + erros + usuário). | basta configurar o DSN na Vercel |
| 4 | **Testes contra banco real** | RPCs testados via mocks; sem prova de RLS/rollback em Postgres real. | vitest + Supabase local (ROADMAP **F1** — DoD: isolamento RLS + rollback de RPCs; exige Docker local) |
| 5 | **QA final multi-dispositivo + release** | Checklist documentado (RELEASE.md) mas não executado manualmente. | `docs/RELEASE.md` — matriz de 16 fluxos em desktop/mobile × 3 temas × 6 acentos |

### 7.1 Edge function de cotações — deploy & cron

> Scripts prontos: `npm run quotes:deploy` e `npm run quotes:cron` (lêem o `.env` local — ref do projeto, service role e schedule).

```bash
# 1. Deploy (a autenticação usa o service role no corpo da função):
npm run quotes:deploy
# equivalente: supabase functions deploy quotes --project-ref <SEU_REF>

# 2. Gerar o SQL do agendamento já preenchido (a cada 6h por padrão):
npm run quotes:cron
#   → copie a saída para o SQL Editor do Supabase (Dashboard > SQL Editor) e execute.
#   Requer as extensões pg_cron e pg_net (Dashboard > Database > Extensions).

# 3. Teste manual:
curl -X POST 'https://<REF>.supabase.co/functions/v1/quotes' \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```

- **SQL versionado:** `supabase/quotes-cron.sql` (idempotente, com placeholders `<CRON_SCHEDULE>`/`<FUNCTION_URL>`/`<SERVICE_ROLE_KEY>`); o `npm run quotes:cron` gera a versão preenchida a partir do `.env`.
- **Script de operação:** `scripts/deploy-quotes.mjs` (Node ESM — segue o padrão de `scripts/`).
- **Cron manual (sem script):** ver o template em `supabase/quotes-cron.sql`.

> ⚠️ O `verify_jwt = false` está no `supabase/config.toml` — a função valida o service role no próprio corpo. Não exponha o service role no cliente.

---

## 8. CHECKLIST RÁPIDO DE PRONTIDÃO

```markdown
[x] Projeto Supabase criado e migrations aplicadas (19 tabelas + RPCs) — ✅ produção
[x] RLS ativo com policies por usuário (Settings → Database → RLS) — ✅ produção
[x] Auth: Site URL e Redirect URLs apontando para o domínio Vercel — ✅ produção
[ ] Auth: SMTP configurado (confirmação de e-mail no cadastro)
[x] Vercel: repo importado, buildCommand `npm run build`, output `dist` — ✅ produção
[x] Vercel: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY configuradas — ✅ produção
[x] Deploy verde: typecheck + lint + 1079 testes + build — ✅ produção
[ ] Login/cadastro/recuperação funcionando em produção (QA manual)
[ ] Onboarding guiado (criar categorias/cartão/lançamento) funcional (QA manual)
[ ] PWA instalável + App Shell offline (QA manual)
[ ] Lighthouse mobile ≥ 90 (baseline)
[ ] Edge function `quotes` deployada + cron (DEPLOYMENT §7.1) — status a confirmar
[ ] CI/CD automatizado: secrets `VERCEL_*`/`SUPABASE_*` no GitHub · [ ] Sentry: adicionar `VITE_SENTRY_DSN` na Vercel quando quiser ativar
[ ] QA final multi-dispositivo (docs/RELEASE.md §2–3)
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
