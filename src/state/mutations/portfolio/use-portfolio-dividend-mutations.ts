import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveDividendsBatchRpc,
  confirmUserDividendEventsRpc,
  dismissUserDividendEventRpc,
  dismissUserDividendEventsAtomicRpc,
  revertConfirmedDividendEventsRpc,
  writeUserDividendEdge,
} from "@/data/rpc";
import { consolidateAssetPrices, type AssetPriceRow } from "@/data/repositories/asset-prices";
import {
  createManualUserDividendEvent,
  deleteUserDividendEvent,
  updateUserDividendEvent,
  type CreateManualUserDividendEventInput,
} from "@/data/repositories/portfolio";
import { FALLBACK_USD_RATE, usdRateFromPrices } from "@/domain/portfolio/valuation";
import { validateDividendReversalSafeguard } from "@/domain/portfolio/dividend-cash-governance";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type {
  ApproveDividendsBatchPayload,
  ConfirmDividendEventsPayload,
  DbInsert,
  PortfolioAsset,
  PortfolioDividend,
  PortfolioDividendDismissalReason,
  UserDividendEvent,
  WriteUserDividendResult,
} from "@/types";
import { PORTFOLIO_QUERY_KEYS, invalidatePortfolioSuite } from "./portfolio-keys";

function assertDividendOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Sem conexão. Conecte-se para salvar.");
  }
}

