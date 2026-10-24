# Runbook Operacional do Fundador — Áxis Finance

> **Manual de Bordo para Operação de Produção & Primeiros Clientes**  
> Guia prático de procedimentos operacionais para atendimento a clientes, concessão manual de planos, resolução de faturamento, privacidade (LGPD), monitoramento e resposta a incidentes.

---

## 1. PRIMEIRO ATENDIMENTO A CLIENTES (SUPORTE EM TEMPO REAL)

O Áxis Finance possui um canal de atendimento integrado diretamente ao aplicativo (`SupportChatDialog`), conectado à Edge Function `support-notify`, que despacha notificações instantâneas para o canal privado do Telegram do fundador.

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
  1. **E-mail:** Clique no link `mailto:` gerado no alerta do Telegram para responder diretamente ao cliente com o e-mail corporativo (`suporte@axis.finance`);
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

### 3.2 Cancelamento e Reembolso em até 7 Dias (CDC Artigo 49)
O Áxis Finance respeita integralmente o Código de Defesa do Consumidor. Caso o cliente solicite arrependimento no prazo de 7 dias da contratação:

1. Acesse o **Painel do Asaas** → **Cobranças**;
2. Localize a transação do cliente;
3. Clique em **Mais Ações** → **Estornar Cobrança**;
4. Confirme o estorno integral para a conta de origem (Pix ou Cartão);
5. O Asaas enviará automaticamente o evento `PAYMENT_DELETED` para o webhook;
6. O sistema marcará atomicamente `cancel_at_period_end = true` no banco de dados;
7. Envie o comprovante de estorno gerado pelo Asaas para o e-mail do cliente.

---

## 4. PRIVACIDADE, LGPD & EXCLUSÃO MANUAL DE DADOS

O Áxis Finance adota o princípio de **Privacidade por Padrão (Privacy by Design)** com banco relacional multi-tenant estritamente isolado por RLS (`Row-Level Security`).

### 4.1 Autoatendimento do Cliente no Aplicativo
Oriente sempre o cliente a utilizar os recursos de autoatendimento nativos:
- **Exportação de Dados:** O usuário pode baixar todas as suas contas, faturas, movimentações e histórico em formato aberto Excel (`.xlsx`) ou JSON acessando **Configurações > Conta > Exportação de Dados**;
- **Zona de Perigo (Exclusão Autônoma):** O próprio usuário pode solicitar a eliminação irrevogável de sua conta e de todos os seus dados em **Configurações > Conta > Zona de Perigo**, acionando a RPC atômica `public.delete_user_account()`.

### 4.2 Atendimento a Solicitações de DPO / Encarregado de Dados
Caso chegue uma solicitação formal pelo canal de privacidade (`privacidade@axis.finance`):
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

---

## 7. DEFINIÇÃO DE PRONTIDÃO (CHECKLIST FINAL DE GO-LIVE)

Antes de entregar o aplicativo ao primeiro cliente pagante, valide os 8 itens fundamentais:
- [ ] `npm run preflight` executado com 100% de sucesso no terminal;
- [ ] Suíte de testes `npm test` verde com ~2.300+ testes unitários e de integração;
- [ ] Domínio próprio com SSL Full (Strict) apontando para o Cloudflare Pages;
- [ ] E-mail de cadastro de teste entregue diretamente na Caixa de Entrada via Resend;
- [ ] Chamado de teste enviado via chat de suporte entregue no Telegram em < 2 segundos;
- [ ] Cobrança de teste de R$ 1,00 via Pix processada no Asaas com nome "Áxis Finance";
- [ ] Selo Pro ativado na conta de teste sem intervenção manual;
- [ ] Termos de Uso e Política de Privacidade acessíveis no rodapé.
