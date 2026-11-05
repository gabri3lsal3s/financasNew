# PLANO DE IMPLEMENTAÇÃO — FECHAMENTO AUTOMÁTICO DE SNAPSHOTS PATRIMONIAIS & SINCRONIZAÇÃO DE COTAÇÕES OFICIAIS

> **Documento Canônico de Arquitetura, Engenharia de Dados e Governança de Software**  
> **Status:** Proposto / Pronto para Execução · Quality Gates QG1–QG5 Definidos  
> **Módulos Afetados:** `supabase/migrations/`, `supabase/functions/quotes/`, `supabase/`, `src/types/`, `src/domain/portfolio/`, `src/data/repositories/`, `src/services/`, `src/state/`, `src/hooks/`, `src/features/investments/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Funções Puras no Domínio · Moeda em Centavos · Padrões CVM, ANBIMA e B3 · Zero Controles Nativos · Zero Emojis (`local/no-decorative-unicode`) · Portões de Qualidade (QG) por Fase  
> **Data:** Novembro de 2026 · **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano resolve de forma definitiva o problema de **materialização e encerramento dos snapshots mensais de investimentos (`portfolio_snapshots`)** sincronizados com as **cotações oficiais de fechamento do último dia do mês (`portfolio_monthly_prices`)**, garantindo que:

1. **Autonomia Multiplataforma (Desktop, PWA e Mobile Nativo):** O fechamento patrimonial não fica à mercê da abertura do aplicativo pelo usuário ou de permissões restritivas de segundo plano do sistema operacional (limitações de *Background Sync* no iOS Safari e *Doze Mode* no Android).
2. **Consciência de Calendário de Mercado (B3 / Tesouro Direto / Câmbio):** O encerramento respeita o **último dia útil** e o horário de consolidação pós-pregão (18h30–21h00 BRT), evitando coletar cotações intradiárias voláteis ou falhar em fins de semana e feriados bancários.
3. **Barreira Absoluta de Integridade (Transacionalidade Atômica):** É **impossível** gravar um snapshot consolidado se as cotações de fechamento dos ativos da carteira não tiverem sido devidamente obtidas, validadas e persistidas na mesma transação. Se houver falha de rede ou cotação ausente, o banco de dados executa `ROLLBACK` total.
4. **Resiliência Híbrida (Server-Authoritative + Just-in-Time Reconciliation):**
   - **Caminho Feliz (Servidor):** Um agendador no backend (`pg_cron` + Edge Function) encerra os snapshots de forma autônoma e silenciosa na virada do mês às 21h00 BRT.
   - **Caminho de Contingência (Dispositivo):** Caso o backend não tenha alcançado a carteira de um usuário (ex.: novo usuário, alteração retroativa de movimentação ou indisponibilidade temporária de API externa), o dispositivo, ao ser aberto em qualquer plataforma, detecta a pendência e executa a reconciliação *Just-in-Time* com validação *pre-flight*.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│             PIPELINE HÍBRIDO DE FECHAMENTO AUTOMÁTICO DE SNAPSHOTS & COTAÇÕES OFICIAIS                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
   [FLUXO PRIMÁRIO: SERVER-AUTHORITATIVE]                            [FLUXO CONTINGÊNCIA: JUST-IN-TIME CLIENT]
   - Disparado via pg_cron às 21h00 BRT                              - Disparado ao abrir o app (Desktop/PWA/App)
   - Executa no último dia útil do mês                               - useAutoPortfolioSnapshot detecta pendência
   - Edge Function 'quotes' fecha pregão                             - Pre-flight check valida 100% dos ativos
   - Chamada à RPC atômica no Postgres                               - Se API falhar: ABORTA sem gravar snapshot
                 │                                                                     │
                 └──────────────────────────────────┬──────────────────────────────────┘
                                                    ▼
                                   [CAMADA DE SEGURANÇA E BANCO DE DADOS]
                                   RPC 'commit_monthly_closing_atomic'
                                   - Inicia Transação SQL
                                   - Grava portfolio_monthly_prices (rastreabilidade da fonte)
                                   - Grava portfolio_snapshots com status='closed'
                                   - Se qualquer cotação for inválida: ROLLBACK TOTAL
                                                    │
                                                    ▼
                                   [CONSUMO NAS INTERFACES & RELATÓRIOS]
                                   - Carrossel de Evolução: Badge [Fechamento Oficial] vs [Provisório]
                                   - Dossiê Executivo (PDF/A4): Dados auditados e congelados
                                   - Motor TWR: Série histórica pura e contínua sem distorções
```

---

