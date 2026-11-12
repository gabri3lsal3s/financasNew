# 26 — Plano de Integridade de Billing, Memória de Lançamentos e Simuladores

> **Status:** Planejamento concluído — aguardando implementação manual  
> **Classificação:** Fluxo Completo (Feature / Módulo / Regras Centrais)  
> **Versão-alvo sugerida:** `3.4.0` (MINOR, quando o lote funcional for implementado)  
> **Natureza deste documento:** plano executável. Nenhum código de produção foi alterado para criá-lo.  
> **Base normativa:** `AGENTS.md` §1–§33 · `docs/architecture/ESPECIFICACAO_TECNICA.md` · `docs/architecture/ARCHITECTURE.md` · `docs/architecture/PROJECT_STRUCTURE.md` · `docs/architecture/FINANCIAL_MATH_SPEC.md` · `docs/design/DESIGN_SYSTEM.md` · `docs/roadmap/ROADMAP.md` · `docs/operations/PROJETO_SAAS.md` · `docs/operations/SECURITY_GOVERNANCE.md` · `docs/operations/FOUNDER_RUNBOOK.md` · `docs/platforms/PWA_GUIDELINES.md` · `docs/platforms/EMAIL_TEMPLATES.md`

---

## 1. Objetivo

Organizar, em fases verificáveis, a correção e a evolução dos seguintes fluxos:

1. **Ciclo de vida da assinatura e do trial:** separar trial ativo, trial com pagamento agendado, trial expirado, assinante ativo, inadimplente, cancelamento agendado e somente-leitura.
2. **Checkout e meios de pagamento:** cartão recorrente, Pix imediato e cobrança agendada, sem gerar QR Code quando não há valor a pagar naquele instante.
3. **Troca de plano:** mensal ↔ anual com efeito apenas na renovação seguinte, incluindo confirmação e cancelamento da mudança.
4. **Renovação acumulativa:** exclusiva do plano mensal, com preço intermediário e confirmação explícita de compra de +365 dias.
5. **Memória e captura por área de transferência:** leitura de links/chaves Pix e comprovantes, pré-preenchimento do Wizard Rápido e correção da calculadora.
6. **Simulador de carteira e aporte:** simplificação visual, responsividade, legibilidade monetária e interatividade dos gráficos.
7. **Página pública de simulação:** análise de primeiro contato, clareza, interatividade e congruência com as regras do produto.
8. **Modo Família:** padronização do nome e posicionamento na arquitetura de informação.
9. **Skeletons:** padronização global dos carregamentos, eliminando spinners genéricos e variações ad hoc.

---

## 2. Diagnóstico atual (fatos verificados no repositório)

### 2.1 Billing e trial — problemas P0

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| B1 | O checkout confia no cliente para calcular a primeira cobrança. `trialDaysRemaining` e `firstBillingDate` são enviados pelo navegador. | `subscription-checkout-page.tsx` envia ambos; `asaas-checkout/index.ts` aceita `firstBillingDate` sem recalcular a partir do banco. | Um cliente adulterado pode postergar cobrança; um estado local stale pode gerar data errada. |
| B2 | `resolveCheckoutBillingSchedule` usa `trialDaysRemaining ?? 30`. Quando o backend devolve `null`, o checkout assume 30 dias. | `src/domain/subscription/trial.ts`. | Explica o sintoma “trial acabou, mas aparece 30 dias”. |
| B3 | Ao criar assinatura com primeira cobrança futura, o backend grava `tier=pro_*` e `status=active` imediatamente, além de sobrescrever `trial_ends_at` com a data da primeira cobrança. | `asaas-checkout/index.ts`, bloco de `update` após criar a assinatura. | O usuário deixa de ser tratado como trial; perde a contagem real e a interface diz “assinatura ativa” antes de qualquer pagamento. |
| B4 | `starts_at` é redefinido para `now` a cada checkout. | Mesmo bloco. | Corrompe a referência da garantia CDC de 7 dias e o histórico. |
| B5 | O webhook calcula `currentPeriodEnd` a partir de `new Date()` (agora), não da data de vencimento/confirmação do pagamento. | `_shared/asaas-webhook-logic.ts`, `computeNextPeriodEnd(targetTier, now)`. | Renovação pode começar antes ou depois do ciclo correto; pagamentos atrasados encurtam/estendem período indevidamente. |
| B6 | A idempotência é baseada em status/tier/paymentId, sem chave única de evento do provedor. | `decideWebhookAction`; `billing_webhook_logs` não tem `provider_event_id` único. | Eventos duplicados ou fora de ordem podem ativar/renovar duas vezes. |
| B7 | O checkout redireciona qualquer `isPro` para `/`, impedindo gerenciar plano. | `if (session && subscription.isPro && !pixResult) return <Navigate to="/" />`. | Torna impossível implementar troca mensal ↔ anual e renovação acumulativa pela tela de checkout. |
| B8 | `upgrade-to-annual` altera o ciclo no gateway imediatamente e muda o tier local, sem confirmação nem efeito apenas na próxima renovação. | `asaas-manage/index.ts`; `updateAsaasSubscriptionCycle(..., updatePendingPayments: true)`. | Pode cobrar valor anual antes da hora e não existe o caminho inverso anual → mensal. |
| B9 | A renovação acumulativa existente aparece apenas para plano anual, mas o CTA leva a um checkout que redireciona o Pro para a home. | `subscription-tab.tsx`, bloco “Renovação Acumulativa Pix”. | Funcionalidade não conclui o fluxo e está no plano errado segundo a regra desejada. |
| B10 | A página de sucesso fabrica data de ativação e próxima renovação com `new Date()`; não lê o backend. | `subscription-success-page.tsx`. | Comprovante visual divergente da cobrança real. |
| B11 | O catálogo `plans` do banco está divergente do domínio: mensal `1990`, anual `17880` (25% OFF), enquanto o app usa `1999` e `14388` (40% OFF). | `20260101000040_saas_plans_and_modular_access.sql` × `src/domain/subscription/plans.ts`. |Admin, checkout e relatórios podem exibir valores diferentes. |
| B12 | Não há job de reconciliação, dunning ou notificação de primeira cobrança/trial. | Não há rotina equivalente no repositório. | Usuário não é avisado com precisão; falhas de cartão dependem de sorte operacional. |
| B13 | O cadastro direto com cartão pode cobrar antes da confirmação de e-mail; a tela seguinte pede confirmação, mas a assinatura já foi criada. | `asaas-checkout/index.ts` (`needsEmailConfirmation`) + checkout. | Cobrança sem acesso efetivo ao produto e risco de suporte/estorno. |
| B14 | Pix é oferecido no checkout anual mesmo durante trial ativo, com QR gerado na hora. | `subscription-checkout-page.tsx`. | O usuário pode pagar imediatamente sem entender que já possui trial; ou gerar QR sem intenção de pagar agora. |

### 2.2 Área de transferência e calculadora — problemas P0/P1

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| C1 | A calculadora só usa `navigator.clipboard.readText`; não há fallback para permissão negada, contexto inseguro ou WebView. | `floating-calculator.tsx`, `handlePasteClipboard`. | O erro relatado (“não foi possível acessar”) é o único caminho. |
| C2 | `Ctrl+V` é interceptado e chama `readText` em vez de permitir a colagem nativa. | Listener de teclado do modal. | Em navegadores que bloqueiam leitura programática, o atalho falha mesmo com o usuário tendo o texto copiado. |
| C3 | O Wizard só tenta `parseUniversalReceipt` no texto da área de transferência e, em qualquer falha, abre o diálogo de anexo. | `launch-wizard.tsx`, `handlePastePixFromClipboard`. | Links Pix, BR Code puro e textos de compartilhamento não são aproveitados para pré-preencher. |
| C4 | Já existem parsers robustos que não são usados nesse caminho: `parsePixShareText`, `parsePixEMVPayload`, `parseUniversalReceipt`, `resolveMerchantIdentity`, `lookupMerchantCategory`. | `src/domain/notifications/*`, `src/services/merchant-learning.ts`. | Retrabalho e baixa precisão. |
| C5 | Não há distinção explícita entre link Pix, BR Code, comprovante textual e URL de compartilhamento. | — | Alto risco de falso positivo e de categorização errada. |
| C6 | A leitura da área de transferência não tem política de privacidade/consentimento no produto. | — | Área de transferência é dado sensível; leitura automática seria violação de expectativa e das regras LGPD. |

