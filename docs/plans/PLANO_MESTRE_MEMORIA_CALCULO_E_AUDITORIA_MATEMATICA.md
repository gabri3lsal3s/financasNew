# Plano Mestre: Memória de Cálculo, Auditoria Matemática e Transparência Financeira — Axi

> **Status:** Planejamento Consolidado, Otimizado e Auditado — Pronto para Início da Fase 1  
> **Caminho Canônico:** `docs/plans/PLANO_MESTRE_MEMORIA_CALCULO_E_AUDITORIA_MATEMATICA.md`  
> **Symlink:** `planos/PLANO_MESTRE_MEMORIA_CALCULO_E_AUDITORIA_MATEMATICA.md`  
> **Vinculação:** Cumpre a Regra 33 do `AGENTS.md` (Explicabilidade Matemática Ativa em KPIs Compostos), a `FINANCIAL_MATH_SPEC.md` e a `ESPECIFICACAO_TECNICA.md`.  
> **Classificação de Governança:** Fluxo Completo (Feature / Plano Mestre) — SemVer `MINOR`.

---

## 1. Visão Geral e Pilares Arquiteturais

Este plano estabelece a implementação, padronização e refinamento do sistema de **Memória de Cálculo** (gatilhos/cards informativos `?`) em todos os pontos cruciais do aplicativo **Axi**, realizando simultaneamente uma **auditoria matemática e funcional forense** para assegurar que todos os cálculos sejam exatos, auditáveis, compreensíveis e congruentes entre telas em dispositivos **mobile** e **desktop**.

### Pilares Fundamentais:
1. **Transparência Viva (Memória de Cálculo Real):** Toda métrica composta ou derivada deve permitir ao usuário abrir uma explicação clara contendo:
   - Definição em 1 frase humana do que o número mede;
   - Equação explícita com os valores reais da conta do usuário;
   - Passos ordenados com números tabulares (`tabular-nums`) e operadores alinhados;
   - Rótulo de período e critérios de inclusão/exclusão (o que entrou e o que ficou de fora);
   - Alertas transparentes (se houver dados estimados, cotação defasada ou mês em curso).
2. **Single Source of Truth (SSOT) & Princípio DRY:**
   - A função de domínio pura (`src/domain/`) que calcula o valor exibido na UI é a **mesma fonte de verdade** que fornece os dados estruturados para a memória de cálculo.
   - Proibido recalcular valores na camada de apresentação (UI).
3. **Ergonomia Responsiva Nativa (Zero Dependências Extras):**
   - **Mobile (< md):** Apresentação em **Bottom Sheet nativa** (`<Modal />` sobre `@radix-ui/react-dialog`) com suporte a arraste via `useBottomSheetDrag`, alça retrátil e safe-area do iOS.
   - **Desktop (md+):** Apresentação em **Popover ancorado** (`<Popover />` sobre `@radix-ui/react-popover`) com detecção de colisão para memórias concisas (até 5 passos), e **Modal compacto** para memórias densas (TWR, carteira, projeções, DRE).
   - **Gatilho (`?`):** Área de toque mínima acessível de `44x44px` no mobile via pseudo-elemento `after:-inset-2.5`, `aria-label` descritivo e isolamento obrigatório de eventos (`stopPropagation`).
4. **Generalização Multi-Unidade (Cura da Limitação Atual):**
   - O componente anterior (`EquationBreakdownPopover`) estava restrito a valores monetários em centavos (`MoneyText`). O novo motor suporta tipadamente:
     - `currency` (R$ em centavos);
     - `percent` (% com vírgula padrão pt-BR via `formatPercent`);
     - `months` (autonomia / runway em meses);
     - `count` (quantidades inteiras de parcelas, cotas ou transações);
     - `ratio` (múltiplos e índices).
5. **Zero Degradação de Performance (Lazy Breakdown):**
   - Para métricas de alta densidade (séries históricas, simulações de rebalanceamento, DRE consolidada), a decomposição dos passos é gerada sob demanda (**Lazy**) apenas no momento em que o usuário toca no `?`, garantindo custo computacional nulo na renderização inicial das telas.

---

## 2. Diagnóstico Forense: Tabela de Fragilidades e Incongruências Catalogadas

