import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Coins,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  PercentInput,
  Select,
  Skeleton,
  Tabs,
  type SelectOption,
  type TabItem,
} from "@/components/ui";
import { numberToCents } from "@/domain/money";
import {
  FALLBACK_USD_RATE,
  getCustodyAtComDate,
  isCashAssetClass,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  todaySaoPauloISO,
  type SuggestedDividendItem,
} from "@/domain/portfolio";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { formatDateBR } from "@/lib/date";
import { formatAssetQuantity } from "@/services/formatting";
import {
  subscribeDividendReviewModal,
  type DividendReviewModalTab,
} from "@/services/dividend-review-modal";
import { formatFxRate } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import {
  useAllPortfolioTransactions,
  useConfirmUserDividendEvents,
  useCorporateDividends,
  useCreateManualUserDividendEvent,
  useDeleteUserDividendEvent,
  useDismissUserDividendEvent,
  usePortfolioAssets,
  useUserPreferences,
} from "@/state";
import type { ConfirmDividendEventItem, CorporateDividendType } from "@/types";

export interface PendingDividendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDividends: SuggestedDividendItem[];
  projectedDividends: SuggestedDividendItem[];
  fxRate?: number;
  initialTab?: DividendReviewModalTab;
  requestSeq?: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

interface RowOverrideState {
  type: CorporateDividendType;
  taxRatePct: number;
  netAmount: number;
  grossBase: number;
}

const DIVIDEND_TYPE_OPTIONS: SelectOption[] = [
  { value: "DIVIDENDO", label: "Dividendo (Isento B3)" },
  { value: "JCP", label: "JCP (15% IRRF)" },
  { value: "RENDIMENTO", label: "Rendimento FII / ETF" },
  { value: "AMORTIZACAO", label: "Amortização" },
  { value: "SOBRA", label: "Sobra / Restituição" },
  { value: "OUTROS", label: "Outros" },
];

function getItemKey(item: SuggestedDividendItem): string {
  return item.eventId ?? `${item.corporateDividendId}:${item.assetId}`;
}

function getDefaultTaxForType(
  type: string,
  currency: "BRL" | "USD",
): number {
  if (currency === "USD") return 30;
  return type === "JCP" ? 15 : 0;
}

function computeInitialGrossBase(item: SuggestedDividendItem): number {
  if (item.grossAmount > 0) return item.grossAmount;
  const tax = item.taxRatePct ?? getDefaultTaxForType(item.type, item.currency);
  if (tax > 0 && tax < 100 && item.totalAmount > 0) {
    return Math.round((item.totalAmount / (1 - tax / 100)) * 100) / 100;
  }
  return item.totalAmount;
}

/**
 * Modal único de revisão, edição fiscal/líquida e provisionamento manual de proventos.
 */
