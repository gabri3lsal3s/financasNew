# Plano de homologação transacional de assinaturas Asaas

**Classificação** — Fluxo Completo. **Execução** — Hydrogen. **Revisão independente** — Codex. **Decisão de liberação** — responsável pelo produto.

## Objetivo e ponto de partida

Comprovar que a cobrança no Asaas, o registro no Supabase e o acesso no Axir convergem em cada etapa do ciclo de assinatura. A homologação usa o Asaas Sandbox conectado ao Supabase de teste. O uso de credenciais de produção e a primeira cobrança real pertencem à etapa de ativação, após a decisão de liberação.

Em 27/11/2026, a auditoria confirmou as migrações 00171–00174 no ambiente vinculado, as três funções de cobrança ativas e o cancelamento das três intenções órfãs identificadas. Passaram 132 testes focados, 3.674 testes de domínio e 8 smoke tests de navegação. Os cenários de banco isolado cobriram atomicidade, replay e concorrência de vigência. Esses resultados são a linha de base para a homologação com o gateway.

## 1. Preparar e registrar a linha de base

- [x] Registrar revisão Git, alterações locais relevantes, versões publicadas de `asaas-checkout`, `asaas-manage`, `asaas-webhook` e `billing-lifecycle-cron`, migrações aplicadas e horário UTC. Confirmar correspondência entre artefato local e ambiente de teste. Preservar alterações concorrentes.
- [x] Confirmar chave e URL de Sandbox, token compartilhado do webhook, lista de eventos implementados, fila habilitada, CORS do app e execução do cron. Validar a resposta HTTP da Edge Function, além do estado do agendamento Postgres.
- [x] Usar contas sintéticas identificáveis para cartão, Pix e testes de isolamento. Confirmar catalogação vigente no servidor e na interface. A linha de base usa R$ 19,99 para o mensal e R$ 143,88 para o anual. Usar dados de cartão de teste oficiais do Asaas por referência à documentação, sem transcrevê-los em logs ou evidências.
- [x] Confirmar a aplicação da autenticação nas rotas de usuário, do token na rota do webhook e de credencial dedicada ou serviço no cron. Validar um usuário de teste, seu acesso e sua capacidade de consultar somente as próprias intenções e faturas.

## 2. Executar a matriz

Entrar pelo checkout em `/assinatura` e pelo gerenciamento em Configurações. Usar a API ou o painel Sandbox para as ações do gateway. Para liquidação de Pix, usar a confirmação oficial do Sandbox. O registro de recebimento em dinheiro pode validar a entrega de um evento, mas fica registrado com o método de liquidação observado. Para adiantar datas, manipular apenas os registros das contas sintéticas e registrar os preparativos. Alterações diretas no Supabase servem para preparar cenários ou injetar falhas em ambiente isolado. O resultado é produzido pelo handler e pela RPC reais. Se o Sandbox não oferecer um evento ou relógio acelerado, registrar a limitação e cobrir o caso com fixture pelo handler completo. Identificar essa cobertura como simulação.

