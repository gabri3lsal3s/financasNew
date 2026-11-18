# Plano Diretor de Auditoria, Saneamento e Refatoração Holística do Motor de Investimentos — Axir

**Documento de Especificação de Engenharia Financeira & Arquitetura de Software**  
**Caso-Base de Referência (Golden Dataset):** Relatórios `ID: BR-20261118-6445` (Data-base: `18/11/2026`)  
**Escopo:** Motor Contábil de Custódia, Ledger de Transações, Motor Cambial (FX), Motor de Cotas (TWR) e Fluxo de Caixa Descontado (TIR/XIRR), Contabilidade de Proventos, Matriz de Alocação e Rebalanceamento, Taxonomia de Raios-X, Motor de Benchmarks/Risco e Camada de Renderização (UI/PDF).

---

## Diretrizes de Execução para o Agente de Código (LLM High-Reasoning)

Este plano foi estruturado para ser executado de forma sequencial, determinística e verificável. Os erros detectados na auditoria dos relatórios `ID: BR-20261118-6445` (**Dossiê Executivo da Posição Vigente Consolidada** e **Extrato Analítico de Evolução Patrimonial**) não devem ser tratados como *hotfixes* pontuais de interface, mas sim como **sintomas de falhas estruturais no motor de cálculo e no modelo de dados do aplicativo**.

### Regras Inegociáveis de Engenharia Financeira
1. **Fonte Única de Verdade (*Single Source of Truth* - SSOT):** Nenhuma tela, gráfico, card ou relatório em PDF pode implementar cálculos financeiros próprios no frontend ou no template do relatório. Todos os consumidores devem ler exclusivamente de um único `PortfolioValuationSnapshot` e `PerformanceTimeSeries` gerados pelo motor central.
2. **Aritmética de Ponto Fixo / Decimal Estrito:** É proibido o uso de `Float` binário padrão ($IEEE\ 754$ `double`/`float` nativo sem tratamento) para valores monetários, quantidades de cotas e preços médios. Utilize tipos `Decimal` de alta precisão ($18$ a $28$ dígitos significativos internamente; $8$ casas decimais para quantidades e cotas; $4$ a $6$ casas decimais para câmbio PTAX; arredondamento `HALF_EVEN` ou `HALF_UP` padronizado apenas na camada final de serialização/exibição).
3. **Imutabilidade Histórica e Derivação por Eventos (*Ledger-First*):** Posições, custos médios, lucros realizados, saldos de caixa e proventos acumulados em qualquer data passada $t$ devem ser funções puras e determinísticas do livro-razão (*ledger*) de eventos ocorridos até o instante $t$ ($\mathcal{L}_{\le t}$).
4. **Bloqueio por Invariantes Contábeis (*Fail-Fast Invariants*):** Nenhum cálculo ou relatório pode ser emitido sem antes passar pelos validadores de invariantes matemáticos definidos nos Portões de Qualidade deste documento.

---

## Catálogo Geral de Fragilidades, Bugs e Erros de Cálculo Diagnosticados

A tabela abaixo consolida os **16 defeitos sistêmicos** comprovados matematicamente na auditoria do caso `BR-20261118-6445` que o editor de código deve localizar e erradicar no repositório:

| ID | Módulo Afetado | Sintoma Observado nos Relatórios (`BR-20261118-6445`) | Causa-Raiz Arquitetural no Motor do Axir |
| :--- | :--- | :--- | :--- |
| **BUG-01** | Custódia & Caixa | Custo Aplicado diverge em $\text{R\$ } 0,96$ entre Dossiê ($\text{R\$ } 17.319,94$) e Extrato ($\text{R\$ } 17.320,90$). Tabela de custódia soma $\text{R\$ } 17.502,72$, mas cabeçalho exibe $\text{R\$ } 17.503,68$. | Tratamento ambíguo da `Reserva de Caixa` ($\text{R\$ } 0,96$): incluída no patrimônio de ambos, excluída do custo no Dossiê e somada ao custo aplicado no Extrato. |
| **BUG-02** | Motor TWR / Cotas | Em `Set/2026` ($+4,69\%$), `Out/2026` ($-1,31\%$) e `Nov/2026` ($-4,50\%$), o TWR mensal exibido é igual à variação bruta do patrimônio ($\Delta P_t / P_{t-1}$). | O motor de TWR falhou em expurgar os fluxos de capital ($\Delta C_t = +\text{R\$ } 368,80$ em Set/26, $+\text{R\$ } 338,18$ em Out/26 e $-\text{R\$ } 188,11$ em Nov/26), tratando aporte como lucro e retirada como prejuízo. |
| **BUG-03** | Motor TWR (Dualidade) | TWR Acumulado de $+11,5\%$ no Dossiê ($\text{MTD Nov/26} = -1,1\%$) vs. $+7,7\%$ no Extrato ($\text{MTD Nov/26} = -4,50\%$, Cota $\text{R\$ } 107,68$). | Existência de dois caminhos de código distintos calculando a rentabilidade do mês corrente (MTD) sem compartilhar o mesmo motor de cotização. |
| **BUG-04** | Série Temporal | O mês de **Agosto/2026 (`08/2026`)** inexiste na tabela do Extrato e nos gráficos de ambos os relatórios (`07/26` salta para `09/26`). | Ausência de uma *Calendar Spine Table* (tabela calendário contínua). Meses sem snapshot salvo ou com falha de job são silenciosamente omitidos da série. |
| **BUG-05** | Contagem de Janela | Período de `Out/2024` a `Nov/2026` rotulado como `25 meses` (são $26$ competências) e janela anual de risco com apenas `11 meses fechados` (`5/11`). | Uso de `COUNT(rows)` sobre a série truncada (sem `08/2026`) em vez de cálculo de diferença de competências de calendário. |
| **BUG-06** | Câmbio (FX) & Custo USD | Os $6$ ETFs internacionais usam câmbio fixo de $\text{R\$ } 5,2500/\text{US\$}$ tanto no saldo atual ($\text{R\$ } 6.852,60$) quanto no custo em BRL ($\text{R\$ } 5.672,26 = \text{US\$ } 1.080,43 \times 5,25$). | O sistema não persiste o câmbio histórico de cada lote de compra (`fx_rate_at_purchase`), convertendo o custo histórico em USD pela PTAX atual e zerando a variação cambial ($0\%$ de efeito câmbio). |
| **BUG-07** | Proventos (Série Mensal) | Coluna `Proventos Mês` exibe $\text{R\$ } 0,00$ em todas as $25$ linhas do Extrato, enquanto o card superior exibe `Proventos no Período: R$ 4,60`. | Falha no `GROUP BY year_month` dos eventos de proventos ou mapeamento incorreto da propriedade no serializador da tabela do Extrato. |
| **BUG-08** | Proventos (Retroatividade) | Coluna `Proventos Acum.` exibe valor fixo de $\text{R\$ } 1.789,87$ desde o mês 1 (`Out/2024`) até `Jul/2026`, subindo para $\text{R\$ } 1.794,47$ em `Set/2026`. | O snapshot histórico gravou o total acumulado de proventos da data de processamento retroativamente em todos os meses passados, distorcendo a coluna `Retorno Total` de toda a série histórica. |
| **BUG-09** | Proventos (Ativos vs. Total) | Dossiê reporta $\text{R\$ } 1.757,57$ de proventos; Extrato reporta $\text{R\$ } 1.794,47$ (diferença de $\text{R\$ } 36,90$). | O Dossiê soma apenas os proventos vinculados aos $26$ ativos atualmente em custódia aberta, ignorando proventos históricos de posições já encerradas ($\text{R\$ } 36,90$). |
| **BUG-10** | P&L Econômico & TIR/XIRR | Card 4 (`P&L Econômico Total: R$ 1.940,35`) promete somar lucros realizados no passado + ganho aberto + todos os proventos, mas soma apenas posições abertas ($182,78 + 1.757,57$). TIR de $+1,4\%\text{ a.a.}$ desconectada. | Ausência de contabilidade de Lucro/Prejuízo Realizado (*Realized P&L*) em vendas passadas no Card 4 e desalinhamento entre os fluxos de caixa enviados ao solver da `XIRR` e o patrimônio final. |
| **BUG-11** | Matriz de Alocação (Metas) | Coluna `Meta (%)` soma $200,0\%$, `Gap (R$)` soma $-\text{R\$ } 17.503,68$ e `Índice de Equilíbrio Geral` cai para $35\%$ (deveria ser $84,9\%$). | Quatro categorias legadas sem saldo (`Fundos Imobiliários` $40\%$, `Ações De Dividendos` $30\%$, `Renda Fixa CDI` $20\%$, `REITs Globais` $10\%$) coexistem com as $6$ classes atuais sem validação de soma $100\%$. |
| **BUG-12** | Narrativa Automatizada (NLG) | Texto da Página 1 afirma que o maior déficit é `Fundos Imobiliários (-R$ 7.001,47)` e, na mesma frase, diz que `FIIs` está acima da meta (`+R$ 173,14`). | O gerador de texto lê a tabela de metas corrompida sem normalização semântica de classes equivalentes. |
| **BUG-13** | Raio-X de Renda Fixa | `CDB ORIGINAL` ($\text{R\$ } 1.348,01$) aparece como `Pós-fixado (Selic / CDI)` nas páginas 4 e 5, mas vira `Prefixado` ($42,4\%$) no Raio-X da página 7. | Divergência de mapeamento de enumeradores (`indexer_type`) entre a tabela de custódia e o agregador do gráfico de Raio-X de Renda Fixa. |
| **BUG-14** | Raio-X Internacional | Cinco ETFs ($\text{R\$ } 6.523,45$ / $95,2\%$) são classificados como `Estados Unidos (US Equity)`, incluindo Ouro (`GLD`), Bitcoin (`BITB`), China (`MCHI`) e Argentina (`ARGT`). | O classificador geográfico usa o país da bolsa de listagem (`exchange_country = US`) em vez da exposição econômica/geográfica e classe real do ativo subjacente (`underlying_region` / `asset_sub_class`). |
| **BUG-15** | Escala de Benchmark (Ibov) | Card do `IBOVESPA (25M)` exibe retorno de `1,0%`, performance relativa de `1.148,0% do Ibovespa` e spread de `+10,5 p.p.`. | Erro de fator $100\times$: o retorno acumulado em base decimal ($1,00165 \equiv +100,17\%$) não foi multiplicado por $100$ antes da exibição/divisão ($\frac{11,499\%}{1,00165\%} = 1.148,0\%$). |
| **BUG-16** | Risco (Sharpe & Contagem) | Índice de Sharpe ($-1,5$) compara retorno não anualizado de $11$ meses ($+2,89\%$) com CDI anual de $12$ meses ($13,70\%$). Página 5 declara `10 segmentos`, mas lista `9`. `BITB` arredonda $-10,94\%$ para $-11,0\%$. | Incompatibilidade dimensional na fórmula do Sharpe, contagem hardcoded ou com elemento oculto no gráfico de segmentos e truncamento/arredondamento prematuro em `BITB`. |

