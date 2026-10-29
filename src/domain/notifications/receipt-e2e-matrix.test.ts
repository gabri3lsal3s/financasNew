/**
 * Matriz de Testes E2E de Comprovantes Reais do Sistema Financeiro Nacional (§Fase 5 — Tarefa 5.1).
 *
 * Valida a extração determinística de ponta a ponta (E2E) com amostras reais de:
 * 1. Pix enviado Nubank e Itaú.
 * 2. Pix recebido Inter e Mercado Pago.
 * 3. Pix agendado Bradesco.
 * 4. Slip Cielo Crédito 3x com final 4821 e adquirente.
 * 5. Slip Stone Mastercard Débito à vista.
 * 6. Slip PagBank Elo Crédito 10x.
 * 7. Comprovante de Pagamento de Boleto Santander / Concessionária.
 * 8. Cupom Fiscal Eletrônico NFC-e com pagamento em Cartão de Crédito.
 * 9. Transferência TED Banco do Brasil para Caixa.
 *
 * Também valida:
 * - Resolução de identidade de estabelecimento e categorização inferida.
 * - Resolução determinística de cartões de crédito ativos por 4 dígitos finais e bandeira.
 * - Tolerância e resiliência a ruídos ópticos de OCR.
 */

import { describe, expect, it } from "vitest";
import type { CreditCard } from "@/types/schema";
import { resolveBestMatchingCard } from "./card-resolution";
import { resolveMerchantIdentity } from "./merchant-resolver";
import { getReceiptKindLabel, parseUniversalReceipt } from "./universal-receipt-parser";

const MOCK_CARDS: CreditCard[] = [
  {
    id: "card-itau-master",
    user_id: "user-1",
    name: "Itaú Mastercard Black",
    brand: "mastercard",
    credit_limit: 15000,
    closing_day: 10,
    due_day: 20,
    color: "#000000",
    is_active: true,
  },
  {
    id: "card-cielo-target",
    user_id: "user-1",
    name: "Nubank Mastercard Gold",
    brand: "mastercard",
    credit_limit: 8000,
    closing_day: 5,
    due_day: 15,
    color: "#820ad1",
    is_active: true,
  },
  {
    id: "card-pagbank-elo",
    user_id: "user-1",
    name: "Bradesco Elo Nanquim",
    brand: "elo",
    credit_limit: 12000,
    closing_day: 12,
    due_day: 22,
    color: "#cc092f",
    is_active: true,
  },
];

