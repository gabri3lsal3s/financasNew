import { useState } from "react";
import { Calculator as CalculatorIcon, Check, ClipboardPaste, Hash, History, Link2 } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Tabs, type TabItem } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CalculatorKeypad } from "@/components/modules/calculator-keypad";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks";
import { centsToDecimal, decimalToCents } from "@/domain/calculator";
import { injectCalculatedValue, injectDecimalValue } from "@/services/calculator-bridge";
import { pushToast } from "@/services/toast";
import {
  CalculatorInstallmentSplitter,
  CalculatorManualPasteDialog,
  CalculatorValuationTab,
  useFloatingCalculator,
} from "./calculator";

function getDisplayFontClass(charLength: number): string {
  if (charLength > 14) return "text-lg sm:text-xl";
  if (charLength > 10) return "text-xl sm:text-2xl";
  return "text-2xl sm:text-3xl";
}

/**
 * Calculadora (F9): modal acessível pelo header (CalculatorButton) e pelo
 * botão de calculadora nos cabeçalhos dos modais com entrada numérica.
 */
export function FloatingCalculator() {
  const {
    open,
    setOpen,
    isConnected,
    connectedLabel,
    isDecimalMode,
    state,
    history,
    installments,
    setInstallments,
    plan,
    manualPasteOpen,
    setManualPasteOpen,
    manualPasteText,
    setManualPasteText,
    handleDigit,
    handleBackspace,
    handleOperator,
    handleEquals,
    handleClear,
    handlePasteClipboard,
    handleApplyManualPaste,
    handleSplit,
    handleInject,
    handleSelectHistory,
  } = useFloatingCalculator();

  const displayCents = decimalToCents(state.display);
  const displayPreviewText = state.error
    ? "Erro"
    : isDecimalMode
      ? state.display !== "0"
        ? state.display
        : "0"
      : formatCentsAsBRL(displayCents);
  const displaySizeClass = getDisplayFontClass(displayPreviewText.length);

  const isInvestmentsContext =
    typeof window !== "undefined" &&
    (window.location.pathname.includes("/investimentos") ||
      connectedLabel?.toLowerCase().includes("teto") ||
      connectedLabel?.toLowerCase().includes("preço"));

  const [activeTab, setActiveTab] = useState<"standard" | "valuation">("standard");

  const handleInjectValuationValue = (valStr: string) => {
    if (isDecimalMode) {
      if (injectDecimalValue(valStr)) {
        setOpen(false);
        pushToast({
          title: "Valor inserido",
          description: `Preço Teto R$ ${valStr} inserido no campo.`,
          variant: "default",
        });
        return;
      }
    } else {
      const cents = decimalToCents(valStr);
      if (injectCalculatedValue(cents)) {
        setOpen(false);
        pushToast({
          title: "Valor inserido",
          description: `${formatCentsAsBRL(cents)} inserido no campo.`,
          variant: "default",
        });
        return;
      }
    }

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(valStr);
      pushToast({
        title: "Resultado copiado",
        description: `R$ ${valStr} copiado para a área de transferência.`,
        variant: "default",
      });
    }
  };

  const valuationTabs: TabItem[] = [
    { value: "standard", label: "Calculadora" },
    { value: "valuation", label: "Valuation & Teto" },
  ];

  return (
    <>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Calculadora"
        description={
          activeTab === "valuation"
            ? "Simulação rápida de valuation e preço teto para ativos."
            : isDecimalMode
              ? "Use o resultado no campo numérico em foco."
              : "Use o resultado no campo em foco do formulário."
        }
        elevated
        footer={
          activeTab === "valuation" ? (
            <ModalFooter borderless>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </ModalFooter>
          ) : (
            <ModalFooter borderless>
              <Button type="button" size="lg" onClick={() => void handleInject()}>
                <Check aria-hidden="true" />
                Usar valor
              </Button>
            </ModalFooter>
          )
        }
      >
        <div className="mt-2 flex flex-col gap-4">
          {isInvestmentsContext && (
            <Tabs
              items={valuationTabs}
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              fullWidth
            />
          )}

          {activeTab === "valuation" ? (
            <CalculatorValuationTab onInjectValue={handleInjectValuationValue} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                {isConnected ? (
                  <Badge variant="muted" size="sm" className="max-w-full truncate gap-1.5 font-normal">
                    {isDecimalMode ? (
                      <Hash className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Link2 className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="truncate">{connectedLabel ? `Campo: ${connectedLabel}` : "Conectado ao campo"}</span>
                  </Badge>
                ) : (
                  <Badge variant="muted" size="sm" className="gap-1.5 font-normal">
                    <CalculatorIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>Calculadora livre</span>
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePasteClipboard()}
                  className="shrink-0 gap-1.5"
                  title="Colar valor da área de transferência (Ctrl+V)"
                >
                  <ClipboardPaste className="size-3.5" aria-hidden="true" />
                  <span>Colar</span>
                </Button>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/60 p-3.5 sm:p-4">
                <div className="w-full overflow-x-auto no-scrollbar text-right">
                  <p className={cn("num text-right font-semibold leading-tight text-foreground", displaySizeClass)} aria-live="polite">
                    {state.error ? (
                      "Erro"
                    ) : isDecimalMode ? (
                      <span className="tabular-nums tracking-tight whitespace-nowrap">
                        {state.display !== "0" ? state.display : "0"}
                      </span>
                    ) : (
                      <MoneyText
                        cents={displayCents}
                        variant="value"
                        tone="default"
                        className={cn("text-right font-semibold leading-tight", displaySizeClass)}
                      />
                    )}
                  </p>
                </div>
                {state.operator && !state.error ? (
                  <p className="text-right text-xs text-muted-foreground">{state.operator}</p>
                ) : null}
                {isDecimalMode ? (
                  <p className="text-right text-[11px] text-muted-foreground">Número decimal</p>
                ) : null}
              </div>

              <CalculatorKeypad
                onDigit={handleDigit}
                onOperator={handleOperator}
                onEquals={handleEquals}
                onClear={handleClear}
                onBackspace={handleBackspace}
              />

              {!isDecimalMode ? (
                <CalculatorInstallmentSplitter
                  installments={installments}
                  onInstallmentsChange={setInstallments}
                  plan={plan}
                  onSplit={handleSplit}
                />
              ) : null}

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
                        onClick={() => handleSelectHistory(entry)}
                        className="cursor-pointer rounded-lg border border-border/80 bg-surface px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        {entry.expression}{" "}
                        {isDecimalMode ? (
                          <span className="font-mono tabular-nums text-xs text-muted-foreground">
                            {centsToDecimal(entry.resultCents)}
                          </span>
                        ) : (
                          <MoneyText cents={entry.resultCents} variant="value" tone="default" className="text-xs text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      <CalculatorManualPasteDialog
        open={manualPasteOpen}
        onOpenChange={(next) => {
          if (!next) setManualPasteOpen(false);
        }}
        value={manualPasteText}
        onValueChange={setManualPasteText}
        onApply={handleApplyManualPaste}
      />
    </>
  );
}