A auditoria forense da Fase 0 identificou 10 pontos de fragilidade matemática, contábil e técnica a serem saneados:

| ID | Severidade | Módulo / Componente | Descrição da Fragilidade / Incongruência | Impacto no Usuário | Solução Planejada |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `AUD-01` | **Alta** | `RealCashHeroCard` / `SafeToSpend` | A fórmula apresentada no popover descreve `Saldo + Recebíveis − Obrigações`, lista a parcela de recebíveis com sinal `+`, mas o `totalCents` repassado é `safeToSpendCents` (que em `cash-ledger.ts` NÃO soma recebíveis). | O total exibido não bate com a soma das parcelas quando há contas a receber pendentes. | Unificar a engine para que a memória de cálculo reflita exatamente a variante exibida ou alinhe a equação com `safeToSpendWithReceivablesCents`. |
| `AUD-02` | **Média** | `TearSheetMethodologyGrid` / `TWR` | O componente `EquationBreakdownPopover` só aceitava `cents: number`. Para exibir taxa anualizada de 14,2%, o código chamava `numberToCents(14.2)`, exibindo `"R$ 14,20"` para uma taxa percentual. | Distorção visual grosseira de unidade na tela de Relatório Executivo. | Suporte nativo a unidades no contrato da memória de cálculo (`unit: "currency" \| "percent"`). |
| `AUD-03` | **Média** | `BalanceTab` / `Grau FIRE` e `Runway` | No Grau de Liberdade Financeira (FIRE) e no Runway (meses), o popover exibia como total a parcela de proventos/reserva em reais em vez do percentual ou meses resultante. | Popover não concluía a explicação da métrica indicada no card. | Implementação de passos com operador de divisão (`/`) e resultado final formatado na unidade correta. |
| `AUD-04` | **Baixa** | `BudgetsLimitsSummaryCard` | Uso de `title={metricTooltip}` nativo do HTML para diferenciar Minha Parte de Total Bruto, gerando tooltip truncado no mobile e sem visibilidade das categorias orçadas vs não orçadas. | Falta de acessibilidade no mobile e perda de contexto de cálculo. | Adição do gatilho canônico `?` com decomposição de categorias orçadas e não orçadas. |
| `AUD-05` | **Média** | `SmartAdvisorCard` | Alertas do SmartAdvisor (ex.: aumentos percentuais de gastos) não informam se o período comparado é o mês completo anterior ou o mesmo número de dias decorridos do mês atual. | Desconfiança do usuário em relação à precisão dos alertas de anomalia. | Inclusão de `CalculationBreakdown` em todos os cards do SmartAdvisor com recorte temporal explícito. |
| `AUD-06` | **Alta** | `use-reports-data.ts` / `Balanço 360°` | No Balanço Patrimonial Pessoal Consolidado, o saldo em caixa passado é apenas o da corretora (`investments.cashBalanceBRL`), omitindo o saldo real em contas bancárias (`realCashBalance`), e as faturas de cartão não são passadas. | O Patrimônio Líquido Real ignora o dinheiro na conta corrente e ignora a dívida da fatura do cartão. | Injetar o saldo bancário de contas correntes e o total de faturas abertas em `computeConsolidatedBalanceSheet`. |
| `AUD-07` | **Média** | Modo Família e Modo Viagem | O usuário vê o saldo devedor/credor do acerto de contas sem conseguir auditar por que aquele valor foi atribuído a ele. | Fricção e discussões interpessoais entre casais ou membros da viagem. | Criar memória de cálculo de conciliação: Total Pago do Bolso − Quota Devida = Saldo Líquido de Compensação. |
| `AUD-08` | **Média** | Aporte e Rebalanceamento | O usuário não sabe por que ativos deficitários foram preteridos na sugestão de aporte. | Sensação de "caixa preta" no algoritmo de rebalanceamento. | Incluir na memória do aporte a seção de diagnóstico com o motivo de corte de ativos preteridos. |
| `AUD-09` | **Média** | `computeOverview` / Taxa de Poupança | Mês sem receitas (`incomeCents === 0`) e com despesas retornava `savingsRatePercent = 0%`, aparentando "equilíbrio" falso. | Falsa percepção de orçamento equilibrado. | Memória de cálculo com mensagem explicativa: *"Sem receitas registradas no mês; déficit de R$ X"*. |
| `AUD-10` | **Técnica** | `src/components/ui/modal.tsx` | Sintaxe espúria `);` na linha 346 introduzida na branch de trabalho que impede a execução limpa do `tsc -b`. | Bloqueio do Quality Gate local no pre-push. | Correção cirúrgica imediata no início da Fase 1 para restabelecer o typecheck 100% verde. |

