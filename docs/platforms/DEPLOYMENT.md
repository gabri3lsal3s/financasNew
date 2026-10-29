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
  - **Defesa em Profundidade:** `Strict-Transport-Security` (HSTS preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - **CORS das Edge Functions:** allowlist (`ALLOWED_ORIGINS` + `*.pages.dev` + localhost/Capacitor); webhook Asaas sem CORS de browser; `quotes` só grava cache global com service role.
  - **Estratégia de Cache de Borda:** assets estáticos versionados (`/assets/*`) com cache imutável de 1 ano (`max-age=31536000, immutable`), e artefatos dinâmicos de ciclo de vida (`/index.html`, `/sw.js`, `/pwa/*`) com validação imediata (`max-age=0, must-revalidate`).
- **Backend:** Supabase — migrations em `supabase/migrations/` (0001–0010: schema, RLS, RPCs, overrides, metas, metas de alocação, backfill de perfis, restauração de backup F22).
- **Auth:** Supabase Auth (email/senha) + trigger `handle_new_user` (cria `profiles` e `user_preferences` automaticamente).
- **Cotações:** tabela `asset_prices` com cache global (`user_id NULL`) + override manual do usuário. O cache global é escrito pela **edge function `quotes`** (implementada em `supabase/functions/quotes/`).

---

## 2. PRÉ-REQUISITOS

| Item | Versão | Observação |
|---|---|---|
| Node.js | ≥ **22.23.4** (ou ≥24.22.1 / ≥26.12.1) | pinado em `engines`, `.nvmrc` e `.node-version` (CVEs out/2026: Brotli/TLS/dns) |
| Conta Cloudflare | Free | uso comercial e monetização 100% permitidos, tráfego ilimitado |
| Projeto Supabase | — | criar em `supabase.com` (região próxima dos usuários) |
| Supabase CLI (opcional) | ≥ 2.114 | `npm run db:*` — requer `supabase/config.toml` local |

---

## 3. PASSOS DE DEPLOY — PASSO A PASSO

### 3.1 Supabase: criar o projeto e aplicar o schema

1. Crie o projeto em [supabase.com/dashboard](https://supabase.com/dashboard) (anote `Project URL` e `anon key` em **Settings → API**).
2. Aplique as migrations **na ordem** (0001 → 0052).
3. **Auth — configurar URLs de redirect** (Settings → Auth → URL Configuration):
   - `Site URL`: `https://<SEU-DOMINIO-CLOUDFLARE>` (ex.: `https://financasnew.pages.dev` ou domínio próprio)
   - `Redirect URLs`: adicionar `https://<SEU-DOMINIO-CLOUDFLARE>/**`
   - O arquivo `supabase/config.toml` já contém a wildcard `"https://*.pages.dev"`.

### 3.2 Supabase Auth: Checklist de Rate Limits & Proteção contra Força Bruta

Para assegurar a prontidão para campanhas de aquisição e tráfego massivo (1k a 10k DAU), configure as proteções de autenticação em **Authentication → Rate Limits** e **Security**:

1. **Proteção contra Força Bruta (Brute-Force & Credential Stuffing):**
   - Ative o limite de tentativas de login por IP e por conta de usuário no painel;
   - Recomenda-se tolerância padrão de até 30 requisições de autenticação por minuto por IP;
   - Configure lockout temporário automático após múltiplas tentativas consecutivas de senha incorreta.
2. **Quotas de Envio de E-mails (Sign-up, Magic Links e Reset de Senha) & SMTP Dedicado (Resend):**
   - O serviço de e-mail embutido padrão do Supabase possui cota restrita de **30 e-mails por hora** no plano Free e remetente genérico (`noreply@mail.app.supabase.io`);
   - **Para Produção em Escala:** É **obrigatório** configurar o provedor transacional **Resend** em **Authentication → SMTP Settings**, desativando o teto restritivo e garantindo entregabilidade na Caixa de Entrada com autenticação SPF/DKIM/DMARC:
     * **Host:** `smtp.resend.com`
     * **Port:** `465` (SSL) ou `587` (TLS)
     * **Username:** `resend`
     * **Password:** `<API_KEY_RESEND_INICIADA_COM_re_>`
     * **Sender Email:** `nao-responda@<dominio_verificado>`
     * **Sender Name:** `Áxis Finance`
     * **Minimum TLS version:** `TLS 1.2`
   - **Apontamentos DNS Obrigatórios no Registrador / Cloudflare:**
     * **TXT (SPF):** `send.<dominio>` ou `<dominio>` com valor `v=spf1 include:amazonses.com ~all`
     * **CNAME (DKIM):** `resend._domainkey` apontando para `resend._domainkey.resend.com`
     * **TXT (DMARC):** `_dmarc.<dominio>` com valor `v=DMARC1; p=none; rua=mailto:dmarc@<dominio>`
     * **MX (Retornos):** `feedback-smtp.us-east-1.amazonses.com` (Prioridade 10)
   - Consulte o guia completo e os códigos HTML dos templates em [`docs/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md).
3. **Teto de Cadastros e Criação de Contas:**
   - Limite a criação de novas contas para até 30 sign-ups por hora por endereço IP para evitar ataques de esgotamento de banco ou geração artificial de usuários.
4. **Prevenção de Abuso de Recuperação de Senha:**
   - Limite as requisições de redefinição de senha (`password recovery`) para no máximo 3 a 5 envios por hora por endereço de e-mail.

### 3.3 Cloudflare Pages: importar e configurar o projeto

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Selecione o repositório `financasNew` e a branch `main`.
3. Defina os **Build Settings**:
   - **Framework preset:** `Vite` (ou `None`)
   - **Build command:** `npm run build` *(Gera `dist/` com typecheck integrado `tsc -b && vite build` em ~2 segundos)*
   - **Build output directory:** `dist`
4. **Variáveis de ambiente** (Environment Variables):

   | Variável | Valor | Onde obter |
   |---|---|---|
   | `NODE_VERSION` | `22.23.4` | **Obrigatório** pin patchado (não use só `22`) — ver security releases Node.js 21/out/2026 |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → Settings → API → Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon public key |
   | `VITE_SENTRY_DSN` | *(opcional)* | Sentry → Settings → Projects → Client Keys |

> **Atenção:** Evite colocar `npm test` no Build command da Cloudflare Pages, pois executar a suíte completa de ~2.000 testes consome muita memória em runners de 1 vCPU e pode causar timeout/estrangulamento. Use `npm run build`.

### 3.4 Vinculação de Domínio Customizado no Cloudflare Pages

1. Acesse o projeto no Cloudflare Pages → **Custom Domains** → **Set up a custom domain**;
2. Informe o domínio ou subdomínio de produção oficial (ex.: `app.seudominio.com.br` ou `axis.finance`);
3. Caso o DNS esteja sob a própria Cloudflare, o CNAME apontando para `<projeto>.pages.dev` é criado e verificado automaticamente;
4. Aguarde o status mudar para **Active** com provisionamento do certificado SSL universal.

### 3.5 Criptografia SSL/TLS em Modo Full (Strict)

Para proteger dados bancários e de autenticação em trânsito com segurança de padrão financeiro:
1. No Cloudflare Dashboard, selecione a zona do domínio oficial;
2. Acesse **SSL/TLS** → **Overview** e selecione o modo **Full (strict)**;
3. Acesse **SSL/TLS** → **Edge Certificates**:
   - **Always Use HTTPS:** Ativado (`On`);
   - **Minimum TLS Version:** `TLS 1.2` ou `TLS 1.3`;
   - **Opportunistic Encryption:** Ativado (`On`);
   - **HTTP Strict Transport Security (HSTS):** Ativado com `max-age=31536000`, `includeSubDomains` e `preload` (alinhado a `public/_headers`).

### 3.6 Sincronização de URLs no Supabase (`URL Configuration`)

Para evitar erros de redirecionamento ou links expirados em convites e resets de senha:
1. Acesse o **Supabase Dashboard** → **Authentication** → **URL Configuration**;
2. No campo **Site URL**, preencha com a URL oficial de produção:
   ```text
   https://app.seudominio.com.br
   ```
3. No campo **Redirect URLs**, registre os padrões permitidos para login social, magic link e confirmação:
   ```text
   https://app.seudominio.com.br/**
   https://app.seudominio.com.br/redefinir-senha
   https://app.seudominio.com.br/confirmar-email
   https://*.pages.dev/**
   http://localhost:5173/**
   ```
4. Salve as alterações.

### 3.7 Auditoria de Entrega dos Cabeçalhos de Borda

Após a propagação do domínio, audite as respostas HTTP via terminal:

```bash
# 1. Auditar HSTS, CSP e cabeçalhos de segurança na raiz:
curl -I https://app.seudominio.com.br

# Resposta esperada contém:
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# content-security-policy: default-src 'self'; ...
# x-frame-options: DENY
# x-content-type-options: nosniff

# 2. Auditar cache imutável de assets estáticos:
curl -I https://app.seudominio.com.br/assets/index-<hash>.js
# Resposta esperada contém:
# cache-control: public, max-age=31536000, immutable
```

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

### 4.6 Edge Functions & Supabase Secrets (Asaas e Telegram)

As Edge Functions do projeto (`asaas-checkout`, `asaas-manage`, `asaas-webhook` e `support-notify`) necessitam de credenciais seguras injetadas diretamente no runtime do Supabase:

#### 1. Configuração via Supabase CLI
```bash
# Definir todas as credenciais sensíveis de produção no cofre do Supabase:
npx supabase secrets set \
  ASAAS_API_KEY="sua_chave_producao_asaas" \
  ASAAS_API_URL="https://api.asaas.com/v3" \
  ASAAS_WEBHOOK_TOKEN="seu_token_secreto_webhook" \
  TELEGRAM_BOT_TOKEN="seu_token_bot_telegram" \
  TELEGRAM_CHAT_ID="seu_chat_id_telegram"
```

#### 2. Matriz de Variáveis Secretas
| Variável | Descrição | Onde Obter / Como Gerar |
|---|---|---|
| `ASAAS_API_KEY` | Chave de API da conta Asaas de produção | Painel Asaas → Menu Superior Direito → Configurações da Conta → Integrações → Gerar Chave de API |
| `ASAAS_API_URL` | URL base do endpoint v3 do Asaas | `https://api.asaas.com/v3` (produção) ou `https://sandbox.asaas.com/api/v3` (homologação) |
| `ASAAS_WEBHOOK_TOKEN` | Token secreto estático para autenticar webhooks | Gerar string de alta entropia (ex.: `openssl rand -hex 24`) e cadastrar no painel do Asaas |
| `TELEGRAM_BOT_TOKEN` | Token do bot de suporte no Telegram | Criado via `@BotFather` no Telegram |
| `TELEGRAM_CHAT_ID` | Identificador do canal/chat de suporte | Obtido via `@userinfobot` ou API do Telegram |

#### 3. Auditoria de Secrets Cadastrados
```bash
npx supabase secrets list
```

### 4.7 Deploy das Edge Functions & Blindagem de Idempotência

O ecossistema de Edge Functions do projeto conta com políticas de segurança estritas e fail-closed:

```bash
# 1. Checkout (criação de cobranças Pix e assinaturas de cartão)
# --no-verify-jwt permite tratamento próprio de CORS no preflight e validação fail-closed via getUser()
npx supabase functions deploy asaas-checkout --no-verify-jwt

# 2. Gestão de Assinatura (cancelamento e atualização de cartão pelo assinante)
npx supabase functions deploy asaas-manage

# 3. Webhook Asaas (recebimento e ativação automática de pagamentos)
# --no-verify-jwt pois o tráfego é server-to-server com autenticação timing-safe via asaas-access-token
npx supabase functions deploy asaas-webhook --no-verify-jwt

# 4. Notificações de Suporte (envio em tempo real de chamados ao Telegram)
npx supabase functions deploy support-notify --no-verify-jwt
```

#### Blindagem e Idempotência no Webhook Asaas (`asaas-webhook`)
1. **Autenticação Timing-Safe:** O token enviado pelo Asaas no cabeçalho `asaas-access-token` é comparado com `ASAAS_WEBHOOK_TOKEN` em tempo constante bit-a-bit (`timingSafeEqualString`), descartando requisições ilegítimas com HTTP 403 sem vazamento de timing.
2. **Idempotência Estrita de Pagamentos:** Quando um evento `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED` é recebido para um pagamento ou assinatura que já se encontra `active` com o mesmo `payment_id` ou `subscription_id`, a função descarta a execução com status 200 `{ duplicate: true, reason: "already_active" }`, impedindo alteração indevida da vigência contratual (`current_period_end`) ou duplicidade de registros.
3. **Resiliência a Retries:** Eventos repetidos de `PAYMENT_OVERDUE` ou `SUBSCRIPTION_DELETED` são absorvidos de forma idempotente sem escritas desnecessárias no banco de dados.

### 4.8 Homologação Transacional Asaas & Checklist de Go-Live (Portão de Qualidade 2)

Para validar a integridade transacional de ponta a ponta com o gateway bancário Asaas:

#### 1. Cadastro do Webhook no Painel Asaas
1. Acesse o **Painel Asaas** (Sandbox ou Produção) → **Menu Superior** → **Configurações da Conta** → **Integrações** → **Webhooks**;
2. Adicione um novo webhook para Cobranças/Assinaturas:
   - **URL de Envio:** `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook`
   - **E-mail para Alertas de Erro:** `suporte@axis.app`
   - **Versão da API:** `v3`
   - **Token de Autenticação (`asaas-access-token`):** Insira a mesma chave gerada para o secret `ASAAS_WEBHOOK_TOKEN` do Supabase;
3. Marque obrigatoriamente os seguintes eventos:
   - `PAYMENT_RECEIVED` (Pagamento recebido via Pix ou saldo)
   - `PAYMENT_CONFIRMED` (Compensação bancária confirmada)
   - `PAYMENT_OVERDUE` (Cobrança vencida sem pagamento)
   - `PAYMENT_DELETED` (Cobrança cancelada ou estornada)
   - `SUBSCRIPTION_DELETED` (Assinatura recorrente encerrada)

#### 2. Execução da Cobrança Real de Teste (R$ 1,00 / Go-Live)
1. Crie uma conta de teste no aplicativo web ou mobile;
2. Navegue até a tela de assinatura (`/subscription/checkout`);
3. Gere o QR Code Pix ou utilize a modalidade cartão de crédito;
4. **Auditoria de Marca no Pix:** Certifique-se de que o comprovante bancário e a descrição exibem a marca oficial `"Áxis Finance"`;
5. Efetue o pagamento de R$ 1,00 (ou valor configurado na sandbox).

#### 3. Auditoria da Transição Atômica no Banco de Dados
Execute a seguinte query no Supabase SQL Editor para auditar o registro do usuário:

```sql
select
  user_id,
  tier,
  status,
  plan_id,
  asaas_payment_id,
  asaas_customer_id,
  current_period_end,
  cancel_at_period_end,
  updated_at
from public.user_subscriptions
where user_id = '<ID_DO_USUARIO_TESTE>';
```

- **Verificação dos Invariantes:**
  * `status`: transiciona de `'trialing'` para `'active'`;
  * `tier`: assume `'pro_annual'` ou `'pro_monthly'`;
  * `current_period_end`: preenchido com a vigência correspondente (+1 ano ou +1 mês);
  * Permissão de escrita ativa: a chamada `public.can_current_user_write()` deve retornar `true`.

#### 4. Homologação do Estorno em 7 Dias (CDC Artigo 49)
1. No painel do Asaas, selecione o pagamento de teste e efetue o **Estorno/Reembolso** da cobrança;
2. O webhook receberá `PAYMENT_DELETED` e marcará atomicamente `cancel_at_period_end = true`;
3. Caso o pagamento seja revertido por inadimplência (`PAYMENT_OVERDUE`), o status passa para `'past_due'` bloqueando escritas futuras com elegância sem quebrar o acesso somente-leitura.

---

## 5. ESTRUTURA DE CONFIGURAÇÃO ESTÁTICA & SEGURANÇA DE BORDA (`public/`)

### 5.1 Cabeçalhos HTTP e Defesa em Profundidade (`public/_headers`)

O arquivo `public/_headers` implementa uma arquitetura de segurança de borda em conformidade com as melhores práticas OWASP e padrões bancários:

1. **Content-Security-Policy (CSP) Estrita:**
   - **Zero Wildcards Permissivos:** Proibido o uso de `*` em `script-src` ou `connect-src`. Apenas origens homologadas e necessárias para o funcionamento do ecossistema são permitidas:
     - `default-src 'self'`: Restringe qualquer recurso não especificado à mesma origem do app;
     - `script-src 'self' 'wasm-unsafe-eval'`: Execução exclusiva de bundles locais e WebAssembly (necessário para bibliotecas de cálculo e compilação client-side);
     - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`: Folhas de estilo locais e tipografia do Google Fonts;
     - `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://brapi.dev https://*.r2.dev`: Conexões REST e WebSockets do Supabase, telemetria Sentry, cotações e distribuição de releases no Cloudflare R2;
     - `font-src 'self' data: https://fonts.gstatic.com`: Fontes estáticas locais e remotas;
     - `img-src 'self' data: blob: https://*.supabase.co`: Imagens locais, avatars, dados base64 e storage do Supabase;
     - `object-src 'none'`: Desativa completamente Flash, Java Applets e plugins herdados;
     - `base-uri 'self'` e `form-action 'self'`: Impede ataques de manipulação de base URL e submissões de formulário externas não-autorizadas.
2. **Prevenção Completa de Clickjacking:**
   - `X-Frame-Options: DENY` e CSP `frame-ancestors 'none'` combinados impedem categoricamente que a aplicação seja embutida dentro de `<iframe>` ou `<frame>` em domínios de terceiros, neutralizando ataques de sobreposição de interface.
3. **Outros Cabeçalhos de Proteção:**
   - `X-Content-Type-Options: nosniff`: Força o navegador a respeitar o MIME-type declarado pelo servidor;
   - `X-XSS-Protection: 1; mode=block`: Bloqueia a renderização em navegadores legados caso um ataque XSS refletido seja detectado;
   - `Referrer-Policy: strict-origin-when-cross-origin`: Omite caminhos internos e parâmetros de rota ao transicionar para domínios externos;
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Desativa sensores físicos sensíveis no ambiente web.

### 5.2 Estratégia de Cache de Borda (Edge Caching)

- **Assets Estáticos Imutáveis (`/assets/*`):**
  - `Cache-Control: public, max-age=31536000, immutable` (1 ano);
  - Como o Vite gera hashes criptográficos únicos no nome de cada chunk JavaScript e CSS (`assets/index-[hash].js`), esses arquivos podem ser cacheados indefinidamente na CDN da Cloudflare e no disco do usuário sem risco de desatualização.
- **Artefatos Dinâmicos de Ciclo de Vida (`/index.html`, `/sw.js`, `/pwa/*`, `manifest.webmanifest`, `version.json`):**
  - `Cache-Control: public, max-age=0, must-revalidate`;
  - Obriga o navegador a sempre validar o ETag/frescor na borda antes de servir o conteúdo, garantindo que novos deploys e atualizações do Service Worker sejam propagados imediatamente a todos os usuários ativos.

### 5.3 Roteamento SPA Fallback Nativo

- O Cloudflare Pages redireciona automaticamente qualquer rota não encontrada para o `dist/index.html` (SPA fallback nativo para Vite/React), dispensando configurações frágeis em `_redirects`.

---

## 6. COMANDOS ÚTEIS (LOCAL)

```bash
npm install          # instala dependências
cp .env.example .env.local   # preencha VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

npm run dev          # dev server (Vite)
npm run typecheck    # tsc -b (valida TODO o projeto, inclusive testes)
npm run lint         # eslint (0 erros esperado)
npm run preflight    # auditoria automatizada de prontidão e saúde (Node, Supabase, Schema, RPCs, Build)
npm run test         # vitest — testes automatizados 100% verde
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

### 7.4 Separação Canônica de Builds: Distribuição Direta (APK) vs Google Play Store (AAB)

O projeto adota uma arquitetura de compilação dual rigorosa para conciliar a auto-atualização direta com as políticas da Google Play Store:

| Requisito / Recurso | Build 1: Distribuição Direta (APK) | Build 2: Google Play Store (AAB) |
|---|---|---|
| **Formato** | `.apk` assinado (`axis-pro.apk`) | `.aab` Android App Bundle |
| **Canal** | Cloudflare R2 / Site Oficial / Painel Pro | Google Play Console / Play Store |
| **Comando de Compilação** | `npm run build:apk` | `npx cap sync android && cd android && ./gradlew bundleRelease` |
| **Permissão `REQUEST_INSTALL_PACKAGES`** | **Presente** (obrigatória para in-app updater) | **Removida** (proibida pelas políticas da Play Store) |
| **Atualizações** | In-App Updater autônomo via `version.json` | Google Play Core In-App Updates / Play Store |
| **Prominent Disclosure (Contrato 4)** | Exibido na aba Notificações | **Mandatório** (auditado por revisores da Google) |

#### Compilação do Android App Bundle (.aab) para a Google Play Store:
1. Comente ou remova a linha `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />` em `android/app/src/main/AndroidManifest.xml`;
2. Execute o build de produção do bundle:
   ```bash
   npm run build && npx cap sync android && cd android && ./gradlew clean bundleRelease
   ```
3. O pacote resultante estará em `android/app/build/outputs/bundle/release/app-release.aab`.

> Para o guia operacional detalhado, respostas do formulário Data Safety e roteiro de submissão na Google Play, consulte [`docs/NATIVE_DISTRIBUTION_GUIDE.md`](./NATIVE_DISTRIBUTION_GUIDE.md) (§8).


