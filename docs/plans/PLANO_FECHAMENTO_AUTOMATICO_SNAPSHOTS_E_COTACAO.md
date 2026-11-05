# PLANO DE IMPLEMENTAÇÃO — FECHAMENTO AUTOMÁTICO DE SNAPSHOTS PATRIMONIAIS, SINCRONIZAÇÃO DE COTAÇÕES & MOTOR INTELIGENTE DE PROVENTOS E INSIGHTS EM CARROSSEL

> **Documento Canônico de Arquitetura, Engenharia de Dados e Governança de Software**  
> **Status:** Proposto / Consolidado, Otimizado e Pronto para Execução · Quality Gates QG1–QG7 Definidos  
> **Módulos Afetados:** `supabase/migrations/`, `supabase/functions/quotes/`, `supabase/`, `src/types/`, `src/domain/portfolio/`, `src/data/repositories/`, `src/services/`, `src/state/`, `src/hooks/`, `src/features/investments/`, `src/features/transactions/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Funções Puras no Domínio · Moeda em Centavos · Padrões CVM, ANBIMA e B3 · Zero Controles Nativos · Zero Emojis (`local/no-decorative-unicode`) · Portões de Qualidade (QG) por Fase  
> **Data:** Novembro de 2026 · **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano de engenharia resolve de ponta a ponta os maiores gargalos operacionais, de integridade matemática e de experiência da área de investimentos da plataforma, consolidando três pilares essenciais:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│              INFRAESTRUTURA INTEGRADA: FECHAMENTO DE CARTEIRA & MOTOR AUTÔNOMO DE PROVENTOS                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                          │
                 ┌────────────────────────────────────────┴────────────────────────────────────────┐
                 ▼                                                                                 ▼
   [PILAR 1: FECHAMENTO & SNAPSHOTS]                                                [PILAR 2: PROVENTOS & DIVIDENDOS]
   - Encerramento no último dia útil do mês                                         - Detecção autônoma de proventos da B3/EUA
   - Cotações oficiais consolidadas pós-19h BRT                                     - Ponto-no-tempo pela Data COM (não pelo pagamento)
   - Transacionalidade atômica (Zero snapshots desatualizados)                      - Deduplicação inteligente contra manuais
   - Server-Authoritative (pg_cron) + Client Just-in-Time                           - Invariante Contábil de Destinação Exclusiva
                 │                                                                  - Reversibilidade total (Undo + Aba Dispensados)
                 │                                                                                 │
                 └────────────────────────────────────────┬────────────────────────────────────────┘
                                                          ▼
                                    [PILAR 3: CENTRO DE AÇÕES & INSIGHTS EM CARROSSEL]
                                    - Carrossel Unificado de Insights (PortfolioInsightsCarousel)
                                    - Fim do empilhamento vertical de alertas (altura fixa compacta)
                                    - Trava inteligente de autoplay durante interação/foco
                                    - Inclusão em 1 clique de proventos direto no slide ativo
                                    - Rebalanceamento, desvio de alocação e marcos da Bola de Neve
                                                          │
                                                          ▼
                                    [CAMADA DE DADOS E ARQUITETURA SERVER-SIDE]
                                    - Supabase Postgres: RPCs transacionais atômicas com Rollback
                                    - Cache Corporativo Global: Cotações e Eventos Corporativos B3
                                    - Tabela de Dispensas Reversíveis (portfolio_dividend_dismissals)
                                    - Edge Function 'quotes': Orquestrador de cotações e proventos
                                                          │
                                                          ▼
                                     [CAMADA DE DOMÍNIO PURO & MATEMÁTICA CVM]
                                     - market-calendar.ts: Calendário de pregão e feriados B3
                                     - closing-validator.ts: Barreira pré-flight de cotações
                                     - dividend-suggester.ts: Cruzamento de Data COM com custódia
                                     - dividend-deduplication.ts: Fuzzy matching contra duplicidades
                                     - dividend-destination.ts: Regra de mútua exclusividade contábil
                                     - dividend-forecaster.ts: Projeção de confirmados vs estimados
                                                          │
                                                          ▼
                                   [EXPERIÊNCIA DO USUÁRIO MULTIPLATAFORMA (DESKTOP/PWA/APP)]
                                   - Centro de Comando no topo de Resumo: visual otimizado e calmo
                                   - RadioGroup de Destino: Caixa vs Orçamento (Zero duplo crédito)
                                   - Gestão de Dispensas: Toast com 'Desfazer' + Aba 'Dispensados'
                                   - Calendário Preditivo: Proventos Confirmados vs Estimados (FIIs)
                                   - Sinergia com Bola de Neve: Detecção do "Número Mágico" de cotas
```

### Pilar 1: Fechamento dos Snapshots e Cotações Oficiais
- **Autonomia Multiplataforma:** O fechamento patrimonial não depende de o usuário abrir o app ou de permissões restritas de segundo plano do sistema operacional (limitações de *Background Sync* no iOS Safari e *Doze Mode* no Android).
- **Consciência de Calendário de Mercado:** Encerramento no **último dia útil** e pós-pregão (18h30–21h00 BRT), evitando coletar dados parciais em fins de semana ou feriados bancários.
- **Barreira Absoluta de Integridade:** Transacionalidade atômica via Postgres RPC. Se qualquer cotação de ativo em custódia for inválida ou faltar, o banco executa `ROLLBACK` total.