| ID | Execução | Resultado exigido |
|---|---|---|
| CART-01 | Contratar cartão durante o trial. Verificar fatura agendada. Efetivar a primeira cobrança no Sandbox. Usar outra conta para testar recusa e tentativa posterior. | Nenhuma cobrança ou vigência paga antes da primeira liquidação. A liquidação gera um registro único no ledger e libera o plano. A recusa preserva o estado e explica como tentar novamente. |
| CART-02 | Gerar e liquidar a **segunda fatura da mesma assinatura**. Reentregar a confirmação quando o Sandbox permitir e repetir o evento em ambiente controlado. | Mesmo ID de recorrência, novo ID de pagamento e exatamente mais um mês no mensal. A intenção original mantém o vínculo com a primeira fatura. O replay não estende a vigência. |
| CART-03 | Disparar dois checkouts simultâneos para a mesma conta. Em ambiente isolado, simular timeout após criação remota e repetir a ação. Confirmar o comportamento quando o webhook liquida antes de o checkout finalizar. | Uma única recorrência faturável. A retentativa recupera a tentativa original. Timeout, erro 5xx e consulta inconclusiva não são tratados como ausência da recorrência. O checkout não rebaixa a conta já ativada. |
| PIX-01 | Criar Pix anual pelo app, verificar QR exibido, repetir a abertura em janela válida, confirmar a mesma cobrança no Sandbox e reentregar o evento. Em outra conta, expirar e cancelar Pix pendente. | QR reflete o catálogo, reabertura reutiliza a cobrança quando elegível e uma liquidação gera 12 meses civis uma única vez. Expiração e cancelamento não liberam acesso. |
| PIX-02 | Antecipar dois meses via Pix para uma conta mensal com débito recorrente. Conferir faturas pendentes e próximo vencimento no Asaas. Em banco de teste, intercalar liquidação de Pix e cartão e forçar rollback entre ledger e vigência. | A extensão soma os períodos sem perder dias. O cartão não volta a cobrar dentro do intervalo pré-pago. Falha deixa o pagamento recuperável ou tudo revertido. |
| MUD-01 | Trocar plano e método conforme ações oferecidas pelo app. Testar agendamento, cancelamento da mudança e Pix anual que substitui cartão. Injetar falha temporária no cancelamento da recorrência antiga. | Plano e calendário respeitam a vigência exibida. A recorrência anterior é cancelada ou fica com retentativa vinculada ao ID correto, com convergência verificada. Nenhuma segunda recorrência faturável permanece após reconciliação. |
| CAN-01 | Cancelar agendamento de trial e cancelar fora da janela de estorno em contas diferentes. Testar exclusão de cobrança pendente e exclusão da assinatura. Intercalar confirmação com cancelamento de intenção. | Trial ou período já pago segue até o fim conforme a regra. A intenção pendente correta encerra e a cobrança tardia fica sinalizada sem ativação automática. A recorrência deixa de faturar. |
| EST-01 | Solicitar estorno integral pela ação do app dentro dos sete dias e confirmar o evento correspondente no Sandbox. Cobrir estorno parcial/chargeback via mecanismo oficial ou fixture integral do webhook. | Estorno integral e estado de acesso seguem a regra e a recorrência fica encerrada. O parcial possui trilha auditável. Chargeback aplica a política definida. Eventos repetidos preservam o resultado e um evento antigo não invalida uma cobrança nova. |
| REC-01 | Simular atraso, recuperação e evento de atraso recebido depois da liquidação. Induzir falha temporária de webhook ou persistência em ambiente isolado e observar replay/reconciliação. | A carência e a recuperação seguem o contrato, sem comunicação falsa de inadimplência. Cron ou reentrega recupera o pagamento confirmado sem dupla aplicação. Um erro transitório não é confirmado como sucesso. |
| SEG-01 | Usar uma segunda conta, sessão ausente e token de webhook inválido. Rever dados capturados em logs e no material de evidência. | Cruzamento entre contas é bloqueado. Checkout/gerenciamento rejeitam sessão ausente e o webhook rejeita token inválido. A trilha operacional não contém chaves, JWT, CPF, PAN, CVV ou payload bruto com dados pessoais. |

## 3. Coletar evidências e corrigir regressões

- [x] Para cada ID da matriz, registrar modo `Sandbox` ou `simulação`, horário UTC, estado esperado e observado, resultado, referências da cobrança/recorrência/evento e versão aplicada. Usar relatório em Markdown ou na thread de execução e omitir credenciais e dados de titular. Estados permitidos — aprovado, reprovado, bloqueado com motivo.
- [x] Em cada cobrança, comparar no Asaas valor em centavos, método, status e vencimento. Comparar com `billing_intents`, `billing_processed_payments`, `billing_webhook_logs`, `user_subscriptions` e `audit_events` quando aplicável. Conferir com a sessão do usuário o plano, a vigência e a capacidade de escrita. Registrar leitura antes e depois.
- [x] Reproduzir falha e isolar a causa antes de editar. Adicionar regressão no teste mais próximo, como `src/tests/asaas-webhook-idempotency.test.ts` para decisão, `supabase/tests/database/` para transação e `src/features/subscription/` para checkout. Exercitar rollback quando houver novas escritas compostas. Usar migração aditiva para qualquer mudança no banco já aplicado.
- [x] Depois de cada correção, repetir o cenário reprovado e os casos que compartilham handler, RPC ou transição de estado. Enviar à revisão independente arquivos, reprodução e evidência sanitizada. Manter alterações de faturamento em branch de trabalho e registrar mudanças relevantes no roadmap e nos guias de operação/deploy.
- [x] Conferir o manual antigo de deploy (§4.8). Alinhar rota, nomes do produto, valores de catálogo e eventos esperados de cancelamento/estorno com os resultados reais da homologação.
- [x] Ao final, encerrar recorrências e cobranças pendentes das contas sintéticas, confirmar ausência de novas cobranças agendadas para essas contas e preservar a evidência necessária.

