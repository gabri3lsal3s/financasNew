# Runbook Operacional do Fundador — Axir

> **Manual de Bordo para Operação de Produção & Primeiros Clientes**  
> Guia prático de procedimentos operacionais para atendimento a clientes, concessão manual de planos, resolução de faturamento, privacidade (LGPD), monitoramento e resposta a incidentes.

---

## 1. PRIMEIRO ATENDIMENTO A CLIENTES (SUPORTE EM TEMPO REAL)

O Axir possui um canal de atendimento integrado diretamente ao aplicativo (`SupportChatDialog`), conectado à Edge Function `support-notify`, que despacha notificações instantâneas para o canal privado do Telegram do fundador.

### 1.1 Anatomia da Notificação no Telegram
Ao abrir um chamado pelo botão de ajuda no cabeçalho ou menu móvel, o fundador recebe uma mensagem formatada contendo:
- **Identificação do Cliente:** Nome completo e e-mail com link direto `mailto:`;
- **Tipo de Chamado:**
  * *Dúvida:* Questões de navegação, lançamentos ou regras de carteira;
  * *Problema Técnico (Bug):* Falha de tela, erro capturado pelo `AppErrorBoundary` ou anomalia visual;
  * *Sugestão:* Feedback de melhoria ou solicitação de novo recurso;
- **Contexto de Navegação:** Rota exata do aplicativo onde o usuário estava ao relatar;
- **Metadados do Dispositivo:** Plataforma (`Web`, `PWA` ou `Android APK`), versão do sistema operacional e versão do aplicativo (`app_version`).

### 1.2 Roteiro de Resposta e SLA
- **Tempo de Resposta Alvo:** Menos de 15 minutos para os 100 primeiros clientes;
- **Canais de Resposta:**
  1. **E-mail:** Clique no link `mailto:` gerado no alerta do Telegram para responder diretamente ao cliente com o e-mail corporativo (`axisfinance.app@gmail.com`);
  2. **WhatsApp Corporativo:** Caso o cliente tenha cadastrado telefone no perfil ou checkout, o fundador pode iniciar contato direto cordial e ágil;
- **Registro no Painel Administrativo (`/admin`):**
  1. Acesse o aplicativo e navegue até a rota `/admin`;
  2. Clique na aba **Chamados de Suporte**;
  3. Localize o ticket correspondente;
  4. Clique em **Atender Chamado**;
  5. Alterne o status para `in_progress` enquanto investiga;
  6. Insira anotações internas no campo **Notas do Administrador** (ex.: *"Respondido por e-mail às 14h30 com instruções de conciliação"*);
  7. Após o encerramento do problema, altere o status para `resolved` ou `closed`.

---

## 2. GESTÃO MANUAL DE PLANOS & AJUSTES DE ACESSO

Como fundador, você dispõe de autonomia total para conceder acessos VIP, estender períodos de teste ou customizar permissões modulares.

### 2.1 Concessão de Plano Lifetime / Beta VIP
Para premiar usuários pioneiros, parceiros ou clientes influenciadores:

#### Método A — Via Painel Administrativo (`/admin`):
1. Acesse `/admin` → aba **Usuários**;
2. Localize o usuário pelo nome ou e-mail na barra de busca;
3. Clique em **Editar Acesso**;
4. No campo **Plano**, selecione `Vitalício (Lifetime)`;
5. No campo **Status da Assinatura**, selecione `Ativo (active)`;
6. Clique em **Salvar Alterações**. A mudança tem efeito imediato sem necessidade de logout.

#### Método B — Via Supabase SQL Editor:
```sql
select public.admin_set_user_subscription(
  p_user_id := '<ID_DO_USUARIO_UUID>',
  p_plan_id := 'lifetime',
  p_tier := 'lifetime'::public.subscription_tier,
  p_status := 'active'::public.subscription_status
);
```

### 2.2 Extensão Manual de Trial (Período de Degustação)
Caso um cliente solicite mais tempo para testar a plataforma antes de assinar:
```sql
-- Estende o trial por mais 30 dias a partir da data atual:
update public.user_subscriptions
set
  trial_ends_at = now() + interval '30 days',
  status = 'trialing'::public.subscription_status,
  updated_at = now()
where user_id = '<ID_DO_USUARIO_UUID>';
```

