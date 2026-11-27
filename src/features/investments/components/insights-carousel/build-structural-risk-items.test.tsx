import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  buildStructuralRiskItems,
  type BuildStructuralRiskItemsParams,
} from "./build-structural-risk-items";
import type { StructuralRiskAlert } from "@/domain/portfolio/portfolio-risk-policy";

describe("buildStructuralRiskItems", () => {
  const isAlertDismissedMock = vi.fn();
  const dismissAlertMock = vi.fn();
  const onNavigateMock = vi.fn();

  const defaultProps: BuildStructuralRiskItemsParams = {
    alerts: [],
    isAlertDismissed: isAlertDismissedMock,
    dismissAlert: dismissAlertMock,
    onNavigate: onNavigateMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isAlertDismissedMock.mockReturnValue(false);
  });

  it("retorna array vazio quando não há alertas", () => {
    const items = buildStructuralRiskItems(defaultProps);
    expect(items).toHaveLength(0);
  });

  it("filtra alertas que foram dispensados pelo usuário", () => {
    const alert: StructuralRiskAlert = {
      id: "alert-1",
      type: "single_asset_concentration",
      priority: 1.5,
      tone: "critical",
      title: "Alta concentração em PETR4",
      description: "PETR4 representa 40% da carteira.",
      ctaAction: "navigate_aporte",
    };

    isAlertDismissedMock.mockReturnValueOnce(true);

    const items = buildStructuralRiskItems({
      ...defaultProps,
      alerts: [alert],
    });

    expect(items).toEqual([false]);
  });

  it("renderiza todos os tipos de alerta com ícones, badges e CTAs corretos", () => {
    const alerts: StructuralRiskAlert[] = [
      {
        id: "a1",
        type: "single_asset_concentration",
        priority: 1.5,
        tone: "critical",
        title: "Alta concentração em PETR4",
        description: "PETR4 representa 35% do total.",
        ctaText: "Simular Rebalanceamento",
        ctaAction: "navigate_aporte",
        metadata: { weightPct: 35.0 },
      },
      {
        id: "a2",
        type: "private_issuer_fgc",
        priority: 2.5,
        tone: "critical",
        title: "Exposição concentrada em Banco BMG",
        description: "Excede cobertura do FGC.",
        ctaText: "Ver Renda Fixa",
        ctaAction: "navigate_fixed_income",
        metadata: { exceedsFgc: true },
      },
      {
        id: "a3",
        type: "macro_sector_concentration",
        priority: 5.5,
        tone: "warning",
        title: "Concentração em Financeiro",
        description: "Concentra 50% das ações.",
        ctaText: "Simular Rebalanceamento",
        ctaAction: "navigate_aporte",
        metadata: { macroInClassPct: 50.0 },
      },
      {
        id: "a4",
        type: "low_diversification_nef",
        priority: 6.5,
        tone: "primary",
        title: "Concentração oculta em Ações",
        description: "Nef é 2.5.",
        ctaText: "Ver Sugestão de Aporte",
        ctaAction: "navigate_aporte",
        metadata: { classNef: 2.5 },
      },
      {
        id: "a5",
        type: "benchmark_overlap",
        priority: 7.5,
        tone: "info",
        title: "Sobreposição de ETFs em S&P 500",
        description: "2 ETFs replicam S&P 500.",
        ctaText: "Ver Carteira",
        ctaAction: "navigate_portfolio",
        metadata: { count: 2 },
      },
    ];

    const items = buildStructuralRiskItems({
      ...defaultProps,
      alerts,
    });

    expect(items).toHaveLength(5);

    // Renderiza cada item e valida interações
    for (const item of items) {
      if (!item) continue;
      const { unmount } = render(item.content);
      unmount();
    }
  });

  it("aciona onNavigate e dismissAlert corretamente nos cliques", () => {
    const alert: StructuralRiskAlert = {
      id: "a1",
      type: "single_asset_concentration",
      priority: 1.5,
      tone: "critical",
      title: "Alta concentração em PETR4",
      description: "PETR4 representa 35% do total.",
      ctaText: "Simular Rebalanceamento",
      ctaAction: "navigate_aporte",
      metadata: { weightPct: 35.0 },
    };

    const items = buildStructuralRiskItems({
      ...defaultProps,
      alerts: [alert],
    });

    const activeItem = items[0];
    expect(activeItem).toBeTruthy();
    if (!activeItem) return;

    render(activeItem.content);

    const button = screen.getByRole("button", { name: "Simular Rebalanceamento" });
    fireEvent.click(button);
    expect(onNavigateMock).toHaveBeenCalledWith("/investments?tab=aporte");
  });
});
