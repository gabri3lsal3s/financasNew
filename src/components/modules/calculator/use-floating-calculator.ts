import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { readClipboardText } from "@/services/clipboard";
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
  parseClipboardToDecimal,
  pressBackspace,
  pressDigit,
  pressEquals,
  pressMoneyBackspace,
  pressMoneyDigit,
  pressOperator,
  splitInstallments,
} from "@/domain/calculator";
import type { CalcOperator, CalculatorState, HistoryEntry } from "@/domain/calculator";

const OPERATOR_KEY_MAP: Record<string, CalcOperator> = {
  "+": "+",
  "-": "−",
  "−": "−",
  "*": "×",
  x: "×",
  "×": "×",
  "/": "÷",
  "÷": "÷",
};

function resolveHydratedState(targetMode: "money" | "decimal" | null): CalculatorState {
  if (targetMode === "decimal") {
    const display = getActiveDecimalDisplay();
    return display && display !== "0"
      ? { display, accumulator: null, operator: null, justEvaluated: true, entering: false, error: false }
      : INITIAL_STATE;
  }
  if (targetMode === "money") {
    const cents = getActiveTargetCents();
    return cents !== null && cents > 0
      ? { display: (cents / 100).toFixed(2), accumulator: null, operator: null, justEvaluated: true, entering: false, error: false }
      : { ...INITIAL_STATE, display: "0.00" };
  }
  return INITIAL_STATE;
}

function evaluatedState(display: string): CalculatorState {
  return { display, accumulator: null, operator: null, justEvaluated: true, entering: false, error: false };
}

