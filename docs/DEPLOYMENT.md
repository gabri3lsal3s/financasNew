# 🚀 DEPLOYMENT.md — Guia de Deploy e Pleno Funcionamento

> **Status:** guia atualizado para **Cloudflare Pages** (Fase de Migração — 2026-08-29).
> Stack: **Cloudflare Pages** (frontend Vite/React SPA + PWA) + **Supabase** (Postgres + RLS + Auth + RPCs).
> O app é **100% Online First**: dados vivem na nuvem; o PWA cacheia apenas o App Shell e assets estáticos.

---

## 1. VISÃO GERAL DA ARQUITETURA DE PRODUÇÃO

```
┌─────────────────────────────────┐        ┌──────────────────────────────┐
│  Cloudflare Pages (Vite SPA)    │ ─────► │  Supabase (Postgres 17)     │
│  / (SPA + PWA)                  │  HTTPS │  ├─ Auth (email/senha)       │
│  /assets/* (Cache imutável)     │        │  ├─ RLS (todas as tabelas)   │
│  _redirects + _headers          │        │  ├─ RPCs transacionais (D1)  │
└─────────────────────────────────┘        │  └─ Migrations versionadas   │
                                           └──────────────────────────────┘
```

- **Frontend:** Cloudflare Pages — Git Integration nativa via Webhooks (sem GitHub Actions). Roteamento SPA configurado via `public/_redirects` e segurança/cache via `public/_headers`.
- **Segurança de Borda e Headers HTTP (`public/_headers`):**
  - **Content-Security-Policy (CSP):** política estrita que restringe a execução de scripts e conexões a origens homologadas (`default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `img-src 'self' data: blob: https://*.supabase.co`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://brapi.dev`, `font-src 'self' data: https://fonts.gstatic.com`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`);
  - **Defesa em Profundidade:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - **Estratégia de Cache de Borda:** assets estáticos versionados (`/assets/*`) com cache imutável de 1 ano (`max-age=31536000, immutable`), e artefatos dinâmicos de ciclo de vida (`/index.html`, `/sw.js`, `/pwa/*`) com validação imediata (`max-age=0, must-revalidate`).
- **Backend:** Supabase — migrations em `supabase/migrations/` (0001–0010: schema, RLS, RPCs, overrides, metas, metas de alocação, backfill de perfis, restauração de backup F22).
- **Auth:** Supabase Auth (email/senha) + trigger `handle_new_user` (cria `profiles` e `user_preferences` automaticamente).
- **Cotações:** tabela `asset_prices` com cache global (`user_id NULL`) + override manual do usuário. O cache global é escrito pela **edge function `quotes`** (implementada em `supabase/functions/quotes/`).

---

## 2. PRÉ-REQUISITOS

| Item | Versão | Observação |
|---|---|---|
| Node.js | ≥ 22.0.0 | definido em `engines` do `package.json` |
| Conta Cloudflare | Free | uso comercial e monetização 100% permitidos, tráfego ilimitado |
| Projeto Supabase | — | criar em `supabase.com` (região próxima dos usuários) |
| Supabase CLI (opcional) | ≥ 2.114 | `npm run db:*` — requer `supabase/config.toml` local |

---

## 3. PASSOS DE DEPLOY — PASSO A PASSO

### 3.1 Supabase: criar o projeto e aplicar o schema

1. Crie o projeto em [supabase.com/dashboard](https://supabase.com/dashboard) (anote `Project URL` e `anon key` em **Settings → API**).
2. Aplique as migrations **na ordem** (0001 → 0010).
3. **Auth — configurar URLs de redirect** (Settings → Auth → URL Configuration):
   - `Site URL`: `https://<SEU-DOMINIO-CLOUDFLARE>` (ex.: `https://financasnew.pages.dev` ou domínio próprio)
   - `Redirect URLs`: adicionar `https://<SEU-DOMINIO-CLOUDFLARE>/**`
   - O arquivo `supabase/config.toml` já contém a wildcard `"https://*.pages.dev"`.

### 3.2 Cloudflare Pages: importar e configurar o projeto

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Selecione o repositório `financasNew` e a branch `main`.
3. Defina os **Build Settings**:
   - **Framework preset:** `Vite` (ou `None`)
   - **Build command:** `npm run build` *(Gera `dist/` com typecheck integrado `tsc -b && vite build` em ~2 segundos)*
   - **Build output directory:** `dist`
4. **Variáveis de ambiente** (Environment Variables):

   | Variável | Valor | Onde obter |
   |---|---|---|
   | `NODE_VERSION` | `22` | Garante Node.js 22 LTS no runner da Cloudflare (ou via `.nvmrc`) |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → Settings → API → Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon public key |
   | `VITE_SENTRY_DSN` | *(opcional)* | Sentry → Settings → Projects → Client Keys |

> **Atenção:** Evite colocar `npm test` no Build command da Cloudflare Pages, pois executar a suíte completa de ~2.000 testes consome muita memória em runners de 1 vCPU e pode causar timeout/estrangulamento. Use `npm run build`.

---

## 4. OPERAÇÕES DE BANCO & CRON DE COTAÇÕES

Para garantir que a aplicação opere sob **alta concorrência sem risco de HTTP 429 (Rate Limit)** em provedores de cotação (Brapi, Yahoo Finance, AwesomeAPI), a arquitetura adota o modelo **100% Server-Side Cache**:
- Os navegadores dos clientes **nunca** realizam chamadas em lote para APIs externas durante o fluxo normal de uso; consomem exclusivamente a tabela consolidada `public.asset_prices` (`user_id is null`).
- O cache global de cotações é alimentado periodicamente pela Edge Function `quotes` agendada no banco de dados via `pg_cron` e `pg_net`.

### 4.1 Auditoria de Quotas e Dimensionamento Operacional

| Serviço | Free Tier / Limite de Quota | Consumo com Cron Agendado | Margem de Segurança |
|---|---|---|---|
| **Supabase Edge Functions** | 500.000 invocações / mês | ~120 a ~180 invocações / mês | **> 99,9% livre** |
| **Brapi (B3)** | Quota gratuita por minuto / dia | 4 a 6 chamadas em lote / dia | **Sem estouro de taxa** |
| **Yahoo Finance / AwesomeAPI** | Rate limits para chamadas massivas | Centralizado na Edge Function | **Zero bloqueio por IP do cliente** |
| **PostgreSQL (`pg_cron`)** | Extensão nativa gerenciada | 1 job agendado em segundo plano | **Impacto imperceptível em CPU** |

### 4.2 Habilitação de Extensões Obrigatórias no Supabase

Antes de ativar o agendamento, certifique-se de que as extensões `pg_cron` e `pg_net` estão habilitadas no banco de dados:

1. Acesse o **Supabase Dashboard** → **Database** → **Extensions**.
2. Pesquise e ative as extensões:
   - **`pg_cron`**: Agendador de tarefas periódicas baseado em cron no PostgreSQL.
   - **`pg_net`**: Cliente de rede assíncrono para chamadas HTTP a partir de triggers ou jobs do banco.
3. *Ou execute diretamente no SQL Editor:*
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```

### 4.3 Ativação do Cron de Cotações (`quotes-cron.sql`)

O script operacional [`supabase/quotes-cron.sql`](../supabase/quotes-cron.sql) efetua o agendamento idempotente e o hardening de segurança das tabelas do schema `cron`.

#### Opção A — Automatizada via CLI (Recomendada):
Gera o SQL com as credenciais reais do seu arquivo `.env`:
```bash
npm run quotes:cron
```
Copie a saída gerada no terminal, cole no **SQL Editor** do Supabase Dashboard e clique em **Run**.

#### Opção B — Manual no SQL Editor:
Abra o arquivo [`supabase/quotes-cron.sql`](../supabase/quotes-cron.sql), substitua os parâmetros:
- `<CRON_SCHEDULE>`: Expressão cron de frequência (ver opções recomendadas abaixo).
- `<FUNCTION_URL>`: URL da sua Edge Function (ex.: `https://<PROJECT_REF>.supabase.co/functions/v1/quotes`).
- `<SERVICE_ROLE_KEY>`: Chave secreta de serviço do Supabase (**Settings → API → service_role**; *nunca use a anon key*).

#### Expressões Cron Recomendadas:
- **`0 11,14,17,20 * * 1-5` (Pregão B3 em Dias Úteis — Recomendada):**
  Dispara às 11h, 14h, 17h e 20h UTC de segunda a sexta-feira. Cobre a abertura, o decorrer do pregão, o fechamento da B3 e o pós-mercado, economizando 100% das chamadas em finais de semana e madrugadas.
- **`0 */6 * * *` (A cada 6 horas — 24/7):**
  Dispara 4 vezes ao dia (00h, 06h, 12h, 18h UTC), todos os dias da semana. Recomendado se houver monitoramento contínuo de Criptoativos.
- **`0 */4 * * 1-5` (A cada 4 horas em Dias Úteis):**
  Dispara a cada 4 horas de segunda a sexta-feira.

### 4.4 Monitoramento e Auditoria de Execução

Após rodar o script no SQL Editor, utilize as seguintes queries para verificar a saúde do agendamento:

```sql
-- 1. Verificar se o job está ativo:
select jobid, jobname, schedule, active from cron.job order by jobid;

-- 2. Auditar histórico de execuções recentes, status e código de resposta HTTP:
select
  r.runid,
  r.jobid,
  j.jobname,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
order by r.start_time desc
limit 10;

-- 3. Inspecionar o cache global consolidado de cotações:
select ticker, price, currency, updated_at
from public.asset_prices
where user_id is null
order by updated_at desc;
```

### 4.5 Índices Compostos Cobridores e Alta Concorrência

Para sustentar alta concorrência de leitura e múltiplos usuários simultâneos consultando carteira e movimentações:
- **`idx_portfolio_tx_user_asset_date`** (`public.portfolio_transactions (user_id, asset_id, date desc)`):
  Criado na Migration `0052_portfolio_transactions_composite_index.sql`. Otimiza a listagem de movimentações e ficha detalhada de ativos (`listPortfolioTransactions`), combinando o predicado multi-tenant `user_id = (select auth.uid())`, o filtro de ativo `asset_id` e a ordenação `date desc` em um único Index Scan direto, eliminando sequential scans e etapas de ordenação em memória.

---

## 5. ESTRUTURA DE CONFIGURAÇÃO ESTÁTICA (`public/`)

- **`public/_headers`**:
  Configura cabeçalhos de segurança (`nosniff`, `DENY`, `XSS`, `Referrer-Policy`) e regras de cache imutável para a pasta `/assets/` e revalidação de Service Worker (`sw.js`).

- **SPA Fallback Nativo**:
  O Cloudflare Pages redireciona automaticamente rotas não encontradas para o `dist/index.html` (SPA fallback nativo para Vite/React), dispensando o arquivo `_redirects`.

---

## 6. COMANDOS ÚTEIS (LOCAL)

```bash
npm install          # instala dependências
cp .env.example .env.local   # preencha VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

npm run dev          # dev server (Vite)
npm run typecheck    # tsc -b (valida TODO o projeto, inclusive testes)
npm run lint         # eslint (0 erros esperado)
npm run test         # vitest — 2313 testes (320 arquivos) 100% verde
npm run build        # tsc -b && vite build (gera dist/ + Service Worker)
npm run preview      # serve dist/ localmente (testa o build de produção)
npm run build:apk    # compila os APKs Debug e Release (assinado) para dist-apk/
npm run quotes:cron  # gera o script SQL preenchido para o pg_cron do Supabase
```

---

## 7. COMPILAÇÃO & DISTRIBUIÇÃO DO APLICATIVO ANDROID (APK)

O projeto suporta compilação automatizada de APKs nativos via Capacitor e Gradle com **In-App Updater** e assinatura determinística permanente:

### 7.1 Compilação Automatizada

```bash
# Compilação padrão (incremento determinístico de versão e geração de version.json)
npm run build:apk

# Ou com versão específica:
APP_VERSION_NAME="1.1.0" APP_VERSION_CODE="2" ./scripts/build-apk.sh
```

O script executa automaticamente:
1. Exportação do ambiente JDK 21 LTS e Android SDK Command-line Tools;
2. Validação da chave criptográfica RSA 2048 bits permanente (`release-key.keystore`);
3. Compilação de produção do Web App Vite (`npm run build`);
4. Sincronização dos assets e plugins nativos com Capacitor (`npx cap sync android`);
5. Compilação dos APKs pelo Gradle Wrapper (`clean assembleDebug assembleRelease`);
6. Cálculo de integridade SHA-256 e geração do manifesto `public/releases/version.json`;
7. Organização dos artefatos finais em `dist-apk/`:
   - `dist-apk/guia-financeiro-debug.apk`
   - `dist-apk/guia-financeiro-release.apk` (assinado para distribuição)
   - `dist-apk/axis-pro.apk` (cópia canônica de distribuição)
   - `dist-apk/version.json` (manifesto sincronizado com `public/releases/version.json`).

### 7.2 Instalação e Atualização In-Place

Com a keystore canônica permanente e `versionCode` incremental, qualquer nova versão instala por cima **sem necessidade de desinstalar**:

```bash
# Instalar ou atualizar versão de Release
adb install -r dist-apk/guia-financeiro-release.apk
```

### 7.3 Publicação Automatizada no Cloudflare R2 (Egress Grátis)

Com as credenciais do Cloudflare R2 configuradas no `.env` local (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`), o envio para o bucket é 100% automatizado:

```bash
# Upload direto do APK para o Cloudflare R2
npm run upload:apk
```

> Para o guia operacional detalhado, backup de chaves e resolução de dúvidas de usuários, consulte [`docs/NATIVE_DISTRIBUTION_GUIDE.md`](./NATIVE_DISTRIBUTION_GUIDE.md).


