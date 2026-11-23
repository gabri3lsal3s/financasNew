# Passo a Passo para Obter as Chaves de Automação Completa

> **Objetivo:** este guia descreve como gerar e onde salvar cada chave no arquivo `.env` local (ignorado pelo Git) para que **todas as configurações externas** (Cloudflare Pages, DNS SPF/DKIM/DMARC, Resend, Supabase Secrets e agendamentos `pg_cron`) possam ser executadas **100% automaticamente via API/CLI**.
> **Regra de segurança:** nunca salve tokens ou chaves privadas reais dentro deste documento nem em arquivos versionados pelo Git. Coloque os valores exclusivamente no arquivo `.env` na raiz do projeto.

---

## 1. Inventário do que já está configurado

As chaves abaixo já estão presentes no `.env` local e/ou nos Secrets do projeto Supabase vinculado (`lnsfcajcfofgvpvabwbi`):

| Camada | Chaves já configuradas | Automação já habilitada |
|---|---|---|
| **Supabase (Banco, Auth, Edge Functions & Web Push VAPID)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_FUNCTION_URL`, `VITE_VAPID_PUBLIC_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ALLOWED_ORIGINS`, `PUBLIC_APP_URL` | Push de migrations (`supabase db push`), deploy de todas as Edge Functions, assinatura Web Push VAPID e configuração dos jobs `pg_cron` (`billing-lifecycle-daily` e `sunday-digest-weekly`). |
| **Cloudflare R2 & DNS** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_API_TOKEN`, `APK_DOWNLOAD_URL` | Upload automatizado do APK e `version.json` para o bucket R2 e acesso à API de **Zone DNS** da Cloudflare. |
| **Android Keystore (Build APK)** | `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | Compilação e assinatura local do APK Android de release (`npm run build:apk`). |
| **Billing Asaas & Suporte Telegram** | `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_ENVIRONMENT`, `ASAAS_WEBHOOK_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Checkout, gestão de assinaturas, webhooks Asaas e notificações de suporte no Telegram. |

---

## 2. Chaves necessárias para automatizar 100% do restante

Para que o agente configure automaticamente o **Cloudflare Pages** e o **Resend + DNS de e-mail**, siga os Passos 1 e 2 abaixo.

---

### Passo 1 — Cloudflare (`CLOUDFLARE_API_TOKEN` com permissão de Pages e DNS)

O token atual salvo em `R2_API_TOKEN` já possui permissão na API de **DNS Zones**, mas ainda retorna `403` na API de **Cloudflare Pages**. Você pode **editar o token existente** ou **criar um novo**:

1. Acesse o painel da Cloudflare: `https://dash.cloudflare.com/profile/api-tokens` (**My Profile > API Tokens**).
2. Para editar o token atual, clique no menu **`...` > Edit** ao lado dele. Para criar um novo, clique em **Create Token** e depois em **Get started** ao lado de **Create Custom Token**.
3. Em **Token name**, informe por exemplo: `axir-full-automation`.
4. Em **Permissions**, adicione ou garanta estas permissões:
   - `Account` -> **`Cloudflare Pages`** -> **`Edit`**
   - `Zone` -> **`DNS`** -> **`Edit`**
   - *(Se estiver editando o token do R2, mantenha as permissões de R2 existentes).*
5. Em **Account Resources**, selecione:
   - `Include` -> **`All accounts`** (ou selecione a conta correspondente ao seu `R2_ACCOUNT_ID`).
6. Em **Zone Resources**, selecione:
   - `Include` -> **`All zones`** (ou `Specific zone` -> `axir.com.br`).
7. Clique em **Continue to summary** e depois em **Create Token** (ou **Save**).
8. Se criou um token novo, copie o valor exibido e adicione no arquivo `.env` na raiz do projeto:
   ```env
   CLOUDFLARE_API_TOKEN="cole_o_token_da_cloudflare_aqui"
   ```
   *(Se você apenas editou o token que já estava em `R2_API_TOKEN`, não é necessário alterar o valor no `.env`, pois o mesmo token passa a ter a permissão de Cloudflare Pages).*

**O que será automatizado com esta chave:**
- Cadastro/atualização de `VITE_VAPID_PUBLIC_KEY` (e demais variáveis `VITE_*`) nos ambientes **Production** e **Preview** do projeto `axir` no **Cloudflare Pages**;
- Disparo automático de novo deploy no Cloudflare Pages para publicar o bundle com a chave pública VAPID ativa.

---

### Passo 2 — Resend (`RESEND_API_KEY` com Full Access para E-mails e DNS Automático)

