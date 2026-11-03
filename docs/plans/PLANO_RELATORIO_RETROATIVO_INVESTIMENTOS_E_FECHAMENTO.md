# PLANO DE IMPLEMENTAÇÃO — SANEAMENTO DE CAIXA, RELATÓRIO RETROATIVO DE INVESTIMENTOS & FECHAMENTO HISTÓRICO DE CARTEIRA

> **Documento Canônico de Arquitetura e Engenharia**  
> **Status:** Pronto para Execução (Fases 1 a 7) · Quality Gates QG1–QG Final Estruturados  
> **Módulos Afetados:** `supabase/migrations/`, `src/types/`, `src/domain/portfolio/`, `src/data/repositories/`, `src/services/`, `src/state/`, `src/hooks/`, `src/features/investments/`, `docs/`  
> **Governança:** TypeScript Estrito · Funções Puras no Domínio · Moeda em Centavos · Zero Controles Nativos · Zero Emojis · Portões de Qualidade (QG) por Fase com Commit e Push  
> **Data:** Novembro de 2026 · **Ambiente:** Web PWA & Android Nativo (Capacitor)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano unifica a resolução definitiva de dois gargalos críticos na área de investimentos:
1. **Distorção e Duplicação no Fluxo de Caixa**: O Caixa vinha sendo tratado como um ativo de custódia negociável comum. Ajustes manuais de saldo geravam ordens espúrias de compra/venda (`buy`/`sell` de CAIXA) e falsos aportes em `portfolio_contributions`. Além disso, operações com débito/crédito em caixa ou proventos creditados duplicavam as movimentações e inflavam o volume negociado e as entradas nos relatórios.
2. **Impossibilidade de Relatório Retroativo de Fechamento**: Na virada do mês, o sistema trava o dashboard no mês vivo e salva um snapshot estático simplificado (`total_value` e `total_cost`), sem guardar cotações de fechamento, sem reconstruir a custódia ponto-no-tempo para meses anteriores e sem permitir ao usuário conferir ou editar as cotações antes de emitir o relatório executivo oficial em A4/PDF.

A arquitetura resolve esses problemas em **duas grandes frentes coordenadas**:
- **Frente A (Saneamento de Caixa)**: Caixa passa a ser tratado como saldo de conta (liquidez pura). O formulário de caixa atualiza diretamente a quantidade sem emitir ordens de compra/venda; transações de débito/crédito interno de caixa não geram ordens no ledger; relatórios e timeline de movimentações filtram estritamente ativos de caixa, preservando os números reais de compras, vendas e proventos.
- **Frente B (Reconstrução Ponto-no-Tempo & Fechamento Histórico)**: Novo motor de domínio calcula a custódia exata em qualquer data de corte (`date <= endOfMonth(month)`), nova tabela `portfolio_monthly_prices` armazena cotações de fechamento com busca inteligente via API/histórico, e o modal do Relatório Executivo ganha seletor de mês e tabela de conferência/edição manual antes da emissão.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               PIPELINE INTEGRADO: SANEAMENTO DE CAIXA + FECHAMENTO RETROATIVO                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
     [PILAR 1: LIQUIDEZ E CAIXA]                                           [PILAR 2: AUDITORIA HISTÓRICA]
     - Saldo de Caixa é liquidez, não título                               - Seletor de mês (ex: 2026-10)
     - Ajuste de saldo direto sem ordens buy/sell                          - Reconstrução ponto-no-tempo
     - syncCash apenas debita/credita quantidade                           - Cotações de fechamento salvas
     - Zero duplicidade em proventos e compras                             - Modo conferência e edição manual
                 │                                                                     │
                 └──────────────────────────────────┬──────────────────────────────────┘
                                                    ▼
                                  [CAMADA 1: MOTOR DE DOMÍNIO PURO]
                                  - point-in-time.ts: custódia retroativa precisa
                                  - valuation.ts / summary.ts: métricas puras sem caixa duplicado
                                  - historical-quotes.ts: resolução e priorização de preços
                                                    │
                                                    ▼
                                 [CAMADA 2: PERSISTÊNCIA E REPOSITÓRIOS]
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼                                                     ▼
              [COTAÇÕES DE FECHAMENTO]                              [SNAPSHOT CONSOLIDADO]
              portfolio_monthly_prices                              portfolio_snapshots
              (por ativo, mês e fonte)                              (recalculado com dados reconciliados)
                                                    │
                                                    ▼
                                  [CAMADA 3: INTERFACE DE CONFERÊNCIA]
                                  Modal Executivo -> Modo Ajustar Fechamento
                                  - Cotação de fechamento editável com badges de origem
                                  - Saldo de caixa daquele mês ajustável
                                  - Coluna comparativa com Cotação Atual (Hoje)
                                                    │
                                                    ▼
                                  [CAMADA 4: EMISSÃO E RELATÓRIO A4]
                                  - Relatório Executivo Oficial (Padrão CVM / A4 / PDF)
                                  - Extrato histórico analítico sem duplicidade
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

