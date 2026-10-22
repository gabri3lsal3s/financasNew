import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachReceiptDialog } from "./attach-receipt-dialog";

const mockExtractReceiptTextFromFile = vi.fn();

vi.mock("@/services/native", () => ({
  extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
  processPixShare: (text: string) => {
    if (text.includes("R$ 120,00")) {
      return {
        id: "tx-test-1",
        amountCents: 12000,
        description: "Supermercado Dia",
        date: "2026-10-22",
        type: "expense",
        bankName: "Nubank",
        merchant: "Supermercado Dia",
        categorySlug: "mercado",
      };
    }
    return null;
  },
  useMerchantCategoryMapping: () => ({}),
  addPendingSuggestion: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("AttachReceiptDialog", () => {
  const onOpenChange = vi.fn();
  const onParsed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza os elementos de envio de arquivo e captura por câmera", () => {
    render(<AttachReceiptDialog open={true} onOpenChange={onOpenChange} onParsed={onParsed} />);

    expect(screen.getByText("Anexar Comprovante")).toBeDefined();
    expect(screen.getByText(/Arraste o comprovante aqui/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Escolher arquivo/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tirar foto/i })).toBeDefined();
  });

  it("processa com sucesso um arquivo de comprovante e aciona onParsed", async () => {
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
          description: "Supermercado Dia",
          type: "expense",
          bankName: "Nubank",
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
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
