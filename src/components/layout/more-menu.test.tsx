import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MoreMenu } from "./more-menu";

vi.mock("@/state", () => ({
  useReminders: () => ({
    totalCount: 3,
    urgentCount: 1,
    items: [],
    isLoading: false,
    error: null,
  }),
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
  }),
}));


describe("MoreMenu", () => {
  it("não renderiza Início, Transações nem Cartões (já presentes na barra de navegação)", () => {
    render(
      <MemoryRouter>
        <MoreMenu />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Início")).not.toBeInTheDocument();
    expect(screen.queryByText("Transações")).not.toBeInTheDocument();
    expect(screen.queryByText("Cartões")).not.toBeInTheDocument();
  });

  it("renderiza as opções secundárias consolidadas", () => {
    render(
      <MemoryRouter>
        <MoreMenu />
      </MemoryRouter>,
    );

    expect(screen.getByText("Planejamento & Análise")).toBeInTheDocument();
    expect(screen.getByText("Notificações & Sistema")).toBeInTheDocument();
    expect(screen.getByText("Dívidas")).toBeInTheDocument();
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Categorias")).toBeInTheDocument();
    expect(screen.getByText("Lembretes")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("exibe badge de notificações em lembretes com contagem", () => {
    render(
      <MemoryRouter>
        <MoreMenu />
      </MemoryRouter>,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