---

## Fase 0: Meta-Auditoria do Plano, Descoberta Arquitetural e Instrumentação de Baseline

Antes de alterar qualquer linha de código de produção, o agente de código deve executar esta Fase 0 para auditar o próprio plano contra a estrutura real do repositório do **Axir**, mapear todas as dependências e criar a rede de segurança de testes determinísticos.

### Etapa 0.1: Auto-Auditoria do Plano e Mapeamento do Repositório (AST & Data Lineage)
1. **Inspeção Completa da Árvore de Código:**
   * Localizar todos os módulos, serviços, *controllers*, *queries* SQL/ORM, *workers* de background e templates de front-end/PDF que calculam ou exibem:
     * Saldo de custódia, preço médio, variação de cota e retorno total por ativo.
     * Conversão cambial (`USD` $\to$ `BRL`) e ingestão de cotações/PTAX.
     * Fechamento mensal de patrimônio, cálculo de cota, `TWR`, `TIR/XIRR` e `Retorno Total`.
     * Matriz de alocação (`Target vs. Actual`), `Gap (R$)` e `Índice de Equilíbrio Geral`.
     * Agregações de Raios-X (Ações, FIIs, Renda Fixa, Internacional e Segmentos).
     * Séries de benchmarks (`CDI`, `IPCA`, `Ibovespa`, `Poupança`) e métricas de risco (`Volatilidade`, `Max Drawdown`, `Sharpe`, `Consistência`).
2. **Identificação de Duplicação de Lógica (*Split-Brain Detection*):**
   * Rastrear por que o **Dossiê Executivo** e o **Extrato Analítico** produzem números diferentes para a mesma carteira e mesma data-base (`18/11/2026`, `ID: BR-20261118-6445`).
   * Documentar em um arquivo temporário de diagnóstico (`AUDIT_CODE_MAP.md`) cada função duplicada que será substituída pelo motor unificado.
3. **Verificação de Casos Ocultos Adicionais:**
   * Durante a varredura, verificar se existem outras classes de ativos (ex.: BDRs, Criptomoedas diretas, Previdência, Fundos de Investimento, Opções/Derivativos, Tesouro Direto com cupons semestrais, Debêntures/CRI/CRA isentos de IR) que sofram dos mesmos vícios de cálculo identificados nos $26$ ativos do relatório auditado.

### Etapa 0.2: Construção da Suíte de Regressão "Golden Dataset" (`BR-20261118-6445`)
1. **Fixture de Teste Fiel ao Caso Auditado:**
   * Criar uma *fixture* automatizada (`tests/fixtures/golden_portfolio_6445.json`) contendo exatamente os $26$ ativos, quantidades, preços médios, cotações, reserva de caixa ($\text{R\$ } 0,96$), metas de alocação e a série histórica de $25$ meses do relatório `BR-20261118-6445`.
2. **Testes de Comprovação de Falha (*Red Tests*):**
   * Escrever testes automatizados que reproduzam os bugs atuais e definam as asserções matemáticas exatas que devem passar (*Green Tests*) após a refatoração de cada fase.

### Portão de Qualidade 0 (Gate 0 — Critérios de Aprovação)
* [x] Mapa completo de linhagem de dados (`AUDIT_CODE_MAP.md`) gerado, identificando todos os arquivos e funções responsáveis pelos **BUG-01** a **BUG-16**.
* [x] *Fixture* `golden_portfolio_6445` configurada e executável na suíte de testes sem dependências externas de rede (*mock* determinístico de cotações e PTAX).
* [x] Confirmação de que nenhuma lógica financeira crítica ficará fora do escopo das Fases 1 a 6.

---

## Fase 1: Saneamento do Modelo de Dados, Ledger de Eventos e Contabilidade de Custódia/Caixa

O objetivo desta fase é garantir que a contabilidade de posições abertas, posições encerradas, preço médio, lucros realizados e reserva de caixa seja matematicamente exata e idêntica em qualquer tela ou relatório do sistema.

### Etapa 1.1: Arquitetura de Ledger Imutável e Máquina de Estados de Posição
Todo o estado da carteira na data $t$ deve ser derivado de eventos atômicos ordenados cronologicamente:
1. **Tipos de Eventos do Ledger (`LedgerEventType`):**
   * `CASH_DEPOSIT` (Aporte externo de dinheiro novo na corretora/carteira)
   * `CASH_WITHDRAWAL` (Resgate externo de dinheiro da corretora para o bolso do usuário)
   * `ASSET_BUY` (Compra de ativo: reduz caixa ou registra aporte implícito, aumenta quantidade e custo total da posição)
   * `ASSET_SELL` (Venda parcial ou total: aumenta caixa ou registra retirada implícita, reduz quantidade proporcionalmente ao custo médio vigente e cristaliza `RealizedPnL`)
   * `DIVIDEND_CASH` / `JCP_CASH` / `RENDIMENTO_FII` / `COUPON_RF` (Provento creditado líquido de IR na fonte)
   * `STOCK_SPLIT` / `INPLIT` / `BONUS_SHARES` (Desdobramento, grupamento e bonificação: altera quantidade e ajusta preço médio unitário preservando ou acrescendo o custo contábil conforme legislação fiscal)
   * `AMORTIZATION` (Amortização de FII/Renda Fixa: reduz custo de aquisição sem configurar dividendo tributável/rendimento puro)

### Etapa 1.2: Fórmulas de Preço Médio Ponderado (PMP) e Lucro Realizado (*Realized P&L*)
Para cada ativo $i$, a evolução da quantidade $Q_{i,t}$, do custo total na moeda original $C_{i,t}^{\text{orig}}$, do custo total em reais $C_{i,t}^{\text{BRL}}$ e do lucro realizado acumulado $\text{PnL}_{i,t}^{\text{real}}$ após cada evento no instante $t$ deve obedecer estritamente às equações abaixo:

1. **Na Compra (`ASSET_BUY`) de quantidade $\Delta Q > 0$ ao preço unitário $P_{\text{compra}}$ (incluindo taxas operacionais $\tau_{\text{compra}}$) e taxa de câmbio $FX_t$ ($FX_t = 1$ para ativos em BRL):**
   $$Q_{i,t} = Q_{i,t-1} + \Delta Q$$
   $$C_{i,t}^{\text{orig}} = C_{i,t-1}^{\text{orig}} + (\Delta Q \times P_{\text{compra}} + \tau_{\text{compra}})$$
   $$C_{i,t}^{\text{BRL}} = C_{i,t-1}^{\text{BRL}} + (\Delta Q \times P_{\text{compra}} + \tau_{\text{compra}}) \times FX_t$$
   $$\text{PM}_{i,t}^{\text{orig}} = \frac{C_{i,t}^{\text{orig}}}{Q_{i,t}}, \qquad \text{PM}_{i,t}^{\text{BRL}} = \frac{C_{i,t}^{\text{BRL}}}{Q_{i,t}}$$