---

## 3. As 9 Melhorias de Alto Impacto para a Experiência do Usuário

### Melhoria 1: Memória Ativa com Deep-Link Interativo (Navegação em 1 Toque)
As linhas da memória de cálculo podem conter metadados de ação (`actionLink`):
- Tocar em *"Despesas à vista do ciclo: R$ 1.250,00"* abre o extrato filtrado nas despesas daquela fatura.
- Tocar em *"Obrigações pendentes: R$ 800,00"* abre a listagem de pendências do mês.
- Tocar em *"Saldo de partida no checkpoint: R$ 4.200,00"* abre o diálogo de calibração do saldo.

### Melhoria 2: Didática Contábil Anti-Dupla-Contagem (Regime Caixa vs. Competência)
Rodapé informativo padronizado para eliminar a maior dúvida contábil de finanças pessoais:
- **Em Despesas do Mês:** *"Compras no cartão de crédito entram na competência da fatura. O pagamento da fatura é uma transferência de liquidação de caixa e não é contabilizado como nova despesa para evitar que o mesmo gasto seja somado duas vezes."*
- **Em Saldo Disponível em Conta:** *"Compras no cartão não afetam seu saldo bancário diário; apenas o pagamento efetivo da fatura debita da sua conta."*

### Melhoria 3: Tratamento de Mês Incompleto com Métricas de Ritmo (Burn Rate Diário)
Em indicadores de despesas, orçamentos e insights durante o mês em curso:
- Apresentar a taxa pro-rata diária:
  $$\text{Ritmo Atual} = \frac{\text{Gasto Acumulado}}{\text{Dias Decorridos}} \quad \text{vs.} \quad \text{Orçamento Diário} = \frac{\text{Teto Restante}}{\text{Dias Restantes}}$$
- Exibir a projeção linear: *"No ritmo atual de R$ 115,00/dia, você fechará o mês em R$ 3.450,00"*.

### Melhoria 4: Tríplice Ótica de Investimentos (Retorno Contábil vs. TWR vs. TIR / XIRR)
Memória integrada para os KPIs da carteira que confronta as 3 métricas lado a lado com os números reais do investidor:
1. **Retorno Contábil:** Valorização das posições abertas hoje frente ao custo pago + proventos ativos.
2. **TWR / Cotas (ANBIMA / CVM):** Retorno das escolhas de ativos isolando o timing de aportes e resgates (comparável com CDI/Ibov).
3. **TIR / XIRR:** Retorno do bolso ponderando o volume e o momento real em que o dinheiro saiu do banco para a corretora.

### Melhoria 5: Auditoria Reversa no Motor de Aporte & Rebalanceamento
Na memória de cálculo da sugestão de aporte, incluir a **Aba de Diagnóstico de Seleção**:
- **Ativos Contemplados:** Conta matemática explícita ($\text{Déficit da Classe} \to \text{Setor} \to \text{Cotas Inteiras B3 / Frações USD} \to \text{Total}$).
- **Ativos Não Contemplados:** Justificativa objetiva de cada ativo preterido (*Acima da meta*, *Trava de concentração de 15%*, *Quarentena/Saída*, ou *Cotação superior ao saldo restante*).

### Melhoria 6: Rastreabilidade Explícita dos Insights do SmartAdvisor
No `?` de cada insight automático:
- **Regra do Gatilho:** Fórmula exata que disparou o alerta;
- **Transações Concretas:** Lançamentos reais envolvidos;
- **Recorte Temporal:** Dias 1 a $N$ deste mês comparados estritamente com os dias 1 a $N$ do mês anterior.

### Melhoria 7: Cópia Rápida em Modo Texto / Executivo
Botão discreto de ícone (`Copy`) no cabeçalho do popover/modal que copia a memória em formato texto limpo para o clipboard, facilitando envio para cônjuge, sócios ou contabilidade.

