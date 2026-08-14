import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Search, Tags, WalletCards } from "lucide-react";
import { Button, Command } from "@/components/ui";
import type { CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { searchGlobal, type SearchEntryType, type SearchResult } from "@/domain/search";
import { todayISO } from "@/domain/debts";
import { useGlobalSearchEntries } from "@/state";

const TYPE_ICON: Record<SearchEntryType, typeof ArrowUpRight> = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  debt: HandCoins,
  card: WalletCards,
  category: Tags,
};

const TYPE_GROUP_LABEL: Record<SearchEntryType, string> = {
  expense: "Despesas",
  income: "Rendas",
  debt: "Dívidas",
  card: "Cartões",
  category: "Categorias",
};

export interface GlobalSearchProps {
  /** Classes de layout do wrapper (ex.: `lg:flex-1` no header). */
  className?: string;
}

/** Busca global (⌘K) — paleta montada no shell, atalho ⌘K/Ctrl+K (§3.9).
 * No desktop vira uma barra de busca inline (mesmo elemento, responsivo) que
 * toma a largura excedente do header; no mobile permanece como botão-ícone. */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { entries, isLoading } = useGlobalSearchEntries(open);

  // Atalho global: ⌘K / Ctrl+K.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      icon: <Icon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        const params = new URLSearchParams(entry.link.params ?? {});
        navigate(`${entry.link.path}?${params.toString()}`);
        close();
      },
    };
  };

  const groups: CommandGroup[] = (
    ["expense", "income", "debt", "card", "category"] as const
  )
    .map((type) => ({
      label: TYPE_GROUP_LABEL[type],
      items: results.filter((result) => result.entry.type === type).map(toItem),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Buscar (Ctrl+K)"
        title="Buscar (Ctrl+K)"
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-0", // permite encolher o texto quando a barra é flexível
          // Barra de busca no desktop (pós-F10): ocupa a largura excedente
          // entre os limites da página e os botões do header (flex-1 via PageShell).
          "lg:size-auto lg:h-10 lg:w-full lg:justify-start lg:gap-2 lg:rounded-lg lg:border lg:border-input lg:bg-surface lg:px-3 lg:text-sm lg:text-muted-foreground lg:shadow-sm lg:hover:bg-surface-hover",
          className,
        )}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="hidden truncate lg:inline">Buscar…</span>
        <span className="ml-auto hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground lg:inline">
          Ctrl+K
        </span>
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
        placeholder="Buscar despesas, rendas, dívidas, cartões, categorias…"
        emptyMessage={
          query.trim().length < 2
            ? "Digite ao menos 2 caracteres para buscar."
            : isLoading
              ? "Carregando…"
              : "Nenhum resultado encontrado."
        }
      />
    </>
  );
}
