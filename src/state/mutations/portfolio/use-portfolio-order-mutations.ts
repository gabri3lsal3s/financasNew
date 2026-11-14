import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  executePortfolioBatchAporte,
  type ExecutePortfolioBatchAporteParams,
} from "@/data/rpc";
import { listPortfolioTransactions } from "@/data/repositories/portfolio";
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
import type { PortfolioAsset } from "@/types";
import { PORTFOLIO_QUERY_KEYS } from "./portfolio-keys";
import {
  useCreatePortfolioAsset,
  useUpdatePortfolioAsset,
} from "./use-portfolio-asset-mutations";
import { useCreatePortfolioTransaction } from "./use-portfolio-transaction-mutations";
import { useCreatePortfolioContribution } from "./use-portfolio-contribution-mutations";
import { useCreatePortfolioDividend } from "./use-portfolio-dividend-mutations";

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
  /** Valor de IRRF retido na fonte customizado pelo usuário (em moeda nativa / BRL). */
  customTaxAmount?: number;
  /** Alíquota de IR informada/customizada pelo usuário (em %). */
  customTaxRatePct?: number;
  /** Valor líquido a ser creditado em Caixa (após todas as deduções de IRRF/taxas). */
  netCreditAmount?: number;
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
      const {
        asset,
        type,
        date,
        quantity,
        price,
        total,
        syncCash,
        cashAsset,
        recordContribution,
        notes,
        usdRate,
        appliedCostBasis,
        customTaxAmount,
        netCreditAmount,
      } = params;

      // Impede ordens de mercado (compra/venda/provento) diretas sobre o ativo de Caixa
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        throw new Error(
          "Ordens diretas em ativos de Caixa não são permitidas. Para gerenciar liquidez, utilize o diálogo de ajuste de Caixa.",
        );
      }

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

        // Se o ativo tinha custo > 0 no momento da venda, registramos a compra inicial correspondente no ledger se ainda não houver compras
        if (baseValue > 0) {
          const existingTxs = await listPortfolioTransactions(asset.id);
          const hasPriorBuy = existingTxs.some((t) => t.type === "buy" || t.type === "subscription");
          if (!hasPriorBuy) {
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
                  (asset.fixed_income_metadata.initial_investment_value ?? currentCost) + orderAmount,
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

        let netCreditBRL = netCreditAmount !== undefined ? Math.max(0, netCreditAmount) : totalBRL;

        if (isCash) {
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: Math.max(0, asset.quantity - (total > 0 ? total : quantity)),
              average_price: 1,
            },
          });
        } else if (isTotalValue) {
          const effectiveAppliedCost =
            appliedCostBasis !== undefined && appliedCostBasis > 0
              ? appliedCostBasis
              : asset.fixed_income_metadata?.initial_investment_value !== undefined &&
                asset.fixed_income_metadata?.initial_investment_value !== null &&
                asset.fixed_income_metadata.initial_investment_value > 0
                ? asset.fixed_income_metadata.initial_investment_value
                : asset.quantity > 1 && asset.average_price > 0
                  ? Math.round(asset.quantity * asset.average_price * 100) / 100
                  : asset.average_price > 0
                    ? asset.average_price
                    : (asset.fixed_income_metadata?.base_value ?? asset.quantity);
          const orderAmount = total > 0 ? total : price;

          let remainingGrossBalance: number;
          let remainingCost: number;

          if (asset.fixed_income_metadata) {
            const baseValue =
              asset.fixed_income_metadata.base_value !== undefined &&
              asset.fixed_income_metadata.base_value !== null &&
              asset.fixed_income_metadata.base_value > 0
                ? asset.fixed_income_metadata.base_value
                : effectiveAppliedCost;

            const fiRes = calculateFixedIncomeBalance({
              baseValue,
              baseDate: asset.fixed_income_metadata.base_date,
              initialInvestmentDate: asset.fixed_income_metadata.initial_investment_date,
              maturityDate: asset.fixed_income_metadata.maturity_date,
              rateType: asset.fixed_income_metadata.rate_type,
              rateValue: asset.fixed_income_metadata.rate_value,
              isTaxExempt: asset.fixed_income_metadata.is_tax_exempt,
              manualTaxRatePct: asset.fixed_income_metadata.manual_tax_rate_pct,
              totalCost: effectiveAppliedCost,
              today: date,
            });

            const grossBalance = Math.max(fiRes.grossValue, effectiveAppliedCost);
            const isFullRedemption = grossBalance > 0
              ? orderAmount >= grossBalance - 0.01
              : orderAmount >= effectiveAppliedCost - 0.01;

            const proportion = grossBalance > 0 ? Math.min(1, orderAmount / grossBalance) : 1;
            const projectedTax = asset.fixed_income_metadata.is_tax_exempt
              ? 0
              : Math.round(fiRes.taxAmount * proportion * 100) / 100;
            const effectiveTax =
              customTaxAmount !== undefined ? Math.max(0, customTaxAmount) : projectedTax;

            netCreditBRL =
              netCreditAmount !== undefined
                ? Math.max(0, netCreditAmount)
                : Math.max(0, Math.round((totalBRL - effectiveTax) * 100) / 100);

            remainingGrossBalance = isFullRedemption
              ? 0
              : Math.max(0, Math.round((grossBalance - orderAmount) * 100) / 100);
            remainingCost = isFullRedemption
              ? 0
              : Math.max(0, Math.round(effectiveAppliedCost * (1 - proportion) * 100) / 100);
          } else {
            const isFullRedemption = orderAmount >= effectiveAppliedCost;
            remainingGrossBalance = isFullRedemption
              ? 0
              : Math.round(Math.max(0, effectiveAppliedCost - orderAmount) * 100) / 100;
            remainingCost = remainingGrossBalance;
          }

          const updatedFiMetadata =
            asset.fixed_income_metadata
              ? {
                  ...asset.fixed_income_metadata,
                  base_date: remainingGrossBalance > 0 ? date : asset.fixed_income_metadata.base_date,
                  base_value: remainingGrossBalance,
                  initial_investment_value: remainingCost,
                }
              : null;

          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: remainingGrossBalance > 0 ? 1 : 0,
              average_price: remainingCost,
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
          sync_cash: Boolean(syncCash && totalBRL > 0),
          cash_amount: syncCash && totalBRL > 0 ? totalBRL : null,
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
            quantity: Math.round(asset.quantity * quantity * 10000) / 10000,
            average_price: Math.round((asset.average_price / quantity) * 10000) / 10000,
          },
        });
      } else if (type === "reverse_split" && quantity > 0) {
        await updateAsset.mutateAsync({
          id: asset.id,
          patch: {
            quantity: Math.round((asset.quantity / quantity) * 10000) / 10000,
            average_price: Math.round(asset.average_price * quantity * 10000) / 10000,
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