### Melhoria 8: Modo Família e Modo Viagem sem Conflitos Interpessoais
Memória transparente de acerto financeiro:
- Demonstração exata: Total gasto pelo usuário − Sua cota devida = Saldo a receber ou a pagar via Pix, eliminando dúvidas entre casais ou grupos de amigos.

### Melhoria 9: Zero Degradação de Performance (Lazy Breakdown)
Garantir que a renderização dos cards principais nunca calcule os passos detalhados da memória de cálculo antecipadamente. A montagem dos passos ocorre sob demanda exclusivamente ao toque do usuário.

---

## 4. Matriz de Priorização de Métricas (`P0 / P1 / P2`)

### Prioridade P0 — Crítico (Obrigatório Adicionar/Refinar Memória de Cálculo)
Métricas compostas, deduzidas, projetadas ou com regras de negócio complexas onde a falta de explicação gera desconfiança imediata.

1. `DASH-CASH`: **Saldo Disponível em Conta & Saldo Livre Real (Safe-to-Spend)** (`RealCashHeroCard`)
2. `DASH-OPBAL`: **Resultado do Mês / Saldo Operacional** (`OverviewKpiGrid` / `computeOverview`)
3. `DASH-SAVINGS`: **Taxa de Poupança (Savings Rate %)** (`computeOverview`)
4. `CARD-INVOICE`: **Fatura Total & Saldo Aberto do Cartão** (`InvoiceKpisSection` / `CompetenceSummary`)
5. `CARD-LIMIT`: **Limite Comprometido vs Disponível do Cartão** (`cardLimitUsage`)
6. `DEBT-BALANCE`: **Saldo Devedor Consolidado & Amortização** (`calculateDebtsSummary` / `loans`)
7. `INV-PATRIMONY`: **Patrimônio Total da Carteira** (`PortfolioKpiStrip` / `usePortfolioPosition`)
8. `INV-TWR`: **Rentabilidade Acumulada e Anualizada TWR (Cotas)** (`twr.ts`)
9. `INV-IRR`: **Retorno do Bolso TIR / XIRR** (`irr.ts`)
10. `INV-PNL`: **Resultado Histórico Total (P&L Aberto + Realizado + Proventos)** (`resumo-metrics.ts`)
11. `INV-APORTE`: **Sugestão de Aporte Inteligente & Rebalanceamento** (`aporte.ts`)
12. `INSIGHT-ADVISOR`: **Alertas de Anomalia e Economia do SmartAdvisor** (`advisor.ts`)
13. `PROJ-EMERGENCY`: **Autonomia da Reserva de Emergência (Meses & Runway)** (`emergency-fund.ts`)
14. `REP-NETWORTH`: **Patrimônio Líquido 360°** (`consolidated-balance.ts`)
15. `REP-FIRE`: **Grau de Liberdade Financeira FIRE %** (`freedom-index.ts`)
16. `FAM-SETTLE`: **Acerto de Contas & Compensação Familiar** (`reconciliation.ts` / `settlement.ts`)
17. `TRIP-SETTLE`: **Balanço Líquido e Acerto Mútuo de Viagem** (`trip-math.ts`)

### Prioridade P1 — Relevante (Recomendado Adicionar Memória de Cálculo)
Totais intermediários, médias e orçamentos onde o critério pode gerar dúvida ocasional.

1. `DASH-INCOME`: **Receitas do Mês (Bruta vs Ponderada)**
2. `DASH-EXPENSE`: **Despesas do Mês (Bruta vs Ponderada)**
3. `BUDGET-SPENT`: **Total Gasto vs Teto Planejado** (`BudgetsLimitsSummaryCard`)
4. `INV-YIELD`: **Yield on Cost e Proventos Mensais Médios** (`proventos-metrics.ts`)
5. `INV-TARGET-DEV`: **Desvio da Meta de Alocação por Classe/Setor** (`allocation.ts`)
6. `FAM-CEILING`: **Teto de Gastos Familiar & Saldo Compartilhado** (`household-balance-card.tsx`)

