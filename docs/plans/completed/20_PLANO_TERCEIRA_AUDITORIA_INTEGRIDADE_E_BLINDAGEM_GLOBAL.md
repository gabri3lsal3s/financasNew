# PLANO 20 — Terceira Auditoria Completa: Integridade Global, Prevenção a Injeção de Fórmulas e Blindagem de Borda

> **Status:** Concluído com Sucesso (100% Homologado)  
> **Área:** Segurança de Aplicação (AppSec), Banco de Dados / RLS, Prevenção DDE/XML, Edge Functions & Sanitização de Borda  
> **Normas Vinculadas:** AGENTS.md, docs/operations/SECURITY_GOVERNANCE.md, docs/architecture/ESPECIFICACAO_TECNICA.md, OWASP Top 10 (A03:2021-Injection, A01:2021-Broken Access Control).

---

## 1. OBJETIVO EXECUTIVO

Realizar uma terceira auditoria de ponta a ponta no ecossistema do **Áxis Finance**, cobrindo todas as frentes de proteção residual identificadas após as auditorias anteriores (Planos 18 e 19):
1. **Prevenção a CSV/XML Formula Injection (DDE Injection):** Blindar a exportação de planilhas XML/XLS em `src/services/excel-export.ts`, garantindo que strings com prefixos maliciosos (`=`, `+`, `-`, `@`, `|`, `\t`, `\r`) sejam sanitizadas mesmo quando precedidas de espaços em branco ou pipes, espelhando a proteção de `src/domain/export/csv.ts`.
2. **Conformidade Estrita de RLS InitPlan & Contagem Canônica de Tabelas:** Corrigir a policy de `billing_webhook_logs` para utilizar `(select auth.uid())`, eliminando execução volátil por linha e satisfazendo 100% dos testes estritos de InitPlan subquery caching; atualizar os quality gates de contagem de tabelas do banco (55 tabelas com RLS ativo).
3. **Blindagem e Governança da Edge Function `quotes`:**
   - Adicionar validação estrita no parser de tickers na Edge Function `quotes` (rejeitar caracteres especiais fora do padrão financeiro e limitar a 50 tickers por requisição);
   - Garantir fallbacks defensivos e sanitização de logs de mercado.
4. **Governança de Abertura de Links Externos (`window.open`):**
   - Garantir que todas as invocações de `window.open` no frontend utilizem `noopener,noreferrer` em `trip-public-page.tsx`, `invite-trip-member-dialog.tsx` e `trip-settlement-dialog.tsx`, prevenindo vulnerabilidades de `window.opener` hijacking (tabnabbing).
5. **Automação de Testes de Regressão de Segurança:**
   - Adicionar suíte de testes de integridade para escape XML/XLS e formula injection em `src/tests/excel-export-security.test.ts`.
   - Garantir 100% de testes verdes em toda a suíte de auditoria (`src/tests/security-audit.test.ts`).

---

## 2. PORTÕES DE QUALIDADE (QUALITY GATES)

| Portão | Descrição | Critério de Aceite |
|---|---|---|
| **QG-1** | Sanitização contra DDE e Injeção XML em `excel-export.ts` | Testes comprovando prefixação segura de `'` para fórmulas iniciadas por `=, +, -, @, \|, \t, \r` com espaços. |
| **QG-2** | InitPlan Caching na Policy de `billing_webhook_logs` | Subquery escalar `(select auth.uid())` aplicada em `20260101000104_billing_refinements_and_audit_logs.sql`. |
| **QG-3** | Segurança de Borda contra Tabnabbing (`noopener,noreferrer`) | 100% dos links externos com `window.open` usando a tupla segura. |
| **QG-4** | Validação Estrita de Entrada na Edge Function `quotes` | Regex e tamanho estrito de tickers (`^[A-Z0-9^=.-]{1,15}$`) e teto de batch. |
| **QG-5** | Testes e Build Verdes | `npm test -- src/tests/security-audit.test.ts` e `npm run build` passando com 0 erros. |

---

## 3. FASES DE EXECUÇÃO

### FASE 1: Sanitização DDE/XML em Exportação Excel
- Arquivo: `src/services/excel-export.ts`
- Implementar `sanitizeSpreadsheetText` com suporte a `|` (pipe), tratamento de trim defensivo e proteção de injeção em todas as colunas textuais.
- Criar teste unitário dedicado: `src/tests/excel-export-security.test.ts`.

### FASE 2: InitPlan Caching & Governança de Migrations SQL
- Arquivo: `supabase/migrations/20260101000104_billing_refinements_and_audit_logs.sql`
- Ajustar policy: `WHERE profiles.id = (SELECT auth.uid())`.
- Arquivo: `src/tests/security-audit.test.ts`
- Atualizar contagem canônica de tabelas para 55 e alinhar teste.

### FASE 3: Blindagem Anti-Tabnabbing em Rotas de Compartilhamento
- Arquivos:
  - `src/features/public-share/pages/trip-public-page.tsx`
  - `src/features/trips/components/invite-trip-member-dialog.tsx`
  - `src/features/trips/components/trip-settlement-dialog.tsx`
  - `src/services/native/update-checker.ts`
- Adicionar `"noopener,noreferrer"` no terceiro argumento de `window.open`.

### FASE 4: Blindagem e Validação de Tickers na Edge Function `quotes`
- Arquivo: `supabase/functions/quotes/index.ts`
- Validar formato de ticker com regex estrito antes de invocar APIs externas (evitando caracteres de injeção ou URLs forjadas).

### FASE 5: Verificação Global & Quality Gates
- Rodar `npx tsc -b`.
- Rodar Vitest em `src/tests/security-audit.test.ts` e novos testes.
- Rodar `npm run build`.
- Atualizar documentação em `docs/operations/SECURITY_GOVERNANCE.md`.

