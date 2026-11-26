import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent, InputHTMLAttributes, KeyboardEvent, MouseEvent } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractDigits } from "@/domain/money/currency-input";
import { formatDecimalNumber, parseDecimalNumber } from "@/domain/money/parse";
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
  /**
   * Ativa a entrada progressiva da direita para a esquerda (padrão MoneyInput/PercentInput).
   * Padrão: false.
   */
  progressive?: boolean;
  /**
   * Quantidade de casas decimais no modo progressivo (padrão 2 ou 4 conforme contexto).
   */
  decimals?: number;
  /** Rótulo exibido na calculadora ao abrir ("Campo: Quantidade de cotas"). */
  calculatorLabel?: string;
  /** Exibe botão inline para abrir a calculadora flutuante. Padrão: false. */
  showCalculatorAction?: boolean;
  /** Callback opcional ao clicar no botão da calculadora. */
  onCalculatorOpen?: () => void;
  /** Limite de casas decimais permitidas no modo livre (opcional). */
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

function digitsFromNumericValue(val: number | string | null | undefined, decs: number): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseDecimalNumber(val);
  if (!Number.isFinite(num) || num <= 0) return "";
  const factor = Math.pow(10, decs);
  return String(Math.round(num * factor));
}

function formatProgressiveDisplay(digitsStr: string, decs: number): string {
  if (!digitsStr) return "";
  const factor = Math.pow(10, decs);
  const num = Number.parseInt(digitsStr, 10) / factor;
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: decs,
    maximumFractionDigits: decs,
  });
}

/**
 * NumericInput — Primitivo para campos numéricos decimais
 * com suporte a digitação livre ou progressiva (da direita para a esquerda, padrão MoneyInput/PercentInput)
 * e integração bidirecional à calculadora flutuante.
 */
