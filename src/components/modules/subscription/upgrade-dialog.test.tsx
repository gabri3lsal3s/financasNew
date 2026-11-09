import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpgradeDialog } from "./upgrade-dialog";
import type { SubscriptionStatus } from "@/types";

let mockSubscription: Partial<SubscriptionStatus> = {
  isTrial: true,
  trialDaysRemaining: 20,
};

vi.mock("@/state", () => ({
  useUserSubscription: () => mockSubscription,
}));

describe("UpgradeDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscription = {
      isTrial: true,
      trialDaysRemaining: 20,
    };
  });

  it("renderiza o modal aberto com título padrão e os 4 pilares das novas funcionalidades", () => {
    render(
      <UpgradeDialog
        open={true}
        onOpenChange={vi.fn()}
        onProceedToCheckout={vi.fn()}
      />,
    );

    expect(screen.getByText("Ativar Plano Pro")).toBeInTheDocument();
    expect(screen.getByText("Leitor OCR de Cupons & Notas Fiscais")).toBeInTheDocument();
    expect(screen.getByText("Multi-Cartões & Parcelas em até 60x")).toBeInTheDocument();
    expect(screen.getByText("Previsibilidade & Safe-to-Spend Diário")).toBeInTheDocument();
    expect(screen.getByText("Espaço Família & Viagens")).toBeInTheDocument();
    expect(screen.getByText(/Apenas R\$\s*0,39 por dia/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,00 cobrados hoje/i)).toBeInTheDocument();
  });

  it("renderiza título customizado quando fornecido via prop context", () => {
    render(
      <UpgradeDialog
        open={true}
        context="Desbloquear Leitor Inteligente"
        onOpenChange={vi.fn()}
        onProceedToCheckout={vi.fn()}
      />,
    );

    expect(screen.getByText("Desbloquear Leitor Inteligente")).toBeInTheDocument();
  });

  it("alterna entre o plano anual e o plano mensal", () => {
    render(
      <UpgradeDialog
        open={true}
        onOpenChange={vi.fn()}
        onProceedToCheckout={vi.fn()}
      />,
    );

    const monthlyButton = screen.getByRole("button", { name: "Mensal" });
    fireEvent.click(monthlyButton);

    expect(screen.getByText(/19,99/i)).toBeInTheDocument();
    expect(screen.queryByText(/Apenas R\$\s*0,39 por dia/i)).not.toBeInTheDocument();

    const annualButton = screen.getByRole("button", { name: /Anual/i });
    fireEvent.click(annualButton);

    expect(screen.getByText(/11,99/i)).toBeInTheDocument();
    expect(screen.getByText(/Apenas R\$\s*0,39 por dia/i)).toBeInTheDocument();
  });

  it("aciona onProceedToCheckout com o plano selecionado ao clicar no botão de confirmação", () => {
    const handleCheckout = vi.fn();
    render(
      <UpgradeDialog
        open={true}
        onOpenChange={vi.fn()}
        onProceedToCheckout={handleCheckout}
      />,
    );

    const ctaButton = screen.getByRole("button", { name: /Continuar para Pagamento Seguro/i });
    fireEvent.click(ctaButton);

    expect(handleCheckout).toHaveBeenCalledWith("annual");
  });

  it("aciona onOpenChange(false) ao clicar em Agora não", () => {
    const handleOpenChange = vi.fn();
    render(
      <UpgradeDialog
        open={true}
        onOpenChange={handleOpenChange}
        onProceedToCheckout={vi.fn()}
      />,
    );

    const dismissButton = screen.getByRole("button", { name: /Agora não/i });
    fireEvent.click(dismissButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
