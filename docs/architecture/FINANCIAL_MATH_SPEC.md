# FINANCIAL_MATH_SPEC.md — Especificações de Engenharia e Precisão Matemática

> **Status:** v1.0 — Especificação Canônica de Cálculos Financeiros e Padrões Matemáticos de Domínio.
> **Vinculação:** Complementa `ARCHITECTURE.md` (§src/domain/) e cumpre os requisitos estritos do `AGENTS.md`.
> **Idioma:** pt-BR.

---

## 1. PRINCÍPIOS FUNDAMENTAIS DE ENGENHARIA MATEMÁTICA

Todos os cálculos e regras financeiras do aplicativo residem exclusivamente em `src/domain/` como **funções puras, determinísticas e sem dependência de UI, banco de dados ou estado externo**.

1. **Pureza Algorítmica:** Funções puras que recebem dados tipados e retornam estruturas imutáveis, 100% testáveis isoladamente via Vitest (`*.test.ts` colocalizados).
2. **Moeda em Centavos Inteiros:** Para valores correntes, transações, parcelamentos, faturas e dívidas, o tráfego interno opera prioritariamente em **números inteiros representando centavos** (`number` inteiro).
3. **Padrão Estrito Contra Imprecisão IEEE 754:** Operações em ponto flutuante de precisão dupla em JavaScript acumulam distorções binárias em frações decimais (ex.: `0.1 + 0.2 === 0.30000000000000004`). Toda derivação em reais aplica arredondamento simétrico meio-para-cima (`round2` / `Half-Up`).
4. **Invariantes Invioláveis:**
   - A soma das parcelas calculadas é **sempre idêntica** ao valor original informado (`somaCents(parcelas) === totalOriginalCents`);
   - O saldo aberto de faturas ou dívidas nunca resulta em valor negativo;
   - O total alocado em sugestões de aporte nunca excede o valor informado pelo investidor (`totalAllocated <= aporte`).

---

## 2. ARITMÉTICA MONETÁRIA E PARCELAMENTO (`src/domain/money/`)

### 2.1. Divisão Exata de Parcelas (`parcelar.ts`)

A divisão de um montante total em $N$ parcelas (onde $1 \le N \le 60$) opera em centavos inteiros. O resíduo da divisão euclidiana é distribuído centavo a centavo entre as primeiras parcelas:

$$\text{base} = \lfloor \text{totalCents} / N \rfloor$$
$$\text{resto} = \text{totalCents} \pmod N$$
$$\text{parcela}_i = \begin{cases} \text{base} + 1, & \text{se } i < \text{resto} \\ \text{base}, & \text{se } i \ge \text{resto} \end{cases} \quad (\forall i \in \{0, \dots, N-1\})$$

**Exemplo:** R$ 100,00 (10.000 centavos) divididos em 3 parcelas:
- $\text{base} = 3.333$ centavos (R$ 33,33);
- $\text{resto} = 1$ centavo;
- Parcela 1: R$ 33,34 (3.334 centavos);
- Parcela 2: R$ 33,33 (3.333 centavos);
- Parcela 3: R$ 33,33 (3.333 centavos);
- **Soma:** R$ 100,00 (10.000 centavos) — exatidão absoluta.

### 2.2. Somatórios Ponderados e Rateio de Contas (`weightedCents` / `totals.ts`)

Para relatórios com ponderação de despesas e receitas (`report_weight` de 0 a 1):
- A conversão de base inteira em centavos ocorre **antes** de qualquer multiplicação ponderada:
  $$\text{weightedCents}(\text{baseCents}, \text{weight}) = \text{round}(\text{baseCents} \times \text{weight})$$
- Itens com peso unitário (`weight === 1`) utilizam conversão direta sem multiplicação por floats;
- **Regra de Ouro Contábil:** O valor Bruto Nominal (100%) é sempre a métrica financeira primária de caixa (extratos, boletos, faturas e dívidas); o valor ponderado é estritamente analítico para despesas pessoais e orçamento.

### 2.3. Rateio Equitativo de Despesas e Balanceamento de Sobra (`split-math.ts`)

Na divisão de contas compartilhadas entre $P$ participantes ($P \ge 1$), a divisão exata opera sobre centavos inteiros com duas políticas determinísticas de distribuição do resto euclidiano:

$$\text{base} = \lfloor \text{totalCents} / P \rfloor, \quad \text{resto} = \text{totalCents} \pmod P$$

1. **Política Balanceada (`balanced` — padrão):**
   $$\text{fatia}_i = \begin{cases} \text{base} + 1, & \text{se } i < \text{resto} \\ \text{base}, & \text{se } i \ge \text{resto} \end{cases} \quad (\forall i \in \{0, \dots, P-1\})$$
   Garante que a discrepância máxima entre quaisquer dois participantes não ultrapasse $1$ centavo.
2. **Política Anfitrião (`host`):**
   $$\text{fatia}_0 = \text{base} + \text{resto}, \quad \text{fatia}_i = \text{base} \quad (\forall i \in \{1, \dots, P-1\})$$
   Atribui toda a sobra ao anfitrião (responsável pelo pagamento), garantindo que todos os convidados paguem valores rigorosamente idênticos (essencial para chave Pix e QR Code de valor único).
3. **Invariante Fundamental:** Em qualquer modalidade, $\sum_{i=0}^{P-1} \text{fatia}_i \equiv \text{totalCents}$.

---

## 3. CUSTÓDIA E LEDGER DE ATIVOS (`src/domain/portfolio/`)

### 3.1. Preço Médio Ponderado de Aquisição

O custo médio unitário reflete o total desembolsado acumulado dividido pela quantidade em custódia:

$$\text{Qtd}_{\text{nova}} = \text{Qtd}_{\text{anterior}} + \text{Qtd}_{\text{op}}$$
$$\text{CustoTotal}_{\text{novo}} = \text{CustoTotal}_{\text{anterior}} + \text{Total}_{\text{op}}$$
$$\text{PreçoMédio} = \frac{\text{CustoTotal}_{\text{novo}}}{\text{Qtd}_{\text{nova}}}$$

Custos operacionais (corretagens e emolumentos) declarados no total da operação são incorporados ao custo de aquisição, conforme normativas fiscais da Receita Federal.

### 3.2. Desinvestimento e Zeramento Estrito

A venda parcial reduz o custo total proporcionalmente ao preço médio vigente, preservando o preço médio unitário das cotas restantes:

$$\text{CustoVendido} = \text{PreçoMédio} \times \text{Qtd}_{\text{vendida}}$$
$$\text{CustoTotal}_{\text{remanescente}} = \max(0, \text{CustoTotal} - \text{CustoVendido})$$

**Regra de Zeramento Absoluto:** Quando $\text{Qtd}_{\text{remanescente}} = 0$ (liquidação total da posição), o custo total e o preço médio são obrigatoriamente cravados em $0$, eliminando qualquer resíduo infinitesimal gerado por dízimas em floats IEEE 754:

$$\text{se } \text{Qtd}_{\text{remanescente}} \le 0 \implies \text{Qtd} = 0, \quad \text{CustoTotal} = 0, \quad \text{PreçoMédio} = 0$$

### 3.3. Proventos e Desdobramentos

- **Proventos (Dividendos, JCP, Rendimentos FII):** Acumulam em linha separada e **nunca alteram o custo total ou o preço médio da posição**.
- **Desdobramentos (Splits):** Multiplicam a quantidade de cotas pelo fator $F > 0$, preservando estritamente o custo total:
  $$\text{Qtd}_{\text{nova}} = \text{Qtd} \times F, \quad \text{PreçoMédio}_{\text{novo}} = \frac{\text{CustoTotal}}{\text{Qtd}_{\text{nova}}}$$

