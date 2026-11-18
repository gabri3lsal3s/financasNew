import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { useAutoPortfolioSnapshot } from "@/hooks/use-auto-portfolio-snapshot";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { usePermission } from "@/state";
import type { PortfolioAsset } from "@/types";
import type { WizardMode } from "../../wizard/wizard-state";

export type MainInvestmentsTab = "carteira" | "rebalancear" | "proventos";
export type CarteiraSubView = "posicao" | "extrato";

export interface OpenWizardOptions {
  initialQuantity?: number | string | null;
  initialTotalCents?: number | null;
}

export function useInvestmentsPageController() {
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

  const handleTabChange = useCallback(
    (nextTab: string, params?: Record<string, string | number>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("valor");
          next.delete("surplusCents");
          next.delete("usarCaixa");
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
    },
    [setSearchParams],
  );

  const handleCarteiraViewChange = useCallback(
    (nextView: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "carteira");
          next.delete("valor");
          next.delete("surplusCents");
          next.delete("usarCaixa");
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
    },
    [setSearchParams],
  );

  const { open: wizardDeepOpen, setOpen: setWizardDeepOpen } = useCreateDeepLink("investimento");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialAsset, setWizardInitialAsset] = useState<PortfolioAsset | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<WizardMode>("select");
  const [wizardInitialQuantity, setWizardInitialQuantity] = useState<number | string | null>(null);
  const [wizardInitialTotalCents, setWizardInitialTotalCents] = useState<number | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);

  const isWizardOpen = wizardOpen || wizardDeepOpen;

  const handleWizardOpenChange = useCallback(
    (next: boolean) => {
      setWizardOpen(next);
      setWizardDeepOpen(next);
      if (!next) {
        setWizardInitialAsset(null);
        setWizardInitialMode("select");
        setWizardInitialQuantity(null);
        setWizardInitialTotalCents(null);
      }
    },
    [setWizardDeepOpen],
  );

  const handleOpenWizard = useCallback(
    (
      asset: PortfolioAsset | null = null,
      mode: WizardMode = "select",
      options?: OpenWizardOptions,
    ) => {
      if (permission.isReadOnlyMode) {
        setUpgradeContext("Adicionar Operação de Investimento");
        setUpgradeOpen(true);
        return;
      }
      setWizardInitialAsset(asset);
      setWizardInitialMode(mode);
      setWizardInitialQuantity(options?.initialQuantity ?? null);
      setWizardInitialTotalCents(options?.initialTotalCents ?? null);
      setWizardOpen(true);
    },
    [permission.isReadOnlyMode],
  );

  const handleOpenCash = useCallback(() => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Gerenciar Caixa de Investimentos");
      setUpgradeOpen(true);
      return;
    }
    setCashDialogOpen(true);
  }, [permission.isReadOnlyMode]);

  const handleProceedToCheckout = useCallback(
    (plan: NonNullable<Parameters<typeof buildCheckoutUrl>[0]>["plan"]) => {
      setUpgradeOpen(false);
      navigate(buildCheckoutUrl({ plan }));
    },
    [navigate],
  );

  return {
    activeTab,
    carteiraView,
    isReadOnlyMode: permission.isReadOnlyMode,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    setUpgradeContext,
    isWizardOpen,
    wizardInitialAsset,
    wizardInitialMode,
    wizardInitialQuantity,
    wizardInitialTotalCents,
    cashDialogOpen,
    setCashDialogOpen,
    handleTabChange,
    handleCarteiraViewChange,
    handleWizardOpenChange,
    handleOpenWizard,
    handleOpenCash,
    handleProceedToCheckout,
  };
}
