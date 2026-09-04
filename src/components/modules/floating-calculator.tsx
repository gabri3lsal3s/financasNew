import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Calculator as CalculatorIcon, Check, Hash, History, Link2 } from "lucide-react";
import { Badge, Button, Modal, NumberStepper } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CalculatorKeypad } from "@/components/modules/calculator-keypad";
import {
  getActiveDecimalDisplay,
  getActiveTargetCents,
  getActiveTargetLabel,
  getActiveTargetMode,
  hasActiveTarget,
  injectCalculatedValue,
  injectDecimalValue,
  subscribeCalculatorTarget,
} from "@/services/calculator-bridge";
import { isCalculatorOpen, setCalculatorOpen, subscribeCalculatorOpen } from "@/services/calculator-open";
import { pushToast } from "@/services/toast";
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
 *
 * Modos de operação:
 *  - "money": carrega centavos do MoneyInput ativo, exibe como R$/$, injeta centavos.
 *  - "decimal": carrega display string do NumericInput ativo, exibe como número,
 *               injeta state.display diretamente (sem conversão de centavos).
 */
export function FloatingCalculator() {
  const open = useSyncExternalStore(subscribeCalculatorOpen, isCalculatorOpen);
  const isConnected = useSyncExternalStore(subscribeCalculatorTarget, hasActiveTarget);
  const connectedLabel = useSyncExternalStore(subscribeCalculatorTarget, getActiveTargetLabel);
  // Lê o modo do alvo ativo (reativo via subscribeCalculatorTarget).
  const targetMode = useSyncExternalStore(subscribeCalculatorTarget, getActiveTargetMode);

  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [installments, setInstallments] = useState(1);
  const [plan, setPlan] = useState<string | null>(null);

  // Hidratação do display ao abrir: padrão "when props change" do React (sem useEffect).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (targetMode === "decimal") {
        // Modo decimal: usa o valor string do campo diretamente.
        const display = getActiveDecimalDisplay();
        setState(
          display !== null && display !== "" && display !== "0"
            ? { display, accumulator: null, operator: null, justEvaluated: true, entering: false, error: false }
            : INITIAL_STATE,
        );
      } else {
        // Modo money (padrão): converte centavos para decimal.
        const targetCents = getActiveTargetCents();
        setState(
          targetCents !== null && targetCents > 0
            ? {
                display: centsToDecimal(targetCents),
                accumulator: null,
                operator: null,
                justEvaluated: true,
                entering: false,
                error: false,
              }
            : INITIAL_STATE,
        );
      }
      setPlan(null);
    }
  }

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
  };

  const handleInject = useCallback(async () => {
    if (targetMode === "decimal") {
      // Modo decimal: injeta o display string diretamente no campo.
      const ok = injectDecimalValue(state.display);
      if (ok) {
        setCalculatorOpen(false);
        return;
      }
      // Sem campo decimal ativo: copia o valor como texto.
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(state.display);
          pushToast({
            title: "Resultado copiado",
            description: `${state.display} copiado para a área de transferência.`,
            variant: "default",
          });
        }
      } catch {
        // noop
      }
      return;
    }

    // Modo money (padrão): converte para centavos e injeta.
    const cents = decimalToCents(state.display);
    const ok = injectCalculatedValue(cents);
    if (ok) {
      setCalculatorOpen(false);
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatCentsAsBRL(cents));
        pushToast({
          title: "Resultado copiado",
          description: `${formatCentsAsBRL(cents)} copiado para a área de transferência.`,
          variant: "default",
        });
      }
    } catch {
      // noop
    }
  }, [state.display, targetMode]);

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

  // Evento customizado "calculator:open" disparado pelo botão do NumericInput
  useEffect(() => {
    const onOpen = () => setCalculatorOpen(true);
    window.addEventListener("calculator:open", onOpen);
    return () => window.removeEventListener("calculator:open", onOpen);
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

  const isDecimalMode = targetMode === "decimal";

  return (
    <Modal
      open={open}
      onOpenChange={setCalculatorOpen}
      title="Calculadora"
      description={
        isDecimalMode
          ? "Use o resultado no campo numérico em foco."
          : "Use o resultado no campo em foco do formulário."
      }
      elevated
    >
        <div className="mt-4 flex flex-col gap-4">
          {/* Status de conexão contextual */}
          <div className="flex items-center justify-between">
            {isConnected ? (
              <Badge variant="muted" size="sm" className="gap-1.5 font-normal">
                {isDecimalMode ? (
                  <Hash className="size-3 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
                )}
                <span>{connectedLabel ? `Campo: ${connectedLabel}` : "Conectado ao campo"}</span>
              </Badge>
            ) : (
              <Badge variant="muted" size="sm" className="gap-1.5 font-normal">
                <CalculatorIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>Calculadora livre</span>
              </Badge>
            )}
          </div>

          {/* Display */}
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted p-4">
            <p className="num text-right text-3xl font-semibold text-foreground" aria-live="polite">
              {state.error
                ? "Erro"
                : isDecimalMode
                  ? // Modo decimal: exibe o número sem símbolo de moeda
                    <span className="tabular-nums tracking-tight">{state.display !== "0" ? state.display : "0"}</span>
                  : <MoneyText cents={displayCents} variant="value" tone="default" className="text-right text-3xl" />
              }
            </p>
            {state.operator && !state.error ? (
              <p className="text-right text-xs text-muted-foreground">{state.operator}</p>
            ) : null}
            {isDecimalMode && (
              <p className="text-right text-[11px] text-muted-foreground">Número decimal</p>
            )}
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

          {/* Divisão de parcelas — apenas no modo money */}
          {!isDecimalMode && (
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
          )}

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