export function NumericInput({
  value = "",
  onValueChange,
  onNumberChange,
  progressive = false,
  decimals,
  maxDecimals,
  calculatorLabel,
  showCalculatorAction = false,
  onCalculatorOpen,
  size = "md",
  className,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  ...rest
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = calculatorLabel ?? ariaLabel;
  const effectiveDecimals = decimals ?? maxDecimals ?? 2;

  // Estado para modo progressivo (dígitos crus)
  const [digits, setDigits] = useState<string>(() =>
    progressive ? digitsFromNumericValue(value, effectiveDecimals) : "",
  );

  // Estado para modo livre (string exibida)
  const [draft, setDraft] = useState<string>(() =>
    progressive ? "" : toDisplayString(value),
  );

  const isFocusedRef = useRef(false);
  const lastExternalValueRef = useRef(value);

  // No modo progressivo, caret sempre no fim (padrão MoneyInput/PercentInput)
  useLayoutEffect(() => {
    if (!progressive) return;
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });

  // Sincroniza com prop externa
  useEffect(() => {
    if (value === lastExternalValueRef.current) return;

    if (progressive) {
      const factor = Math.pow(10, effectiveDecimals);
      const currentNum = digits === "" ? null : Number.parseInt(digits, 10) / factor;
      const incomingNum =
        value === null || value === undefined || value === "" ? null : parseDecimalNumber(value);

      if (digits === "" && incomingNum === null) {
        lastExternalValueRef.current = value;
        return;
      }

      if (
        isFocusedRef.current &&
        incomingNum !== null &&
        currentNum !== null &&
        Math.abs(currentNum - incomingNum) < 1e-9
      ) {
        lastExternalValueRef.current = value;
        return;
      }

      lastExternalValueRef.current = value;
      setDigits(digitsFromNumericValue(value, effectiveDecimals));
      return;
    }

    const currentNum = draft === "" ? null : parseDecimalNumber(draft);
    const incomingNum =
      value === null || value === undefined || value === "" ? null : parseDecimalNumber(value);

    if (draft === "" && incomingNum === null) {
      lastExternalValueRef.current = value;
      return;
    }

    if (
      isFocusedRef.current &&
      incomingNum !== null &&
      currentNum !== null &&
      currentNum === incomingNum
    ) {
      lastExternalValueRef.current = value;
      return;
    }

    lastExternalValueRef.current = value;
    setDraft(toDisplayString(value));
  }, [value, draft, digits, progressive, effectiveDecimals]);

  const calculatorTargetRef = useRef<CalculatorDecimalTarget>({
    mode: "decimal",
    injectDecimal: () => {},
    getDecimalDisplay: () => {
      if (progressive) {
        return formatProgressiveDisplay(digits, effectiveDecimals);
      }
      return String(draft ?? "");
    },
    label,
  });

  useLayoutEffect(() => {
    calculatorTargetRef.current = {
      mode: "decimal",
      injectDecimal: (display: string) => {
        if (progressive) {
          const parsed = parseDecimalNumber(display);
          if (parsed <= 0) {
            setDigits("");
            onValueChange?.("");
            onNumberChange?.(null);
          } else {
            const factor = Math.pow(10, effectiveDecimals);
            const nextDigits = String(Math.round(parsed * factor)).slice(0, 12);
            setDigits(nextDigits);
            const formatted = formatProgressiveDisplay(nextDigits, effectiveDecimals);
            onValueChange?.(formatted);
            onNumberChange?.(parsed);
          }
          return;
        }

        setDraft(display);
        onValueChange?.(display);
        if (onNumberChange) {
          onNumberChange(display === "" ? null : parseDecimalNumber(display));
        }
      },
      getDecimalDisplay: () => {
        if (progressive) {
          return formatProgressiveDisplay(digits, effectiveDecimals);
        }
        return String(draft ?? "");
      },
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
      if (!progressive) {
        if (draft.endsWith(",") || draft.endsWith(".")) {
          const cleaned = draft.slice(0, -1);
          setDraft(cleaned);
          onValueChange?.(cleaned);
          if (onNumberChange) {
            onNumberChange(cleaned === "" ? null : parseDecimalNumber(cleaned));
          }
        }
      }
      onBlur?.(e);
    },
    [draft, onBlur, onNumberChange, onValueChange, progressive],
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLInputElement>) => {
      if (progressive) {
        const el = inputRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      }
      onClick?.(e);
    },
    [onClick, progressive],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (progressive) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key.length !== 1) return;
        // No modo progressivo, apenas dígitos numéricos são aceitos (a vírgula é automática)
        if (!/\d/.test(event.key)) {
          event.preventDefault();
          return;
        }
      }
      onKeyDown?.(event);
    },
    [onKeyDown, progressive],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (progressive) {
        const raw = e.target.value;
        const currentDisplay = formatProgressiveDisplay(digits, effectiveDecimals);

        // Detecta se é digitação/remoção de 1 caractere no fim
        const isSingleAppend =
          raw.startsWith(currentDisplay) && raw.length === currentDisplay.length + 1;
        const isSingleDelete =
          currentDisplay.startsWith(raw) && raw.length === currentDisplay.length - 1;

        // Se o usuário colou um valor com separador decimal explícito (ex.: "5,25" ou "5.8234")
        if (!isSingleAppend && !isSingleDelete && /[.,]/.test(raw)) {
          const parsed = parseDecimalNumber(raw);
          if (parsed <= 0) {
            setDigits("");
            onValueChange?.("");
            onNumberChange?.(null);
          } else {
            const factor = Math.pow(10, effectiveDecimals);
            const nextDigits = String(Math.round(parsed * factor)).slice(0, 12);
            setDigits(nextDigits);
            const display = formatProgressiveDisplay(nextDigits, effectiveDecimals);
            onValueChange?.(display);
            onNumberChange?.(parsed);
          }
          return;
        }

        // Digitação progressiva normal: extrai apenas dígitos e normaliza (remove zeros à esquerda acumulados)
        const rawDigits = extractDigits(raw);
        const parsedInt = Number.parseInt(rawDigits, 10);
        const nextDigits =
          Number.isFinite(parsedInt) && parsedInt > 0 ? String(parsedInt).slice(0, 12) : "";
        setDigits(nextDigits);

        if (!nextDigits) {
          onValueChange?.("");
          onNumberChange?.(null);
        } else {
          const factor = Math.pow(10, effectiveDecimals);
          const parsedNum = Number.parseInt(nextDigits, 10) / factor;
          const display = formatProgressiveDisplay(nextDigits, effectiveDecimals);
          onValueChange?.(display);
          onNumberChange?.(parsedNum);
        }
        return;
      }

      // Modo livre (não progressivo)
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
    [digits, effectiveDecimals, maxDecimals, onNumberChange, onValueChange, progressive],
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
        inputMode={progressive ? "numeric" : "decimal"}
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        value={progressive ? formatProgressiveDisplay(digits, effectiveDecimals) : draft}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
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