### 3.4. Apuração de DARF Mensal e Isenções Fiscais (`tax.ts`)

- **Isenção de R$ 20.000,00:** Restrita **estritamente a ações comuns locais negociadas na B3** (volume bruto de alienação no mês $\le \text{R\$}~20.000,00$).
- **Ativos Internacionais em Dólar (Lei 14.754/2023):** Alíquota geral de 15% anual sobre o ganho de capital líquido em moeda nacional, **sem direito à isenção de R$ 20k da B3**.
- **ETFs Nacionais e BDRs:** Alíquota de 15% sobre o ganho de capital líquido sem faixa de isenção.
- **Fundos Imobiliários (FIIs) e FIAGRO:** Alíquota de 20% sobre o ganho de capital líquido sem faixa de isenção.
- **Compensação de Prejuízos:** Prejuízos acumulados passados só compensam ganhos líquidos de ativos da mesma espécie tributária.

### 3.5. Yield on Cost (YoC) em Moeda Nativa

Para ativos denominados em moeda estrangeira (`currency: "USD"`), o Yield on Cost é calculado estritamente na moeda nativa antes da conversão cambial:

$$\text{YoC}_{\text{USD}} = \left( \frac{\text{ProventosTotais}_{\text{USD}}}{\text{CustoTotal}_{\text{USD}}} \right) \times 100$$

Isso impede que desvalorizações ou valorizações conjunturais da taxa PTAX (USD/BRL) distorçam a eficiência dos dividendos pagos pelas empresas investidas frente ao capital originalmente aportado.
  $$\text{Qtd}_{\text{nova}} = \text{Qtd} \times F, \quad \text{PreçoMédio}_{\text{novo}} = \frac{\text{CustoTotal}}{\text{Qtd}_{\text{nova}}}$$

---

## 4. MOTORES DE RENTABILIDADE

### 4.1. TWRR — Time-Weighted Rate of Return (`twr.ts`)

Padrão CVM/ANBIMA/GIPS para aferir o mérito da estratégia de alocação de forma imune aos aportes e resgates externos:
- Cada subperíodo calcula a variação percentual isolada $r_t$ utilizando o método **Modified Dietz com ponderação exata de fluxos diários**:
  $$W_i = \frac{CD - D_i + 1}{CD}$$
  onde $CD$ é a quantidade total de dias corridos no mês de competência e $D_i$ é o dia em que o aporte/resgate ocorreu ($1 \le D_i \le CD$).
- O capital médio ponderado no mês $t$ é calculado por:
  $$\bar{C}_t = V_{\text{inicial}} + \sum_{i=1}^{n} (F_i \times W_i)$$
- Caso não haja detalhamento dia a dia dos fluxos de caixa, o sistema adota $W = 0.5$ (simplificação padrão de fluxo no meio do mês).
- A rentabilidade do subperíodo é computada como:
  $$r_t = \frac{V_{\text{final}} - V_{\text{inicial}} - F_{\text{líquido}}}{\bar{C}_t}$$
- **Proteção de Colapso de Denominador:** Se resgates atípicos massivos tornarem $\bar{C}_t \le 0$ mesmo com patrimônio remanescente positivo, a rentabilidade do subperíodo é travada em $0.00\%$ para evitar singularidades matemáticas ou inversões de sinal fictícias.
- A taxa acumulada no período decorre do encadeamento geométrico:

$$R_{\text{twr}} = \prod_{t=1}^{T} (1 + r_t) - 1$$

- **Salvaguarda de Perda Total:** O retorno acumulado respeita o piso teórico de $-100.00\%$, prevenindo distorções numéricas decorrentes de aproximações de ponto flutuante.

### 4.2. MWRR / TIR / XIRR (`irr.ts`)

Mede a taxa interna de retorno do capital efetivamente investido pelo bolso, ponderada pelas datas exatas dos fluxos de caixa:
- Resolve a equação de Valor Presente Líquido (VPL):

$$\text{VPL}(r) = \sum_{k=1}^{K} \frac{C_k}{(1 + r)^{\frac{d_k - d_0}{365}}} = 0$$

- **Solver Híbrido:** Executa até 50 iterações de Newton-Raphson com tolerância $\epsilon = 10^{-7}$. Em caso de divergência ou derivada nula, aciona busca intervalar por bisseção no intervalo $[-0.999, 10.0]$.
- **Salvaguardas Regulatórias CVM/ANBIMA e de Formação:**
  1. **Histórico < 30 dias:** Retorna status `insufficient_history` e `isEligible = false`. A taxa simples do período é calculada, mas nenhuma taxa anualizada é gerada.
  2. **Histórico entre 30 e 364 dias ($30 \le \Delta d < 365$):** Em estrito cumprimento à Resolução CVM 19/2021 e às diretrizes ANBIMA, o produto expõe a rentabilidade acumulada simples do período (`periodRatePct`), mantendo `annualizedRatePct = null`. A taxa anualizada matemática bruta (`rawAnnualizedRatePct`) é preservada para fins analíticos internos, impedindo a exibição de taxas projetadas distorcidas por exponenciação curta.
  3. **Histórico $\ge 365$ dias:** Exibe tanto o retorno no período quanto a taxa anualizada ponderada no tempo (`annualizedRatePct` em % a.a.).
  4. **Imunidade ao Turnover:** Reinvestimentos internos (venda de um ativo seguida de compra de outro na mesma corretora) têm fluxo líquido do bolso zero, impactando a carteira apenas pela valorização dos ativos e não como novos aportes externos.

### 4.3. Extrato Mensal da Competência Isolada (`monthly-statement.ts`)

Regra canônica para cálculo do resultado financeiro e rentabilidade periódica estritamente isolada de um determinado mês $M$ (Modified Dietz ANBIMA/GIPS):

$$r_M = \frac{\text{Saldo}_{\text{Fim}} - \text{Saldo}_{\text{Início}} - \text{FluxoLíquido}_M}{\text{Saldo}_{\text{Início}} + \sum_{i} (W_i \cdot \text{Fluxo}_i)}$$

Onde:
- $\text{Saldo}_{\text{Fim}}$ = Saldo de fechamento da carteira no último dia do mês $M$ (ativos valorados + caixa + reserva elegível).
- $\text{Saldo}_{\text{Início}}$ = Saldo de fechamento do mês anterior $M-1$.
- $\text{FluxoLíquido}_M = \text{Aportes Externos}_M - \text{Resgates Externos}_M$ ocorridos no mês $M$.
- $W_i = \frac{\text{DiasNoMês} - \text{DiaDoFluxo} + 1}{\text{DiasNoMês}}$ = Ponderação diária do fluxo pelo tempo de permanência na competência.

#### Equações Auxiliares & P&L Líquido do Mês:
- **Resultado Líquido Financeiro (P&L):**
  $$\text{P\&L}_M = \text{Saldo}_{\text{Fim}} - \text{Saldo}_{\text{Início}} - \text{FluxoLíquido}_M$$
- **Proventos da Competência:** Soma dos proventos auferidos exclusivamente no mês de competência $M$.

