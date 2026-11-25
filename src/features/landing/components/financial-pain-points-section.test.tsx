import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FinancialPainPointsSection } from "./financial-pain-points-section";

describe("FinancialPainPointsSection", () => {
  it("inicia no cenário de Caixa Real e permite marcar/desmarcar compromissos", async () => {
    const user = userEvent.setup();
    render(<FinancialPainPointsSection />);

    expect(screen.getByTestId("pain-preview-cash")).toBeInTheDocument();
    expect(screen.getByText("Simulador de Caixa Real Seguro")).toBeInTheDocument();

    const invoiceCheckbox = screen.getByRole("checkbox", {
      name: /Fatura aberta do cartão/i,
    });
    expect(invoiceCheckbox).toHaveAttribute("aria-checked", "true");

    await user.click(invoiceCheckbox);
    expect(invoiceCheckbox).toHaveAttribute("aria-checked", "false");
  });

  it("permite alternar entre os 6 cenários financeiros e interagir com cada widget", async () => {
    const user = userEvent.setup();
    const onExploreInvestments = vi.fn();
    render(<FinancialPainPointsSection onExploreInvestments={onExploreInvestments} />);

    // 2. Captura sem fricção + aprovação de despesa
    await user.click(screen.getByRole("tab", { name: /Captura com IA/i }));
    expect(screen.getByTestId("pain-preview-capture")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Aprovar Despesa/i }));
    expect(screen.getByText("Lançamento confirmado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aprovada \(desfazer\)/i })).toBeInTheDocument();

    // 3. Separação PF & PJ (Modo Negócio)
    await user.click(screen.getByRole("tab", { name: /PF & PJ/i }));
    expect(screen.getByTestId("pain-preview-business")).toBeInTheDocument();

    // 3. Parcelas, Contas a Receber & Dívidas (Price / SAC)
    await user.click(screen.getByRole("tab", { name: /Parcelas & Dívidas/i }));
    expect(screen.getByTestId("pain-preview-debts")).toBeInTheDocument();
    expect(screen.getByText(/A Receber \(racha e empréstimos\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Price / SAC" }));
    expect(screen.getByText(/Financiamento · Tabela SAC/i)).toBeInTheDocument();
    expect(screen.getByText("5 meses a menos")).toBeInTheDocument();

    // 4. Casal & Amigos (SharedFinancesShowcase)
    await user.click(screen.getByRole("tab", { name: /Casal & Amigos/i }));
    expect(screen.getByTestId("card-racha")).toBeInTheDocument();

    // 5. Onde aportar -> CTA para aprofundar em Investimentos
    await user.click(screen.getByRole("tab", { name: /Onde aportar/i }));
    expect(screen.getByTestId("pain-preview-invest")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Explorar ferramentas completas/i }));
    expect(onExploreInvestments).toHaveBeenCalledTimes(1);
  });
});
