import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AporteResult, type AporteRouteRow } from "./aporte-result";

const mockRoutes: AporteRouteRow[] = [
  {
    assetId: "a1",
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
    assetId: "a2",
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

  it("aciona onExecuteAporte ao clicar no botão de lançar compras", async () => {
    const onExecuteAporte = vi.fn();
    const user = userEvent.setup();
    render(
      <AporteResult
        mode="asset"
        aporte={2000}
        totalAllocated={2000}
        leftover={0}
        routes={mockRoutes}
        onExecuteAporte={onExecuteAporte}
      />,
    );

    const launchBtn = screen.getByRole("button", { name: "Lançar compras no extrato" });
    expect(launchBtn).toBeInTheDocument();
    await user.click(launchBtn);

    expect(onExecuteAporte).toHaveBeenCalledTimes(1);
  });

  it("renderiza a distribuição macro por classe e diagnóstico de ativos ignorados", async () => {
    const user = userEvent.setup();
    render(
      <AporteResult
        mode="both"
        aporte={2000}
        totalAllocated={2000}
        leftover={0}
        routes={mockRoutes}
        classSummaries={[
          {
            className: "Ações",
            targetPct: 50,
            targetValueBRL: 5000,
            currentValueBRL: 4000,
            gapBRL: 1000,
            budgetAllocatedBRL: 1000,
            actualAllocatedBRL: 1000,
          },
        ]}
        skippedAssets={[
          {
            assetId: "s1",
            ticker: "VALE3",
            assetClass: "Ações",
            reason: "above_target",
            detail: "Posição na meta.",
          },
        ]}
      />,
    );

    expect(screen.getByText("Distribuição Macro por Classe")).toBeInTheDocument();
    expect(screen.getByText("Ativos não contemplados neste aporte (1)")).toBeInTheDocument();

    await user.click(screen.getByText("Ativos não contemplados neste aporte (1)"));
    expect(screen.getByText("VALE3")).toBeInTheDocument();
    expect(screen.getByText("Na meta")).toBeInTheDocument();
  });
});