### Pilar 2: Motor Inteligente de Proventos e Dividendos
- **Fim da Fricção de Digitação:** O usuário não precisa abrir a corretora para anotar provento por provento; o app apura os proventos da carteira automaticamente.
- **Rigor Regulatório (CVM/B3):** O cálculo respeita rigorosamente a **Data COM** (custódia apurada no fechamento da data de corte via `calculatePointInTimePosition`), e não a quantidade de cotas no dia do pagamento.
- **Tratamento Tributário Fidedigno:** Distinção exata entre Dividendos de ações / Rendimentos de FIIs (isentos) e JCP (desconto de 15% de IR na fonte), sugerindo o valor líquido real creditado em conta.
- **Invariante Contábil de Mútua Exclusividade de Destino:** O montante financeiro do provento obedece estritamente ao princípio de conservação de caixa: ou é reinvestido (incrementando o **Caixa de Investimentos**), ou é transferido para uso pessoal (entrando como **Receita de Dividendos no Orçamento**), ou apenas registrado contabilmente. **É terminantemente proibido creditar simultaneamente no Caixa e no Orçamento**.
- **Reversibilidade Total & Aprendizado Contínuo:** Dispensas de proventos contam com *Undo* imediato via Toast (5 segundos) e uma aba dedicada de "Dispensados" no Inbox, permitindo restaurar qualquer sugestão a qualquer momento.

### Pilar 3: Centro Unificado de Ações & Insights da Carteira em Carrossel
- **Substituição do Túnel Vertical de Cards:** Unificação do `AllocationDriftCard`, do `DividendSuggestionsInbox`, do marco da Bola de Neve e dos alertas quantamentais em um carrossel horizontal compacto e nobre (`PortfolioInsightsCarousel`), nos moldes do consolidado `DashboardAlertsCarousel` da Home.
- **Trava Inteligente de Interação:** O autoplay é pausado automaticamente em hover, em toques na tela e enquanto qualquer controle interno estiver em foco (`onFocus`), eliminando a fragilidade de troca de slides involuntária durante a escolha de opções.
- **Resolução em 1-Clique no Slide:** O investidor pode aprovar todos os proventos diretamente no slide ativo, recebendo feedback tátil instantâneo (`triggerSensory("success")`) com transição suave para o próximo slide ativo ou colapso limpo caso a carteira fique 100% em dia.

---

## 2. MATRIZ DE FRAGILIDADES DIAGNOSTICADAS & SALVAGUARDAS BLINDADAS