## 2. MATRIZ DE FRAGILIDADES DIAGNOSTICADAS & SALVAGUARDAS BLINDADAS

| # | Fragilidade Diagnosticada | Causa Raiz | Salvaguarda Blindada de Engenharia |
|---|---|---|---|
| **F1** | Inviabilidade de background execution confiável no PWA/Mobile | O WebKit (iOS Safari) não suporta *Periodic Background Sync*. O Android suspende tarefas via *Doze Mode*. No Desktop, a aba precisa estar aberta. | Migração da responsabilidade primária de fechamento para o servidor via `pg_cron` e Edge Function, transformando o cliente em consumidor passivo e reconciliador *Just-in-Time*. |
| **F2** | Snapshot gravado com cotações intradiárias ou inexistentes | Disparos realizados antes das 18h30 BRT ou em fins de semana capturam dados parciais ou repetidos. | Implementação do motor de calendário de mercado (`market-calendar.ts`), mapeando feriados da B3 e agendando o fechamento para as 21h00 BRT do último dia útil do mês. |
| **F3** | Dessincronia entre cotações e snapshot (escrita não-atômica) | O cliente executa mutações separadas (`upsertPortfolioMonthlyPricesBatch` e `upsertPortfolioSnapshot`). Se a conexão cair entre uma e outra, o snapshot fica dessincronizado. | Criação da RPC atômica `commit_monthly_closing_atomic` no Postgres. A gravação das cotações e do snapshot ocorre em um único bloco `BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK;`. |
| **F4** | Gravação de snapshot com cotação zerada em caso de falha de API | Falta de barreira pré-gravação (*pre-flight validation*). Na ausência de preço, o sistema usava fallback cego de custo ou zero. | Validador estrito de cobertura no domínio (`closing-validator.ts`): se qualquer ativo de risco em custódia retornar sem preço válido $> 0$, o fechamento é expressamente rejeitado. |
| **F5** | Conflito de concorrência entre Servidor e Cliente | Dispositivo aberto às 21h01 BRT tentando fechar o mês ao mesmo tempo em que a rotina do servidor está rodando. | Bloqueio idempotente por chave única `(user_id, month)` e trava lógica `closing_status = 'closed'`. Se o mês já estiver consolidado, mutações redundantes são ignoradas. |
| **F6** | Usuário não sabe se o valor do mês é final ou estimativa | A tabela `portfolio_snapshots` só armazenava `total_value` e `total_cost`, sem discriminar status de consolidação. | Adição das colunas `status` (`'provisional' | 'closed'`), `closing_date` e `closed_at` na tabela `portfolio_snapshots`, refletidas na UI com badges semânticos. |

---

## 3. FASES DE EXECUÇÃO DETALHADAS

### FASE 1: ARQUITETURA DE DADOS & TRANSAÇÃO ATÔMICA NO POSTGRES

**Objetivo:** Blindar o banco de dados para que seja fisicamente impossível salvar um snapshot sem que todas as cotações do fechamento estejam gravadas e validadas.

- [ ] **Etapa 1.1: Migration de Enriquecimento de Snapshots (`supabase/migrations/`)**
  - Adicionar as colunas `status` (`varchar(20) default 'provisional' check (status in ('provisional', 'closed'))`), `closing_date` (`date null`) e `closed_at` (`timestamptz null`) na tabela `portfolio_snapshots`.
  - Criar índice otimizado para busca de pendências de fechamento: `create index idx_portfolio_snapshots_user_month_status on portfolio_snapshots (user_id, month, status);`.
- [ ] **Etapa 1.2: Criação da RPC Transacional `commit_monthly_closing_atomic`**
  - Implementar a função em PL/pgSQL com transação atômica (`SECURITY INVOKER`):
    - Parâmetros: `p_month text`, `p_closing_date date`, `p_prices jsonb`, `p_total_value numeric`, `p_total_cost numeric`.
    - Validação de invariantes: verifica se `p_prices` não está vazio e se nenhum item possui `price <= 0`.
    - Executa upsert em lote na tabela `portfolio_monthly_prices`.
    - Executa upsert na tabela `portfolio_snapshots` marcando `status = 'closed'` e `closed_at = now()`.
    - Em caso de qualquer inconsistência, emite `RAISE EXCEPTION`, abortando a transação sem gravar nada.
- [ ] **Etapa 1.3: Atualização dos Tipos Canônicos TypeScript (`src/types/database.ts` e `src/types/portfolio.ts`)**
  - Atualizar a interface `PortfolioSnapshot` para incluir `status: "provisional" | "closed"`, `closing_date?: string` e `closed_at?: string`.
  - Atualizar os contratos de input e retorno das mutations de fechamento.

