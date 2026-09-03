# 📐 ESPECIFICACAO_TECNICA.md — Especificação Técnica Consolidada

> **Status:** v1.0 — consolida o `RECONSTRUCAO.md` (regras de negócio) + decisões de **Arquitetura & Resiliência (Etapa 1)** + **Diretriz de UI/UX (Etapa 2)**.
>
> **Stack definida:** Supabase (BaaS — auth + Postgres + RLS) · React 18+ com **Vite** · TypeScript estrito · Tailwind CSS · shadcn/ui · TanStack Query (estado de servidor).
>
> **Objetivo:** ser a fonte única e executável de regras de negócio, arquitetura e visão de produto para a reconstrução do zero.

---

## 0. DECISÕES-CHAVE (RESUMO EXECUTIVO)

| # | Tema | Decisão | Motivo |
|---|---|---|---|
| D1 | Atomicidade de escritas | **Transações no servidor (RPC Postgres)** para toda operação composta | Operações multi-registro (despesa+cobrança, estorno→renda, exclusão em cascata) nunca podem ficar pela metade; o cliente faz **1 chamada** e recebe sucesso/erro atômico |
| D2 | Exclusão | **Hard delete + log de eventos imutável** (`audit_events`) | Schema e queries limpos (sem `deleted_at` em tudo); auditoria financeira preservada (quem/quando/valores) |
| D3 | Competência de fatura | **Snapshot na escrita + recálculo controlado em lote** | Histórico de faturas estável; mudanças de regras do cartão exigem confirmação do usuário antes de reclassificar |
| D4 | Multiusuário | **Isolado** — RLS por `auth.uid()`; sem compartilhamento nesta fase | Schema simples; modelo permite evoluir para compartilhamento sem ruptura |
| D5 | Integração de cotações | Cache em servidor + fallback estático + **preço manual** (override do usuário) | Rebalanceamento nunca fica bloqueado por indisponibilidade da API externa |
| D6 | Frontend | **React (Vite) + Tailwind + shadcn/ui** | Combina com os contratos de estado (hooks/providers) da spec e com Supabase; SPA pura, sem SSR |
| D7 | Filosofia visual | **Cards amigáveis (fintech)** — estilo Nubank/Organizze | Acolhedor, mobile-first, microinterações; adequado a finanças pessoais |
| D8 | Navegação | **Sidebar fixa (desktop) + bottom tabs (mobile)** | Escala com 8+ áreas; padrão moderno SaaS/fintech |
| D9 | Temas | **Light / Dark / OLED** (true black) com toggle e preferência do sistema | Suporte completo; OLED economiza bateria em AMOLED |
| D10 | Lançamento rápido | **Tela cheia guiada** (wizard 4 passos) + **atalho global** + defaults inteligentes | Respeita a escolha de fluxo guiado mantendo a fricção mínima |
| ~~D11~~ | ~~Storage de arquivos~~ | ~~**Cloudflare R2** atrás de abstração própria (`src/services/storage`), upload via presigned URLs~~ | ~~A UI nunca conhece a implementação; anexos (comprovantes, avatar) ficam fora do fluxo financeiro core~~ — **REMOVIDO DO ESCOPO** (decisão do usuário, 2026-08-15): nenhuma tela usa upload e anexos não participam do fluxo financeiro core; o primitivo `Dropzone` permanece para uso futuro |
| D12 | Parcelamento | **Cliente calcula** (`domain/money`, centavos) **+ servidor valida invariantes** (soma = original, 1–60, datas) | Lógica de divisão única em TS; SQL só valida — sem duplicação |

---

## 1. ARQUITETURA DE SOFTWARE

### 1.1 Visão geral e princípios

Aplicação web **100% Online First**: a nuvem (Supabase) é a única fonte da verdade. Sem persistência local de dados de negócio, sem filas de sincronização, sem modo offline. Leitura e escrita sempre via API, com estados de carregamento/erro explícitos na interface.

**Princípios arquiteturais:**

- **Online First**: toda mutação é síncrona com a nuvem; erros têm tratamento explícito e retry manual.
- **Lógica pura e testável**: todo cálculo (parcelamento, competência de fatura, projeções, insights, rebalanceamento) vive em módulos de domínio **sem dependência de UI**.
- **Estado centralizado**: hooks/providers expõem `data | loading | error | CRUD | refresh`; a UI apenas consome esses contratos (recomendado: TanStack Query para estado de servidor + hooks de domínio por cima).
- **Separação domínio × apresentação**: formatação monetária, status derivados e cores são serviços de apresentação; regras de negócio nunca dependem deles.
- **Integridade no servidor**: operações compostas são **RPCs transacionais** (D1) — o cliente não orquestra multi-escrita.

### 1.2 Camadas

| Camada | Responsabilidade | Onde vive |
|---|---|---|
| **Domínio puro** | Cálculos e regras (parcelamento, competência, status derivado, insights, rebalanceamento) | Módulos TS sem imports de UI/Supabase; 100% testáveis |
| **Dados (Supabase)** | Persistência, RLS, RPCs transacionais | Cliente Supabase + migrations + funções Postgres |
| **Contratos de estado** | `data \| loading \| error \| CRUD \| refresh` por domínio | Hooks (TanStack Query + hooks de domínio) |
| **Apresentação** | Formatação, máscaras, cores, status exibidos | Serviços + tokens |
| **UI** | Telas e componentes (shadcn/ui) | React/Vite |

### 1.3 Atomicidade e integridade (D1 — RPCs transacionais)

Toda operação que altera **mais de um registro** em uma única ação do usuário deve ser executada como **função Postgres (RPC) dentro de uma transação** (`BEGIN/COMMIT`, rollback em qualquer erro). O cliente chama uma vez e recebe `{ ok, data } | { ok: false, error }`.

**Catálogo de RPCs obrigatórios:**

| RPC | Operação composta | Transação garante |
|---|---|---|
| `create_expense_with_debt` | Criar despesa (+ parcelas, se aplicável) + cobrança vinculada | Despesa e dívida(s) nascem juntas ou não nascem |
| `create_refund` | Estorno de fatura → cria renda automática na categoria reservada "Estorno" (`[REFUND]{id}`) | Estorno e renda somente-leitura sempre em par |
| `delete_expense_installments` | Excluir parcela(s) (`single \| all \| subsequent`) + cascata de dívidas pendentes vinculadas + gravar `audit_events` | Dívidas órfãs pendentes nunca sobram |
| `pay_debt` / `receive_debt` | Quitar dívida + criar despesa/renda correspondente (quando escolhido) | Quitação e lançamento em par |
| `settle_integrated_receivable` | Recebimento integrado: reduz o valor da despesa no relatório | Desconto aplicado atomicamente |
| `recalculate_bill_competences` | Recálculo em lote de competências de um cartão (D3) | Reclassificação consistente + log |
| `delete_category_migrate` | Excluir categoria movendo lançamentos para outra | Migração sem órfãos |
| `set_budget_limit` / `set_income_goal` | Upsert de limite/expectativa por `(categoria, mês)` | Upsert atômico |

> **Regra de ouro:** se a ação toca 2+ tabelas, é RPC transacional. O cliente **nunca** faz chamadas sequenciais compensatórias.

### 1.4 Persistência e auditoria (D2 — hard delete + log de eventos)

- **Exclusão física** de registros (despesas, rendas, dívidas, etc.) com gravação **imutável** em `audit_events`:
  - `audit_events (id, user_id, entity_type, entity_id, action, payload jsonb, created_at)`
  - `payload` guarda os fatos: valores, datas, vínculos (ex.: grupo de parcelas, competência) e motivo.
  - RLS: **insert + select do próprio dono; sem update/delete** (imutável por construção).
- São auditados: exclusões (hard delete), estornos, pagamentos de fatura, alteração de regras de cartão, recálculo de competência em lote, quitação de dívidas.
- **Não há soft delete** nesta fase; se houver necessidade futura de recuperação, o log permite reconstituir fatos (não o registro vivo).

### 1.5 Competência de fatura (D3 — snapshot + recálculo controlado)

