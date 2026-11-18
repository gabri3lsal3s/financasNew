import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useDebounce } from "@/hooks";
import { currentMonth, currentYear } from "@/lib/date";
import type { Expense } from "@/types";
import type { AggregationTab, PeriodMode } from "../components";

export type ReportsMainTab = "financas" | "investimentos" | "balanco" | "fiscal";

/**
 * Gerencia estado de navegação de abas, filtros de período, expansão da árvore de metas
 * e abertura dos modais executivos da Central de Relatórios.
 */
export function useReportModalsState(params: {
  hasFinanceFeatures: boolean;
  hasInvestmentsFeature: boolean;
}) {
  const { hasFinanceFeatures, hasInvestmentsFeature } = params;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam =
    (searchParams.get("aba") as ReportsMainTab) ||
    (searchParams.get("tab") as ReportsMainTab) ||
    "financas";

  const availableTabs = useMemo<ReportsMainTab[]>(() => {
    const list: ReportsMainTab[] = [];
    if (hasFinanceFeatures) list.push("financas");
    if (hasInvestmentsFeature) list.push("investimentos");
    if (hasFinanceFeatures) list.push("balanco");
    if (hasInvestmentsFeature) list.push("fiscal");
    if (list.length === 0) return ["financas", "investimentos", "balanco", "fiscal"];
    return list;
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  const defaultTab = availableTabs[0] ?? (hasInvestmentsFeature ? "investimentos" : "financas");

  const [selectedTab, setSelectedTab] = useState<ReportsMainTab>(() =>
    availableTabs.includes(activeTabParam) ? activeTabParam : defaultTab,
  );

  const mainTab: ReportsMainTab = availableTabs.includes(selectedTab) ? selectedTab : defaultTab;

  const handleTabChange = useCallback(
    (val: string) => {
      const nextTab = val as ReportsMainTab;
      setSelectedTab(nextTab);
      setSearchParams((prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("aba", nextTab);
        return updated;
      });
    },
    [setSearchParams],
  );

  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [aggregationTab, setAggregationTab] = useState<AggregationTab>("category");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const debouncedCustomStart = useDebounce(customStart, 350);
  const debouncedCustomEnd = useDebounce(customEnd, 350);

  const [detailModal, setDetailModal] = useState<{ title: string; expenses: Expense[] } | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const [financialReportOpen, setFinancialReportOpen] = useState(false);
  const [tearSheetOpen, setTearSheetOpen] = useState(false);
  const [dividendFreedomOpen, setDividendFreedomOpen] = useState(false);
  const [consolidatedWealthOpen, setConsolidatedWealthOpen] = useState(false);
  const [taxReportOpen, setTaxReportOpen] = useState(false);
  const [darfMonitorOpen, setDarfMonitorOpen] = useState(false);

  const [expandedTreeClasses, setExpandedTreeClasses] = useState<Set<string>>(() => new Set());
  const [expandedTreeSectors, setExpandedTreeSectors] = useState<Set<string>>(() => new Set());

  return {
    mainTab,
    handleTabChange,
    month,
    setMonth,
    year,
    setYear,
    mode,
    setMode,
    aggregationTab,
    setAggregationTab,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    debouncedCustomStart,
    debouncedCustomEnd,
    detailModal,
    setDetailModal,
    selectedExpense,
    setSelectedExpense,
    financialReportOpen,
    setFinancialReportOpen,
    tearSheetOpen,
    setTearSheetOpen,
    dividendFreedomOpen,
    setDividendFreedomOpen,
    consolidatedWealthOpen,
    setConsolidatedWealthOpen,
    taxReportOpen,
    setTaxReportOpen,
    darfMonitorOpen,
    setDarfMonitorOpen,
    expandedTreeClasses,
    setExpandedTreeClasses,
    expandedTreeSectors,
    setExpandedTreeSectors,
  };
}
