import { useState } from "react";
import { Briefcase, Coins, Plus, TrendingUp, Wallet } from "lucide-react";
import { Button, Tabs } from "@/components/ui";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { ResumoTab } from "./resumo-tab";
import { ProventosTab } from "./proventos-tab";
import { AporteTab } from "./aporte-tab";
import { CashFormDialog } from "../components";
import { InvestmentWizard } from "../wizard";
import type { WizardMode } from "../wizard/wizard-state";
import type { PortfolioAsset } from "@/types";

type InvestmentsTab = "resumo" | "aporte" | "proventos";

/**
 * Investimentos — área única de consolidação da carteira (unificação /carteira
 * + dashboard): Carteira (posição executiva + operação + ferramentas no rodapé),
 * Aporte (rebalanceamento + metas integradas) e Proventos (extrato e calendário).
 */
export function InvestmentsPage() {
  const [tab, setTab] = useState<InvestmentsTab>("resumo");

  // FAB contextual mobile (?novo=investimento) e abertura do Wizard
  const { open: wizardDeepOpen, setOpen: setWizardDeepOpen } = useCreateDeepLink("investimento");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialAsset, setWizardInitialAsset] = useState<PortfolioAsset | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<WizardMode>("select");
  const [cashDialogOpen, setCashDialogOpen] = useState(false);

  const isWizardOpen = wizardOpen || wizardDeepOpen;
  const handleWizardOpenChange = (next: boolean) => {
    setWizardOpen(next);
    setWizardDeepOpen(next);
    if (!next) {
      setWizardInitialAsset(null);
      setWizardInitialMode("select");
    }
  };

  const handleOpenWizard = (asset: PortfolioAsset | null = null, mode: WizardMode = "select") => {
    setWizardInitialAsset(asset);
    setWizardInitialMode(mode);
    setWizardOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header com ações acessíveis no mobile e desktop — padrão consistente com a página de dívidas */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Investimentos
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Posição da carteira, rendimentos, rebalanceamento de aportes e inteligência fiscal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Adicionar caixa"
            className="flex-1 sm:flex-initial"
            onClick={() => setCashDialogOpen(true)}
          >
            <Wallet aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Adicionar Caixa</span>
            <span className="sm:hidden">Caixa</span>
          </Button>
          <Button
            size="sm"
            aria-label="Nova operação"
            className="flex-1 sm:flex-initial"
            onClick={() => handleOpenWizard(null, "select")}
          >
            <Plus aria-hidden="true" className="size-4" />
            Nova Operação
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as InvestmentsTab)}
        swipeable
        items={[
          {
            value: "resumo",
            label: "Carteira",
            icon: <Briefcase className="size-4" aria-hidden="true" />,
            content: (
              <ResumoTab
                onOpenWizard={handleOpenWizard}
                onOpenCash={() => setCashDialogOpen(true)}
              />
            ),
          },
          {
            value: "aporte",
            label: "Aporte",
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            content: <AporteTab onGoToPosition={() => setTab("resumo")} />,
          },
          {
            value: "proventos",
            label: "Proventos",
            icon: <Coins className="size-4" aria-hidden="true" />,
            content: <ProventosTab />,
          },
        ]}
      />

      {/* Investment Wizard Unificado */}
      <InvestmentWizard
        open={isWizardOpen}
        onOpenChange={handleWizardOpenChange}
        initialAsset={wizardInitialAsset}
        initialMode={wizardInitialMode}
      />

      {/* Diálogo de Saldo em Caixa */}
      <CashFormDialog
        open={cashDialogOpen}
        onOpenChange={setCashDialogOpen}
      />
    </div>
  );
}