### Prioridade P2 — Atômico (Não Adicionar `?` — Manter Interface Limpa)
Valores autoevidentes ou inseridos diretamente pelo próprio usuário.
- Valor nominal de um lançamento único no extrato;
- Quantidade simples de cotas de um ativo (ex.: 50 cotas);
- Data de vencimento ou dia de fechamento;
- Nome de categoria ou cartão.

---

## 5. Arquitetura Canônica de Módulos e Arquivos

Respeitando estritamente a árvore do `PROJECT_STRUCTURE.md` e a regra de isolamento de camadas do `AGENTS.md`:

```
src/
├── domain/
│   └── calculation-memory/                # Motores puros de cálculo e montadores de explicação
│       ├── types.ts                       # Contrato canônico: CalculationBreakdown, BreakdownStep, etc.
│       ├── formatters.ts                  # Formatação de unidades: BRL, %, meses, contadores
│       ├── builders/
│       │   ├── cash-breakdown.ts          # Builders para Saldo em Conta e Safe-to-Spend
│       │   ├── invoice-breakdown.ts       # Builders para Faturas, Limites e Parcelas de Cartão
│       │   ├── debts-breakdown.ts         # Builders para Saldo Devedor, Mora e Amortização Price/SAC
│       │   ├── portfolio-breakdown.ts     # Builders para Patrimônio, P&L, Preço Médio e Aporte
│       │   ├── performance-breakdown.ts   # Builders para TWR, TIR/XIRR e Benchmarks
│       │   ├── insights-breakdown.ts      # Builders para SmartAdvisor, anomalias e hábitos
│       │   ├── budgets-breakdown.ts       # Builders para Orçamentos e Metas
│       │   ├── family-breakdown.ts        # Builders para Teto e Acerto de Contas Familiar
│       │   ├── trips-breakdown.ts         # Builders para Balanço e Liquidação de Viagens
│       │   └── reports-breakdown.ts       # Builders para Balanço 360°, FIRE e Reserva
│       ├── index.ts                       # Barrel exportando tipos e builders
│       └── *.test.ts                      # Testes unitários com Vitest
│
└── components/
    └── modules/
        └── calculation-memory/            # Componentes de apresentação reutilizáveis
            ├── calculation-memory-trigger.tsx # Botão (?) acessível com área de toque 44x44px
            ├── calculation-memory-modal.tsx   # Container híbrido: Bottom Sheet no mobile / Popover ou Modal no desktop
            ├── calculation-memory-view.tsx    # Corpo visual canônico com tabela de passos e regras
            └── index.ts                       # Barrel re-exportado em components/modules/index.ts
```

---

## 6. Roteiro Executivo em Fases Refinadas

### Fase 1 — Fundação Arquitetural, Tipagem Universal e Piloto
- [x] Corrigir cirurgicamente o erro de sintaxe `);` duplicado na linha 346 de `src/components/ui/modal.tsx` para deixar `tsc -b` verde.
- [x] Criar o contrato de domínio puro em `src/domain/calculation-memory/types.ts` com suporte nativo a `currency`, `percent`, `months`, `count` e `ratio`, além de `actionLinks` e `copyText`.
- [x] Criar os utilitários de formatação pura em `formatters.ts` com proteção total contra divisão por zero e `NaN`.
- [x] Construir a suíte de componentes de UI em `src/components/modules/calculation-memory/`:
  - `CalculationMemoryTrigger`: Botão `?` discreto, com acessibilidade `aria-label`, navegação por teclado e área de clique de 44px.
  - `CalculationMemoryModal`: Orquestrador responsivo que renderiza Bottom Sheet nativa com arraste no mobile (`<Modal />`) e Popover (`<Popover />`) ou Modal compacto no desktop.
  - `CalculationMemoryView`: Visor padronizado com resumo humano, tabela tabular de passos, total destacado, rodapé de inclusões/exclusões e botão de cópia.
