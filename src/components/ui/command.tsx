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

export interface CommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
}

/**
 * Command palette (⌘K) — substitui a busca/busca nativa e navegação por atalho
 * (DESIGN_SYSTEM §13). Acessível e com teclado via cmdk.
 */
export function Command({
  open,
  onOpenChange,
  items,
  placeholder = "Buscar…",
  emptyMessage = "Nenhum resultado encontrado.",
}: CommandProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[15%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg focus:outline-none">
          <CommandPrimitive className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <CommandPrimitive.Input
                placeholder={placeholder}
                className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CommandPrimitive.Empty>
              <CommandPrimitive.Group>
                {items.map((item) => (
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
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