| # | Fragilidade Diagnosticada | Causa Raiz | Salvaguarda Blindada de Engenharia |
|---|---|---|---|
| **F1** | Inviabilidade de background execution confiável no PWA/Mobile | O WebKit (iOS Safari) não suporta *Periodic Background Sync*. O Android suspende tarefas via *Doze Mode*. No Desktop, a aba precisa estar aberta. | Migração da responsabilidade primária de fechamento para o servidor via `pg_cron` e Edge Function, transformando o cliente em consumidor passivo e reconciliador *Just-in-Time*. |
| **F2** | Snapshot gravado com cotações intradiárias ou inexistentes | Disparos realizados antes das 18h30 BRT ou em fins de semana capturam dados parciais ou repetidos. | Implementação do motor de calendário de mercado (`market-calendar.ts`), mapeando feriados da B3 e agendando o fechamento para as 21h00 BRT do último dia útil do mês. |
| **F3** | Dessincronia entre cotações e snapshot (escrita não-atômica) | O cliente executa mutações separadas (`upsertPortfolioMonthlyPricesBatch` e `upsertPortfolioSnapshot`). Se a conexão cair entre uma e outra, o snapshot fica dessincronizado. | Criação da RPC atômica `commit_monthly_closing_atomic` no Postgres. A gravação das cotações e do snapshot ocorre em um único bloco `BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK;`. |
| **F4** | Gravação de snapshot com cotação zerada em caso de falha de API | Falta de barreira pré-gravação (*pre-flight validation*). Na ausência de preço, o sistema usava fallback cego de custo ou zero. | Validador estrito de cobertura no domínio (`closing-validator.ts`): se qualquer ativo de risco em custódia retornar sem preço válido $> 0$, o fechamento é expressamente rejeitado. |
| **F5** | Provento calculado sobre cotas incorretas | Multiplicar o dividendo pela quantidade atual de cotas em vez da posição na Data COM. | Utilização do motor de custódia retroativa ponto-no-tempo (`calculatePointInTimePosition`), apurando a quantidade exata detida no fechamento da Data COM. |
| **F6** | Sugestão com valor bruto divergente do saldo da corretora | JCP anunciado com valor bruto sem descontar os 15% de IR retidos na fonte pela B3. | O cache corporativo armazena `gross_rate` e `net_rate`. O motor sugere sempre o valor líquido real creditado em conta, exibindo badge `[JCP · 15% IR retido]`. |
| **F7** | Duplicação de proventos já inseridos manualmente | O usuário cadastra o dividendo manualmente na hora em que recebe o aviso da corretora; posteriormente a rotina sugere o mesmo provento. | Motor de deduplicação com *fuzzy matching* (`dividend-deduplication.ts`): compara `asset_id`, janela de data ($\pm 3$ dias úteis) e valor ($\pm 2$ centavos). Se houver match, associa silenciosamente sem duplicar. |
| **F8** | Projeção irreal de dividendos de ações no calendário futuro | Replicar dividendos extraordinários de ações cíclicas (ex.: commodities) para meses futuros. | Segregação estrita no calendário: ações exibem apenas proventos com Data COM confirmada; projeções estimadas são limitadas a FIIs e Fiagros com tag visual `[Estimado]`. |
| **F9** | Duplicação de liquidez por destinação conflitante | Checkboxes independentes permitindo marcar "Creditar no Caixa" e "Registrar no Orçamento" ao mesmo tempo, inflando o patrimônio ficticiamente. | **Invariante de Mútua Exclusividade**: Componente `RadioGroup` e validação de domínio em `dividend-destination.ts` exigindo opção única (`"investment_cash" \| "monthly_income" \| "record_only"`). |
| **F10**| Dispensas de proventos irreversíveis por clique acidental | O usuário clica em "Dispensar" por engano e perde a sugestão para sempre sem conseguir desfazer. | Mecanismo duplo de reversibilidade: (1) Toast com ação `Desfazer` de 5 segundos; (2) Sub-aba "Dispensados" no Inbox de proventos com botão `Restaurar Sugestão`. |
| **F11**| Poluição visual por acúmulo de cards de alerta verticais | `AllocationDriftCard`, alertas de proventos e cards de insights empilhados verticalmente empurram os gráficos para baixo da dobra. | **Unificação em Carrossel Horizontal (`PortfolioInsightsCarousel`)**: Espaço nobre vertical fixo de ~150px, com ordenação por prioridade e colapso gracioso quando tudo estiver em dia. |
| **F12**| Troca involuntária de slide durante a interação com o carrossel | O autoplay do carrossel roda a cada 8 segundos e troca de slide enquanto o usuário seleciona opções do RadioGroup ou confere valores. | **Trava de Autoplay Reativa**: Pausa imediata no autoplay durante o `hover`, toques na tela (`touchStart`) e foco em qualquer controle interativo interno (`onFocus`). |

---

## 3. FASES DE EXECUÇÃO DETALHADAS & ETAPAS

### FASE 1: ARQUITETURA DE DADOS & TRANSAÇÃO ATÔMICA NO POSTGRES (PILAR 1)

**Objetivo:** Blindar o banco de dados para que seja fisicamente impossível salvar um snapshot sem que todas as cotações do fechamento estejam gravadas e validadas.

- [ ] **Etapa 1.1: Migration de Enriquecimento de Snapshots (`supabase/migrations/`)**
  - Adicionar as colunas `status` (`varchar(20) default 'provisional' check (status in ('provisional', 'closed'))`), `closing_date` (`date null`) e `closed_at` (`timestamptz null`) na tabela `portfolio_snapshots`.
  - Criar índice otimizado: `create index idx_portfolio_snapshots_user_month_status on portfolio_snapshots (user_id, month, status);`.
- [ ] **Etapa 1.2: Criação da RPC Transacional `commit_monthly_closing_atomic`**
  - Implementar a função em PL/pgSQL com transação atômica (`SECURITY INVOKER`):
    - Parâmetros: `p_month text`, `p_closing_date date`, `p_prices jsonb`, `p_total_value numeric`, `p_total_cost numeric`.
    - Validação de invariantes: verifica se `p_prices` não está vazio e se nenhum item possui `price <= 0`.
    - Executa upsert em lote na tabela `portfolio_monthly_prices`.
    - Executa upsert na tabela `portfolio_snapshots` marcando `status = 'closed'` e `closed_at = now()`.
    - Em caso de qualquer inconsistência, emite `RAISE EXCEPTION`, provocando rollback automático.
- [ ] **Etapa 1.3: Atualização dos Tipos Canônicos TypeScript (`src/types/database.ts` e `src/types/portfolio.ts`)**
  - Atualizar a interface `PortfolioSnapshot` para incluir `status: "provisional" | "closed"`, `closing_date?: string` e `closed_at?: string`.

---

