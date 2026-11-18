import { Briefcase, Coins, Plus, Scale, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { Button, Tabs } from "@/components/ui";
import { CashFormDialog, PortfolioInsightsCarousel } from "../components";
import { useInvestmentsPageController } from "../components/resumo/use-investments-page-controller";
import { InvestmentWizard } from "../wizard";
import { MovimentacoesTab } from "./movimentacoes-tab";
import { ProventosTab } from "./proventos-tab";
import { RebalanceTab } from "./rebalance-tab";
import { ResumoTab } from "./resumo-tab";

/**
 * Investimentos (§Plano 42 · v3.10.0) — Arquitetura unificada em 3 abas Nível 1:
 * 1. Carteira (Posição | Extrato)
 * 2. Rebalancear (Simulador | Metas)
 * 3. Proventos (Extrato Mensal | Calendário | Por Ativo | Bola de Neve)
 * Preserva roteamento retrocompatível para ?tab=resumo, ?tab=movimentacoes, ?tab=aporte e ?tab=metas.
 */
export function InvestmentsPage() {
  const controller = useInvestmentsPageController();

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <PageHeader
        title="Investimentos"
        description="Posição da carteira, rendimentos, rebalanceamento de aportes e inteligência fiscal"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-label="Adicionar caixa"
              className="flex-1 sm:flex-initial"
              onClick={controller.handleOpenCash}
            >
              <Wallet aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Adicionar Caixa</span>
              <span className="sm:hidden">Caixa</span>
            </Button>
            <Button
              size="sm"
              aria-label="Nova operação"
              data-tour="investments-new-op"
              className="flex-1 sm:flex-initial"
              onClick={() => controller.handleOpenWizard(null, "select")}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nova Operação
            </Button>
          </>
        }
      />

      {controller.isReadOnlyMode ? (
        <ReadOnlyBanner
          onActivatePro={() => {
            controller.setUpgradeContext(undefined);
            controller.setUpgradeOpen(true);
          }}
        />
      ) : null}

      <PortfolioInsightsCarousel />

      <Tabs
        value={controller.activeTab}
        onValueChange={controller.handleTabChange}
        swipeable
        items={[
          {
            value: "carteira",
            label: "Carteira",
            icon: <Briefcase className="size-4" aria-hidden="true" />,
            content: (
              <div className="flex flex-col gap-5 min-w-0">
                <Tabs
                  value={controller.carteiraView}
                  onValueChange={controller.handleCarteiraViewChange}
                  variant="pills"
                  fullWidth
                  ariaLabel="Sub-abas da carteira"
                  items={[
                    {
                      value: "posicao",
                      label: "Posição",
                      content: (
                        <ResumoTab
                          onOpenWizard={controller.handleOpenWizard}
                          onOpenCash={controller.handleOpenCash}
                          onSelectTab={controller.handleTabChange}
                        />
                      ),
                    },
                    {
                      value: "extrato",
                      label: "Extrato",
                      content: <MovimentacoesTab />,
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            value: "rebalancear",
            label: "Rebalancear",
            icon: <Scale className="size-4" aria-hidden="true" />,
            content: <RebalanceTab onGoToPosition={() => controller.handleTabChange("carteira")} />,
          },
          {
            value: "proventos",
            label: "Proventos",
            icon: <Coins className="size-4" aria-hidden="true" />,
            content: <ProventosTab onOpenWizard={controller.handleOpenWizard} />,
          },
        ]}
      />

      <InvestmentWizard
        open={controller.isWizardOpen}
        onOpenChange={controller.handleWizardOpenChange}
        initialAsset={controller.wizardInitialAsset}
        initialMode={controller.wizardInitialMode}
        initialQuantity={controller.wizardInitialQuantity}
        initialTotalCents={controller.wizardInitialTotalCents}
      />

      <CashFormDialog
        open={controller.cashDialogOpen}
        onOpenChange={controller.setCashDialogOpen}
      />

      <UpgradeDialog
        open={controller.upgradeOpen}
        onOpenChange={controller.setUpgradeOpen}
        context={controller.upgradeContext}
        onProceedToCheckout={controller.handleProceedToCheckout}
      />
    </div>
  );
}
