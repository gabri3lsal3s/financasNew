import type { ReactNode } from "react";
import { Delete, Divide, Equal, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CalcOperator } from "@/domain/calculator";

export interface CalculatorKeypadProps {
  onDigit: (digit: string) => void;
  onOperator: (operator: CalcOperator) => void;
  onEquals: () => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

interface KeySpec {
  label: ReactNode;
  ariaLabel: string;
  onPress: () => void;
  variant?: "operator" | "equals";
  className?: string;
}

const OPERATOR_ICON: Record<CalcOperator, ReactNode> = {
  "+": <Plus aria-hidden="true" />,
  "−": <Minus aria-hidden="true" />,
  "×": <X aria-hidden="true" />,
  "÷": <Divide aria-hidden="true" />,
};

/**
 * Teclado da calculadora flutuante (F9) — presentacional: cada tecla repassa a
 * ação para o estado gerenciado pelo `FloatingCalculator` (motor puro de
 * domain/calculator). Layout clássico com "=" único ocupando duas linhas à
 * direita. Todos os controles são primitivos do app (Button).
 */
export function CalculatorKeypad({
  onDigit,
  onOperator,
  onEquals,
  onClear,
  onBackspace,
  className,
}: CalculatorKeypadProps) {
  const digit = (d: string): KeySpec => ({
    label: d,
    ariaLabel: d === "." ? "Vírgula" : `Dígito ${d}`,
    onPress: () => onDigit(d),
  });

  const rows: KeySpec[][] = [
    [
      { label: "C", ariaLabel: "Limpar", onPress: onClear, className: "bg-surface-hover" },
      { label: <Delete aria-hidden="true" />, ariaLabel: "Apagar dígito", onPress: onBackspace, className: "bg-surface-hover" },
      { label: OPERATOR_ICON["÷"], ariaLabel: "Divisão", onPress: () => onOperator("÷"), variant: "operator" },
      { label: OPERATOR_ICON["×"], ariaLabel: "Multiplicação", onPress: () => onOperator("×"), variant: "operator" },
    ],
    [
      digit("7"),
      digit("8"),
      digit("9"),
      { label: OPERATOR_ICON["−"], ariaLabel: "Subtração", onPress: () => onOperator("−"), variant: "operator" },
    ],
    [
      digit("4"),
      digit("5"),
      digit("6"),
      { label: OPERATOR_ICON["+"], ariaLabel: "Somar", onPress: () => onOperator("+"), variant: "operator" },
    ],
    [digit("1"), digit("2"), digit("3")],
  ];

  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {rows.map((row, rowIndex) =>
        row.map((key) => (
          <Button
            key={`${rowIndex}-${key.ariaLabel}`}
            type="button"
            variant={key.variant === "equals" ? "default" : key.variant === "operator" ? "secondary" : "outline"}
            aria-label={key.ariaLabel}
            className={cn("h-12 text-base font-semibold", key.className)}
            onClick={key.onPress}
          >
            {key.label}
          </Button>
        )),
      )}
      {/* '=' único: ocupa as duas linhas da coluna 4 (1 2 3 | = / 0 0 , | =). */}
      <Button
        type="button"
        variant="default"
        aria-label="Igual"
        className="row-span-2 h-full text-base font-semibold"
        onClick={onEquals}
      >
        <Equal aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-label="Dígito 0"
        className="col-span-2 h-12 text-base font-semibold"
        onClick={() => onDigit("0")}
      >
        0
      </Button>
      <Button type="button" variant="outline" aria-label="Vírgula" className="h-12 text-base font-semibold" onClick={() => onDigit(".")}>
        ,
      </Button>
    </div>
  );
}