### 2.3 Simulador da landing — problemas P0/P1

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| S1 | Grid de 3 métricas sempre em `grid-cols-3`, inclusive em 320–390px. | `fire-projection-curve.tsx`. | Compressão e violação da Regra 10 do `AGENTS.md`. |
| S2 | Valores monetários usam `truncate`; o print mostra `R$ 2.898,...`. | `MoneyText ... className="... truncate"` nos 3 cards. | Viola a Regra 11 (zero reticências em valores monetários). |
| S3 | Gráfico SVG com `viewBox` fixo 500×180, textos de 10px e rótulos de meta/eixo que colidem. | `FireProjectionCurve`. | Baixa legibilidade e aparência comprimida em mobile. |
| S4 | Card interno com `rounded-2xl`, borda e padding próprios dentro do card externo; vários badges e CTAs competindo. | `minimal-wealth-simulator.tsx`. | “Bagunçado / cheio de informação”, como relatado. |
| S5 | A aba “Curva Patrimonial” usa meta FIRE, regra dos 4% e despesas derivadas do patrimônio sem explicar a premissa. | `FireProjectionCurve` recebe `monthlyExpenses` calculado no pai. | Números parecem arbitrários e pouco confiáveis. |
| S6 | Tooltip é limitado a 16%–84% da largura por percentual, sem medição real; pode cobrir o ponto e cortar valores. | `activePercent`. | Interação imprecisa no mobile. |
| S7 | Não há alternativa acessível em tabela nem navegação por teclado no gráfico. | — | Barreira de acessibilidade. |
| S8 | O simulador público `/ferramentas/rebalanceamento` tem presets duplicados e não aproveita a mesma experiência visual/interativa da landing. | `rebalance-simulator-page.tsx` × `minimal-wealth-simulator.tsx`. | Divergência de produto e manutenção duplicada. |

### 2.4 Modo Família e skeletons — problemas P1

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| F1 | Nome oscila entre “Orçamento Familiar”, “Modo Familiar”, “Família” e “Modo Família”. | `nav-items.tsx`, `family-page.tsx`, diálogos, onboarding, testes. | Falta de padronização com “Modo Viagem”. |
| F2 | O item já está em “Estratégia & Análise”, mas o nome visual não acompanha os demais modos. | `nav-items.tsx`. | Baixa reconhecibilidade. |
| K1 | O fallback de rota autenticada usa spinner genérico, não skeleton. | `RouteSuspenseFallback` em `router.tsx`. | Viola a regra “loading = Skeleton, não spinner genérico”. |
| K2 | A página de família usa blocos `Skeleton` crus em vez dos compostos existentes. | `family-page.tsx`. | Skeletons não reproduzem o layout final e geram salto visual. |
| K3 | Existem primitivos prontos e subutilizados: `SkeletonKpi`, `SkeletonChart`, `SkeletonList`, `SkeletonTable`, `SkeletonHeroCard`. | `src/components/ui/skeleton.tsx`. | Retrabalho e inconsistência. |

---

## 3. Prompts refinados para implementação

> Estes prompts convertem os pedidos originais em especificações executáveis. Cada um deve ser usado com o `AGENTS.md` ao lado.

### Prompt 1 — Máquina de estados de assinatura e trial

```text
Implemente uma máquina de estados única para assinatura em src/domain/subscription/,
sem imports de UI, Supabase ou gateway. Exponha um tipo BillingPhase com os estados:
trial_active, trial_scheduled, trial_expired, active, past_due, canceled_until_period_end,
read_only e lifetime. Crie funções puras para resolver a fase a partir de:
tier, status, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end,
scheduled_plan_id, scheduled_first_charge_at, pending_plan_id e pending_plan_effective_at.
Regras: trial é único por conta e nunca reinicia após expirar, cancelar, ficar inadimplente
ou já ter pago; trial expirado cobra imediatamente; pagamento agendado durante o trial mantém
a fase trial_scheduled e NÃO antecipa o Pro; trial com pagamento já confirmado mantém o acesso
até o fim do período contratado. Cubra todos os estados com testes Vitest, incluindo datas
limítrofes, timezone local e virada de mês/ano. Não altere UI nesta etapa.
```

### Prompt 2 — Cobrança agendada, Pix e confirmação de e-mail

```text
Refatore o checkout para que o servidor seja a única autoridade sobre datas e valores.
O cliente envia apenas plano, método e dados de pagamento; o Edge Function recalcula
trial residual, primeira cobrança e valor a partir do banco. Regras:
(1) se há trial ativo, cartão pode agendar a primeira cobrança para o último dia do trial;
(2) Pix só é oferecido quando há valor a pagar HOJE — nunca durante trial ativo;
(3) trial expirado, past_due e read_only cobram imediatamente;
(4) assinante ativo não é redirecionado para fora do checkout: ele entra no fluxo de
gerenciamento/troca de plano;
(5) não cobrar antes da confirmação de e-mail em cadastro novo: criar intenção pendente,
confirmar e só então cobrar;
(6) toda criação de assinatura futura mantém tier/status de trial e grava
scheduled_plan_id/scheduled_first_charge_at, sem sobrescrever trial_ends_at nem starts_at.
Use idempotency key e billing_intents. Não duplique regra no cliente.
```

### Prompt 3 — Troca de plano e renovação acumulativa

```text
Implemente troca mensal ↔ anual com efeito exclusivamente na próxima renovação.
Ao confirmar, grave pending_plan_id e pending_plan_effective_at = current_period_end,
mostre a data e permita cancelar a mudança. Não altere o gateway nem o tier no ato.
Um job idempotente aplica a mudança na data efetiva; se falhar, mantém o plano antigo,
registra auditoria e notifica. Implemente renovação acumulativa apenas para plano mensal
ativo (não trial, não anual, não lifetime, não read_only, não past_due):
preço fechado de R$ 191,88 por +365 dias (12 × R$ 15,99; 20% abaixo do mensal e
R$ 48,00 acima do anual), pago à vista via Pix ou cartão avulso, sem parcelamento e sem
criar nova recorrência. Aplique new_period_end = max(current_period_end, hoje) + 365 dias
em UTC, sem alterar tier, plan_id, starts_at ou trial_ends_at. Permita apenas uma
acumulativa ativa por ciclo: bloqueie se houver billing_intent paga cujo
metadata.new_period_end coincida com o current_period_end vigente; como proteção
secundária, bloqueie também se current_period_end > hoje + 365 dias.
Bloqueie se houver pending_plan_id; se cancel_at_period_end, permita somente com aviso
explícito de reativação. Grave billing_intent com metadata.previous_period_end,
idempotência por payment_id e webhook duplicado sem soma dupla. Reembolso CDC em 7 dias
reverte a extensão; após 7 dias, mantém acesso até o novo vencimento. Confirmação deve
mostrar valor, +365 dias, vencimento anterior e novo vencimento. Inclua recibo,
auditoria e testes de soma de datas, empilhamento, reembolso e pagamento duplicado.
```

### Prompt 4 — Captura de Pix pela área de transferência

```text
Crie um gateway único em src/services/clipboard.ts e um parser puro em
src/domain/notifications/pix-clipboard.ts. O parser deve reconhecer, sem rede:
BR Code EMV (000201...), links Pix com payload/valor, textos de compartilhamento de
comprovante e comprovantes bancários. Reutilize parsePixEMVPayload, parsePixShareText,
parseUniversalReceipt, resolveMerchantIdentity, lookupMerchantCategory e a memória do
usuário. Retorne um candidato com natureza, valor em centavos, descrição, contraparte,
data, confiança e origem. Nunca salve automaticamente: abra um diálogo de revisão ou o
Wizard Rápido pré-preenchido. Leia a área de transferência apenas em ação explícita do
usuário; nunca em foco, montagem, polling ou background. Se a permissão for negada,
contexto inseguro ou WebView sem API, ofereça fallback de colagem manual com Textarea.
Não persista o texto bruto; só memória normalizada de estabelecimento com opt-in.
```

