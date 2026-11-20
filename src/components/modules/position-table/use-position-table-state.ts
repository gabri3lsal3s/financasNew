import { useEffect, useMemo, useState } from "react";
import { inferSectorFromTicker } from "@/domain/portfolio";
import {
  filterPositionRows,
  groupPositionsByClass,
  groupPositionsBySector,
  isPositionRowClosed,
  paginatePositionRows,
  resolveHighlightedGroupKey,
  sortPositionRows,
} from "@/domain/portfolio/position-grouping";
import type { PositionRow, SortKey, SortState } from "@/components/modules/portfolio";

export function usePositionTableState(rows: readonly PositionRow[], highlightId?: string | null) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [governanceFilter, setGovernanceFilter] = useState<"all" | "core" | "quarantine" | "exit">("core");
  const [quarantineSectionOpen, setQuarantineSectionOpen] = useState(false);
  const [exitSectionOpen, setExitSectionOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<"class" | "sector">("class");
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const [hideClosed, setHideClosed] = useState(true);
  const [closedSectionOpen, setClosedSectionOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 5 : 10,
  );
  const [page, setPage] = useState<number>(1);

  const effectiveRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);
  const activeRows = useMemo(() => effectiveRows.filter((r) => !isPositionRowClosed(r)), [effectiveRows]);
  const closedRows = useMemo(() => effectiveRows.filter((r) => isPositionRowClosed(r)), [effectiveRows]);

  const quarantineRows = useMemo(
    () => activeRows.filter((r) => r.allocationStatus === "quarantine"),
    [activeRows],
  );
  const exitRows = useMemo(
    () => activeRows.filter((r) => r.allocationStatus === "exit"),
    [activeRows],
  );
  const coreRows = useMemo(
    () => activeRows.filter((r) => r.allocationStatus !== "quarantine" && r.allocationStatus !== "exit"),
    [activeRows],
  );

  const displaySourceRows = useMemo(() => {
    let source = activeRows;
    if (governanceFilter === "core") {
      source = coreRows;
    } else if (governanceFilter === "quarantine") {
      source = quarantineRows;
    } else if (governanceFilter === "exit") {
      source = exitRows;
    }
    return hideClosed ? source : effectiveRows;
  }, [activeRows, coreRows, quarantineRows, exitRows, governanceFilter, hideClosed, effectiveRows]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => {
      const el =
        document.getElementById(`asset-row-${highlightId}`) ??
        document.getElementById(`asset-card-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const availableClasses = useMemo(
    () => [...new Set(displaySourceRows.map((r) => r.assetClass).filter((c): c is string => Boolean(c)))],
    [displaySourceRows],
  );

  const availableSectors = useMemo(() => {
    const rowsToInspect = selectedClass
      ? displaySourceRows.filter((r) => r.assetClass === selectedClass)
      : displaySourceRows;

    const sectors = rowsToInspect.map(
      (r) => r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass) || "Outros",
    );
    return [...new Set(sectors)].sort((a, b) => a.localeCompare(b));
  }, [displaySourceRows, selectedClass]);

  const effectiveSelectedSector =
    selectedSector && availableSectors.includes(selectedSector) ? selectedSector : null;

  const filteredRows = useMemo(
    () => filterPositionRows(displaySourceRows, { search, selectedClass, selectedSector: effectiveSelectedSector }),
    [displaySourceRows, search, selectedClass, effectiveSelectedSector],
  );

  const sortedRows = useMemo(() => sortPositionRows(filteredRows, sort), [filteredRows, sort]);
  const isGroupedMode = groupBy === "sector" ? true : selectedClass === null;

  const classGroups = useMemo(
    () => (groupBy === "class" && selectedClass === null ? groupPositionsByClass(filteredRows, sort) : []),
    [groupBy, selectedClass, filteredRows, sort],
  );
  const sectorGroups = useMemo(
    () => (groupBy === "sector" ? groupPositionsBySector(filteredRows, sort) : []),
    [groupBy, filteredRows, sort],
  );

  const autoExpandedClass = useMemo(
    () => resolveHighlightedGroupKey(effectiveRows, highlightId, "class"),
    [effectiveRows, highlightId],
  );
  const autoExpandedSector = useMemo(
    () => resolveHighlightedGroupKey(effectiveRows, highlightId, "sector"),
    [effectiveRows, highlightId],
  );

  const isClassExpanded = (clsName: string) =>
    expandedClasses[clsName] !== undefined ? expandedClasses[clsName] : autoExpandedClass === clsName;

  const isSectorExpanded = (sectorKey: string) => {
    if (expandedSectors[sectorKey] !== undefined) return expandedSectors[sectorKey];
    if (effectiveSelectedSector !== null) return true;
    return autoExpandedSector === sectorKey;
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const pagination = useMemo(
    () => paginatePositionRows(sortedRows, page, pageSize),
    [sortedRows, page, pageSize],
  );

  const allClassKeys = useMemo(() => classGroups.map((g) => g.className), [classGroups]);
  const allSectorKeys = useMemo(
    () => sectorGroups.map((g) => `${g.className}__${g.sectorName}`),
    [sectorGroups],
  );

  const activeGroupKeys = groupBy === "class" ? allClassKeys : allSectorKeys;
  const areAllExpanded =
    activeGroupKeys.length > 0 &&
    activeGroupKeys.every((key) => (groupBy === "class" ? isClassExpanded(key) : isSectorExpanded(key)));

  const toggleExpandAll = () => {
    const nextState = !areAllExpanded;
    if (groupBy === "class") {
      const nextMap: Record<string, boolean> = {};
      allClassKeys.forEach((k) => {
        nextMap[k] = nextState;
      });
      setExpandedClasses(nextMap);
    } else {
      const nextMap: Record<string, boolean> = {};
      allSectorKeys.forEach((k) => {
        nextMap[k] = nextState;
      });
      setExpandedSectors(nextMap);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedClass(null);
    setSelectedSector(null);
    setGovernanceFilter("core");
    setPage(1);
  };

  const hasFiltersActive =
    search.trim() !== "" ||
    selectedClass !== null ||
    effectiveSelectedSector !== null ||
    governanceFilter !== "core";

  return {
    sort,
    toggleSort,
    search,
    setSearch: (val: string) => {
      setSearch(val);
      setPage(1);
    },
    selectedClass,
    setSelectedClass: (cls: string | null) => {
      setSelectedClass(cls);
      setPage(1);
    },
    selectedSector: effectiveSelectedSector,
    setSelectedSector: (sec: string | null) => {
      setSelectedSector(sec);
      setPage(1);
    },
    groupBy,
    setGroupBy: (mode: "class" | "sector") => {
      setGroupBy(mode);
      if (mode === "class") {
        setSelectedSector(null);
      }
      setPage(1);
    },
    isClassExpanded,
    toggleClass: (cls: string) =>
      setExpandedClasses((prev) => ({ ...prev, [cls]: !isClassExpanded(cls) })),
    isSectorExpanded,
    toggleSector: (key: string) =>
      setExpandedSectors((prev) => ({ ...prev, [key]: !isSectorExpanded(key) })),
    toggleExpandAll,
    areAllExpanded,
    clearFilters,
    governanceFilter,
    setGovernanceFilter: (status: "all" | "core" | "quarantine" | "exit") => {
      setGovernanceFilter(status);
      setPage(1);
    },
    quarantineRows,
    exitRows,
    quarantineSectionOpen,
    toggleQuarantineSection: () => setQuarantineSectionOpen((prev) => !prev),
    exitSectionOpen,
    toggleExitSection: () => setExitSectionOpen((prev) => !prev),
    hideClosed,
    toggleHideClosed: () => setHideClosed((prev) => !prev),
    closedSectionOpen,
    toggleClosedSection: () => setClosedSectionOpen((prev) => !prev),
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    setPage,
    closedRows,
    availableClasses,
    availableSectors,
    filteredRows,
    sortedRows,
    isGroupedMode,
    classGroups,
    sectorGroups,
    pagination,
    hasFiltersActive,
  };
}