- [x] **Piloto de Refatoração:** Migrar o `RealCashHeroCard` no Dashboard e corrigir o bug `AUD-01` (congruência entre fórmula, recebíveis e total do Safe-to-Spend).
- [x] Adaptar o `EquationBreakdownPopover` existente para atuar como casca compatível sem quebrar outros usos.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 2 — Núcleo Financeiro: Dashboard, Contas, Rendas e Despesas
- [x] **Auditoria de Fórmulas:**
  - Resolver `AUD-09`: validar a fórmula de `computeOverview` quando `incomeCents === 0` (taxa de poupança tratada com mensagem transparente).
  - Auditar neutralização de transferências entre contas próprias e pagamento de fatura vs despesa (Melhoria 2).
- [x] Implementar builders em `src/domain/calculation-memory/builders/cash-breakdown.ts`:
  - `buildRealCashBreakdown`: Saldo de partida + entradas após checkpoint − saídas após checkpoint = Saldo Disponível.
  - `buildSafeToSpendBreakdown`: Saldo em conta + recebíveis previstos − faturas do ciclo − dívidas do ciclo = Saldo Livre.
  - `buildSavingsRateBreakdown`: $\frac{\text{Receitas} - \text{Despesas}}{\text{Receitas}} \times 100$.
  - `buildOperatingBalanceBreakdown`: Receitas − Despesas = Resultado do Mês.
- [x] Conectar os botões `?` na `OverviewKpiGrid` e no Dashboard.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 3 — Crédito e Compromissos: Cartões, Faturas, Dívidas e Empréstimos
- [x] **Auditoria de Fórmulas:**
  - Validar o cálculo de `openInvoicesCents` e `usedLimitCents` para compras parceladas e compras no dia de fechamento.
  - Validar estornos de fatura e créditos acumulados de meses anteriores.
- [x] Implementar builders em `builders/invoice-breakdown.ts` e `builders/debts-breakdown.ts`:
  - `buildInvoiceBreakdown`: Despesas à vista + parcelas do mês − pagamentos − estornos − crédito herdado = Saldo aberto.
  - `buildCardLimitBreakdown`: Limite total − despesas abertas e parcelas futuras = Limite disponível.
  - `buildDebtsSummaryBreakdown`: Dívidas a pagar pendentes − valores a receber pendentes = Saldo líquido de pendências.
  - `buildLoanAmortizationBreakdown`: Decomposição de parcela em Amortização + Juros (Price/SAC).
- [x] Conectar os botões `?` na `InvoiceKpisSection`, no card 3D do cartão e na página de Dívidas.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 4A — Investimentos: Custódia, Patrimônio, Preço Médio e Caixa
- [x] **Auditoria de Fórmulas:**
  - [x] Validar o cálculo do Patrimônio Total da carteira (Ativos em BRL + Ativos em USD com cotação PTAX + Caixa da Corretora).
  - [x] Validar a regra de zeramento estrito do Preço Médio na venda total.
- [x] Implementar builders em `builders/portfolio-breakdown.ts`:
  - [x] `buildPortfolioTotalBreakdown`: Soma do valor de mercado de cada ativo + saldo em caixa da corretora.
  - [x] `buildAssetCostBreakdown`: Quantidade × Preço Médio = Custo de Aquisição.
  - [x] `buildUnrealizedPnlBreakdown`: Valor de Mercado − Custo Total = Lucro/Prejuízo Aberto.
- [x] Conectar o `?` no card de Patrimônio Total de `PortfolioKpiStrip`, no `CashKpiCard` e na ficha de ativo.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 4B — Investimentos: Rentabilidade (TWR, TIR/XIRR, Histórico) e Proventos
- [x] **Auditoria de Fórmulas:**
  - [x] Resolver o bug `AUD-02` (unidade percentual exibida como moeda em TWR).
  - [x] Explicar com precisão matemática o encadeamento geométrico de cotas do TWR.
  - [x] Explicar o cálculo da TIR (solver Newton-Raphson com fluxo ponderado do bolso) e implementar a Tríplice Ótica (Melhoria 4).
- [x] Implementar builders em `builders/performance-breakdown.ts`:
  - [x] `buildTwrBreakdown`: Evolução do valor da cota, rentabilidade do período e taxa anualizada.
  - [x] `buildIrrBreakdown`: Fluxos de caixa reais (aportes/retiradas) vs saldo final e taxa equivalente ao ano.
  - [x] `buildAllTimePnlBreakdown`: Lucro realizado passado + lucro não realizado de hoje + proventos recebidos = Riqueza gerada.
  - [x] `buildYieldBreakdown`: Proventos dos últimos 12 meses ÷ Custo de aquisição (Yield on Cost) vs Cotação atual (Dividend Yield).
