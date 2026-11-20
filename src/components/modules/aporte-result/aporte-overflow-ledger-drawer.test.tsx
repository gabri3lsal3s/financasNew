import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AporteOverflowLedgerDrawer } from "./aporte-overflow-ledger-drawer";
import type { AporteOverflowEvent, PausedAssetDiagnostic } from "@/domain/portfolio";

describe("AporteOverflowLedgerDrawer (Fase 6)", () => {
  it("renderiza empty state calmo quando não há eventos de overflow", () => {
    render(
      <AporteOverflowLedgerDrawer
        open={true}
        onOpenChange={vi.fn()}
        overflowEvents={[]}
        pausedAssets={[]}
        totalAllocatedBRL={1000}
        leftoverBRL={0}
      />,
    );

    expect(screen.getByText("Trilha de Decisão & Overflow Ledger")).toBeInTheDocument();
    expect(screen.getByText("Alocação Direta sem Transbordamento")).toBeInTheDocument();
    expect(screen.getByText("0 eventos")).toBeInTheDocument();
  });

  it("renderiza eventos de overflow com badges de saturação e valores", () => {
    const overflowEvents: AporteOverflowEvent[] = [
      {
        type: "sector_saturated",
        sourceId: "Bancos",
        sourceLabel: "Setor Bancos",
        targetId: "Energia",
        targetLabel: "Setor Energia",
        amountBRL: 450,
        reason: "Teto setorial de 35% na classe Ações atingido. Excedente transferido para o próximo setor deficitário.",
      },
    ];

    const pausedAssets: PausedAssetDiagnostic[] = [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        reason: "asset_ceiling",
        currentValueBRL: 15000,
        targetValueBRL: 10000,
        detail: "Concentração atual de 16.5% excede o teto individual de 15%.",
      },
    ];

    render(
      <AporteOverflowLedgerDrawer
        open={true}
        onOpenChange={vi.fn()}
        overflowEvents={overflowEvents}
        pausedAssets={pausedAssets}
        totalAllocatedBRL={2000}
        leftoverBRL={50}
      />,
    );

    expect(screen.getByText("Setor Bancos")).toBeInTheDocument();
    expect(screen.getByText("Setor Energia")).toBeInTheDocument();
    expect(screen.getByText("Teto Setorial")).toBeInTheDocument();
    expect(screen.getByText(/Excedente transferido/)).toBeInTheDocument();

    // Ativos pausados
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("Teto Individual (15%)")).toBeInTheDocument();
  });

  it("dispara onOpenChange(false) ao clicar no botão de concluir leitura", () => {
    const handleClose = vi.fn();
    render(
      <AporteOverflowLedgerDrawer
        open={true}
        onOpenChange={handleClose}
        overflowEvents={[]}
        pausedAssets={[]}
        totalAllocatedBRL={1000}
        leftoverBRL={0}
      />,
    );

    const btn = screen.getByRole("button", { name: "Concluir Leitura" });
    fireEvent.click(btn);
    expect(handleClose).toHaveBeenCalledWith(false);
  });
});
