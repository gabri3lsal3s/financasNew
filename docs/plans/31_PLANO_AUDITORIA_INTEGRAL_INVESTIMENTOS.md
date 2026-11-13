# PLANO 31 — Auditoria Integral do Módulo de Investimentos & Precisão Patrimonial

> **Status:** Aprovado para Execução · **Canônico**  
> **Data de Emissão:** 2026-11-13  
> **Autoridade:** Antigravity AI & Engenharia Financeira  
> **Referência:** `AGENTS.md`, `ESPECIFICACAO_TECNICA.md`, `FINANCIAL_MATH_SPEC.md`

---

## 1. RESUMO EXECUTIVO & ESCOPO

Este plano consolida as ações de remediação para todas as fragilidades, incompatibilidades de schema, inconsistências de ledger e distorções matemáticas identificadas na auditoria completa de ponta a ponta do ecossistema de investimentos.

O plano abrange 4 fases de implementação técnica, assegurando que o fluxo de ponta a ponta do usuário — desde o cadastro inaugural até o rebalanceamento automatizado, apuração fiscal e fechamento de rentabilidade — opere com 100% de precisão financeira e estabilidade de dados.

---

## 2. MATRIZ DE ACHADOS & METAS DE REMEDIAÇÃO

| ID | Severidade | Módulo / Arquivo | Descrição do Problema | Meta de Remediação |
|---|---|---|---|---|
| **INV-01** | Crítica | `supabase/migrations/` e `src/data/rpc/portfolio.ts` | Parâmetro `integer` no RPC `execute_portfolio_batch_aporte` gerava exceção fatal ao receber decimais e truncava preços médios | Criar migration `20260101000120_harden_portfolio_batch_aporte_rpc.sql` com tipos `numeric(18, 8)` e `numeric(18, 2)` |
| **INV-02** | Crítica | `asset-split-dialog.tsx` e `use-portfolio-order-mutations.ts` | `AssetSplitDialog` atualizava a custódia sem registrar o evento na tabela `portfolio_transactions`, corrompendo recálculos futuros de ledger | Gravar transações de `split` e `reverse_split` no ledger e ajustar arredondamento a 4 casas |
| **INV-03** | Alta | `portfolio-import-dialog.tsx` | Importação de planilhas com múltiplas linhas do mesmo ticker pegava apenas a 1ª linha ou sobrescrevia com a última linha | Consolidar linhas por ticker via `computeLedger` e `applyOperation` antes de persistir a posição |
| **INV-04** | Média/Alta | `src/domain/portfolio/dividends.ts` e `proventos-tab.tsx` | Média de Yield on Cost da carteira calculada por média aritmética não ponderada de percentuais | Implementar `calculateWeightedPortfolioYoC` ponderado pelo capital investido real |
| **INV-05** | Média | `src/domain/portfolio/operations.ts` | Reconciliação de custódia descartava cotas base legadas não registradas em transações após exclusão de ordens | Preservar cotas base calculando $\Delta = \text{max}(0, \text{currentQuantity} - \text{trackedQuantity})$ |
| **INV-06** | Média | `portfolio-darf-monitor.tsx` | Reconstituição cronológica de PM no monitor de DARF omitia subscrições, desdobramentos e grupamentos | Incluir subscrições e fatores de split/reverse split no acumulador histórico |
| **INV-07** | Baixa | `movimentacoes-tab.tsx` | Falta de atalho contextual para a apuração fiscal e controle de DARF na aba de histórico da carteira | Adicionar card de ação rápida para o `PortfolioDarfMonitor` na `MovimentacoesTab` |

---

## 3. FASES DE EXECUÇÃO E PORTÕES DE QUALIDADE

### Fase 1: Blindagem de Banco de Dados & RPC Transacional (INV-01)
- **Ações:**
  - Criar `supabase/migrations/20260101000120_harden_portfolio_batch_aporte_rpc.sql`.
  - Dropar sobrecargas obsoletas de `execute_portfolio_batch_aporte`.
  - Restaurar parâmetros: `(p_items jsonb, p_date date, p_total_amount numeric, p_notes text default null)`.
  - Tipagem estrita: `numeric(18, 8)` e `numeric(18, 2)`.
  - Row-locking pessimista: `for update` no loop de ativos.
  - Verificação de segurança: `can_current_user_write_module('investments')` e `is_current_user_active()`.
