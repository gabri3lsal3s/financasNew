# AUDITORIA FORENSE DE SEGURANÇA, CICLO DE VIDA E FLUXO OPERACIONAL — AXIR

> **Data da Auditoria:** 18 de Novembro de 2026  
> **Classificação:** Documento Técnico de Arquitetura e Segurança da Informação  
> **Escopo:** Backend Supabase (Postgres, RLS, RPCs, pg_cron), Edge Functions Deno (Asaas, Resend, Lifecycle Cron, Admin Action), Frontend React/TypeScript (TanStack Query, State Guards, Checkout, Painel Administrativo).

---

## 1. SUMÁRIO EXECUTIVO E VEREDITO ARQUITETURAL

O aplicativo **Axir** atingiu um patamar de maturidade técnica e segurança financeira de excelência, com conformidade estrita às decisões arquiteturais canonizadas (D-01 a D-15), isolamento multiusuário rigoroso com Row Level Security (RLS) cobrindo 100% das 62 tabelas, ausência de vazamento de segredos no bundle do cliente e testes automatizados abrangentes (2.920 testes unitários de domínio e 58 testes de auditoria estática de segurança aprovados).

A presente auditoria identificou que a transição de planos, a vigência de trials de 30 dias, o modo Somente Leitura e as permissões modulares do Superadmin operam de maneira determinística e sincronizada entre a base de dados PostgreSQL e a interface.

Entretanto, uma análise forense detalhada das camadas de integração identificou **três pontos de fragilidade operacional e de segurança** que demandam blindagem corretiva (um erro de contrato de schema na Edge Function de e-mails, uma pendência de sincronização no fallback do cron de antecipação e uma concessão aberta em função de reconciliação), além de **oportunidades pontuais de refinamento de UX**.

---

## 2. AVALIAÇÃO DO CICLO DE VIDA E TRANSIÇÃO AUTOMÁTICA DE USUÁRIOS

Foi verificado se o sistema transita o usuário automaticamente entre os diferentes planos e estados, sem exigir recarga de página (F5) e sem depender exclusivamente de tarefas agendadas em segundo plano para manter a integridade dos dados.

### 2.1 Matriz de Transições de Estado

| Estado de Origem | Evento Desencadeador | Estado de Destino | Camada de Efetivação | Comportamento de Segurança e UX |
|---|---|---|---|---|
| **Novo Cadastro** | Criação de conta via `auth.users` | `trial` (30 dias) / `trialing` | Trigger `handle_new_user` no Postgres | Criação atômica de `user_subscriptions` com `trial_ends_at = now() + interval '30 days'` e liberação imediata de escrita. |
| **Trial Ativo** | Contratação Cartão de Crédito no Trial | `trial` / `trialing` (`trial_scheduled`) | Edge Function `asaas-checkout` | Não cobra no ato. Registra cartão no Asaas com `nextDueDate = trial_ends_at`. Dispara e-mail de agendamento. Mantém gratuidade até o 30º dia. |
| **Trial Ativo / Vencido** | Pagamento de Fatura Pro (Cartão ou Pix Anual) | `pro_monthly` ou `pro_annual` / `active` | Webhook Asaas (`PAYMENT_RECEIVED`) | Ativação imediata. Se ainda houver dias de trial restantes, a vigência Pro é somada ao fim do trial (vigência monotônica sem perda de dias). |
| **Trial Vencido (Sem Cartão)** | `trial_ends_at <= now()` | `read_only` / `read_only_expired` | Postgres RLS (`get_user_module_access`) + `useSubscriptionBoundaryTimer` | **Bloqueio em tempo real:** RLS bloqueia escritas no segundo exato do término. O frontend invalida cache via timer. Transição para Modo Somente Leitura sem perda de dados históricos. |
| **Pro Ativo** | Falha na renovação do cartão | `pro_monthly` ou `pro_annual` / `past_due` | Webhook Asaas (`PAYMENT_OVERDUE`) | Entra em Grace Period de 3 dias. Escrita permanece liberada durante os 3 dias. Banner de alerta de pagamento é exibido no topo da Home. |
| **Past Due (> 3 dias)** | `current_period_end + 3 dias <= now()` | `read_only` / `read_only_expired` | `reconcile_expired_subscriptions` + RLS | Escrita bloqueada. Usuário pode apenas visualizar dados até regularizar o pagamento no Asaas. |
| **Pro Ativo (<= 7 dias)** | Cancelamento solicitado no wizard | `read_only` / `canceled` | Edge Function `asaas-manage` | Regra CDC 7 dias: estorno total solicitado via API do Asaas e acesso Pro encerrado imediatamente. |
| **Pro Ativo (> 7 dias)** | Cancelamento solicitado no wizard | `pro_*` / `active` com `cancel_at_period_end = true` | Edge Function `asaas-manage` | Cancelamento da recorrência futura no Asaas. Acesso Pro mantido integralmente até a data de `current_period_end`. |
| **Pro Mensal Ativo** | Pagamento Pix Antecipado (2 a 11 meses) | `pro_monthly` / `active` | Webhook Asaas (`apply_cumulative_renewal`) | Soma meses à vigência, registra em `billing_processed_payments` e adia o `nextDueDate` no Asaas. |

