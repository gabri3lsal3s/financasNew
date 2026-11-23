import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIX_CITY,
  calculatePixCrc16,
  decodePixBrCode,
  detectPixKeyType,
  extractBrazilianPhoneLocalDigits,
  formatEmvField,
  formatPixAmount,
  generatePixBrCode,
  normalizePixKey,
  sanitizeMerchantText,
  sanitizePixCity,
  sanitizePixMerchantName,
  sanitizeTxId,
  stripInvisiblePixChars,
  validatePixBrCode,
} from "./pix-br-code";

describe("pix-br-code (Motor Puro de Geracao Pix Copia e Cola BACEN)", () => {
  describe("calculatePixCrc16 & formatEmvField", () => {
    it("valida o vetor de teste canonico universal do CRC16-CCITT (123456789 -> 29B1)", () => {
      expect(calculatePixCrc16("123456789")).toBe("29B1");
    });

    it("formata tags EMV usando contagem exata em bytes UTF-8 e calcula CRC16 em UTF-8", () => {
      expect(formatEmvField("0", "01")).toBe("000201");
      expect(formatEmvField("58", "BR")).toBe("5802BR");
      expect(formatEmvField("53", "986")).toBe("5303986");
      // "Café" possui 4 caracteres UTF-16, mas 5 bytes UTF-8
      expect(formatEmvField("02", "Café")).toBe("0205Café");
      // 50 caracteres "é" = 100 bytes UTF-8 -> excede o limite de 99 bytes
      expect(() => formatEmvField("02", "é".repeat(50))).toThrow();
    });
  });

  describe("Caso Oficial de Teste do Banco Central do Brasil (BACEN)", () => {
    it("gera exatamente o payload canonico oficial do manual do BACEN sem valor (omite Tag 01 no estatico)", () => {
      const payload = generatePixBrCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
        txId: "***",
      });

      const officialBacenPayload =
        "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

      expect(payload).toBe(officialBacenPayload);
      expect(payload.startsWith("00020126")).toBe(true);
      expect(payload.startsWith("000201010211")).toBe(false);
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded).not.toBeNull();
      expect(decoded?.pixKey).toBe("123e4567-e12b-12d1-a456-426655440000");
      expect(decoded?.merchantName).toBe("Fulano de Tal");
      expect(decoded?.merchantCity).toBe("BRASILIA");
      expect(decoded?.txId).toBe("***");
      expect(decoded?.pointOfInitiationMethod).toBeUndefined();
      expect(decoded?.amountCents).toBeUndefined();
      expect(decoded?.crc).toBe("1D3D");
      expect(decoded?.isValidCrc).toBe(true);
    });

    it("gera payload com valor definido em centavos (tag 54) e calcula CRC16 correto", () => {
      const payload = generatePixBrCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
        amountCents: 1000, // R$ 10,00
      });

      expect(payload.startsWith("00020126")).toBe(true);
      expect(payload.startsWith("000201010211")).toBe(false);
      expect(payload).toContain("540510.00");
      expect(payload.endsWith("6304288F")).toBe(true);
      expect(validatePixBrCode(payload)).toBe(true);

      const decoded = decodePixBrCode(payload);
      expect(decoded?.amountCents).toBe(1000);
      expect(decoded?.pointOfInitiationMethod).toBeUndefined();
      expect(decoded?.crc).toBe("288F");
      expect(decoded?.isValidCrc).toBe(true);
    });

    it("garante compatibilidade exata com thalesog/pix-utils, oneTime=true (010212) e cenario real de racha", () => {
      // Vetor canonico publicado pelo thalesog/pix-utils passa integralmente no nosso validador BACEN
      expect(
        validatePixBrCode(
          "00020126650014br.gov.bcb.pix0119nubank@thalesog.com0220Gerado por Pix-Utils52040000530398654041.005802BR5914Thales Ogliari6009Sao Paulo62070503***63046069",
        ),
      ).toBe(true);

      const pixUtilsVector = generatePixBrCode({
        pixKey: "nubank@thalesog.com",
        merchantName: "Thales Ogliari",
        merchantCity: "Sao Paulo",
        infoAdicional: "Gerado por Pix-Utils",
        amountCents: 100,
        txId: "***",
      });
      expect(pixUtilsVector).toBe(
        "00020126650014br.gov.bcb.pix0119nubank@thalesog.com0220Gerado por Pix Utils52040000530398654041.005802BR5914Thales Ogliari6009SAO PAULO62070503***6304E93F",
      );
      expect(validatePixBrCode(pixUtilsVector)).toBe(true);

      // oneTime: true emite 010212 (uso unico)
      const oneTimePayload = generatePixBrCode({
        pixKey: "gabriel@exemplo.com",
        merchantName: "Gabriel Sales",
        merchantCity: "ARACAJU",
        amountCents: 2500,
        oneTime: true,
      });
      expect(oneTimePayload.startsWith("000201010212")).toBe(true);
      expect(decodePixBrCode(oneTimePayload)?.pointOfInitiationMethod).toBe("12");
      expect(validatePixBrCode(oneTimePayload)).toBe(true);

      // Cenario de racha com R$ 26,12, chave e-mail sintetica e cidade longa truncada em 15 chars
      const realRacha = generatePixBrCode({
        pixKey: "anfitriao.teste@exemplo.com",
        keyType: "email",
        merchantName: "Gabriel Sales",
        merchantCity: "NOSSA SENHORA DO SOCORRO",
        amountCents: 2612,
        infoAdicional: "Aniversario de Yasmin",
        txId: "***",
      });
      expect(realRacha).toBe(
        "00020126740014br.gov.bcb.pix0127anfitriao.teste@exemplo.com0221Aniversario de Yasmin520400005303986540526.125802BR5913Gabriel Sales6015NOSSA SENHORA D62070503***63045D60",
      );
      expect(validatePixBrCode(realRacha)).toBe(true);
    });

    it("gera, valida e decodifica os 5 tipos de chave Pix (CPF, CNPJ, Email, Celular, Aleatoria) com valor definido", () => {
      const cases = [
        {
          pixKey: "529.982.247-25",
          keyType: "cpf" as const,
          expectedKey: "52998224725",
          amountCents: 4590,
        },
        {
          pixKey: "11.222.333/0001-81",
          keyType: "cnpj" as const,
          expectedKey: "11222333000181",
          amountCents: 12990,
        },
        {
          pixKey: "recebedor@exemplo.com.br",
          keyType: "email" as const,
          expectedKey: "recebedor@exemplo.com.br",
          amountCents: 2612,
        },
        {
          pixKey: "(079) 99988-7766",
          keyType: "phone" as const,
          expectedKey: "+5579999887766",
          amountCents: 7500,
        },
        {
          pixKey: "123E4567-E12B-12D1-A456-426655440000",
          keyType: "random" as const,
          expectedKey: "123e4567-e12b-12d1-a456-426655440000",
          amountCents: 199,
        },
      ];

      for (const item of cases) {
        const code = generatePixBrCode({
          pixKey: item.pixKey,
          keyType: item.keyType,
          merchantName: "Recebedor Teste",
          merchantCity: "ARACAJU",
          amountCents: item.amountCents,
          infoAdicional: "Racha Axir",
          txId: "***",
        });

        expect(code.startsWith("00020126")).toBe(true);
        expect(validatePixBrCode(code)).toBe(true);

        const decoded = decodePixBrCode(code);
        expect(decoded).not.toBeNull();
        expect(decoded?.pixKey).toBe(item.expectedKey);
        expect(decoded?.amountCents).toBe(item.amountCents);
        expect(decoded?.txId).toBe("***");
        expect(decoded?.pointOfInitiationMethod).toBeUndefined();
        expect(decoded?.isValidCrc).toBe(true);
      }
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
      expect(detectPixKeyType("79999887766")).toBe("phone");
      expect(detectPixKeyType("5579999887766")).toBe("phone");
      // 11 digitos com espacos internos e sem pontos (mesmo passando no Mod-11 do CPF) indicam celular
      expect(detectPixKeyType("11 9 8765 4374")).toBe("phone");
      expect(normalizePixKey("11 9 8765 4374")).toBe("+5511987654374");
    });

    it("normaliza telefone sem mascara para +55 automaticamente", () => {
      expect(normalizePixKey("79999887766")).toBe("+5579999887766");
      expect(normalizePixKey("5579999887766")).toBe("+5579999887766");
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

    it("normaliza telefone com prefixo 0 de operadora, DDI 0055 e caracteres invisiveis", () => {
      expect(stripInvisiblePixChars("\u200B\uFEFF+55\u00A0(11) 98765-4321\r\n")).toBe(
        "+55(11) 98765-4321",
      );
      expect(extractBrazilianPhoneLocalDigits("011987654321")).toBe("11987654321");
      expect(extractBrazilianPhoneLocalDigits("+55 (011) 98765-4321")).toBe("11987654321");
      expect(extractBrazilianPhoneLocalDigits("005579999887766")).toBe("79999887766");
      expect(normalizePixKey("011987654321")).toBe("+5511987654321");
      expect(normalizePixKey("0055\u200B79999887766")).toBe("+5579999887766");
      expect(normalizePixKey("\uFEFFana.teste@exemplo.com\u200B")).toBe("ana.teste@exemplo.com");
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

    it("sanitiza cidade de forma resiliente com remocao de UF, corte por palavra e fallback BRASILIA", () => {
      expect(sanitizePixCity("")).toEqual({
        value: DEFAULT_PIX_CITY,
        adjusted: false,
        usedFallback: true,
        reason: expect.stringContaining(DEFAULT_PIX_CITY),
      });

      expect(sanitizePixCity("12345")).toMatchObject({
        value: DEFAULT_PIX_CITY,
        adjusted: true,
        usedFallback: true,
      });

      expect(sanitizePixCity("???")).toMatchObject({
        value: DEFAULT_PIX_CITY,
        adjusted: true,
        usedFallback: true,
      });

      expect(sanitizePixCity("Aracaju - SE")).toMatchObject({
        value: "ARACAJU",
        adjusted: true,
        usedFallback: false,
      });

      expect(sanitizePixCity("São Paulo/SP")).toMatchObject({
        value: "SAO PAULO",
        adjusted: true,
        usedFallback: false,
      });

      expect(sanitizePixCity("Recife (PE)")).toMatchObject({
        value: "RECIFE",
        adjusted: true,
        usedFallback: false,
      });

      // Corta em fronteira de palavra sem deixar "NOSSA SENHORA D"
      expect(sanitizePixCity("Nossa Senhora do Socorro, SE")).toMatchObject({
        value: "NOSSA SENHORA",
        adjusted: true,
        usedFallback: false,
      });

      // Palavra unica maior que 15 letras corta em 15 caracteres
      expect(sanitizePixCity("PindamonhangabaCentro")).toMatchObject({
        value: "PINDAMONHANGABA",
        adjusted: true,
        usedFallback: false,
      });
    });

    it("sanitiza nome do recebedor de forma resiliente sem cortar palavras no meio", () => {
      expect(sanitizePixMerchantName("")).toMatchObject({
        value: "RECEBEDOR",
        adjusted: false,
        usedFallback: true,
      });

      expect(sanitizePixMerchantName("@@@")).toMatchObject({
        value: "RECEBEDOR",
        adjusted: true,
        usedFallback: true,
      });

      expect(sanitizePixMerchantName("João Carlos Pereira Vasconcelos")).toMatchObject({
        value: "Joao Carlos Pereira",
        adjusted: true,
        usedFallback: false,
      });
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

    it("rejeita strings que nao sao QR Codes EMV ou possuem estrutura TLV invalida", () => {
      expect(validatePixBrCode("texto qualquer")).toBe(false);
      expect(validatePixBrCode("")).toBe(false);
      expect(decodePixBrCode("texto qualquer")).toBeNull();

      // Payload com CRC recalculado mas faltando tag obrigatoria 60 (cidade)
      const missingCityBody = "00020126330014br.gov.bcb.pix0111529982247255204000053039865802BR5905Teste62070503***6304";
      const missingCity = `${missingCityBody}${calculatePixCrc16(missingCityBody)}`;
      expect(validatePixBrCode(missingCity)).toBe(false);

      // Payload com CRC recalculado mas GUI diferente de br.gov.bcb.pix
      const wrongGuiBody = "00020126330014br.gov.out.psp0111529982247255204000053039865802BR5905Teste6007ARACAJU62070503***6304";
      const wrongGui = `${wrongGuiBody}${calculatePixCrc16(wrongGuiBody)}`;
      expect(validatePixBrCode(wrongGui)).toBe(false);
    });

    it("lanca erro quando chave Pix excede limite BACEN de 77 bytes", () => {
      expect(() =>
        generatePixBrCode({
          pixKey: `${"a".repeat(70)}@exemplo.com`,
          keyType: "email",
          merchantName: "Recebedor",
          merchantCity: "ARACAJU",
        }),
      ).toThrow("77 caracteres");
    });

    it("normaliza barras e underlines em textos EMV sem quebrar validadores bancarios", () => {
      expect(sanitizeMerchantText("Pizza 1/3 _ Mesa_2", 25)).toBe("Pizza 1 3 Mesa 2");
    });

    it("lanca erro se formatEmvField exceder 99 caracteres", () => {
      expect(() => formatEmvField("26", "a".repeat(100))).toThrow();
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
