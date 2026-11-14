# 29. PLANO DE AUDITORIA INTEGRAL DA JORNADA DO USUÁRIO, AUTH, ONBOARDING & BILLING ASAAS

> **Status:** Concluído & Homologado  
> **Versão da Aplicação Alvo:** v3.5.0+  
> **Data:** Novembro de 2026  
> **Classificação:** Documento Técnico Estratégico de Arquitetura, Compliance Financeiro (CDC & LGPD) e Experiência do Usuário (UX)  
> **Origem:** Auditoria Profunda de Ponta a Ponta: Apresentação, Cadastro, Onboarding, Checkout Transparente, Ciclo de Vida de Assinatura, Cancelamento/Reembolso e Modo Leitura  
> **Documentos Vinculados:** [`ESPECIFICACAO_TECNICA.md`](../docs/architecture/ESPECIFICACAO_TECNICA.md) · [`ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md) · [`SECURITY_GOVERNANCE.md`](../docs/operations/SECURITY_GOVERNANCE.md) · [`DESIGN_SYSTEM.md`](../docs/design/DESIGN_SYSTEM.md) · [`AGENTS.md`](../AGENTS.md)

---

## 1. Sumário Executivo & Diagnóstico da Auditoria

O aplicativo **Áxis Finance (`financasnew`)** é uma plataforma web e mobile de gestão financeira pessoal e rebalanceamento patrimonial que opera no modelo SaaS (Software as a Service) com período de degustação gratuito (Trial de 30 dias sem cartão) e planos pagos recorrentes (Pro Mensal a R$ 19,99 e Pro Anual a R$ 143,88 com 40% de desconto), integrados ao gateway **Asaas**.

Uma auditoria exaustiva e transversal cobrindo toda a jornada do usuário — desde o primeiro acesso na Landing Page, passando pelo cadastro direto, checkout integrado com cartão e Pix, experiência de onboarding, regras de cobrança diferida, ciclo de renovação, cancelamento com direito de arrependimento (Art. 49 do CDC), reversão para o modo somente-leitura e tentativas de reativação — identificou **13 vulnerabilidades, brechas operacionais e inconsistências de UX**.

### Tabela Consolidada de Fragilidades Identificadas

| ID | Classificação | Componente / Arquivo | Descrição da Fragilidade | Impacto no Negócio / Risco |
|---|---|---|---|---|
| **JORNADA-01** | **Crítico** | `supabase/functions/asaas-checkout/index.ts` | **Bloqueio rígido de vendas PIX:** se o usuário estiver em período de teste ou for um novo visitante, o backend rejeita com HTTP 400 (`isDelayedByTrial`). | **Perda de conversão:** clientes que desejam pagar à vista o Plano Anual via PIX não conseguem concluir a compra. |
| **JORNADA-02** | **Crítico** | `src/features/subscription/pages/subscription-checkout-page.tsx` | **Fallback perigoso para PIX Falso (Mock) em Produção:** se a Edge Function falhar ou recusar a criação do PIX, o bloco `catch` do checkout exibe um QR Code demonstrativo estático. | **Risco financeiro e reputacional:** usuário transfere fundos para chave inexistente/mock sem ter a conta ativada. |
| **JORNADA-03** | **Alto** | `supabase/functions/asaas-checkout/index.ts` | **Race Condition no Cadastro com Cartão Direto:** `userClient.auth.signUp()` cria a conta, mas se a query seguinte rodar antes do trigger `handle_new_user()`, `userSub` retorna nulo e debita o cartão imediatamente. | **Cobrança indevida:** quebra a promessa comercial de degustação de 30 dias antes do primeiro débito. |
| **JORNADA-04** | **Crítico** | `SubscriptionTab.tsx` / `subscriptions.ts` | **Erro de Cálculo do Prazo de 7 Dias do CDC:** o frontend usa `subscription.startsAt` (início do trial, 30+ dias atrás) em vez de `billing_start_at` (data real da cobrança). | **Infração legal (Art. 49 CDC):** usuários que foram cobrados no 30º dia e tentam cancelar no 32º dia têm o botão de estorno CDC ocultado. |
| **JORNADA-05** | **Crítico** | `supabase/functions/asaas-manage/index.ts` | **Estorno incompleto no Asaas se `asaas_payment_id` for nulo:** no cancelamento em até 7 dias, se o ID da cobrança não estiver no banco, a função cancela no app sem chamar o estorno no Asaas. | **Cobrança retida:** o cliente perde o acesso, pensa que foi estornado, mas a fatura continua cobrada na operadora de cartão. |
| **JORNADA-06** | **Crítico** | Migração SQL `000110` (`get_user_module_access`) | **Bypass de Escrita em Assinaturas Canceladas e Vencidas:** a função não checa `v_sub.current_period_end > NOW()`. Como o status permanece `'active'`, a escrita via PostgREST continua liberada. | **Falha de segurança RLS:** contas canceladas e expiradas mantêm permissão total de mutação no banco. |
| **JORNADA-07** | **Alto** | `asaas-manage` vs `asaas-webhook` | **Agendamento de Mudança de Plano Fantasma:** `schedule-plan-change` salva `pending_plan_id` no banco, mas não atualiza a assinatura no Asaas; o webhook nunca processa a pendência. | **Incongruência de faturamento:** o cliente agenda a migração anual/mensal, mas o Asaas continua cobrando o valor antigo indefinidamente. |
| **JORNADA-08** | **Médio** | `_shared/http.ts` / `asaas-checkout` | **Silenciamento de Motivos de Recusa de Cartão:** `safeErrorResponse` substitui qualquer erro retornado pelo Asaas por uma mensagem genérica de erro interno. | **Fricção na conversão:** o cliente não é informado se o cartão estourou o limite, se o banco bloqueou por segurança ou se o CVV foi digitado incorretamente. |
| **JORNADA-09** | **Médio** | `src/features/auth/pages/register-page.tsx` | **Evasão de Trial por Falta de Identificador Único:** o formulário de cadastro gratuito exige apenas nome, e-mail e senha, sem checagem de unicidade por CPF ou fingerprint de dispositivo. | **Evasão de receita:** facilidade de criação de contas descartáveis sucessivas com novos 30 dias de trial. |
| **JORNADA-10** | **Baixo** | `src/features/landing/components/pricing-section.tsx` | **Incongruência de Copy no Card Pro:** botão "Assinar Plano Pro" exibe legenda "Sem cartão · Cancele quando quiser", quando deveria indicar a garantia incondicional de 7 dias. | **Ruído de comunicação:** mensagem contradiz a necessidade de informar o cartão para assinar. |
| **JORNADA-11** | **Médio** | `src/components/modules/onboarding-banner.tsx` | **Ausência de Diálogo de Boas-Vindas Guiado no Primeiro Acesso:** o usuário entra no app e encontra a Home vazia com banner passivo, sem fluxo guiado de 3 passos para o primeiro lançamento. | **Abandono precoce:** usuários novatos demoram para compreender o fluxo do caixa diário e do Safe-to-Spend. |
| **JORNADA-12** | **Crítico** | `src/state/mutations/use-profile-mutations.ts` | **Risco de Cobrança Perpétua pós-Exclusão de Conta (LGPD):** se `cancelSubscription()` falhar por erro de rede durante o expurgo da conta, o erro é silenciado e a conta é deletada do Postgres, mantendo o cartão cobrado no Asaas para sempre. | **Dano financeiro & infração LGPD:** cliente tem dados apagados mas continua sendo cobrado no cartão sem conseguir acessar a plataforma. |
| **JORNADA-13** | **Médio** | `src/features/subscription/pages/subscription-success-page.tsx` | **Desconexão de UX na Tela de Sucesso para Cobrança Agendada:** quando o cartão é cadastrado com agendamento para 30 dias, a tela exibe "Pagamento Confirmado Hoje", assustando o cliente que acha que foi debitado de imediato. | **Insegurança do usuário:** gera chamados de suporte por aparente quebra da promessa de 30 dias gratuitos. |

---

## 2. Estrutura de Fases e Portões de Qualidade (Quality Gates)

O plano de remediação e modernização está estruturado em **5 Fases Sequenciais**, com **5 Portões de Qualidade Estritos**:

```mermaid
flowchart TD
    subgraph Fase 1: Blindagem de Faturamento & Asaas
        F1_1["Liberar PIX no Checkout (JORNADA-01)"]
        F1_2["Eliminar Mock PIX em Produção (JORNADA-02)"]
        F1_3["Resolver Race Condition no Cadastro (JORNADA-03)"]
        F1_4["Mensagens Amigáveis de Recusa (JORNADA-08)"]
    end

    subgraph Fase 2: Conformidade CDC & Cancelamento Seguro
        F2_1["Mapear billing_start_at no Frontend (JORNADA-04)"]
        F2_2["Buscar Cobrança Asaas para Estorno (JORNADA-05)"]
        F2_3["Sincronizar Troca de Plano com Gateway (JORNADA-07)"]
    end

    subgraph Fase 3: Blindagem RLS & Governança de Modo Leitura
        F3_1["Migração SQL: get_user_module_access com Vigência (JORNADA-06)"]
        F3_2["Validação de Assinaturas Expiradas no Banco"]
        F3_3["Idempotência de Webhook por provider_event_id"]
    end

    subgraph Fase 4: Experiência de Entrada, Anti-Abuso & Onboarding
        F4_1["Ajuste de Copy na Landing Page (JORNADA-10)"]
        F4_2["Modal de Boas-Vindas em 3 Passos (JORNADA-11)"]
        F4_3["Proteção Anti-Abuso de Trial (JORNADA-09)"]
    end

    subgraph Fase 5: Homologação, E2E & Despacho ARGOS
        F5_1["Suíte de Testes Automatizados (Vitest)"]
        F5_2["Verificação Transacional E2E"]
        F5_3["Notificação Executiva via Bot ARGOS (Telegram)"]
    end

    Fase 1 --> QG1["Portão de Qualidade 1 (Checkout & Asaas OK)"]
    QG1 --> Fase 2
    Fase 2 --> QG2["Portão de Qualidade 2 (CDC & Estorno Validado)"]
    QG2 --> Fase 3
    Fase 3 --> QG3["Portão de Qualidade 3 (RLS & Modo Leitura Blindado)"]
    QG3 --> Fase 4
    F4_3 --> QG4["Portão de Qualidade 4 (UX & Onboarding Fluido)"]
    QG4 --> Fase 5
    F5_3 --> QG5["Portão de Qualidade 5 (Go-Live & ARGOS Notificado)"]
```

---

## 3. Detalhamento Operacional das Fases

### FASE 1: Blindagem de Faturamento, Checkout & Gateway Asaas

#### Etapa 1.1: Desbloqueio e Tratamento Canônico de Vendas PIX (JORNADA-01)
- **Arquivo:** `supabase/functions/asaas-checkout/index.ts`
- **Ação:**
  - Remover a trava restritiva `if (isDelayedByTrial)` nas linhas 299–305 para pagamentos via PIX.
  - Implementar regra de negócio clara: se um cliente em trial ou um novo visitante escolhe pagar o Plano Pro Anual via PIX, ele está deliberadamente contratando 1 ano de acesso pago. O valor de R$ 143,88 deve ser cobrado imediatamente gerando o QR Code dinâmico do Asaas.
  - O cálculo do `current_period_end` desse pagamento deve estender o acesso Pro por 12 meses (adicionados à data atual ou somados ao trial restante).

#### Etapa 1.2: Eliminação do Mock PIX em Produção (JORNADA-02)
- **Arquivo:** `src/features/subscription/pages/subscription-checkout-page.tsx`
- **Ação:**
  - Substituir o bloco `catch` permissivo nas linhas 431–450 por tratamento formal de erro.
  - Exibir toast e alerta descritivo na tela quando o gateway retornar erro ou estiver indisponível.
  - Restringir geração de payloads simulados exclusivamente a testes automatizados (`import.meta.env.DEV && import.meta.env.VITE_TEST_MODE === "true"`), garantindo que nenhum usuário final veja QR Codes estáticos fictícios.

#### Etapa 1.3: Resolução de Concorrência (Race Condition) no Cadastro Direto com Cartão (JORNADA-03)
- **Arquivo:** `supabase/functions/asaas-checkout/index.ts`
- **Ação:**
  - No bloco de novo cadastro (`isRegistration = true`), se a query `supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle()` retornar `null` (devido a ligeiro atraso no trigger de banco), aplicar fallback determinístico fail-safe:
    ```ts
    const serverTrialEnds = isRegistration
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      : userSub?.trial_ends_at ? new Date(userSub.trial_ends_at) : null;
    ```
  - Isso garante que a data de primeiro débito (`nextDueDate`) no Asaas seja sempre agendada para 30 dias após o cadastro, mantendo a integridade da promessa comercial.

#### Etapa 1.4: Sanitização e Transparência em Erros de Recusa de Cartão (JORNADA-08)
- **Arquivos:** `supabase/functions/_shared/asaas.ts`, `supabase/functions/_shared/http.ts`, `supabase/functions/asaas-checkout/index.ts`
- **Ação:**
  - Mapear códigos e descrições comuns de recusa do Asaas (ex.: `Cartão recusado pelo banco emissor`, `Saldo ou limite insuficiente`, `Código de segurança inválido`, `Transação não autorizada`).
  - Retornar mensagens claras e acolhedoras para o frontend (`jsonResponse(req, { error: friendlyMessage }, 400)`), orientando o usuário sobre a causa exata da recusa para que ele possa utilizar outro cartão ou autorizar a operação no app do seu banco.

---

### FASE 2: Conformidade Jurídica (CDC), Cancelamento Ético & Estorno Asaas

#### Etapa 2.1: Mapeamento de `billing_start_at` no Repositório de Assinaturas (JORNADA-04)
- **Arquivos:** `src/types/subscription.ts`, `src/data/repositories/subscriptions.ts`, `src/features/settings/components/tabs/subscription-tab.tsx`
- **Ação:**
  - Adicionar a propriedade `billingStartAt: string | null` ao contrato `SubscriptionStatus` em `src/types/subscription.ts`.
  - Mapear `billingStartAt: raw.billing_start_at ?? null` na função `getMySubscription()` em `src/data/repositories/subscriptions.ts`.
  - Em `SubscriptionTab.tsx`, corrigir a invocação de cálculo da garantia legal:
    ```tsx
    const referenceDate = subscription.billingStartAt || subscription.startsAt;
    const { isWithinGuarantee, daysRemaining } = useMemo(() => {
      return calculateGuaranteeResidual({
        startsAt: referenceDate,
        isPro: subscription.isPro,
      });
    }, [referenceDate, subscription.isPro]);
    ```
  - Resultado: o usuário que realizou os 30 dias de teste e teve o cartão debitado no 30º dia terá seus 7 dias de garantia contados a partir da data da cobrança real (`billing_start_at`), em total conformidade com o Artigo 49 do CDC.

#### Etapa 2.2: Busca Resiliente da Cobrança Asaas no Cancelamento com Reembolso (JORNADA-05)
- **Arquivo:** `supabase/functions/asaas-manage/index.ts`
- **Ação:**
  - No handler `action === "cancel"`, antes de chamar `refundAsaasPayment`:
    Se `userSub.asaas_payment_id` for nulo, mas `userSub.asaas_customer_id` ou `userSub.asaas_subscription_id` existir:
    1. Chamar `listAsaasCustomerPayments(userSub.asaas_customer_id, 5)` para obter as últimas cobranças do cliente.
    2. Localizar o último pagamento com status `CONFIRMED` ou `RECEIVED`.
    3. Utilizar esse ID para invocar `refundAsaasPayment(resolvedPaymentId, "Cancelamento legal de 7 dias (CDC)")`.
    4. Atualizar `asaas_payment_id` no banco de dados para manter o histórico auditável.
  - Se a chamada de estorno na API do Asaas falhar, retornar HTTP 500 com log de auditoria e alertar o suporte administrativo, evitando colocar a conta em somente-leitura sem a confirmação do gateway.

#### Etapa 2.3: Sincronização Efetiva da Troca de Plano Agendada (JORNADA-07)
- **Arquivos:** `supabase/functions/asaas-manage/index.ts`, `supabase/functions/asaas-webhook/index.ts`, `supabase/functions/_shared/asaas-webhook-logic.ts`
- **Ação:**
  - Na ação `schedule-plan-change` de `asaas-manage`, além de persistir `pending_plan_id` no banco, invocar a API do Asaas para atualizar a assinatura:
    - Se a migração for Mensal -> Anual: atualizar o valor e ciclo para `YEARLY` e R$ 143,88 com efeito a partir do próximo ciclo (`updatePendingPayments: false`).
    - Se for Anual -> Mensal: atualizar para `MONTHLY` e R$ 19,99 a partir da data de término do ciclo anual.
  - No `asaas-webhook`, ao receber a renovação confirmada, conferir se havia um `pending_plan_id`, aplicar a troca de `tier` e limpar o status pendente no banco.

#### Etapa 2.4: Blindagem contra Cobrança Perpétua no Expurgo de Conta LGPD (JORNADA-12)
- **Arquivos:** `src/state/mutations/use-profile-mutations.ts`, `src/features/settings/components/tabs/delete-account-card.tsx`
- **Ação:**
  - Em `useDeleteAccountMutation()`, substituir o `try/catch` que silencia falhas de cancelamento de assinatura:
    - Antes de deletar os registros do Postgres (`deleteCurrentUserAccount`), verificar se o usuário possui `asaas_subscription_id`.
    - Se possuir, a exclusão da conta só pode prosseguir se o cancelamento da assinatura no gateway Asaas retornar sucesso comprovado.
    - Se a Edge Function ou o gateway Asaas falharem, abortar o expurgo da conta com erro explicativo: *"Não foi possível cancelar sua cobrança recorrente no gateway de pagamento. A conta não foi excluída para evitar cobranças futuras indevidas. Tente novamente ou contate o suporte."*.

---

### FASE 3: Blindagem RLS, Segurança de Banco & Modo Somente-Leitura

#### Etapa 3.1: Nova Migração SQL para Validação Estrita de Vigência em `get_user_module_access` (JORNADA-06)
- **Arquivo:** `supabase/migrations/20260101000118_harden_modular_access_period_expiration.sql`
- **Ação:**
  - Atualizar a função SQL `public.get_user_module_access(p_user_id uuid, p_module_key text)` para exigir que assinaturas Pro ativas estejam com a vigência dentro do prazo:
    ```sql
    -- Assinatura ativa (Vitalício tem validade ilimitada; Pro Mensal e Anual exigem prazo válido)
    if v_sub.status = 'active'::public.subscription_status then
      if v_sub.tier = 'lifetime'::public.subscription_tier then
        return 'write'::public.access_level;
      elsif v_sub.tier in ('pro_monthly'::public.subscription_tier, 'pro_annual'::public.subscription_tier) then
        if v_sub.current_period_end is null or v_sub.current_period_end > now() then
          return 'write'::public.access_level;
        else
          -- Vencida pós-cancelamento ou sem renovação -> Somente Leitura
          return 'read'::public.access_level;
        end if;
      end if;
    end if;
    ```
  - Isso fecha completamente a brecha nas políticas RLS (`can_current_user_write_module`), impedindo qualquer mutação via API PostgREST assim que o ciclo de uma assinatura cancelada expirar.

#### Etapa 3.2: Reconciliação Periódica de Status de Assinatura (Cron / Sanitização)
- **Ação:**
  - Criar função SQL `public.reconcile_expired_subscriptions()` para marcar como `status = 'canceled'` e `tier = 'read_only'` contas cujas assinaturas tiveram `cancel_at_period_end = true` e `current_period_end <= NOW()`.
  - Vincular a chamada ao endpoint diário de manutenção e às chamadas de perfil para garantir consistência física entre colunas e derivações lógicas.

---

### FASE 4: Experiência de Entrada, Anti-Abuso & Onboarding

#### Etapa 4.1: Correção de Copy e Legendas nos Cards de Preço (JORNADA-10)
- **Arquivo:** `src/features/landing/components/pricing-section.tsx`
- **Ação:**
  - Na linha 226, substituir a legenda incorreta sob o botão "Assinar Plano Pro":
    - **Antes:** `<span>Sem cartão · Cancele quando quiser</span>`
    - **Depois:** `<span>7 dias de garantia incondicional · Cancele em 1 clique</span>`
  - Manter o destaque "Sem cartão de crédito" exclusivamente no card do Teste de 30 Dias.

#### Etapa 4.2: Diálogo de Boas-Vindas e Configuração Rápida em 3 Passos (JORNADA-11)
- **Arquivos:** `src/components/modules/onboarding/welcome-modal.tsx`, `src/features/overview/pages/overview-page.tsx`
- **Ação:**
  - Implementar um modal leve e acolhedor disparado apenas no primeiro login de novos usuários (quando `onboardingCounts.transactions === 0` e flag não vista):
    - **Passo 1 (Objetivo Principal):** O que você mais quer resolver hoje? (Eliminar sustos no cartão / Controlar gastos do dia a dia / Investir e receber dividendos).
    - **Passo 2 (Saldo Inicial ou Conta Principal):** Informar saldo bancário inicial ou cadastrar o cartão principal.
    - **Passo 3 (Safe-to-Spend Diário):** Apresentação visual de 15 segundos do painel mostrando quanto é seguro gastar hoje sem comprometer faturas futuras.
  - Oferecer botão claro para pular a qualquer momento e continuar com o `OnboardingBanner` no topo da Home.

#### Etapa 4.3: Fortalecimento Anti-Abuso de Trial sem Fricção (JORNADA-09)
- **Ação:**
  - No cadastro de usuário, registrar o hash do navegador e IP de criação no metadata (`user_metadata.client_fingerprint`).
  - Se um novo cadastro for solicitado no mesmo dispositivo que já teve um trial completado ou expirado, criar a conta diretamente em `tier = 'read_only'` com o convite para assinar o Pro, prevenindo a evasão contínua de receita por e-mails descartáveis.

#### Etapa 4.4: Congruência de UX na Tela de Sucesso para Cobrança Agendada (JORNADA-13)
- **Arquivo:** `src/features/subscription/pages/subscription-success-page.tsx`
- **Ação:**
  - Detectar se a transação do cartão foi com cobrança diferida para o término do trial (`isDelayedByTrial = true` ou parâmetro `fase=trial_agendado`).
  - Adaptar os textos e cartões:
    - **Título:** *"Cartão Cadastrado com Sucesso!"*
    - **Subtítulo:** *"Seu período de teste gratuito de 30 dias está ativo. Nenhuma cobrança foi realizada hoje."*
    - **Metadados:** Data de término do teste e data prevista do primeiro débito claramente visíveis, eliminando o susto do usuário.

---

### FASE 5: Homologação, Testes E2E & Despacho Executivo via ARGOS

#### Etapa 5.1: Suíte de Testes Automatizados Transversais
- **Ação:**
  - Criar testes unitários e de integração em `src/tests/`:
    - `asaas-pix-checkout-flow.test.ts`: valida criação imediata de Pix no cadastro de novos usuários e no trial.
    - `cdc-refund-guarantee-congruence.test.ts`: valida o cálculo de 7 dias com base em `billing_start_at`.
    - `asaas-manage-refund-fallback.test.ts`: valida a busca de faturas do Asaas quando `asaas_payment_id` for nulo.
    - `rls-expired-subscription-write-lock.test.sql`: valida o bloqueio estrito de escrita em RLS para assinaturas expiradas.
  - Executar typecheck estrito (`npm run typecheck`), lint sem violações (`npm run lint`) e vitest global.

#### Etapa 5.2: Despacho do Relatório Executivo ao Fundador via Bot ARGOS (Telegram)
- **Ação:**
  - Executar o script oficial `scripts/notify-telegram.ts` enviando o resumo executivo completo da auditoria, as vulnerabilidades mapeadas e o status de aprovação de todos os portões de qualidade para o chat configurado do Telegram.

---

## 4. Portões de Qualidade (Quality Gates)

| Portão | Critério de Aceite Mandatório | Verificação |
|---|---|---|
| **QG-1 (Fase 1)** | Checkout PIX funcional para novos usuários; sem geração de mock PIX em builds de produção; concorrência de cadastro com cartão eliminada. | `npm test src/tests/asaas*` 100% verde; teste de checkout PIX sem HTTP 400. |
| **QG-2 (Fase 2)** | Garantia legal do CDC calculada estritamente a partir de `billing_start_at`; cancelamento em 7 dias executa estorno real no Asaas mesmo com `payment_id` inicialmente nulo. | Teste de unidade `calculateGuaranteeResidual` e simulação de estorno aprovados. |
| **QG-3 (Fase 3)** | Assinaturas com `current_period_end <= NOW()` não conseguem inserir nem atualizar registros via PostgREST nem via RPCs. | Testes de RLS executados com perfil em `read_only` e expirado. |
| **QG-4 (Fase 4)** | Landing page com legendas congruentes; modal de boas-vindas responsivo, com zero emojis e zero controles nativos crus. | `npm run lint` 100% OK; inspeção visual no tema claro e escuro. |
| **QG-5 (Fase 5)** | Build de produção web (`npm run build`) sem erros; relatório entregue e confirmado no canal do Telegram ARGOS. | Build de produção gerado com sucesso e mensagem HTTP 200 no Telegram. |

---

## 5. Parecer Técnico sobre Banco de Dados (Supabase)

Para a implementação completa das correções identificadas, **será necessária 1 nova migração SQL no Supabase**:

- **Nome da Migração:** `supabase/migrations/20260101000118_harden_modular_access_period_expiration.sql`
- **Conteúdo da Migração:**
  1. Atualização da função `public.get_user_module_access(p_user_id uuid, p_module_key text)` para validar `(v_sub.current_period_end IS NULL OR v_sub.current_period_end > NOW())` quando o status for `'active'`.
  2. Criação do procedimento de higienização de assinaturas expiradas `public.reconcile_expired_subscriptions()`.
  3. Grant de permissão `EXECUTE` para roles autorizadas e comentários de governança.