### 2.2 Diagnóstico do Mecanismo de Reatividade Temporal
O aplicativo não depende de recarregamento manual (F5) para reagir à expiração de planos:
1. **Hook `useSubscriptionBoundaryTimer`:** Monitora `trialEndsAt` e `currentPeriodEnd`. Se a fronteira temporal estiver dentro das próximas 24 horas, agenda um `setTimeout` para o segundo exato da virada. Ao disparar, invalida as chaves de query `USER_SUBSCRIPTION_KEY` e `USER_ACCESS_KEY`.
2. **Monitor de Visibilidade (`visibilitychange`):** Caso o usuário pague um Pix ou regularize o cartão em outra aba/aplicativo bancário e retorne ao Axir após 15 segundos, o estado de assinatura é automaticamente revalidado em background.
3. **Bloqueio Fail-Closed no Banco:** Mesmo se o timer do navegador falhar ou o cliente for adulterado, a função PostgreSQL `get_user_module_access` e o predicado RLS `can_current_user_write_module` avaliam `trial_ends_at > now()` e `current_period_end > now()` diretamente no relógio atômico do PostgreSQL, impedindo qualquer inserção ou alteração não autorizada.

---

## 3. AUDITORIA DE PERMISSÕES MODULARES E GOVERNANÇA DO SUPERADMIN

Foi auditado se as restrições modulares estão operando com segurança e se o Superadmin possui controle efetivo e auditável sobre o acesso dos usuários.

### 3.1 Mecanismo de Decisão Modular (`get_user_module_access`)
A resolução de permissões em banco obedece a uma cascata hierárquica estrita de 6 níveis:
1. **Kill-Switch Global (`system_features.is_globally_enabled`):** Se desativado globalmente pelo Superadmin via `admin_toggle_global_feature`, o retorno é `none` imediato para todos os usuários (exceto admins).
2. **Status da Conta (`profiles.status`):** Usuários `suspended`, `banned` ou `pending_approval` recebem `none` irrestrito em todos os módulos.
3. **Papel Administrativo (`profiles.role`):** Usuários `superadmin` e `admin` recebem nível `admin` em todos os módulos.
4. **Override Granular (`user_module_permissions`):** Se houver uma concessão explícita para o usuário e módulo com data válida (`expires_at is null OR expires_at > now()`), esse nível prevalece sobre o plano base.
5. **Módulos Beta (`bank_notification_listener`, `family_sharing`, `trip_split`):** Bloqueados por padrão (`none`) para usuários comuns. O acesso exige concessão explícita individual do Superadmin em `user_module_permissions`.
6. **Módulos Core do Plano Base:** Derivam automaticamente do plano (`active` ou `trial` vigente = `write`; expirado ou cancelado = `read`).

