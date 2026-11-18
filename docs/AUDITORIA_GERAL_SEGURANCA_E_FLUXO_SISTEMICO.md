# AUDITORIA SISTÊMICA DE SEGURANÇA, INTEGRIDADE FINANCEIRA E FLUXOS OPERACIONAIS — AXIR

> **Data de Emissão:** 18 de Novembro de 2026  
> **Classificação:** Documento Técnico de Arquitetura, Segurança da Informação e Auditoria Forense  
> **Escopo da Análise:** Banco de Dados Supabase (PostgreSQL 15+, RLS, Triggers, RPCs, pg_cron), Edge Functions Deno (Asaas Checkout, Webhook, Manage, Lifecycle Cron, Admin Action, Quotes, Support, Sunday Digest), Frontend React 18+ (TanStack Query, State Guards, Checkout, Configurações, Painel Administrativo, Compartilhamento Público).

---

## 1. SUMÁRIO EXECUTIVO

Esta auditoria forense aprofundada examinou a esteira completa do aplicativo **Axir**, inspecionando não apenas o ciclo de faturamento e assinaturas, mas também os fluxos de autenticação, exclusão de contas (LGPD), compartilhamento público, integridade financeira de lançamentos, processamento assíncrono em Edge Functions e ergonomia de interface.

### Veredito Geral
O sistema demonstra maturidade excepcional em suas camadas de domínio e isolamento multiusuário:
- **100% das 62 tabelas** do schema possuem Row Level Security (RLS) ativo com predicados escalares `(select auth.uid())` e `can_current_user_write_module`.
- **2.920 testes de domínio** e **58 testes de segurança estática** passam sem falhas.
- **Zero segredos privilegiados** expostos no código de produção ou no bundle estático compilado.

Entretanto, foram detectadas **vulnerabilidades e inconsistências de integração entre o banco de dados e os serviços externos (Asaas e Resend)**, destacando-se um **risco financeiro crítico de cobrança fantasma na exclusão de conta pelo usuário** e **dessincronias de schema em Edge Functions**.

---

## 2. DIAGNÓSTICO FORENSE DE SEGURANÇA E VULNERABILIDADES

### 2.1 VULN-01: Risco Crítico de Cobrança Fantasma na Exclusão de Conta pelo Usuário (Severidade: ALTA / Risco Financeiro)
- **Localização:**  
  - Frontend: `src/features/settings/components/tabs/delete-account-card.tsx` e `src/state/mutations/use-profile-mutations.ts` (`useDeleteAccountMutation`).
  - Backend: `supabase/migrations/20260101000122_...sql` (função `public.delete_current_user_account()`).
- **Mecanismo da Falha:**  
  Ao acionar a opção *"Excluir Minha Conta"* nas configurações de privacidade, o frontend invoca a RPC `delete_current_user_account()`. No PostgreSQL, a função executa um expurgo em cascata reversa que remove o registro em `user_subscriptions`, `profiles` e `auth.users`.  
  **O problema:** Se o usuário possuir uma assinatura ativa com renovação automática no Asaas (`asaas_subscription_id IS NOT NULL`), a RPC deleta os dados no banco sem solicitar o cancelamento da assinatura na API do Asaas.  
- **Impacto no Negócio:**  
  1. O Asaas continuará debitando o cartão de crédito do cliente indefinidamente no dia de cada renovação.  
  2. Quando o Asaas disparar o webhook `PAYMENT_RECEIVED`, o handler do backend não encontrará mais o `user_id` nem o `subscription_id` no banco, retornando `{ unlinked: true }`.  
  3. O cliente será cobrado por um serviço que já excluiu, provocando contestações judiciais, denúncias no Procon e chargebacks graves.  
- **Remediação Técnica:**  
  Antes de executar a exclusão atômica no banco, a mutation de exclusão ou a RPC deve invocar a Edge Function `asaas-manage` (ação `cancel`) ou verificar via Edge Function autenticada se há assinatura recorrente ativa e cancelá-la no gateway antes de rodar `delete_current_user_account()`.

---

