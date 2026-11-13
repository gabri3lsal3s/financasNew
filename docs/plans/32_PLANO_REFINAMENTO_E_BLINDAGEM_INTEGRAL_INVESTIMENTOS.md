# PLANO 32 — Refinamento, Blindagem Matemática e Evolução Integral de Investimentos

> **Status:** Proposto para Execução · **Canônico**  
> **Data de Emissão:** 2026-11-13  
> **Autoridade:** Antigravity AI & Engenharia Financeira  
> **Referência:** `AGENTS.md`, `ESPECIFICACAO_TECNICA.md`, `FINANCIAL_MATH_SPEC.md`, `docs/plans/31_PLANO_AUDITORIA_INTEGRAL_INVESTIMENTOS.md`

---

## 1. RESUMO EXECUTIVO & ESCOPO

Após a auditoria de ponta a ponta e a homologação do Plano 31 (que saneou sobrecargas de banco, rastreabilidade de splits e média ponderada de YoC), foi realizada uma análise matemática, contábil e de usabilidade minuciosa de cada cálculo, fórmula, transição de estado e diálogo do ecossistema de investimentos.

Esta análise detalhada revelou **8 pontos de refinamento e blindagem**, distribuídos entre:
1. **Precisão Temporal e Fiscal:** Critério de desempate determinístico em ordens no mesmo dia e compensação contínua de prejuízos passados no monitor de DARF 6015;
2. **Motores de Rebalanceamento e Valoração:** Suporte a frações de títulos do Tesouro Direto (0,01) e proteção contra arredondamento prematuro de cotações sub-centavos (< R$ 0,01);
3. **Consistência Contábil de Proventos:** Identificação e classificação imutável de JCP no relatório anual de IRPF;
4. **Ergonomia e Governança de UI:** Unificação de grupamento (`reverse_split`) no Wizard de Investimentos, migração de abas artesanais para o primitivo `<Tabs />` e uso de `<MoneyInput />` para resgates parciais de Renda Fixa.

---

## 2. MATRIZ DE ACHADOS & METAS DE REMEDIAÇÃO

| ID | Severidade | Módulo / Arquivo | Descrição da Fragilidade / Incongruência | Meta de Remediação |
|---|---|---|---|---|
| **INV-08** | Média/Alta | `portfolio-darf-monitor.tsx` e `operations.ts` | **Desempate Intraday Indeterminado:** Ordenação apenas por `date` (`a.date.localeCompare(b.date)`) não garante que compras/splits precedam vendas ocorridas no mesmo dia, podendo zerar a custódia antes da hora e supertributar vendas. | Implementar ordenação determinística: eventos corporativos $\rightarrow$ compras $\rightarrow$ vendas no desempate de mesma data. |
| **INV-09** | Alta | `portfolio-darf-monitor.tsx` e `tax.ts` | **Ausência de Compensação de Prejuízos Anteriores:** `PortfolioDarfMonitor` não calcula nem repassa `previousLosses` ao motor `calculateMonthlyDarf`, cobrando DARF indevido de quem tem prejuízo acumulado legal a abater. | Criar função de agregação histórica de prejuízos não compensados anteriores ao mês selecionado e repassar ao `calculateMonthlyDarf`. |
| **INV-10** | Média/Alta | `src/domain/portfolio/aporte.ts` | **Trava de Cota Inteira no Tesouro Direto:** `resolveAssetPrecision` retorna `0` para qualquer ativo em `BRL`, impedindo frações de 0,01 do Tesouro Direto e bloqueando aportes abaixo do valor cheio de 1 título (~R$ 15.000). | Permitir precisão de 2 casas decimais para Tesouro Direto (`isTesouroAsset`) e alocação financeira direta para Renda Fixa. |
| **INV-11** | Média | `tax.ts` e `dividends.ts` | **Fragilidade na Detecção de JCP para IRPF:** A tabela `portfolio_dividends` não tem coluna `type`, e `classifyAnnualDividendsReport` busca "JCP" no texto de `notes`. Notas customizadas pelo usuário perdem o tipo e classificam JCP erroneamente como provento isento. | Forçar prefixo estruturado `[JCP]` em `resolveDividendNote` sempre que `type === "jcp"` e cruzar com o ledger. |
| **INV-12** | Média | `valuation.ts` | **Arredondamento Prematuro de Cotações Sub-Centavos:** `calculatePositionSummary` arredonda `priceBRL` para 2 casas decimais antes de multiplicar pela quantidade, zerando cotações de micro-ativos cotados abaixo de R$ 0,01. | Manter precisão de ponto flutuante na cotação intermediária e arredondar apenas o valor consolidado final em centavos. |
| **INV-13** | Média | `wizard-state.ts`, `step-order.tsx` e `investment-wizard.tsx` | **Grupamento Ausente no Wizard:** O Wizard possui a operação `split` (desdobramento 1 para N), mas não contempla `reverse_split` (grupamento N para 1), que só existe no `AssetSplitDialog`. | Adicionar a opção "Grupamento (N para 1)" no seletor de operações do Wizard com validação de fator e cálculo reverso de PM. |
| **INV-14** | Baixa | `asset-sell-tab.tsx` | **Input Numérico sem Máscara de Moeda:** Resgate de Renda Fixa em modo `total_value` usa `NumericInput` livre em vez de `MoneyInput` monetário formatado. | Migrar campo de valor a resgatar para `MoneyInput` com máscara de centavos e prevenção de erros de digitação. |
| **INV-15** | Baixa | `asset-form-dialog.tsx` | **Abas Artesanais em Diálogo:** Alternância entre "Editar Dados & Compras" e "Venda" usa tags nativas `<button>` com estilos manuais, violando as Regras 4 e 7 do AGENTS.md. | Migrar o bloco para o componente canônico `<Tabs />` com abas fluidas e acessibilidade completa. |

