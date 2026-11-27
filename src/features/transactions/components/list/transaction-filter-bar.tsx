import { useMemo } from "react";
import {
  ArrowLeftRight,
  Briefcase,
  Layers,
  LayoutList,
  Repeat,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Chip, SearchInput, Tabs } from "@/components/ui";
import type { BusinessSubFilter, FeedFilter } from "@/domain/expenses";

export interface TransactionFilterBarProps {
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  structuredFilterBadges?: readonly string[];
  activeIdsFilterCount?: number;
  onClearIdsFilter?: () => void;
  isBusinessModeEnabled?: boolean;
  businessSubFilter?: BusinessSubFilter;
  onBusinessSubFilterChange?: (sub: BusinessSubFilter) => void;
}

const BASE_FILTER_TAB_ITEMS = [
  { value: "all", label: "Tudo", icon: <LayoutList aria-hidden="true" /> },
  { value: "incomes", label: "Receitas", icon: <TrendingUp aria-hidden="true" /> },
  { value: "expenses", label: "Despesas", icon: <TrendingDown aria-hidden="true" /> },
  { value: "installments", label: "Parceladas", icon: <Layers aria-hidden="true" /> },
  { value: "recurring", label: "Recorrentes", icon: <Repeat aria-hidden="true" /> },
];

const BUSINESS_SUB_CHIPS: readonly {
  id: BusinessSubFilter;
  label: string;
  icon: typeof Briefcase;
}[] = [
  { id: "all", label: "Todos", icon: Briefcase },
  { id: "deductible", label: "Dedutíveis", icon: ShieldCheck },
  { id: "reimbursement", label: "A Reembolsar", icon: RotateCcw },
  { id: "transfers", label: "Transferências", icon: ArrowLeftRight },
];

/** Barra de abas por natureza de lançamento e campo de busca instantânea. */
export function TransactionFilterBar({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  structuredFilterBadges = [],
  activeIdsFilterCount = 0,
  onClearIdsFilter,
  isBusinessModeEnabled = false,
  businessSubFilter = "all",
  onBusinessSubFilterChange,
}: TransactionFilterBarProps) {
  const tabItems = useMemo(() => {
    if (!isBusinessModeEnabled) return BASE_FILTER_TAB_ITEMS;
    return [
      ...BASE_FILTER_TAB_ITEMS,
      { value: "business", label: "Negócio", icon: <Briefcase aria-hidden="true" /> },
    ];
  }, [isBusinessModeEnabled]);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={filter}
        onValueChange={(val) => onFilterChange(val as FeedFilter)}
        fullWidth={false}
        ariaLabel="Filtro de lançamentos"
        items={tabItems}
      />

      {isBusinessModeEnabled && filter === "business" ? (
        <div
          className="flex flex-wrap items-center gap-1.5 pt-0.5"
          role="radiogroup"
          aria-label="Filtros contextuais do negócio"
        >
          {BUSINESS_SUB_CHIPS.map((chip) => {
            const Icon = chip.icon;
            const isSelected = businessSubFilter === chip.id;
            return (
              <Chip
                key={chip.id}
                role="radio"
                aria-checked={isSelected}
                selected={isSelected}
                sensoryIntent="selection"
                onClick={() => onBusinessSubFilterChange?.(chip.id)}
                icon={<Icon className="size-3.5" />}
                className={isSelected ? "border-portfolio/40 bg-portfolio/10 text-portfolio font-medium" : undefined}
              >
                <span>{chip.label}</span>
              </Chip>
            );
          })}
        </div>
      ) : null}

      <SearchInput
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange("")}
        placeholder="Buscar por descrição, tag, 'acima de 200', 'parcelado'…"
        aria-label="Buscar lançamentos"
        className="bg-surface text-base sm:text-sm"
      />

      {structuredFilterBadges.length > 0 || (activeIdsFilterCount > 0 && Boolean(onClearIdsFilter)) ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Filtros ativos:</span>
          {structuredFilterBadges.map((label) => (
            <Badge key={label} variant="muted" size="xs">
              {label}
            </Badge>
          ))}
          {activeIdsFilterCount > 0 && onClearIdsFilter ? (
            <Button type="button" variant="ghost" size="xs" onClick={onClearIdsFilter}>
              Limpar revisão
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
