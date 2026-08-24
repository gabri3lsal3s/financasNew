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

  it("renderiza a distribuição meso por setor e permite alternar para o modo Árvore", async () => {
    const user = userEvent.setup();
    const routesWithSector: AporteRouteRow[] = [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        sector: "Petróleo & Gás",
        targetValueBRL: 5000,
        currentValueBRL: 4000,
        gapBRL: 1000,
        allocatedBRL: 1000,
        quantity: 25,
        priceBRL: 40,
      },
    ];

    render(
      <AporteResult
        mode="both"
        aporte={1000}
        totalAllocated={1000}
        leftover={0}
        routes={routesWithSector}
        sectorSummaries={[
          {
            className: "Ações",
            sectorName: "Petróleo & Gás",
            targetPctInClass: 50,
            effectiveTargetPct: 25,
            targetValueBRL: 5000,
            currentValueBRL: 4000,
            gapBRL: 1000,
            budgetAllocatedBRL: 1000,
            actualAllocatedBRL: 1000,
          },
        ]}
      />,
    );

    expect(screen.getByText("Distribuição Meso por Setor")).toBeInTheDocument();
    expect(screen.getAllByText("Petróleo & Gás").length).toBeGreaterThanOrEqual(1);

    const treeBtn = screen.getByRole("button", { name: "Árvore" });
    expect(treeBtn).toBeInTheDocument();
    await user.click(treeBtn);

    expect(screen.getByText("Hierarquia / Ativo")).toBeInTheDocument();
  });

  it("permite colapsar e expandir classes e setores destacando os itens com aporte", async () => {
    const user = userEvent.setup();
    const classSummaries = [
      { className: "Ações", targetPct: 25, targetValueBRL: 5000, currentValueBRL: 4000, gapBRL: 1000, budgetAllocatedBRL: 500, actualAllocatedBRL: 500 },
      { className: "FIIs", targetPct: 25, targetValueBRL: 5000, currentValueBRL: 4500, gapBRL: 500, budgetAllocatedBRL: 0, actualAllocatedBRL: 0 },
      { className: "Renda Fixa", targetPct: 25, targetValueBRL: 5000, currentValueBRL: 4600, gapBRL: 400, budgetAllocatedBRL: 0, actualAllocatedBRL: 0 },
      { className: "Internacional", targetPct: 25, targetValueBRL: 5000, currentValueBRL: 4700, gapBRL: 300, budgetAllocatedBRL: 0, actualAllocatedBRL: 0 },
    ];

    render(
      <AporteResult
        mode="both"
        aporte={500}
        totalAllocated={500}
        leftover={0}
        routes={mockRoutes}
        classSummaries={classSummaries}
      />,
    );

    // Inicialmente mostra apenas a classe com aporte (Ações)
    expect(screen.getAllByText("Ações").length).toBeGreaterThan(0);
    expect(screen.queryByText("Internacional")).not.toBeInTheDocument();

    // Botão de expandir exibe todas as classes
    const expandBtn = screen.getByRole("button", { name: /Ver todas \(4\)/i });
    expect(expandBtn).toBeInTheDocument();
    await user.click(expandBtn);

    // Todas as 4 classes agora estão visíveis
    expect(screen.getByText("Internacional")).toBeInTheDocument();
    expect(screen.getAllByText("FIIs").length).toBeGreaterThan(0);

    // Clicar em Recolher volta ao modo compacto
    const collapseBtn = screen.getByRole("button", { name: /Recolher/i });
    await user.click(collapseBtn);
    expect(screen.queryByText("Internacional")).not.toBeInTheDocument();
  });
});