- A competência (`bill_competence`, formato `YYYY-MM`) é **calculada e persistida no momento da escrita** da despesa, usando a regra `resolveBillCompetence(data, closingDayVigente)` (ver §4.5).
- Overrides mensais vivem em `card_competence_overrides` e **prevalecem** sobre o `closing_day` padrão do cartão.
- **Mudança de regras do cartão** (closing day/vencimento ou override) **não altera faturas passadas automaticamente**. A UI oferece o RPC `recalculate_bill_competences(card_id, from_month)` que:
  1. pré-visualiza quantas despesas serão reclassificadas (contagem por competência antiga → nova);
  2. exige confirmação explícita do usuário;
  3. executa em transação e grava `audit_events` do recálculo.

### 1.6 Integrações externas (D5 — cotações resilientes)

- **Única integração externa:** cotações (Yahoo Finance via proxy CORS em cascata) para valoração usada no rebalanceamento.
- **Pipeline de resiliência (em ordem):**
  1. **Cache em servidor** — tabela `asset_prices` (preço, moeda, fonte, `updated_at`); a UI **nunca** chama a API externa em tempo de request.
  2. **Atualização assíncrona** — edge function/worker atualiza a tabela em lote (timeouts curtos, tolerante a falhas por ticker).
  3. **Fallback estático** — preço fixo por classe (ex.: USD 5,25) quando não há dado.
  4. **Preço manual** — o usuário pode informar/sobrescrever o preço (coluna `manual_price`); o override **prevalece** sobre cache/fallback e é marcado na UI como "preço informado manualmente".
- **Guardrail de spike:** variação > 50% em 1 dia mantém o último preço válido (proteção contra dado corrompido).
- **Degradação graciosa:** em indisponibilidade prolongada, a carteira e o rebalanceamento continuam funcionando com aviso visível de imprecisão.
- **Governança de Ativos Internacionais e Proventos (USD):**
  - **Moeda Nativa:** ativos com `currency: "USD"` mantêm preço unitário, preço médio, custo total e proventos (acumulados e periódicos) registrados na moeda nativa (USD). A interface exibe máscaras monetárias e símbolos em dólar (`$`).
  - **Yield on Cost (YoC):** calculado estritamente na moeda nativa ($\text{proventos USD} / \text{custo total USD}$), evitando distorções cambiais.
  - **Consolidação Patrimonial (BRL):** na carteira consolidada, série mensal de snapshots e relatórios, o valor de mercado e os proventos são convertidos para BRL pela taxa cambial vigente (`usdRate`), assegurando que $\text{totalReturnPnl} = \text{unrealizedPnl} + (\text{totalDividendsNative} \times \text{usdRate})$.
  - **Tributação (IRPF):** proventos internacionais são segregados como "Rendimentos Recebidos do Exterior (Carnê-Leão / Exterior)", não sendo misturados com a Ficha 09 de rendimentos isentos locais.

### 1.7 Gateway de erros e contratos de estado

- **Gateway único de erros** (`getErrorMessage`): mensagens pt-BR padronizadas; casos especiais — rate limit (aguarde alguns minutos), e-mail não confirmado, sessão expirada, rede indisponível (Online First → erro explícito com "Tentar novamente").
- **Contrato de estado** por domínio: `{ data, isLoading, isError, error, mutate (CRUD), refresh }` — consumível por qualquer tela sem acoplamento ao cliente de dados.

### 1.8 Storage de arquivos (~~D11~~ — REMOVIDO DO ESCOPO)

> **Decisão do usuário (2026-08-15):** o storage de arquivos (Cloudflare R2) foi **removido do escopo** — nenhuma tela usa upload hoje e anexos não participam do fluxo financeiro core. O primitivo `Dropzone` (`components/ui`) permanece disponível caso a feature (comprovantes, avatar) seja retomada no futuro; nesse caso, retomar a abstração `services/storage` + endpoint de presigned URLs.

---

## 2. MODELO DE DADOS (SCHEMA LÓGICO)

> Reconstruído do zero. Todas as tabelas com `user_id` + **RLS `auth.uid() = user_id`** (D4 — multiusuário isolado). Datas em `date`, meses em `YYYY-MM` (text/char(7) ou first day). Valores monetários em **numeric(12,2)** (4 casas apenas para `report_weight`).

| Tabela | Colunas-chave | Constraints / Notas |
|---|---|---|
| `profiles` | id (PK = auth.users.id), name, email, created_at | Criada no signup (trigger) |
| `user_preferences` | user_id (PK), theme (`light \| dark \| oled \| system`), reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled | — |
| `categories` | id, user_id, type (`expense \| income`), name, icon, color, is_reserved (ex.: "Estorno"), is_active | Nome único por (user, type); reservadas não são editáveis/excluíveis nos fluxos normais |
| `incomes` | id, user_id, value, date, category_id (FK), receive_type (`cash \| pix \| transfer \| other`), description, report_weight (default 1, 0–1), source_ref (para rendas automáticas `[REFUND]`), created_at | Check: value > 0; date ≥ APP_START_DATE; report_weight 0–1; rendas com `source_ref` = somente-leitura |
| `expenses` | id, user_id, value, date, category_id, payment_method (`cash \| debit \| credit_card \| pix \| transfer \| other`), card_id (FK nullable), installments_total (1–60), installment_number, installment_group_id (UUID, nullable), bill_competence (`YYYY-MM` snapshot, nullable), report_weight, base_amount (valor original p/ auditoria de pesos), description, created_at | Check: value > 0; date ≥ APP_START_DATE; installments 1–60; **card_id NOT NULL quando payment_method = `credit_card`**; `installment_group_id` presente sse installments_total > 1 |
| `credit_cards` | id, user_id, name, brand, credit_limit, closing_day (1–31), due_day (1–31), color, is_active | Desativar não apaga histórico |
| `card_competence_overrides` | id, card_id, month (`YYYY-MM`), closing_day, due_day | Unique (card_id, month); prevalece sobre padrão |
| `card_payments` | id, user_id, card_id, competence_month, amount, date, note, is_refund | Estorno = amount negativo OU note `[REFUND]...`; estorno → RPC `create_refund` |
| `debts` | id, user_id, name, type (`payable \| receivable`), amount (≥ 0), due_date, **paid_at (timestamptz NULL — preenchido na quitação; NULL = pendente)**, expense_id (FK nullable), installment_group_id (nullable), created_at | Check: amount ≥ 0; status derivado (overdue/due_today/due_soon/pending) nunca é armazenado |
| `budgets` | id, user_id, category_id, month, limit | **Unique (category_id, month)**; upsert |
| `income_goals` | id, user_id, category_id, month, expected | Unique (category_id, month); upsert |
| `insight_feedback` | id, user_id, occurrence_key (hash estável: tipo + entidade + mês), decision (`ignore \| confirm`), created_at | Registra o aprendizado do usuário sobre insights (§3.7.4); ocorrência ignorada deixa de contar |
| `portfolio_assets` | id, user_id, ticker, asset_class, sector (nullable), currency (BRL/USD), quantity, average_price, accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata (jsonb nullable), notes (nullable) | Ticker único por user; custody position direta |
| `portfolio_transactions` | id, user_id, asset_id, type (`buy \| sell \| dividend \| jcp \| fii_yield \| split \| reverse_split \| subscription`), date, quantity, price, total | Caixa derivado do ledger (nunca armazenado como saldo) |
| `allocation_targets` | id, user_id, asset_id, target_percentage (0–100) | Soma por user ≤ 100 — **validada no domínio e no banco (trigger/RPC)**; check não cobre soma entre linhas |
| `class_targets` / `sector_targets` | id, user_id, group_type (`class \| sector`), name, target_percentage | Metas opcionais por classe/setor |
| `asset_prices` | id, **user_id (nullable — NULL = cache global da edge function; preenchido = override manual do usuário)**, ticker, price, currency, source (`api \| fallback \| manual`), manual_price (nullable), updated_at | Cache servidor; override manual prevalece; RLS: dono quando `user_id` presente, leitura global quando NULL |
| `audit_events` | id, user_id, entity_type, entity_id, action, payload jsonb, created_at | **Imutável** (RLS: insert + select; sem update/delete) |

**Índices recomendados:** `expenses (user_id, date DESC)`, `expenses (installment_group_id)`, `incomes (user_id, date DESC)`, `debts (user_id, due_date)`, `card_payments (card_id, competence_month)`, `budgets (user_id, month)`.

