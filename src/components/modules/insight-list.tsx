import { Check, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

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
 * recorrências com confiança e ações de aprendizado (ignorar/confirmar/restaurar).
 */
export function InsightList({
  items,
  feedback = {},
  onIgnore,
  onConfirm,
  onRestore,
  emptyLabel = "Nenhuma ocorrência encontrada.",
  formatAmount = (cents) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
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
              "flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3",
              ignored && "opacity-50",
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
                  {item.tag ? <Badge variant={item.tagTone ?? "default"}>{item.tag}</Badge> : null}
                  {confirmed ? <Badge variant="positive">Confirmada</Badge> : null}
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

            <div className="flex shrink-0 items-center gap-2">
              {item.amountCents !== undefined && item.amountCents > 0 ? (
                <span className="num text-sm font-semibold text-positive-strong">
                  {formatAmount(item.amountCents)}
                </span>
              ) : null}
              {ignored ? (
                <button
                  type="button"
                  onClick={() => onRestore?.(item.key)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Restaurar ${item.title}`}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Restaurar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onIgnore?.(item.key)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Ignorar ${item.title}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Ignorar
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm?.(item.key)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    aria-label={`Confirmar ${item.title}`}
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Confirmar
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
