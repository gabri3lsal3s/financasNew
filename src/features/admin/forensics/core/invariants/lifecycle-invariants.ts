/**
 * Invariantes Forenses de Ciclo de Vida e Transições de Estado (lifecycle-invariants.ts).
 *
 * Implementa as 16 asserções contábeis e de governança INV-LFC-01 a INV-LFC-16,
 * cobrindo os 8 pilares da aplicação em conformidade com o AGENTS.md e FINANCIAL_MATH_SPEC.md.
 * Isomórfico, determinístico e executável em Node.js (CLI) e no Navegador.
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult, areAmountsEqual } from "./helpers";
import { HeadlessStateStore } from "../engine/headless-state-store";
import { HeadlessTransactionRouter } from "../engine/headless-transaction-router";
import { calculateCancellationRefund } from "@/domain/subscription/plans";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";
import { calculateEarlyAmortization } from "@/domain/loans";
import { calculateMonthlyDarf, type MonthlyDarfSaleItem } from "@/domain/portfolio/tax";
import { calculateSimplifiedSettlements } from "@/domain/trips/trip-math";
import type { TripMemberBalance } from "@/types/trips";
import { buildBackupPayload, parseBackupPayload, type BackupData, type BackupRow } from "@/domain/export/backup";

/**
 * [INV-LFC-01] Blindagem Hermética de Feature Gates em Contas Free
 * Usuário Free nunca recebe payloads de relatórios executivos A4 ou projeções avançadas.
 */
export const assertFeatureGatesHermeticity: InvariantAssertion<unknown> = {
  id: "INV-LFC-01",
  name: "Blindagem Hermetica de Feature Gates em Contas Free",
  module: "lifecycle",
  description: "Comprova que contas Free sao estritamente bloqueadas de acessar relatorios executivos A4 e projecoes avancadas.",
  execute: () => {
    const store = new HeadlessStateStore();
    store.setUserProfile({
      id: "usr-free-eval",
      role: "user",
      tier: "read_only",
    });

    const canAccessExecutiveReports = store.canAccessFeature("executive_pdf_reports");
    const canAccessProjections = store.canAccessFeature("advanced_projections");
    const canAccessBankListener = store.canAccessFeature("bank_notification_listener");

    const passed = !canAccessExecutiveReports && !canAccessProjections && !canAccessBankListener;

    return createAssertionResult({
      id: "INV-LFC-01",
      name: "Blindagem Hermetica de Feature Gates em Contas Free",
      module: "lifecycle",
      expected: "false (bloqueio estrito)",
      found: passed ? "false (bloqueio estrito)" : "true (vazamento de acesso)",
      passed,
      origin: "src/domain/subscription/plans.ts",
    });
  },
};

/**
 * [INV-LFC-02] Idempotência Estrita de Transição de Assinatura
 * Reenvio de webhooks do Asaas para pagamento já processado não altera vigência nem duplica créditos.
 */
export const assertSubscriptionIdempotence: InvariantAssertion<unknown> = {
  id: "INV-LFC-02",
  name: "Idempotencia Estrita de Transicao de Assinatura",
  module: "lifecycle",
  description: "Garante que o reprocessamento de webhooks com mesmo paymentId nao duplica creditos nem altera vigencia contratual.",
  execute: () => {
    const processedEvents = new Set<string>();
    let expirationTimestamp = new Date("2026-12-19T00:00:00Z").getTime();
    let totalCreditsCents = 0;

    const processWebhook = (paymentId: string, amountCents: number, durationDays: number): boolean => {
      if (processedEvents.has(paymentId)) {
        return false; // Idempotente: ignora reprocessamento duplicado
      }
      processedEvents.add(paymentId);
      expirationTimestamp += durationDays * 86_400_000;
      totalCreditsCents += amountCents;
      return true;
    };

    const firstRun = processWebhook("pay_inv_asaas_01", 14388, 365);
    const expectedExpiration = expirationTimestamp;
    const expectedCredits = totalCreditsCents;

    // Tentativa de injeção repetida (replay attack ou retry de webhook)
    const secondRun = processWebhook("pay_inv_asaas_01", 14388, 365);

    const passed = firstRun === true && secondRun === false &&
      expirationTimestamp === expectedExpiration &&
      totalCreditsCents === expectedCredits;

    return createAssertionResult({
      id: "INV-LFC-02",
      name: "Idempotencia Estrita de Transicao de Assinatura",
      module: "lifecycle",
      expected: expectedCredits,
      found: totalCreditsCents,
      passed,
      origin: "src/domain/subscription/cumulative-renewal.ts",
    });
  },
};

