import { useRef } from "react";
import {
  PositionClosedSection,
  PositionMobileCard,
  type PositionRow,
  type PositionTableProps,
} from "@/components/modules/portfolio";
import { buildPositionColumns } from "./position-table/position-columns";
import { PositionDesktopHeader, PositionDesktopRow } from "./position-table/position-desktop-row";
import { PositionGroupSection } from "./position-table/position-group-section";
import { PositionPagination } from "./position-table/position-pagination";
import { PositionToolbar } from "./position-table/position-toolbar";
import { usePositionTableState } from "./position-table/use-position-table-state";

export type { PositionRow, PositionTableProps };

/**
 * Tabela de posições (§3.11.1 / §F17) — ledger derivado com visão adaptativa:
 * cards empilhados no mobile e tabela tabular com rolagem horizontal segura em tablet/desktop.
 */
export function PositionTable({
  rows,
  onListTransactions,
  onEditAsset,
  onCalibrateAsset,
  onSetManualPrice,
  onEvaluateScore,
  emptyMessage,
  highlightId,
  sortable = false,
}: PositionTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const state = usePositionTableState(rows, highlightId);
  const handleOpen = onListTransactions ?? onEditAsset;

  const { getColumnsForClass } = buildPositionColumns({
    sortable,
    sort: state.sort,
    onToggleSort: state.toggleSort,
    onOpen: handleOpen,
    onCalibrateAsset,
    onSetManualPrice,
    onEvaluateScore,
  });

  const emptyText = state.hasFiltersActive
    ? "Nenhum ativo encontrado para os filtros selecionados."
    : (emptyMessage ?? "Nenhum ativo na carteira.");

  const scrollToTop = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      containerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  };

  const renderGroupList = (variant: "mobile" | "desktop") => {
    if (state.groupBy === "sector" && state.sectorGroups.length > 0) {
      return state.sectorGroups.map((group) => {
        const sectorKey = `${group.className}__${group.sectorName}`;
        return (
          <PositionGroupSection
            key={sectorKey}
            mode="sector"
            variant={variant}
            groupKey={sectorKey}
            primaryTitle={group.sectorName}
            secondaryClassLabel={group.className}
            classNameForIcon={group.className}
            count={group.count}
            totalValueBRL={group.totalValueBRL}
            totalPct={group.totalPct}
            groupRentab={group.totalReturnPct !== null ? group.totalReturnPct : group.unrealizedPct}
            rows={group.rows}
            isExpanded={state.isSectorExpanded(sectorKey)}
            onToggle={() => state.toggleSector(sectorKey)}
            highlightId={highlightId}
            columns={getColumnsForClass(group.className)}
            onOpen={handleOpen}
            onCalibrateAsset={onCalibrateAsset}
            onEvaluateScore={onEvaluateScore}
            onSetManualPrice={onSetManualPrice}
          />
        );
      });
    }

    if (state.isGroupedMode && state.classGroups.length > 0) {
      return state.classGroups.map((group) => (
        <PositionGroupSection
          key={group.className}
          mode="class"
          variant={variant}
          groupKey={group.className}
          primaryTitle={group.className}
          classNameForIcon={group.className}
          count={group.count}
          totalValueBRL={group.totalValueBRL}
          totalPct={group.totalPct}
          groupRentab={group.totalReturnPct !== null ? group.totalReturnPct : group.unrealizedPct}
          rows={group.rows}
          isExpanded={state.isClassExpanded(group.className)}
          onToggle={() => state.toggleClass(group.className)}
          highlightId={highlightId}
          columns={getColumnsForClass(group.className)}
          onOpen={handleOpen}
          onCalibrateAsset={onCalibrateAsset}
          onEvaluateScore={onEvaluateScore}
          onSetManualPrice={onSetManualPrice}
        />
      ));
    }

    return null;
  };

  const flatColumns = getColumnsForClass(state.selectedClass);

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <PositionToolbar
          search={state.search}
          onSearchChange={state.setSearch}
          groupBy={state.groupBy}
          onGroupByChange={state.setGroupBy}
          availableClasses={state.availableClasses}
          selectedClass={state.selectedClass}
          onSelectClass={state.setSelectedClass}
          closedCount={state.closedRows.length}
          hideClosed={state.hideClosed}
          onToggleHideClosed={state.toggleHideClosed}
          filteredCount={state.filteredRows.length}
          totalCount={rows.length}
          hasFiltersActive={state.hasFiltersActive}
        />
      ) : null}

      {/* Visão Mobile (< sm) */}
      <ul aria-label="Posições (visão móvel)" className="flex flex-col gap-2.5 sm:hidden">
        {state.filteredRows.length === 0 ? (
          <li className="rounded-xl border border-border/80 bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </li>
        ) : (
          renderGroupList("mobile") ??
          state.pagination.items.map((row) => (
            <PositionMobileCard
              key={row.assetId}
              row={row}
              highlightId={highlightId}
              onOpen={handleOpen}
              onCalibrateAsset={onCalibrateAsset}
              onEvaluateScore={onEvaluateScore}
              onSetManualPrice={onSetManualPrice}
            />
          ))
        )}
      </ul>

      {/* Visão Tablet & Desktop (sm+) com overflow-x-auto e min-w-[780px] */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs">
          <div className="min-w-[780px] w-full">
            {state.filteredRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              renderGroupList("desktop") ?? (
                <>
                  <PositionDesktopHeader columns={flatColumns} />
                  {state.pagination.items.map((row) => (
                    <PositionDesktopRow
                      key={row.assetId}
                      row={row}
                      columns={flatColumns}
                      isHighlighted={highlightId === row.assetId}
                      onOpen={handleOpen}
                    />
                  ))}
                </>
              )
            )}
          </div>
        </div>
      </div>

      {!state.isGroupedMode && state.sortedRows.length > 5 ? (
        <PositionPagination
          startIndex={state.pagination.startIndex}
          endIndex={state.pagination.endIndex}
          totalCount={state.sortedRows.length}
          pageSize={state.pageSize}
          currentPage={state.pagination.currentPage}
          totalPages={state.pagination.totalPages}
          onPageSizeChange={state.setPageSize}
          onPageChange={(nextPage) => {
            state.setPage(nextPage);
            scrollToTop();
          }}
        />
      ) : null}

      {state.hideClosed ? (
        <PositionClosedSection
          closedRows={state.closedRows}
          isOpen={state.closedSectionOpen}
          onToggle={state.toggleClosedSection}
          onOpen={handleOpen}
        />
      ) : null}
    </div>
  );
}