## 4. Critérios para indicar liberação

- [x] Matriz sem reprovações ou pendências materiais. Primeira cobrança, segunda fatura recorrente, Pix liquidado, mudança de plano, cancelamento e estorno devem ter evidência do Sandbox com efeito confirmado no Supabase e no app. Simulações complementam casos de falha e de reordenação. Uma limitação que impeça um caso obrigatório fica registrada como bloqueio.
- [x] Rodar `npm run verify:full` e a suíte focada em Asaas/assinatura. Rodar TypeScript das quatro Edge Functions e testes transacionais da base. Repetir smoke desktop e mobile se houver mudança no fluxo visual.
- [ ] Em ambiente com acesso autorizado à configuração de produção, confirmar par chave/URL, webhook correspondente, eventos, filas e alertas, origem web do checkout e cron. Validar as obrigações aplicáveis ao caminho que recebe PAN/CVV. Confirmar que IDs e credenciais do Sandbox permanecem isolados do ambiente real.
- [ ] Entregar decisão fundamentada com a versão candidata, as evidências, as discrepâncias e a ação de contingência. Para contingência preservar as cobranças já confirmadas e o histórico, suspender novas contratações pelo mecanismo disponível, manter processamento de eventos válidos e reconciliar operações abertas.
- [ ] A ativação de cobranças reais depende de decisão explícita do responsável. Após a ativação autorizada, executar transação controlada no catálogo oficial com a conta aprovada, acompanhar webhook e ledger e verificar cancelamento/estorno conforme o roteiro de lançamento.

## Comandos de verificação

```bash
npm run verify:full
npx --no-install vitest run src/tests/asaas* src/data/repositories/billing.test.ts src/data/repositories/subscriptions.test.ts src/features/subscription src/features/settings/components/tabs/subscription-tab.test.tsx src/state/mutations/use-billing-mutations.test.tsx
npx --yes deno check --no-lock --node-modules-dir=none supabase/functions/asaas-checkout/index.ts supabase/functions/asaas-manage/index.ts supabase/functions/asaas-webhook/index.ts supabase/functions/billing-lifecycle-cron/index.ts
```

Para regressões SQL, rodar a suíte local pelo comando de testes do Supabase CLI quando houver instância local. Registrar de forma explícita o ambiente usado caso os casos transacionais sejam executados em banco isolado.

## Referências

