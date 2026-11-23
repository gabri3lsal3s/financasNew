# Plano Mestre de Arquitetura e Execução — Motor Global de Cotações (SWR + EOD/EOM), Stale Quote Guard, Custódia BRL/USD e Proventos Automatizados

> **Documento Vivo de Governança e Execução (`Fluxo Completo — Feature / Plano`, `AGENTS.md` §10.5)**
> - **Status Atual:** `CONCLUÍDO (BLOCOS A, B E C APROVADOS)`
> - **Última Atualização:** 2026-11-23
> - **Ordem de Execução:** `Bloco A` → `[Portão A]` → `Bloco B` → `[Portão B]` → `Bloco C` → `[Portão C]`

---

## 0. TRAVA INVIOLÁVEL DE NÃO-REGRESSÃO

Em **nenhuma** etapa dos Blocos A, B ou C é permitido alterar:
1. Regras contábeis de **Reserva de Caixa** (`CAIXA`);
2. Regras de **liquidação/baixa de ordens** (compra/venda/aporte);
3. Cálculo de **preço médio** (BRL e USD);
4. Motores de cálculo de **Renda Fixa (CDBs/LCIs/LCAs)** (`src/domain/portfolio/fixed-income.ts`) e **Tesouro Direto**.

Regras de governança obrigatórias (`AGENTS.md`):
- TypeScript estrito (zero `any`, zero `@ts-ignore`);
- Funções puras de cálculo em `src/domain/` com testes unitários colocalizados (`*.test.ts`) e moeda em **centavos inteiros** nos motores;
- UI 100% DRY com primitivos de `components/ui` e `components/modules`, **zero controles nativos**, **zero `autoFocus`**, **zero emojis/Unicode decorativo** (`local/no-decorative-unicode`);
- Datas em fuso local `America/Sao_Paulo` (proibido `toISOString().slice(0, 10)` para intervalos/datas civis);
- Percentuais via `formatPercent` (pt-BR, vírgula) e monetários via `<MoneyText />` (zero `truncate` em dinheiro);
- Integração obrigatória de eventos de proventos ao **Notification Hub** (`AGENTS.md` §4.35).

---

## 1. META-ANÁLISE CRÍTICA CONTRA O CÓDIGO REAL (FASE 0.1)

A auditoria contra o repositório real (migrations `0001`–`0131`, `supabase/.temp/postgres-version`, Edge Functions, `src/domain/`, `src/data/`, `src/state/`, `src/features/` e suítes `security-audit.test.ts` / `quotes-core.test.ts`) confirmou **100% de viabilidade** na stack atual (PostgreSQL **17.6.1.155**, Supabase Edge Functions Deno, React 18+, TanStack Query, Vitest) e identificou **10 riscos ocultos e lacunas** resolvidos preventivamente abaixo:

| # | Risco / Lacuna Detectada no Código Real | Evidência no Repositório | Refinamento Incorporado no Plano |
|---|---|---|---|
| **1** | **Quebra dupla no `restore_backup` ao endurecer `asset_prices`:** (a) o `ON CONFLICT (ticker, user_id)` falharia com erro `42P10` após trocar a constraint única por índices parciais; (b) backups legados contêm `user_id = v_uid` com `source = 'api'`, violando o novo `CHECK`. | `20260101000127` L995–1012 + `src/data/repositories/export.ts` L19–20 | Atualizar `restore_backup` no Bloco A para filtrar `ap.user_id = v_uid AND (ap.source = 'manual' OR ap.manual_price IS NOT NULL)`, normalizar `source = 'manual'` e usar `ON CONFLICT (ticker, user_id) WHERE user_id IS NOT NULL DO UPDATE`. |
| **2** | **Bug oculto em `restore_backup` com `trg_portfolio_snapshot_immutability`:** a migration `0130` passou a bloquear `INSERT` de snapshots `< mês corrente` sem `app.snapshot_rpc = 'on'`, mas `restore_backup` (`0127`) não ativa essa GUC. | `20260101000130` L42–51 vs. `20260101000127` L929–951 | Adicionar `perform set_config('app.snapshot_rpc', 'on', true);` em `restore_backup` (Bloco A), garantindo restauração íntegra de snapshots históricos. |
| **3** | **Compatibilidade com RPC de Patrimônio Familiar:** a RPC familiar consulta `asset_prices` com prioridade de usuário sobre global. | `20260101000084` L212–216 | Validado 100% compatível (`order by (ap.user_id is not null) desc limit 1` + `coalesce(ap.manual_price, ap.price)`): override manual vence o cache global único sem alteração na RPC familiar. |
| **4** | **Paridade SSOT no `close_month_global` sem duplicar fórmulas de Renda Fixa/Tesouro:** `fixed-income.ts` usa `@/` (Vite) e é protegido pela Trava de Não-Regressão; reescrever fórmulas aproximadas no Deno causaria divergência. | `src/domain/portfolio/fixed-income.ts`, `supabase/functions/` (0 leituras server-side de `portfolio_snapshots`) | Arquitetura EOM em 2 camadas: **(1) Nuvem (`close_month_global`)** congela eternamente 100% das cotações EOM + `USDBRL=X` PTAX oficial em `market_price_history` (`is_month_end = true`) e hidrata `portfolio_monthly_prices` de todos os usuários (preservando `manual`); fecha `portfolio_snapshots` diretamente na nuvem via `commit_monthly_closing_system` para carteiras sem RF paramétrica; **(2) Carteiras com RF paramétrica/Tesouro** fecham automaticamente no próximo acesso via `commit_monthly_closing_atomic` usando **exatamente** `canonical-engine.ts` + `fixed-income.ts` na data de corte EOM + os preços já congelados em `market_price_history` (0% divergência, 0% dependência de preço do dia atual). |
| **5** | **Vazamento entre meses e ausência de `USDBRL=X` em `usePortfolioMonthlyPosition`:** `apiQuotesMap` é indexado só por `ticker` (vaza preços ao trocar de mês) e `missingTickers` nunca inclui `USDBRL=X`. | `src/state/queries/use-portfolio-monthly-position.ts` L64, L76–83, L113 | Substituir leitura histórica por `useMarketPriceHistory(month)` (incluindo `USDBRL=X` EOM) e indexar qualquer enrichment sob demanda por `${month}:${ticker}`. |
| **6** | **`ReportDocumentLayout.onBeforePrint` síncrono e gesto de usuário para `window.print()`:** abrir modal de confirmação assíncrono em `onBeforePrint` quebraria o fluxo síncrono e bloquearia `window.print()` no Safari/iOS WebKit. | `src/components/modules/reports/report-document-layout.tsx` L20, L51–56 | Adicionar suporte nativo a `printWarning` no `ReportDocumentLayout`: ao clicar em "Imprimir / Salvar PDF" com alertas ativos, abre `<ConfirmDialog />` (sem `autoFocus`) e o botão "Emitir PDF mesmo assim" chama `triggerPrint(suggestedTitle)` diretamente no `onClick` (gesto de usuário preservado). |
| **7** | **Schema real de `corporate_dividends` e promoção `payment_date NULL → DATE`:** (a) `payment_date` hoje é `NOT NULL`; (b) `type` usa enum maiúsculo (`DIVIDENDO`, `JCP`, etc.); (c) `INSERT ... ON CONFLICT` com `UNIQUE NULLS NOT DISTINCT` criaria linha duplicada ao anunciar `payment_date` depois; (d) `portfolio_dividend_dismissals` já existe com dispensas prévias. | `20260101000087` L15–54 + PG `17.6.1.155` | (a) `ALTER COLUMN payment_date DROP NOT NULL` + `UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date)`; (b) preservar enum maiúsculo + adicionar `is_type_uncertain boolean NOT NULL DEFAULT false`; (c) criar RPC `upsert_corporate_dividend_system` que promove in-place `(ticker, com_date, type)` com `payment_date IS NULL` (e taxa compatível `±0,005`, suportando múltiplas parcelas na mesma `data-com` como PETR4); (d) migrar dispensas de `portfolio_dividend_dismissals` para `user_dividend_events (status = 'DISMISSED')`. |
| **8** | **Feriados e fusos distintos (B3 vs. NYSE/NASDAQ + DST EUA):** `business-days.ts` cobre apenas feriados BR; feriado só nos EUA ou horário de verão americano (EDT UTC-4 vs. EST UTC-5) distorceria o EOD Guard se avaliado em bloco único. | `src/domain/portfolio/business-days.ts`, `market-calendar.ts` | Criar calendário puro multi-mercado (`BR` = B3/ANBIMA em `America/Sao_Paulo`, `US` = NYSE/NASDAQ em `America/New_York` via `Intl.DateTimeFormat` para DST exato + feriados federais/NYSE, `CRYPTO` = 24/7, `FX` = dias úteis BR/BCB PTAX), avaliado **por ticker**. |
| **9** | **`VITE_BRAPI_TOKEN` no cliente e preservação de `fetchPtaxForDate`:** `security-audit.test.ts` L493 libera `VITE_BRAPI_TOKEN` hoje; `use-quick-transaction-form.ts` depende de `fetchPtaxForDate` para ordens USD históricas. | `src/services/quotes.ts` L88–145, `src/tests/security-audit.test.ts` L493 | Remover `fetchBrapi`, `fetchAwesomeApi`, `setAssetPriceFromApi`, `setAssetPricesBatchFromApi` e `VITE_BRAPI_TOKEN` do cliente (e da allowlist de `security-audit.test.ts`). Manter `fetchPtaxForDate` (consultando `market_price_history` → BCB SGS Série 1) apenas para preenchimento assistido de data histórica no formulário de ordem. |
| **10** | **Modo Offline / PWA e resiliência de rede:** SWR não deve disparar erros nem loops quando o usuário estiver sem internet (`!navigator.onLine`) ou com aba em background. | `AGENTS.md` + `docs/platforms/PWA_GUIDELINES.md` | SWR só dispara quando `navigator.onLine === true`, `document.visibilityState === 'visible'` e houver ao menos 1 ticker elegível; offline renderiza silenciosamente do cache local/TanStack Query sem toast de erro. |