2. **Na Venda (`ASSET_SELL`) de quantidade $\Delta Q > 0$ (com $\Delta Q \le Q_{i,t-1}$) ao preço líquido de venda $P_{\text{venda}}$ e câmbio $FX_t$:**
   * O preço médio unitário **não se altera** em uma venda: $\text{PM}_{i,t}^{\text{orig}} = \text{PM}_{i,t-1}^{\text{orig}}$ e $\text{PM}_{i,t}^{\text{BRL}} = \text{PM}_{i,t-1}^{\text{BRL}}$.
   * O custo baixado é estritamente proporcional à fração vendida $f = \frac{\Delta Q}{Q_{i,t-1}}$:
     $$Q_{i,t} = Q_{i,t-1} - \Delta Q$$
     $$C_{i,t}^{\text{orig}} = C_{i,t-1}^{\text{orig}} \times (1 - f), \qquad C_{i,t}^{\text{BRL}} = C_{i,t-1}^{\text{BRL}} \times (1 - f)$$
   * O resultado realizado na operação ($\Delta \text{PnL}_{i,t}^{\text{real, BRL}}$) é:
     $$\Delta \text{PnL}_{i,t}^{\text{real, BRL}} = (\Delta Q \times P_{\text{venda}} \times FX_t) - \left(C_{i,t-1}^{\text{BRL}} \times f\right)$$
     $$\text{PnL}_{i,t}^{\text{real, BRL}} = \text{PnL}_{i,t-1}^{\text{real, BRL}} + \Delta \text{PnL}_{i,t}^{\text{real, BRL}}$$
   * Se $Q_{i,t} = 0$, a posição passa para o status `CLOSED` (encerrada), mas seu histórico de $\text{PnL}_{i,t}^{\text{real, BRL}}$ e de proventos recebidos ($D_{i}^{\text{hist}}$) permanece armazenado no portfólio para compor o **P&L Econômico Total** e o **Extrato Analítico**.

### Etapa 1.3: Unificação Contábil da Reserva de Caixa ($\text{R\$ } 0,96$) — Correção do `BUG-01`
Para eliminar a divergência de $\text{R\$ } 0,96$ entre o Dossiê Executivo ($\text{Custo} = \text{R\$ } 17.319,94$) e o Extrato Analítico ($\text{Custo} = \text{R\$ } 17.320,90$):
1. **Definição Formal de Custo e Patrimônio:**
   * $\text{Saldo de Ativos Risco/RF } (V_{\text{ativos}}) = \sum_{i=1}^{N} V_{i,t} = \text{R\$ } 17.502,72$
   * $\text{Custo de Aquisição de Ativos } (C_{\text{ativos}}) = \sum_{i=1}^{N} C_{i,t}^{\text{BRL}} = \text{R\$ } 17.319,94$
   * $\text{Reserva de Caixa } (V_{\text{caixa}}) = C_{\text{caixa}} = \text{R\$ } 0,96$ (o custo contábil de moeda nacional em caixa é $1:1$ com seu valor nominal, variação de cota $= 0,0\%$).
   * $\text{Patrimônio Total Consolidado } (P_{\text{total}}) = V_{\text{ativos}} + V_{\text{caixa}} = \text{R\$ } 17.503,68$
   * $\text{Custo Total Consolidado } (C_{\text{total}}) = C_{\text{ativos}} + C_{\text{caixa}} = \text{R\$ } 17.320,90$
2. **Invariante de Ganho de Capital Aberto ($\Delta V_{\text{aberto}}$):**
   $$\Delta V_{\text{aberto}} = P_{\text{total}} - C_{\text{total}} = V_{\text{ativos}} - C_{\text{ativos}} = \text{R\$ } 182,78$$
3. **Regra de Exibição Padronizada:**
   * Quando um componente exibir o **Patrimônio Total Consolidado** ($\text{R\$ } 17.503,68$), o custo de referência exibido ao lado deve ser o **Custo Total Consolidado** ($\text{R\$ } 17.320,90$) ou explicitar literalmente: *"Custo de aquisição de ativos: $\text{R\$ } 17.319,94$ + $\text{R\$ } 0,96$ em caixa ($\text{R\$ } 17.320,90$ total)"*.
   * Na tabela `Custódia Consolidada de Ativos por Classe` (Páginas 3 e 4 do Dossiê), incluir a seção/linha explícita de `Reserva de Caixa (R$ 0,96)` ou alterar o rótulo do subtotal de ativos para `Total em Ativos Custodiados: R$ 17.502,72 | Reserva de Caixa: R$ 0,96 | Patrimônio Total: R$ 17.503,68`.

### Portão de Qualidade 1 (Gate 1 — Critérios de Aprovação)
* [ ] Invariante $P_{\text{total}} - C_{\text{total}} \equiv V_{\text{ativos}} - C_{\text{ativos}}$ validado em $100\%$ dos testes unitários.
* [ ] Custo Total reportado no cabeçalho do Dossiê e na linha `Nov/2026` do Extrato são rigorosamente idênticos ou reconciliados ao centavo ($\text{R\$ } 0,00$ de divergência não explicada).
* [ ] Posições encerradas ($Q_{i,t} = 0$) preservam seu `RealizedPnL` e seus proventos históricos no agregador global da carteira.

---

## Fase 2: Motor Multi-Moeda (FX Engine) e Integração de Dados de Mercado (PTAX & Cotações)

O objetivo desta fase é erradicar o **BUG-06**, onde o sistema aplicou uma taxa artificial de $\text{R\$ } 5,2500/\text{US\$}$ tanto ao saldo atual quanto ao custo de aquisição em dólar dos $6$ ETFs internacionais (`ARGT`, `BITB`, `GLD`, `MCHI`, `VEA`, `VOO`), anulando o efeito cambial.

### Etapa 2.1: Separação Estrita entre Custo Histórico em BRL e Marcação a Mercado em BRL
1. **Schema de Lotes/Posições Internacionais:**
   Cada transação e cada posição consolidada em moeda estrangeira ($m \in \{\text{USD}, \text{EUR}, \dots\}$) deve manter obrigatoriamente **dois custos médios independentes**:
   * `avg_price_original_currency` ($\text{PM}_{i}^{\text{USD}}$): Preço médio na moeda de origem do ativo.
   * `avg_cost_brl` ($\text{PM}_{i}^{\text{BRL}}$) e `total_cost_brl` ($C_{i}^{\text{BRL}}$): Custo histórico em reais ponderado pela taxa de câmbio efetiva (`fx_rate_at_purchase`) de cada lote de compra:
     $$C_{i}^{\text{BRL}} = \sum_{k \in \text{Compras}(i)} \left(q_{i,k} \times p_{i,k}^{\text{USD}} + \tau_{i,k}^{\text{USD}}\right) \times FX_{k}^{\text{compra}}$$
   * Taxa de câmbio média histórica implícita da posição ($FX_{i}^{\text{hist}}$):
     $$FX_{i}^{\text{hist}} = \frac{C_{i}^{\text{BRL}}}{C_{i}^{\text{USD}}}$$
2. **Proibição de Multiplicação do Custo em USD pela PTAX Atual:**
   * Auditar e remover do código qualquer expressão equivalente a `custo_brl = custo_usd * ptax_atual`.
   * *Fallback de Migração para Legado:* Caso um registro antigo no banco de dados não possua o campo `fx_rate_at_purchase` preenchido, uma *migration* deve buscar na tabela histórica de PTAX do Banco Central a cotação de venda do dia útil da data de compra (`transaction_date`) de cada lote e popular `fx_rate_at_purchase` e `total_cost_brl` de forma definitiva.

### Etapa 2.2: Decomposição Matemática do Retorno de Ativos Internacionais
Para todo ativo internacional $i$ com preço médio $\text{PM}_{i}^{\text{USD}}$, cotação atual $P_{i,t}^{\text{USD}}$, câmbio médio histórico de compra $FX_{i}^{\text{hist}}$, PTAX atual de fechamento $FX_{t}^{\text{PTAX}}$ e proventos líquidos acumulados em reais $D_{i,t}^{\text{BRL}}$:

1. **Variação da Cota na Moeda Original (`Var. Cota (USD)`):**
   $$R_{i,t}^{\text{USD}} = \frac{P_{i,t}^{\text{USD}}}{\text{PM}_{i}^{\text{USD}}} - 1$$
2. **Variação Cambial Implícita da Posição (`Var. Câmbio`):**
   $$R_{i,t}^{\text{FX}} = \frac{FX_{t}^{\text{PTAX}}}{FX_{i}^{\text{hist}}} - 1$$
3. **Variação da Cota Convertida em Reais (`Var. Cota (BRL)`):**
   $$R_{i,t}^{\text{Cota, BRL}} = \frac{V_{i,t}^{\text{BRL}}}{C_{i}^{\text{BRL}}} - 1 = \left(1 + R_{i,t}^{\text{USD}}\right) \times \left(1 + R_{i,t}^{\text{FX}}\right) - 1$$
4. **Retorno Total em Reais (`Ret. Total (BRL)` — incluindo Câmbio + Proventos Líquidos de $30\%$ IRS):**
   $$R_{i,t}^{\text{Total, BRL}} = \frac{V_{i,t}^{\text{BRL}} + D_{i,t}^{\text{BRL}} - C_{i}^{\text{BRL}}}{C_{i}^{\text{BRL}}} = R_{i,t}^{\text{Cota, BRL}} + \frac{D_{i,t}^{\text{BRL}}}{C_{i}^{\text{BRL}}}$$
