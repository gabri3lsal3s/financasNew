import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AporteCockpitCommandCard } from "./aporte-cockpit-command-card";

describe("AporteCockpitCommandCard", () => {
  it("renderiza corretamente com aporte R$ 0,00 e caixa desligado", () => {
    render(
      <AporteCockpitCommandCard
        aporteCents={0}
        onAporteCentsChange={vi.fn()}
        availableCashCents={150000}
        useBrokerageCash={false}
        onToggleBrokerageCash={vi.fn()}
        effectiveCashSelectedCents={0}
        onCashSelectedChange={vi.fn()}
        onUseOnlyCash={vi.fn()}
        effectiveTotalAllocated={0}
        effectiveLeftover={0}
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

    expect(screen.getByLabelText("Valor do aporte")).toBeInTheDocument();
    expect(screen.getByText("Somar saldo em Caixa da corretora")).toBeInTheDocument();
    expect(screen.getByText("Usar apenas o Caixa")).toBeInTheDocument();

    // Síntese
    expect(screen.getByText("Aporte informado")).toBeInTheDocument();
    expect(screen.getByText("Alocado em ativos")).toBeInTheDocument();
    expect(screen.getByText("Sobra para caixa")).toBeInTheDocument();

    // Chips
    expect(screen.getByText("6.2")).toBeInTheDocument();
    expect(screen.getByText("18.5%")).toBeInTheDocument();
  });

  it("revela o input de caixa quando o switch estiver ligado", () => {
    const onToggle = vi.fn();
    render(
      <AporteCockpitCommandCard
        aporteCents={50000}
        onAporteCentsChange={vi.fn()}
        availableCashCents={150000}
        useBrokerageCash={true}
        onToggleBrokerageCash={onToggle}
        effectiveCashSelectedCents={100000}
        onCashSelectedChange={vi.fn()}
        onUseOnlyCash={vi.fn()}
        effectiveTotalAllocated={1480}
        effectiveLeftover={20}
      />,
    );

    expect(screen.getByLabelText("Saldo em caixa utilizado")).toBeInTheDocument();
    expect(screen.getByText("Bolso:")).toBeInTheDocument();
  });

  it("exibe o botão Overflow Ledger e aciona callback ao clicar", () => {
    const onOpenLedger = vi.fn();
    render(
      <AporteCockpitCommandCard
        aporteCents={50000}
        onAporteCentsChange={vi.fn()}
        availableCashCents={0}
        useBrokerageCash={false}
        onToggleBrokerageCash={vi.fn()}
        effectiveCashSelectedCents={0}
        onCashSelectedChange={vi.fn()}
        onUseOnlyCash={vi.fn()}
        effectiveTotalAllocated={500}
        effectiveLeftover={0}
        overflowEventsCount={3}
        onOpenOverflowLedger={onOpenLedger}
      />,
    );

    const btn = screen.getByRole("button", { name: /Overflow Ledger/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onOpenLedger).toHaveBeenCalledTimes(1);
  });
});
