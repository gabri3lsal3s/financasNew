import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RequireFeature } from "./require-feature";

const mockUseUserAccess = vi.fn();

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

describe("RequireFeature Guard", () => {
  it("redireciona para o destino quando a feature flag estiver desabilitada", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
      hasFeature: vi.fn((key: string) => key !== "investments"),
    });

    render(
      <MemoryRouter initialEntries={["/investments"]}>
        <Routes>
          <Route element={<RequireFeature featureKey="investments" redirectTo="/overview" />}>
            <Route path="/investments" element={<div>Carteira de Investimentos</div>} />
          </Route>
          <Route path="/overview" element={<div>Visão Geral</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Carteira de Investimentos")).not.toBeInTheDocument();
    expect(screen.getByText("Visão Geral")).toBeInTheDocument();
  });

  it("permite o acesso à rota quando a feature flag estiver habilitada", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
      hasFeature: vi.fn(() => true),
    });

    render(
      <MemoryRouter initialEntries={["/investments"]}>
        <Routes>
          <Route element={<RequireFeature featureKey="investments" />}>
            <Route path="/investments" element={<div>Carteira de Investimentos</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Carteira de Investimentos")).toBeInTheDocument();
  });
});
