import { CategoryDonut, type DonutSlice } from "./category-donut";

export interface AllocationSlice {
  key?: string;
  /** Nome da classe de ativo (ex.: "Ações", "FIIs", "Caixa"). */
  label: string;
  /** Valor de mercado em centavos. */
  valueCents: number;
  subtitle?: string | null;
  onClick?: () => void;
}

export interface AllocationDonutProps {
  /** Fatias por classe, ordenadas por valor (desc) para a leitura do anel. */
  slices: AllocationSlice[];
  /** Centro do donut: valor total formatado (default). */
  centerValue?: string;
  className?: string;
  listClassName?: string;
  onSliceClick?: (slice: DonutSlice, index: number) => void;
}

/**
 * AllocationDonut — distribuição patrimonial por classe de ativo (§F16).
 * Contrato próprio de alocação (label + centavos); o anel/legenda reusam o
 * `CategoryDonut` (DRY — regra de ouro: zero JSX duplicado entre módulos).
 */
export function AllocationDonut({ slices, centerValue, className, listClassName, onSliceClick }: AllocationDonutProps) {
  return (
    <CategoryDonut
      slices={slices.map((slice) => ({
        key: slice.key,
        label: slice.label,
        valueCents: slice.valueCents,
        subtitle: slice.subtitle,
        onClick: slice.onClick,
      }))}
      centerValue={centerValue}
      className={className}
      listClassName={listClassName}
      onSliceClick={onSliceClick}
    />
  );
}
