import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SplitPreviewMockupCard } from "./split-preview-mockup-card";

describe("SplitPreviewMockupCard — Apresentação Didática e Mockup Estático de Racha (§Plano 11)", () => {
  it("renderiza cabeçalho, badge demonstrativo, valores e chave Pix didática", () => {
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
    expect(screen.getByText(/Cobrança organizada por/i)).toBeInTheDocument();
    expect(screen.getByText("Gabriel (Demonstração)")).toBeInTheDocument();
    expect(screen.getByText("pix.demo@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText(/Cada um paga \(4 pessoas\)/i)).toBeInTheDocument();
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

    const copyBtn = screen.getByRole("button", { name: "Copiar Chave Pix" });
    const shareBtn = screen.getByRole("button", { name: "Compartilhar Link" });

    await user.click(copyBtn);
    expect(handleCopy).toHaveBeenCalledTimes(1);

    await user.click(shareBtn);
    expect(handleShare).toHaveBeenCalledTimes(1);
  });
});
