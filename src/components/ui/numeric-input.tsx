import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimalNumber, parseDecimalNumber } from "@/domain/money";
import {
  registerCalculatorTarget,
  unregisterCalculatorTarget,
} from "@/services/calculator-bridge";
import type { CalculatorDecimalTarget } from "@/services/calculator-bridge";
import { setCalculatorOpen } from "@/services/calculator-open";

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value" | "size"> {
  /** Valor atual como string ("10", "10,5"), número (10.5) ou null/undefined (""). */
  value?: string | number | null;
  /** Callback quando o valor textual muda (sempre string normalizada). */
  onValueChange?: (value: string) => void;
  /** Callback opcional quando o valor numérico parsed muda (ou null se vazio). */
  onNumberChange?: (value: number | null) => void;
  /** Rótulo exibido na calculadora ao abrir ("Campo: Quantidade de cotas"). */
  calculatorLabel?: string;
  /** Exibe botão inline para abrir a calculadora flutuante. Padrão: false. */
  showCalculatorAction?: boolean;
  /** Callback opcional ao clicar no botão da calculadora. */
  onCalculatorOpen?: () => void;
  /** Limite de casas decimais permitidas (opcional). */
  maxDecimals?: number;
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

function toDisplayString(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    return formatDecimalNumber(val);
  }
  return String(val);
}

/**
 * NumericInput — Primitivo para campos numéricos decimais livres
 * com integração bidirecional à calculadora flutuante e suporte a decimais pt-BR.
 */
export function NumericInput({
  value = "",
  onValueChange,
  onNumberChange,
  calculatorLabel,
  showCalculatorAction = false,
  onCalculatorOpen,
  maxDecimals,
  size = "md",
  className,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
  ...rest
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = calculatorLabel ?? ariaLabel;

  const [draft, setDraft] = useState<string>(() => toDisplayString(value));
  const isFocusedRef = useRef(false);
  const lastExternalValueRef = useRef(value);

  // Sincroniza draft com prop externa apenas quando houver mudança real externa
  useEffect(() => {
    if (value === lastExternalValueRef.current) return;

    const currentNum = draft === "" ? null : parseDecimalNumber(draft);
    const incomingNum =
      value === null || value === undefined || value === "" ? null : parseDecimalNumber(value);

    // Se ambos são vazios
    if (draft === "" && incomingNum === null) {
      lastExternalValueRef.current = value;
      return;
    }

    // Se o usuário está com foco no campo e o valor numérico parsed é idêntico (ex: digitou "5," ou "5,20"),
    // preservamos o draft digitado pelo usuário para não perder a vírgula nem os zeros à direita!
    if (isFocusedRef.current && incomingNum !== null && currentNum !== null && currentNum === incomingNum) {
      lastExternalValueRef.current = value;
      return;
    }

    lastExternalValueRef.current = value;
    setDraft(toDisplayString(value));
  }, [value, draft]);

  const calculatorTargetRef = useRef<CalculatorDecimalTarget>({
    mode: "decimal",
    injectDecimal: () => {},
    getDecimalDisplay: () => String(draft ?? ""),
    label,
  });

  useLayoutEffect(() => {
    calculatorTargetRef.current = {
      mode: "decimal",
      injectDecimal: (display: string) => {
        setDraft(display);
        onValueChange?.(display);
        if (onNumberChange) {
          onNumberChange(display === "" ? null : parseDecimalNumber(display));
        }
      },
      getDecimalDisplay: () => String(draft ?? ""),
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

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      registerCalculatorTarget(decimalTarget);
      onFocus?.(e);
    },
    [decimalTarget, onFocus],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      if (draft.endsWith(",") || draft.endsWith(".")) {
        const cleaned = draft.slice(0, -1);
        setDraft(cleaned);
        onValueChange?.(cleaned);
        if (onNumberChange) {
          onNumberChange(cleaned === "" ? null : parseDecimalNumber(cleaned));
        }
      }
      onBlur?.(e);
    },
    [draft, onBlur, onNumberChange, onValueChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^0-9.,-]/g, "");

      // Permite apenas um sinal de menos no início
      if (raw.includes("-")) {
        const isNeg = raw.startsWith("-");
        raw = (isNeg ? "-" : "") + raw.replace(/-/g, "");
      }

      // Isola o primeiro separador decimal (, ou .) e remove os subsequentes
      const firstSepIdx = raw.search(/[.,]/);
      if (firstSepIdx !== -1) {
        const sep = raw[firstSepIdx];
        const intPart = raw.slice(0, firstSepIdx);
        let decPart = raw.slice(firstSepIdx + 1).replace(/[.,]/g, "");
        if (maxDecimals !== undefined) {
          decPart = decPart.slice(0, maxDecimals);
        }
        raw = `${intPart}${sep}${decPart}`;
      }

      setDraft(raw);
      onValueChange?.(raw);

      if (onNumberChange) {
        if (raw === "" || raw === "-" || raw === "," || raw === ".") {
          onNumberChange(null);
        } else {
          onNumberChange(parseDecimalNumber(raw));
        }
      }
    },
    [maxDecimals, onNumberChange, onValueChange],
  );

  const handleOpenCalculator = useCallback(() => {
    registerCalculatorTarget(decimalTarget);
    if (onCalculatorOpen) {
      onCalculatorOpen();
    } else {
      setCalculatorOpen(true);
    }
  }, [decimalTarget, onCalculatorOpen]);

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
        value={draft}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