### 2.3 Concessão Modular Específica (Feature Flag por Usuário)
Para liberar módulos avançados (ex.: Investimentos / Rebalanceamento) a usuários específicos:
```sql
-- Concede permissão de escrita no módulo de investimentos:
select public.admin_set_user_module_permission(
  p_user_id := '<ID_DO_USUARIO_UUID>',
  p_module_key := 'investments',
  p_access_level := 'write'::public.access_level,
  p_expires_at := now() + interval '90 days'
);
```

---

## 3. RESOLUÇÃO DE PROBLEMAS DE FATURAMENTO (GATEWAY ASAAS)

A integração com o Asaas opera de forma automatizada via Webhook, mas eventuais divergências bancárias contam com procedimentos de contingência simples:

### 3.1 Pagamento Realizado sem Liberação Automática (Atraso de Webhook)
**Cenário:** O cliente pagou via Pix ou cartão, mas a conta continua com status `trialing` ou `incomplete`.

#### Diagnóstico Rápido:
1. Acesse o **Painel do Asaas** → **Cobranças** e pesquise pelo CPF ou e-mail do cliente;
2. Verifique o status da cobrança no Asaas:
   - Se estiver `RECEIVED` ou `CONFIRMED`: o pagamento foi processado pelo Asaas;
   - Acesse **Configurações > Integrações > Webhooks > Logs de Envio** no Asaas e verifique se a requisição para `/functions/v1/asaas-webhook` retornou `HTTP 200`.

#### Resolução Sem Atrito (Ativação Manual Imediata):
Nunca deixe o cliente esperando na fila enquanto investiga a rede:
1. No painel `/admin` do Áxis Finance, localize o usuário e altere o plano para `Pro Anual` ou `Pro Mensal` com status `Ativo`;
2. Notifique o cliente: *"Seu plano Pro foi ativado manualmente com sucesso e já está disponível em todas as suas telas."*;
3. Em seguida, verifique se a URL do webhook ou a chave secreta `ASAAS_WEBHOOK_TOKEN` estão sincronizadas.

### 3.2 Cancelamento e Reembolso em até 7 Dias (CDC Artigo 49) vs Pós-7 Dias
O Áxis Finance respeita integralmente o Código de Defesa do Consumidor e possui fluxo automatizado no app e contingência manual no Asaas:

#### A. Autoatendimento no Aplicativo (`Configurações > Assinatura`):
- **Cancelamento em até 7 dias corridos:** O próprio usuário clica em "Cancelar Assinatura e Reembolsar". A Edge Function `asaas-manage` calcula o intervalo de 7 dias, aciona a API do Asaas (`POST /payments/{id}/refund`), estorna o valor integral (Pix ou Cartão), cancela a assinatura recorrente e rebaixa imediatamente o usuário para `tier = 'read_only'`.
- **Cancelamento após 7 dias corridos:** O usuário clica em "Cancelar Renovação". A Edge Function cancela a assinatura no Asaas (`DELETE /subscriptions/{id}`) para evitar cobranças futuras, marca `cancel_at_period_end = true` e o usuário mantém o acesso Pro completo até o fim da data paga (`current_period_end`). Ao expirar, o banco transiciona automaticamente para `read_only`.

#### B. Procedimento Manual de Suporte (Painel Asaas):
Caso o cliente entre em contato com o fundador solicitando o estorno manualmente:
1. Acesse o **Painel do Asaas** → **Cobranças**;
2. Localize a transação do cliente pelo e-mail ou CPF;
3. Clique em **Mais Ações** → **Estornar Cobrança**;
4. Confirme o estorno integral para a conta de origem (Pix ou Cartão);
5. O Asaas enviará automaticamente o evento `PAYMENT_REFUNDED` para o webhook;
6. O sistema rebaixará atomicamente a assinatura para `tier = 'read_only'` e `status = 'canceled'` no banco de dados;
7. Envie o comprovante de estorno gerado pelo Asaas para o e-mail ou WhatsApp do cliente.

---

## 4. PRIVACIDADE, LGPD & EXCLUSÃO MANUAL DE DADOS

O Axir adota o princípio de **Privacidade por Padrão (Privacy by Design)** com banco relacional multi-tenant estritamente isolado por RLS (`Row-Level Security`).

