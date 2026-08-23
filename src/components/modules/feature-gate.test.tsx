import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureGate } from "./feature-gate";

const mockUseUserAccess = vi.fn();

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

describe("FeatureGate Component", () => {
  it("não renderiza nada durante o carregamento das flags", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: true,
      hasFeature: vi.fn(),
    });

    render(
      <FeatureGate feature="investments">
        <div>Conteúdo Protegido</div>
      </FeatureGate>,
    );

    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
  });

  it("renderiza o fallback quando a funcionalidade estiver desativada", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      hasFeature: (key: string) => key !== "investments",
    });

    render(
      <FeatureGate feature="investments" fallback={<div>Módulo Desativado</div>}>
        <div>Conteúdo de Investimentos</div>
      </FeatureGate>,
    );

    expect(screen.queryByText("Conteúdo de Investimentos")).not.toBeInTheDocument();
    expect(screen.getByText("Módulo Desativado")).toBeInTheDocument();
  });

  it("renderiza os children quando a funcionalidade estiver ativa", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      hasFeature: (key: string) => key === "investments",
    });

    render(
      <FeatureGate feature="investments">
        <div>Conteúdo de Investimentos</div>
      </FeatureGate>,
    );

    expect(screen.getByText("Conteúdo de Investimentos")).toBeInTheDocument();
  });
});
