# PLANO DE IMPLEMENTAÇÃO — SANEAMENTO DE CAIXA, RELATÓRIO RETROATIVO DE INVESTIMENTOS & RETIFICAÇÃO QUANTITATIVA DO DOSSIÊ EXECUTIVO

> **Documento Canônico de Arquitetura, Engenharia Quantitativa e Governança de Software**  
> **Status:** Pronto para Execução (Fases 1 a 7) · Quality Gates QG1–QG Final Estruturados  
> **Módulos Afetados:** `supabase/migrations/`, `src/types/`, `src/domain/portfolio/`, `src/domain/reports/`, `src/data/repositories/`, `src/services/`, `src/state/`, `src/hooks/`, `src/components/modules/reports/`, `src/features/investments/`, `src/features/reports/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Funções Puras no Domínio · Moeda em Centavos · Padrões CVM, ANBIMA e CFA · Zero Controles Nativos · Zero Emojis (`local/no-decorative-unicode`) · Portões de Qualidade (QG) por Fase com Commit e Push  
> **Data:** Novembro de 2026 · **Ambiente:** Web PWA & Android Nativo (Capacitor)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano unifica e resolve de forma definitiva três pilares fundamentais da infraestrutura de investimentos e relatórios da plataforma:

1. **Saneamento da Arquitetura de Caixa e Liquidez**: O Caixa vinha sendo tratado como um ativo de custódia negociável comum. Ajustes manuais de saldo geravam ordens espúrias de compra/venda (`buy`/`sell` de CAIXA) e falsos aportes em `portfolio_contributions`. Além disso, operações com débito/crédito em caixa ou proventos creditados duplicavam as movimentações e inflavam o volume negociado e as entradas nos relatórios.
2. **Reconstrução Ponto-no-Tempo & Fechamento Histórico de Carteira**: Na virada do mês, o sistema salva um snapshot estático simplificado (`total_value` e `total_cost`), sem guardar cotações de fechamento por papel, sem reconstruir a custódia ponto-no-tempo para meses anteriores e sem permitir ao usuário conferir ou editar as cotações antes de emitir o relatório executivo oficial em A4/PDF.
3. **Retificação Metodológica & Quantitativa do Dossiê Executivo de Investimentos & Custódia (Padrões CVM / ANBIMA / CFA)**: Correção de 5 debilidades de cálculo e de apresentação detectadas em auditoria matemática no PDF, garantindo consistência, solidez estocástica e precisão decimal para qualquer investidor (iniciantes com poucos meses, carteiras de longo prazo com anos de histórico, ativos multi-moeda e alocações complexas).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│             PIPELINE INTEGRADO: SANEAMENTO DE CAIXA + FECHAMENTO + ENGENHARIA QUANTITATIVA             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┼──────────────────────────────────┐
                 ▼                                  ▼                                  ▼
     [PILAR 1: LIQUIDEZ E CAIXA]        [PILAR 2: HISTÓRICO & FECHAMENTO]  [PILAR 3: ENGENHARIA QUANTITATIVA]
     - Saldo de Caixa é liquidez        - Seletor de mês retroativo        - Anualização por dias exatos
     - Ajuste direto sem buy/sell       - Reconstrução ponto-no-tempo      - Visão Híbrida: Total + 12M
     - syncCash sem pseudo-ordens       - Cotações de fechamento salvas    - Isolamento de MTD na volatilidade
     - Zero duplicidade em proventos    - Modo conferência e edição        - Var. Cota nativa + Subtotal BRL
                 │                                  │                      - Normalização 100,0% (Hamilton)
                 └──────────────────────────────────┼──────────────────────────────────┘
                                                    ▼
                                   [CAMADA 1: MOTOR DE DOMÍNIO PURO]
                                   - point-in-time.ts: custódia retroativa ponto-no-tempo
                                   - twr.ts: annualizeRateFromDays (fórmula exata de dias)
                                   - risk-metrics.ts: volatilidade/Sharpe sobre meses fechados
                                   - benchmarks.ts: visão híbrida (Total Desde Início + 12M)
                                   - distribution.ts: Largest Remainder Method (soma 100,0%)
                                   - allocation-donuts.ts: Caixa isolado de setores econômicos
                                                    │
                                                    ▼
                                  [CAMADA 2: PERSISTÊNCIA E REPOSITÓRIOS]
                          ┌──────────────────────────┴──────────────────────────┐
                          ▼                                                     ▼
               [COTAÇÕES DE FECHAMENTO]                              [SNAPSHOT CONSOLIDADO]
               portfolio_monthly_prices                              portfolio_snapshots
               (por ativo, mês e fonte)                              (recalculado com reconciliação)
                                                    │
                                                    ▼
                                   [CAMADA 3: INTERFACE DE CONFERÊNCIA]
                                   Modal Executivo -> Modo Ajustar Fechamento
                                   - Cotação de fechamento editável com badges de origem
                                   - Saldo de caixa daquele mês ajustável
                                   - Coluna comparativa com Cotação Atual (Hoje)
                                                    │
                                                    ▼
                                   [CAMADA 4: EMISSÃO E RELATÓRIO A4 / PDF]
                                   - Relatório Executivo Oficial (Padrão CVM / A4 / PDF)
                                   - Gráfico com identificação explícita de MTD: "MM/AA* (MTD)"
                                   - Tabela Internacional: Var. Cota por ativo e Subtotal (BRL)
                                   - Sincronização automática com Carrossel de Evolução
```

---

## 2. MATRIZ DE AUDITORIA DE FRAGILIDADES & SALVAGUARDAS BLINDADAS