---

## 3. CHECKLIST EXECUTIVO EM 7 FASES COM QUALITY GATES

### Legenda de Status
- `[ ]` **Pendente**: Roteiro pronto para execução.
- `[x]` **Concluído**: Implementado, tipado, testado com Vitest e aprovado no Quality Gate da Fase.

---

### FASE 1: Saneamento da Arquitetura de Caixa, Eliminação de Pseudo-Transações e Desduplicação de Movimentações
> **Objetivo:** Tratar o Caixa estritamente como saldo de conta (liquidez pura), eliminando a geração de pseudo-compras/vendas e falsos aportes, e blindando relatórios e timelines contra duplicações.

- [ ] **Tarefa 1.1: Redesenho do Diálogo de Caixa (`src/features/investments/components/cash-form-dialog.tsx`)**
  - [ ] Alterar o `submit`: quando o usuário apenas altera o saldo em caixa, atualizar exclusivamente o `quantity` do ativo de caixa via `updateAsset` com `average_price: 1`.
  - [ ] Remover a criação automática de transações `createTx` (`buy` e `sell` de CAIXA) e de contribuições automáticas `createContrib`.
  - [ ] Adicionar switch/toggle opcional: *"Registrar como novo aporte financeiro vindo de fora"* (desligado por padrão).
    - Se ligado e o delta for positivo, cadastra a contribuição em `portfolio_contributions` com a nota correspondente.
    - Se desligado, executa reconciliação de saldo pura sem tocar em `portfolio_contributions` ou `portfolio_transactions`.

- [ ] **Tarefa 1.2: Ajuste no Motor de Ordens (`src/state/mutations/use-portfolio-mutations.ts` — `useRecordOrder`)**
  - [ ] Revisar o comportamento de `syncCash` em compras, vendas e proventos:
    - Na Compra: apenas subtrai `cashDebit` de `cashAsset.quantity`. Não gera nenhuma transação de venda de CAIXA.
    - Na Venda: apenas soma `netCreditBRL` a `cashAsset.quantity`. Não gera nenhuma transação de compra de CAIXA.
    - No Provento: apenas soma `totalBRL` a `cashAsset.quantity`. Não gera transação de compra de CAIXA nem aporte adicional.
  - [ ] Impedir que `recordOrder` aceite ordens de `buy` ou `sell` diretas onde o ativo seja da classe `"Caixa"` ou ticker `"CAIXA"`.

- [ ] **Tarefa 1.3: Blindagem da Timeline de Movimentações (`src/features/investments/components/portfolio-activity-panel.tsx`)**
  - [ ] Filtrar transações de Caixa: em `allActivities`, ignorar transações onde `isCashAssetClass(asset?.asset_class) || asset?.ticker === "CAIXA"`.
  - [ ] Nas métricas do mês (`monthStats`):
    - `totalBought`: somar apenas compras de ativos reais (`!isCash`).
    - `totalSold`: somar apenas vendas de ativos reais (`!isCash`).
    - `totalDividends`: proventos reais.
    - `netFlow`: fluxo financeiro de ativos sem duplicação de caixa.