#### Tratamento de Casos de Borda e Singularidades:
1. **Marco Zero / Mês Inaugural ($\text{Saldo}_{\text{Início}} = 0$):** O denominador adota o capital médio ponderado dos fluxos de entrada daquele mês ($\sum W_i \cdot \text{Fluxo}_i$).
2. **Salvaguarda de Colapso de Denominador:** Se resgates massivos reduzirem o denominador para valor inferior a $\text{R\$} 10,00$, o motor neutraliza a taxa percentual (`monthRatePct = null`) e prioriza a apresentação do P&L financeiro em reais, prevenindo taxas assintóticas absurdas.
3. **Mês Corrente em Andamento (MTD Parcial):** O extrato considera os proventos efetivamente creditados e os fluxos realizados até a data corrente.

---

## 5. REBALANCEAMENTO INTELIGENTE DE APORTES (`aporte.ts`)

O motor de sugestão de aportes distribui a verba nova informada sem gerar ordens de venda (aporte passivo inteligente):

1. **Hierarquia Tripla:**
   - **Nível Macro (Classe):** Orçamento alocado proporcionalmente ao déficit relativo $(\text{Meta} - \text{Atual}) / \text{Meta}$;
   - **Nível Meso (Setor):** Verba da classe distribuída entre os setores com maior defasagem interna;
   - **Nível Micro (Ativo):** Alocação individual respeitando o preço da cota e frações permitidas.
2. **Precisão Fracionária:**
   - Ativos B3 (Ações e FIIs): cotas inteiras ($\ge 1$);
   - Ativos Internacionais (USD): frações de até 4 casas decimais;
   - Criptoativos: frações de até 8 casas decimais.
3. **Invariantes do Aporte:**
   - $\text{TotalAlocado} \le \text{AporteInformado}$;
   - $\text{Leftover} = \max(0, \text{round2}(\text{AporteInformado} - \text{TotalAlocado}))$;
   - Ativos sem meta ou com valor atual superior à meta não recebem aporte.

---

## 6. FATURAS, CARTÕES E DÍVIDAS (`src/domain/cards/` e `src/domain/debts/`)

### 6.1. Competência e Saldo de Fatura com Créditos Acumulados

- O saldo aberto por competência considera pagamentos, estornos e créditos remanescentes do mês anterior:
  $$\text{SaldoAbertoCents} = \max(0, \text{PrevistoCents} - \text{PagoCents} - \text{EstornoCents} - \text{CréditoAnteriorCents})$$
- **Crédito Transferível de Fatura (`carryoverCredit`):** Pagamentos superiores ao saldo previsto geram crédito acumulado transferível para a competência seguinte:
  $$\text{NovoCréditoCents} = \max(0, \text{PagoCents} + \text{EstornoCents} + \text{CréditoAnteriorCents} - \text{PrevistoCents})$$
- Pagamentos e estornos nunca geram saldo aberto negativo em qualquer competência.

### 6.2. Juros de Mora e Multa Contratual

Para dívidas em atraso com $D$ dias corridos decorridos após o vencimento:
- Multa contratual padrão CDC (2%):
  $$\text{MultaCents} = \text{round}\left( \frac{\text{PrincipalCents} \times \text{TaxaMulta}}{100} \right)$$
- Juros de mora pro rata die simples (base mensal de 30 dias):
  $$\text{JurosCents} = \text{round}\left( \text{PrincipalCents} \times \frac{\text{TaxaMensal}}{30 \times 100} \times D \right)$$
- Quitação total:
  $$\text{TotalQuitaçãoCents} = \max(0, \text{PrincipalCents} + \text{MultaCents} + \text{JurosCents} - \text{DescontoCents})$$
- **Tolerância Zero no Dia do Vencimento:** Quando $\text{DataPagamento} \le \text{DataVencimento}$, juros e multa são estritamente nulos ($D = 0$).

### 6.3. Amortização Extraordinária e Sistemas SAC/Price (`loans/`)

- **Amortização com Desconto a Valor Presente (CDC art. 52 § 2º):** O desconto proporcional de juros futuros aplica-se estritamente às parcelas vincendas ($monthsAhead \ge 1$):
  $$\text{ValorPresente} = \frac{\text{ValorNominalParcela}}{(1 + i)^{monthsAhead}}$$
  Parcelas com vencimento no mesmo mês de referência da amortização ($monthsAhead = 0$) não recebem desconto indevido de mês cheio.
- **Zeramento Exato na Parcela Final $N$:** As tabelas SAC e Price garantem que o saldo devedor remanescente na última parcela seja rigorosamente cravado em zero, absorvendo resíduos de dízimas na amortização final.

---

## 7. BALANÇO CONSOLIDADO E DRE PESSOAL (`src/domain/reports/`)

O fechamento de balanço e demonstração de resultados aplica a sanitização determinística `round2` em todas as métricas:

### 7.1. Ativos Totais e Segregação de Passivos

$$\text{AtivosTotais} = \text{round2}(\text{InvestimentosCustódia} + \text{CaixaLiquidez} + \text{ContasAReceber})$$
$$\text{PassivosTotais} = \text{round2}(\text{DívidasPayable} + \text{FaturasCartãoAberto})$$
$$\text{PatrimônioLíquidoReal} = \text{round2}(\text{AtivosTotais} - \text{PassivosTotais})$$
$$\text{GrauAlavancagemPct} = \text{round2}\left( \frac{\text{PassivosTotais}}{\text{AtivosTotais}} \times 100 \right)$$

- **Passivo a Descoberto:** Quando $\text{PassivosTotais} > \text{AtivosTotais}$, o Patrimônio Líquido assume valor negativo e a alavancagem supera 100% de forma matematicamente congruente, sem mascaramentos.
- **Proteção Numérica:** Valores não-finitos (`NaN`, `Infinity`, números negativos acidentais) são normalizados com segurança (`Math.max(0, ...)` e `Number.isFinite`), blindando os relatórios contra corrupção matemática.

### 7.2. Demonstração do Resultado Pessoal (DRE)

$$\text{PoupançaOperacional} = \text{round2}(\text{ReceitaBruta} - \text{DespesasOperacionais})$$
$$\text{TaxaPoupançaPct} = \text{round2}\left( \frac{\text{PoupançaOperacional}}{\text{ReceitaBruta}} \times 100 \right)$$
$$\text{VariaçãoFinalCaixa} = \text{round2}(\text{PoupançaOperacional} - \text{AportesInvestimentos})$$

**Neutralidade Contábil:** Transferências entre contas correntes do próprio usuário e pagamentos de fatura de cartão de crédito não são contabilizados como novas despesas na DRE operacional (o gasto no cartão já foi registrado na competência de compra), impedindo duplicação no fluxo de caixa.

---

## 8. MOTOR CANÔNICO DE INVESTIMENTOS, FX ENGINE E INVARIANTES MATEMÁTICOS DE RELATÓRIO (§Fase 0 a Fase 6)

### 8.1. Fonte Única da Verdade (`UnifiedPortfolioReportPayload`)
Toda a camada visual (Dashboard, Custódia, Metas, Raios-X e Extratos) e exportadores institucionais em PDF consomem um contrato de dados imutável único:
- **Conservação de Patrimônio:** $P_{\text{total}} = V_{\text{ativos}} + V_{\text{caixa}}$
- **Conservação de Custo Aplicado:** $C_{\text{total}} = C_{\text{ativos}} + V_{\text{caixa}}$
- **Ganho de Capital Aberto:** $\Delta V_{\text{aberto}} = P_{\text{total}} - C_{\text{total}} \equiv V_{\text{ativos}} - C_{\text{ativos}}$
- **Resultado Contábil Aberto:** $\Delta V_{\text{aberto}} + \text{Proventos}_{\text{ativos\_vivos}}$
- **Resultado Econômico Total:** $\Delta V_{\text{aberto}} + \text{GanhoRealizado}_{\text{encerrados}} + \text{ProventosTotais}_{\text{históricos}}$

