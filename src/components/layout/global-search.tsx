import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Search, Tags, WalletCards } from "lucide-react";
import { Button, Command } from "@/components/ui";
import type { CommandGroup, CommandItem } from "@/components/ui/command";
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

/** Busca global (⌘K) — paleta montada no shell, atalho ⌘K/Ctrl+K (§3.9). */
export function GlobalSearch() {
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
      >
        <Search aria-hidden="true" />
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