### 4.1 Autoatendimento do Cliente no Aplicativo
Oriente sempre o cliente a utilizar os recursos de autoatendimento nativos:
- **Exportação de Dados:** O usuário pode baixar todas as suas contas, faturas, movimentações e histórico em formato aberto Excel (`.xlsx`) ou JSON acessando **Configurações > Conta > Exportação de Dados**;
- **Zona de Perigo (Exclusão Autônoma):** O próprio usuário pode solicitar a eliminação irrevogável de sua conta e de todos os seus dados em **Configurações > Conta > Zona de Perigo**, acionando a RPC atômica `public.delete_user_account()`.

### 4.2 Atendimento a Solicitações de DPO / Encarregado de Dados
Caso chegue uma solicitação formal pelo canal de privacidade (`axisfinance.app@gmail.com`):
1. Confirme a identidade do solicitante através do e-mail cadastrado na conta;
2. Caso o usuário prefira que a exclusão seja realizada pela equipe de engenharia, execute via SQL no Supabase:
```sql
-- Exclusão atômica em cascata de todos os dados do titular (LGPD Art. 18):
select public.delete_user_account(); -- quando executado no contexto do usuário
-- Ou administrativamente:
delete from auth.users where id = '<ID_DO_USUARIO_UUID>';
-- Todas as tabelas públicas (profiles, transactions, subscriptions, etc.)
-- possuem constraints ON DELETE CASCADE e são purgadas atomicamente.
```

---

## 5. MONITORAMENTO OPERACIONAL & DIAGNÓSTICO EM PRODUÇÃO

### 5.1 Onde Acompanhar Métricas de Saúde

| Camada | Ferramenta / Console | O que Monitorar | Alerta de Ação |
|---|---|---|---|
| **Frontend & Borda** | Cloudflare Pages Dashboard | Requisições/segundo, taxa de cache de assets (> 95% esperado), HTTP 5xx | Subir issue se houver pico de erros 520/522 |
| **Erros e Exceções** | Sentry Dashboard | Issues não resolvidas, taxa de erros capturados pelo `AppErrorBoundary` | Investigar falhas com mais de 5 ocorrências |
| **Banco de Dados** | Supabase Dashboard | Conexões ativas no pooler PgBouncer, CPU do banco, consumo de storage | Ativar pooler Transaction se conexões > 80% |
| **Edge Functions** | Supabase Functions Logs | Invocações de `quotes`, `support-notify`, `asaas-webhook` | Verificar falhas 403 (token inválido) ou timeouts |

### 5.2 O Comando Universal de Pré-Voo (`npm run preflight`)
Antes de liberar o acesso a um novo grupo de clientes ou após qualquer deploy de infraestrutura, execute na máquina local:

```bash
npm run preflight
```

O script executará automaticamente:
1. Validação de paridade do runtime Node.js;
2. Checagem das variáveis de ambiente de produção;
3. Teste de conectividade Auth e REST do Supabase;
4. Integridade de esquema das 5 tabelas críticas;
5. Disponibilidade da RPC `get_my_subscription()`;
6. Saúde do cache de cotações em `public.asset_prices`;
7. Compilação estrita TypeScript (`tsc -b`) e linting (`eslint .`).

**Critério de Prontidão:** Todas as checagens com status `[ SUCESSO ]` e 0 falhas críticas.

---

## 6. CONTINGÊNCIAS RÁPIDAS & MATRIZ DE RESPOSTA A INCIDENTES

### Incidente 1: "Cotações de Investimentos Desatualizadas"
- **Causa Provável:** Falha momentânea na API externa de mercado ou cron pg_cron suspenso.
- **Ação Imediata:** Execute `npm run quotes:cron` e aplique o script gerado no SQL Editor do Supabase, ou force a atualização manual invocando:
  ```bash
  curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/quotes" \
    -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
  ```

### Incidente 2: "Erro Inesperado na Tela do Cliente (Tela Branca Evitada)"
- O componente `AppErrorBoundary` intercepta a exceção React, apresenta a tela estilizada do Design System com botão de recarregar e atalho *"Reportar ao Suporte"*.
- O erro é gravado no Sentry com o `componentStack`. Localize o release correspondente no Sentry para isolar a issue e providenciar o hotfix.