---

## 2. ARQUITETURA FINAL DETALHADA

### 2.1 Visão de Camadas (Estado Alvo)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CAMADA 1 — BANCO DE DADOS & RLS (PostgreSQL 17 / Supabase)                │
│ • public.asset_prices (user_id NULL = cache global único API;             │
│   user_id NOT NULL = override manual exclusivo; índices parciais + CHECK) │
│ • public.market_price_history (PK ticker + reference_date; 90d EOD + EOM) │
│ • public.market_fetch_locks (Single-Flight lock por ticker, TTL 45s)      │
│ • public.quote_refresh_rate_limits (Rate limit por usuário/janela)        │
│ • public.corporate_dividends (global, payment_date nullable,              │
│   UNIQUE NULLS NOT DISTINCT, provider, tax_rate_pct, is_type_uncertain)   │
│ • public.user_dividend_events (por usuário, ciclo de vida completo)       │
│ • public.portfolio_dividends (+ source_event_id único idempotente)        │
│ • RPCs System (service_role): upsert_global_asset_prices,                 │
│   try_acquire_quote_locks, check_quote_refresh_rate_limit,                │
│   commit_monthly_closing_system, upsert_corporate_dividend_system,        │
│   settle_user_dividend_event_system                                       │
│ • RPCs User (authenticated): confirm_user_dividend_events_atomic,         │
│   restore_backup (atualizado e blindado)                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 2 — EDGE FUNCTIONS & CRONS (Deno / pg_cron — Custo Zero)           │
│ • supabase/functions/_shared/quotes-core.ts (normalização, parsers c/     │
│   timestamps reais, calendário BR/US/FX, PTAX parser, spike guardrail     │
│   split-aware, fiscal proventos B3/US — 100% testado no Vitest)           │
│ • supabase/functions/quotes/index.ts:                                     │
│   - default (SWR / on-demand autenticado + EOD Guard + cooldown 15m/5m    │
│     + Single-Flight + rate limit + validação anti-envenenamento)          │
│   - action: 'eod_close' (cron 22:00 UTC seg–sex)                          │
│   - action: 'close_month_global' (cron 22:30 UTC seg–sex c/ auto-healing) │
│   - action: 'sync_corporate_dividends' (cron 10:00 UTC diário)            │
│   - action: 'process_user_dividends' (cron 11:30 UTC diário)              │
│ • supabase/quotes-cron.sql (somente 4 agendamentos enxutos, 0 intradiário)│
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 3 — DOMÍNIO PURO / SSOT (`src/domain/portfolio/`)                  │
│ • market-calendar.ts (calendário BR/B3 + US/NYSE + DST + janela pregão)   │
│ • quotes.ts (normalização, classificação de mercado, helpers puros)       │
│ • canonical-engine.ts + canonical-types.ts (preserva source, manual_price,│
│   market_price_at, fetched_at, provider + fxMetadata SSOT único)          │
│ • stale-quote-guard.ts (post_trade_stale, missing_or_fallback,            │
│   stale_market_data por mercado, fxWarning)                               │
│ • custody-reconciliation.ts (Custódia Brasil BRL vs. Exterior USD em      │
│   centavos inteiros; invariante soma === Patrimônio no Fechamento)        │
│ • provisioned-dividends.ts (isolamento contábil estrito: A Receber +      │
│   Total Projetado nunca somam ao Patrimônio nem ao Caixa)                 │
│ • dividend-suggester.ts (reconstrução data-com c/ baseline+ordens+splits, │
│   fuso America/Sao_Paulo, fiscal B3/EUA, anti-flood, dedup fuzzy)         │
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 4 — ESTADO, UI PASSIVA, PDFs & NOTIFICATION HUB                    │
│ • useMarketQuotesSwr (SWR sob demanda em Home/Investimentos + 15 min se   │
│   visible & mercado aberto + sync cirúrgico cache miss & D+0)             │
│ • useExecutiveReportRefresh (pré-relatório com EOD Guard + cooldown 5m)   │
│ • CustodySectionCard (indicador editorial passivo; SEM botão manual;      │
│   "Tentar novamente" apenas quando houver ativo degradado/erro)           │
│ • ReportHeader + ReportEquityClassTable + CustodyReconciliationCard (DRY) │
│   + ReportDocumentLayout (alerta + ConfirmDialog no printWarning)         │
│ • DividendEventsModal único + DividendsCalendarPanel evoluído +           │
│   Notification Hub (PROVISIONED / PENDING_CONFIRMATION / SETTLED) +       │
│   Configurações > Notificações & Automações (preferência de proventos)    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estratégia de Cotações (Sem Botão Manual) & Anti-Spam