5. **Subtotal da Classe Internacional:**
   * A coluna `VAR. COTA` do subtotal internacional deve exibir simultaneamente ou de forma clara a variação da carteira em dólar ($\frac{\sum V_{i,t}^{\text{USD}}}{\sum C_{i}^{\text{USD}}} - 1$) e a variação de capital em reais ($\frac{\sum V_{i,t}^{\text{BRL}}}{\sum C_{i}^{\text{BRL}}} - 1$), garantindo coerência com a nota de rodapé do relatório.

### Etapa 2.3: Pipeline Oficial de PTAX (BCB) e Cotações de Fechamento (B3 / NYSE / NASDAQ)
1. **Integração PTAX Banco Central do Brasil (Série SGS `1` / Olinda API PTAX):**
   * Utilizar a cotação PTAX de fechamento (4 casas decimais, ex.: $\text{R\$ } 5,7843$) do dia útil de referência ($D\text{-}0$ após as 13h30 BRT ou $D\text{-}1$ útil caso o relatório seja emitido antes do fechamento do boletim PTAX).
   * Exibir explicitamente no rodapé da seção Internacional do relatório a taxa PTAX utilizada e seu timestamp oficial (ex.: *"Conversão USD/BRL pela PTAX Oficial BCB de 18/11/2026: R$ X,XXXX"*).
2. **Padronização de Cotações de Mercado (D-0 vs. D-1):**
   * Armazenar junto a cada cotação o `quote_timestamp` e a fonte (`B3`, `NYSE`, `NASDAQ`).
   * Para títulos de Renda Fixa (`CDB ORIGINAL`, `TESOURO-IPCA`, `TESOURO-SELIC`), calcular a marcação na curva (acréscimo diário pro-rata de $\text{CDI/Selic}$ em base $252$ dias úteis) ou marcação a mercado via PU oficial do Tesouro Direto.

### Portão de Qualidade 2 (Gate 2 — Critérios de Aprovação)
* [ ] Para qualquer ativo internacional sem dividendos (como `BITB` e `GLD`), se $FX_{t}^{\text{PTAX}} \neq FX_{i}^{\text{hist}}$, então obrigatoriamente $R_{i,t}^{\text{Total, BRL}} \neq R_{i,t}^{\text{USD}}$, refletindo com exatidão o fator $(1 + R_{i,t}^{\text{USD}})(1 + R_{i,t}^{\text{FX}}) - 1$.
* [ ] Todas as conversões USD $\to$ BRL na mesma data-base utilizam exatamente a mesma PTAX oficial de 4 casas decimais, sem desvios entre ativos.
* [ ] O arredondamento de `BITB` ($(37,27 / 41,85) - 1 = -10,9438\%$) exibe `-10,9%` em vez de `-11,0%` (**BUG-16**).

---

## Fase 3: Unificação do Motor de Rentabilidade (TWR / Cotas CVM-ANBIMA, TIR/XIRR e P&L Econômico)

Esta é a fase mais crítica do plano: corrigir o cálculo de cotas (TWR) que tratou aportes como rentabilidade em `Set/2026` e `Out/2026` (**BUG-02**), unificar o cálculo do mês corrente `Nov/2026 MTD` entre Dossiê e Extrato (**BUG-03**), restaurar o mês omitido de `Ago/2026` (**BUG-04** e **BUG-05**) e reconstruir a série histórica de proventos e P&L (**BUG-07**, **BUG-08**, **BUG-09**, **BUG-10**).

### Etapa 3.1: Algoritmo Oficial de Cotização (TWR Padrão CVM / ANBIMA / GIPS)
O retorno ponderado pelo tempo (*Time-Weighted Return* — TWR) deve isolar integralmente o efeito de aportes e resgates externos. O motor deve implementar duas modalidades hierárquicas compatíveis:

#### Modalidade A: Cota Diária Exata (Quando há saldos diários disponíveis)
No início da carteira ($t = 0$), define-se o valor da cota inicial $Q_0 = 100,00000000$ e a quantidade inicial de cotas $N_0 = \frac{P_0}{Q_0}$. Para cada dia útil $d$:
1. **Antes das movimentações externas de capital do dia $d$**, avalia-se o patrimônio dos ativos do dia anterior marcados aos preços do dia $d$ (incluindo proventos $D_d$ creditados no dia):
   $$P_{d}^{\text{pré-fluxo}} = P_d - F_d$$
   onde $F_d = \text{Aportes Externos}_d - \text{Resgates Externos}_d$ é o fluxo externo líquido de capital do dia $d$. *(Nota crucial: compras de ativos pagas com caixa já existente na carteira ou com proventos recebidos na carteira possuem $F_d = 0$; compras pagas com dinheiro novo vindo do bolso do investidor possuem $F_d = +\Delta C_d$, e vendas cujo recurso sai da carteira possuem $F_d = -\text{Valor Resgatado}_d$).*
2. **Atualização do Valor da Cota ($Q_d$) e Retorno do Dia ($r_d$):**
   $$Q_d = \frac{P_{d}^{\text{pré-fluxo}}}{N_{d-1}} = Q_{d-1} \times \left(\frac{P_d - F_d}{P_{d-1}}\right), \qquad r_d = \frac{Q_d}{Q_{d-1}} - 1$$
3. **Emissão ou Resgate de Cotas pelo Fluxo Externo ($F_d$):**
   $$N_d = N_{d-1} + \frac{F_d}{Q_d} = \frac{P_d}{Q_d}$$

#### Modalidade B: Método de Dietz Modificado / Simples Mensal (Quando há apenas snapshots mensais)
Quando o cálculo operar sobre snapshots mensais ($t-1 \to t$) com fluxo externo líquido $F_t$ (ou variação de capital aplicado $\Delta C_t = C_t - C_{t-1}$ ajustada por lucros/prejuízos realizados em vendas $\Delta \text{PnL}_{t}^{\text{real}}$):
1. **Fluxo Externo Líquido do Mês ($F_t$):**
   $$F_t = \sum_{k=1}^{K} f_{t,k} = \Delta C_t + \Delta \text{PnL}_{t}^{\text{real}}$$
2. **Ponderação Temporal de Cada Fluxo Intra-Mês ($w_{t,k}$):**
   $$w_{t,k} = \frac{D_{\text{mês}} - d_{t,k}}{D_{\text{mês}}}$$
   onde $D_{\text{mês}}$ é o total de dias corridos do mês e $d_{t,k}$ é o dia do fluxo $f_{t,k}$ (se a data exata intra-mês não estiver disponível, adota-se a convenção de fluxo no final do período $w_{t,k} = 0$ ou meio do período $w_{t,k} = 0,5$ de maneira uniforme).
3. **Fórmula do TWR Mensal ($\text{TWR}_t$):**
   $$\text{TWR}_t = \frac{P_t - P_{t-1} - F_t}{P_{t-1} + \sum_{k=1}^{K} \left(w_{t,k} \times f_{t,k}\right)}$$
   *(Para fluxos de fim de período onde $w_{t,k} = 0$, a fórmula reduz-se a $\text{TWR}_t = \frac{P_t - P_{t-1} - F_t}{P_{t-1}}$, eliminando imediatamente o erro brutal de `Set/2026`, `Out/2026` e `Nov/2026` onde o Axir omitiu o termo $- F_t$ no numerador!).*
4. **Encadeamento Recursivo da Cota e TWR Acumulado:**
   $$\text{Cota}_t = \text{Cota}_{t-1} \times \left(1 + \text{TWR}_t\right), \qquad \text{TWR}_{\text{acum}, t} = \frac{\text{Cota}_t}{100,00} - 1$$

### Etapa 3.2: Calendário Contínuo (*Calendar Spine Table*) e Restauração de `Ago/2026` — Correção dos `BUG-04` e `BUG-05`
1. **Geração Obrigatória de Série Contínua de Competências:**
   * A query ou serviço que monta a série histórica entre a data do primeiro aporte ($t_{\text{início}} = \text{Out/2024}$) e a data-base atual ($t_{\text{atual}} = \text{Nov/2026}$) deve gerar uma sequência contínua de meses (`generate_series('2024-10-01', '2026-11-01', '1 month')` no PostgreSQL ou equivalente no código).
   * **Proibição de Buracos Cronológicos:** Se por falha de processamento um mês fechado (como `Ago/2026`) não tiver snapshot persistido na tabela de cache, o motor deve:
     1. Reconstruir automaticamente o snapshot de `2026-08-31` a partir do ledger de transações até `31/08/2026` e das cotações históricas de fechamento de agosto de 2026; ou
     2. Caso não tenha havido nenhuma movimentação nem variação registrada entre `Jul/2026` e `Ago/2026`, interpolar explicitamente a linha `Ago/2026 fechado` com $P_{\text{Ago/26}} = P_{\text{Jul/26}}$, $C_{\text{Ago/26}} = C_{\text{Jul/26}}$, $\text{TWR}_{\text{Ago/26}} = 0,00\%$ e $\text{Cota}_{\text{Ago/26}} = \text{Cota}_{\text{Jul/26}}$.