---

#### 🛡️ PORTÃO DE QUALIDADE 1 (QG1) — BANCO DE DADOS & TRANSAÇÃO ATÔMICA
> **Critérios Inegociáveis de Passagem:**
> 1. A migration roda limpa e idempotente sem quebrar a série histórica existente.
> 2. O teste da RPC confirma que:
>    - Ao passar cotações válidas, tanto `portfolio_monthly_prices` quanto `portfolio_snapshots` são persistidos com status `closed`.
>    - Ao forçar erro em uma cotação (ex.: `price: 0` ou `price: -10`), a função falha e **nenhuma linha** é gravada no banco (rollback total verificado).
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/tests/cross-tenant-penetration.test.ts
> npx tsc --noEmit
> ```

---

### FASE 2: MOTOR DE DOMÍNIO — CALENDÁRIO DE MERCADO E VALIDADOR PRÉ-FLIGHT

**Objetivo:** Criar regras de negócio puras em `src/domain/` para gerenciar datas de fechamento da B3 e validar a higienização de cotações antes do envio ao banco.

- [ ] **Etapa 2.1: Implementação do Calendário de Mercado Financeiro (`src/domain/portfolio/market-calendar.ts`)**
  - Função pura `getLastTradingDayOfMonth(year: number, month: number): string (YYYY-MM-DD)`.
  - Mapeamento estático e determinístico de feriados nacionais e bancários da B3 (Confraternização, Carnaval, Paixão de Cristo, Tiradentes, Dia do Trabalho, Corpus Christi, Independência, N. Sra Aparecida, Finados, Proclamação da República, Dia da Consciência Negra, Natal e último dia útil bancário de dezembro sem negociação).
  - Função pura `isMarketClosingAvailable(currentDate: Date, targetMonth: string): boolean`:
    - Retorna `true` apenas se a data e hora atual forem iguais ou posteriores às 19h00 BRT do último dia útil daquele mês.
- [ ] **Etapa 2.2: Validador Pré-Flight de Cotações (`src/domain/portfolio/closing-validator.ts`)**
  - Função pura `validateClosingEligibility`:
    - Recebe a lista de ativos em custódia apurados via `PointInTimeResult` e a lista de cotações obtidas.
    - Classifica ativos: Caixa e Renda Fixa pós-fixada privada utilizam regras próprias de valor nominal/acumulado; ações, FIIs, BDRs, ETFs e Tesouro Direto **exigem obrigatoriamente** cotação de mercado $> 0$.
    - Retorna objeto com `{ canCommit: boolean, missingTickers: string[], validatedPrices: MonthlyPriceInput[] }`.
- [ ] **Etapa 2.3: Testes Unitários de Domínio (`market-calendar.test.ts` e `closing-validator.test.ts`)**
  - Testar meses que terminam em sábado, domingo e feriados (ex.: dezembro, abril, novembro).
  - Testar cenários com falha parcial de cotação (deve rejeitar o fechamento) e cobertura total (deve aprovar).

---

#### 🛡️ PORTÃO DE QUALIDADE 2 (QG2) — MOTOR PURO DE DOMÍNIO
> **Critérios Inegociáveis de Passagem:**
> 1. Suíte de testes de calendário cobrindo 100% dos cenários de borda de feriados bancários e fins de semana.
> 2. Zero importações de UI, Supabase ou dependências externas em `src/domain/portfolio/`.
> 3. Suíte de validação pré-flight com cobertura de 100% dos ramos condicionais.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/domain/portfolio/market-calendar.test.ts src/domain/portfolio/closing-validator.test.ts
> npx tsc --noEmit
> ```

---

### FASE 3: BACKEND AUTÔNOMO — EDGE FUNCTION & AGENDADOR PG_CRON

**Objetivo:** Permitir que o fechamento ocorra de forma centralizada e automática no servidor, sem que o usuário precise estar com o app aberto.

- [ ] **Etapa 3.1: Expansão da Edge Function `quotes` (`supabase/functions/quotes/index.ts`)**
  - Implementar modo de ação de fechamento mensal (`action: 'close_month'`):
    - Recebe ou infere o mês de competência a ser fechado.
    - Executa a busca em lote das cotações de fechamento oficial de todos os ativos da base na data de corte.
    - Valida as cotações contra guardrails de volatilidade e spikes.
    - Se invocado pelo agendador com `service_role`, consolida a posição de carteira e invoca a RPC transacional com segurança.
