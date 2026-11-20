import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  HorizontalAllocationDriftBars,
  type DriftBarItem,
} from "./allocation-drift-bars";

describe("HorizontalAllocationDriftBars", () => {
  const classItems: DriftBarItem[] = [
    {
      id: "c1",
      name: "Ações",
      currentValueBRL: 4000,
      allocatedBRL: 1000,
      targetPct: 50,
      ceilingPct: 60,
    },
    {
      id: "c2",
      name: "FIIs",
      currentValueBRL: 6000,
      allocatedBRL: 0,
      targetPct: 50,
      ceilingPct: 60,
    },
  ];

  const sectorItems: DriftBarItem[] = [
    { id: "s1", name: "Bancos", className: "Ações", currentValueBRL: 2000, allocatedBRL: 500, targetPct: 20 },
    { id: "s2", name: "Energia", className: "Ações", currentValueBRL: 2000, allocatedBRL: 500, targetPct: 20 },
    { id: "s3", name: "Saneamento", className: "Ações", currentValueBRL: 1000, allocatedBRL: 0, targetPct: 15 },
    { id: "s4", name: "Mineração", className: "Ações", currentValueBRL: 1000, allocatedBRL: 0, targetPct: 15 },
    { id: "s5", name: "Petróleo", className: "Ações", currentValueBRL: 1000, allocatedBRL: 0, targetPct: 15 },
    { id: "s6", name: "Logística", className: "FIIs", currentValueBRL: 500, allocatedBRL: 0, targetPct: 50 },
    { id: "s7", name: "Shoppings", className: "FIIs", currentValueBRL: 500, allocatedBRL: 0, targetPct: 50 },
  ];

  it("não renderiza nada se não houver itens ou se o total projetado for zero", () => {
    const { container } = render(
      <HorizontalAllocationDriftBars
        classItems={[]}
        totalCurrentBRL={0}
        totalAllocatedBRL={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza barras de classes com expansão de aporte e percentuais corretos", () => {
    render(
      <HorizontalAllocationDriftBars
        classItems={classItems}
        totalCurrentBRL={10000}
        totalAllocatedBRL={1000}
      />,
    );

    expect(screen.getByText("Alocação: Antes vs. Pós-Aporte")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getAllByText(/\(Meta:\s*50,0%\)/)).toHaveLength(2);

    // Ações: 4000/10000 = 40,0% -> (4000+1000)/11000 = 45,5%
    expect(screen.getByText(/40,0%/)).toBeInTheDocument();
    expect(screen.getByText(/45,5%/)).toBeInTheDocument();
  });

  it("permite alternar para visualização de setores, lista todos os setores sem corte de Outros e permite filtrar por classe pai", () => {
    render(
      <HorizontalAllocationDriftBars
        classItems={classItems}
        sectorItems={sectorItems}
        totalCurrentBRL={10000}
        totalAllocatedBRL={1000}
      />,
    );

    // Clica na aba de Setores
    const sectorsTab = screen.getByRole("button", { name: "Setores" });
    fireEvent.click(sectorsTab);

    // Deve exibir todos os setores sem agrupar em Outros
    expect(screen.getByText("Bancos")).toBeInTheDocument();
    expect(screen.getByText("Energia")).toBeInTheDocument();
    expect(screen.getByText("Saneamento")).toBeInTheDocument();
    expect(screen.getByText("Mineração")).toBeInTheDocument();
    expect(screen.getByText("Petróleo")).toBeInTheDocument();
    expect(screen.getByText("Logística")).toBeInTheDocument();
    expect(screen.getByText("Shoppings")).toBeInTheDocument();

    // Não deve existir 'Outros agrupados'
    expect(screen.queryByText("Outros agrupados")).toBeNull();

    // Mini-filtro por classe pai
    expect(screen.getByRole("button", { name: /Todos \(7\)/i })).toBeInTheDocument();
    const fiisFilterBtn = screen.getByRole("button", { name: /FIIs/i });
    expect(fiisFilterBtn).toBeInTheDocument();

    // Filtra exclusivamente por FIIs
    fireEvent.click(fiisFilterBtn);

    // Agora apenas setores de FIIs devem ser renderizados
    expect(screen.getByText("Logística")).toBeInTheDocument();
    expect(screen.getByText("Shoppings")).toBeInTheDocument();
    expect(screen.queryByText("Bancos")).toBeNull();
    expect(screen.queryByText("Energia")).toBeNull();
  });
});