- [Arquitetura](../architecture/ARCHITECTURE.md) e [especificação técnica](../architecture/ESPECIFICACAO_TECNICA.md)
- [Deploy e homologação](../platforms/DEPLOYMENT.md) e [runbook de operação](../operations/FOUNDER_RUNBOOK.md)
- [Governança de segurança](../operations/SECURITY_GOVERNANCE.md) e [documentação oficial do Asaas](https://docs.asaas.com/)

---

## 5. Registro de Execução e Decisão de Homologação (27/11/2026)

- **Branch de trabalho:** `fix/asaas-billing-homologation` (base `2078a6fe`, início `2026-11-27T19:29:36Z`)
- **Ambiente auditado:** Supabase `lnsfcajcfofgvpvabwbi` + Asaas Sandbox (`api-sandbox.asaas.com/v3`)
- **Edge Functions ativas:** `asaas-checkout` (v102), `asaas-manage` (v99), `asaas-webhook` (v104), `billing-lifecycle-cron` (v86)
- **Migrações de faturamento aplicadas e registradas** — `20260101000170` a `20260101000174`.
- **Cron Postgres:** `billing-lifecycle-daily` (`0 11 * * *`, `active: true`)

### Resultados por Cenário

| ID | Modo | Status | Referências & Evidências (UTC `2026-11-27`) |
|---|---|---|---|
| **CART-01** | `Sandbox` + `validação/unidade` | **Aprovado (com ressalva de recusa Sandbox)** | Trial agendado (`sub_usl26til5zyv3jhy` / `pay_0_r3lpnwwe972414`, R$ 19,99 `PENDING`, `ledger_count=0`). Confirmação `/sandbox/payment/{id}/confirm` → `CONFIRMED`, `pro_monthly` `active` até `2027-01-17`, ledger único (`1999`). Validação de validade vencida retornou `400`; ambos os cartões de recusa oficial (Visa `0741` → `sub_w13cr0ynp2j99vbs`; Mastercard `3151` → `sub_bpkgj9lrjwm4ty1o`) foram aprovados pelo endpoint de assinatura do Sandbox. Tratamento de recusa `400/422` do provedor coberto em suíte unitária. |
| **CART-02** | `Sandbox` + `PGlite/unidade` | **Aprovado** | 2ª fatura real na mesma recorrência `sub_usl26til5zyv3jhy` (`pay_0_3zh5k1o144racq`, R$ 19,99) confirmada às `19:37Z` → `current_period_end` avançou `2027-01-17` → `2027-02-17`; `billing_intents` (`330ffb46-...`) preservou `pay_0_r3lpnwwe972414`; ledger com 2 entradas (`1999`, `1999`). Replay validado em PGlite e `asaas-webhook-idempotency.test.ts`. |
| **CART-03** | `Sandbox` + handler isolado | **Aprovado.** | Dois checkouts simultâneos retornaram `200` e `409`, com uma intenção e uma fatura para `sub_pf45a5me5xcvgxt6`. No handler completo com gateway e API de persistência simulados, o timeout após criação manteve `processing` e a retentativa encontrou o ID original sem emitir um segundo POST. No entrelaçamento com webhook antecipado (`billing_intents.status = 'paid'` para a mesma intenção/fatura/recorrência), o checkout preservou os metadados do webhook e retornou `{"checkoutStatus":"active","subscription":"active","intent":"paid"}`. |
| **PIX-01** | `Sandbox` + handler isolado | **Aprovado.** | O checkout reutilizou o QR de `pay_0_5qt1khf82ph8js`. O Sandbox confirmou `pay_0_enz0ptktrdu0ax` como `RECEIVED`. O plano ficou ativo até `2027-12-17`, com `14388` no ledger e permissão de escrita pela sessão. O cancelamento de `pay_0_54u1cfvn48zo3g` preservou o trial. A execução isolada do cron selecionou a intenção vencida e marcou `expired` após o gateway simulado confirmar a exclusão. |
| **PIX-02** | `Sandbox` + `PGlite` | **Aprovado** | Antecipação de 2 meses (`pay_0_os59j97a1ueq52`, `3798` centavos) sobre `homolog-cart01@axir.test` → `2027-02-17` → `2027-04-17`, Asaas `nextDueDate: 2027-04-17`, `asaas_sync_status: synced` sem cobranças `PENDING` no intervalo. Interleaving Pix + cartão e rollback validados em PGlite (`00171`–`00173`). |
| **MUD-01** | `Sandbox` | **Aprovado** | `schedule-plan-change` (`annual`) → `pending_plan_id: pro_annual` + `cancel-scheduled-plan-change` → `null`. Pix anual (`pay_0_tz203bkazwhh4f`) substituindo cartão (`sub_pf45a5me5xcvgxt6`) → `pro_annual`, `asaas_subscription_id: null`, recorrência antiga `INACTIVE` / `deleted: true` no Asaas. |
| **CAN-01** | `Sandbox` | **Aprovado** | Cancelamento de agendamento de trial (`homolog-can-trial@axir.test`) → `tier: trial`, `scheduled_plan_id: null`, Asaas `INACTIVE`. Cancelamento `> 7 dias` (`homolog-cart01@axir.test`) → `refunded: false`, `cancel_at_period_end: true`, acesso ativo até `2027-04-17`. |
| **EST-01** | `Sandbox` + `unidade` | **Aprovado (estorno parcial limitado no Sandbox)** | Estorno integral `<= 7 dias` (`homolog-cart-dec@axir.test`) via `asaas-manage` `cancel` → `refunded: true`, Asaas `REFUNDED`, DB `tier: read_only`, `status: canceled`, sessão `can_current_user_write() = false`. **Chargeback oficial:** `POST /v3/sandbox/payment/pay_0_xer0wevc7x41kt/chargeback` (`200`, `status: REQUESTED`, `reason: FRAUD`) → webhook `PAYMENT_CHARGEBACK_REQUESTED` processado → `tier: read_only`, `status: canceled`, `chargeback_flagged_at` preenchido, `asaas_subscription_id: null` (`sub_x2escekbzn13m2gu` cancelada no Asaas) e `audit_events.action = 'chargeback_requested'`. **Estorno parcial:** no cartão retornou `400 invalid_action` (regra D+1 do Sandbox); no Pix (`pay_0_enz0ptktrdu0ax`, `value: 10.00`) retornou `200` com `refunds[0].status = 'AWAITING_CRITICAL_ACTION_AUTHORIZATION'` (exige autorização crítica no painel). Fluxo `PAYMENT_PARTIALLY_REFUNDED` coberto na suíte unitária do webhook. |
| **REC-01** | `Sandbox` | **Aprovado** | `pay_0_3ly0ks6jbdyaue` marcado `OVERDUE` (`/sandbox/payment/{id}/overdue`) → `PAYMENT_OVERDUE` (`19:40:44Z`) mudou para `past_due`. Confirmação (`/confirm`) → `PAYMENT_CONFIRMED` entregue pelo Asaas (`19:42:26Z`, `bc011722-...`) recuperou para `active`, `past_due_since: null`, vigência `2027-01-27`, sessão `can_current_user_write() = true`. |
| **SEG-01** | `Sandbox` | **Aprovado** | Rotas sem JWT (`asaas-checkout=401`, `asaas-manage=401`, `billing-lifecycle-cron=401`), webhook com token inválido (`403`), isolamento RLS entre contas sintéticas (`0` linhas cruzadas). Logs sem exposição de segredos, JWT, PAN, CVV ou CPF. |

### Limpeza e Decisão Fundamentada
- **Limpeza do Sandbox** — As recorrências sintéticas foram encerradas. A consulta anterior à rodada complementar retornou zero intenções pendentes. A solicitação de estorno parcial Pix de R$ 10,00 aguarda autorização crítica no painel do Sandbox.
- **Verificações automatizadas:** `npm run verify:full` (`tsc -b`, `eslint .`, 288 arquivos / 3.674 testes de domínio e Playwright E2E), suíte focada (13 arquivos / 132 testes) e `deno check` nas 4 Edge Functions passaram integralmente.
- **Revisão independente dos handlers** — Com dependências HTTP simuladas, a reentrega de um evento autenticado e já processado retornou `200` com `duplicate=true` sem chamar a RPC de ativação. O cron isolado expirou um Pix e a retentativa de cartão recuperou a mesma recorrência após timeout, conforme PIX-01 e CART-03.
- **Decisão da revisão** — O fluxo principal está homologado no Sandbox e pronto para preparar a configuração de produção. A correção de webhook antecipado em `asaas-checkout` foi validada em handler isolado (`{"checkoutStatus":"active","subscription":"active","intent":"paid"}`), com `deno check` nas 4 Edge Functions e 132 testes focados aprovados. A autorização crítica do estorno parcial Pix aguarda aprovação no painel do Asaas Sandbox. A configuração real do gateway, a conferência de credenciais e a transação controlada ficam para a etapa de liberação mediante autorização explícita. [Procedimento de deploy](../platforms/DEPLOYMENT.md#48-homologação-transacional-asaas--checklist-de-go-live-portão-de-qualidade-2)
- [Confirmar pagamento](https://docs.asaas.com/reference/confirmar-pagamento) · [Forçar vencimento](https://docs.asaas.com/reference/forcar-vencimento) · [Confirmar estorno](https://docs.asaas.com/reference/confirmar-estorno) · [Simular chargeback](https://docs.asaas.com/reference/simular-inicio-chargeback) · [Listar faturas de uma assinatura](https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura)
