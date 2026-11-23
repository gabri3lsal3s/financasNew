# Configuração das Stacks e Passos Manuais de Produção

> **Referência operacional** para **Cloudflare Pages / DNS / SSL / R2**, **Supabase**, **Resend**, **Firebase FCM (Android)** e **Sentry** no ecossistema Axir Finance (Web PWA + Notification Hub + Push Remoto + Resumo Dominical Opt-In + Billing Asaas + Android Pro).
> **Regra de segurança:** nunca cole valores reais de tokens, chaves privadas ou senhas neste documento nem em commits Git. Sempre copie os valores locais a partir do arquivo `.env` (ignorado pelo Git) ou do cofre de segredos do projeto.

---

## 0. Status da Configuracao Automatizada (verificado em producao)

Aplicado via APIs oficiais e validado ponta a ponta:

| Stack | Item | Status |
|---|---|---|
| Cloudflare Workers (`financasnew`) | Workers Builds (`main` e demais branches) com `VITE_VAPID_PUBLIC_KEY`, `VITE_PUBLIC_SITE_URL`, `NODE_VERSION=22`; dominios `axir.com.br` e `www.axir.com.br`; SSL/TLS `Full (strict)`; Always Use HTTPS; build com chave VAPID embutida no bundle e `/sw-push.js` ativo | Ativo |
| Resend | Dominio `axir.com.br` verificado (SPF/DKIM); `RESEND_API_KEY` e `RESEND_FROM_EMAIL` nos secrets do Supabase | Ativo |
| Supabase Auth | SMTP customizado Resend (`smtp.resend.com:465`), Site URL e Redirect URLs (incluindo `com.guiafinanceiro.app://**`) | Ativo |
| Supabase DB e Crons | `pg_cron` e `pg_net` habilitadas; jobs `billing-lifecycle-daily`, `sunday-digest-weekly` e `quotes-cron`; policies InitPlan de push sincronizadas; migration `0140` aplicada | Ativo |
| Firebase FCM (`axir-de9f6`) e Android Push | App Android `com.guiafinanceiro.app` registrado; `FCM_PROJECT_ID` e `FCM_SERVICE_ACCOUNT_JSON` nos secrets; `android/app/google-services.json` local (ignorado pelo Git); `@capacitor/push-notifications`, `src/services/push/fcm-push.ts`, toggle opt-in nativo, handler de deep-link e limpeza no logout integrados | Ativo |
| `WEBHOOK_SECRET` e Webhook `support_tickets` | `WEBHOOK_SECRET` provisionado nos secrets e no Supabase Vault (`webhook_secret`, `support_notify_url`); trigger `trg_notify_support_ticket_webhook` via `pg_net` e deduplicacao atomica (`telegram_notified_at`) ativos em `support-notify` | Ativo |
| Distribuicao Mobile (Android Pro) | APK assinado `v3.16.1` (Build `104`) com `@capacitor/push-notifications` e `google-services.json` compilado, publicado no Cloudflare R2 e manifesto `public/releases/version.json` sincronizado | Ativo |
| Sentry (`VITE_SENTRY_DSN`) | SDK `@sentry/react`, higienizacao LGPD (`src/services/observability.ts`), `AppErrorBoundary`, lazy chunk `vendor-sentry` e CSP `https://*.sentry.io` validados nos testes; aguarda apenas o DSN publico do projeto React no Sentry | Pronto para ativar |

Nota: a hospedagem e Cloudflare Workers Static Assets (nao Pages); as variaveis de build ficam em Workers Builds.

### Pendencias reais (opcionais)

1. Sentry em producao: criar o projeto React em sentry.io, copiar `VITE_SENTRY_DSN` e cadastrar nos triggers do Cloudflare Workers Builds (disparando um novo deploy).
2. Rotacionar chaves compartilhadas em conversas (Resend API Key, Supabase PAT, chave da conta de servico Firebase) e atualizar `RESEND_API_KEY` e `FCM_SERVICE_ACCOUNT_JSON` nos secrets do Supabase.

As secoes abaixo sao referencia historica de como cada item foi configurado.

---

## 1. O que já está configurado e ativo

As etapas automatizáveis de banco de dados, Edge Functions, segredos de servidor e cabeçalhos de borda já foram aplicadas e validadas no projeto Supabase vinculado (`lnsfcajcfofgvpvabwbi`):