#### 🛡️ PORTÃO DE QUALIDADE 1 (QG1) — TRANSAÇÃO ATÔMICA NO BANCO
> **Critérios Inegociáveis de Passagem:**
> 1. A migration roda limpa e idempotente sem quebrar a série histórica existente.
> 2. Testes de banco confirmam que se qualquer cotação for inválida (`price <= 0`), **nenhuma linha** é gravada no banco (rollback total verificado).
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/tests/cross-tenant-penetration.test.ts
> npx tsc --noEmit
> ```

---

### FASE 2: MOTOR DE DOMÍNIO — CALENDÁRIO DE MERCADO E VALIDADOR PRÉ-FLIGHT (PILAR 1)

**Objetivo:** Criar regras de negócio puras em `src/domain/` para gerenciar datas de fechamento da B3 e validar cotações antes do envio ao banco.

- [ ] **Etapa 2.1: Calendário de Mercado Financeiro (`src/domain/portfolio/market-calendar.ts`)**
  - Função pura `getLastTradingDayOfMonth(year: number, month: number): string (YYYY-MM-DD)`.
  - Mapeamento estático e determinístico de feriados nacionais e bancários da B3.
  - Função pura `isMarketClosingAvailable(currentDate: Date, targetMonth: string): boolean`:
    - Retorna `true` apenas se a data e hora atual forem iguais ou posteriores às 19h00 BRT do último dia útil daquele mês.
- [ ] **Etapa 2.2: Validador Pré-Flight de Cotações (`src/domain/portfolio/closing-validator.ts`)**
  - Função pura `validateClosingEligibility`:
    - Cruza a custódia do fechamento com as cotações obtidas.
    - Exige cotação $> 0$ para 100% dos ativos de renda variável e Tesouro Direto.
    - Retorna `{ canCommit: boolean, missingTickers: string[], validatedPrices: MonthlyPriceInput[] }`.
- [ ] **Etapa 2.3: Testes Unitários de Domínio (`market-calendar.test.ts` e `closing-validator.test.ts`)**
  - Cobertura completa de meses encerrados em sábado, domingo e feriados bancários.

---

#### 🛡️ PORTÃO DE QUALIDADE 2 (QG2) — MOTOR PURO DE CALENDÁRIO & PRÉ-FLIGHT
> **Critérios Inegociáveis de Passagem:**
> 1. Suíte de testes de calendário cobrindo 100% dos cenários de feriados bancários e fins de semana.
> 2. Zero dependências externas ou imports de banco em `src/domain/portfolio/`.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/domain/portfolio/market-calendar.test.ts src/domain/portfolio/closing-validator.test.ts
> npx tsc --noEmit
> ```

---

### FASE 3: BACKEND DE FECHAMENTO — EDGE FUNCTION & AGENDADOR PG_CRON (PILAR 1)

**Objetivo:** Orquestrar o fechamento autônomo no servidor, dispensando a presença do usuário no último dia do mês.

- [ ] **Etapa 3.1: Expansão da Edge Function `quotes` (`supabase/functions/quotes/index.ts`)**
  - Implementar modo de ação de fechamento mensal (`action: 'close_month'`).
  - Buscar cotações oficiais da data de corte e executar consolidação em lote com `service_role`.
- [ ] **Etapa 3.2: Script SQL do Cron (`supabase/monthly-closing-cron.sql`)**
  - Configurar job no `pg_cron` agendado para rodar às 21h00 BRT nos dias úteis.
  - Documentar auditoria em `FOUNDER_RUNBOOK.md`.
- [ ] **Etapa 3.3: Testes Automatizados de Orquestração (`src/tests/quotes-cron.test.ts`)**
  - Validar hardening de permissões e segurança contra chamadas não-autorizadas.

---

#### 🛡️ PORTÃO DE QUALIDADE 3 (QG3) — SERVIÇO DE BACKEND & CRON
> **Critérios Inegociáveis de Passagem:**
> 1. A Edge Function compila com Deno sem erros de tipagem.
> 2. Chamadas anônimas recebem HTTP 401; chamadas `service_role` processam o fechamento.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/tests/quotes-cron.test.ts src/tests/quotes-cron-and-ratelimits.test.ts
> ```

---

### FASE 4: MODELAGEM DE PROVENTOS, EVENTOS CORPORATIVOS E DISPENSAS REVERSÍVEIS (PILAR 2)

**Objetivo:** Modelar as estruturas de dados no Postgres para armazenar eventos corporativos globais da B3/EUA, gerenciar a reversibilidade de sugestões e registrar destinações financeiras.

- [ ] **Etapa 4.1: Migration de Eventos Corporativos Globais (`supabase/migrations/`)**
  - Criar tabela `corporate_dividends` (cache global com `user_id` nulo):
    - `id uuid primary key default gen_random_uuid()`
    - `ticker text not null`
    - `event_type varchar(20) not null check (event_type in ('dividend', 'jcp', 'fii_yield', 'amortization'))`
    - `gross_rate numeric(16,8) not null` (valor bruto anunciado)
    - `net_rate numeric(16,8) not null` (valor líquido descontado de 15% para JCP)
    - `com_date date not null` (Data COM / corte)
    - `payment_date date not null` (Data do crédito)
    - `currency varchar(3) default 'BRL'`
    - `source varchar(20) default 'brapi'`
    - `created_at timestamptz default now()`
    - Constraint de unicidade: `unique (ticker, event_type, com_date, payment_date)`.
- [ ] **Etapa 4.2: Enriquecimento de `portfolio_dividends` e Tabela de Dispensas Reversíveis**
  - Adicionar em `portfolio_dividends`:
    - `corporate_dividend_id uuid null references corporate_dividends(id) on delete set null`
    - `source varchar(20) default 'manual' check (source in ('manual', 'suggested_1click', 'auto_commit'))`
    - `destination varchar(20) default 'investment_cash' check (destination in ('investment_cash', 'monthly_income', 'record_only'))`
    - `linked_income_id uuid null references incomes(id) on delete set null`
  - Criar tabela `portfolio_dividend_dismissals` (com suporte total a reversão/delete):
    - `user_id uuid not null references auth.users(id) on delete cascade`
    - `corporate_dividend_id uuid not null references corporate_dividends(id) on delete cascade`
    - `dismissed_at timestamptz default now()`
    - Primary key: `(user_id, corporate_dividend_id)`.
- [ ] **Etapa 4.3: Atualização dos Contratos TypeScript (`src/types/schema.ts` e `src/types/database.ts`)**
  - Adicionar tipos `CorporateDividend`, `PortfolioDividendDismissal`, `DividendDestination` e inputs de mutação em lote.

---

#### 🛡️ PORTÃO DE QUALIDADE 4 (QG4) — MODELAGEM DE PROVENTOS & RLS
> **Critérios Inegociáveis de Passagem:**
> 1. Migration executada com sucesso com RLS ativado em `corporate_dividends` (leitura pública autenticada, escrita restrita a service_role) e `portfolio_dividend_dismissals` (isolamento rigoroso por usuário).
> 2. Testes de invasão cross-tenant comprovam impossibilidade de um usuário ler ou mutar dispensas de terceiros.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/tests/cross-tenant-penetration.test.ts
> npx tsc --noEmit
> ```