| # | Fragilidade Diagnosticada | Causa Raiz no Código Legado | Solução de Engenharia Blindada | Status |
|---|---|---|---|---|
| **F1** | Ajuste de caixa gera falsas compras e vendas | `CashFormDialog.tsx` emite `buy` e `sell` em `portfolio_transactions` para deltas de caixa. | Ajuste direto de saldo na quantidade do ativo de caixa, sem criar ordens de compra/venda no ledger. | **Planejado (Fase 1)** |
| **F2** | Ajuste de caixa gera aportes falsos | `CashFormDialog.tsx` cria registro em `portfolio_contributions` automaticamente para qualquer aumento de saldo. | Switch opcional *"Registrar como novo aporte financeiro vindo de fora"*, desligado por padrão (reconciliação contábil pura). | **Planejado (Fase 1)** |
| **F3** | Dupla contagem em proventos creditados | Provento recebido é registrado em `portfolio_dividends` e, ao ajustar o caixa, vira também aporte/compra. | `syncCash` apenas incrementa a quantidade de caixa; provento permanece como única receita nas métricas. | **Planejado (Fase 1)** |
| **F4** | Dupla contagem em compras debitadas do caixa | Compra de ativo gera `buy` do ativo e ajuste de caixa gera `sell` de CAIXA, inflando o volume negociado. | Movimentações internas de liquidez não geram ordens no ledger; volume negociado computa apenas ativos de mercado. | **Planejado (Fase 1)** |
| **F5** | Timeline de movimentações poluída | `PortfolioActivityPanel` lista compras, vendas e aportes do ativo CAIXA misturados a ações e FIIs. | Filtro estrito `!isCashAssetClass(item.assetClass)` nas seções de compras, vendas e métricas de volume. | **Planejado (Fase 1)** |
| **F6** | Snapshots perdem detalhamento por ativo | `portfolio_snapshots` só possui `total_value` e `total_cost`. | Criação da tabela `portfolio_monthly_prices` com unicidade `(user_id, ticker, month)` e rastreabilidade da fonte (`manual`, `api`, `fallback`). | **Planejado (Fase 2)** |
| **F7** | Posição histórica distorcida por vendas futuras | `usePortfolioPosition` itera todas as transações até hoje; um ativo vendido hoje desaparece do passado. | Motor `calculatePointInTimePosition` filtra estritamente `date <= endOfMonth(month)`, mantendo ativos que estavam em custódia na data de corte. | **Planejado (Fase 3)** |
| **F8** | Custos médios históricos contaminados | Transações posteriores ao mês afetam o cálculo de custo médio da posição antiga. | O motor calcula o preço médio ponderado estritamente com as compras e vendas ocorridas até o último dia daquele mês. | **Planejado (Fase 3)** |
| **F9** | API sobrecarregada a cada abertura de relatório | Sem cache de fechamento, o app precisaria consultar APIs externas para todos os ativos toda vez que abrir o relatório. | Cotações salvas em `portfolio_monthly_prices` são reutilizadas; a API só é chamada se o mês não tiver cotações gravadas ou se o usuário solicitar atualização. | **Planejado (Fase 2/4)** |
| **F10**| Falta de cotação oficial em ativos ilíquidos ou falha de rede | Se a API de fechamento falhar para um ticker, o relatório fica em branco ou quebra. | Cascata resiliente: tenta API de fechamento; se falhar, sugere o preço da última operação do mês ou cotação atual, exibindo badge "Sugerida" para o usuário revisar. | **Planejado (Fase 4)** |
| **F11**| Divergência entre extrato da corretora e o app | Pequenas diferenças de centavos ou taxas na corretora deixam o relatório desalinhado. | Tabela interativa de conferência no modal permite editar manualmente cotações e saldo de caixa antes de gerar o relatório oficial. | **Planejado (Fase 6)** |
| **F12**| Desalinhamento entre relatório e gráficos de evolução | Ao alterar a cotação no relatório, os gráficos do carrossel continuariam com os números antigos. | Ao salvar o fechamento do relatório, o sistema recalcula e atualiza `portfolio_snapshots` com os novos totais reconciliados, sincronizando o carrossel. | **Planejado (Fase 5/6)** |
| **F13**| Lançamentos retroativos não atualizam o histórico | Ao cadastrar um dividendo retroativo do mês passado, o carrossel continua exibindo o snapshot congelado antigo. | Efeito em background em `use-auto-portfolio-snapshot.ts` detecta mutações retroativas e recalcula o snapshot do mês afetado automaticamente. | **Planejado (Fase 5)** |
| **F14**| Risco de loop infinito em recálculos automáticos | Mutações retroativas disparando novas mutações que re-executam os efeitos de snapshot. | Bloqueio por hash de competência e trava em `useRef` garantindo idempotência e execução única por alteração real de dados. | **Planejado (Fase 5)** |
| **F15**| Dissonância temporal entre Capa (Pág 1/6) e Benchmarks/Risco (Pág 5) | `ReportPerformanceChart.tsx` aplica `.slice(-12)` sobre a série histórica e calcula benchmarks e risco apenas nos 12 meses. | Benchmarks e Métricas de Risco passam a usar a série completa Desde o Início (ex: TWR total), com Visão Híbrida exibindo o recorte 12M no rodapé dos cards. | **Planejado (Fase 3/6)** |
| **F16**| Contaminação por Mês Parcial (MTD) na Volatilidade e Sharpe | O mês corrente incompleto (ex: 3 dias) é tratado como mês cheio de 30 dias na variância amostral multiplicada por $\sqrt{12}$. | Segregação estrita: Volatilidade anualizada e Sharpe são calculados exclusivamente sobre meses fechados; no gráfico, o MTD recebe rótulo explícito `* (MTD)`. | **Planejado (Fase 3/6)** |
| **F17**| Divergência na base de anualização do TWR na Capa vs TIR | TWR anualiza dividindo por meses calendário tocados (`12 / months`), enquanto a TIR anualiza por dias corridos exatos (`365 / days`). | Criar `annualizeRateFromDays(r, days)` unificando a base temporal do TWR na contagem exata de dias da carteira. | **Planejado (Fase 3/5)** |
| **F18**| Inconsistência semântica e cambial na tabela Internacional (Pág 3) | Cabeçalho fixa `Var. (USD)` mesmo para ativos em reais (`IVVB11`) e a linha de subtotal exibe variação em BRL sob a coluna USD. | Renomear coluna para `Var. Cota` (indicando moeda nativa de cada ativo) e etiquetar explicitamente o subtotal contábil como variação em Reais `(BRL)`. | **Planejado (Fase 6)** |
| **F19**| Erro de arredondamento visual de percentuais e Caixa embutido em Setores | Percentuais somam 99,9% ou 100,1% por arredondamento isolado; Reserva de Caixa entra no cálculo de setores econômicos e cai em "Outros Setores". | Aplicar o Método do Maior Resto (Largest Remainder Method / Hamilton-Hare) garantindo soma exata de 100,0%; isolar a Reserva de Caixa dos setores econômicos produtivos. | **Planejado (Fase 3/6)** |

---

## 3. MATRIZ COMPARATIVA DE FÓRMULAS MATEMÁTICAS (ANTES vs. DEPOIS)

Esta tabela sintetiza a evolução matemática rigorosa para todas as fórmulas de cálculo e apresentação:

| Métrica / Domínio | Fórmula Legada (Antes) | Nova Fórmula Parametrizada (Depois) | Justificativa Quantitativa (CVM / ANBIMA / CFA) |
|---|---|---|---|
| **TWR Anualizado** | $(1 + R_{\text{acum}})^{\frac{12}{N_{\text{meses}}}} - 1$ | $(1 + R_{\text{acum}})^{\frac{365}{D_{\text{dias}}}} - 1$ *(se $D \ge 365$)* | Elimina a distorção de meses parciais nas pontas e unifica a base com a TIR (XIRR). |
| **Volatilidade Anualizada ($\sigma_{\text{a}}$)** | $s_{\text{amostral}}(r_1, \dots, r_n) \times \sqrt{12}$ *(incluindo MTD)* | $s_{\text{amostral}}(r_1, \dots, r_{n-1}^{\text{fechados}}) \times \sqrt{12}$ | Respeita a premissa de homogeneidade temporal ($\Delta t = 1/12$). Um mês de poucos dias não distorce o desvio-padrão. |
| **Índice de Sharpe** | $\frac{R_{\text{anual}}(12\text{m}) - CDI_{12\text{m}}}{\sigma_{\text{a}}(12\text{m c/ MTD})}$ | $\frac{R_{\text{anual}}(\text{Total}) - CDI_{\text{anual}}(\text{Total})}{\sigma_{\text{a}}(\text{meses fechados})}$ *(com 12M no rodapé)* | Coerência estrutural entre a Capa e os cards de Risco, sem ruído do mês incompleto. |
| **Benchmarks (CDI, Poupança, IPCA)** | Comparação restrita a $\text{slice}(-12)$ | **Destaque:** Acumulado Desde o Início.<br>**Subtítulo:** Recorte móvel dos Últimos 12M. | Visão dual institucional: solidez de longo prazo sem abrir mão do termômetro de curto prazo. |
| **Soma de Percentuais** | $\text{round}(P_i, 1)$ *(arredondamento isolado)* | **Largest Remainder Method (Hamilton-Hare):**<br>$F_i = \lfloor 10 \cdot P_i \rfloor$, distribui centésimos pelos maiores restos. | Garante que $\sum P_i \equiv 100,0\%$ matematicamente, eliminando discrepâncias visuais (99,9% / 100,1%). |
| **Diversificação por Setor** | Caixa embutido em `sectorMap`, agrupado em "Outros Setores" | Setores Econômicos calculados sobre os ativos de investimento; Caixa isolado como "Reserva de Caixa" | Caixa é liquidez/moeda, não atividade corporativa. Impede contaminação da análise setorial. |

---

## 4. CHECKLIST EXECUTIVO EM 7 FASES COM QUALITY GATES

### Legenda de Status
- `[ ]` **Pendente**: Roteiro pronto para execução.
- `[x]` **Concluído**: Implementado, tipado, testado com Vitest e aprovado no Quality Gate da Fase.

---

### FASE 1: Saneamento da Arquitetura de Caixa, Eliminação de Pseudo-Transações e Desduplicação de Movimentações
> **Objetivo:** Tratar o Caixa estritamente como saldo de conta (liquidez pura), eliminando a geração de pseudo-compras/vendas e falsos aportes, e blindando relatórios e timelines contra duplicações.

- [x] **Tarefa 1.1: Redesenho do Diálogo de Caixa (`src/features/investments/components/cash-form-dialog.tsx`)**
  - [x] Alterar o `submit`: quando o usuário apenas altera o saldo em caixa, atualizar exclusivamente o `quantity` do ativo de caixa via `updateAsset` com `average_price: 1`.
  - [x] Remover a criação automática de transações `createTx` (`buy` e `sell` de CAIXA) e de contribuições automáticas `createContrib`.
  - [x] Adicionar switch/toggle opcional: *"Registrar como novo aporte financeiro vindo de fora"* (desligado por padrão).
    - Se ligado e o delta for positivo, cadastra a contribuição em `portfolio_contributions` com a nota correspondente.
    - Se desligado, executa reconciliação de saldo pura sem tocar em `portfolio_contributions` ou `portfolio_transactions`.

- [x] **Tarefa 1.2: Ajuste no Motor de Ordens (`src/state/mutations/use-portfolio-mutations.ts` — `useRecordOrder`)**
  - [x] Revisar o comportamento de `syncCash` em compras, vendas e proventos:
    - Na Compra: apenas subtrai `cashDebit` de `cashAsset.quantity`. Não gera nenhuma transação de venda de CAIXA.
    - Na Venda: apenas soma `netCreditBRL` a `cashAsset.quantity`. Não gera nenhuma transação de compra de CAIXA.
    - No Provento: apenas soma `totalBRL` a `cashAsset.quantity`. Não gera transação de compra de CAIXA nem aporte adicional.
  - [x] Impedir que `recordOrder` aceite ordens de `buy` ou `sell` diretas onde o ativo seja da classe `"Caixa"` ou ticker `"CAIXA"`.

- [x] **Tarefa 1.3: Blindagem da Timeline de Movimentações (`src/features/investments/components/portfolio-activity-panel.tsx`)**
  - [x] Filtrar transações de Caixa: em `allActivities`, ignorar transações onde `isCashAssetClass(asset?.asset_class) || asset?.ticker === "CAIXA"`.
  - [x] Nas métricas do mês (`monthStats`):
    - `totalBought`: somar apenas compras de ativos reais (`!isCash`).
    - `totalSold`: somar apenas vendas de ativos reais (`!isCash`).
    - `totalDividends`: proventos reais.
    - `netFlow`: fluxo financeiro de ativos sem duplicação de caixa.

- [x] **Tarefa 1.4: Blindagem das Métricas em Relatórios (`src/features/reports/pages/reports-page.tsx` e `src/domain/portfolio/summary.ts`)**
  - [x] Filtrar `periodTransactions` em `reports-page.tsx` para excluir transações em ativos de Caixa (`isCashAssetClass`).
  - [x] Garantir que `periodBuysBRL`, `periodSellsBRL` e `periodNetFlowBRL` não sejam inflados por deltas de caixa.

- [x] **Tarefa 1.5: Saneamento e Purga de Transações Legadas de Caixa**
  - [x] Criar rotina/script de migração de dados que remove ou desativa transações legadas de `buy` e `sell` associadas a ativos da classe `"Caixa"` em `portfolio_transactions`.
  - [x] Garantir que o saldo atual de caixa seja preservado fielmente em `portfolio_assets.quantity`.

- [x] **Tarefa 1.6: Testes Automatizados de Caixa e Não-Duplicação**
  - [x] Atualizar e expandir `cash-form-dialog.test.tsx` garantindo que edição de saldo não gera transações de compra/venda.
  - [x] Criar teste de integração para `useRecordOrder` com `syncCash` validando ausência de ordens espúrias de caixa.
  - [x] Atualizar `portfolio-activity-panel.test.tsx` verificando que o caixa não aparece como ativo comprado/vendido.

