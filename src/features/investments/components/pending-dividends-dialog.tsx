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
  Alert,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Dropzone,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  PercentInput,
  Select,
  Skeleton,
  Tabs,
  Textarea,
  type SelectOption,
  type TabItem,
} from "@/components/ui";
import { numberToCents } from "@/domain/money";
import {
  FALLBACK_USD_RATE,
  getCustodyAtComDate,
  isAssetPendingDividendCalibration,
  isCashAssetClass,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  isValidDividendSettlementDate,
  isValidDividendTrackingDate,
  parseDividendImportText,
  summarizeCalibrationPlan,
  todaySaoPauloISO,
  type SuggestedDividendItem,
} from "@/domain/portfolio";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { formatDateBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { formatAssetQuantity } from "@/services/formatting";
import {
  subscribeDividendReviewModal,
  type DividendReviewModalFilter,
  type DividendReviewModalTab,
} from "@/services/dividend-review-modal";
import { formatFxRate } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import {
  useAllPortfolioTransactions,
  useConfirmUserDividendEvents,
  useCorporateDividends,
  useCreateManualUserDividendEvent,
  useCreatePortfolioDividend,
  useDeleteUserDividendEvent,
  useDismissUserDividendEvent,
  useDismissUserDividendEventsBatch,
  usePortfolioAssets,
  usePortfolioDividends,
  useSetDividendTracking,
  useUpdatePortfolioDividend,
  useUpdateUserDividendEvent,
  useUserPreferences,
} from "@/state";
import type {
  ConfirmDividendEventItem,
  CorporateDividendType,
  PortfolioAsset,
} from "@/types";


type OriginFilterValue = "all" | "official" | "community_verified" | "estimated" | "manual";

function resolveItemOriginKey(item: SuggestedDividendItem): Exclude<OriginFilterValue, "all"> {
  if (item.isManual) return "manual";
  if (item.trustTier === "official") return "official";
  if (item.trustTier === "community_verified") return "community_verified";
  return "estimated";
}

function resolveItemOriginBadge(item: SuggestedDividendItem): {
  label: string;
  variant: "positive" | "portfolio" | "warning" | "muted";
} {
  const origin = resolveItemOriginKey(item);
  if (origin === "manual") return { label: "Manual", variant: "muted" };
  if (origin === "official") return { label: "Oficial", variant: "positive" };
  if (origin === "community_verified") {
    return { label: "Verificado pela Comunidade", variant: "portfolio" };
  }
  return { label: "Estimado — conferir", variant: "warning" };
}

const ORIGIN_FILTER_OPTIONS: SelectOption[] = [
  { value: "all", label: "Todas as origens" },
  { value: "official", label: "Oficial" },
  { value: "community_verified", label: "Verificado pela Comunidade" },
  { value: "estimated", label: "Estimado — conferir" },
  { value: "manual", label: "Manual" },
];

const CURRENCY_FILTER_OPTIONS: SelectOption[] = [
  { value: "all", label: "Todas moedas" },
  { value: "BRL", label: "BRL" },
  { value: "USD", label: "USD" },
];


export interface PendingDividendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDividends: SuggestedDividendItem[];
  projectedDividends: SuggestedDividendItem[];
  assetsNeedingCalibration?: PortfolioAsset[];
  trackingStartDate?: string | null;
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
  paymentDate: string;
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
  assetsNeedingCalibration: assetsNeedingCalibrationProp,
  trackingStartDate: trackingStartDateProp,
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
  const dismissBatchMutation = useDismissUserDividendEventsBatch();
  const createManualMutation = useCreateManualUserDividendEvent();
  const deleteManualMutation = useDeleteUserDividendEvent();
  const updateDividendEventMutation = useUpdateUserDividendEvent();
  const updatePortfolioDividendMutation = useUpdatePortfolioDividend();
  const createPortfolioDividendMutation = useCreatePortfolioDividend();
  const portfolioDividendsQuery = usePortfolioDividends();
  const setDividendTracking = useSetDividendTracking();

  const [searchTicker, setSearchTicker] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<"all" | "BRL" | "USD">("all");
  const [originFilter, setOriginFilter] = useState<OriginFilterValue>("all");
  const [missingDateOnly, setMissingDateOnly] = useState(false);
  const [includeOldOver120, setIncludeOldOver120] = useState(true);

  const effectiveFx = fxRateProp && fxRateProp > 0 ? fxRateProp : FALLBACK_USD_RATE;
  const defaultAutoCreditCash =
    userPreferences?.custom_settings?.dividendAutomation?.autoCreditCash !== false;
  const effectiveTrackingStartDate = useMemo(() => {
    if (typeof trackingStartDateProp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(trackingStartDateProp)) {
      return trackingStartDateProp;
    }
    const fromPref = userPreferences?.custom_settings?.dividendAutomation?.trackingStartDate;
    return typeof fromPref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fromPref.trim())
      ? fromPref.trim()
      : null;
  }, [trackingStartDateProp, userPreferences]);

  const pendingCalibrationAssets = useMemo(() => {
    const raw =
      assetsNeedingCalibrationProp ??
      (assetsQuery.data ?? []).filter(isAssetPendingDividendCalibration);
    const seen = new Set<string>();
    const unique: PortfolioAsset[] = [];
    for (const a of raw) {
      if (!a?.id || seen.has(a.id)) continue;
      seen.add(a.id);
      unique.push(a);
    }
    return unique;
  }, [assetsNeedingCalibrationProp, assetsQuery.data]);

  const [activeTabOverride, setActiveTabOverride] = useState<DividendReviewModalTab | null>(null);
  const [prevRequestKey, setPrevRequestKey] = useState<string>(`${initialTab}:${requestSeq}`);
  const currentRequestKey = `${initialTab}:${requestSeq}`;
  if (currentRequestKey !== prevRequestKey) {
    setPrevRequestKey(currentRequestKey);
    setActiveTabOverride(null);
  }

  const [syncCashOverride, setSyncCashOverride] = useState<boolean | null>(null);
  const [contributePublicly, setContributePublicly] = useState(true);
  const [deselectedKeys, setDeselectedKeys] = useState<Set<string>>(() => new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RowOverrideState>>({});
  const [paymentDateErrorKeys, setPaymentDateErrorKeys] = useState<Set<string>>(() => new Set());
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Estado da calibração em lote ("Calibrar N ativos")
  const [deselectedCalibrationIds, setDeselectedCalibrationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [commonCalibrationDate, setCommonCalibrationDate] = useState<string>("");
  const [rowCalibrationDates, setRowCalibrationDates] = useState<Record<string, string>>({});
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

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
  const [manualAmountMode, setManualAmountMode] = useState<"total" | "per_unit">("total");
  const [manualNetCents, setManualNetCents] = useState<number>(0);
  const [manualPerUnitCents, setManualPerUnitCents] = useState<number>(0);
  const [manualAlreadyReceived, setManualAlreadyReceived] = useState<boolean>(false);
  const [manualTaxPctOverride, setManualTaxPctOverride] = useState<number | null>(null);
  const [manualNotes, setManualNotes] = useState<string>("");
  const [manualSubMode, setManualSubMode] = useState<"single" | "import">("single");
  const [importRawText, setImportRawText] = useState<string>("");
  const [isImportingDividends, setIsImportingDividends] = useState<boolean>(false);

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
      setPaymentDateErrorKeys(new Set());
      setReviewError(null);
      setDeselectedCalibrationIds(new Set());
      setCommonCalibrationDate("");
      setRowCalibrationDates({});
      setCalibrationError(null);
      setActiveTabOverride(null);
      setSyncCashOverride(null);
      setManualAssetId("");
      setManualType("DIVIDENDO");
      setManualComDate(todaySaoPauloISO());
      setManualPaymentDate("");
      setManualAmountMode("total");
      setManualNetCents(0);
      setManualPerUnitCents(0);
      setManualAlreadyReceived(false);
      setManualSubMode("single");
      setImportRawText("");
      setManualTaxPctOverride(null);
      setManualNotes("");
      setSearchTicker("");
      setCurrencyFilter("all");
      setOriginFilter("all");
      setMissingDateOnly(false);
      setIncludeOldOver120(true);
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
        paymentDate: item.paymentDate ? item.paymentDate.slice(0, 10) : "",
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
        paymentDate: item.paymentDate ? item.paymentDate.slice(0, 10) : "",
      };
      return { ...prev, [key]: updater(current) };
    });
  };

  const oldOver120Count = useMemo(
    () => availableDividends.filter((d) => Boolean(d.isOver120DaysWithoutPayment && !d.paymentDate)).length,
    [availableDividends],
  );

  const datelessProjectedCount = useMemo(
    () => projectedDividends.filter((d) => !d.paymentDate).length,
    [projectedDividends],
  );

  const matchesCommonFilters = useCallback(
    (item: SuggestedDividendItem) => {
      const q = searchTicker.trim().toUpperCase();
      if (q && !item.ticker.toUpperCase().includes(q)) return false;
      if (currencyFilter !== "all" && item.currency !== currencyFilter) return false;
      if (originFilter !== "all" && resolveItemOriginKey(item) !== originFilter) return false;
      if (missingDateOnly && Boolean(item.paymentDate)) return false;
      return true;
    },
    [searchTicker, currencyFilter, originFilter, missingDateOnly],
  );

  const filteredAvailableDividends = useMemo(
    () =>
      availableDividends.filter((item) => {
        if (!includeOldOver120 && item.isOver120DaysWithoutPayment && !item.paymentDate) {
          return false;
        }
        return matchesCommonFilters(item);
      }),
    [availableDividends, includeOldOver120, matchesCommonFilters],
  );

  const filteredProjectedDividends = useMemo(
    () => projectedDividends.filter(matchesCommonFilters),
    [projectedDividends, matchesCommonFilters],
  );

  const filteredAvailableKeys = useMemo(
    () => filteredAvailableDividends.map(getItemKey),
    [filteredAvailableDividends],
  );

  const allAvailableSelected = useMemo(
    () =>
      filteredAvailableDividends.length > 0 &&
      filteredAvailableDividends.every((d) => selectedKeys.has(getItemKey(d))),
    [filteredAvailableDividends, selectedKeys],
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
    setDeselectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const k of filteredAvailableKeys) next.delete(k);
      } else {
        for (const k of filteredAvailableKeys) next.add(k);
      }
      return next;
    });
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

  const todayForValidation = todaySaoPauloISO();

  const calibrationPlan = useMemo(() => {
    return pendingCalibrationAssets.map((asset) => {
      const selected = !deselectedCalibrationIds.has(asset.id);
      const rawDate = (rowCalibrationDates[asset.id] || commonCalibrationDate || "").trim();
      const targetDate = isValidDividendTrackingDate(rawDate, todayForValidation) ? rawDate : null;
      return { asset, selected, rawDate, targetDate };
    });
  }, [
    pendingCalibrationAssets,
    deselectedCalibrationIds,
    rowCalibrationDates,
    commonCalibrationDate,
    todayForValidation,
  ]);

  const calibrationSummary = useMemo(
    () =>
      summarizeCalibrationPlan(
        calibrationPlan.map((p) => ({
          assetId: p.asset.id,
          selected: p.selected,
          targetDate: p.targetDate,
        })),
        effectiveTrackingStartDate,
      ),
    [calibrationPlan, effectiveTrackingStartDate],
  );

  const missingCalibrationDatesCount = useMemo(
    () => calibrationPlan.filter((p) => p.selected && !p.targetDate).length,
    [calibrationPlan],
  );

  const handleToggleCalibrationAsset = (assetId: string, checked: boolean) => {
    setCalibrationError(null);
    setDeselectedCalibrationIds((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleApplyCalibration = () => {
    if (setDividendTracking.isPending) return;
    if (calibrationSummary.selectedCount === 0) {
      setCalibrationError("Selecione ao menos um ativo para calibrar.");
      return;
    }
    const invalidItem = calibrationPlan.find((p) => p.selected && !p.targetDate);
    if (invalidItem) {
      setCalibrationError(
        `Informe uma data válida entre 01/01/2000 e amanhã para ${invalidItem.asset.ticker}.`,
      );
      return;
    }
    setCalibrationError(null);
    guardAction(() => {
      void (async () => {
        const dedupedByAssetId = new Map<
          string,
          { asset_id: string; expected_start: string | null; start_date: string | null }
        >();
        for (const item of calibrationPlan) {
          if (!item.selected || !item.targetDate) continue;
          dedupedByAssetId.set(item.asset.id, {
            asset_id: item.asset.id,
            expected_start: item.asset.dividends_start_date
              ? item.asset.dividends_start_date.slice(0, 10)
              : null,
            start_date: item.targetDate,
          });
        }
        try {
          await setDividendTracking.mutateAsync({
            trackingStartDate: null,
            assets: Array.from(dedupedByAssetId.values()),
            expectedTrackingStartDate: effectiveTrackingStartDate,
            silent: false,
          });
          setCalibrationError(null);
        } catch (err) {
          setCalibrationError(getErrorMessage(err));
        }
      })();
    });
  };

  const hasInvalidSelectedAmount = useMemo(
    () => selectedItems.some((item) => getEffectiveRow(item).netAmount <= 0),
    [selectedItems, getEffectiveRow],
  );

  const buildConfirmItem = (d: SuggestedDividendItem): ConfirmDividendEventItem => {
    const eff = getEffectiveRow(d);
    const paymentIso = eff.paymentDate.trim().slice(0, 10);
    const qty = Math.max(0, d.quantityOnComDate);
    const netRate = qty > 0 ? Math.round((eff.netAmount / qty) * 100_000_000) / 100_000_000 : d.netRate;

    return {
      event_id: d.eventId ?? null,
      expected_revision: d.revision ?? null,
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
    const today = todaySaoPauloISO();
    const invalidPayKeys: string[] = [];
    for (const item of selectedItems) {
      const eff = getEffectiveRow(item);
      if (!isValidDividendSettlementDate(eff.paymentDate, item.comDate, today)) {
        invalidPayKeys.push(getItemKey(item));
      }
    }
    if (invalidPayKeys.length > 0) {
      setPaymentDateErrorKeys(new Set(invalidPayKeys));
      setEditingKey(invalidPayKeys[0]!);
      setReviewError(
        "Informe a data real de pagamento (entre a Data COM e hoje) para todos os itens selecionados antes de confirmar.",
      );
      return;
    }
    setPaymentDateErrorKeys(new Set());
    setReviewError(null);
    guardAction(() => {
      void (async () => {
        try {
          await confirmMutation.mutateAsync({
            items: selectedItems.map((item) => buildConfirmItem(item)),
            sync_cash: syncCash,
            ...(contributePublicly ? {} : { allow_consensus_contribution: false }),
          });
          handleOpenChange(false);
        } catch (err) {
          const msg = getErrorMessage(err);
          setReviewError(msg);
          if (/conflit|revis[aã]o|atualizad|409/i.test(msg)) {
            onRetry?.();
          }
        }
      })();
    });
  };

  const handleSettleProvisionedNow = (item: SuggestedDividendItem) => {
    const eff = getEffectiveRow(item);
    if (confirmMutation.isPending || eff.netAmount <= 0) return;
    const today = todaySaoPauloISO();
    const key = getItemKey(item);
    if (!isValidDividendSettlementDate(eff.paymentDate, item.comDate, today)) {
      if (eff.paymentDate > today) {
        setRowOverride(item, (curr) => ({ ...curr, paymentDate: "" }));
      }
      setPaymentDateErrorKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setEditingKey(key);
      setReviewError(
        `Informe a data real de recebimento de ${item.ticker} (entre ${formatDateBR(item.comDate)} e hoje) antes de efetivar.`,
      );
      return;
    }
    setPaymentDateErrorKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setReviewError(null);
    guardAction(() => {
      void (async () => {
        try {
          await confirmMutation.mutateAsync({
            items: [buildConfirmItem(item)],
            sync_cash: syncCash,
          });
          setEditingKey(null);
        } catch (err) {
          const msg = getErrorMessage(err);
          setReviewError(msg);
          if (/conflit|revis[aã]o|atualizad|409/i.test(msg)) {
            onRetry?.();
          }
        }
      })();
    });
  };

  const handleDismissSelectedBatch = () => {
    if (selectedItems.length === 0 || dismissBatchMutation.isPending || dismissMutation.isPending) {
      return;
    }
    const persisted = selectedItems.filter((item) => Boolean(item.eventId));
    const legacy = selectedItems.filter((item) => !item.eventId);
    guardAction(() => {
      void (async () => {
        if (persisted.length > 0) {
          await dismissBatchMutation
            .mutateAsync({
              ids: persisted.map((item) => item.eventId!),
              revisions: persisted.map((item) => item.revision ?? 1),
              reason: "manual_ignore",
            })
            .catch(() => undefined);
        }
        for (const item of legacy) {
          await dismissMutation
            .mutateAsync({
              eventId: null,
              corporateDividendId: item.isManual ? null : item.corporateDividendId,
              assetId: item.assetId,
              reason: "manual_ignore",
            })
            .catch(() => undefined);
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

  const manualEffectiveQty =
    manualCustodyQty > 0 ? manualCustodyQty : (selectedManualAsset?.quantity ?? 0);

  const parsedImport = useMemo(
    () =>
      parseDividendImportText(
        importRawText,
        assetsQuery.data ?? [],
        portfolioDividendsQuery.data ?? [],
      ),
    [importRawText, assetsQuery.data, portfolioDividendsQuery.data],
  );

  const handleImportDividendsBatch = () => {
    const toImport = parsedImport.items.filter((it) => !it.alreadyImported);
    if (toImport.length === 0 || isImportingDividends) return;
    guardAction(() => {
      void (async () => {
        setIsImportingDividends(true);
        try {
          for (const item of toImport) {
            const isUsd = item.currency === "USD";
            const cashAmount = syncCash
              ? isUsd
                ? Math.round(item.amount * effectiveFx * 100) / 100
                : item.amount
              : null;
            await createPortfolioDividendMutation.mutateAsync({
              asset_id: item.matchedAssetId,
              ticker: item.ticker,
              amount: item.amount,
              date: item.date,
              notes: item.notes,
              sync_cash: syncCash,
              cash_amount: cashAmount,
              create_transaction: syncCash,
              tx_type: item.txType === "yield" ? "fii_yield" : item.txType === "other" ? undefined : item.txType,
              fx_rate: isUsd ? effectiveFx : null,
            });
          }
          setImportRawText("");
          setManualSubMode("single");
          onRetry?.();
          setActiveTabOverride("review");
        } catch {
          // O hook já exibe toast de erro
        } finally {
          setIsImportingDividends(false);
        }
      })();
    });
  };

  const manualEffectiveNetCents = useMemo(() => {
    if (manualAmountMode === "total") return manualNetCents;
    if (manualPerUnitCents <= 0 || manualEffectiveQty <= 0) return 0;
    const gross = manualEffectiveQty * (manualPerUnitCents / 100);
    const net = gross * (1 - manualTaxPct / 100);
    return Math.max(0, Math.round(net * 100));
  }, [manualAmountMode, manualNetCents, manualPerUnitCents, manualEffectiveQty, manualTaxPct]);

  const handleCreateManual = () => {
    if (
      !selectedManualAsset ||
      manualEffectiveNetCents <= 0 ||
      !manualComDate ||
      createManualMutation.isPending ||
      createPortfolioDividendMutation.isPending
    ) {
      return;
    }
    guardAction(() => {
      void (async () => {
        const netAmount = manualEffectiveNetCents / 100;
        const today = todaySaoPauloISO();
        const cleanPay = manualPaymentDate ? manualPaymentDate.slice(0, 10) : null;

        try {
          if (manualAlreadyReceived) {
            const receivedDate = cleanPay ?? manualComDate.slice(0, 10);
            const isUsd = selectedManualAsset.currency === "USD";
            const cashAmount = syncCash
              ? isUsd
                ? Math.round(netAmount * effectiveFx * 100) / 100
                : netAmount
              : null;
            const txType =
              manualType === "JCP"
                ? "jcp"
                : manualType === "RENDIMENTO"
                  ? "fii_yield"
                  : "dividend";
            await createPortfolioDividendMutation.mutateAsync({
              asset_id: selectedManualAsset.id,
              ticker: selectedManualAsset.ticker,
              amount: netAmount,
              date: receivedDate,
              notes: manualNotes.trim() || null,
              sync_cash: syncCash,
              cash_amount: cashAmount,
              create_transaction: syncCash,
              tx_type: txType,
              fx_rate: isUsd ? effectiveFx : null,
            });
          } else {
            const status =
              cleanPay !== null && cleanPay <= today ? "PENDING_CONFIRMATION" : "PROVISIONED";
            await createManualMutation.mutateAsync({
              asset_id: selectedManualAsset.id,
              ticker: selectedManualAsset.ticker,
              type: manualType,
              com_date: manualComDate.slice(0, 10),
              payment_date: cleanPay,
              quantity_on_com_date: manualEffectiveQty,
              tax_rate_pct: manualTaxPct,
              net_amount: netAmount,
              currency: selectedManualAsset.currency === "USD" ? "USD" : "BRL",
              status,
              notes: manualNotes.trim() || null,
            });
          }

          setManualNetCents(0);
          setManualPerUnitCents(0);
          setManualAlreadyReceived(false);
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

  const handleLinkToExistingManual = (
    item: SuggestedDividendItem,
    adoptOfficialDate = false,
  ) => {
    if (
      !item.eventId ||
      !item.suggestedManualMatch ||
      updateDividendEventMutation.isPending ||
      updatePortfolioDividendMutation.isPending
    ) {
      return;
    }
    const manualId = item.suggestedManualMatch.manualId;
    const targetIds =
      item.suggestedManualMatch.groupEventIds &&
      item.suggestedManualMatch.groupEventIds.length > 0
        ? item.suggestedManualMatch.groupEventIds
        : [item.eventId];
    const officialDate =
      adoptOfficialDate && item.paymentDate ? item.paymentDate.slice(0, 10) : null;

    guardAction(() => {
      void (async () => {
        try {
          if (officialDate && officialDate !== item.suggestedManualMatch?.manualDate) {
            await updatePortfolioDividendMutation.mutateAsync({
              id: manualId,
              patch: { date: officialDate },
            });
          }
          for (const evId of targetIds) {
            await updateDividendEventMutation.mutateAsync({
              id: evId,
              patch: {
                status: "SETTLED",
                settlement_origin: "dedup",
                settled_dividend_id: manualId,
              },
            });
          }
          onRetry?.();
        } catch {
          // O hook já exibe toast de erro
        }
      })();
    });
  };

  const suggestedAvailableItems = useMemo(
    () =>
      filteredAvailableDividends.filter((d) =>
        Boolean(d.suggestedManualMatch && d.eventId),
      ),
    [filteredAvailableDividends],
  );

  const handleLinkAllSuggested = () => {
    if (
      suggestedAvailableItems.length === 0 ||
      updateDividendEventMutation.isPending
    ) {
      return;
    }
    guardAction(() => {
      void (async () => {
        try {
          const seenEventIds = new Set<string>();
          for (const item of suggestedAvailableItems) {
            if (!item.eventId || !item.suggestedManualMatch) continue;
            const ids =
              item.suggestedManualMatch.groupEventIds &&
              item.suggestedManualMatch.groupEventIds.length > 0
                ? item.suggestedManualMatch.groupEventIds
                : [item.eventId];
            for (const evId of ids) {
              if (seenEventIds.has(evId)) continue;
              seenEventIds.add(evId);
              await updateDividendEventMutation.mutateAsync({
                id: evId,
                patch: {
                  status: "SETTLED",
                  settlement_origin: "dedup",
                  settled_dividend_id: item.suggestedManualMatch.manualId,
                },
              });
            }
          }
          onRetry?.();
        } catch {
          // O hook já exibe toast de erro
        }
      })();
    });
  };

  const renderSuggestedMatchBanner = (div: SuggestedDividendItem) => {
    if (!div.suggestedManualMatch || !div.eventId) return null;
    const isGroup =
      Boolean(div.suggestedManualMatch.groupEventIds) &&
      (div.suggestedManualMatch.groupEventIds?.length ?? 0) > 1;
    const canAdoptDate =
      Boolean(div.paymentDate) &&
      div.paymentDate !== div.suggestedManualMatch.manualDate &&
      !isGroup;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-t border-border/60 text-[11px]">
        <span className="text-muted-foreground">
          {isGroup ? (
            <>
              Soma de{" "}
              <strong className="text-foreground">
                {div.suggestedManualMatch.groupEventIds?.length} eventos
              </strong>{" "}
              corresponde ao lançamento em{" "}
            </>
          ) : (
            "Possível correspondência no extrato em "
          )}
          <strong className="text-foreground">
            {formatDateBR(div.suggestedManualMatch.manualDate)}
          </strong>
          {div.suggestedManualMatch.reason && !isGroup
            ? ` (${div.suggestedManualMatch.reason})`
            : ""}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center shrink-0">
          {canAdoptDate ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                isReadOnlyMode ||
                updateDividendEventMutation.isPending ||
                updatePortfolioDividendMutation.isPending
              }
              onClick={() => handleLinkToExistingManual(div, true)}
              className="text-xs"
            >
              Vincular e adotar data oficial
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isReadOnlyMode || updateDividendEventMutation.isPending}
            onClick={() => handleLinkToExistingManual(div, false)}
          >
            {isGroup ? "Vincular grupo (sem novo crédito)" : "Vincular (sem novo crédito)"}
          </Button>
        </div>
      </div>
    );
  };

  const handleDeleteManualEvent = (eventId: string) => {
    if (deleteManualMutation.isPending) return;
    guardAction(() => {
      void deleteManualMutation.mutateAsync(eventId).catch(() => undefined);
    });
  };

  const renderTaxAndSourceBadges = (item: SuggestedDividendItem, eff: RowOverrideState) => {
    const originBadge = resolveItemOriginBadge(item);
    return (
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
        <Badge size="xs" variant={originBadge.variant}>
          {originBadge.label}
        </Badge>
        {item.isOver120DaysWithoutPayment && !item.paymentDate ? (
          <Badge size="xs" variant="muted">
            Antiga &gt;120d
          </Badge>
        ) : null}
      </div>
    );
  };

  const renderInlineRowEditor = (
    div: SuggestedDividendItem,
    eff: RowOverrideState,
    options?: { allowDirectConfirm?: boolean },
  ) => {
    const key = getItemKey(div);
    const today = todaySaoPauloISO();
    const hasValidPayment = isValidDividendSettlementDate(eff.paymentDate, div.comDate, today);
    const showPayError =
      paymentDateErrorKeys.has(key) || (eff.paymentDate.length > 0 && !hasValidPayment);

    return (
      <div className="px-3 pb-3 pt-2.5 bg-muted/25 border-t border-border/80 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <FormField label="Tipo" htmlFor={`edit-type-${key}`}>
            <Select
              id={`edit-type-${key}`}
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
          </FormField>

          <FormField label="Data real de pagamento" htmlFor={`edit-pay-date-${key}`}>
            <DatePicker
              id={`edit-pay-date-${key}`}
              value={eff.paymentDate}
              onValueChange={(nextDate) => {
                setRowOverride(div, (curr) => ({ ...curr, paymentDate: nextDate }));
                setPaymentDateErrorKeys((prev) => {
                  const next = new Set(prev);
                  next.delete(key);
                  return next;
                });
                if (reviewError) setReviewError(null);
              }}
              placeholder="Selecionar data recebida"
              ariaLabel={`Data real de pagamento de ${div.ticker}`}
            />
            {showPayError ? (
              <span role="alert" className="text-[11px] text-critical-strong">
                Informe uma data entre {formatDateBR(div.comDate)} e hoje
              </span>
            ) : null}
          </FormField>

          <FormField label="IR Retido (%)" htmlFor={`edit-tax-${key}`}>
            <PercentInput
              id={`edit-tax-${key}`}
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
          </FormField>

          <FormField
            label={`Valor Líquido (${div.currency})`}
            htmlFor={`edit-net-${key}`}
            error={eff.netAmount <= 0 ? "Deve ser maior que zero" : undefined}
          >
            <MoneyInput
              id={`edit-net-${key}`}
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
          </FormField>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span>
            Fonte: {div.provider ?? (div.isManual ? "Manual" : "Yahoo")}
            {div.trustTier !== "official" && !div.isManual
              ? " · Campos estimados (tipo/IR/pagamento) sujeitos à conferência"
              : ""}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {options?.allowDirectConfirm ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              loading={confirmMutation.isPending}
              disabled={
                isReadOnlyMode ||
                confirmMutation.isPending ||
                eff.netAmount <= 0 ||
                !hasValidPayment
              }
              onClick={() => handleSettleProvisionedNow(div)}
            >
              Confirmar recebimento
            </Button>
          ) : null}
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
    );
  };

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
      {pendingCalibrationAssets.length > 0 ? (
        <section
          aria-label={`Calibrar ${pendingCalibrationAssets.length} ativos`}
          className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5"
        >
          <div className="flex items-start gap-2.5">
            <CalendarClock
              className="size-4 text-warning-strong shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-semibold text-foreground">
                Calibrar {pendingCalibrationAssets.length}{" "}
                {pendingCalibrationAssets.length === 1 ? "ativo" : "ativos"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                Lotes com proventos acumulados anteriores ao extrato exigem uma data inicial (Data COM) antes que novos eventos sejam sugeridos.
              </span>
            </div>
          </div>

          <FormField
            label="Data inicial comum (Data COM)"
            htmlFor="batch-calibration-common-date"
            helperText="Aplicada aos ativos selecionados sem exceção individual."
          >
            <DatePicker
              id="batch-calibration-common-date"
              value={commonCalibrationDate}
              onValueChange={(nextDate) => {
                setCommonCalibrationDate(nextDate);
                if (calibrationError) setCalibrationError(null);
              }}
              placeholder="Selecionar data comum"
              ariaLabel="Data inicial comum para calibração"
            />
          </FormField>

          <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface">
            {calibrationPlan.map(({ asset, selected, rawDate }) => {
              const rowDateValue = rowCalibrationDates[asset.id] ?? "";
              return (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) =>
                        handleToggleCalibrationAsset(asset.id, Boolean(checked))
                      }
                      aria-label={`Selecionar ${asset.ticker} para calibração`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold font-mono text-foreground">
                        {asset.ticker}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Acumulado:{" "}
                        <MoneyText
                          cents={numberToCents(asset.accumulated_dividends ?? 0)}
                          currency={asset.currency === "USD" ? "USD" : "BRL"}
                          tone="default"
                          className="inline text-[11px] font-medium text-foreground"
                        />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-52 shrink-0">
                    <FormField
                      label={`Exceção ${asset.ticker}`}
                      htmlFor={`calibration-row-date-${asset.id}`}
                      className="w-full"
                    >
                      <DatePicker
                        id={`calibration-row-date-${asset.id}`}
                        value={rowDateValue}
                        onValueChange={(nextDate) => {
                          setRowCalibrationDates((prev) => ({
                            ...prev,
                            [asset.id]: nextDate,
                          }));
                          if (calibrationError) setCalibrationError(null);
                        }}
                        placeholder={
                          commonCalibrationDate && selected
                            ? `Comum (${formatDateBR(commonCalibrationDate)})`
                            : "Data individual"
                        }
                        ariaLabel={`Data inicial de ${asset.ticker}`}
                      />
                    </FormField>
                  </div>
                  {selected && !rawDate ? (
                    <span className="sr-only">Aguardando data para {asset.ticker}</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <span>
              Resumo:{" "}
              {calibrationSummary.selectedCount === 0
                ? "nenhum ativo selecionado"
                : calibrationSummary.dateCounts.length > 0
                  ? calibrationSummary.dateCounts
                      .map(
                        (item) =>
                          `${item.count} ${item.count === 1 ? "ativo" : "ativos"} em ${formatDateBR(item.date)}`,
                      )
                      .join(", ")
                  : "escolha a data para aplicar aos selecionados"}
            </span>
            {calibrationSummary.firstCoveredDay ? (
              <span className="font-medium text-foreground">
                Primeiro dia coberto pela automação: {formatDateBR(calibrationSummary.firstCoveredDay)}
              </span>
            ) : null}
          </div>

          {calibrationError ? (
            <Alert variant="error">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{calibrationError}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleApplyCalibration}
                  disabled={setDividendTracking.isPending}
                >
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              variant="default"
              loading={setDividendTracking.isPending}
              disabled={
                isReadOnlyMode ||
                setDividendTracking.isPending ||
                calibrationSummary.selectedCount === 0 ||
                missingCalibrationDatesCount > 0
              }
              onClick={handleApplyCalibration}
            >
              Aplicar aos selecionados ({calibrationSummary.selectedCount})
            </Button>
          </div>
        </section>
      ) : null}

      {reviewError ? <Alert variant="error">{reviewError}</Alert> : null}

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

      <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            placeholder="Buscar ticker (ex.: PETR4)"
            aria-label="Buscar provento por ticker"
          />
          <Select
            value={currencyFilter}
            onValueChange={(val) => setCurrencyFilter(val as "all" | "BRL" | "USD")}
            options={CURRENCY_FILTER_OPTIONS}
            ariaLabel="Filtrar por moeda"
          />
          <Select
            value={originFilter}
            onValueChange={(val) => setOriginFilter(val as OriginFilterValue)}
            options={ORIGIN_FILTER_OPTIONS}
            ariaLabel="Filtrar por origem"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={missingDateOnly}
              onCheckedChange={(checked) => setMissingDateOnly(Boolean(checked))}
              aria-label="Filtrar apenas proventos sem data de pagamento"
            />
            <span>Sem data de pagamento</span>
          </label>
          {oldOver120Count > 0 ? (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeOldOver120}
                onCheckedChange={(checked) => setIncludeOldOver120(Boolean(checked))}
                aria-label="Incluir proventos antigos acima de 120 dias sem data"
              />
              <span>Incluir antigas &gt;120d ({oldOver120Count})</span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2 flex-wrap">
            <Checkbox
              checked={allAvailableSelected}
              onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
              disabled={filteredAvailableDividends.length === 0}
              aria-label="Selecionar visíveis para conferência"
            />
            <span className="text-xs font-semibold text-foreground">
              Selecionar visíveis ({filteredAvailableDividends.length})
            </span>
            {selectedItems.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                disabled={isReadOnlyMode || dismissBatchMutation.isPending || dismissMutation.isPending}
                onClick={handleDismissSelectedBatch}
              >
                <EyeOff className="size-3.5 mr-1" aria-hidden="true" />
                Dispensar selecionados ({selectedItems.length})
              </Button>
            ) : null}
            {suggestedAvailableItems.length >= 2 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isReadOnlyMode || updateDividendEventMutation.isPending}
                onClick={handleLinkAllSuggested}
              >
                Vincular {suggestedAvailableItems.length} sugeridos (sem novo crédito)
              </Button>
            ) : null}
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

        {filteredAvailableDividends.length === 0 ? (
          <EmptyState
            title="Nenhum provento aguardando confirmação"
            description="Quando a data de pagamento chegar ou você provisionar manualmente, os lançamentos aparecerão aqui para conferência."
            headingLevel="h3"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface">
            {filteredAvailableDividends.map((div) => {
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
                          {eff.paymentDate
                            ? `Pagamento ${formatDateBR(eff.paymentDate)}`
                            : "Pagamento a confirmar"}
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
                        title="Editar tipo, data, IR ou valor líquido"
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

                  {renderSuggestedMatchBanner(div)}

                  {isEditing ? renderInlineRowEditor(div, eff) : null}
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
          <div className="flex items-start gap-2.5 pt-2 mt-1 border-t border-border/60">
            <Checkbox
              id="consensus-lgpd-toggle"
              checked={contributePublicly}
              onCheckedChange={(checked) => setContributePublicly(Boolean(checked))}
              aria-label="Contribuir anonimamente para o catálogo de proventos"
            />
            <label
              htmlFor="consensus-lgpd-toggle"
              className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer"
            >
              Contribuir anonimamente com termos públicos corrigidos (LGPD). Desmarque para conferência privada.
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );

  const provisionedContent = isLoading ? (
    <div className="flex flex-col gap-3 py-2" aria-busy="true">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  ) : isError ? (
    <div className="py-2">
      <ErrorState
        message="Não foi possível carregar os proventos provisionados."
        onRetry={onRetry}
      />
    </div>
  ) : (
    <div className="flex flex-col gap-4 py-1">
      <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            placeholder="Buscar ticker (ex.: PETR4)"
            aria-label="Buscar provisionado por ticker"
          />
          <Select
            value={currencyFilter}
            onValueChange={(val) => setCurrencyFilter(val as "all" | "BRL" | "USD")}
            options={CURRENCY_FILTER_OPTIONS}
            ariaLabel="Filtrar provisionados por moeda"
          />
          <Select
            value={originFilter}
            onValueChange={(val) => setOriginFilter(val as OriginFilterValue)}
            options={ORIGIN_FILTER_OPTIONS}
            ariaLabel="Filtrar provisionados por origem"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={missingDateOnly}
              onCheckedChange={(checked) => setMissingDateOnly(Boolean(checked))}
              aria-label="Filtrar provisionados sem data de pagamento"
            />
            <span>Sem data de pagamento ({datelessProjectedCount})</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            Fora do Patrimônio e do Caixa até o pagamento
          </span>
        </div>
      </div>

      {filteredProjectedDividends.length === 0 ? (
        <EmptyState
          title="Nenhum provento provisionado"
          description="Proventos futuros anunciados ou provisionados manualmente aparecerão aqui até a data de pagamento."
          headingLevel="h3"
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                Provisionados — A Receber ({filteredProjectedDividends.length})
              </span>
            </div>
            {datelessProjectedCount > 0 ? (
              <Badge size="xs" variant="muted">
                {datelessProjectedCount} sem data
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface">
            {filteredProjectedDividends.map((div) => {
              const key = getItemKey(div);
              const eff = getEffectiveRow(div);
              const isEditing = editingKey === key;
              return (
                <div key={key} className="flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-3 gap-2.5 text-xs">
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold font-mono text-foreground">{div.ticker}</span>
                        {renderTaxAndSourceBadges(div, eff)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Data COM {formatDateBR(div.comDate)} ·{" "}
                        {eff.paymentDate
                          ? `Previsto para ${formatDateBR(eff.paymentDate)}`
                          : "Pagamento a confirmar"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Editar tipo, data de pagamento, IR ou valor líquido"
                        aria-label={`Editar provento previsto de ${div.ticker}`}
                        onClick={() => setEditingKey(isEditing ? null : key)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
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
                  {renderSuggestedMatchBanner(div)}
                  {isEditing
                    ? renderInlineRowEditor(div, eff, { allowDirectConfirm: true })
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const manualContent = (
    <div className="flex flex-col gap-4 py-1">
      <div className="inline-flex items-center self-start rounded-lg border border-border/80 bg-muted/30 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setManualSubMode("single")}
          className={`px-3 py-1 rounded-md transition-colors ${
            manualSubMode === "single"
              ? "bg-surface text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Lançamento individual
        </button>
        <button
          type="button"
          onClick={() => setManualSubMode("import")}
          className={`px-3 py-1 rounded-md transition-colors ${
            manualSubMode === "import"
              ? "bg-surface text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Importar extrato B3 / CSV
        </button>
      </div>

      {manualSubMode === "import" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Envie um arquivo CSV/TSV ou cole as linhas exportadas da Área do Investidor B3
            (colunas Produto, Pagamento, Tipo de Evento e Valor líquido). Lançamentos já existentes no extrato são ignorados automaticamente.
          </p>
          <Dropzone
            accept=".csv,.txt,.tsv"
            label="Arraste um CSV da B3/corretora ou clique para selecionar"
            onFiles={(files) => {
              const file = files[0];
              if (!file) return;
              void file.text().then((txt) => setImportRawText(txt));
            }}
          />
          <Textarea
            value={importRawText}
            onChange={(e) => setImportRawText(e.target.value)}
            placeholder={"Produto;Pagamento;Tipo de Evento;Valor líquido\nHGRU11 - CSHG RENDA URBANA FII;15/10/2026;Rendimento;R$ 120,00"}
            rows={5}
            aria-label="Conteúdo CSV ou tabela da B3 para importar proventos"
          />
          {parsedImport.items.length > 0 || parsedImport.skippedInvalid > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge size="xs" variant="positive">
                  {parsedImport.newCount} novos
                </Badge>
                {parsedImport.duplicateCount > 0 ? (
                  <Badge size="xs" variant="muted">
                    {parsedImport.duplicateCount} já lançados
                  </Badge>
                ) : null}
                {parsedImport.skippedInvalid > 0 ? (
                  <Badge size="xs" variant="warning">
                    {parsedImport.skippedInvalid} ignorados
                  </Badge>
                ) : null}
              </div>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-surface">
                {parsedImport.items.map((it) => (
                  <div
                    key={`${it.rowIndex}-${it.ticker}-${it.date}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono font-semibold text-foreground">{it.ticker}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateBR(it.date)}
                      </span>
                      {it.alreadyImported ? (
                        <Badge size="xs" variant="muted">
                          Já lançado
                        </Badge>
                      ) : null}
                    </div>
                    <MoneyText
                      cents={numberToCents(it.amount)}
                      currency={it.currency}
                      tone={it.alreadyImported ? "default" : "positive"}
                      className="text-xs font-semibold shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : eligibleAssets.length === 0 ? (
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
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="manual-div-net" className="text-xs font-semibold text-foreground">
                  {manualAmountMode === "total"
                    ? `Valor líquido total (${selectedManualAsset?.currency ?? "BRL"})`
                    : `Valor bruto por cota (${selectedManualAsset?.currency ?? "BRL"})`}
                </label>
                <div className="inline-flex items-center rounded-md border border-border/80 bg-muted/30 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setManualAmountMode("total")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      manualAmountMode === "total"
                        ? "bg-surface text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualAmountMode("per_unit")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      manualAmountMode === "per_unit"
                        ? "bg-surface text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Por cota
                  </button>
                </div>
              </div>
              {manualAmountMode === "total" ? (
                <MoneyInput
                  id="manual-div-net"
                  currency={selectedManualAsset?.currency === "USD" ? "USD" : "BRL"}
                  cents={manualNetCents}
                  onCentsChange={setManualNetCents}
                  aria-label="Valor líquido total do provisionamento"
                />
              ) : (
                <>
                  <MoneyInput
                    id="manual-div-net"
                    currency={selectedManualAsset?.currency === "USD" ? "USD" : "BRL"}
                    cents={manualPerUnitCents}
                    onCentsChange={setManualPerUnitCents}
                    aria-label="Valor bruto por cota"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Total líquido calculado ({formatAssetQuantity(manualEffectiveQty)} cotas):{" "}
                    <MoneyText
                      cents={manualEffectiveNetCents}
                      currency={selectedManualAsset?.currency === "USD" ? "USD" : "BRL"}
                      tone="default"
                      className="inline text-[11px] font-semibold text-foreground"
                    />
                  </span>
                </>
              )}
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

          <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <Checkbox
              checked={manualAlreadyReceived}
              onCheckedChange={(checked) => {
                const isChecked = Boolean(checked);
                setManualAlreadyReceived(isChecked);
                if (isChecked && !manualPaymentDate) {
                  setManualPaymentDate(todaySaoPauloISO());
                }
              }}
              aria-label="Já recebido na conta (lançar direto no extrato)"
            />
            <span>Já recebido na conta (lançar direto no extrato)</span>
          </label>
        </>
      )}
    </div>
  );

  const tabs: TabItem[] = [
    {
      value: "review",
      label: `A Conferir (${availableDividends.length})`,
      content: reviewContent,
    },
    {
      value: "provisioned",
      label: `Provisionados (${projectedDividends.length})`,
      content: provisionedContent,
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
          ) : activeTab === "provisioned" ? (
            <ModalFooter borderless>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Fechar
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
              {manualSubMode === "import" ? (
                <Button
                  type="button"
                  size="sm"
                  loading={isImportingDividends}
                  disabled={
                    isReadOnlyMode ||
                    parsedImport.newCount === 0 ||
                    isImportingDividends
                  }
                  onClick={handleImportDividendsBatch}
                >
                  Importar {parsedImport.newCount} provento{parsedImport.newCount === 1 ? "" : "s"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  loading={createManualMutation.isPending || createPortfolioDividendMutation.isPending}
                  disabled={
                    isReadOnlyMode ||
                    !selectedManualAsset ||
                    manualEffectiveNetCents <= 0 ||
                    !manualComDate ||
                    createManualMutation.isPending ||
                    createPortfolioDividendMutation.isPending
                  }
                  onClick={handleCreateManual}
                >
                  {manualAlreadyReceived ? "Registrar recebido" : "Provisionar"}
                </Button>
              )}
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

export function PendingDividendsDialogHostContent({
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
  const {
    available,
    projected,
    assetsNeedingCalibration,
    trackingStartDate,
    fxRate,
    isLoading,
    isError,
    refetch,
  } = useCorporateDividends();
  return (
    <PendingDividendsDialog
      open={open}
      onOpenChange={onOpenChange}
      availableDividends={available}
      projectedDividends={projected}
      assetsNeedingCalibration={assetsNeedingCalibration}
      trackingStartDate={trackingStartDate}
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
  const [, setInitialFilter] = useState<DividendReviewModalFilter>("all");
  const [requestSeq, setRequestSeq] = useState(0);

  useEffect(() => {
    return subscribeDividendReviewModal((opts) => {
      setInitialTab(opts.initialTab ?? "review");
      setInitialFilter(opts.initialFilter ?? "all");
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