| Cenário | Comportamento | Chamadas Externas |
|---|---|---|
| **Mercado fechado + EOD já capturado** (noite, fim de semana, feriado local do ativo) | Edge Function identifica `fetched_at >= lastMarketClose` e devolve cache global imediatamente | **0** |
| **Pregão aberto — entrada na Home ou Investimentos** | Renderiza instantaneamente do Postgres (`asset_prices`). Cliente identifica apenas tickers da carteira com `now - fetched_at >= 15 min` cujo mercado está aberto e envia só esse subconjunto | Apenas tickers vencidos (1x a cada 15 min compartilhado entre **todos** os usuários) |
| **Usuário ativo na aba Investimentos** | Timer silencioso a cada 15 min **apenas** se `visibilityState === 'visible'`, `navigator.onLine === true` e houver mercado aberto | Somente tickers vencidos |
| **Cadastro de ativo inédito (`cache miss`)** | Sync cirúrgico imediato apenas daquele ticker (inclusive fim de semana/feriado, 1 única vez) para capturar último fechamento oficial e popular cache global | 1 (bypass de EOD Guard exclusivo para `cache miss`) |
| **Ordem D+0 registrada** | Invalida `asset_prices` e dispara sync cirúrgico apenas do ticker negociado + `USDBRL=X` (bypass de cooldown se `post_trade_stale` e mercado aberto) | 1–2 |
| **Abertura do Relatório Executivo / Tear Sheet (mês atual)** | `useExecutiveReportRefresh` aplica EOD Guard + cooldown de **5 min** (`mode: 'report_preflight'`) e envia só tickers vencidos | 0 (mercado fechado ou <5m) ou apenas vencidos |
| **Proteção contra abuso / concorrência** | Validação contra tickers existentes em `portfolio_assets` (ou `USDBRL=X`), `check_quote_refresh_rate_limit` (10 req/min e 60/h por usuário), `try_acquire_quote_locks` (Single-Flight 45s por ticker) e pool máx. 6 req simultâneas com backoff+jitter em 429/5xx | Protegido contra stampede e cache poisoning |

### 2.3 Orçamento Técnico Custo Zero (Supabase Free + Brapi + Yahoo + BCB)

| Métrica / Recurso | Limite Gratuito | 10 usuários (~40 tickers únicos) | 100 usuários (~150 tickers únicos) | 1.000 usuários (~400 tickers únicos) |
|---|---|---|---|---|
| **Crons/dia** | Ilimitado (`pg_cron`) | 4 execuções/dia | 4 execuções/dia | 4 execuções/dia |
| **Invocações Edge Function/mês** | 500.000/mês | ~600 (~0,1%) | ~3.500 (~0,7%) | ~22.000 (~4,4%) |
| **Chamadas externas/mês (deduplicado global)** | Brapi/Yahoo free + BCB ilimitado | ~4.500 | ~15.000 | ~38.000 (compartilhamento reduz >95%) |
| **Armazenamento Postgres (cotações + histórico 90d EOD + EOM eterno)** | 500 MB | < 1 MB | < 3 MB | < 12 MB |

### 2.4 Regras Críticas Detalhadas

#### A. Câmbio Oficial `USDBRL=X` (PTAX)
1. Primário: **BCB Olinda PTAX** (`CotacaoDolarDia` / `CotacaoDolarPeriodo` — campo `cotacaoVenda`, paridade exata com SGS Série 1) com **lookback de até 7 dias corridos** (cobrindo fins de semana e feriados prolongados como Carnaval).
2. Fallback 1: Yahoo Finance (`USDBRL=X`).
3. Fallback 2: AwesomeAPI (`USD-BRL`).
4. `USDBRL=X` entra obrigatoriamente no cron `eod_close`, `close_month_global` e no `fxMetadata` único (`rate`, `source`, `provider`, `fxRateAt`, `isFallback`).
5. Rótulo no PDF exibe a fonte real (`PTAX Oficial BCB`, `Yahoo Finance`, `AwesomeAPI`, `Manual` ou `Taxa Estimada (Fallback)` — nunca afirma "PTAX Oficial" para fallback/Yahoo).

#### B. `applySpikeGuardrail` Split-Aware
Ao detectar variação > 50% entre novo preço e preço anterior:
1. **Eventos de Split/Inplit (Yahoo `events.splits`):** se houve evento de desdobramento/grupamento nos últimos 5 dias úteis e o novo preço bate com `prevPrice / splitRatio` (±20%), **aceita imediatamente** e atualiza `market_price_at` e `provider`.
2. **Consenso por `chartPreviousClose` / provedor secundário:** se o preço coincide com `chartPreviousClose` (±15%) ou é confirmado por provedor secundário (Brapi/Yahoo cruzado, ±5%), **aceita imediatamente**.
3. **Cache velho (> 5 dias úteis):** se `prev.market_price_at` tem mais de 5 dias úteis, aceita novo preço (não congela ativo que ficou meses sem atualizar).
4. **Auto-destravamento via confirmação dupla (`pending_spike_price` / `pending_spike_at`):** na 1ª ocorrência suspeita sem split/consenso, preserva preço, `market_price_at` e `provider` antigos e grava `pending_spike_price` + `pending_spike_at = now()`. Se nova leitura ≥ 10 min depois confirmar o mesmo patamar (±5%), destrava e aceita automaticamente.

#### C. Pipeline de Proventos na Nuvem (B3 vs. EUA, Anti-Flood e Isolamento Contábil)
1. **Coleta Global (`10:00 UTC` / `07:00 BRT`, diário):** lista tickers distintos de renda variável com custódia > 0 (excluindo Caixa e Renda Fixa):
   - **B3 (primário):** Brapi (`BRAPI_TOKEN`, `modules=cashDividends`) — distingue explicitamente `DIVIDENDO` (0% IR) vs. `JCP` (15% IRRF) vs. `RENDIMENTO` (FIIs 0% IR) e retorna `lastDatePrior` (`com_date`) e `paymentDate` (opcional/nullable).
   - **B3 (fallback Yahoo `events=div`):** quando Brapi falhar ou não retornar o ativo, coleta via Yahoo marcando `is_type_uncertain = true` → **força `PENDING_CONFIRMATION`** (jamais assume alíquota silenciosamente).
   - **EUA:** Yahoo `events=div` com `currency = 'USD'`, `tax_rate_pct = 30` (withholding tax), `net_rate = rate * 0.70`, `com_date` = dia útil anterior NYSE à `ex-date`.
   - Persistência via RPC `upsert_corporate_dividend_system`: antes de promover uma linha `payment_date IS NULL` para a data confirmada, verificar explicitamente se já existe registro com aquela `payment_date` exata (evitando colisão de chave única em parcelas múltiplas); promover in-place apenas quando não houver conflito, preservando os `user_dividend_events` já vinculados.