### Prompt 5 — Correção da calculadora

```text
Corrija o botão Colar e Ctrl+V da calculadora. Use o gateway de clipboard com estados
tipados: unsupported, insecure_context, permission_denied, empty, invalid, success.
Em permission_denied/unsupported, abra um diálogo de colagem manual em vez de apenas
um toast destrutivo. No atalho Ctrl+V, não bloqueie a colagem nativa; em iOS/Android
WebView sem Clipboard API, use o fallback. Preserve parseClipboardToDecimal e adicione
testes para R$ 1.250,50, 1,250.50, 1500, vazio, texto inválido e permissão negada.
Zero leitura automática, zero duplo toast, zero emoji.
```

### Prompt 6 — Simulador da landing

```text
Refatore o Simulador de Carteira & Aportes da landing para primeiro contato:
(1) remova cards aninhados, badges redundantes e CTAs duplicados;
(2) controles em grid-cols-1 sm:grid-cols-3, sem truncamento de texto ou valores;
(3) métricas em grid-cols-1 sm:grid-cols-3, com MoneyText e sem truncate;
(4) gráfico responsivo com altura mínima, fontes legíveis, tooltip medido em pixels,
sem colisão de rótulos e com tabela visualmente oculta para leitores de tela;
(5) interação por toque, mouse e teclado (setas, Home, End);
(6) explique a premissa de rentabilidade e a regra dos 4% em texto curto;
(7) uma única CTA final. Preserve simulateStrategyAporte e a matemática em centavos.
Valide em 320, 360, 390, 768 e 1280px, com valores de 7+ dígitos.
```

### Prompt 7 — Página pública de simulação

```text
Analise e refine /ferramentas/rebalanceamento para primeiro contato:
presets com descrição curta, resumo do cenário ativo, entradas monetárias sem overflow,
resultado sticky no mobile, detalhamento por classe e CTA única. Reaproveite os
primitivos e o motor de domínio; não duplique presets entre landing e ferramenta.
Adicione comparação clara entre alocação atual e pós-aporte, explicação do algoritmo
e aviso legal. O gráfico deve ser interativo (seleção de fatia, foco por teclado) e
acessível. Nada de `<input type="range">` nativo: use chips, botões ou primitivos
existentes. Valide com valores grandes e em viewport de 360px.
```

### Prompt 8 — Modo Família e skeletons

```text
Renomeie todo texto de produto de “Orçamento Familiar”/“Modo Familiar” para
“Modo Família”, mantendo /familia e os nomes internos de código/banco. Atualize
nav-items, PageHeader, empty states, diálogos, onboarding, testes e docs. Mantenha
o item em “Estratégia & Análise”. Adicione alias /modo-familia com redirect para
/familia, sem quebrar links antigos. Em paralelo, substitua o spinner de
RouteSuspenseFallback por skeletons compostos e migre a página de família para
SkeletonKpi/SkeletonChart/SkeletonList, preservando o layout final e aria-busy.
Audite todas as telas com loading e elimine spinners de conteúdo.
```

---

## 4. Decisões de produto recomendadas

### 4.1 Pix, boleto e QR Code

- **Pix durante trial ativo:** não gerar QR Code. O usuário não tem valor a pagar hoje. Oferecer apenas **agendamento no cartão**; se ele quiser antecipar, apresentar uma ação explícita “Pagar agora e encerrar o teste”, com confirmação e aviso de perda dos dias restantes.
- **Pix no vencimento:** quando o trial termina, o usuário pode pagar o anual via Pix. O QR é gerado naquele momento, com validade curta.
- **Pix para renovação acumulativa mensal:** permitido, pois é uma compra avulsa de +365 dias paga no ato.
- **Pix para mensal recorrente:** não existe; mensal é cartão recorrente.
- **Boleto:** não faz parte do produto atual e não deve ser adicionado neste lote. Se necessário no futuro, exigirá endereço/CEP, compensação de 1–3 dias úteis e conciliação própria. Nome, CPF e e-mail são suficientes para criar o cliente e gerar Pix; não são suficientes para boleto completo.
- **Dados do cliente:** nome, CPF, e-mail e telefone opcional bastam para o Asaas criar o cliente e gerar Pix. Não pedir endereço no checkout só para Pix.

### 4.2 Trial e cobrança

- Trial é **único por conta** e começa na criação da conta gratuita.
- Trial ativo + pagamento no cartão = **cobrança agendada** para o último dia do trial; o usuário continua em trial até lá.
- Trial expirado = **cobrança imediata**; a interface deve dizer “hoje”, nunca “30 dias”.
- Inadimplente ou ex-assinante = **nunca** volta ao trial; cobrança imediata.
- Cancelado com período pago vigente = acesso até `current_period_end`; novo pagamento só após o fim ou com regra explícita de reativação.
- `trial_ends_at` é imutável após o início; `billing_start_at` e `scheduled_first_charge_at` são campos distintos.
- A data de início da garantia CDC (`starts_at`) é a data do **primeiro pagamento confirmado**, não a data do cadastro.

### 4.3 Troca de plano

- Mensal → anual e anual → mensal: **somente na próxima renovação**.
- Sem cobrança proporcional, sem crédito retroativo e sem alteração imediata de ciclo.
- A mudança é uma **intenção confirmada** (`pending_plan_id`) com data efetiva visível.
- O usuário pode cancelar a mudança antes da data efetiva.
- Se a cobrança da renovação falhar, o plano antigo permanece até o fim do grace period e o usuário é notificado.

### 4.4 Renovação acumulativa mensal

#### 4.4.1 Preço e posicionamento

**Preço recomendado e fechado para a implementação: R$ 191,88 por +365 dias.**

Esse valor é exatamente `12 × R$ 15,99` e ocupa o ponto médio entre o anual e o mensal:

| Modalidade | Valor | Equivalente mensal | Economia vs. 12 meses de mensal | Posição |
|---|---:|---:|---:|---|
| Mensal recorrente | R$ 19,99/mês | R$ 19,99 | — | Preço cheio |
| **Acumulativa mensal** | **R$ 191,88/ano** | **R$ 15,99** | **R$ 48,00 (20,0%)** | **Intermediária** |
| Anual | R$ 143,88/ano | R$ 11,99 | R$ 96,00 (40,0%) | Melhor preço |

Racional:

- `12 × R$ 19,99 = R$ 239,88`.
- `12 × R$ 15,99 = R$ 191,88` — desconto efetivo de 20,008%, exibido como 20%.
- `R$ 191,88 − R$ 143,88 = R$ 48,00` — a acumulativa custa exatamente R$ 48,00 a mais que o anual.
- `R$ 239,88 − R$ 191,88 = R$ 48,00` — e economiza exatamente R$ 48,00 contra o mensal.
- O anual continua sendo a melhor oferta (40% OFF); a acumulativa não canibaliza o anual e reduz a fricção de quem não quer trocar de ciclo.
- Não usar R$ 15,00 nem R$ 16,00: R$ 15,00 produziria R$ 180,00 (25% OFF), apenas R$ 36,12 acima do anual, comprimindo o posicionamento intermediário; R$ 16,00 produziria R$ 192,00 (19,97% OFF), praticamente o mesmo desconto, mas sem o efeito psicológico de "abaixo de R$ 16". R$ 15,99 preserva a lógica de preço do produto.

#### 4.4.2 Regras normativas

