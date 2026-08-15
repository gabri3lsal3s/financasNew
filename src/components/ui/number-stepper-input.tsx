import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";

export interface NumberStepperInputProps {
  /** Valor atual — número ou string (vazio = sem valor, ex.: "Sem trava"). */
  value: number | string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  /** Incremento dos botões (padrão 1; aceita decimais como 0.5). */
  step?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

/** Atraso antes da repetição contínua ao segurar (ms). */
const HOLD_DELAY_MS = 400;
/** Intervalo da repetição contínua (ms). */
const HOLD_INTERVAL_MS = 100;

/**
 * Stepper numérico próprio do app (F25/pós-F13) — substitui o
 * `input[type="number"]` nativo (DESIGN_SYSTEM §13): esconde os spin buttons
 * do navegador, mantém digitação livre (`inputMode="decimal"`) e adiciona
 * botões − / + com feedback tátil, respeito a `min`/`max`/`step` e repetição
 * contínua ao segurar (long-press). Totalmente aderente ao tema ativo.
 */
export function NumberStepperInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: NumberStepperInputProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const [holding, setHolding] = useState<"-" | "+" | null>(null);
  // Ref espelhado do valor: o tick recursivo do long-press precisa sempre ler o
  // valor MAIS RECENTE (o closure antigo do useCallback ficaria obsoleto).
  const valueRef = useRef(value);

  // Cleanup do timer de repetição no unmount (sem setState em effect).
  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    };
  }, []);

  // Sincroniza o ref após cada render (sem setState em effect).
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const numericValue = useCallback((): number => {
    const parsed = parseFloat(String(valueRef.current).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const clamp = useCallback(
    (n: number): number => {
      let next = n;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      return next;
    },
    [min, max],
  );

  const adjust = useCallback(
    (direction: 1 | -1) => {
      const effectiveStep = step > 0 ? step : 1;
      const next = clamp(Math.round((numericValue() + direction * effectiveStep) * 1000) / 1000);
      onValueChange(String(next));
      triggerHaptic("light");
    },
    [clamp, numericValue, onValueChange, step],
  );

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(null);
  }, []);

  /** Inicia a repetição contínua apenas após o delay (não ajusta no início). */
  const startHold = useCallback(
    (direction: "-" | "+") => {
      heldRef.current = false;
      const tick = () => {
        heldRef.current = true;
        adjust(direction === "-" ? -1 : 1);
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
      // Se houve repetição por long-press, o clique (pointerup) não pode
      // incrementar de novo.
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      adjust(direction === "-" ? -1 : 1);
    },
    [adjust, disabled],
  );

  // Limites calculados a partir do valor da PROP no render (o ref só é lido
  // dentro de callbacks — regra do React Compiler).
  const current = parseFloat(String(value).replace(",", "."));
  const atMin = min !== undefined && (Number.isFinite(current) ? current : 0) <= min;
  const atMax = max !== undefined && (Number.isFinite(current) ? current : 0) >= max;

  const stepButtonClass =
    "flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-surface text-foreground shadow-sm transition-colors select-none hover:bg-surface-hover active:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5",
        // Sem spin buttons nativos do navegador (FF/WebKit/Blink) — ver globals.css.
        "[&_input]:appearance-none",
        className,
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel ? `Diminuir ${ariaLabel}` : "Diminuir"}
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

      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "h-10 min-w-0 flex-1 rounded-md border border-input bg-surface px-2 text-center font-mono text-base tabular-nums text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Estado visual do long-press nos botões (aria-pressed).
          holding && "select-none",
        )}
      />

      <button
        type="button"
        aria-label={ariaLabel ? `Aumentar ${ariaLabel}` : "Aumentar"}
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