- [ ] **Etapa 3.2: Criação do Script SQL de Agendamento (`supabase/monthly-closing-cron.sql`)**
  - Configurar job no `pg_cron` agendado para rodar de segunda a sexta-feira às 21h00 BRT (`0 0 * * 2-6 UTC`):
    - O script verifica se a data atual corresponde ao último dia útil do mês via função SQL rápida ou se o mês corrente fechou.
    - Dispara requisição HTTP assíncrona segura (`net.http_post`) para a Edge Function de cotações com token de serviço.
  - Documentar comandos operacionais de auditoria no `FOUNDER_RUNBOOK.md` (`cron.job_run_details`).
- [ ] **Etapa 3.3: Testes Automatizados de Orquestração (`src/tests/quotes-cron.test.ts`)**
  - Validar a integridade do script SQL, permissões e parâmetros de segurança da chamada HTTP.

---

#### 🛡️ PORTÃO DE QUALIDADE 3 (QG3) — SERVIÇO DE BACKEND & CRON
> **Critérios Inegociáveis de Passagem:**
> 1. A Edge Function compila com Deno sem erros de tipagem.
> 2. Testes de integração confirmam que chamadas com `service_role` processam o fechamento e chamadas públicas sem autorização recebem HTTP 401.
> 3. O script `monthly-closing-cron.sql` passa no teste estático de regras de segurança e quotas.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/tests/quotes-cron.test.ts src/tests/quotes-cron-and-ratelimits.test.ts
> ```

---

### FASE 4: CLIENTE RESILIENTE — RECONCILIAÇÃO JUST-IN-TIME (DESKTOP / PWA / MOBILE)

**Objetivo:** Garantir que, caso o usuário abra o Desktop, PWA ou App Nativo e o mês anterior não tenha sido fechado pelo servidor, o dispositivo realize o fechamento com total segurança.

- [ ] **Etapa 4.1: Repositório de Fechamento Atômico (`src/data/repositories/portfolio-monthly-closing.ts`)**
  - Implementar chamada tipada para a RPC `commit_monthly_closing_atomic`.
  - Tratamento padronizado de erros via `getErrorMessage` com logs de auditoria.
- [ ] **Etapa 4.2: Refatoração do Hook `useAutoPortfolioSnapshot` (`src/hooks/use-auto-portfolio-snapshot.ts`)**
  - Adicionar detecção de **Mês Anterior Pendente de Fechamento**:
    - Ao iniciar o app, verifica se o mês imediatamente anterior possui snapshot com `status === 'closed'`.
    - Se não possuir e a data atual for posterior ao fechamento do mercado daquele mês (`isMarketClosingAvailable`):
      - Dispara a busca das cotações históricas oficiais da data de corte (`fetchHistoricalMonthlyQuotes`).
      - Passa pelo `validateClosingEligibility`.
      - **Se válido:** invoca `commitMonthlyClosingAtomic`.
      - **Se inválido:** aborta a mutação, preserva a integridade e não grava snapshot corrompido.
  - Manter a trava de concorrência com `useRef` e hash de competência para evitar execuções duplicadas.
- [ ] **Etapa 4.3: Atualização da Mutação `useSaveMonthlyClosing` (`src/state/mutations/use-portfolio-monthly-mutations.ts`)**
  - Migrar a mutação manual do modal de fechamento para usar a nova RPC atômica, eliminando escritas parciais desprotegidas.

---

#### 🛡️ PORTÃO DE QUALIDADE 4 (QG4) — CLIENTE JUST-IN-TIME & ESTADO
> **Critérios Inegociáveis de Passagem:**
> 1. Testes unitários do hook `use-auto-portfolio-snapshot.test.ts` cobrindo:
>    - Mês já fechado: zero mutações disparadas.
>    - Mês pendente com cotações com sucesso: dispara RPC atômica e fecha o mês.
>    - Mês pendente com falha de cotação: cancela sem chamar gravação de snapshot.
> 2. Zero loops infinitos de re-render ou re-fetching.
> 
> **Comandos de Verificação:**
> ```bash
> npx vitest run src/hooks/use-auto-portfolio-snapshot.test.ts src/state/mutations/use-portfolio-monthly-mutations.test.ts
> npx tsc --noEmit
> ```

---

### FASE 5: EXPERIÊNCIA DE USUÁRIO, AUDITORIA VISUAL & HOMOLOGAÇÃO MULTIPLATAFORMA

**Objetivo:** Oferecer transparência ao investidor sobre o status do fechamento e validar a experiência no Desktop, PWA e Mobile.

- [ ] **Etapa 5.1: Indicadores Visuais de Fechamento (`PortfolioSnapshotsCarousel` e `MonthlyClosingEditor`)**
  - Adicionar badge sutil e semântico no card de cada mês:
    - `[Fechamento Oficial]` (verde suave / neutro) quando `status === 'closed'`.
    - `[Em Aberto / MTD]` (tom neutro / muted) para o mês corrente em andamento.
    - `[Aguardando Cotações]` (amarelo de aviso discreto) caso o mês tenha virado mas a conferência esteja pendente.
- [ ] **Etapa 5.2: Validação Multiplataforma (PWA, Android Nativo e Desktop)**
  - Testar o comportamento ao abrir o aplicativo:
    - No navegador Desktop (Chrome / Safari / Edge).
    - No PWA instalado (modo standalone).
    - No APK Android compilado (Capacitor).
  - Verificar se a lista de ativos sincroniza sem jank, sem layout shift e respeitando o Design System (§4 e §13 de `AGENTS.md`).
- [ ] **Etapa 5.3: Atualização Canônica da Documentação (`docs/`)**
  - Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` (seção §3.11.2 e decisões de arquitetura).
  - Atualizar `docs/architecture/ARCHITECTURE.md` e `docs/roadmap/ROADMAP.md` marcando a funcionalidade como concluída.

