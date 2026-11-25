import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachReceiptDialog } from "./attach-receipt-dialog";
import {
  computeEMVCRC16,
  formatDigitableLine,
  getReceiptKindLabel,
  modulo10,
  modulo11Febraban,
} from "@/domain/notifications";
import * as clipboardService from "@/services/clipboard";
import { PdfPasswordProtectedError } from "@/services/native/receipt-extractor";
import * as pdfSessionService from "@/services/pdf-session";
import { clearLocalReceiptScanCache } from "@/services/receipt-resolution";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types/schema";

const mockExtractReceiptTextFromFile = vi.fn();

vi.mock("@/services/native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native")>();
  return {
    ...actual,
    extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
    processPixShare: vi.fn(),
    addPendingSuggestion: vi.fn(),
  };
});

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/merchant-learning", () => {
  const memory = {
    name_restaurante_fogao_a_lenha: {
      friendlyName: "Restaurante Fogão a Lenha",
      categorySlug: "alimentacao",
      preferredPaymentMethod: "credit_card",
      preferredCardId: "card-itau-uuid",
    },
  };
  const cardDigitsMapping = {
    "4821": "card-itau-uuid",
  };
  const bankCardMapping = {};
  return {
    useMerchantLearning: () => ({ memory }),
    useCardDigitsMapping: () => ({ cardDigitsMapping }),
    useBankCardMapping: () => ({ bankCardMapping }),
    getMerchantLearningMemory: () => memory,
    getCardDigitsMapping: () => cardDigitsMapping,
    getBankCardMapping: () => bankCardMapping,
  };
});

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
    localStorage.clear();
    clearLocalReceiptScanCache();
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

    expect(screen.getByText("Anexar Comprovante ou Cupom")).toBeDefined();
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

  it("processa carnê de loja com parcelamento e resolução de categoria (Tarefa 7.4)", async () => {
    const rawCarne = `
      MAGAZINE LUIZA
      COMPROVANTE DE PAGAMENTO DE CARNÊ
      DATA DO PAGAMENTO: 10/11/2026
      VENCIMENTO: 15/11/2026
      BENEFICIÁRIO: MAGAZINE LUIZA S.A.
      CNPJ: 47.960.950/0001-21
      PARCELA 04 DE 10
      VALOR PAGO: R$ 120,00
      LINHA DIGITÁVEL: 23793.38128 60000.123456 01000.654321 8 89010000012000
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawCarne);

    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["carne"], "carne.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 12000,
          installments: 10,
          currentInstallment: 4,
          receiptKind: "bank_slip_payment",
          categorySlug: "compras",
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

  it("rejeita arquivo com tamanho superior a 15 MB exibindo mensagem defensiva (SEC-06)", async () => {
    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File(["dummy"], "arquivo-pesado.pdf", { type: "application/pdf" });
    Object.defineProperty(largeFile, "size", { value: 16 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/O arquivo selecionado excede o limite de 15 MB/i)).toBeInTheDocument();
    });

    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it("rejeita arquivo com extensão SVG exibindo aviso de formato não suportado (SEC-06)", async () => {
    render(
      <AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const svgFile = new File(["<svg></svg>"], "vetor.svg", { type: "image/svg+xml" });

    fireEvent.change(fileInput, { target: { files: [svgFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Arquivos SVG não são suportados/i)).toBeInTheDocument();
    });

    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it("usa readClipboardText no botão 'Colar comprovante Pix' para PIX_BRCODE sem Tag 54 e PIX_KEY", async () => {
    const baseEmv =
      "00020126360014br.gov.bcb.pix0114+55119876543215204000053039865802BR5913CAFE SAO JOSE6009SAO PAULO6304";
    const emvWithoutAmount = `${baseEmv}${computeEMVCRC16(baseEmv)}`;
    const readSpy = vi.spyOn(clipboardService, "readClipboardText").mockResolvedValueOnce({
      status: "success",
      text: emvWithoutAmount,
    });

    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    fireEvent.click(screen.getByRole("button", { name: /Colar comprovante Pix/i }));

    await waitFor(() => {
      expect(readSpy).toHaveBeenCalledTimes(1);
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 0,
          paymentMethod: "pix",
          pixKey: "+5511987654321",
        }),
      );
    });
  });

  it("aceita Ctrl+V de imagem colada diretamente no diálogo e aciona OCR", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Comprovante Pix Nubank\nValor Pago: R$ 72,50\nData: 22/11/2026\nDestino\nFARMACIA EXEMPLO",
    );

    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    const dropText = screen.getByText(/Arraste o comprovante aqui/i);
    const pngFile = new File(["png-print"], "print.png", { type: "image/png" });
    fireEvent.paste(dropText, {
      clipboardData: {
        files: [pngFile],
        getData: () => "",
      },
    });

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 7250,
          paymentMethod: "pix",
        }),
      );
    });
  });

  it("orienta e oferece redirecionamento para importação de fatura quando status for multi_statement", async () => {
    const onNavigateToStatementImport = vi.fn();
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      [
        "Extrato Bancário Mensal",
        "01/11/2026 SUPERMERCADO A R$ 110,00",
        "02/11/2026 FARMACIA B R$ 45,00",
        "03/11/2026 PADARIA C R$ 22,50",
      ].join("\n"),
    );

    render(
      <AttachReceiptDialog
        open={true}
        onOpenChange={onOpenChange}
        onParsed={onParsed}
        onNavigateToStatementImport={onNavigateToStatementImport}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = new File(["extrato-pdf"], "extrato.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    const redirectBtn = await screen.findByRole("button", {
      name: /Ir para importação de fatura/i,
    });
    expect(onParsed).not.toHaveBeenCalled();

    fireEvent.click(redirectBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigateToStatementImport).toHaveBeenCalledTimes(1);
  });

  it("permite colar linha digitável de boleto na aba 'Colar texto ou código'", async () => {
    const user = userEvent.setup();
    const free25 = "1234567890123456789012345";
    const factor = "1642";
    const amt = "0000031500";
    const base43 = `3419${factor}${amt}${free25}`;
    const dvG = modulo11Febraban(base43);
    const c1 = `3419${free25.slice(0, 5)}`;
    const c2 = free25.slice(5, 15);
    const c3 = free25.slice(15, 25);
    const line = formatDigitableLine(
      `${c1}${modulo10(c1)}${c2}${modulo10(c2)}${c3}${modulo10(c3)}${dvG}${factor}${amt}`,
    );

    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    await user.click(screen.getByRole("tab", { name: /Colar texto ou código/i }));
    const textarea = await screen.findByLabelText(/Conteúdo colado do comprovante ou boleto/i);
    fireEvent.change(textarea, { target: { value: line } });
    await user.click(screen.getByRole("button", { name: /Reconhecer dados/i }));

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 31500,
          documentStatus: "pending_due",
          receiptKind: "bank_slip_payment",
        }),
      );
    });
  });

  it("exibe desbloqueio inline quando PDF está protegido por senha e retoma leitura ao enviar senha", async () => {
    const disposeMock = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi
      .spyOn(pdfSessionService, "openPdfDocumentSession")
      .mockRejectedValueOnce(new PdfPasswordProtectedError())
      .mockResolvedValueOnce({
        fileName: "condominio.pdf",
        sha256: null,
        totalPages: 1,
        getTotalPages: () => 1,
        getBuffer: () => new ArrayBuffer(16),
        extractPageTexts: async () => [
          "Comprovante de Pagamento de Boleto\nBeneficiário: Condomínio Parque\nValor Pago: R$ 540,00\nData: 20/11/2026",
        ],
        extractSpatialPages: async () => ({
          usedTwoColumnMode: false,
          totalPages: 1,
          lines: [
            {
              text: "Comprovante de Pagamento de Boleto\nBeneficiário: Condomínio Parque\nValor Pago: R$ 540,00\nData: 20/11/2026",
              y: 700,
              xStart: 40,
              xEnd: 400,
              fontSize: 10,
              column: 1,
              pageNumber: 1,
              tokens: [],
            },
          ],
        }),
        renderPageToBlob: async () => null,
        dispose: disposeMock,
      });

    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const protectedPdf = new File(["%PDF-1.4 locked"], "condominio.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [protectedPdf] } });

    const passwordInput = await screen.findByLabelText(/Senha do arquivo PDF/i);
    expect(screen.getByText(/Boleto ou comprovante em PDF protegido/i)).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: /Desbloquear e continuar/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(onParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 54000,
          receiptKind: "bank_slip_payment",
        }),
      );
    });
    openSpy.mockRestore();
  });
});