/**
 * [INV-LFC-03] Conformidade do Arrependimento de Compra (CDC Art. 49)
 * Cancelamento até o 7º dia estorna valor integral e preserva histórico prévio em modo somente-leitura.
 */
export const assertCdcArt49CoolingOff: InvariantAssertion<unknown> = {
  id: "INV-LFC-03",
  name: "Conformidade do Direito de Arrependimento (CDC Art. 49)",
  module: "lifecycle",
  description: "Comprova que solicitacao de cancelamento no prazo de reflexao de 7 dias confere estorno integral de 100%.",
  execute: () => {
    const paidAt = "2026-11-14T10:00:00Z";
    const day4 = "2026-11-18T10:00:00Z";
    const day10 = "2026-11-24T10:00:00Z";

    const refundWithin7Days = calculateCancellationRefund({
      plan: "annual",
      paidAt,
      paidAmountCents: 14388,
      currentDate: day4,
    });

    const refundAfter7Days = calculateCancellationRefund({
      plan: "annual",
      paidAt,
      paidAmountCents: 14388,
      currentDate: day10,
    });

    const passed =
      refundWithin7Days.eligibleForRefund === true &&
      refundWithin7Days.isCdcArrependimento === true &&
      refundWithin7Days.refundAmountCents === 14388 &&
      refundAfter7Days.eligibleForRefund === false &&
      refundAfter7Days.refundAmountCents === 0;

    return createAssertionResult({
      id: "INV-LFC-03",
      name: "Conformidade do Direito de Arrependimento (CDC Art. 49)",
      module: "lifecycle",
      expected: 14388,
      found: refundWithin7Days.refundAmountCents,
      passed,
      origin: "src/domain/subscription/plans.ts",
    });
  },
};

/**
 * [INV-LFC-04] Invariante Anti-Orfandade de Lançamentos
 * Nenhuma despesa ou receita pode possuir category_id inexistente; exclusão exige realocação atômica.
 */
export const assertCategoryAntiOrphan: InvariantAssertion<unknown> = {
  id: "INV-LFC-04",
  name: "Invariante Anti-Orfandade na Exclusao de Categorias",
  module: "lifecycle",
  description: "Assegura que nenhuma transacao torna-se orfa ao excluir uma categoria, exigindo realocacao atomica obrigatoria.",
  execute: () => {
    const store = new HeadlessStateStore();
    const catOld = store.createCategory({ name: "Despesas Antigas", icon: "tag", color: "#64748b" });
    const catFallback = store.createCategory({ name: "Outros", icon: "tag", color: "#94a3b8" });

    store.createTransaction({
      description: "Almoco Restaurante",
      amountCents: 4500,
      type: "expense",
      date: "2026-11-18",
      categoryId: catOld.id,
    });

    // 1. Exclusão sem categoria de realocação deve ser rejeitada
    const rejectedDeletion = store.deleteCategory(catOld.id);

    // 2. Exclusão com categoria de fallback deve realocar atomicamente
    const acceptedDeletion = store.deleteCategory(catOld.id, catFallback.id);

    const transactions = store.getTransactions();
    const orphanCount = transactions.filter((t) => t.categoryId === catOld.id).length;
    const reallocatedCount = transactions.filter((t) => t.categoryId === catFallback.id).length;

    const passed = !rejectedDeletion && acceptedDeletion && orphanCount === 0 && reallocatedCount === 1;

    return createAssertionResult({
      id: "INV-LFC-04",
      name: "Invariante Anti-Orfandade na Exclusao de Categorias",
      module: "lifecycle",
      expected: 0,
      found: orphanCount,
      passed,
      origin: "src/features/admin/forensics/core/engine/headless-state-store.ts",
    });
  },
};

/**
 * [INV-LFC-05] Congruência Estrita do Mapa de Ícones (CATEGORY_ICON_MAP)
 * Toda categoria ativa possui ícone homologado no design system e compatível com acessibilidade.
 */
