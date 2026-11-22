import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AporteCockpitCommandCard } from "./aporte-cockpit-command-card";

describe("AporteCockpitCommandCard", () => {
  it("renderiza corretamente com aporte R$ 0,00 e caixa desligado", () => {
    render(
      <MemoryRouter>
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
        />
      </MemoryRouter>,
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
      <MemoryRouter>
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
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Saldo em caixa utilizado")).toBeInTheDocument();
    expect(screen.getByText("Bolso:")).toBeInTheDocument();
  });

  it("exibe o botão Overflow Ledger e aciona callback ao clicar", () => {
    const onOpenLedger = vi.fn();
    render(
      <MemoryRouter>
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
        />
      </MemoryRouter>,
    );

    const btn = screen.getByRole("button", { name: /Overflow Ledger/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onOpenLedger).toHaveBeenCalledTimes(1);
  });

  it("abre a memória de cálculo do aporte e exibe a decomposição hierárquica", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AporteCockpitCommandCard
          aporteCents={100000}
          onAporteCentsChange={vi.fn()}
          availableCashCents={20000}
          useBrokerageCash={true}
          onToggleBrokerageCash={vi.fn()}
          effectiveCashSelectedCents={20000}
          onCashSelectedChange={vi.fn()}
          onUseOnlyCash={vi.fn()}
          effectiveTotalAllocated={1180}
          effectiveLeftover={20}
          classSummaries={[
            {
              className: "Ações Brasil",
              targetPct: 50,
              targetValueBRL: 50000,
              currentValueBRL: 40000,
              gapBRL: 10000,
              budgetAllocatedBRL: 1180,
              actualAllocatedBRL: 1180,
            },
          ]}
          skippedAssets={[
            {
              assetId: "1",
              ticker: "VALE3",
              assetClass: "Ações",
              reason: "price_exceeds_budget",
            },
          ]}
        />
      </MemoryRouter>,
    );

    const memoryBtn = screen.getByRole("button", { name: /Ver memória de cálculo/i });
    expect(memoryBtn).toBeInTheDocument();

    await user.click(memoryBtn);
    expect(await screen.findByRole("heading", { name: "Distribuição e Engenharia do Aporte" })).toBeInTheDocument();
    expect(screen.getByText(/Dinheiro Novo do Bolso/i)).toBeInTheDocument();
    expect(screen.getByText(/Saldo em Caixa da Corretora Aproveitado/i)).toBeInTheDocument();
    expect(screen.getByText(/Alocação na Classe: Ações Brasil/i)).toBeInTheDocument();
    expect(screen.getByText(/Sobra Não Alocada/i)).toBeInTheDocument();
  });

  it("renderiza o controle de sensibilidade ao Preço Teto e dispara callback na troca", async () => {
    const user = userEvent.setup();
    const onCeilingSensitivityChange = vi.fn();

    render(
      <MemoryRouter>
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
          ceilingSensitivity="balanced"
          onCeilingSensitivityChange={onCeilingSensitivityChange}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preço Teto / Valuation")).toBeInTheDocument();
    const strictBtn = screen.getByRole("button", { name: "Oportunidade Estrita" });
    await user.click(strictBtn);

    expect(onCeilingSensitivityChange).toHaveBeenCalledWith("strict_opportunity");
  });
});
