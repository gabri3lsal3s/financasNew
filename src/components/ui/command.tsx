import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

export interface CommandItem {
  value: string;
  label: string;
  keywords?: string[];
  icon?: ReactNode;
  onSelect: () => void;
}

export interface CommandGroup {
  /** Rótulo do grupo (ex.: "Despesas"). */
  label: string;
  items: CommandItem[];
}

export interface CommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Itens de um grupo único (compat) ou use `groups`. */
  items?: CommandItem[];
  /** Grupos rotulados por tipo (busca global §3.9). */
  groups?: CommandGroup[];
  /** Query controlada (opcional — sem controle, o cmdk filtra internamente). */
  query?: string;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

/**
 * Command palette (⌘K) — substitui a busca nativa e a navegação por atalho
 * (DESIGN_SYSTEM §13). Acessível e com teclado via cmdk.
 * Com `query`/`onQueryChange` o input é controlado (motor de scoring fora);
 * `groups` organiza os resultados por tipo com cabeçalho.
 */
export function Command({
  open,
  onOpenChange,
  items,
  groups,
  query,
  onQueryChange,
  placeholder = "Buscar…",
  emptyMessage = "Nenhum resultado encontrado.",
}: CommandProps) {
  const groupList: CommandGroup[] = groups ?? (items ? [{ label: "", items }] : []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[15%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg focus:outline-none">
          <CommandPrimitive className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={onQueryChange}
                placeholder={placeholder}
                className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CommandPrimitive.Empty>
              {groupList.map((group) => (
                <CommandPrimitive.Group key={group.label || "default"} heading={group.label || undefined}>
                  {group.items.map((item) => (
                    <CommandPrimitive.Item
                      key={item.value}
                      value={item.value}
                      keywords={item.keywords}
                      onSelect={item.onSelect}
                      className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none transition-colors data-[selected=true]:bg-primary/10"
                    >
                      {item.icon ? (
                        <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                          {item.icon}
                        </span>
                      ) : null}
                      {item.label}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
