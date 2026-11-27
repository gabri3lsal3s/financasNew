import { lazy, Suspense } from "react";
import { ContentLoading } from "@/components/ui/content-loading";
import { Briefcase, Coins, Plus, Scale, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { Button, Tabs } from "@/components/ui";
import { useMarketQuotesSwr } from "@/state";
import { PortfolioInsightsCarousel } from "../components";
import { useInvestmentsPageController } from "../components/resumo/use-investments-page-controller";
const loadInvestmentWizard = () => import("../wizard/investment-wizard");
const loadCashFormDialog = () => import("../components/cash-form-dialog");

const InvestmentWizard = lazy(() => loadInvestmentWizard().then((module) => ({ default: module.InvestmentWizard })));
const CashFormDialog = lazy(() => loadCashFormDialog().then((module) => ({ default: module.CashFormDialog })));
const MovimentacoesTab = lazy(() => import("./movimentacoes-tab").then((module) => ({ default: module.MovimentacoesTab })));
const ProventosTab = lazy(() => import("./proventos-tab").then((module) => ({ default: module.ProventosTab })));
const RebalanceTab = lazy(() => import("./rebalance-tab").then((module) => ({ default: module.RebalanceTab })));
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
  useMarketQuotesSwr({ enabled: true, enableInterval: true });

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <PageHeader
        title="Investimentos"
        description="Carteira, rendimentos e rebalanceamento"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-label="Adicionar caixa"
              onMouseEnter={() => void loadCashFormDialog()}
              onFocus={() => void loadCashFormDialog()}
              onClick={controller.handleOpenCash}
            >
              <Wallet aria-hidden="true" />
              <span className="hidden sm:inline">Adicionar caixa</span>
              <span className="sm:hidden">Caixa</span>
            </Button>
            <Button
              size="sm"
              aria-label="Nova operação"
              data-tour="investments-new-op"
              onMouseEnter={() => void loadInvestmentWizard()}
              onFocus={() => void loadInvestmentWizard()}
              onClick={() => controller.handleOpenWizard(null, "select")}
            >
              <Plus aria-hidden="true" />
              <span>Nova operação</span>
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
        keepMountedAfterFirstVisit
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
                  keepMountedAfterFirstVisit
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
                      content: (
                        <Suspense fallback={<ContentLoading />}>
                          <MovimentacoesTab />
                        </Suspense>
                      ),
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
            content: (
              <Suspense fallback={<ContentLoading />}>
                <RebalanceTab onGoToPosition={() => controller.handleTabChange("carteira")} />
              </Suspense>
            ),
          },
          {
            value: "proventos",
            label: "Proventos",
            icon: <Coins className="size-4" aria-hidden="true" />,
            content: (
              <Suspense fallback={<ContentLoading />}>
                <ProventosTab onOpenWizard={controller.handleOpenWizard} />
              </Suspense>
            ),
          },
        ]}
      />

      {controller.isWizardOpen && <Suspense fallback={null}>
      <InvestmentWizard
        open={controller.isWizardOpen}
        onOpenChange={controller.handleWizardOpenChange}
        initialAsset={controller.wizardInitialAsset}
        initialMode={controller.wizardInitialMode}
        initialQuantity={controller.wizardInitialQuantity}
        initialTotalCents={controller.wizardInitialTotalCents}
      />
      </Suspense>}

      {controller.cashDialogOpen && (
        <Suspense fallback={null}>
          <CashFormDialog
            open={controller.cashDialogOpen}
            onOpenChange={controller.setCashDialogOpen}
          />
        </Suspense>
      )}

      <UpgradeDialog
        open={controller.upgradeOpen}
        onOpenChange={controller.setUpgradeOpen}
        context={controller.upgradeContext}
        onProceedToCheckout={controller.handleProceedToCheckout}
      />
    </div>
  );
}