describe("receipt-e2e-matrix — Matriz de Testes E2E de Comprovantes Reais (Tarefa 5.1)", () => {
  describe("1. Pix Enviado (Saídas / Despesas)", () => {
    it("parseia comprovante real de Pix enviado Nubank com favorecido, CNPJ e chave", () => {
      const nubankSample = `
Comprovante de transferência Pix
Nubank

Valor
R$ 125,50

Data da transferência
25/10/2026 - 15:30:12

Destino
Nome: POSTO IPIRANGA LTDA
CNPJ: 12.345.678/0001-90
Instituição: BANCO ITAU UNIBANCO S.A.
Chave Pix: 12345678000190

Origem
Nome: GABRIEL SALES
CPF: ***.123.456-**
Instituição: Nu Pagamentos S.A.
ID da transação: E18236120202610251830a1b2c3d4e5f
`;

      const parsed = parseUniversalReceipt(nubankSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("pix");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.amountCents).toBe(12550);
      expect(parsed?.date).toBe("2026-10-25");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.merchantOrBeneficiary).toContain("POSTO IPIRANGA");
      expect(parsed?.taxId).toBe("12345678000190");
      expect(parsed?.payerOrSource).toBe("GABRIEL SALES");
      expect(parsed?.pixKey).toBe("12345678000190");
      expect(parsed?.txId).toBe("E18236120202610251830a1b2c3d4e5f");
      expect(getReceiptKindLabel(parsed?.kind)).toBe("Comprovante Pix");

      // Categorização inferida (combustível / transporte)
      const identity = resolveMerchantIdentity({
        merchantOrDescription: parsed?.merchantOrBeneficiary,
        rawText: nubankSample,
        taxId: parsed?.taxId,
      });
      expect(identity.categorySlug).toBe("transporte");
    });

    it("parseia comprovante real de Pix enviado Itaú com instituição recebedora e autenticação", () => {
      const itauSample = `
Itaú Unibanco
Comprovante de Pagamento Pix

Valor: R$ 89,90
Data de débito: 26/10/2026 - 11:20:00

Dados de quem recebeu:
Nome: FARMACIA DROGASIL
CNPJ: 61.585.865/0240-49
Instituição: Nu Pagamentos S.A.
Chave Pix: 61585865024049

Dados de quem pagou:
Nome: GABRIEL SALES
Instituição: Itaú Unibanco S.A.
Autenticação: A8F91B2C3D4E5F6
`;

      const parsed = parseUniversalReceipt(itauSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("pix");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.amountCents).toBe(8990);
      expect(parsed?.date).toBe("2026-10-26");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.merchantOrBeneficiary).toContain("FARMACIA DROGASIL");
      expect(parsed?.bankName).toBe("Itaú");

      // Categorização inferida (farmácia / saúde)
      const identity = resolveMerchantIdentity({
        merchantOrDescription: parsed?.merchantOrBeneficiary,
        rawText: itauSample,
        taxId: parsed?.taxId,
      });
      expect(identity.categorySlug).toBe("saude");
    });
  });

  describe("2. Pix Recebido (Entradas / Receitas)", () => {
    it("parseia comprovante real de Pix recebido Banco Inter com identificação de pagador", () => {
      const interSample = `
Banco Inter
Comprovante de Transferência Pix Recebida

Valor recebido: R$ 1.500,00
Data do crédito: 20/10/2026 às 09:15:30

Origem / Pagador:
Nome: EMPRESA CONSULTORIA LTDA
CNPJ: 11.222.333/0001-44
Instituição: BANCO DO BRASIL S.A.

Destino / Recebedor:
Nome: GABRIEL SALES
CPF: ***.123.456-**
Instituição: BANCO INTER S.A.
ID Fim a Fim: E00416968202610201215s8f7e6d5c4b
`;

      const parsed = parseUniversalReceipt(interSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("pix");
      expect(parsed?.nature).toBe("income");
      expect(parsed?.amountCents).toBe(150000);
      expect(parsed?.date).toBe("2026-10-20");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.payerOrSource).toContain("EMPRESA CONSULTORIA");
      expect(parsed?.bankName).toBe("Inter");
      expect(parsed?.txId).toBe("E00416968202610201215s8f7e6d5c4b");
    });

    it("parseia comprovante real de Pix recebido Mercado Pago", () => {
      const mpSample = `
Mercado Pago
Comprovante de Recebimento Pix

Você recebeu
R$ 250,00

Data: 22/10/2026 18:45:00

De:
Nome: MARIA APARECIDA OLIVEIRA
CPF: ***.987.654-**
Instituição: Nu Pagamentos S.A.

Para:
Nome: GABRIEL SALES
Instituição: Mercado Pago
ID da transação: E10573521202610221845xyz9876543
`;

      const parsed = parseUniversalReceipt(mpSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("pix");
      expect(parsed?.nature).toBe("income");
      expect(parsed?.amountCents).toBe(25000);
      expect(parsed?.date).toBe("2026-10-22");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.payerOrSource).toContain("MARIA APARECIDA OLIVEIRA");
      expect(parsed?.bankName).toBe("Mercado Pago");
    });
  });

  describe("3. Pix Agendado (Agendamentos Futuros)", () => {
    it("parseia comprovante real de Pix agendado Bradesco com data futura e status", () => {
      const bradescoScheduled = `
Banco Bradesco S.A.
Comprovante de Agendamento Pix

Status: Agendado com sucesso
Valor do pagamento: R$ 450,00
Data agendada para débito: 30/10/2026

Favorecido:
Nome: IMOBILIARIA MODELO LTDA
CNPJ: 99.888.777/0001-66
Instituição: BANCO SANTANDER (BRASIL) S.A.

Pagador:
Nome: GABRIEL SALES
Agência: 0123 Conta: 0045678-9
Instituição: BANCO BRADESCO S.A.
Autenticação: 20261025001ABC
`;

      const parsed = parseUniversalReceipt(bradescoScheduled);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("pix");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.amountCents).toBe(45000);
      expect(parsed?.date).toBe("2026-10-30");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.merchantOrBeneficiary).toContain("IMOBILIARIA MODELO");
      expect(parsed?.bankName).toBe("Bradesco");
      expect(parsed?.description).toContain("Pix Agendado");
    });
  });

  describe("4. Slips de Maquininhas de Cartão (POS / TEF)", () => {
    it("parseia slip Cielo Crédito parcelado em 3x com final 4821, adquirente e resolução do cartão", () => {
      const cieloSlip = `
CIELO
ESTABELECIMENTO: RESTAURANTE SABOR DE MINAS
CNPJ: 23.456.789/0001-01
DATA: 24/10/2026 20:30:15
VIA CLIENTE
CREDITO PARCELADO
PARCELAS: 3
VALOR TOTAL: R$ 210,00
VALOR PARCELA: R$ 70,00
CARTAO: MASTERCARD FINAL 4821
AUTORIZACAO: 045123
DOC: 887766
`;

      const parsed = parseUniversalReceipt(cieloSlip);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("card_slip");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.amountCents).toBe(21000);
      expect(parsed?.installments?.count).toBe(3);
      expect(parsed?.installments?.installmentAmountCents).toBe(7000);
      expect(parsed?.cardLastDigits).toBe("4821");
      expect(parsed?.cardBrand).toBe("Mastercard");
      expect(parsed?.terminalAcquirer).toBe("Cielo");
      expect(parsed?.merchantOrBeneficiary).toContain("RESTAURANTE SABOR DE MINAS");
      expect(getReceiptKindLabel(parsed?.kind, parsed?.installments?.count)).toBe(
        "Comprovante de Cartão de Crédito (3x)",
      );

      // Resolução do cartão via memória de 4 dígitos finais (4821 -> Nubank Mastercard Gold)
      const cardDigitsMap = { "4821": "card-cielo-target" };
      const resolvedCard = resolveBestMatchingCard(MOCK_CARDS, {
        cardLastDigits: parsed?.cardLastDigits,
        cardBrand: parsed?.cardBrand,
        cardDigitsMapping: cardDigitsMap,
      });
      expect(resolvedCard?.id).toBe("card-cielo-target");
      expect(resolvedCard?.name).toBe("Nubank Mastercard Gold");

      // Categorização do estabelecimento
      const identity = resolveMerchantIdentity({
        merchantOrDescription: parsed?.merchantOrBeneficiary,
        rawText: cieloSlip,
      });
      expect(identity.categorySlug).toBe("alimentacao");
    });

    it("parseia slip Stone Mastercard Débito à vista com adquirente e final de cartão", () => {
      const stoneSlip = `
STONE
DROGARIA SAO PAULO
VIA DO CLIENTE
DATA: 25/10/2026 16:10
MASTERCARD DEBITO
A VISTA
VALOR: R$ 42,90
CARTAO: **** **** **** 1092
AUT: 321654
CV: 123456789
`;

      const parsed = parseUniversalReceipt(stoneSlip);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("card_slip");
      expect(parsed?.paymentMethod).toBe("debit");
      expect(parsed?.amountCents).toBe(4290);
      expect(parsed?.cardLastDigits).toBe("1092");
      expect(parsed?.cardBrand).toBe("Mastercard");
      expect(parsed?.terminalAcquirer).toBe("Stone");
      expect(parsed?.merchantOrBeneficiary).toContain("DROGARIA SAO PAULO");
      expect(parsed?.installments).toBeUndefined();
    });

    it("parseia slip PagBank Elo Crédito parcelado em 10x com resolução de bandeira Elo", () => {
      const pagbankSlip = `
PAGBANK
PAGSEGURO INTERNET S.A.
LOJA MOVEIS CONFORT
DATA: 23/10/2026 14:00
CARTAO ELO
CREDITO EM 10X
VALOR DA COMPRA: R$ 1.200,00
PARCELA: R$ 120,00
CARTAO: FINAL 6543
AUT: 789123
DOC: 456123
`;

      const parsed = parseUniversalReceipt(pagbankSlip);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("card_slip");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.amountCents).toBe(120000);
      expect(parsed?.installments?.count).toBe(10);
      expect(parsed?.installments?.installmentAmountCents).toBe(12000);
      expect(parsed?.cardLastDigits).toBe("6543");
      expect(parsed?.cardBrand).toBe("Elo");
      expect(parsed?.terminalAcquirer).toBe("PagBank");
      expect(parsed?.merchantOrBeneficiary).toContain("MOVEIS CONFORT");

      // Resolução direta pela bandeira Elo e banco
      const resolvedCard = resolveBestMatchingCard(MOCK_CARDS, {
        cardLastDigits: parsed?.cardLastDigits,
        cardBrand: parsed?.cardBrand,
      });
      expect(resolvedCard?.id).toBe("card-pagbank-elo");
      expect(resolvedCard?.brand).toBe("elo");
    });
  });

  describe("5. Boletos Bancários e Concessionárias", () => {
    it("parseia comprovante de pagamento de boleto Santander / Concessionária com linha digitável e CNPJ", () => {
      const boletoSample = `
BANCO SANTANDER (BRASIL) S.A.
COMPROVANTE DE PAGAMENTO DE TITULO / BOLETO
DATA DO PAGAMENTO: 21/10/2026
BENEFICIARIO: ENEL DISTRIBUICAO SP
CNPJ: 61.695.227/0001-93
PAGADOR: GABRIEL SALES
LINHA DIGITAVEL: 03399.12345 67890.123456 78901.234567 1 89010000015580
VALOR DO DOCUMENTO: R$ 155,80
VALOR COBRADO: R$ 155,80
AUTENTICACAO BANCARIA: 9A8B7C6D5E4F3G2
`;

      const parsed = parseUniversalReceipt(boletoSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("bank_slip_payment");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.paymentMethod).toBe("other");
      expect(parsed?.amountCents).toBe(15580);
      expect(parsed?.date).toBe("2026-10-21");
      expect(parsed?.merchantOrBeneficiary).toContain("ENEL DISTRIBUICAO");
      expect(parsed?.taxId).toBe("61695227000193");
      expect(parsed?.bankName).toBe("Santander");
      expect(parsed?.barcodeOrDigitableLine?.replace(/\D/g, "")).toBe(
        "03399123456789012345678901234567189010000015580",
      );
      expect(getReceiptKindLabel(parsed?.kind)).toBe("Boleto Bancário");
    });
  });

  describe("6. Cupom Fiscal Eletrônico (DANFE NFC-e)", () => {
    it("parseia DANFE NFC-e com chave de acesso de 44 dígitos e pagamento em Cartão de Crédito", () => {
      const nfceSample = `
SUPERMERCADO PAO DE ACUCAR
COMPANHIA BRASILEIRA DE DISTRIBUICAO
CNPJ: 47.508.411/0001-56
DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
QTD TOTAL DE ITENS: 5
VALOR TOTAL: R$ 345,60
FORMA DE PAGAMENTO: CARTAO DE CREDITO
VALOR PAGO: R$ 345,60
EMISSAO: 24/10/2026 19:40:12
CHAVE DE ACESSO:
3526 1047 5084 1100 0156 6500 1000 0123 4510 0987 6543
PROTOCOLO DE AUTORIZACAO: 135260012345678
`;

      const parsed = parseUniversalReceipt(nfceSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("invoice_danfe");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.amountCents).toBe(34560);
      expect(parsed?.date).toBe("2026-10-24");
      expect(parsed?.merchantOrBeneficiary).toContain("PAO DE ACUCAR");
      expect(parsed?.taxId).toBe("47508411000156");
      expect(parsed?.nfeAccessKey).toBe("35261047508411000156650010000123451009876543");
      expect(getReceiptKindLabel(parsed?.kind)).toBe("Cupom Fiscal");

      // Categorização inferida (alimentação / supermercado -> slug mercado)
      const identity = resolveMerchantIdentity({
        merchantOrDescription: parsed?.merchantOrBeneficiary,
        rawText: nfceSample,
        taxId: parsed?.taxId,
      });
      expect(identity.categorySlug).toBe("mercado");
    });
  });

  describe("7. Transferência Bancária Tradicional (TED Banco do Brasil para Caixa)", () => {
    it("parseia comprovante de TED do Banco do Brasil com banco de destino e remetente", () => {
      const tedSample = `
BANCO DO BRASIL
COMPROVANTE DE TRANSFERENCIA TED
DATA DA TRANSFERENCIA: 22/10/2026
VALOR: R$ 850,00
FAVORECIDO:
NOME: JOAO CARLOS SILVA
CPF: ***.456.789-**
BANCO: 104 - CAIXA ECONOMICA FEDERAL
AGENCIA: 0987 CONTA: 00012345-6
REMETENTE:
NOME: GABRIEL SALES
CONTA: 12345-6
DOCUMENTO / AUTENTICACAO: BB.TED.20261022.987654
FINALIDADE: 01 - CREDITO EM CONTA
`;

      const parsed = parseUniversalReceipt(tedSample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("wire_transfer");
      expect(parsed?.nature).toBe("expense");
      expect(parsed?.paymentMethod).toBe("transfer");
      expect(parsed?.amountCents).toBe(85000);
      expect(parsed?.date).toBe("2026-10-22");
      expect(parsed?.merchantOrBeneficiary).toContain("JOAO CARLOS SILVA");
      expect(parsed?.payerOrSource).toContain("GABRIEL SALES");
      expect(parsed?.bankName).toBe("Banco do Brasil");
      expect(getReceiptKindLabel(parsed?.kind)).toBe("Transferência Bancária");
    });
  });

  describe("8. Resiliência a Ruído Óptico de OCR", () => {
    it("parseia comprovante com ruídos ópticos comuns de OCR (barras verticais, pontuações ad-hoc e formatações coladas)", () => {
      const noisySample = `
| CIELO |
ESTABELECIMENTO : POSTO SHELL IPIRANGA
C.N.P.J. : 12.345.678/0001-99
DATA : 25/10/2026   18:40:00
VIA CLIENTE
CREDITO A VISTA
VALOR TOTAL R$185,50
CARTAO : VISA   FINAL : 9812
AUTORIZACAO: 778899
`;

      const parsed = parseUniversalReceipt(noisySample);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe("card_slip");
      expect(parsed?.amountCents).toBe(18550);
      expect(parsed?.date).toBe("2026-10-25");
      expect(parsed?.cardLastDigits).toBe("9812");
      expect(parsed?.cardBrand).toBe("Visa");
      expect(parsed?.terminalAcquirer).toBe("Cielo");
      expect(parsed?.merchantOrBeneficiary).toContain("POSTO SHELL");
    });
  });
});
