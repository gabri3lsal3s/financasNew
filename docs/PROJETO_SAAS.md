# PROJETO_SAAS.md — Modelo de Planos, 30 Dias de Trial & Modo Somente-Leitura

> **Status:** v2.0 — Especifica o modelo de precificação SaaS limpo e direto: **30 dias de Teste Pro Total (Full Access)** com transição para **Modo Somente-Leitura (Read-Only)** pós-trial, eliminando complexidade desnecessária de cotas parciais.

---

## 1. VISÃO GERAL DO MODELO DE NEGÓCIOS

O modelo de monetização adota a estratégia **Product-Led Growth (PLG)** com **30 dias de Acesso Total Pro** sem pedir cartão de crédito no cadastro.

### Por Que 30 Dias?
A gestão financeira pessoal opera em ciclos mensais (recebimento de salário, pagamento de despesas fixas, fechamento de fatura de cartão e balanço do mês). Um período de 30 dias permite ao usuário vivenciar um ciclo financeiro real completo antes de decidir pela assinatura.

```
                  ┌──────────────────────────────────────────────────────────┐
                  │                 CADASTRO DO USUÁRIO                      │
                  │        (Email / Google · Sem Cartão de Crédito)          │
                  └────────────────────────────┬─────────────────────────────┘
                                               │
                                               ▼
                  ┌──────────────────────────────────────────────────────────┐
                  │               DIAS 1 A 30: TRIAL PRO TOTAL               │
                  │  Acesso 100% irrestrito e ativo a todas as ferramentas   │
                  └────────────────────────────┬─────────────────────────────┘
                                               │
                                               ▼
                                      FIM DOS 30 DIAS?
                                     /                \
                       (Assinou Pro)                   (Não Assinou)
                            /                             \
                           ▼                               ▼
       ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
       │             PLANO PRO                │  │        MODO SOMENTE-LEITURA          │
       │    (Mensal R$ 19,90 ou Anual R$ 14,90) │  │          (R$ 0 para sempre)          │
       │  • Gestão e escritas ativas contínuas│  │  • Consulta de todo histórico salvo  │
       │  • Lançamentos e parcelamentos 60x   │  │  • Visualização de faturas e saldos  │
       │  • Rebalanceamento de Investimentos  │  │  • Zero perda de dados cadastrados   │
       │  • Radar Fiscal IR & DARF            │  │  x Escrita e novos lançamentos       │
       │  • Dossiê Executivo Excel (.xlsx)    │  │    bloqueados até ativação do Pro    │
       └──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## 2. MATRIZ DOS PLANOS

| Recurso / Ação | Primeiros 30 Dias (Trial Pro) | Modo Somente-Leitura (Pós-30d) | Plano Pro (Mensal ou Anual) |
|---|:---:|:---:|:---:|
| **Cartão no Cadastro** | Não necessário | Não necessário | Sim (na contratação) |
| **Novos Lançamentos (Despesas/Receitas)** | Liberado | **Bloqueado (Paywall limpo)** | **Ilimitado** |
| **Visualização do Histórico e Saldos** | Completo | **Liberado (Sem expiração)** | **Completo Vitalício** |
| **Gestão e Quitação de Faturas Salvas** | Liberado | **Consulta e Quitação Liberadas** | **Ilimitado** |
| **Criação de Novos Cartões** | Liberado | **Bloqueado** | **Ilimitado** |
| **Rebalanceamento Ativo de Aportes** | Liberado | **Bloqueado para novos cálculos** | **Ativo** |
| **Radar Fiscal de IR & DARF** | Liberado | **Bloqueado para novas apurações** | **Ativo** |
| **Exportação Excel (.xlsx com 5 abas)** | Liberado | **Bloqueado** | **Ilimitado (.xlsx)** |
| **Simulador de Projeção Patrimonial & Reserva** | Liberado | **Bloqueado** | **Ativo** |

---

## 3. POLÍTICA DE INTEGRIDADE & TRATAMENTO DE DADOS (PÓS-TRIAL)

1. **Zero Exclusão de Dados:** Nenhum dado cadastrado durante os 30 dias é apagado do banco de dados.
2. **Acesso Permanente para Consulta:** O usuário que optar por não assinar continua podendo acessar sua conta a qualquer momento para consultar seus saldos, faturas e registros passados.
3. **Fácil Reativação:** Ao clicar em qualquer ação de criação/edição ou no banner da interface, o usuário pode assinar o Plano Pro e retomar instantaneamente o controle ativo de onde parou.

---

## 4. ESTRUTURA DE PREÇOS & ANCORAGEM

- **Plano Pro Mensal:** `R$ 19,90 / mês` (Flexibilidade total, sem fidelidade, cancelamento a qualquer momento em 1 clique).
- **Plano Pro Anual (Âncora Principal):** `R$ 14,90 / mês` (`R$ 178,80 faturado anualmente em 1x ou parcelado`, com **25% de desconto** em relação ao mensal).

---

## 5. BENEFÍCIOS TÉCNICOS E DE ENGENHARIA

- **Simplicidade Extrema (KISS):** Elimina a necessidade de contadores de transações, cotas mensais e regras condicionais espalhadas em 15 telas.
- **Robustez no Backend:** Uma única verificação de assinatura ativa (`isPro || inTrial`) protege as escritas sem risco de bugs de borda.
- **Alta Conversão:** O usuário que já usou o app por 30 dias tem forte incentivo para assinar o Pro no momento em que precisar adicionar novas transações.

---

## 6. REGRAS DE TRIAL POR CONTA & ELEGIBILIDADE

- **Escopo do Ciclo de Trial:** 30 dias corridos calculados a partir da data de criação da conta (`created_at` do perfil/usuário).
- **Invariante de Elegibilidade:** A elegibilidade ao período de teste gratuito é avaliada no nível da conta (`isAccountTrialEligible` em `src/domain/subscription/trial.ts`). O benefício do trial é intransferível e único por cadastro.
- **Contagem Regressiva e Alertas:** A interface exibe avisos sutis no Dashboard apenas quando restam $\le 5$ dias para o término do trial (`TrialEndingBanner`), mantendo a experiência desobstruída nos primeiros 25 dias.
- **Transição Automática e Suave:** Ao término do 30º dia, a conta transiciona imediatamente para o Modo Somente-Leitura (`read_only`), mantendo todos os dados intactos e sem qualquer cobrança surpresa.

---

## 7. CONFORMIDADE LEGAL (CDC) & POLÍTICA DE CANCELAMENTO / REEMBOLSO

O modelo de contratação está 100% blindado em conformidade com o **Código de Defesa do Consumidor (Lei nº 8.078/1990)** e as melhores práticas de transparência:

1. **Direito de Arrependimento (Art. 49 do CDC — 7 Dias Incondicionais):**
   - Todo usuário possui garantia incondicional de 7 (sete) dias a contar da confirmação do pagamento para cancelar a assinatura com **reembolso integral (100%)** do valor pago (`calculateResidualRefundCents` retorna o valor total faturado).
   - O estorno é acionado automaticamente sem burocracia ou retenção.
2. **Cancelamento Pós-7 Dias & Cálculo Residual (Pro-Rata):**
   - Em caso de cancelamento voluntário após o 7º dia no plano anual, o cálculo residual proporcional aos dias/meses não usufruídos é computado com transparência conforme as diretrizes do CDC.
3. **Cancelamento em 1 Clique:**
   - O usuário pode gerenciar e cancelar sua renovação a qualquer momento diretamente pela aba de Configurações (`src/features/settings/components/tabs/subscription-tab.tsx`), sem menus ocultos ou necessidade de atendimento humano.
4. **Checkout Transparente Multimodal:**
   - Suporte a **PIX Instantâneo** com QR Code e chave copia-e-cola gerados dinamicamente;
   - Suporte a **Cartão de Crédito** com validação de bandeira em tempo real (Visa, Mastercard, Elo, Amex, Hipercard) e criptografia ponta a ponta.

---

## 8. GOVERNANÇA ADMINISTRATIVA, LICENCIAMENTO MODULAR & WHITELIST DE ACESSO

Para além dos planos canônicos (Trial, Pro Mensal, Pro Anual e Vitalício VIP), a plataforma conta com um motor flexível de **Licenciamento Modular Granular**, gerenciado exclusivamente por administradores e superadministradores através do Painel Administrativo (`src/features/admin/components/user-edit-dialog.tsx`).

### 8.1 Princípio de Segurança Whitelist Estrita
O acesso modular é regido pelo princípio de **Whitelist Estrita**:
1. **Modo Padrão do Plano:** Quando o usuário não possui registros personalizados na tabela `user_module_permissions`, o acesso a todos os módulos é governado exclusivamente pelas regras de seu plano base e status de assinatura.
2. **Modo Whitelist Ativo:** A partir do momento em que o administrador concede qualquer override explícito (ex.: acesso total ao módulo de Investimentos), o backend ativa o modo Whitelist para a conta.
3. **Bloqueio Automático por Omissão:** Em modo Whitelist, qualquer módulo não concedido expressamente na tabela opera **sumariamente bloqueado**, independentemente de o usuário possuir um plano ativo (como Trial ou Vitalício).

### 8.2 Transparência Visual no Diálogo de Gestão de Usuário
Para eliminar ambiguidades e evitar que o administrador suponha falsamente que um usuário com licença modular ainda tem acesso a módulos não configurados:
- **Card Contextual de Whitelist:** Exibição de alerta visual em destaque (`ShieldAlert`) indicando que o modo Whitelist está ativo e que módulos omitidos estão bloqueados por padrão.
- **Badges Semânticos:**
  - Módulos com override explícito exibem seu nível configurado (`Override: Acesso Total`, `Override: Somente Leitura` ou `Override: Bloqueado`).
  - Módulos sem override em modo Whitelist exibem o badge explícito `Bloqueado (Whitelist)` com variante `critical`.
  - Módulos em contas sob o regime padrão exibem `Padrão do Plano` com variante `muted`.

### 8.3 Ações Rápidas de Configuração em 1 Clique
Para acelerar o atendimento operacional e reduzir a propensão a erros de configuração manual:
- **"Apenas Investimentos":** Configura em uma única operação a atribuição de acesso total a Investimentos (`investments: write`) e limpa overrides residuais dos outros módulos, deixando o usuário sob a licença de carteira isolada.
- **"Restaurar Padrão do Plano":** Remove em lote todos os overrides de módulo do usuário, desativando o modo Whitelist e restabelecendo os acessos canônicos de seu plano base.

### 8.4 Invalidação Atômica de Cache e Tempo Real
Qualquer modificação de permissão modular via `useAdminSetUserModulePermission` ou `useAdminRemoveUserModulePermission` invalida atipicamente em lote:
- As chaves de auditoria e listagem administrativa (`ADMIN_USER_MODULE_PERMISSIONS_KEY`, `ADMIN_AUDIT_KEY`);
- As chaves de controle de acesso do próprio usuário (`userAccessQueryKey(userId)`, `userFeaturesQueryKey(userId)`), propagando a alteração imediatamente em sessões ativas sem necessidade de logout.

---

## 9. ARQUITETURA AGNÓSTICA DE PAGAMENTOS (ADAPTER PATTERN: STRIPE & ASAAS READY)

A plataforma opera sob o padrão arquitetural **Adapter Pattern (Provedor Agnóstico)**, garantindo que a interface com o usuário, as rotinas de domínio financeiro e as tabelas de banco de dados não possuam acoplamento rígido a nenhuma instituição ou gateway de pagamento proprietário.

### 9.1 Provedores Homologados e Especialidades

1. **Asaas (Operações Domésticas / Brasil):**
   - **PIX Instantâneo Dinâmico:** Geração de QR Code e chave Copia e Cola em tempo real via Edge Function;
   - **Cartão de Crédito Transparente:** Tokenização de cartão com validação de bandeiras locais (Elo, Hipercard) e internacionais (Visa, Mastercard, Amex);
   - **Cobrança Diferida (Trial Residual):** Agendamento transparente do primeiro débito para a data exata de término dos 30 dias de trial (`firstBillingDate`).

2. **Stripe (Operações Globais / Multi-Moeda & Hosted Checkout):**
   - **Stripe Checkout Sessions:** Redirecionamento seguro para sessões hospedadas com suporte a 3D Secure (3DS);
   - **Stripe Customer Portal:** Portal de autoatendimento nativo para atualização de dados de faturamento, faturas fiscais e cancelamento autônomo;
   - **Cartões Internacionais:** Processamento multi-moeda e conversão automática.

### 9.2 Contrato Canônico `BillingProviderAdapter` (`src/types/billing.ts`)

Todos os adaptadores implementam a interface canônica `BillingProviderAdapter`:

```typescript
export interface BillingProviderAdapter {
  readonly providerName: BillingProviderName; // "stripe" | "asaas" | "manual"
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  cancelSubscription(params?: CancelSubscriptionParams): Promise<void>;
  updatePaymentMethod(params: UpdatePaymentParams): Promise<void>;
  getBillingPortalUrl?(customerId: string, returnUrl?: string): Promise<string>;
}
```

Os resultados de checkout utilizam contratos discriminados fortemente tipados:
- `PixCheckoutResult`: `method: "pix"`, contendo QR Code base64, chave Copia e Cola e expiração;
- `DirectCreditCardResult`: `method: "credit_card"`, contendo confirmação direta de ativação;
- `HostedSessionResult`: `method: "hosted_session"`, contendo `checkoutUrl` e `sessionId` para redirecionamento.

### 9.3 Resolução Dinâmica de Provedor (`src/data/repositories/billing.ts`)

O despachante `getBillingAdapter(provider?: BillingProviderName)` resolve o adaptador ativo:
1. Prioriza o provedor solicitado explicitamente no parâmetro da chamada;
2. Caso omitido, resolve a variável pública de ambiente `VITE_DEFAULT_BILLING_PROVIDER` (`"asaas"` por padrão, ou `"stripe"`);
3. Garante que qualquer rota ou componente de checkout invoque o contrato genérico sem conhecer detalhes de transporte de rede do gateway.

### 9.4 Normalização Universal de Webhooks

Para unificar a ingestão assíncrona de eventos de cobrança, a plataforma normaliza todos os webhooks externos em 4 macroeventos canônicos universais:

| Evento Canônico Universal | Evento Asaas | Evento Stripe | Ação no Sistema |
|---|---|---|---|
| `subscription.created` | `SUBSCRIPTION_CREATED` | `customer.subscription.created` | Registra e vincula identificadores da assinatura. |
| `invoice.paid` | `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | `invoice.paid` / `checkout.session.completed` | Ativa status `active`, atualiza tier e renova período. |
| `invoice.payment_failed` | `PAYMENT_OVERDUE` | `invoice.payment_failed` | Altera status para `past_due` e alerta o usuário. |
| `subscription.canceled` | `SUBSCRIPTION_DELETED` | `customer.subscription.deleted` | Efetiva cancelamento e transiciona para `read_only_expired`. |

Todos os eventos normalizados convergem no contrato universal `NormalizedWebhookEvent` e são processados de forma idempotente no Postgres via RPC transacional.

### 9.5 Transição Suave e Retrocompatível do Esquema (Postgres)

A modelagem de dados da tabela `public.user_subscriptions` foi migrada para campos agnósticos:
- `payment_provider`: Identificador do provedor (`'stripe'`, `'asaas'`, `'manual'`);
- `provider_customer_id`: ID do cliente no gateway ativo;
- `provider_subscription_id`: ID da assinatura no gateway ativo;
- `provider_payment_id`: ID do pagamento/cobrança pontual.

As colunas legadas (`asaas_customer_id`, `asaas_subscription_id`, `asaas_payment_id`) são preservadas com retrocompatibilidade garantida, assegurando operação contínua e sem quebra de integrações legadas.

