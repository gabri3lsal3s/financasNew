import { useLayoutEffect, useMemo, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  registerCalculatorTarget,
  unregisterCalculatorTarget,
} from "@/services/calculator-bridge";
import type { CalculatorDecimalTarget } from "@/services/calculator-bridge";
import { setCalculatorOpen } from "@/services/calculator-open";

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value" | "size"> {
  /** Valor atual como string (permite "" para vazio e decimais como "12.5"). */
  value: string | number;
  /** Callback quando o valor muda (sempre string normalizada). */
  onValueChange: (value: string) => void;
  /** Rótulo exibido na calculadora ao abrir ("Campo: Quantidade de cotas"). */
  calculatorLabel?: string;
  /** Exibe botão inline para abrir a calculadora flutuante. Padrão: false. */
  showCalculatorAction?: boolean;
  /** Callback opcional ao clicar no botão da calculadora. */
  onCalculatorOpen?: () => void;
  /** Variante de tamanho. */
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<
  NonNullable<NumericInputProps["size"]>,
  { wrapper: string; input: string; button: string }
> = {
  sm: {
    wrapper: "h-8",
    input: "h-8 text-base sm:text-sm",
    button: "size-7",
  },
  md: {
    wrapper: "h-10",
    input: "h-10 text-base sm:text-sm",
    button: "size-8",
  },
  lg: {
    wrapper: "h-14",
    input: "h-14 text-2xl font-semibold",
    button: "size-10",
  },
};

/**
 * NumericInput — Primitivo para campos numéricos decimais livres
 * com integração bidirecional à calculadora flutuante.
 */
export function NumericInput({
  value,
  onValueChange,
  calculatorLabel,
  showCalculatorAction = false,
  onCalculatorOpen,
  size = "md",
  className,
  "aria-label": ariaLabel,
  ...rest
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = calculatorLabel ?? ariaLabel;

  const calculatorTargetRef = useRef<CalculatorDecimalTarget>({
    mode: "decimal",
    injectDecimal: () => {},
    getDecimalDisplay: () => String(value ?? ""),
    label,
  });

  useLayoutEffect(() => {
    calculatorTargetRef.current = {
      mode: "decimal",
      injectDecimal: (display: string) => {
        const normalized = display.replace(",", ".");
        onValueChange(normalized);
      },
      getDecimalDisplay: () => String(value ?? ""),
      label,
    };
  });

  const decimalTarget = useMemo<CalculatorDecimalTarget>(
    () => ({
      mode: "decimal" as const,
      injectDecimal: (display: string) => calculatorTargetRef.current.injectDecimal(display),
      getDecimalDisplay: () => calculatorTargetRef.current.getDecimalDisplay(),
      get label() {
        return calculatorTargetRef.current.label;
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    return () => {
      unregisterCalculatorTarget(decimalTarget);
    };
  }, [decimalTarget]);

  const handleFocus = () => {
    registerCalculatorTarget(decimalTarget);
  };

  const handleOpenCalculator = () => {
    registerCalculatorTarget(decimalTarget);
    if (onCalculatorOpen) {
      onCalculatorOpen();
    } else {
      setCalculatorOpen(true);
    }
  };

  const sizeStyle = sizeClasses[size];
  const hasAction = showCalculatorAction;

  return (
    <div className={cn("relative flex items-center w-full", sizeStyle.wrapper)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.,-]/g, "");
          onValueChange(raw);
        }}
        onFocus={handleFocus}
        className={cn(
          "flex w-full rounded-md border border-input bg-surface px-3.5 py-2 font-mono tabular-nums text-foreground shadow-xs transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeStyle.input,
          hasAction && "pr-10",
          className,
        )}
        {...rest}
      />
      {hasAction && (
        <button
          type="button"
          aria-label="Abrir calculadora"
          tabIndex={-1}
          onClick={handleOpenCalculator}
          className={cn(
            "absolute right-1 flex cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors",
            "hover:bg-surface-hover hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "max-sm:after:absolute max-sm:after:-inset-1.5",
            sizeStyle.button,
          )}
        >
          <Calculator className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
