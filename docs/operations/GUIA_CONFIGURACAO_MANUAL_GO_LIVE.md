# 📘 GUIA_CONFIGURACAO_MANUAL_GO_LIVE.md — Guia de Configuração Manual do Fundador

> **Público:** Gabriel Sales (Fundador & Desenvolvedor Responsável).  
> **Objetivo:** Roteiro prático, sequencial e detalhado de todas as etapas manuais externas necessárias para colocar o **Áxis Finance** em pleno funcionamento com seu **domínio próprio**, **Asaas Pessoa Física (CPF)**, **Telegram** e **Resend SMTP**.

---

## ÍNDICE RÁPIDO

1. [Etapa 1: Aquisição do Domínio Próprio & DNS na Cloudflare](#1-etapa-1-aquisição-do-domínio-próprio--dns-na-cloudflare)
2. [Etapa 2: Atualização de URLs no Supabase Cloud](#2-etapa-2-atualização-de-urls-no-supabase-cloud)
3. [Etapa 3: Abertura e Configuração da Conta Asaas Pessoa Física (CPF)](#3-etapa-3-abertura-e-configuração-da-conta-asaas-pessoa-física-cpf)
4. [Etapa 4: Criação do Bot de Suporte no Telegram (@BotFather)](#4-etapa-4-criação-do-bot-de-suporte-no-telegram-botfather)
5. [Etapa 5: Injeção dos Secrets & Deploy das Edge Functions](#5-etapa-5-injeção-dos-secrets--deploy-das-edge-functions)
6. [Etapa 6: Configuração de E-mails Transacionais no Resend (SMTP)](#6-etapa-6-configuração-de-e-mails-transacionais-no-resend-smtp)
7. [Etapa 7: Habilitação de Extensões & Cron de Cotações no Supabase](#7-etapa-7-habilitação-de-extensões--cron-de-cotações-no-supabase)
8. [Etapa 8: Roteiro de Teste Real e Validação do Go-Live](#8-etapa-8-roteiro-de-teste-real-e-validação-do-go-live)
9. [Etapa 9: Submissão do APK ao Google Play Protect (Lista Branca)](#9-etapa-9-submissão-do-apk-ao-google-play-protect-lista-branca)

---


## 1. ETAPA 1: AQUISIÇÃO DO DOMÍNIO PRÓPRIO & DNS NA CLOUDFLARE

### 1.1 Onde Comprar o Domínio
* **Para domínio `.com.br` (Recomendado no Brasil):**
  * Acesse [registro.br](https://registro.br);
  * Custo padrão: R$ 40,00/ano;
  * Sugestões de nomes: `axisapp.com.br`, `axisfinancas.com.br`, `meuaxis.com.br`.
* **Para domínios internacionais (`.com`, `.finance`, `.app`):**
  * Compre diretamente no [Cloudflare Registrar](https://dash.cloudflare.com) (preço de custo sem margem de revenda) ou [Namecheap](https://namecheap.com).

### 1.2 Configurar DNS na Cloudflare
1. Se comprou no Registro.br:
   * No painel da Cloudflare → **Websites** → **Add a site** → informe seu domínio;
   * Selecione o plano **Free**;
   * A Cloudflare indicará 2 servidores de DNS (nameservers), ex.: `ada.ns.cloudflare.com` e `bob.ns.cloudflare.com`;
   * No Registro.br, acesse a gestão do domínio, altere os servidores DNS para os dois indicados pela Cloudflare e salve.

### 1.3 Vincular Domínio Customizado no Cloudflare Pages
1. No painel da Cloudflare → **Workers & Pages** → selecione o projeto `financasNew`;
2. Acesse a aba **Custom Domains** → clique em **Set up a custom domain**;
3. Digite o domínio (ex.: `axisfinancas.com.br` ou `app.axisfinancas.com.br`);
4. Clique em **Continue** e **Activate domain**;
5. Aguarde até o status mudar para **Active** com certificado SSL universal emitido.

### 1.4 Ativar Criptografia SSL/TLS Full (Strict) e HSTS
1. No painel da Cloudflare, selecione o domínio oficial na lateral esquerda;
2. Vá em **SSL/TLS** → **Overview** e selecione o modo **Full (strict)**;
3. Vá em **SSL/TLS** → **Edge Certificates**:
   * **Always Use HTTPS:** Ligue (`On`);
   * **HTTP Strict Transport Security (HSTS):** Clique em *Enable HSTS*, marque `Max-Age: 1 year (31536000)`, `Include subdomains` e `Preload`.

---

## 2. ETAPA 2: ATUALIZAÇÃO DE URLS NO SUPABASE CLOUD

Para que links de confirmação de cadastro e recuperação de senha funcionem sem erros de CORS ou redirecionamento:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e abra o projeto de produção;
2. No menu lateral, acesse **Authentication** → **URL Configuration**;
3. No campo **Site URL**, preencha com a URL oficial de produção (sem barra no final):
   ```text
   https://axisfinancas.com.br
   ```
4. No campo **Redirect URLs**, clique em **Add URL** e adicione:
   ```text
   https://axisfinancas.com.br/**
   https://axisfinancas.com.br/redefinir-senha
   https://axisfinancas.com.br/confirmar-email
   ```
5. Clique em **Save**.

---

## 3. ETAPA 3: ABERTURA E CONFIGURAÇÃO DA CONTA ASAAS PESSOA FÍSICA (CPF)

O gateway bancário Asaas permite cadastro e recebimento tanto para empresas (CNPJ) quanto para **Pessoas Físicas (CPF)**.

### 3.1 Criar a Conta Asaas
1. Acesse [asaas.com](https://www.asaas.com) e clique em **Criar conta grátis**;
2. Selecione a opção **Para Mim (Pessoa Física)**;
3. Preencha seus dados pessoais (nome completo, CPF, e-mail e telefone celular);
4. Conclua o processo de ativação e envio de documento de identidade para liberação de saque e recebimento Pix.

### 3.2 Gerar a Chave de API de Produção
1. Com a conta aprovada no Asaas, clique no seu perfil no **canto superior direito**;
2. Acesse **Configurações da Conta** → aba **Integrações**;
3. Na seção **Chaves de API**, clique em **Gerar nova chave de API**;
4. Copie o token exibido (inicia com `$aact_...`). Guarde este valor, ele será usado no secret `ASAAS_API_KEY`.

### 3.3 Gerar o Token Secreto do Webhook
Gere uma string aleatória e segura no terminal do seu computador para autenticar os webhooks:
```bash
openssl rand -hex 24
```
*Exemplo gerado:* `e8b7c3d9a1f24e6890123456abcdef7890abcdef12345678`  
Guarde este valor, ele será o seu `ASAAS_WEBHOOK_TOKEN`.

### 3.4 Cadastrar o Webhook no Asaas
1. No painel do Asaas, vá em **Configurações da Conta** → **Integrações** → aba **Webhooks**;
2. Clique em **Novo Webhook** para Cobranças/Assinaturas:
   * **Nome:** Supabase Production Webhook
   * **URL de Envio:** `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook` *(substitua `<PROJECT_REF>` pelo ID do seu projeto no Supabase)*;
   * **E-mail para Alertas de Erro:** seu e-mail de contato;
   * **Versão da API:** `v3`;
   * **Token de Autenticação (`asaas-access-token`):** cole o token gerado no passo 3.3 (`ASAAS_WEBHOOK_TOKEN`);
3. Em **Eventos**, marque obrigatoriamente:
   * [x] `PAYMENT_RECEIVED` (Pagamento recebido via Pix ou cartão)
   * [x] `PAYMENT_CONFIRMED` (Compensação bancária confirmada)
   * [x] `PAYMENT_OVERDUE` (Cobrança vencida sem pagamento)
   * [x] `PAYMENT_DELETED` (Cobrança cancelada ou estornada)
   * [x] `SUBSCRIPTION_DELETED` (Assinatura recorrente cancelada)
4. Clique em **Salvar Webhook**.

---

## 4. ETAPA 4: CRIAÇÃO DO BOT DE SUPORTE NO TELEGRAM (@BotFather)

O app envia todos os chamados de suporte abertos pelos usuários diretamente para o seu celular via Telegram.

### 4.1 Criar o Bot
1. Abra o aplicativo do Telegram no celular ou desktop;
2. Pesquise por `@BotFather` (verifique o selo azul de verificado) e inicie uma conversa clicando em **Start**;
3. Envie o comando:
   ```text
   /newbot
   ```
4. O BotFather solicitará um nome para exibição. Exemplo:
   ```text
   Suporte Áxis Finance
   ```
5. Em seguida, solicitará um username (deve terminar obrigatoriamente com `bot`). Exemplo:
   ```text
   axis_finance_suporte_bot
   ```
6. O BotFather responderá com o token de acesso HTTP.  
   *Exemplo:* `7123456789:AAFlkjhsdf987234_sdfkjh234`  
   Guarde este valor, ele será o seu `TELEGRAM_BOT_TOKEN`.

### 4.2 Obter o seu Chat ID Pessoal
1. No Telegram, abra a conversa com o seu próprio bot recém-criado e clique em **Start** (ou envie `/start`);
2. Em seguida, pesquise pelo bot `@userinfobot` no Telegram e clique em **Start**;
3. Ele responderá com os seus dados de usuário, incluindo o campo:
   ```text
   Id: 123456789
   ```
4. Esse número é o seu identificador privado no Telegram. Guarde este valor, ele será o seu `TELEGRAM_CHAT_ID`.

### 4.3 Gestão e Controle Programável do Bot (No Painel Admin)
O bot do Telegram do Áxis é 100% programável e modular. Uma vez configuradas as credenciais, você pode ligar ou desligar canais específicos a qualquer momento sem reiniciar servidores ou fazer novos deploys:
1. Acesse o aplicativo como Administrador e navegue para a aba **Sistema & Auditoria** (`/admin?tab=sistema`);
2. Localize o card **Configuração do Bot Telegram (Canais de Transmissão)**;
3. Ative ou desative os canais conforme sua preferência de operação:
   - **Chamados de Suporte:** Notificações em tempo real com deep link direto para o chamado no painel admin;
   - **Git Commits & Push:** Alertas automatizados de commits enviados ao repositório via script de CI/CD;
   - **Deploys & Releases:** Avisos de publicação de novas versões e builds;
   - **Telemetria de Uso:** Alertas periódicos de volume e métricas de funcionalidades acessadas;
   - **Novos Usuários Cadastrados:** Alerta imediato a cada novo registro na plataforma;
   - **Modo Silencioso (DND):** Pausa todas as notificações do bot instantaneamente com apenas um switch.

---

## 5. ETAPA 5: INJEÇÃO DOS SECRETS & DEPLOY DAS EDGE FUNCTIONS

Com os dados em mãos, injete todos os segredos no cofre seguro do Supabase e suba as Edge Functions.

### 5.1 Fazer Login na Supabase CLI (se necessário)
No terminal da sua máquina, execute:
```bash
npx supabase login
```
*Siga a instrução no navegador para autorizar o token de acesso pessoal.*

### 5.2 Vincular ao Projeto de Produção
```bash
npx supabase link --project-ref <PROJECT_REF>
```
*(O `PROJECT_REF` é a sigla de letras e números que aparece na URL do dashboard do seu projeto no Supabase, ex.: `abcdefghijklmno`)*.

### 5.3 Injetar as Secrets de Produção
Execute o comando abaixo preenchendo os seus valores reais:

```bash
npx supabase secrets set \
  ASAAS_API_KEY="COLE_AQUI_SUA_CHAVE_ASAAS_$aact" \
  ASAAS_API_URL="https://api.asaas.com/v3" \
  ASAAS_WEBHOOK_TOKEN="COLE_AQUI_O_TOKEN_ALEATORIO_DO_WEBHOOK" \
  TELEGRAM_BOT_TOKEN="COLE_AQUI_O_TOKEN_DO_BOT_TELEGRAM" \
  TELEGRAM_CHAT_ID="COLE_AQUI_SEU_CHAT_ID_NUMERICO"
```

Para verificar se foram salvas corretamente:
```bash
npx supabase secrets list
```

### 5.4 Deploy das 5 Edge Functions
Execute o script automatizado registrado no seu `package.json`:
```bash
npm run deploy:functions
```
Ele publicará as seguintes funções:
* `asaas-checkout` (Criação de cobranças Pix e assinaturas de cartão)
* `asaas-manage` (Cancelamento e gestão de assinatura pelo cliente)
* `asaas-webhook` (Recepção e ativação automática de pagamentos)
* `support-notify` (Encaminhamento de chamados in-app para o Telegram)
* `quotes` (Alimentação server-side do cache de cotações de mercado)

---

## 6. ETAPA 6: CONFIGURAÇÃO DE E-MAILS TRANSACIONAIS NO RESEND (SMTP)

O Supabase possui uma cota padrão de **30 e-mails por hora** no plano Free e envia via `noreply@mail.app.supabase.io` (geralmente caindo no Spam). O Resend oferece 3.000 envios/mês gratuitos no seu próprio domínio com 100% de entregabilidade.

### 6.1 Criar Conta e Adicionar Domínio no Resend
1. Acesse [resend.com](https://resend.com) e crie uma conta gratuita;
2. No menu lateral, acesse **Domains** → clique em **Add Domain**;
3. Digite o seu domínio (ex.: `axisfinancas.com.br`);
4. O Resend fornecerá 3 registros DNS obrigatórios:
   * **TXT (SPF):** Nome `send` (ou `@`), Valor `v=spf1 include:amazonses.com ~all`
   * **CNAME (DKIM):** Nome `resend._domainkey`, Valor `resend._domainkey.resend.com`
   * **TXT (DMARC):** Nome `_dmarc`, Valor `v=DMARC1; p=none; rua=mailto:dmarc@axisfinancas.com.br`
   * **MX (Retorno):** Prioridade 10, Servidor `feedback-smtp.us-east-1.amazonses.com`

### 6.2 Adicionar os Registros no DNS da Cloudflare
1. Abra o painel da Cloudflare no seu domínio → **DNS** → **Records**;
2. Clique em **Add record** e cadastre cada um dos registros informados pelo Resend;
3. Volte ao Resend e clique em **Verify Records**. Aguarde até o status ficar verde (**Verified**).

### 6.3 Gerar API Key no Resend
1. No menu do Resend, clique em **API Keys** → **Create API Key**;
2. Dê um nome (ex.: `Supabase Production Auth`) com permissão **Full Access**;
3. Copie a chave gerada (inicia com `re_...`).

### 6.4 Configurar o SMTP no Painel do Supabase
1. No dashboard do Supabase → **Authentication** → **SMTP Settings**;
2. Ative a chave **Enable Custom SMTP**;
3. Preencha com os dados exatos:
   * **Sender Email:** `nao-responda@axisfinancas.com.br` *(use o seu domínio verificado)*
   * **Sender Name:** `Áxis Finance`
   * **Host:** `smtp.resend.com`
   * **Port:** `465` (com SSL) ou `587` (com TLS)
   * **Username:** `resend`
   * **Password:** `<SUA_API_KEY_DO_RESEND_INICIADA_COM_re_>`
   * **Minimum TLS version:** `TLS 1.2`
4. Clique em **Save**. A partir deste momento, todos os cadastros e recuperações de senha sairão pelo Resend com entrega garantida na Caixa de Entrada.

---

## 7. ETAPA 7: HABILITAÇÃO DE EXTENSÕES & CRON DE COTAÇÕES NO SUPABASE

Para que a tabela de cotações (`asset_prices`) seja atualizada automaticamente durante o pregão da B3 sem que os usuários precisem consultar APIs externas:

### 7.1 Habilitar Extensões no Banco
1. Acesse o **Supabase Dashboard** → **SQL Editor**;
2. Execute o comando:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```
3. Clique em **Run** (deve retornar `Success. No rows returned`).

### 7.2 Gerar o Script de Agendamento do Cron
No terminal da sua máquina, execute:
```bash
npm run quotes:cron
```
O script lerá as variáveis do seu arquivo `.env` / `.env.local` e imprimirá no terminal o bloco SQL pronto.

### 7.3 Executar no SQL Editor
1. Copie o bloco SQL gerado pelo terminal;
2. Cole no **SQL Editor** do Supabase Dashboard;
3. Clique em **Run**.

### 7.4 Conferir se o Cron está Ativo
Execute a consulta:
```sql
select jobid, jobname, schedule, active from cron.job;
```
Você verá o job `update-asset-quotes` ativo com a frequência definida.

---

## 8. ETAPA 8: ROTEIRO DE TESTE REAL E VALIDAÇÃO DO GO-LIVE

Antes de divulgar aos primeiros clientes, execute este teste de ponta a ponta:

1. **Acessar a Aplicação no Domínio Oficial:**
   * Abra `https://seudominio.com.br` no navegador (ou instale o PWA pelo ícone da barra de endereços);
2. **Criar uma Conta de Teste:**
   * Cadastre-se com um e-mail pessoal secundário;
   * Verifique se o e-mail de confirmação chegou na Caixa de Entrada via Resend;
3. **Auditar o Período de Trial:**
   * Entre na aplicação e vá em **Configurações** → **Assinatura**;
   * Certifique-se de que o badge exibe **30 dias de teste restantes** e status `trialing`;
4. **Testar o Chat de Suporte com Push no Telegram:**
   * Clique no botão de **Ajuda / Suporte** no menu do app;
   * Envie uma mensagem de teste (ex.: *"Teste de suporte do fundador"*);
   * Verifique se a notificação caiu instantaneamente no seu Telegram com os metadados do chamado;
5. **Teste de Cobrança Pix de R$ 1,00:**
   * Acesse a tela de checkout (`/subscription/checkout`);
   * Gere uma cobrança Pix de teste;
   * Efetue o pagamento de R$ 1,00 pelo aplicativo do seu banco;
   * Verifique se a conta transiciona imediatamente para o Plano Pro Ativo (`active`);
   * No painel do Asaas, selecione a cobrança e efetue o **Estorno/Reembolso** do R$ 1,00 para validar o cumprimento da garantia legal de 7 dias (CDC Art. 49).

---

## 9. ETAPA 9: SUBMISSÃO DO APK AO GOOGLE PLAY PROTECT (LISTA BRANCA)

Como o aplicativo Áxis distribui uma versão Android Pro de alto desempenho diretamente pelo site (sem passar pela Google Play Store), o serviço **Google Play Protect** e o recurso de segurança **Samsung Bloqueador Automático (Auto Blocker)** podem exibir alertas preventivos para os usuários caso a assinatura ainda não seja conhecida nos servidores do Google.

Para eliminar esse atrito e colocar o aplicativo na lista de permissão (whitelist) do Google:

### 9.1 Gerar os Dados Prontos da Aplicação
No terminal do projeto, execute o comando automatizado:
```bash
npm run playprotect:info
```
Este comando extrairá automaticamente a impressão digital criptográfica SHA-256 da sua keystore oficial (`release-key.keystore`), a hash do APK atual e gerará o texto de apelação pronto para envio.

### 9.2 Preencher o Formulário de Apelação do Google
1. Acesse o portal oficial de apelações do Google Play Protect:  
   👉 **[https://support.google.com/googleplay/android-developer/contact/protectappeals](https://support.google.com/googleplay/android-developer/contact/protectappeals)**
2. Preencha os campos com os dados impressos pelo comando:
   * **Developer Name:** `Gabriel Sales`
   * **Developer Email:** Seu e-mail de contato / suporte (ex.: seu Gmail de desenvolvedor)
   * **Application Package Name:** `com.guiafinanceiro.app`
   * **App Name:** `Áxis — Controle Financeiro`
   * **Download Link to APK:** `https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk`
   * **Certificate SHA-256 Fingerprint:** Cole o fingerprint exibido no terminal (`B9:C1:4B:F2:4D:F9:95:0A:84:70:EA:2E:02:6C:BC:2D:84:32:86:FE:6F:0A:30:8F:8B:F3:1D:4A:5C:29:9A:1B`)
   * **Description / Justification:** Copie e cole o texto em inglês gerado pelo script na Seção 2.
3. Clique em **Submit**.

### 9.3 O que Esperar do Google
* O robô de triagem do Google Play Protect realiza a varredura do APK na URL fornecida em um prazo de **48 a 72 horas úteis**.
* Assim que aprovado, a assinatura digital da sua keystore passa a ser reconhecida pelo ecossistema Android e o Play Protect para de bloquear ou exibir telas de aviso no download.
* **Nota sobre atualizações futuras:** Como mantemos a mesma keystore criptográfica permanente (`release-key.keystore`), as novas versões compiladas herdam a mesma confiabilidade e atualizam via In-App Updater sem novos bloqueios.

### 9.4 Dica para Aparelhos Samsung Galaxy (One UI 6+)
Em smartphones Samsung atualizados com Android 14/One UI 6, a fabricante introduziu o recurso **Bloqueador Automático (Auto Blocker)** que bloqueia downloads fora de lojas por padrão.
* Se um usuário relatar que não consegue abrir o arquivo APK baixado, instrua-o a:
  1. Abrir **Configurações** do Samsung;
  2. Acessar **Segurança e Privacidade**;
  3. Tocar em **Bloqueador Automático** e desativá-lo temporariamente para instalar o app.

---

🎉 **Parabéns!** Cumpridas estas etapas, o **Áxis Finance** estará operando em produção de nível profissional, com segurança bancária, compliance LGPD/CDC e zero pontos únicos de falha.
