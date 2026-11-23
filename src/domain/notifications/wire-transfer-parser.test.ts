import { describe, expect, it } from "vitest";
import {
  extractWireBeneficiary,
  extractWireSender,
  isWireTransferReceipt,
  parseWireTransferReceipt,
} from "./wire-transfer-parser";

describe("wire-transfer-parser — Parser Especializado de TED/DOC/Transferências (Tarefa 2.4)", () => {
  it("detecta comprovante de transferência bancária tradicional", () => {
    expect(
      isWireTransferReceipt("Comprovante de Transferência Eletrônica TED Itaú"),
    ).toBe(true);
    expect(isWireTransferReceipt("Operação: TED Banco do Brasil")).toBe(true);
    expect(isWireTransferReceipt("Comprovante de transferência Pix")).toBe(
      false,
    );
  });

  it("extrai remetente e favorecido da transferência", () => {
    const raw = `
      Remetente: Gabriel Sales
      Favorecido: Maria Fernandes dos Santos
    `;
    expect(extractWireSender(raw)).toBe("Gabriel Sales");
    expect(extractWireBeneficiary(raw)).toContain(
      "Maria Fernandes dos Santos",
    );
  });

  it("parseia comprovante completo de TED", () => {
    const raw = `
      Banco do Brasil
      Comprovante de Transferência TED
      Data da transferência: 24/10/2026
      Valor: R$ 850,00
      
      Favorecido:
      Nome: Imobiliária Modelo LTDA
      CPF/CNPJ: 11.222.333/0001-44
      Banco: 104 - Caixa Econômica Federal
      Agência: 0123 Conta: 00012345-6
      
      Remetente:
      Nome: Gabriel Sales
      Conta: 12345-6
    `;

    const parsed = parseWireTransferReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("wire_transfer");
    expect(parsed?.nature).toBe("expense");
    expect(parsed?.paymentMethod).toBe("transfer");
    expect(parsed?.amountCents).toBe(85000);
    expect(parsed?.date).toBe("2026-10-24");
    expect(parsed?.merchantOrBeneficiary).toContain("Imobiliária Modelo");
    expect(parsed?.payerOrSource).toBe("Gabriel Sales");
    expect(parsed?.bankName).toBe("Banco do Brasil");
    expect(parsed?.issuerBank).toBe("Caixa");
  });

  it("rejeita texto sem valor monetário", () => {
    expect(parseWireTransferReceipt("TED agendada com sucesso")).toBeNull();
  });

  it("não colide com comprovantes de Pix", () => {
    const pixRaw = "Comprovante de transferência Pix realizada";
    expect(parseWireTransferReceipt(pixRaw)).toBeNull();
  });

  it("extrai blocos sem 'Nome:' e detecta TED Recebida como income (Fase B)", () => {
    const tedReceived = `
      Banco Itaú
      Comprovante de Transferência Bancária Recebida
      Tipo de transferência: TED
      Data: 20/11/2026
      Valor creditado: R$ 3.400,00

      Origem
      EMPRESA ALFA CONSULTORIA LTDA
      CNPJ: 18.236.120/0001-58
      Instituição: Banco do Brasil S.A.

      Destino
      GABRIEL SALES
      Instituição: Itaú Unibanco S.A.
    `;

    const parsed = parseWireTransferReceipt(tedReceived);
    expect(parsed).not.toBeNull();
    expect(parsed?.nature).toBe("income");
    expect(parsed?.amountCents).toBe(340000);
    expect(parsed?.payerOrSource).toContain("EMPRESA ALFA CONSULTORIA");
    expect(parsed?.merchantOrBeneficiary).toBe("GABRIEL SALES");
    expect(parsed?.description).toContain("TED Recebida:");
  });
});