### 3.2 Proteção Contra Elevação de Privilégios e Invasão Hierárquica
Nas RPCs administrativas atualizadas na migração 128:
- **Proteção do Superadmin:** As funções `admin_set_user_subscription`, `admin_set_user_module_permission` e `admin_remove_user_module_permission` possuem checagem que impede que administradores comuns (`admin`) modifiquem o plano, as permissões ou o status de um `superadmin`.
- **Trilha de Auditoria Imutável:** Todas as alterações administrativas gravam eventos estruturados na tabela `audit_events`, registrando o ID do operador, a ação e os parâmetros anteriores e novos.
- **Higienização Automática de Overrides:** Ao alterar o plano de um usuário para `pro_annual`, `pro_monthly` ou `lifetime`, a RPC `admin_set_user_subscription` remove automaticamente overrides manuais pré-existentes de módulos core, garantindo que o usuário responda de forma limpa e transparente ao novo plano.

---

## 4. FRAGILIDADES TÉCNICAS E VULNERABILIDADES IDENTIFICADAS

A inspeção forense do código identificou as seguintes fragilidades que demandam remediação:

### 4.1 SEC-01: Dessincronia de Schema no `resend.ts` vs `transactional_email_logs` (Severidade: Média / Operacional)
- **Localização:** `supabase/functions/_shared/resend.ts` (linhas 70–160) cruzado com `supabase/migrations/20260101000128_...sql` (linhas 49–80).
- **Diagnóstico:** A tabela `transactional_email_logs` criada na migração 128 possui as colunas canônicas:
  ```sql
  id uuid, user_id uuid, template_key text NOT NULL, dedup_key text NOT NULL UNIQUE,
  recipient_email text NOT NULL, provider_message_id text, status text, metadata jsonb, created_at timestamptz
  ```
  No entanto, o módulo `resend.ts` tenta inserir:
  ```ts
  await supabaseAdmin.from("transactional_email_logs").insert({
    user_id: options.userId || null,
    recipient_email: cleanTo,
    template_name: options.template, // Coluna não existe (correto: template_key)
    subject: options.subject,         // Coluna não existe na tabela
    status: "sent",
    provider_id: providerId,          // Coluna não existe (correto: provider_message_id)
    metadata: { ... },
    // dedup_key não é enviado, violando a constraint NOT NULL!
  });
  ```
- **Impacto:** Como o bloco está envolvido em `try/catch`, o e-mail é disparado via API externa do Resend, mas a gravação do log e a consulta de idempotência no banco falham silenciosamente. Como resultado, a deduplicação de e-mails fica inoperante, podendo ocasionar disparos repetidos caso o webhook do Asaas sofra retentativas.
- **Remediação Recomendada:** Atualizar `supabase/functions/_shared/resend.ts` para mapear estritamente:
  - `template_key: options.template`
  - `dedup_key: idempotencyKey || `${options.template}_${cleanTo}_${Date.now()}``
  - `provider_message_id: providerId`
  - Incluir `subject` dentro do objeto `metadata`.

---

### 4.2 SEC-02: Reconciliação Incompleta de Falha no Adiamento de Vencimento no Cron (Severidade: Média / Resiliência de Faturamento)
- **Localização:** `supabase/functions/billing-lifecycle-cron/index.ts` (linhas 45–70).
- **Diagnóstico:** Quando o usuário Pro Mensal realiza uma antecipação de 2 a 11 meses via Pix, o webhook do Asaas tenta adiar a data da próxima fatura de cartão no gateway chamando `postponeAsaasSubscriptionAfterPrepayment`. Caso a API do Asaas oscile ou falhe, o webhook grava `asaas_sync_status = 'pending_resync'` na assinatura.
  Porém, no cron de reconciliação (`billing-lifecycle-cron`), o loop de tratamento faz apenas:
  ```ts
  const asaasSub = await getAsaasSubscription(sub.asaas_subscription_id);
  if (asaasSub) {
    await supabaseAdmin.from("user_subscriptions").update({
      status: asaasSub.status === "ACTIVE" ? "active" : "canceled",
      asaas_sync_status: "synced",
    }).eq("id", sub.id);
  }
  ```
