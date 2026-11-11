import { useState, type ReactNode } from "react";
import { Calculator, Info } from "lucide-react";
import {
  Badge,
  Button,
  MoneyText,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface EquationItem {
  label: string;
  cents: number;
  /** Operador aritmético exibido antes do valor (+, - ou =) */
  sign?: "+" | "-" | "=";
  /** Tom semântico da moeda */
  tone?: "positive" | "negative" | "default" | "portfolio";
  /** Detalhe ou observação explicativa abaixo do item */
  hint?: string;
}

export interface EquationBreakdownPopoverProps {
  /** Título do KPI (ex: "Saldo Livre Real (Safe-to-Spend)") */
  title: string;
  /** Descrição sucinta do propósito da métrica */
  description?: string;
  /** Fórmula matemática descritiva (ex: "Saldo em Conta + A Receber Previsto − Obrigações") */
  formula?: string;
  /** Parcelas da equação com valores monetários */
  items: EquationItem[];
  /** Rótulo da linha de total */
  totalLabel: string;
  /** Valor final resultante da equação em centavos */
  totalCents: number;
  /** Tom semântico do total */
  totalTone?: "positive" | "negative" | "default";
  /** Elemento customizado como gatilho. Se omitido, renderiza ícone discreto */
  children?: ReactNode;
  /** Alinhamento do popover */
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * EquationBreakdownPopover — Explicabilidade Matemática Ativa em KPIs Compostos (Regra 33 do AGENTS.md).
 *
 * Apresenta a fórmula matemática transparente e o detalhamento das parcelas de métricas derivadas
 * (Safe-to-Spend, Saldo Livre Real, Disponível para Gastar, Custo Ponderado, etc.), eliminando dúvidas
 * ou desconfiança sobre a integridade dos cálculos.
 */
export function EquationBreakdownPopover({
  title,
  description,
  formula,
  items,
  totalLabel,
  totalCents,
  totalTone,
  children,
  align = "end",
  className,
}: EquationBreakdownPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) triggerSensory("selection");
    setOpen(nextOpen);
  };

  const resolvedTotalTone =
    totalTone ?? (totalCents >= 0 ? "positive" : "negative");

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children ? (
          <span className="inline-flex cursor-pointer">{children}</span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`Ver fórmula e explicabilidade de ${title}`}
            title={`Ver como ${title} é calculado`}
            className="size-5 p-0 text-muted-foreground/80 hover:text-foreground cursor-pointer rounded-full"
          >
            <Info className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Explicar cálculo de {title}</span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className={cn(
          "w-80 sm:w-88 flex flex-col gap-3 p-4 text-xs shadow-xl border-border/80 bg-surface/98 backdrop-blur-md rounded-2xl",
          className,
        )}
        data-testid="equation-breakdown-popover"
      >
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1.5 pb-1 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <Calculator className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>{title}</span>
            </div>
            <Badge variant="muted" size="xs">
              Transparência
            </Badge>
          </div>

          {description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}

          {formula && (
            <div className="rounded-lg bg-surface-raised border border-border/60 px-2 py-1 text-[10px] font-mono text-muted-foreground break-words">
              {formula}
            </div>
          )}
        </div>

        {/* Parcelas da Equação */}
        <div className="flex flex-col gap-2 py-0.5">
          {items.map((item, index) => {
            const isNegativeSign = item.sign === "-";
            const isPositiveSign = item.sign === "+";
            const tone =
              item.tone ??
              (isNegativeSign ? "negative" : isPositiveSign ? "positive" : "default");

            return (
              <div
                key={`${item.label}-${index}`}
                className="flex items-center justify-between gap-2 min-w-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold w-3 text-center shrink-0",
                      isNegativeSign
                        ? "text-negative"
                        : isPositiveSign
                          ? "text-positive"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.sign ?? ""}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-foreground text-xs font-medium">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.hint}
                      </span>
                    )}
                  </div>
                </div>

                <MoneyText
                  cents={item.cents}
                  tone={tone}
                  className="font-mono text-xs font-medium tabular-nums shrink-0"
                />
              </div>
            );
          })}
        </div>

        {/* Total da Equação */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80 min-w-0 font-semibold bg-surface-hover/40 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs font-bold w-3 text-center shrink-0 text-foreground">
              =
            </span>
            <span className="text-foreground text-xs truncate">
              {totalLabel}
            </span>
          </div>

          <MoneyText
            cents={totalCents}
            tone={resolvedTotalTone}
            className="font-mono text-xs sm:text-sm font-bold tabular-nums shrink-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