2. **Materialização & Efetivação (`11:30 UTC` / `08:30 BRT`, diário):**
   - Para cada usuário elegível, reconstrói `quantity_on_com_date` via custódia completa (`baseline + compras/vendas + splits/inplits` até o fechamento da `com_date` em `America/Sao_Paulo`). Se `qty <= 0`, ignora.
   - Se `payment_date IS NULL` ou `payment_date > hoje (BRT)` → cria/atualiza `user_dividend_events` com `status = 'PROVISIONED'`.
   - Quando `payment_date <= hoje (BRT)`:
     - **Anti-Flood na Ativação:** calcula `cutoffDate = max(dividendAutomation.activatedAt, hoje - 7 dias)`. Eventos com `payment_date < cutoffDate` **NUNCA** são liquidados automaticamente (ficam como `PENDING_CONFIRMATION` ou ignorados se anteriores à custódia, impedindo despejo retroativo).
     - **Deduplicação Fuzzy:** verifica `portfolio_dividends` manuais existentes para o ativo em `±3 dias úteis` e `±R\$ 0,05` (ou `±US\$ 0,05`). Se houver match, vincula `settled_dividend_id` e marca `SETTLED` sem duplicar.
     - **Efetivação:** se `is_type_uncertain = true` OU `settlementMode = 'manual_confirm'`, marca `PENDING_CONFIRMATION`. Se `settlementMode = 'auto'` (padrão) e dentro da janela segura, chama `settle_user_dividend_event_system`: insere em `portfolio_dividends` (com `source_event_id` único), atualiza `accumulated_dividends`, e se `autoCreditCash = true`, credita `CAIXA` convertendo USD→BRL pela taxa oficial `USDBRL=X` vigente (PTAX/EOD) e registrando `fx_rate_applied`.
3. **Isolamento Contábil Estrito (`provisioned-dividends.ts`):**
   - Eventos `PROVISIONED` e `PENDING_CONFIRMATION` **nunca** entram em `totalBRL`, `cashBRL`, TWR, rentabilidade ou Patrimônio no Fechamento.
   - São exibidos exclusivamente como linhas auxiliares destacadas (*Proventos Provisionados — A Receber* e *Total Projetado c/ Provisionados*) no `CustodyReconciliationCard` (UI e PDF).

---

#### D. Guardas de Integridade SQL e Feriado Cruzado EOM
1. **Never-Degrade SQL em `upsert_global_asset_prices`:** na cláusula `ON CONFLICT (ticker) WHERE user_id IS NULL DO UPDATE`, uma cotação global `source = 'api'` válida (`price > 0`) **nunca** pode ser sobrescrita por `price <= 0`, `source = 'fallback'` ou `market_price_at` mais antigo que o existente (preservando dados de preço/timestamp/provedor e permitindo atualizar apenas metadados de revalidação como `fetched_at` e `pending_spike_*`).
2. **Feriado Cruzado no `is_month_end` (`eod_close`):** no último dia útil do mês no calendário BR, caso algum mercado estrangeiro esteja em feriado naquela data (ex.: EUA) ou falhe na coleta, `eod_close` persiste em `market_price_history` com `is_month_end = true` o último preço oficial válido de `asset_prices` daquele ticker, evitando lacunas no fechamento mensal.

---

## 3. PLANO DE EXECUÇÃO GRANULAR E CHECKLIST VIVO

### BLOCO A — Motor Global de Cotações, Câmbio Oficial PTAX, Anti-Spam e Fechamento EOD/EOM na Nuvem

#### A.1 Banco de Dados, RLS e RPCs (`supabase/migrations/`)
- [x] **Criar** `supabase/migrations/20260101000142_global_market_quotes_engine.sql`:
  - [x] Limpar linhas legadas `user_id IS NOT NULL AND source <> 'manual'` em `asset_prices` e deduplicar `user_id IS NULL` mantendo o registro mais recente (`updated_at desc, id desc`).
  - [x] Dropar constraint legada `asset_prices_ticker_user_id_key` (se existir) e criar índices únicos parciais: `uq_asset_prices_global_ticker (ticker) WHERE user_id IS NULL` e `uq_asset_prices_user_manual_ticker (user_id, ticker) WHERE user_id IS NOT NULL`.
  - [x] Adicionar colunas `market_price_at timestamptz`, `fetched_at timestamptz`, `provider text`, `pending_spike_price numeric(18,8)`, `pending_spike_at timestamptz` + índice `idx_asset_prices_ticker_updated (ticker, updated_at desc)` em `asset_prices`.
  - [x] Adicionar `CHECK ((user_id IS NULL AND source IN ('api', 'fallback')) OR (user_id IS NOT NULL AND source = 'manual'))` e endurecer políticas RLS em `asset_prices` (`authenticated` só escreve com `user_id = auth.uid() AND source = 'manual'`; global exclusivo `service_role`).
  - [x] Criar RPC `public.upsert_global_asset_prices(p_rows jsonb)` (`SECURITY DEFINER`, `service_role` apenas, `ON CONFLICT (ticker) WHERE user_id IS NULL DO UPDATE` com trava **Never-Degrade**: não sobrescreve `source = 'api'` válida por `price <= 0`, `source = 'fallback'` ou `market_price_at` mais antigo).
  - [x] Atualizar `public.restore_backup(p_backup jsonb)`: ativar `set_config('app.snapshot_rpc', 'on', true)`, filtrar `asset_prices` para manter apenas `user_id IS NOT NULL AND (source = 'manual' OR manual_price IS NOT NULL)` com deduplicação `DISTINCT ON`, `source = 'manual'` e `ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE`.
  - [x] Criar `public.market_price_history` (`PK (ticker, reference_date)`, `price`, `currency`, `provider`, `market_price_at`, `month`, `is_month_end`, RLS leitura para `authenticated` ativo, escrita apenas `service_role` + rotina de retenção 90d EOD / permanente EOM).
  - [x] Criar `public.market_fetch_locks` + RPC `public.try_acquire_quote_locks(p_tickers text[], p_ttl_seconds int default 45)` (`service_role`).
  - [x] Criar `public.quote_refresh_rate_limits` + RPC `public.check_quote_refresh_rate_limit(p_user_id uuid, p_max_per_min int default 10, p_max_per_hour int default 60)` (`service_role`).
  - [x] Criar RPC `public.commit_monthly_closing_system(...)` (`service_role`, `set_config('app.snapshot_rpc', 'on', true)`, preservando `is_manually_calibrated = true` e `source = 'manual'` em `portfolio_monthly_prices`).

#### A.2 Edge Function, Motor Puro Compartilhado e Cron (`supabase/`)
- [x] **Alterar** `supabase/functions/_shared/quotes-core.ts`:
  - [x] Normalização de tickers: fracionário B3 (`PETR4F` → `PETR4.SA` / `PETR4`), ações EUA com ponto (`BRK.B` → `BRK-B`), BDRs/ETFs B3 (`.SA`) e tickers EUA curtos sem `.SA`, preservando ticker original no retorno.
  - [x] Classificador de mercado por ticker (`BR`, `US`, `FX`, `CRYPTO`) + calendário de feriados BR (ANBIMA/B3) e US (NYSE/NASDAQ) + horário de pregão com DST via `America/Sao_Paulo` e `America/New_York` + `isMarketOpenForTicker` e `getLastMarketCloseUtc`.
  - [x] Parsers preservando timestamps reais (`market_price_at`, `provider`) e `events.splits` + `chartPreviousClose` (Yahoo), `parseBrapiResponse` (timestamp real), `parseBcbPtaxResponse` (`cotacaoVenda`, paridade SGS Série 1) e `parseAwesomeApiResponse` (`create_date`).
  - [x] Evoluir `applySpikeGuardrail` (`evaluateSpikeGuardrail`) para modo split-aware (splits 5d úteis, consenso `chartPreviousClose`/provedor secundário, cache > 5d úteis, `pending_spike_price`/`pending_spike_at`, preservando `market_price_at` e `provider` quando bloqueado).