1. **Elegibilidade:** apenas `billing_phase = active`, `plan = monthly`, `tier = pro_monthly` e `status = active`. Bloquear trial, anual, lifetime, `read_only`, `past_due` e `trial_expired`.
2. **Cancelamento agendado:** permitir a compra, mas com confirmação explícita de que a renovação automática será reativada (`cancel_at_period_end = false`). Se o produto preferir não misturar retenção com renovação, bloquear até o usuário reativar o plano; a recomendação é permitir com aviso claro.
3. **Troca de plano pendente:** bloquear enquanto existir `pending_plan_id` mensal → anual. O usuário deve cancelar a migração pendente antes de comprar a acumulativa, evitando duas extensões conflitantes. Uma acumulativa já comprada não impede pedir anual depois; a troca passa a valer no novo `current_period_end`.
4. **Empilhamento:** permitir **uma única acumulativa ativa por ciclo**. O bloqueio não pode ser apenas por data, porque após um dia o vencimento já estaria a menos de 365 dias e uma segunda compra passaria. Verificar a última `billing_intent` de `cumulative_renewal` paga cujo `metadata.new_period_end` coincide com o `current_period_end` vigente; se existir e o período estiver ativo, bloquear e orientar o anual. A compra volta a ser elegível somente após a renovação mensal normal criar um novo ciclo. Como proteção secundária, bloquear também se `current_period_end > now + 365 dias`.
5. **Efeito temporal:** `new_period_end = max(current_period_end, now) + 365 dias`, usando adição de dias (não `setFullYear`), em UTC, preservando a hora original. Não alterar `trial_ends_at`, `starts_at`, `plan_id`, `tier` nem o ciclo mensal.
6. **Cobrança:** pagamento avulso de R$ 191,88 via Pix ou cartão, sem parcelamento e sem criar nova assinatura recorrente no Asaas. A recorrência mensal existente permanece intacta, apenas com a próxima cobrança deslocada para o novo vencimento.
7. **Idempotência:** cada compra gera uma `billing_intent` com `kind = cumulative_renewal`, `external_reference` única, `metadata.previous_period_end` e `metadata.new_period_end`. Webhook duplicado não soma duas vezes. Pagamento confirmado após expiração local do Pix ainda é honrado pelo `payment_id`. A própria intenção paga é a fonte de verdade para o bloqueio de empilhamento.
8. **Reembolso CDC:** dentro de 7 dias da compra, reembolso integral e reversão da extensão para `metadata.previous_period_end`. Após 7 dias, sem reembolso; o acesso permanece até o novo vencimento e o cancelamento apenas impede a renovação seguinte.
9. **Falha de pagamento:** não estender o período. Pix expirado pode ser regenerado; cartão recusado permite nova tentativa. Nunca conceder dias antes da confirmação.
10. **Transparência:** a confirmação deve mostrar valor, “+365 dias”, data de início da extensão, vencimento anterior e novo vencimento. Exibir “R$ 191,88 à vista” e “equivale a R$ 15,99/mês”; não usar “12x”, pois não é parcelamento.
11. **Recibo e auditoria:** descrever “Renovação acumulativa +365 dias” no histórico, registrar `audit_events` e manter o `billing_intent` para conciliação e estorno.
12. **Preço:** o valor é uma constante de domínio (`CUMULATIVE_RENEWAL_CONFIG`) e pode ser exposto no catálogo administrativo. Nunca hardcodar na tela. Compras já confirmadas mantêm o preço pago; mudanças futuras de tabela não recalculam dias já comprados.
13. **Contabilidade:** receita prepaga de 12 meses; se o regime for de competência, deferir mensalmente. Isso é nota operacional, não regra de UI.

### 4.5 Modo Família

- Nome de produto: **Modo Família**, alinhado a **Modo Viagem**.
- Posição: permanecer em **Estratégia & Análise**. O módulo trata orçamento, patrimônio e equilíbrio da casa; não é uma operação cotidiana como Transações ou Cartões. “Modo Viagem” fica em Operações porque executa despesas e acertos durante a viagem.
- Rota: manter `/familia`; adicionar `/modo-familia` como alias com redirect 301 interno para preservar links e PWA.
- Código e banco continuam usando `family` para evitar migração cosmética de schema.

---

## 5. Arquitetura-alvo

### 5.1 Fase de billing derivada

Não criar um novo enum no banco para evitar migração de dados. A fase é **derivada** por função pura e replicada na RPC `get_my_subscription()`:

```text
lifetime
trial_active
trial_scheduled       (trial ativo + primeira cobrança agendada no cartão)
trial_expired
active
past_due
canceled_until_period_end
read_only
```

Regras de precedência:

1. `tier = lifetime` e status ativo → `lifetime`.
2. `tier = trial` e `trial_ends_at > now`:
   - com `scheduled_plan_id` e `scheduled_first_charge_at` → `trial_scheduled`;
   - sem agendamento → `trial_active`.
3. `tier = trial` e `trial_ends_at <= now` → `trial_expired`.
4. `tier = pro_*` e status `active` e `current_period_end > now` → `active`.
5. `tier = pro_*` e status `past_due` dentro do grace → `past_due`.
6. `cancel_at_period_end = true` e `current_period_end > now` → `canceled_until_period_end`.
7. Demais → `read_only`.

### 5.2 Matriz de decisão do checkout

| Estado do usuário | Cartão | Pix | Primeira cobrança | Acesso |
|---|---|---|---|---|
| Conta nova, sem trial usado, checkout direto | Permitido | Não no ato; só no vencimento | Hoje, após confirmação de e-mail | Pro após confirmação do pagamento |
| Trial ativo, sem pagamento | Permitido, agendado | Bloqueado com explicação | Último dia do trial | Trial até o fim |
| Trial ativo, pagamento antecipado explícito | Permitido | Permitido se o usuário confirmar “pagar agora” | Hoje, com renúncia explícita ao restante | Pro imediato |
| Trial expirado | Permitido | Permitido para anual | Hoje | Pro após pagamento |
| `past_due` | Permitido | Permitido para anual | Hoje | Pro após regularização |
| Pro ativo | Apenas troca/gerenciamento | Não | Próxima renovação, se troca | Mantém |
| Cancelado com período vigente | Reativação agendada | Não | Fim do período | Até o fim |
| `read_only` | Permitido | Permitido para anual | Hoje | Pro após pagamento |

### 5.3 Intenções de cobrança

Toda cobrança passa a ter uma **intenção** (`billing_intents`) antes de ir ao gateway:

- `kind`: `subscription_start`, `plan_change`, `cumulative_renewal`, `reactivation`.
- `provider_payment_id` e `external_reference` vinculam webhook → intenção.
- `status`: `pending`, `processing`, `paid`, `failed`, `expired`, `canceled`.
- `expires_at` para Pix (15–30 min) e para intenções de cadastro (24 h).
- O webhook nunca decide plano apenas por valor; usa a intenção. O catálogo por valor permanece apenas como fallback legado.

### 5.4 Notificações

Canais recomendados, em ordem:

1. **In-app** (banner/toast persistente e central de avisos), obrigatório.
2. **E-mail transacional** via Resend API (chave nova `RESEND_API_KEY`) ou SMTP já configurado; requer Edge Function `billing-notify` e templates em `docs/platforms/EMAIL_TEMPLATES.md`.
3. **Push/PWA** apenas se o serviço existente suportar; não bloquear a entrega por isso.
4. **Telegram do fundador** para falhas de cobrança e vendas, mantendo o padrão do webhook atual.

Mensagens canônicas (sem emojis):

- Trial ativo: “Seu teste Pro termina em 12 dias, em 24/11/2026. A primeira cobrança de R$ 143,88 será feita no cartão final 1234 em 24/11/2026. Cancele antes dessa data sem custo.”
- Trial com cobrança agendada: “Hoje não há cobrança. Você mantém 12 dias de teste e a primeira cobrança será em 24/11/2026.”
- Trial expirado: “Seu teste terminou em 10/11/2026. A cobrança de R$ 19,99 será feita hoje no cartão cadastrado.”
- `past_due`: “Não conseguimos cobrar sua renovação. Atualize o cartão até 13/11/2026 para manter o acesso Pro.”
- Troca agendada: “Sua migração para o Pro Anual foi agendada para 12/12/2026. Até lá, seu plano mensal continua ativo.”
- Acumulativa: “Renovação de +365 dias confirmada por R$ 191,88. Seu novo vencimento é 12/12/2027. Seu plano mensal continua ativo.”

---

## 6. Modelo de dados e migrações futuras

> Estas migrações **não foram criadas** neste trabalho. São parte do plano de implementação manual. Todas devem ser transacionais, idempotentes e acompanhadas de rollback documentado.

### 6.1 Migração `20260101000114_billing_lifecycle_v2.sql`

Adicionar a `public.user_subscriptions`:

