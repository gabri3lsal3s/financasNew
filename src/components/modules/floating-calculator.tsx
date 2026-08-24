import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, History } from "lucide-react";
import { Button, Modal, NumberStepper } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CalculatorKeypad } from "@/components/modules/calculator-keypad";
import { injectCalculatedValue } from "@/services/calculator-bridge";
import { isCalculatorOpen, setCalculatorOpen, subscribeCalculatorOpen } from "@/services/calculator-open";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks";
import {
  INITIAL_STATE,
  addHistory,
  centsToDecimal,
  decimalToCents,
  pressBackspace,
  pressDigit,
  pressEquals,
  pressOperator,
  splitInstallments,
} from "@/domain/calculator";
import type { CalculatorState, HistoryEntry } from "@/domain/calculator";

/**
 * Calculadora (F9): modal acessível pelo header (CalculatorButton) e pelo
 * botão de calculadora nos cabeçalhos de todos os modais do app.
 * "Usar valor" injeta o resultado em centavos no MoneyInput focado/ativo.
 */
export function FloatingCalculator() {
  const open = useSyncExternalStore(subscribeCalculatorOpen, isCalculatorOpen);
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [installments, setInstallments] = useState(1);
  const [plan, setPlan] = useState<string | null>(null);

  const handleEquals = useCallback(() => {
    const previous = state;
    const result = pressEquals(state);
    const accumulator = previous.accumulator;
    const operator = previous.operator;
    if (!result.error && operator !== null && accumulator !== null) {
      setHistory((current) =>
        addHistory(current, {
          expression: `${centsToDecimal(accumulator)} ${operator} ${previous.display} =`,
          resultCents: decimalToCents(result.display),
        }),
      );
    }
    setState(result);
    setPlan(null);
  }, [state]);

  const handleSplit = () => {
    const parts = splitInstallments(decimalToCents(state.display), installments);
    setPlan(
      parts.length === 1
        ? formatCentsAsBRL(parts[0] ?? 0)
        : `${parts.length} × ${formatCentsAsBRL(parts[0] ?? 0)} (resto na 1ª)`,
    );
    setState((current) => ({ ...current, display: centsToDecimal(parts[0] ?? 0), justEvaluated: true }));
    triggerHaptic("light");
  };

  const handleInject = useCallback(() => {
    const ok = injectCalculatedValue(decimalToCents(state.display));
    triggerHaptic(ok ? "success" : "warning");
    if (ok) setCalculatorOpen(false);
  }, [state.display]);

  const displayCents = decimalToCents(state.display);

  // Atalho global F9: alterna abertura da calculadora em qualquer tela
  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F9") {
        event.preventDefault();
        setCalculatorOpen(!isCalculatorOpen());
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  // Suporte a teclado físico quando o modal da calculadora está aberto
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleInject();
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const key = event.key;

      if (key >= "0" && key <= "9") {
        event.preventDefault();
        setState((current) => pressDigit(current, key));
      } else if (key === "." || key === ",") {
        event.preventDefault();
        setState((current) => pressDigit(current, "."));
      } else if (key === "+") {
        event.preventDefault();
        setState((current) => pressOperator(current, "+"));
      } else if (key === "-" || key === "−") {
        event.preventDefault();
        setState((current) => pressOperator(current, "−"));
      } else if (key === "*" || key.toLowerCase() === "x" || key === "×") {
        event.preventDefault();
        setState((current) => pressOperator(current, "×"));
      } else if (key === "/" || key === "÷") {
        event.preventDefault();
        setState((current) => pressOperator(current, "÷"));
      } else if (key === "=" || key === "Enter") {
        event.preventDefault();
        handleEquals();
      } else if (key === "Backspace") {
        event.preventDefault();
        setState((current) => pressBackspace(current));
      } else if (key.toLowerCase() === "c" || key === "Delete") {
        event.preventDefault();
        setState(INITIAL_STATE);
        setPlan(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleEquals, handleInject]);

  return (
    <Modal
      open={open}
      onOpenChange={setCalculatorOpen}
      title="Calculadora"
      description="Use o resultado no campo em foco do formulário."
      elevated
    >
        <div className="mt-4 flex flex-col gap-4">
          {/* Display */}
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted p-4">
            <p className="num text-right text-3xl font-semibold text-foreground" aria-live="polite">
              {state.error ? "Erro" : <MoneyText cents={displayCents} variant="value" tone="default" className="text-right text-3xl" />}
            </p>
            {state.operator && !state.error ? (
              <p className="text-right text-xs text-muted-foreground">{state.operator}</p>
            ) : null}
          </div>

          <CalculatorKeypad
            onDigit={(digit) => setState((current) => pressDigit(current, digit))}
            onOperator={(operator) => setState((current) => pressOperator(current, operator))}
            onEquals={handleEquals}
            onClear={() => {
              setState(INITIAL_STATE);
              setPlan(null);
            }}
            onBackspace={() => setState((current) => pressBackspace(current))}
          />

          {/* Divisão de parcelas */}
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">Dividir em parcelas</p>
              <NumberStepper
                value={installments}
                onValueChange={setInstallments}
                min={1}
                max={60}
                decreaseLabel="Diminuir parcelas"
                increaseLabel="Aumentar parcelas"
                className="w-36"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {plan ?? "Divisão exata em centavos (resto na primeira parcela)."}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleSplit}>
                Dividir
              </Button>
            </div>
          </div>

          {/* Histórico */}
          {history.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="size-3.5" aria-hidden="true" />
                Histórico
              </p>
              <div className="flex flex-wrap gap-1.5">
                {history.map((entry) => (
                  <button
                    key={entry.expression}
                    type="button"
                    onClick={() => {
                      setState((current) => ({ ...current, display: centsToDecimal(entry.resultCents), justEvaluated: true }));
                      setPlan(null);
                    }}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    {entry.expression} <MoneyText cents={entry.resultCents} variant="value" tone="default" className="text-xs text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Button type="button" size="lg" onClick={handleInject}>
            <Check aria-hidden="true" />
            Usar valor
          </Button>
        </div>
      </Modal>
  );
}
