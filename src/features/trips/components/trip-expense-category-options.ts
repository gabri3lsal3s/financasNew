import type { SelectOption } from "@/components/ui";
import type { Category } from "@/types";

export const DEFAULT_TRIP_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Alimentação", label: "Alimentação" },
  { value: "Transporte", label: "Transporte" },
  { value: "Hospedagem", label: "Hospedagem" },
  { value: "Lazer", label: "Lazer" },
  { value: "Compras", label: "Compras" },
  { value: "Geral", label: "Geral" },
];

export function buildTripCategoryOptions(
  expenseCategories: readonly Category[],
  extraCategoryName?: string | null,
): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const cat of expenseCategories) {
    const lower = cat.name.trim().toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      options.push({ value: cat.name, label: cat.name });
    }
  }

  for (const opt of DEFAULT_TRIP_CATEGORY_OPTIONS) {
    const lower = opt.value.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      options.push(opt);
    }
  }

  const trimmedExtra = extraCategoryName?.trim();
  if (trimmedExtra && !seen.has(trimmedExtra.toLowerCase())) {
    options.unshift({ value: trimmedExtra, label: trimmedExtra });
  }

  return options;
}