- [x] Conectar o `?` nos cards de Rentabilidade, TIR e Resultado Histórico da `PortfolioKpiStrip`, no `TearSheetMethodologyGrid` e em `AssetPositionMetricsGrid`.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 4C — Investimentos: Rebalanceamento e Sugestões de Aporte
- [x] **Auditoria de Fórmulas:**
  - [x] Isolar a explicação dos 3 estágios hierárquicos do motor de aporte (`aporte.ts`):
    1. Déficit relativo da classe;
    2. Alocação interna no setor;
    3. Quantidade de cotas inteiras (B3) ou frações (USD/Cripto) e resíduo não alocado.
  - [x] Resolver `AUD-08`: criar seção de diagnóstico com justificativas de corte para ativos preteridos (Melhoria 5).
- [x] Implementar builders em `builders/aporte-breakdown.ts`:
  - [x] `buildAporteBreakdown`: Decomposição do poder de compra (bolso + caixa), alocação nas classes, sobra em caixa e diagnósticos de preterição AUD-08.
  - [x] `buildAporteAssetRouteBreakdown`: Meta percentual alvo, posição atual, gap de alocação, preço de mercado e dimensionamento de cotas sugeridas.
- [x] Conectar o `?` no cabeçalho do `AporteCockpitCommandCard`, nas linhas da `AporteDesktopTable` e nos cards da `AporteMobileCardList`.
- [x] Executar Quality Gate: `npm run verify`.

### Fase 4.5 — Usabilidade, Blindagem de Event Bubbling em Portais e Padronização de Modais/Tooltips Antigos
- [x] **Blindagem Arquitetural de Propagação de Eventos (Event Bubbling em Portais React):**
  - [x] Em `src/components/ui/modal.tsx`: interceptar e isolar `onClick`, `onPointerDown`, `onMouseDown`, `onKeyDown` em `DialogPrimitive.Content` e `DialogPrimitive.Overlay`, impedindo que cliques no botão "Fechar" (X), no backdrop ou no corpo do modal borbulhem pela árvore do React até componentes contêineres pais (`KpiCard`, botões ou links).
  - [x] Em `src/components/ui/modal-header-bar.tsx`: adicionar `e.stopPropagation()` no botão `DialogPrimitive.Close` (X).
  - [x] Em `src/components/modules/calculation-memory/calculation-memory-modal.tsx`:
    - Blindar a casca do modal e do popover com isolamento estrito de eventos.
    - Eliminar duplicações de renderização de triggers e garantir que o fechamento nunca cause falso clique no elemento de fundo.
  - [x] Em `src/components/modules/calculation-memory/calculation-memory-trigger.tsx`:
    - Adicionar `e.stopPropagation()` e `e.preventDefault()` em `onClick`, `onPointerDown`, `onMouseDown` e `onKeyDown`.
  - [x] Em `src/components/modules/kpi-card.tsx`:
    - Adicionar barreira de eventos (`onClick`, `onPointerDown`, `onMouseDown`, `onKeyDown`) na `div` contêiner da prop `action`, garantindo isolamento total entre o gatilho da memória de cálculo e a ação de clique do corpo do card.
- [x] **Padronização das Estruturas Antigas de Memória de Cálculo / Tooltips (Imagens 1, 2 e 3):**
  - [x] **Imagem 1 (`budgets-metric-toggle.tsx`):**
    - Refatorar o popover ad-hoc antigo "Informações sobre os modos de visualização" ao lado do alternador Minha Parte vs Total Bruto para o padrão canônico `CalculationMemoryModal`.
  - [x] **Imagem 2 (`budgets-limits-summary-card.tsx`):**
    - Substituir o ícone `(i)` antigo com tooltip nativo HTML (`title={metricTooltip}`) por `CalculationMemoryModal` com explicabilidade matemática da ponderação de gastos pessoais vs brutos.
  - [x] **Imagem 3 (`portfolio-indicators-guide-modal.tsx` e `portfolio-kpi-strip.tsx`):**
    - Garantir separação total de intenção do usuário:
      * Clicar no botão `(?)` abre **exclusivamente** a memória de cálculo do indicador específico;
      * Fechar a memória de cálculo **nunca** abre o modal de Modelos de Rentabilidade nem redireciona;
      * Clicar no corpo do card (fora do `?`) continua abrindo o guia metodológico geral (`onOpenExplainModal`).
