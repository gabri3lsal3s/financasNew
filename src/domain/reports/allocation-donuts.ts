import { normalizePercentagesTo100 } from "./distribution";

const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface RawAllocationPosition {
  assetClass: string | null;
  sector?: string | null;
  valueBRL: number;
}

export interface AllocationDonutSegment {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface AllocationDonutsResult {
  classSegments: AllocationDonutSegment[];
  sectorSegments: AllocationDonutSegment[];
  totalBRL: number;
  totalUniqueSectors: number;
}

export interface BuildAllocationDonutsParams {
  positions: readonly RawAllocationPosition[];
  cashBalanceBRL?: number;
  includeCash?: boolean;
}

export const DONUT_CLASS_COLORS: Record<string, string> = {
  acao: "#1b6b62",
  acoes: "#1b6b62",
  fii: "#dda726",
  fiis: "#dda726",
  etf: "#0284c7",
  etfs: "#0284c7",
  "renda fixa": "#2dd4bf",
  renda_fixa: "#2dd4bf",
  internacional: "#38bdf8",
  cripto: "#a855f7",
  caixa: "#10b981",
  outros: "#64748b",
};

export const DONUT_SECTOR_PALETTE: readonly string[] = [
  "#1b6b62", // teal escuro
  "#dda726", // ouro
  "#0284c7", // azul
  "#2dd4bf", // menta
  "#a855f7", // roxo
  "#f97316", // laranja
  "#38bdf8", // azul céu
  "#14b8a6", // teal claro
  "#eab308", // amarelo
  "#ec4899", // rosa
  "#8b5cf6", // violeta
  "#06b6d4", // ciano
  "#64748b", // slate neutro para outros
];

/**
 * Constrói os segmentos dos gráficos Donut de Classes e Setores
 * com isolamento estrito de Caixa e soma de percentuais normalizada a 100,0% (§F19).
 */
export function buildAllocationDonutSegments(
  params: BuildAllocationDonutsParams,
): AllocationDonutsResult {
  const { positions, cashBalanceBRL = 0, includeCash = true } = params;

  const validPositions = positions.filter((p) => p.valueBRL > 0);
  const totalInvestedBRL = validPositions.reduce((acc, p) => acc + p.valueBRL, 0);
  const effectiveCashBRL = includeCash && cashBalanceBRL > 0 ? cashBalanceBRL : 0;
  const totalBRL = round2(totalInvestedBRL + effectiveCashBRL);

  if (totalBRL <= 0) {
    return {
      classSegments: [],
      sectorSegments: [],
      totalBRL: 0,
      totalUniqueSectors: 0,
    };
  }

  // 1. Agrupamento por Classe de Ativos
  const classMap = new Map<string, number>();
  for (const pos of validPositions) {
    const rawClass = (pos.assetClass ?? "Outros").trim();
    const currentVal = classMap.get(rawClass) ?? 0;
    classMap.set(rawClass, currentVal + pos.valueBRL);
  }

  const classList: { label: string; value: number; key: string }[] = [];
  for (const [cls, val] of classMap.entries()) {
    const normKey = cls
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    classList.push({
      label: cls,
      value: val,
      key: normKey,
    });
  }

  if (effectiveCashBRL > 0) {
    classList.push({
      label: "Reserva de Caixa",
      value: effectiveCashBRL,
      key: "caixa",
    });
  }

  // Ordena decrescente por valor
  classList.sort((a, b) => b.value - a.value);

  const rawClassSegments = classList.map((item) => {
    const color = DONUT_CLASS_COLORS[item.key] ?? DONUT_CLASS_COLORS.outros ?? "#64748b";
    const rawPct = (item.value / totalBRL) * 100;
    return {
      key: item.key,
      label: item.label,
      value: round2(item.value),
      rawPct,
      color,
    };
  });

  const normalizedClasses = normalizePercentagesTo100(rawClassSegments, 1);
  const classSegments: AllocationDonutSegment[] = normalizedClasses.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.value,
    pct: item.formattedPct,
    color: item.color,
  }));

  // 2. Agrupamento por Setor Econômico (exclusivo para ativos produtivos corporativos)
  const sectorMap = new Map<string, number>();
  for (const pos of validPositions) {
    const rawSector =
      pos.sector && pos.sector.trim().length > 0
        ? pos.sector.trim()
        : (pos.assetClass ?? "Geral / Outros").trim();
    const currentVal = sectorMap.get(rawSector) ?? 0;
    sectorMap.set(rawSector, currentVal + pos.valueBRL);
  }

  const rawSectorList: { label: string; value: number }[] = [];
  for (const [sec, val] of sectorMap.entries()) {
    rawSectorList.push({
      label: sec,
      value: val,
    });
  }

  rawSectorList.sort((a, b) => b.value - a.value);
  const totalUniqueSectors = rawSectorList.length;

  const MAX_VISIBLE_SECTORS = 12;
  const MIN_SECTOR_PCT = 1.0;

  const topSectors: { label: string; value: number; isCash?: boolean }[] = [];
  let otherSectorsValue = 0;

  for (let i = 0; i < rawSectorList.length; i++) {
    const item = rawSectorList[i];
    if (!item) continue;
    const pct = (item.value / totalBRL) * 100;

    if (i < MAX_VISIBLE_SECTORS && pct >= MIN_SECTOR_PCT) {
      topSectors.push(item);
    } else if (i === MAX_VISIBLE_SECTORS - 1 && rawSectorList.length === MAX_VISIBLE_SECTORS) {
      // Se tiver exatamente 12 setores, não cria "Outros" apenas por ter 12
      topSectors.push(item);
    } else {
      otherSectorsValue += item.value;
    }
  }

  if (otherSectorsValue > 0) {
    topSectors.push({
      label: "Outros Setores",
      value: otherSectorsValue,
    });
  }

  // Se houver saldo em caixa, mantém como fatia destacada de liquidez própria
  // NUNCA aglutinada em "Outros Setores"
  if (effectiveCashBRL > 0) {
    topSectors.push({
      label: "Reserva de Caixa",
      value: effectiveCashBRL,
      isCash: true,
    });
  }

  const rawSectorSegments = topSectors.map((sec, index) => {
    const isOther = sec.label === "Outros Setores";
    const isCash = sec.isCash === true;
    let color: string;

    if (isCash) {
      color = "#10b981";
    } else if (isOther) {
      color = "#64748b";
    } else {
      color = DONUT_SECTOR_PALETTE[index % (DONUT_SECTOR_PALETTE.length - 1)] ?? "#64748b";
    }

    const rawPct = (sec.value / totalBRL) * 100;
    return {
      key: `sector-${index}-${sec.label.toLowerCase().replace(/\s+/g, "-")}`,
      label: sec.label,
      value: round2(sec.value),
      rawPct,
      color,
    };
  });

  const normalizedSectors = normalizePercentagesTo100(rawSectorSegments, 1);
  const sectorSegments: AllocationDonutSegment[] = normalizedSectors.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
    pct: s.formattedPct,
    color: s.color,
  }));

  return {
    classSegments,
    sectorSegments,
    totalBRL,
    totalUniqueSectors,
  };
}
