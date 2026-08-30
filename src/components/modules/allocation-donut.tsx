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
  /** Chave selecionada (modo controlado). */
  selectedKey?: string | null;
  /** Callback acionado ao alterar a seleção. */
  onSelectKey?: (key: string | null) => void;
  className?: string;
  listClassName?: string;
  /** Disposição entre anel e legendas ('auto' | 'vertical' | 'horizontal' | 'side-by-side'). */
  layout?: "auto" | "vertical" | "horizontal" | "side-by-side";
  /** Tamanho visual do anel SVG: "sm" (160px), "md" (200px padrão) ou "lg" (240px amplo). */
  donutSize?: "sm" | "md" | "lg";
  onSliceClick?: (slice: DonutSlice, index: number) => void;
}

/**
 * AllocationDonut — distribuição patrimonial por classe de ativo (§F16).
 * Contrato próprio de alocação (label + centavos); o anel/legenda reusam o
 * `CategoryDonut` (DRY — regra de ouro: zero JSX duplicado entre módulos).
 */
export function AllocationDonut({
  slices,
  centerValue,
  selectedKey,
  onSelectKey,
  className,
  listClassName,
  layout,
  donutSize,
  onSliceClick,
}: AllocationDonutProps) {
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
      selectedKey={selectedKey}
      onSelectKey={onSelectKey}
      className={className}
      listClassName={listClassName}
      layout={layout}
      donutSize={donutSize}
      onSliceClick={onSliceClick}
    />
  );
}