- **Portão 1:** Testes unitários de RPC e integração de aporte aprovados sem erros de sintaxe ou tipo.

### Fase 2: Integridade de Ledger & Ajustes Societários (INV-02 & INV-05)
- **Ações:**
  - Atualizar `AssetSplitDialog` (`src/features/investments/components/asset-split-dialog.tsx`) para invocar `recordOrder` ou `createTransaction.mutateAsync` gerando a transação de desdobramento/grupamento.
  - Em `use-portfolio-order-mutations.ts`, alinhar `reverse_split` para `Math.round((asset.quantity / quantity) * 10000) / 10000`.
  - Em `src/domain/portfolio/operations.ts`, implementar a salvaguarda de posições base não registradas em `calculateReconciledAssetPosition`.
  - Atualizar e adicionar testes em `operations.test.ts` e `asset-split-dialog.test.tsx`.
- **Portão 2:** `npx vitest run src/domain/portfolio/operations.test.ts src/features/investments/components/asset-split-dialog.test.tsx` 100% verde.

### Fase 3: Consolidação Multilinhas na Importação de Carteira (INV-03)
- **Ações:**
  - Em `src/features/investments/components/portfolio-import-dialog.tsx`:
    - Agrupar `selectedRows` por ticker antes de atualizar ou criar ativos.
    - Para novos ativos: consolidar via `computeLedger` sobre as linhas daquele ticker.
    - Para ativos existentes: aplicar sequencialmente as transações da planilha sobre a posição atual com `applyOperation`.
  - Atualizar testes em `portfolio-import-dialog.test.tsx`.
- **Portão 3:** `npx vitest run src/features/investments/components/portfolio-import-dialog.test.tsx` 100% verde.

### Fase 4: Precisão Matemática de YoC, Fiscalidade DARF & Ergonomia (INV-04, INV-06 & INV-07)
- **Ações:**
  - Em `src/domain/portfolio/dividends.ts`, criar `calculateWeightedPortfolioYoC(items: readonly { costBRL: number; dividendsBRL: number }[])` e atualizar testes em `dividends.test.ts`.
  - Em `src/features/investments/pages/proventos-tab.tsx`, conectar o novo cálculo ponderado.
  - Em `src/features/investments/components/portfolio-darf-monitor.tsx`, expandir o acumulador para `subscription`, `split` e `reverse_split`.
  - Em `src/features/investments/pages/movimentacoes-tab.tsx`, adicionar card e botão para abrir `PortfolioDarfMonitor`.
  - Atualizar testes em `portfolio-darf-monitor.test.tsx`, `proventos-tab.test.tsx` e `movimentacoes-tab.test.tsx`.
- **Portão 4:** `npx vitest run src/domain/portfolio/ src/features/investments/` 100% verde.

### Fase 5: Validação Global, Documentação e Notificação
- **Ações:**
  - Executar verificação de tipos (`npx tsc -b`) e linting (`npm run lint`).
  - Executar build de produção (`npm run build`).
  - Atualizar `docs/roadmap/ROADMAP.md` registrando a entrega.
  - Enviar notificação executiva ao bot Telegram ARGOS via `scripts/notify-telegram.ts`.
- **Portão 5:** Zero erros de compilação, zero avisos de lint, build íntegro.

---

## 4. DEFINITION OF DONE (DOD)
1. **Zero Exceções de Tipo em Aportes:** Execuções de lote de aportes inteligentes ocorrem de forma atômica e com precisão decimal exata.
2. **Ledger Fiel e Auditável:** Splits e reverse splits geram registros permanentes em `portfolio_transactions`, sobrevivendo a recálculos posteriores de custódia.
3. **Importação Determinística:** Arquivos com múltiplos lançamentos do mesmo ticker consolidam posições exatas tanto para ativos novos quanto para ativos já existentes.
4. **Matemática Financeira Canônica:** YoC da carteira representa rigorosamente a taxa ponderada de retorno sobre o capital real aportado.
5. **Fiscalidade Completa:** Monitor de DARF reconstitui o custo de aquisição histórico considerando todas as compras, subscrições, vendas intermediárias e eventos de split.
