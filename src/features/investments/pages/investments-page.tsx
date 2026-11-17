import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Briefcase, Coins, Plus, Scale, Wallet } from "lucide-react";
import { Button, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useAutoPortfolioSnapshot } from "@/hooks/use-auto-portfolio-snapshot";
import { usePermission } from "@/state";
import { ResumoTab } from "./resumo-tab";
import { MovimentacoesTab } from "./movimentacoes-tab";
import { RebalanceTab } from "./rebalance-tab";
import { ProventosTab } from "./proventos-tab";
import { CashFormDialog, PortfolioInsightsCarousel } from "../components";
import { InvestmentWizard } from "../wizard";
import type { WizardMode } from "../wizard/wizard-state";
import type { PortfolioAsset } from "@/types";

type MainInvestmentsTab = "carteira" | "rebalancear" | "proventos";
type CarteiraSubView = "posicao" | "extrato";

/**
 * Investimentos (§Plano 42 · v3.10.0) — Arquitetura unificada em 3 abas Nível 1:
 * 1. Carteira (Posição | Extrato)
 * 2. Rebalancear (Simulador | Metas)
 * 3. Proventos (Extrato Mensal | Calendário | Por Ativo | Bola de Neve)
 * Preserva roteamento retrocompatível para ?tab=resumo, ?tab=movimentacoes, ?tab=aporte e ?tab=metas.
 */
export function InvestmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");

  const activeTab: MainInvestmentsTab =
    tabParam === "proventos"
      ? "proventos"
      : tabParam === "rebalancear" || tabParam === "aporte" || tabParam === "metas"
        ? "rebalancear"
        : "carteira";

  const carteiraView: CarteiraSubView =
    tabParam === "movimentacoes" || (activeTab === "carteira" && viewParam === "extrato")
      ? "extrato"
      : "posicao";

  useAutoPortfolioSnapshot();

  const permission = usePermission("investments");
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const handleTabChange = (nextTab: string, params?: Record<string, string | number>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("valor");
        next.delete("surplusCents");
        next.delete("view");
        next.delete("subtab");

        if (nextTab === "movimentacoes") {
          next.set("tab", "carteira");
          next.set("view", "extrato");
        } else if (nextTab === "resumo" || nextTab === "carteira") {
          next.set("tab", "carteira");
        } else if (nextTab === "aporte") {
          next.set("tab", "rebalancear");
          next.set("view", "simulador");
        } else if (nextTab === "metas") {
          next.set("tab", "rebalancear");
          next.set("view", "metas");
        } else if (nextTab === "rebalancear" || nextTab === "proventos") {
          next.set("tab", nextTab);
        } else {
          next.set("tab", "carteira");
        }

        if (params) {
          Object.entries(params).forEach(([key, val]) => {
            next.set(key, String(val));
          });
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleCarteiraViewChange = (nextView: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "carteira");
        next.delete("valor");
        next.delete("surplusCents");
        next.delete("subtab");
        if (nextView === "extrato") {
          next.set("view", "extrato");
        } else {
          next.delete("view");
        }
        return next;
      },
      { replace: true },
    );
  };

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
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Adicionar Operação de Investimento");
      setUpgradeOpen(true);
      return;
    }
    setWizardInitialAsset(asset);
    setWizardInitialMode(mode);
    setWizardOpen(true);
  };

  const handleOpenCash = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Gerenciar Caixa de Investimentos");
      setUpgradeOpen(true);
      return;
    }
    setCashDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
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
              onClick={handleOpenCash}
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
              onClick={() => handleOpenWizard(null, "select")}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nova Operação
            </Button>
          </>
        }
      />

      {permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            setUpgradeContext(undefined);
            setUpgradeOpen(true);
          }}
        />
      )}

      <PortfolioInsightsCarousel />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        swipeable
        items={[
          {
            value: "carteira",
            label: "Carteira",
            icon: <Briefcase className="size-4" aria-hidden="true" />,
            content: (
              <div className="flex flex-col gap-5 min-w-0">
                <Tabs
                  value={carteiraView}
                  onValueChange={handleCarteiraViewChange}
                  variant="pills"
                  fullWidth
                  ariaLabel="Sub-abas da carteira"
                  items={[
                    {
                      value: "posicao",
                      label: "Posição",
                      content: (
                        <ResumoTab
                          onOpenWizard={handleOpenWizard}
                          onOpenCash={handleOpenCash}
                          onSelectTab={handleTabChange}
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
            content: <RebalanceTab onGoToPosition={() => handleTabChange("carteira")} />,
          },
          {
            value: "proventos",
            label: "Proventos",
            icon: <Coins className="size-4" aria-hidden="true" />,
            content: <ProventosTab onOpenWizard={handleOpenWizard} />,
          },
        ]}
      />

      <InvestmentWizard
        open={isWizardOpen}
        onOpenChange={handleWizardOpenChange}
        initialAsset={wizardInitialAsset}
        initialMode={wizardInitialMode}
      />

      <CashFormDialog
        open={cashDialogOpen}
        onOpenChange={setCashDialogOpen}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(p) => {
          setUpgradeOpen(false);
          navigate(buildCheckoutUrl({ plan: p }));
        }}
      />
    </div>
  );
}