- [x] **Alterar** `supabase/functions/quotes/index.ts`:
  - [x] Ler `BRAPI_TOKEN` via `Deno.env.get("BRAPI_TOKEN")`.
  - [x] Pool de concorrência (máx. 6 simultâneas) + retry com backoff exponencial + jitter em HTTP 429/5xx/timeout.
  - [x] Cadeia `USDBRL=X`: BCB PTAX (lookback até 7 dias corridos) → Yahoo → AwesomeAPI.
  - [x] Validar tickers contra `portfolio_assets` (ou `USDBRL=X`) anti-envenenamento.
  - [x] Implementar EOD Guard por mercado (com trava anti-spoofing de `cache_miss`) + Cooldown (15 min padrão / 5 min `mode: 'report_preflight'`, bypass apenas `cache_miss` ou `post_trade_stale`) + `try_acquire_quote_locks` + `check_quote_refresh_rate_limit` + persistência via `upsert_global_asset_prices`.
  - [x] Implementar histórico mensal real (`month`: lê `market_price_history` c/ `is_month_end = true` primeiro; fallback Yahoo `period1`/`period2` reais + BCB PTAX último dia útil do mês e grava em `market_price_history`).
  - [x] Implementar `action: 'eod_close'` (todos tickers ativos + `USDBRL=X` → `asset_prices` + `market_price_history` + purge EOD > 90d; no último dia útil do mês BR, gravar `is_month_end = true` usando último preço oficial válido de `asset_prices` caso algum mercado estrangeiro esteja em feriado) e `action: 'close_month_global'` (congelamento EOM em `market_price_history` + hidratação `portfolio_monthly_prices` + fechamento `portfolio_snapshots` para carteiras elegíveis sem duplicar RF/Tesouro + auto-healing nos 3 primeiros dias úteis).
- [x] **Alterar** `supabase/quotes-cron.sql` (e `scripts/deploy-quotes.mjs` / `supabase/.env.example`):
  - [x] Remover crons intradiários (4x/dia); manter apenas `eod_close` (`22:00 UTC` seg–sex) e `close_month_global` (`22:30 UTC` seg–sex).

#### A.3 Camada Cliente (SWR Automático, Metadados, FX SSOT e Limpeza Client-Side)
- [x] **Alterar** `src/domain/portfolio/market-calendar.ts` (adicionar helpers multi-mercado BR/US/FX/CRYPTO para SWR no cliente).
- [x] **Alterar** `src/domain/portfolio/canonical-types.ts` e `src/domain/portfolio/canonical-engine.ts`:
  - [x] Preservar `source`, `manual_price`, `market_price_at`, `fetched_at` e `provider` em `evaluateInstantState` (fim do mascaramento de fallback/manual como `"Oficial API"`).
  - [x] Unificar `fxMetadata` (`rate`, `source`, `provider`, `fxRateAt`, `isFallback`) como SSOT em `CanonicalPortfolioState` (distinguindo PTAX real `5.25` de fallback estático `5.25`).
- [x] **Alterar** `src/data/repositories/asset-prices.ts` e `src/data/repositories/asset-prices.test.ts`:
  - [x] Remover `setAssetPriceFromApi` e `setAssetPricesBatchFromApi`.
  - [x] Selecionar `user_id`, `updated_at`, `fetched_at`, `market_price_at`, `provider` em `listAssetPrices` com ordenação determinística; corrigir `consolidateAssetPrices` (manual do dono > global mais recente).
  - [x] Adicionar `listMarketPriceHistoryByMonth(month)` em `src/data/repositories/asset-prices.ts`.
- [x] **Alterar** `src/services/quotes.ts` e `src/services/quotes.test.ts`:
  - [x] Remover `fetchBrapi`, `fetchAwesomeApi`, `VITE_BRAPI_TOKEN` e escrita em `asset_prices` pelo cliente.
  - [x] Manter `fetchPtaxForDate` (consultando `market_price_history` primeiro → BCB SGS Série 1) para o formulário de ordens históricas.
  - [x] Atualizar `syncMarketQuotesBatch` / `syncQuoteForTicker` / `syncQuotesForAssets` / `fetchOnlineQuote` para delegar 100% à Edge Function (`mode`, `reason`) e retornar metadados estruturados (incluindo cache hits / skipped / failed).
  - [x] Corrigir `fetchHistoricalMonthlyQuotes` para consultar `market_price_history` primeiro antes da Edge Function.
- [x] **Alterar** `src/tests/security-audit.test.ts`: remover `VITE_BRAPI_TOKEN` de `ALLOWED_CLIENT_ENV_VARS`, atualizar contagem de tabelas (`64` → `67`) e validar hardening multi-tenant da migration `000142`.
- [x] **Criar** `src/state/queries/use-market-quotes-swr.ts` (e exportar em `src/state/index.ts`):
  - [x] Motor SWR automático sob demanda: dispara na entrada de Home/Investimentos apenas para tickers vencidos (`>= 15 min` com mercado aberto) ou `cache miss` (1x mesmo fora do pregão), separa lotes `cache_miss` vs. `swr`, pausa offline / em background, revalida a cada 15 min enquanto ativo na aba de Investimentos com pregão aberto, e invalida `asset_prices` apenas se houver atualização real.
- [x] **Alterar** `src/state/queries/use-portfolio-position.ts`, `use-portfolio-monthly-position.ts`, `src/features/reports/hooks/use-investment-report-data.ts`:
  - [x] Consumir `fxMetadata` SSOT (preservando procedência do câmbio e metadados de cotação nas posições).
  - [x] Corrigir `usePortfolioMonthlyPosition` para usar `market_price_history` do mês (incluindo `USDBRL=X`), isolar estado por `${month}:${ticker}` e respeitar `isEstimate` / `fallbackQuotesCount` reais no mês atual.
- [x] **Alterar** `src/features/overview/pages/overview-page.tsx` e `src/features/investments/pages/investments-page.tsx`: conectar `useMarketQuotesSwr` (Home em modo entrada; Investimentos em modo entrada + intervalo ativo).
- [x] **Alterar / Criar testes Bloco A:** `src/tests/quotes-core.test.ts`, `src/data/repositories/asset-prices.test.ts`, `src/services/quotes.test.ts`, `src/domain/portfolio/canonical-engine.test.ts`, `src/domain/portfolio/market-calendar.test.ts` (e mocks de `@/state` em `overview-page.test.tsx`, `investments-page.test.tsx`, `accessibility-audit.test.tsx`).
- [x] **Portão de Segurança A:** rodar `npm run verify` + 8 suítes relacionadas + auditoria forense do diff + registrar resultado na Seção 4.

---

### BLOCO B — Stale Quote Guard, UI Passiva (Sem Botão Manual), Metadados no PDF e Conciliação por Custódia (BRL vs. USD)

#### B.1 Domínio Puro (Stale Quote Guard & Conciliação por Custódia)
- [x] **Criar** `src/domain/portfolio/stale-quote-guard.ts` + `src/domain/portfolio/stale-quote-guard.test.ts`:
  - [x] Detectar por ativo: `post_trade_stale` (ordem D+0 com data > `market_price_at` em `America/Sao_Paulo`), `missing_or_fallback`, `stale_market_data` (> 1 dia útil no calendário do respectivo mercado BR/US) e `fxWarning` quando houver custódia em USD.