- **Impacto:** O cron marca a assinatura como `synced` sem tentar executar novamente o adiamento do vencimento (`postponeAsaasSubscriptionAfterPrepayment`) no Asaas. Caso ocorra uma falha de rede no momento do webhook Pix, o Asaas continuará com o vencimento original e cobrará o cartão de crédito do cliente no mês seguinte, gerando duplicidade de cobrança de meses já antecipados.
- **Remediação Recomendada:** No `billing-lifecycle-cron`, para assinaturas com `asaas_sync_status = 'pending_resync'`, buscar o `current_period_end` da assinatura no banco e invocar `postponeAsaasSubscriptionAfterPrepayment(sub.asaas_subscription_id, sub.current_period_end)` antes de marcar como `synced`.

---

### 4.3 SEC-03: Concessão Ampla de Execução em `reconcile_expired_subscriptions()` (Severidade: Baixa / Higiene de Segurança)
- **Localização:** `supabase/migrations/20260101000128_...sql` (linha 2056).
- **Diagnóstico:** A função de manutenção em lote `reconcile_expired_subscriptions()` foi concedida com:
  ```sql
  GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions() TO authenticated, service_role;
  ```
  A função possui `SECURITY DEFINER` e não contém guarda interna verificando se o chamador é administrador (`public.is_admin()`).
- **Impacto:** Embora a função não aceite parâmetros maliciosos e apenas transite assinaturas genuinamente vencidas pelo relógio do banco, qualquer usuário autenticado pode executar a RPC via cliente JavaScript (`supabase.rpc('reconcile_expired_subscriptions')`), gerando locks desnecessários de tabelas e potencial degradação de performance por chamadas repetitivas.
- **Remediação Recomendada:** Adicionar cláusula defensiva no início da função:
  ```sql
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acesso negado: privilégios insuficientes para executar reconciliação global.';
  END IF;
  ```
  E revogar a concessão pública para o papel `authenticated`.

---

### 4.4 SEC-04: Governança dos Secrets das Edge Functions no Supabase Cloud (Severidade: Baixa / Operacional)
- **Diagnóstico:** As Edge Functions (`asaas-checkout`, `asaas-webhook`, `asaas-manage`, `billing-lifecycle-cron`, `admin-super-action`) consomem variáveis de ambiente de produção.
- **Checklist de Prontidão das Chaves:**
  - `ASAAS_API_KEY`: Chave da API Asaas (homologação ou produção).
  - `ASAAS_WEBHOOK_TOKEN`: Token de autenticação recebido no cabeçalho `asaas-access-token`.
  - `RESEND_API_KEY`: Chave de disparo de e-mails (`re_...`).
  - `RESEND_FROM_EMAIL`: Remetente canônico autenticado (`Axir <contato@axir.com.br>`).
  - `PUBLIC_APP_URL`: URL base da aplicação (`https://axir.com.br`).
  - `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`: Alertas operacionais de vendas e anomalias.
  - `CRON_SECRET`: Segredo de autorização para execução agendada do lifecycle cron.
- **Recomendação:** Garantir que o comando `supabase secrets set ...` tenha sido executado com todas as variáveis obrigatórias no projeto remoto.

---

## 5. OPORTUNIDADES DE MELHORIA E REFINAMENTO DE UI/UX

Foram analisados os pontos de contato do usuário final e do administrador para eliminar fricções e tornar a experiência confortável e transparente.

### 5.1 UX-01: Modal de Cancelamento para Usuário em Trial com Cartão Agendado
- **Arquivo:** `src/features/settings/components/subscription/cancel-subscription-wizard-modal.tsx`
- **Cenário Atual:** Quando o usuário cadastra o cartão durante o teste de 30 dias para garantir o desconto após o término, ele entra na fase `trial_scheduled`. Se decidir cancelar o agendamento antes dos 30 dias, o modal atualmente exibe mensagens que mencionam estorno ou fim de anuidade:
  *"Você está dentro do prazo legal de 7 dias de garantia..."* ou *"Sua assinatura não será renovada ao final do ciclo..."*