---

#### 🛡️ PORTÃO DE QUALIDADE 5 (QG5 — FINAL) — HOMOLOGAÇÃO E PRONTIDÃO
> **Critérios Inegociáveis de Passagem:**
> 1. Suíte de testes completa passando sem regressões: testes de domínio, repositórios, hooks e penetração de banco.
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
| **NEW** | `supabase/migrations/20261105_portfolio_snapshots_closing.sql` | Migration com colunas de status e RPC `commit_monthly_closing_atomic` |
| **NEW** | `supabase/monthly-closing-cron.sql` | Script SQL de agendamento no `pg_cron` para encerramento às 21h BRT |
| **NEW** | `src/domain/portfolio/market-calendar.ts` | Motor puro de calendário de mercado da B3 e detecção de fechamento |
| **NEW** | `src/domain/portfolio/market-calendar.test.ts` | Testes de unidade do calendário de mercado financeiro |
| **NEW** | `src/domain/portfolio/closing-validator.ts` | Validador pré-flight de integridade de cotações para fechamento |
| **NEW** | `src/domain/portfolio/closing-validator.test.ts` | Testes do validador pré-flight de fechamento |
| **NEW** | `src/data/repositories/portfolio-monthly-closing.ts` | Repositório cliente de chamada da RPC atômica |
| **MODIFY** | `supabase/functions/quotes/index.ts` | Adição de handler para fechamento mensal oficial de ativos |
| **MODIFY** | `src/types/database.ts` | Tipagem da tabela `portfolio_snapshots` enriquecida |
| **MODIFY** | `src/types/portfolio.ts` | Tipagem de contratos de fechamento mensal |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.ts` | Reconciliador Just-in-Time com trava de segurança pré-flight |
| **MODIFY** | `src/hooks/use-auto-portfolio-snapshot.test.ts` | Testes de unidade e concorrência do hook atualizado |
| **MODIFY** | `src/state/mutations/use-portfolio-monthly-mutations.ts` | Migração para uso da RPC atômica |
| **MODIFY** | `src/features/investments/components/portfolio-snapshots-carousel.tsx` | Badges semânticos de status do snapshot (`closed` vs `provisional`) |
| **MODIFY** | `docs/architecture/ESPECIFICACAO_TECNICA.md` | Registro formal das regras canônicas de fechamento |
| **MODIFY** | `docs/roadmap/ROADMAP.md` | Atualização do plano de entregas |

---

## 5. RESUMO DE BENEFÍCIOS TÉCNICOS & OPERACIONAIS

1. **Blindagem Contra Falhas de Cotação:** Snapshots corrompidos ou com valores parciais deixam de existir, pois a transação no banco exige validação prévia de 100% dos ativos de risco.
2. **Independência do Aparelho do Usuário:** O fechamento ocorre nas nuvens (Supabase), dispensando que o usuário lembre de abrir o PWA ou o Desktop no último dia do mês.
3. **Resiliência Multiplataforma:** Se por qualquer motivo o cron não alcançar o fechamento, o aplicativo Desktop, o PWA e o App Nativo realizam a reconciliação transparente no primeiro acesso do usuário.
4. **Alinhamento com Padrões CVM/ANBIMA:** Séries históricas de cotas (TWR) e relatórios executivos tornam-se auditáveis, estáveis e imutáveis após a consolidação oficial.
