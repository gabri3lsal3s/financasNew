# PLANO DE EXECUÇÃO — FASE 11 (ROADMAP FASE 109 / v3.7.0)
## REORGANIZAÇÃO INTEGRAL & HARMONIZAÇÃO 360° DO MOTOR DE INVESTIMENTOS

> **Status:** 100% Concluído e Auditado  
> **Data:** 14/11/2026  
> **Versão de Lançamento:** `v3.7.0`  
> **Módulos:** `src/components/modules/position-table*`, `src/features/investments/`, `src/domain/portfolio/`, `src/state/`  
> **Governança:** `AGENTS.md` (Regras 3, 4, 7–27), `DESIGN_SYSTEM.md`, `FINANCIAL_MATH_SPEC.md`

---

## 1. VISÃO GERAL & OBJETIVO

Após a consolidação canônica do motor de rebalanceamento hierárquico em 3 níveis (Fase 108 / v3.6.8), esta fase harmonizou e conectou todo o ecossistema remanescente de investimentos à hierarquia **Macro (Classes) $\rightarrow$ Meso (Setores) $\rightarrow$ Micro (Ativos)**.

O objetivo foi cumprido integralmente: transformar a custódia, os proventos, as movimentações e as fichas de ativos em uma experiência contínua, unificada e sem atritos, fechando o ciclo virtuoso do patrimônio: **Monitorar $\rightarrow$ Diagnosticar $\rightarrow$ Reinvestir**.

---

## 2. ETAPAS DE IMPLEMENTAÇÃO

### Fase 1: Custódia Dinâmica — Agrupamento por Classe e Setor (`PositionTable`)
- [x] Adicionar seletor de agrupamento no cabeçalho da tabela: `"class"` (Classes de Ativos) e `"sector"` (Setores da Carteira).
- [x] Implementar agrupamento por setor utilizando `inferSectorFromTicker(r.ticker, r.assetClass)`.
- [x] Calcular subtotais por setor (saldo consolidado, rentabilidade do setor ponderada e percentual na carteira).
- [x] Renderizar tags de setor nos cards mobile e nas linhas de ativos no desktop.
- [x] **Portão de Qualidade 1:** Testes unitários em `position-table.test.tsx` e verificação com `npm run typecheck`.

### Fase 2: Ficha do Ativo (`AssetDetailSheet`) & Conexão Direta ao Wizard
- [x] Integrar card de **Diagnóstico de Alocação**:
  - Meta individual do ativo e meta setorial;
  - % atual na carteira vs meta (gap financeiro em R$);
  - Indicador de oportunidade quando a cotação estiver abaixo do Preço Médio (`diffVsAveragePct < 0`).
- [x] Conectar botão "Aportar" ao `InvestmentWizard`, pré-carregando o ativo selecionado e cotas calculadas para sanar o déficit orçamentário.
- [x] Exibir visão dual para ativos internacionais (moeda nativa US$ e BRL via taxa PTAX).
- [x] **Portão de Qualidade 2:** Testes unitários em `asset-detail-sheet.test.tsx` e verificação de layout mobile.

### Fase 3: Ciclo de Proventos & Reinvestimento Ativo (`ProventosTab`)
- [x] Adicionar card `ReinvestDividendsBanner` no extrato de proventos quando `cashBalance > 0`:
  - Alerta sutil indicando proventos disponíveis em caixa;
  - CTA de 1-toque ("Reinvestir no Rebalanceador") abrindo o Wizard ou a aba de Aportes com o saldo em caixa pré-preenchido.
- [x] Atualizar simulador Snowball (`src/domain/portfolio/snowball.ts`) para projetar proventos futuros respeitando as metas de alocação da carteira.
- [x] **Portão de Qualidade 3:** Testes unitários em `proventos-tab.test.tsx` e `snowball.test.ts`.

### Fase 4: Movimentações, Renda Fixa por Indexador e Invalidação Atômica
- [x] Adicionar resumo financeiro do mês no topo da `MovimentacoesTab` (Total Comprado, Total Vendido, Proventos e Compras Líquidas).
- [x] Identificar e destacar transações executadas via "Aporte Inteligente" com badges discretos, mantendo rastreabilidade do lote.
- [x] Adicionar filtros por Classe e Setor com `Select` do Design System (Radix, sem controle nativo).
- [x] Criar função central `invalidatePortfolioSuite(queryClient)` em `src/state/mutations/portfolio/portfolio-keys.ts` para sincronização atômica de cache.
- [x] **Portão de Qualidade 4:** Suíte completa de testes (`npm test`), `npm run typecheck` e `npm run lint`.

---

## 3. CHECKLIST DE CONFORMIDADE COM AGENTS.MD
- [x] Regra 3: TypeScript estrito sem `any` nem `@ts-ignore`.
- [x] Regra 7: ZERO controles nativos (`<select>`, checkbox nativo, etc.).
- [x] Regra 8: ZERO emojis decorativos — apenas `lucide-react`.
- [x] Regra 11: ZERO reticências em moedas (usar `<MoneyText />` ou tabular auto-fit).
- [x] Regra 13: Ícones sóbrios em cards comuns e badges de destaque padronizados em alertas.
- [x] Regra 18: Modais responsivos (`size` tipado, drawer no mobile com pill handle).
- [x] Regra 20: ZERO `autoFocus` declarativo em formulários.
