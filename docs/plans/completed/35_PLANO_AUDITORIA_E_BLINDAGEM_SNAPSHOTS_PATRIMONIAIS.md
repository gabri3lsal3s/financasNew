# PLANO 35 — Auditoria e Blindagem da Funcionalidade de Snapshots Patrimoniais

> **Status:** Concluído  
> **Versão Alvo:** v3.6.5 (Build 64)  
> **Data:** Novembro de 2026  
> **Contexto:** Auditoria completa 360° da funcionalidade de Snapshots Patrimoniais (`portfolio_snapshots`), materialização autônoma, fechamento mensal atômico, TWR Modified Dietz, tabela analítica e relatórios executivos.

---

## 1. OBJETIVO

Blindar integralmente o ciclo de vida dos **Snapshots Patrimoniais** no módulo de investimentos:
1. Eliminar o descarte silencioso de metadados (`status`, `closing_date`, `closed_at`) no repositório de dados.
2. Migrar o fechamento mensal no frontend para a RPC atômica transacional `commit_monthly_closing_atomic`, mantendo fallback resiliente.
3. Permitir atualização e recalibração do snapshot provisório do mês corrente em `useAutoPortfolioSnapshot`, mantendo imutabilidade sobre competências formalmente fechadas (`status = 'closed'`).
4. Propagar o status do snapshot para a série analítica (`PortfolioMonthlySeriesPoint`) e enriquecer a interface da tabela analítica (`portfolio-snapshots-dialog.tsx`) e carrossel com indicadores claros de status provisório vs. fechado.
5. Garantir deduplicação robusta em `batchUpsertPortfolioSnapshots` e invalidação estrita de cache em `useDeletePortfolioSnapshot`.

---

## 2. FASES DE EXECUÇÃO

### Fase 1: Repositório e Contratos Tipados
- [x] Atualizar `PortfolioSnapshotInput` em `src/types/schema.ts` com `status`, `closing_date` e `closed_at`.
- [x] Atualizar `validateSnapshotInput` em `src/data/repositories/portfolio.ts` para validar e preservar `status`, `closing_date` e `closed_at`.
- [x] Implementar deduplicação em `batchUpsertPortfolioSnapshots` para prevenir erros de duplicidade de chaves no Postgres.
- [x] Atualizar testes em `src/data/repositories/portfolio.test.ts`.

### Fase 2: Fechamento Atômico Transacional
- [x] Atualizar `SaveMonthlyClosingInput` em `src/state/mutations/use-portfolio-monthly-mutations.ts` para aceitar `closingDate?: string`.
- [x] Utilizar a RPC `commitMonthlyClosingRpc` com fallback no `useSaveMonthlyClosing`.
- [x] Passar `closingDate: historicalPosition.cutoffDate` em `src/features/investments/components/monthly-closing-editor.tsx`.
- [x] Invalidar `[PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, month]` em `useDeletePortfolioSnapshot`.

### Fase 3: Materialização Autônoma Aprimorada
- [x] Atualizar `useAutoPortfolioSnapshot` em `src/hooks/use-auto-portfolio-snapshot.ts`:
  - Mês corrente: gravar explicitamente com `status: "provisional"`.
  - Recalibrar se snapshot existente for `"provisional"` e houver divergência $\ge \text{R\$}~1,00$ em relação à custódia atual.
  - Respeitar imutabilidade se `status === "closed"`.
  - Meses retroativos: gravar sempre com `status: "closed"` e repassar `snapshots: existingSnapshots`.
- [x] Atualizar testes em `src/hooks/use-auto-portfolio-snapshot.test.ts`.

### Fase 4: Enriquecimento de Domínio e Interface Analítica
- [x] Atualizar `PortfolioMonthlySeriesPoint` e `CurrentMonthSeriesPoint` em `src/domain/portfolio/summary.ts` com `status?: "provisional" | "closed"`.
- [x] Mapear o status em `buildPortfolioMonthlySeries`.
- [x] Exibir badge `provisório` para meses históricos abertos em `portfolio-snapshots-dialog.tsx` e `portfolio-snapshots-carousel.tsx`.
- [x] Atualizar testes unitários de componentes.

### Fase 5: Quality Gates, Versão & Deploy
- [x] Executar bateria completa de testes de investimentos e segurança.
- [x] Validar tipagem (`tsc -b`), linting (`npm run lint`) e build de produção (`npm run build`).
- [x] Atualizar `docs/roadmap/ROADMAP.md` e bump de versão para v3.6.5 (Build 64) em `package.json`.
- [x] Commit git, push para `origin/main` e despacho de relatório executivo ao Telegram.