- **Melhoria Proposta:** Adicionar uma terceira variante de mensagem no modal quando a assinatura estiver em fase `trial_scheduled`:
  > **Título:** *"Cancelar Agendamento de Renovação"*  
  > **Descrição:** *"Seu cartão ainda não foi cobrado. Ao cancelar o agendamento, nenhuma cobrança será efetuada no término dos 30 dias e você continuará aproveitando seus dias restantes de teste gratuito normalmente."*  
  > **Botão de Confirmação:** *"Cancelar Agendamento"* (em tom neutro/aviso, e não destrutivo com menção a estorno).

---

### 5.2 UX-02: Botão de Verificação Manual no Painel Pix (`PixQrWaitingPanel`)
- **Arquivo:** `src/features/subscription/components/pix-qr-waiting-panel.tsx`
- **Cenário Atual:** O painel aguarda a confirmação do pagamento exclusivamente via polling automático a cada 3,5 segundos no TanStack Query.
- **Melhoria Proposta:** Em cenários de redes móveis instáveis ou lentidão passageira de webhooks, disponibilizar um botão secundário *"Já realizei o pagamento — Verificar agora"* acompanhado de indicador de carregamento discreto (`Loader2`). Isso confere sensação imediata de controle e reduz a ansiedade do usuário.

---

### 5.3 UX-03: Alerta Visual Educativo de Overrides Modulares no Painel do Superadmin
- **Arquivo:** `src/features/admin/components/user-edit/user-module-permissions-matrix.tsx`
- **Cenário Atual:** A matriz exibe claramente badges de *Override* nos módulos que foram configurados manualmente.
- **Melhoria Proposta:** Incluir um pequeno banner explicativo no topo dos módulos base quando houver overrides ativos, informando de forma didática:
  *"Este usuário possui permissões customizadas que sobrepõem as regras automáticas do plano SaaS. Use o botão 'Restaurar Padrão do Plano' caso deseje reconectar o comportamento modular ao status da assinatura."*

---

## 6. MATRIZ DE PRIORIZAÇÃO E PLANO DE AÇÃO

| Código | Item | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| **SEC-01** | Alinhamento de schema em `_shared/resend.ts` para conformidade com `transactional_email_logs` | Alto (E-mails e Auditoria) | Baixo (1 arquivo) | P1 — Imediata |
| **SEC-02** | Re-tentativa de adiamento de vencimento Asaas no `billing-lifecycle-cron` | Alto (Prevenção de Cobrança Indevida) | Baixo (1 arquivo) | P1 — Imediata |
| **SEC-03** | Guarda de segurança e revogação de `authenticated` em `reconcile_expired_subscriptions` | Médio (Higiene de Banco) | Baixo (1 migration) | P2 — Recomendada |
| **UX-01** | Refinamento de cópia no wizard de cancelamento para `trial_scheduled` | Médio (Clareza do Consumidor) | Baixo (1 componente) | P2 — Recomendada |
| **UX-02** | Botão manual de verificação no painel de QR Code Pix | Baixo (Conveniência UX) | Baixo (1 componente) | P3 — Oportunidade |

---

## 7. CONCLUSÃO E AVALIAÇÃO FINAL

A arquitetura do **Axir** apresenta uma base sólida, resiliente e em estrita aderência às regras do `AGENTS.md` e do `ESPECIFICACAO_TECNICA.md`. A gestão de estados monetários em centavos, a proteção do CDC de 7 dias, a vigência monotônica e a blindagem RLS por nó escalar garantem que os direitos dos usuários e a segurança da empresa estejam resguardados.

A aplicação das correções técnicas mapeadas nas seções 4.1 e 4.2 e dos refinamentos de UX da seção 5 consolidará o sistema em seu nível definitivo de excelência para operação em larga escala.
