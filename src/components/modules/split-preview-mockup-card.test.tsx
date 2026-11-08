import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SplitPreviewMockupCard } from "./split-preview-mockup-card";

describe("SplitPreviewMockupCard — Apresentação Didática com Paridade ao Link Compartilhado (§Plano 11)", () => {
  it("renderiza cabeçalho fiel, badge demonstrativo, valores, participantes e chave Pix", () => {
    render(
      <SplitPreviewMockupCard
        totalCents={48000}
        peopleCount={4}
        description="Churrasco com Amigos"
        pixKey="pix.demo@exemplo.com"
        merchantName="Gabriel (Demonstração)"
      />,
    );

    expect(screen.getByText("Churrasco com Amigos")).toBeInTheDocument();
    expect(screen.getByText("Exemplo Demonstrativo")).toBeInTheDocument();
    expect(screen.getByText("Despesa Compartilhada")).toBeInTheDocument();
    expect(screen.getByText(/Por:/i)).toBeInTheDocument();
    expect(screen.getAllByText("Gabriel (Demonstração)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4 participantes")).toBeInTheDocument();
    expect(screen.getByText("Sua parte a pagar")).toBeInTheDocument();
    expect(screen.getByText(/Valor total da conta: R\$ 480,00/i)).toBeInTheDocument();
    expect(screen.getByText("pix.demo@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Divisão entre os participantes")).toBeInTheDocument();
  });

  it("aciona callbacks de cópia e compartilhamento quando fornecidos", async () => {
    const user = userEvent.setup();
    const handleCopy = vi.fn();
    const handleShare = vi.fn();

    render(
      <SplitPreviewMockupCard
        onCopyClick={handleCopy}
        onShareClick={handleShare}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar código Pix no valor de/i });
    const shareBtn = screen.getByRole("button", { name: /Compartilhar Link do Racha/i });

    await user.click(copyBtn);
    expect(handleCopy).toHaveBeenCalledTimes(1);

    await user.click(shareBtn);
    expect(handleShare).toHaveBeenCalledTimes(1);
  });
});
