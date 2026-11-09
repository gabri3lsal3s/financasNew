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

  it("renderiza seletor de parcelas e permite alternar para quitar todas juntas quando despesa parcelada", async () => {
    const user = userEvent.setup();
    const onSelectInstallmentId = vi.fn();
    const onTogglePayAllRemaining = vi.fn();

    const mockInstallments = [
      {
        id: "p_guest_inst_1",
        participant_id: "p_guest",
        installment_number: 1,
        total_installments: 3,
        amount_cents: 4000,
        due_date: "2026-11-10",
        is_settled: true,
        settled_at: "2026-11-10T10:00:00Z",
      },
      {
        id: "p_guest_inst_2",
        participant_id: "p_guest",
        installment_number: 2,
        total_installments: 3,
        amount_cents: 4000,
        due_date: "2026-12-10",
        is_settled: false,
        settled_at: null,
      },
      {
        id: "p_guest_inst_3",
        participant_id: "p_guest",
        installment_number: 3,
        total_installments: 3,
        amount_cents: 4000,
        due_date: "2027-01-10",
        is_settled: false,
        settled_at: null,
      },
    ];

    render(
      <SplitChargeCard
        {...baseProps}
        installmentsCount={3}
        installments={mockInstallments}
        selectedInstallmentId="p_guest_inst_2"
        onSelectInstallmentId={onSelectInstallmentId}
        onTogglePayAllRemaining={onTogglePayAllRemaining}
      />
    );

    // Deve exibir o cabeçalho de parcelas
    expect(screen.getByText(/Parcelas \(1\/3 pagas\)/i)).toBeInTheDocument();
    expect(screen.getByText("Quitar todas pendentes")).toBeInTheDocument();

    // Deve exibir cada uma das 3 parcelas
    expect(screen.getByText("Parcela 1/3")).toBeInTheDocument();
    expect(screen.getByText("Paga")).toBeInTheDocument();

    expect(screen.getByText("Parcela 2/3")).toBeInTheDocument();
    expect(screen.getByText("Selecionada")).toBeInTheDocument();

    expect(screen.getByText("Parcela 3/3")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();

    // Clica na parcela 3 pendente
    const parcela3Btn = screen.getByText("Parcela 3/3").closest("button")!;
    await user.click(parcela3Btn);
    expect(onSelectInstallmentId).toHaveBeenCalledWith("p_guest_inst_3");

    // Clica no toggle de quitar todas
    const payAllBtn = screen.getByText("Quitar todas pendentes");
    await user.click(payAllBtn);
    expect(onTogglePayAllRemaining).toHaveBeenCalled();
  });

  it("renderiza layout split-desktop com coluna Pix dedicada e suporte a 6 parcelas com scroll", () => {
    const mockSixInstallments = Array.from({ length: 6 }, (_, idx) => ({
      id: `inst_${idx + 1}`,
      participant_id: "p_guest",
      installment_number: idx + 1,
      total_installments: 6,
      amount_cents: 2000,
      due_date: `2026-${String(idx + 1).padStart(2, "0")}-10`,
      is_settled: idx < 2,
      settled_at: idx < 2 ? "2026-01-10T10:00:00Z" : null,
    }));

    render(
      <SplitChargeCard
        {...baseProps}
        layout="split-desktop"
        installmentsCount={6}
        installments={mockSixInstallments}
        selectedInstallmentId="inst_3"
        desktopExtraContent={<div data-testid="extra-content">Banner Onboarding</div>}
      />
    );

    // Deve exibir o badge de EMV do Pix
    expect(screen.getByText("BACEN EMV")).toBeInTheDocument();
    expect(screen.getByTestId("extra-content")).toBeInTheDocument();

    // Deve exibir as parcelas
    expect(screen.getByText("Parcela 1/6")).toBeInTheDocument();
    expect(screen.getByText("Parcela 6/6")).toBeInTheDocument();
    expect(screen.getByText(/Parcelas \(2\/6 pagas\)/i)).toBeInTheDocument();
  });
});

