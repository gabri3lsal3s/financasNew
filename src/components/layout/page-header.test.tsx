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
  it("renderiza título com line-clamp-2 break-words e descrição corretamente", () => {
    render(
      <BrowserRouter>
        <PageHeader
          title="Contas & Dívidas"
          description="Gestão de contas a pagar e receber"
        />
      </BrowserRouter>,
    );

    const heading = screen.getByRole("heading", { name: "Contas & Dívidas" });
    expect(heading).toBeInTheDocument();
    expect(heading.className).toContain("line-clamp-2");
    expect(heading.className).toContain("break-words");
    expect(heading.className).not.toContain("truncate");
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

  it("aplica grid proporcional grid-cols-2 sm:flex no mobile quando há 2 botões diretos no slot actions", () => {
    render(
      <BrowserRouter>
        <PageHeader
          title="Orçamentos"
          actions={
            <>
              <button type="button">Ajustar</button>
              <button type="button">Nova Categoria</button>
            </>
          }
        />
      </BrowserRouter>,
    );

    const actionsContainer = screen.getByRole("button", { name: "Ajustar" }).parentElement;
    expect(actionsContainer?.className).toContain("grid-cols-2");
    expect(actionsContainer?.className).toContain("sm:flex");
  });

  it("aciona callback de voltar ao clicar no botão de voltar com área mínima de toque 44px no mobile", async () => {
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
    expect(backBtn.className).toContain("min-h-11");
    expect(backBtn.className).toContain("min-w-11");
    await user.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renderiza utilityActions junto com actions mantendo grid-cols-2 para os botões principais", () => {
    render(
      <BrowserRouter>
        <PageHeader
          title="Transações"
          utilityActions={<button type="button">Guia</button>}
          actions={
            <>
              <button type="button">Exportar CSV</button>
              <button type="button">Nova transação</button>
            </>
          }
        />
      </BrowserRouter>,
    );

    expect(screen.getByRole("button", { name: "Guia" })).toBeInTheDocument();
    const actionsContainer = screen.getByRole("button", { name: "Exportar CSV" }).parentElement;
    expect(actionsContainer?.className).toContain("grid-cols-2");
    expect(actionsContainer?.className).toContain("flex-1");
  });
});
