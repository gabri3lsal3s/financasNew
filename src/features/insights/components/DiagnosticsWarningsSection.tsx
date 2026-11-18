import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, Badge, Button } from "@/components/ui";
import type { WarningItem } from "./diagnostics-tab";

export interface DiagnosticsWarningsSectionProps {
  warnings: WarningItem[];
  expandedWarnings: boolean;
  setExpandedWarnings: (val: boolean | ((prev: boolean) => boolean)) => void;
  hasTransactions?: boolean;
}

export function DiagnosticsWarningsSection({
  warnings,
  expandedWarnings,
  setExpandedWarnings,
  hasTransactions,
}: DiagnosticsWarningsSectionProps) {
  return (
    <section aria-label="Avisos e recomendações" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Avisos &amp; Recomendações
        </h2>
        {warnings.length > 2 ? (
          <Badge size="xs" variant="muted" className="shrink-0">
            {expandedWarnings
              ? `${warnings.length} de ${warnings.length}`
              : `2 de ${warnings.length} alertas`}
          </Badge>
        ) : null}
      </div>

      {warnings.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-positive/30 bg-positive/5 p-4 text-xs shadow-xs">
          <CheckCircle2 className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="font-medium text-foreground">
              {hasTransactions === false
                ? "Tudo pronto para começar seus diagnósticos"
                : "Nenhum aviso no momento."}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {hasTransactions === false
                ? "Registre suas primeiras receitas e despesas para acompanhar seu ritmo de gastos e diagnósticos de economia."
                : "Seu ritmo de gastos e orçamentos estão equilibrados neste mês."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(expandedWarnings ? warnings : warnings.slice(0, 2)).map((w) => (
            <Alert key={w.id} variant={w.variant}>
              {w.message}
            </Alert>
          ))}
          {warnings.length > 2 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setExpandedWarnings((prev) => !prev)}
              className="self-center max-sm:min-h-11 gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-0.5"
            >
              {expandedWarnings ? (
                <>
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                  <span>Mostrar menos alertas</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                  <span>
                    Ver mais {warnings.length - 2}{" "}
                    {warnings.length - 2 === 1 ? "alerta" : "alertas"}
                  </span>
                </>
              )}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
