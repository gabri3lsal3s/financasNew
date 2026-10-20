# 🛡️ Diagnóstico Mestre de Segurança, Velocidade e Escala para Alto Volume Concorrente

> **Status:** Diagnóstico Técnico Canônico Aprovado  
> **Arquivo Oficial:** `docs/DIAGNOSTICO_SEGURANCA_PERFORMANCE_ESCALA.md`  
> **Data:** 20 de Outubro de 2026  
> **Diretrizes de Governança:** Vinculado estritamente a `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STRUCTURE.md` e `ESPECIFICACAO_TECNICA.md`.  
> **Premissa Operacional:** Suportar de 1.000 a 10.000 usuários ativos diários (DAU) com picos de centenas de acessos concorrentes em fechamento de mês/faturas e aberturas simultâneas de notificações push, mantendo **blindagem de segurança nível bancário**, **latência sub-segundo** e **custo mínimo/zero adicional** sobre a infraestrutura padrão (Supabase + Cloudflare Pages).

---

## 1. Sumário Executivo & Score de Prontidão

A aplicação apresenta uma base arquitetural sólida, com separação de camadas limpa (`domain/` puro com Vitest colocalizado, `state/` orquestrando TanStack Query e `data/` isolando chamadas Supabase), 100% das tabelas cobertas por Row Level Security (RLS) e bundle do Vite altamente otimizado com chunks dedicados e PWA atômico.

Contudo, para atingir o patamar de **1.000 a 10.000 clientes diários sem gargalos e no menor custo possível**, foram identificados pontos de estrangulamento de alto impacto (gargalos de concorrência e desperdício de requisições) que precisam de intervenção cirúrgica antes de campanhas de tráfego intenso.

### Matriz de Prontidão Técnica (Health Score 0–100)

| Pilar Técnico | Score Atual | Gargalo Principal Identificado | Score Pós-Mitigação |
|---|:---:|---|:---:|
| **1. Banco de Dados & Supabase** | **84/100** | Avaliação não-escalar de funções RLS (`auth.uid()` vs `(select auth.uid())`) em policies legadas e overhead de verificação de módulos linha a linha. | **98/100** |
| **2. APIs Externas & Quotas** | **62/100** | Chamadas diretas do navegador para `brapi.dev` em `fetchOnlineQuote` em caso de ticker não cacheado (risco imediato de HTTP 429 sob concorrência). | **96/100** |
| **3. Frontend, Cache & Tráfego** | **80/100** | Disparo de *Refetch Storms* no TanStack Query (`refetchOnWindowFocus: true` padrão em mobile ao alternar apps); ausência de debounce em buscas. | **97/100** |
| **4. Segurança Multitenant & Headers** | **88/100** | Ausência de política de `Content-Security-Policy` (CSP) em `public/_headers` contra injeção e exfiltração; falta de rate limit em rotas de auth. | **99/100** |
| **MÉDIA GLOBAL DE PRONTIDÃO** | **78.5/100** | **Pronto para tráfego moderado; exige Quick Wins para escala comercial.** | **97.5/100** |

---

## 2. Modelo de Carga & Premissas de Escala

### 2.1 Perfil de Volume & Tráfego Projetado

- **Base de Clientes:** 1.000 a 10.000 DAU (Daily Active Users).
- **Pico de Concorrência Simultânea:** 200 a 800 sessões ativas simultâneas.
- **Janelas Críticas de Pico:**
  1. *Fechamento de Mês (dias 28 a 05):* Registro massivo de despesas, conferência de extratos bancários, orçamentos e conciliação de faturas.
  2. *Disparos de Notificação Push (08:00 e 19:00):* Centenas de usuários abrindo o app no mesmo minuto via alerta de fatura/dívida prestes a vencer.
  3. *Abertura de Mercado B3 (10:00 às 10:30):* Usuários conferindo cotações de carteira e proventos.

