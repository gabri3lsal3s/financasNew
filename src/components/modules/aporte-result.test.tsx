import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AporteResult, type AporteRouteRow } from "./aporte-result";

const mockRoutes: AporteRouteRow[] = [
  {
    ticker: "PETR4",
    assetClass: "Ações",
    targetValueBRL: 5000,
    currentValueBRL: 4000,
    gapBRL: 1000,
    allocatedBRL: 1000,
    quantity: 25,
    priceBRL: 40,
  },
  {
    ticker: "HGLG11",
    assetClass: "FIIs",
    targetValueBRL: 6000,
    currentValueBRL: 5000,
    gapBRL: 1000,
    allocatedBRL: 1000,
    quantity: 6,
    priceBRL: 160,
  },
];

describe("AporteResult", () => {
  it("renderiza o sumário e as linhas de ativos sugeridos", () => {
    render(
      <AporteResult
        mode="asset"
        aporte={2000}
        totalAllocated={2000}
        leftover={0}
        routes={mockRoutes}
      />,
    );

    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("HGLG11")).toBeInTheDocument();
    expect(screen.getByText("Alocado em ativos")).toBeInTheDocument();
  });

  it("permite marcar um ativo como feito e atualiza o contador de execução", async () => {
    const user = userEvent.setup();
    render(
      <AporteResult
        mode="asset"
        aporte={2000}
        totalAllocated={2000}
        leftover={0}
        routes={mockRoutes}
      />,
    );

    const markPetr4 = screen.getByRole("button", { name: "Marcar PETR4 como executado" });
    expect(markPetr4).toBeInTheDocument();

    await user.click(markPetr4);

    expect(screen.getByText("Feito")).toBeInTheDocument();
    expect(screen.getByText("Alocado (1/2 feitos)")).toBeInTheDocument();

    const unmarkPetr4 = screen.getByRole("button", { name: "Marcar PETR4 como pendente" });
    await user.click(unmarkPetr4);

    expect(screen.getByText("Alocado em ativos")).toBeInTheDocument();
  });

  it("exibe mensagem amigável quando não há rotas elegíveis", () => {
    render(
      <AporteResult
        mode="asset"
        aporte={2000}
        totalAllocated={0}
        leftover={2000}
        routes={[]}
      />,
    );

    expect(screen.getByText(/Nenhum ativo elegível/i)).toBeInTheDocument();
  });
});
