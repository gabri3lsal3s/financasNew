/**
 * Gerenciador de Estado Volátil e Mutações em Memória (headless-state-store.ts).
 *
 * Provê armazenamento isomórfico transacional para simulações completas de ciclo de vida
 * com suporte a snapshots reversíveis, invariantes relacionais e zero escrita no Supabase.
 * Conforme AGENTS.md (Funções puras, TypeScript estrito, centavos inteiros).
 */

import type {
  HeadlessAnnualProvision,
  HeadlessBudgetLimit,
  HeadlessCardPayment,
  HeadlessCategory,
  HeadlessCreditCard,
  HeadlessDebt,
  HeadlessFamilyProfile,
  HeadlessLoanContract,
  HeadlessState,
  HeadlessTransaction,
  HeadlessTrip,
  HeadlessTripExpense,
  HeadlessTripMember,
  HeadlessTripSettlement,
  HeadlessUserProfile,
} from "./types";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction } from "@/types";

export class HeadlessStateStore {
  private state: HeadlessState;
  private snapshots: Map<string, HeadlessState> = new Map();

  constructor(initialState?: HeadlessState) {
    this.state = initialState ? this.cloneState(initialState) : this.createDefaultInitialState();
  }

  /**
   * Inicializa um estado determinístico padrão com perfil e categorias canônicas.
   */
  public createDefaultInitialState(): HeadlessState {
    const userId = "usr-headless-seed";
    const profile: HeadlessUserProfile = {
      id: userId,
      email: "forensics.seed@axir.app",
      name: "Investidor Forense Seed",
      tier: "pro_monthly",
      role: "user",
      monthlyIncomeCents: 12000_00, // R$ 12.000,00
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const categories: HeadlessCategory[] = [
      { id: "cat-moradia", userId, name: "Moradia", icon: "moradia", color: "#3B82F6", type: "expense" },
      { id: "cat-alimentacao", userId, name: "Alimentação", icon: "alimentacao", color: "#10B981", type: "expense" },
      { id: "cat-transporte", userId, name: "Transporte", icon: "transporte", color: "#F59E0B", type: "expense" },
      { id: "cat-saude", userId, name: "Saúde", icon: "saude", color: "#EF4444", type: "expense" },
      { id: "cat-educacao", userId, name: "Educação", icon: "educacao", color: "#8B5CF6", type: "expense" },
      { id: "cat-lazer", userId, name: "Lazer", icon: "lazer", color: "#EC4899", type: "expense" },
      { id: "cat-salario", userId, name: "Salário", icon: "salario", color: "#14B8A6", type: "income" },
      { id: "cat-investimentos", userId, name: "Rendimentos", icon: "investimentos", color: "#6366F1", type: "income" },
    ];

    const cards: HeadlessCreditCard[] = [
      {
        id: "card-principal",
        userId,
        name: "Cartão Titanium",
        brand: "Mastercard",
        creditLimitCents: 15000_00, // R$ 15.000,00
        closingDay: 10,
        dueDay: 17,
        color: "#1E293B",
        isActive: true,
      },
    ];

    return {
      profile,
      categories,
      creditCards: cards,
      transactions: [],
      cardPayments: [],
      debts: [],
      loans: [],
      assets: [],
      portfolioTransactions: [],
      portfolioDividends: [],
      portfolioSnapshots: [],
      cashBalanceCents: 0,
      budgetLimits: [],
      annualProvisions: [],
      familyProfile: null,
      trips: [],
      tripMembers: [],
      tripExpenses: [],
      tripSettlements: [],
      dismissedInsightIds: new Set<string>(),
      auditEvents: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Snapshots e Reversibilidade
  // ---------------------------------------------------------------------------

  /**
   * Cria um checkpoint imutável do estado atual e retorna o identificador.
   */
  public saveSnapshot(label?: string): string {
    const key = label ?? `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.snapshots.set(key, this.cloneState(this.state));
    return key;
  }

  /**
   * Alias idiomático para criação de snapshot.
   */
  public takeSnapshot(label?: string): string {
    return this.saveSnapshot(label);
  }

  /**
   * Restaura o estado a partir de um checkpoint previamente salvo.
   */
  public restoreSnapshot(label: string): boolean {
    const snap = this.snapshots.get(label);
    if (!snap) return false;
    this.state = this.cloneState(snap);
    return true;
  }

  /**
   * Obtém cópia profunda imutável do estado atual.
   */
  public getState(): Readonly<HeadlessState> {
    return this.cloneState(this.state);
  }

  /**
   * Define o perfil do usuário.
   */
  public setProfile(profile: Partial<HeadlessUserProfile>): void {
    this.state.profile = {
      ...this.state.profile,
      ...profile,
    };
  }

  /**
   * Alias para atualização parcial do perfil.
   */
  public updateProfile(profile: Partial<HeadlessUserProfile>): void {
    this.setProfile(profile);
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Categorias
  // ---------------------------------------------------------------------------

  public addCategory(category: HeadlessCategory): void {
    this.state.categories.push({ ...category });
  }

  public updateCategory(categoryId: string, updates: Partial<HeadlessCategory>): void {
    const idx = this.state.categories.findIndex((c) => c.id === categoryId);
    if (idx >= 0) {
      const existing = this.state.categories[idx];
      if (existing) {
        this.state.categories[idx] = { ...existing, ...updates };
      }
    }
  }

  public deleteCategory(categoryId: string, reallocateToCategoryId?: string): boolean {
    const catIdx = this.state.categories.findIndex((c) => c.id === categoryId);
    if (catIdx < 0) return false;

    // Se houver transações vinculadas e não foi fornecida categoria de realocação, rejeita
    const linkedTxs = this.state.transactions.filter((t) => t.categoryId === categoryId);
    if (linkedTxs.length > 0 && !reallocateToCategoryId) {
      return false;
    }

    if (reallocateToCategoryId) {
      const destExists = this.state.categories.some((c) => c.id === reallocateToCategoryId && c.id !== categoryId);
      if (!destExists) return false;

      // Realoca transações
      for (const t of this.state.transactions) {
        if (t.categoryId === categoryId) {
          t.categoryId = reallocateToCategoryId;
        }
      }
    }

    this.state.categories.splice(catIdx, 1);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Transações
  // ---------------------------------------------------------------------------

  public addTransaction(tx: HeadlessTransaction): void {
    this.state.transactions.push({ ...tx });
  }

  public addTransactionsBatch(txs: HeadlessTransaction[]): void {
    for (const t of txs) {
      this.state.transactions.push({ ...t });
    }
  }

  public deleteTransaction(txId: string): boolean {
    const idx = this.state.transactions.findIndex((t) => t.id === txId);
    if (idx < 0) return false;
    this.state.transactions.splice(idx, 1);
    return true;
  }

  public deleteInstallmentSeries(
    seriesId: string,
    scope: "single" | "future" | "all",
    fromInstallmentNumber?: number,
  ): number {
    if (scope === "all") {
      const initialCount = this.state.transactions.length;
      this.state.transactions = this.state.transactions.filter((t) => t.installmentSeriesId !== seriesId);
      return initialCount - this.state.transactions.length;
    }

    if (scope === "future" && typeof fromInstallmentNumber === "number") {
      const initialCount = this.state.transactions.length;
      this.state.transactions = this.state.transactions.filter((t) => {
        if (t.installmentSeriesId !== seriesId) return true;
        return (t.installmentNumber ?? 0) < fromInstallmentNumber;
      });
      return initialCount - this.state.transactions.length;
    }

    return 0;
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Cartões e Pagamentos
  // ---------------------------------------------------------------------------

  public addCard(card: HeadlessCreditCard): void {
    this.state.creditCards.push({ ...card });
  }

  public addCreditCard(card: HeadlessCreditCard): void {
    this.addCard(card);
  }

  public addCardPayment(payment: HeadlessCardPayment): void {
    this.state.cardPayments.push({ ...payment });
  }

  public addCardInvoicePayment(payment: HeadlessCardPayment): void {
    this.addCardPayment(payment);
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Dívidas e Empréstimos
  // ---------------------------------------------------------------------------

  public addDebt(debt: HeadlessDebt): void {
    this.state.debts.push({ ...debt });
  }

  public addLoan(loan: HeadlessLoanContract): void {
    this.state.loans.push({ ...loan });
  }

  public updateLoan(loanId: string, updates: Partial<HeadlessLoanContract>): void {
    const idx = this.state.loans.findIndex((l) => l.id === loanId);
    if (idx >= 0) {
      const existing = this.state.loans[idx];
      if (existing) {
        this.state.loans[idx] = { ...existing, ...updates };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Ativos e Carteira
  // ---------------------------------------------------------------------------

  public addAsset(asset: PortfolioAsset): void {
    this.state.assets.push({ ...asset });
  }

  public updateAsset(assetId: string, updates: Partial<PortfolioAsset>): void {
    const idx = this.state.assets.findIndex((a) => a.id === assetId);
    if (idx >= 0) {
      const existing = this.state.assets[idx];
      if (existing) {
        this.state.assets[idx] = { ...existing, ...updates };
      }
    }
  }

  public addPortfolioTransaction(tx: PortfolioTransaction): void {
    this.state.portfolioTransactions.push({ ...tx });
  }

  public deletePortfolioTransaction(txId: string): boolean {
    const idx = this.state.portfolioTransactions.findIndex((t) => t.id === txId);
    if (idx < 0) return false;
    this.state.portfolioTransactions.splice(idx, 1);
    return true;
  }

  public addPortfolioDividend(div: PortfolioDividend): void {
    this.state.portfolioDividends.push({ ...div });
  }

  public setCashBalanceCents(amountCents: number): void {
    this.state.cashBalanceCents = amountCents;
  }

  public setCashBalance(amountCents: number): void {
    this.setCashBalanceCents(amountCents);
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Viagens
  // ---------------------------------------------------------------------------

  public addTrip(trip: HeadlessTrip): void {
    this.state.trips.push({ ...trip });
  }

  public addTripMember(member: HeadlessTripMember): void {
    this.state.tripMembers.push({ ...member });
  }

  public addTripExpense(expense: HeadlessTripExpense): void {
    this.state.tripExpenses.push({ ...expense });
  }

  public addTripSettlement(settlement: HeadlessTripSettlement): void {
    this.state.tripSettlements.push({ ...settlement });
  }

  // ---------------------------------------------------------------------------
  // Mutadores de Orçamento & Família
  // ---------------------------------------------------------------------------

  public setBudgetLimit(limit: HeadlessBudgetLimit): void {
    const idx = this.state.budgetLimits.findIndex((b) => b.categoryId === limit.categoryId && b.month === limit.month);
    if (idx >= 0) {
      this.state.budgetLimits[idx] = { ...limit };
    } else {
      this.state.budgetLimits.push({ ...limit });
    }
  }

  public addAnnualProvision(provision: HeadlessAnnualProvision): void {
    this.state.annualProvisions.push({ ...provision });
  }

  public setFamilyProfile(family: HeadlessFamilyProfile | null): void {
    this.state.familyProfile = family ? { ...family } : null;
  }

  // ---------------------------------------------------------------------------
  // Auditoria e Insights
  // ---------------------------------------------------------------------------

  public dismissInsight(insightId: string): void {
    this.state.dismissedInsightIds.add(insightId);
  }

  public logAuditEvent(action: string, payloadSummary: string): void {
    this.state.auditEvents.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      timestamp: new Date().toISOString(),
      payloadSummary,
    });
  }

  public recordAuditEvent(event: {
    id: string;
    userId: string;
    eventType: string;
    details: string;
    timestamp: string;
  }): void {
    this.state.auditEvents.push({
      id: event.id,
      userId: event.userId,
      eventType: event.eventType,
      action: event.eventType,
      details: event.details,
      timestamp: event.timestamp,
      payloadSummary: event.details,
    });
  }

  // ---------------------------------------------------------------------------
  // Utilitários Internos
  // ---------------------------------------------------------------------------

  private cloneState(source: HeadlessState): HeadlessState {
    return {
      profile: { ...source.profile },
      categories: source.categories.map((c) => ({ ...c })),
      creditCards: source.creditCards.map((c) => ({ ...c })),
      transactions: source.transactions.map((t) => ({ ...t })),
      cardPayments: source.cardPayments.map((p) => ({ ...p })),
      debts: source.debts.map((d) => ({ ...d })),
      loans: source.loans.map((l) => ({
        ...l,
        installments: l.installments.map((i) => ({ ...i })),
      })),
      assets: source.assets.map((a) => ({ ...a })),
      portfolioTransactions: source.portfolioTransactions.map((pt) => ({ ...pt })),
      portfolioDividends: source.portfolioDividends.map((pd) => ({ ...pd })),
      portfolioSnapshots: source.portfolioSnapshots.map((ps) => ({ ...ps })),
      cashBalanceCents: source.cashBalanceCents,
      budgetLimits: source.budgetLimits.map((b) => ({ ...b })),
      annualProvisions: source.annualProvisions.map((ap) => ({ ...ap })),
      familyProfile: source.familyProfile
        ? {
            ...source.familyProfile,
            members: source.familyProfile.members.map((m) => ({ ...m })),
          }
        : null,
      trips: source.trips.map((tr) => ({ ...tr })),
      tripMembers: source.tripMembers.map((tm) => ({ ...tm })),
      tripExpenses: source.tripExpenses.map((te) => ({
        ...te,
        splits: te.splits.map((s) => ({ ...s })),
      })),
      tripSettlements: source.tripSettlements.map((ts) => ({ ...ts })),
      dismissedInsightIds: new Set(source.dismissedInsightIds),
      auditEvents: source.auditEvents.map((ae) => ({ ...ae })),
    };
  }
}