- [x] **Criar** `src/domain/portfolio/custody-reconciliation.ts` + `src/domain/portfolio/custody-reconciliation.test.ts`:
  - [x] Cálculo em **centavos inteiros**: Custódia Brasil (BRL — incluindo `IVVB11`/ETFs B3, preservando-os na classe Internacional nos gráficos estratégicos) vs. Custódia Exterior (USD — subtotal exato em `US\$` + equivalente em `R\$` pelo mesmo `fxMetadata.rate` do cabeçalho).
  - [x] Garantir invariante `custodyBrazilCents + custodyForeignBRLCents === closingPatrimonyCents` (com ajuste de arredondamento explícito se necessário, nunca divergindo 1 centavo).
- [x] **Exportar** novos módulos em `src/domain/portfolio/index.ts`.

#### B.2 Proteção D+0 e Snapshot Provisional
- [x] **Alterar** `src/state/mutations/portfolio/use-portfolio-order-mutations.ts` e `use-portfolio-transaction-mutations.ts` (e `use-portfolio-asset-mutations.ts` / `portfolio-keys.ts`):
  - [x] Após ordem D+0 (`buy`/`sell`/`subscription`) ou cadastro de ativo novo (`cache miss`), invalidar `asset_prices` e disparar sync cirúrgico apenas do ticker + `USDBRL=X` (`reason: 'post_trade_stale' | 'cache_miss'`).
- [x] **Alterar** `src/hooks/use-auto-portfolio-snapshot.ts`:
  - [x] Bloquear gravação de snapshot provisional enquanto houver `post_trade_stale` ativo; manter estritamente restrito ao mês corrente provisional (e auto-reconciliação determinística de mês anterior fechado apenas quando `market_price_history` EOM já estiver congelado na nuvem).

#### B.3 UI Passiva (Remoção do Botão Manual) & Tooltips
- [x] **Alterar** `src/features/investments/components/resumo/use-resumo-tab-controller.ts`, `use-resumo-deep-links.ts`, `src/features/investments/pages/resumo-tab.tsx`, `src/features/investments/components/resumo/custody-section-card.tsx`:
  - [x] Remover o botão fixo "Atualizar Cotações" e handlers manuais redundantes (`useSyncQuotes`).
  - [x] Exibir indicador editorial discreto de referência/frescor no `CustodySectionCard` (B3, USD quando aplicável e câmbio USD/BRL com fonte real + micro-indicador silencioso durante revalidação SWR) e botão contextual discreto *"Tentar novamente"* **somente** quando houver ativo degradado/em erro.
- [x] **Alterar** `src/components/modules/position-table/position-columns.tsx`, `position-mobile-card-metrics.tsx` e `position-types.ts`:
  - [x] Enriquecer tooltip da coluna de preço com `market_price_at`, `provider`, status real (`Oficial`, `Manual`, `Fallback`) e eventual alerta do `StaleQuoteGuard`.

#### B.4 Refresh Pré-Relatório, Metadados no PDF e Conciliação DRY
- [x] **Criar** `src/features/investments/hooks/use-executive-report-refresh.ts`:
  - [x] Executa refresh pré-relatório (`mode: 'report_preflight'`, respeitando EOD Guard e cooldown de 5 min) ao abrir `PortfolioExecutiveReport` (mês atual) e `WealthTearSheetModal`, expondo progresso e diagnóstico final do `StaleQuoteGuard`.
- [x] **Criar** `src/components/modules/reports/custody-reconciliation-card.tsx` (DRY, `variant="ui"` e `variant="report"`):
  - [x] Reutilizado na aba Patrimônio (`ResumoTab`) e nos relatórios PDF (`ExecutiveReportDocument` e `WealthTearSheetModal`).
- [x] **Alterar** `src/components/modules/reports/report-document-layout.tsx`:
  - [x] Adicionar prop opcional `printWarning` abrindo `<ConfirmDialog />` (sem `autoFocus`) antes de imprimir, com confirmação disparando `triggerPrint` no gesto de clique.
- [x] **Alterar** `src/components/modules/reports/report-header.tsx`, `report-equity-class-table.tsx`, `report-class-table-parts.tsx`:
  - [x] Adicionar faixa editorial discreta no `ReportHeader` (Cotações B3, Cotações Exterior USD quando aplicável e Câmbio USD/BRL com 4 casas pt-BR, fonte real e data/hora).
  - [x] Corrigir legenda fixa de `ReportEquityClassTable` para exibir a fonte real do câmbio (eliminando texto fixo "PTAX Oficial BCB").
  - [x] Estender `ReportClassTableItem` com `quoteStatusFlag ("fallback" | "stale" | "manual" | null)` e `marketPriceAt`, exibindo marcador tipográfico discreto (sem emojis) + nota de rodapé compacta.
- [x] **Alterar** `src/domain/portfolio/executive-report-builder.ts` (+ `.test.ts`), `src/domain/reports/build-tear-sheet-model.ts`, `src/features/investments/components/portfolio-executive-report.tsx`, `executive-report/executive-report-document.tsx`, `src/features/reports/components/wealth-tear-sheet-modal.tsx`, `TearSheetCustodyAndBreakdowns.tsx`:
  - [x] Integrar `useExecutiveReportRefresh`, banner de alerta no preview quando degradado (`ReportQuoteStatusBanner`), `printWarning` no `ReportDocumentLayout`, metadados no `ReportHeader`, flags por linha e `CustodyReconciliationCard`.
- [x] **Portão de Segurança B:** testes unitários (`stale-quote-guard`, `custody-reconciliation`, `executive-report-builder`) + simulação de falha de API + auditoria `AGENTS.md` (zero `autoFocus`, zero emojis, zero nativos) + `npm run verify` + auditoria forense do diff + registrar resultado na Seção 4.

---

### BLOCO C — Limpeza da "Colcha de Retalhos" e Motor Unificado de Proventos Automatizados na Nuvem

#### C.1 Banco de Dados, RLS e RPCs de Proventos (`supabase/migrations/`)
- [x] **Criar** `supabase/migrations/20260101000143_automated_dividends_engine.sql`:
  - [x] Evoluir `public.corporate_dividends`: `ALTER COLUMN payment_date DROP NOT NULL`, adicionar `provider text`, `tax_rate_pct numeric(5,2) NOT NULL DEFAULT 0`, `is_type_uncertain boolean NOT NULL DEFAULT false`, `updated_at timestamptz NOT NULL DEFAULT now()`; substituir `uq_corporate_dividends` por `UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date)`.
  - [x] Criar RPC `public.upsert_corporate_dividend_system(...)` (`service_role`): antes de promover uma linha `payment_date IS NULL` para a data confirmada, verificar se já existe registro com aquela `payment_date` exata (evitando colisão de chave única em parcelas múltiplas), promovendo in-place por `(ticker, com_date, type)` + taxa compatível `±0,005` sem duplicar `user_dividend_events`.
  - [x] Criar `public.user_dividend_events` (RLS do dono; `status IN ('PROVISIONED', 'PENDING_CONFIRMATION', 'SETTLED', 'DISMISSED')`, `corporate_dividend_id`, `asset_id`, `ticker`, `type`, `com_date`, `payment_date`, `quantity_on_com_date`, `gross_rate`, `net_rate`, `tax_rate_pct`, `gross_amount`, `net_amount`, `currency`, `fx_rate_applied`, `settled_dividend_id`, `is_manual boolean`, `is_type_uncertain boolean`, `UNIQUE (user_id, corporate_dividend_id) WHERE corporate_dividend_id IS NOT NULL`) + migrar dispensas existentes de `portfolio_dividend_dismissals`.
  - [x] Adicionar `source_event_id uuid` + `UNIQUE (user_id, source_event_id) WHERE source_event_id IS NOT NULL` em `public.portfolio_dividends` (e atualizar `restore_backup` se necessário para preservar colunas).
  - [x] Criar RPCs transacionais `public.settle_user_dividend_event_system(...)` (`service_role`) e `public.confirm_user_dividend_events_atomic(...)` (`authenticated` ativo + write `investments`): remover trava `< 2026-01-01`, aplicar conversão cambial oficial USD→BRL ao creditar `CAIXA` quando `currency = 'USD'`, e garantir idempotência via `source_event_id`.

