import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CreditCard, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import type { CardSubscriptionImpact } from "@/domain/insights";

export interface CardSubscriptionRadarProps {
  impact: CardSubscriptionImpact;
  className?: string;
  /** Ação de ensino/descarte direto: permite ao usuário cortar ou desconsiderar uma previsão da fatura. */
  onIgnoreItem?: (itemKey: string) => void;
}

export function CardSubscriptionRadar({ impact, className, onIgnoreItem }: CardSubscriptionRadarProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (impact.totalProjectedCents <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs transition-all",
        impact.exceedsAvailableLimit && "border-warning-border/80 bg-warning-surface/10",
        className,
      )}
      data-testid={`card-subscription-radar-${impact.cardId}`}
    >
      {/* Cabeçalho adaptativo do Card */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CreditCard
            className={cn(
              "size-4 shrink-0",
              impact.exceedsAvailableLimit ? "text-warning-strong" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {impact.cardName}
          </h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            Radar de Assinaturas
          </span>
        </div>

        <Badge variant="muted" size="sm" className="self-start sm:self-auto font-normal text-muted-foreground">
          Fecha dia {impact.closingDay} ({impact.daysUntilClosing === 0 ? "hoje" : `em ${impact.daysUntilClosing}d`})
        </Badge>
      </div>

      {/* Mensagem editorial canônica com MoneyText sem reticências */}
      <p className="text-xs sm:text-sm text-foreground leading-relaxed">
        Você possui{" "}
        <MoneyText
          cents={impact.totalProjectedCents}
          tone="default"
          className="font-semibold text-foreground"
        />{" "}
        em assinaturas previstas para este cartão antes do fechamento da fatura
      </p>

      {/* Alerta Preventivo de Limite Comprometido */}
      {impact.exceedsAvailableLimit ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-surface/30 p-3 text-xs text-warning-strong"
        >
          <AlertTriangle className="size-4 shrink-0 text-warning-strong mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              Alerta de Limite Comprometido
            </span>
            <p className="text-[11px] leading-relaxed text-warning-strong">
              {impact.warningMessage ??
                "Atenção: o total de assinaturas projetadas supera o limite disponível restante do cartão."}
            </p>
          </div>
        </div>
      ) : null}

      {/* Lista de Assinaturas Previstas (Expansível) */}
      {impact.items.length > 0 ? (
        <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex items-center justify-between gap-2 h-7 px-1.5 self-start text-[11px] text-muted-foreground hover:text-foreground"
            aria-expanded={detailsOpen}
          >
            <span>
              Ver {impact.projectedCount} assinatura(s) mapeada(s)
            </span>
            {detailsOpen ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          {detailsOpen ? (
            <ul className="flex flex-col gap-1.5 pt-1" aria-label="Assinaturas previstas antes do fechamento">
              {impact.items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-hover/50 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-foreground truncate">{item.name}</span>
                    {item.typicalDayOfMonth ? (
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        (dia ~{item.typicalDayOfMonth})
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <MoneyText cents={item.amountCents} tone="default" className="font-medium" />
                    {onIgnoreItem ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        title="Já cortei ou desconsiderar nesta fatura"
                        aria-label={`Já cortei ou desconsiderar ${item.name}`}
                        onClick={() => onIgnoreItem(item.key)}
                      >
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