### 8.2. Decomposição Cambial Multi-Moeda (FX Engine)
Para ativos denominados em moeda estrangeira ($USD$), a valoração decompõe o retorno em três componentes aditivos:
1. **Ganho do Ativo em Moeda Estrangeira:** $\Delta V_{\text{USD}} = (P_{\text{atual}}^{\text{USD}} - \text{PM}^{\text{USD}}) \times Q \times \text{PTAX}_{\text{compra}}$
2. **Efeito Cambial em Moeda Nacional:** $\Delta V_{\text{FX}} = (\text{PTAX}_{\text{atual}} - \text{PTAX}_{\text{compra}}) \times \text{PM}^{\text{USD}} \times Q$
3. **Produto Cruzado:** $\Delta V_{\text{cross}} = (P_{\text{atual}}^{\text{USD}} - \text{PM}^{\text{USD}}) \times (\text{PTAX}_{\text{atual}} - \text{PTAX}_{\text{compra}}) \times Q$
- **Total P&L em BRL:** $\text{P\&L}_{\text{BRL}} = \Delta V_{\text{USD}} + \Delta V_{\text{FX}} + \Delta V_{\text{cross}}$
- **Padronização de Arredondamento:** Arredondamento simétrico meio-para-cima com 1 casa decimal para variações percentuais em relatórios (ex.: BITB em -10,9%).

### 8.3. Saneamento de Metas Legadas e Índice de Equilíbrio Geral ($IEG$)
- **Saneamento Preventivo:** Classes legadas órfãs sem saldo na carteira são expurgadas quando a soma das metas ultrapassa 100%, garantindo $\sum w_c^{\text{meta}} = 100,00\%$.
- **Invariante de Gap Financeiro:** $\sum \text{Gap}_c \equiv \text{R\$ } 0,00$
- **Fórmula Canônica do IEG:**
  $$IEG = 100\% - \frac{1}{2}\sum_{c} |w_c - w_c^{\text{meta}}|$$

### 8.4. Validador Pré-Emissão (*Pre-Flight Invariant Validator*)
Antes de emitir relatórios ou persistir snapshots de fechamento, o validador audita as asserções fundamentais:
1. $V_{\text{ativos}} + V_{\text{caixa}} == P_{\text{total}}$
2. $C_{\text{ativos}} + V_{\text{caixa}} == C_{\text{total}}$
3. $P_{\text{total}} - C_{\text{total}} == V_{\text{ativos}} - C_{\text{ativos}} == \Delta V_{\text{aberto}}$
4. $\sum V_i == V_{\text{ativos}}$
5. $\text{round}(100 \times (1 + \text{TWR}_{\text{acum}}), 2) == \text{Cota}_T$
6. Continuidade Cronológica estrita (*Calendar Spine* sem meses saltados)
7. Encadeamento de cotas: $|\text{Cota}_t - \text{Cota}_{t-1} \times (1 + \text{TWR}_t)| \le 0,05$
8. Reconciliação e monotonicidade de proventos: $\sum \text{ProventosMês}_t == \text{ProventosAcum}_T$ e $\text{ProventosAcum}_t \ge \text{ProventosAcum}_{t-1}$
9. $\sum w_c^{\text{meta}} == 100,00\%$ e $\sum \text{Gap}_c == \text{R\$ } 0,00$
10. Reconciliação dos subtotais dos Raios-X com as classes de custódia
11. Contagem dinâmica de segmentos listados e janela anual de risco de 12 meses fechados
12. Sanidade de escala decimal de benchmarks (fator 100x em períodos $\ge 12$ meses)
13. Sanidade de TWR em meses sem movimentação / *carry-forward*: $|P_t - P_{t-1}| < 0,01$, $|C_t - C_{t-1}| < 0,01 \implies \text{TWR}_t \ge 0$
14. Invariante contábil de fluxo externo: $|F_t| > 0,01 \implies F_t = \Delta C_{\text{total}, t} + \Delta \text{PnL}^{\text{real}}_t$ e proíbe "0 operações / sem movimentações"

---

## 9. MOTOR HÍBRIDO (MARCO ZERO VS. CADASTRO RETROATIVO), SANIDADE DE CARRY-FORWARD E BENCHMARKS REAIS (§Fase 0-v2 a Fase 6-v2)

### 9.1. Invariantes de Snapshots Híbridos e Carry-Forward (Asserção 13)
- Quando uma competência mensal não possui movimentações ativas ou resulta de interpolação (*carry-forward*), isto é, $|P_t - P_{t-1}| < 0,01$, $|C_t - C_{t-1}| < 0,01$ e $\text{Proventos}_t \ge 0$, o $\text{TWR}_t$ é estritamente $0,00\%$ (nunca negativo). A cota teórica é preservada: $\text{Cota}_t = \text{Cota}_{t-1}$.
- Na transição entre o modo `retroativo_manual` e o modo `calculado_ledger`, a cota é herdada com continuidade contábil sem recalcular nem sobrescrever o passado cadastrado pelo usuário.
- **Segregação de Proventos:** Saldo inicial retroativo sem data mensal é armazenado separadamente (`opening_dividends_balance`) e não contamina o retorno de competências mensais passadas.

### 9.2. Identidade Fundamental de Fluxo de Caixa Externo (Asserção 14)
- Em competências operacionais (incluindo MTD), o Aporte Líquido Injetado ($F_t$) obedece estritamente à identidade:
  $$F_t = \Delta C_{\text{total}, t} + \Delta \text{PnL}^{\text{real}}_t$$
  onde $C_{\text{total}, t} = C_{\text{ativos}, t} + V_{\text{caixa}, t}$. Se não houve alienações no período ($\Delta \text{PnL}^{\text{real}}_t = 0$), então $F_t \equiv \Delta C_{\text{total}, t}$.
- O rótulo "Sem movimentações" ou "0 operações" é proibido sempre que $|F_t| > 0,01$. Variações na Reserva de Caixa contam como movimentação financeira externa.

### 9.3. Motor Cambial Híbrido (FX Engine v2)
- Ativos com histórico transacional congelam o custo médio em BRL na data da compra: $C_i^{\text{BRL}} = \sum (q_k \cdot p_k^{\text{USD}} + \tau_k^{\text{USD}}) \times FX_k^{\text{compra}}$.
- Posições cadastradas retroativamente sem data de compra suportam o campo `cambio_medio_aquisicao`. Na sua ausência, o sistema aplica transparência metodológica explicitando em nota de rodapé a estimativa pela PTAX atual.

### 9.4. Fonte Única Canônica de Indexador de Renda Fixa (`resolveFixedIncomeIndexer`)
- Títulos são classificados de forma canônica e determinística em `FixedIncomeIndexer { POS_FIXADO_CDI_SELIC, PREFIXADO, INFLACAO_IPCA, HIBRIDO_OUTROS }` com prioridade para taxa contratual estruturada (ex: `13,58% a.a.` $\implies$ Prefixado). Todos os relatórios consomem essa única fonte da verdade.