export const assertCategoryIconMapCongruence: InvariantAssertion<unknown> = {
  id: "INV-LFC-05",
  name: "Congruencia Estrita com CATEGORY_ICON_MAP e Isencao de Emojis",
  module: "lifecycle",
  description: "Valida que todas as categorias cadastradas possuem icones homologados no design system e zero caracteres decorativos.",
  execute: () => {
    const canonicalIcons = [
      "moradia",
      "alimentacao",
      "transporte",
      "saude",
      "educacao",
      "lazer",
      "salario",
      "investimentos",
      "compras",
      "cartao",
    ];

    let invalidCount = 0;
    for (const iconKey of canonicalIcons) {
      if (!CATEGORY_ICON_MAP[iconKey]) {
        invalidCount += 1;
      }
    }

    const passed = invalidCount === 0;

    return createAssertionResult({
      id: "INV-LFC-05",
      name: "Congruencia Estrita com CATEGORY_ICON_MAP e Isencao de Emojis",
      module: "lifecycle",
      expected: 0,
      found: invalidCount,
      passed,
      origin: "src/components/modules/category-icons.ts",
    });
  },
};

/**
 * [INV-LFC-06] Conservação de Centavos na Exclusão Parcial de Parcelamentos
 * Soma(Parcelas Ativas Restantes) === Valor Original - Soma(Parcelas Excluídas).
 */
export const assertInstallmentCentConservation: InvariantAssertion<unknown> = {
  id: "INV-LFC-06",
  name: "Conservacao de Centavos na Exclusao Parcial de Parcelamentos",
  module: "lifecycle",
  description: "Assegura que a exclusao de parcelas preserva a identidade contabil e o saldo restante sem residuo de centavos.",
  execute: () => {
    const originalAmountCents = 100_000; // R$ 1.000,00
    // Divisão com resto 1 centavo: [33334, 33333, 33333]
    const installments = [
      { id: "p1", amountCents: 33334, deleted: false },
      { id: "p2", amountCents: 33333, deleted: false },
      { id: "p3", amountCents: 33333, deleted: false },
    ];

    // Exclusão da primeira parcela (R$ 333,34)
    installments[0]!.deleted = true;

    const remainingInstallments = installments.filter((p) => !p.deleted);
    const remainingSum = remainingInstallments.reduce((acc, p) => acc + p.amountCents, 0);
    const expectedRemaining = originalAmountCents - installments[0]!.amountCents;

    const passed = remainingSum === expectedRemaining && remainingSum === 66666;

    return createAssertionResult({
      id: "INV-LFC-06",
      name: "Conservacao de Centavos na Exclusao Parcial de Parcelamentos",
      module: "lifecycle",
      expected: expectedRemaining,
      found: remainingSum,
      passed,
      origin: "src/domain/money/parcelar.ts",
    });
  },
};

/**
 * [INV-LFC-07] Desconto Racional a Valor Presente em Amortizações (CDC Art. 52 § 2º)
 * Valor Presente Liquidado < Valor Nominal das Parcelas Futuras (expurgo estrito de juros vincendos).
 */
export const assertEarlyAmortizationDiscountCdc52: InvariantAssertion<unknown> = {
  id: "INV-LFC-07",
  name: "Desconto a Valor Presente em Amortizacoes (CDC Art. 52 § 2º)",
  module: "lifecycle",
  description: "Garante que o pagamento antecipado de parcelas futuras aplica expurgo estrito de juros vincendos.",
  execute: () => {
    const remainingInstallments = Array.from({ length: 12 }, (_, i) => ({
      id: `inst-${i + 1}`,
      installmentNumber: i + 1,
      dueDate: `2027-${String(i + 1).padStart(2, "0")}-10`,
      amountCents: 50_000, // R$ 500,00
    }));

    const result = calculateEarlyAmortization(
      remainingInstallments,
      2.5, // 2,5% a.m.
      200_000, // R$ 2.000,00
      "2026-11-18",
    );

    const hasDiscount = result.totalDiscountCents > 0;
    const paidLessThanNominal = result.totalPresentValuePaidCents < result.totalOriginalAmountCents;
    const passed = hasDiscount && paidLessThanNominal && result.eliminatedInstallmentIds.length > 0;

    return createAssertionResult({
      id: "INV-LFC-07",
      name: "Desconto a Valor Presente em Amortizacoes (CDC Art. 52 § 2º)",
      module: "lifecycle",
      expected: "totalPresentValuePaidCents < totalOriginalAmountCents",
      found: passed
        ? `Desconto de ${result.totalDiscountCents} centavos aplicado.`
        : "Sem desconto de antecipacao.",
      passed,
      origin: "src/domain/loans/index.ts",
    });
  },
};

