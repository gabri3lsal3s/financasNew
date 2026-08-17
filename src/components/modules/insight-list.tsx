import { Check, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface InsightListItemBadge {
  label: string;
  tone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted";
}

export interface InsightListItemData {
  /** Chave estável da ocorrência (feedback). */
  key: string;
  title: string;
  subtitle?: string;
  /** Confiança 0–1 (opcional). */
  confidence?: number;
  /** Badge extra (ex.: tier de corte). */
  tag?: string;
  /** Cor do badge extra. */
  tagTone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted";
  /** Lista de badges (ex.: tier, reajuste, duplicidade). */
  badges?: readonly InsightListItemBadge[];
  /** Valor monetário à direita (ex.: economia mensal). */
  amountCents?: number;
  icon?: ReactNode;
}

export interface InsightListProps {
  items: readonly InsightListItemData[];
  /** Estado de feedback por chave (ignore/confirm). */
  feedback?: Record<string, "ignore" | "confirm">;
  onIgnore?: (key: string) => void;
  onConfirm?: (key: string) => void;
  onRestore?: (key: string) => void;
  emptyLabel?: string;
  /** Formatação do valor (default BRL). */
  formatAmount?: (cents: number) => string;
}

/**
 * Lista de descobertas do motor de insights (§3.7.2/.3) — assinaturas e
 * recorrências com confiança e ações de aprendizado unificadas e animadas
 * (ignorar/confirmar/restaurar).
 */
export function InsightList({
  items,
  feedback = {},
  onIgnore,
  onConfirm,
  onRestore,
  emptyLabel = "Nenhuma ocorrência encontrada.",
  formatAmount = formatCentsAsBRL,
}: InsightListProps) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const state = feedback[item.key];
        const confirmed = state === "confirm";
        const ignored = state === "ignore";
        return (
          <li
            key={item.key}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 transition-all duration-200",
              ignored && "opacity-60",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              {item.icon ? (
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                  {item.icon}
                </span>
              ) : null}
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  {item.badges?.map((b) => (
                    <Badge key={b.label} variant={b.tone ?? "default"}>{b.label}</Badge>
                  ))}
                  {item.tag ? <Badge variant={item.tagTone ?? "default"}>{item.tag}</Badge> : null}
                  {ignored ? <Badge variant="muted">Ignorada</Badge> : null}
                </div>
                {item.subtitle ? <p className="text-xs text-muted-foreground">{item.subtitle}</p> : null}
                {item.confidence !== undefined ? (
                  <p className="text-[11px] text-muted-foreground">
                    Confiança{" "}
                    <span className="num font-medium text-foreground">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              {item.amountCents !== undefined && item.amountCents > 0 ? (
                <span className="num text-sm font-semibold text-positive-strong">
                  {formatAmount(item.amountCents)}
                </span>
              ) : null}

              {/* Cápsula de ação unificada e animada */}
              {ignored ? (
                <div
                  className="inline-flex items-center rounded-lg border border-border/80 bg-surface/80 p-0.5 shadow-sm"
                  role="group"
                  aria-label={`Ações para ${item.title}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      onRestore?.(item.key);
                    }}
                    className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary-strong active:scale-95 sm:h-8"
                    aria-label={`Restaurar ${item.title}`}
                    title={`Restaurar ${item.title}`}
                  >
                    <RotateCcw className="size-3.5 sm:size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </button>
                </div>
              ) : confirmed ? (
                <div
                  className="inline-flex items-center rounded-lg border border-positive/40 bg-positive/10 p-0.5 shadow-sm transition-all duration-200"
                  role="group"
                  aria-label={`Ações para ${item.title}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      onRestore?.(item.key);
                    }}
                    className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-positive-strong transition-all duration-200 hover:bg-positive/20 active:scale-95 sm:h-8"
                    aria-label={`Confirmada (${item.title}) — clique para desmarcar`}
                    title={`Confirmada (${item.title}) — clique para desmarcar`}
                  >
                    <Check className="size-3.5 animate-spring-pop sm:size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Confirmada</span>
                  </button>
                </div>
              ) : (
                <div
                  className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5 shadow-sm transition-all duration-200 hover:border-border-strong"
                  role="group"
                  aria-label={`Ações para ${item.title}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      onIgnore?.(item.key);
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-negative/10 hover:text-negative-strong active:scale-95 sm:size-8"
                    aria-label={`Ignorar ${item.title}`}
                    title={`Ignorar ${item.title}`}
                  >
                    <X className="size-3.5 sm:size-4" aria-hidden="true" />
                  </button>
                  <span className="h-3.5 w-px bg-border/60" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("success");
                      onConfirm?.(item.key);
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-positive/10 hover:text-positive-strong active:scale-95 sm:size-8"
                    aria-label={`Confirmar ${item.title}`}
                    title={`Confirmar ${item.title}`}
                  >
                    <Check className="size-3.5 sm:size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
