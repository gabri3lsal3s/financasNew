import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { extractDigits } from "@/domain/money";

export interface PercentInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode" | "size"
  > {
  /** Valor percentual (number, ex: 8.52 para 8,52% ou 110 para 110%). */
  value?: number;
  /** Notifica o componente pai com o número decimal parseado. */
  onValueChange?: (value: number) => void;
  /** Sufixo visual à direita do campo (default "%"). */
  suffix?: string;
  /** Variante de tamanho. */
  size?: "sm" | "md" | "lg";
  /** Quantidade máxima de dígitos numéricos (default 8). */
  maxDigits?: number;
  /** Mensagem de erro padronizada. */
  error?: string;
}

const sizeClasses: Record<NonNullable<PercentInputProps["size"]>, { input: string; suffix: string }> = {
  sm: { input: "h-8 px-2.5 text-base sm:text-sm", suffix: "text-xs pr-2.5" },
  md: { input: "h-10 px-3.5 text-base sm:text-sm", suffix: "text-xs sm:text-sm pr-3.5" },
  lg: { input: "h-14 px-4 text-2xl font-semibold text-center", suffix: "text-base pr-4" },
};

function formatPercentDisplay(val: number): string {
  return val.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function digitsFromValue(val: number | undefined, maxDigits: number): string {
  if (val === undefined || !Number.isFinite(val) || val <= 0) return "";
  return String(Math.round(val * 100)).slice(0, maxDigits);
}

/**
 * PercentInput — Entrada percentual progressiva (padrão MoneyInput).
 */
export function PercentInput({
  id,
  value = 0,
  onValueChange,
  suffix = "%",
  size = "md",
  maxDigits = 8,
  error,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: PercentInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState<string>(() => digitsFromValue(value, maxDigits));

  const numericValue = useMemo(() => {
    if (!digits) return 0;
    return Number.parseInt(digits, 10) / 100;
  }, [digits]);

  const display = useMemo(() => formatPercentDisplay(numericValue), [numericValue]);

  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (lastExternalValue.current !== value) {
      lastExternalValue.current = value;
      setDigits(digitsFromValue(value, maxDigits));
    }
  }, [value, maxDigits]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextDigits = extractDigits(event.target.value).slice(0, maxDigits);
      setDigits(nextDigits);
      const nextVal = nextDigits ? Number.parseInt(nextDigits, 10) / 100 : 0;
      onValueChange?.(nextVal);
    },
    [maxDigits, onValueChange],
  );

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    if (!/\d/.test(event.key)) event.preventDefault();
  }, []);

  const sizeStyle = sizeClasses[size];

  const inputWrapper = (
    <div className="relative flex items-center w-full">
      <input
        ref={inputRef}
        id={inputId}
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={Boolean(error) || ariaInvalid}
        aria-describedby={errorId ?? ariaDescribedBy}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full rounded-md border border-input bg-surface font-mono tabular-nums text-foreground shadow-xs transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeStyle.input,
          suffix ? "pr-20 sm:pr-28" : "",
          error && "border-critical-strong focus-visible:border-critical-strong focus-visible:ring-critical/20",
          className,
        )}
      />
      {suffix ? (
        <span
          className={cn(
            "pointer-events-none absolute right-0 flex items-center justify-end font-medium text-muted-foreground select-none",
            sizeStyle.suffix,
          )}
          aria-hidden="true"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );

  if (!error) return inputWrapper;

  return (
    <div className="flex flex-col gap-1 w-full">
      {inputWrapper}
      <p id={errorId} role="alert" className="text-[11px] font-medium text-critical-strong leading-tight">
        {error}
      </p>
    </div>
  );
}