- [x] **Testes de Regressão e Validação:**
  - [x] Atualizar `portfolio-kpi-strip.test.tsx` garantindo que abrir e fechar os 4 modais de memória não chama `onOpenExplainModal`.
  - [x] Atualizar `overview-kpi-grid.test.tsx` garantindo que abrir e fechar os modais de receitas/despesas/investimentos/resultado não chama `onNavigate`.
  - [x] Executar Quality Gate: `npm run verify`.

### Fase 5 — Inteligência: Insights, Orçamentos, Metas, Projeções e Módulos Colaborativos
- [x] **Auditoria de Fórmulas:**
  - Resolver o bug `AUD-05`: garantir que insights com comparações percentuais informem os dias equivalentes comparados e o burn rate diário (Melhoria 3 e Melhoria 6).
  - Resolver o bug `AUD-04` em `BudgetsLimitsSummaryCard`.
  - Resolver o bug `AUD-06`: corrigir `use-reports-data.ts` para injetar o saldo bancário real e as faturas de cartão no Balanço 360°.
  - Resolver `AUD-07`: criar memórias de acerto para Modo Família e Modo Viagem (Melhoria 8).
- [x] Implementar builders em `builders/insights-breakdown.ts`, `budgets-breakdown.ts`, `family-breakdown.ts`, `trips-breakdown.ts` e `reports-breakdown.ts`:
  - `buildSmartAdvisorBreakdown`: Transações mapeadas que dispararam o alerta, valores exatos e fórmula de aumento percentual ou economia anual.
  - `buildBudgetConsumptionBreakdown`: Gasto acumulado na categoria ÷ Limite planejado × 100, ritmo diário e sobra disponível.
  - `buildEmergencyFundBreakdown`: Reservas líquidas totais ÷ Custo de vida mensal = Meses de autonomia (Runway).
  - `buildFamilySettlementBreakdown`: Gasto de cada membro vs Quota esperada = Saldo a compensar via Pix.
  - `buildTripSettlementBreakdown`: Total desembolsado vs Participação do viajante = Débito/Crédito simplificado.
  - `buildBalanceSheet360Breakdown`: Ativos (Investimentos + Contas Bancárias + Recebíveis) − Passivos (Dívidas + Faturas) = Patrimônio Líquido Real.
- [x] Conectar o `?` nos cards correspondentes.
- [x] Executar Quality Gate: `npm run verify`. ✅ 213 arquivos, 3043 testes — 2026-11-20

### Fase 6 — Reconciliação Transversal, Edge Cases, Acessibilidade e QA Final
- [x] **Bateria de Testes Transversais:**
  - Reconciliar centavo a centavo os valores mestres entre Dashboard, Contas, Cartões, Investimentos, Família e Relatórios.
  - Testar cenários de borda: conta virgem (zeros), saldos negativos, patrimônio líquido negativo, ativos 100% liquidados e faturas com crédito.
- [x] **Auditoria de UX/UI:**
  - Testar em mobile estreito (`320px–375px`) e desktop ultrawide.
  - Validar temas claro, escuro e OLED.
  - Validar acessibilidade: contraste AA, leitores de tela com `aria-label`, foco modal e teclado (`ESC`).
- [x] Quality Gate Final: `npm run verify` ✅ 3043 testes — `npm run build` ✅ — 2026-11-20

---

## 7. Governança e Regras de Entrega

1. **Sem Código de Produção na Fase 0:** Esta etapa gerou exclusivamente a meta-análise, o inventário forense e o plano otimizado.
2. **Quality Gate Local Obrigatório:** Nenhuma fase de implementação subsequente pode ser considerada concluída sem que `npm run verify` passe 100% verde.
3. **Classificação Automática de Escopo:** Este projeto é classificado como **Fluxo Completo (Feature / Plano)** com versionamento semântico `MINOR` ao final de sua execução completa.
