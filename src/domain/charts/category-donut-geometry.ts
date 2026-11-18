import { resolveDonutSliceColor } from "./donut-geometry";

export const CATEGORY_DONUT_SIZE = 160;
export const CATEGORY_DONUT_STROKE_WIDTH = 15;
export const CATEGORY_DONUT_RADIUS = (CATEGORY_DONUT_SIZE - CATEGORY_DONUT_STROKE_WIDTH) / 2;
export const CATEGORY_DONUT_CIRCUMFERENCE = 2 * Math.PI * CATEGORY_DONUT_RADIUS;
export const CATEGORY_DONUT_CENTER = CATEGORY_DONUT_SIZE / 2;
export const CATEGORY_DONUT_GAP_SPACING = 5;
export const CATEGORY_DONUT_TOTAL_GAP = CATEGORY_DONUT_STROKE_WIDTH + CATEGORY_DONUT_GAP_SPACING;

export interface CategoryDonutSliceInput {
  key?: string;
  label: string;
  valueCents: number;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryVisualRingSlice {
  key: string;
  label: string;
  valueCents: number;
  colorStyle: string;
  isOthersGroup?: boolean;
  memberKeys: string[];
}

export interface CategoryDonutArc {
  key: string;
  label: string;
  valueCents: number;
  dash: number;
  offset: number;
  colorStyle: string;
  isSelected: boolean;
  isHovered: boolean;
  isOthersGroup?: boolean;
  strokeLinecap: "round" | "butt";
}

export function getCategorySliceColor(color: string | null | undefined, index: number): string {
  return resolveDonutSliceColor(color ?? undefined, index);
}

export function buildCategoryVisualRingSlices(
  validSlices: readonly CategoryDonutSliceInput[],
  maxVisualSlices: number,
): CategoryVisualRingSlice[] {
  if (validSlices.length <= maxVisualSlices) {
    return validSlices.map((s, idx) => {
      const key = s.key ?? `${s.label}-${idx}`;
      return {
        key,
        label: s.label,
        valueCents: s.valueCents,
        colorStyle: getCategorySliceColor(s.color, idx),
        memberKeys: [key],
      };
    });
  }

  const topCount = Math.max(1, maxVisualSlices - 1);
  const topSlices = validSlices.slice(0, topCount);
  const others = validSlices.slice(topCount);
  const othersValueCents = others.reduce((acc, s) => acc + s.valueCents, 0);

  const mappedTop: CategoryVisualRingSlice[] = topSlices.map((s, idx) => {
    const key = s.key ?? `${s.label}-${idx}`;
    return {
      key,
      label: s.label,
      valueCents: s.valueCents,
      colorStyle: getCategorySliceColor(s.color, idx),
      memberKeys: [key],
    };
  });

  const othersKeys = others.map((s, idx) => s.key ?? `${s.label}-${topCount + idx}`);
  mappedTop.push({
    key: "__donut_others__",
    label: `Outros (${others.length})`,
    valueCents: othersValueCents,
    colorStyle: "hsl(var(--muted-foreground) / 0.55)",
    isOthersGroup: true,
    memberKeys: othersKeys,
  });

  return mappedTop;
}

export function computeRoundPillShares(
  slices: readonly CategoryVisualRingSlice[],
  total: number,
  minShare = 0.05,
): number[] {
  const n = slices.length;
  if (n <= 1) return slices.map(() => 1);

  const effectiveMin = Math.min(minShare, 0.85 / n);
  const rawShares = slices.map((s) => (total > 0 ? s.valueCents / total : 1 / n));

  let underAllocatedSum = 0;
  let overAllocatedRawSum = 0;
  const isSmall = rawShares.map((share) => share < effectiveMin);

  for (let i = 0; i < n; i++) {
    if (isSmall[i]) {
      underAllocatedSum += effectiveMin;
    } else {
      overAllocatedRawSum += rawShares[i] ?? 0;
    }
  }

  const remainingBudget = Math.max(0, 1 - underAllocatedSum);
  const largeCount = isSmall.filter((small) => !small).length;
  return rawShares.map((share, i) => {
    if (isSmall[i]) return effectiveMin;
    return overAllocatedRawSum > 0
      ? (share / overAllocatedRawSum) * remainingBudget
      : largeCount > 0
        ? remainingBudget / largeCount
        : 0;
  });
}

export function buildCategoryDonutArcs(params: {
  visualRingSlices: readonly CategoryVisualRingSlice[];
  total: number;
  activeSelectedKey: string | null;
  hoveredSliceKey: string | null;
}): CategoryDonutArc[] {
  const { visualRingSlices, total, activeSelectedKey, hoveredSliceKey } = params;
  const hasMultipleRingSlices = visualRingSlices.length > 1;
  const visualShares = computeRoundPillShares(visualRingSlices, total, 0.05);
  const totalGapBudget = hasMultipleRingSlices ? visualRingSlices.length * CATEGORY_DONUT_TOTAL_GAP : 0;
  const availableDashBudget = Math.max(10, CATEGORY_DONUT_CIRCUMFERENCE - totalGapBudget);

  return visualRingSlices.map((vSlice, index) => {
    let dash: number;
    let offset: number;

    if (hasMultipleRingSlices) {
      const visualShare = visualShares[index] ?? 0;
      dash = Math.max(0.1, visualShare * availableDashBudget);

      const priorVisualShare = visualShares.slice(0, index).reduce((sum, v) => sum + v, 0);
      const priorOffset = priorVisualShare * availableDashBudget + index * CATEGORY_DONUT_TOTAL_GAP;
      offset = priorOffset + CATEGORY_DONUT_TOTAL_GAP / 2;
    } else {
      dash = CATEGORY_DONUT_CIRCUMFERENCE;
      offset = 0;
    }

    return {
      key: vSlice.key,
      label: vSlice.label,
      valueCents: vSlice.valueCents,
      dash,
      offset,
      colorStyle: vSlice.colorStyle,
      isSelected: activeSelectedKey !== null && vSlice.memberKeys.includes(activeSelectedKey),
      isHovered: hoveredSliceKey !== null && vSlice.memberKeys.includes(hoveredSliceKey),
      isOthersGroup: vSlice.isOthersGroup,
      strokeLinecap: (hasMultipleRingSlices ? "round" : "butt") as "round" | "butt",
    };
  });
}