2. **Contagem Exata de Competências:**
   * De `Out/2024` a `Nov/2026` existem exatas **$26$ competências** ($25$ meses fechados de `Out/2024` a `Out/2026` + $1$ competência parcial MTD em `Nov/2026`).
   * A janela móvel das últimas 12 competências (`12/25` a `11/26` ou `11/25` a `10/26` fechado + `11/26` MTD) deve conter sempre **$12$ meses fechados completos** para o cálculo de risco e consistência ($N = 12$ meses fechados, ex.: `6/12 meses`), nunca $11$ meses (`5/11 meses`).

### Etapa 3.3: Unificação da Fonte de Verdade (SSOT) do Mês Corrente (MTD) — Correção do `BUG-03`
1. **Eliminação da Divergência entre Dossiê (`+11,5%` / MTD `-1,1%`) e Extrato (`+7,7%` / MTD `-4,50%`):**
   * Investigar a origem da variação de custo de $-\text{R\$ } 188,11$ entre `Out/2026` ($\text{R\$ } 17.509,01$) e `Nov/2026` ($\text{R\$ } 17.320,90$) no Extrato, frente ao aviso do Dossiê de *"Sem movimentações financeiras registradas na competência"*.
   * Se a diferença de $-\text{R\$ } 188,11$ no custo entre `Out/2026` e `Nov/2026` decorreu da flutuação cambial do custo em dólar (porque `Out/2026` foi fechado com um dólar mais alto que $\text{R\$ } 5,25$), a correção da **Fase 2 (Etapa 2.1 — Custo Histórico Fixo em BRL)** fará com que o custo de `Out/2026` e `Nov/2026` seja rigorosamente idêntico ($\Delta C_{\text{Nov/26}} = \text{R\$ } 0,00$) quando não houver movimentações no mês!
   * Ambos os relatórios devem consumir o valor de $\text{TWR}_{\text{MTD}}$, $\text{TWR}_{\text{Acum}}$ e $\text{Cota}_{\text{Atual}}$ da mesma instância de `PerformanceSummaryDTO`.

### Etapa 3.4: Reconciliação da Série de Proventos e Retorno Total Histórico — Correção dos `BUG-07`, `BUG-08` e `BUG-09`
1. **Cálculo Mensal e Progressivo de Proventos no Extrato Analítico:**
   * Para cada competência mensal $t \in \{1, \dots, T\}$:
     $$\text{Proventos Mês}_t = \sum_{e \in \text{EventosProventos}(t)} \text{ValorLíquido}^{\text{BRL}}(e)$$
     $$\text{Proventos Acum.}_t = \sum_{k=1}^{t} \text{Proventos Mês}_k$$
   * **Invariante de Soma:** No extrato completo desde o início da carteira, a soma da coluna `Proventos Mês` deve ser idêntica ao card `Proventos no Período` e ao valor final da coluna `Proventos Acum.`:
     $$\sum_{t=1}^{T} \text{Proventos Mês}_t \equiv \text{Proventos no Período} \equiv \text{Proventos Acum.}_T$$
2. **Correção da Coluna `Retorno Total` em Cada Mês $t$ do Extrato:**
   * Com o `Proventos Acum.` progressivo real (e não o valor final estampado retroativamente em `Out/2024`), o retorno contábil acumulado em cada mês $t$ passa a refletir a verdade histórica daquele mês:
     $$\text{Retorno Total}_t = \frac{(P_t - C_t) + \text{Proventos Acum.}_t + \text{PnL}_{\text{acum}, t}^{\text{real}}}{C_t}$$
3. **Reconciliação entre Proventos da Custódia Ativa ($\text{R\$ } 1.757,57$) e Proventos Históricos Totais ($\text{R\$ } 1.794,47$):**
   * O Dossiê deve distinguir claramente duas métricas:
     * `Proventos da Custódia Ativa`: $\text{R\$ } 1.757,57$ (usado no **Card 3 — Retorno Contábil da Custódia Aberta**: $\frac{182,78 + 1.757,57}{17.319,94} = +11,20\%$).
     * `Proventos Históricos Totais (Incluindo Posições Encerradas)`: $\text{R\$ } 1.794,47$ ($\text{R\$ } 1.757,57$ de posições ativas + $\text{R\$ } 36,90$ de posições encerradas), que deve ser usado no **Card 4 — Resultado Histórico (P&L Econômico Total)** e no **Extrato Analítico**.

### Etapa 3.5: Motor de TIR / XIRR e P&L Econômico Total — Correção do `BUG-10`
1. **Reconciliação do Card 4 (`Resultado Histórico / P&L Econômico Total`):**
   * Conforme o próprio texto explicativo do Card 4 na página 10 do Dossiê, a fórmula implementada no backend deve somar as três parcelas econômicas reais da vida da carteira:
     $$\text{P\&L Econômico Total} = \underbrace{\left(P_{\text{total}} - C_{\text{total}}\right)}_{\text{Ganho de Capital Aberto}} + \underbrace{\text{PnL}_{\text{acum}, T}^{\text{real}}}_{\text{Lucro/Prejuízo Realizado em Vendas}} + \underbrace{\text{Proventos Acum.}_T}_{\text{Totalidade de Proventos Recebidos}}$$
2. **Padronização do Solver da TIR / XIRR (`Retorno do Bolso`):**
   * A Taxa Interna de Retorno Anualizada ($\text{XIRR}$) deve resolver a equação de Valor Presente Líquido nulo sobre todos os fluxos externos reais do investidor:
     $$\sum_{k=0}^{M} \frac{CF_k}{\left(1 + \text{XIRR}\right)^{\frac{d_k - d_0}{365}}} + \frac{P_{\text{total}, T}}{\left(1 + \text{XIRR}\right)^{\frac{d_T - d_0}{365}}} = 0$$
   * **Regra de Sinais dos Fluxos ($CF_k$):**
     * Aportes externos / compras com dinheiro novo: $CF_k < 0$ (saída do bolso do investidor).
     * Resgates externos / vendas sacadas da carteira: $CF_k > 0$ (retorno para o bolso do investidor).
     * Proventos ($D_k$): Se os proventos **não** estão embutidos no saldo de caixa final $P_{\text{total}, T}$ nem foram reinvestidos sem registro de novo aporte externo, cada provento líquido pago deve entrar como $CF_k = +D_k > 0$ na data do recebimento (ou, se reinvestidos automaticamente na carteira, a compra feita com dinheiro de proventos **não** pode entrar como fluxo negativo $CF_k < 0$, pois não saiu do bolso do investidor!).
     * *Diagnóstico do bug atual da TIR de $+1,4\%\text{ a.a.}$:* Quando o sistema registra uma compra feita com dinheiro de dividendos como se fosse um novo aporte externo negativo ($CF_k < 0$), mas não registra o dividendo recebido como fluxo positivo ($+D_k$), ele penaliza artificialmente a TIR/XIRR como se o investidor tivesse tirado mais $\text{R\$ } 1.794,47$ do próprio bolso!

### Portão de Qualidade 3 (Gate 3 — Critérios de Aprovação)
* [ ] Teste de Invariância de Aporte: Ao injetar um aporte de $+\text{R\$ } 10.000,00$ em qualquer dia $d$ sem variação de preço dos ativos, a variação do TWR no dia/mês é exatamente $0,0000\%$.
* [ ] O TWR Acumulado, o TWR MTD e a Cota na data-base são $100\%$ idênticos entre o Dossiê Executivo e o Extrato Analítico.
* [ ] A série cronológica entre `Out/2024` e `Nov/2026` possui todas as $26$ competências sem omissão de `Ago/2026`.
* [ ] $\sum \text{Proventos Mês} \equiv \text{Proventos Acum.}_T$ e nenhum mês histórico exibe proventos futuros retroativamente.
* [ ] Compras realizadas com saldo de proventos recebidos não são tratadas como saída de caixa do bolso do usuário na função `XIRR`.

---

## Fase 4: Motor de Alocação, Rebalanceamento (Target vs. Actual) e Taxonomia Multi-Dimensional (Raios-X)

O objetivo desta fase é corrigir a soma de metas de $200\%$ (**BUG-11**), a contradição textual na narrativa da Página 1 (**BUG-12**), o erro de classificação do `CDB ORIGINAL` como Prefixado (**BUG-13**), a classificação de Ouro, Bitcoin, China e Argentina como `US Equity` (**BUG-14**) e a contagem incorreta de segmentos (**BUG-16**).

### Etapa 4.1: Saneamento e Invariantes da Matriz de Alocação (`Target vs. Actual`)
1. **Invariante de Soma de Metas ($100,0\%$):**
   * Para qualquer carteira de usuário, o conjunto de classes de alocação ativas $\mathcal{C}_{\text{ativas}}$ deve satisfazer:
     $$\sum_{c \in \mathcal{C}_{\text{ativas}}} w_{c}^{\text{meta}} = 100,00\% \quad (\text{tolerância máxima de arredondamento: } \pm 0,01\%)$$
   * **Validação de Backend e Banco de Dados:** Criar uma *constraint* / transação atômica no endpoint `PUT /api/allocation-targets`: toda atualização de metas substitui ou atualiza o conjunto canônico de classes de forma que a soma seja sempre igual a $100\%$.
