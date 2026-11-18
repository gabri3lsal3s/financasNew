import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface NumberStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Incremento dos botões (padrão 1; aceita decimais como 0.5). */
  step?: number;
  /** Quando true, exibe input digitável central além dos botões − / +. */
  editable?: boolean;
  /** Valor bruto em string (compatibilidade com NumberStepperInput). */
  rawValue?: number | string;
  /** Callback bruto em string (compatibilidade com NumberStepperInput). */
  onRawValueChange?: (value: string) => void;
  /** Rótulo acessível do botão de diminuir (ex.: "Diminuir parcelas"). */
  decreaseLabel?: string;
  /** Rótulo acessível do botão de aumentar (ex.: "Aumentar parcelas"). */
  increaseLabel?: string;
  /** Formatação do valor exibido no modo somente-leitura (default: número puro). */
  format?: (value: number) => string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Atraso antes da repetição contínua ao segurar (ms). */
const HOLD_DELAY_MS = 400;
/** Intervalo da repetição contínua (ms). */
const HOLD_INTERVAL_MS = 100;
/** Throttle mínimo entre pulsos táteis durante long-press (ms). */
const HOLD_SENSORY_THROTTLE_MS = 120;

/**
 * NumberStepper — controle unificado de incremento/decremento com botões − / +
 * e modo opcional digitável (`editable`).
 * Usa `font-mono tabular-nums` SEM `.num` para que o Modo Privacidade nunca
 * borre quantidades de parcelas, dias de vencimento ou multiplicadores.
 */
export function NumberStepper({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  editable = false,
  rawValue,
  onRawValueChange,
  decreaseLabel,
  increaseLabel,
  format,
  placeholder,
  ariaLabel,
  disabled = false,
  className,
}: NumberStepperProps) {
  const effectiveMin = min !== undefined ? min : editable ? undefined : 0;
  const effectiveMax = max !== undefined ? max : editable ? undefined : Number.MAX_SAFE_INTEGER;

  const [draft, setDraft] = useState<string>(() => String(value));
  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (lastExternalValue.current !== value) {
      lastExternalValue.current = value;
      setDraft(String(value));
    }
  }, [value]);

  const displayedInputValue = rawValue !== undefined ? rawValue : draft;
  const valueRef = useRef<number | string>(editable ? displayedInputValue : value);

  useEffect(() => {
    valueRef.current = editable ? (rawValue !== undefined ? rawValue : draft) : value;
  }, [draft, editable, rawValue, value]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const lastHoldSensoryAt = useRef(-HOLD_SENSORY_THROTTLE_MS);
  const [holding, setHolding] = useState<"-" | "+" | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    };
  }, []);

  const numericValue = useCallback((): number => {
    const parsed = parseFloat(String(valueRef.current).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const clamp = useCallback(
    (n: number): number => {
      let next = n;
      if (effectiveMin !== undefined) next = Math.max(effectiveMin, next);
      if (effectiveMax !== undefined) next = Math.min(effectiveMax, next);
      return next;
    },
    [effectiveMax, effectiveMin],
  );

  const adjust = useCallback(
    (direction: 1 | -1, fromHold: boolean) => {
      const effectiveStep = step > 0 ? step : 1;
      const next = clamp(Math.round((numericValue() + direction * effectiveStep) * 1000) / 1000);
      if (onRawValueChange) {
        onRawValueChange(String(next));
      } else {
        setDraft(String(next));
        onValueChange(next);
      }

      if (fromHold) {
        const now = Date.now();
        if (now - lastHoldSensoryAt.current >= HOLD_SENSORY_THROTTLE_MS) {
          lastHoldSensoryAt.current = now;
          triggerSensory("selection", { skipSound: true });
        }
      } else {
        triggerSensory("selection");
      }
    },
    [clamp, numericValue, onRawValueChange, onValueChange, step],
  );

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(null);
  }, []);

  const startHold = useCallback(
    (direction: "-" | "+") => {
      heldRef.current = false;
      const tick = () => {
        heldRef.current = true;
        adjust(direction === "-" ? -1 : 1, true);
        holdTimer.current = setTimeout(tick, HOLD_INTERVAL_MS);
      };
      holdTimer.current = setTimeout(tick, HOLD_DELAY_MS);
    },
    [adjust],
  );

  const handlePointerDown = useCallback(
    (direction: "-" | "+") => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      startHold(direction);
      setHolding(direction);
    },
    [disabled, startHold],
  );

  const handleClick = useCallback(
    (direction: "-" | "+") => () => {
      if (disabled) return;
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      adjust(direction === "-" ? -1 : 1, false);
    },
    [adjust, disabled],
  );

  const currentNumeric = editable
    ? parseFloat(String(displayedInputValue).replace(",", "."))
    : value;
  const resolvedCurrent = Number.isFinite(currentNumeric) ? currentNumeric : 0;
  const atMin = effectiveMin !== undefined && resolvedCurrent <= effectiveMin;
  const atMax = effectiveMax !== undefined && resolvedCurrent >= effectiveMax;

  const resolvedDecreaseLabel = decreaseLabel ?? (ariaLabel ? `Diminuir ${ariaLabel}` : "Diminuir");
  const resolvedIncreaseLabel = increaseLabel ?? (ariaLabel ? `Aumentar ${ariaLabel}` : "Aumentar");

  const stepButtonClass =
    "relative flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-surface text-foreground shadow-xs transition-colors select-none cursor-pointer hover:bg-surface-hover active:bg-primary/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 max-sm:after:absolute max-sm:after:-inset-1.5";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5",
        editable && "[&_input]:appearance-none",
        className,
      )}
    >
      <button
        type="button"
        aria-label={resolvedDecreaseLabel}
        title="Diminuir"
        disabled={disabled || atMin}
        onPointerDown={handlePointerDown("-")}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={handleClick("-")}
        className={stepButtonClass}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>

      {editable ? (
        <input
          type="text"
          inputMode="decimal"
          value={displayedInputValue}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^0-9.,]/g, "");
            if (onRawValueChange) {
              onRawValueChange(raw);
            } else {
              setDraft(raw);
              const parsed = parseFloat(raw.replace(",", "."));
              if (Number.isFinite(parsed)) {
                onValueChange(clamp(parsed));
              }
            }
          }}
          onBlur={(event) => {
            const parsed = parseFloat(event.target.value.replace(",", "."));
            if (Number.isFinite(parsed)) {
              const clamped = clamp(parsed);
              if (onRawValueChange) {
                onRawValueChange(String(clamped));
              } else {
                setDraft(String(clamped));
                onValueChange(clamped);
              }
            } else if (!onRawValueChange) {
              setDraft(String(value));
            }
          }}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-md border border-input bg-surface px-3.5 text-center font-mono text-base sm:text-sm tabular-nums text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            holding && "select-none",
          )}
        />
      ) : (
        <span className="flex h-10 min-w-0 flex-1 items-center justify-center font-mono text-base sm:text-sm font-semibold tabular-nums text-foreground">
          {format ? format(value) : value}
        </span>
      )}

      <button
        type="button"
        aria-label={resolvedIncreaseLabel}
        title="Aumentar"
        disabled={disabled || atMax}
        onPointerDown={handlePointerDown("+")}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={handleClick("+")}
        className={stepButtonClass}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
