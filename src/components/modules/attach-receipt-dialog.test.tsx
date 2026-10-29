import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachReceiptDialog } from "./attach-receipt-dialog";
import { getReceiptKindLabel } from "@/domain/notifications";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types/schema";

const mockExtractReceiptTextFromFile = vi.fn();

vi.mock("@/services/native", () => ({
  extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
  processPixShare: vi.fn(),
  addPendingSuggestion: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/merchant-learning", () => ({
  useMerchantLearning: () => ({
    memory: {
      name_restaurante_fogao_a_lenha: {
        friendlyName: "Restaurante Fogão a Lenha",
        categorySlug: "alimentacao",
        preferredPaymentMethod: "credit_card",
        preferredCardId: "card-itau-uuid",
      },
    },
  }),
  useCardDigitsMapping: () => ({
    cardDigitsMapping: {
      "4821": "card-itau-uuid",
    },
  }),
}));

function makeCard(overrides: Partial<CreditCard> & { id: string; name: string }): CreditCard {
  return {
    user_id: "user-1",
    brand: "visa",
    credit_limit: 500000,
    closing_day: 10,
    due_day: 17,
    color: null,
    is_active: true,
    ...overrides,
  };
}

describe("AttachReceiptDialog", () => {
  const onOpenChange = vi.fn();
  const onParsed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getReceiptKindLabel retorna rótulo correto para cada tipo de comprovante", () => {
    expect(getReceiptKindLabel("card_slip", 1)).toBe("Comprovante de Cartão");
    expect(getReceiptKindLabel("card_slip", 3)).toBe("Comprovante de Cartão de Crédito (3x)");
    expect(getReceiptKindLabel("pix")).toBe("Comprovante Pix");
    expect(getReceiptKindLabel("bank_slip_payment")).toBe("Boleto Bancário");
    expect(getReceiptKindLabel("danfe_nfc_e")).toBe("Cupom Fiscal");
    expect(getReceiptKindLabel("wire_transfer")).toBe("Transferência Bancária");
    expect(getReceiptKindLabel("generic", 1)).toBe("Comprovante de Pagamento");
    expect(getReceiptKindLabel("generic", 4)).toBe("Comprovante de Pagamento (4x)");
    expect(getReceiptKindLabel(undefined)).toBe("Comprovante");
  });

  it("renderiza os elementos de envio de arquivo e captura por câmera", () => {
    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    expect(screen.getByText("Anexar Comprovante")).toBeDefined();
    expect(screen.getByText(/Arraste o comprovante aqui/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Escolher arquivo/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tirar foto/i })).toBeDefined();
  });

  it("processa com sucesso um arquivo de comprovante Pix e aciona onParsed com feedback visual", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Comprovante Pix Nubank\nValor: R$ 120,00\nPara: Supermercado Dia\nData: 22/10/2026",
    );

    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    const file = new File(["dummy content"], "comprovante.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 12000,
          description: expect.stringMatching(/Dia/i),
          type: "expense",
          bankName: "Nubank",
          paymentMethod: "pix",
          receiptKind: "pix",
        }),
      );
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Comprovante Pix reconhecido",
          variant: "success",
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("processa comprovante de cartão parcelado e auto-resolve o cartão via cardDigitsMapping", async () => {
    const rawSlip = `
      CIELO
      VIA CLIENTE
      CREDITO PARCELADO
      PARC: 03
      VALOR DA PARCELA: R$ 50,00
      VALOR TOTAL: R$ 150,00
      MASTERCARD
      FINAL 4821
      AUTORIZACAO: 987654
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawSlip);

    const cards = [
      makeCard({ id: "card-itau-uuid", name: "Itaú Personnalité", brand: "mastercard" }),
      makeCard({ id: "card-nubank-uuid", name: "Nubank Roxinho", brand: "mastercard" }),
    ];

    render(
      <AttachReceiptDialog
        open={true}
        onOpenChange={onOpenChange}
        onParsed={onParsed}
        cards={cards}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["slip"], "slip.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 15000,
          installments: 3,
          installmentAmountCents: 5000,
          paymentMethod: "credit_card",
          cardId: "card-itau-uuid",
          cardLastDigits: "4821",
          receiptKind: "card_slip",
        }),
      );
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Comprovante de Cartão de Crédito (3x) reconhecido",
          variant: "success",
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("processa comprovante de boleto bancário / tributo com sucesso", async () => {
    const rawBoleto = `
      Banco do Brasil
      Comprovante de Pagamento de Concessionária
      Empresa Conveniada: Enel Distribuição
      Valor Pago: R$ 185,40
      Data do Pagamento: 22/10/2026
      Linha Digitável: 83640000001-8 85400138000-4 12345678901-2 34567890123-5
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawBoleto);

    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["boleto"], "boleto.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 18540,
          type: "expense",
          receiptKind: "bank_slip_payment",
        }),
      );
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Boleto Bancário reconhecido",
          variant: "success",
        }),
      );
    });
  });

  it("exibe mensagem de erro quando o arquivo não contém informações financeiras válidas", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("Texto aleatório sem nenhum valor financeiro");

    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "outro.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível identificar informações financeiras válidas/i)).toBeDefined();
    });

    expect(onParsed).not.toHaveBeenCalled();
  });
});