#### 🚪 Quality Gate 1 (QG1)
- [x] Executar typecheck estrito: `npm run typecheck`.
- [x] Executar testes de caixa e movimentações: `npx vitest run src/features/investments/components/cash-form-dialog.test.tsx src/features/investments/components/portfolio-activity-panel.test.tsx`.
- [x] Verificar manualmente que ajustar o caixa não cria itens na aba Movimentações nem infla compras do mês.
- [x] **Commit & Push:** `fix(portfolio): saneamento de caixa eliminacao de pseudo-transacoes e desduplicacao (QG1)`

---

### FASE 2: Modelagem de Dados, Migração Supabase & Repositórios (Persistência de Cotações Mensais)
> **Objetivo:** Criar a infraestrutura de dados para armazenar o histórico de cotações mensais com segurança RLS multi-tenant e repositórios tipados.

- [x] **Tarefa 2.1: Migração SQL no Supabase (`supabase/migrations/20261103000001_portfolio_monthly_prices.sql`)**
  - [x] Criar tabela `public.portfolio_monthly_prices`:
    - `id uuid primary key default gen_random_uuid()`
    - `user_id uuid not null references public.profiles(id) on delete cascade`
    - `ticker text not null`
    - `month char(7) not null check (month ~ '^\d{4}-\d{2}$')`
    - `price numeric(18, 8) not null check (price >= 0)`
    - `currency text not null default 'BRL' check (currency in ('BRL', 'USD'))`
    - `source text not null check (source in ('api', 'manual', 'fallback'))`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
    - `unique (user_id, ticker, month)`
  - [x] Habilitar RLS: `alter table public.portfolio_monthly_prices enable row level security;`
  - [x] Criar políticas RLS blindadas com padrão `is_current_user_active()`:
    - `portfolio_monthly_prices_select_own`
    - `portfolio_monthly_prices_write_own`
  - [x] Criar índices para performance:
    - `idx_portfolio_monthly_prices_user_month on public.portfolio_monthly_prices (user_id, month desc);`
    - `idx_portfolio_monthly_prices_lookup on public.portfolio_monthly_prices (user_id, month, ticker);`

- [x] **Tarefa 2.2: Contratos de Tipos em TypeScript (`src/types/database.ts` e `src/types/portfolio.ts`)**
  - [x] Adicionar `PortfolioMonthlyPrice` em `src/types/database.ts`.
  - [x] Definir `MonthlyPriceRow`, `MonthlyPriceInput` e `MonthlyClosingData` em `src/types/portfolio.ts`.

- [x] **Tarefa 2.3: Repositório de Cotações Mensais (`src/data/repositories/portfolio-monthly-prices.ts`)**
  - [x] Implementar `listPortfolioMonthlyPrices(month: string): Promise<MonthlyPriceRow[]>`.
  - [x] Implementar `upsertPortfolioMonthlyPricesBatch(items: MonthlyPriceInput[]): Promise<void>` com atomicidade e idempotência.
  - [x] Implementar `deletePortfolioMonthlyPrice(ticker: string, month: string): Promise<void>`.

- [x] **Tarefa 2.4: Testes Automatizados do Repositório (`src/data/repositories/portfolio-monthly-prices.test.ts`)**
  - [x] Testar leitura vazia e preenchida.
  - [x] Testar upsert em lote sem duplicidade (upsert por `user_id, ticker, month`).
  - [x] Testar isolamento de usuário simulado.

#### 🚪 Quality Gate 2 (QG2)
- [x] Executar typecheck estrito: `npm run typecheck`.
- [x] Executar testes do repositório: `npx vitest run src/data/repositories/portfolio-monthly-prices.test.ts`.
- [x] Validar integridade da migração SQL com as regras de hardening (RLS e checks).
- [x] **Commit & Push:** `feat(portfolio): schema e repositorio de cotacoes mensais historicas (QG2)`

---

### FASE 3: Motor de Domínio Puro — Reconstrução Ponto-no-Tempo & Retificação Quantitativa
> **Objetivo:** Desenvolver funções puras, testáveis isoladamente e sem dependências de UI/banco, para reconstruir a custódia no fechamento e fornecer motores de cálculo matematicamente blindados para todos os investidores.

- [x] **Tarefa 3.1: Motor Ponto-no-Tempo (`src/domain/portfolio/point-in-time.ts`)**
  - [x] Implementar `calculatePointInTimePosition(params: PointInTimeCalculationParams): PointInTimeResult`:
    - Filtrar movimentações (`transactions`) onde `date <= endOfMonth(month)`.
    - Iterar operações cronologicamente: compras aumentam quantidade e ajustam preço médio ponderado; desdobramentos/splits ajustam quantidade e custo unitário; vendas parciais reduzem quantidade sem alterar o custo médio unitário; vendas totais zeram a posição.
    - Descartar ativos cuja quantidade em custódia na data de corte seja zero ou negativa.
    - Apurar proventos (`dividends`) recebidos especificamente dentro daquele mês e o acumulado de proventos até a data de corte.
    - Para títulos de renda fixa (CDB, LCI, LCA, CRI, CRA) e Tesouro Direto: calcular a valorização pela taxa pactuada e indexador (CDI/Selic/IPCA) acumulada estritamente até a data de fechamento do mês.
    - Aplicar cotações de fechamento (convertendo ativos USD para BRL pela PTAX da data de corte).
    - Calcular ganho de capital aberto, proventos do mês e retorno total consolidado na competência.

- [x] **Tarefa 3.2: Utilitários de Resolução de Cotações Históricas (`src/domain/portfolio/historical-quotes.ts`)**
  - [x] Implementar `resolveHistoricalQuotePriority`:
    - Prioridade 1: Preço manual gravado pelo usuário (`source: 'manual'`).
    - Prioridade 2: Cotação oficial de fechamento via API (`source: 'api'`).
    - Prioridade 3: Sugestão baseada na última compra/venda do mês (`source: 'fallback'`).
    - Prioridade 4: Cotação atual com flag `isEstimate: true` e badge "Sugerida".
  - [x] Normalizar tickers e tratamento de arredondamentos monetários (2 casas decimais para valores totais, até 4 casas para cotações).

- [x] **Tarefa 3.3: Motor de Anualização de TWR por Dias Corridos Exatos (`src/domain/portfolio/twr.ts`)**
  - [x] Implementar `annualizeRateFromDays(accumulatedRatePct: number, daysElapsed: number): number | null`:
    - Se `daysElapsed < 365` ou `accumulatedRatePct <= -100`: retornar `null` (salvaguarda CVM/ANBIMA: proíbe anualizar períodos curtos $< 1$ ano).
    - Se `daysElapsed >= 365`: calcular $(1 + R_{\text{acum}} / 100)^{\frac{365}{\text{daysElapsed}}} - 1$.
  - [x] Atualizar `calculateTwrSeries`: aceitar parâmetro opcional `daysElapsed?: number` (ou `startDate?: string` e `endDate?: string`). Se fornecido e $\ge 365$, utilizar a anualização exata por dias corridos; caso contrário, fallback para `annualizeRateFromMonths`.

