import { EyeOff, RotateCcw } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import type { ActiveCarouselDismissalEntry } from "@/domain/notifications/hub";

export interface DeferredAlertsSectionProps {
  entries: readonly ActiveCarouselDismissalEntry[];
  onReactivate: (canonicalId: string) => void;
  isPending?: boolean;
}

/**
 * Seção de gerenciamento de avisos adiados/ocultos nos carrosséis da Home e de Investimentos.
 * Exibe apenas rótulos genéricos de catálogo e permite revogação explícita (Onda 2 · Fase 6).
 */
export function DeferredAlertsSection({
  entries,
  onReactivate,
  isPending = false,
}: DeferredAlertsSectionProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<EyeOff className="size-6" aria-hidden="true" />}
        title="Nenhum aviso adiado"
        description="Avisos dispensados nos carrosséis da Visão Geral e de Investimentos aparecem aqui até a data de retorno."
        tone="default"
      />
    );
  }

  return (
    <section
      aria-label="Avisos adiados nos carrosséis"
      className="flex flex-col gap-2.5 min-w-0"
    >
      {entries.map((entry) => {
        const returnText =
          entry.returnDateLabel === "Até reativar"
            ? "Oculto até reativar"
            : `Retorna em ${entry.returnDateLabel}`;

        return (
          <article
            key={entry.canonicalId}
            data-canonical-id={entry.canonicalId}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs min-w-0"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-muted-foreground"
                aria-hidden="true"
              >
                <EyeOff className="size-4.5" />
              </span>

              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words min-w-0">
                    {entry.displayName}
                  </h3>
                  <Badge variant="default" size="xs" className="max-w-full truncate shrink-0">
                    {entry.module}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {returnText}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center self-stretch sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="selection"
                disabled={isPending}
                onClick={() => onReactivate(entry.canonicalId)}
                aria-label={`Reativar ${entry.displayName}`}
                title="Reativar aviso nos carrosséis"
                className="w-full sm:w-auto h-8 text-xs font-medium"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reativar</span>
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