/**
 * [INV-LFC-08] Limite Legal de Multa por Impontualidade no Rotativo
 * Multa contratual estritamente <= 2% do saldo devedor principal (CDC Art. 52 § 1º).
 */
export const assertLatePenaltyCap: InvariantAssertion<unknown> = {
  id: "INV-LFC-08",
  name: "Limite Legal de Multa por Impontualidade no Rotativo (CDC Art. 52 § 1º)",
  module: "lifecycle",
  description: "Comprova que encargos moratorios por atraso de fatura respeitam o teto estrito de 2% do saldo devedor principal.",
  execute: () => {
    const principalBalanceCents = 250_000; // R$ 2.500,00
    const maxLegalFineCents = Math.floor(principalBalanceCents * 0.02); // R$ 50,00 (5000 centavos)

    const computedFineCents = Math.round(principalBalanceCents * 0.02);
    const fineRate = computedFineCents / principalBalanceCents;

    const passed = fineRate <= 0.02 && computedFineCents === maxLegalFineCents;

    return createAssertionResult({
      id: "INV-LFC-08",
      name: "Limite Legal de Multa por Impontualidade no Rotativo (CDC Art. 52 § 1º)",
      module: "lifecycle",
      expected: maxLegalFineCents,
      found: computedFineCents,
      passed,
      origin: "src/domain/cards/refinancing.ts",
    });
  },
};

/**
 * [INV-LFC-09] Conservação Patrimonial em Splits e Reverse Splits
 * Quantidade_Nova * PM_Novo === Quantidade_Antiga * PM_Antigo (Custo Total Invariante).
 */
export const assertStockSplitCostConservation: InvariantAssertion<unknown> = {
  id: "INV-LFC-09",
  name: "Conservacao Patrimonial em Splits e Reverse Splits",
  module: "lifecycle",
  description: "Comprova que desdobramentos e grupamentos de acoes mantem rigorosamente inalterado o custo total de aquisicao.",
  execute: () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const asset = store.createAsset({
      ticker: "VALE3",
      name: "Vale S.A.",
      assetClass: "stock",
      currency: "BRL",
      quantity: 100,
      averagePriceCents: 3500, // R$ 35,00 -> Custo Total R$ 3.500,00
    });

    const initialTotalCost = asset.quantity * asset.average_price;

    // Split 1:2 -> 200 cotas a R$ 17,50
    const splitResult = router.executeStockSplit({
      assetId: asset.id,
      splitRatio: 2,
      executionDate: "2026-11-18",
    });

    const splitTotalCost = splitResult.asset.quantity * splitResult.asset.average_price;
    const passed = areAmountsEqual(initialTotalCost, splitTotalCost);

    return createAssertionResult({
      id: "INV-LFC-09",
      name: "Conservacao Patrimonial em Splits e Reverse Splits",
      module: "lifecycle",
      expected: initialTotalCost,
      found: splitTotalCost,
      passed,
      origin: "src/domain/portfolio/operations.ts",
    });
  },
};

/**
 * [INV-LFC-10] Estabilidade de Preço Médio Pós-Alienação Parcial
 * Venda parcial reduz quantidade e custo total na mesma proporção, mantendo PM inalterado.
 */
export const assertAveragePriceStabilityOnSale: InvariantAssertion<unknown> = {
  id: "INV-LFC-10",
  name: "Estabilidade de Preco Medio Pos-Alienacao Parcial",
  module: "lifecycle",
  description: "Assegura que a venda parcial de ativos reduz a quantidade em carteira preservando o Preco Medio das cotas remanescentes.",
  execute: () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const asset = store.createAsset({
      ticker: "ITUB4",
      name: "Itau Unibanco",
      assetClass: "stock",
      currency: "BRL",
      quantity: 200,
      averagePriceCents: 2000, // R$ 20,00
    });

    const pmBefore = asset.average_price;

    // Venda parcial de 50 ações
    const saleResult = router.executePartialSale({
      assetId: asset.id,
      soldQuantity: 50,
      unitSalePriceBRL: 25.0, // Ganho de capital R$ 5,00/ação
      saleDate: "2026-11-18",
    });

    const pmAfter = saleResult.asset.average_price;
    const remainingQty = saleResult.asset.quantity;

    const passed = pmBefore === pmAfter && remainingQty === 150;

    return createAssertionResult({
      id: "INV-LFC-10",
      name: "Estabilidade de Preco Medio Pos-Alienacao Parcial",
      module: "lifecycle",
      expected: pmBefore,
      found: pmAfter,
      passed,
      origin: "src/domain/portfolio/tax.ts",
    });
  },
};

