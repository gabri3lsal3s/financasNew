import { useState } from "react";
import { Tabs } from "@/components/ui";
import { ResumoTab } from "./resumo-tab";
import { ProventosTab } from "./proventos-tab";
import { AporteTab } from "./aporte-tab";
import { TargetsTab } from "./targets-tab";
import { FerramentasTab } from "./relatorios-tab";

type InvestmentsTab = "resumo" | "metas" | "aporte" | "proventos" | "ferramentas";

/**
 * Investimentos — área única de consolidação da carteira (unificação /carteira
 * + dashboard): Resumo (posição executiva + operação), Proventos (extrato e
 * calendário de rendimentos — F18), Metas (limites por ativo/classe + travas
 * setoriais), Aporte (rebalanceamento) e Ferramentas (Importação + Relatórios & IR — F40).
 */
export function InvestmentsPage() {
  const [tab, setTab] = useState<InvestmentsTab>("resumo");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Investimentos
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Posição da carteira, rendimentos, rebalanceamento de aportes e inteligência fiscal
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as InvestmentsTab)}
        swipeable
        items={[
          { value: "resumo", label: "Resumo", content: <ResumoTab /> },
          {
            value: "proventos",
            label: "Proventos",
            content: <ProventosTab />,
          },
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
          {
            value: "ferramentas",
            label: "Ferramentas",
            content: <FerramentasTab />,
          },
        ]}
      />
    </div>
  );
}
