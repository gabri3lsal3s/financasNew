# Relatório de Viabilidade Técnica: Notificações de Aplicativos de Transporte e Serviços

**Data:** 04/11/2026  
**Status:** Concluído / Parecer Técnico Formal  
**Autor:** Antigravity / Engenharia do Áxis Finance  
**Classificação:** Análise de Arquitetura & Viabilidade de Produto  

---

## 1. Sumário Executivo

Este documento apresenta a análise de viabilidade técnica, arquitetural e de experiência do usuário para o eventual monitoramento passivo de notificações push geradas por aplicativos de transporte e delivery no sistema Android nativo — especificamente **Uber**, **99 Tecnologia** e **iFood**.

### Parecer Técnico Formal
**Desfavorável à inclusão de aplicativos de serviço na esteira de captura primária do assistente de notificações.**

A arquitetura do Áxis Finance deve **manter o foco exclusivo nas notificações de instituições financeiras e carteiras digitais homologadas**. A captura de pushes diretos de plataformas de serviço introduz um risco crítico de transações duplicadas, alto volume de ruídos promocionais e inconsistências contábeis decorrentes de múltiplos modelos de cobrança (créditos pré-pagos, vouchers, dinheiro físico e ajustes tarifários posteriores).

---

## 2. Mapeamento de Pacotes e Estrutura de Pushes (Tarefa 4.1)

### 2.1 Uber
* **Pacotes Android:**
  * `com.ubercab` (Uber Passageiro / Viagens)
  * `com.ubercab.eats` (Uber Eats)
* **Pushes de Finalização Financeira:**
  * *"Sua viagem de R$ 24,90 terminou"*
  * *"Recibo da sua viagem de R$ 32,50"*
* **Ruídos Operacionais e Promocionais:**
  * *"Seu motorista está chegando"*
  * *"50% off na sua próxima corrida com o código XYZ"*
  * *"Avalie sua viagem com o motorista"*
  * *"Uber Flash: pacote a caminho"*

### 2.2 99 Tecnologia (99App / 99Pay)
* **Pacotes Android:**
  * `com.taxis99` (99 Passageiro / 99Pay)
* **Pushes de Finalização Financeira:**
  * *"Corrida finalizada. Valor: R$ 19,80"*
  * *"Você pagou R$ 19,80 no cartão com final 1234"*
* **Ruídos Operacionais e Promocionais:**
  * *"Cupom de 20% disponível para você!"*
  * *"Economize até R$ 15 chamando um 99Moto"*
  * *"Seu saldo na 99Pay rendeu hoje"*
  * *"Motorista a 2 minutos do ponto de encontro"*

### 2.3 iFood
* **Pacotes Android:**
  * `br.com.brainweb.ifood` (iFood Delivery de Comida e Mercado)
* **Pushes de Finalização Financeira:**
  * *"Pedido entregue! Total R$ 68,90"*
  * *"Pagamento aprovado: R$ 45,00 no Outback Steakhouse"*
* **Ruídos Operacionais e Promocionais:**
  * *"Hora do almoço! Peça agora com entrega grátis"*
  * *"Prato em dobro hoje: veja os restaurantes participantes"*
  * *"Seu pedido saiu para entrega"*
  * *"Restaurante começou a preparar sua comida"*

---

## 3. Análise Crítica do Risco de Duplicação com Notificações Bancárias (Tarefa 4.2)

O principal obstáculo técnico à captura de aplicativos de serviço reside na **colisão inevitável com a notificação bancária**.

```
[ Usuário finaliza corrida na Uber de R$ 24,90 ]
                 │
                 ├── (t = 0s) Push Uber (com.ubercab):
                 │            "Sua viagem de R$ 24,90 terminou"
                 │
                 └── (t + 2s) Push Banco (ex: Nubank - com.nu.production):
                              "Compra de R$ 24,90 aprovada em Uber *Trip"
```

