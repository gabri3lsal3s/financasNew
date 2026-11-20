import { useState } from "react";
import { Calculator, Check, Copy, ExternalLink, Info } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BreakdownTone, CalculationBreakdown } from "@/domain/calculation-memory";
import { formatOperator } from "@/domain/calculation-memory";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface CalculationMemoryViewProps {
  breakdown: CalculationBreakdown;
  /** Callback acionado ao clicar em um link de navegação interno (para fechar o modal/popover). */
  onNavigateAction?: () => void;
  className?: string;
}

function resolveToneClass(tone?: BreakdownTone): string {
  switch (tone) {
    case "positive":
      return "text-positive-strong";
    case "negative":
      return "text-negative-strong";
    case "portfolio":
      return "text-portfolio";
    case "muted":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

/**
 * Visor Padronizado de Memória de Cálculo e Explicabilidade Matemática.
 *
 * Apresenta a fórmula transparente, as parcelas da conta viva e os critérios
 * contábeis com alta escaneabilidade, suporte a cópia em 1 toque e deep-links.
 */
export function CalculationMemoryView({
  breakdown,
  onNavigateAction,
  className,
}: CalculationMemoryViewProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!breakdown.copyText) return;
    try {
      await navigator.clipboard.writeText(breakdown.copyText);
      triggerSensory("selection");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Falha silenciosa de permissão do clipboard
    }
  };

  const handleActionClick = (to: string) => {
    onNavigateAction?.();
    navigate(to);
  };

  return (
    <div className={cn("flex flex-col gap-3.5 text-xs text-foreground", className)}>
      {/* Topo: Título + Badge de Período + Botão de Cópia */}
      <div className="flex flex-col gap-1.5 pb-2 border-b border-border/80">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs sm:text-sm">
            <Calculator className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
            <span className="truncate">{breakdown.title}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {breakdown.periodLabel ? (
              <Badge variant="muted" size="xs">
                {breakdown.periodLabel}
              </Badge>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="xs"
              sensoryIntent={false}
              onClick={handleCopy}
              aria-label="Copiar memória de cálculo formatada"
              title="Copiar memória de cálculo em texto"
              className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                  <span className="text-positive-strong font-medium">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" aria-hidden="true" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {breakdown.description ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {breakdown.description}
          </p>
        ) : null}

        {breakdown.formulaExpression ? (
          <div className="rounded-lg bg-surface-raised border border-border/80 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-mono text-muted-foreground break-words">
            <span className="font-semibold text-foreground/80">Fórmula: </span>
            {breakdown.formulaExpression}
          </div>
        ) : null}
      </div>

      {/* Tabela de Passos e Parcelas Reais da Conta */}
      <div className="flex flex-col gap-2 py-0.5" role="list" aria-label="Passos da memória de cálculo">
        {breakdown.steps.map((step, index) => {
          const operatorChar = formatOperator(step.operator);
          const isNegativeOp = step.operator === "-";
          const isPositiveOp = step.operator === "+";
          const operatorColor = isNegativeOp
            ? "text-negative-strong"
            : isPositiveOp
              ? "text-positive-strong"
              : "text-muted-foreground";

          return (
            <div
              key={`${step.label}-${index}`}
              className={cn(
                "flex items-start justify-between gap-2.5 min-w-0 py-0.5",
                step.emphasis === "subtotal" ? "pt-1.5 border-t border-border/60 font-medium" : "",
              )}
              role="listitem"
            >
              {/* Lado Esquerdo: Operador + Rótulo + Hint + DeepLink */}
              <div className="flex items-start gap-1.5 min-w-0">
                <span
                  className={cn(
                    "font-mono text-xs font-bold w-3.5 text-center shrink-0 select-none pt-0.5",
                    operatorColor,
                  )}
                  aria-hidden="true"
                >
                  {operatorChar}
                </span>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-foreground text-xs font-medium">
                      {step.label}
                    </span>

                    {step.actionLink ? (
                      <button
                        type="button"
                        onClick={() => handleActionClick(step.actionLink!.to)}
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary-strong hover:underline cursor-pointer"
                        title={step.actionLink.hint ?? step.actionLink.label}
                      >
                        <span>{step.actionLink.label}</span>
                        <ExternalLink className="size-2.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  {step.hint ? (
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      {step.hint}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Lado Direito: Valor Formatado Tabular */}
              <span
                className={cn(
                  "font-mono text-xs font-medium tabular-nums shrink-0 whitespace-nowrap pt-0.5",
                  resolveToneClass(step.tone),
                )}
              >
                {step.formattedValue}
              </span>
            </div>
          );
        })}
      </div>

      {/* Linha de Resultado Final Destacada */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80 min-w-0 font-semibold bg-surface-hover/40 -mx-4 -mb-1 px-4 py-3 rounded-b-2xl">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-bold w-3.5 text-center shrink-0 text-foreground" aria-hidden="true">
            =
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-foreground text-xs sm:text-sm font-semibold truncate">
              {breakdown.result.label}
            </span>
            {breakdown.result.hint ? (
              <span className="text-[10px] text-muted-foreground font-normal leading-snug">
                {breakdown.result.hint}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={cn(
            "font-mono text-xs sm:text-sm font-bold tabular-nums shrink-0 whitespace-nowrap",
            resolveToneClass(breakdown.result.tone),
          )}
        >
          {breakdown.result.formattedValue}
        </span>
      </div>

      {/* Bloco de Critérios: Inclusões e Exclusões */}
      {(breakdown.inclusions?.length || breakdown.exclusions?.length) ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/70 text-[11px]">
          {breakdown.inclusions?.length ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider">
                O que entra nesta conta
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {breakdown.inclusions.map((item, idx) => (
                  <li key={`inc-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {breakdown.exclusions?.length ? (
            <div className="flex flex-col gap-1 pt-1">
              <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider">
                O que fica de fora (critério contábil)
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {breakdown.exclusions.map((item, idx) => (
                  <li key={`exc-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Alertas de Transparência */}
      {breakdown.notes?.length ? (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-2.5 text-[11px] text-warning-strong flex items-start gap-2">
          <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            {breakdown.notes.map((note, idx) => (
              <p key={`note-${idx}`} className="leading-snug m-0">
                {note}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
