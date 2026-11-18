/**
 * Motor de Análise de Defasagem de Alocação (Target vs. Actual) — Consultoria de Carteira (§F42).
 *
 * Função pura e determinística que compara a alocação atual da carteira com as metas
 * definidas pelo investidor (por Macroclasse e por Ativo individual), calculando os
 * gaps financeiros em BRL e o score de aderência patrimonial (0–100%).
 */

export interface AllocationPositionInput {
  id: string;
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector?: string | null;
  valueBRL: number;
  isCash?: boolean;
}

export interface ClassTargetInput {
  assetClass: string;
  targetPercentage: number;
}

export interface SectorTargetInput {
  className?: string;
  sectorName: string;
  targetPercentage: number;
}

export interface AssetTargetInput {
  assetId: string;
  targetPercentage: number;
}

export type GapStatus = "deficit" | "balanced" | "surplus";

export interface ClassAllocationGap {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  recommendedOrder: number;
}

export interface SectorAllocationGap {
  className: string;
  sectorName: string;
  currentBRL: number;
  currentPct: number;
  targetPctInClass: number;
  effectiveTargetPct: number;
  targetIdealBRL: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  recommendedOrder: number;
}

export interface AssetAllocationGap {
  assetId: string;
  ticker: string;
  assetClass: string;
  sector?: string | null;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  recommendedOrder: number;
}

export interface AllocationTreeAssetNode {
  id: string;
  ticker: string;
  name?: string | null;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
}

export interface AllocationTreeSectorNode {
  sectorName: string;
  className: string;
  currentBRL: number;
  currentPct: number;
  targetPctInClass: number;
  effectiveTargetPct: number;
  targetIdealBRL: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  assets: AllocationTreeAssetNode[];
}

export interface AllocationTreeClassNode {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  targetIdealBRL: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  sectors: AllocationTreeSectorNode[];
}

export interface AllocationAnalysisResult {
  totalBRL: number;
  alignmentScore: number;
  equilibriumIndexPct: number;
  totalTargetPct: number;
  totalGapBRL: number;
  classGaps: ClassAllocationGap[];
  sectorGaps: SectorAllocationGap[];
  assetGaps: AssetAllocationGap[];
  topDeficitClass: ClassAllocationGap | null;
  topDeficitSector: SectorAllocationGap | null;
  topDeficitAsset: AssetAllocationGap | null;
  treeNodes: AllocationTreeClassNode[];
}

