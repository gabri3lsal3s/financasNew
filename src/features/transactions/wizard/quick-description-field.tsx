import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge, Input } from "@/components/ui";
import {
  CANONICAL_MERCHANT_CATALOG,
  matchCategoryBySlug,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import { useMerchantLearning } from "@/services/merchant-learning";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface QuickDescriptionFieldProps {
  value: string;
  isExpense: boolean;
  categories: Category[] | undefined;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (categoryId: string) => void;
}

interface AutoCompleteSuggestion {
  friendlyName: string;
  categorySlug?: string;
  source: "learned" | "catalog";
}

export function QuickDescriptionField({
  value,
  isExpense,
  categories,
  onDescriptionChange,
  onCategoryChange,
}: QuickDescriptionFieldProps) {
  const { memory } = useMerchantLearning();
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo<AutoCompleteSuggestion[]>(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];
    const results: AutoCompleteSuggestion[] = [];
    const seen = new Set<string>();
    for (const r of Object.values(memory)) {
      if ((r.friendlyName.toLowerCase().includes(query) || r.rawAliases.some((a) => a.toLowerCase().includes(query))) && !seen.has(r.friendlyName)) {
        seen.add(r.friendlyName);
        results.push({ friendlyName: r.friendlyName, categorySlug: r.categorySlug, source: "learned" });
      }
      if (results.length >= 3) return results;
    }
    for (const e of CANONICAL_MERCHANT_CATALOG) {
      if ((e.friendlyName.toLowerCase().includes(query) || e.keywords.some((k) => k.toLowerCase().includes(query))) && !seen.has(e.friendlyName)) {
        seen.add(e.friendlyName);
        results.push({ friendlyName: e.friendlyName, categorySlug: e.categorySlug, source: "catalog" });
      }
      if (results.length >= 3) break;
    }
    return results;
  }, [value, memory]);

  const handleApplySuggestion = (suggestion: AutoCompleteSuggestion) => {
    triggerSensory("action");
    onDescriptionChange(suggestion.friendlyName);
    if (suggestion.categorySlug && categories?.length) {
      const matched = matchCategoryBySlug(categories, suggestion.categorySlug as CanonicalCategorySlug);
      if (matched) onCategoryChange(matched.id);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor="quick-description-input" className="text-xs font-semibold text-foreground">
        Descrição / Estabelecimento
      </label>
      <Input
        id="quick-description-input"
        value={value}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={isExpense ? "Ex: Padaria do Zé, Uber, Mercado..." : "Ex: Salário, Rendimentos, Pix..."}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {focused && suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="mr-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />Sugestões:
          </span>
          {suggestions.map((s) => (
            <button
              key={s.friendlyName}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleApplySuggestion(s)}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-border/80 bg-surface-raised px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              <span>{s.friendlyName}</span>
              {s.source === "learned" ? <Badge variant="muted" size="xs">Memorizado</Badge> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
