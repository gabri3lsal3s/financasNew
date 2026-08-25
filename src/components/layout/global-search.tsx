import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Compass,
  HandCoins,
  PiggyBank,
  Search,
  Tags,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button, Command } from "@/components/ui";
import type { CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { searchGlobal, type SearchEntryType, type SearchResult } from "@/domain/search";
import { todayISO } from "@/domain/debts";
import { useGlobalSearchEntries } from "@/state";

const TYPE_ICON: Record<SearchEntryType, typeof ArrowUpRight> = {
  action: Zap,
  page: Compass,
  investment: TrendingUp,
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  debt: HandCoins,
  card: WalletCards,
  budget: PiggyBank,
  reminder: Bell,
  category: Tags,
};

const TYPE_ICON_CLASS: Record<SearchEntryType, string> = {
  action: "text-primary",
  page: "text-muted-foreground",
  investment: "text-portfolio",
  expense: "text-negative-strong",
  income: "text-positive-strong",
  debt: "text-warning-strong",
  card: "text-portfolio",
  budget: "text-warning-strong",
  reminder: "text-primary-strong",
  category: "text-primary-strong",
};

const TYPE_GROUP_LABEL: Record<SearchEntryType, string> = {
  action: "Ações Rápidas",
  page: "Navegação",
  investment: "Investimentos & Ativos",
  expense: "Despesas",
  income: "Receitas",
  debt: "Dívidas & Empréstimos",
  card: "Cartões de Crédito",
  budget: "Orçamentos",
  reminder: "Lembretes & Recorrências",
  category: "Categorias",
};

const ORDERED_TYPES: readonly SearchEntryType[] = [
  "action",
  "page",
  "investment",
  "expense",
  "income",
  "debt",
  "card",
  "budget",
  "reminder",
  "category",
];

export interface GlobalSearchProps {
  /** Classes de layout do wrapper (ex.: `lg:flex-1` no header). */
  className?: string;
}

/** Busca global e Command Palette (⌘K) — paleta montada no shell, atalho ⌘K/Ctrl+K (§3.9 e Fase 64). */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { entries, isLoading, error } = useGlobalSearchEntries(open);

  // Atalho global: ⌘K / Ctrl+K e tecla '/' quando fora de inputs
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (
        event.key === "/" &&
        !open &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const results = useMemo(
    () => (open ? searchGlobal(query, entries, todayISO()) : []),
    [open, query, entries],
  );

  const toItem = (result: SearchResult): CommandItem => {
    const { entry } = result;
    const Icon = TYPE_ICON[entry.type];
    return {
      value: `${entry.type}:${entry.id}`,
      label: entry.label,
      keywords: [...entry.text, ...(entry.statusWords ?? []), entry.detail ?? ""],
      icon: <Icon className={cn("size-4", TYPE_ICON_CLASS[entry.type])} aria-hidden="true" />,
      onSelect: () => {
        const params = new URLSearchParams(entry.link.params ?? {});
        const paramStr = params.toString();
        navigate(paramStr ? `${entry.link.path}?${paramStr}` : entry.link.path);
        close();
      },
    };
  };

  const groups: CommandGroup[] = ORDERED_TYPES.map((type) => ({
    label: TYPE_GROUP_LABEL[type],
    items: results.filter((result) => result.entry.type === type).map(toItem),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Buscar ou executar comando (Ctrl+K)"
        title="Buscar ou executar comando (Ctrl+K)"
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-0 size-auto h-10 w-full justify-between gap-2 rounded-lg border border-input bg-surface px-3 text-sm text-muted-foreground shadow-xs hover:bg-surface-hover",
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Buscar ou comando…</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-surface-hover/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Command
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        placeholder="Buscar páginas, ações, investimentos, despesas, cartões…"
        emptyMessage={
          query.trim().length < 2
            ? "Digite ao menos 2 caracteres para buscar."
            : error
              ? "Falha ao carregar os dados. Feche e tente novamente."
              : isLoading
                ? "Carregando…"
                : "Nenhum resultado encontrado."
        }
      />
    </>
  );
}
