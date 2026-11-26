import { useState } from "react";
import { Plane, Scale, Target, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SplitMockupPreview } from "./showcase/split-mockup-preview";
import { GoalMockupPreview } from "./showcase/goal-mockup-preview";
import { FamilyMockupPreview } from "./showcase/family-mockup-preview";
import { TripMockupPreview } from "./showcase/trip-mockup-preview";

export interface SharedFinancesShowcaseProps {
  className?: string;
}

type SharedTab = "split" | "goal" | "family" | "trip";

export function SharedFinancesShowcase({ className }: SharedFinancesShowcaseProps) {
  const [activeTab, setActiveTab] = useState<SharedTab>("split");

  return (
    <Card
      className={cn(
        "border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-4.5 rounded-2xl sm:rounded-3xl",
        className,
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SharedTab)}
        variant="pills"
        ariaLabel="Cards de Finanças Compartilhadas"
        items={[
          {
            value: "split",
            label: "Racha",
            ariaLabel: "Racha com Pix",
            icon: <Users aria-hidden="true" />,
          },
          {
            value: "goal",
            label: "Metas",
            ariaLabel: "Vaquinha Coletiva (Metas)",
            icon: <Target aria-hidden="true" />,
          },
          {
            value: "family",
            label: "Modo Família",
            ariaLabel: "Modo Família",
            shortLabel: "Família",
            icon: <Scale aria-hidden="true" />,
          },
          {
            value: "trip",
            label: "Modo Viagem",
            ariaLabel: "Modo Viagem",
            shortLabel: "Viagem",
            icon: <Plane aria-hidden="true" />,
          },
        ]}
      />

      <SplitMockupPreview active={activeTab === "split"} />
      <GoalMockupPreview active={activeTab === "goal"} />
      <FamilyMockupPreview active={activeTab === "family"} />
      <TripMockupPreview active={activeTab === "trip"} />
    </Card>
  );
}
