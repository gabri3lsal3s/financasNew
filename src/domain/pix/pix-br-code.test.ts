import { describe, expect, it } from "vitest";
import {
  calculatePixCrc16,
  decodePixBrCode,
  detectPixKeyType,
  formatEmvField,
  formatPixAmount,
  generatePixBrCode,
  normalizePixKey,
  sanitizeMerchantText,
  sanitizeTxId,
  validatePixBrCode,
} from "./pix-br-code";

describe("pix-br-code (Motor Puro de Geracao Pix Copia e Cola BACEN)", () => {
  describe("calculatePixCrc16 & formatEmvField", () => {
    it("valida o vetor de teste canonico universal do CRC16-CCITT (123456789 -> 29B1)", () => {
      expect(calculatePixCrc16("123456789")).toBe("29B1");
    });

    it("formata tags EMV com padding correto de 2 digitos para ID e tamanho", () => {
      expect(formatEmvField("0", "01")).toBe("000201");
      expect(formatEmvField("58", "BR")).toBe("5802BR");
      expect(formatEmvField("53", "986")).toBe("5303986");
    });
  });

  describe("Caso Oficial de Teste do Banco Central do Brasil (BACEN)", () => {
    it("gera exatamente o payload canonico oficial do manual do BACEN sem valor", () => {
      const payload = generatePixBrCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
        txId: "***",
      });

      // Inclui a Tag 010211 (Point of Initiation Method: Estático) imediatamente após a Tag 00 (000201)
      const officialBacenPayloadWithTag01 =
        "00020101021126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***630448CD";

      expect(payload).toBe(officialBacenPayloadWithTag01);
      expect(payload.startsWith("000201010211")).toBe(true);
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded).not.toBeNull();
      expect(decoded?.pixKey).toBe("123e4567-e12b-12d1-a456-426655440000");
      expect(decoded?.merchantName).toBe("Fulano de Tal");
      expect(decoded?.merchantCity).toBe("BRASILIA");
      expect(decoded?.txId).toBe("***");
      expect(decoded?.pointOfInitiationMethod).toBe("11");
      expect(decoded?.amountCents).toBeUndefined();
      expect(decoded?.crc).toBe("48CD");
      expect(decoded?.isValidCrc).toBe(true);
    });

    it("gera payload com valor definido em centavos (tag 54) e calcula CRC16 correto", () => {
      const payload = generatePixBrCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
        amountCents: 1000, // R$ 10,00
      });

      expect(payload.startsWith("000201010211")).toBe(true);
      expect(payload).toContain("540510.00");
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded?.amountCents).toBe(1000);
      expect(decoded?.pointOfInitiationMethod).toBe("11");
      expect(decoded?.crc).toBe(payload.slice(-4));
      expect(decoded?.isValidCrc).toBe(true);
    });
  });

  describe("Normalizacao e Deteccao de Chaves Pix", () => {
    it("detecta tipos de chaves com precisao", () => {
      expect(detectPixKeyType("usuario@email.com.br")).toBe("email");
      expect(detectPixKeyType("123e4567-e12b-12d1-a456-426655440000")).toBe("random");
      expect(detectPixKeyType("123.456.789-01")).toBe("cpf");
      expect(detectPixKeyType("12.345.678/0001-90")).toBe("cnpj");
      expect(detectPixKeyType("(11) 98765-4321")).toBe("phone");
      expect(detectPixKeyType("+5511987654321")).toBe("phone");
    });

    it("normaliza CPF removendo pontos e tracos", () => {
      expect(normalizePixKey("  123.456.789-01  ")).toBe("12345678901");
      expect(normalizePixKey("12345678901")).toBe("12345678901");
    });

    it("normaliza CNPJ removendo pontuacao", () => {
      expect(normalizePixKey("12.345.678/0001-90")).toBe("12345678000190");
    });

    it("normaliza telefone para formato internacional BACEN (+55...)", () => {
      expect(normalizePixKey("(11) 98765-4321")).toBe("+5511987654321");
      expect(normalizePixKey("+55 11 98765-4321")).toBe("+5511987654321");
      expect(normalizePixKey("+5511987654321")).toBe("+5511987654321");
      expect(normalizePixKey("11987654321", "phone")).toBe("+5511987654321");
    });

    it("normaliza e-mail para minusculas e trim", () => {
      expect(normalizePixKey("  Meu.Nome@Empresa.COM.BR  ")).toBe("meu.nome@empresa.com.br");
    });

    it("normaliza chave aleatoria para minusculas e trim", () => {
      expect(normalizePixKey(" 123E4567-E12B-12D1-A456-426655440000 ")).toBe(
        "123e4567-e12b-12d1-a456-426655440000"
      );
    });
  });

  describe("Sanitizacao de Textos (Merchant Name, City e TXID)", () => {
    it("remove acentos e caracteres especiais do nome, truncando a 25 caracteres", () => {
      expect(sanitizeMerchantText("José Carlos da Silva", 25)).toBe("Jose Carlos da Silva");
      expect(sanitizeMerchantText("Estabelecimento Supermercado Extra Longo Ltda", 25)).toBe(
        "Estabelecimento Supermerc"
      );
    });

    it("remove acentos, aplica caixa alta e trunca a cidade a 15 caracteres", () => {
      expect(sanitizeMerchantText("São Paulo", 15, true)).toBe("SAO PAULO");
      expect(sanitizeMerchantText("Florianópolis", 15, true)).toBe("FLORIANOPOLIS");
      expect(sanitizeMerchantText("São José do Rio Preto", 15, true)).toBe("SAO JOSE DO RIO");
    });

    it("sanitiza TXID para alfanumerico com fallback para ***", () => {
      expect(sanitizeTxId("PEDIDO12345")).toBe("PEDIDO12345");
      expect(sanitizeTxId("PED-123.45")).toBe("PED12345");
      expect(sanitizeTxId("")).toBe("***");
      expect(sanitizeTxId(undefined)).toBe("***");
      expect(sanitizeTxId("---")).toBe("***");
    });
  });

  describe("Formatacao de Valores Monetarios em Centavos", () => {
    it("formata valores fracionados e inteiros com 2 casas decimais", () => {
      expect(formatPixAmount(1)).toBe("0.01");
      expect(formatPixAmount(50)).toBe("0.50");
      expect(formatPixAmount(100)).toBe("1.00");
      expect(formatPixAmount(1050)).toBe("10.50");
      expect(formatPixAmount(123456)).toBe("1234.56");
    });

    it("rejeita valores negativos ou fracionados nao inteiros", () => {
      expect(() => formatPixAmount(-100)).toThrow();
      expect(() => formatPixAmount(10.5)).toThrow();
    });
  });

  describe("Campos Opcionais (infoAdicional e postalCode)", () => {
    it("injeta campo infoAdicional (tag 26.02) e decodifica corretamente", () => {
      const payload = generatePixBrCode({
        pixKey: "pix@empresa.com",
        merchantName: "Empresa XPTO",
        merchantCity: "CURITIBA",
        amountCents: 5000,
        infoAdicional: "Racha Pizza",
      });

      expect(payload).toContain("0211Racha Pizza");
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded?.infoAdicional).toBe("Racha Pizza");
      expect(decoded?.amountCents).toBe(5000);
    });

    it("injeta postalCode (tag 61) quando informado", () => {
      const payload = generatePixBrCode({
        pixKey: "pix@empresa.com",
        merchantName: "Empresa XPTO",
        merchantCity: "CURITIBA",
        postalCode: "80000-000",
      });

      expect(payload).toContain("610980000-000");
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded?.postalCode).toBe("80000-000");
    });

    it("suporta TXID customizado de ate 25 caracteres", () => {
      const payload = generatePixBrCode({
        pixKey: "12345678901",
        merchantName: "Maria Souza",
        merchantCity: "RECIFE",
        txId: "FATURA202611",
      });

      expect(payload).toContain("62160512FATURA202611");
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded?.txId).toBe("FATURA202611");
    });
  });

  describe("Validacao e Resiliencia a Erros de Integridade", () => {
    it("detecta payload corrompido ou adulterado pelo CRC16", () => {
      const validPayload = generatePixBrCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
      });

      expect(validatePixBrCode(validPayload)).toBe(true);

      // Adulterando 1 caractere no nome
      const tampered = validPayload.replace("Fulano de Tal", "Ciclano de Ta");
      expect(validatePixBrCode(tampered)).toBe(false);

      const decodedTampered = decodePixBrCode(tampered);
      expect(decodedTampered?.isValidCrc).toBe(false);
    });

    it("rejeita strings que nao sao QR Codes EMV", () => {
      expect(validatePixBrCode("texto qualquer")).toBe(false);
      expect(validatePixBrCode("")).toBe(false);
      expect(decodePixBrCode("texto qualquer")).toBeNull();
    });

    it("lanca erro se chave Pix estiver vazia", () => {
      expect(() =>
        generatePixBrCode({
          pixKey: "",
          merchantName: "Nome",
          merchantCity: "Cidade",
        })
      ).toThrow("Chave Pix e obrigatoria.");
    });

    it("lanca erro se nome do recebedor estiver vazio", () => {
      expect(() =>
        generatePixBrCode({
          pixKey: "pix@email.com",
          merchantName: "",
          merchantCity: "Cidade",
        })
      ).toThrow("Nome do recebedor (merchantName) e obrigatorio.");
    });

    it("lanca erro se cidade do recebedor estiver vazia", () => {
      expect(() =>
        generatePixBrCode({
          pixKey: "pix@email.com",
          merchantName: "Nome",
          merchantCity: "",
        })
      ).toThrow("Cidade do recebedor (merchantCity) e obrigatoria.");
    });

    it("lanca erro se valor em centavos for negativo ou fracionado", () => {
      expect(() =>
        generatePixBrCode({
          pixKey: "pix@email.com",
          merchantName: "Nome",
          merchantCity: "Cidade",
          amountCents: -500,
        })
      ).toThrow("Valor em centavos deve ser um numero inteiro nao-negativo.");

      expect(() =>
        generatePixBrCode({
          pixKey: "pix@email.com",
          merchantName: "Nome",
          merchantCity: "Cidade",
          amountCents: 10.5,
        })
      ).toThrow("Valor em centavos deve ser um numero inteiro nao-negativo.");
    });
  });
});
