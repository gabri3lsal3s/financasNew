/**
 * Roteador de Transações e Mutações Headless (headless-transaction-router.ts).
 *
 * Executa as regras de negócio de domínio do Axir em memória volátil, simulando
 * a execução transacional de RPCs do Supabase sem efeitos colaterais de rede.
 * Conforme AGENTS.md (Funções puras, TypeScript estrito, centavos inteiros).
 */

import type { HeadlessStateStore } from "./headless-state-store";
import type { HeadlessCardPayment, HeadlessTransaction } from "./types";
import type { PortfolioAsset } from "@/types";
import { splitAmountEqually } from "@/domain/finance/split-math";
import { calculateEarlyAmortization } from "@/domain/loans";
import { calculateMemberBalances, calculateSimplifiedSettlements } from "@/domain/trips/trip-math";

export interface CreateInstallmentParams {
  userId: string;
  description: string;
  totalAmountCents: number;
  installmentsCount: number;
  categoryId: string;
  purchaseDate: string; // "YYYY-MM-DD"
  cardId?: string;
  reportWeight?: number;
}

export interface StockSaleResult {
  soldQuantity: number;
  salePrice: number;
  saleTotalBRL: number;
  costOfSoldSharesBRL: number;
  realizedPnlBRL: number;
  isTaxExempt: boolean;
  darfTaxRatePercent: number;
  darfDueBRL: number;
  remainingQuantity: number;
  remainingAveragePrice: number;
  remainingCostBRL: number;
}

export class HeadlessTransactionRouter {
  private store: HeadlessStateStore;

  constructor(store: HeadlessStateStore) {
    this.store = store;
  }

  // ---------------------------------------------------------------------------
  // 1. Lançamentos e Parcelamentos
  // ---------------------------------------------------------------------------

  public createInstallmentExpense(params: {
    description: string;
    totalAmountCents: number;
    installmentsCount: number;
    purchaseDate: string;
    categoryId: string;
    cardId?: string | null;
    userId?: string;
    reportWeight?: number;
  }): HeadlessTransaction[] {
    return this.createExpenseWithInstallments({
      userId: params.userId ?? this.store.getState().profile.id,
      description: params.description,
      totalAmountCents: params.totalAmountCents,
      installmentsCount: params.installmentsCount,
      purchaseDate: params.purchaseDate,
      categoryId: params.categoryId,
      cardId: params.cardId ?? undefined,
      reportWeight: params.reportWeight,
    });
  }