### 3.1 Impacto no Sistema Financeiro
1. **Geração de Sugestões Concorrentes:** se ambos os pacotes forem monitorados, o serviço nativo (`BankNotificationListenerService`) gerará duas sugestões distintas para o mesmo fato financeiro com intervalo inferior a 5 segundos.
2. **Duplicação de Despesa no Extrato:** caso o usuário confirme ambas no Wizard ou pela notificação interativa rápida, o saldo da categoria (Transporte) e a projeção financeira mensal sofrerão superavaliação indevida da saída de caixa.
3. **Falta de Dados Canônicos no Push do App:**
   * O push da Uber/iFood geralmente omite a conta bancária ou cartão real de liquidação (informa apenas "Pago no cartão" ou máscara genérica).
   * O push bancário informa o emissor, a competência da fatura, se a operação foi crédito ou débito e os 4 últimos dígitos do cartão físico/virtual.
   * Portanto, a notificação bancária carrega valor semântico financeiro estritamente superior ao push do aplicativo de serviço.

---

## 4. Análise de Inconsistências de Liquidação

Além da duplicação direta, a captura de apps de serviço enfrenta divergências operacionais de liquidação:

1. **Vouchers Corporativos e Créditos Pré-Pagos:**
   * Se o usuário utiliza saldo pré-pago (Uber Cash, Saldo iFood, Gift Cards) ou voucher corporativo (Uber for Business), o app emite notificação com o valor facial da corrida (ex.: R$ 35,00), mas nenhuma movimentação financeira ocorreu nas contas pessoais do usuário naquele momento. Registrar essa transação gera distorção patrimonial.
2. **Revisões Tarifárias Pós-Viagem:**
   * Ajustes dinâmicos de rota, inclusão de pedágios ou taxas de cancelamento frequentemente alteram o valor cobrado após o envio da notificação inicial da viagem.
   * Apenas a notificação do banco ou o fechamento da fatura reflete a cobrança líquida definitiva.
3. **Pagamento em Dinheiro Físico:**
   * O aplicativo envia "Valor da corrida: R$ 20,00". No entanto, o usuário pode ter pago com nota de R$ 50,00 e recebido troco, ou adicionado gorjeta não declarada no app.
4. **Volume Excessivo de Marketing:**
   * A densidade de notificações promocionais e de engajamento do iFood e da 99 é ordens de grandeza maior que a de aplicativos bancários.
   * Isso exigiria uma camada de filtros heurísticos altamente instável para distinguir avisos de cupons e rastreamento de entregas de confirmações reais de débito.

---

## 5. Arquitetura Técnica Recomendada para Cenários Futuros (Tarefa 4.3)

Caso surja a necessidade estratégica de suportar apps de mobilidade e delivery (por exemplo, para usuários que pagam exclusivamente via carteiras internas do app ou dinheiro), a implementação deverá seguir obrigatoriamente a seguinte arquitetura de tolerância e desduplicação:

### 5.1 Janela Deslizante de Deduplicação Temporal (120 Segundos)
* Quando uma notificação de serviço (`com.ubercab`, `com.taxis99`, `br.com.brainweb.ifood`) for detectada, ela é retida em um buffer transitório de quarentena por 120 segundos.
* Se dentro dessa janela chegar uma notificação bancária com:
  * Valor idêntico em centavos (`amountCents`);
  * Termo correspondente na descrição (`"uber"`, `"99"`, `"ifood"`);
* O sistema descarta sumariamente a notificação do aplicativo de serviço e processa exclusivamente a notificação bancária oficial.

### 5.2 Opt-In Estrito com Isolação de Categoria
* Desativado por padrão no aplicativo.
* Configuração explícita em *Configurações > Assistente Bancário > Captura de Apps de Transporte*.
* Aviso destacado ao usuário sobre a prioridade do banco e riscos de pequenas discrepâncias em corridas pagas em dinheiro.

---

## 6. Parecer Final e Recomendações

1. **Manter o Foco no Ecossistema Bancário:** A decisão arquitetural de restringir o `BankNotificationListenerService` aos pacotes bancários e adquirentes homologados (`DEFAULT_MONITORED_PACKAGES`) é a conduta correta, garantindo precisão matemática, zero duplicações e blindagem contra spam de marketing.
2. **Prioridade para Comprovantes Ópticos (OCR):** Para compras no iFood, recibos de corrida ou cupons de delivery sem notificação de banco (ou para conferência item a item), a rota canônica estabelecida é o anexo via imagem/PDF no assistente de comprovantes OCR (Fases 5, 6 e 7 do plano), onde o totalizador fiscal e os itens são auditados com rigor.
3. **Conclusão:** Não incorporar os pacotes `com.ubercab`, `com.taxis99` e `br.com.brainweb.ifood` no `DEFAULT_MONITORED_PACKAGES` no estágio atual do produto.
