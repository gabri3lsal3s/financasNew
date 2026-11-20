import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllocationCard } from "./allocation-card";

const mockClasses = [
  { id: "acoes", name: "Ações", currentValueBRL: 4000, allocatedBRL: 500, targetPct: 50 },
  { id: "fiis", name: "FIIs", currentValueBRL: 3000, allocatedBRL: 300, targetPct: 30 },
];

const mockSectors = [
  { id: "sec-1", name: "Tecnologia", currentValueBRL: 2000, allocatedBRL: 300, targetPct: 40 },
  { id: "sec-2", name: "Financeiro", currentValueBRL: 2000, allocatedBRL: 200, targetPct: 40 },
];

describe("AllocationCard", () => {
  it("renderiza o cabeçalho adaptativo e o donut concêntrico na aba classes", () => {
    render(
      <AllocationCard
        classItems={mockClasses}
        sectorItems={mockSectors}
        totalCurrentBRL={7000}
        totalAllocatedBRL={800}
      />,
    );

    expect(screen.getByText("Alocação: Antes vs. Pós-Aporte")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
  });

  it("renderiza o título Atual vs. Meta quando aporte for R$ 0,00", () => {
    render(
      <AllocationCard
        classItems={mockClasses.map((c) => ({ ...c, allocatedBRL: 0 }))}
        sectorItems={mockSectors}
        totalCurrentBRL={7000}
        totalAllocatedBRL={0}
      />,
    );

    expect(screen.getByText("Alocação Atual vs. Meta")).toBeInTheDocument();
  });

  it("permite alternar para a aba Setores e exibe as barras horizontais", () => {
    render(
      <AllocationCard
        classItems={mockClasses}
        sectorItems={mockSectors}
        totalCurrentBRL={7000}
        totalAllocatedBRL={800}
      />,
    );

    const sectorsBtn = screen.getByRole("button", { name: /Setores/i });
    fireEvent.click(sectorsBtn);

    expect(screen.getByText("Tecnologia")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
  });
});
