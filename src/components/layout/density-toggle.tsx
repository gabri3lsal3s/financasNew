import { Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleDensity, useDensity } from "@/hooks/use-density";

/**
 * Alternância de densidade (F8 — Decisão 4): Confortável ↔ Compacta, aplicada
 * globalmente em listas/tabelas (TransactionRow, DataList) e persistida.
 */
export function DensityToggle() {
  const density = useDensity();
  const compact = density === "compact";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Densidade ${compact ? "compacta" : "confortável"} — alternar para ${compact ? "confortável" : "compacta"}`}
      title={`Densidade: ${compact ? "compacta" : "confortável"}`}
      aria-pressed={compact}
      onClick={() => toggleDensity()}
    >
      {compact ? <Rows3 aria-hidden="true" /> : <Rows4 aria-hidden="true" />}
    </Button>
  );
}
