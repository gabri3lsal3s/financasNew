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

  it("mantém LoadingScreen visível e não renderiza conteúdo privado enquanto isLoading for true", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: true,
      isAdmin: false,
      hasFeature: vi.fn(() => false),
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

    expect(screen.queryByText("Carteira de Investimentos")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redireciona na rota raiz '/' para a primeira página disponível quando overview (Home) estiver desabilitada", () => {
    // Cenário: Usuário modular com acesso apenas a investimentos
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
      hasFeature: vi.fn((key: string) => key === "investments"),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<RequireFeature featureKey="overview" />}>
            <Route path="/" element={<div>Painel Início</div>} />
          </Route>
          <Route path="/investments" element={<div>Carteira de Investimentos</div>} />
          <Route path="/transacoes" element={<div>Extrato de Transações</div>} />
          <Route path="/configuracoes" element={<div>Configurações</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Painel Início")).not.toBeInTheDocument();
    expect(screen.getByText("Carteira de Investimentos")).toBeInTheDocument();
  });

  it("redireciona na rota raiz '/' para transações quando overview estiver desabilitada mas transações estiver ativa", () => {
    // Cenário: Usuário com extrato/transações ativo, mas sem visão geral
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
      hasFeature: vi.fn((key: string) => key === "transactions" || key === "investments"),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<RequireFeature featureKey="overview" />}>
            <Route path="/" element={<div>Painel Início</div>} />
          </Route>
          <Route path="/transacoes" element={<div>Extrato de Transações</div>} />
          <Route path="/investments" element={<div>Carteira de Investimentos</div>} />
          <Route path="/configuracoes" element={<div>Configurações</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Painel Início")).not.toBeInTheDocument();
    expect(screen.getByText("Extrato de Transações")).toBeInTheDocument();
  });
});
