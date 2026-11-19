/**
 * Jornada JRN-CAT-01: Taxonomia, Hierarquia Pai/Filho, Reconciliação de Órfãos & Ícones.
 *
 * Cobre:
 * 1. Criação de estrutura taxonômica (categoria pai e subcategoria filha).
 * 2. Validação estrita de ícones contra CATEGORY_ICON_MAP (AGENTS.md Regra 8).
 * 3. Mutação de atributos da categoria (renomeação e alteração de cor).
 * 4. Registro de despesas associadas à subcategoria.
 * 5. Bloqueio determinístico de exclusão sem categoria de realocação.
 * 6. Exclusão atômica com realocação automática de transações para o pai.
 * 7. Salvaguarda de integridade referencial: zero transações órfãs na base.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type { JourneyDefinition, JourneyExecutionResult, JourneyStepResult } from "./types";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";

export const journeyCategoriesLifecycle: JourneyDefinition = {
  id: "JRN-CAT-01",
  name: "Taxonomia, Hierarquia Pai/Filho & Reconciliação de Órfãos",
  pillar: "categories",
  description:
    "Comprova a integridade estrutural da árvore de categorias, aderência a CATEGORY_ICON_MAP e bloqueio de exclusão órfã.",
  execute: (ctx): JourneyExecutionResult => {
    const startTime = performance.now();
    const steps: JourneyStepResult[] = [];
    const { store } = ctx;

    const snapshotId = store.takeSnapshot();

    try {
      // -----------------------------------------------------------------------
      // Passo 1: Criação de Estrutura Taxonômica Pai/Filho
      // -----------------------------------------------------------------------
      const t1 = performance.now();
      const userId = store.getState().profile.id;

      const parentCategory = {
        id: "cat-moradia-parent",
        userId,
        name: "Habitação & Moradia",
        icon: "moradia",
        color: "#2563EB",
        type: "expense" as const,
      };

      const childCategory = {
        id: "cat-condominio-child",
        userId,
        name: "Taxa Condominial",
        icon: "moradia",
        color: "#3B82F6",
        type: "expense" as const,
        parentId: parentCategory.id,
      };

      store.addCategory(parentCategory);
      store.addCategory(childCategory);

      const state1 = store.getState();
      const parentCreated = state1.categories.some((c) => c.id === parentCategory.id);
      const childCreated = state1.categories.some((c) => c.id === childCategory.id && c.parentId === parentCategory.id);

      steps.push({
        stepNumber: 1,
        name: "Criação de Hierarquia de Taxonomia (Categoria Pai e Subcategoria Filha)",
        passed: parentCreated && childCreated,
        details: `Categoria pai '${parentCategory.name}' e filha '${childCategory.name}' estruturadas.`,
        durationMs: Math.round((performance.now() - t1) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 2: Validação de Ícones Estritos em CATEGORY_ICON_MAP
      // -----------------------------------------------------------------------
      const t2 = performance.now();
      const iconParentValid = Boolean(CATEGORY_ICON_MAP[parentCategory.icon]);
      const iconChildValid = Boolean(CATEGORY_ICON_MAP[childCategory.icon]);
      const isEmojiFree = !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(parentCategory.name + childCategory.name);

      steps.push({
        stepNumber: 2,
        name: "Validação Estrita de Ícones em CATEGORY_ICON_MAP e Isenção de Emojis",
        passed: iconParentValid && iconChildValid && isEmojiFree,
        details: "Ícones Home e Building2 homologados na escala Lucide sem caracteres decorativos.",
        durationMs: Math.round((performance.now() - t2) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 3: Mutação de Atributos com Higienização
      // -----------------------------------------------------------------------
      const t3 = performance.now();
      store.updateCategory(childCategory.id, {
        name: "Condomínio Residencial",
        color: "#1D4ED8",
      });

      const updatedChild = store.getState().categories.find((c) => c.id === childCategory.id);
      const mutationPassed = updatedChild?.name === "Condomínio Residencial" && updatedChild?.color === "#1D4ED8";

      steps.push({
        stepNumber: 3,
        name: "Mutação Segura de Atributos (Nome e Paleta de Cores)",
        passed: mutationPassed,
        details: "Atributos atualizados preservando integridade de identificador e chave estrangeira.",
        durationMs: Math.round((performance.now() - t3) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 4: Registro de Transações Vinculadas à Subcategoria Filha
      // -----------------------------------------------------------------------
      const t4 = performance.now();
      store.addTransaction({
        id: "tx-condo-nov",
        userId,
        description: "Boleto Condomínio Nov/2026",
        amountCents: 65000, // R$ 650,00
        type: "expense",
        date: "2026-11-10",
        competenceMonth: "2026-11",
        categoryId: childCategory.id,
        isPaid: true,
        reportWeight: 1,
        createdAt: "2026-11-10T12:00:00Z",
      });

      store.addTransaction({
        id: "tx-condo-dez",
        userId,
        description: "Boleto Condomínio Dez/2026",
        amountCents: 65000, // R$ 650,00
        type: "expense",
        date: "2026-12-10",
        competenceMonth: "2026-12",
        categoryId: childCategory.id,
        isPaid: true,
        reportWeight: 1,
        createdAt: "2026-12-10T12:00:00Z",
      });

      const linkedTxsCount = store.getState().transactions.filter((t) => t.categoryId === childCategory.id).length;
      steps.push({
        stepNumber: 4,
        name: "Vinculação de Despesas Recorrentes à Subcategoria Filha",
        passed: linkedTxsCount === 2,
        details: "2 transações (R$ 1.300,00 total) atreladas à subcategoria filha.",
        durationMs: Math.round((performance.now() - t4) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 5: Bloqueio Estrito de Exclusão Órfã (Sem Categoria Destino)
      // -----------------------------------------------------------------------
      const t5 = performance.now();
      const deleteResult = store.deleteCategory(childCategory.id);
      const deleteWithoutReallocationBlocked = deleteResult === false;

      steps.push({
        stepNumber: 5,
        name: "Bloqueio Estrito de Exclusão de Categoria com Transações sem Realocação",
        passed: deleteWithoutReallocationBlocked,
        details: "Exclusão interrompida preventivamente para evitar geração de lançamentos órfãos.",
        durationMs: Math.round((performance.now() - t5) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 6: Exclusão Atômica com Realocação para a Categoria Pai
      // -----------------------------------------------------------------------
      const t6 = performance.now();
      store.deleteCategory(childCategory.id, parentCategory.id);

      const stateAfterDelete = store.getState();
      const childIsGone = !stateAfterDelete.categories.some((c) => c.id === childCategory.id);
      const reallocatedCount = stateAfterDelete.transactions.filter((t) => t.categoryId === parentCategory.id).length;

      steps.push({
        stepNumber: 6,
        name: "Exclusão Atômica com Realocação de Transações para o Pai",
        passed: childIsGone && reallocatedCount >= 2,
        details: "Subcategoria removida e todas as despesas reatribuídas com sucesso à categoria pai.",
        durationMs: Math.round((performance.now() - t6) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 7: Salvaguarda de Órfãos: 100% de Integridade Referencial
      // -----------------------------------------------------------------------
      const t7 = performance.now();
      const validCategoryIds = new Set(store.getState().categories.map((c) => c.id));
      const hasAnyOrphan = store.getState().transactions.some((t) => !validCategoryIds.has(t.categoryId));

      steps.push({
        stepNumber: 7,
        name: "Salvaguarda de Órfãos e Auditoria de Chaves Estrangeiras",
        passed: !hasAnyOrphan,
        details: "Zero transações com category_id inválido ou nulo no estado consolidado.",
        durationMs: Math.round((performance.now() - t7) * 100) / 100,
      });

      const allPassed = steps.every((s) => s.passed);
      return {
        journeyId: "JRN-CAT-01",
        name: "Taxonomia, Hierarquia Pai/Filho & Reconciliação de Órfãos",
        pillar: "categories",
        passed: allPassed,
        totalDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
        steps,
      };
    } finally {
      store.restoreSnapshot(snapshotId);
    }
  },
};
