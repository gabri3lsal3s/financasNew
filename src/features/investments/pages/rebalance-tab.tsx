import { useState } from "react";
import { useSearchParams } from "react-router";
import { Tabs } from "@/components/ui";
import { AporteTab } from "./aporte-tab";
import { TargetsTab } from "./targets-tab";

export type RebalanceView = "simulador" | "metas";

export interface RebalanceTabProps {
  onGoToPosition?: () => void;
}

/**
 * Aba Nível 1 "Rebalancear" (§Plano 42 · v3.10.0):
 * Agrupa o Simulador de Aporte Composto (Bolso + Caixa) e a configuração
 * hierárquica de Metas (Classes %, Setores % opcionais e Notas 0–10).
 */
export function RebalanceTab({ onGoToPosition }: RebalanceTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickedView, setPickedView] = useState<RebalanceView>("simulador");

  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");
  const hasSubTab = searchParams.has("subtab");
  const hasValor =
    searchParams.has("valor") ||
    searchParams.has("surplusCents") ||
    searchParams.get("usarCaixa") === "1";

  const activeView: RebalanceView =
    viewParam === "metas" || (tabParam === "metas" && viewParam !== "simulador") || hasSubTab
      ? "metas"
      : viewParam === "simulador" || tabParam === "aporte" || hasValor
        ? "simulador"
        : pickedView;

  const handleViewChange = (next: string) => {
    const valid: RebalanceView = next === "metas" ? "metas" : "simulador";
    setPickedView(valid);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("tab", "rebalancear");
        if (valid === "metas") {
          updated.set("view", "metas");
          updated.delete("valor");
          updated.delete("surplusCents");
          updated.delete("usarCaixa");
        } else {
          updated.delete("view");
          updated.delete("subtab");
        }
        return updated;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <Tabs
        value={activeView}
        onValueChange={handleViewChange}
        variant="pills"
        fullWidth
        ariaLabel="Sub-abas de rebalanceamento"
        items={[
          {
            value: "simulador",
            label: "Simulador",
            content: (
              <AporteTab
                onGoToPosition={onGoToPosition}
                onGoToTargets={() => handleViewChange("metas")}
              />
            ),
          },
          {
            value: "metas",
            label: "Metas",
            content: <TargetsTab onGoToPosition={onGoToPosition} />,
          },
        ]}
      />
    </div>
  );
}
