import { formatCentsAsBRL } from "@/services/masks";

export function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function buildCardAriaLabel(params: {
  name: string;
  masked: boolean;
  usedLimitCents: number;
  availableLimitCents: number | null;
  usedLimitPonderadoCents?: number;
}): string {
  if (params.masked) {
    return `Cartão ${params.name} (valores ocultos no modo privacidade)`;
  }
  const availablePart =
    params.availableLimitCents !== null ? `, disponível ${formatCentsAsBRL(params.availableLimitCents)}` : "";
  const ponderadoPart =
    params.usedLimitPonderadoCents !== undefined
      ? `, ponderada ${formatCentsAsBRL(params.usedLimitPonderadoCents)}`
      : "";
  return `Cartão ${params.name}, fatura atual ${formatCentsAsBRL(params.usedLimitCents)}${availablePart}${ponderadoPart}`;
}
