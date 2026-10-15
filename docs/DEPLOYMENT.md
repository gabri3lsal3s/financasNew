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

## 4. ESTRUTURA DE CONFIGURAÇÃO ESTÁTICA (`public/`)

- **`public/_headers`**:
  Configura cabeçalhos de segurança (`nosniff`, `DENY`, `XSS`, `Referrer-Policy`) e regras de cache imutável para a pasta `/assets/` e revalidação de Service Worker (`sw.js`).

- **SPA Fallback Nativo**:
  O Cloudflare Pages redireciona automaticamente rotas não encontradas para o `dist/index.html` (SPA fallback nativo para Vite/React), dispensando o arquivo `_redirects`.

---

## 5. COMANDOS ÚTEIS (LOCAL)

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
```

---

## 6. COMPILAÇÃO & DISTRIBUIÇÃO DO APLICATIVO ANDROID (APK)

O projeto suporta compilação automatizada de APKs nativos via Capacitor e Gradle:

### 6.1 Compilação em 1 Comando

Para compilar os APKs de Debug e Release:

```bash
npm run build:apk
# ou diretamente:
./scripts/build-apk.sh
```

O script executa automaticamente:
1. Exportação do ambiente JDK 21 LTS e Android SDK Command-line Tools;
2. Geração da chave criptográfica RSA 2048 bits (`release-key.keystore`), caso não exista;
3. Compilação de produção do Web App Vite (`npm run build`);
4. Sincronização dos assets e plugins nativos com Capacitor (`npx cap sync android`);
5. Compilação dos APKs pelo Gradle Wrapper (`clean assembleDebug assembleRelease`);
6. Organização e cópia dos artefatos finais para `dist-apk/`:
   - `dist-apk/guia-financeiro-debug.apk`
   - `dist-apk/guia-financeiro-release.apk` (assinado para distribuição).

### 6.2 Instalação no Aparelho Real

Com o celular conectado via cabo USB (com Depuração USB ativada) ou WiFi:

```bash
# Instalar versão de Release
adb install -r dist-apk/guia-financeiro-release.apk

# Ou instalar versão Debug
adb install -r dist-apk/guia-financeiro-debug.apk
```

