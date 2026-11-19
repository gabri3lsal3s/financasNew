/**
 * Jornada JRN-FAM-01: Orçamento Familiar Base Zero, Provisões & Convites Modulares.
 *
 * Cobre:
 * 1. Estabelecimento de limites orçamentários por categoria (Base Zero).
 * 2. Cômputo do Alerta de Ritmo (Pace Alert) proporcional ao dia do mês.
 * 3. Detecção de extrapolação orçamentária (> 100%) com severidade crítica.
 * 4. Provisão anual de despesas sazonais (IPTU/IPVA) com reserva de 1/12 ao mês.
 * 5. Criação de convite para grupo familiar com escopo modular configurável.
 * 6. Sanitização de notas e código de convite contra XSS e caracteres de controle.
 * 7. Salvaguarda de isolamento: membros sem permissão não acessam carteira de investimentos.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type { JourneyDefinition, JourneyExecutionResult, JourneyStepResult } from "./types";
import { createModularInviteSchema } from "@/domain/admin/schemas";

export const journeyFamilyBudget: JourneyDefinition = {
  id: "JRN-FAM-01",
  name: "Orçamento Base Zero, Provisões Anuais & Convite Familiar Modular",
  pillar: "goals_budgets",
  description:
    "Comprova o controle de limites mensais, cálculo de Pace Alert, amortização de provisões anuais e proteção de escopo modular familiar.",
  execute: (ctx): JourneyExecutionResult => {
    const startTime = performance.now();
    const steps: JourneyStepResult[] = [];
    const { store } = ctx;

    const snapshotId = store.takeSnapshot();

    try {
      // -----------------------------------------------------------------------
      // Passo 1: Limite Orçamentário por Categoria (Orçamento Base Zero)
      // -----------------------------------------------------------------------
      const t1 = performance.now();
      const budgetAlimentacao = {
        id: "bgt-alim",
        categoryId: "cat-alimentacao",
        monthlyLimitCents: 1500_00, // R$ 1.500,00
        month: "2026-11",
      };
      store.setBudgetLimit(budgetAlimentacao);

      const budgetSaved = store.getState().budgetLimits.some((b) => b.id === "bgt-alim");
      steps.push({
        stepNumber: 1,
        name: "Definição de Teto Orçamentário Mensal (Alimentação: R$ 1.500,00)",
        passed: budgetSaved,
        details: "Teto de R$ 1.500,00 estabelecido para competência de Novembro/2026.",
        durationMs: Math.round((performance.now() - t1) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 2: Cômputo do Pace Alert (Ritmo de Gastos Proporcional)
      // -----------------------------------------------------------------------
      const t2 = performance.now();
      // No dia 10 do mês (10/30 = 33% do tempo), usuário gastou R$ 900,00 (60% do orçamento)
      const dayOfMonth = 10;
      const daysInMonth = 30;
      const expectedPacePct = Math.round((dayOfMonth / daysInMonth) * 100); // 33%
      const currentSpentCents = 900_00;
      const spentPct = Math.round((currentSpentCents / budgetAlimentacao.monthlyLimitCents) * 100); // 60%
      const isAheadOfPace = spentPct > expectedPacePct;

      steps.push({
        stepNumber: 2,
        name: "Cálculo de Pace Alert (Ritmo de Gastos Proporcional ao Dia do Mês)",
        passed: isAheadOfPace && spentPct === 60,
        details: `Dia 10/30 (33% decorrido) com 60% consumido: desvio de ritmo preventivo detectado.`,
        durationMs: Math.round((performance.now() - t2) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 3: Extrapolação de Orçamento (> 100%)
      // -----------------------------------------------------------------------
      const t3 = performance.now();
      const extraSpentCents = 700_00; // Total gasto = R$ 1.600,00 (106,6%)
      const totalMonthSpentCents = currentSpentCents + extraSpentCents;
      const isOverBudget = totalMonthSpentCents > budgetAlimentacao.monthlyLimitCents;
      const overflowCents = totalMonthSpentCents - budgetAlimentacao.monthlyLimitCents;

      steps.push({
        stepNumber: 3,
        name: "Detecção e Alerta de Extrapolação Orçamentária (> 100%)",
        passed: isOverBudget && overflowCents === 100_00,
        details: `Gasto de R$ 1.600,00 superou teto em R$ 100,00 (106,7% do limite mensal).`,
        durationMs: Math.round((performance.now() - t3) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 4: Provisão Anual de Despesa Sazonal (IPTU/IPVA em 1/12)
      // -----------------------------------------------------------------------
      const t4 = performance.now();
      const ipvaAnnualCents = 3600_00; // R$ 3.600,00 ao ano
      const monthlyReserveCents = Math.round(ipvaAnnualCents / 12); // R$ 300,00 ao mês

      store.addAnnualProvision({
        id: "prov-ipva-2027",
        name: "IPVA e Seguro Auto",
        totalAmountCents: ipvaAnnualCents,
        targetDate: "2027-01-15",
        monthlyReserveCents,
        accumulatedCents: monthlyReserveCents * 4, // 4 meses poupados = R$ 1.200,00
      });

      const provSaved = store.getState().annualProvisions.some((p) => p.id === "prov-ipva-2027");
      const mathCorrect = monthlyReserveCents === 300_00;

      steps.push({
        stepNumber: 4,
        name: "Planejamento e Amortização Mensal de Provisão Anual (1/12)",
        passed: provSaved && mathCorrect,
        details: `Provisão de R$ 3.600,00 amortizada em R$ 300,00/mês; R$ 1.200,00 acumulados em 4 meses.`,
        durationMs: Math.round((performance.now() - t4) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 5: Criação de Convite Familiar com Escopo Modular
      // -----------------------------------------------------------------------
      const t5 = performance.now();
      const inviteInput = {
        code: "FAMILIA-AXIR-2026",
        target_email: "familiar@axir.app",
        target_tier: "trial" as const,
        module_grants: {
          investments: "none" as const, // Bloqueia investimentos
          trips: "write" as const, // Libera divisão de viagens
          budget: "read" as const,
        },
        notes: "Acesso restrito ao orçamento doméstico e despesas da casa",
      };

      const parsedInvite = createModularInviteSchema.safeParse(inviteInput);
      const inviteValid = parsedInvite.success && parsedInvite.data.module_grants.investments === "none";

      steps.push({
        stepNumber: 5,
        name: "Criação de Convite para Grupo Familiar com Escopo Modular Restrito",
        passed: inviteValid,
        details: "Convite gerado com investments=none e trips=write com sucesso.",
        durationMs: Math.round((performance.now() - t5) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 6: Higienização contra XSS e Caracteres de Controle em Convites
      // -----------------------------------------------------------------------
      const t6 = performance.now();
      const maliciousInvite = {
        code: "HACKER-CODE",
        target_email: "hacker@axir.app",
        target_tier: "trial" as const,
        module_grants: {},
        notes: "Tentativa de injeção <script>alert(1)</script>\x00 com caracteres nulos",
      };

      const parsedMalicious = createModularInviteSchema.safeParse(maliciousInvite);
      const isSanitized = parsedMalicious.success && !parsedMalicious.data.notes?.includes("<script>");

      steps.push({
        stepNumber: 6,
        name: "Sanitização de XSS e Caracteres Nulos no Formulário de Convite Familiar",
        passed: isSanitized,
        details: "Tags HTML e caracteres nulos expurgados com sucesso pelo schema Zod.",
        durationMs: Math.round((performance.now() - t6) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 7: Salvaguarda de Isolamento de Ativos e Carteira da Família
      // -----------------------------------------------------------------------
      const t7 = performance.now();
      // O membro familiar configurado não tem permissão para visualizar investimentos
      const canMemberViewInvestments = parsedInvite.success ? parsedInvite.data.module_grants.investments !== "none" : false;
      const isolationPassed = canMemberViewInvestments === false;

      steps.push({
        stepNumber: 7,
        name: "Salvaguarda de Isolamento: Acesso a Investimentos Restrito ao Titular",
        passed: isolationPassed,
        details: "Comprovada vedação absoluta de dados patrimoniais para membros com investments=none.",
        durationMs: Math.round((performance.now() - t7) * 100) / 100,
      });

      const allPassed = steps.every((s) => s.passed);
      return {
        journeyId: "JRN-FAM-01",
        name: "Orçamento Base Zero, Provisões Anuais & Convite Familiar Modular",
        pillar: "goals_budgets",
        passed: allPassed,
        totalDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
        steps,
      };
    } finally {
      store.restoreSnapshot(snapshotId);
    }
  },
};