```sql
trial_started_at timestamptz,
trial_consumed_at timestamptz,
billing_start_at timestamptz,
scheduled_plan_id text references public.plans(id),
scheduled_first_charge_at timestamptz,
pending_plan_id text references public.plans(id),
pending_plan_effective_at timestamptz,
payment_method text check (payment_method in ('credit_card','pix')),
card_brand text,
card_last4 text,
last_payment_at timestamptz,
last_payment_status text
```

Backfill:

- `trial_started_at = starts_at` para trials existentes.
- `trial_consumed_at = trial_ends_at` para contas que já expiraram ou pagaram.
- `billing_start_at = current_period_end - interval` apenas quando houver período pago conhecido.
- Não inferir `pending_plan_id` retroativamente.
- `card_last4` só pode ser preenchido a partir de fonte segura; nunca armazenar PAN/CVV.

Atualizar `get_my_subscription()` para retornar:

```text
billing_phase, trial_started_at, trial_days_used, trial_days_remaining,
scheduled_plan_id, scheduled_first_charge_at, pending_plan_id,
pending_plan_effective_at, has_used_trial, payment_method, card_last4,
next_charge_at
```

Atualizar `can_current_user_write()` para usar a fase derivada, preservando o grace period de 3 dias já existente.

### 6.2 Migração `20260101000115_billing_intents_and_notifications.sql`

Criar:

- `public.billing_intents`
  - `id uuid pk`, `user_id uuid fk`, `kind text check`, `plan_id text fk`,
  - `amount_cents integer check >= 0`, `method text check`, `status text check`,
  - `provider text`, `provider_payment_id text`, `provider_subscription_id text`,
  - `external_reference text unique`, `expires_at timestamptz`,
  - `metadata jsonb`, `created_at`, `updated_at`.
  - Índices: `user_id`, `status`, `provider_payment_id`, `external_reference`.
- `public.billing_notifications`
  - `id`, `user_id`, `kind`, `channel`, `scheduled_for`, `sent_at`,
  - `status`, `dedupe_key text unique`, `payload jsonb`.
- `public.subscription_plan_changes`
  - `id`, `user_id`, `from_plan_id`, `to_plan_id`, `requested_at`,
  - `effective_at`, `status`, `applied_at`, `canceled_at`, `failure_reason`.
- Adicionar `provider_event_id text unique` em `billing_webhook_logs`.
- RLS: leitura apenas do próprio usuário para intenções/notificações; escrita via service role/RPC. Admins leem tudo.

### 6.3 Migração `20260101000116_plans_catalog_alignment.sql`

Alinhar `public.plans` ao domínio:

- `pro_monthly`: `1999`, `month`.
- `pro_annual`: `14388`, `year`, descrição 40% OFF.
- `trial`: `0`, sem intervalo.
- `lifetime`: `0`, sem intervalo.
- Adicionar `monthly_equivalent_cents` e `cumulative_renewal_price_cents` se o admin for editar preços pelo banco; caso contrário, manter a fonte única em `PLAN_CONFIGS` e apenas corrigir os valores.
- Criar `CUMULATIVE_RENEWAL_CONFIG` em `src/domain/subscription/cumulative-renewal.ts` com `priceCents: 19188`, `months: 12`, `days: 365`, `monthlyEquivalentCents: 1599`, `discountVsMonthlyPercentage: 20` e `maxActivePurchases: 1`. A UI e o Edge Function devem importar/espelhar esse contrato, nunca repetir o valor na tela.
- Exibir a decomposição: `12 × 1599 = 19188`, economia de `4800` contra 12 meses de mensal e diferença de `4800` para o anual.

### 6.4 RPCs e jobs

- `request_plan_change(p_plan_id text)` — autenticada, valida plano, grava intenção e data efetiva.
- `cancel_pending_plan_change()` — autenticada, cancela antes da data efetiva.
- `apply_due_plan_changes()` — `security definer`, executada por cron; idempotente; aplica apenas `pending_plan_effective_at <= now()`.
- `expire_billing_intents()` — marca Pix vencidos.
- `enqueue_billing_notifications()` — cria lembretes D-7, D-3, D-1, D0 e D+3.
- `billing-reconcile` (Edge Function) — compara assinaturas/pagamentos do Asaas com o banco; corrige divergências e alerta o fundador.

Cron sugerido (Supabase Cron/pg_cron):

- a cada 15 min: `expire_billing_intents`.
- diariamente às 08:00 America/Sao_Paulo: `enqueue_billing_notifications`.
- diariamente às 08:15: `apply_due_plan_changes`.
- diariamente às 09:00: `billing-reconcile`.

### 6.5 Segurança

- Nunca armazenar número completo de cartão ou CVV. Somente `card_last4` e `card_brand`.
- Não logar payload de cartão; reutilizar `sanitizePaymentLog`.
- `billing_intents` não deve aceitar `amount_cents` do cliente; calcular no servidor.
- RLS testada para: usuário A não lê intenção/notificação de B; admin lê; service role escreve.
- Webhook valida `asaas-access-token` com comparação timing-safe já existente.
- Confirmar e-mail antes de cobrar cadastro novo.

---

## 7. Fases de implementação

### Fase 0 — Baseline, flags e sandbox

**Objetivo:** congelar o comportamento atual e criar rede de segurança.

Etapas:

1. Rodar `npm run verify` e registrar o baseline.
2. Criar backup lógico das tabelas de billing antes da migração.
3. Configurar/validar credenciais de sandbox do Asaas e webhook local.
4. Criar feature flags (em `user_preferences.custom_settings` ou `system_features`):
   - `billing_lifecycle_v2`
   - `clipboard_pix_ingest`
   - `simulator_v2`
   - `family_mode_naming`
5. Documentar os cenários atuais que serão substituídos.

**Portão QG-0:** `npm run verify` verde; backup confirmado; flags desligadas por padrão.

---

### Fase 1 — Domínio puro de billing

**Objetivo:** concentrar todas as regras em `src/domain/subscription/` sem UI/Supabase.

Arquivos:

- `src/domain/subscription/billing-phase.ts` (novo)
- `src/domain/subscription/charge-schedule.ts` (novo)
- `src/domain/subscription/plan-change.ts` (novo)
- `src/domain/subscription/cumulative-renewal.ts` (novo)
- `src/domain/subscription/trial.ts` (refatorar)
- `src/domain/subscription/plans.ts` (fonte única de preços)
- testes colocalizados `*.test.ts`

Funções mínimas:

- `resolveBillingPhase(input): BillingPhase`
- `resolveChargeSchedule({ phase, trialEndsAt, currentPeriodEnd, now }): ChargeSchedule`
- `canUsePix({ phase, amountDueTodayCents }): boolean`
- `nextPeriodEnd(base, interval, timezone)`
- `addCumulativeRenewal(currentPeriodEnd, now, days = 365)`
- `resolvePendingPlanChange(current, target, effectiveAt)`
- `isTrialEligible({ hasUsedTrial, hasPaid, status })`

Regras de teste:

- trial com 0 dias → cobrança hoje;
- trial com 1 dia → cobrança amanhã;
- trial com `trial_ends_at = null` → nunca assumir 30 por padrão em produção; tratar como estado inválido e exigir reparo;
- virada de mês (31/01 + 1 mês);
- ano bissexto (29/02 + 1 ano);
- timezone `America/Sao_Paulo`;
- `past_due` não reinicia trial;
- `canceled_until_period_end` não cobra antes do fim;
- acumulativa soma 365 dias a partir do maior valor, bloqueia empilhamento e reverte no CDC.

**Portão QG-1:** testes de domínio cobrindo 100% dos novos branches; zero `any`; zero import de UI/Supabase.

---

### Fase 2 — Banco, RPC e migrações

**Objetivo:** persistir o novo ciclo e expor contrato confiável ao frontend.

Etapas:

1. Criar as migrações 114, 115 e 116 descritas na §6.
2. Atualizar `get_my_subscription()` com os novos campos.
3. Atualizar `can_current_user_write()` e `get_user_module_access()` para a fase derivada.
4. Criar RPCs de troca de plano e jobs.
5. Backfill idempotente.
6. Testar rollback em banco local.
7. Rodar `npx supabase db diff` e revisar o SQL gerado.