### 2.2 VULN-02: Dessincronia de Schema no Módulo de E-mails Transacionais (`resend.ts`) (Severidade: MÉDIA / Operacional)
- **Localização:** `supabase/functions/_shared/resend.ts` cruzado com `supabase/migrations/20260101000128_...sql`.
- **Mecanismo da Falha:**  
  A tabela `transactional_email_logs` criada na migração 128 possui o seguinte contrato DDL:
  ```sql
  CREATE TABLE public.transactional_email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_key text NOT NULL,
    dedup_key text NOT NULL CONSTRAINT uq_transactional_email_logs_dedup UNIQUE,
    recipient_email text NOT NULL,
    provider_message_id text,
    status text NOT NULL DEFAULT 'sent',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
  No entanto, o arquivo `supabase/functions/_shared/resend.ts` tenta gravar registros usando nomes de colunas divergentes:
  - Tenta inserir `template_name` em vez de `template_key`.
  - Tenta inserir `subject` (coluna inexistente na tabela).
  - Tenta inserir `provider_id` em vez de `provider_message_id`.
  - Tenta inserir `error_message` (coluna inexistente).
  - **Omissão crítica:** Não envia `dedup_key`, violando a constraint `NOT NULL`.
- **Impacto no Negócio:**  
  Embora o e-mail seja disparado pela API HTTP do Resend, a gravação de auditoria em `transactional_email_logs` falha com erro de coluna inexistente / constraint violation (capturado pelo `catch (dbErr)`). Com isso, a verificação de idempotência (`dedup_key`) nunca encontra registros anteriores, deixando o sistema suscetível a disparos repetidos de e-mail de ativação caso o Asaas retente o webhook.
- **Remediação Técnica:**  
  Ajustar o `resend.ts` para mapear estritamente as colunas canônicas da migração 128 (`template_key`, `dedup_key`, `provider_message_id` e metadados).

---

### 2.3 VULN-03: Falha de Re-tentativa no Adiamento de Vencimento Pix (`billing-lifecycle-cron`) (Severidade: MÉDIA / Financeira)
- **Localização:** `supabase/functions/billing-lifecycle-cron/index.ts` (linhas 45 a 65).
- **Mecanismo da Falha:**  
  Quando um usuário do plano Pro Mensal realiza antecipação de 2 a 11 meses via Pix, o webhook do Asaas calcula o novo vencimento futuro e tenta adiar a cobrança de cartão chamando `postponeAsaasSubscriptionAfterPrepayment`. Caso a API do Asaas retorne erro de rede temporário, o webhook atualiza `user_subscriptions.asaas_sync_status = 'pending_resync'`.  
  No cron de ciclo de vida (`billing-lifecycle-cron`), as assinaturas com `pending_resync` são consultadas, mas o cron apenas verifica se o status da assinatura é `ACTIVE` e já atualiza o campo para `'synced'`, **sem tentar adiar o vencimento no Asaas novamente**.
- **Impacto no Negócio:**  
  Caso haja instabilidade temporária na API do Asaas no segundo do pagamento Pix, o cron mascara o erro como "sincronizado", e o Asaas continuará cobrando o cartão de crédito do assinante no mês seguinte, gerando duplicidade de pagamento.
- **Remediação Técnica:**  
  No `billing-lifecycle-cron`, para cada assinatura com `pending_resync`, obter o `current_period_end` registrado no banco e re-executar `postponeAsaasSubscriptionAfterPrepayment(sub.asaas_subscription_id, sub.current_period_end)` antes de marcar como `synced`.

---

### 2.4 VULN-04: Quebra Silenciosa de Agregação no Resumo Semanal (`sunday-digest`) (Severidade: BAIXA / Operacional)
- **Localização:** `supabase/functions/sunday-digest/index.ts` (linhas 55 a 65).
- **Mecanismo da Falha:**  
  A Edge Function consulta a tabela `expenses` usando `.select("amount_cents")`:
  ```ts
  const { data: weeklyExpenses } = await supabaseAdmin
    .from("expenses")
    .select("amount_cents")
    .eq("user_id", profile.id)
    .gte("date", sevenDaysAgo);
  ```
  Na modelagem canônica do Axir (migração 1 e 56), a tabela `expenses` armazena o valor financeiro na coluna `value` (tipo `numeric(12, 2)`), não possuindo a coluna `amount_cents`.
- **Impacto no Negócio:**  
  A agregação semanal de gastos calcula sempre zero (`totalWeeklySpentCents = 0`) para todos os usuários, inviabilizando a consolidação do resumo semanal.
- **Remediação Técnica:**  
  Ajustar a consulta para `.select("value")` e converter o somatório para centavos multiplicando por 100 e arredondando (`Math.round(val * 100)`), além de filtrar perfis com `status = 'active'`.

---

### 2.5 VULN-05: Concessão Ampla de Execução em `reconcile_expired_subscriptions()` (Severidade: BAIXA / Higiene RBAC)
- **Localização:** `supabase/migrations/20260101000128_...sql` (linha 2056).
- **Mecanismo da Falha:**  
  A função de manutenção em lote possui privilégios de `SECURITY DEFINER` e foi liberada com:
  ```sql
  GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() TO authenticated, service_role;
  ```
  Ela não possui checagem interna de privilégios (`public.is_admin()`).
- **Impacto no Negócio:**  
  Qualquer usuário autenticado comum pode invocar a função repetidamente via SDK JavaScript (`supabase.rpc('reconcile_expired_subscriptions')`). Embora a função seja idempotente e execute apenas transições legítimas por data, isso expõe o banco de dados a contenções de locks e consumo excessivo de I/O em horários de pico.
- **Remediação Técnica:**  
  Inserir guarda `IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN RAISE EXCEPTION ...` e revogar a permissão do papel `authenticated`.

---

### 2.6 VULN-06: Governança de Chaves e Segredos de Produção (Severidade: BAIXA / Checklist Operacional)
- **Diagnóstico:**  
  As credenciais operacionais fornecidas (tokens Asaas, Resend, Cloudflare e Supabase) devem permanecer isoladas exclusivamente no painel de segredos do Supabase (`supabase secrets set`) e nas variáveis de build do Cloudflare Pages.
- **Validação de Código:**  
  A suíte automatizada `security-audit.test.ts` (Fase 5.3) confirmou que nenhum segredo real ou token de servidor está commitado em arquivos rastreados no repositório.

---

## 3. AUDITORIA DE TRANSIÇÕES AUTOMÁTICAS E DIREITOS DO USUÁRIO

### 3.1 Transição de Trial (30 Dias) para Modo Somente Leitura
O sistema possui arquitetura de tripla proteção para encerramento de trials:
1. **Proteção Imediata por RLS (PostgreSQL):** A função `get_user_module_access` avalia `trial_ends_at > NOW()`. No milissegundo em que o trial expira, qualquer tentativa de escrita em `transactions`, `cards`, `debts`, `budgets` ou `investments` é rejeitada na camada de banco, independentemente de haver cron ativo.
2. **Proteção Reativa no Frontend (`useSubscriptionBoundaryTimer`):** O timer de borda agenda um evento para o segundo exato do término do trial (ou da vigência Pro), invalidando as queries do TanStack Query sem exigir recarga de página.
3. **Preservação de Dados e UX de Degradação Suave:** O usuário mantém acesso de visualização completo a todo o seu histórico financeiro e relatórios. Ao tentar criar ou editar dados, o `useMutationGuard` intercepta a ação e apresenta o diálogo de upgrade com atalho de contratação.

### 3.2 Transições de Cobrança e Grace Period
- **Falha de Cartão de Crédito (`past_due`):** O sistema aplica um Grace Period de 3 dias (`current_period_end + interval '3 days' > now()`), durante o qual a permissão de escrita é mantida e um banner informativo de regularização é fixado na Home.
- **Cancelamento nos Primeiros 7 Dias (CDC):** O cálculo dos 7 dias é ancorado em `billing_start_at` (primeira cobrança efetiva), não em `starts_at` (criação do trial). O estorno é automático via API do Asaas e o acesso Pro é encerrado de imediato.
- **Cancelamento após 7 Dias:** A renovação futura é cancelada no Asaas, e a vigência Pro permanece ativa até o último dia pago (`current_period_end`).

---

## 4. AUDITORIA DE RESTRIÇÕES MODULARES E SUPERADMIN

### 4.1 Controle Hierárquico do Superadmin
- **Proteção Hierárquica:** O Superadmin possui autoridade exclusiva para gerenciar kill-switches globais (`admin_toggle_global_feature`) e permissões de outros administradores. Um `admin` comum não pode rebaixar, suspender ou alterar o plano de um `superadmin`.
- **Módulos Beta:** Funcionalidades experimentais (`bank_notification_listener`, `family_sharing`, `trip_split`) têm valor padrão `default_enabled_for_new_users = false`. O acesso é estritamente individual mediante concessão do Superadmin na tabela `user_module_permissions`.
- **Restauração Limpa:** Ao alterar o plano de um usuário no painel administrativo, a função `admin_set_user_subscription` remove automaticamente overrides residuais de módulos base, assegurando que o usuário passe a responder dinamicamente ao novo plano.

---

## 5. AUDITORIA DE UI/UX E ERGONOMIA DO USUÁRIO

### 5.1 UX-01: Modal de Cancelamento para Assinatura Agendada no Trial (`trial_scheduled`)
- **Situação Atual:** No componente `CancelSubscriptionWizardModal`, quando o usuário cadastrou o cartão durante o teste de 30 dias (para garantir a renovação com desconto), a interface exibe mensagens de estorno CDC ou término de anuidade.
- **Impacto no Usuário:** Causa confusão, pois o usuário acredita erroneamente que já foi cobrado e está pedindo reembolso.
- **Melhoria Recomendada:** Renderizar texto específico para `trial_scheduled`:
  > *"Seu cartão ainda não foi cobrado. Ao cancelar o agendamento de renovação, nenhuma cobrança será efetuada e você continuará aproveitando seus dias restantes de teste gratuito normalmente."*

### 5.2 UX-02: Botão de Verificação Manual no QR Code Pix (`PixQrWaitingPanel`)
- **Situação Atual:** O painel aguarda a liquidação exclusivamente via polling a cada 3,5 segundos.
- **Melhoria Recomendada:** Adicionar botão *"Já realizei o pagamento — Verificar agora"* que força a invalidação de queries do TanStack Query, eliminando a ansiedade do usuário em redes móveis com oscilação de sinal.

### 5.3 UX-03: Alerta Educativo de Overrides Modulares no Painel Admin
- **Situação Atual:** A matriz exibe badges de override, mas não explica explicitamente que eles desconectam o usuário do dinamismo automático do plano SaaS.
- **Melhoria Recomendada:** Exibir banner de contexto quando houver overrides ativos, recomendando o uso do botão *"Restaurar Padrão do Plano"* para reconectar as permissões ao ciclo do plano.

---

## 6. PLANO DE AÇÃO E REMEDIAÇÃO TÉCNICA

A tabela abaixo estabelece a ordem prioritária de implementação para sanar todas as fragilidades apontadas:

| Ordem | Código | Ação Técnica | Arquivos Envolvidos | Severidade |
|---|---|---|---|---|
| **1** | **SEC-01** | Alinhar colunas e preencher `dedup_key` no disparo de e-mails transacionais | `supabase/functions/_shared/resend.ts` | Alta |
| **2** | **SEC-02** | Cancelar assinatura Asaas antes de executar `delete_current_user_account` | `src/state/mutations/use-profile-mutations.ts` / Edge Function de expurgo | Alta |
| **3** | **SEC-03** | Adicionar re-tentativa de adiamento de vencimento Asaas no cron | `supabase/functions/billing-lifecycle-cron/index.ts` | Média |
| **4** | **SEC-04** | Corrigir coluna de agregação de gastos de `amount_cents` para `value` | `supabase/functions/sunday-digest/index.ts` | Média |
| **5** | **SEC-05** | Restringir execução de `reconcile_expired_subscriptions` apenas para administradores | Nova migração DDL Supabase | Baixa |
| **6** | **UX-01** | Ajustar cópia do modal de cancelamento para usuários em `trial_scheduled` | `src/features/settings/components/subscription/cancel-subscription-wizard-modal.tsx` | Baixa |
| **7** | **UX-02** | Adicionar botão de verificação manual no painel Pix | `src/features/subscription/components/pix-qr-waiting-panel.tsx` | Baixa |

---

## 7. CONCLUSÃO

A auditoria comprova que a estrutura de governança, banco de dados e UX do Axir é altamente robusta. A resolução das fragilidades pontuais documentadas acima — especialmente o cancelamento preventivo no gateway antes da exclusão de conta e o alinhamento de schema no envio de e-mails — blindará o produto contra qualquer passivo financeiro, garantindo estabilidade e conforto integral ao usuário.
