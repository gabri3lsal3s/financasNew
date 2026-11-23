import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  executePortfolioBatchAporte,
  revertPortfolioBatchAporte,
  type ExecutePortfolioBatchAporteParams,
} from "@/data/rpc";
import { generateBatchId } from "@/domain/portfolio/aporte-execution-mapper";
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
import { todayISO } from "@/lib/date";
import type { FixedIncomeMetadata, PortfolioAsset } from "@/types";
import {
  PORTFOLIO_QUERY_KEYS,
  invalidatePortfolioSuite,
  triggerSurgicalQuoteSync,
} from "./portfolio-keys";
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
  /** Taxa de câmbio negociada em BRL para ativos em moeda estrangeira (Fase 2). */
  fxRateBRL?: number;
  /** Custo original aplicado na compra/lote resgatado (especialmente relevante para Renda Fixa). */
  appliedCostBasis?: number;
  /** Custo total da posição antes do resgate (custo pré-operação). Se omitido, deriva de initial_investment_value ou average_price. */
  preRedemptionHoldingCost?: number;
  /** Valor de IRRF retido na fonte customizado pelo usuário (em moeda nativa / BRL). */
  customTaxAmount?: number;
  /** Alíquota de IR informada/customizada pelo usuário (em %). */
  customTaxRatePct?: number;
  /** Valor líquido a ser creditado em Caixa (após todas as deduções de IRRF/taxas). */
  netCreditAmount?: number;
  /** Registrar como retirada da carteira em portfolio_contributions caso não credite Caixa (blinda o TWR). */
  recordWithdrawal?: boolean;
  /** Data da primeira aplicação informada/corrigida pelo usuário no resgate (Marco Zero de IR). */
  customInitialInvestmentDate?: string | null;
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
        fxRateBRL,
        appliedCostBasis,
        preRedemptionHoldingCost,
        customTaxAmount,
        netCreditAmount,
        recordWithdrawal,
        customInitialInvestmentDate,
      } = params;

      // Impede ordens de mercado (compra/venda/provento) diretas sobre o ativo de Caixa
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        throw new Error(
          "Ordens diretas em ativos de Caixa não são permitidas. Para gerenciar liquidez, utilize o diálogo de ajuste de Caixa.",
        );
      }

      const rate = asset.currency === "USD" ? (fxRateBRL ?? usdRate ?? 5.25) : 1;
      const totalBRL = Math.round(total * rate * 100) / 100;
      const isCash = isCashAssetClass(asset.asset_class);
      const pricingMode = getAssetPricingMode(asset);
      const isTotalValue = !isCash && pricingMode === "total_value";

      // 1. Se for Venda: antes de gravar a venda, verifica se o ativo tem compras anteriores no ledger.
      // Se não tiver (ativo cadastrado direto pelo form sem compra explícita), grava a compra inicial com o custo de aquisição.
      if (type === "sell") {
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
            const initialDate = (
              customInitialInvestmentDate ||
              asset.fixed_income_metadata?.initial_investment_date ||
              asset.fixed_income_metadata?.base_date ||
              date
            ).slice(0, 10);

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

      // Determinação de total_cost_brl na transação:
      // Para compra: custo total em BRL (totalBRL = total * fx_rate)
      // Para venda de Renda Fixa / Valor Completo: custo de aquisição da parcela resgatada (SSOT P&L / Gate v5)
      let txTotalCostBRL = totalBRL;
      if (type === "sell" && isTotalValue) {
        if (appliedCostBasis !== undefined && appliedCostBasis > 0) {
          txTotalCostBRL = appliedCostBasis;
        } else {
          const effectiveAppliedCost =
            asset.fixed_income_metadata?.initial_investment_value !== undefined &&
            asset.fixed_income_metadata?.initial_investment_value !== null &&
            asset.fixed_income_metadata.initial_investment_value > 0
              ? asset.fixed_income_metadata.initial_investment_value
              : asset.quantity > 1 && asset.average_price > 0
                ? Math.round(asset.quantity * asset.average_price * 100) / 100
                : asset.average_price > 0
                  ? asset.average_price
                  : (asset.fixed_income_metadata?.base_value ?? asset.quantity);
          const currentGross = asset.fixed_income_metadata?.base_value ?? effectiveAppliedCost;
          const prop = currentGross > 0 ? Math.min(1, total / currentGross) : 1;
          txTotalCostBRL = Math.round(effectiveAppliedCost * prop * 100) / 100;
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
        notes: notes ?? undefined,
        fx_rate: asset.currency === "USD" ? rate : undefined,
        total_cost_brl: txTotalCostBRL,
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

          if (asset.currency === "USD") {
            const currentTotalCostBRL =
              asset.total_cost_brl ??
              Math.round(asset.quantity * asset.average_price * (asset.fx_rate_at_purchase ?? rate) * 100) / 100;
            const newTotalCostBRL = Math.round((currentTotalCostBRL + totalBRL) * 100) / 100;
            const newAverageCostBRL =
              lotCalc.newQuantity > 0 ? Math.round((newTotalCostBRL / lotCalc.newQuantity) * 10000) / 10000 : 0;
            const newFxRateAtPurchase =
              lotCalc.newAveragePrice > 0
                ? Math.round((newAverageCostBRL / lotCalc.newAveragePrice) * 10000) / 10000
                : rate;

            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: lotCalc.newQuantity,
                average_price: lotCalc.newAveragePrice,
                total_cost_brl: newTotalCostBRL,
                average_cost_brl: newAverageCostBRL,
                fx_rate_at_purchase: newFxRateAtPurchase,
              },
            });
          } else {
            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: lotCalc.newQuantity,
                average_price: lotCalc.newAveragePrice,
              },
            });
          }
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
            preRedemptionHoldingCost !== undefined && preRedemptionHoldingCost > 0
              ? preRedemptionHoldingCost
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
          let isFullRedemption: boolean;
          let proportion: number;

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
            isFullRedemption = grossBalance > 0
              ? orderAmount >= grossBalance - 0.01
              : orderAmount >= effectiveAppliedCost - 0.01;

            proportion = grossBalance > 0 ? Math.min(1, orderAmount / grossBalance) : 1;
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
              : Math.max(0, Math.round((effectiveAppliedCost - txTotalCostBRL) * 100) / 100);
          } else {
            const currentGrossBalance =
              asset.quantity > 0 && asset.average_price > 0 && asset.quantity !== 1
                ? Math.round(asset.quantity * asset.average_price * 100) / 100
                : asset.average_price > 0
                  ? asset.average_price
                  : asset.quantity;

            const effectiveGross = Math.max(currentGrossBalance, effectiveAppliedCost);
            isFullRedemption = effectiveGross > 0
              ? orderAmount >= effectiveGross - 0.01
              : orderAmount >= effectiveAppliedCost - 0.01;

            proportion = effectiveGross > 0 ? Math.min(1, orderAmount / effectiveGross) : 1;
            remainingGrossBalance = isFullRedemption
              ? 0
              : Math.max(0, Math.round((effectiveGross - orderAmount) * 100) / 100);
            remainingCost = isFullRedemption
              ? 0
              : Math.max(0, Math.round((effectiveAppliedCost - txTotalCostBRL) * 100) / 100);
          }

          const updatedFiMetadata: FixedIncomeMetadata | null =
            asset.fixed_income_metadata
              ? {
                  ...asset.fixed_income_metadata,
                  base_date: asset.fixed_income_metadata.base_date,
                  ...(customInitialInvestmentDate ? { initial_investment_date: customInitialInvestmentDate.slice(0, 10) } : {}),
                  base_value: isFullRedemption
                    ? null
                    : Math.max(
                        0,
                        Math.round(
                          (asset.fixed_income_metadata.base_value ?? effectiveAppliedCost) * (1 - proportion) * 100,
                        ) / 100,
                      ),
                  initial_investment_value: isFullRedemption ? null : remainingCost,
                }
              : null;

          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: remainingGrossBalance > 0 ? 1 : 0,
              average_price: remainingCost,
              total_cost_brl: remainingCost,
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
          const remainingCostBRL = Math.round(sellResult.remainingQuantity * sellResult.remainingAveragePrice * 100) / 100;
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: sellResult.remainingQuantity,
              average_price: sellResult.remainingAveragePrice,
              total_cost_brl: remainingCostBRL,
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
        } else if (!syncCash && recordWithdrawal && netCreditBRL > 0) {
          // Registra retirada de recursos em portfolio_contributions quando o recurso não for para o Caixa (blinda o TWR)
          await createContrib.mutateAsync({
            amount: -netCreditBRL,
            date,
            asset_id: asset.id,
            notes: notes ? `[Retirada] ${notes}` : `Retirada de recursos em ${asset.ticker}`,
          });
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
    onSuccess: (_result, params) => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      const txDate = (params.date ?? "").slice(0, 10);
      if (
        (params.type === "buy" || params.type === "sell" || params.type === "subscription") &&
        txDate >= todayISO()
      ) {
        void triggerSurgicalQuoteSync(queryClient, {
          assets: [params.asset],
          reason: "post_trade_stale",
        });
      }
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

export const LAST_BATCH_APORTE_STORAGE_KEY = "axir_last_batch_aporte";

export interface LastBatchAporteSession {
  batchId: string;
  executedAt: number;
  itemsCount: number;
  totalAmount: number;
}

/**
 * Executa o aporte inteligente em lote via RPC transacional (§F36 + Fase 3).
 * Atualiza posições, lança as compras em portfolio_transactions com batch_id e registra a contribuição.
 * Permite Undo atômico via toast de ação e armazena o lote recente em sessionStorage.
 */
export function useExecutePortfolioBatchAporte() {
  const queryClient = useQueryClient();
  const revertMutation = useRevertPortfolioBatchAporte();

  return useMutation({
    mutationFn: async (params: ExecutePortfolioBatchAporteParams) => {
      const batchId =
        params.batchId && params.batchId.trim().length > 0 ? params.batchId.trim() : generateBatchId();
      const enrichedParams: ExecutePortfolioBatchAporteParams = {
        ...params,
        batchId,
      };
      const ok = await executePortfolioBatchAporte(enrichedParams);
      return { success: ok, batchId };
    },
    onSuccess: (result, params) => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      if ((params.date ?? "").slice(0, 10) >= todayISO()) {
        const cachedAssets =
          queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
        const assetMap = new Map(cachedAssets.map((a) => [a.id, a]));
        const batchAssets = params.items
          .map((item) => assetMap.get(item.asset_id))
          .filter((a): a is PortfolioAsset => Boolean(a));
        if (batchAssets.length > 0) {
          void triggerSurgicalQuoteSync(queryClient, {
            assets: batchAssets,
            reason: "post_trade_stale",
          });
        }
      }
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const sessionData: LastBatchAporteSession = {
            batchId: result.batchId,
            executedAt: Date.now(),
            itemsCount: params.items.length,
            totalAmount: params.totalAmount,
          };
          window.sessionStorage.setItem(LAST_BATCH_APORTE_STORAGE_KEY, JSON.stringify(sessionData));
        } catch {
          // No-op para ambientes sem sessionStorage
        }
      }

      pushToast({
        title: "Aportes aplicados à carteira",
        description: `Posições de ${params.items.length} ativos atualizadas e compras lançadas com sucesso.`,
        variant: "success",
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: () => {
            revertMutation.mutate(result.batchId);
          },
        },
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

/**
 * Reverte de forma transacional e atômica um lote de aportes executado (Undo ACID - Fase 3).
 * Restaura quantidade e preço médio anteriores, cancela débito de Caixa e apaga compras do lote.
 */
export function useRevertPortfolioBatchAporte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => revertPortfolioBatchAporte(batchId),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(LAST_BATCH_APORTE_STORAGE_KEY);
        } catch {
          // No-op
        }
      }
      pushToast({
        title: "Lote de aportes revertido",
        description: "As compras e posições foram restauradas com sucesso.",
        variant: "info",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Não foi possível desfazer o lote",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}
