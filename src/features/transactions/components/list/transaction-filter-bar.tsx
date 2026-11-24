import { Layers, LayoutList, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, SearchInput, Tabs } from "@/components/ui";
import type { FeedFilter } from "@/domain/expenses";

export interface TransactionFilterBarProps {
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  structuredFilterBadges?: readonly string[];
}

const FILTER_TAB_ITEMS = [
  { value: "all", label: "Tudo", icon: <LayoutList aria-hidden="true" /> },
  { value: "incomes", label: "Receitas", icon: <TrendingUp aria-hidden="true" /> },
  { value: "expenses", label: "Despesas", icon: <TrendingDown aria-hidden="true" /> },
  { value: "installments", label: "Parceladas", icon: <Layers aria-hidden="true" /> },
  { value: "recurring", label: "Recorrentes", icon: <Repeat aria-hidden="true" /> },
];

/** Barra de abas por natureza de lançamento e campo de busca instantânea. */
export function TransactionFilterBar({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  structuredFilterBadges = [],
}: TransactionFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={filter}
        onValueChange={(val) => onFilterChange(val as FeedFilter)}
        fullWidth={false}
        ariaLabel="Filtro de lançamentos"
        items={FILTER_TAB_ITEMS}
      />

      <SearchInput
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange("")}
        placeholder="Buscar por descrição, tag, 'acima de 200', 'parcelado'…"
        aria-label="Buscar lançamentos"
        className="bg-surface text-base sm:text-sm"
      />

      {structuredFilterBadges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Filtros ativos:</span>
          {structuredFilterBadges.map((label) => (
            <Badge key={label} variant="muted" size="xs">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