**Portão QG-2:** migração aplicada em local; rollback testado; RLS testada; `get_my_subscription()` retorna os campos esperados para 8 personas de teste.

---

### Fase 3 — Checkout e Edge Functions

**Objetivo:** servidor como autoridade de datas, valores e idempotência.

Arquivos:

- `src/features/subscription/pages/subscription-checkout-page.tsx`
- `src/features/subscription/pages/subscription-success-page.tsx`
- `src/features/subscription/components/*` (novos subcomponentes)
- `src/data/repositories/billing.ts`
- `src/state/mutations/use-checkout-mutation.ts` (ou equivalente)
- `supabase/functions/asaas-checkout/index.ts`
- `supabase/functions/asaas-manage/index.ts`
- `supabase/functions/_shared/asaas.ts`
- `supabase/functions/_shared/asaas-plans.ts`

Mudanças:

1. Remover `trialDaysRemaining`/`firstBillingDate` do payload público; calcular no servidor.
2. Criar `billing_intent` antes da chamada ao gateway.
3. Se trial ativo + cartão: criar assinatura com `nextDueDate = trial_ends_at`, mas manter `tier=trial` e `status=trialing`, gravando `scheduled_plan_id` e `scheduled_first_charge_at`.
4. Se cobrança hoje: criar assinatura/cobrança e ativar somente após confirmação do gateway/webhook.
5. Pix: bloquear durante trial; permitir apenas com `amountDueToday > 0`.
6. Cadastro novo: confirmar e-mail antes de cobrar; manter intenção pendente e retomar o checkout após confirmação.
7. Não sobrescrever `starts_at` nem `trial_ends_at`.
8. Guardar `card_last4`/`card_brand`, nunca PAN.
9. Substituir o redirect de `isPro` por estado de gerenciamento.
10. Página de sucesso lê `current_period_end`, `billing_start_at`, `next_charge_at` e `payment_method` do backend.
11. Exibir timeline de cobrança: Hoje → Fim do trial → Primeira cobrança → Renovação.

**Portão QG-3:** matriz de sandbox abaixo 100% aprovada; nenhuma data calculada no cliente; logs sem PII.

| Cenário | Resultado esperado |
|---|---|
| Conta nova + cartão, e-mail confirmado | Cobrança hoje, Pro ativo, período correto |
| Conta nova + cartão, e-mail pendente | Nenhuma cobrança; intenção pendente; retomada após confirmar |
| Trial ativo + cartão | `trial_scheduled`; sem cobrança hoje; primeira cobrança no fim |
| Trial ativo + Pix | Bloqueado com explicação; sem QR |
| Trial expirado + cartão | Cobrança hoje |
| Trial expirado + Pix anual | QR hoje; ativação após pagamento |
| `past_due` + cartão | Cobrança hoje; sem trial |
| Pro mensal ativo | Checkout não redireciona; oferece troca |
| Cancelado com período vigente | Sem cobrança até o fim |
| Cupom/valor divergente | Rejeitado pelo catálogo |

---

### Fase 4 — Webhook, dunning e notificações

**Objetivo:** processar eventos de forma idempotente e comunicar o usuário.

Etapas:

1. Adicionar `provider_event_id` único e inserir antes de processar.
2. Resolver `billing_intent` por `external_reference`/payment ID.
3. Calcular período a partir de `dueDate`/`confirmedDate`, nunca de `now`.
4. `PAYMENT_RECEIVED`/`CONFIRMED`: ativar ou renovar conforme intenção.
5. `PAYMENT_OVERDUE`: `past_due`, manter grace de 3 dias, notificar e tentar retry.
6. `SUBSCRIPTION_DELETED`: `cancel_at_period_end`, não cortar acesso imediatamente.
7. `PAYMENT_REFUNDED`: `read_only` imediato, registrar auditoria.
8. Pagamento de renovação acumulativa: somar +365 dias uma única vez por `billing_intent`, sem mudar tier; gravar `previous_period_end`; reembolso CDC reverte para esse valor; duplicata não soma novamente.
9. Criar `billing_notify` (Edge Function) e cron de lembretes.
10. Criar `billing-reconcile` diário.

**Portão QG-4:** simular eventos duplicados, fora de ordem, pagamento tardio, reembolso, cancelamento e renovação acumulativa; nenhum período duplicado ou perdido.

---

### Fase 5 — UI de gerenciamento, troca e renovação acumulativa

**Objetivo:** dar controle ao usuário sem sair do app.

Arquivos:

- `src/features/settings/components/tabs/subscription-tab.tsx`
- `src/components/modules/subscription/upgrade-dialog.tsx`
- novos componentes em `src/features/subscription/components/`
- `src/features/subscription/pages/subscription-checkout-page.tsx`

Etapas:

1. StatusBlock passa a usar `billing_phase`:
   - Trial ativo;
   - Trial com cobrança agendada;
   - Trial expirado;
   - Ativo;
   - Inadimplente;
   - Cancelamento agendado;
   - Somente-leitura.
2. Exibir “Primeira cobrança” e “Próxima renovação” separadamente.
3. Troca de plano:
   - modal de confirmação com data efetiva;
   - “Sua mudança será aplicada em DD/MM/AAAA”;
   - botão “Cancelar mudança”;
   - nenhum upgrade imediato.
4. Renovação acumulativa:
   - card apenas para mensal ativo; bloquear trial, anual, lifetime, read_only e past_due;
   - valor R$ 191,88 e equivalente R$ 15,99/mês;
   - explicar que são +365 dias após o vencimento atual, sem trocar o ciclo mensal;
   - confirmação com vencimento anterior, novo vencimento e aviso de reativação se `cancel_at_period_end`;
   - bloquear se houver `pending_plan_id`, se já houver acumulativa ativa no ciclo (`billing_intent` paga com `new_period_end = current_period_end`) ou se `current_period_end > hoje + 365 dias`;
   - checkout avulso (Pix/cartão), sem parcelamento e sem recorrência;
   - recibo “Renovação acumulativa +365 dias” e estorno CDC revertendo `metadata.previous_period_end`.
5. Atualizar textos de cancelamento/garantia para usar `starts_at` real.
6. Atualizar `PLAN_LABELS` para consumir `PLAN_CONFIGS`; remover preços hardcoded.

**Portão QG-5:** fluxos completos em desktop e mobile; zero texto “30 dias” quando expirado; zero CTA morto; testes de componente atualizados.

---

### Fase 6 — Clipboard, Pix e calculadora

**Objetivo:** reduzir fricção sem violar privacidade.

Arquivos:

- `src/services/clipboard.ts` (novo)
- `src/domain/notifications/pix-clipboard.ts` (novo)
- `src/domain/notifications/pix-clipboard.test.ts`
- `src/components/modules/clipboard-suggestion-dialog.tsx` (novo)
- `src/components/modules/floating-calculator.tsx`
- `src/features/transactions/wizard/launch-wizard.tsx`
- `src/components/modules/attach-receipt-dialog.tsx`
- `src/features/settings/components/tabs/*` (opt-in de sugestões)

Etapas:

1. Implementar gateway de clipboard com estados tipados.
2. Implementar parser puro de candidato:
   - BR Code EMV;
   - link Pix com payload;
   - texto de compartilhamento;
   - comprovante bancário.
3. Reutilizar memória existente para categoria, descrição, cartão e método.
4. Diálogo de revisão com valor, contraparte, natureza, categoria e confiança.
5. Pré-preencher Wizard Rápido somente após confirmação.
6. Adicionar opção “Colar link Pix” no diálogo de anexo.
7. Corrigir calculadora com fallback manual.
8. Criar opt-in “Sugerir lançamentos a partir da área de transferência” (padrão desligado).
9. Nunca ler clipboard em background.
10. Testes de permissão negada, contexto inseguro, texto vazio, link inválido, comprovante e BR Code.

**Portão QG-6:** cálculo e wizard sem leitura automática; fallback funciona em navegador sem Clipboard API; parser não salva nada; logs não contêm texto bruto.

---

### Fase 7 — Simulador da landing

**Objetivo:** transformar o card em experiência de primeiro contato clara e responsiva.

Arquivos:

- `src/features/landing/components/minimal-wealth-simulator.tsx`
- `src/features/landing/components/fire-projection-curve.tsx`
- `src/components/modules/allocation-donut.tsx` (se necessário)
- `src/features/landing/components/minimal-wealth-simulator.test.tsx`
- `src/features/landing/components/fire-projection-curve.test.tsx`

Etapas:

1. Reduzir a densidade: remover badges redundantes, cards aninhados e CTA duplicada.
2. Reorganizar em três blocos: controles, visualização, direcionamento.
3. Controles: patrimônio, perfil e aporte em `grid-cols-1 sm:grid-cols-3`; sem `truncate` em valores.
4. Métricas do gráfico: `grid-cols-1 sm:grid-cols-3`; `MoneyText` sem truncate; labels com `break-words`.
5. Gráfico:
   - altura mínima `220px`;
   - margens calculadas;
   - fontes 11–12px no mobile;
   - rótulo da meta escondido ou reposicionado em telas estreitas;
   - tooltip medido em pixels e limitado ao container;
   - tabela oculta para leitores de tela;
   - navegação por setas/Home/End.
6. Explicar “rentabilidade ilustrativa de 8% a.a.” e “regra dos 4%” em uma linha.
7. Interatividade: tocar/arrastar muda o ano; selecionar fatia do donut destaca a classe; tabs “Alocação” e “Projeção” com rótulos claros.
8. CTA única: “Organizar Meus Investimentos”.

**Portão QG-7:** em 320/360/390px, nenhum valor monetário cortado; nenhum overflow horizontal; gráfico legível; teclado funciona; screenshot aprovado.

---

### Fase 8 — Página pública de simulação

**Objetivo:** melhorar `/ferramentas/rebalanceamento` para primeiro contato.

Etapas:

1. Unificar presets com a landing (uma fonte em `domain/portfolio` ou constante compartilhada).
2. Adicionar resumo do cenário ativo e explicação do algoritmo.
3. Melhorar inputs e grids (sem overflow; sem truncate monetário).
4. Resultado sticky no mobile com “Aportar R$ X” e “Ver detalhes”.
5. Donut interativo com seleção de fatia e detalhe textual.
6. Comparação “Hoje → Pós-aporte” por classe.
7. Aviso legal e CTA única.
8. Testes de share URL e valores grandes.

**Portão QG-8:** página utilizável em 360px; presets sem duplicação; cálculo inalterado (mesmos testes de domínio); acessibilidade do gráfico.

---

### Fase 9 — Modo Família e arquitetura de informação

**Objetivo:** padronizar nome e posição.

Etapas:

1. Renomear textos para “Modo Família” em:
   - `nav-items.tsx` (label e shortLabel);
   - `family-page.tsx` (PageHeader, empty states);
   - `family-create-modal.tsx`;
   - `family-settings-dialog.tsx`;
   - `family-invite-page.tsx`;
   - onboarding (`initial_goal = family`);
   - textos de insights e testes.