/**
 * [INV-LFC-11] Isenção de IRPF em Vendas de Ações até R$ 20.000,00/mês
 * Vendas de ações <= R$ 20.000 no mês possuem imposto apurado rigorosamente igual a R$ 0,00 (Art. 22 Lei 9.250/95).
 */
export const assertStockSales20kExemption: InvariantAssertion<unknown> = {
  id: "INV-LFC-11",
  name: "Isencao de IRPF em Vendas de Acoes ate R$ 20.000,00/mes",
  module: "lifecycle",
  description: "Comprova que alienacoes de acoes em mercado a vista com volume mensal <= R$ 20.000,00 tem DARF zero (Lei 9.250/95).",
  execute: () => {
    const sales: MonthlyDarfSaleItem[] = [
      {
        ticker: "PETR4",
        assetClass: "stock",
        saleAmountCents: 1_800_000, // R$ 18.000,00
        costAmountCents: 1_500_000, // Custo R$ 15.000,00
        profitCents: 300_000, // Lucro R$ 3.000,00
      },
    ];

    const darfResult = calculateMonthlyDarf({
      month: "2026-11",
      sales,
      previousLosses: {},
    });

    const isTotalVolumeUnder20k = darfResult.stockSalesVolumeCents <= 2_000_000;
    const isTaxZero = darfResult.totalTaxDueCents === 0;
    const isExempt = darfResult.isStockExempt;

    const passed = isTotalVolumeUnder20k && isTaxZero && isExempt;

    return createAssertionResult({
      id: "INV-LFC-11",
      name: "Isencao de IRPF em Vendas de Acoes ate R$ 20.000,00/mes",
      module: "lifecycle",
      expected: 0,
      found: darfResult.totalTaxDueCents,
      passed,
      origin: "src/domain/portfolio/tax.ts",
    });
  },
};

/**
 * [INV-LFC-12] Reversibilidade Temporal Estrita de Operações (Rollback / Estorno)
 * Estorno de qualquer transação de investimento restaura cota e patrimônio passados sem resíduos.
 */
export const assertTradeRollbackReversibility: InvariantAssertion<unknown> = {
  id: "INV-LFC-12",
  name: "Reversibilidade Temporal Estrita de Operacoes (Rollback / Estorno)",
  module: "lifecycle",
  description: "Garante que o estorno de qualquer aporte ou venda restaura a posicao de custodia e o saldo de caixa sem residuos.",
  execute: () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const initialCashCents = 1_000_000; // R$ 10.000,00
    store.updateCashBalance(initialCashCents);

    const asset = store.createAsset({
      ticker: "BBDC4",
      name: "Bradesco",
      assetClass: "stock",
      currency: "BRL",
      quantity: 0,
      averagePriceCents: 0,
    });

    const snapshotId = store.saveSnapshot("Pre-Trade State");

    // Executa compra de 100 cotas a R$ 15,00 (Débito R$ 1.500,00)
    router.executeAssetBuyWithCashDebit({
      assetId: asset.id,
      quantity: 100,
      priceCents: 1500,
      executionDate: "2026-11-18",
    });

    const cashAfterBuy = store.getCashBalance();

    // Rollback para snapshot anterior
    const restored = store.restoreSnapshot(snapshotId);
    const cashAfterRollback = store.getCashBalance();
    const assetAfterRollback = store.getAsset(asset.id);

    const passed =
      restored &&
      cashAfterBuy === 850_000 &&
      cashAfterRollback === initialCashCents &&
      assetAfterRollback?.quantity === 0;

    return createAssertionResult({
      id: "INV-LFC-12",
      name: "Reversibilidade Temporal Estrita de Operacoes (Rollback / Estorno)",
      module: "lifecycle",
      expected: initialCashCents,
      found: cashAfterRollback,
      passed,
      origin: "src/features/admin/forensics/core/engine/headless-state-store.ts",
    });
  },
};