### 2.2 Capacidade do Tier Padrão vs Demanda de Concorrência

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INFRAESTRUTURA DE PRODUÇÃO                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ Cloudflare Pages (Frontend)    │ • Tráfego Ilimitado (Edge Global)     │
│                                │ • Cache de Assets Imutável (HTTP 200) │
│                                │ • Latência de borda < 25ms            │
├────────────────────────────────┼───────────────────────────────────────┤
│ Supabase PostgREST (Stateless) │ • Conexões HTTP via Pooler Supavisor  │
│                                │ • 1 conexão cliente != 1 conexão PG   │
│                                │ • Suporta 10.000 req/min com pooling  │
├────────────────────────────────┼───────────────────────────────────────┤
│ PostgreSQL Engine (Compute)    │ • CPU & Memória limitados pelo tier   │
│                                │ • Gargalo real: Queries lentas (seq   │
│                                │   scans) e re-avaliações de RLS       │
└────────────────────────────────┴───────────────────────────────────────┘
```

> [!TIP]
> O segredo para atender 10.000 clientes no menor custo possível **não é aumentar a máquina do banco**, mas sim **eliminar 80% das requisições desnecessárias no cliente** (com caching inteligente no TanStack Query) e garantir que as requisições que chegam ao Postgres executem em **menos de 3 milissegundos via Index-Only Scans**.

---

## 3. Diagnóstico Técnico por Pilar

---

### PILAR 1: Banco de Dados PostgreSQL & Supabase

#### Achado 1.1 — Subplan Caching de RLS (`auth.uid()` vs `(select auth.uid())`)
- **Severidade:** ALTA (Impacto em throughput e CPU do Postgres).
- **Diagnóstico:** Em migrações anteriores à 0041 (como `20260101000002_rls.sql` e `20260101000013_recurrences.sql`), diversas políticas de RLS foram escritas utilizando `auth.uid() = user_id` diretamente.
- **Mecanismo do Gargalo:** No PostgreSQL, `auth.uid()` é tratada como função volátil no contexto de predicados de linha. Quando escrita sem subquery escalar, o motor do Postgres é forçado a re-executar a resolução de contexto de autenticação para **cada linha avaliada no scan**. Em uma tabela com 5.000 despesas, isso gera 5.000 invocações de função por query.
- **Solução Recomendada (Quick Win):** Normalizar 100% das policies para `(select auth.uid()) = user_id`. Com a sintaxe `(select auth.uid())`, o planejador do Postgres gera um **InitPlan**, avalia a expressão uma única vez por consulta, armazena o valor escalar em memória e aplica o scan de índice diretamente com uma constante.
- **Ganho Esperado:** Redução de 60% a 90% no tempo de CPU do banco de dados em consultas filtradas.

#### Achado 1.2 — Otimização de Funções Modulares RLS (`get_user_module_access`)
- **Severidade:** MÉDIA-ALTA.
- **Diagnóstico:** A migração `0041_saas_rls_and_rpc_hardening.sql` introduziu verificações de módulos SaaS dentro das policies RLS:
  ```sql
  (select auth.uid()) = user_id
  and public.is_current_user_active()
  and public.get_user_module_access(auth.uid(), 'investments') in (...)
  ```
  Embora `get_user_module_access` e `is_current_user_active` estejam marcadas como `STABLE`, se não estiverem encapsuladas em `(select ...)`, o PostgreSQL pode avaliá-las repetidamente durante a filtragem de linhas.
- **Solução Recomendada:** Padronizar as verificações de autorização nas policies como:
  ```sql
  (select auth.uid()) = user_id
  and (select public.is_current_user_active())
  and (select public.can_current_user_read_module('investments'))
  ```
  Isso transforma todas as checagens de permissão de usuário em nós `InitPlan` executados 1 única vez antes do scan da tabela.

#### Achado 1.3 — Cobertura de Índices em Chaves Estrangeiras e Consultas Compostas
- **Severidade:** BAIXA-MÉDIA (Mitigado em grande parte pela migração 0031).
- **Diagnóstico:** A migração `0031_performance_covering_indexes.sql` já cobriu com sucesso os índices cobridores primários (`idx_expenses_user_date_covering`, `idx_incomes_user_date_covering`, `idx_debts_user_covering`, `idx_portfolio_assets_user_covering`).
- **Ponto de Atenção Residual:** A tabela `portfolio_transactions` possui índice `idx_portfolio_tx_user_date on (user_id, date desc)`, mas a listagem de transações frequentemente filtra por ativo `asset_id`. Adicionar um índice composto `(user_id, asset_id, date desc)` eliminará sequential scan quando o usuário abrir a ficha detalhada de um ativo com histórico longo.

#### Achado 1.4 — Dimensionamento do Pooler de Conexões (Supavisor)
- **Severidade:** CRÍTICA em picos simultâneos.
- **Diagnóstico:** O app consome dados via `@supabase/supabase-js`, que utiliza a API REST PostgREST por padrão. O PostgREST não mantém conexões de banco presas durante o ciclo de vida do cliente no navegador (é totalmente stateless e usa o pool de conexões do Supavisor em Transaction Mode).
- **Recomendação Operacional:** Garantir que nenhuma chamada futura use conexão PostgreSQL direta (`postgres://...:5432`) no front-end. O pooling via porta `6543` (Transaction Mode) ou via PostgREST na porta HTTPS 443 é a arquitetura ideal e deve ser rigorosamente mantida.