1. Acesse `https://resend.com` e faça login (ou crie uma conta gratuita).
2. No menu lateral esquerdo, clique em **API Keys** (`https://resend.com/api-keys`).
3. Clique no botão **Create API Key**:
   - **Name:** `axir-production`
   - **Permission:** selecione **`Full access`** *(obrigatório escolher **Full access** e não apenas Sending access, pois o Full access permite registrar o domínio `axir.com.br` via API do Resend, ler os registros SPF/DKIM gerados e disparar a verificação automática do domínio)*.
   - **Domain:** `All domains`.
4. Clique em **Add** e copie a chave gerada (iniciada por `re_`).
5. Adicione as duas linhas abaixo ao seu arquivo `.env` na raiz do projeto:
   ```env
   RESEND_API_KEY="re_cole_sua_chave_do_resend_aqui"
   RESEND_FROM_EMAIL="Axir <noreply@axir.com.br>"
   ```

**O que será automatizado com esta chave (em conjunto com o token DNS da Cloudflare):**
- Criação/consulta do domínio `axir.com.br` via API do Resend (`POST /domains`);
- Criação automática dos registros DNS exigidos pelo Resend (`SPF`, `DKIM` e `_dmarc`) na zona `axir.com.br` da Cloudflare com `proxied: false` (DNS Only / nuvem cinza);
- Acionamento da verificação do domínio no Resend (`POST /domains/{id}/verify`);
- Gravação automática dos secrets `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no runtime das Edge Functions do Supabase (`supabase secrets set`).

---

## 3. Chaves Opcionais (Recursos Extras)

### Passo 3 (Opcional) — Firebase FCM (Push Remoto com App Fechado no APK Android Nativo)

> **Nota:** o APK Android já possui **notificações locais nativas agendadas para os próximos 7 dias** e o **Web Push Remoto VAPID** já funciona nos navegadores Desktop/Android/iOS PWA sem Firebase. Siga este passo apenas se quiser habilitar também o canal FCM HTTP v1 para o APK nativo.

1. Acesse o Firebase Console: `https://console.firebase.google.com`.
2. Crie um projeto (ex.: `axir-finance`) ou selecione um projeto existente.
3. Na visão geral do projeto, clique no botão **Android** para registrar o aplicativo:
   - **Nome do pacote Android (Android package name):** `com.guiafinanceiro.app` *(deve ser exatamente este identificador)*
   - **Apelido do app:** `Axir Android`
4. Clique em **Registrar app**, faça o download do arquivo **`google-services.json`** e salve-o em:
   ```text
   android/app/google-services.json
   ```
5. No menu lateral esquerdo do Firebase, clique no ícone de engrenagem -> **Configurações do projeto (Project settings)** -> aba **Contas de serviço (Service accounts)**.
6. Clique em **Gerar nova chave privada (Generate new private key)** -> **Gerar chave**.
7. Salve o arquivo `.json` baixado na raiz do repositório com o nome:
   ```text
   firebase-service-account.json
   ```
   *(Adicione `firebase-service-account.json` e `android/app/google-services.json` apenas localmente; nunca faça commit deles no Git).*

**O que será automatizado com estes arquivos:**
- Extração automática de `FCM_PROJECT_ID` e `FCM_SERVICE_ACCOUNT_JSON` para os Secrets do Supabase (`push-dispatcher`);
- Detecção automática do plugin `com.google.gms.google-services` pelo Gradle durante o `npm run build:apk`.

---

### Passo 4 (Opcional) — Sentry (`VITE_SENTRY_DSN` para Observabilidade de Frontend)

1. Acesse `https://sentry.io` e faça login.
2. Vá em **Projects > Create Project**.
3. Selecione a plataforma **React**, nomeie o projeto como `axir` e finalize a criação.
4. Copie o **DSN** exibido (formato `https://...@o....ingest.us.sentry.io/...`) e adicione ao seu `.env`:
   ```env
   VITE_SENTRY_DSN="https://cole_seu_dsn_do_sentry_aqui"
   ```

---

## 4. Resumo do Bloco Final no `.env`

Após concluir os passos acima, basta garantir que estas linhas estejam preenchidas no final do seu arquivo `.env` local e avisar no chat para que a automação execute todas as integrações:

```env
# 1. Cloudflare Pages + DNS (ou permissão Cloudflare Pages: Edit adicionada ao R2_API_TOKEN)
CLOUDFLARE_API_TOKEN="seu_token_cloudflare_com_pages_e_dns_edit"

# 2. Resend (Full Access) para e-mails transacionais, resumo dominical e DNS automático
RESEND_API_KEY="re_sua_chave_full_access_do_resend"
RESEND_FROM_EMAIL="Axir <noreply@axir.com.br>"

# 3. Opcional: Sentry
# VITE_SENTRY_DSN="https://seu_dsn_sentry"
```