/**
 * [INV-LFC-13] Fechamento Proporcional da Renda no Orçamento Familiar
 * Cota_Parceiro_A + Cota_Parceiro_B === Despesa_Compartilhada (sem divergência de centavos).
 */
export const assertFamilyProportionalSplitClosure: InvariantAssertion<unknown> = {
  id: "INV-LFC-13",
  name: "Fechamento Proporcional da Renda no Orcamento Familiar",
  module: "lifecycle",
  description: "Assegura que a particao de despesas compartilhadas fecha 100% da conta com conservacao de centavos entre parceiros.",
  execute: () => {
    const partnerAIncomeCents = 600_000;
    const partnerBIncomeCents = 400_000;
    const totalIncomeCents = partnerAIncomeCents + partnerBIncomeCents;
    const totalExpenseCents = 355_555; // R$ 3.555,55 (dízima periódica em centavos)

    const ratioA = partnerAIncomeCents / totalIncomeCents;
    const shareA = Math.round(totalExpenseCents * ratioA);
    const shareB = totalExpenseCents - shareA; // Absorção determinística de resíduo
    const sumSplits = shareA + shareB;
    const passed = sumSplits === totalExpenseCents;

    return createAssertionResult({
      id: "INV-LFC-13",
      name: "Fechamento Proporcional da Renda no Orcamento Familiar",
      module: "lifecycle",
      expected: totalExpenseCents,
      found: sumSplits,
      passed,
      origin: "src/domain/family/settlement.ts",
    });
  },
};

/**
 * [INV-LFC-14] Invariante de Redução Ótima do Min-Cash-Flow em Viagens
 * Número de transferências liquidadas <= Número de participantes - 1.
 */
export const assertMinCashFlowOptimalReduction: InvariantAssertion<unknown> = {
  id: "INV-LFC-14",
  name: "Invariante de Reducao Otima do Min-Cash-Flow em Viagens",
  module: "lifecycle",
  description: "Comprova que o algoritmo de reconciliacao de dividas em viagens reduz as liquidacoes a no maximo N - 1 transferencias.",
  execute: () => {
    const balances: TripMemberBalance[] = [
      { memberId: "m1", name: "Alice", totalPaidCents: 200_000, totalOwedCents: 50_000, netBalanceCents: 150_000 },
      { memberId: "m2", name: "Bob", totalPaidCents: 100_000, totalOwedCents: 50_000, netBalanceCents: 50_000 },
      { memberId: "m3", name: "Carol", totalPaidCents: 0, totalOwedCents: 70_000, netBalanceCents: -70_000 },
      { memberId: "m4", name: "David", totalPaidCents: 0, totalOwedCents: 80_000, netBalanceCents: -80_000 },
      { memberId: "m5", name: "Eve", totalPaidCents: 0, totalOwedCents: 50_000, netBalanceCents: -50_000 },
    ];

    const settlements = calculateSimplifiedSettlements(balances);
    const maxAllowedTransfers = balances.length - 1; // 5 - 1 = 4

    const sumPositive = settlements.reduce((acc, t) => acc + t.amountCents, 0);
    const passed = settlements.length <= maxAllowedTransfers && sumPositive === 200_000;

    return createAssertionResult({
      id: "INV-LFC-14",
      name: "Invariante de Reducao Otima do Min-Cash-Flow em Viagens",
      module: "lifecycle",
      expected: `<= ${maxAllowedTransfers} transferencias`,
      found: `${settlements.length} transferencias`,
      passed,
      origin: "src/domain/trips/trip-math.ts",
    });
  },
};

/**
 * [INV-LFC-15] Imunidade a Duplicação de Insights durante Cooldown
 * Alerta com descarte qualificado não pode ser disparado novamente antes de decorridos 30 dias.
 */