**Contratos de domínio TS:** os enums canônicos (`payment_method`, `receive_type`, `debts.type`, `portfolio_transactions.type`, faixas de atenção, `source`) são definidos em `src/types/` com os **mesmos literais** desta tabela; validação nas bordas (zod) e constraints do banco espelham esses valores (DRY de tipos — sem literais soltos).

---

## 3. REGRAS DE NEGÓCIO CONSOLIDADAS

> Regras herdadas do `RECONSTRUCAO.md`, refinadas pelas decisões D1–D12. Onde uma decisão altera o comportamento, a regra está marcada com **(D#)**.

### 3.1 Receitas (Rendas)

- **Entrada:** valor, data, categoria de renda, tipo de recebimento (`cash | pix | transfer | other`), descrição opcional, peso de relatório (0–1, default 1).
- **Validações:** categoria e valor obrigatórios; data ≥ **APP_START_DATE (2026-01-01)**; valor numérico finito > 0.
- **Fluxo:** CRUD completo; listagem agrupada por mês; edição preserva todos os campos; exclusão definitiva com `audit_events` (D2).
- **Rendas automáticas** (estornos, `source_ref` presente) são **somente-leitura**: não editáveis, não excluíveis, não recategorizáveis nos fluxos normais — manutenção exclusiva pela tela de cartões.
- **Parcelamento (1–60x):** mesmo contrato das despesas (§3.2.2) — divisão exata em centavos no cliente (`domain/money`), gravação transacional via RPC `create_income_installments` (D12: soma = valor original, parcelas 1–60, datas ≥ APP_START_DATE); linhas compartilham `installment_group_id` com `installment_number`/`installments_total`; exclusão e edição em grupo nos 3 modos (ver §3.2.7).
- **Recorrência:** rendas podem nascer de um template de recorrência (ver §3.2.5) — linhas materializadas com `recurrence_id`/`occurrence_number`.
- **Ordenação:** data desc; empate por `created_at` desc.

### 3.2 Despesas

#### 3.2.1 Registro e classificação

- **Entrada:** valor, data, categoria, forma de pagamento (`cash | debit | credit_card | pix | transfer | other`), cartão (obrigatório se `credit_card`), descrição, parcelas (1–60), peso de relatório (0–1, default 1).
- **Validações:** categoria e valor obrigatórios; data ≥ APP_START_DATE; parcelas 1–60; cartão obrigatório no crédito.
- **Ordenação:** data desc; empate por `created_at` desc.

#### 3.2.2 Parcelamento (1–60x)

- Gera uma despesa por mês a partir da data inicial; todas compartilham `installment_group_id` (UUID) e recebem `installment_number` (1..N) e `installment_total`.
- **Divisão exata em centavos:** resto de `valor ÷ N` distribuído nas **primeiras parcelas** (R$ 100 ÷ 3 → 33,34 / 33,33 / 33,33). Soma sempre idêntica ao original.
- **Competência de fatura** (cartão): calculada por parcela na escrita (snapshot, D3).
- **Cálculo no cliente, validação no servidor (D12):** as parcelas são calculadas em `domain/money` (TS, testável) e enviadas ao RPC, que **valida invariantes** (soma = valor original, parcelas 1–60, datas ≥ APP_START_DATE) antes de persistir — a lógica de divisão não é duplicada em SQL.
- **Exclusão em 3 modos** via RPC `delete_expense_installments` (D1):
  - `single` — exclui apenas a parcela selecionada;
  - `all` — exclui todo o grupo;
  - `subsequent` — exclui a parcela-alvo e posteriores (por `installment_number`).
  - **Cascata:** despesas excluídas removem **dívidas pendentes vinculadas** (`expense_id` + status `pending`); dívidas pagas nunca são tocadas. Tudo em transação + `audit_events` (D1/D2).

#### 3.2.3 Edição com troca de forma de pagamento

- Passa a ser cartão → recalcula/insere a competência (snapshot) usando closing day vigente + overrides.
- Deixa de ser cartão → limpa vínculo com cartão e competência.

#### 3.2.4 Cobrança vinculada (dívida integrada à despesa)

- Criada **na mesma ação** que a despesa via RPC `create_expense_with_debt` (D1).
- **Validações:** valor obrigatório, > 0 e **≤ valor da despesa**; padrão sincroniza com o valor da despesa.
- Herda o grupo de parcelas (uma cobrança por parcela); descrição padrão `Cobrança integrada à despesa: {descrição}`.
- Quitação com fluxo integrado (ver §3.4).

#### 3.2.5 Despesas fixas e recorrentes (cadastro formal — Fase 32)

- **Modelo template + materialização sob demanda:** o usuário cadastra uma recorrência (`recurrences` — fonte da verdade) e as linhas (`expenses`/`incomes`) são **materializadas por mês** pelo RPC `materialize_recurrences`, idempotente e **respeitando skips** — o cliente calcula as datas (D12, `domain/recurrences`) e o servidor valida invariantes e insere apenas as linhas faltantes. Nenhuma escrita em massa no cadastro.
- **Frequências:** `monthly | weekly | quarterly | yearly`, com clamp de dia de fim de mês (31 → 28/29/30 conforme o mês destino).
- **Fim sempre definido:** `end_date` (inclusivo) **XOR** `occurrences_total` (1-based, inclui a primeira) — CHECK no banco; recorrência sempre finita (guarda defensiva de 600 ocorrências no motor).
- **Campos:** `kind` (`expense | income`), valor > 0, categoria, data de início (≥ APP_START_DATE), descrição, `report_weight` e campos por tipo (forma/cartão p/ despesa; `receive_type` p/ renda).
- **Exclusão individual** de uma ocorrência grava `recurrence_skips` — a data não regenera na materialização; edição/exclusão em grupo por ocorrência (ver §3.2.7).
- **Insights:** linhas com `recurrence_id` são recorrências **formais** e ficam **fora** da detecção histórica (§3.8) — sem duplicidade entre cadastro e aprendizado.

#### 3.2.6 Valor Real vs. Valor no Relatório (Rateio e Ponderação)

- **Entrada no lançamento:** opções rápidas em porcentagem (100%, 75%, 50%, 25%, 0%) e opção **"Personalizado"** com entrada direta do **valor gasto real em reais (R$)** considerado no relatório. O sistema converte e persiste a fração normalizada (0–1).
- **Listas e Linhas de Transação:** quando uma despesa/receita possui `report_weight < 1`, o componente `TransactionRow` exibe o valor real/nominal em destaque com a indicação secundária `Relat.: R$ X,XX`.
- **KPIs da tela de Transações:** os cards de topo (`Receitas`, `Despesas`, `Saldo do mês`) exibem o valor nominal/bruto total em destaque e, quando houver transações rateadas, exibem o hint secundário `Sua cota: R$ X,XX`.
- **Detalhamento e Edição (`ExpenseDetailDialog`):** exibe o valor nominal e o valor no relatório correspondente tanto no cabeçalho quanto na lista de metadados, e permite editar o peso e o valor considerado no relatório.
- **Cartões e Relatórios:** totalização e gráficos segregam e exibem simultaneamente os valores nominais brutos e os valores ponderados.

#### 3.2.7 Operações em grupo (parcelas e recorrências — Fase 32)

- **Escopo (`single | all | subsequent`):** aplicado por RPC transacional (D1) sobre parcelas de despesa/renda e ocorrências de recorrência — `single` age só na linha-alvo; `all` age no grupo/template inteiro; `subsequent` age da linha-alvo em diante (por `installment_number`/`occurrence_number`).
- **Valor em grupo — parcelas:** editável **apenas na parcela individual** (`single`), via RPC que atualiza `value` **e** `base_amount` juntos (invariante de auditoria §3.2.2 preservado). Mudar o total da compra = excluir o grupo e refazer. No modo grupo (all/subsequent) o campo de valor fica **desabilitado** na UI, com hint "editar o total = excluir e refazer".
- **Valor em grupo — recorrências:** sem invariante de soma — `all`/`subsequent` atualizam template + linhas (a competência snapshot da fatura é recalculada na materialização); `single` atualiza só a linha. Metadados (categoria, descrição, forma/cartão, peso, competência) são sempre editáveis em grupo.
- **Exclusão em grupo — recorrências:** `single` remove a linha e grava skip; `all` remove template + linhas (cascata de dívidas pendentes) + skips; `subsequent` remove da ocorrência em diante e **trunca o template** (fim antecipado ou contagem reduzida), preservando o CHECK de limite único.
- **Rendas automáticas** (`source_ref`) permanecem **somente-leitura** em todos os modos.

### 3.3 Cartões de Crédito

#### 3.3.1 CRUD

- **Entrada:** nome, bandeira, limite total, `closing_day` (1–31), `due_day` (1–31), cor, `is_active`.
- Desativar não apaga histórico; apenas remove de seleção/fluxos ativos.

#### 3.3.2 Competência de fatura

- Regra base `resolveBillCompetence(purchaseDate, closingDay)`: **dia da compra ≥ closing day → fatura do mês seguinte**; senão, mês atual.
- `clampDay` limita closing day a 1–31 (meses com menos dias usam o último dia).
- **Overrides mensais** (`card_competence_overrides`) prevalecem sobre o padrão.
- **Snapshot na escrita** (D3): competência gravada no lançamento; mudanças de regra exigem recálculo controlado (§1.5).

#### 3.3.3 Fatura, pagamentos e estornos

- **Visão dupla da fatura:** no cartão 3D, nos KPIs e no extrato da fatura, o sistema exibe simultaneamente:
  1. **Fatura Total (Valor Bruto / 100% nominal):** total desembolsado no cartão.
  2. **Fatura Ponderada (Com Pesos do Relatório):** total considerado após pesos/rateios percentuais.
- **Status da fatura e quitação bancária:** o status (`open`, `closed`, `overdue`, `near_due`) e o saldo aberto a pagar ao banco são calculados com base no **saldo bruto nominal (`saldoBrutoCents`)**, garantindo que a fatura só seja considerada quitada perante o banco após o pagamento integral da obrigação.
- **Detalhamento e edição pela fatura:** a tela de cartões permite clicar em qualquer despesa da fatura para abrir seu diálogo de detalhes, edição completa (categoria, valor, data, forma) e alteração/transição de competência da fatura (`bill_competence`) ou exclusão.
- **Fallback de descrição:** quando um lançamento não possuir descrição textual, o sistema exibe o nome de sua respectiva categoria como título principal (nunca textos genéricos como "despesa sem descrição").
- Fatura consolida: despesas do período (com peso aplicado, `base_amount` preservado para auditoria), pagamentos e estornos.
- **Estorno** = pagamento com valor negativo OU nota iniciando em `[REFUND]`; sem competência explícita, resolvida pela data do pagamento.
- **Estorno gera renda automática** (RPC `create_refund`, D1): cria receita na categoria reservada **"Estorno"**, vinculada por nota `[REFUND]{id da renda}` — somente-leitura (§3.1); valor no relatório limitado a 0–valor do estorno.
- Pagamento de fatura: CRUD com competência; total pago abate o previsto.
- **Seleção do mês de fatura:** mês atual se tiver pendências; senão varre **para trás** (até APP_START_DATE) pelo mês mais recente com pendências; se nenhum, tenta o mês seguinte; por fim, mês atual. Deep-links (`?card=` / `?month=`) sobrepõem.
- **Saldo aberto** = `max(0, previsto − pago)` (por competência; pagamento a maior nunca gera saldo negativo), exibido com saldo bruto e saldo ponderado.
- **Lembrete de fatura:** alerta com saldo aberto, `overdue` (vencida) ou `near_due` (janela configurável, default 3 dias antes do vencimento).

### 3.4 Dívidas / Contas a Pagar e Receber

- **Entrada:** nome, tipo (`payable | receivable`), valor **≥ 0**, data de vencimento, status lógico (`pending | paid` — **persistido via `paid_at`**, ver schema §2), vínculo opcional com despesa (herda grupo de parcelas).
- **Status derivado** (nunca armazenado): `paid` (quitada) · `overdue` (vencida e pendente) · `due_today` · `due_soon` (≤ 3 dias) · `pending`.
- **Quitação a pagar** (RPC `pay_debt`): opção **"Pagar e Cadastrar Despesa"** (cria a despesa correspondente) ou **"Apenas Pagar"**.
- **Quitação a receber** (RPC `receive_debt`): **"Receber e Criar Renda"** ou **"Apenas Receber"**.
- **Recebimento integrado** (RPC `settle_integrated_receivable`): recebível vinculado a despesa reduz **automaticamente o valor da despesa no relatório** (resultado editável pelo usuário).
- **Ordenação:** `due_date` ascendente.
- **Efeitos em totais:** dívidas **pagas** entram nos totais do período (recebíveis → rendas; pagáveis → despesas) pelo **mês do vencimento**; **pendentes** alimentam a projeção de pendências (§3.9); totais de Contas consideram apenas pendentes com vencimento no mês selecionado.
- **Exclusão vinculada:** herda os modos `single | all | subsequent` do grupo de parcelas (via RPC de exclusão, D1).
- **Lembrete:** janela configurável (dias antes) + `overdue`.

### 3.5 Categorias, Orçamentos e Metas

#### 3.5.1 Categorias

- CRUD de categorias de despesa e renda (nome, ícone, cor).
- **Sugestão inteligente por nome:** infere ícone/cor e limite sugerido por regra de nome (moradia, alimentação, transporte, saúde, educação, lazer, compras, outros).
- **Exclusão com migração** (RPC `delete_category_migrate`): mover lançamentos para outra categoria antes de excluir.

#### 3.5.2 Orçamentos (despesas)

- **Limite mensal por categoria:** valor por `(categoria, mês)`, upsert; limpar o campo remove o limite.
- **Herança de limite:** sem limite no mês atual, herda o do mês anterior (fallback de exibição/alerta).
- **Faixas de atenção:** ≥ 85% → Atenção; ≥ 90% → Alta; ≥ 95% → Crítica; > 100% → **Excedida** (alerta com valor excedido).
- **KPIs:** total de limites do mês, % global usado (`min(100, despesas ÷ (totalLimites || rendas))`), cor de progresso (≥85% vermelho, ≥70% amarelo, senão verde).
- **Sugestão de limite** por % da renda (regra de nome: moradia ≤ 30%, alimentação ≤ 15%, transporte ≤ 10%…).
- **Realocação automática:** categoria com maior folga → maior excesso; valor = `min(excesso, folga)` arredondado ao múltiplo de 10 (mínimo R$ 10); reduz limite da origem com folga e aumenta o destino com excesso — com confirmação.
- **Alertas:** categoria estourou → lista de atenção + motor de insights (§3.8).

#### 3.5.3 Metas de renda

- **Expectativa mensal por categoria de renda:** `(categoria, mês) → valor esperado`; compara realizado × esperado em relatórios/insights (déficit de receita).

### 3.6 Visão Consolidada (Dia / Mês / Ano)

- **Hierarquia de Apresentação em Relatórios:** em todas as visões, dossiês e tabelas onde métricas ponderadas forem relevantes, o valor principal e de maior destaque visual é **sempre o valor bruto nominal (100%)**, enquanto o valor ponderado é apresentado como **dado de consulta analítica** (coluna ou sub-linha dedicada), garantindo transparência contábil de face e comparabilidade de dados.
- **KPIs fundamentais** (com peso de relatório para consulta analítica): `totalRendas`, `totalDespesas`, `totalInvestimentos` (aportes líquidos do mês), `saldo`, `savingsRate = saldo ÷ rendas`.
- `saldo = rendas − despesas − investimentos`.
- **Saldo líquido de Contas** = total a receber (pendentes do mês) − total a pagar (pendentes do mês) − total de faturas em aberto.
- **Fluxo diário:** barras empilhadas por dia (rendas/despesas/investimentos); comparativo com período anterior.
- **Agrupamentos temporais:** dia/mês/ano; navegação de mês/ano com clamp no APP_START_DATE.
- **Orçamentos:** progresso vs limite, lista de atenção, recomendação de realocação.
- **Limite de período customizado:** máximo 366 dias.


### 3.7 Motor de Análise e Diagnóstico (Insights)

**Entrada:** totais, savings rate, resumos por categoria (atual + anteriores), totais por dia da semana, limites estourados, renda por categoria, ritmo e projeção de gastos, saldo, despesas (mês atual + 3 anteriores).

#### 3.7.1 Alertas e avisos (prioridade)

1. Saldo negativo;
2. Ritmo de gastos > 5% acima do esperado;
3. Limites de orçamento estourados;
4. Burn rate > 85% da renda;
5. Déficit projetado para o fim do mês (dia ≥ 10 e fora do trilho);
6. Elogio automático quando poupança ≥ 20% da renda.

*Nota de UI:* os alertas são apresentados como avisos unificados na aba **Avisos & Diagnósticos** integrados às notificações de contexto e diagnósticos (§3.7.6).

#### 3.7.2 Detecção de assinaturas

- 3 sinais: nome conhecido (lista de serviços), categoria de assinatura, valor exato (tolerância ±5%).
- Árvore de decisão com **confiança 0.40–0.98**.
- **Tiers de corte:** `essential` (não sugere corte) · `discretionary` · `can_cut`; cada ocorrência reporta `savingsIfCut`.

#### 3.7.3 Detecção de recorrências (3 níveis)

- `subscription` — mesmo nome + valor/categoria estável;
- `recurring` — mesma descrição, valor com tolerância ±50%;
- `similar` — mesma categoria com total ±30%; **categorias agregadoras excluídas** (supermercado, combustível, farmácia…), checagem de dispersão interna, 2+ meses quando há 3+ meses de histórico.
- Parcelas (`installment_group_id`) são **filtradas** — parcelamento não é recorrência.

#### 3.7.4 Confiança e aprendizado

- **Confiança** = base + bônus não-linear por meses de histórico (2m:+0.05 … 5m:+0.28) − penalidade de variância (0.3× subscription, 0.8× recurring).
- **Aprendizado:** usuário pode **ignorar / confirmar / restaurar** ocorrências; ignorada deixa de contar.

#### 3.7.5 Desafios e sugestões

- **Desafios de economia:** por categoria de alto gasto (reduzir 10/20/30%) + "30% em não essenciais"; **limite mínimo dinâmico** = `max(R$ 20, 0,5% da renda)`; máx. 4 simultâneos.
- **Sugestões de limite:** estourou → sugere aumento de `max(excesso, 15% do limite)`; uso < 50% com folga > R$ 50 → sugere redução **mantendo 30% de margem**; máx. 3 sugestões/mês.

#### 3.7.6 Diagnósticos adicionais

- Concentração de renda: alerta quando 1 fonte > 60% da renda.
- Tendência vs mês anterior: significativa quando > 15%.
- Gastos de fim de semana: alerta quando ratio fim de semana/dia útil > 1.5.
- Saúde da poupança: faixas crítico/baixo/moderado/saudável/forte.
- Compromisso com investimentos: comparação com meta de 15–20% da renda.

### 3.8 Projeção e Prospecção de Gastos

- **Gasto disponível (orçamento diário derivado):**
  - `mensalDisponível = rendas − investimentos − despesas`.
  - Mês atual: `diário = max(0, mensalDisponível ÷ diasRestantes)` com `diasRestantes = diasNoMês − diaAtual + 1` (inclui hoje).
  - Mês futuro: `diário = max(0, (rendas − investimentos) ÷ diasNoMês)`.
  - Mês encerrado: sem valor diário (resultado real).
- **Ritmo de gastos (spending pace):** acumulado do mês vs fração esperada; ativa a partir do **8º dia** e quando fração decorrida ≥ 30%.
- **Projeção de fim de mês:** exige **dia ≥ 3**; `burnRate = despesas ÷ diasDecorridos`; `projeção = burnRate × diasNoMês`; `superávit projetado = rendas − investimentos − projeção`; `noTrilho = superávit ≥ 0`. Passado → valores reais; futuro → não aplicável.
- **Projeção de pendências:** dívidas pendentes (pagáveis/recebíveis) do período com projeção de saldo.
- **Corte de gastos:** insights consolidam assinaturas cortáveis, recorrências, desafios e realocação em sugestões priorizadas por impacto financeiro.

### 3.9 Busca Global

- Gatilho: query ≥ 2 caracteres; busca em despesas, rendas, dívidas, cartões e categorias.
- **Normalização:** remove acentos, minúsculas.
- **Scoring:** igual 100 / prefixo 85 / contém 60; numérico 30; status de dívida 40.
- **Bônus de recência logarítmico:** mês atual +25; 1–2m +20; 3–4m +15; 5–6m +10; 7–12m +5; 12m+ +0.
- **Limites:** máx. 5 por tipo e 12 no total; ordenação por score desc.
- **Deep-link:** navega ao registro com destaque visual (highlight + scroll) e mês correto.

### 3.10 Lembretes e Central de Notificações

- Consolida alertas de **faturas** (saldo aberto por competência: vencida/em breve) e **dívidas** (pendentes: vence em X dias/vencida).
- Ações: **marcar como lido** e **snooze** (adiar); snooze **expira automaticamente** ao vencer/atrasar.
- Ordenação: atrasados primeiro; depois por vencimento.
- Ativação: somente com preferência habilitada; janelas configuráveis.

### 3.11 Motor de Rebalanceamento de Carteira

> Escopo reduzido: metas, leitura de posição e cálculo de aporte. Sem motor quantamental.

#### 3.11.1 Metas / Alocação Alvo

#### 3.11.1 Metas de Alocação Hierárquicas (Classe $\rightarrow$ Setor $\rightarrow$ Ativo)

- **Meta macro por classe:** `class_targets` (`group_type = "class"`) — % do patrimônio total ($\sum \le 100\%$).
- **Meta meso por setor:** `sector_targets` (`group_type = "sector"`) — % relativo da classe ($\sum \le 100\%$ dentro da respectiva classe). Meta efetiva do setor no patrimônio total = $(\text{meta da classe} \times \text{meta do setor}) / 100$.
- **Meta micro por ativo:** `target_percentage` (0–100) por `(user, asset_id)` no patrimônio total ($\sum \le 100\%$).
- **Inferência setorial automática (`inferSectorFromTicker`):** mapeamento canônico de setores por classe (Ações B3 por setor financeiro/bancos, petróleo, utilidades; FIIs por tijolo/logística, papel/CRI; Tesouro Direto por indexador econômico Selic/CDI, IPCA+, Prefixado; Ativos Internacionais USD por tecnologia, saúde, REITs, ETFs globais neutros; Criptoativos).
- **Ações contextuais:** normalização em 1-clique (100% ou teto da classe), equiponderação ($1/N$) e zeramento em todos os 3 níveis.
- Edição em lote com feedback visual de soma (barra de total ≤ 100% validada no domínio e no banco via RPC).

#### 3.11.2 Posição Atual (Posição Consolidada & Snapshots — F36)

- **Modelo de Custódia Direta:** posições mantidas diretamente em `portfolio_assets` (`quantity`, `average_price`, `sector`, `notes`), permitindo valoração instantânea $O(1)$ (`calculatePositionSummary`).
- **Valoração e Rentabilidade (Retorno Total / Total Return):**
  - `totalCost = quantity * average_price`
  - `valueBRL = quantity * priceBRL` (com conversão USD via `USDBRL=X` quando aplicável)
  - `unrealizedPnl = valueBRL - totalCostBRL` (Ganho de capital não realizado)
  - `unrealizedPct = (unrealizedPnl / totalCostBRL) * 100` (Variação da cotação %)
  - `totalDividends = accumulated_dividends + sum(portfolio_dividends)` (Proventos totais recebidos)
  - `totalReturnPnl = (valueBRL - totalCostBRL) + totalDividends` (Resultado total)
  - `totalReturnPct = (totalReturnPnl / totalCostBRL) * 100` (Retorno Total % consolidado)
  - `yieldOnCostPct = (totalDividends / totalCostBRL) * 100` (Yield on Cost)
- **Snapshots Patrimoniais e Série Mensal Integrada (`buildPortfolioMonthlySeries`):** histórico mensal gravado na tabela `portfolio_snapshots` (`month`, `total_value`, `total_cost`), enriquecido de forma puramente determinística no cliente com a evolução temporal de proventos acumulados até cada mês ($\text{Retorno Total}_M = \text{Ganho de Capital}_M + \text{Proventos}_M$), garantindo consistência histórica e resiliência a lançamentos retroativos.
- **Aportes Mensais (`portfolio_contributions`):** registros independentes de aportes financeiros integrados aos fluxos de caixa da Overview e dos Insights (sempre em BRL).
- **Proventos (`portfolio_dividends`):** lançamentos desacoplados para extrato mensal e calendário anual, integrados ao Retorno Total e YoC (convertidos para BRL no consolidado quando o ativo for USD).
- **Preço Médio Ponderado em Novos Lotes (`calculateWeightedAveragePrice`):**
  - $\text{Novo PM} = \frac{(\text{Qtd Atual} \times \text{PM Atual}) + (\text{Qtd Nova} \times \text{Preço Novo})}{\text{Qtd Atual} + \text{Qtd Nova}}$
- **Tratamento de Multi-Moeda (Ativos USD vs BRL):**
  - Custódia e Preço Médio são mantidos estritamente na moeda nativa do ativo (`currency: "USD"` ou `"BRL"`).
  - Cotações manuais e de mercado são precificadas na moeda nativa (`priceQuote`).
  - O Caixa da carteira e o registro de aportes no fluxo mensal são mantidos em Reais (BRL).
  - Operações de compra, venda e provento em USD com sincronização de caixa (`syncCash = true`) ou registro de aporte (`recordContribution = true`) convertem o valor da ordem para BRL pela taxa de câmbio USD/BRL (`usdRate`), sem inflar o preço médio nem duplicar conversões no recálculo patrimonial.
- **Ativos de Caixa e Renda Fixa Parametrizada:**
  - **Caixa / Reserva:** Opera em modo Saldo Direto 1:1 (quantidade = valor, PM = 1,00, rentabilidade nula).
  - **Renda Fixa e Tesouro Direto (Modo Valor Total):** O `average_price` armazena estritamente o Custo de Aplicação Original ($C_0$). Metadados em `fixed_income_metadata` (`rate_type`, `rate_value`, `base_date`, `base_value`, `initial_investment_date`, `maturity_date`, `is_tax_exempt`) controlam a capitalização diária a partir do Marco Zero ($D_0$). O Saldo do extrato bancário recalibra `base_value` e `base_date` sem sobrescrever `average_price`, preservando o histórico de lucro acumulado e Yield on Cost.
#### 3.11.3 Algoritmo de Aporte Hierárquico (`simulateCombinedAporte`) & Sugestões do Wizard

1. **Defasagem macro por classe:** classe com maior déficit relativo recebe prioridade de orçamentação.
2. **Prevalência Macro Estrita (Hard Cap por Classe):** se uma classe atingiu ou superou o percentual-alvo ($classCurrentValueBRL \ge classTargetValueBRL$), o gap macro da classe é travado em `0` e nenhum centavo é direcionado a ela. Nenhum ativo membro daquela classe recebe sugestão de aporte ou recomendação no Wizard, mesmo que possua defasagem interna ou meta individual.
3. **Orçamentação meso por setor:** a verba da classe é distribuída entre seus setores conforme o déficit das metas setoriais relativas ou equiponderação setorial.
4. **Distribuição micro por ativo:** a verba setorial é distribuída entre os ativos membros com base nas metas individuais ou cota equiponderada ($1/N$).
5. **Precisão fracionária adaptativa (`resolveAssetPrecision`):**
   - **Moeda Estrangeira (USD / Internacional):** compras fracionárias com até **4 casas decimais** (`0.1234 VOO`).
   - **Criptoativos:** compras fracionárias com até **8 casas decimais** (`0.00012345 BTC`).
   - **Mercado Nacional (B3):** estritamente cotas inteiras ($\ge 1$ cota).
6. **Elegibilidade:** meta definida (individual, setorial ou de classe), cotação disponível, abaixo da meta (gap > 0) e pertencente a classe com déficit relativo positivo.
7. **Ordenação:** prioridade da classe com maior déficit relativo desc; dentro da classe, setor com maior déficit desc; dentro do setor, gap financeiro desc.
8. **Transbordamento:** sobras internas de setor retornam para a classe; sobras da classe retornam ao pool global para atender a próxima classe defasada.
9. **Sobra:** resíduos não alocados por restrição de cota mínima retornam ao caixa/reserva.
10. **Log de roteamento & Diagnóstico:** por ativo — valor alvo, atual, aporte sugerido, quantidade (fracionária ou inteira), preço; sobra final e diagnóstico de ativos não contemplados (indicando motivo e classe no limite).
11. **Recomendações no Investment Wizard & Soberania da Quantidade:**
    - **Com saldo em Caixa ($> 0$):** os cards calculam a quantidade de cotas que cabe no saldo disponível ($\min(\lfloor\text{gapBRL} / \text{preço}\rfloor, \lfloor\text{caixa} / \text{preço}\rfloor)$) e exibem `"Cabe no caixa: X cota(s) (~R$ Y) · Déficit total: R$ Z"`. Ao clicar, o formulário já inicia preenchido com essas cotas e a sincronização com o caixa ativada.
    - **Sem saldo em Caixa (ou R$ 0,00):** os cards exibem `"Déficit para meta: R$ Z (W%)"` e, ao clicar, a quantidade no formulário vem **em branco** (`""`), permitindo digitação livre pelo usuário.
    - **Soberania da Quantidade Digitada:** para ativos cotizados (renda variável), o total financeiro é estritamente $\text{Quantidade} \times \text{Preço Unitário}$. Alterações na quantidade ou preço limpam qualquer resquício de valor residual, impedindo a imposição forçada de valores recomendados.

**Consistência:** soma dos aportes nunca excede o aporte informado; ativo sem meta não recebe aporte; aporte só para ativos **abaixo** da meta (gap > 0); motor hierárquico único e opinado.

---

## 4. DATAS, MOEDA E VALIDAÇÕES

### 4.1 Datas e calendário

- **APP_START_DATE = 2026-01-01**: lançamentos anteriores bloqueados; navegação clampeada a `2026-01`.
- Datas em **timezone local** (nunca `toISOString` para ranges de mês); parsing `new Date('YYYY-MM-DDT12:00:00')`/`T00:00:00`.
- Dia da semana **Monday-first** `(getDay()+6)%7`.
- Último dia do mês: "+1 dia muda de mês" (robusto a 30/31/fevereiro).
- Mês seguinte = `+1 mês` (evita salto de fevereiro para abril).

### 4.2 Moeda e arredondamento

- Valores: **2 casas decimais**; `report_weight`: 4 casas (0–1).
- Parcelas em centavos com resto nas primeiras (soma = original).
- **Peso derivado:** peso = valorNoRelatório ÷ valorBase, 4 casas.
- **Peso na fatura:** `amountExibido = base × peso` (2 casas), `base_amount` preservado; pesos desabilitados → amount = base.
- Parsing monetário tolerante: `R$`, parênteses (negativos), sinais, "1.234,56" vs "1234.56".
- Máscara com `Intl.NumberFormat` pt-BR + `inputMode=numeric`.
- Conversão USD com fallback 5,25; guardrail de spike > 50%/dia mantém último preço válido.

### 4.3 Somatórios e derivações

- `saldo = rendas − despesas − investimentos`; `savingsRate = saldo ÷ rendas` (rendas = 0 → sem taxa).
- Saldo líquido de Contas = a receber − a pagar − faturas em aberto (2 casas); `faturaAberto = max(0, previsto − pago)`; totais de dívidas apenas pendentes com vencimento no mês.
- Proventos somam como **investimento negativo**; compras/subscrições positivo.
- Relatórios somam dívidas pagas (recebíveis → rendas; pagáveis → despesas) pelo mês do vencimento.
- Recebimento integrado reduz a despesa no relatório pelo valor recebido (editável).
- Percentual de meta: soma ≤ 100%.

### 4.4 Ordenações padrão

- Despesas/rendas: data desc, `created_at` desc.
- Dívidas: `due_date` asc.
- Dias da semana: Segunda → Domingo.
- Meses: mais recente primeiro.
- Alertas: atrasados primeiro, depois por vencimento.

### 4.5 Validações de formulário (pt-BR)

| Campo | Regra |
|---|---|
| Categoria (despesa/renda) | Obrigatória |
| Valor | Obrigatório, numérico finito > 0 |
| Data (despesa/renda) | ≥ APP_START_DATE (2026-01-01) |
| Parcelas | Inteiro 1–60 |
| Peso de relatório | Decimal 0–1 (default 1) |
| Cartão | Obrigatório se `credit_card` |
| Dívida — valor | ≥ 0 |
| Cobrança vinculada | Obrigatório, > 0 e ≤ valor da despesa |
| Meta de ativo | 0–100; soma ≤ 100% |
| Período customizado | Máx. 366 dias |
| Closing/due day | 1–31 (clamp) |

Erros via gateway único (`getErrorMessage`), §1.7.

---

## 5. DIRETRIZ DE UI/UX

### 5.1 Filosofia — Cards amigáveis (fintech) (D7)

- **Linguagem visual:** cards arredondados (radius generoso), sombras suaves, cor primária **esmeralda `#10B981`** + teal/sky — identidade **"Vital · Verde + Terminal"** já resolvida em `docs/DESIGN_SYSTEM.md` (tokens em `src/styles/tokens.css`); tipografia Inter + Sora + IBM Plex Mono; microinterações sutis (hover, transições 150–200ms), tom acolhedor e mobile-first.
- **Densidade:** informação clara em primeiro plano; gráficos quando agregam, nunca por decoração.
- **Copy:** pt-BR, curta e orientada a ação ("Lançar despesa", "Quitar agora").

### 5.2 Navegação e hierarquia (D8)

- **Desktop:** sidebar fixa à esquerda com as áreas: **Início (Visão Geral) · Transações · Cartões · Dívidas · Orçamentos · Relatórios · Carteira · Lembretes (badge de pendências) · Configurações**.
- **Mobile:** bottom tabs — **Início · Transações · [+]** (FAB central = lançamento guiado) **· Relatórios · Mais** (demais áreas + configurações).
- **Deep-links:** `?card=`, `?month=`, busca com destaque (§3.9).
- Áreas secundárias (categorias, perfil) acessíveis via Configurações.

### 5.3 Temas (D9) — Light / Dark / OLED

- Três temas completos via **tokens CSS** (variáveis): `light`, `dark` e `oled` (**true black `#000`** para telas AMOLED, com economia de bateria).
- Toggle no cabeçalho + **seguir preferência do sistema**; preferência persistida em `user_preferences.theme`.
- Tokens: cor de fundo, superfície, texto, borda, primária, sucesso/atenção/crítico, radius, sombra, espaçamento.

### 5.4 Design System (D6)

- **Base:** Tailwind CSS + shadcn/ui (Radix, acessível, customizável via tokens).
- **Componentes core:** Button, Input, Select, Modal/Dialog, Sheet (mobile), Tabs, Card, Sidebar, BottomNav, Badge, Toast, Skeleton, EmptyState, Progress, Stepper (wizard), Command (busca ⌘K), DataList, Chart primitives.
- **Formatação centralizada** nos serviços de apresentação (moeda, datas, status de dívida, cores de categoria).

### 5.5 Fluxos críticos — Lançamento guiado (D10)

**Tela cheia guiada (wizard de 4 passos), aberta por atalho global (tecla `N`) ou FAB `[+]`:**
1. **Valor** — campo grande com máscara pt-BR e teclado numérico.
2. **Tipo + Categoria** — toggle despesa/receita; grid de categorias com ícone/cor e sugestão inteligente por nome; opção "nova categoria".
3. **Forma de pagamento** — cartão → parcelas (1–60) e competência calculada na hora (snapshot); senão cash/pix/transfer; opção "criar cobrança vinculada" (dívida integrada).
4. **Detalhes** — data (default hoje), descrição, peso de relatório; **resumo** com valor/categoria/parcelamento/competência; botão salvar (RPC transacional).

**Anti-fricção:** defaults inteligentes (última categoria e forma usadas), estado do wizard preservado ao navegar, validação inline com mensagens do gateway, sucesso com toast + retorno à lista do mês. Fluxo alternativo futuro (modal rápido) pode ser adicionado sem quebrar o fluxo guiado.

### 5.6 Inventário de telas (prioridade)

| Tela | Prioridade | Notas |
|---|---|---|
| Auth (login/registro/recuperação) | P0 | Supabase auth + gateway de erros |
| Início / Visão Geral | P0 | KPIs, fluxo diário, orçamentos, alertas |
| Lançamento guiado (wizard) | P0 | §5.5 |
| Transações (lista por mês) | P0 | filtros, busca, deep-link |
| Cartões (lista + fatura) | P0 | seleção automática de mês |
| Dívidas | P0 | status derivado, quitação integrada |
| Orçamentos | P0 | progresso, atenção, realocação |
| Detalhe de lançamento | P1 | edição, exclusão (3 modos em parcelas) |
| Pagamento / estorno de fatura | P1 | estorno → renda automática |
| Quitação de dívida | P1 | pagar/receber + criar lançamento |
| Categorias | P1 | sugestão inteligente, migração |
| Relatórios | P1 | dia/mês/ano, custom 366d, comparativos |
| Insights | P1 | alertas, assinaturas, recorrências |
| Projeção e corte de gastos | P1 | gasto disponível, ritmo, sugestões |
| Busca global (⌘K) | P1 | scoring + destaque |
| Lembretes | P1 | consolidado, snooze |
| Carteira | P2 | posição, custo médio, valoração |
| Metas e calculadora de aporte | P2 | soma ≤ 100%, simulação |
| Configurações | P2 | preferências, temas, lembretes |
| Perfil | P2 | nome, e-mail, sessão |

### 5.7 Estados vazios / carregamento / erro

- **Empty states dedicados:** sem lançamentos no mês, sem categorias, sem metas de carteira, sem insights.
- **Loading:** skeletons por card/lista (nunca spinner genérico em tela inteira, exceto rotas).
- **Erro:** banner com mensagem do gateway + ação "Tentar novamente"; estados parciais quando aplicável (ex.: cotação desatualizada).
- **Acessibilidade:** contraste AA nos 3 temas, foco visível, labels e aria nos componentes shadcn, navegação por teclado (⌘K, `N`, Esc).

---

## 6. ROADMAP DEFINITIVO DE DESENVOLVIMENTO

> **Nota de governança (auditoria v1):** o plano de execução canônico — entregas em ordem, ordem da biblioteca de UI e DoD completo — vive em **`docs/ROADMAP.md`**. Esta seção é o **resumo executivo** e deve permanecer em sincronia com ele.
>
> Princípio: **fundação → dados → domínio financeiro → análise → carteira → experiência transversal → hardening**. Cada fase entrega valor testável e tem **Definition of Done (DoD)** objetivo.

### Fase 0 — Fundação do Repositório & Design System

**Objetivo:** base técnica e visual sólida antes de qualquer regra de negócio.

1. Repo novo: Vite + React + TypeScript **estrito**, ESLint + Prettier, Vitest + Testing Library.
2. CI: typecheck + lint + testes em todo PR.
3. Tailwind config + **tokens** dos 3 temas (light/dark/oled) + toggle + persistência.
4. shadcn/ui setup + **primitivos** (Button, Input, **MoneyInput**, Select, Card, Badge, Skeleton, EmptyState, Modal/Dialog, Tabs, DataList, Progress, Stepper, Command, Toast — ordem completa em `docs/ROADMAP.md` §4.1).
5. Shell de navegação responsivo (sidebar desktop / bottom tabs mobile) + roteamento (react-router) + deep-link params.
6. Adotar os tokens de `src/styles/tokens.css` + `globals.css` e carregar as Google Fonts (Inter, Sora, IBM Plex Mono) — identidade resolvida em `docs/DESIGN_SYSTEM.md`.
7. **PWA base:** `vite-plugin-pwa` + manifest + ícones + service worker de assets (App Shell) — `docs/PWA_GUIDELINES.md`.

**✅ DoD:** CI verde; 3 temas funcionando com toggle e preferência do sistema; componentes base revisados visualmente no browser (desktop + mobile); shell responsivo com navegação entre telas placeholder.

---

### Fase 1 — Infraestrutura de Dados & Autenticação

**Objetivo:** dados seguros, atômicos e auditáveis — o alicerce Online First.

1. Projeto Supabase + cliente único + módulo de env; estado de conexão/erro explícito.
2. Auth: login, registro, recuperação de senha, sessão, perfil (`profiles` via trigger).
3. **Schema completo** (§2) com migrations versionadas: constraints (parcelas 1–60, card no crédito, pesos 0–1, soma de metas ≤ 100% via trigger/RPC) e índices.
4. **RLS** por `auth.uid()` em todas as tabelas (incl. `audit_events` imutável).
5. **RPCs transacionais** (D1): catálogo inicial — `create_expense_with_debt`, `create_refund`, `delete_expense_installments`, `pay_debt`, `receive_debt`, `settle_integrated_receivable`, `delete_category_migrate`, `set_budget_limit`, `set_income_goal`, `recalculate_bill_competences`. **Recebem parcelas calculadas no cliente (`domain/money`) e validam invariantes no servidor** (D12).
6. Gateway de erros (`getErrorMessage`) + contratos de estado (TanStack Query + hooks) para os domínios-base.
7. Tabela `asset_prices` + edge function de atualização de cotações (cache em servidor).
8. ~~Serviço de storage (Cloudflare R2)~~ — **REMOVIDO DO ESCOPO** (decisão do usuário, 2026-08-15).

**✅ DoD:** teste de isolamento RLS (usuário A não lê dados de B); **cada RPC com teste de transação** (falha no meio → rollback total); contrato `data | loading | error | CRUD | refresh` disponível para os domínios-base; todas as mensagens de erro do gateway cobertas por teste.

---

### Fase 2 — Core de Finanças Pessoais

**Objetivo:** CRUD completo e fiel às regras do §3.1–3.5.

1. **Domínio puro:** parcelamento em centavos, `resolveBillCompetence` + `clampDay`, status derivado de dívidas, saldo de fatura, peso de relatório — com testes.
2. Receitas e despesas: CRUD, listagem por mês, ordenação, validações.
3. Parcelamento (1–60x) + exclusão 3 modos via RPC com cascata de dívidas.
4. Cartões: CRUD, faturas, pagamentos, **estornos → renda automática** (somente-leitura), seleção automática de mês, saldo aberto.
5. Dívidas: CRUD, cobrança vinculada, quitação com criação de lançamento, recebimento integrado.
6. Categorias (sugestão por nome, migração na exclusão), orçamentos (herança, faixas 85/90/95%, realocação), metas de renda.
7. **Telas correspondentes** (P0/P1 do §5.6) usando o design system e o wizard de lançamento.

**✅ DoD:** suíte de testes espelhando as regras de centavos, competência snapshot e status derivado; cascata de exclusão verificada com rollback (falha → nada excluído); estorno gera renda `[REFUND]` somente-leitura; parcelas calculadas no cliente e validadas no servidor (soma = original, 1–60); CRUDs com estados vazios/erro/loading funcionando.

---

### Fase 3 — Análise, Projeção & Corte de Gastos

**Objetivo:** inteligência sobre os dados (módulos puros + telas).

1. **Motor de insights** puro: alertas críticos priorizados, assinaturas (3 sinais + tiers), recorrências (3 níveis), confiança + aprendizado (ignorar/confirmar/restaurar).
2. Desafios de economia (10/20/30%, limite dinâmico, máx. 4) e sugestões de limite (máx. 3/mês).
3. Projeção: gasto disponível diário, ritmo de gastos (8º dia / ≥30%), projeção de fim de mês (dia ≥ 3), projeção de pendências.
4. Relatórios: dia/mês/ano, períodos customizados (≤ 366 dias), agregação por categoria/forma/dia da semana, comparativo, merge de dívidas pagas.
5. Central de lembretes: consolidação de faturas/dívidas, marcar lido, snooze com expiração. **Decisão aberta:** push ou in-app.
6. Telas: Insights, Projeção, Relatórios, Lembretes.

**✅ DoD:** testes dos alertas priorizados (ordem correta) e da fórmula de confiança; projeções conferidas contra cálculo manual de referência; relatórios com peso de relatório e merge de dívidas pagas validados por testes; central de lembretes com snooze expirando ao vencer.

---

### Fase 4 — Carteira & Rebalanceamento

**Objetivo:** posição confiável + calculadora de aporte.

1. Ledger: custo médio, caixa derivado, splits/proventos — módulo puro + testes de reconciliação.
2. Valoração: cache + fallback + **preço manual** (override marcado na UI) + guardrail de spike.
3. Metas por ativo/classe/setor com validação soma ≤ 100% (UI + banco) e travas setoriais.
4. **Calculadora de aporte**: `simulateSmartAporte` / `simulateRebalanceAporte` (2 modos) com log de roteamento.
5. Telas: Carteira, Metas (edição em lote com barra de soma), Calculadora de aporte.

**✅ DoD:** ledger reconciliado com exemplos manuais (compras/vendas/custo médio/splits); soma de metas > 100% bloqueada na UI e no banco; simulação nunca aloca além do aporte informado; preço manual prevalece sobre API/fallback e é exibido como "informado manualmente".

---

### Fase 5 — Experiência Transversal

**Objetivo:** polish, acessibilidade e busca.

1. **Busca global** (⌘K): normalização, scoring, recência, limites por tipo, deep-link com destaque.
2. Tema OLED refinado (contraste e estados) + microinterações.
3. Auditoria de acessibilidade (axe, contraste AA, foco, teclado) em todas as telas.
4. Empty states completos + onboarding de primeiro uso (criar primeiras categorias/cartões).
5. Performance: bundle splitting, virtualização de listas longas, revisão de queries (N+1).
6. **PWA polish:** prompt de instalação (`beforeinstallprompt`), atualização automática com toast, splash/iOS, auditoria Lighthouse PWA.

**✅ DoD:** busca retorna tipos ordenados por score com destaque funcional; auditoria a11y sem erros críticos; Lighthouse ≥ 90 (mobile); navegação 100% por teclado nas telas P0.

---

### Fase 6 — Hardening & Lançamento

**Objetivo:** confiança, segurança e produção.

1. **Prova de fidelidade:** suíte completa espelhando **cada regra** desta especificação (regressão contra o comportamento do app anterior).
2. Segurança: revisão final de RLS, rate limit, secrets/ambiente.
3. Observabilidade: logging de erros (ex.: Sentry — **decisão de serviço a confirmar**), métricas básicas.
4. Deploy: **Cloudflare Pages** (frontend SPA/PWA com Git integration nativa) + **Supabase** (Postgres + RLS + Auth); env vars protegidas.
5. QA final multi-dispositivo + documento de release.

**✅ DoD:** suíte de fidelidade 100% verde; revisão RLS auditada (nenhuma leitura cross-user); deploy de produção funcional com variáveis protegidas; checklist de QA aprovado em desktop + mobile (3 temas).

---

## ANEXO A — GLOSSÁRIO

| Termo | Definição |
|---|---|
| `installment_group_id` | Identificador do grupo de parcelas de uma despesa |
| `bill_competence` | Mês da fatura de cartão da despesa (**snapshot na escrita**, D3) |
| `closing_day` / `due_day` | Dia de fechamento / vencimento da fatura |
| `report_weight` | Peso (0–1) da despesa/receita nos relatórios |
| `APP_START_DATE` | Data mínima aceita para lançamentos (2026-01-01) |
| `cobrança vinculada` | Dívida criada junto da despesa (herda parcelas) |
| `target_percentage` | Percentual-alvo de ativo/classe no patrimônio total |
| `gap_financeiro` | Valor em R$ para alinhar posição à meta |
| `burn rate` | Gasto médio diário usado na projeção de fim de mês |
| `gasto disponível` | Orçamento diário derivado = mensalDisponível ÷ dias restantes |
| `savingsRate` | Taxa de poupança = saldo ÷ rendas do período |
| `audit_events` | Log imutável de eventos (exclusões, estornos, recálculos) — D2 |
| `RPC transacional` | Função Postgres com BEGIN/COMMIT para operações compostas — D1 |

---

## DECISÕES EM ABERTO (para resolver nas fases indicadas)

1. ~~Cor primária e identidade da marca~~ — **RESOLVIDA**: identidade **"Vital · Verde + Terminal"** (esmeralda/teal/sky, Inter + Sora + IBM Plex Mono, 3 temas, densidade equilibrada) — ver `docs/DESIGN_SYSTEM.md` e `src/styles/`.
2. ~~Hosting do frontend~~ — **RESOLVIDA**: **Cloudflare Pages** (Vite SPA + PWA, Git integration nativa, sem GitHub Actions).
3. ~~Serviço de observabilidade/erros~~ — **RESOLVIDA**: **Sentry** (`@sentry/react`, env-gated por `VITE_SENTRY_DSN` com dynamic import; Web Vitals LCP/INP/CLS + correlação de usuário — ver `docs/ARCHITECTURE.md` §11 e F6.3 do ROADMAP).
4. **Notificações** — in-app apenas ou push (edge function) — decisão da Fase 3 (a spec atual assume in-app; push é opcional).
