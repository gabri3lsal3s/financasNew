import { useState } from "react";
import { Tabs } from "@/components/ui";
import { ResumoTab } from "./resumo-tab";
import { TargetsTab } from "@/features/portfolio/pages/targets-tab";
import { AporteTab } from "@/features/portfolio/pages/aporte-tab";

type InvestmentsTab = "resumo" | "metas" | "aporte";

/**
 * Investimentos — área única de consolidação da carteira (unificação /carteira
 * + dashboard): Resumo (posição executiva + operação), Metas (limites por
 * ativo/classe + travas setoriais) e Aporte (rebalanceamento). A antiga rota
 * `/carteira` redireciona para cá. Simples e organizado: sem telas paralelas.
 */
export function InvestmentsPage() {
  const [tab, setTab] = useState<InvestmentsTab>("resumo");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Investimentos</h1>
        <p className="text-sm text-muted-foreground">
          Consolidação da carteira: posição, limites de alocação e rebalanceamento em um só lugar.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as InvestmentsTab)}
        swipeable
        items={[
          { value: "resumo", label: "Resumo", content: <ResumoTab /> },
          {
            value: "metas",
            label: "Metas",
            content: <TargetsTab onGoToPosition={() => setTab("resumo")} />,
          },
          {
            value: "aporte",
            label: "Aporte",
            content: <AporteTab onGoToPosition={() => setTab("resumo")} />,
          },
        ]}
      />
    </div>
  );
}