- [x] **Tarefa 3.4: Motor de Normalização de Percentuais pelo Método do Maior Resto (`src/domain/reports/distribution.ts`)**
  - [x] Implementar `normalizePercentagesTo100<T extends { rawPct: number }>(items: readonly T[], decimals?: number): (T & { formattedPct: number; displayPctStr: string })[]`:
    - Baseado no algoritmo de Hamilton-Hare / Largest Remainder Method;
    - Trunca no inteiro multiplicado por $10^{\text{decimals}}$ e distribui o déficit residual entre os itens com maiores restos fracionários;
    - Assegura invariante absoluto: $\sum \text{formattedPct} \equiv 100,0\%$.

- [x] **Tarefa 3.5: Retificação de Métricas de Risco com Segregação de MTD (`src/domain/portfolio/risk-metrics.ts`)**
  - [x] Atualizar `calculatePortfolioRiskSummary`:
    - Aceitar flag `hasPartialCurrentMonth?: boolean` ou data de corte.
    - Se o último ponto for o mês corrente incompleto (`isMtd`), **excluí-lo** do cálculo do desvio-padrão amostral ($\sigma_m$) e do Sharpe anualizado, preservando a hipótese de homogeneidade temporal ($\Delta t = 1/12$).
    - Calcular Max Drawdown e Consistência (Win Rate) com a granularidade apropriada.

- [x] **Tarefa 3.6: Retificação de Benchmarks com Visão Híbrida (`src/domain/portfolio/benchmarks.ts`)**
  - [x] Atualizar `calculateConsolidatedBenchmarks`:
    - Permitir entrada de taxas acumuladas do período total (`portfolioTotalRatePct`) e da janela recente de 12 meses (`portfolio12mRatePct?: number`).
    - Produzir dados comparativos tanto para o Total Desde o Início quanto para o recorte de 12 meses.

- [x] **Tarefa 3.7: Desacoplamento de Caixa dos Setores Econômicos (`src/domain/reports/allocation-donuts.ts`)**
  - [x] Refatorar `buildAllocationDonutSegments`:
    - Não injetar Caixa dentro de `sectorMap` de emissores corporativos.
    - Setores econômicos refletem estritamente empresas e títulos produtivos (`totalUniqueSectors` reporta apenas setores reais).
    - A fatia de Caixa é mantida como elemento de liquidez próprio (`#10b981`), nunca permitindo ser aglutinada em "Outros Setores".
    - Aplicar `normalizePercentagesTo100` tanto nas classes quanto nos setores.

- [x] **Tarefa 3.8: Testes de Unidade Exaustivos do Domínio (`point-in-time.test.ts`, `twr.test.ts`, `risk-metrics.test.ts`, `distribution.test.ts`)**
  - [x] Testar anualização de TWR: 978 dias e +22,4% acumulado gerando exatamente **+7,8% a.a.** (+7,84%).
  - [x] Testar anualização para usuário iniciante (< 365 dias): retorna `null` ("Em formação").
  - [x] Testar Largest Remainder Method: array `[23.84, 23.86, 29.96, 0.54, 21.72]` somando exatamente **100,0%**.
  - [x] Testar segregação de MTD: série com 11 meses cheios + 1 mês de 3 dias não distorcendo $\sigma_m \times \sqrt{12}$.
  - [x] Testar ponto-no-tempo com ativos comprados/vendidos, proventos e splits.

#### 🚪 Quality Gate 3 (QG3)
- [x] Executar testes de domínio: `npx vitest run src/domain/portfolio/point-in-time.test.ts src/domain/portfolio/historical-quotes.test.ts src/domain/portfolio/twr.test.ts src/domain/portfolio/risk-metrics.test.ts src/domain/reports/allocation-donuts.test.ts`.
- [x] Garantir 100% de cobertura nos cenários de borda e invariantes financeiras.
- [x] Executar typecheck estrito: `npm run typecheck`.
- [x] **Commit & Push:** `feat(portfolio): motores puros de ponto-no-tempo anualizacao exata e normalizacao quantitativa (QG3)`

---

### FASE 4: Serviço de Cotações Históricas & Cascata Inteligente (Edge Function + API)
> **Objetivo:** Buscar cotações de fechamento oficiais para o último dia útil de meses anteriores com fallback resiliente e sem travar a interface do usuário.

- [x] **Tarefa 4.1: Suporte a Fechamento Histórico na Edge Function (`supabase/functions/quotes/`)**
  - [x] Adaptar a Edge Function para aceitar parâmetro opcional `date` ou `month` (ex: `date=2026-10-31`).
  - [x] Para Yahoo Finance: consultar o histórico diário (`interval=1d&range=5d` centrado no fim do mês) para extrair o `close` do último pregão.
  - [x] Para Moedas: consultar o histórico da AwesomeAPI ou BCB SGS para taxa de câmbio USD de fechamento do mês.

- [x] **Tarefa 4.2: Método de Serviço no Cliente (`src/services/quotes.ts`)**
  - [x] Implementar `fetchHistoricalMonthlyQuotes(params: { tickers: string[]; month: string; lastTransactionsPrices?: Map<string, number> }): Promise<Map<string, HistoricalQuoteResult>>`.
  - [x] Cascata de busca com timeout defensivo de 4 segundos:
    - 1. Edge Function com data de fechamento;
    - 2. AwesomeAPI para USD e cripto;
    - 3. Fallback para preço da última movimentação no mês;
    - 4. Fallback final para cotação atual com flag `isSuggested: true`.

- [x] **Tarefa 4.3: Testes de Integração e Resiliência do Serviço (`src/services/quotes.test.ts`)**
  - [x] Testar mock de resposta de histórico com sucesso.
  - [x] Testar degradação graciosa em timeout e erro de rede (retornando fallback sem estourar exceção não tratada).

#### 🚪 Quality Gate 4 (QG4)
- [x] Executar testes do serviço: `npx vitest run src/services/quotes.test.ts`.
- [x] Executar typecheck: `npm run typecheck`.
- [x] Executar linting: `npm run lint`.
- [x] **Commit & Push:** `feat(portfolio): servico de cotacoes historicas de fechamento com cascata defensiva (QG4)`

---

### FASE 5: Orquestração de Estado & Recálculo Retroativo Automático (TanStack Query & Hooks)
> **Objetivo:** Conectar TanStack Query, repositórios e domínio em hooks reativos, gerenciando o carregamento da posição histórica, a unificação temporal com contagem de dias exatos e o recálculo automático após movimentações retroativas.