function resolveDividendRequestId(requestId?: string | null): string {
  if (requestId && requestId.trim().length > 0) {
    return requestId.trim();
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type CreatePortfolioDividendMutationInput = Omit<DbInsert<PortfolioDividend>, "user_id"> & {
  request_id?: string | null;
  create_transaction?: boolean;
  tx_type?: "dividend" | "jcp" | "fii_yield";
  fx_rate?: number | null;
};

export function useCreatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (input: CreatePortfolioDividendMutationInput): Promise<WriteUserDividendResult> => {
      assertDividendOnline();
      return writeUserDividendEdge({
        op: "create",
        request_id: resolveDividendRequestId(input.request_id),
        asset_id: input.asset_id,
        ticker: input.ticker,
        amount: input.amount,
        date: input.date,
        notes: input.notes ?? null,
        sync_cash: Boolean(input.sync_cash),
        cash_amount: input.cash_amount ?? null,
        create_transaction: Boolean(input.create_transaction),
        tx_type: input.tx_type ?? "dividend",
        fx_rate: input.fx_rate ?? null,
      });
    },
    onSuccess: (result) => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      const reconciledCount = result.linked_event_ids?.length ?? 0;
      pushToast({
        title: reconciledCount > 0 ? "Provento registrado e conciliado" : "Provento registrado",
        description:
          reconciledCount > 0
            ? "O rendimento foi salvo no extrato e conciliado com os eventos da agenda."
            : "O rendimento foi salvo no extrato de proventos.",
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

export function useUpdatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (params: {
      id: string;
      patch: Partial<Omit<PortfolioDividend, "id" | "user_id" | "created_at">>;
      syncCash?: boolean;
      previousSyncCash?: boolean;
      previousCashAmount?: number;
      expected_updated_at?: string | null;
    }): Promise<WriteUserDividendResult> => {
      assertDividendOnline();
      const { id, patch, syncCash, expected_updated_at } = params;
      const cachedDivs =
        queryClient.getQueryData<PortfolioDividend[]>(PORTFOLIO_QUERY_KEYS.dividends) ?? [];
      const existingDiv = cachedDivs.find((d) => d.id === id);

      let resolvedCashAmount = patch.cash_amount;
      if (syncCash !== undefined) {
        if (!syncCash) {
          resolvedCashAmount = null;
        } else if (patch.cash_amount !== undefined && patch.cash_amount !== null) {
          resolvedCashAmount = Number(patch.cash_amount) || 0;
        } else if (patch.amount !== undefined) {
          const rawAmount = Number(patch.amount) || 0;
          const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
          const targetAssetId = patch.asset_id ?? existingDiv?.asset_id;
          const targetAsset = cachedAssets.find((a) => a.id === targetAssetId);
          if (targetAsset?.currency === "USD") {
            const cachedPrices =
              queryClient.getQueryData<AssetPriceRow[]>(PORTFOLIO_QUERY_KEYS.assetPrices) ?? [];
            const liveFx = usdRateFromPrices(
              consolidateAssetPrices(cachedPrices),
              FALLBACK_USD_RATE,
            );
            resolvedCashAmount = Math.round(rawAmount * liveFx * 100) / 100;
          } else {
            resolvedCashAmount = rawAmount;
          }
        }
      }

      return writeUserDividendEdge({
        op: "update",
        id,
        expected_updated_at: expected_updated_at !== undefined ? expected_updated_at : (existingDiv?.updated_at ?? null),
        amount: patch.amount,
        date: patch.date,
        notes: patch.notes,
        sync_cash: syncCash !== undefined ? syncCash : Boolean(patch.sync_cash),
        cash_amount: resolvedCashAmount,
      });
    },
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      pushToast({
        title: "Provento atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "info",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
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
      sync_cash?: boolean | null;
      cash_amount?: number | null;
      rollbackCash?: boolean;
    };

export function useDeletePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (
      input: DeletePortfolioDividendInput,
    ): Promise<{ result: WriteUserDividendResult; deletedSnapshot: PortfolioDividend | null }> => {
      assertDividendOnline();
      const id = typeof input === "string" ? input : input.id;
      const rollbackCash = typeof input !== "string" ? Boolean(input.rollbackCash) : false;

      const cached = queryClient.getQueryData<PortfolioDividend[]>(PORTFOLIO_QUERY_KEYS.dividends) ?? [];
      const match = cached.find((d) => d.id === id) ?? null;

      const result = await writeUserDividendEdge({
        op: "delete",
        id,
        rollback_cash: rollbackCash,
      });

      return { result, deletedSnapshot: match };
    },
    onSuccess: ({ result, deletedSnapshot }) => {
      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      const hasShortfall = (result.cash_shortfall_brl ?? 0) > 0.01;
      const description = hasShortfall
        ? "O rendimento foi removido e o Caixa foi zerado sem ficar negativo (saldo insuficiente para estorno integral)."
        : "O rendimento e a operação vinculada foram removidos.";

      pushToast({
        title: "Provento excluído",
        description,
        variant: hasShortfall ? "warning" : "info",
        duration: 10000,
        ...(deletedSnapshot
          ? {
              action: {
                label: "Desfazer",
                onClick: () => {
                  void writeUserDividendEdge({
                    op: "create",
                    request_id: resolveDividendRequestId(null),
                    asset_id: deletedSnapshot.asset_id,
                    ticker: deletedSnapshot.ticker,
                    amount: deletedSnapshot.amount,
                    date: deletedSnapshot.date,
                    notes: deletedSnapshot.notes ?? null,
                    sync_cash: Boolean(deletedSnapshot.sync_cash),
                    cash_amount: deletedSnapshot.cash_amount ?? null,
                  })
                    .then(() => {
                      void invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
                      triggerSensory("success");
                    })
                    .catch((err) => {
                      pushToast({
                        title: "Não foi possível desfazer",
                        description: getErrorMessage(err),
                        variant: "destructive",
                      });
                    });
                },
              },
            }
          : {}),
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

/**
 * Hook para aprovação atômica em lote de proventos corporativos elegíveis
 * com suporte a estorno seguro (Undo) com salvaguarda de reinvestimento.
 */
export function useApproveDividendsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApproveDividendsBatchPayload) => {
      return approveDividendsBatchRpc(payload);
    },
    onSuccess: (result, variables) => {
      void invalidatePortfolioSuite(queryClient);

      triggerSensory("success");

      const count = result.inserted_count;
      const totalFormatted = result.total_cash.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      pushToast({
        title: count === 1 ? "Provento creditado com sucesso" : `${count} proventos creditados com sucesso`,
        description: variables.sync_cash
          ? `${totalFormatted} creditados no ativo Caixa da carteira.`
          : `${totalFormatted} registrados em proventos recebidos.`,
        variant: "success",
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const corpIds = variables.dividends
                .map((d) => d.corporate_dividend_id)
                .filter((cid): cid is string => Boolean(cid));

              const undoRes = await revertConfirmedDividendEventsRpc({
                dividendIds: result.inserted_ids ?? [],
                eventIds: [],
                corporateIds: corpIds,
              });

              if (variables.sync_cash && result.total_cash > 0) {
                const shortfall = Math.max(
                  0,
                  Math.round((result.total_cash - undoRes.reverted_cash_brl) * 100) / 100,
                );
                if (shortfall > 0.01) {
                  const reversal = validateDividendReversalSafeguard(
                    undoRes.reverted_cash_brl,
                    result.total_cash,
                  );
                  if (!reversal.isSafe) {
                    pushToast({
                      title: "Atenção ao estorno de Caixa",
                      description: reversal.warningMessage,
                      variant: "warning",
                      duration: 6000,
                    });
                  }
                }
              }

              void invalidatePortfolioSuite(queryClient);

              triggerSensory("warning");
              pushToast({
                title: "Aprovação desfeita",
                description: "Os lançamentos foram removidos com sucesso.",
                variant: "default",
              });
            } catch (undoErr) {
              pushToast({
                title: "Erro ao desfazer",
                description: getErrorMessage(undoErr),
                variant: "destructive",
              });
            }
          },
        },
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao aprovar proventos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para ignorar / dispensar um provento corporativo sugerido.
 */
export function useDismissCorporateDividend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      corporateDividendId,
      reason = "manual_ignore",
    }: {
      corporateDividendId: string;
      reason?: PortfolioDividendDismissalReason;
    }) => {
      return dismissUserDividendEventRpc({
        corporateDividendId,
        reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.userDividendEvents });
      triggerSensory("action");
      pushToast({
        title: "Provento ignorado",
        description: "O provento não será mais sugerido na carteira.",
        variant: "default",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao ignorar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/**
 * Confirma e liquida eventos de proventos (automatizados ou provisionados manualmente)
 * com valores editáveis, imposto explícito, conversão USD -> BRL no Caixa e Undo seguro.
 */
export function useConfirmUserDividendEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConfirmDividendEventsPayload) =>
      confirmUserDividendEventsRpc(payload),
    onSuccess: (result, variables) => {
      void invalidatePortfolioSuite(queryClient);
      triggerSensory("success");

      const count = result.inserted_count;
      const totalFormatted = result.total_cash.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      pushToast({
        title: count === 1 ? "Provento confirmado" : `${count} proventos confirmados`,
        description:
          variables.sync_cash !== false
            ? `${totalFormatted} creditados no Caixa da carteira.`
            : `${totalFormatted} registrados no extrato de proventos.`,
        variant: "success",
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const corpIds = variables.items
                .map((item) => item.corporate_dividend_id)
                .filter((cid): cid is string => Boolean(cid));

              const undoRes = await revertConfirmedDividendEventsRpc({
                dividendIds: result.inserted_ids ?? [],
                eventIds: result.settled_event_ids ?? [],
                corporateIds: corpIds,
              });

              if (variables.sync_cash !== false && result.total_cash > 0) {
                const shortfall = Math.max(
                  0,
                  Math.round((result.total_cash - undoRes.reverted_cash_brl) * 100) / 100,
                );
                if (shortfall > 0.01) {
                  const reversal = validateDividendReversalSafeguard(
                    undoRes.reverted_cash_brl,
                    result.total_cash,
                  );
                  if (!reversal.isSafe) {
                    pushToast({
                      title: "Atenção ao estorno de Caixa",
                      description: reversal.warningMessage,
                      variant: "warning",
                      duration: 6000,
                    });
                  }
                }
              }
              void invalidatePortfolioSuite(queryClient);
              triggerSensory("warning");
              pushToast({
                title: "Confirmação desfeita",
                description: "Os proventos voltaram para a fila de conferência.",
                variant: "default",
              });
            } catch (undoErr) {
              pushToast({
                title: "Erro ao desfazer",
                description: getErrorMessage(undoErr),
                variant: "destructive",
              });
            }
          },
        },
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao confirmar proventos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/** Registra um provisionamento manual de provento na fila do usuário. */
export function useCreateManualUserDividendEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualUserDividendEventInput) =>
      createManualUserDividendEvent(input),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      triggerSensory("success");
      pushToast({
        title: "Provento provisionado",
        description: "O provento foi adicionado à agenda sem afetar o Caixa até o pagamento.",
        variant: "success",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao provisionar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/** Atualiza um evento de provento do usuário. */
export function useUpdateUserDividendEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          UserDividendEvent,
          | "status"
          | "payment_date"
          | "net_amount"
          | "gross_amount"
          | "tax_rate_pct"
          | "type"
          | "notes"
          | "dismiss_reason"
          | "settled_dividend_id"
          | "settlement_origin"
          | "fx_rate_applied"
        >
      >;
    }) => updateUserDividendEvent(id, patch),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      triggerSensory("success");
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao atualizar evento de provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/** Dispensa/ignora um evento de provento (persiste em `user_dividend_events` e/ou legado). */
export function useDismissUserDividendEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      corporateDividendId,
      assetId,
      reason = "manual_ignore",
    }: {
      eventId?: string | null;
      corporateDividendId?: string | null;
      assetId?: string | null;
      reason?: PortfolioDividendDismissalReason;
    }) => {
      return dismissUserDividendEventRpc({
        eventId: eventId ?? null,
        corporateDividendId: corporateDividendId ?? null,
        assetId: assetId ?? null,
        reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.userDividendEvents });
      triggerSensory("action");
      pushToast({
        title: "Provento dispensado",
        description: "O provento foi removido das pendências da carteira.",
        variant: "default",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao dispensar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/** Dispensa em lote eventos de provento com atomicidade e Undo. */
export function useDismissUserDividendEventsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (params: {
      ids: string[];
      revisions?: number[] | null;
      reason?: string;
    }) => {
      assertDividendOnline();
      const cachedEvents =
        queryClient.getQueryData<UserDividendEvent[]>(PORTFOLIO_QUERY_KEYS.userDividendEvents) ?? [];
      const previousStatuses = new Map(cachedEvents.map((ev) => [ev.id, ev.status]));
      const result = await dismissUserDividendEventsAtomicRpc(params);
      return { result, previousStatuses };
    },
    onSuccess: ({ result, previousStatuses }) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.userDividendEvents });
      triggerSensory("action");
      const count = result.dismissed_ids.length;
      pushToast({
        title: count > 1 ? `${count} proventos dispensados` : "Provento dispensado",
        description: "Os itens foram removidos das pendências da carteira.",
        variant: "default",
        duration: 10000,
        ...(count > 0
          ? {
              action: {
                label: "Desfazer",
                onClick: () => {
                  void Promise.all(
                    result.dismissed_ids.map((id) =>
                      updateUserDividendEvent(id, {
                        status: previousStatuses.get(id) ?? "PENDING_CONFIRMATION",
                      }),
                    ),
                  )
                    .then(() => {
                      void invalidatePortfolioSuite(queryClient);
                      triggerSensory("success");
                    })
                    .catch((err) => {
                      pushToast({
                        title: "Não foi possível desfazer",
                        description: getErrorMessage(err),
                        variant: "destructive",
                      });
                    });
                },
              },
            }
          : {}),
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao dispensar proventos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/** Remove um evento manual de provento provisionado. */
export function useDeleteUserDividendEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUserDividendEvent(id),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      triggerSensory("destructive");
      pushToast({
        title: "Provisionamento excluído",
        description: "O evento manual foi removido da agenda.",
        variant: "info",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao excluir provisionamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}
