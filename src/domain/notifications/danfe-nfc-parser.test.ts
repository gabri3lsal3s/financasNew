import { describe, expect, it } from "vitest";
import {
  cleanCorporateSuffixes,
  detectDanfePaymentMethod,
  extractDanfeAccessKey,
  extractDanfeIssuer,
  extractDanfeTotalCents,
  isDanfeNfcReceipt,
  parseDanfeNfcReceipt,
} from "./danfe-nfc-parser";

describe("danfe-nfc-parser — Parser Especializado de Cupons Fiscais (NFC-e / SAT) (Tarefa 2.4)", () => {
  it("detecta cupom fiscal NFC-e e Extrato SAT com marcadores característicos", () => {
    expect(
      isDanfeNfcReceipt(
        "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica",
      ),
    ).toBe(true);
    expect(isDanfeNfcReceipt("Extrato SAT CF-e Cupom Fiscal Eletrônico")).toBe(
      true,
    );
    expect(isDanfeNfcReceipt("Comprovante de transferência Pix")).toBe(false);
  });

  it("extrai chave de acesso de 44 dígitos mesmo espaçada", () => {
    const raw =
      "CHAVE DE ACESSO: 3526 1047 5084 1100 0156 6500 1000 0123 4510 0987 6543";
    expect(extractDanfeAccessKey(raw)).toBe(
      "35261047508411000156650010000123451009876543",
    );
  });

  it("detecta forma de pagamento a partir do texto do cupom", () => {
    expect(detectDanfePaymentMethod("FORMA DE PAGAMENTO: CARTAO DE CREDITO")).toBe(
      "credit_card",
    );
    expect(detectDanfePaymentMethod("PAGAMENTO: DEBITO")).toBe("debit");
    expect(detectDanfePaymentMethod("PAGO EM DINHEIRO")).toBe("cash");
    expect(detectDanfePaymentMethod("PAGAMENTO VIA PIX")).toBe("pix");
  });

  it("parseia cupom fiscal eletrônico completo", () => {
    const raw = `
      SUPERMERCADOS BH LTDA
      CNPJ: 04.641.376/0001-36
      DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      
      QTD TOTAL DE ITENS: 12
      VALOR TOTAL R$ 248,90
      VALOR A PAGAR R$ 248,90
      FORMA DE PAGAMENTO: CARTAO DE CREDITO
      
      EMISSAO: 24/10/2026 18:30:00
      CHAVE DE ACESSO:
      3126 1004 6413 7600 0136 6500 1000 0543 2110 0123 4567
    `;

    const parsed = parseDanfeNfcReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("invoice_danfe");
    expect(parsed?.nature).toBe("expense");
    expect(parsed?.amountCents).toBe(24890);
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.date).toBe("2026-10-24");
    expect(parsed?.merchantOrBeneficiary).toMatch(/supermercados bh/i);
    expect(parsed?.taxId).toBe("04641376000136");
    expect(parsed?.nfeAccessKey).toBe(
      "31261004641376000136650010000543211001234567",
    );
  });

  it("rejeita texto sem valor financeiro", () => {
    expect(parseDanfeNfcReceipt("DANFE NFC-e Emitida")).toBeNull();
  });

  describe("Busca Reversa Bottom-Up e Cupons com Múltiplos Itens (Fase 6 / Tarefas 6.1 e 6.2)", () => {
    it("isola o valor consolidado 'VALOR A PAGAR' em cupom com múltiplos itens e troco", () => {
      const multiItemReceipt = `
        DROGARIA SAO PAULO S.A.
        CNPJ: 61.412.110/0001-55
        DANFE NFC-e Documento Auxiliar
        
        001 7891058012345 DIPIRONA 500MG 1 UN X 8,50 8,50
        002 7891234567890 PARACETAMOL 750MG 2 UN X 12,00 24,00
        003 7899876543210 PROTETOR SOLAR 1 UN X 65,90 65,90
        
        QTD TOTAL DE ITENS: 3
        SUBTOTAL R$ 98,40
        DESCONTO R$ 8,40
        TOTAL LIQUIDO R$ 90,00
        VALOR A PAGAR R$ 90,00
        FORMA DE PAGAMENTO: DINHEIRO 100,00
        TROCO R$ 10,00
        
        EMISSAO: 25/10/2026 14:15:00
        CHAVE DE ACESSO:
        3526 1061 4121 1000 0155 6500 1000 0987 6510 0123 4567
      `;

      const cents = extractDanfeTotalCents(multiItemReceipt);
      expect(cents).toBe(9000); // R$ 90,00 (não 8,50 do item 1, nem 100,00 pago, nem 10,00 de troco)

      const parsed = parseDanfeNfcReceipt(multiItemReceipt);
      expect(parsed?.amountCents).toBe(9000);
      expect(parsed?.merchantOrBeneficiary).toMatch(/drogaria s[ãa]o paulo/i);
      expect(parsed?.taxId).toBe("61412110000155");
    });

    it("suporta totalizador com rótulo em uma linha e valor na linha seguinte", () => {
      const brokenLineReceipt = `
        MERCADO CENTRAL LTDA
        CNPJ: 11.222.333/0001-44
        EXTRATO SAT CF-e
        
        ITEM 001 PRODUTO A 15,00
        ITEM 002 PRODUTO B 35,00
        
        VALOR A PAGAR R$
        50,00
        
        FORMA PAGAMENTO: DEBITO
      `;

      expect(extractDanfeTotalCents(brokenLineReceipt)).toBe(5000);
    });

    it("higieniza sufixos societários (LTDA, S/A, ME, EPP) do nome do emitente", () => {
      expect(cleanCorporateSuffixes("SUPERMERCADOS BH LTDA")).toBe("SUPERMERCADOS BH");
      expect(cleanCorporateSuffixes("DROGARIA ARAUJO S/A")).toBe("DROGARIA ARAUJO");
      expect(cleanCorporateSuffixes("PADARIA DO ZE ME")).toBe("PADARIA DO ZE");
      expect(cleanCorporateSuffixes("RESTAURANTE SABOR EPP")).toBe("RESTAURANTE SABOR");
      expect(cleanCorporateSuffixes("FARMACIA CENTRAL - ME")).toBe("FARMACIA CENTRAL");
      expect(cleanCorporateSuffixes("COMERCIAL EIRELI")).toBe("COMERCIAL");

      const raw = `
        VIA CONSUMIDOR
        PANIFICADORA BELLA VISTA LTDA - EPP
        CNPJ: 12.345.678/0001-90
        VALOR A PAGAR R$ 35,50
      `;
      expect(extractDanfeIssuer(raw)).toBe("PANIFICADORA BELLA VISTA");
    });
  });

  describe("Portão de Qualidade 2 & 3 — Casos Reais Críticos de Cupons Fiscais", () => {
    it("Rede Moleza: prioriza 27000 centavos sobre itens de 19,90 e identifica dinheiro", () => {
      const raw = `
        ]
        | o AA
        CNPJ 88 709 S63/0001-02 | E.. 0962841714
        AVASSIS BRASIL, 2090 - CRISTO REDENTOR - Porto Alegre - RS
        Documento Auxiliar da Nota Fiscal Eletronica de Consumidor
        código qtde UN VI Unie VI. Total
        3834 BOLAS COURO 2UN 1990 3980
        Gbi69 FILTROLINHASTOM 6UN 3590 21540
        5501 PULVERIZADOR 3UN 786 2397
        Quantidade Total de Itens: 3
        Valor Total R$. 27917
        Desconto R$ 217
        Valor a Pagar R$: 270,00
        FORMA PAGAMENTO VALOR PAGO R$
        Dinheiro 270,00
      `;

      const cents = extractDanfeTotalCents(raw);
      expect(cents).toBe(27000); // R$ 270,00

      const parsed = parseDanfeNfcReceipt(raw);
      expect(parsed?.amountCents).toBe(27000);
      expect(parsed?.paymentMethod).toBe("cash");
      expect(parsed?.items?.length).toBeGreaterThanOrEqual(2);
    });

    it("Comprovante Adicional: prioriza 4300 centavos sobre cerveja de 6,00", () => {
      const raw = `
        EMPRESA TESTE
        RUA DAS OLIVEIRAS, 1234
        COMPROVANTE ADICIONAL DE VENDA
        38 CERVEJA LONGNECK UN
        1,000 x R$ 6,000 => R$ 6,000
        139 GATORADE UN
        1,000 x R$ 4,500 => R$ 4,500
        Total R$ 43,00
        Descontos R$ ---> 9,0
        Liquido R$ > 43,00
        DINHEIRO 43,0
      `;

      const cents = extractDanfeTotalCents(raw);
      expect(cents).toBe(4300); // R$ 43,00

      const parsed = parseDanfeNfcReceipt(raw);
      expect(parsed?.amountCents).toBe(4300);
      expect(parsed?.paymentMethod).toBe("cash");
    });

    it("Popularmed: prioriza valor líquido 139,52 sobre total bruto de 213,17 e desconto de 73,65", () => {
      const raw = `
        sf POPULARES, FARMACIAS
        MELLO E SIMON COMERCIO DE MEDICAMENTOS LTDA
        DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
        QTD TOTAL DE ITENS 3
        VALOR TOTAL R$ 213,17
        DESCONTO R$ 73,65
        TOTAL APAGAR R$ 139,52
        FORMA DE PAGAMENTO VALOR PAGO
        Cartão de débito 139,52
      `;

      const cents = extractDanfeTotalCents(raw);
      expect(cents).toBe(13952); // R$ 139,52

      const parsed = parseDanfeNfcReceipt(raw);
      expect(parsed?.amountCents).toBe(13952);
      expect(parsed?.paymentMethod).toBe("debit");
    });

    it("Cásiopea Beauty: ticket de PDV com cifrão simples e cartão de crédito", () => {
      const raw = `
        PDV Teste 1
        Cásiopea Beauty
        Juramento 5100, BH
        Subtotal (1 produto): $3.990,00
        TOTAL $3.990,00
        Meio de pagamento
        Cartão de crédito $3.990,00
      `;

      const cents = extractDanfeTotalCents(raw);
      expect(cents).toBe(399000); // R$ 3.990,00

      const parsed = parseDanfeNfcReceipt(raw);
      expect(parsed?.amountCents).toBe(399000);
      expect(parsed?.paymentMethod).toBe("credit_card");
    });
  });
});