2. Manter `/familia`; adicionar `/modo-familia` com `<Navigate to="/familia" replace />`.
3. Manter o grupo “Estratégia & Análise”.
4. Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md`, `ROADMAP.md` e testes.
5. Não renomear tabelas, RPCs ou campos `family_*`.

**Portão QG-9:** zero ocorrências de “Orçamento Familiar” na UI; testes de navegação e página atualizados; links antigos funcionam.

---

### Fase 10 — Skeletons e quality gate final

**Objetivo:** padronizar loading em todo o app e fechar a release.

Etapas:

1. Substituir `RouteSuspenseFallback` por skeleton de shell autenticado e skeleton público.
2. Migrar `family-page.tsx` para `SkeletonKpi`, `SkeletonChart`, `SkeletonList`.
3. Auditar todas as telas com `animate-pulse`, `animate-spin` e `LoadingScreen`.
4. Usar os compostos existentes; criar `SkeletonPage` apenas se necessário em `components/ui/skeleton.tsx`.
5. Garantir `aria-busy`, `role="status"`, `prefers-reduced-motion` e zero CLS.
6. Rodar `npm run verify:full`.
7. Build de produção e preview.
8. Atualizar docs e versão.

**Portão QG-10:** `verify:full` verde; build sucesso; preview sem erros de console; screenshots mobile/desktop; docs atualizados; versão SemVer.

---

## 8. Matriz de testes

### 8.1 Unitários (Vitest, domínio)

- `billing-phase.test.ts`: 8 fases, limites de data, timezone, ano bissexto.
- `charge-schedule.test.ts`: trial 0/1/30 dias, expirado, pago, null.
- `plan-change.test.ts`: mensal→anual, anual→mensal, cancelamento, data efetiva.
- `cumulative-renewal.test.ts`: preço 19188 e equivalente 1599; soma 365 em UTC; período vigente e expirado; bloqueio em trial/anual/lifetime/past_due/read_only; `cancel_at_period_end`; `pending_plan_id`; bloqueio de empilhamento por intenção paga no ciclo; reembolso CDC revertendo `previous_period_end`; webhook duplicado.
- `plans.test.ts`: preços 1999/14388/19188, economia de R$ 48,00 em cada lado, arredondamento e ausência de hardcode na UI.
- `pix-clipboard.test.ts`: BR Code, link, comprovante, confiança, falso positivo.
- `clipboard.test.ts`: permissão, contexto inseguro, vazio.
- `calculator` existente: regressão de colagem.
- `financial` existente: nenhum cálculo alterado.

### 8.2 Integração

- Checkout com Edge Function mockada: payload não contém datas; resposta atualiza fase.
- Webhook: duplicata, fora de ordem, pagamento tardio, renovação acumulativa.
- RPC `get_my_subscription`: 8 personas.
- RLS: usuário A não acessa B.

### 8.3 E2E (Playwright, apenas smoke)

- Landing → checkout → cadastro → confirmação (mock) → checkout.
- Trial ativo → checkout cartão → texto “primeira cobrança em…”.
- Trial expirado → checkout → texto “cobrança hoje”.
- Settings → troca de plano → confirmação com data efetiva.
- Calculadora → colar (mock) → valor no display.
- Simulador → trocar aba → sem overflow horizontal.
- `/familia` → redireciona/abre “Modo Família”.

### 8.4 Manual sandbox Asaas

Executar a matriz da Fase 3 e mais:

- cartão recusado;
- cartão expirado;
- Pix expirado;
- pagamento Pix após expiração;
- reembolso CDC;
- cancelamento após 7 dias;
- troca de plano no dia da renovação;
- renovação acumulativa com pagamento duplicado;
- renovação acumulativa com troca de plano pendente;
- renovação acumulativa com Pix confirmado após expiração local;
- renovação acumulativa com reembolso CDC e reversão exata do vencimento.

---

## 9. Segurança, LGPD e PCI

1. **PCI:** nunca persistir PAN/CVV; somente last4/brand. Não enviar cartão para logs/telemetria.
2. **LGPD:** área de transferência é dado pessoal; leitura somente sob ação explícita; opt-in para sugestões; não persistir texto bruto; permitir limpar memória de estabelecimentos.
3. **Minimização:** parser retorna apenas o necessário; logs de erro usam `getErrorMessage` e `sanitizePaymentLog`.
4. **Consentimento:** aviso curto no primeiro uso da colagem e configuração para desativar.
5. **Retenção:** `billing_webhook_logs` com prazo definido; notificações com expurgo.
6. **Auditoria:** toda mudança de plano, cobrança, reembolso e renovação acumulativa em `audit_events`.
7. **Server authority:** nenhum valor/data crítica aceita do cliente.

---

## 10. Observabilidade e métricas

Eventos sugeridos (sem PII):

- `billing_checkout_started` (plano, método, fase)
- `billing_checkout_completed` (plano, método, fase)
- `billing_charge_scheduled` (dias até cobrança)
- `billing_charge_succeeded`
- `billing_charge_failed` (código do gateway)
- `billing_plan_change_scheduled`
- `billing_cumulative_renewal_purchased`
- `clipboard_candidate_detected` (origem, confiança, natureza)
- `clipboard_candidate_confirmed`
- `simulator_interaction` (aba, faixa de anos, dispositivo)
- `skeleton_shown` (rota, duração)

Metas:

- zero divergência entre `plans` e `PLAN_CONFIGS`;
- zero cobrança sem `billing_intent`;
- zero ativação duplicada por webhook;
- 100% das cobranças agendadas com data visível ao usuário;
- NPS/suporte: reduzir tickets “cobrança no dia errado” e “não consigo colar”.

---

## 11. Rollout e rollback

1. Flags desligadas; migrações primeiro.
2. Ativar `billing_lifecycle_v2` para contas internas/superadmin.
3. Ativar para 10% dos novos checkouts; monitorar 48 h.
4. Ativar 100%; manter rollback de UI, mas **não** reverter dados de cobrança sem reconciliação.
5. `clipboard_pix_ingest` e `simulator_v2` podem ser ativadas independentemente.
6. Rollback de migração: script documentado, com restauração de backup; nunca `drop column` em produção sem janela.

Critérios de abortar:

- qualquer cobrança em duplicidade;
- período de acesso divergente;
- erro 5xx no webhook acima de 2%;
- perda de acesso para Pro ativo;
- reclamação de cobrança antes da confirmação de e-mail.

---

## 12. Definition of Done

- [ ] Fases 0–10 concluídas na ordem, com portões aprovados.
- [ ] `npm run verify:full` verde.
- [ ] Migrações aplicadas e reconciliadas; nenhuma pendente.
- [ ] Nenhuma cobrança sem intenção idempotente.
- [ ] Trial, agendamento, expiração, past_due e troca de plano cobertos por testes.
- [ ] Pix nunca gera QR quando não há valor a pagar hoje.
- [ ] Troca mensal ↔ anual só na renovação, com confirmação e cancelamento.
- [ ] Renovação acumulativa mensal com R$ 191,88, +365 dias, uma compra ativa, bloqueios de elegibilidade, reembolso CDC e idempotência validados.
- [ ] Clipboard com fallback e opt-in; calculadora corrigida.
- [ ] Simuladores sem truncamento monetário e sem overflow em 320px.
- [ ] “Modo Família” padronizado; `/familia` preservado.
- [ ] Skeletons compostos em todas as telas de conteúdo.
- [ ] Docs atualizados: `ARCHITECTURE.md`, `ESPECIFICACAO_TECNICA.md`, `PROJETO_SAAS.md`, `ROADMAP.md`, `DESIGN_SYSTEM.md` (se novos padrões), `FOUNDER_RUNBOOK.md` (dunning), `SECURITY_GOVERNANCE.md` (clipboard).
- [ ] Versão MINOR `3.4.0` e build de produção.

---

## 13. Riscos e decisões abertas

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Asaas não permitir alterar ciclo apenas na renovação | Média | Alto | Spike na Fase 1/3; se não permitir, job no dia efetivo com `updateAsaasSubscriptionCycle` + idempotência. |
| Webhook fora de ordem | Média | Alto | `provider_event_id` único, intenção, reconciliação diária. |
| Cobrança antes da confirmação de e-mail | Média | Crítico | Intenção pendente + confirmação antes de capturar. |
| Pix expirado e pago depois | Baixa | Médio | Reconciliação e ativação por payment ID, não por validade local. |
| Muitos estados e textos novos | Alta | Médio | Fonte única `billing_phase` + testes de copy. |
| Parser de clipboard com falso positivo | Média | Médio | Confiança mínima, revisão humana, opt-in, nunca salvar automático. |
| Migração de dados de trial | Média | Alto | Backfill conservador, backup, relatório de divergências antes de ativar. |
| Documentação `PROJETO_SAAS` já diverge do schema (campos genéricos) | Alta | Médio | Atualizar doc na mesma entrega; não prometer campo que não existe. |

Decisões que exigem confirmação do fundador antes da Fase 3:

1. Cobrar somente após confirmação de e-mail ou permitir cobrança antes com acesso limitado? **Recomendação: confirmar antes.**
2. Preço da acumulativa: **R$ 191,88 (R$ 15,99/mês), recomendação fechada neste plano**. Validar apenas a nota contábil de receita diferida com o contador; não reabrir para R$ 15,00/R$ 16,00 sem análise de canibalização do anual.
3. Pix no trial: bloquear totalmente ou permitir “pagar agora e encerrar o teste”? **Recomendação: bloquear por padrão; ação explícita opcional.**
4. Canal de e-mail: Resend API (nova chave) ou apenas in-app + Telegram nesta fase? **Recomendação: in-app obrigatório; e-mail na mesma fase se a chave existir.**

---

## 14. Fora de escopo

- Boleto bancário e conciliação de compensação.
- Parcelamento do plano anual.
- Cupons, afiliados e promoções.
- Migração de gateway (Stripe) ou multi-moeda.
- Reescrita do motor de rebalanceamento.
- Renomear tabelas/RPCs de família.
- Persistência offline de dados de negócio.

---

## 15. Ordem recomendada de execução

```text
Fase 0 (baseline)
  → Fase 1 (domínio puro)
  → Fase 2 (banco/RPC)
  → Fase 3 (checkout/edge)
  → Fase 4 (webhook/notificações)
  → Fase 5 (UI de gestão/troca/acumulativa)
  → Fase 6 (clipboard/calculadora)
  → Fase 7 (simulador landing)
  → Fase 8 (simulador público)
  → Fase 9 (Modo Família)
  → Fase 10 (skeletons/QA/release)
```

Dependências:

- Fase 5 depende de 2–4.
- Fase 6 é independente de billing.
- Fases 7–9 são independentes entre si.
- Fase 10 depende de todas as anteriores para o gate final.

---

## 16. Anexo — Arquivos-chave por área

### Billing

- `src/domain/subscription/plans.ts`
- `src/domain/subscription/trial.ts`
- `src/features/subscription/pages/subscription-checkout-page.tsx`
- `src/features/subscription/pages/subscription-success-page.tsx`
- `src/features/settings/components/tabs/subscription-tab.tsx`
- `src/components/modules/subscription/upgrade-dialog.tsx`
- `src/data/repositories/billing.ts`
- `src/state/queries/use-user-subscription.ts`
- `supabase/functions/asaas-checkout/index.ts`
- `supabase/functions/asaas-manage/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/_shared/asaas.ts`
- `supabase/functions/_shared/asaas-plans.ts`
- `supabase/functions/_shared/asaas-webhook-logic.ts`
- `supabase/migrations/20260101000103_subscription_cancellation_and_period_expiration.sql`
- `supabase/migrations/20260101000104_billing_refinements_and_audit_logs.sql`

### Clipboard / memória

- `src/components/modules/floating-calculator.tsx`
- `src/domain/calculator/index.ts`
- `src/features/transactions/wizard/launch-wizard.tsx`
- `src/components/modules/attach-receipt-dialog.tsx`
- `src/domain/notifications/universal-receipt-parser.ts`
- `src/domain/notifications/bank-parser.ts`
- `src/domain/notifications/pix-emv-parser.ts`
- `src/domain/notifications/merchant-resolver.ts`
- `src/domain/notifications/merchant-memory.ts`
- `src/services/merchant-learning.ts`
- `src/services/native/merchant-storage.ts`

### Simuladores

- `src/features/landing/components/minimal-wealth-simulator.tsx`
- `src/features/landing/components/fire-projection-curve.tsx`
- `src/features/tools/pages/rebalance-simulator-page.tsx`
- `src/components/modules/allocation-donut.tsx`
- `src/components/modules/category-donut.tsx`
- `src/domain/portfolio/simulation.ts`

### Modo Família / skeletons

- `src/components/layout/nav-items.tsx`
- `src/features/family/pages/family-page.tsx`
- `src/features/family/components/*`
- `src/app/router.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/layout/loading-screen.tsx`

---

## 17. Nota de escopo desta entrega

Este documento é exclusivamente de planejamento. Não houve alteração de código de produto, schema, Edge Functions ou configuração de billing. As migrações descritas na §6 são propostas para a implementação manual e **não** foram aplicadas neste trabalho. Todas as migrações atualmente existentes no repositório já estão aplicadas no Supabase remoto (incluindo `20260101000113_theme_schedule_and_preferences`), conforme verificação feita na sessão.
