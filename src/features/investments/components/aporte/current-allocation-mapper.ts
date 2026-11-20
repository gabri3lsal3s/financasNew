import type { GroupTarget } from "@/types";
import type { ClassAporteSummary, SectorAporteSummary } from "@/domain/portfolio";
import type { AportePositionRowInput } from "@/domain/portfolio/aporte-execution-mapper";

/**
 * Deriva os resumos de alocação por Classe e Setor da carteira atual
 * para exibição estática do Cockpit quando aporteTotal === 0 (§Fase 4.5).
 * Não altera a matemática do motor de simulação.
 */
export function buildCurrentAllocationSummaries({
  positionRows,
  rawClassTargets,
  rawSectorTargets,
}: {
  positionRows: readonly AportePositionRowInput[];
  rawClassTargets: readonly GroupTarget[];
  rawSectorTargets: readonly GroupTarget[];
}): {
  classSummaries: ClassAporteSummary[];
  sectorSummaries: SectorAporteSummary[];
  totalCurrentBRL: number;
} {
  const nonCashRows = positionRows.filter((r) => !r.isCash);
  const totalCurrentBRL = nonCashRows.reduce((sum, r) => sum + r.valueBRL, 0);

  // Mapeia classes existentes na carteira e nas metas
  const classNamesSet = new Set<string>();
  nonCashRows.forEach((r) => {
    if (r.assetClass) classNamesSet.add(r.assetClass);
  });
  rawClassTargets.forEach((t) => {
    if (t.name) classNamesSet.add(t.name);
  });

  const classTargetMap = new Map(rawClassTargets.map((t) => [t.name.trim().toLowerCase(), t.target_percentage]));

  const classSummaries: ClassAporteSummary[] = Array.from(classNamesSet).map((cls) => {
    const currentVal = nonCashRows
      .filter((r) => r.assetClass?.trim().toLowerCase() === cls.trim().toLowerCase())
      .reduce((sum, r) => sum + r.valueBRL, 0);
    const targetPct = classTargetMap.get(cls.trim().toLowerCase()) ?? 0;
    const targetValueBRL = (targetPct / 100) * totalCurrentBRL;
    const gapBRL = Math.max(0, targetValueBRL - currentVal);

    return {
      className: cls,
      targetPct,
      targetValueBRL,
      currentValueBRL: currentVal,
      gapBRL,
      budgetAllocatedBRL: 0,
      actualAllocatedBRL: 0,
    };
  });

  // Setores
  const sectorMap = new Map<string, { className: string; sectorName: string; currentValueBRL: number }>();
  nonCashRows.forEach((r) => {
    const cls = r.assetClass ?? "Ações";
    const sec = r.sector ?? "Geral";
    const key = `${cls}::${sec}`;
    const existing = sectorMap.get(key);
    if (existing) {
      existing.currentValueBRL += r.valueBRL;
    } else {
      sectorMap.set(key, { className: cls, sectorName: sec, currentValueBRL: r.valueBRL });
    }
  });

  const sectorTargetMap = new Map(
    rawSectorTargets.map((st) => [
      `${(st.class_name ?? "").trim().toLowerCase()}::${st.name.trim().toLowerCase()}`,
      st.target_percentage,
    ]),
  );

  const sectorSummaries: SectorAporteSummary[] = Array.from(sectorMap.values()).map((item) => {
    const key = `${item.className.trim().toLowerCase()}::${item.sectorName.trim().toLowerCase()}`;
    const targetPctInClass = sectorTargetMap.get(key) ?? 0;
    const classSummary = classSummaries.find(
      (c) => c.className.trim().toLowerCase() === item.className.trim().toLowerCase(),
    );
    const classCurrentVal = classSummary?.currentValueBRL ?? 0;
    const targetVal = (targetPctInClass / 100) * classCurrentVal;
    const gap = Math.max(0, targetVal - item.currentValueBRL);

    return {
      className: item.className,
      sectorName: item.sectorName,
      targetPctInClass,
      effectiveTargetPct: ((classSummary?.targetPct ?? 0) * targetPctInClass) / 100,
      targetValueBRL: targetVal,
      currentValueBRL: item.currentValueBRL,
      gapBRL: gap,
      budgetAllocatedBRL: 0,
      actualAllocatedBRL: 0,
    };
  });

  return {
    classSummaries,
    sectorSummaries,
    totalCurrentBRL,
  };
}