---

### FASE 5: MOTOR DE DOMÍNIO — DATA COM, TRIBUTAÇÃO, DEDUPLICAÇÃO & DESTINAÇÃO EXCLUSIVA (PILAR 2)

**Objetivo:** Criar os motores puros que cruzam a custódia do usuário na Data COM com os proventos declarados, descontam tributação, eliminam duplicidades, projetam o calendário futuro e asseguram a mútua exclusividade de destino.

- [ ] **Etapa 5.1: Motor de Deduplicação e Fuzzy Matching (`src/domain/portfolio/dividend-deduplication.ts`)**
  - Função pura `matchExistingDividend`:
    - Compara um evento corporativo com a lista de proventos já cadastrados em `portfolio_dividends`.
    - Regra de matching: mesmo ativo (`asset_id`), data de pagamento na janela de $\pm 3$ dias úteis e valor em centavos com tolerância de até R$ 0,02 (ajuste de arredondamento de corretoras).
    - Retorna `matched: boolean, existingDividendId?: string`.
- [ ] **Etapa 5.2: Motor de Apuração de Sugestões de Proventos (`src/domain/portfolio/dividend-suggester.ts`)**
  - Função pura `calculateDividendSuggestions`:
    - Recebe: ativos do usuário, histórico de transações até a Data COM (`calculatePointInTimePosition`), eventos corporativos vigentes, proventos já cadastrados e lista de IDs dispensados.
    - Para cada evento com data de pagamento decorrida ou corrente:
      1. Se já está dispensado ou já possui match com provento existente $\rightarrow$ ignora (ou marca como dispensado para a aba de dispensas).
      2. Apura cotas na data COM. Se cotas $\le 0 \rightarrow$ ignora.
      3. Calcula total líquido: $\text{Cotas na Data COM} \times \text{net\_rate}$.
      4. Gera sugestão estruturada com metadados para auditoria (cotas na data COM, valor por cota, data de pagamento, IR retido).
- [ ] **Etapa 5.3: Regra de Mútua Exclusividade de Destinação (`src/domain/portfolio/dividend-destination.ts`)**
  - Tipo puro `DividendDestination = "investment_cash" | "monthly_income" | "record_only"`.
  - Função pura `validateDividendDestination`:
    - Garante a conservação contábil de caixa: se `destination === "monthly_income"`, o valor **não pode** alterar o saldo de `cash_checkpoints`. Se `destination === "investment_cash"`, o valor **não pode** gerar linha em `incomes`.
- [ ] **Etapa 5.4: Motor de Calendário Preditivo & Bola de Neve (`src/domain/portfolio/dividend-forecaster.ts`)**
  - Função pura `projectUpcomingDividends`:
    - Segrega os proventos futuros em duas faixas:
      1. **Confirmados:** Eventos corporativos com Data COM decorrida e pagamento futuro (100% determinísticos).
      2. **Estimados (FIIs/Fiagros):** Para fundos com histórico contínuo nos últimos 6 meses, projeta o dividendo dos próximos 1 a 3 meses com base no último rendimento distribuído.
    - Calcula o indicador de **Número Mágico**: verifica se o provento de um FII cobre o custo de aquisição de 1 nova cota inteira.