function divideSafe(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

/** Tolerância percentual para considerar uma alocação equilibrada (ex.: ±0.5%). */
const BALANCE_TOLERANCE_PCT = 0.5;

function resolveGapStatus(gapPct: number, hasTarget: boolean): GapStatus {
  if (!hasTarget) return "balanced";
  if (gapPct > BALANCE_TOLERANCE_PCT) return "deficit";
  if (gapPct < -BALANCE_TOLERANCE_PCT) return "surplus";
  return "balanced";
}

/** Mapeamento de categorias legadas para equivalentes canônicos */
const LEGACY_TO_CANONICAL_CLASS_MAP: Record<string, string> = {
  "fundos imobiliarios": "FIIs",
  "fundo imobiliario": "FIIs",
  "acoes de dividendos": "Ações",
  "acoes dividendos": "Ações",
  "renda fixa cdi": "Renda Fixa",
  "reits globais": "Internacional",
  "reits": "Internacional",
};

/**
 * Saneia metas de alocação que contenham taxonomias legadas órfãs (BUG-11).
 * Quando a soma das metas ultrapassa 100% devido a registros legados com saldo R$ 0,00,
 * expurga as categorias legadas órfãs mantendo o conjunto canônico ativo somando 100,00%.
 */
export function sanitizeOrphanLegacyTargets(
  positions: readonly AllocationPositionInput[],
  classTargets: readonly ClassTargetInput[],
): ClassTargetInput[] {
  if (classTargets.length === 0) return [];

  const rawSum = classTargets.reduce((acc, ct) => acc + (ct.targetPercentage || 0), 0);
  const classValueMap = new Map<string, number>();
  for (const pos of positions) {
    const cls = pos.assetClass || (pos.isCash ? "Caixa" : "Outros");
    classValueMap.set(cls, (classValueMap.get(cls) ?? 0) + Math.max(0, pos.valueBRL));
  }

  // Se a soma ultrapassa 100% (ex: 200% em caso de taxonomia legada coexistente)
  if (rawSum > 100.01) {
    // 1. Remove classes legadas órfãs com saldo zero
    const filtered = classTargets.filter((ct) => {
      const norm = ct.assetClass
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const isKnownLegacy = norm in LEGACY_TO_CANONICAL_CLASS_MAP;
      const currentBalance = classValueMap.get(ct.assetClass) ?? 0;

      if (isKnownLegacy && currentBalance <= 0.001) {
        return false;
      }
      return true;
    });

    const filteredSum = filtered.reduce((acc, ct) => acc + ct.targetPercentage, 0);
    if (Math.abs(filteredSum - 100) <= 0.05) {
      return filtered;
    }

    // Se ainda ultrapassar 100%, filtra classes sem saldo caso as ativas já somem 100%
    if (filteredSum > 100.01) {
      const activeOnly = filtered.filter((ct) => (classValueMap.get(ct.assetClass) ?? 0) > 0.001);
      const activeSum = activeOnly.reduce((acc, ct) => acc + ct.targetPercentage, 0);
      if (Math.abs(activeSum - 100) <= 0.05) {
        return activeOnly;
      }
      if (activeSum > 0) {
        return activeOnly.map((ct) => ({
          assetClass: ct.assetClass,
          targetPercentage: Math.round((ct.targetPercentage / activeSum) * 10000) / 100,
        }));
      }
    }
  }

  return classTargets.map((ct) => ({ ...ct }));
}

export function calculateAllocationGaps(
  positions: readonly AllocationPositionInput[],
  classTargets: readonly ClassTargetInput[] = [],
  assetTargets: readonly AssetTargetInput[] = [],
  sectorTargets: readonly SectorTargetInput[] = [],
): AllocationAnalysisResult {
  const totalBRL = positions.reduce((acc, pos) => acc + Math.max(0, pos.valueBRL), 0);

  // Saneamento preventivo de metas legadas órfãs (BUG-11)
  const sanitizedClassTargets = sanitizeOrphanLegacyTargets(positions, classTargets);

  // 1. Agrupar posições por classe e setor
  const classValueMap = new Map<string, number>();
  const classPositionsMap = new Map<string, AllocationPositionInput[]>();

  for (const pos of positions) {
    const cls = pos.assetClass || (pos.isCash ? "Caixa" : "Outros");
    classValueMap.set(cls, (classValueMap.get(cls) ?? 0) + Math.max(0, pos.valueBRL));
    const list = classPositionsMap.get(cls) ?? [];
    list.push(pos);
    classPositionsMap.set(cls, list);
  }

  // Coletar todas as classes únicas (das posições e das metas saneadas)
  const allClasses = new Set<string>([...classValueMap.keys(), ...sanitizedClassTargets.map((ct) => ct.assetClass)]);
  const classTargetMap = new Map<string, number>(sanitizedClassTargets.map((ct) => [ct.assetClass, ct.targetPercentage]));

  const classGaps: ClassAllocationGap[] = [];
  let totalAbsoluteClassDeviations = 0;

  for (const cls of allClasses) {
    const currentBRL = classValueMap.get(cls) ?? 0;
    const currentPct = divideSafe(currentBRL, totalBRL) * 100;
    const targetPct = classTargetMap.get(cls) ?? 0;
    const targetIdealBRL = totalBRL * (targetPct / 100);
    const gapBRL = targetIdealBRL - currentBRL;
    const gapPct = targetPct - currentPct;

    const status = resolveGapStatus(gapPct, targetPct > 0);

    totalAbsoluteClassDeviations += Math.abs(gapPct);

    classGaps.push({
      assetClass: cls,
      currentBRL,
      currentPct,
      targetPct,
      gapBRL,
      gapPct,
      status,
      recommendedOrder: 0,
    });
  }

  // Ordenar classes: maiores déficits primeiro (gapBRL decrescente)
  classGaps.sort((a, b) => b.gapBRL - a.gapBRL);
  classGaps.forEach((cg, idx) => {
    cg.recommendedOrder = idx + 1;
  });

  // 2. Análise por Ativo Individual
  const assetTargetMap = new Map<string, number>(assetTargets.map((at) => [at.assetId, at.targetPercentage]));
  const assetGaps: AssetAllocationGap[] = [];

  const nonCashPositions = positions.filter((p) => !p.isCash);
  for (const pos of nonCashPositions) {
    const currentBRL = Math.max(0, pos.valueBRL);
    const currentPct = divideSafe(currentBRL, totalBRL) * 100;
    const targetPct = assetTargetMap.get(pos.id) ?? 0;
    const targetIdealBRL = totalBRL * (targetPct / 100);
    const gapBRL = targetIdealBRL - currentBRL;
    const gapPct = targetPct - currentPct;

    const status = resolveGapStatus(gapPct, targetPct > 0);

    assetGaps.push({
      assetId: pos.id,
      ticker: pos.ticker,
      assetClass: pos.assetClass,
      sector: pos.sector,
      currentBRL,
      currentPct,
      targetPct,
      gapBRL,
      gapPct,
      status,
      recommendedOrder: 0,
    });
  }

  // Ordenar ativos: maiores déficits primeiro
  assetGaps.sort((a, b) => b.gapBRL - a.gapBRL);
  assetGaps.forEach((ag, idx) => {
    ag.recommendedOrder = idx + 1;
  });

  // 3. Análise por Setor
  const sectorTargetMap = new Map<string, number>();
  for (const st of sectorTargets) {
    const key = st.className ? `${st.className}::${st.sectorName}` : st.sectorName;
    sectorTargetMap.set(key, st.targetPercentage);
  }

  const sectorGaps: SectorAllocationGap[] = [];
  const sectorGroups = new Map<string, { className: string; sectorName: string; currentBRL: number; positions: AllocationPositionInput[] }>();

  for (const pos of nonCashPositions) {
    const cls = pos.assetClass || "Outros";
    const sec = pos.sector?.trim() || "Geral";
    const key = `${cls}::${sec}`;

    const existing = sectorGroups.get(key) ?? { className: cls, sectorName: sec, currentBRL: 0, positions: [] };
    existing.currentBRL += Math.max(0, pos.valueBRL);
    existing.positions.push(pos);
    sectorGroups.set(key, existing);
  }

  // Também inclui setores definidos em metas mesmo que sem posição atual
  for (const st of sectorTargets) {
    const cls = st.className || "Ações";
    const key = `${cls}::${st.sectorName}`;
    if (!sectorGroups.has(key)) {
      sectorGroups.set(key, { className: cls, sectorName: st.sectorName, currentBRL: 0, positions: [] });
    }
  }

  for (const group of sectorGroups.values()) {
    const classTargetPct = classTargetMap.get(group.className) ?? 0;
    const targetInClass =
      sectorTargetMap.get(`${group.className}::${group.sectorName}`) ??
      sectorTargetMap.get(group.sectorName) ??
      0;

    const currentPct = divideSafe(group.currentBRL, totalBRL) * 100;
    const effectiveTargetPct = classTargetPct > 0 && targetInClass > 0
      ? (classTargetPct * targetInClass) / 100
      : targetInClass;

    const targetIdealBRL = totalBRL * (effectiveTargetPct / 100);
    const gapBRL = targetIdealBRL - group.currentBRL;
    const gapPct = effectiveTargetPct - currentPct;
    const hasTarget = effectiveTargetPct > 0 || targetInClass > 0;
    const status = resolveGapStatus(gapPct, hasTarget);

    sectorGaps.push({
      className: group.className,
      sectorName: group.sectorName,
      currentBRL: group.currentBRL,
      currentPct,
      targetPctInClass: targetInClass,
      effectiveTargetPct,
      targetIdealBRL,
      gapBRL,
      gapPct,
      status,
      recommendedOrder: 0,
    });
  }

  sectorGaps.sort((a, b) => b.gapBRL - a.gapBRL);
  sectorGaps.forEach((sg, idx) => {
    sg.recommendedOrder = idx + 1;
  });

  // 4. Estrutura Hierárquica em Árvore (Classe -> Setor -> Ativos)
  const treeNodes: AllocationTreeClassNode[] = classGaps.map((cg) => {
    const classPositions = classPositionsMap.get(cg.assetClass) ?? [];
    const classSectors = sectorGaps.filter((sg) => sg.className === cg.assetClass);

    const sectorNodes: AllocationTreeSectorNode[] = classSectors.map((sg) => {
      const sectorPositions = classPositions.filter((p) => (p.sector?.trim() || "Geral") === sg.sectorName);
      const assetNodes: AllocationTreeAssetNode[] = sectorPositions.map((pos) => {
        const ag = assetGaps.find((a) => a.assetId === pos.id);
        const curBRL = Math.max(0, pos.valueBRL);
        const curPct = divideSafe(curBRL, totalBRL) * 100;
        const tgtPct = ag?.targetPct ?? 0;
        const gBRL = ag?.gapBRL ?? 0;
        const gPct = ag?.gapPct ?? 0;
        return {
          id: pos.id,
          ticker: pos.ticker,
          name: pos.name,
          currentBRL: curBRL,
          currentPct: curPct,
          targetPct: tgtPct,
          gapBRL: gBRL,
          gapPct: gPct,
          status: ag?.status ?? "balanced",
        };
      });

      return {
        sectorName: sg.sectorName,
        className: sg.className,
        currentBRL: sg.currentBRL,
        currentPct: sg.currentPct,
        targetPctInClass: sg.targetPctInClass,
        effectiveTargetPct: sg.effectiveTargetPct,
        targetIdealBRL: sg.targetIdealBRL,
        gapBRL: sg.gapBRL,
        gapPct: sg.gapPct,
        status: sg.status,
        assets: assetNodes,
      };
    });

    return {
      assetClass: cg.assetClass,
      currentBRL: cg.currentBRL,
      currentPct: cg.currentPct,
      targetPct: cg.targetPct,
      targetIdealBRL: totalBRL * (cg.targetPct / 100),
      gapBRL: cg.gapBRL,
      gapPct: cg.gapPct,
      status: cg.status,
      sectors: sectorNodes,
    };
  });

  // 5. Score de aderência patrimonial (Índice de Equilíbrio Geral - IEG)
  const hasTargets = sanitizedClassTargets.length > 0;
  const rawIeg = hasTargets && totalBRL > 0
    ? Math.max(0, Math.min(100, 100 - totalAbsoluteClassDeviations / 2))
    : 100;
  const alignmentScore = Math.round(rawIeg);
  const equilibriumIndexPct = Math.round(rawIeg * 10) / 10;
  const totalTargetPct = Math.round(sanitizedClassTargets.reduce((acc, ct) => acc + ct.targetPercentage, 0) * 100) / 100;
  const totalGapBRL = Math.round(classGaps.reduce((acc, cg) => acc + cg.gapBRL, 0) * 100) / 100;

  const topDeficitClass = classGaps.find((c) => c.status === "deficit" && c.gapBRL > 0) ?? null;
  const topDeficitSector = sectorGaps.find((s) => s.status === "deficit" && s.gapBRL > 0) ?? null;
  const topDeficitAsset = assetGaps.find((a) => a.status === "deficit" && a.gapBRL > 0) ?? null;

  return {
    totalBRL,
    alignmentScore,
    equilibriumIndexPct,
    totalTargetPct,
    totalGapBRL,
    classGaps,
    sectorGaps,
    assetGaps,
    topDeficitClass,
    topDeficitSector,
    topDeficitAsset,
    treeNodes,
  };
}