2. **Script de Migração e Limpeza de Categorias Legadas Órfãs:**
   * Identificar usuários que possuem registros de metas em taxonomias antigas (`Fundos Imobiliários`, `Ações De Dividendos`, `Renda Fixa CDI`, `REITs Globais`) coexistindo com a taxonomia canônica atual (`FIIs`, `Ações`, `Renda Fixa`, `ETFs`, `Internacional`, `Caixa`).
   * Mapear todos os ativos para o enumerador canônico único (`CanonicalAssetClass`) e remover/desativar na tabela de metas do usuário as categorias legadas órfãs com saldo $\text{R\$ } 0,00$ quando a soma das classes canônicas já totalizar $100,0\%$.
3. **Invariante de Soma Zero dos Gaps ($\sum \text{Gap}_c = \text{R\$ } 0,00$):**
   * Para cada classe $c \in \mathcal{C}_{\text{ativas}}$:
     $$w_{c}^{\text{atual}} = \frac{V_c}{P_{\text{total}}}, \qquad V_{c}^{\text{meta}} = P_{\text{total}} \times w_{c}^{\text{meta}}, \qquad \text{Gap}_c = V_c - V_{c}^{\text{meta}}$$
   * Como $\sum V_c = P_{\text{total}}$ e $\sum w_{c}^{\text{meta}} = 1$, segue matematicamente que:
     $$\sum_{c \in \mathcal{C}_{\text{ativas}}} \text{Gap}_c = \sum V_c - P_{\text{total}} \sum w_{c}^{\text{meta}} = P_{\text{total}} - P_{\text{total}} = \text{R\$ } 0,00$$
4. **Fórmula Oficial do Índice de Equilíbrio Geral ($IEG \in [0\%, 100\%]$):**
   * Utilizando a distância $L_1$ normalizada (Distância de Variação Total entre a distribuição atual e a distribuição-alvo):
     $$IEG = \max\left(0\%, \ 100\% - \frac{1}{2} \sum_{c \in \mathcal{C}_{\text{ativas}}} \left|w_{c}^{\text{atual}} - w_{c}^{\text{meta}}\right|\right)$$
   * **Validação no Golden Dataset (`BR-20261118-6445`):**
     Com as $6$ classes canônicas (`Renda Fixa`: $|18,17\% - 25,00\%| = 6,83\%$; `ETFs`: $|0,70\% - 5,00\%| = 4,30\%$; `Ações`: $|20,99\% - 25,00\%| = 4,01\%$; `Caixa`: $|0,01\% - 0,00\%| = 0,01\%$; `FIIs`: $|20,99\% - 20,00\%| = 0,99\%$; `Internacional`: $|39,15\% - 25,00\%| = 14,15\%$):
     $$\sum \left|w_{c}^{\text{atual}} - w_{c}^{\text{meta}}\right| = 30,29\% \implies IEG = 100\% - \frac{30,29\%}{2} = 84,86\% \approx 85\%$$

### Etapa 4.2: Reforma da Taxonomia Multi-Dimensional para os Raios-X — Correção dos `BUG-13`, `BUG-14` e `BUG-16`
1. **Raio-X de Renda Fixa (Unificação de Indexadores — Página 7 vs. Páginas 4 e 5):**
   * Unificar o campo `indexer_category` no modelo de títulos de Renda Fixa usando um enumerador estrito:
     * `POS_FIXADO_CDI_SELIC` $\to$ Rótulo: `Pós-fixado (CDI / Selic)` (`TESOURO-SELIC`: $\text{R\$ } 1.617,51$ + `CDB ORIGINAL`: $\text{R\$ } 1.348,01 = \text{R\$ } 2.965,52$ / $93,3\%$, $2$ títulos).
     * `INFLACAO_IPCA` $\to$ Rótulo: `Inflação (IPCA+)` (`TESOURO-IPCA`: $\text{R\$ } 214,65$ / $6,7\%$, $1$ título).
     * `PREFIXADO` $\to$ Rótulo: `Prefixado` ($\text{R\$ } 0,00$ / $0,0\%$, $0$ títulos).
   * Garantir que o gráfico da página 7 consuma exatamente o mesmo atributo `indexer_category` usado na coluna `INDEXADOR / VENCIMENTO` da página 4 e na tabela `Diversificação por Segmento & Indexador` da página 5.
2. **Raio-X Internacional (Desacoplamento entre País de Custódia/Listagem e Exposição Econômica/Geográfica — Página 8):**
   * Separar no schema de cadastro de ativos (`AssetMetadata`) três dimensões independentes:
     * `custody_currency_vehicle`: `USD_DIRECT` (Conta Internacional em Dólar Direto) vs. `BDR_B3` vs. `ETF_B3`.
     * `economic_region_exposure`: Região geográfica real do ativo subjacente.
     * `international_asset_theme`: Subclasse/tema econômico do ativo internacional.
   * **Mapeamento Correto para os $6$ Ativos Internacionais do Caso-Base ($\text{R\$ } 6.852,60$):**
     * `VOO` ($\text{R\$ } 3.616,83$ / $52,8\%$): Região = `Estados Unidos (US Equity)` ($1$ ativo).
     * `GLD` ($\text{R\$ } 1.872,26$ / $27,3\%$): Região/Tema = `Commodities Globais / Ouro` ($1$ ativo).
     * `BITB` ($\text{R\$ } 584,65$ / $8,5\%$): Região/Tema = `Criptoativos Globais / Bitcoin` ($1$ ativo).
     * `VEA` ($\text{R\$ } 329,15$ / $4,8\%$): Região = `Mercados Desenvolvidos (ex-EUA)` ($1$ ativo).
     * `ARGT` ($\text{R\$ } 227,63$ / $3,3\%$) + `MCHI` ($\text{R\$ } 222,08$ / $3,2\%$): Região = `Mercados Emergentes (China & América Latina)` ($\text{R\$ } 449,71$ / $6,6\%$, $2$ ativos).
   * Atualizar a regra do alerta de concentração do Raio-X Internacional: com `VOO` representando $52,8\%$ da carteira internacional (e não $95,2\%$), o diagnóstico de diversificação geográfica passa a refletir a exposição real do investidor.
3. **Correção da Contagem de Segmentos na Página 5 (`Diversificação por Segmento & Indexador`):**
   * O contador exibido no subtítulo (`X segmentos`) e no centro do gráfico de rosca (`X SETORES`) deve ser calculado dinamicamente via `displayed_rows.length` da lista efetivamente renderizada (ou, se houver truncamento top-$N$ em `Outros Setores`, exibir `9 segmentos agrupados (de X totais)`), eliminando a divergência entre `10 segmentos` declarados e `9 linhas` exibidas.

### Etapa 4.3: Motor de Narrativa Automatizada (NLG) Determinístico — Correção do `BUG-12`
* O parágrafo executivo da Página 1 deve ser gerado **após** a validação da Matriz de Alocação saneada (soma de metas $= 100\%$).
* **No Golden Dataset corrigido**, o texto gerará automaticamente:
  * Maior distanciamento negativo da meta (déficit): **Renda Fixa** ($\text{Gap} = -\text{R\$ } 1.195,75$), seguida por **ETFs** ($-\text{R\$ } 752,85$) e **Ações** ($-\text{R\$ } 702,18$).
  * Classes acima do planejado (superávit): **Internacional** ($+\text{R\$ } 2.476,68$) e **FIIs** ($+\text{R\$ } 173,14$).
  * Elimina-se completamente a frase contraditória que apontava déficit em *"Fundos Imobiliários (-R$ 7.001,47)"* e superávit em *"FIIs"*.

### Portão de Qualidade 4 (Gate 4 — Critérios de Aprovação)
* [ ] Invariante $\sum w_{c}^{\text{meta}} = 100,00\%$ e $\sum \text{Gap}_c = \text{R\$ } 0,00$ garantido por testes de contrato de API.
* [ ] Índice de Equilíbrio Geral ($IEG$) recalculado para $84,9\%$ ($85\%$) no Golden Dataset.
* [ ] Soma de cada categoria de indexador no Raio-X de Renda Fixa (Página 7) bate centavo a centavo com a soma dos títulos por indexador na Custódia (Página 4) e no gráfico de Segmentos (Página 5).
* [ ] Nenhum ETF de Commodity (`GLD`), Cripto (`BITB`) ou Mercados Emergentes (`MCHI`, `ARGT`) é rotulado como `Estados Unidos (US Equity)`.

---

## Fase 5: Motor de Benchmarks, Índices Macroeconômicos e Métricas de Risco (Padrão CFA / ANBIMA)

O objetivo desta fase é corrigir o erro de fator $100\times$ no Ibovespa de 25 meses (**BUG-15**), alinhar as janelas temporais dos benchmarks com a carteira, recalcular o Ganho Real pela Equação de Fisher sobre o TWR unificado e corrigir a incompatibilidade dimensional do Índice de Sharpe (**BUG-16**).