- [x] **Tarefa 5.1: Query de Posição Histórica (`src/state/queries/use-portfolio-monthly-position.ts`)**
  - [x] Criar hook `usePortfolioMonthlyPosition(month: string)`:
    - Se `month === currentMonth()`, retorna diretamente o resultado de `usePortfolioPosition()`.
    - Se `month < currentMonth()`:
      - Carrega `portfolio_assets`, `portfolio_transactions`, `portfolio_dividends`, `portfolio_contributions` e `portfolio_monthly_prices(month)`.
      - Identifica tickers sem cotação salva para o mês e dispara busca assíncrona via `fetchHistoricalMonthlyQuotes`.
      - Executa `calculatePointInTimePosition` gerando a lista de ativos, valores de fechamento, rentabilidades e totais.
  - [x] Gerenciar estados `isLoading`, `isRefetching`, `isError` e cache com `staleTime` adequado.

- [x] **Tarefa 5.2: Mutação de Salvamento e Fechamento (`src/state/mutations/use-portfolio-monthly-mutations.ts`)**
  - [x] Implementar mutação `useSaveMonthlyClosing()`:
    - Grava lote em `portfolio_monthly_prices` com `source: 'manual' | 'api'`.
    - Executa upsert na tabela `portfolio_snapshots` com o novo `total_value` e `total_cost` reconciliados daquele mês.
    - Invalida queries relevantes: `["portfolio_snapshots"]`, `["portfolio_monthly_prices", month]` e `["portfolio_position"]`.
    - Emite feedback sensorial via gateway central (`triggerSensory("success")`) e toast de confirmação.

- [x] **Tarefa 5.3: Gatilho de Recálculo Automático Retroativo (`src/hooks/use-auto-portfolio-snapshot.ts`)**
  - [x] Estender `useAutoPortfolioSnapshot`:
    - Monitorar inserções/edições de transações (`portfolio_transactions`) e proventos (`portfolio_dividends`).
    - Se a data do lançamento for `< currentMonth()`, identificar os meses retroativos afetados.
    - Executar recálculo do snapshot consolidado em background para cada mês afetado, atualizando `portfolio_snapshots`.
    - Proteger contra loop de execuções com `useRef` e deduplicação de chamadas.

- [x] **Tarefa 5.4: Unificação Temporal em `usePortfolioPosition` (`src/state/queries/use-portfolio-position.ts`)**
  - [x] Determinar a data inicial real da carteira a partir da primeira transação ou aporte (`firstOperationDate`).
  - [x] Calcular `daysElapsed = differenceInDays(today, firstOperationDate)`.
  - [x] Passar `daysElapsed` ao invocar `calculateTwrSeries`, permitindo a anualização fiel por dias corridos exatos.

- [x] **Tarefa 5.5: Testes Automatizados dos Hooks de Estado (`src/state/queries/use-portfolio-monthly-position.test.ts`)**
  - [x] Testar alternância entre mês corrente e mês retroativo.
  - [x] Testar salvamento de fechamento atualizando cache de snapshots.
  - [x] Testar gatilho retroativo em segundo plano.

#### 🚪 Quality Gate 5 (QG5)
- [x] Executar testes de estado e hooks: `npx vitest run src/state/queries/use-portfolio-monthly-position.test.ts src/hooks/use-auto-portfolio-snapshot.test.ts`.
- [x] Executar typecheck estrito: `npm run typecheck`.
- [x] Verificar ausência de loops infinitos no hook de recálculo retroativo.
- [x] **Commit & Push:** `feat(portfolio): queries e mutacoes de fechamento mensal e unificacao temporal de dias (QG5)`

---

### FASE 6: Interface do Usuário (UI/UX) — Seletor de Competência, Modal de Conferência e Dossiê A4/PDF Retificado
> **Objetivo:** Entregar a experiência visual completa no modal do Relatório Executivo com seletor de mês, tabela interativa de conferência com cotação atual comparativa, edição de valores, eliminação das 5 debilidades quantitativas e impressão em A4 limpo.

- [x] **Tarefa 6.1: Seletor de Mês & Alternância de Modos em `PortfolioExecutiveReport`**
  - [x] Adicionar seletor de competência no cabeçalho do diálogo (`portfolio-executive-report.tsx`):
    - Seleção de qualquer mês arquivado (desde o início da carteira até o mês corrente).
    - Badge discreta indicando se o mês selecionado é o "Mês Atual" ou "Fechamento Histórico".
  - [x] Adicionar abas/botões de alternância:
    - Aba 1: "Relatório Executivo (A4/PDF)" — visualização e impressão do relatório oficial.
    - Aba 2: "Conferir & Ajustar Fechamento" — tabela de auditoria e edição das cotações daquele mês.

- [x] **Tarefa 6.2: Tabela de Conferência e Edição de Cotações (`MonthlyClosingEditor`)**
  - [x] Criar sub-componente `MonthlyClosingEditor`:
    - Listagem de todos os ativos sob custódia naquele mês (com ticker, classe, quantidade histórica bloqueada para leitura).
    - Input de Cotação de Fechamento com máscara monetária (`MoneyInput`).
    - Badge de status de preço: `Oficial API`, `Manual` ou `Sugerida` (fallback).
    - Coluna comparativa com **Cotação Atual (Hoje)** e variação percentual desde o fechamento (`+X.X%` / `-X.X%`).
    - Campo de Caixa do Mês (ajustável).
    - Card de resumo com o Patrimônio Total Recalculado em tempo real conforme o usuário digita.
    - Botão de ação: "Salvar Fechamento & Gerar Relatório" com ícone `Check` e indicador de carregamento.

- [x] **Tarefa 6.3: Refatoração do Gráfico e Painéis em `ReportPerformanceChart` (`report-performance-chart.tsx`)**
  - [x] Receber `fullSeries` (série histórica consolidada) e `displaySeries` (últimas 12 competências para o gráfico visual).
  - [x] **Identificação de MTD:** Se o mês corrente estiver aberto, renderizar a barra correspondente com distinção visual e rótulo explícito `MM/AA* (MTD)`.
  - [x] **Painel de Benchmarks:**
    - Destacar no cabeçalho e nos cards o comparativo **Desde o Início** (ex.: TWR total vs CDI acumulado e Ganho Real Fisher total).
    - No subtítulo de cada card (onde havia texto estático), exibir o recorte móvel: `12M: +X.X% vs Y.Y% (Z% CDI)`.
  - [x] **Painel de Risco & Consistência:**
    - Calcular Volatilidade Anualizada e Índice de Sharpe estritamente sobre as competências mensais fechadas (sem distorção de dias parciais).
    - Max Drawdown e Consistência calculados na curva global da carteira.

