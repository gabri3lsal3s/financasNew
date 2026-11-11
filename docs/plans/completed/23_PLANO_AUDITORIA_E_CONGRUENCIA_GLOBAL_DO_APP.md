# 🎯 23_PLANO_AUDITORIA_E_CONGRUENCIA_GLOBAL_DO_APP.md

> **Status:** 100% Concluído e Homologado (v3.1.0)  
> **Classificação:** 🔵 Fluxo Completo (Feature / Plano / Refatoração Global)  
> **Base de Regras:** `AGENTS.md` (33 Regras Canônicas) · `ESPECIFICACAO_TECNICA.md` · `DESIGN_SYSTEM.md`  
> **Quality Gate:** `npm run verify` por fase · `npm run verify:full` no fechamento · Bump de versão para `3.1.0`.

---

## 1. OBJETIVO E ESCOPO

Eliminar todas as incongruências levantadas na auditoria completa do aplicativo, harmonizando a base de código com 100% das diretrizes do `AGENTS.md`:
1. **Formatação PT-BR Canônica (Regra 28):** Eliminar `.toFixed()` soltos em JSX, substituindo por `formatPercent` e `formatCentsAsBRL`.
2. **Elevação e Bordas Canônicas (Regra 16):** Unificar a trinca `border-border/80 bg-surface shadow-xs`.
3. **Prevenção de Truncamento Cego (Regra 23):** Converter títulos compostos para `line-clamp-2 break-words`.
4. **Reuso de Primitivos & Zero Elementos Nativos (Regras 4 e 7):** Integrar `<Dropzone />` em `attach-receipt-dialog.tsx` e sanear `<input>` estático e `as any`.
5. **Blindagem Arquitetural de Dados (Regra 45):** Isolar `@/data` no ESLint e mover chamadas de auth para hooks.
6. **Domínio Puro (Regra 3):** Mover cálculo da independência financeira (FIRE) para `src/domain/portfolio/fire.ts`.
7. **Harmonização de Cabeçalhos (Regra 21):** Adicionar `<PageHeader />` em `cards-page.tsx` e `transaction-list-page.tsx`.
8. **Componentização de Chips (Regra DRY #4):** Primitivo unificado `<Chip />`.

---

## 2. CHECKLIST DE EXECUÇÃO

- [x] **Fase 1:** Padronização Linguística e Formatação PT-BR Canônica (Regra 28)
- [x] **Fase 2:** Unificação de Elevação e Bordas Canônicas (Regra 16)
- [x] **Fase 3:** Blindagem contra Truncamento Cego em Cabeçalhos Compostos (Regra 23)
- [x] **Fase 4:** Reuso de Primitivos de Controle e Saneamento de Tipos (Regras 4, 7 e 3)
- [x] **Fase 5:** Blindagem da Camada de Dados e Atualização de ESLint (Regra 45)
- [x] **Fase 6:** Extração do Motor Financeiro da Curva FIRE para Domínio Puro (Regra 3)
- [x] **Fase 7:** Harmonização de Cabeçalhos de Página (Regra 21)
- [x] **Fase 8:** Componentização de Chips de Seleção Rápida (Regra DRY #4)
- [x] **Quality Gate Final:** `npm run verify:full`, version bump `3.1.0` e documentação.
