import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router";
import { PageHeader } from "./page-header";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("PageHeader", () => {
  it("renderiza título e descrição corretamente", () => {
    render(
      <BrowserRouter>
        <PageHeader
          title="Contas & Dívidas"
          description="Gestão de contas a pagar e receber"
        />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: "Contas & Dívidas" })).toBeInTheDocument();
    expect(screen.getByText("Gestão de contas a pagar e receber")).toBeInTheDocument();
  });

  it("renderiza badge e botões de ação", () => {
    render(
      <BrowserRouter>
        <PageHeader
          title="Orçamentos"
          badge={<span>Ativo</span>}
          actions={<button type="button">Nova Categoria</button>}
        />
      </BrowserRouter>,
    );

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova Categoria" })).toBeInTheDocument();
  });

  it("aciona callback de voltar ao clicar no botão de voltar", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <BrowserRouter>
        <PageHeader
          title="Detalhes"
          backTo={onBack}
          backLabel="Retornar à lista"
        />
      </BrowserRouter>,
    );

    const backBtn = screen.getByRole("button", { name: "Retornar à lista" });
    expect(backBtn).toBeInTheDocument();
    await user.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