### Incidente 3: "Novo Deploy em Andamento e Clientes com Abas Abertas"
- O listener global `window.addEventListener('vite:preloadError')` entra em ação automaticamente: caso o navegador tente baixar um chunk JavaScript antigo que já foi substituído no Cloudflare Pages, o app efetua um reload suave automático, mantendo o usuário na versão mais recente sem quebra de experiência.

### Incidente 4: "Cliente Perdeu o Smartphone / Aplicativo Autenticador (2FA / TOTP)"
- **Cenário:** O usuário ativou 2FA/TOTP no painel de segurança, mas trocou de aparelho celular, desinstalou o autenticador ou perdeu o dispositivo e não consegue realizar o segundo fator de autenticação.
- **Protocolo de Verificação de Identidade (Obrigatório antes de qualquer ação):**
  1. Solicite confirmação enviada a partir do **mesmo e-mail cadastrado na conta**;
  2. Confirme os últimos 4 dígitos do telefone cadastrado e o nome completo do titular;
  3. Para planos Pro pagos, confirme a data e valor aproximado da última transação no Asaas.
- **Procedimento Direto no Painel Superadmin (1 Clique — Recomendado):**
  1. Acesse o **Painel Administrativo** (`/admin/users`);
  2. Localize o usuário e clique no botão **Gerenciar**;
  3. Na seção **Ações de Suporte do Superadmin**, clique no botão **Resetar 2FA**;
  4. Confirme no diálogo. O sistema remove atomicamente todos os fatores TOTP em `auth.mfa_factors` via RPC/Edge Function auditada e registra a ação em `audit_events`.
  5. *(Opcional)* Se o cliente também esqueceu a senha, clique em **Link Recuperação** para gerar na hora uma URL segura de acesso direto e despachar via WhatsApp ou E-mail.
- **Procedimento Emergencial via SQL (Caso o painel admin esteja inacessível):**
  No **Supabase Dashboard > SQL Editor**, execute a desativação do fator TOTP para o ID do usuário:
  ```sql
  -- Invoca a RPC atômica criada para o Superadmin:
  select public.admin_reset_user_mfa('<ID_DO_USUARIO_UUID>');
  ```
- **Pós-Atendimento:**
  1. O cliente conseguirá acessar imediatamente utilizando apenas e-mail e senha (ou pelo link de recuperação gerado);
  2. Oriente o usuário a acessar **Configurações > Conta > Gerenciar 2FA** para cadastrar seu novo dispositivo autenticador.

---

### Incidente 5: "Provisionamento Direto de Conta pelo Superadmin (Convite VIP / Corporativo)"
- **Cenário:** O fundador deseja criar uma conta completa para um cliente ou parceiro VIP sem que o cliente precise passar pelo fluxo público de cadastro.
- **Regra de Ouro da LGPD:** O administrador **NUNCA** cria nem digita a senha do cliente.
- **Procedimento:**
  1. No painel de usuários (`/admin/users`), clique no botão **Adicionar Usuário** no cabeçalho;
  2. Preencha o Nome Completo, E-mail, Telefone (opcional), Cargo administrativo inicial e Plano SaaS (Free, Pro ou Lifetime);
  3. Clique em **Cadastrar e Gerar Link**;
  4. O sistema cria o usuário de forma atômica no banco, configura a assinatura e perfil, grava o evento de auditoria e gera um **Link Soberano de Ativação**;
  5. Copie o link ou clique em **Despachar Link via WhatsApp do Cliente** para enviar diretamente na conversa privada do cliente;
  6. Ao abrir o link, o cliente é recebido em tela segura onde define sua própria senha pessoal e já ingressa na plataforma com o plano configurado.

---

## 7. DEFINIÇÃO DE PRONTIDÃO (CHECKLIST FINAL DE GO-LIVE)

