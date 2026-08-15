import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";
import { triggerHaptic } from "@/services/haptics";

/**
 * Atalho da calculadora no header: mesmo visual dos botões de alternância (ghost, ícone).
 * Abre o painel da calculadora — dentro de modais, o botão dedicado no cabeçalho do modal
 * mantém o acesso rápido e discreto à calculadora.
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
