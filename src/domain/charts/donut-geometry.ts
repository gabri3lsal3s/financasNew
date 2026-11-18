/**
 * Motor puro de geometria SVG para gráficos Donut — sem dependências de UI/Supabase.
 * Segue a escala fechada `--cat-1` .. `--cat-10` do DESIGN_RULES.md §1.3.
 */

export const DONUT_CATEGORY_TOKENS = [
  "--cat-1",
  "--cat-2",
  "--cat-3",
  "--cat-4",
  "--cat-5",
  "--cat-6",
  "--cat-7",
  "--cat-8",
  "--cat-9",
  "--cat-10",
] as const;

export const DONUT_CATEGORY_COLORS: readonly string[] = DONUT_CATEGORY_TOKENS.map(
  (token) => `hsl(var(${token}))`,
);

export interface DonutInputSlice {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutGeometryOptions {
  /** Tamanho do viewBox quadrado SVG (default 200). */
  size?: number;
  /** Espessura do traço do anel (default 24). */
  strokeWidth?: number;
  /** Espaço angular em graus entre fatias quando há 2+ fatias (default 2). */
  gapDegrees?: number;
  /** Piso mínimo de participação visual (0..0.25) para que fatias pequenas continuem clicáveis (default 0.02). */
  minVisualShare?: number;
}

export interface DonutComputedSlice {
  id: string;
  label: string;
  value: number;
  /** Participação real no total (0..1). */
  share: number;
  /** Percentual real (0..100). */
  percentage: number;
  /** Participação visual normalizada respeitando `minVisualShare` (soma = 1). */
  visualShare: number;
  /** Ângulo inicial em graus (0 = 12h, sentido horário). */
  startAngleDeg: number;
  /** Ângulo final em graus. */
  endAngleDeg: number;
  /** Ângulo central em graus. */
  midAngleDeg: number;
  /** Comprimento do arco em unidades do viewBox. */
  dashLength: number;
  /** Deslocamento negativo para `strokeDashoffset` em círculo rotacionado -90deg. */
  dashOffset: number;
  /** Cor CSS resolvida (sempre válida em atributos SVG/style). */
  color: string;
  /** Caminho SVG do arco (`d`). */
  pathD: string;
}

export interface DonutGeometryResult {
  total: number;
  size: number;
  strokeWidth: number;
  cx: number;
  cy: number;
  radius: number;
  circumference: number;
  slices: DonutComputedSlice[];
}

export function getDonutCategoryColor(index: number): string {
  const safeIndex = Math.abs(Math.trunc(index)) % DONUT_CATEGORY_COLORS.length;
  return DONUT_CATEGORY_COLORS[safeIndex]!;
}

export function resolveDonutSliceColor(customColor: string | undefined, index: number): string {
  const trimmed = customColor?.trim();
  if (!trimmed) return getDonutCategoryColor(index);
  if (trimmed.startsWith("--")) {
    return `hsl(var(${trimmed}))`;
  }
  if (trimmed.startsWith("var(--")) {
    return `hsl(${trimmed})`;
  }
  return trimmed;
}

/**
 * Redistribui shares garantindo um piso visual mínimo sem perder a soma unitária (= 1).
 */
export function computeVisualShares(shares: readonly number[], minVisualShare: number): number[] {
  if (shares.length === 0) return [];
  if (shares.length === 1) return [1];

  const effectiveMin = Math.min(Math.max(0, minVisualShare), 1 / shares.length);
  if (effectiveMin <= 0) return [...shares];

  const result = new Array<number>(shares.length).fill(0);
  const pinned = new Array<boolean>(shares.length).fill(false);

  let remainingWeight = 1;
  let remainingOriginalSum = 1;

  for (let pass = 0; pass < shares.length; pass++) {
    let changed = false;
    for (let i = 0; i < shares.length; i++) {
      if (pinned[i]) continue;
      const proportional =
        remainingOriginalSum > 0
          ? (shares[i]! / remainingOriginalSum) * remainingWeight
          : 0;
      if (proportional < effectiveMin) {
        pinned[i] = true;
        result[i] = effectiveMin;
        remainingWeight -= effectiveMin;
        remainingOriginalSum -= shares[i]!;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const unpinnedIndices: number[] = [];
  for (let i = 0; i < shares.length; i++) {
    if (!pinned[i]) unpinnedIndices.push(i);
  }

  if (unpinnedIndices.length > 0) {
    const unpinnedShareSum = unpinnedIndices.reduce((acc, idx) => acc + shares[idx]!, 0);
    for (const idx of unpinnedIndices) {
      result[idx] =
        unpinnedShareSum > 0
          ? (shares[idx]! / unpinnedShareSum) * Math.max(0, remainingWeight)
          : Math.max(0, remainingWeight) / unpinnedIndices.length;
    }
  }

  return result;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/**
 * Gera caminho SVG `d` de arco no sentido horário (0° no topo).
 */
export function describeDonutArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const sweep = endAngleDeg - startAngleDeg;
  if (sweep <= 0) return "";
  if (sweep >= 359.99) {
    const top = polarToCartesian(cx, cy, radius, 0);
    const bottom = polarToCartesian(cx, cy, radius, 180);
    return `M ${top.x.toFixed(3)} ${top.y.toFixed(3)} A ${radius} ${radius} 0 1 1 ${bottom.x.toFixed(3)} ${bottom.y.toFixed(3)} A ${radius} ${radius} 0 1 1 ${top.x.toFixed(3)} ${top.y.toFixed(3)}`;
  }

  const start = polarToCartesian(cx, cy, radius, startAngleDeg);
  const end = polarToCartesian(cx, cy, radius, endAngleDeg);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export function computeDonutGeometry(
  slices: readonly DonutInputSlice[],
  options: DonutGeometryOptions = {},
): DonutGeometryResult {
  const size = options.size ?? 200;
  const strokeWidth = options.strokeWidth ?? 24;
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;

  const positiveSlices = slices.filter((slice) => Number.isFinite(slice.value) && slice.value > 0);
  const total = positiveSlices.reduce((acc, slice) => acc + slice.value, 0);

  if (total <= 0 || positiveSlices.length === 0) {
    return {
      total: 0,
      size,
      strokeWidth,
      cx,
      cy,
      radius,
      circumference,
      slices: [],
    };
  }

  const rawGapDeg = positiveSlices.length > 1 ? Math.max(0, options.gapDegrees ?? 2) : 0;
  const maxAllowedGapDeg = positiveSlices.length > 1 ? 180 / positiveSlices.length : 0;
  const gapDeg = Math.min(rawGapDeg, maxAllowedGapDeg);
  const availableArcDeg = 360 - gapDeg * positiveSlices.length;

  const realShares = positiveSlices.map((slice) => slice.value / total);
  const visualShares = computeVisualShares(realShares, options.minVisualShare ?? 0.02);

  let cursorDeg = 0;
  const computed: DonutComputedSlice[] = positiveSlices.map((slice, index) => {
    const share = realShares[index]!;
    const visualShare = visualShares[index]!;
    const sweepDeg = visualShare * availableArcDeg;
    const startAngleDeg = cursorDeg;
    const endAngleDeg = startAngleDeg + sweepDeg;
    const midAngleDeg = startAngleDeg + sweepDeg / 2;
    const dashLength = (sweepDeg / 360) * circumference;
    const dashOffset = -((startAngleDeg / 360) * circumference);

    cursorDeg = endAngleDeg + (positiveSlices.length > 1 ? gapDeg : 0);

    return {
      id: slice.id,
      label: slice.label,
      value: slice.value,
      share,
      percentage: share * 100,
      visualShare,
      startAngleDeg,
      endAngleDeg,
      midAngleDeg,
      dashLength,
      dashOffset,
      color: resolveDonutSliceColor(slice.color, index),
      pathD: describeDonutArcPath(cx, cy, radius, startAngleDeg, endAngleDeg),
    };
  });

  return {
    total,
    size,
    strokeWidth,
    cx,
    cy,
    radius,
    circumference,
    slices: computed,
  };
}
