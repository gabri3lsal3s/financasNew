import { useRef, useState, useSyncExternalStore } from "react";
import { Calculator as CalculatorIcon, Check, History } from "lucide-react";
import { Button, Modal, NumberStepper } from "@/components/ui";
import { CalculatorKeypad } from "@/components/modules/calculator-keypad";
import { useDraggable } from "@/hooks/use-draggable";
import {
  getCalculatorTarget,
  injectCalculatedValue,
  subscribeCalculatorTarget,
} from "@/services/calculator-bridge";
import { isCalculatorOpen, setCalculatorOpen, subscribeCalculatorOpen } from "@/services/calculator-open";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks/money";
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

const FAB_SIZE = 56;

/** Calculadora flutuante (F9): FAB arrastável com snap às bordas + painel
 * retrátil. "Usar valor" injeta o resultado em centavos no MoneyInput ativo.
 * O estado de abertura é compartilhado (calculator-open): o botão do header
 * (CalculatorButton) e o FAB abrem o mesmo painel. O FAB usa z-[60] para
 * ficar visível acima de modais de formulário (z-50).
 *
 * Visibilidade do FAB (pós-F10): aparece SOMENTE quando há um campo de valor
 * ativo (MoneyInput focado) — ou seja, em modais/fluxos onde a calculadora
 * pode injetar dados. Fora disso, a calculadora é acessada pelo ícone do
 * header (CalculatorButton). */
export function FloatingCalculator() {
  // Store externo — abrir via header OU FAB abre o mesmo painel.
  const open = useSyncExternalStore(subscribeCalculatorOpen, isCalculatorOpen);
  // FAB visível apenas com campo ativo registrado (foco em MoneyInput).
  const hasTarget = useSyncExternalStore(subscribeCalculatorTarget, () => getCalculatorTarget() !== null);
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [installments, setInstallments] = useState(1);
  const [plan, setPlan] = useState<string | null>(null);

  // FAB acima da BottomNav (mobile) e do ScrollToTop (desktop).
  const bottomInset = typeof window !== "undefined" && window.innerWidth >= 1024 ? 72 : 128;
  const dragMovedRef = useRef(false);
  const draggable = useDraggable({
    size: FAB_SIZE,
    margin: 8,
    bottomInset,
    onDragStart: () => {
      dragMovedRef.current = true;
    },
  });

  const handleEquals = () => {
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
  };

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

  const handleInject = () => {
    const ok = injectCalculatedValue(decimalToCents(state.display));
    triggerHaptic(ok ? "success" : "warning");
    if (ok) setCalculatorOpen(false);
  };

  const displayCents = decimalToCents(state.display);

  return (
    <>
      {/* FAB arrastável — apenas com campo de valor ativo (pós-F10) */}
      {hasTarget ? (
        <button
          type="button"
          aria-label="Abrir calculadora"
          title="Calculadora"
          className="fixed z-[60] flex items-center justify-center rounded-full border border-primary-strong/40 bg-background/95 text-primary-strong shadow-sm transition-transform active:scale-95"
          style={{ left: draggable.position.x, top: draggable.position.y, width: FAB_SIZE, height: FAB_SIZE }}
          {...draggable.pointerHandlers}
          onClick={() => {
            if (dragMovedRef.current) {
              dragMovedRef.current = false;
              return;
            }
            setCalculatorOpen(true);
            triggerHaptic("light");
          }}
        >
          <CalculatorIcon className="size-5" aria-hidden="true" />
        </button>
      ) : null}

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
              {state.error ? "Erro" : formatCentsAsBRL(displayCents)}
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
                    {entry.expression} {formatCentsAsBRL(entry.resultCents)}
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
    </>
  );
}
