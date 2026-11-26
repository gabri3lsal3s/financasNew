import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CorporateDividendsBanner } from "./corporate-dividends-banner";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("CorporateDividendsBanner", () => {
  it("renderiza pluralização correta no singular e usa role='region' com título text-sm", () => {
    render(
      <CorporateDividendsBanner
        availableCount={1}
        projectedCount={0}
        totalAvailableAmount={45.5}
        totalProjectedAmount={0}
        onInspect={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: /Aviso de proventos/i })).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: /Proventos a Conferir/i });
    expect(heading).toHaveClass("text-sm");
    expect(screen.getByText(/1 provento disponível totalizando/i)).toBeInTheDocument();
  });

  it("permite dispensar o aviso de proventos por 7 ou 30 dias via CarouselDismissPopover", () => {
    const onDismiss = vi.fn();
    render(
      <CorporateDividendsBanner
        availableCount={0}
        projectedCount={2}
        totalAvailableAmount={0}
        totalProjectedAmount={120}
        onInspect={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(/2 proventos previstos totalizando/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dispensar aviso de proventos/i }));
    fireEvent.click(screen.getByRole("button", { name: /Lembrar no próximo mês/i }));
    expect(onDismiss).toHaveBeenCalledWith(30);
  });

  it("destaca conferência obrigatória quando houver alíquota incerta (fallback Yahoo)", () => {
    render(
      <CorporateDividendsBanner
        availableCount={2}
        projectedCount={0}
        totalAvailableAmount={180}
        totalProjectedAmount={0}
        hasUncertainTax
        onInspect={vi.fn()}
      />,
    );

    expect(screen.getByText("Conferir alíquota")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conferir e Aprovar/i })).toBeInTheDocument();
  });
});