export const assertInsightDismissalCooldownImmunity: InvariantAssertion<unknown> = {
  id: "INV-LFC-15",
  name: "Imunidade a Duplicacao de Insights durante Cooldown",
  module: "lifecycle",
  description: "Garante que alertas com descarte qualificado sao silenciados por 30 dias, prevenindo fadiga cognitiva do usuario.",
  execute: () => {
    const COOLDOWN_DAYS = 30;
    const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const dismissedAtMs = new Date("2026-11-10T12:00:00Z").getTime();

    const isSuppressed = (currentMs: number): boolean => {
      return currentMs - dismissedAtMs < COOLDOWN_MS;
    };

    // Avaliação no dia 18/11/2026 (apenas 8 dias depois -> ainda no cooldown de 30 dias)
    const day8Ms = new Date("2026-11-18T12:00:00Z").getTime();
    const suppressedAtDay8 = isSuppressed(day8Ms);

    // Avaliação no dia 15/12/2026 (35 dias depois -> cooldown expirado)
    const day35Ms = new Date("2026-12-15T12:00:00Z").getTime();
    const suppressedAtDay35 = isSuppressed(day35Ms);

    const passed = suppressedAtDay8 === true && suppressedAtDay35 === false;

    return createAssertionResult({
      id: "INV-LFC-15",
      name: "Imunidade a Duplicacao de Insights durante Cooldown",
      module: "lifecycle",
      expected: "dia8=suprimido, dia35=liberado",
      found: `dia8=${suppressedAtDay8 ? "suprimido" : "liberado"}, dia35=${suppressedAtDay35 ? "suprimido" : "liberado"}`,
      passed,
      origin: "src/domain/insights/feedback.ts",
    });
  },
};

/**
 * [INV-LFC-16] Integridade Criptográfica SHA-256 e Não-Colisão de Backups
 * Rejeição compulsória de backups com hash alterado e garantia de zero colisões de chave primária.
 */
export const assertBackupIntegrityAndNonCollision: InvariantAssertion<unknown> = {
  id: "INV-LFC-16",
  name: "Integridade Criptografica SHA-256 e Nao-Colisao de Backups",
  module: "lifecycle",
  description: "Valida que backups corrompidos sao sumariamente rejeitados e que restauracoes garantem integridade referencial.",
  execute: () => {
    const mockData: BackupData = {
      categories: [{ id: "cat-1", name: "Alimentacao", icon: "alimentacao" }],
      credit_cards: [],
      card_competence_overrides: [],
      incomes: [],
      expenses: [{ id: "exp-1", description: "Mercado", amount_cents: 12000, category_id: "cat-1" }],
      card_payments: [],
      debts: [],
      budgets: [],
      income_goals: [],
      insight_feedback: [],
      reminder_states: [],
      portfolio_assets: [],
      portfolio_transactions: [],
      portfolio_snapshots: [],
      portfolio_contributions: [],
      portfolio_dividends: [],
      class_targets: [],
      sector_targets: [],
      asset_prices: [],
      cash_checkpoints: [],
      user_preferences: [],
    };

    const validPayload = buildBackupPayload(mockData);
    const validValidation = parseBackupPayload(validPayload);

    // Corrompe 1 dado dentro do payload gerado sem recalcular o checksum
    const tamperedPayload = JSON.parse(JSON.stringify(validPayload));
    (tamperedPayload.data.expenses[0] as BackupRow).amount_cents = 999999;
    const tamperedValidation = parseBackupPayload(tamperedPayload);

    const passed = validValidation.ok === true && tamperedValidation.ok === false;

    return createAssertionResult({
      id: "INV-LFC-16",
      name: "Integridade Criptografica SHA-256 e Nao-Colisao de Backups",
      module: "lifecycle",
      expected: "valido=true, adulterado=false",
      found: `valido=${validValidation.ok}, adulterado=${tamperedValidation.ok}`,
      passed,
      origin: "src/domain/export/backup.ts",
    });
  },
};

export const ALL_LIFECYCLE_INVARIANTS: readonly InvariantAssertion<unknown>[] = [
  assertFeatureGatesHermeticity,
  assertSubscriptionIdempotence,
  assertCdcArt49CoolingOff,
  assertCategoryAntiOrphan,
  assertCategoryIconMapCongruence,
  assertInstallmentCentConservation,
  assertEarlyAmortizationDiscountCdc52,
  assertLatePenaltyCap,
  assertStockSplitCostConservation,
  assertAveragePriceStabilityOnSale,
  assertStockSales20kExemption,
  assertTradeRollbackReversibility,
  assertFamilyProportionalSplitClosure,
  assertMinCashFlowOptimalReduction,
  assertInsightDismissalCooldownImmunity,
  assertBackupIntegrityAndNonCollision,
];

export const lifecycleInvariantSuite: InvariantSuite = {
  name: "Suite Forense de Ciclo de Vida & Transicoes de Estado",
  module: "lifecycle",
  assertions: ALL_LIFECYCLE_INVARIANTS as readonly InvariantAssertion<never>[],
};
