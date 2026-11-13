# Plano 33 — Segunda Rodada de Auditoria e Refinamentos de Investimentos

> **Status:** Em Execução  
> **Versão Alvo:** v3.6.3 (Build 62)  
> **Módulo:** Investimentos / Portfólio / Fiscal / UI  
> **Data:** 13/11/2026  

---

## 1. Contexto e Motivação

Após a conclusão com êxito da primeira rodada de blindagem de investimentos (v3.6.2 Build 61), foi realizada uma nova auditoria transversal e aprofundada de ponta a ponta sobre todo o ecossistema de investimentos:
1. Cadastros de Ativos, Fichas de Detalhes e Eventos Societários;
2. Transações e Lançamentos Rápidos (`QuickTransactionSheet`, `TransactionFormDialog`);
3. Proventos e inteligência da Bola de Neve (`proventos-tab.tsx`, `snowball.ts`);
4. Apuração Fiscal e Classificação Tributária B3 (`tax.ts`);
5. Conformidade estrita com o Design System (Regras DRY, Regra 1, 7, 9, 15 e 18 de AGENTS.md).

---

## 2. Itens do Plano de Ação

| ID | Área | Descrição | Arquivos Envolvidos |
|---|---|---|---|
| **AUDIT-01** | UI / DRY | Migrar a barra de sub-abas de proventos de marcação ad-hoc com `<Button role="tab">` para o componente canônico `<Tabs variant="pills" />` (Radix UI com teclado e scroll fluido). | `src/features/investments/pages/proventos-tab.tsx`, `src/features/investments/pages/proventos-tab.test.tsx` |
| **AUDIT-02** | Operações | Adicionar o botão "Grupamento" (`reverse_split`) ao seletor de operações do `QuickTransactionSheet` e corrigir a prévia de cotas resultantes para não truncar decimais via `Math.floor`. | `src/features/investments/components/quick-transaction-sheet.tsx`, `src/features/investments/components/quick-transaction-sheet.test.tsx` |
| **AUDIT-03** | UI / Ergonomia | Padronizar o rodapé do diálogo `TransactionFormDialog` com o layout canônico de modais usando a prop `destructiveAction` para o botão de exclusão. | `src/features/investments/components/transaction-form-dialog.tsx`, `src/features/investments/components/transaction-form-dialog.test.tsx` |
| **AUDIT-04** | Usabilidade | Atualizar o rótulo do botão de eventos de cotas na ficha de detalhes `AssetDetailSheet` de "Desdobrar" para "Ajuste de Cotas", comunicando com clareza o suporte a desdobro e grupamento. | `src/features/investments/components/asset-detail-sheet.tsx` |
| **AUDIT-05** | Fiscal | Incluir sufixo "11B" na detecção de FIIs em `isFiiAsset` de `tax.ts` para garantir a apuração correta da alíquota de 20% para recibos e frações corporativas de fundos imobiliários. | `src/domain/portfolio/tax.ts`, `src/domain/portfolio/tax.test.ts` |

---

## 3. Fases de Execução

### Fase 1: Domínio & Cálculos (AUDIT-05)
- Ajustar `isFiiAsset` em `src/domain/portfolio/tax.ts` para reconhecer `upperTicker.endsWith("11B")`.
- Adicionar testes correspondentes em `src/domain/portfolio/tax.test.ts`.

### Fase 2: Operações Rápidas & Precisão Fracionária (AUDIT-02 & AUDIT-04)
- Incluir `reverse_split` em `operations` do `quick-transaction-sheet.tsx`.
- Corrigir a prévia de cotas para `Math.round((targetAsset.quantity / splitFactor) * 10000) / 10000`.
- Atualizar o rótulo do botão em `asset-detail-sheet.tsx`.

### Fase 3: Conformidade de UI & Acessibilidade (AUDIT-01 & AUDIT-03)
- Substituir botões crus por `<Tabs />` em `proventos-tab.tsx`.
- Padronizar `<ModalFooter>` em `transaction-form-dialog.tsx`.

### Fase 4: Quality Gates & Verificação
- Rodar `npx vitest run src/domain/portfolio/ src/features/investments/`.
- Rodar `npx tsc -b`.
- Rodar `npm run lint`.
- Rodar `npm run build`.
- Atualizar `ROADMAP.md` e bump de versão para 3.6.3 (Build 62).
- Commit, push e notificação Telegram.
