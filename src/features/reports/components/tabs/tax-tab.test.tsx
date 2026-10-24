import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaxTab } from "./tax-tab";
import { OFFICIAL_TAX_DISCLAIMER } from "@/lib/institutional";
import type { ExcelWorkbookData } from "@/services/excel-export";

const mockWorkbookData: ExcelWorkbookData = {
  appName: "Áxis Finance",
  summary: {
    totalPatrimonyBRL: 100000,
    totalInvestedCostBRL: 80000,
    unrealizedPnlBRL: 20000,
    unrealizedPnlPct: 25,
    cashBalanceBRL: 10000,
    yearDividendsBRL: 5000,
    freedomPct: 50,
    savingsRatePct: 30,
  },
  positions: [],
  dividends: [],
  dreMonthly: [],
  debts: [],
};

describe("features/reports/components/tabs/TaxTab", () => {
  it("renderiza os cards de IRPF, DARF, exportação Excel e o aviso de responsabilidade fiscal/CFC/RFB", () => {
    render(
      <TaxTab
        workbookData={mockWorkbookData}
        excelDescription="Exportação completa das abas de Investimentos e Finanças"
        onOpenTaxReport={vi.fn()}
        onOpenDarfMonitor={vi.fn()}
      />,
    );

    expect(screen.getByText("Facilitador de Declaração de IRPF")).toBeInTheDocument();
    expect(screen.getByText("Monitor Mensal de DARF & Isenção de R$ 20k")).toBeInTheDocument();
    expect(screen.getByText("Aviso de Responsabilidade Tributária e Fiscal")).toBeInTheDocument();
    expect(screen.getByText(OFFICIAL_TAX_DISCLAIMER)).toBeInTheDocument();
  });

  it("aciona os callbacks de abertura ao clicar nos botões", async () => {
    const user = userEvent.setup();
    const handleOpenTax = vi.fn();
    const handleOpenDarf = vi.fn();

    render(
      <TaxTab
        workbookData={mockWorkbookData}
        excelDescription="Exportação teste"
        onOpenTaxReport={handleOpenTax}
        onOpenDarfMonitor={handleOpenDarf}
      />,
    );

    const taxBtn = screen.getByRole("button", { name: /Abrir Fichas de IRPF/i });
    await user.click(taxBtn);
    expect(handleOpenTax).toHaveBeenCalledTimes(1);

    const darfBtn = screen.getByRole("button", { name: /Abrir Monitor DARF/i });
    await user.click(darfBtn);
    expect(handleOpenDarf).toHaveBeenCalledTimes(1);
  });
});
