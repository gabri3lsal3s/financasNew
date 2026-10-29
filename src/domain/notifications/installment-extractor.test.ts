import { describe, expect, it } from "vitest";
import { extractDetailedInstallments } from "./installment-extractor";

describe("extractDetailedInstallments", () => {
  it("retorna null para entradas nulas ou vazias", () => {
    expect(extractDetailedInstallments("")).toBeNull();
  });

  it("reconhece multiplicador com valor de parcela (em 3x de R$ 50,00)", () => {
    const text = "Compra na Loja XYZ em 3x de R$ 50,00 aprovada";
    const result = extractDetailedInstallments(text);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(3);
    expect(result?.installmentAmountCents).toBe(5000);
    expect(result?.totalAmountCents).toBe(15000);
    expect(result?.isNewFinancedPurchase).toBe(true);
  });

  it("reconhece multiplicador com espaco e sem R$ (3 x 120,50)", () => {
    const text = "Total parcelado: 3 x 120,50";
    const result = extractDetailedInstallments(text);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(3);
    expect(result?.installmentAmountCents).toBe(12050);
    expect(result?.totalAmountCents).toBe(36150);
  });

  it("reconhece padrao de maquininhas de cartao (PARC: 04)", () => {
    const text = "COMPROVANTE CIELO\nVALOR TOTAL R$ 200,00\nPARC: 04\nCREDITO PARCELADO";
    const result = extractDetailedInstallments(text, 20000);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(4);
    expect(result?.totalAmountCents).toBe(20000);
    expect(result?.installmentAmountCents).toBe(5000);
    expect(result?.isNewFinancedPurchase).toBe(true);
  });

  it("reconhece padrao QTDE PARCELAS: 10 em comprovantes de maquininha", () => {
    const text = "REDE CARD - VIA CLIENTE\nQTDE PARCELAS: 10\nVALOR: R$ 1.000,00";
    const result = extractDetailedInstallments(text, 100000);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(10);
    expect(result?.totalAmountCents).toBe(100000);
    expect(result?.installmentAmountCents).toBe(10000);
  });

  it("reconhece valor total com indicacao de parcelas (R$ 300,00 em 3x)", () => {
    const text = "Pagamento de R$ 300,00 parcelado em 3x no cartao Nubank";
    const result = extractDetailedInstallments(text, 30000);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(3);
    expect(result?.totalAmountCents).toBe(30000);
    expect(result?.installmentAmountCents).toBe(10000);
  });

  it("reconhece parcela isolada periodica (Parcela 02/10 de R$ 45,00)", () => {
    const text = "Financiamento Imobiliario - Parcela 02/10 de R$ 45,00 debitada";
    const result = extractDetailedInstallments(text, 4500);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(10);
    expect(result?.currentInstallment).toBe(2);
    expect(result?.installmentAmountCents).toBe(4500);
    expect(result?.totalAmountCents).toBe(4500);
    expect(result?.isNewFinancedPurchase).toBe(false);
  });

  it("reconhece parcela isolada com formato 'PARC 3 DE 12'", () => {
    const text = "PARC 03 DE 12 - R$ 90,00";
    const result = extractDetailedInstallments(text);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(12);
    expect(result?.currentInstallment).toBe(3);
    expect(result?.installmentAmountCents).toBe(9000);
    expect(result?.isNewFinancedPurchase).toBe(false);
  });

  it("rejeita quantidades fora do limite de negocio (ex: mais de 60 parcelas)", () => {
    const text = "Compra em 72x de R$ 100,00";
    expect(extractDetailedInstallments(text)).toBeNull();
  });
});