  /**
   * Lança despesa simples ou parcelada aplicando a divisão exata de centavos
   * e determinando a competência contábil com base no dia de fechamento do cartão.
   */
  public createExpenseWithInstallments(params: CreateInstallmentParams): HeadlessTransaction[] {
    const {
      userId,
      description,
      totalAmountCents,
      installmentsCount,
      categoryId,
      purchaseDate,
      cardId,
      reportWeight = 1.0,
    } = params;

    const shares = splitAmountEqually(totalAmountCents, installmentsCount, { remainderPolicy: "host" });
    const seriesId = installmentsCount > 1 ? `srs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : null;

    // Determina competência inicial com base no cartão
    let initialYear: number;
    let initialMonth: number; // 1-12

    const [pYear, pMonth, pDay] = purchaseDate.split("-").map(Number);
    initialYear = pYear ?? 2026;
    initialMonth = pMonth ?? 1;
    const purchaseDay = pDay ?? 1;

    if (cardId) {
      const card = this.store.getState().creditCards.find((c) => c.id === cardId);
      if (card) {
        // Se a data de compra for >= closing_day, entra na fatura do mês seguinte
        if (purchaseDay >= card.closingDay) {
          initialMonth += 1;
          if (initialMonth > 12) {
            initialMonth = 1;
            initialYear += 1;
          }
        }
      }
    }

    const createdTransactions: HeadlessTransaction[] = [];

    for (let i = 0; i < installmentsCount; i++) {
      let curMonth = initialMonth + i;
      let curYear = initialYear;
      while (curMonth > 12) {
        curMonth -= 12;
        curYear += 1;
      }

      const compStr = `${curYear}-${String(curMonth).padStart(2, "0")}`;
      const installmentNumber = i + 1;
      const shareCents = shares[i] ?? 0;

      const tx: HeadlessTransaction = {
        id: `tx-inst-${seriesId ?? "single"}-${installmentNumber}`,
        userId,
        type: "expense",
        amountCents: shareCents,
        description: installmentsCount > 1 ? `${description} (${installmentNumber}/${installmentsCount})` : description,
        categoryId,
        date: purchaseDate,
        competenceMonth: compStr,
        cardId: cardId ?? null,
        installmentNumber: installmentsCount > 1 ? installmentNumber : null,
        installmentTotal: installmentsCount > 1 ? installmentsCount : null,
        installmentSeriesId: seriesId,
        isPaid: false,
        reportWeight,
        createdAt: new Date().toISOString(),
      };

      createdTransactions.push(tx);
    }

    this.store.addTransactionsBatch(createdTransactions);
    return createdTransactions;
  }

  // ---------------------------------------------------------------------------
  // 2. Faturas de Cartão de Crédito
  // ---------------------------------------------------------------------------

  public payInvoice(params: {
    cardId: string;
    competenceMonth: string;
    amountPaidCents: number;
    paymentDate: string;
  }): HeadlessCardPayment {
    const payment: HeadlessCardPayment = {
      id: `pmt-inv-${params.cardId}-${params.competenceMonth}`,
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      amountPaidCents: params.amountPaidCents,
      paymentDate: params.paymentDate,
    };

    this.store.addCardPayment(payment);

    // Marca transações da fatura como pagas
    const txs = this.store
      .getState()
      .transactions.filter((t) => t.cardId === params.cardId && t.competenceMonth === params.competenceMonth);
    for (const t of txs) {
      t.isPaid = true;
    }

    return payment;
  }

  // ---------------------------------------------------------------------------
  // 3. Empréstimos e Amortização Antecipada CDC 52
  // ---------------------------------------------------------------------------

  /**
   * Executa amortização antecipada de empréstimo quitando parcelas de trás para frente
   * com desconto a valor presente dos juros vincendos (Art. 52 § 2º do CDC).
   */
  public amortizeLoanEarlyCDC52(params: {
    loanId: string;
    targetPaymentCents: number;
    referenceDateIso: string;
  }) {
    const state = this.store.getState();
    const loan = state.loans.find((l) => l.id === params.loanId);
    if (!loan) throw new Error("Contrato de empréstimo não encontrado.");

    const remainingInstallments = loan.installments.filter((i) => !i.isPaid);

    const amortizationResult = calculateEarlyAmortization(
      remainingInstallments.map((i) => ({
        id: String(i.number),
        installmentNumber: i.number,
        amountCents: i.totalInstallmentCents,
        dueDate: i.dueDate,
      })),
      loan.monthlyInterestRatePercent,
      params.targetPaymentCents,
      params.referenceDateIso,
    );

    // Marca as parcelas quitadas antecipadamente (do fim para o início)
    const paidNumbers = new Set(amortizationResult.eliminatedInstallmentIds.map(Number));
    const updatedInstallments = loan.installments.map((inst) => {
      if (paidNumbers.has(inst.number)) {
        return { ...inst, isPaid: true };
      }
      return inst;
    });

    this.store.updateLoan(loan.id, { installments: updatedInstallments });
    return amortizationResult;
  }

  // ---------------------------------------------------------------------------
  // 4. Investimentos e Custódia (Splits, Venda Parcial e Tributação)
  // ---------------------------------------------------------------------------

  /**
   * Registra aporte/compra de ativo em carteira e debita sincronizadamente o saldo em Caixa.
   */
  public recordAssetPurchase(params: {
    assetId: string;
    ticker: string;
    assetClass: string;
    quantity: number;
    unitPriceBRL: number;
    transactionDate: string;
  }): { asset: PortfolioAsset; costBRL: number } {
    const state = this.store.getState();
    const costBRL = Math.round(params.quantity * params.unitPriceBRL * 100) / 100;
    const costCents = Math.round(costBRL * 100);

    // Debita o saldo em Caixa
    this.store.setCashBalanceCents(state.cashBalanceCents - costCents);

    const existing = state.assets.find((a) => a.id === params.assetId);
    let updatedAsset: PortfolioAsset;

    if (existing) {
      const existingCost = existing.quantity * existing.average_price;
      const newQty = Math.round((existing.quantity + params.quantity) * 1000000) / 1000000;
      const newAvgPrice = Math.round(((existingCost + costBRL) / newQty) * 10000) / 10000;
      this.store.updateAsset(params.assetId, {
        quantity: newQty,
        average_price: newAvgPrice,
      });
      updatedAsset = { ...existing, quantity: newQty, average_price: newAvgPrice };
    } else {
      updatedAsset = {
        id: params.assetId,
        user_id: state.profile.id,
        ticker: params.ticker,
        asset_class: params.assetClass,
        quantity: params.quantity,
        average_price: params.unitPriceBRL,
        currency: "BRL",
        updated_at: new Date().toISOString(),
      };
      this.store.addAsset(updatedAsset);
    }

    return { asset: updatedAsset, costBRL };
  }

  /**
   * Executa evento corporativo de desdobramento (Split) ou grupamento (Reverse Split),
   * garantindo a conservação estrita do Custo Total da Posição (Q * PM invariante).
   */
  public executeStockSplit(
    assetIdOrParams: string | { assetId: string; splitRatio: number; executionDate?: string },
    ratioArg?: number,
  ): { asset: PortfolioAsset; costTotalAfterBRL: number } {
    const assetId = typeof assetIdOrParams === "string" ? assetIdOrParams : assetIdOrParams.assetId;
    const ratio = typeof assetIdOrParams === "string" ? (ratioArg ?? 1) : assetIdOrParams.splitRatio;

    if (ratio <= 0) throw new Error("Razão de split deve ser estritamente positiva.");

    const state = this.store.getState();
    const asset = state.assets.find((a) => a.id === assetId);
    if (!asset) throw new Error("Ativo não encontrado.");

    const oldTotalCost = asset.quantity * asset.average_price;
    const newQuantity = Math.round(asset.quantity * ratio * 1000000) / 1000000;
    const newAveragePrice = Math.round((oldTotalCost / newQuantity) * 10000) / 10000;

    this.store.updateAsset(assetId, {
      quantity: newQuantity,
      average_price: newAveragePrice,
    });

    const updated = this.store.getState().assets.find((a) => a.id === assetId)!;
    return {
      asset: updated,
      costTotalAfterBRL: Math.round(newQuantity * newAveragePrice * 100) / 100,
    };
  }

  /**
   * Executa alienação parcial de ações/FIIs, apurando ganho de capital,
   * checando a faixa de isenção de R$ 20.000,00/mês para ações e conservando o PM remanescente.
   */
  public executeStockSaleWithTax(params: {
    assetId: string;
    soldQuantity: number;
    salePrice: number;
    saleDate: string;
    monthlySalesVolumePriorBRL?: number;
  }): StockSaleResult {
    const { assetId, soldQuantity, salePrice, monthlySalesVolumePriorBRL = 0 } = params;

    const state = this.store.getState();
    const asset = state.assets.find((a) => a.id === assetId);
    if (!asset) throw new Error("Ativo não encontrado.");
    if (soldQuantity > asset.quantity) throw new Error("Venda a descoberto proibida (quantidade insuficiente).");

    const pm = asset.average_price;
    const saleTotalBRL = Math.round(soldQuantity * salePrice * 100) / 100;
    const costOfSoldSharesBRL = Math.round(soldQuantity * pm * 100) / 100;
    const realizedPnlBRL = Math.round((saleTotalBRL - costOfSoldSharesBRL) * 100) / 100;

    // Regra Fiscal (Art. 22 Lei 9.250/95 para Ações vs FIIs 20%):
    const totalMonthSales = monthlySalesVolumePriorBRL + saleTotalBRL;
    const isFII = (asset.asset_class || "").toLowerCase().includes("fii");
    let isTaxExempt: boolean;
    let darfTaxRatePercent: number;
    let darfDueBRL = 0;

    if (isFII) {
      isTaxExempt = false;
      darfTaxRatePercent = 20.0;
      if (realizedPnlBRL > 0) {
        darfDueBRL = Math.round(realizedPnlBRL * 0.20 * 100) / 100;
      }
    } else {
      // Ações brasileiras
      if (totalMonthSales <= 20000.0) {
        isTaxExempt = true;
        darfTaxRatePercent = 0.0;
        darfDueBRL = 0.0;
      } else {
        isTaxExempt = false;
        darfTaxRatePercent = 15.0;
        if (realizedPnlBRL > 0) {
          darfDueBRL = Math.round(realizedPnlBRL * 0.15 * 100) / 100;
        }
      }
    }

    const remainingQuantity = Math.round((asset.quantity - soldQuantity) * 1000000) / 1000000;
    const remainingCostBRL = Math.round(remainingQuantity * pm * 100) / 100;

    this.store.updateAsset(assetId, {
      quantity: remainingQuantity,
      average_price: pm, // Preço médio das cotas remanescentes NÃO se altera
    });

    return {
      soldQuantity,
      salePrice,
      saleTotalBRL,
      costOfSoldSharesBRL,
      realizedPnlBRL,
      isTaxExempt,
      darfTaxRatePercent,
      darfDueBRL,
      remainingQuantity,
      remainingAveragePrice: pm,
      remainingCostBRL,
    };
  }

  /**
   * Alias idiomático para venda parcial de ativo de custódia.
   */
  public executePartialSale(params: {
    assetId: string;
    soldQuantity: number;
    unitSalePriceBRL: number;
    saleDate: string;
    monthlySalesVolumePriorBRL?: number;
  }): StockSaleResult & { asset: PortfolioAsset } {
    const saleResult = this.executeStockSaleWithTax({
      assetId: params.assetId,
      soldQuantity: params.soldQuantity,
      salePrice: params.unitSalePriceBRL,
      saleDate: params.saleDate,
      monthlySalesVolumePriorBRL: params.monthlySalesVolumePriorBRL,
    });
    const asset = this.store.getState().assets.find((a) => a.id === params.assetId)!;
    return {
      ...saleResult,
      asset,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Viagens e Racha (Min-Cash-Flow)
  // ---------------------------------------------------------------------------

  /**
   * Rebalanceia e simplifica as transferências de uma viagem utilizando o algoritmo
   * Min-Cash-Flow comprovando a conservação de soma zero.
   */
  public rebalanceTripSplitsMinCashFlow(tripId: string) {
    const state = this.store.getState();
    const members = state.tripMembers.filter((m) => m.tripId === tripId);
    const expenses = state.tripExpenses.filter((e) => e.tripId === tripId);
    const settlements = state.tripSettlements.filter((s) => s.tripId === tripId);

    // Mapeia para contratos de trip-math
    const memberInputs = members.map((m) => ({ id: m.id, name: m.name }));
    const expenseInputs = expenses.map((e) => ({
      paid_by_member_id: e.payerMemberId,
      amount_cents: e.amountBaseCents,
      split_type: "custom" as const,
      splits: e.splits.map((s) => ({
        member_id: s.memberId,
        share_cents: s.shareCents,
      })),
    }));
    const settlementInputs = settlements.map((s) => ({
      from_member_id: s.fromMemberId,
      to_member_id: s.toMemberId,
      amount_cents: s.amountCents,
    }));

    const balances = calculateMemberBalances(memberInputs, expenseInputs, settlementInputs);
    const simplifiedSettlements = calculateSimplifiedSettlements(balances);

    return {
      balances,
      simplifiedSettlements,
    };
  }
}
