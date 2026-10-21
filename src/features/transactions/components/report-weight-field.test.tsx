import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportWeightField } from "./report-weight-field";

describe("ReportWeightField", () => {
  it("renderiza o rótulo claro 'Sua Participação / Rateio' e não exibe aviso no modo 100%", () => {
    render(
      <ReportWeightField
        valueCents={10000}
        mode="1"
        onModeChange={vi.fn()}
        customAmountCents={10000}
        onCustomAmountChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Sua Participação / Rateio")).toBeInTheDocument();
    expect(screen.queryByText(/Aviso de Rateio/i)).not.toBeInTheDocument();
  });

  it("exibe aviso explícito de que o valor bancário cobrado permanece 100% quando há rateio", () => {
    render(
      <ReportWeightField
        valueCents={20000} // R$ 200,00
        mode="0.5" // 50%
        onModeChange={vi.fn()}
        customAmountCents={10000}
        onCustomAmountChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aviso de Rateio:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/O valor bancário cobrado permanece 100% \(R\$ 200,00\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/entrará apenas a sua cota de R\$ 100,00/i)).toBeInTheDocument();
  });

  it("renderiza bloco customizado com aviso proporcional quando modo é custom", async () => {
    const user = userEvent.setup();
    const onCustomChange = vi.fn();

    render(
      <ReportWeightField
        valueCents={15000} // R$ 150,00
        mode="custom"
        onModeChange={vi.fn()}
        customAmountCents={5000} // R$ 50,00 = 33%
        onCustomAmountChange={onCustomChange}
        customLabel="Sua cota considerada no relatório"
      />,
    );

    expect(screen.getByText("Sua cota considerada no relatório")).toBeInTheDocument();
    expect(screen.getByText(/Equivale a 33% do valor total cobrado \(R\$ 150,00\)/i)).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Valor considerado no relatório" });
    await user.clear(input);
    await user.type(input, "7500");

    expect(onCustomChange).toHaveBeenCalled();
  });
});