### 9.5. Benchmarks Reais por Produtório Geométrico & Janela de Risco 12M
- Séries de CDI (SGS 4391), IPCA (SGS 433), Poupança (SGS 195) e Ibovespa (^BVSP) são encadeadas geometricamente:
  $$R_{\text{Bench}}(t_0, t_1) = \left[ \prod_{t=t_0}^{t_1} (1 + b_t) \right] - 1$$
- Métricas anuais de risco (Sharpe, Volatilidade, Consistência e Drawdown) operam estritamente sobre $N = 12$ meses fechados homogêneos, desacopladas da série visual (que exibe MTD parcial com asterisco).

---

## 10. CERTIFICAÇÃO FINAL DE PRODUÇÃO DO MOTOR DE INVESTIMENTOS (§v3 — Auditoria Forense BR-20261119-6445)

### 10.1. Sincronização Estrita de Fluxo Líquido (Gate v3.1)
- O fluxo financeiro líquido no mês corrente é derivado de fonte única da verdade (`computePeriodInvestmentFlow`), alimentado prioritariamente pelo demonstrativo homogêneo da competência (`monthlyStatement`) e reconciliado com a espinha dorsal de snapshots (`reconciledNetFlowBRL = \Delta C_{\text{total}}`).
- Fita de movimentação do Dossiê Executivo, bloco de movimentações do Relatório Executivo e coluna de aporte do Extrato Analítico exibem rigorosamente o mesmo valor consolidado (R$ 100,38 no caso auditado).

### 10.2. Continuidade da Coluna Retorno Total no Extrato Analítico (Gate v3.2)
- Quando o saldo inicial retroativo de proventos está segregado (`segregateOpeningDividends: true`), a coluna `Retorno Total` da linha corrente (MTD) aplica a fórmula contínua do período:
  $$\text{RetornoTotal}_{\text{MTD}} = \frac{\Delta V_{\text{aberto, MTD}} + \text{Proventos}_{\text{MTD}}}{C_{\text{total, MTD}}}$$
  calculando $-1,4\%$ na mesma base temporal das competências anteriores (Out/24 a Out/26), eliminando o salto espúrio para $+8,7\%$. A métrica histórica all-time da custódia aberta é preservada no contrato em `allTimeTotalReturnPct`.

### 10.3. Consistência Estritamente Positiva ($r > 0$) e Tratamento de Gaps de Snapshot (Gate v3.3)
- **Predicado Estritamente Positivo:** A apuração de consistência mensal adota a definição matemática estrita $r_t > 0,0001$. Meses com variação nula ($r_t = 0,00\%$) são contabilizados como neutros, corrigindo a proporção de meses positivos para $5/12$ ($41,7\%$) quando houver mês inalterado como Ago/2026.
- **Tratamento de Meses Sem Dados (`sem_snapshot`):** Competências sem dados cadastrados recebem a classificação formal de origem `sem_snapshot`. O motor não inventa nem interpola taxas sintéticas fictícias, preservando o histórico auditável com badge `sem snapshot` e isolando o cálculo de risco de contaminações estocásticas.
- **Harmonização do Sharpe com CDI 12M:** A taxa livre de risco utilizada no cálculo do Índice de Sharpe converge com o CDI anualizado encadeado da janela fechada de 12 meses observada.

### 10.4. Transparência Cambial de Fallback PTAX (Gate v3.4)
- Em ativos internacionais onde a taxa PTAX oficial do BCB não puder ser consultada online ou coincidir com o valor base estimado do sistema (`FALLBACK_USD_RATE = 5,2500`), o rodapé técnico explicita transparentemente:
  `"Conversão USD/BRL pelo câmbio de referência estimado (fallback): R$ 5,2500"`,
  reservando a denominação `"PTAX Oficial BCB"` exclusivamente para boletins diários homologados.

### 10.5. Reconciliação do P&L Total e Duplo Custo da Narrativa (Gate v3.5)
- **Card 4 (Resultado Histórico / P&L Total):** Consolida ganho não realizado da custódia viva, a totalidade de proventos recebidos (ativos e encerrados) e o resultado realizado apurado em vendas passadas:
  $$\text{P&L}_{\text{Econômico Total}} = \text{P&L}_{\text{Não Realizado}} + \text{Proventos}_{\text{Total}} + \text{P&L}_{\text{Realizado Encerrados}}$$
- **Duplo Denominador na Narrativa:** A narrativa executiva explicita tanto o custo em ativos aplicados ($\text{R\$ } 17.319,94$) quanto o custo total com reserva de caixa ($\text{R\$ } 17.609,39$), justificando matematicamente o Retorno Contábil de $+8,7\%$ sobre ativos e $+8,6\%$ sobre o capital consolidado.

### 10.6. Polimento Tipográfico e Impressão sem Cabeçalhos Órfãos (Gate v3.6)
- **Typo Sanado:** Título do Raio-X de Ações Brasil corrigido para `"Raio-X de Ações Brasil (Ciclicidade & Porte)"`.
- **Rótulo Canônico Selic:** Títulos do Tesouro indexados à Selic sem taxa adicional exibem `"SELIC"` (ou `"Selic + X,XX% a.a."` quando houver taxa contratada), eliminando o equívoco de `"100% CDI"`.
- **Proteção Contra Cabeçalhos Órfãos:** Blocos de tabela de custódia e cabeçalhos de classe (`AÇÕES`, `RENDA FIXA`) recebem `print:[break-after:avoid] print:[break-inside:avoid]`, impedindo que fiquem isolados no rodapé de páginas A4.
- **Sinal Negativo Explícito:** Formatação com sinal de menos ASCII explícito antes do símbolo monetário (`-R$ 249,42 (-1,4%)`).
- **Respiro no Subtotal Internacional:** Ajuste de larguras e paddings (`px-2`, `w-[13%]`) eliminando qualquer concorrência visual entre Total e Variação de Cota.

## 11. CERTIFICAÇÃO FORENSE DE EDGE CASES & MOTOR DE PRODUÇÃO (§v4 — Auditoria BR-20261119-6445)

### 11.1. Baixa Proporcional de Custo em Resgate Parcial de Renda Fixa (Gate v4.1)
- **Causa Raiz Sanada:** O resgate parcial de títulos de renda fixa com preço unitário unificado ($Q = 1$) abatia o valor resgatado diretamente sobre o custo inicial na proporção 1:1, desvinculando o custo baixado da valorização acumulada e gerando prejuízos fictícios em resgates subsequentes.
- **Fórmula de Abatimento Proporcional Canônica (Padrão Receita Federal / Tesouro Direto):**
  $$C_{\text{baixado}} = C_{\text{pré}} \times \min\left(1, \frac{V_{\text{resgate}}}{V_{\text{pré}}}\right)$$
  $$C_{\text{pós}} = C_{\text{pré}} - C_{\text{baixado}}$$
  $$\text{Lucro Realizado} = V_{\text{resgate}} - C_{\text{baixado}}$$
  $$\text{Rentabilidade Contábil Pós-Resgate} = \frac{V_{\text{pós}} - C_{\text{pós}}}{C_{\text{pós}}} = \frac{V_{\text{pré}} - C_{\text{pré}}}{C_{\text{pré}}}$$
  Garante preservação estrita da rentabilidade histórica do título e elimina prejuízos espúrios no Extrato de Resgates do Período.

