import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as nativeModule from "@/services/native";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";
import { PasteReceiptDialog } from "./paste-receipt-dialog";

describe("PasteReceiptDialog — Área de Colar Comprovante / Notificação (§4.2)", () => {
  const onOpenChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza conteúdo quando open é false", () => {
    render(<PasteReceiptDialog open={false} onOpenChange={onOpenChangeMock} />);
    expect(screen.queryByText("Colar Comprovante ou Notificação")).not.toBeInTheDocument();
  });

  it("renderiza diálogo com título, textarea e botões quando open é true", () => {
    render(<PasteReceiptDialog open={true} onOpenChange={onOpenChangeMock} />);

    expect(screen.getByText("Colar Comprovante ou Notificação")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Campo para colar texto de comprovante"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirmar conversão do comprovante colado/i }),
    ).toBeDisabled();
  });

  it("ao digitar texto de comprovante Pix válido, exibe pré-visualização instantânea", async () => {
    const user = userEvent.setup();
    render(<PasteReceiptDialog open={true} onOpenChange={onOpenChangeMock} />);

    const textarea = screen.getByLabelText("Campo para colar texto de comprovante");
    await user.type(
      textarea,
      "Comprovante Pix Nubank: Valor R$ 85,50 Pago para: Supermercado Alianca",
    );

    // Pré-visualização renderizada
    expect(
      screen.getByRole("region", { name: "Pré-visualização da transação detectada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText(/Pix: Supermercado Alianca/)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /Confirmar conversão do comprovante colado/i,
    });
    expect(submitBtn).toBeEnabled();
  });

  it("ao clicar em Converter com texto válido, chama processPixShare, emite Toast e adiciona sugestão à fila", async () => {
    const addPendingSpy = vi.spyOn(nativeModule, "addPendingSuggestion").mockImplementation(() => {});
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(<PasteReceiptDialog open={true} onOpenChange={onOpenChangeMock} />);

    const textarea = screen.getByLabelText("Campo para colar texto de comprovante");
    fireEvent.change(textarea, {
      target: {
        value: "Comprovante Pix Nubank: Valor R$ 150,00 Beneficiário: João Silva",
      },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Confirmar conversão do comprovante colado/i,
    });
    fireEvent.click(submitBtn);

    expect(addPendingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 15000,
        bankName: "Nubank",
        description: "Pix: João Silva",
      }),
    );
    expect(sensorySpy).toHaveBeenCalledWith("success");
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comprovante reconhecido",
        variant: "success",
      }),
    );
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("ao fornecer callback onParsed, repassa a transação reconhecida para o callback", () => {
    const onParsedMock = vi.fn();
    const addPendingSpy = vi.spyOn(nativeModule, "addPendingSuggestion");

    render(
      <PasteReceiptDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        onParsed={onParsedMock}
      />,
    );

    const textarea = screen.getByLabelText("Campo para colar texto de comprovante");
    fireEvent.change(textarea, {
      target: {
        value: "Compra de R$ 42,90 aprovada no Nubank em Padaria Central",
      },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Confirmar conversão do comprovante colado/i,
    });
    fireEvent.click(submitBtn);

    expect(onParsedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 4290,
        bankName: "Nubank",
      }),
    );
    // Não adiciona na fila geral quando onParsed trata o formulário local
    expect(addPendingSpy).not.toHaveBeenCalled();
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("ao inserir texto inválido sem valores monetários legíveis, exibe mensagem de erro", () => {
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(<PasteReceiptDialog open={true} onOpenChange={onOpenChangeMock} />);

    const textarea = screen.getByLabelText("Campo para colar texto de comprovante");
    fireEvent.change(textarea, {
      target: {
        value: "Olá amigo, segue o comprovante que te falei mais cedo",
      },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Confirmar conversão do comprovante colado/i,
    });
    fireEvent.click(submitBtn);

    expect(sensorySpy).toHaveBeenCalledWith("warning");
    expect(
      screen.getByText(/Não foi possível identificar um comprovante ou notificação bancária válida/),
    ).toBeInTheDocument();
    expect(onOpenChangeMock).not.toHaveBeenCalled();
  });

  it("permite colar da área de transferência quando navigator.clipboard estiver disponível", async () => {
    const originalClipboard = navigator.clipboard;
    const readTextMock = vi.fn().mockResolvedValue("Comprovante Pix Itaú: Valor R$ 75,00");
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: readTextMock },
      configurable: true,
      writable: true,
    });

    render(<PasteReceiptDialog open={true} onOpenChange={onOpenChangeMock} />);

    const pasteBtn = screen.getByRole("button", { name: "Colar da área de transferência" });
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(readTextMock).toHaveBeenCalled();
    });

    const textarea = screen.getByLabelText("Campo para colar texto de comprovante");
    await waitFor(() => {
      expect(textarea).toHaveValue("Comprovante Pix Itaú: Valor R$ 75,00");
    });

    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });
});
