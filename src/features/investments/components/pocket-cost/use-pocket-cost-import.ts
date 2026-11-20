import { useEffect, useMemo, useRef, useState } from "react";
import {
  computePocketCostSummary,
  filterHistoricalContributions,
} from "@/domain/portfolio/pocket-statement-parser";
import {
  usePortfolioContributions,
  usePortfolioSnapshots,
} from "@/state";
import { usePocketCostManual } from "./use-pocket-cost-manual";

export function usePocketCostImport(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL: number;
  onSuccess?: () => void;
}) {
  const { open, onOpenChange, defaultCostBRL, onSuccess } = params;

  const contributionsQuery = usePortfolioContributions();
  const snapshotsQuery = usePortfolioSnapshots();

  const [activeTab, setActiveTab] = useState<string>("manual");

  const refetchContributions = contributionsQuery.refetch;
  const refetchSnapshots = snapshotsQuery.refetch;
  const refetchContribRef = useRef(refetchContributions);
  const refetchSnapshotsRef = useRef(refetchSnapshots);

  useEffect(() => {
    refetchContribRef.current = refetchContributions;
    refetchSnapshotsRef.current = refetchSnapshots;
  }, [refetchContributions, refetchSnapshots]);

  useEffect(() => {
    if (open) {
      void refetchContribRef.current?.();
      void refetchSnapshotsRef.current?.();
    }
  }, [open]);

  const historicalContributions = useMemo(
    () => filterHistoricalContributions(contributionsQuery.data ?? []),
    [contributionsQuery.data],
  );

  const snapshotsData = snapshotsQuery.data;
  const snapshotsCount = snapshotsData?.length ?? 0;
  const snapshotsByMonth = useMemo(() => {
    const map = new Map<string, NonNullable<typeof snapshotsData>[number]>();
    for (const s of snapshotsData ?? []) {
      map.set(s.month, s);
    }
    return map;
  }, [snapshotsData]);

  const summary = useMemo(
    () => computePocketCostSummary(historicalContributions),
    [historicalContributions],
  );

  const manual = usePocketCostManual({
    historicalContributions,
    snapshotsByMonth,
    defaultCostBRL,
    refetchContributions: contributionsQuery.refetch,
    refetchSnapshots: snapshotsQuery.refetch,
    onOpenChange,
    onSuccess,
  });

  return {
    activeTab,
    setActiveTab,
    historicalContributions,
    snapshotsCount,
    snapshotsByMonth,
    summary,
    ...manual,
  };
}
