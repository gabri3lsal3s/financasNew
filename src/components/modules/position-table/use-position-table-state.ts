import { useEffect, useMemo, useState } from "react";
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
  const displaySourceRows = hideClosed ? activeRows : effectiveRows;

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

  const filteredRows = useMemo(
    () => filterPositionRows(displaySourceRows, { search, selectedClass }),
    [displaySourceRows, search, selectedClass],
  );

  const sortedRows = useMemo(() => sortPositionRows(filteredRows, sort), [filteredRows, sort]);
  const isGroupedMode = selectedClass === null;

  const classGroups = useMemo(
    () => (isGroupedMode && groupBy === "class" ? groupPositionsByClass(filteredRows, sort) : []),
    [isGroupedMode, groupBy, filteredRows, sort],
  );
  const sectorGroups = useMemo(
    () => (isGroupedMode && groupBy === "sector" ? groupPositionsBySector(filteredRows, sort) : []),
    [isGroupedMode, groupBy, filteredRows, sort],
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

  const isSectorExpanded = (sectorKey: string) =>
    expandedSectors[sectorKey] !== undefined ? expandedSectors[sectorKey] : autoExpandedSector === sectorKey;

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

  const hasFiltersActive = search.trim() !== "" || selectedClass !== null;

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
    groupBy,
    setGroupBy,
    isClassExpanded,
    toggleClass: (cls: string) =>
      setExpandedClasses((prev) => ({ ...prev, [cls]: !isClassExpanded(cls) })),
    isSectorExpanded,
    toggleSector: (key: string) =>
      setExpandedSectors((prev) => ({ ...prev, [key]: !isSectorExpanded(key) })),
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
    filteredRows,
    sortedRows,
    isGroupedMode,
    classGroups,
    sectorGroups,
    pagination,
    hasFiltersActive,
  };
}