| Camada | Item Configurado | Status Atual |
|---|---|---|
| **Supabase Database** | Migrations `0001` até `0138` (`user_push_subscriptions`, `push_delivery_logs`, `weekly_digest_enabled`, expiração/dispensa de broadcasts, `FORCE RLS`, revogação de acesso `anon` nas RPCs e hardening do ciclo de vida) | Aplicado e sincronizado no banco remoto |
| **Supabase Edge Functions** | 9 funções ativas (`status: ACTIVE`, `verify_jwt: false`, empacotamento via `--use-api`): `asaas-checkout`, `asaas-manage`, `asaas-webhook`, `quotes`, `support-notify`, `billing-lifecycle-cron`, `push-dispatcher`, `sunday-digest`, `admin-super-action` | Implantadas e testadas via HTTP (auth fail-closed e resposta `200`/`400` autenticada) |
| **Supabase Secrets** | Variáveis cadastradas no runtime das Edge Functions: `ALLOWED_ORIGINS`, `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_ENVIRONMENT`, `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET`, `PUBLIC_APP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (além das `SUPABASE_*` gerenciadas) | Ativos em produção |
| **Web / Cloudflare Pages** | `public/_headers` (CSP com `*.supabase.co`, `challenges.cloudflare.com`, `*.sentry.io`, `brapi.dev`, `economia.awesomeapi.com.br`, `api.bcb.gov.br`, `*.r2.dev`; cache `max-age=0, must-revalidate` em `/sw.js`, `/sw-push.js`, `/index.html`, `/releases/version.json`) | Configurado no repositório |
| **Service Worker Push** | `public/sw-push.js` e inclusão via `vite.config.ts` (`importScripts("/sw-push.js")` em `dist/sw.js`) | Validado no build de produção |
| **Scripts e Crons** | `supabase/config.toml`, `scripts/notifications-cron.mjs`, `supabase/notifications-cron.sql` (`npm run notifications:cron` usando `CRON_SECRET` com fallback para `SUPABASE_SERVICE_ROLE_KEY`) e `npm run deploy:functions` | Prontos no repositório |
| **Ambiente Local (`.env`)** | `VITE_VAPID_PUBLIC_KEY` (chave pública P-256 RFC 8292) e `CRON_SECRET` (token hexadecimal de 32 bytes) adicionados ao `.env` local (fora do Git) | Provisionados localmente |

---

## 2. Cloudflare Pages, DNS, SSL e R2 (Passos Manuais)

Como não há token de API do Cloudflare nem `wrangler` autenticados neste ambiente local, conclua os ajustes diretamente no painel da Cloudflare:

### 2.1 Variáveis de Ambiente no Cloudflare Pages

1. Acesse **Cloudflare Dashboard > Workers & Pages > axir > Settings > Environment variables**.
2. Em **Production** (e em **Preview**, se utilizar previews com login/push), adicione ou confira:
   - `VITE_VAPID_PUBLIC_KEY`: copie exatamente o valor presente no seu `.env` local (`VITE_VAPID_PUBLIC_KEY=...`). Sem esta variável em build-time, o navegador não consegue assinar Web Push VAPID em produção.
   - `NODE_VERSION`: `22.23.4` (conforme faixa homologada em `package.json` `engines`).
   - `VITE_SUPABASE_URL`: URL do projeto Supabase (`https://lnsfcajcfofgvpvabwbi.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: chave pública `anon` do projeto Supabase.
   - `VITE_PUBLIC_SITE_URL`: `https://axir.com.br`.
   - `VITE_DEFAULT_BILLING_PROVIDER`: `asaas`.
   - `VITE_SENTRY_DSN`: opcional, caso ative monitoramento Sentry (ver seção 5).

### 2.2 SSL/TLS e DNS (Domínio e Resend)

1. Em **Cloudflare Dashboard > SSL/TLS > Overview** (para `axir.com.br`), mantenha o modo **Full (Strict)**.
2. Em **Cloudflare Dashboard > DNS > Records**, ao cadastrar os registros exigidos pelo **Resend** (SPF `TXT`, DKIM `TXT`/`CNAME` e DMARC `_dmarc`), configure o status de proxy de todos os registros `CNAME`/verificação de e-mail como **DNS Only (nuvem cinza)** — nunca como *Proxied* (nuvem laranja).

### 2.3 Novo Deploy após Configurar Variáveis

- Após salvar `VITE_VAPID_PUBLIC_KEY` no Cloudflare Pages, dispare um novo deploy (push/merge para `main` ou **Deployments > Retry deployment**) para gerar o bundle Vite com a chave pública VAPID embutida e o `/sw-push.js` atualizado na borda.

### 2.4 Cloudflare R2 (Distribuição de APK Android e Manifesto)