---

## 3. ANÁLISE MATEMÁTICA E CONTÁBIL DOS CÁLCULOS

### 3.1 Preço Médio Ponderado e Reconstituição Temporal (INV-08)
- **Fórmula Canônica (Receita Federal / CVM):**
  $$\text{PM}_t = \frac{\text{PM}_{t-1} \times Q_{t-1} + P_{\text{compra}} \times Q_{\text{compra}}}{Q_{t-1} + Q_{\text{compra}}}$$
- **Venda Parcial:** O Preço Médio permanece estritamente constante ($\text{PM}_t = \text{PM}_{t-1}$).
- **Invariante de Desempate Temporal:** Quando múltiplas transações ocorrem no mesmo dia $D$:
  $$\text{OrderWeight}(\text{split / reverse\_split}) < \text{OrderWeight}(\text{buy / subscription}) < \text{OrderWeight}(\text{sell})$$
  Isso garante que um desdobramento ou compra ocorrida no mesmo dia de uma venda aumente a custódia antes que a venda deduza as cotas e calcule o lucro líquido.

### 3.2 Compensação Contínua de Prejuízos Acumulados no DARF (INV-09)
- **Regra Legal (IN RFB 1.585/2015, art. 56):**
  - Prejuízos em Ações comuns abatem lucros futuros em Ações comuns;
  - Prejuízos em FIIs abatem exclusivamente lucros futuros em FIIs;
  - Prejuízos em ETFs/BDRs abatem lucros em ETFs/BDRs;
  - Prejuízos são transportados indefinidamente mês a mês até integral compensação.
- **Algoritmo de Replay Fiscal:**
  Para o mês de consulta $M$, o sistema deve iterar cronologicamente sobre todos os meses $m < M$, apurando o saldo líquido de perdas e subtraindo dos ganhos do mesmo ativo/classe para gerar o `previousLosses` inicial exato do mês $M$.

### 3.3 Fracionamento e Cotas Mínimas no Tesouro Direto (INV-10)
- **Regra da Secretaria do Tesouro Nacional (STN):**
  - Aplicação mínima: 1% de 1 título (0,01 título) ou R$ 30,00;
  - Precisão necessária no motor de rebalanceamento: `precision = 2`.
  - Para `isTesouroAsset(ticker, class) = true`:
    $$\text{Quantidade Comprável} = \text{floor}\left( \frac{\text{Budget}}{\text{Preço Título}} \times 100 \right) \div 100$$
  Isso viabiliza aportes realistas de R$ 100 a R$ 1.000 em títulos cujo valor nominal unitário ultrapassa R$ 10.000 (ex: Tesouro Selic).

### 3.4 Precisão de Micro-Cotações (< R$ 0,01) (INV-12)
- **Problema de Truncamento:**
  `priceBRL = Math.round(price * rate * 100) / 100` $\rightarrow$ para `price = $0.001` e `rate = 5.25`, `0.00525` vira `0.00`.
- **Fórmula Corrigida:**
  $$\text{valueBRL} = \text{round2}(Q \times (\text{priceQuote} \times \text{rate}))$$
  mantendo `priceBRL` com até 6 ou 8 casas decimais em tela se $P < 0,01$, sem truncamento prematuro do valor total da posição.

---

## 4. FASES DE IMPLEMENTAÇÃO E CRONOGRAMA