- [ ] **Tarefa 1.4: Blindagem das Métricas em Relatórios (`src/features/reports/pages/reports-page.tsx` e `src/domain/portfolio/summary.ts`)**
  - [ ] Filtrar `periodTransactions` em `reports-page.tsx` para excluir transações em ativos de Caixa (`isCashAssetClass`).
  - [ ] Garantir que `periodBuysBRL`, `periodSellsBRL` e `periodNetFlowBRL` não sejam inflados por deltas de caixa.

- [ ] **Tarefa 1.5: Saneamento e Purga de Transações Legadas de Caixa**
  - [ ] Criar rotina/script de migração de dados que remove ou desativa transações legadas de `buy` e `sell` associadas a ativos da classe `"Caixa"` em `portfolio_transactions`.
  - [ ] Garantir que o saldo atual de caixa seja preservado fielmente em `portfolio_assets.quantity`.

- [ ] **Tarefa 1.6: Testes Automatizados de Caixa e Não-Duplicação**
  - [ ] Atualizar e expandir `cash-form-dialog.test.tsx` garantindo que edição de saldo não gera transações de compra/venda.
  - [ ] Criar teste de integração para `useRecordOrder` com `syncCash` validando ausência de ordens espúrias de caixa.
  - [ ] Atualizar `portfolio-activity-panel.test.tsx` verificando que o caixa não aparece como ativo comprado/vendido.

#### 🚪 Quality Gate 1 (QG1)
- [ ] Executar typecheck estrito: `npm run typecheck`.
- [ ] Executar testes de caixa e movimentações: `npx vitest run src/features/investments/components/cash-form-dialog.test.tsx src/features/investments/components/portfolio-activity-panel.test.tsx`.
- [ ] Verificar manualmente que ajustar o caixa não cria itens na aba Movimentações nem infla compras do mês.
- [ ] **Commit & Push:** `fix(portfolio): saneamento de caixa eliminacao de pseudo-transacoes e desduplicacao (QG1)`

---

### FASE 2: Modelagem de Dados, Migração Supabase & Repositórios (Persistência de Cotações Mensais)
> **Objetivo:** Criar a infraestrutura de dados para armazenar o histórico de cotações mensais com segurança RLS multi-tenant e repositórios tipados.

- [ ] **Tarefa 2.1: Migração SQL no Supabase (`supabase/migrations/20261103000001_portfolio_monthly_prices.sql`)**
  - [ ] Criar tabela `public.portfolio_monthly_prices`:
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
  - [ ] Habilitar RLS: `alter table public.portfolio_monthly_prices enable row level security;`
  - [ ] Criar políticas RLS blindadas com padrão `is_current_user_active()`:
    - `portfolio_monthly_prices_select_own`
    - `portfolio_monthly_prices_write_own`
  - [ ] Criar índices para performance:
    - `idx_portfolio_monthly_prices_user_month on public.portfolio_monthly_prices (user_id, month desc);`
    - `idx_portfolio_monthly_prices_lookup on public.portfolio_monthly_prices (user_id, month, ticker);`

- [ ] **Tarefa 2.2: Contratos de Tipos em TypeScript (`src/types/database.ts` e `src/types/portfolio.ts`)**
  - [ ] Adicionar `PortfolioMonthlyPrice` em `src/types/database.ts`.
  - [ ] Definir `MonthlyPriceRow`, `MonthlyPriceInput` e `MonthlyClosingData` em `src/types/portfolio.ts`.

- [ ] **Tarefa 2.3: Repositório de Cotações Mensais (`src/data/repositories/portfolio-monthly-prices.ts`)**
  - [ ] Implementar `listPortfolioMonthlyPrices(month: string): Promise<MonthlyPriceRow[]>`.
  - [ ] Implementar `upsertPortfolioMonthlyPricesBatch(items: MonthlyPriceInput[]): Promise<void>` com atomicidade e idempotência.
  - [ ] Implementar `deletePortfolioMonthlyPrice(ticker: string, month: string): Promise<void>`.