### Etapa 5.1: Padronização de Escala e Capitalização de Benchmarks (`CDI`, `IPCA`, `Ibovespa`, `Poupança`)
1. **Convenção Única de Representação Interna de Taxas:**
   * Definir em todo o código-fonte do motor uma convenção única documentada em tipo forte (ex.: `RateDecimal` onde $+11,5\%$ é armazenado internamente como $0,115000$ e $+100,17\%$ é armazenado como $1,001650$, sendo multiplicado por $100$ **exclusivamente** no formatador visual `formatPercentage(rate: RateDecimal)`).
   * **Correção do Bug do Ibovespa (`BUG-15`):**
     * No código atual, o retorno acumulado de 25 meses do Ibovespa ($R_{\text{Ibov, 25M}}$) chegou ao componente de benchmark como `1.00165` já tratado como percentual (`1,0%`) em vez de decimal ($1,00165 \times 100\% = 100,2\%$).
     * Garantir que todas as séries de benchmarks passem pela mesma função de acumulação por produtório (ou razão de pontos do índice):
       $$R_{\text{Bench}}(t_0, t_1) = \left[\prod_{k=t_0}^{t_1} \left(1 + r_{\text{Bench}, k}\right)\right] - 1 \quad \text{ou} \quad R_{\text{Ibov}}(t_0, t_1) = \frac{\text{Pontos}_{\text{Ibov}}(t_1)}{\text{Pontos}_{\text{Ibov}}(t_0)} - 1$$
2. **Fórmulas de Comparação Relativa com Benchmarks:**
   Para o retorno acumulado da carteira $R_{\text{Cart}}$ e o retorno acumulado do benchmark $R_{\text{Bench}}$ exatamente na mesma janela $[t_0, t_1]$:
   * **Diferença / Excesso em Pontos Percentuais (`Spread p.p.`):**
     $$\Delta_{\text{p.p.}} = \left(R_{\text{Cart}} - R_{\text{Bench}}\right) \times 100$$
   * **Percentual do Benchmark (`% do Benchmark`):**
     * Se $R_{\text{Bench}} > 0$ e $R_{\text{Cart}} \ge 0$:
       $$\% \text{ do Benchmark} = \frac{R_{\text{Cart}}}{R_{\text{Bench}}} \times 100\%$$
     * *Regra de Guarda Estatística:* Se $R_{\text{Bench}} \le 0$ (ex.: Ibovespa negativo no período), a razão simples $\frac{R_{\text{Cart}}}{R_{\text{Bench}}}$ perde significado econômico; nesse caso, exibir `"N/A (Benchmark Negativo)"` ou exibir apenas o excesso em pontos percentuais ($\Delta_{\text{p.p.}}$).
   * **Ganho Real Acima da Inflação (Equação Exata de Fisher):**
     $$R_{\text{Real (Fisher)}} = \frac{1 + R_{\text{Cart}}}{1 + R_{\text{IPCA}}} - 1$$

### Etapa 5.2: Métricas de Risco e Consistência (Padrão CFA & ANBIMA) — Correção do `BUG-16`
Conforme a nota metodológica da Página 9, a competência parcial corrente (`MTD`) é segregada das métricas estatísticas para evitar amostragem heterogênea (comparar meses de $30$ dias com um mês parcial de $18$ dias). Assim, a janela anual de risco deve compreender sempre os **últimos $N = 12$ meses fechados completos** ($r_1, r_2, \dots, r_{12}$):

1. **Média Aritmética Mensal ($\bar{r}$) e Desvio Padrão Amostral Mensal ($s_m$):**
   $$\bar{r} = \frac{1}{N} \sum_{t=1}^{N} r_t, \qquad s_m = \sqrt{\frac{1}{N - 1} \sum_{t=1}^{N} \left(r_t - \bar{r}\right)^2}$$
2. **Volatilidade Anualizada ($\sigma_{\text{anual}}$):**
   $$\sigma_{\text{anual}} = s_m \times \sqrt{12}$$
3. **Max Drawdown (Maior Retração Pico-Fundo na Série de Cotas $Q_0, Q_1, \dots, Q_N$):**
   $$M_t = \max_{0 \le k \le t} Q_k, \qquad DD_t = \frac{Q_t}{M_t} - 1, \qquad \text{Max Drawdown} = \min_{1 \le t \le N} DD_t$$
   *(Opcionalmente, se o Max Drawdown intradiário/MTD da competência corrente superar o drawdown dos meses fechados, o sistema pode reportar o Max Drawdown incluindo o MTD ou explicitar se a janela é estritamente dos $12$ meses fechados).*
4. **Consistência Mensal:**
   $$\text{Meses Positivos} = \sum_{t=1}^{N} \mathbb{I}(r_t > 0), \qquad \text{Consistência (\%)} = \frac{\text{Meses Positivos}}{N} \times 100\%$$
   Com a restauração de `Ago/2026`, o denominador de uma janela anual completa será sempre $N = 12$ (`X/12 meses`), nunca `5/11 meses`.
5. **Correção Dimensional do Índice de Sharpe ($\text{Sharpe}_{\text{anual}}$):**
   * O numerador e o denominador do Índice de Sharpe devem estar rigorosamente na **mesma base temporal (anualizada)** e cobrir exatamente os mesmos $N$ meses fechados:
     $$R_{\text{Cart, anual}} = \left[\prod_{t=1}^{N} \left(1 + r_t\right)\right]^{\frac{12}{N}} - 1, \qquad R_{\text{CDI, anual}} = \left[\prod_{t=1}^{N} \left(1 + r_{\text{CDI}, t}\right)\right]^{\frac{12}{N}} - 1$$
     $$\text{Sharpe}_{\text{anual}} = \frac{R_{\text{Cart, anual}} - R_{\text{CDI, anual}}}{\sigma_{\text{anual}}}$$
   * *(Alternativamente, pelo método de excesso mensal médio do CFA Institute: define-se o retorno excedente mensal $e_t = r_t - r_{\text{CDI}, t}$, calcula-se $\bar{e} = \frac{1}{N}\sum e_t$ e $s_e = \sqrt{\frac{1}{N-1}\sum (e_t - \bar{e})^2}$, e obtém-se $\text{Sharpe}_{\text{anual}} = \frac{\bar{e}}{s_e} \times \sqrt{12}$. Ambas as abordagens são dimensionalmente consistentes, ao contrário da implementação atual que subtraiu um retorno de $11$ meses de um CDI de $12$ meses).*

### Portão de Qualidade 5 (Gate 5 — Critérios de Aprovação)
* [ ] Nenhum benchmark apresenta erro de escala decimal vs. percentual (teste unitário verificando que `1.00165` é renderizado como `100,2%` e não `1,0%`).
* [ ] A Equação de Fisher $\frac{1 + R_{\text{Cart}}}{1 + R_{\text{IPCA}}} - 1$ utiliza exatamente o mesmo $R_{\text{Cart}}$ exibido no cabeçalho do Dossiê e na linha final do Extrato.
* [ ] A janela anual de métricas de risco utiliza $N = 12$ meses fechados consecutivos sem lacunas e calcula o Índice de Sharpe com numerador e denominador na mesma base anualizada.

---

## Fase 6: Padronização de Arredondamento, Contratos de API e Governança de Relatórios (UI & PDF)

O objetivo desta fase final é blindar a camada de apresentação (Dashboard Web/Mobile e geradores de PDF do **Dossiê Executivo** e do **Extrato Analítico**) para que ambos os documentos sejam meras projeções visuais de um único objeto de domínio validado.

### Etapa 6.1: Contrato Unificado de Snapshot (`UnifiedPortfolioReportPayload`)
Refatorar os geradores do **Dossiê Executivo** e do **Extrato Analítico** para receberem exatamente a mesma estrutura de dados gerada pelo `PortfolioAuditEngine`:

