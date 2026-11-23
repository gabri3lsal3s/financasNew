import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPixTransferCode } from "@/domain/pix";
import { PixRecipientConfigFields } from "./pix-recipient-config-fields";
import { PixTroubleshootAccordion } from "./pix-troubleshoot-accordion";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("PixRecipientConfigFields & PixTroubleshootAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exige apenas a Chave Pix, oculta campo de Cidade e gera verificação EMV/CRC16 ao vivo", () => {
    render(
      <PixRecipientConfigFields
        pixKey="(79) 99988-7766"
        onPixKeyChange={vi.fn()}
        selectedKeyType="auto"
        onSelectedKeyTypeChange={vi.fn()}
        merchantName=""
        onMerchantNameChange={vi.fn()}
        previewAmountCents={2612}
      />,
    );

    expect(screen.queryByLabelText(/Cidade/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Código Pix verificado \(Padrão BACEN\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^CRC16 [0-9A-F]{4}$/)).toBeInTheDocument();
    expect(screen.getAllByText("+5579999887766").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("RECEBEDOR")).toBeInTheDocument();
  });

  it("exibe motivo exato quando a chave Pix está incompleta ou inválida", () => {
    render(
      <PixRecipientConfigFields
        pixKey="123e4567-e12b"
        onPixKeyChange={vi.fn()}
        selectedKeyType="auto"
        onSelectedKeyTypeChange={vi.fn()}
        merchantName="Gabriel"
        onMerchantNameChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Código Pix bloqueado — Motivo:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/13\/36 caracteres/i).length).toBeGreaterThanOrEqual(1);
  });

  it("exibe diagnóstico EMV/CRC16 e atalho para copiar chave no PixTroubleshootAccordion", () => {
    const onCopyKey = vi.fn();
    const validBrCode = buildPixTransferCode({
      pixKey: "52998224725",
      merchantName: "Recebedor Teste",
      merchantCity: "BRASILIA",
      amountCents: 3500,
    });

    const { rerender } = render(
      <PixTroubleshootAccordion
        pixBrCode={validBrCode}
        pixKey="52998224725"
        pixKeyType="cpf"
        onCopyPixKey={onCopyKey}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Deu erro ao pagar no app do banco\? Ver diagnóstico/i }),
    );

    expect(screen.getByText("Estrutura EMV íntegra")).toBeInTheDocument();
    expect(screen.getByText(/^CRC16 [0-9A-F]{4}$/)).toBeInTheDocument();
    expect(screen.getByText(/Chave Pix informada não está cadastrada/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Copiar apenas a chave Pix/i }));
    expect(onCopyKey).toHaveBeenCalledTimes(1);

    rerender(
      <PixTroubleshootAccordion
        pixBrCode={null}
        pixKey="123.456.789-01"
        pixKeyType="cpf"
        onCopyPixKey={onCopyKey}
      />,
    );

    expect(screen.getByText(/CPF inválido/i)).toBeInTheDocument();
  });
});
