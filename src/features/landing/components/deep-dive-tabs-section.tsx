import { useState } from "react";
import { FileBarChart2, Layers, PieChart, ShieldCheck } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { ScrollReveal } from "./scroll-reveal";
import { InvestmentsProPreview } from "./deep-dive-previews/investments-pro-preview";
import { ReportsSuitePreview } from "./deep-dive-previews/reports-suite-preview";
import { SecurityAndRadarPreview } from "./deep-dive-previews/security-and-radar-preview";

export type DeepDiveTabKey = "investments" | "reports" | "security";

export interface DeepDiveTabsSectionProps {
  activeTab?: DeepDiveTabKey;
  onTabChange?: (tab: DeepDiveTabKey) => void;
}

export function DeepDiveTabsSection({
  activeTab: controlledTab,
  onTabChange,
}: DeepDiveTabsSectionProps) {
  const [internalTab, setInternalTab] = useState<DeepDiveTabKey>("investments");
  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = (value: string) => {
    const nextTab = value as DeepDiveTabKey;
    triggerSensory("selection");
    setInternalTab(nextTab);
    onTabChange?.(nextTab);
  };

  const tabItems: TabItem[] = [
    {
      value: "investments",
      label: "Investimentos & Preço Teto",
      shortLabel: "Investimentos",
      icon: <PieChart className="size-4" aria-hidden="true" />,
      content: <InvestmentsProPreview />,
    },
    {
      value: "reports",
      label: "Relatórios & Memória de Cálculo",
      shortLabel: "Relatórios",
      icon: <FileBarChart2 className="size-4" aria-hidden="true" />,
      content: <ReportsSuitePreview />,
    },
    {
      value: "security",
      label: "Radar Preventivo & Privacidade",
      shortLabel: "Radar & Segurança",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      content: <SecurityAndRadarPreview />,
    },
  ];

  return (
    <section
      id="profundidade"
      className="py-14 md:py-28 border-t border-border/60 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8 sm:space-y-12 min-w-0 w-full">
        <ScrollReveal className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <Layers className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Profundidade sob Demanda</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Simples no primeiro minuto. Profundo quando você quiser evoluir.
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Explore por assunto a inteligência de investimentos, a suíte executiva de relatórios com
            memória de cálculo e a camada de segurança e radar preventivo.
          </p>
        </ScrollReveal>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          variant="pills"
          ariaLabel="Recursos em profundidade do Axir"
          items={tabItems}
        />
      </div>
    </section>
  );
}