export function useFloatingCalculator() {
  const open = useSyncExternalStore(subscribeCalculatorOpen, isCalculatorOpen);
  const isConnected = useSyncExternalStore(subscribeCalculatorTarget, hasActiveTarget);
  const connectedLabel = useSyncExternalStore(subscribeCalculatorTarget, getActiveTargetLabel);
  const targetMode = useSyncExternalStore(subscribeCalculatorTarget, getActiveTargetMode);

  const isDecimalMode = targetMode === "decimal";
  const isMoneyMode = targetMode === "money";

  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [installments, setInstallments] = useState(1);
  const [plan, setPlan] = useState<string | null>(null);
  const [manualPasteOpen, setManualPasteOpen] = useState(false);
  const [manualPasteText, setManualPasteText] = useState("");
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState(resolveHydratedState(targetMode));
      setPlan(null);
      setManualPasteOpen(false);
    }
  }

  const handleDigit = useCallback(
    (digit: string) => setState((c) => (isMoneyMode ? pressMoneyDigit(c, digit) : pressDigit(c, digit))),
    [isMoneyMode],
  );
  const handleBackspace = useCallback(
    () => setState((c) => (isMoneyMode ? pressMoneyBackspace(c) : pressBackspace(c))),
    [isMoneyMode],
  );
  const handleOperator = useCallback((op: CalcOperator) => setState((c) => pressOperator(c, op)), []);
  const handleClear = useCallback(() => {
    setState(isMoneyMode ? { ...INITIAL_STATE, display: "0.00" } : INITIAL_STATE);
    setPlan(null);
  }, [isMoneyMode]);

  const handlePasteClipboard = useCallback(async () => {
    const result = await readClipboardText();
    if (result.status === "permission_denied" || result.status === "unsupported" || result.status === "insecure_context") {
      setManualPasteText("");
      setManualPasteOpen(true);
      pushToast({ title: "Acesso à área de transferência restrito", description: "Cole o valor manualmente no campo a seguir.", variant: "default" });
      return;
    }
    if (result.status === "empty") {
      pushToast({ title: "Área de transferência vazia", description: "Nenhum texto encontrado para colar.", variant: "default" });
      return;
    }
    const sanitized = parseClipboardToDecimal(result.text);
    if (!sanitized) {
      setManualPasteText(result.text);
      setManualPasteOpen(true);
      pushToast({ title: "Valor numérico não identificado", description: "Confira ou edite o texto colado.", variant: "default" });
      return;
    }
    setState(evaluatedState(sanitized));
    setPlan(null);
    pushToast({ title: "Valor colado", description: `${sanitized} inserido no display.`, variant: "default" });
  }, []);

  const handleApplyManualPaste = useCallback(() => {
    const sanitized = parseClipboardToDecimal(manualPasteText);
    if (!sanitized) {
      pushToast({ title: "Valor inválido", description: "Não foi possível identificar um valor numérico no texto informado.", variant: "destructive" });
      return;
    }
    setState(evaluatedState(sanitized));
    setPlan(null);
    setManualPasteOpen(false);
    pushToast({ title: "Valor aplicado", description: `${sanitized} inserido no display.`, variant: "default" });
  }, [manualPasteText]);

  const handleEquals = useCallback(() => {
    const result = pressEquals(state);
    if (!result.error && state.operator !== null && state.accumulator !== null) {
      setHistory((c) => addHistory(c, { expression: `${centsToDecimal(state.accumulator!)} ${state.operator} ${state.display} =`, resultCents: decimalToCents(result.display) }));
    }
    setState(result);
    setPlan(null);
  }, [state]);

  const handleSplit = useCallback(() => {
    const parts = splitInstallments(decimalToCents(state.display), installments);
    setPlan(parts.length === 1 ? formatCentsAsBRL(parts[0] ?? 0) : `${parts.length} × ${formatCentsAsBRL(parts[0] ?? 0)} (resto na 1ª)`);
    setState((c) => ({ ...c, display: centsToDecimal(parts[0] ?? 0), justEvaluated: true }));
  }, [installments, state.display]);

  const handleInject = useCallback(async () => {
    if (targetMode === "decimal") {
      if (injectDecimalValue(state.display)) { setCalculatorOpen(false); return; }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(state.display);
          pushToast({ title: "Resultado copiado", description: `${state.display} copiado para a área de transferência.`, variant: "default" });
        }
      } catch { /* noop */ }
      return;
    }
    const cents = decimalToCents(state.display);
    if (injectCalculatedValue(cents)) { setCalculatorOpen(false); return; }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatCentsAsBRL(cents));
        pushToast({ title: "Resultado copiado", description: `${formatCentsAsBRL(cents)} copiado para a área de transferência.`, variant: "default" });
      }
    } catch { /* noop */ }
  }, [state.display, targetMode]);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setState((c) => ({ ...c, display: centsToDecimal(entry.resultCents), justEvaluated: true }));
    setPlan(null);
  }, []);

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") { e.preventDefault(); setCalculatorOpen(!isCalculatorOpen()); }
    };
    const onOpen = () => setCalculatorOpen(true);
    window.addEventListener("keydown", onGlobalKeyDown);
    window.addEventListener("calculator:open", onOpen);
    return () => { window.removeEventListener("keydown", onGlobalKeyDown); window.removeEventListener("calculator:open", onOpen); };
  }, []);

  useEffect(() => {
    if (!open || manualPasteOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { e.preventDefault(); void handlePasteClipboard(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void handleInject(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;
      const mappedOp = OPERATOR_KEY_MAP[key.toLowerCase()] ?? OPERATOR_KEY_MAP[key];
      if (key >= "0" && key <= "9") { e.preventDefault(); handleDigit(key); }
      else if ((key === "." || key === ",") && !isMoneyMode) { e.preventDefault(); setState((c) => pressDigit(c, ".")); }
      else if (mappedOp) { e.preventDefault(); handleOperator(mappedOp); }
      else if (key === "=" || key === "Enter") { e.preventDefault(); handleEquals(); }
      else if (key === "Escape") { e.preventDefault(); setCalculatorOpen(false); }
      else if (key === "Backspace") { e.preventDefault(); handleBackspace(); }
      else if (key.toLowerCase() === "c" || key === "Delete") { e.preventDefault(); handleClear(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, manualPasteOpen, isMoneyMode, handleDigit, handleBackspace, handleOperator, handleEquals, handleClear, handleInject, handlePasteClipboard]);

  return {
    open, setOpen: setCalculatorOpen, isConnected, connectedLabel, isDecimalMode, state, history,
    installments, setInstallments, plan, manualPasteOpen, setManualPasteOpen, manualPasteText, setManualPasteText,
    handleDigit, handleBackspace, handleOperator, handleEquals, handleClear, handlePasteClipboard, handleApplyManualPaste, handleSplit, handleInject, handleSelectHistory,
  };
}
