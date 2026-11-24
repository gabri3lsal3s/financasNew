import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildPaceProjectionBreakdown } from "@/domain/calculation-memory";
import { PaceAlertBanner } from "./pace-alert-banner";

describe("PaceAlertBanner (§3.8 / Fase 3)", () => {
  it("renderiza o banner com tom consultivo quando ritmo está acelerado sem déficit", async () => {
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

    expect(screen.getByText("Ritmo acima do planejado")).toBeInTheDocument();
    expect(screen.getByText("Ritmo acelerado")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const text = element?.textContent ?? "";
        return (
          element?.tagName.toLowerCase() === "p" &&
          text.includes("Você utilizou 75% da referência mensal") &&
          text.includes("50% do mês")
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

  it("renderiza selo transparente de base provisória e botão (?) de Memória de Cálculo quando déficit é projetado", () => {
    const breakdown = buildPaceProjectionBreakdown({
      month: "2026-08",
      referenceBudgetCents: 600000,
      referenceBudgetSource: "expected_income",
      isProvisionalReference: true,
      fixedPaidCents: 220000,
      pendingFixedCents: 30000,
      oneOffAndTripCents: 0,
      projectedVariableCents: 390000,
      projectedSurplusCents: -40000,
      dailyCents: 0,
      dayOfMonth: 18,
      daysInMonth: 31,
    });

    render(
      <PaceAlertBanner
        spentPercent={85}
        elapsedPercent={60}
        dailyCents={0}
        daysRemaining={12}
        surplusCents={-40000}
        isProvisionalReference
        referenceBudgetSource="expected_income"
        calculationBreakdown={breakdown}
        onNavigateInsights={vi.fn()}
      />,
    );

    expect(screen.getByText("Projeção pede ajuste no mês")).toBeInTheDocument();
    expect(screen.getByText("Atenção ao ritmo")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const text = element?.textContent ?? "";
        return (
          element?.tagName.toLowerCase() === "p" &&
          text.includes("85% da renda habitual prevista") &&
          text.includes("Orçamento mensal atingido.")
        );
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver memória de cálculo: Memória do cálculo do ritmo de gastos|Memória de cálculo do ritmo de gastos/i }),
    ).toBeInTheDocument();
  });

  it("não renderiza nada quando não há base válida (guarda defensiva anti-500000%)", () => {
    const { container } = render(
      <PaceAlertBanner
        spentPercent={0}
        elapsedPercent={77}
        dailyCents={null}
        daysRemaining={9}
        surplusCents={null}
        onNavigateInsights={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