#### C.2 Pipeline de Proventos na Nuvem & Domínio Puro
- [x] **Alterar** `supabase/functions/_shared/quotes-core.ts` (parsers de proventos B3 Brapi `cashDividends` + Yahoo `events=div` B3 fallback com `isTypeUncertain: true` e EUA 30% IR + cálculo `com_date` dia útil NYSE anterior).
- [x] **Alterar** `supabase/functions/quotes/index.ts` e `supabase/quotes-cron.sql`:
  - [x] Corrigir `action: 'sync_corporate_dividends'` (cron `10:00 UTC` diário): somente tickers de renda variável ativos (excluir Caixa/RF), B3 via Brapi (`BRAPI_TOKEN`) com fallback Yahoo incerto, EUA via Yahoo 30%, upsert via `upsert_corporate_dividend_system`.
  - [x] Implementar `action: 'process_user_dividends'` (cron `11:30 UTC` diário): reconstrução `data-com`, anti-flood (`activatedAt` / janela segura 7 dias), deduplicação fuzzy (`±3 dias úteis`, `±0,05`), respeito a `user_preferences.custom_settings.dividendAutomation` e efetivação via `settle_user_dividend_event_system`.
- [x] **Alterar** `src/domain/portfolio/dividend-suggester.ts` (+ `.test.ts`):
  - [x] Corrigir `getCustodyAtComDate` (custódia baseline + compras/vendas + splits/inplits até fechamento da `com_date` em `America/Sao_Paulo`, sem UTC `toISOString`), separar totais BRL vs. USD com câmbio oficial e exportar helpers de deduplicação fuzzy e anti-flood.
- [x] **Criar** `src/domain/portfolio/provisioned-dividends.ts` + `src/domain/portfolio/provisioned-dividends.test.ts`:
  - [x] Agregação pura de `PROVISIONED` + `PENDING_CONFIRMATION` (BRL + USD convertido pelo `fxMetadata.rate`), com testes garantindo **isolamento contábil estrito** (nunca altera Patrimônio no Fechamento nem Caixa).
- [x] **Alterar** `src/data/repositories/portfolio.ts` e `src/data/rpc/portfolio.ts`:
  - [x] Corrigir `listCorporateDividends` (filtrar pelos tickers da carteira, sem `.limit(200)` global cego).
  - [x] Adicionar repositório/RPCs de `user_dividend_events` (listagem, criação/edição de provisionado manual, confirmação em lote, dispensa).
- [x] **Alterar** `src/state/queries/use-corporate-dividends.ts` (ou evoluir para `use-user-dividend-events.ts`) e `src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts`.

#### C.3 Limpeza da "Colcha de Retalhos", UI, Notification Hub & Preferências
- [x] **Remover** `src/features/investments/components/reinvest-dividends-banner.tsx` (código morto) e limpar código morto (`reinvestmentOpportunities`, `handleReinvest`, `handleReinvestCash`) em `src/features/investments/components/proventos/use-proventos-tab-controller.ts`.
- [x] **Eliminar as 3 instâncias duplicadas** de `PendingDividendsDialog` (`OverviewModalsHost`, `PortfolioInsightsCarousel`, `ProventosTab`) substituindo por um **modal único unificado** (sincronização reativa de `selectedIds`, edição de centavos/IR antes da confirmação, suporte a cadastro/conversão de provisionado manual, zero `autoFocus`, 100% primitivos `components/ui`).
- [x] **Integrar ao Notification Hub:** atualizar `src/domain/notifications/hub/event-detectors.ts`, `build-notification-center.ts`, `src/hooks/use-notification-center.ts` e `supabase/functions/push-dispatcher/index.ts` para eventos `PROVISIONED`, `PENDING_CONFIRMATION` e `SETTLED` (respeitando Horário Silencioso e preferências do usuário).
- [x] **Unificar banners/carrossel:** remover duplicidade entre `src/features/overview/components/corporate-dividends-banner.tsx` e `src/features/investments/components/insights-carousel/build-dividend-insight-items.tsx`, padronizando dispensa via `CarouselDismissPopover`.
- [x] **Corrigir e evoluir painéis de Proventos:**
  - [x] `src/features/investments/components/proventos/dividends-by-asset-panel.tsx`: formatar YoC com `formatPercent` (pt-BR).
  - [x] `src/features/investments/components/proventos/dividends-calendar-panel.tsx`: detalhar `PROVISIONED` vs. `PENDING_CONFIRMATION` por ativo, indicando alíquota/incerteza e data "a definir" quando `payment_date` for nula.
  - [x] `src/features/settings/components/tabs/notifications-tab.tsx` (novo card ou seção em `notifications/`): expor preferência `dividendAutomation` (`settlementMode: "auto" | "manual_confirm"`, `autoCreditCash`, `notifyOnProvisioned`, `notifyOnPayment`, gravando `activatedAt`).
  - [x] `src/components/modules/reports/custody-reconciliation-card.tsx`: adicionar linhas auxiliares (*Proventos Provisionados — A Receber* e *Total Projetado c/ Provisionados*) tanto na UI quanto nos PDFs executivos.

#### C.4 Documentação & Portão de Segurança Final (Bloco C)
- [x] **Atualizar** `docs/roadmap/ROADMAP.md`, `docs/architecture/ESPECIFICACAO_TECNICA.md` e `docs/architecture/PROJECT_STRUCTURE.md`.
- [x] **Rodar testes completos Bloco C + `npm run verify:full`** (custódia `data-com` com baseline/split, fiscal JCP/EUA, fallback Yahoo B3 → `PENDING_CONFIRMATION`, anti-flood retroativo, conversão USD→BRL no Caixa, deduplicação/idempotência, isolamento contábil de provisionados).
- [x] **Auditoria forense ponta a ponta** comparando 100% deste documento com o código implementado + registrar Portão C na Seção 4 e marcar plano como `CONCLUÍDO`.

---

## 4. CRITÉRIOS DE ACEITE E REGISTRO DOS PORTÕES DE SEGURANÇA