- [ ] **Etapa 5.5: Testes Unitários de Domínio (`dividend-suggester.test.ts`, `dividend-deduplication.test.ts`, `dividend-destination.test.ts`, `dividend-forecaster.test.ts`)**
  - Cobertura de compra de cotas pós-Data COM (não deve receber provento).
  - Cobertura de JCP com desconto exato de 15% de IR.
  - Cobertura de deduplicação e teste de invariante da destinação exclusiva de liquidez.

---

#### 🛡️ PORTÃO DE QUALIDADE 5 (QG5) — MOTOR PURO DE PROVENTOS & DEDUPLICAÇÃO
> **Critérios Inegociáveis de Passagem:**
> 1. Suíte de testes matemáticos com 100% de aprovação.
> 2. Proibição absoluta de cálculo de provento sobre cotas adquiridas após a Data COM.
> 3. Deduplicação com 0% de falso-positivos em lançamentos com tickers distintos.
> 4. Garantia matemática de que a destinação de liquidez é mutuamente exclusiva (zero duplo crédito).
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/domain/portfolio/dividend-suggester.test.ts src/domain/portfolio/dividend-deduplication.test.ts src/domain/portfolio/dividend-destination.test.ts src/domain/portfolio/dividend-forecaster.test.ts
> npx tsc --noEmit
> ```

---

### FASE 6: RECONCILIAÇÃO JUST-IN-TIME, REPOSITÓRIOS, AUTO-COMMIT & DISPENSAS (PILAR 1 & 2)

**Objetivo:** Conectar o frontend e o backend para ingestão de eventos da B3 via Brapi, reconciliação Just-in-Time, reversão de dispensas e execução da destinação selecionada.

- [ ] **Etapa 6.1: Ingestão de Proventos Corporativos na Edge Function `quotes`**
  - Adicionar rotina noturna que consulta proventos declarados na API Brapi (`/api/quote/{ticker}?dividends=true`) para todos os ativos em custódia na plataforma.
  - Gravar os eventos na tabela `corporate_dividends` calculando `net_rate` (aplicando 85% para JCP e 100% para Dividendos e FIIs).
- [ ] **Etapa 6.2: Repositórios e Mutações com Destinação Exclusiva (`src/data/repositories/` e `src/state/mutations/`)**
  - Implementar `portfolio-dividends-batch.ts`:
    - Mutação `useApproveDividendsBatch`:
      - Insere em lote os proventos em `portfolio_dividends`.
      - Se `destination === 'investment_cash'`: atualiza atômica e exclusivamente o saldo de Caixa da carteira (`cash_checkpoints`).
      - Se `destination === 'monthly_income'`: cria atômica e exclusivamente uma linha em `incomes` (Receita) vinculada à categoria de Rendimentos.
      - Se `destination === 'record_only'`: não altera saldos financeiros.
    - Mutação `useDismissDividendSuggestion`: insere na tabela `portfolio_dividend_dismissals`.
    - Mutação `useRestoreDismissedDividend`: remove da tabela `portfolio_dividend_dismissals`, fazendo o provento reaparecer imediatamente no Inbox ativo.
- [ ] **Etapa 6.3: Refatoração de `useAutoPortfolioSnapshot` com Contingência de Proventos & Fechamento**
  - Ao abrir o app, executa as duas verificações em paralelo com travas de `useRef`:
    1. Verifica se o mês anterior está com `status === 'closed'`; se pendente, aciona `commitMonthlyClosingAtomic` com cotações validadas.
    2. Se o usuário tiver ativado a preferência de **Auto-Commit de Proventos**, aprova automaticamente os proventos detectados com a destinação padrão configurada.

---

#### 🛡️ PORTÃO DE QUALIDADE 6 (QG6) — REPOSITÓRIOS, ESTADO & JUST-IN-TIME
> **Critérios Inegociáveis de Passagem:**
> 1. Inserção em lote de proventos funcionando com invalidação precisa de cache (`["portfolio_dividends"]`, `["portfolio_position"]`, `["cash_checkpoints"]`, `["incomes"]`, `["corporate_dividends"]`).
> 2. Reversão de dispensa testada: restaurar um provento faz ele reaparecer no Inbox sem refresh de página.
> 3. Zero loops infinitos no hook `useAutoPortfolioSnapshot`.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/hooks/use-auto-portfolio-snapshot.test.ts src/state/mutations/use-portfolio-mutations.test.ts
> npx tsc --noEmit
> ```

---

### FASE 7: CENTRO UNIFICADO DE INSIGHTS EM CARROSSEL, UX DE PROVENTOS & HOMOLOGAÇÃO (PILAR 3)

**Objetivo:** Construir a experiência visual no Desktop, PWA e Mobile nativo, consolidando o Carrossel Unificado de Insights, o seletor exclusivo e a homologação completa.