### 11.2. Motor Cambial Multi-Moeda, PTAX Dinâmica e Edição Retroativa (Gate v4.2)
- **Captura da Taxa Cambial no Lançamento:** Formulários de compra e venda (`OrderBuySellFields`) aceitam a taxa de câmbio efetiva da operação (`fx_rate_brl`), com preenchimento automático inteligente via PTAX histórica oficial do Banco Central do Brasil para a data selecionada (`fetchPtaxForDate(dateISO)`).
- **Edição Retroativa de Posições:** Permite ao usuário corrigir o câmbio médio de aquisição histórico (`fx_rate_at_purchase`) e o custo total convertido em reais (`total_cost_brl`) diretamente na ficha de edição do ativo, recalculando o preço médio ponderado em BRL.
- **Extração Dinâmica de Cotação Cambial:** A taxa USDBRL é resolvida prioritariamente a partir do feed de cotações em tempo real (`usdRateFromPrices`), eliminando dependência estática do fallback `FALLBACK_USD_RATE = 5,2500` quando cotações de mercado estiverem ativas.

### 11.3. Blindagem Internacional: Denominador BRL e Segregação IVVB11 (Gate v4.3)
- **Salvaguarda Contra Custo em Moeda Cruzada:** Se uma posição internacional tiver custo em moeda nativa ($C_{\text{USD}} > 0$) e seu custo em BRL gravado for inferior a $2,5 \times C_{\text{USD}}$, o motor canônico identifica a contaminação de moeda e recalcula automaticamente o denominador pela taxa cambial vigente ($C_{\text{BRL}} = C_{\text{USD}} \times \text{PTAX}$), erradicando retornos totais matematicamente anômalos (+786,6% em INDA ou +84,1% em SPHQ).
- **Segregação de Veículo Internacional:** Ativos denominados em BRL e negociados na B3 (como `IVVB11`, `SPXI11`, `WRLD11` e BDRs terminados em 34/35/39) são classificados rigorosamente como `ETF B3 / BDR (Custódia BRL)` ($22,5\%$), reservando `Moeda Forte Direta (USD)` ($77,5\%$) para ativos sob custódia internacional real em moeda estrangeira.
- **Formatação de Tabela A4:** Ajuste de larguras de coluna no Extrato de Custódia por Classe (`Total (R$)`: 16%, `Var. Cota`: 14%, `Ret. Total`: 13%) com `whitespace-nowrap`, prevenindo sobreposição e colisão visual para patrimônios de 5 ou mais dígitos.

### 11.4. Unificação de Posições Vivas e Sinal de Fluxo (Gate v4.4)
- **Filtro Canônico de Custódia Ativa (`getActiveCustodyPositions`):** Filtra deterministicamente posições com $\text{Qtd} > 0 \land \text{Valor} > \text{R\$ } 0,001 \land \neg \text{isCash}$, harmonizando a contagem de ativos em exatamente 62 investimentos ativos e 20 títulos de Renda Fixa em todos os relatórios, excluindo títulos vencidos e zerados (`CDB-FACTA`, `CDB-RODOBENS`).
- **Sinal Negativo Robusto em Headless Print:** Substituição do caractere Unicode `\u2212` por `-` ASCII no primitivo `<MoneyText />` e aplicação de `sign="explicit"` no banner de Movimentação do Período, assegurando a visibilidade perene do sinal negativo em fluxos retirados (`-R$ 1.931,08`).

### 11.5. Classificador Soberano e Higienização de Rótulos de Taxa (Gate v4.5)
- **Prevalência Soberana de Indexador:** A heurística de resolução de indexador prioriza palavras-chave expressas do ticker (`IPCA`, `NTNB`, `SELIC`, `LFT`) antes de qualquer fallback de formulário (`rate_type: "pre"`), garantindo que títulos como `TESOURO-IPCA-32` sejam classificados indefectivelmente como `Inflação (IPCA+)`.
- **Eliminação de Ruído de Taxa Zero:** Títulos de renda fixa com taxa não cadastrada (`rate_value <= 0`) têm a exibição de `"0% a.a."` e `"IPCA + 0% a.a."` suprimida, exibindo rótulos limpos (`"Prefixado"`, `"IPCA+"`, `"SELIC"`, `"CDI"`).
- **Alerta Não-Bloqueante de Queda de Custo Retroativo:** Detecção automática de redução superior a 50% de custo aplicado de uma competência para a seguinte sem redução patrimonial correspondente, alertando o usuário de forma não-bloqueante na tela de fechamento.

## 12. FECHAMENTO DEFINITIVO DE CORE BUGS & CERTIFICAÇÃO DE PRODUÇÃO (§v5 — Auditoria BR-20261119-6445)

### 12.1. Invariância Cambial do Custo e Isolamento Estrito do Fluxo Externo (Gate v5.1)
- **Congelamento do Custo Histórico em BRL:** O custo de ativos internacionais em BRL ($C_i^{\text{BRL}}$) é fixado deterministicamente no momento de aquisição através de `fx_rate_at_purchase` ou pelo custo do lote registrado, nunca flutuando com a cotação PTAX D-0 de fechamento diário. Toda a valorização do dólar impacta exclusivamente o valor de mercado BRL ($V_t^{\text{BRL}}$) e o ganho econômico/TWR.
- **Isolamento de Fluxo Externo ($F_t$) em Competências Operacionais:** Em meses operacionais (`calculado_ledger` e MTD), o aporte líquido injetado deriva estritamente dos eventos transacionais reais do ledger:
  $$F_t = \sum \text{Compras Externas}_t - \sum \text{Vendas Externas}_t + \sum \text{Depósitos Caixa}_t - \sum \text{Saques Caixa}_t$$
  sendo proibido substituir $F_t$ por $\Delta C_{\text{total}}$ bruto em competências com ledger ativo (eliminando vazamentos de reavaliação cambial).

### 12.2. Fonte Única de Resultado Realizado e Tabela Regressiva de IR (Gate v5.2)
- **SSOT de P&L Realizado:** O resultado realizado exibido no resumo da página 1 do Dossiê, no Card 4 (P&L Econômico) e na tabela da página 5 decorre do mesmo motor de baixa proporcional de custos.
- **Persistência de Custo Baixado:** A mutação de resgate parcial de Renda Fixa persiste o custo residual no banco (`total_cost_brl: remainingCost`), sincronizando a base de cálculo contábil.
- **Tabela Regressiva de IR Auditável:** O cálculo de dias decorridos para enquadramento nas alíquotas regressivas ($22,5\%$ a $15,0\%$) utiliza a data de aplicação original do título (`initial_investment_date ?? base_date ?? created_at`) com salvaguarda de maturidade ($> 720$ dias para retornos acumulados $\ge 25\%$).

### 12.3. Sanidade Cambial em Lotes USD e Guardrail Defensivo de SPHQ (Gate v5.3)
- **Salvaguarda de Saneamento de Custo USD:** Ativos em moeda estrangeira que apresentem razão $\text{Custo}_{\text{BRL}} / \text{Custo}_{\text{Nativo}} < 3,5$ têm o custo em reais curado automaticamente pela taxa cambial histórica/de referência, eliminando retornos anômalos espúrios (como $+85,5\%$ em SPHQ).
- **Validação de Entrada:** Formulários bloqueiam o cadastro ou atualização de ordens em moedas estrangeiras com taxa de câmbio $\le 1,0$.

### 12.4. Unicidade de Classificador e Polimento pt-BR (Gate v5.4)
- **Classificador Canônico:** `TESOURO-IPCA-32` utiliza `resolveFixedIncomeIndexer` retornando `IPCA+` em todos os relatórios executivos e dossiês.
- **Formatação Decimal pt-BR:** Garantia de 100% de conformidade com vírgula decimal pt-BR e sinais explícitos nos relatórios, demonstrativos e tabelas de resgate.

