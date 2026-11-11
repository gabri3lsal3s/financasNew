# Relatório de Auditoria de Falha — AGY Orchestrator

- **Data/Hora:** 2026-11-11 11:27:16
- **Status Geral:** 🛑 Falha / Interrupção
- **Modo Operacional:** `nightshift`
- **Ciclo / Passo:** `5` de `50`
- **Workspace:** `/home/gabrielsales/meus_apps/financasnew`
- **Tarefa Alvo:** PIN Fallback: Permite desbloqueio local por PIN de 4 a 6 dígitos quando a biometria falhar ou não estiver disponível no hardware.

---

## 1. Descrição do Erro / Causa da Parada

**Resumo:** AGY encerrou com código de erro 3

```text
❌ Erro na execução do AGY:

error: failed to construct executor: plan model not specified; you must specify a valid model
AGY_ERROR: {"short_error":"failed to construct executor: plan model not specified; you must specify a valid model","status":"UNKNOWN","error_code":2,"code_kind":"grpc","retryable":false,"error_id":"c4278c24-5493-404a-9e95-2a0a63cd7a14-1"}
```

---

## 2. Ações de Integridade de Código (Git Guard)

- Arquivos staged desmarcados (git reset HEAD). Nenhuma alteração mantida pronta para commit.
- Comando de git push bloqueado categoricamente.

**Arquivos Modificados no Workspace:**
```text
M src/app/app-lock-overlay.test.tsx
 M src/app/router.tsx
 M src/components/modules/aporte-result.tsx
 M src/components/modules/cash-kpi-card.tsx
 M src/components/modules/category-donut.tsx
 M src/components/modules/interactive-target-donut.tsx
 M src/components/modules/manage-split-dialog.tsx
 M src/components/modules/portfolio/position-mobile-card.tsx
 M src/components/modules/position-table.tsx
 M src/components/modules/projection-line.tsx
 M src/components/modules/report-table.tsx
 M src/components/modules/reports/report-allocation-donuts.tsx
 M src/components/modules/reports/report-fii-breakdown-card.tsx
 M src/components/modules/reports/report-fixed-income-breakdown-card.tsx
 M src/components/modules/reports/report-international-breakdown-card.tsx
 M src/components/modules/reports/report-performance-chart.tsx
 M src/components/modules/reports/report-stocks-breakdown-card.tsx
 M src/components/routing/require-active-account.test.tsx
 M src/components/routing/require-active-account.tsx
 M src/data/auth.test.ts
 M src/data/auth.ts
 M src/data/rpc/index.ts
 M src/features/auth/pages/login-page.test.tsx
 M src/features/auth/pages/login-page.tsx
 M src/features/landing/components/minimal-wealth-simulator.tsx
 M src/features/settings/components/tabs/index.ts
 M src/features/settings/components/tabs/security-tab.test.tsx
 M src/features/settings/components/tabs/security-tab.tsx
 M src/hooks/use-auth.ts
 M src/hooks/use-sign-out.test.ts
 M src/hooks/use-sign-out.ts
 M src/lib/date.test.ts
 M src/lib/date.ts
 M src/services/native/app-lock.test.ts
 M src/services/native/app-lock.ts
 M src/services/native/index.ts
 M src/state/index.ts
 M src/types/database.ts
 M src/types/schema.ts
?? docs/plans/23_PLANO_AUDITORIA_E_CONGRUENCIA_GLOBAL_DO_APP.md
?? "docs/plans/Plano de Auditoria e Implementa\303\247\303\243o remoto.md"
?? docs/reports/RELATORIO_AUDITORIA_ERRO_1794404343.md
?? docs/reports/RELATORIO_AUDITORIA_ERRO_1794406219.md
?? src/data/repositories/devices.test.ts
?? src/data/repositories/devices.ts
?? src/data/rpc/auth-sessions.ts
?? src/features/settings/components/tabs/active-devices-card.test.tsx
?? src/features/settings/components/tabs/active-devices-card.tsx
?? src/features/settings/components/tabs/security/
?? src/hooks/use-auth.test.ts
?? src/services/native/device-info.test.ts
?? src/services/native/device-info.ts
?? src/state/mutations/use-device-mutations.ts
?? src/state/queries/use-devices.test.tsx
?? src/state/queries/use-devices.ts
?? supabase/migrations/20260101000112_user_devices_and_session_management.sql
```

**Garantia de Integridade:** Nenhum commit contendo erros foi preservado e nenhuma alteração foi enviada para branches remotas (push bloqueado).

---

## 3. Estado do Checklist

- **Tarefas Concluídas:** `4` de `41`
- **Tarefas Restantes:** `37`
- **Próxima Pendência:** PIN Fallback: Permite desbloqueio local por PIN de 4 a 6 dígitos quando a biometria falhar ou não estiver disponível no hardware.

---

## 4. Política de Energia & Sistema

- Política de Energia: **MANTER COMPUTADOR LIGADO** (Auto-desligamento desativado).
- O computador **NÃO** será desligado automaticamente e permanece pronto para continuidade ou inspeção.