- As credenciais locais `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET_NAME` já constam no `.env` local e são consumidas por `npm run upload:apk` (`scripts/upload-r2.mjs`).
- Confirme no painel **Cloudflare R2** que o bucket configurado possui acesso público (subdomínio `*.r2.dev` ou domínio customizado configurado em `APK_DOWNLOAD_URL`) compatível com a diretiva `connect-src` em `public/_headers`.

---

## 3. Supabase Dashboard e Resend (Passos Manuais)

### 3.1 Resend e Secrets de E-mail Transacional

Sem uma chave válida da API do Resend, o resumo dominical (`sunday-digest`) e o lembrete de fim de trial (`billing-lifecycle-cron`) executam normalmente em modo *dry/safe*, mas não entregam e-mails externos.

1. Crie uma conta no **Resend** ([resend.com](https://resend.com)) e adicione o domínio `axir.com.br`.
2. Publique os registros DNS fornecidos pelo Resend no DNS da Cloudflare (seção 2.2) e aguarde a validação do domínio.
3. Gere uma API Key no Resend e cadastre os secrets no Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY="re_sua_chave_aqui" RESEND_FROM_EMAIL="Axir <noreply@axir.com.br>"
   ```
4. Configure também o **SMTP Customizado do Supabase Auth** (**Supabase Dashboard > Authentication > SMTP Settings**), pois o SMTP nativo do Supabase impõe limite restrito por hora:
   - **Enable Custom SMTP:** ativado
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (ou `587`)
   - **Username:** `resend`
   - **Password:** o mesmo valor de `RESEND_API_KEY`
   - **Sender email:** `noreply@axir.com.br`
   - **Sender name:** `Axir`

### 3.2 Habilitação de `pg_cron` e `pg_net` + Agendamento dos Crons de Notificações

1. Acesse **Supabase Dashboard > Database > Extensions** e certifique-se de que `pg_cron` e `pg_net` estejam habilitadas (ou execute `create extension if not exists pg_cron; create extension if not exists pg_net;` no SQL Editor).
2. No terminal local (na raiz do projeto, com `.env` contendo `CRON_SECRET`), gere o SQL preenchido com segurança:
   ```bash
   npm run notifications:cron
   ```
3. Copie a saída completa e execute no **Supabase Dashboard > SQL Editor**.
4. Este script efetua hardening do schema `cron`, remove agendamentos anteriores com o mesmo nome e cria dois jobs idempotentes autenticados via `CRON_SECRET`:
   - `billing-lifecycle-daily` (`0 11 * * *` — diariamente às 08:00 BRT): chama `/functions/v1/billing-lifecycle-cron` para reconciliar assinaturas expiradas, sincronizar pendências Asaas e enviar avisos na janela de 48h–76h antes do término do trial.
   - `sunday-digest-weekly` (`0 12 * * 0` — domingos às 09:00 BRT): chama `/functions/v1/sunday-digest` para enviar o resumo semanal por e-mail (e push remoto opt-in) estritamente para usuários com `weekly_digest_enabled = true`.

### 3.3 Verificação do Cron de Cotações (`npm run quotes:cron`)

- Diferente de `billing-lifecycle-cron`, `sunday-digest` e `push-dispatcher` (que aceitam `CRON_SECRET`), a Edge Function `quotes` valida a autorização comparando o Bearer token diretamente com o secret `SUPABASE_SERVICE_ROLE_KEY` injetado no runtime do Supabase Edge.
- Caso o `SUPABASE_SERVICE_ROLE_KEY` salvo no `.env` local seja antigo ou divergente da chave vigente do projeto no runtime das Edge Functions, copie a chave `service_role` atual em **Supabase Dashboard > Settings > API** para o `.env` local antes de rodar `npm run quotes:cron` e reaplicar [`supabase/quotes-cron.sql`](../../supabase/quotes-cron.sql) no SQL Editor.

### 3.4 URL Configuration, Rate Limits e Database Webhook Opcional

1. Em **Supabase Dashboard > Authentication > URL Configuration**, confirme:
   - **Site URL:** `https://axir.com.br`
   - **Redirect URLs:**
     - `https://axir.com.br/**`
     - `https://www.axir.com.br/**`
     - `https://axir.com.br/reset-password`
     - `https://*.pages.dev/**`
     - `com.guiafinanceiro.app://**` (callback nativo Android Capacitor)
     - `http://localhost:5173/**` (somente se desejar manter testes locais)
2. Em **Authentication > Rate Limits** e **Security**, revise os tetos de tentativas por IP, recuperação de senha e uso de Turnstile quando habilitado.
3. **Suporte Telegram (`support-notify`):** `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` já estão ativos nos secrets do Supabase e o envio funciona via sessão autenticada pelo app. Caso queira também acionar `support-notify` diretamente por um **Database Webhook** em `INSERT` na tabela `public.support_tickets`, defina um `WEBHOOK_SECRET` forte via `supabase secrets set WEBHOOK_SECRET="..."` e informe o mesmo valor no cabeçalho `x-webhook-secret` da regra do webhook no painel do Supabase.

---

## 4. Opcional: Android Pro Push Remoto (Firebase FCM) e Release APK

As notificações locais nativas no Android (agendamento local para os próximos 7 dias nos canais `axir_*`) e o **Web Push Remoto VAPID** (PWA no desktop, Android Chrome/Edge e iOS 16.4+ instalado na Tela Inicial) **já funcionam sem depender do Firebase**.

Configure o bloco abaixo **apenas** se quiser entregas de **Push Remoto em segundo plano (app fechado) no APK Android nativo** via FCM HTTP v1 (`push-dispatcher`):

1. No **Firebase Console**, crie ou selecione um projeto e adicione um app Android com Package Name exato `com.guiafinanceiro.app`.
2. Baixe o arquivo `google-services.json` e salve em `android/app/google-services.json` (mantenha o arquivo fora do Git ou protegido conforme política de segredos; o script [`android/app/build.gradle`](../../android/app/build.gradle) já detecta automaticamente sua presença para aplicar `com.google.gms.google-services`).
3. No **Google Cloud / Firebase Console** (**Project Settings > Service accounts > Generate new private key**), gere o arquivo JSON de conta de serviço com acesso à **Firebase Cloud Messaging API (V1)**.
4. Grave os secrets nas Edge Functions (com o JSON em linha única):
   ```bash
   supabase secrets set \
     FCM_PROJECT_ID="seu-firebase-project-id" \
     FCM_SERVICE_ACCOUNT_JSON="$(tr -d '\n' < caminho/para/firebase-service-account.json)"
   ```
5. Recompile os APKs com `VITE_VAPID_PUBLIC_KEY` (no `.env`) e `google-services.json` presentes, e publique no Cloudflare R2 utilizando as credenciais `KEYSTORE_*` e `R2_*` já presentes no `.env`:
   ```bash
   npm run build:apk && npm run upload:apk
   ```

---

## 5. Opcional: Sentry e Checklist Final de Validação Ponta a Ponta

### 5.1 Observabilidade com Sentry (Opcional)

1. Crie um projeto React/Browser no Sentry e obtenha o DSN público.
2. Cadastre `VITE_SENTRY_DSN` no `.env` local (se desejar validar localmente) e nas variáveis do **Cloudflare Pages**. O arquivo `public/_headers` já autoriza `https://*.sentry.io` na diretiva `connect-src` da CSP.

### 5.2 Checklist Operacional de Validação Ponta a Ponta

Execute na ordem após concluir os passos manuais de Cloudflare, Resend e SQL Editor:

1. [ ] **Saúde local e tipagem:** rodar `npm run preflight` e confirmar todas as checagens aprovadas sem falhas.
2. [ ] **Bundle em produção (Cloudflare Pages):** após o redeploy com `VITE_VAPID_PUBLIC_KEY`, abrir o app autenticado em `https://axir.com.br` e confirmar no DevTools (`Application > Service Workers`) que o worker está registrado com `/sw-push.js` ativo e sem erros de CSP no console.
3. [ ] **Push Web Remoto (VAPID):** acessar **Configurações > Notificações**, ativar **Push Remoto em Tempo Real**, conceder permissão ao navegador, enviar notificação de teste e confirmar criação de registro em `public.user_push_subscriptions` e `public.push_delivery_logs`.
4. [ ] **Resumo Dominical Opt-In (`sunday-digest`):** confirmar em **Configurações > Notificações** que a opção vem desligada por padrão (`weekly_digest_enabled = false`), ativar em uma conta de teste com `RESEND_API_KEY` configurada e validar o recebimento do e-mail + gravação em `public.transactional_email_logs`.
5. [ ] **Auditoria dos Agendamentos `pg_cron` no SQL Editor:**
   ```sql
   select jobid, jobname, schedule, active
   from cron.job
   order by jobid;

   select r.runid, j.jobname, r.status, r.return_message, r.start_time, r.end_time
   from cron.job_run_details r
   join cron.job j on j.jobid = r.jobid
   order by r.start_time desc
   limit 20;

   select event_type, channel, status, count(*)
   from public.push_delivery_logs
   group by 1, 2, 3
   order by 1;

   select template_key, status, count(*)
   from public.transactional_email_logs
   group by 1, 2
   order by 1;
   ```
