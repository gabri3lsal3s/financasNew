import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteTripMemberDialog } from "./invite-trip-member-dialog";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("InviteTripMemberDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renderiza o link de convite e botões de compartilhamento", () => {
    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        destination="Ubatuba"
        publicToken="token-ubatuba-123"
      />
    );

    expect(screen.getByText("Convidar para a Viagem")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/viagem\/token-ubatuba-123/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exibir QR Code/i })).toBeInTheDocument();
  });

  it("copia o link de convite para a área de transferência ao clicar em Copiar", async () => {
    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        publicToken="token-ubatuba-123"
      />
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("viagem/token-ubatuba-123")
    );
    await waitFor(() => {
      expect(screen.getByText("Copiado")).toBeInTheDocument();
    });
  });

  it("abre o WhatsApp com a mensagem formatada de convite", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        destination="Ubatuba"
        publicToken="token-ubatuba-123"
      />
    );

    const whatsappBtn = screen.getByRole("button", { name: /WhatsApp/i });
    fireEvent.click(whatsappBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("api.whatsapp.com/send?text="),
      "_blank",
      expect.anything()
    );
  });

  it("alterna a exibição do QR Code na tela", () => {
    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        publicToken="token-ubatuba-123"
      />
    );

    const qrToggleBtn = screen.getByRole("button", { name: /Exibir QR Code/i });
    fireEvent.click(qrToggleBtn);

    expect(screen.getByText(/Aponte a camera do celular para entrar no grupo da viagem/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ocultar QR/i }));
    expect(screen.queryByText(/Aponte a camera do celular para entrar no grupo da viagem/i)).not.toBeInTheDocument();
  });

  it("exibe aviso de link encerrado quando a viagem está finalizada", () => {
    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        publicToken="token-ubatuba-123"
        isCompleted={true}
      />
    );

    expect(screen.getByText(/Link de compartilhamento encerrado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar/i })).not.toBeInTheDocument();
  });

  it("chama onOpenAddDirectMember ao clicar em Adicionar Manualmente", () => {
    const addDirectMock = vi.fn();
    const openChangeMock = vi.fn();

    render(
      <InviteTripMemberDialog
        open={true}
        onOpenChange={openChangeMock}
        tripId="trip-1"
        tripTitle="Praia de Ubatuba"
        publicToken="token-ubatuba-123"
        onOpenAddDirectMember={addDirectMock}
      />
    );

    const manualBtn = screen.getByRole("button", { name: /Adicionar Manualmente/i });
    fireEvent.click(manualBtn);

    expect(openChangeMock).toHaveBeenCalledWith(false);
    expect(addDirectMock).toHaveBeenCalled();
  });
});