## 13. RESTAURAÇÃO DE SSOT, IR REGRESSIVO REAL & CERTIFICAÇÃO FINAL DE PRODUÇÃO (§v6 — ID BR-20261119-6445)

### 13.1. SSOT de Competência Operacional em Tempo Real & Desacoplamento Cambial Total (Gate v6.1)
- **Harmonização dos Três Relatórios:** Eliminação da injeção sintética de `diff` provocada por $\Delta C$ de ativos em USD no hook `usePortfolioMonthlyPosition`. A tupla canônica de competência ativa ($F_t$, $\text{P\&L}$, $\text{TWR}$) é unificada via `curMonthSeriesPoint`:
  $$F_t = \text{curMonthSeriesPoint.netContributionBRL}$$
  $$\text{TWR}_t = \text{curMonthSeriesPoint.twrMonthPct}$$
  garantindo que o Extrato Mensal (+0,34%), o Dossiê Anual (+0,3%) e o Relatório Executivo reflitam rigorosamente a mesma realidade econômica sem dispersão.
- **Congelamento do Custo de Referência Cambial:** No motor `evaluatePortfolioCanonicalState`, a base de custo de ativos estrangeiros prioriza `cost_fx_rate_snapshot` e `average_cost_brl` antes de qualquer fallback de PTAX D-0 em tempo real, eliminando oscilações espúrias na apuração de capital alocado.

### 13.2. IR Regressivo Fiel com Histórico Real de Lotes & Guardrail Econômico (Gate v6.2)
- **Resolução Cronológica de Aplicação:** A apuração dos dias decorridos para enquadramento na tabela regressiva de IR (art. 1º da Lei nº 11.033/2004) busca a data da primeira ordem de compra (`earliestBuyTx.date`) do ativo no livro-razão de transações (`portfolio_transactions`).
- **Salvaguarda Econômica de Maturidade:** Caso a data do ativo seja recente por ter sido cadastrado via migração de custódia (fallback de `created_at`), mas o ganho econômico acumulado em relação ao custo aplicado for substancial ($\text{retRatio} \ge 25\%$), o motor aplica a salvaguarda econômica atribuindo maturidade de longo prazo ($> 720$ dias $\to 15,0\%$), eliminando a retenção indevida da alíquota máxima de $22,5\%$ sobre títulos soberanos antigos (`TESOURO-SELIC-31`).
- **Segregação Semântica de Realizados:** O subtítulo da tabela de resgates da página 5 do Dossiê adota rotulagem explícita `Competência: <Mês/Ano> (Resgates do Mês)`, eliminando ambiguidade com o resultado total acumulado de todos os ativos da carteira exibido na página 1.

### 13.3. Sanidade Tipográfica e Formatação Decimal pt-BR (Gate v6.3 & Gate v6.4)
- **Eliminação de Colisões de Colunas:** A tabela de classes patrimoniais e a tabela de resgates em PDF adotam `table-fixed` com larguras canônicas dedicadas. Na tabela de resgates, a coluna 4 dedica-se exclusivamente ao `Valor Resgatado` e a coluna 5 ao `Resultado Líquido` em duas linhas (retorno líquido na linha 1 e IR retido na linha 2), eliminando sobreposição visual e quebras de linha em impressão.
- **Conformidade Estrita pt-BR:** As funções de formatação `formatPercent` e `formatSignedPct` executam substituição determinística `.replace(".", ",")`, assegurando a vírgula como separador decimal em todos os ambientes e evitando resíduos como `+1.00%`.

## 14. LEDGER IMUTÁVEL DE RESGATES, IR REGRESSIVO REAL & CERTIFICAÇÃO FINAL DE PRODUÇÃO (§v7 — ID BR-20261119-6445)

### 14.1. Segregação Estrutural de Custo e Imutabilidade Sequencial de Resgates (Gate v7.1)
- **Desambiguação de Custo Pré-Operação vs. Custo Proporcional Baixado:** Nos fluxos de liquidação parcial de Renda Fixa (`quick-transaction-submit.ts`, `wizard-submit-actions.ts`), a base de custo total da custódia anterior ao resgate é transmitida como `preRedemptionHoldingCost`, enquanto a parcela de custo a ser amortizada é transmitida como `appliedCostBasis`:
  $$C_{\text{resgatado}} = C_{\text{pré}} \times \min\left(1, \frac{V_{\text{resgate}}}{V_{\text{pré}}}\right)$$
  $$C_{\text{remanescente}} = \max(0, C_{\text{pré}} - C_{\text{resgatado}})$$
- **Persistência de Metadados e Gravação no Ledger:** O custo resgatado $C_{\text{resgatado}}$ é gravado de forma imutável na coluna `total_cost_brl` do registro da transação de venda (`portfolio_transactions`). Simultaneamente, o payload enriquecido `[FI_SELL_SNAPSHOT] appliedCost=...;realizedProfit=...;taxAmount=...;taxRatePct=...;netCredit=...;` é registrado no campo `notes`.
- **Prevenção do P&L Zerado no 3º Resgate:** Elimina-se a sobreposição onde $C_{\text{resgatado}}$ era equivocadamente preenchido com o valor bruto da venda ($V_{\text{resgate}}$), garantindo que sucessivos resgates parciais (ex.: 3º resgate de R$ 2.023,29 em `TESOURO-SELIC-31`) apurem o lucro bruto (+R$ 273,87), imposto retido (R$ 55,11) e crédito líquido (+R$ 218,76) com precisão centesimal.
- **Imutabilidade Histórica no Replay:** Ao reconstruir os resgates do período em `period-redemptions.ts` e `canonical-normalizer.ts`, os dados de resgates anteriores são preservados a partir do snapshot gravado na transação, impedindo que a redução contínua do custo do ativo deturpe retrospectivamente as operações 1 e 2.

### 14.2. IR Regressivo Real e Salvaguarda Econômica (Gate v7.2)
- **Cálculo Fiel de Dias Corridos e Alíquota de 15,0%:** O cálculo de dias úteis/corridos considera a data da ordem original de aquisição. Para ativos em modo de migração com rendimento acumulado $\ge 25\%$, o motor assegura a incidência da alíquota definitiva de 15,0% ($> 720$ dias), prevenindo a regressão indevida para 22,5%.
- **Transparência de Realizados no Dossiê:** A Pág. 1 do Dossiê explicita "resultado realizado de posições encerradas e resgates", garantindo coerência matemática e semântica com a discriminação dos resgates do mês na Pág. 5.

### 14.3. Rebalanceamento de Tabela Internacional e Sincronização de Metas (Gate v7.3)
- **Eliminação de Colisão Visual no Subtotal USD:** A tabela de classes de ativos (`report-equity-class-table.tsx`) adota distribuição ponderada de larguras percentuais sob `table-fixed` (Ticker 11%, Setor 14%, Qtd 5%, Preço Médio 12%, Cotação 11%, Total 18%, Var. Cota 16%, Ret. Total 13%), com espaçamento `pr-2.5` e `pl-2`, erradicando qualquer colisão de strings de 5+ dígitos (`R$ 22.588,752,0% (USD)`).
- **Consistência de Alocação de Renda Fixa na Pág. 1:** A tabela de metas e alocação atual (`Target vs. Actual`) lê o percentual de classes diretamente de `donutData.classSegments` (calculado pelo método de Hare-Niemeyer), harmonizando perfeitamente `27,1%` entre o gráfico de rosca e a grade de alocação.