- [ ] **Etapa 7.1: Desenvolvimento do Componente `PortfolioInsightsCarousel` (`src/features/investments/components/`)**
  - Implementar o componente unificado estendendo o padrão canônico do `DashboardAlertsCarousel`:
    - Prioridade 1: **Slide de Proventos Detectados** (com mini-extrato, total acumulado, RadioGroup de Destino e botão de aprovação em 1 clique).
    - Prioridade 2: **Slide de Desvio de Alocação** (substituindo o card isolado com diagnóstico de drift e CTA "Simular Aporte").
    - Prioridade 3: **Slide de Conquista Bola de Neve** (com cota autossuficiente atingida).
    - Prioridade 4: **Slide de Insights Quantamentais** (alertas de concentração ou oportunidade).
  - Trava inteligente de autoplay: pausa em `hover`, `touchStart` e foco de input (`onFocus`), eliminando trocas de slide involuntárias.
  - Comportamento de saída limpa: ao aprovar os proventos em 1 clique, dispara `triggerSensory("success")` e o slide transiciona suavemente para o próximo item útil.
  - Se a carteira estiver 100% balanceada e sem proventos pendentes: exibe card calmo neutro (*"Carteira em dia e balanceada"*) ou colapsa suavemente.
- [ ] **Etapa 7.2: Componente `DividendSuggestionsInbox` e Gestão de Dispensados em `proventos-tab.tsx`**
  - Na aba Proventos, disponibilizar a visão completa detalhada com filtros: `[Pendentes (3)]` e `[Dispensados (1)]`.
  - Ação de dispensar provento aciona Toast imediato com botão `Desfazer` (5 segundos).
  - Na aba "Dispensados": lista de proventos ignorados com botão `[Restaurar]` para reinserir no Inbox ativo.
- [ ] **Etapa 7.3: Atualização da Sub-Aba Calendário com Visão Preditiva**
  - Na sub-aba "Calendário" de `proventos-tab.tsx`:
    - Adicionar seção de **Próximos Proventos Previstos (30–90 dias)**.
    - Coluna de status discriminando claramente `[Confirmado]` (Data COM atingida) de `[Estimado · FII]` (projeção recorrente pontilhada).
- [ ] **Etapa 7.4: Configurações de Preferência (`settings-page.tsx`)**
  - Switch em Investimentos: *"Lançar proventos oficiais da B3 automaticamente no dia do pagamento (Auto-Commit)"*.
  - Select de Destinação Padrão para Auto-Commit: `Caixa de Investimentos` ou `Receita no Orçamento`.
- [ ] **Etapa 7.5: Homologação Visual Multiplataforma & Testes E2E**
  - Conferir responsividade em telas mobile pequenas ($< 380\text{px}$) e desktop widescreen.
  - Atualização dos documentos canônicos em `docs/` (`ESPECIFICACAO_TECNICA.md`, `ARCHITECTURE.md`, `ROADMAP.md`).

---

#### 🛡️ PORTÃO DE QUALIDADE 7 (QG7 — FINAL) — HOMOLOGAÇÃO COMPLETA & DEPLOY READY
> **Critérios Inegociáveis de Passagem:**
> 1. Suíte de testes completa passando sem regressões: testes de domínio, repositórios, hooks, carrossel e penetração.
> 2. `npm run lint` limpo, sem violação da regra `local/no-decorative-unicode` (zero emojis).
> 3. `npx tsc --noEmit` com zero erros de tipo.
> 4. Build de produção do Vite e compilação do Android (`npm run build`) concluídos com sucesso.
> 
> **Comandos de Verificação:**
> ```bash
> npm run lint
> npx tsc --noEmit
> npm run test
> npm run build
> ```

---

## 4. MATRIZ DE ARQUIVOS AFETADOS