- [ ] **Tarefa 2.4: Testes Automatizados do Repositório (`src/data/repositories/portfolio-monthly-prices.test.ts`)**
  - [ ] Testar leitura vazia e preenchida.
  - [ ] Testar upsert em lote sem duplicidade (upsert por `user_id, ticker, month`).
  - [ ] Testar isolamento de usuário simulado.

#### 🚪 Quality Gate 2 (QG2)
- [ ] Executar typecheck estrito: `npm run typecheck`.
- [ ] Executar testes do repositório: `npx vitest run src/data/repositories/portfolio-monthly-prices.test.ts`.
- [ ] Validar integridade da migração SQL com as regras de hardening (RLS e checks).
- [ ] **Commit & Push:** `feat(portfolio): schema e repositorio de cotacoes mensais historicas (QG2)`

---

### FASE 3: Motor de Domínio Puro — Reconstrução Ponto-no-Tempo & Cotações Históricas
> **Objetivo:** Desenvolver funções puras, testáveis isoladamente e sem dependências de UI/banco, para reconstruir a custódia no fechamento de qualquer mês anterior.

- [ ] **Tarefa 3.1: Motor Ponto-no-Tempo (`src/domain/portfolio/point-in-time.ts`)**
  - [ ] Implementar `calculatePointInTimePosition(params: PointInTimeCalculationParams): PointInTimeResult`:
    - Filtrar movimentações (`transactions`) onde `date <= endOfMonth(month)`.
    - Iterar operações cronologicamente: compras aumentam quantidade e ajustam preço médio ponderado; desdobramentos/splits ajustam quantidade e custo unitário; vendas parciais reduzem quantidade sem alterar o custo médio unitário; vendas totais zeram a posição.
    - Descartar ativos cuja quantidade em custódia na data de corte seja zero ou negativa.
    - Apurar proventos (`dividends`) recebidos especificamente dentro daquele mês e o acumulado de proventos até a data de corte.
    - Para títulos de renda fixa (CDB, LCI, LCA, CRI, CRA) e Tesouro Direto: calcular a valorização pela taxa pactuada e indexador (CDI/Selic/IPCA) acumulada estritamente até a data de fechamento do mês.
    - Aplicar cotações de fechamento (convertendo ativos USD para BRL pela PTAX da data de corte).
    - Calcular ganho de capital aberto, proventos do mês e retorno total consolidado na competência.

- [ ] **Tarefa 3.2: Utilitários de Resolução de Cotações Históricas (`src/domain/portfolio/historical-quotes.ts`)**
  - [ ] Implementar `resolveHistoricalQuotePriority`:
    - Prioridade 1: Preço manual gravado pelo usuário (`source: 'manual'`).
    - Prioridade 2: Cotação oficial de fechamento via API (`source: 'api'`).
    - Prioridade 3: Sugestão baseada na última compra/venda do mês (`source: 'fallback'`).
    - Prioridade 4: Cotação atual com flag `isEstimate: true` e badge "Sugerida".
  - [ ] Normalizar tickers e tratamento de arredondamentos monetários (2 casas decimais para valores totais, até 4 casas para cotações).

- [ ] **Tarefa 3.3: Testes de Unidade Exaustivos (`src/domain/portfolio/point-in-time.test.ts` e `historical-quotes.test.ts`)**
  - [ ] Caso 1: Ativo comprado em 2026-09 e vendido em 2026-11 deve aparecer na custódia de 2026-10 com a quantidade correta.
  - [ ] Caso 2: Ativo comprado em 2026-11 NÃO pode aparecer na custódia de 2026-10.
  - [ ] Caso 3: Desdobramento (split) ocorrido em 2026-11 não afeta as quantidades de 2026-10.
  - [ ] Caso 4: Desdobramento ocorrido em 2026-10 ajusta corretamente as quantidades de 2026-10.
  - [ ] Caso 5: Proventos creditados em 2026-10 são somados no mês; proventos de 2026-11 não entram em 2026-10.
  - [ ] Caso 6: Renda fixa marcada na curva acumula rendimento até 31/10/2026.
  - [ ] Caso 7: Conversão de câmbio USD/BRL utilizando a cotação histórica do dólar.