- [x] **Tarefa 6.4: Refatoração Semântica e Cambial em `ReportClassTables` (`report-class-tables.tsx`)**
  - [x] Substituir o cabeçalho `Var. (USD)` por **`Var. Cota`**.
  - [x] Nas linhas da tabela Internacional:
    - Ativos USD exibem cotações e variação em dólares (`US$`).
    - Ativos BRL (`IVVB11`, BDRs) exibem cotação e variação em reais com identificação explícita `(BRL)`.
  - [x] Na linha de subtotal contábil da classe internacional:
    - Indicar explicitamente que a variação consolidada é em Reais: `Subtotal Internacional ... +10,0% (BRL)`.

- [x] **Tarefa 6.5: Normalização Visual de Percentuais a 100,0% em Componentes Visuais**
  - [x] Em `ReportStackedBar.tsx`: aplicar `normalizePercentagesTo100` para que a soma dos percentuais da barra de classes feche matematicamente em 100,0%.
  - [x] Em `ReportAllocationDonuts.tsx`: aplicar a normalização nas fatias de classes e setores econômicos.
  - [x] Exibir `"X Setores Econômicos (+ Reserva de Caixa)"` com a fatia de caixa claramente destacada em verde `#10b981`.

- [x] **Tarefa 6.6: Adaptação Global do Documento A4/PDF do Relatório Executivo (`wealth-tear-sheet-modal.tsx`)**
  - [x] Atualizar cabeçalho para exibir a competência de referência (ex: *"Competência: Outubro de 2026 — Posição de Fechamento"*).
  - [x] Exibir o TWR anualizado calculado com base em dias corridos exatos (`+7,8% a.a.`).
  - [x] Garantir alinhamento perfeito de quebra de páginas (`print-break-inside-avoid` e `.print-sheet`).

- [x] **Tarefa 6.7: Conexão com a Página de Investimentos (`resumo-tab.tsx` e `portfolio-snapshots-carousel.tsx`)**
  - [x] No botão "Relatório" da aba Resumo: permitir abrir diretamente o modal executivo.
  - [x] No Carrossel de Evolução Histórica (`PortfolioSnapshotsCarousel`): adicionar ação rápida em cada card de mês *"Gerar Relatório deste Mês"* que já abre o modal com aquela competência pré-selecionada.

- [x] **Tarefa 6.8: Testes de Renderização, Layout A4 e Acessibilidade**
  - [x] Atualizar `wealth-tear-sheet-modal.test.tsx` e `report-performance-chart.test.tsx`.
  - [x] Testar conformidade de acessibilidade (ARIA labels, foco, teclado) e ausência de emojis.

#### 🚪 Quality Gate 6 (QG6)
- [x] Executar testes de componentes: `npx vitest run src/features/reports/components/wealth-tear-sheet-modal.test.tsx src/components/modules/reports/reports.test.tsx`.
- [x] Validar conformidade estrita com o Design System:
  - Zero controles nativos (usar componentes shadcn/tokens);
  - Zero emojis (ícones `lucide-react`);
  - Tipografia de moeda sem reticências (`MoneyText` / tabular-nums);
  - Responsividade mobile-first e layout A4 sem cortes de margem.
- [x] Executar typecheck: `npm run typecheck`.
- [x] Executar linting: `npm run lint`.
- [x] **Commit & Push:** `feat(reports): interface de selecao retroativa conferencia e dossie a4 com visao hibrida e normalizacao (QG6)`

---

### FASE 7: Homologação Final, Varredura de Fragilidades, Documentação & Fechamento
> **Objetivo:** Executar auditoria de segurança multi-tenant, testes de regressão ponta a ponta com casos de teste paramétricos cobrindo todos os tipos de carteira, atualizar a documentação arquitetural e finalizar a entrega.

- [x] **Tarefa 7.1: Auditoria de Segurança Multi-Tenant (RLS Penetration)**
  - [x] Adicionar cenários em `src/tests/cross-tenant-penetration.test.ts` validando que Usuário B não consegue ler nem modificar cotações mensais de Usuário A em `portfolio_monthly_prices`.
  - [x] Testar exclusão em cascata (`on delete cascade`) ao deletar conta de usuário.

- [x] **Tarefa 7.2: Testes de Regressão Integrados Parametrizados**
  - [x] **Cenário 1 (Caso Auditado em 03/11/2026):**
    - 978 dias, 34 competências, R$ 106.107,27 de patrimônio, 61 ativos, TWR acumulado +22,4%;
    - TWR anualizado validado em **+7,8% a.a.** (+7,84%);
    - Soma visual das classes validada em exatamente **100,0%**;
    - Volatilidade e Sharpe calculados sobre os 33 meses fechados (excluindo MTD de 3 dias);
    - Tabela internacional exibindo `Var. Cota` e subtotal em Reais (+10,0% BRL);
    - 25 setores econômicos produtivos + Reserva de Caixa isolada (0,54%).
  - [x] **Cenário 2 (Usuário Iniciante / Pouco Histórico):**
    - Carteira com 3 meses de histórico;
    - TWR anualizado e Sharpe retornando `null` com badges "Em formação" / "Requer histórico", sem estourar erros de divisão por zero.
  - [x] **Cenário 3 (Fechamento Mensal Retroativo Efetivo):**
    - Emissão de relatório para competência fechada anterior (ex.: `2026-10`);
    - O relatório não possui MTD (100% de meses fechados).
  - [x] **Cenário 4 (Carteira Puramente Doméstica):**
    - Carteira sem ativos em USD; validação de ausência de ruídos cambiais.

