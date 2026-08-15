import { CategoryDonut } from "./category-donut";

export interface AllocationSlice {
  /** Nome da classe de ativo (ex.: "Ações", "FIIs", "Caixa"). */
  label: string;
  /** Valor de mercado em centavos. */
  valueCents: number;
}

export interface AllocationDonutProps {
  /** Fatias por classe, ordenadas por valor (desc) para a leitura do anel. */
  slices: AllocationSlice[];
  /** Centro do donut: valor total formatado (default). */
  centerValue?: string;
  className?: string;
}

/**
 * AllocationDonut — distribuição patrimonial por classe de ativo (§F16).
 * Contrato próprio de alocação (label + centavos); o anel/legenda reusam o
 * `CategoryDonut` (DRY — regra de ouro: zero JSX duplicado entre módulos).
 * As fatias sem cor caem na paleta da marca (CAT_DONUT_PALETTE).
 */
export function AllocationDonut({ slices, centerValue, className }: AllocationDonutProps) {
  return (
    <CategoryDonut
      slices={slices.map((slice) => ({ label: slice.label, valueCents: slice.valueCents }))}
      centerValue={centerValue}
      className={className}
    />
  );
}