#### 🚪 Quality Gate 3 (QG3)
- [ ] Executar testes de domínio: `npx vitest run src/domain/portfolio/point-in-time.test.ts src/domain/portfolio/historical-quotes.test.ts`.
- [ ] Garantir 100% de cobertura nos cenários de borda e invariantes financeiras.
- [ ] Executar typecheck estrito: `npm run typecheck`.
- [ ] **Commit & Push:** `feat(portfolio): motor de dominio puro ponto-no-tempo e cotacoes historicas (QG3)`

---

### FASE 4: Serviço de Cotações Históricas & Cascata Inteligente (Edge Function + API)
> **Objetivo:** Buscar cotações de fechamento oficiais para o último dia útil de meses anteriores com fallback resiliente e sem travar a interface do usuário.

- [ ] **Tarefa 4.1: Suporte a Fechamento Histórico na Edge Function (`supabase/functions/quotes/`)**
  - [ ] Adaptar a Edge Function para aceitar parâmetro opcional `date` ou `month` (ex: `date=2026-10-31`).
  - [ ] Para Yahoo Finance: consultar o histórico diário (`interval=1d&range=5d` centrado no fim do mês) para extrair o `close` do último pregão.
  - [ ] Para Moedas: consultar o histórico da AwesomeAPI ou BCB SGS para taxa de câmbio USD de fechamento do mês.

- [ ] **Tarefa 4.2: Método de Serviço no Cliente (`src/services/quotes.ts`)**
  - [ ] Implementar `fetchHistoricalMonthlyQuotes(params: { tickers: string[]; month: string; lastTransactionsPrices?: Map<string, number> }): Promise<Map<string, HistoricalQuoteResult>>`.
  - [ ] Cascata de busca com timeout defensivo de 4 segundos:
    - 1. Edge Function com data de fechamento;
    - 2. AwesomeAPI para USD e cripto;
    - 3. Fallback para preço da última movimentação no mês;
    - 4. Fallback final para cotação atual com flag `isSuggested: true`.

- [ ] **Tarefa 4.3: Testes de Integração e Resiliência do Serviço (`src/services/quotes.test.ts`)**
  - [ ] Testar mock de resposta de histórico com sucesso.
  - [ ] Testar degradação graciosa em timeout e erro de rede (retornando fallback sem estourar exceção não tratada).

#### 🚪 Quality Gate 4 (QG4)
- [ ] Executar testes do serviço: `npx vitest run src/services/quotes.test.ts`.
- [ ] Executar typecheck: `npm run typecheck`.
- [ ] Executar linting: `npm run lint`.
- [ ] **Commit & Push:** `feat(portfolio): servico de cotacoes historicas de fechamento com cascata defensiva (QG4)`

---

### FASE 5: Orquestração de Estado & Recálculo Retroativo Automático (TanStack Query & Hooks)
> **Objetivo:** Conectar TanStack Query, repositórios e domínio em hooks reativos, gerenciando o carregamento da posição histórica e o recálculo automático após movimentações retroativas.