```typescript
export interface UnifiedPortfolioReportPayload {
  reportId: string;                 // Ex: "BR-20261118-6445"
  referenceDate: string;            // Ex: "2026-11-18"
  ptaxReference: {
    rate: string;                   // Decimal 4 casas, ex: "5.2500"
    bulletinDate: string;           // Data/hora do boletim BCB
  };
  summary: {
    assetsMarketValueBrl: string;   // R$ 17.502,72
    cashReserveBrl: string;         // R$ 0,96
    totalEquityBrl: string;         // R$ 17.503,68 (Invariante: assets + cash)
    assetsAcquisitionCostBrl: string; // R$ 17.319,94
    totalAppliedCostBrl: string;    // R$ 17.320,90 (Invariante: assetsCost + cash)
    openCapitalGainBrl: string;     // R$ 182,78 (Invariante: totalEquity - totalAppliedCost)
    openCapitalGainPct: string;     // +1,06% (+1,1%)
    activePositionsDividendsBrl: string; // R$ 1.757,57
    closedPositionsDividendsBrl: string; // R$ 36,90
    totalHistoricalDividendsBrl: string; // R$ 1.794,47 (Invariante: active + closed)
    realizedCapitalGainClosedBrl: string; // Lucros/prejuízos realizados em vendas passadas
    openAccountingReturnBrl: string; // R$ 1.940,35 (openCapitalGain + activeDividends)
    openAccountingReturnPct: string; // +11,20% (+11,2%)
    totalEconomicPnlBrl: string;    // openCapitalGain + realizedClosed + totalHistoricalDividends
    twrCumulativePct: string;       // Único para Dossiê e Extrato
    twrAnnualizedPct: string;       // Padrão CVM/ANBIMA
    currentQuotaValueBrl: string;   // Base 100.00 -> 100 * (1 + twrCumulative)
    xirrAnnualizedPct: string;      // Retorno do bolso ponderado por tempo
    durationDays: number;           // Ex: 748
  };
  allocationMatrix: {
    equilibriumIndexPct: string;    // Ex: 84,9% (85%)
    totalTargetPct: string;         // Invariante estrito: 100,0%
    totalGapBrl: string;            // Invariante estrito: R$ 0,00
    items: AllocationRowDTO[];      // Apenas classes canônicas ativas
  };
  custodyByClass: CustodyClassGroupDTO[];
  xRays: {
    equitiesProfile: XRayGroupDTO;
    equitiesMarketCap: XRayGroupDTO;
    fiisStrategy: XRayGroupDTO;
    fixedIncomeIndexers: XRayGroupDTO; // Vinculado ao campo canônico do título
    fixedIncomeIssuers: XRayGroupDTO;
    internationalRegions: XRayGroupDTO; // Vinculado à região econômica real do ativo subjacente
    internationalVehicles: XRayGroupDTO;
    consolidatedSegments: XRayGroupDTO; // Contagem dinâmica igual ao número de linhas
  };
  monthlyEvolutionSeries: MonthlyEvolutionRowDTO[]; // Série contínua sem buracos (Calendar Spine)
  benchmarksAndRisk: BenchmarksAndRiskDTO;
}
```

### Etapa 6.2: Validador Pré-Emissão (*Pre-Flight Mathematical Audit Guard*)
Implementar um *middleware* validador (`PortfolioReportInvariantValidator.validate(payload)`) que é executado obrigatoriamente antes de renderizar qualquer PDF ou resposta de API. Se qualquer uma das $12$ asserções abaixo falhar, o sistema bloqueia a geração do relatório sujo, registra o erro estruturado no log de observabilidade e dispara o recálculo automático do snapshot:

1. **Asserção 1 (Patrimônio):** $V_{\text{ativos}} + V_{\text{caixa}} == P_{\text{total}}$
2. **Asserção 2 (Custo):** $C_{\text{ativos}} + V_{\text{caixa}} == C_{\text{total}}$
3. **Asserção 3 (Ganho de Capital Aberto):** $P_{\text{total}} - C_{\text{total}} == V_{\text{ativos}} - C_{\text{ativos}} == \Delta V_{\text{aberto}}$
4. **Asserção 4 (Soma de Custódia Individual):** Para cada ativo $i$, $\text{round}(Q_i \times P_i \times FX_i, 2) == V_i$, e $\sum_{i=1}^{N} V_i == V_{\text{ativos}}$.
5. **Asserção 5 (Consistência de Cota e TWR):** $\text{round}(100 \times (1 + \text{TWR}_{\text{acum}, T}), 2) == \text{Cota}_T$, e o $\text{TWR}_{\text{acum}, T}$ do Dossiê é idêntico ao da linha final do Extrato.
6. **Asserção 6 (Continuidade Cronológica):** Para toda linha $t \in \{2, \dots, T\}$ da série mensal, $\text{Competência}_t == \text{Competência}_{t-1} + 1\text{ mês}$ (zero meses saltados).
7. **Asserção 7 (Encadeamento de Cotas):** Para toda linha $t \in \{1, \dots, T\}$, $\left|\text{Cota}_t - \text{Cota}_{t-1} \times (1 + \text{TWR}_t)\right| \le 0,01$.
8. **Asserção 8 (Reconciliação de Proventos):** $\sum_{t=1}^{T} \text{Proventos Mês}_t == \text{Proventos Acum.}_T$, e $\text{Proventos Acum.}_t \le \text{Proventos Acum.}_{t+1}$ para todo $t$.
9. **Asserção 9 (Soma de Metas e Gaps):** $\left|\sum w_{c}^{\text{meta}} - 100,0\%\right| \le 0,01\%$ e $\left|\sum \text{Gap}_c\right| \le \text{R\$ } 0,02$.
10. **Asserção 10 (Reconciliação de Raios-X):** A soma dos saldos de cada gráfico de Raio-X é idêntica ao subtotal da respectiva classe na tabela de custódia, e a soma do indexador `Pós-fixado (CDI / Selic)` na página 7 é idêntica à soma na página 5.
11. **Asserção 11 (Contagem de Segmentos e Meses):** O rótulo `X segmentos` na página 5 é igual ao número de linhas da tabela (`rows.length`), e a janela anual de risco possui exatamente $12$ meses fechados quando a carteira tem $\ge 12$ meses de histórico fechado.
12. **Asserção 12 (Sanidade de Escala de Benchmarks):** Nenhum benchmark exibe razão `% do Benchmark` calculada sobre taxa não convertida de decimal para percentual.

---

## Portão de Qualidade Final (Gate 6 — Checklist de Certificação de Produção)

Ao concluir a implementação das Fases 0 a 6, o editor de código deve executar a suíte de verificação completa sobre o **Golden Dataset (`BR-20261118-6445`)** e confirmar os seguintes resultados esperados:

| Indicador Auditado no Golden Dataset | Valor Antigo (Com Bug) | Valor Esperado Pós-Refatoração | Status Exigido |
| :--- | :--- | :--- | :--- |
| **Custo Total (Dossiê vs. Extrato)** | $\text{R\$ } 17.319,94$ vs. $\text{R\$ } 17.320,90$ | Reconciliado ($\text{R\$ } 17.319,94$ ativos + $\text{R\$ } 0,96$ caixa) | $100\%$ Consistente |
| **Competência `Ago/2026`** | Omitida (`07/26` $\to$ `09/26`) | Presente na tabela e nos gráficos ($26$ competências) | $100\%$ Contínuo |
| **TWR `Set/2026` (c/ aporte de $\text{R\$ } 368,80$)** | $+4,69\%$ (sem expurgo) | $+2,61\%$ (com expurgo do fluxo) | Fluxo Isolado |
| **TWR `Out/2026` (c/ aporte de $\text{R\$ } 338,18$)** | $-1,31\%$ (sem expurgo) | $-3,13\%$ (com expurgo do fluxo) | Fluxo Isolado |
| **TWR `Nov/2026` (Dossiê vs. Extrato)** | $-1,1\%$ vs. $-4,50\%$ | Unificado via SSOT (sem divergência entre PDFs) | $100\%$ Unificado |
| **Proventos Mês (Extrato)** | $\text{R\$ } 0,00$ em todas as $25$ linhas | Valores reais pagos em cada mês ($\sum = \text{R\$ } 1.794,47$) | $100\%$ Reconciliado |
| **Custo Internacional em BRL** | $\text{US\$ } 1.080,43 \times \text{PTAX}_{\text{atual}}$ | $\sum (\text{Lote}_{\text{USD}} \times \text{FX}_{\text{compra}})$ (efeito cambial real) | Câmbio Histórico |
| **Var. Cota `BITB` (USD)** | $-11,0\%$ | $-10,9\%$ ($-10,9438\%$) | Arred. Correto |
| **Soma da Coluna `Meta (%)`** | $200,0\%$ ($10$ classes) | $100,0\%$ ($6$ classes canônicas ativas) | Invariante $100\%$ |
| **Soma da Coluna `Gap (R$)`** | $-\text{R\$ } 17.503,68$ | $\text{R\$ } 0,00$ | Invariante Zero |
| **Índice de Equilíbrio Geral ($IEG$)** | $35\%$ | $84,9\%$ ($85\%$) | Recalculado |
| **Raio-X Renda Fixa: Pós-fixado vs. Pref.** | $50,9\%$ Pós / $42,4\%$ Pref. | $93,3\%$ Pós ($\text{R\$ } 2.965,52$) / $0,0\%$ Pref. | Classificação Fiel |
| **Raio-X Internacional: `US Equity`** | $95,2\%$ ($5$ ativos: inclui Ouro/BTC/China/Arg) | $52,8\%$ ($1$ ativo: `VOO` = $\text{R\$ } 3.616,83$) | Exposição Real |
| **Contagem de Segmentos (Página 5)** | `10 segmentos` declarados / `9` listados | Contagem dinâmica exata (`9 segmentos`) | UI Consistente |
| **Benchmark Ibovespa (25M)** | `1,0%` (`1.148,0% do Ibov`) | `100,2%` (`11,5% do Ibov` na base do sistema) | Escala Corrigida |
| **Janela Anual de Risco & Sharpe** | $11$ meses (`5/11`) e Sharpe misto | $12$ meses fechados (`X/12`) e Sharpe anualizado homogêneo | Padrão CFA/ANBIMA |
