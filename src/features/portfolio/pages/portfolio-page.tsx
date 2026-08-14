import { useState } from "react";
import { Tabs } from "@/components/ui";
import { PositionTab } from "./position-tab";
import { TargetsTab } from "./targets-tab";
import { AporteTab } from "./aporte-tab";

type PortfolioTab = "position" | "targets" | "aporte";

/** Carteira & rebalanceamento (§3.11) — posição, metas de alocação e calculadora de aporte. */
export function PortfolioPage() {
  const [tab, setTab] = useState<PortfolioTab>("position");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Carteira</h1>
        <p className="text-sm text-muted-foreground">
          Posição derivada do ledger, metas de alocação e calculadora de aporte.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PortfolioTab)}
        items={[
          { value: "position", label: "Posição", content: <PositionTab /> },
          { value: "targets", label: "Metas", content: <TargetsTab /> },
          { value: "aporte", label: "Aporte", content: <AporteTab /> },
        ]}
      />
    </div>
  );
}