- [ ] **Tarefa 5.1: Query de Posição Histórica (`src/state/queries/use-portfolio-monthly-position.ts`)**
  - [ ] Criar hook `usePortfolioMonthlyPosition(month: string)`:
    - Se `month === currentMonth()`, retorna diretamente o resultado de `usePortfolioPosition()`.
    - Se `month < currentMonth()`:
      - Carrega `portfolio_assets`, `portfolio_transactions`, `portfolio_dividends`, `portfolio_contributions` e `portfolio_monthly_prices(month)`.
      - Identifica tickers sem cotação salva para o mês e dispara busca assíncrona via `fetchHistoricalMonthlyQuotes`.
      - Executa `calculatePointInTimePosition` gerando a lista de ativos, valores de fechamento, rentabilidades e totais.
  - [ ] Gerenciar estados `isLoading`, `isRefetching`, `isError` e cache com `staleTime` adequado.

- [ ] **Tarefa 5.2: Mutação de Salvamento e Fechamento (`src/state/mutations/use-portfolio-monthly-mutations.ts`)**
  - [ ] Implementar mutação `useSaveMonthlyClosing()`:
    - Grava lote em `portfolio_monthly_prices` com `source: 'manual' | 'api'`.
    - Executa upsert na tabela `portfolio_snapshots` com o novo `total_value` e `total_cost` reconciliados daquele mês.
    - Invalida queries relevantes: `["portfolio_snapshots"]`, `["portfolio_monthly_prices", month]` e `["portfolio_position"]`.
    - Emite feedback tátil via `triggerSensory("success")` e toast de confirmação.

- [ ] **Tarefa 5.3: Gatilho de Recálculo Automático Retroativo (`src/hooks/use-auto-portfolio-snapshot.ts`)**
  - [ ] Estender `useAutoPortfolioSnapshot`:
    - Monitorar inserções/edições de transações (`portfolio_transactions`) e proventos (`portfolio_dividends`).
    - Se a data do lançamento for `< currentMonth()`, identificar os meses retroativos afetados.
    - Executar recálculo do snapshot consolidado em background para cada mês afetado, atualizando `portfolio_snapshots`.
    - Proteger contra loop de execuções com `useRef` e deduplicação de chamadas.

- [ ] **Tarefa 5.4: Testes Automatizados dos Hooks de Estado (`src/state/queries/use-portfolio-monthly-position.test.ts`)**
  - [ ] Testar alternância entre mês corrente e mês retroativo.
  - [ ] Testar salvamento de fechamento atualizando cache de snapshots.
  - [ ] Testar gatilho retroativo em segundo plano.

#### 🚪 Quality Gate 5 (QG5)
- [ ] Executar testes de estado e hooks: `npx vitest run src/state/queries/use-portfolio-monthly-position.test.ts src/hooks/use-auto-portfolio-snapshot.test.ts`.
- [ ] Executar typecheck estrito: `npm run typecheck`.
- [ ] Verificar ausência de loops infinitos no hook de recálculo retroativo.
- [ ] **Commit & Push:** `feat(portfolio): queries e mutacoes de fechamento mensal e recalculador retroativo (QG5)`

---

### FASE 6: Interface do Usuário (UI/UX) — Seletor de Competência, Modal de Conferência e Relatório A4/PDF
> **Objetivo:** Entregar a experiência visual completa no modal do Relatório Executivo com seletor de mês, tabela interativa de conferência com cotação atual comparativa, edição de valores e impressão de relatório retroativo.

- [ ] **Tarefa 6.1: Seletor de Mês & Alternância de Modos em `PortfolioExecutiveReport`**
  - [ ] Adicionar seletor de competência no cabeçalho do diálogo (`portfolio-executive-report.tsx`):
    - Seleção de qualquer mês arquivado (desde o início da carteira até o mês corrente).
    - Badge discreta indicando se o mês selecionado é o "Mês Atual" ou "Fechamento Histórico".
  - [ ] Adicionar abas/botões de alternância:
    - Aba 1: "Relatório Executivo (A4/PDF)" — visualização e impressão do relatório oficial.
    - Aba 2: "Conferir & Ajustar Fechamento" — tabela de auditoria e edição das cotações daquele mês.

