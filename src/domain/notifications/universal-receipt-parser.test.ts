import { describe, expect, it } from "vitest";
import {
  getReceiptKindLabel,
  parseUniversalReceipt,
} from "./universal-receipt-parser";

describe("universal-receipt-parser (Orquestrador Universal)", () => {
  describe("1. Cupons Fiscais Eletrônicos (DANFE NFC-e / SAT)", () => {
    it("deve orquestrar e extrair comprovante DANFE NFC-e de supermercado", () => {
      const sample = `
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
        SUPERMERCADO PÃO DE AÇÚCAR LTDA
        CNPJ: 47.508.411/0001-56
        EMISSÃO: 15/04/2026 14:32:10
        QTD. TOTAL DE ITENS: 12
        VALOR TOTAL R$: 184,50
        FORMA DE PAGAMENTO: CARTÃO DE CRÉDITO
        CHAVE DE ACESSO:
        3526 0447 5084 1100 0156 6500 1000 1234 5610 9876 5432
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("invoice_danfe");
      expect(result?.amountCents).toBe(18450);
      expect(result?.date).toBe("2026-04-15");
      expect(result?.paymentMethod).toBe("credit_card");
      expect(result?.taxId).toBe("47508411000156");
      expect(result?.merchantOrBeneficiary).toContain("PÃO DE AÇÚCAR");
    });

    it("deve orquestrar DANFE NFC-e de farmácia com desconto", () => {
      const sample = `
        DROGA RAIA S.A.
        CNPJ: 61.585.865/0240-31
        DANFE NFC-e
        DATA: 10/05/2026 18:20
        TOTAL BRUTO: 55,00
        DESCONTO: 12,10
        VALOR A PAGAR R$: 42,90
        FORMA PAGTO: CARTÃO DE DÉBITO
        CHAVE DE ACESSO: 35260561585865024031650020000456121087654321
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("invoice_danfe");
      expect(result?.amountCents).toBe(4290);
      expect(result?.paymentMethod).toBe("debit");
      expect(result?.taxId).toBe("61585865024031");
    });

    it("deve orquestrar Extrato SAT fiscal", () => {
      const sample = `
        DROGARIA SÃO PAULO S.A.
        EXTRATO No. 000123456 DO SAT
        CNPJ: 61.412.110/0001-55
        DATA: 22/03/2026 11:15:00
        TOTAL R$: 68,00
        DINHEIRO: 68,00
        CHAVE DE ACESSO: 35260361412110000155590001234560000012345678
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("invoice_danfe");
      expect(result?.amountCents).toBe(6800);
      expect(result?.paymentMethod).toBe("cash");
    });
  });

  describe("2. Boletos Bancários, Títulos e Tributos", () => {
    it("deve orquestrar boleto de cobrança bancária do Santander", () => {
      const sample = `
        BANCO SANTANDER (BRASIL) S.A.
        COMPROVANTE DE PAGAMENTO DE TÍTULO
        LINHA DIGITÁVEL: 03399.12345 67890.123456 78901.234567 1 89000000125000
        BENEFICIÁRIO: ESCOLA DO FUTURO LTDA
        CNPJ: 12.345.678/0001-90
        DATA DO PAGAMENTO: 05/06/2026
        VALOR DO DOCUMENTO: R$ 1.250,00
        VALOR PAGO: R$ 1.250,00
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("bank_slip_payment");
      expect(result?.amountCents).toBe(125000);
      expect(result?.date).toBe("2026-06-05");
      expect(result?.merchantOrBeneficiary).toContain("ESCOLA DO FUTURO");
      expect(result?.paymentMethod).toBe("other");
    });

    it("deve orquestrar boleto bancário Bradesco com código de barras digitável", () => {
      const sample = `
        BANCO BRADESCO S.A.
        PAGAMENTO DE COBRANÇA
        23793.38128 60000.123456 01000.654321 9 91230000034000
        BENEFICIÁRIO: CONDOMÍNIO RESIDENCIAL PARQUE DAS FLORES
        DATA: 10/06/2026
        VALOR PAGO: R$ 340,00
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("bank_slip_payment");
      expect(result?.amountCents).toBe(34000);
      expect(result?.paymentMethod).toBe("other");
    });

    it("deve orquestrar conta de luz/energia ENEL", () => {
      const sample = `
        COMPROVANTE DE PAGAMENTO DE CONCESSIONÁRIA
        ENEL DISTRIBUIÇÃO SÃO PAULO
        CÓDIGO DE BARRAS: 846700000021 158001090114 260610202613 001234567890
        DATA DO PAGAMENTO: 12/06/2026
        VALOR: R$ 215,80
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("bank_slip_payment");
      expect(result?.amountCents).toBe(21580);
      expect(result?.merchantOrBeneficiary).toContain("ENEL");
    });

    it("deve orquestrar conta de água SABESP", () => {
      const sample = `
        PAGAMENTO DE CONTAS E CONVÊNIOS
        SABESP SANEAMENTO BÁSICO
        CÓDIGO DE BARRAS: 826400000009 941500123456 789012345678 123456789012
        DATA: 18/06/2026
        VALOR COBRADO: R$ 94,15
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("bank_slip_payment");
      expect(result?.amountCents).toBe(9415);
      expect(result?.merchantOrBeneficiary).toContain("SABESP");
    });

    it("deve orquestrar guia de tributo DARF Receita Federal", () => {
      const sample = `
        MINISTÉRIO DA FAZENDA
        SECRETARIA DA RECEITA FEDERAL DO BRASIL
        DOCUMENTO DE ARRECADAÇÃO DE RECEITAS FEDERAIS - DARF
        02 PERÍODO DE APURAÇÃO: 31/05/2026
        04 CÓDIGO DA RECEITA: 0588
        06 DATA DE VENCIMENTO: 20/06/2026
        07 VALOR DO PRINCIPAL: R$ 150,00
        VALOR TOTAL DO DOCUMENTO: R$ 150,00
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("bank_slip_payment");
      expect(result?.amountCents).toBe(15000);
      expect(result?.description).toContain("DARF");
    });
  });

  describe("3. Comprovantes de Transferências e Pagamentos Pix", () => {
    it("deve orquestrar comprovante Pix do Nubank", () => {
      const sample = `
        Comprovante de Transferência Pix
        Nubank
        Valor: R$ 85,00
        Data: 14/05/2026 - 15:30:12
        Destino:
        Nome: Gabriel Santos Silva
        CPF: ***.123.456-**
        Instituição: Nu Pagamentos S.A.
        Chave Pix: gabriel@email.com
        ID da transação: E1823612020260514153012345678901
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix");
      expect(result?.amountCents).toBe(8500);
      expect(result?.paymentMethod).toBe("pix");
      expect(result?.merchantOrBeneficiary).toContain("Gabriel Santos");
      expect(result?.bankName).toContain("Nubank");
    });

    it("deve orquestrar Pix por QR Code no Banco Inter", () => {
      const sample = `
        Banco Inter
        Comprovante de Pagamento Pix
        Valor pago: R$ 48,50
        Data e hora: 02/06/2026 às 12:45
        Recebedor: Restaurante Sabor da Terra
        CNPJ: 22.333.444/0001-55
        Banco do recebedor: Inter
        Tipo de transação: Pix QR Code
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix");
      expect(result?.amountCents).toBe(4850);
      expect(result?.merchantOrBeneficiary).toContain("Sabor da Terra");
    });

    it("deve orquestrar comprovante Pix Itaú Unibanco", () => {
      const sample = `
        Itaú Unibanco
        Comprovante de Pix Enviado
        Valor: R$ 200,00
        Data da operação: 20/06/2026 10:14:00
        Favorecido: Maria de Fátima Oliveira
        Chave Pix: 11987654321
        Instituição: Banco Bradesco S.A.
        Código de autenticação: ITPix987456123
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix");
      expect(result?.amountCents).toBe(20000);
      expect(result?.merchantOrBeneficiary).toContain("Maria de Fátima");
    });

    it("deve orquestrar comprovante Pix C6 Bank com EndToEndId", () => {
      const sample = `
        C6 Bank
        Comprovante de Envio Pix
        Valor transferido: R$ 135,20
        Data: 28/06/2026
        Para: Clínica Odontológica Sorriso Perfeito
        CNPJ: 33.444.555/0001-66
        EndToEndId: E3187249520260628102030405060708
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix");
      expect(result?.amountCents).toBe(13520);
      expect(result?.taxId).toBe("33444555000166");
    });
  });

  describe("4. Slips de Maquininhas de Cartão (POS / TEF)", () => {
    it("deve orquestrar comprovante Cielo Débito", () => {
      const sample = `
        PADARIA BELA VISTA
        CIELO
        VIA CLIENTE
        DATA: 10/05/2026 08:30:15
        DÉBITO À VISTA
        VISA ELECTRON
        CARTÃO: ****.****.****.1234
        VALOR: R$ 24,50
        AUTORIZAÇÃO: 054321
        DOC: 123456
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("card_slip");
      expect(result?.amountCents).toBe(2450);
      expect(result?.paymentMethod).toBe("debit");
      expect(result?.cardLastDigits).toBe("1234");
      expect(result?.cardBrand).toBe("Visa");
      expect(result?.merchantOrBeneficiary).toContain("PADARIA BELA VISTA");
    });

    it("deve orquestrar comprovante Stone Crédito à vista", () => {
      const sample = `
        RESTAURANTE FOGÃO MINEIRO
        STONE
        VIA DO CLIENTE
        DATA: 12/05/2026 13:10:00
        CRÉDITO À VISTA
        MASTERCARD
        FINAL: 4321
        VALOR TOTAL: R$ 96,00
        AUTORIZAÇÃO: 987654
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("card_slip");
      expect(result?.amountCents).toBe(9600);
      expect(result?.paymentMethod).toBe("credit_card");
      expect(result?.cardLastDigits).toBe("4321");
      expect(result?.cardBrand).toBe("Mastercard");
      expect(result?.merchantOrBeneficiary).toContain("FOGÃO MINEIRO");
    });

    it("deve orquestrar comprovante Rede Crédito Parcelado com acoplamento de parcelas", () => {
      const sample = `
        LOJA RENNER S.A.
        REDE
        VIA CLIENTE
        DATA: 25/05/2026 16:40:00
        CRÉDITO PARCELADO
        PARCELAS: 3X DE R$ 89,90
        VALOR TOTAL: R$ 269,70
        CARTÃO: ************5678
        BANDEIRA: ELO
        AUTORIZAÇÃO: 112233
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("card_slip");
      expect(result?.amountCents).toBe(26970);
      expect(result?.paymentMethod).toBe("credit_card");
      expect(result?.installments).toBeDefined();
      expect(result?.installments?.count).toBe(3);
      expect(result?.cardLastDigits).toBe("5678");
    });

    it("deve orquestrar comprovante PagBank Débito", () => {
      const sample = `
        MERCEARIA CENTRAL
        PAGBANK PAGSEGURO
        VIA DO CONSUMIDOR
        15/06/2026 19:22
        DÉBITO
        CARTÃO FINAL 9012
        VALOR: R$ 35,00
        DOC: 456789
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("card_slip");
      expect(result?.amountCents).toBe(3500);
      expect(result?.paymentMethod).toBe("debit");
      expect(result?.cardLastDigits).toBe("9012");
    });

    it("deve orquestrar comprovante Getnet Crédito Parcelado", () => {
      const sample = `
        ÓTICA VISÃO CLARA
        GETNET
        VIA CLIENTE
        DATA: 01/07/2026 14:00
        CRÉDITO PARCELADO LOJA
        PARC: 5X DE 120,00
        TOTAL: R$ 600,00
        VISA CRÉDITO
        AUT: 887766
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("card_slip");
      expect(result?.amountCents).toBe(60000);
      expect(result?.installments?.count).toBe(5);
    });
  });

  describe("5. Transferências Bancárias Tradicionais (TED / DOC / TEF)", () => {
    it("deve orquestrar comprovante TED Banco do Brasil para outro banco", () => {
      const sample = `
        BANCO DO BRASIL
        COMPROVANTE DE TRANSFERÊNCIA - TED
        DATA DA TRANSFERÊNCIA: 18/06/2026
        VALOR: R$ 1.800,00
        CONTA DE ORIGEM:
        AGÊNCIA: 1234-5  CONTA: 98765-4
        DADOS DO FAVORECIDO:
        NOME: CARLOS PEREIRA DA SILVA
        CPF: ***.987.654-**
        BANCO: 237 - BANCO BRADESCO S.A.
        AGÊNCIA: 4321 CONTA: 12345-6
        AUTENTICAÇÃO: BB.TED.20260618.998877
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("wire_transfer");
      expect(result?.amountCents).toBe(180000);
      expect(result?.merchantOrBeneficiary).toContain("CARLOS PEREIRA");
      expect(result?.paymentMethod).toBe("transfer");
    });

    it("deve orquestrar comprovante TED Caixa Econômica Federal", () => {
      const sample = `
        CAIXA ECONÔMICA FEDERAL
        COMPROVANTE DE TED
        DATA: 24/06/2026
        VALOR: R$ 550,00
        FAVORECIDO: LÚCIA MENDES SANTOS
        CPF: 123.456.789-00
        BANCO DESTINO: BANCO ITAÚ UNIBANCO
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("wire_transfer");
      expect(result?.amountCents).toBe(55000);
      expect(result?.merchantOrBeneficiary).toContain("LÚCIA MENDES");
    });

    it("deve orquestrar transferência entre contas do mesmo banco (TEF)", () => {
      const sample = `
        BANCO ITAÚ
        COMPROVANTE DE TRANSFERÊNCIA ENTRE CONTAS ITAÚ
        DATA: 30/06/2026
        VALOR DEBITADO: R$ 420,00
        CREDITADO EM:
        FAVORECIDO: RENATO ALVES MOREIRA
        AGÊNCIA: 0987 CONTA: 54321-0
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("wire_transfer");
      expect(result?.amountCents).toBe(42000);
      expect(result?.merchantOrBeneficiary).toContain("RENATO ALVES");
    });
  });

  describe("6. Recibos Avulsos Não Estruturados (Fallback Semântico)", () => {
    it("deve orquestrar recibo de aluguel avulso", () => {
      const sample = `
        RECIBO DE PAGAMENTO
        Recebi de ROBERTO SANTOS a quantia de R$ 2.200,00 (dois mil e duzentos reais)
        referente ao aluguel do imóvel situado à Rua das Palmeiras, 120.
        Data: 05/06/2026
        Emissor: IMOBILIÁRIA CENTRAL LTDA
        CNPJ: 10.203.405/0001-88
        Forma: PIX
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("generic");
      expect(result?.amountCents).toBe(220000);
      expect(result?.paymentMethod).toBe("pix");
      expect(result?.date).toBe("2026-06-05");
      expect(result?.taxId).toBe("10203405000188");
      expect(result?.payerOrSource).toContain("ROBERTO SANTOS");
    });

    it("deve orquestrar recibo de prestação de serviços com parcelamento no texto", () => {
      const sample = `
        RECIBO DE PRESTAÇÃO DE SERVIÇOS
        PRESTADOR: OFICINA DA MADEIRA MARCENARIA
        CLIENTE: MARIANA COSTA
        VALOR TOTAL: R$ 1.500,00
        PAGAMENTO: CARTÃO DE CRÉDITO EM 3X DE R$ 500,00
        DATA: 14/07/2026
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("generic");
      expect(result?.amountCents).toBe(150000);
      expect(result?.paymentMethod).toBe("credit_card");
      expect(result?.installments?.count).toBe(3);
      expect(result?.merchantOrBeneficiary).toContain("OFICINA DA MADEIRA");
    });
  });

  describe("7. Casos de Borda, Mensagens Rejeitadas e Normalização", () => {
    it("deve rejeitar mensagem de 2FA / código de confirmação por SMS", () => {
      const sample = "Nubank: Seu código de segurança é 489210. Não compartilhe com ninguém.";
      const result = parseUniversalReceipt(sample);
      expect(result).toBeNull();
    });

    it("deve rejeitar texto vazio, nulo ou com caracteres em branco", () => {
      expect(parseUniversalReceipt("")).toBeNull();
      expect(parseUniversalReceipt("    \n\t  ")).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(parseUniversalReceipt(null as any)).toBeNull();
    });

    it("deve rejeitar propaganda ou mensagem de texto sem valor monetário", () => {
      const sample = `
        Super Ofertas da Semana no Pão de Açúcar!
        Aproveite descontos especiais em vinhos e queijos.
        Visite nossa loja mais próxima ou compre pelo aplicativo.
      `;
      const result = parseUniversalReceipt(sample);
      expect(result).toBeNull();
    });

    it("deve limpar ruídos de OCR (pipes, múltiplos espaços, cabeçalhos de print) antes de analisar", () => {
      const sample = `
        100% 12:30
        |  CIELO  |
        VIA   DO   CLIENTE
        PADARIA   FLOR   DO   IPÊ
        DATA: 10/05/2026
        DÉBITO
        VALOR:   R$    18,50
      `;

      const result = parseUniversalReceipt(sample);
      expect(result).not.toBeNull();
      expect(result?.amountCents).toBe(1850);
      expect(result?.paymentMethod).toBe("debit");
    });
  });

  describe("8. getReceiptKindLabel (Rótulos Amigáveis em pt-BR)", () => {
    it("deve retornar rótulo adequado para cada categoria de comprovante", () => {
      expect(getReceiptKindLabel("card_slip")).toBe("Comprovante de Cartão");
      expect(getReceiptKindLabel("card_slip", 3)).toBe(
        "Comprovante de Cartão de Crédito (3x)",
      );
      expect(getReceiptKindLabel("pix")).toBe("Comprovante Pix");
      expect(getReceiptKindLabel("bank_slip_payment")).toBe("Boleto Bancário");
      expect(getReceiptKindLabel("invoice_danfe")).toBe("Cupom Fiscal");
      expect(getReceiptKindLabel("wire_transfer")).toBe("Transferência Bancária");
      expect(getReceiptKindLabel("generic")).toBe("Comprovante de Pagamento");
      expect(getReceiptKindLabel("generic", 2)).toBe(
        "Comprovante de Pagamento (2x)",
      );
      expect(getReceiptKindLabel("desconhecido")).toBe("Comprovante");
      expect(getReceiptKindLabel(undefined)).toBe("Comprovante");
    });
  });
});
