import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SplitChargeCard } from "./split-charge-card";
import * as toastService from "@/services/toast";

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("SplitChargeCard — Card Canônico de Cobrança Compartilhada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    title: "Churrasco de Confraternização",
    date: "2026-11-08",
    hostName: "Gabriel Sales",
    peopleCount: 4,
    totalCents: 48000,
    guestShareCents: 12000,
    pixBrCode: "00020126580014BR.GOV.BCB.PIX0119gabriel@exemplo.com",
    pixKey: "gabriel@exemplo.com",
    pixKeyType: "E-mail",
    participants: [
      { name: "Gabriel Sales", is_host: true, share_cents: 12000 },
      { name: "Lucas", is_host: false, share_cents: 12000 },
      { name: "Mateus", is_host: false, share_cents: 12000 },
      { name: "Ana", is_host: false, share_cents: 12000 },
    ],
  };

  it("renderiza todos os blocos com fidelidade estética ao link de compartilhamento", () => {
    render(<SplitChargeCard {...baseProps} isDemo={true} />);

    expect(screen.getByText("Churrasco de Confraternização")).toBeInTheDocument();
    expect(screen.getByText("Despesa Compartilhada")).toBeInTheDocument();
    expect(screen.getByText("Exemplo Demonstrativo")).toBeInTheDocument();
    expect(screen.getByText("08/11/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Gabriel Sales").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4 participantes")).toBeInTheDocument();

    // Bloco Hero
    expect(screen.getByText("Sua parte a pagar")).toBeInTheDocument();
    expect(screen.getByText(/Valor total da conta: R\$ 480,00/i)).toBeInTheDocument();

    // Participantes
    expect(screen.getByText("Divisão entre os participantes")).toBeInTheDocument();
    expect(screen.getByText("Anfitrião")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Mateus")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("copia código Pix e exibe feedback de sucesso", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    render(<SplitChargeCard {...baseProps} />);

    const copyBtn = screen.getByRole("button", {
      name: /Copiar código Pix no valor de/i,
    });
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(baseProps.pixBrCode);
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Código Pix copiado!",
        variant: "success",
      }),
    );
    expect(screen.getByText("Código Pix Copiado!")).toBeInTheDocument();
  });

  it("permite alternar exibição do QR Code e copiar a chave Pix direta", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    render(<SplitChargeCard {...baseProps} defaultShowQrCode={false} />);

    // Inicialmente QR Code oculto
    expect(screen.queryByText(/Abra o app do seu banco/i)).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: "Exibir QR Code Pix" });
    await user.click(toggleBtn);

    // Agora visível
    expect(screen.getByText(/Abra o app do seu banco/i)).toBeInTheDocument();
    expect(screen.getByText("gabriel@exemplo.com")).toBeInTheDocument();

    const copyKeyBtn = screen.getByRole("button", { name: "Copiar chave Pix diretamente" });
    await user.click(copyKeyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith("gabriel@exemplo.com");
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Chave Pix copiada!",
      }),
    );
  });
});