- [ ] **Tarefa 6.2: Tabela de Conferência e Edição de Cotações (`MonthlyClosingEditor`)**
  - [ ] Criar sub-componente `MonthlyClosingEditor`:
    - Listagem de todos os ativos sob custódia naquele mês (com ticker, classe, quantidade histórica bloqueada para leitura).
    - Input de Cotação de Fechamento com máscara monetária (`MoneyInput`).
    - Badge de status de preço:
      - `Oficial API` (azul/neutro);
      - `Manual` (verde/positivo);
      - `Sugerida` (amarelo/warning — quando fallback).
    - Coluna comparativa com **Cotação Atual (Hoje)** e variação percentual desde o fechamento (`+X.X%` / `-X.X%`).
    - Campo de Caixa do Mês (ajustável).
    - Card de resumo com o Patrimônio Total Recalculado em tempo real conforme o usuário digita.
    - Botão de ação: "Salvar Fechamento & Gerar Relatório" com ícone `Check` e indicador de carregamento.

- [ ] **Tarefa 6.3: Adaptação do Documento A4/PDF do Relatório Executivo**
  - [ ] Atualizar o cabeçalho do documento para exibir explicitamente a competência de referência (ex: *"Competência: Outubro de 2026 — Posição de Fechamento"*).
  - [ ] Exibir os dados históricos calculados: rentabilidade do período, proventos auferidos naquele mês e composição patrimonial por classe.
  - [ ] Incluir nota explicativa discreta no rodapé: *"Relatório gerado com base na posição consolidada em 31/10/2026"*.

- [ ] **Tarefa 6.4: Conexão com a Página de Investimentos (`resumo-tab.tsx` e `portfolio-snapshots-carousel.tsx`)**
  - [ ] No botão "Relatório" da aba Resumo: permitir abrir diretamente o modal executivo.
  - [ ] No Carrossel de Evolução Histórica (`PortfolioSnapshotsCarousel`): adicionar ação rápida em cada card de mês *"Gerar Relatório deste Mês"* que já abre o modal com aquela competência pré-selecionada.

- [ ] **Tarefa 6.5: Testes de Renderização e Interação (`portfolio-executive-report.test.tsx`)**
  - [ ] Testar troca de mês no seletor e carregamento da posição histórica.
  - [ ] Testar edição de cotação e atualização do total em tempo real.
  - [ ] Testar conformidade de acessibilidade (ARIA labels, foco, teclado) e ausência de emojis.

#### 🚪 Quality Gate 6 (QG6)
- [ ] Executar testes de componentes: `npx vitest run src/features/investments/components/portfolio-executive-report.test.tsx`.
- [ ] Validar conformidade estrita com o Design System:
  - Zero controles nativos (usar componentes shadcn/tokens);
  - Zero emojis (ícones `lucide-react`);
  - Tipografia de moeda sem reticências (`MoneyText` / tabular-nums);
  - Responsividade mobile-first e layout A4 sem cortes de margem.
- [ ] Executar typecheck: `npm run typecheck`.
- [ ] Executar linting: `npm run lint`.
- [ ] **Commit & Push:** `feat(investments): interface de selecao retroativa conferencia de cotacoes e relatorio executivo (QG6)`

---

### FASE 7: Homologação Final, Varredura de Fragilidades, Documentação & Fechamento
> **Objetivo:** Executar auditoria de segurança multi-tenant, testes de regressão ponta a ponta, atualizar a documentação arquitetural e finalizar a entrega.

- [ ] **Tarefa 7.1: Auditoria de Segurança Multi-Tenant (RLS Penetration)**
  - [ ] Adicionar cenários em `src/tests/cross-tenant-penetration.test.ts` validando que Usuário B não consegue ler nem modificar cotações mensais de Usuário A em `portfolio_monthly_prices`.
  - [ ] Testar exclusão em cascata (`on delete cascade`) ao deletar conta de usuário.

- [ ] **Tarefa 7.2: Testes de Regressão Integrados**
  - [ ] Rodar toda a suíte de testes de investimentos e relatórios:
    - `npx vitest run src/domain/portfolio/`
    - `npx vitest run src/features/investments/`
    - `npx vitest run src/features/reports/`
  - [ ] Validar que nenhum teste existente quebrou.

