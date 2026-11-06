import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaceAlertBanner } from "./pace-alert-banner";

describe("PaceAlertBanner (§3.8)", () => {
  it("renderiza o banner com aviso de ritmo acelerado quando não há déficit projetado", async () => {
    const user = userEvent.setup();
    const onNavigateInsights = vi.fn();

    render(
      <PaceAlertBanner
        spentPercent={75}
        elapsedPercent={50}
        dailyCents={5000}
        daysRemaining={15}
        surplusCents={20000}
        onNavigateInsights={onNavigateInsights}
      />,
    );

    expect(screen.getByText("Ritmo de gastos acima do previsto")).toBeInTheDocument();
    expect(screen.getByText("Fora do trilho")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const text = element?.textContent ?? "";
        return (
          element?.tagName.toLowerCase() === "p" &&
          text.includes("Consumido 75% do orçamento") &&
          text.includes("50% do mês decorrido")
        );
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === "span" &&
          Boolean(element?.textContent?.includes("50,00"))
        );
      }),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Simular cortes e projeção/i });
    await user.click(button);
    expect(onNavigateInsights).toHaveBeenCalledTimes(1);
  });

  it("renderiza o banner com alerta crítico quando há déficit projetado", () => {
    render(
      <PaceAlertBanner
        spentPercent={85}
        elapsedPercent={60}
        dailyCents={0}
        daysRemaining={12}
        surplusCents={-40000}
        onNavigateInsights={vi.fn()}
      />,
    );

    expect(screen.getByText("Projeção de déficit no mês")).toBeInTheDocument();
    expect(screen.getByText("Fora do trilho")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const text = element?.textContent ?? "";
        return (
          element?.tagName.toLowerCase() === "p" &&
          text.includes("Consumido 85% do orçamento") &&
          text.includes("60% do mês decorrido")
        );
      }),
    ).toBeInTheDocument();
  });
});