Antes de entregar o aplicativo ao primeiro cliente pagante, valide os 8 itens fundamentais:
- [ ] `npm run preflight` executado com 100% de sucesso no terminal (validação com credenciais ativas do ambiente);
- [ ] Suíte de testes `npm test` verde com ~2.300+ testes unitários e de integração;
- [ ] Domínio próprio com SSL Full (Strict) apontando para o Cloudflare Pages;
- [ ] E-mail de cadastro de teste entregue diretamente na Caixa de Entrada via Resend;
- [ ] Chamado de teste enviado via chat de suporte entregue no Telegram em < 2 segundos;
- [ ] Cobrança de teste de R$ 1,00 via Pix processada no Asaas com nome "Áxis Finance";
- [ ] Selo Pro ativado na conta de teste sem intervenção manual;
- [x] Termos de Uso e Política de Privacidade acessíveis no rodapé (`landing-footer.tsx` e `LegalDialog`).

---

## 8. NOVO PAINEL ADMINISTRATIVO & GOVERNANÇA AVANÇADA (v3.0)

O ecossistema administrativo do Áxis Finance foi completamente isolado da aplicação de finanças pessoais do cliente comum, contando com seu próprio shell de navegação, portal de autenticação dedicado e políticas rígidas de conformidade.

### 8.1 Autenticação e Acesso ao Console (`/admin/login`)
- **Rota de Entrada:** `https://app.axisfinance.app/admin/login`
- **Isolamento de Sessão:** O guarda de rotas `RequireAdminSession` bloqueia qualquer acesso sem login administrativo prévio. Se um usuário comum tentar abrir rotas sob `/admin/*`, é imediatamente desconectado e enviado a `/admin/login`.
- **Anti-Bot & Brute-Force:** O portal conta com Cloudflare Turnstile e bloqueio automático progressivo (3 tentativas: 15s; 5 tentativas: 60s).

### 8.2 Controle de Acesso ao Aplicativo Nativo (APK Android Beta)
Para gerenciar o beta fechado com precisão cirúrgica sem necessidade de compilar novas versões:
1. Acesse o **Console Admin** → **Sistema & Configurações** (`/admin/settings`);
2. Localize a seção **Controle de Acesso ao Aplicativo Nativo (APK Android)**;
3. Alterne as chaves:
   - `apk_access_free`: Libera o login pelo APK nativo para usuários do plano Free;
   - `apk_access_pro`: Libera o login pelo APK nativo para assinantes do plano Pro;
4. **Comportamento no Dispositivo:** Caso o acesso ao APK esteja desligado para o plano do usuário, o aplicativo Android exibe um modal bloqueador amigável convidando o cliente a usar o Áxis via navegador móvel (PWA/Web). Operadores com perfil `admin`/`superadmin` possuem passe livre irrestrito para homologação.

### 8.3 Central de Notificações & Broadcast Push (`/admin/notifications`)
Permite despachar comunicados instantâneos na barra de alertas do aplicativo dos clientes:
- **Públicos Selecionáveis:** Todos os usuários (`all`), apenas assinantes Pro (`pro`), contas gratuitas (`free`) ou um usuário específico por ID UUID (`specific_user`);
- **Tipos Semânticos:** Informativo (`info`), Sucesso (`success`), Alerta Operacional (`warning`) ou Manutenção Crítica (`critical`);
- **Ações Clicáveis:** Suporte a links internos (ex: `/ferramentas`, `/configuracoes`) com rastreamento de leitura individual em `user_notification_reads`.

### 8.4 Central de Backups & Disaster Recovery (DRP) (`/admin/backups`)
1. **Geração de Snapshot:** Clique em **Gerar Snapshot Agora**. O console compila todos os registros públicos e metadados, calcula o checksum SHA-256 no cliente e registra o evento na tabela `system_backups`;
2. **Download Seguro:** O arquivo `.json` versionado pode ser baixado e arquivado em cofre seguro;
3. **Verificação de Integridade:** Na ferramenta de validação, cole o hash SHA-256 de qualquer backup histórico para atestar se o arquivo não sofreu corrupção ou adulteração de dados.

### 8.5 Cofre de Contato Auditado (LGPD) (`/admin/users`)
- O telefone/WhatsApp e o CPF dos clientes não são expostos em listagens públicas nem no REST do Supabase (`REVOKE SELECT`).
- Na tela de edição de usuário, o operador clica em **Revelar Telefone & CPF (Auditado)**.
- A visualização invoca a RPC `admin_get_user_contact_details`, que registra compulsoriamente a auditoria em `audit_events` com timestamp, ID do operador e ID do cliente, assegurando total conformidade com a LGPD e link direto para WhatsApp de suporte.