### Fase 1: Blindagem de Cálculos Fiscais & Temporalidade (INV-08, INV-09 & INV-11)
- **Ações:**
  1. Em `src/domain/portfolio/tax.ts`, criar função pura `calculateHistoricalLossesCarryover(transactions, assets, targetMonth)` que computa os prejuízos acumulados transportados de meses anteriores;
  2. Em `src/features/investments/components/portfolio-darf-monitor.tsx`:
     - Implementar o desempate determinístico de ordenação para transações da mesma data (Split $\rightarrow$ Buy $\rightarrow$ Sell);
     - Conectar `calculateHistoricalLossesCarryover` para alimentar o `previousLosses` em `calculateMonthlyDarf`;
     - Exibir no card de resumo o saldo de prejuízos a compensar de meses anteriores;
  3. Em `src/domain/portfolio/dividends.ts`, ajustar `resolveDividendNote` para fixar o prefixo `[JCP]` sempre que a operação for JCP, e em `tax.ts` verificar o prefixo estruturado.
- **Portão 1:** Testes unitários de apuração de DARF com compensação contínua de prejuízos e ordenação intraday aprovados (`tax.test.ts` e `portfolio-darf-monitor.test.tsx`).

### Fase 2: Precisão de Rebalanceamento & Cotações Fracionárias (INV-10 & INV-12)
- **Ações:**
  1. Em `src/domain/portfolio/aporte.ts`:
     - Atualizar `resolveAssetPrecision` para conceder 2 casas decimais aos títulos de Tesouro Direto (`isTesouroAsset`);
     - Permitir alocação direta de capital em Renda Fixa privada sem bloqueio por cota inteira;
     - Adicionar testes cobrindo Tesouro Selic e CDB no rebalanceamento;
  2. Em `src/domain/portfolio/valuation.ts`:
     - Eliminar o arredondamento prematuro de `priceBRL` em `calculatePositionSummary`, calculando `valueBRL` com precisão integral de ponto flutuante antes do arredondamento monetário final;
     - Adicionar testes para ativos cotados abaixo de R$ 0,01.
- **Portão 2:** Testes de alocação de aporte e valoração patrimonial 100% aprovados (`aporte.test.ts` e `valuation.test.ts`).

### Fase 3: Unificação de Grupamento no Wizard de Investimentos (INV-13)
- **Ações:**
  1. Em `src/features/investments/wizard/wizard-state.ts`:
     - Adicionar modo `reverse_split` no tipo `WizardMode`;
     - Implementar `reverseSplitFactor` no estado do Wizard e validação em `canProceed`;
  2. Em `src/features/investments/wizard/step-order.tsx`:
     - Incluir a opção "Grupamento (Reverse Split)" na lista de operações;
     - Exibir o preview de cotas e novo PM resultante ($Q \div F$ e $\text{PM} \times F$);
  3. Em `src/features/investments/wizard/step-review.tsx` e `investment-wizard.tsx`:
     - Conectar o envio da ordem `reverse_split` via `recordOrder`;
  4. Adicionar testes unitários em `wizard-state.test.ts` e `investment-wizard.test.tsx`.
- **Portão 3:** Testes do Wizard de Investimentos com suporte integral a desdobramentos e grupamentos aprovados.

### Fase 4: Ergonomia de Formulários & Conformidade DRY (INV-14 & INV-15)
- **Ações:**
  1. Em `src/features/investments/components/asset-form/asset-sell-tab.tsx`:
     - Substituir o `NumericInput` de valor a resgatar pelo primitivo `MoneyInput` quando `isTotalValueMode` for verdadeiro;
  2. Em `src/features/investments/components/asset-form-dialog.tsx`:
     - Migrar a barra de alternância manual para o primitivo canônico `<Tabs />` com abas fluidas e acessibilidade semântica (Regras 4, 7 e 9);
  3. Atualizar testes de interface em `asset-form-dialog.test.tsx`.
- **Portão 4:** Interface em estrita conformidade com os tokens do DESIGN_SYSTEM e AGENTS.md.

---

## 5. DEFINITION OF DONE (DOD)

1. **Zero Emojis e Zero Controles Crus:** Cumprimento rigoroso das Regras 7 e 8 do AGENTS.md em todos os novos trechos e diálogos ajustados;
2. **Camadas Isoladas:** Cálculos de compensação fiscal e precisão financeira isolados no domínio puro (`src/domain/portfolio/`);
3. **Precisão Numérica:** Conformidade com o `FINANCIAL_MATH_SPEC.md` (moeda em centavos nas bordas, precisão decimal sem truncamento prematuro);
4. **Quality Gates 100% Verdes:**
   - Vitest: 100% dos testes de domínio e componentes de investimentos aprovados;
   - TypeScript: `npx tsc -b` com 0 erros;
   - ESLint: `npm run lint` com 0 erros e 0 avisos;
   - Build: `npm run build` bem-sucedido com precache PWA gerado;
5. **Documentação e Notificação:** Atualização do roadmap executivo e envio do relatório final para o Telegram ARGOS.
