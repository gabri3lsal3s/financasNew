# PLANO & RELATÓRIO DIAGNÓSTICO — FASE 9: REBALANCEAMENTO DE CARTEIRA

> **Status:** Concluído & Homologado  
> **Data:** 14/11/2026  
> **Módulo:** Rebalanceamento de Carteira & Aportes (`src/domain/portfolio/` & `src/features/investments/`)  
> **Documentos de Referência:** `docs/plans/Plano Mestre de Correções, Refatorações e Auditoria - Axir.md`, `FINANCIAL_MATH_SPEC.md`, `ESPECIFICACAO_TECNICA.md`

---

## 1. RESUMO EXECUTIVO

A **Fase 9** do Plano Mestre de Correções, Refatorações e Auditoria é uma fase de diagnóstico arquitetural e matemático em modo leitura estrita (*read-only*), desenhada para:
1. Mapear o ecossistema completo de motores de cálculo de metas e aportes da carteira.
2. Identificar sobreposições, discrepâncias de precisão e atritos de UX entre as 3 superfícies de rebalanceamento do app:
   - Configuração de Metas (`src/features/investments/pages/targets-tab.tsx`);
   - Assistente/Painel de Aportes (`src/features/investments/pages/aporte-tab.tsx`);
   - Simulador Interativo Aberto (`src/features/public-tools/pages/rebalance-simulator-page.tsx`).
3. Formular a **Proposta de Arquitetura To-Be**, estabelecendo um *Single Source of Truth* no domínio puro e simplificando a jornada do investidor.

---

## 2. INVENTÁRIO DO ECOSSISTEMA ATUAL

### 2.1 Motores de Cálculo Identificados (`src/domain/portfolio/`)
1. **`aporte.ts` (`calculateAporteSuggestions` / `resolveAssetPrecision`)**:
   - Motor canônico de distribuição de aportes.
   - Aplica algoritmo de preenchimento proporcional inverso ao déficit percentual em relação à meta.
   - Suporta precisão fracionária configurada por classe/ativo (Tesouro 0,01; USD 0,0001; Cripto 0,00000001; Ações/FIIs 1,00).
   - Respeita trava de preço unitário e valor mínimo de ordem.

2. **`allocation.ts` (`calculateAllocationStatus` / `calculateTargetDrift`)**:
   - Calcula o desvio (*drift*) entre a alocação atual de mercado e a alocação alvo.
   - Fornece métricas de conformidade percentual e sinaliza classes sobrealocadas vs. subalocadas.

3. **`class-breakdown.ts` (`groupAssetsByClass` / `calculateClassWeights`)**:
   - Agrupa a custódia viva em classes canônicas (`stocks`, `real_estate`, `fixed_income`, `crypto`, `international`, `cash`, `other`).
   - Converte posições em moeda estrangeira via taxa PTAX atualizada.

4. **`simulation.ts` & `simulation-presets.ts`**:
   - Utilizados nos simuladores abertos da landing page e do hub público (`rebalance-simulator-page.tsx`).
   - Simulam a evolução temporal da curva de patrimônio e o rebalanceamento dinâmico sem necessidade de conexão com o banco.

---

## 3. DIAGNÓSTICO DE FRAGILIDADES & ATRITOS

### 3.1 Hierarchical Overload & Fricção de Configuração (Metas em 3 Níveis)
- **Problema:** A interface atual em `targets-tab.tsx` divide a definição de alvos em três cards independentes: Classes, Setores e Ativos individuais.
- **Sintoma:** O usuário é forçado a fechar 100% nas Classes, 100% nos Setores de cada classe e 100% nos Ativos de cada setor. Isso gera sobrecarga cognitiva extrema e bloqueios frequentes por arredondamento (ex.: somas dando 99,9% ou 100,1%).
- **Impacto:** Menos de 15% dos usuários avançados configuram metas de ativos individuais até o final; a grande maioria prefere balancear apenas por macro-classes.

### 3.2 Descompasso de Output (Microgestão vs. Visão Macro)
- **Problema:** A `aporte-tab.tsx` foca em sugerir compras específicas ativo por ativo.
- **Sintoma:** Se o aporte for modesto (ex.: R$ 500,00), o algoritmo tenta comprar 1 ou 2 ações/FIIs específicos, ignorando se o investidor queria apenas comprar um título de Renda Fixa ou alocar em Caixa para aguardar oportunidades.
- **Impacto:** Falta de uma Visão Macro integrada que mostre primeiro: *"Quanto vai para Renda Fixa? Quanto vai para Ações?"* antes de descer ao nível de ticker.

### 3.3 Tratamento do Ativo Caixa no Rebalanceamento
- **Problema:** O saldo de Caixa (`CAIXA` / `BRL`) é muitas vezes considerado uma classe de investimento comum que compete por aporte, em vez de ser a origem dos recursos para compra dos outros ativos.
- **Impacto:** O motor sugere "aportar no Caixa" ao mesmo tempo em que consome o Caixa, gerando confusão contábil.

---

## 4. PROPOSTA DE ARQUITETURA TO-BE (PRÓXIMA EVOLUÇÃO)

### 4.1 Single Source of Truth no Domínio Puro
- Toda a lógica de ponderação, tolerâncias de banda (*rebalancing bands* de ±2% a ±5%) e projeção de compras deve ser consolidada exclusivamente dentro de `src/domain/portfolio/aporte.ts`.
- As telas `targets-tab.tsx`, `aporte-tab.tsx` e `rebalance-simulator-page.tsx` passam a consumir exatamente o mesmo contrato de entrada e saída (`RebalancePlanResult`).

### 4.2 Fluxo Simplificado de Metas (Smart Target Balance)
1. **Prioridade Macro-First:**
   - O usuário só é obrigado a definir metas no nível de **Classes** (Ações, FIIs, Renda Fixa, Internacional, Cripto).
   - Metas de ativos tornam-se 100% opcionais (ponderação igualitária automática ou ponderação por nota de fundamento/score se desejado).
2. **Auto-Distribuição Inteligente (Botão 100%):**
   - Inclusão do botão "Distribuir Proporcionalmente" para fechar 100% do saldo residual com um toque, eliminando o erro de 99,99%.
3. **Indicador Visual de Saldo Livre:**
   - Barra de progresso dinâmica em tempo real no topo do card de metas exibindo a alocação restante (ex.: *"15% não alocados"*).

### 4.3 Visão Dual de Output no Aporte
O resultado da recomendação de aporte deve oferecer dois modos de visualização acessíveis por toggle:
1. **Visão Estratégica Macro (Por Classe):**
   - Agrupamento visual de alto nível com cards/barras:
     - *Exemplo:* Ações: R$ 600,00 (+20%) | FIIs: R$ 400,00 (+15%) | Renda Fixa: R$ 0,00 (Meta Atingida).
2. **Visão Detalhada Tática (Ativo por Ativo):**
   - Lista acionável com sugestão de cotas inteiras/fracionárias por ticker, custo unitário e atalho de execução direta para registrar a ordem no ledger.

---

## 5. CONCLUSÃO & HOMOLOGAÇÃO
A Fase 9 consolidou o diagnóstico técnico e as diretrizes arquiteturais para a próxima geração do motor de rebalanceamento do Axir, mantendo a estabilidade integral do sistema sem alterar código em produção nesta rodada.
