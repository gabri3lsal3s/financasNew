import { useMutation, useQueryClient } from "@tanstack/react-query";
import { executePortfolioBatchAporte, type ExecutePortfolioBatchAporteParams } from "@/data/rpc";
import {
  createPortfolioAsset,
  createPortfolioContribution,
  createPortfolioDividend,
  createPortfolioTransaction,
  createPortfolioTransactionsBatch,
  deletePortfolioAsset,
  deletePortfolioContribution,
  deletePortfolioContributionsMatching,
  deletePortfolioDividend,
  deletePortfolioDividendsMatching,
  deletePortfolioTransaction,
  deletePortfolioTransactionsMatching,
  updatePortfolioAsset,
  updatePortfolioTransaction,
} from "@/data/repositories/portfolio";
import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { sellAssetPosition } from "@/domain/portfolio/operations";
import { calculateFixedIncomeBalance } from "@/domain/portfolio/fixed-income";
import {
  getAssetPricingMode,
  isCashAssetClass,
} from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { DbInsert, DbUpdate, PortfolioAsset, PortfolioContribution, PortfolioDividend, PortfolioTransaction } from "@/types";

export const PORTFOLIO_QUERY_KEYS = {
  assets: ["portfolio_assets"] as const,
  transactions: ["portfolio_transactions"] as const,
  allTransactions: ["portfolio_transactions", "all"] as const,
  contributions: ["portfolio_contributions"] as const,
  dividends: ["portfolio_dividends"] as const,
  snapshots: ["portfolio_snapshots"] as const,
  allocationTargets: ["allocation_targets"] as const,
  assetPrices: ["asset_prices"] as const,
};

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => {
      const created = await createPortfolioAsset(input);
      void import("@/services/quotes")
        .then(({ syncQuoteForTicker }) => syncQuoteForTicker(created.ticker, created.asset_class))
        .catch(() => undefined);
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo criado",
        description: "O novo ativo foi adicionado à sua carteira.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao criar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useUpdatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioAsset> }) =>
      updatePortfolioAsset(id, patch),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      if (updated?.ticker) {
        void import("@/services/quotes")
          .then(({ syncQuoteForTicker }) => syncQuoteForTicker(updated.ticker, updated.asset_class))
          .catch(() => undefined);
      }
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useDeletePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deletePortfolioAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo excluído",
        description: "O ativo e todo o seu histórico foram removidos da carteira.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioTransaction>, "user_id">) =>
      createPortfolioTransaction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar transação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioTransactionsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioTransaction>, "user_id">[]) =>
      createPortfolioTransactionsBatch(inputs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar lote de transações",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useUpdatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioTransaction> }) =>
      updatePortfolioTransaction(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamento atualizado",
        description: "A movimentação foi alterada com sucesso.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar lançamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export type DeletePortfolioTransactionInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      type?: string | null;
      date?: string | null;
      total?: number | null;
    };

export function useDeletePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioTransactionInput) => {
      const id = typeof input === "string" ? input : input.id;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let type = typeof input !== "string" ? input.type : undefined;
      let date = typeof input !== "string" ? input.date : undefined;
      let total = typeof input !== "string" ? input.total : undefined;

      // Se não foram passados os metadados, tenta localizá-los no cache
      if (!assetId || !date) {
        const cachedAll = queryClient.getQueryData<PortfolioTransaction[]>(PORTFOLIO_QUERY_KEYS.allTransactions) ?? [];
        const match = cachedAll.find((t) => t.id === id);
        if (match) {
          assetId = assetId ?? match.asset_id;
          type = type ?? match.type;
          date = date ?? match.date;
          total = total ?? match.total;
        }
      }

      // 1. Deleta a transação principal
      await deletePortfolioTransaction(id);

      // 2. Cascata em Proventos ou Aportes correspondentes
      if (assetId && date && total !== undefined && total !== null) {
        if (type === "dividend" || type === "jcp" || type === "fii_yield") {
          await deletePortfolioDividendsMatching({
            asset_id: assetId,
            date,
            amount: total,
          });
        } else if (type === "buy") {
          await deletePortfolioContributionsMatching({
            asset_id: assetId,
            date,
            amount: total,
          });
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamento excluído",
        description: "A operação e seus lançamentos vinculados foram removidos.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir lançamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioContribution>, "user_id">) =>
      createPortfolioContribution(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aporte financeiro registrado",
        description: "O valor foi contabilizado nos aportes do mês.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar aporte",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export type DeletePortfolioContributionInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      date?: string | null;
      amount?: number | null;
    };

export function useDeletePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioContributionInput) => {
      const id = typeof input === "string" ? input : input.id;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let date = typeof input !== "string" ? input.date : undefined;
      let amount = typeof input !== "string" ? input.amount : undefined;

      if (!assetId || !date) {
        const cached = queryClient.getQueryData<PortfolioContribution[]>(PORTFOLIO_QUERY_KEYS.contributions) ?? [];
        const match = cached.find((c) => c.id === id);
        if (match) {
          assetId = assetId ?? match.asset_id;
          date = date ?? match.date;
          amount = amount ?? match.amount;
        }
      }

      // 1. Deleta a contribuição de aporte
      await deletePortfolioContribution(id);

      // 2. Cascata em Transações de Ativos se vinculado
      if (assetId && date && amount !== undefined && amount !== null) {
        await deletePortfolioTransactionsMatching({
          asset_id: assetId,
          date,
          types: ["buy"],
          total: amount,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aporte excluído",
        description: "O lançamento de aporte e a operação vinculada foram removidos.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir aporte",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioDividend>, "user_id">) =>
      createPortfolioDividend(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento registrado",
        description: "O rendimento foi salvo no extrato de proventos.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export type DeletePortfolioDividendInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      date?: string | null;
      amount?: number | null;
    };

export function useDeletePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioDividendInput) => {
      const id = typeof input === "string" ? input : input.id;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let date = typeof input !== "string" ? input.date : undefined;
      let amount = typeof input !== "string" ? input.amount : undefined;

      if (!assetId || !date) {
        const cached = queryClient.getQueryData<PortfolioDividend[]>(PORTFOLIO_QUERY_KEYS.dividends) ?? [];
        const match = cached.find((d) => d.id === id);
        if (match) {
          assetId = assetId ?? match.asset_id;
          date = date ?? match.date;
          amount = amount ?? match.amount;
        }
      }

      // 1. Deleta o provento
      await deletePortfolioDividend(id);

      // 2. Cascata em Transações de Ativos se vinculado
      if (assetId && date && amount !== undefined && amount !== null) {
        await deletePortfolioTransactionsMatching({
          asset_id: assetId,
          date,
          types: ["dividend", "jcp", "fii_yield"],
          total: amount,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento excluído",
        description: "O rendimento e a operação vinculada foram removidos.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/** Payload para a mutação de ordem rápida com sincronização de posição. */
export interface RecordOrderParams {
  asset: PortfolioAsset;
  type: "buy" | "sell" | "dividend" | "jcp" | "fii_yield" | "split" | "reverse_split" | "subscription";
  date: string;
  quantity: number;
  price: number;
  total: number;
  syncCash?: boolean;
  cashAsset?: PortfolioAsset | null;
  recordContribution?: boolean;
  notes?: string | null;
  usdRate?: number;
  /** Custo original aplicado na compra/lote resgatado (especialmente relevante para Renda Fixa). */
  appliedCostBasis?: number;
}

/**
 * Hook de Ordem Rápida:
 * Registra a transação histórica no ledger, atualiza a quantidade e preço médio do ativo
 * e opcionalmente debita do caixa / registra o aporte financeiro do mês em um fluxo único e consistente.
 */
export function useRecordOrder() {
  const queryClient = useQueryClient();
  const createAsset = useCreatePortfolioAsset();
  const createTx = useCreatePortfolioTransaction();
  const updateAsset = useUpdatePortfolioAsset();
  const createContrib = useCreatePortfolioContribution();
  const createDiv = useCreatePortfolioDividend();

  return useMutation({
    mutationFn: async (params: RecordOrderParams) => {
      const { asset, type, date, quantity, price, total, syncCash, cashAsset, recordContribution, notes, usdRate, appliedCostBasis } = params;
      const rate = asset.currency === "USD" ? (usdRate ?? 5.25) : 1;
      const totalBRL = Math.round(total * rate * 100) / 100;

      // 1. Se for Venda: antes de gravar a venda, verifica se o ativo tem compras anteriores no ledger.
      // Se não tiver (ativo cadastrado direto pelo form sem compra explícita), grava a compra inicial com o custo de aquisição.
      if (type === "sell") {
        const isCash = isCashAssetClass(asset.asset_class);
        const pricingMode = getAssetPricingMode(asset);
        const isTotalValue = !isCash && pricingMode === "total_value";

        const currentCost =
          asset.quantity > 1 && asset.average_price > 0
            ? Math.round(asset.quantity * asset.average_price * 100) / 100
            : asset.average_price > 0
              ? asset.average_price
              : asset.quantity;

        const baseValue =
          appliedCostBasis !== undefined && appliedCostBasis > 0
            ? appliedCostBasis
            : isTotalValue && asset.fixed_income_metadata
              ? asset.fixed_income_metadata.base_value !== undefined &&
                asset.fixed_income_metadata.base_value !== null &&
                asset.fixed_income_metadata.base_value > 0
                ? asset.fixed_income_metadata.base_value
                : currentCost
              : currentCost;

        // Se o ativo tinha custo > 0 no momento da venda, registramos a compra inicial correspondente no ledger
        if (baseValue > 0) {
          const initialDate =
            asset.fixed_income_metadata?.initial_investment_date ||
            asset.fixed_income_metadata?.base_date ||
            date;

          await createTx.mutateAsync({
            asset_id: asset.id,
            type: "buy",
            date: initialDate,
            quantity: isTotalValue ? 1 : asset.quantity,
            price: isTotalValue ? baseValue : asset.average_price,
            total: isTotalValue ? baseValue : Math.round(asset.quantity * asset.average_price * 100) / 100,
          });
        }
      }

      // 2. Grava a transação atual no ledger de transações (na moeda nativa do ativo)
      await createTx.mutateAsync({
        asset_id: asset.id,
        type,
        date,
        quantity,
        price,
        total,
      });

      // 3. Se for Compra ou Subscrição: atualiza o Preço Médio ponderado e quantidade
      if (type === "buy" || type === "subscription") {
        const isCash = isCashAssetClass(asset.asset_class);
        const pricingMode = getAssetPricingMode(asset);
        const isTotalValue = !isCash && pricingMode === "total_value";

        if (isCash) {
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: asset.quantity + (total > 0 ? total : quantity),
              average_price: 1,
            },
          });
        } else if (isTotalValue) {
          const currentCost =
            asset.quantity > 1 && asset.average_price > 0
              ? Math.round(asset.quantity * asset.average_price * 100) / 100
              : asset.average_price > 0
                ? asset.average_price
                : asset.quantity;
          const orderAmount = total > 0 ? total : price;
          const newTotalApplied = Math.round((currentCost + orderAmount) * 100) / 100;

          const updatedFiMetadata = asset.fixed_income_metadata
            ? {
                ...asset.fixed_income_metadata,
                base_date: date,
                base_value: newTotalApplied,
                initial_investment_date:
                  asset.fixed_income_metadata.initial_investment_date ?? asset.fixed_income_metadata.base_date,
                initial_investment_value:
                  asset.fixed_income_metadata.initial_investment_value ?? newTotalApplied,
              }
            : null;

          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: 1,
              average_price: newTotalApplied,
              ...(updatedFiMetadata ? { fixed_income_metadata: updatedFiMetadata } : {}),
            },
          });
        } else {
          const lotCalc = calculateWeightedAveragePrice(
            asset.quantity,
            asset.average_price,
            quantity,
            price > 0 ? price : total / (quantity || 1),
          );
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: lotCalc.newQuantity,
              average_price: lotCalc.newAveragePrice,
            },
          });
        }

        // Debita do caixa em BRL se solicitado e disponível
        if (syncCash && cashAsset && totalBRL > 0) {
          const cashDebit = Math.min(cashAsset.quantity, totalBRL);
          if (cashDebit > 0) {
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: {
                quantity: Math.max(0, cashAsset.quantity - cashDebit),
                average_price: 1,
              },
            });
          }
        }

        // Registra aporte financeiro no mês em BRL se solicitado
        if (recordContribution && totalBRL > 0) {
          await createContrib.mutateAsync({
            amount: totalBRL,
            date,
            asset_id: asset.id,
            notes: notes ?? (asset.currency === "USD" ? `Aporte em ${asset.ticker} ($${total.toFixed(2)})` : `Aporte em ${asset.ticker}`),
          });
        }
      }

      // 4. Se for Venda: reduz a quantidade mantendo o PM e opcionalmente credita Caixa em BRL
      if (type === "sell") {
        const isCash = isCashAssetClass(asset.asset_class);
        const pricingMode = getAssetPricingMode(asset);
        const isTotalValue = !isCash && pricingMode === "total_value";

        let netCreditBRL = totalBRL;

        if (isCash) {
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: Math.max(0, asset.quantity - (total > 0 ? total : quantity)),
              average_price: 1,
            },
          });
        } else if (isTotalValue) {
          const currentCost =
            asset.quantity > 1 && asset.average_price > 0
              ? Math.round(asset.quantity * asset.average_price * 100) / 100
              : asset.average_price > 0
                ? asset.average_price
                : asset.quantity;
          const orderAmount = total > 0 ? total : price;

          let newTotalApplied: number;

          if (asset.fixed_income_metadata) {
            const baseValue =
              asset.fixed_income_metadata.base_value !== undefined &&
              asset.fixed_income_metadata.base_value !== null &&
              asset.fixed_income_metadata.base_value > 0
                ? asset.fixed_income_metadata.base_value
                : currentCost;

            const fiRes = calculateFixedIncomeBalance({
              baseValue,
              baseDate: asset.fixed_income_metadata.base_date,
              initialInvestmentDate: asset.fixed_income_metadata.initial_investment_date,
              maturityDate: asset.fixed_income_metadata.maturity_date,
              rateType: asset.fixed_income_metadata.rate_type,
              rateValue: asset.fixed_income_metadata.rate_value,
              isTaxExempt: asset.fixed_income_metadata.is_tax_exempt,
              manualTaxRatePct: asset.fixed_income_metadata.manual_tax_rate_pct,
              totalCost: currentCost,
              today: date,
            });

            const grossBalance = Math.max(fiRes.grossValue, currentCost);
            const isFullRedemption = orderAmount >= grossBalance || orderAmount >= currentCost;

            const proportion = grossBalance > 0 ? Math.min(1, orderAmount / grossBalance) : 1;
            const estimatedTax = asset.fixed_income_metadata.is_tax_exempt
              ? 0
              : Math.round(fiRes.taxAmount * proportion * 100) / 100;

            netCreditBRL = Math.max(0, Math.round((totalBRL - estimatedTax) * 100) / 100);

            newTotalApplied = isFullRedemption
              ? 0
              : Math.max(0, Math.round(currentCost * (1 - proportion) * 100) / 100);
          } else {
            newTotalApplied = Math.round(Math.max(0, currentCost - orderAmount) * 100) / 100;
          }

          const baseValue =
            appliedCostBasis !== undefined && appliedCostBasis > 0
              ? appliedCostBasis
              : asset.fixed_income_metadata?.base_value !== undefined &&
                  asset.fixed_income_metadata?.base_value !== null &&
                  asset.fixed_income_metadata.base_value > 0
                ? asset.fixed_income_metadata.base_value
                : currentCost;

          const updatedFiMetadata =
            asset.fixed_income_metadata
              ? {
                  ...asset.fixed_income_metadata,
                  base_date: newTotalApplied > 0 ? date : asset.fixed_income_metadata.base_date,
                  base_value: newTotalApplied,
                  initial_investment_value:
                    asset.fixed_income_metadata.initial_investment_value ?? baseValue,
                }
              : null;

          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: newTotalApplied > 0 ? 1 : 0,
              average_price: newTotalApplied,
              ...(updatedFiMetadata ? { fixed_income_metadata: updatedFiMetadata } : {}),
            },
          });
        } else {
          const sellResult = sellAssetPosition({
            currentQuantity: asset.quantity,
            currentAveragePrice: asset.average_price,
            sellQuantity: quantity,
            sellPrice: price > 0 ? price : total / (quantity || 1),
          });
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: sellResult.remainingQuantity,
              average_price: sellResult.remainingAveragePrice,
            },
          });
        }

        // Credita no caixa em BRL se solicitado (valor líquido descontado de IRRF se aplicável)
        if (syncCash && netCreditBRL > 0) {
          if (cashAsset) {
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: {
                quantity: cashAsset.quantity + netCreditBRL,
                average_price: 1,
              },
            });
          } else {
            await createAsset.mutateAsync({
              ticker: "CAIXA",
              asset_class: "Caixa",
              sector: "Reserva / Liquidez",
              quantity: netCreditBRL,
              average_price: 1,
              currency: "BRL",
            });
          }
        }
      }

      // 4. Se for Provento (dividendo, jcp, fii_yield)
      if (type === "dividend" || type === "jcp" || type === "fii_yield") {
        await createDiv.mutateAsync({
          amount: total,
          date,
          asset_id: asset.id,
          ticker: asset.ticker,
          notes: notes ?? `Rendimento de ${asset.ticker}`,
        });

        // Credita no caixa em BRL se solicitado
        if (syncCash && totalBRL > 0) {
          if (cashAsset) {
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: {
                quantity: cashAsset.quantity + totalBRL,
                average_price: 1,
              },
            });
          } else {
            await createAsset.mutateAsync({
              ticker: "CAIXA",
              asset_class: "Caixa",
              sector: "Reserva / Liquidez",
              quantity: totalBRL,
              average_price: 1,
              currency: "BRL",
            });
          }
        }
      }

      // 5. Se for Desdobramento / Grupamento (Split / Reverse Split)
      if (type === "split" && quantity > 0) {
        await updateAsset.mutateAsync({
          id: asset.id,
          patch: {
            quantity: asset.quantity * quantity,
            average_price: asset.average_price / quantity,
          },
        });
      } else if (type === "reverse_split" && quantity > 0) {
        await updateAsset.mutateAsync({
          id: asset.id,
          patch: {
            quantity: Math.floor(asset.quantity / quantity),
            average_price: asset.average_price * quantity,
          },
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ordem executada",
        description: "A movimentação foi concluída e a posição atualizada.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao executar ordem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/**
 * Executa o aporte inteligente em lote via RPC transacional (§F36).
 * Atualiza posições, lança as compras em portfolio_transactions e registra a contribuição.
 */
export function useExecutePortfolioBatchAporte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ExecutePortfolioBatchAporteParams) => executePortfolioBatchAporte(params),
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aportes aplicados à carteira",
        description: `Posições de ${params.items.length} ativos atualizadas e compras lançadas com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao aplicar aportes",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