## 15. CORREÇÃO ALGÉBRICA DE RESGATES SEM DUPLO DESCONTO, PAGINAÇÃO CHROMIUM & CERTIFICAÇÃO DE PRODUÇÃO (§v8 — ID BR-20261119-6445)

### 15.1. Prova Algébrica e Eliminação do Duplo Desconto na Reconstrução de Resgates (Gate v8.1)
- **Causa-Raiz do Duplo Desconto:** Na reconstrução histórica de resgates a partir da custódia remanescente ($C_{\text{atual}}, S_{\text{atual}}$), a fórmula recursiva anteriormente utilizada:
  $$C_i = C_{\text{atual}} \times \frac{V_i}{S_{\text{atual}} + V_i}$$
  incorporava indevidamente o valor resgatado $V_i$ no denominador enquanto $C_{\text{atual}}$ já se encontrava amortizado pelos resgates anteriores, provocando uma diluição artificial do custo baixado nos primeiros resgates e gerando rentabilidades brutas infladas (como $+48\%$ em vez de $+15,65\%$).
- **Equação Canônica Direta sem Duplo Desconto:** A proporção de custo em qualquer resgate parcial de Renda Fixa corresponde à razão de custo unitária vigente na posição:
  $$r_{\text{custo}} = \min\left(1, \frac{C_{\text{atual}}}{S_{\text{atual}}}\right)$$
  $$C_{\text{baixado}, i} = V_i \times r_{\text{custo}}$$
  $$\text{LucroBruto}_i = V_i - C_{\text{baixado}, i} = V_i \times (1 - r_{\text{custo}})$$
  $$\text{RentabilidadeBruta}_i = \frac{1 - r_{\text{custo}}}{r_{\text{custo}}}$$
  Essa formulação garante que, a partir de uma posição remanescente com saldo $S = \text{R\$}~5.054,69$ e custo $C = \text{R\$}~4.370,51$ ($r_{\text{custo}} \approx 0,864645$), múltiplos resgates sucessivos ($V_A = \text{R\$}~1.653,17$, $V_B = \text{R\$}~1.009,51$, $V_C = \text{R\$}~2.023,29$) mantenham de forma invariante a rentabilidade real bruta de $+15,65\%$.

### 15.2. SSOT de Realizados entre Dossiê Pág. 1 e Pág. 5 (Gate v8.1)
- O total líquido realizado acumulado da Página 1 do Dossiê (+R$ 768,84) consolida de forma estrita a soma dos lucros líquidos dos resgates do período com os resultados de posições encerradas passadas:
  $$\text{RealizadoTotal} = \sum_{i} \text{LucroLíquido}_i + \text{ResultadoEncerradasPassadas}$$
- A tabela POSIÇÕES ENCERRADAS & RESGATES REALIZADOS da Página 5 reflete exatamente os mesmos valores centavo por centavo, lendo prioritariamente os campos canônicos imutáveis da transação (`cost_basis_realized`, `gross_realized_pnl`, `ir_withheld`, `net_realized_pnl`) e as notas `[FI_SELL_SNAPSHOT]`.

### 15.3. Tabela Regressiva de IR e Preservação de Data Explícita
- Quando o ativo possuir `initial_investment_date` definido explicitamente pelo usuário ou pela instituição custodiante, o cálculo de dias decorridos é estritamente soberano:
  $$\text{dias} = \text{diasEntre}(\text{initial\_investment\_date}, \text{data\_resgate})$$
  respeitando as faixas legais de IR (art. 1º da Lei nº 11.033/2004):
  - $\le 180$ dias: $22,5\%$
  - $181$ a $360$ dias: $20,0\%$
  - $361$ a $720$ dias: $17,5\%$
  - $> 720$ dias: $15,0\%$
- Somente quando a data de aquisição for desconhecida ou estimada (modo Marco Zero com fallback de data de cadastro) e o ativo apresentar rendimento econômico acumulado característico de longo prazo ($\ge 15\%$), aplica-se a salvaguarda de $15,0\%$ ($> 720$ dias).

### 15.4. Arquitetura de Paginação Multi-Página no Chromium Print Engine (Gate v8.2)
- No motor de renderização Blink/Chromium, contêineres pai estilizados com `display: flex` ou `display: grid` desabilitam a capacidade do paginador de fragmentar tabelas HTML ao longo de quebras de página A4, forçando o corte seco do documento na primeira página.
- A arquitetura de impressão foi corrigida definindo `display: block !important`, `width: 100% !important` e `overflow: visible !important` em todas as cascas de impressão (`.print-sheet > div`, `.print-document`, `.print-area`), desativando raios de borda e sombras decorativas durante o evento `@media print`. Com isso, tabelas extensas com $\ge 20$ ativos paginam com fluidez e naturalidade ao longo de 5 páginas A4.

### 15.5. Rebalanceamento de Colunas da Tabela de Renda Variável Internacional (Gate v8.3)
- Na tabela de ativos internacionais (`report-equity-class-table.tsx`), a coluna de Variação da Cota foi rebalanceada de $16\%$ para $22\%$ ($> 150\text{px}$ de largura útil física), acomodando os valores duplos `+X,X% (USD)` e `+Y,Y% (BRL)` com espaçamento `pl-2`.
- No subtotal (`tfoot`), os valores consolidados utilizam `font-mono tabular-nums text-[10px]` com quebra em duas linhas, eliminando permanentemente colisões tipográficas com a coluna de Total em R$.

## 16. EXPLICABILIDADE MATEMÁTICA ATIVA E MEMÓRIA DE CÁLCULO CANÔNICA (`src/domain/calculation-memory/`)

Em estrito cumprimento da Regra 33 do `AGENTS.md`, todo indicador financeiro derivado, composto, rateado ou projetado possui uma representação estruturada de sua equação matemática gerada exclusivamente pelo domínio puro.

### 16.1. Contrato Canônico de Memória de Cálculo (`types.ts`)
1. **Estrutura de Decomposição (`CalculationBreakdown`):**
   - `id`: identificador estável da métrica;
   - `title`: nome humano descritivo (ex.: "Saldo Livre Real (Safe-to-Spend)");
   - `description`: definição em uma frase do objetivo da medição;
   - `periodLabel`: escopo temporal estrito (ex.: "Novembro/2026", "Últimos 12 meses");
   - `formulaExpression`: representação simbólica inteligível (ex.: `Saldo em Contas + A Receber − Faturas − Pendências`);
   - `unit`: unidade canônica de apresentação (`currency`, `percent`, `months`, `count`, `ratio`);
   - `steps`: array ordenado de parcelas operacionais (`BreakdownStep`) com operador (`+`, `-`, `=`, `/`, `*`), valor bruto, dica explicativa e tonalidade semântica (`default`, `positive`, `negative`, `muted`, `portfolio`);
   - `result`: valor final computado com formatação e unidade;
   - `inclusions` e `exclusions`: critérios explícitos de fronteira contábil;
   - `copyText`: versão estruturada em texto plano para exportação e auditoria.

### 16.2. SSOT & Isolamento de Camadas
- É expressamente proibido calcular valores ou passos de decomposição matemática dentro de componentes React de UI.
- O mesmo módulo de domínio puro (`src/domain/`) que alimenta os KPIs da tela fornece o builder estruturado da memória de cálculo correspondente.
- Todos os formatadores (`formatters.ts`) tratam valores especiais com neutralização matemática: $\text{NaN}$, $\pm\infty$ e denominadores nulos retornam formatações seguras de zero com alertas contextuais.