---

### PILAR 2: APIs Externas, Cotações & Terceiros

#### Achado 2.1 — Gargalo Crítico de Cotações Client-Side (Brapi / Yahoo Finance)
- **Severidade:** CRÍTICA (Ponto de falha imediato para 1.000+ usuários simultâneos).
- **Diagnóstico:** Em `src/services/quotes.ts`:
  ```ts
  // Linha 138: Requisição direta do browser para a API Brapi
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}${token}`;
  
  // Linha 337: Fallback que dispara requisições concorrentes para ativos faltantes
  const fallbackResults = await Promise.allSettled(missingTickers.map((t) => fetchOnlineQuote(t)));
  ```
- **Mecanismo da Falha:** Se 500 clientes logarem às 10:00 e possuírem 10 ativos em suas carteiras cujas cotações não estejam no cache local do dia, serão disparadas **5.000 requisições simultâneas do browser para a Brapi**.
  1. A API Brapi aplica rate limiting agressivo (geralmente 60 a 120 req/min no plano básico/público);
  2. Todos os usuários receberão erro `429 Too Many Requests`;
  3. A chave de API pública ou token `VITE_BRAPI_TOKEN` fica esgotada, quebrando o cálculo de patrimônio.
- **Solução Canônica de Escala (Custo Zero):**
  - **Arquitetura 100% Server-Side Cache:** O cliente **NUNCA** deve chamar a Brapi diretamente em fluxo padrão de listagem.
  - O banco de dados já possui a tabela `asset_prices` e a Edge Function `quotes` agendada via `quotes-cron.sql` (executada a cada poucas horas pelo `pg_cron` / `pg_net`).
  - O front-end deve ler exclusivamente da tabela `asset_prices` (`user_id is null or user_id = auth.uid()`).
  - Caso um ativo nunca antes cadastrado seja inserido por um usuário, o cliente invoca a Edge Function `/functions/v1/quotes` (que possui cache em servidor e rate limiting centralizado), e nunca a API externa diretamente.
- **Ganho Esperado:** Eliminação de 100% dos erros 429, blindagem de tokens de cotação e redução do tráfego do navegador.

#### Achado 2.2 — Upload e Processamento de Extratos Bancários (OFX, CSV, PDF)
- **Severidade:** MÉDIA.
- **Diagnóstico:** A importação de extratos (`BankStatementImportDialog` e `StatementImportDialog`) processa os arquivos de forma totalmente client-side via Web Workers e funções de parsing puras em `src/domain/reconciliation/`. Isso é excelente para escalabilidade, pois **não consome CPU do servidor** durante o parsing.
- **Ponto de Risco:** Envio de lotes excessivamente volumosos para as RPCs `import_bank_transactions` e `import_statement_expenses` (ex.: extratos de 1.000 linhas em um único JSON).
- **Mitigação Recomendada:** Limitar no client-side o lote de importação para no máximo 300 transações por chunk de envio, evitando payloads JSON > 1MB no PostgREST e prevenindo timeouts de transação no banco.

---

### PILAR 3: Frontend, Cache & Tráfego de Rede

#### Achado 3.1 — Refetch Storms no TanStack Query (`refetchOnWindowFocus`)
- **Severidade:** ALTA (Maior causador de tráfego fantasma no banco).
- **Diagnóstico:** Em `src/app/providers.tsx`:
  ```ts
  new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 30_000 },
      mutations: { retry: false },
    },
  })
  ```
  No TanStack Query, as propriedades `refetchOnWindowFocus` e `refetchOnReconnect` possuem o valor padrão `true`.
- **Mecanismo do Desperdício:**
  - Em dispositivos móveis (Android/PWA) ou abas de desktop, toda vez que o usuário alterna entre o aplicativo do banco e o financasNew (para checar um comprovante, copiar código Pix ou conferir fatura), o evento de foco na janela dispara **imediatamente o refetch de todas as queries ativas na tela** se tiverem mais de 30 segundos;
  - Com 5.000 usuários alternando telas, isso gera dezenas de milhares de requisições de leitura repetidas no Supabase, consumindo tráfego e conexões sem nenhuma necessidade real.
- **Solução Recomendada (Quick Win):**
  Ajustar o `defaultOptions` global em `providers.tsx`:
  ```ts
  queries: {
    retry: 1,
    staleTime: 60_000, // 1 minuto para dados transacionais
    gcTime: 10 * 60_000, // 10 minutos de retenção em cache
    refetchOnWindowFocus: false, // Erradica tempestade de requisições ao trocar de app
    refetchOnReconnect: "always",
  }
  ```
  Para dados estáticos/configurações (categorias, preferências de tema, metas anuais), utilizar `staleTime: 300_000` (5 minutos) ou infinito com invalidação dirigida por mutações.
- **Ganho Esperado:** Queda imediata de **50% a 70% no volume total de requisições diárias** ao Supabase.

#### Achado 3.2 — Debounce e Cancelamento de Requisições de Busca
- **Severidade:** MÉDIA.
- **Diagnóstico:** Na listagem de transações (`TransactionListPage`), as buscas por texto e filtros rápidos realizam filtragem sobre os dados em memória já carregados no mês atual (o que é rápido). No entanto, relatórios com ranges customizados que efetuam busca no servidor devem assegurar debounce de 350ms e cancelamento automático de queries anteriores (`AbortController` do TanStack Query) para não enfileirar requisições sobrepostas.

#### Achado 3.3 — Retenção de Cache de Borda e Chunks Imutáveis no Cloudflare Pages
- **Severidade:** POSITIVA (Excelente configuração atual).
- **Diagnóstico:** Em `public/_headers`, os chunks compilados `/assets/*` já estão configurados com:
  `Cache-Control: public, max-age=31536000, immutable`.
  Isso garante que 99% dos arquivos estáticos JS/CSS/WebP são servidos pela CDN da Cloudflare sem nunca tocar no servidor de origem, com custo zero e banda ilimitada.

---

### PILAR 4: Segurança Multitenant, Autenticação & Headers

#### Achado 4.1 — Ausência de Content-Security-Policy (CSP) no Cloudflare Pages
- **Severidade:** ALTA (Segurança e Compliance Financeiro).
- **Diagnóstico:** Em `public/_headers`, estão presentes os headers `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` e `Permissions-Policy`, mas **NÃO há Content-Security-Policy configurada**.
- **Risco:** Sem CSP, caso ocorra qualquer injeção de script de terceiros (via pacote NPM comprometido ou vulnerabilidade XSS), o navegador não impedirá conexões com servidores maliciosos externos.
- **Solução Recomendada (Quick Win):** Configurar CSP estrita no `public/_headers` permitindo scripts e conexões apenas com domínios autorizados da aplicação:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://brapi.dev; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  ```

#### Achado 4.2 — Proteção contra Brute Force e Credential Stuffing
- **Severidade:** ALTA.
- **Diagnóstico:** A autenticação é gerenciada pelo Supabase Auth (`supabase.auth.signInWithPassword`). O Supabase possui rate limiting embutido no gateway do GoTrue (limite padrão de tentativas de login por IP).
- **Recomendação:** No painel do Supabase (**Authentication -> Rate Limits**), verificar e garantir que os limites de `Email sending` (30/hora) e `Sign-in attempts` (30/minuto por IP) estejam ativados, impedindo ataques de força bruta automatizados que possam degradar o banco.

#### Achado 4.3 — Isolamento Multitenant e Validação de Ownership
- **Severidade:** BLINDADO (100% de conformidade com a auditoria de migrações).
- **Diagnóstico:** Todas as 34 tabelas possuem RLS ativado e 100% das inserções/atualizações impõem `user_id = auth.uid()` ou chaves estrangeiras validadas em subqueries (`categories.user_id = auth.uid()`). A suíte `src/tests/security-audit.test.ts` valida automaticamente em cada build que nenhuma tabela órfã sem RLS é criada.

---

## 4. Auditoria Funcionalidade por Funcionalidade

Abaixo, a avaliação detalhada do comportamento de concorrência e velocidade para cada uma das 11 áreas funcionais do aplicativo:

### 4.1 Overview (Dashboard Consolidado)
- **Perfil de Carga:** É a tela com maior volume de acessos (100% dos usuários passam por ela).
- **Comportamento Atual:** Carrega transações do mês, orçamentos, metas de renda, cartões e resumo de carteira. Os cálculos pesados (partição da barra de orçamento, sparklines, liquidez e projeções) já foram migrados para `useMemo` na Tarefa 4.4 do plano anterior.
- **Gargalo Potencial:** Múltiplas queries paralelas disparadas no mount.
- **Mitigação de Escala:** Agrupar stale times do Dashboard para 60 segundos e desabilitar `refetchOnWindowFocus`, evitando recarregamento em cascata toda vez que a aba ganha foco.

### 4.2 Transações (Receitas & Despesas)
- **Perfil de Carga:** Alta frequência de escrita e leitura.
- **Comportamento Atual:** Filtradas estritamente por mês (`gte date, lt date`). O volume típico é de 50 a 300 registros por mês por usuário, o que roda em menos de 10ms com os índices `idx_expenses_user_date_covering` e `idx_incomes_user_date_covering`.
- **Gargalo Potencial:** Importação de extratos bancários em lote.
- **Mitigação de Escala:** Lotes de importação limitados a 300 registros por chamada RPC para garantir resposta < 150ms no banco.

### 4.3 Cartões de Crédito & Faturas
- **Perfil de Carga:** Picos intensos no fechamento de fatura.
- **Comportamento Atual:** Despesas de cartão filtradas por competência de fatura (`bill_competence`) e pagamentos parciais via `card_payments`.
- **Segurança & Velocidade:** Validado com índice composto `idx_expenses_user_card` e RLS com checagem de ownership no cartão. Transições e agrupamentos memoizados no React.

### 4.4 Orçamentos & Metas
- **Perfil de Carga:** Leitura constante no início e fim de mês; baixa escrita.
- **Comportamento Atual:** Tabela `budgets` coberta por `idx_budgets_user_category_month` cobrindo o campo `limit`.
- **Escalabilidade:** Quase zero impacto no banco. Os dados são leves (< 2KB por mês) e devem ter `staleTime` estendido para 5 minutos.

### 4.5 Dívidas & Empréstimos
- **Perfil de Carga:** Leitura frequente no módulo de saúde financeira; mutações pontuais em pagamentos.
- **Comportamento Atual:** Cálculos de progresso e amortização centralizados em funções puras (`calculateLoanProgress`, `calculateDebtsSummary`).
- **Escalabilidade:** Índice cobridor `idx_debts_user_covering` ativo. Risco de concorrência nulo.

### 4.6 Investimentos (Carteira, Cotações & Proventos)
- **Perfil de Carga:** Alta sensibilidade a concorrência e dependência externa de cotações.
- **Comportamento Atual:** Contém cálculos contábeis do ledger, conversão cambial e TIR (XIRR).
- **Ponto Crítico Identificado:** Dependência do endpoint da Brapi no front-end em caso de ticker faltante (Achado 2.1).
- **Ação Obrigatória:** Blindagem para consumir estritamente o cache do banco `asset_prices`, delegando fetching externo para edge functions agendadas.

### 4.7 Relatórios & Exportações
- **Perfil de Carga:** Consultas analíticas pesadas abrangendo até 12 meses (366 dias).
- **Comportamento Atual:** Consultas executadas com filtros de range temporal `listExpensesByRange` e `listIncomesByRange`.
- **Escalabilidade:** Os índices cobridores com `INCLUDE` da migração 0031 evitam leituras de heap no banco. No cliente, a geração de planilhas Excel/CSV utiliza streams em memória via `@sheetjs` sem bloquear a UI.

### 4.8 Notificações & Lembretes
- **Perfil de Carga:** Sincronização local em segundo plano.
- **Comportamento Atual:** Utiliza `syncDueReminderNotifications` despachando para LocalNotifications no Android ou Web Notifications no PWA.
- **Escalabilidade:** Excelente arquitetura: os lembretes são computados localmente no dispositivo a partir das dívidas/faturas já em cache, **sem disparar push notifications remotas custosas** no servidor para cada aviso diário.

### 4.9 Assinatura, SaaS & Billing
- **Perfil de Carga:** Webhooks de pagamento (Asaas/Stripe) e verificação de status Pro.
- **Comportamento Atual:** Tabelas `subscriptions`, `system_features` e `user_module_overrides`.
- **Segurança & Velocidade:** Políticas de RLS em 0041 e 0046 aplicadas. Webhook com assinatura criptográfica e idempotência por `event_id`.

### 4.10 Painel Administrativo
- **Perfil de Carga:** Acesso restrito a administradores (`role = 'admin'`).
- **Segurança:** 100% blindado por RLS (`public.is_admin()`). Não afeta a performance dos clientes comuns.

### 4.11 Configurações & Preferências
- **Perfil de Carga:** Leitura única na inicialização (`useUserPreferences`).
- **Comportamento Atual:** Sincronizado via `CloudPreferencesSync` com debounce em atualizações.
- **Escalabilidade:** Dados com tamanho irrisório (< 1KB), retidos em cache por 10 minutos.

---

## 5. Matriz de Riscos & Priorização de Impacto

```
ALTO IMPACTO │  [Achado 2.1]             [Achado 1.1]
             │  Gargalo Brapi            Subplan Caching RLS
             │  (HTTP 429)               (CPU no Postgres)
             │
             │  [Achado 4.1]             [Achado 3.1]
             │  Ausência de CSP          Refetch Storms
             │  no Cloudflare            TanStack Query
             │
BAIXO IMPACTO│  [Achado 3.2]             [Achado 1.3]
             │  Debounce em              Índice composto
             │  Relatórios               portfolio_tx
             └──────────────────────────────────────────
                BAIXA CONCORRÊNCIA       ALTA CONCORRÊNCIA
```

| ID | Vulnerabilidade / Gargalo | Severidade | Probabilidade em Pico | Impacto se não tratado |
|---|---|:---:|:---:|---|
| **R1** | Refetch Storms ao alternar janelas/apps no mobile | **ALTA** | **100%** | Multiplicação desnecessária de conexões e consumo da cota do Supabase. |
| **R2** | Cotações chamadas diretamente no client (Brapi) | **CRÍTICA** | **85%** | Bloqueio imediato por limite de taxa (HTTP 429) no módulo de investimentos. |
| **R3** | Políticas RLS sem subquery escalar `(select auth.uid())` | **ALTA** | **70%** | Lentidão progressiva nas queries conforme o volume de linhas aumenta. |
| **R4** | Ausência de CSP nos cabeçalhos HTTP | **ALTA** | **30%** | Risco de injeção e falha em auditorias de segurança bancária. |
| **R5** | Lotes de importação de extratos sem teto rígido | **MÉDIA** | **40%** | Travamento temporário da thread do Postgres em uploads massivos. |

---

## 6. Plano de Ação: "Quick Wins de Custo Zero" (Execução Faseada)

O plano de ação está estruturado para **multiplicar a capacidade do aplicativo em até 10x sem gastar 1 centavo adicional em servidores**, aproveitando a inteligência de cache e as capacidades nativas do PostgreSQL e do Cloudflare Pages.

### FASE 1: Quick Wins Imediatos no Frontend & Cabeçalhos (Impacto Instantâneo)

- [ ] **Ação 1.1 — Eliminação de Refetch Storms no TanStack Query:**
  - Em `src/app/providers.tsx`: desativar `refetchOnWindowFocus: false` e calibrar `staleTime: 60_000` (1 min para transações) e `gcTime: 600_000` (10 min de retenção).
  - Em queries de leitura estática (categorias, preferências, planos): definir `staleTime: 300_000` (5 minutos).
- [ ] **Ação 1.2 — Implementação de Content-Security-Policy (CSP) Estrita:**
  - Em `public/_headers`: adicionar cabeçalho `Content-Security-Policy` bloqueando origens externas não autorizadas e permitindo apenas Supabase, Sentry e assets locais.
- [ ] **Ação 1.3 — Blindagem de Fallback de Cotações Client-Side:**
  - Em `src/services/quotes.ts`: desativar requisições em leque para a Brapi no browser em listagens regulares; utilizar prioritariamente a tabela de preços do banco e acionar edge function com debounce apenas em adições pontuais de novos tickers.

### FASE 2: Quick Wins no Banco de Dados Supabase (Otimização de Throughput)

- [ ] **Ação 2.1 — Normalização de RLS para InitPlan (`(select auth.uid())`):**
  - Criar migração SQL de performance revisando policies que ainda utilizam `auth.uid() = user_id` solto para `(select auth.uid()) = user_id`, permitindo que o PostgreSQL use avaliação escalar única.
- [ ] **Ação 2.2 — Encapsulamento de Checagens de Módulos SaaS:**
  - Garantir que chamadas a `is_current_user_active()` e `can_current_user_read_module(...)` nas policies RLS estejam encapsuladas em subqueries escalares `(select ...)`.
- [ ] **Ação 2.3 — Índice Composto Complementar em Transações de Ativos:**
  - Adicionar índice `idx_portfolio_tx_user_asset_date` em `portfolio_transactions (user_id, asset_id, date desc)`.

### FASE 3: Validação de Carga & Homologação de Segurança

- [ ] **Ação 3.1 — Testes Automatizados de Regressão de Segurança & CSP:**
  - Expandir `src/tests/security-audit.test.ts` para validar o cabeçalho CSP em `public/_headers` e a ausência de chamadas a domínios não autorizados.
- [ ] **Ação 3.2 — Testes de Penetração RLS Cross-Tenant:**
  - Validar isolamento horizontal completo simulando dois usuários concorrentes nas tabelas centrais.
- [ ] **Ação 3.3 — Quality Gate Global:**
  - `npm run typecheck` (0 erros).
  - `npm run lint` (0 erros e 0 avisos).
  - `npm run test` (100% da suíte verde).
  - `npm run build` (geração de bundle de produção otimizada).

---

## 7. Critérios de Conclusão e Definição de Pronto (DoD)

1. **Eficiência de Rede:** Redução de pelo menos 60% nas requisições Supabase disparadas por minuto em navegação típica móvel (sem refetch storms ao alternar apps).
2. **Imunidade a HTTP 429:** Nenhuma chamada direta do navegador a APIs externas de cotações em loop de renderização ou listagem.
3. **Segurança de Borda:** Cabeçalho CSP válido presente e aprovado em scanners de segurança HTTP.
4. **Isolamento de Banco:** 100% das políticas de RLS otimizadas com nós InitPlan no planejador do PostgreSQL.
5. **Zero Custo Adicional:** Todas as otimizações operam com folga dentro do tier padrão do Supabase e Cloudflare Pages Free.
