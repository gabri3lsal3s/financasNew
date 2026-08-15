import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllocationDonut } from "./allocation-donut";

describe("AllocationDonut (F16 — alocação por classe de ativo)", () => {
  it("renderiza as classes com percentual e valor", () => {
    render(
      <AllocationDonut
        slices={[
          { label: "Ações", valueCents: 800000 },
          { label: "FIIs", valueCents: 200000 },
        ]}
      />,
    );
    // Percentuais sobre o total (80% / 20%) e valores formatados.
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("R$ 8.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
  });

  it("aceita centerValue próprio (padrão: total das fatias)", () => {
    render(<AllocationDonut slices={[{ label: "Caixa", valueCents: 100000 }]} centerValue="R$ 1.000,00" />);
    // Centro + linha da fatia exibem o mesmo valor (lista replica o montante).
    expect(screen.getAllByText("R$ 1.000,00").length).toBeGreaterThan(0);
  });
});