| Portão | Bloco | Verificações Obrigatórias | Status | Achados / Correções | Data |
|---|---|---|---|---|---|
| **Portão A** | Bloco A | Testes (`quotes-core`, `asset-prices`, EOD Guard BR/US, spike split-aware, PTAX lookback, paridade EOM, câmbio SSOT) + `npm run verify` + auditoria forense do diff (RLS, `restore_backup`, race conditions) | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes, `221/221` suítes / `3171/3171` testes de domínio); 8 suítes focadas ok (`8/8` arquivos, `186/186` testes incl. `security-audit.test.ts` 63/63, `quotes-core.test.ts` 33/33, `asset-prices.test.ts` 12/12, `quotes.test.ts` 9/9). Auditoria forense resolveu colisão de timestamp (`000141` → `000142`), deduplicação `DISTINCT ON` em `restore_backup`, filtro `.eq("is_month_end", true)` em consultas EOM, trava anti-spoofing de `cache_miss` no servidor e separação `cache_miss`/`swr` + merge `degradedTickers` no SWR. | 2026-11-23 |
| **Portão B** | Bloco B | Testes (`stale-quote-guard`, `custody-reconciliation`, `executive-report-builder`) + simulação de falha de API + zero botão manual + zero `autoFocus`/emojis + `npm run verify` + auditoria forense do diff | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes fora de `src/`, `223/223` suítes / `3180/3180` testes de domínio); 7 suítes focadas UI/PDF/segurança/a11y ok (`7/7` arquivos, `122/122` testes incl. `resumo-tab` 7/7, `investments-page` 9/9, `portfolio-executive-report` 8/8, `wealth-tear-sheet-modal` 7/7, `reports-page` 13/13, `accessibility-audit` 13/13, `security-audit` 63/63 e `portfolio-audit-gate-v3` na suíte de domínio). Removido `useSyncQuotes` e botão manual fixo; integrado `StaleQuoteGuard`, `CustodyReconciliationCard` DRY, flags `[M]`/`[D]`/`[E]`, `ConfirmDialog` de impressão sem `autoFocus` e `useMemo` em `effectiveFxMetadata`. | 2026-11-23 |
| **Portão C** | Bloco C | Testes (custódia `data-com`, fiscal JCP/EUA, fallback Yahoo B3 incerto, anti-flood, USD→BRL no Caixa, deduplicação/idempotência, isolamento provisionados) + `npm run verify:full` + auditoria forense final ponta a ponta | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`, `224/224` suítes / `3187/3187` testes de domínio); `17/17` suítes focadas ok (`302/302` testes incl. `quotes-core` 37/37, `security-audit` 64/64, `accessibility-audit` 13/13, `notifications-tab` 29/29); `npm run verify:full` (`8/8` testes Playwright E2E) exit 0. Antes do Portão C foram corrigidas 2 asserções desatualizadas: fixture baseline + novo caso em `dividend-suggester.test.ts` e nome `uq_corporate_dividends` em `security-audit.test.ts`. | 2026-11-23 |
| **Hardening Pós-Auditoria** | Blocos A, B & C | Revisão forense profunda em 4 frentes (SQL/Crons, Edge Functions/Data, Domínio/State/Hooks e UI/Modais/PDFs) + expansão de testes unitários + `npm run verify:full` + build Android `v3.17.1` (`Build 106`) | `APROVADO` | Hardening completo aplicado em SQL (`0142`/`0143`, `quotes-cron.sql`), Edge Functions (`quotes-core.ts`, `quotes/index.ts`, `push-dispatcher/index.ts` com timeouts 5s e claim atômico `in_flight`), repositórios (`asset-prices.ts` paginado, `user-preferences.ts` fila serializada + upsert, `portfolio.ts` chunks 150 + RPCs revert/dismiss), domínio puro (`canonical-engine`, `stale-quote-guard`, `dividends-analytics`, `custody-reconciliation`, `market-calendar`), hooks SWR/PIT/Snapshots (`useSyncExternalStore`, sem dupla contagem de `CAIXA`) e UI/PDF (`use-print` síncrono com `flushSync` para Safari/iOS, `PendingDividendsDialog`, `ReportEquityClassTable`, `PortfolioExecutiveReport`, `WealthTearSheetModal`, `DividendAutomationCard`). Verificado com `224/224` suítes de domínio (`3.193/3.193` testes), `190/190` suítes de infra/estado/segurança (`1.688/1.688` testes), `221/221` suítes de componentes/features (`1.551/1.551` testes) e `8/8` testes E2E Playwright. Push remoto ao Supabase (`db push` / `functions deploy`) pendente de `npx supabase login` devido a `401 Invalid access token` no CLI local. | 2026-11-23 |

---

## 5. LOG DE EXECUÇÃO E DECISÕES

- **2026-11-22 (Fase 0):** Meta-análise crítica concluída contra o código real (PG 17.6.1.155 confirmado; 10 refinamentos de risco/lacuna incorporados). Arquivo mestre criado. Aguardando aprovação explícita do usuário para iniciar o **Bloco A**.
- **2026-11-22 (Início Bloco A):** Plano aprovado pelo usuário com 3 ajustes incorporados (feriado cruzado no `is_month_end` via `asset_prices`, Never-Degrade SQL em `upsert_global_asset_prices` e checagem de colisão em parcelas múltiplas no `upsert_corporate_dividend_system` do Bloco C). Numeração das migrations ajustada para `000141` (Bloco A) e `000142` (Bloco C). Iniciando implementação do Bloco A.
- **2026-11-23 (Portão A Aprovado):** Bloco A concluído. Migration renomeada para `000142_global_market_quotes_engine.sql` (e Bloco C ajustado para `000143_automated_dividends_engine.sql`) devido à coexistência de `000141_new_user_default_preferences_refinement.sql` no workspace. Todos os checks do Portão A passaram após os ajustes finais (`npm run verify` + 8 suítes integradas com 0 falhas). Aguardando confirmação do usuário para iniciar o Bloco B.
- **2026-11-23 (Portão B Aprovado — Início Bloco C):** Bloco B implementado e validado (`npm run verify` + 7 suítes integradas, 0 erros de lint/TS, zero botão manual, zero `autoFocus`/emojis, invariante centavos 100% preservada). Seguindo plano mestre aprovado, iniciando **Bloco C** (`20260101000143_automated_dividends_engine.sql`, pipeline de proventos B3/EUA, modal único e Notification Hub).
- **2026-11-23 (Portão C Aprovado — Release v3.17.0 · Build 105):** Bloco C concluído e Portão C aprovado (`npm run verify`, `17/17` suítes focadas e `npm run verify:full` com `8/8` E2E Playwright aprovados). Documentação atualizada (`ESPECIFICACAO_TECNICA.md`, `PROJECT_STRUCTURE.md`, `ROADMAP.md`, `PLANO_MOTOR_COTACOES_PROVENTOS.md`), versão promovida para `3.17.0` (`Build 105`) com migrations `000142`/`000143` e Edge Functions `quotes`/`push-dispatcher` preparadas para push/deploy remoto (CLI Supabase retornou `401 Invalid access token` nesta sessão) e build do APK assinada.
- **2026-11-23 (Hardening Forense Pós-Auditoria — Release v3.17.1 · Build 106):** Auditoria forense em 4 subagentes especializados seguida de correção integral de todas as fragilidades identificadas em SQL, Edge Functions, camada de dados, domínio puro, React Query hooks, Notification Hub, relatórios A4/PDF e UI (`224/224` suítes de domínio / `3.193` testes, `190/190` suítes de infra/estado / `1.688` testes, `221/221` suítes de UI/features / `1.551` testes e `8/8` E2E Playwright aprovados), geração do APK assinado `v3.17.1` (`Build 106`), commit/push em `origin/main` e envio do relatório executivo ao bot ARGOS no Telegram.