- [x] **Tarefa 7.3: Atualização da Documentação Governança (`docs/`)**
  - [x] Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` com a nova seção §F51: *"Fechamento Histórico de Carteira, Relatórios Retroativos Ponto-no-Tempo e Retificação Quantitativa do Dossiê Executivo"*.
  - [x] Atualizar `docs/architecture/PROJECT_STRUCTURE.md` registrando os novos arquivos criados.
  - [x] Atualizar `docs/roadmap/ROADMAP.md` marcando a funcionalidade como concluída.

#### 🚪 Quality Gate Final (QG Final)
- [x] Suíte completa de testes verde: `npm run test`.
- [x] Typecheck sem nenhum erro: `npm run typecheck`.
- [x] Linter sem violações: `npm run lint`.
- [x] Build de produção concluído com sucesso: `npm run build`.
- [x] **Commit & Push:** `chore(release): homologacao e documentacao de relatorios retroativos de investimentos e saneamento quantitativo (QG Final)`

---

## 5. MATRIZ DE RASTREABILIDADE DE ARQUIVOS

| Ação | Arquivo | Finalidade |
|---|---|---|
| **MODIFY** | `src/features/investments/components/cash-form-dialog.tsx` | Ajuste de saldo direto sem ordens buy/sell + toggle aporte externo |
| **MODIFY** | `src/state/mutations/use-portfolio-mutations.ts` | syncCash silencioso em useRecordOrder sem pseudo-transações |
| **MODIFY** | `src/features/investments/components/portfolio-activity-panel.tsx` | Filtro estrito de caixa na timeline e métricas de compras/vendas |
| **MODIFY** | `src/features/reports/pages/reports-page.tsx` | Desduplicação de métricas de fluxo financeiro sem caixa |
| **NEW** | `supabase/migrations/20261103000001_portfolio_monthly_prices.sql` | Tabela de cotações mensais, índices e políticas RLS |
| **MODIFY** | `src/types/database.ts` | Tipagem da tabela `portfolio_monthly_prices` |
| **MODIFY** | `src/types/portfolio.ts` | Contratos de dados de fechamento mensal e histórico |
| **NEW** | `src/domain/portfolio/point-in-time.ts` | Motor puro de reconstrução de custódia ponto-no-tempo |
| **NEW** | `src/domain/portfolio/point-in-time.test.ts` | Testes de unidade das regras financeiras retroativas |
| **NEW** | `src/domain/portfolio/historical-quotes.ts` | Resolução e priorização de cotações históricas |
| **NEW** | `src/domain/portfolio/historical-quotes.test.ts` | Testes de resolução de cotações e fallbacks |
| **MODIFY** | `src/domain/portfolio/twr.ts` | Anualização de TWR por dias corridos exatos (`annualizeRateFromDays`) |
| **MODIFY** | `src/domain/portfolio/twr.test.ts` | Testes da fórmula de anualização por dias corridos |
| **NEW** | `src/domain/reports/distribution.ts` | Algoritmo do Maior Resto (Largest Remainder Method) para soma exata de 100,0% |
| **NEW** | `src/domain/reports/distribution.test.ts` | Testes unitários de normalização de percentuais a 100,0% |
| **MODIFY** | `src/domain/portfolio/risk-metrics.ts` | Cálculo de volatilidade e Sharpe excluindo MTD parcial |
| **MODIFY** | `src/domain/portfolio/risk-metrics.test.ts` | Testes de volatilidade e Sharpe com e sem MTD |
| **MODIFY** | `src/domain/portfolio/benchmarks.ts` | Suporte a comparativo duplo (Total Desde Início + Janela 12M) |
| **MODIFY** | `src/domain/portfolio/benchmarks.test.ts` | Testes do comparativo de benchmarks híbrido |
| **MODIFY** | `src/domain/reports/allocation-donuts.ts` | Desacoplamento de Caixa dos setores econômicos produtivos e normalização a 100,0% |
| **MODIFY** | `src/domain/reports/allocation-donuts.test.ts` | Testes de isolamento de caixa nos setores |
| **NEW** | `src/data/repositories/portfolio-monthly-prices.ts` | Repositório com queries e mutations no Supabase |
| **NEW** | `src/data/repositories/portfolio-monthly-prices.test.ts` | Testes do repositório de cotações mensais |
| **MODIFY** | `src/services/quotes.ts` | Busca de cotações históricas com fallback defensivo |
| **NEW** | `src/state/queries/use-portfolio-monthly-position.ts` | Hook de consulta da posição histórica com cache |
| **NEW** | `src/state/queries/use-portfolio-monthly-position.test.ts` | Testes do hook de estado da posição mensal |
| **NEW** | `src/state/mutations/use-portfolio-monthly-mutations.ts` | Mutação para salvar fechamento e atualizar snapshot |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.ts` | Recalculador automático para movimentações retroativas |
| **MODIFY** | `src/state/queries/use-portfolio-position.ts` | Injeção de `daysElapsed` no TWR e flags de segregação MTD |
| **MODIFY** | `src/features/investments/components/portfolio-executive-report.tsx` | Seletor de mês, modo de conferência/edição e relatório A4 |
| **NEW** | `src/features/investments/components/monthly-closing-editor.tsx` | Tabela interativa de conferência de cotações de fechamento |
| **MODIFY** | `src/components/modules/reports/report-performance-chart.tsx` | Visão híbrida Total + 12M, MTD rotulado `* (MTD)` e risco ajustado |
| **MODIFY** | `src/components/modules/reports/report-class-tables.tsx` | Cabeçalho `Var. Cota` e subtotal internacional com identificação `(BRL)` |
| **MODIFY** | `src/components/modules/reports/report-stacked-bar.tsx` | Normalização visual para 100% Total sem discrepâncias |
| **MODIFY** | `src/features/reports/components/wealth-tear-sheet-modal.tsx` | Dossiê A4 integrado com os novos dados de fechamento e métricas |
| **MODIFY** | `src/features/investments/components/portfolio-snapshots-carousel.tsx` | Ação de emitir relatório diretamente a partir do card do mês |
| **MODIFY** | `src/features/investments/pages/resumo-tab.tsx` | Conexão do fluxo de abertura do relatório retroativo |
| **MODIFY** | `docs/architecture/ESPECIFICACAO_TECNICA.md` | Documentação canônica das regras §F51 e governança quantitativa |
| **MODIFY** | `docs/architecture/PROJECT_STRUCTURE.md` | Atualização da árvore de arquivos e diretórios |
| **MODIFY** | `docs/roadmap/ROADMAP.md` | Registro de entrega no roadmap oficial |

---

## 6. GOVERNANÇA DE QUALIDADE E CRITÉRIOS DE ACEITE (Definition of Done)

Para qualquer fase ser considerada concluída, ela deve satisfazer impreterivelmente todos os critérios:
1. **Compilação e Tipagem Estrita:** `npm run typecheck` sem qualquer advertência ou erro (zero `any`, zero `@ts-ignore`).
2. **Qualidade de Código & ESLint:** `npm run lint` 100% limpo, sem violação da regra `local/no-decorative-unicode` (zero emojis ou caracteres decorativos soltos).
3. **Precisão Matemática e Invariantes:**
   - Moeda internamente representada em centavos inteiros nos motores de cálculo;
   - Toda soma de percentuais de alocação que compõe o todo deve fechar em exatamente 100,0%;
   - Nenhuma métrica anualizada pode ser gerada para históricos inferiores a 365 dias (salvaguarda CVM/ANBIMA);
   - A volatilidade anualizada não pode ser contaminada por períodos com tempo inferior a 1 mês completo.
4. **Resiliência Multi-Tenant e RLS:** Usuário B jamais consegue ler ou modificar cotações mensais de Usuário A no Supabase.
5. **Git Hygiene:** Commits atômicos, descritivos em pt-BR com prefixo convencional (`feat:`, `fix:`, `test:`, `chore:`) e push após cada Quality Gate.
