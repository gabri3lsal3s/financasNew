import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { ArrowUpDown, CornerDownLeft, Search } from "lucide-react";
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
  /** Slot opcional renderizado acima dos resultados (ex: resposta instantânea determinística). */
  headerSlot?: ReactNode;
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
  headerSlot,
}: CommandProps) {
  const groupList: CommandGroup[] = groups ?? (items ? [{ label: "", items }] : []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-overlay backdrop-blur-sm transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Em dispositivos de toque (mobile/tablet), evita abrir o teclado automaticamente antes que o usuário veja a lista
            if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
              e.preventDefault();
            }
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-[max(1rem,calc(max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))+0.75rem))] z-modal max-h-[calc(85dvh-max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl md:max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-primary/25 bg-surface shadow-2xl backdrop-blur-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:top-[12%] sm:max-h-[82dvh]"
        >
          <CommandPrimitive className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border/80 px-4 sm:px-5">
              <Search className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={onQueryChange}
                placeholder={placeholder}
                className="h-13 sm:h-14 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-border/80 bg-surface-hover/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0 shadow-2xs">
                ESC
              </kbd>
            </div>
            {headerSlot ? (
              <div className="border-b border-border/80 bg-surface-hover/20 p-2 sm:p-2.5">
                {headerSlot}
              </div>
            ) : null}
            <CommandPrimitive.List className="max-h-80 sm:max-h-96 overflow-y-auto p-2 sm:p-2.5">
              <CommandPrimitive.Empty className="py-8 sm:py-10 text-center text-sm text-muted-foreground">
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
                      className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
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
            <div className="hidden sm:flex items-center justify-between border-t border-border/80 bg-surface-hover/30 px-4 py-2 text-xs text-muted-foreground select-none">
              <div className="flex items-center gap-3.5">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <kbd className="inline-flex items-center justify-center rounded border border-border/80 bg-surface px-1 py-0.5 font-mono text-[10px] shadow-2xs">
                    <ArrowUpDown className="size-2.5" aria-hidden="true" />
                  </kbd>
                  Navegar
                </span>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <kbd className="inline-flex items-center justify-center rounded border border-border/80 bg-surface px-1 py-0.5 font-mono text-[10px] shadow-2xs">
                    <CornerDownLeft className="size-2.5" aria-hidden="true" />
                  </kbd>
                  Selecionar
                </span>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <kbd className="inline-flex items-center justify-center rounded border border-border/80 bg-surface px-1.5 py-0.5 font-mono text-[10px] shadow-2xs">
                    ESC
                  </kbd>
                  Fechar
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground/75 font-medium">Busca Global Áxis</span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
