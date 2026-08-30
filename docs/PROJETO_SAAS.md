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
| **Simulador FIRE & Projeção** | Liberado | **Bloqueado** | **Ativo** |

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
