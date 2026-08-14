import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";
import { triggerHaptic } from "@/services/haptics";

/**
 * Atalho da calculadora flutuante no header (pós-F10): mesmo visual dos
 * botões de alternância (ghost, ícone). Abre o painel da calculadora —
 * dentro de modais, o FAB flutuante (z-[60], acima do overlay z-50)
 * mantém o acesso à calculadora.
 */
export function CalculatorButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Abrir calculadora"
      title="Calculadora"
      onClick={() => {
        triggerHaptic("light");
        setCalculatorOpen(true);
      }}
    >
      <Calculator aria-hidden="true" />
    </Button>
  );
}
