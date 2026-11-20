import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConcentricAllocationDonut, type ConcentricDonutClassItem } from "./concentric-allocation-donut";

const mockItems: ConcentricDonutClassItem[] = [
  {
    id: "acoes",
    name: "Ações",
    currentValueBRL: 4000,
    allocatedBRL: 600,
    targetPct: 50,
  },
  {
    id: "fiis",
    name: "FIIs",
    currentValueBRL: 3000,
    allocatedBRL: 400,
    targetPct: 30,
  },
  {
    id: "renda-fixa",
    name: "Renda Fixa",
    currentValueBRL: 3000,
    allocatedBRL: 0,
    targetPct: 20,
  },
];

describe("ConcentricAllocationDonut", () => {
  it("renderiza corretamente com aporte R$ 0,00 exibindo percentuais atuais", () => {
    const zeroAllocItems = mockItems.map((i) => ({ ...i, allocatedBRL: 0 }));

    render(
      <ConcentricAllocationDonut
        items={zeroAllocItems}
        totalCurrentBRL={10000}
        totalAllocatedBRL={0}
        diversificationImpact={{
          currentNef: 6.2,
          projectedNef: 6.2,
          deltaNefPct: 0,
          currentNefStocks: 4.1,
          projectedNefStocks: 4.1,
          topAssetTicker: "PETR4",
          currentTopAssetSharePct: 18.5,
          projectedTopAssetSharePct: 18.5,
        }}
      />,
    );

    // Deve exibir o Nef atual no centro
    expect(screen.getByText("6.2")).toBeInTheDocument();
    expect(screen.getByText("Ativos efetivos")).toBeInTheDocument();

    // Micro-legenda
    expect(screen.getByText("Atual")).toBeInTheDocument();
    expect(screen.getByText("Meta")).toBeInTheDocument();

    // Classes na legenda
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("Renda Fixa")).toBeInTheDocument();
  });

  it("renderiza com aporte ativo (> 0) exibindo antes vs pós-aporte e Nef projetado com delta", () => {
    render(
      <ConcentricAllocationDonut
        items={mockItems}
        totalCurrentBRL={10000}
        totalAllocatedBRL={1000}
        diversificationImpact={{
          currentNef: 6.2,
          projectedNef: 7.8,
          deltaNefPct: 25.8,
          currentNefStocks: 4.1,
          projectedNefStocks: 5.0,
          topAssetTicker: "PETR4",
          currentTopAssetSharePct: 18.5,
          projectedTopAssetSharePct: 16.2,
        }}
      />,
    );

    // Deve exibir o Nef projetado com badge delta
    expect(screen.getByText("7.8")).toBeInTheDocument();
    expect(screen.getByText("+25.8%")).toBeInTheDocument();
    expect(screen.getByText("Pós-aporte")).toBeInTheDocument();

    // Valores alocados
    expect(screen.getByText("+R$ 600")).toBeInTheDocument();
    expect(screen.getByText("+R$ 400")).toBeInTheDocument();
  });

  it("atualiza o centro do donut no hover de um item da legenda", () => {
    render(
      <ConcentricAllocationDonut
        items={mockItems}
        totalCurrentBRL={10000}
        totalAllocatedBRL={1000}
      />,
    );

    const acoesBtn = screen.getByRole("button", { name: /Ações/i });
    fireEvent.mouseEnter(acoesBtn);

    // O centro deve mudar para os detalhes de Ações
    expect(screen.getByText("Meta 50,0%")).toBeInTheDocument();

    fireEvent.mouseLeave(acoesBtn);
    // Volta para o estado inicial
    expect(screen.getByText("Ativos efetivos")).toBeInTheDocument();
  });
});
