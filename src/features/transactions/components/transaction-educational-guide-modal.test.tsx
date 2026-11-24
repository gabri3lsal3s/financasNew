import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionEducationalGuideModal } from "./transaction-educational-guide-modal";

vi.mock("@/state", () => ({
  useUpdateCustomSettings: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-visual-customization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-visual-customization")>();
  return {
    ...actual,
    useVisualCustomization: () => ({
      showEducationalPlaybooks: true,
      dismissedPlaybookKeys: [],
      dismissPlaybook: vi.fn(),
      setShowEducationalPlaybooks: vi.fn(),
      isPlaybookVisible: vi.fn(() => true),
    }),
  };
});

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("TransactionEducationalGuideModal", () => {
  it("renderiza o modal com as 4 abas pedagógicas", () => {
    render(
      <TransactionEducationalGuideModal
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Guia de Lançamentos & Gestão de Cartões")).toBeInTheDocument();
    expect(screen.getByText("Rotina Ideal")).toBeInTheDocument();
    expect(screen.getByText("Comece de Hoje")).toBeInTheDocument();
    expect(screen.getByText("Categoria × Descrição")).toBeInTheDocument();
    expect(screen.getByText("Cartão Desmistificado")).toBeInTheDocument();
  });

  it("permite responder ao quiz e acionar o CTA de recomendação", () => {
    const mockOpenImport = vi.fn();
    render(
      <TransactionEducationalGuideModal
        open={true}
        onOpenChange={vi.fn()}
        onOpenImport={mockOpenImport}
      />,
    );

    // Passo 1: Frequência
    const weeklyOption = screen.getByText("Uma vez por semana (Final de semana)");
    fireEvent.click(weeklyOption);

    // Passo 2: Pagamento
    const cardOption = screen.getByText("Quase tudo no Cartão de Crédito");
    fireEvent.click(cardOption);

    // Passo 3: Resultado e CTA
    expect(screen.getByText("Rotina Inteligente via Fatura")).toBeInTheDocument();
    const ctaButton = screen.getByText("Importar Fatura Agora");
    expect(ctaButton).toBeInTheDocument();

    fireEvent.click(ctaButton);
    expect(mockOpenImport).toHaveBeenCalled();
  });
});