- [ ] **Tarefa 7.3: Atualização da Documentação Governança (`docs/`)**
  - [ ] Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` com a nova seção §F51: *"Fechamento Histórico de Carteira e Relatórios Retroativos Ponto-no-Tempo"* e revisão da governança de Caixa.
  - [ ] Atualizar `docs/architecture/PROJECT_STRUCTURE.md` registrando os novos arquivos criados.
  - [ ] Atualizar `docs/roadmap/ROADMAP.md` marcando a funcionalidade como concluída.

#### 🚪 Quality Gate Final (QG Final)
- [ ] Suite completa de testes verde: `npm run test`.
- [ ] Typecheck sem nenhum erro: `npm run typecheck`.
- [ ] Linter sem violações: `npm run lint`.
- [ ] Build de produção concluído com sucesso: `npm run build`.
- [ ] **Commit & Push:** `chore(release): homologacao e documentacao de relatorios retroativos de investimentos e saneamento de caixa (QG Final)`

---

## 4. MATRIZ DE RASTREABILIDADE DE ARQUIVOS

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
| **NEW** | `src/data/repositories/portfolio-monthly-prices.ts` | Repositório com queries e mutations no Supabase |
| **NEW** | `src/data/repositories/portfolio-monthly-prices.test.ts` | Testes do repositório de cotações mensais |
| **MODIFY** | `src/services/quotes.ts` | Busca de cotações históricas com fallback defensivo |
| **NEW** | `src/state/queries/use-portfolio-monthly-position.ts` | Hook de consulta da posição histórica com cache |
| **NEW** | `src/state/queries/use-portfolio-monthly-position.test.ts` | Testes do hook de estado da posição mensal |
| **NEW** | `src/state/mutations/use-portfolio-monthly-mutations.ts` | Mutação para salvar fechamento e atualizar snapshot |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.ts` | Recalculador automático para movimentações retroativas |
| **MODIFY** | `src/features/investments/components/portfolio-executive-report.tsx` | Seletor de mês, modo de conferência/edição e relatório A4 |
| **NEW** | `src/features/investments/components/monthly-closing-editor.tsx` | Tabela interativa de conferência de cotações de fechamento |
| **MODIFY** | `src/features/investments/components/portfolio-snapshots-carousel.tsx` | Ação de emitir relatório diretamente a partir do card do mês |
| **MODIFY** | `src/features/investments/pages/resumo-tab.tsx` | Conexão do fluxo de abertura do relatório retroativo |
| **MODIFY** | `docs/architecture/ESPECIFICACAO_TECNICA.md` | Documentação canônica das regras §F51 e governança de Caixa |
| **MODIFY** | `docs/architecture/PROJECT_STRUCTURE.md` | Atualização da árvore de arquivos e diretórios |
| **MODIFY** | `docs/roadmap/ROADMAP.md` | Registro de entrega no roadmap oficial |

---

## 5. GOVERNANÇA DE QUALIDADE E CRITÉRIOS DE ACEITE (Definition of Done)

Para qualquer fase ser considerada concluída, ela deve satisfazer impreterivelmente todos os critérios:
1. **Compilação e Tipagem:** `npm run typecheck` sem qualquer advertência ou erro (`sem any`).
2. **Qualidade de Código:** `npm run lint` 100% limpo, sem violação da regra `local/no-decorative-unicode` (zero emojis).
3. **Testes Unitários:** Testes colocalizados (`*.test.ts`/`*.test.tsx`) cobrindo cenários normais, limites matemáticos e erros.
4. **Isolamento de Segurança:** Nenhuma brecha de leitura cruzada entre usuários no Supabase RLS.
5. **Git Hygiene:** Commits atômicos, descritivos em pt-BR com prefixo convencional (`feat:`, `fix:`, `test:`, `chore:`) e push após cada Quality Gate.