export function PendingDividendsDialog({
  open,
  onOpenChange,
  availableDividends,
  projectedDividends,
  fxRate: fxRateProp,
  initialTab = "review",
  requestSeq = 0,
  isLoading = false,
  isError = false,
  onRetry,
}: PendingDividendsDialogProps) {
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "investments",
  });
  const { data: userPreferences } = useUserPreferences();
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const confirmMutation = useConfirmUserDividendEvents();
  const dismissMutation = useDismissUserDividendEvent();
  const createManualMutation = useCreateManualUserDividendEvent();
  const deleteManualMutation = useDeleteUserDividendEvent();

  const effectiveFx = fxRateProp && fxRateProp > 0 ? fxRateProp : FALLBACK_USD_RATE;
  const defaultAutoCreditCash =
    userPreferences?.custom_settings?.dividendAutomation?.autoCreditCash !== false;

  const [activeTabOverride, setActiveTabOverride] = useState<DividendReviewModalTab | null>(null);
  const [prevRequestKey, setPrevRequestKey] = useState<string>(`${initialTab}:${requestSeq}`);
  const currentRequestKey = `${initialTab}:${requestSeq}`;
  if (currentRequestKey !== prevRequestKey) {
    setPrevRequestKey(currentRequestKey);
    setActiveTabOverride(null);
  }

  const [syncCashOverride, setSyncCashOverride] = useState<boolean | null>(null);
  const [deselectedKeys, setDeselectedKeys] = useState<Set<string>>(() => new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RowOverrideState>>({});

  const activeTab = activeTabOverride ?? initialTab;
  const syncCash = syncCashOverride ?? defaultAutoCreditCash;

  // Estado da aba de provisionamento manual
  const eligibleAssets = useMemo(() => {
    return (assetsQuery.data ?? []).filter(
      (a) =>
        Number(a.quantity) > 0 &&
        !isCashAssetClass(a.asset_class) &&
        !(isFixedIncomeClass(a.asset_class) && !isTesouroAsset(a.ticker, a.asset_class)) &&
        !isPrivateFixedIncomeTicker(a.ticker),
    );
  }, [assetsQuery.data]);

  const [manualAssetId, setManualAssetId] = useState<string>("");
  const effectiveManualAssetId = manualAssetId || eligibleAssets[0]?.id || "";
  const [manualType, setManualType] = useState<CorporateDividendType>("DIVIDENDO");
  const [manualComDate, setManualComDate] = useState<string>(() => todaySaoPauloISO());
  const [manualPaymentDate, setManualPaymentDate] = useState<string>("");
  const [manualNetCents, setManualNetCents] = useState<number>(0);
  const [manualTaxPctOverride, setManualTaxPctOverride] = useState<number | null>(null);
  const [manualNotes, setManualNotes] = useState<string>("");

  const availableKeys = useMemo(
    () => availableDividends.map(getItemKey),
    [availableDividends],
  );

  const selectedKeys = useMemo(
    () => new Set(availableKeys.filter((key) => !deselectedKeys.has(key))),
    [availableKeys, deselectedKeys],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDeselectedKeys(new Set());
      setEditingKey(null);
      setOverrides({});
      setActiveTabOverride(null);
      setSyncCashOverride(null);
      setManualAssetId("");
      setManualType("DIVIDENDO");
      setManualComDate(todaySaoPauloISO());
      setManualPaymentDate("");
      setManualNetCents(0);
      setManualTaxPctOverride(null);
      setManualNotes("");
    }
    onOpenChange(next);
  };

  const getEffectiveRow = useCallback(
    (item: SuggestedDividendItem): RowOverrideState => {
      const key = getItemKey(item);
      const ov = overrides[key];
      if (ov) return ov;
      return {
        type: (item.type as CorporateDividendType) || "DIVIDENDO",
        taxRatePct: item.taxRatePct ?? getDefaultTaxForType(item.type, item.currency),
        netAmount: item.totalAmount,
        grossBase: computeInitialGrossBase(item),
      };
    },
    [overrides],
  );

  const setRowOverride = (
    item: SuggestedDividendItem,
    updater: (curr: RowOverrideState) => RowOverrideState,
  ) => {
    const key = getItemKey(item);
    setOverrides((prev) => {
      const current = prev[key] ?? {
        type: (item.type as CorporateDividendType) || "DIVIDENDO",
        taxRatePct: item.taxRatePct ?? getDefaultTaxForType(item.type, item.currency),
        netAmount: item.totalAmount,
        grossBase: computeInitialGrossBase(item),
      };
      return { ...prev, [key]: updater(current) };
    });
  };

  const allAvailableSelected = useMemo(
    () =>
      availableDividends.length > 0 &&
      availableDividends.every((d) => selectedKeys.has(getItemKey(d))),
    [availableDividends, selectedKeys],
  );

  const selectedItems = useMemo(
    () => availableDividends.filter((d) => selectedKeys.has(getItemKey(d))),
    [availableDividends, selectedKeys],
  );

  const selectedSummary = useMemo(() => {
    let totalBRLCents = 0;
    let totalUSDCents = 0;
    let hasUsd = false;
    let hasUncertain = false;

    for (const item of selectedItems) {
      const eff = getEffectiveRow(item);
      const cents = Math.round(eff.netAmount * 100);
      if (item.currency === "USD") {
        hasUsd = true;
        totalUSDCents += cents;
        totalBRLCents += Math.round(cents * effectiveFx);
      } else {
        totalBRLCents += cents;
      }
      if (item.isTypeUncertain) {
        hasUncertain = true;
      }
    }

    return { totalBRLCents, totalUSDCents, hasUsd, hasUncertain };
  }, [selectedItems, getEffectiveRow, effectiveFx]);

  const handleToggleAll = (checked: boolean) => {
    setDeselectedKeys(checked ? new Set() : new Set(availableKeys));
  };

  const handleToggleOne = (item: SuggestedDividendItem, checked: boolean) => {
    const key = getItemKey(item);
    setDeselectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasInvalidSelectedAmount = useMemo(
    () => selectedItems.some((item) => getEffectiveRow(item).netAmount <= 0),
    [selectedItems, getEffectiveRow],
  );

  const buildConfirmItem = (
    d: SuggestedDividendItem,
    options?: { capEarlyDate?: boolean },
  ): ConfirmDividendEventItem => {
    const eff = getEffectiveRow(d);
    const today = todaySaoPauloISO();
    const rawPayDate = d.paymentDate ?? today;
    const paymentIso = options?.capEarlyDate && rawPayDate > today ? today : rawPayDate;
    const qty = Math.max(0, d.quantityOnComDate);
    const netRate = qty > 0 ? Math.round((eff.netAmount / qty) * 100_000_000) / 100_000_000 : d.netRate;

    return {
      event_id: d.eventId ?? null,
      corporate_dividend_id: d.isManual ? null : d.corporateDividendId,
      asset_id: d.assetId,
      ticker: d.ticker,
      type: eff.type,
      com_date: d.comDate,
      date: paymentIso,
      amount: Math.round(eff.netAmount * 100) / 100,
      tax_rate_pct: eff.taxRatePct,
      quantity_on_com_date: qty,
      gross_rate: d.rate,
      net_rate: netRate,
      currency: d.currency,
      fx_rate: d.currency === "USD" ? effectiveFx : null,
      notes: d.isManual
        ? (d.notes?.trim() || `Provento manual (${eff.type})`)
        : `Provento automático (${eff.type}${eff.taxRatePct > 0 ? ` · ${formatPercent(eff.taxRatePct)}% IR` : ""})`,
    };
  };

  const handleConfirmSelected = () => {
    if (selectedItems.length === 0 || hasInvalidSelectedAmount || confirmMutation.isPending) return;
    guardAction(() => {
      void (async () => {
        try {
          await confirmMutation.mutateAsync({
            items: selectedItems.map((item) => buildConfirmItem(item)),
            sync_cash: syncCash,
          });
          handleOpenChange(false);
        } catch {
          // O hook já exibe toast de erro; mantém modal aberto
        }
      })();
    });
  };

  const handleSettleProvisionedNow = (item: SuggestedDividendItem) => {
    if (confirmMutation.isPending || getEffectiveRow(item).netAmount <= 0) return;
    guardAction(() => {
      void (async () => {
        try {
          await confirmMutation.mutateAsync({
            items: [buildConfirmItem(item, { capEarlyDate: true })],
            sync_cash: syncCash,
          });
        } catch {
          // O hook já exibe toast de erro
        }
      })();
    });
  };

  const selectedManualAsset = useMemo(
    () => eligibleAssets.find((a) => a.id === effectiveManualAssetId) ?? null,
    [eligibleAssets, effectiveManualAssetId],
  );

  const manualTaxPct =
    manualTaxPctOverride ?? getDefaultTaxForType(manualType, selectedManualAsset?.currency ?? "BRL");

  const manualCustodyQty = useMemo(() => {
    if (!selectedManualAsset) return 0;
    return getCustodyAtComDate(
      selectedManualAsset,
      transactionsQuery.data ?? [],
      manualComDate || todaySaoPauloISO(),
    );
  }, [selectedManualAsset, transactionsQuery.data, manualComDate]);

  const handleCreateManual = () => {
    if (
      !selectedManualAsset ||
      manualNetCents <= 0 ||
      !manualComDate ||
      createManualMutation.isPending
    ) {
      return;
    }
    guardAction(() => {
      void (async () => {
        const netAmount = manualNetCents / 100;
        const today = todaySaoPauloISO();
        const cleanPay = manualPaymentDate ? manualPaymentDate.slice(0, 10) : null;
        const status =
          cleanPay !== null && cleanPay <= today ? "PENDING_CONFIRMATION" : "PROVISIONED";

        try {
          await createManualMutation.mutateAsync({
            asset_id: selectedManualAsset.id,
            ticker: selectedManualAsset.ticker,
            type: manualType,
            com_date: manualComDate.slice(0, 10),
            payment_date: cleanPay,
            quantity_on_com_date: manualCustodyQty > 0 ? manualCustodyQty : selectedManualAsset.quantity,
            tax_rate_pct: manualTaxPct,
            net_amount: netAmount,
            currency: selectedManualAsset.currency === "USD" ? "USD" : "BRL",
            status,
            notes: manualNotes.trim() || null,
          });

          setManualNetCents(0);
          setManualTaxPctOverride(null);
          setManualNotes("");
          setManualPaymentDate("");
          setActiveTabOverride("review");
        } catch {
          // O hook já exibe toast de erro
        }
      })();
    });
  };

  const handleDismissItem = (item: SuggestedDividendItem) => {
    if (dismissMutation.isPending) return;
    guardAction(() => {
      void dismissMutation
        .mutateAsync({
          eventId: item.eventId,
          corporateDividendId: item.isManual ? null : item.corporateDividendId,
          assetId: item.assetId,
          reason: "manual_ignore",
        })
        .catch(() => undefined);
    });
  };

  const handleDeleteManualEvent = (eventId: string) => {
    if (deleteManualMutation.isPending) return;
    guardAction(() => {
      void deleteManualMutation.mutateAsync(eventId).catch(() => undefined);
    });
  };

  const renderTaxAndSourceBadges = (item: SuggestedDividendItem, eff: RowOverrideState) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge size="xs" variant={eff.type === "JCP" ? "warning" : "muted"}>
        {eff.type}
      </Badge>
      {item.currency === "USD" ? (
        <Badge size="xs" variant="portfolio">
          EUA · {formatPercent(eff.taxRatePct)}% IR
        </Badge>
      ) : eff.taxRatePct > 0 ? (
        <Badge size="xs" variant="warning">
          {formatPercent(eff.taxRatePct)}% IR
        </Badge>
      ) : null}
      {item.isTypeUncertain ? (
        <Badge size="xs" variant="warning">
          Alíquota a conferir (Yahoo)
        </Badge>
      ) : null}
      {item.isManual ? (
        <Badge size="xs" variant="muted">
          Manual
        </Badge>
      ) : null}
    </div>
  );

  const reviewContent = isLoading ? (
    <div className="flex flex-col gap-3 py-2" aria-busy="true">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  ) : isError ? (
    <div className="py-2">
      <ErrorState
        message="Não foi possível carregar os proventos pendentes e provisionados."
        onRetry={onRetry}
      />
    </div>
  ) : (
    <div className="flex flex-col gap-4 py-1">
      {selectedSummary.hasUncertain ? (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground"
        >
          <AlertTriangle className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold">Conferência fiscal recomendada</span>
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              Alguns proventos vieram do fallback Yahoo sem distinção automática entre Dividendo e JCP.
              Use o botão editar em cada linha se precisar ajustar tipo, alíquota de IR ou valor líquido.
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allAvailableSelected}
              onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
              disabled={availableDividends.length === 0}
              aria-label="Selecionar todos os proventos a confirmar"
            />
            <span className="text-xs font-semibold text-foreground">
              A Confirmar ({availableDividends.length})
            </span>
          </div>
          {selectedSummary.totalBRLCents > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span>
                {selectedItems.length} de {availableDividends.length} selecionados:
              </span>
              <MoneyText
                cents={selectedSummary.totalBRLCents}
                tone="positive"
                className="text-xs font-semibold"
              />
              {selectedSummary.hasUsd && selectedSummary.totalUSDCents > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  (inclui{" "}
                  <MoneyText
                    cents={selectedSummary.totalUSDCents}
                    currency="USD"
                    tone="default"
                    className="inline text-[11px] font-medium text-foreground"
                  />{" "}
                  · câmbio R$ {formatFxRate(effectiveFx)})
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {availableDividends.length === 0 ? (
          <EmptyState
            title="Nenhum provento aguardando confirmação"
            description="Quando a data de pagamento chegar ou você provisionar manualmente, os lançamentos aparecerão aqui para conferência."
            headingLevel="h3"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface">
            {availableDividends.map((div) => {
              const key = getItemKey(div);
              const eff = getEffectiveRow(div);
              const isEditing = editingKey === key;
              const isSelected = selectedKeys.has(key);

              return (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between py-2.5 px-3 gap-3 hover:bg-surface-hover/40 transition-colors">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleOne(div, Boolean(checked))}
                        aria-label={`Selecionar provento de ${div.ticker}`}
                      />
                      <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs font-mono text-foreground">
                            {div.ticker}
                          </span>
                          {renderTaxAndSourceBadges(div, eff)}
                        </div>
                        <span className="text-[11px] text-muted-foreground break-words">
                          {formatAssetQuantity(div.quantityOnComDate)} cotas em{" "}
                          {formatDateBR(div.comDate)} ·{" "}
                          {div.paymentDate
                            ? `Pagamento ${formatDateBR(div.paymentDate)}`
                            : "Data a definir"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <MoneyText
                        cents={numberToCents(eff.netAmount)}
                        currency={div.currency}
                        tone="default"
                        className="text-xs font-semibold text-right"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Editar tipo, IR ou valor líquido"
                        aria-label={`Editar provento de ${div.ticker}`}
                        onClick={() => setEditingKey(isEditing ? null : key)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Dispensar este provento"
                        aria-label={`Ignorar provento de ${div.ticker}`}
                        onClick={() => handleDismissItem(div)}
                        disabled={isReadOnlyMode || dismissMutation.isPending}
                      >
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="px-3 pb-3 pt-2 bg-muted/25 border-t border-border/80 flex flex-col gap-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-foreground">
                            Tipo
                          </label>
                          <Select
                            value={eff.type}
                            options={DIVIDEND_TYPE_OPTIONS}
                            ariaLabel={`Tipo do provento de ${div.ticker}`}
                            onValueChange={(nextType) => {
                              const typed = nextType as CorporateDividendType;
                              setRowOverride(div, (curr) => {
                                const nextTax = getDefaultTaxForType(typed, div.currency);
                                const nextNet =
                                  Math.round(curr.grossBase * (1 - nextTax / 100) * 100) / 100;
                                return {
                                  ...curr,
                                  type: typed,
                                  taxRatePct: nextTax,
                                  netAmount: nextNet > 0 ? nextNet : curr.netAmount,
                                };
                              });
                            }}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-foreground">
                            IR Retido (%)
                          </label>
                          <PercentInput
                            size="sm"
                            maxValue={100}
                            value={eff.taxRatePct}
                            aria-label={`Alíquota IR de ${div.ticker}`}
                            onValueChange={(nextPct) => {
                              const clamped = Math.max(0, Math.min(100, nextPct));
                              setRowOverride(div, (curr) => {
                                const nextNet =
                                  Math.round(curr.grossBase * (1 - clamped / 100) * 100) / 100;
                                return {
                                  ...curr,
                                  taxRatePct: clamped,
                                  netAmount: nextNet,
                                };
                              });
                            }}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-foreground">
                            Valor Líquido ({div.currency})
                          </label>
                          <MoneyInput
                            size="sm"
                            currency={div.currency}
                            cents={numberToCents(eff.netAmount)}
                            aria-label={`Valor líquido de ${div.ticker}`}
                            aria-invalid={eff.netAmount <= 0}
                            onCentsChange={(cents) => {
                              setRowOverride(div, (curr) => ({
                                ...curr,
                                netAmount: cents / 100,
                              }));
                            }}
                          />
                          {eff.netAmount <= 0 ? (
                            <span role="alert" className="text-[11px] text-critical-strong">
                              Deve ser maior que zero
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => setEditingKey(null)}
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          Concluir edição
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Opção explícita de crédito em CAIXA */}
      {availableDividends.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Checkbox
                id="credit-dividend-cash-toggle"
                checked={syncCash}
                onCheckedChange={(checked) => setSyncCashOverride(Boolean(checked))}
                aria-label="Creditar no Caixa da carteira"
              />
              <label
                htmlFor="credit-dividend-cash-toggle"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Creditar no Caixa da carteira
              </label>
            </div>
            <Coins className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
            {selectedSummary.hasUsd
              ? `Ativos em USD permanecem na moeda nativa no extrato e creditam em R$ no Caixa pelo câmbio de referência (R$ ${formatFxRate(effectiveFx)}).`
              : "Ao manter marcado, o valor líquido confirmado entra imediatamente no ativo Caixa da carteira."}
          </p>
        </div>
      ) : null}

      {/* Fila Provisionada (futuros ou sem data confirmada) */}
      {projectedDividends.length > 0 ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/80">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                Provisionados — A Receber ({projectedDividends.length})
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Fora do Patrimônio e do Caixa até o pagamento
            </span>
          </div>
          <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface">
            {projectedDividends.map((div) => {
              const eff = getEffectiveRow(div);
              return (
                <div
                  key={getItemKey(div)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-3 gap-2.5 text-xs"
                >
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold font-mono text-foreground">{div.ticker}</span>
                      {renderTaxAndSourceBadges(div, eff)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Data COM {formatDateBR(div.comDate)} ·{" "}
                      {div.paymentDate
                        ? `Previsto para ${formatDateBR(div.paymentDate)}`
                        : "Data de pagamento a definir"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <MoneyText
                      cents={numberToCents(eff.netAmount)}
                      currency={div.currency}
                      tone="portfolio"
                      className="font-semibold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isReadOnlyMode || confirmMutation.isPending || eff.netAmount <= 0}
                      onClick={() => handleSettleProvisionedNow(div)}
                    >
                      Confirmar agora
                    </Button>
                    {div.isManual && div.eventId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        title="Excluir provisionamento manual"
                        aria-label={`Excluir provisionamento manual de ${div.ticker}`}
                        disabled={isReadOnlyMode || deleteManualMutation.isPending}
                        onClick={() => handleDeleteManualEvent(div.eventId!)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Dispensar provento previsto"
                        aria-label={`Dispensar provento previsto de ${div.ticker}`}
                        disabled={isReadOnlyMode || dismissMutation.isPending}
                        onClick={() => handleDismissItem(div)}
                      >
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );

  const manualContent = (
    <div className="flex flex-col gap-4 py-1">
      {eligibleAssets.length === 0 ? (
        <EmptyState
          title="Nenhum ativo elegível em custódia"
          description="Cadastre uma ação, FII, ETF ou BDR com saldo em custódia para provisionar proventos manualmente."
          headingLevel="h3"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-asset" className="text-xs font-semibold text-foreground">
                Ativo em custódia
              </label>
              <Select
                id="manual-div-asset"
                value={effectiveManualAssetId}
                onValueChange={(id) => {
                  setManualAssetId(id);
                  setManualTaxPctOverride(null);
                }}
                options={eligibleAssets.map((a) => ({
                  value: a.id,
                  label: `${a.ticker} (${a.currency})`,
                }))}
                ariaLabel="Selecionar ativo"
              />
              {selectedManualAsset ? (
                <span className="text-[11px] text-muted-foreground">
                  Custódia na Data COM:{" "}
                  {formatAssetQuantity(
                    manualCustodyQty > 0 ? manualCustodyQty : selectedManualAsset.quantity,
                  )}{" "}
                  cotas
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-type" className="text-xs font-semibold text-foreground">
                Tipo de provento
              </label>
              <Select
                id="manual-div-type"
                value={manualType}
                onValueChange={(val) => {
                  const typed = val as CorporateDividendType;
                  setManualType(typed);
                  setManualTaxPctOverride(null);
                }}
                options={DIVIDEND_TYPE_OPTIONS}
                ariaLabel="Selecionar tipo de provento"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-com-date" className="text-xs font-semibold text-foreground">
                Data COM
              </label>
              <DatePicker
                id="manual-div-com-date"
                value={manualComDate}
                onValueChange={setManualComDate}
                ariaLabel="Data COM"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-pay-date" className="text-xs font-semibold text-foreground">
                Data de pagamento <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <DatePicker
                id="manual-div-pay-date"
                value={manualPaymentDate}
                onValueChange={setManualPaymentDate}
                placeholder="Data a definir"
                ariaLabel="Data de pagamento"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-net" className="text-xs font-semibold text-foreground">
                Valor líquido total ({selectedManualAsset?.currency ?? "BRL"})
              </label>
              <MoneyInput
                id="manual-div-net"
                currency={selectedManualAsset?.currency === "USD" ? "USD" : "BRL"}
                cents={manualNetCents}
                onCentsChange={setManualNetCents}
                aria-label="Valor líquido total do provisionamento"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-div-tax" className="text-xs font-semibold text-foreground">
                Alíquota IR <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <PercentInput
                id="manual-div-tax"
                maxValue={100}
                value={manualTaxPct}
                onValueChange={(pct) => setManualTaxPctOverride(Math.max(0, Math.min(100, pct)))}
                aria-label="Alíquota IR aplicada"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-div-notes" className="text-xs font-semibold text-foreground">
              Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              id="manual-div-notes"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Ex.: Aviso aos acionistas ou corretora EUA"
            />
          </div>
        </>
      )}
    </div>
  );

  const tabs: TabItem[] = [
    {
      value: "review",
      label: `Conferência (${availableDividends.length + projectedDividends.length})`,
      content: reviewContent,
    },
    {
      value: "manual",
      label: "Provisionar Manual",
      content: manualContent,
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title="Proventos Detectados e Provisionados"
        description="Confira valores líquidos, alíquotas de IR (JCP 15% / EUA 30%) e confirme o lançamento no extrato e no Caixa."
        size="lg"
        footer={
          activeTab === "review" ? (
            <ModalFooter borderless>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Fechar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                loading={confirmMutation.isPending}
                disabled={
                  isReadOnlyMode ||
                  selectedItems.length === 0 ||
                  hasInvalidSelectedAmount ||
                  confirmMutation.isPending
                }
                sensoryIntent={false}
                onClick={handleConfirmSelected}
              >
                {syncCash
                  ? `Aprovar no Caixa (${selectedItems.length})`
                  : `Confirmar no Extrato (${selectedItems.length})`}
              </Button>
            </ModalFooter>
          ) : (
            <ModalFooter borderless>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTabOverride("review")}
              >
                Voltar para Conferência
              </Button>
              <Button
                type="button"
                size="sm"
                loading={createManualMutation.isPending}
                disabled={
                  isReadOnlyMode ||
                  !selectedManualAsset ||
                  manualNetCents <= 0 ||
                  !manualComDate ||
                  createManualMutation.isPending
                }
                onClick={handleCreateManual}
              >
                Provisionar
              </Button>
            </ModalFooter>
          )
        }
      >
        <Tabs
          value={activeTab}
          onValueChange={(next) => setActiveTabOverride(next as DividendReviewModalTab)}
          variant="pills"
          fullWidth
          items={tabs}
          ariaLabel="Seções do modal de proventos"
        />
      </Modal>
      {upgradeModal}
    </>
  );
}

function PendingDividendsDialogHostContent({
  open,
  onOpenChange,
  initialTab,
  requestSeq,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initialTab: DividendReviewModalTab;
  requestSeq: number;
}) {
  const { available, projected, fxRate, isLoading, isError, refetch } = useCorporateDividends();
  return (
    <PendingDividendsDialog
      open={open}
      onOpenChange={onOpenChange}
      availableDividends={available}
      projectedDividends={projected}
      fxRate={fxRate}
      initialTab={initialTab}
      requestSeq={requestSeq}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
    />
  );
}

/**
 * Host global único para o modal de revisão de proventos (montado em AuthenticatedProviders).
 * Só assina `useCorporateDividends` enquanto aberto, evitando overhead em páginas comuns.
 */
export function PendingDividendsDialogHost() {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<DividendReviewModalTab>("review");
  const [requestSeq, setRequestSeq] = useState(0);

  useEffect(() => {
    return subscribeDividendReviewModal((opts) => {
      setInitialTab(opts.initialTab ?? "review");
      setRequestSeq((prev) => prev + 1);
      setOpen(true);
    });
  }, []);

  if (!open) return null;

  return (
    <PendingDividendsDialogHostContent
      open={open}
      onOpenChange={setOpen}
      initialTab={initialTab}
      requestSeq={requestSeq}
    />
  );
}
