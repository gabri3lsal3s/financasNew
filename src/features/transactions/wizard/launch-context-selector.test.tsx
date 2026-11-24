import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultLaunchState } from "./wizard-state";
import { LaunchContextSelector } from "./launch-context-selector";

describe("LaunchContextSelector - Proporção Personalizada no Split PF/PJ", () => {
  const setup = (overrides = {}) => {
    const onSplitPFPJBusinessPercentChange = vi.fn();
    const onSplitPFPJToggle = vi.fn();
    const onScopeChange = vi.fn();
    const onTaxDeductibleChange = vi.fn();

    const state = defaultLaunchState("expense", {
      valueCents: 10000, // R$ 100,00
      splitPFPJEnabled: true,
      splitPFPJBusinessPercent: 50,
      scope: "personal",
      ...overrides,
    });

    const utils = render(
      <LaunchContextSelector
        state={state}
        isBusinessModeEnabled={true}
        onSplitPFPJToggle={onSplitPFPJToggle}
        onSplitPFPJBusinessPercentChange={onSplitPFPJBusinessPercentChange}
        onScopeChange={onScopeChange}
        onTaxDeductibleChange={onTaxDeductibleChange}
      />,
    );

    return {
      ...utils,
      state,
      onSplitPFPJBusinessPercentChange,
      onSplitPFPJToggle,
      onScopeChange,
      onTaxDeductibleChange,
    };
  };

  it("renderiza os 4 presets padrão e o chip 'Personalizado'", () => {
    setup();

    expect(screen.getByRole("radio", { name: /50% \/ 50%/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /70% PJ \/ 30% PF/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /30% PJ \/ 70% PF/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /80% PJ \/ 20% PF/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Personalizado/i })).toBeInTheDocument();
  });

  it("chama onSplitPFPJBusinessPercentChange ao clicar em um preset padrão", async () => {
    const user = userEvent.setup();
    const { onSplitPFPJBusinessPercentChange } = setup();

    await user.click(screen.getByRole("radio", { name: /70% PJ \/ 30% PF/i }));
    expect(onSplitPFPJBusinessPercentChange).toHaveBeenCalledWith(70);
  });

  it("abre os controles personalizados ao clicar em 'Personalizado'", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByText("Proporção Personalizada")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Personalizado/i }));

    expect(screen.getByText("Proporção Personalizada")).toBeInTheDocument();
    expect(screen.getByText("Fatia do negócio:")).toBeInTheDocument();
    expect(screen.getByText("+5%")).toBeInTheDocument();
    expect(screen.getByText("+10%")).toBeInTheDocument();
    expect(screen.getByText("-5%")).toBeInTheDocument();
    expect(screen.getByText("-10%")).toBeInTheDocument();
  });

  it("abre os controles personalizados automaticamente se o percentual inicial não for preset padrão", () => {
    setup({ splitPFPJBusinessPercent: 65 });

    expect(screen.getByText("Proporção Personalizada")).toBeInTheDocument();
    expect(screen.getByText("65% PJ · 35% PF")).toBeInTheDocument();
  });

  it("ajusta o percentual via botões delta (+5%, -10%)", async () => {
    const user = userEvent.setup();
    const { onSplitPFPJBusinessPercentChange } = setup({ splitPFPJBusinessPercent: 60 });

    await user.click(screen.getByRole("button", { name: "+5%" }));
    expect(onSplitPFPJBusinessPercentChange).toHaveBeenCalledWith(65);

    await user.click(screen.getByRole("button", { name: "-10%" }));
    expect(onSplitPFPJBusinessPercentChange).toHaveBeenCalledWith(50);
  });

  it("permite definir cota em reais e calcula percentual correspondente", () => {
    // Total: R$ 100,00 (10000 cents). Se PJ = R$ 40,00 (4000 cents) => 40%
    const { onSplitPFPJBusinessPercentChange } = setup({
      valueCents: 10000,
      splitPFPJBusinessPercent: 50,
    });

    // Clica em personalizado para abrir
    fireEvent.click(screen.getByRole("radio", { name: /Personalizado/i }));

    const moneyInput = screen.getByLabelText("Cota do negócio em reais");
    expect(moneyInput).toBeInTheDocument();

    // Simula alteração do valor no MoneyInput (digita 4000)
    fireEvent.change(moneyInput, { target: { value: "4000" } });
    expect(onSplitPFPJBusinessPercentChange).toHaveBeenCalledWith(40);
  });

  it("exibe cards de Parcela Pessoal e Negócio com valores monetários e percentuais exatos", () => {
    setup({
      valueCents: 20000, // R$ 200,00
      splitPFPJBusinessPercent: 65,
    });

    expect(screen.getByText("Parcela Pessoal (PF)")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();

    expect(screen.getByText("Parcela Negócio (PJ)")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });
});