| Ação | Arquivo | Finalidade |
|---|---|---|
| **NEW** | `supabase/migrations/20261105_portfolio_snapshots_closing.sql` | Migration de status de snapshots e RPC transacional de fechamento |
| **NEW** | `supabase/migrations/20261106_corporate_dividends_cache.sql` | Migration de eventos corporativos, proventos sugeridos, destinação e dispensas reversíveis |
| **NEW** | `supabase/monthly-closing-cron.sql` | Script SQL de agendamento no `pg_cron` para fechamento às 21h BRT |
| **NEW** | `src/domain/portfolio/market-calendar.ts` | Motor puro de calendário de mercado da B3 e detecção de fechamento |
| **NEW** | `src/domain/portfolio/market-calendar.test.ts` | Testes de unidade do calendário de mercado financeiro |
| **NEW** | `src/domain/portfolio/closing-validator.ts` | Validador pré-flight de integridade de cotações para fechamento |
| **NEW** | `src/domain/portfolio/closing-validator.test.ts` | Testes do validador pré-flight de fechamento |
| **NEW** | `src/domain/portfolio/dividend-suggester.ts` | Motor de cruzamento de Data COM com custódia e apuração líquida |
| **NEW** | `src/domain/portfolio/dividend-suggester.test.ts` | Testes de apuração de proventos por Data COM e tributação |
| **NEW** | `src/domain/portfolio/dividend-deduplication.ts` | Motor de fuzzy matching e deduplicação contra lançamentos manuais |
| **NEW** | `src/domain/portfolio/dividend-deduplication.test.ts` | Testes de matching e eliminação de proventos duplicados |
| **NEW** | `src/domain/portfolio/dividend-destination.ts` | Motor e regras de mútua exclusividade contábil de destinação |
| **NEW** | `src/domain/portfolio/dividend-destination.test.ts` | Testes da invariante de destinação exclusiva de proventos |
| **NEW** | `src/domain/portfolio/dividend-forecaster.ts` | Motor de projeção de proventos futuros (confirmados vs estimados) |
| **NEW** | `src/domain/portfolio/dividend-forecaster.test.ts` | Testes de projeção do calendário preditivo |
| **NEW** | `src/data/repositories/portfolio-monthly-closing.ts` | Repositório cliente de chamada da RPC atômica |
| **NEW** | `src/data/repositories/corporate-dividends.ts` | Repositório de leitura de eventos corporativos e dispensas reversíveis |
| **NEW** | `src/features/investments/components/portfolio-insights-carousel.tsx` | Carrossel unificado de insights, desvio de alocação e proventos com trava de autoplay |
| **NEW** | `src/features/investments/components/portfolio-insights-carousel.test.tsx`| Testes de priorização, autoplay com trava de foco e ações em 1 clique |
| **NEW** | `src/features/investments/components/dividend-suggestions-inbox.tsx` | Componente de inbox, aprovação em 1 clique, seletor exclusivo e gestão de dispensados |
| **NEW** | `src/features/investments/components/dividend-suggestions-inbox.test.tsx`| Testes de renderização, reversibilidade, destinação exclusiva e ações em lote |
| **MODIFY** | `supabase/functions/quotes/index.ts` | Adição de handlers para fechamento de mês e ingestão de proventos Brapi |
| **MODIFY** | `src/types/database.ts` | Tipagem do banco enriquecida com `corporate_dividends`, destinação e dispensas |
| **MODIFY** | `src/types/schema.ts` | Contratos de domínio atualizados para proventos automáticos e `DividendDestination` |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.ts` | Reconciliador Just-in-Time com trava pré-flight e auto-commit |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.test.ts` | Testes do ciclo de vida e concorrência do hook atualizado |
| **MODIFY** | `src/state/mutations/use-portfolio-monthly-mutations.ts` | Migração para uso da RPC atômica |
| **MODIFY** | `src/state/mutations/use-portfolio-mutations.ts` | Adição de mutations em lote de proventos com destinação exclusiva e restauração |
| **MODIFY** | `src/features/investments/pages/resumo-tab.tsx` | Substituição do card isolado pelo `PortfolioInsightsCarousel` unificado |
| **MODIFY** | `src/features/investments/pages/proventos-tab.tsx` | Inclusão do inbox de sugestões, aba dispensados e calendário preditivo |
| **MODIFY** | `src/features/investments/components/portfolio-snapshots-carousel.tsx` | Badges semânticos de status do snapshot (`closed` vs `provisional`) |
| **MODIFY** | `docs/architecture/ESPECIFICACAO_TECNICA.md` | Registro formal das regras canônicas de fechamento, proventos e carrossel |
| **MODIFY** | `docs/roadmap/ROADMAP.md` | Atualização do plano de entregas |

---

## 5. RESUMO DE BENEFÍCIOS TÉCNICOS & OPERACIONAIS

1. **Centro de Comando Unificado e Elegante:** O topo da aba Investimentos ganha um carrossel horizontal compacto e interativo (`PortfolioInsightsCarousel`), eliminando o empilhamento vertical de alertas e mantendo a visibilidade imediata dos gráficos de alocação.
2. **Experiência Interativa Blindada Contra Troca de Slides:** A trava de autoplay garante que o carrossel pause no momento em que o usuário interagir com qualquer elemento interno, prevenindo frustrações ao escolher destinações ou clicar em botões.
3. **Zero Fricção no Registro de Proventos:** O investidor deixa de digitar notas de corretagem manualmente; a plataforma detecta, calcula e oferece a inclusão em 1 clique direto no carrossel ou na aba Proventos.
4. **Conservação Contábil Absoluta:** O valor do provento é estritamente mutuamente exclusivo: ou reinvestido na carteira (Caixa de Investimentos), ou consumido no orçamento (Receita de Dividendos), ou puramente histórico. É eliminada qualquer possibilidade de duplicação financeira de saldos.
5. **Reversibilidade Completa & Controle do Usuário:** Nenhuma ação de dispensa é definitiva ou destrutiva; o investidor conta com Toast de *Desfazer* imediato e pode reativar qualquer provento ignorado na aba de Dispensados.
6. **Precisão Matemática e Tributária Impecável:** A quantidade de cotas é ancorada na **Data COM** (e não na data do pagamento) e o **JCP é deduzido em 15% na fonte**, eliminando divergências com o extrato da corretora.
7. **Fechamento Histórico Blindado:** Snapshots corrompidos ou com cotações desatualizadas deixam de existir através da transacionalidade atômica no Postgres e da independência em relação ao dispositivo do usuário.
8. **Harmonia com o Design System:** Toda a interface utiliza componentes nativos encapsulados, badges semânticos discretos, tipografia monetária adaptativa (`<MoneyText />`) e zero emojis, respeitando a identidade elegante do produto.
