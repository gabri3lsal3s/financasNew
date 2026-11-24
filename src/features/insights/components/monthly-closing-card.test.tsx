import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthlyClosingCard } from "./monthly-closing-card";

describe("MonthlyClosingCard (Fase 6)", () => {
  it("renderiza resultado real, conquista e permite aplicar ajuste de teto em 1 toque ou dispensar", () => {
    const onDismiss = vi.fn();
    const onApplyLimit = vi.fn();

    render(
      <MonthlyClosingCard
        summary={{
          closedMonth: "2026-10",
          incomeCents: 500_000,
          expenseCents: 300_000,
          balanceCents: 200_000,
          savingsRatePercent: 40,
          highlightAchievement: "Você poupou 40% da renda no mês encerrado.",
          limitSuggestions: [
            {
              categoryId: "c1",
              name: "Lazer",
              icon: "lazer",
              kind: "increase",
              currentLimitCents: 40_000,
              suggestedLimitCents: 60_000,
              reason: "Estourou o limite (excesso de R$ 200).",
            },
          ],
        }}
        onDismiss={onDismiss}
        onApplyLimit={onApplyLimit}
      />,
    );

    expect(screen.getByText(/Fechamento de Out/i)).toBeInTheDocument();
    expect(screen.getByText(/Você poupou 40%/)).toBeInTheDocument();
    expect(screen.getByText("Lazer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Aplicar teto/i }));
    expect(onApplyLimit).toHaveBeenCalledWith("c1", 60_000, "Lazer");

    fireEvent.click(screen.getByRole("button", { name: /Dispensar resumo/i }));
    expect(onDismiss).toHaveBeenCalledWith("2026-10");
  });
});
