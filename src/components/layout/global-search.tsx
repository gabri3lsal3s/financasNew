import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAppLocked } from "@/services/native/app-lock";

const LazyGlobalSearchPalette = lazy(() =>
  import("./global-search-palette").then((m) => ({ default: m.GlobalSearchPalette })),
);

export interface GlobalSearchProps {
  /** Classes de layout do wrapper (ex.: `lg:flex-1` no header). */
  className?: string;
}

/**
 * Busca global e Command Palette (⌘K) — o gatilho e o listener de atalhos ficam
 * leves no shell, carregando `cmdk` e o índice de busca sob demanda ao abrir.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [query, setQuery] = useState("");

  const openPalette = useCallback(() => {
    setHasOpened(true);
    setOpen(true);
  }, []);

  // Atalho global: ⌘K / Ctrl+K e tecla '/' quando fora de inputs (bloqueado durante AppLock)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isAppLocked()) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHasOpened(true);
        setOpen((prev) => !prev);
      } else if (
        event.key === "/" &&
        !open &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        data-tour="global-search-trigger"
        aria-label="Buscar ou executar comando (Ctrl+K)"
        title="Buscar ou executar comando (Ctrl+K)"
        onClick={openPalette}
        className={cn(
          "min-w-0 h-10 w-full justify-between gap-2 rounded-lg border border-input bg-surface px-3 text-sm text-muted-foreground shadow-xs hover:bg-surface-hover",
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
      {hasOpened ? (
        <Suspense fallback={null}>
          <LazyGlobalSearchPalette
            open={open}
            onOpenChange={setOpen}
            query={query}
            onQueryChange={setQuery}
            onClose={close}
          />
        </Suspense>
      ) : null}
    </>
  );
}
