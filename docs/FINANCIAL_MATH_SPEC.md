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

Padrão CVM/ANBIMA para aferir o mérito da estratégia de alocação de forma imune aos aportes e resgates externos:
- Cada subperíodo calcula a variação percentual isolada $r_t$;
- A taxa acumulada no período decorre do encadeamento geométrico:

$$R_{\text{twr}} = \prod_{t=1}^{T} (1 + r_t) - 1$$

- **Salvaguarda de Perda Total:** O retorno acumulado respeita o piso teórico de $-100.00\%$, prevenindo distorções numéricas decorrentes de aproximações de ponto flutuante.

### 4.2. MWRR / TIR / XIRR (`irr.ts`)

Mede a taxa interna de retorno do capital efetivamente investido pelo bolso, ponderada pelas datas exatas dos fluxos de caixa:
- Resolve a equação de Valor Presente Líquido (VPL):

$$\text{VPL}(r) = \sum_{k=1}^{K} \frac{C_k}{(1 + r)^{\frac{d_k - d_0}{365}}} = 0$$

- **Solver Híbrido:** Executa até 50 iterações de Newton-Raphson com tolerância $\epsilon = 10^{-7}$. Em caso de divergência ou derivada nula, aciona busca intervalar por bisseção no intervalo $[-0.999, 10.0]$.

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
