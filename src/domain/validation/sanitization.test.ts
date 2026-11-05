import { describe, expect, it } from "vitest";
import {
  cleanTextSchema,
  MAX_MONEY_AMOUNT,
  MAX_MONEY_CENTS,
  moneyAmountSchema,
  moneyCentsSchema,
  normalizeEmail,
  sanitizeString,
} from "./sanitization";

describe("normalizeEmail — Normalizacao Defensiva de E-mails", () => {
  it("converte enderecos em maiusculas para minusculas", () => {
    expect(normalizeEmail("USUARIO@DOMINIO.COM")).toBe("usuario@dominio.com");
    expect(normalizeEmail("Gabriel.Sales@Empresa.COM.BR")).toBe("gabriel.sales@empresa.com.br");
  });

  it("remove espacos em branco nas extremidades (trim)", () => {
    expect(normalizeEmail("   usuario@dominio.com   ")).toBe("usuario@dominio.com");
    expect(normalizeEmail("\tuser@domain.org\n")).toBe("user@domain.org");
  });

  it("preserva caracteres especiais validos em e-mails (subenderecamento, pontos, hifens, underscores)", () => {
    expect(normalizeEmail("usuario+tag@gmail.com")).toBe("usuario+tag@gmail.com");
    expect(normalizeEmail("primeiro.ultimo@provedor.co.uk")).toBe("primeiro.ultimo@provedor.co.uk");
    expect(normalizeEmail("contato-financeiro@empresa-holding.com")).toBe("contato-financeiro@empresa-holding.com");
    expect(normalizeEmail("dev_teste@provedor.org")).toBe("dev_teste@provedor.org");
  });

  it("combina remocao de espacos, conversao para minusculas e caracteres especiais", () => {
    expect(normalizeEmail("  Usuario.Dev+Faturas@Holding-Corp.COM  ")).toBe("usuario.dev+faturas@holding-corp.com");
  });

  it("retorna string vazia para entradas nao-string ou vazias", () => {
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail("   ")).toBe("");
    expect(normalizeEmail(null as unknown as string)).toBe("");
    expect(normalizeEmail(undefined as unknown as string)).toBe("");
    expect(normalizeEmail(12345 as unknown as string)).toBe("");
    expect(normalizeEmail({} as unknown as string)).toBe("");
  });
});

describe("sanitization — Prevenção de XSS e Caracteres de Controle", () => {
  it("remove tags HTML perigosas para prevenir XSS", () => {
    expect(sanitizeString("<script>alert('xss')</script>")).toBe("alert('xss')");
    expect(sanitizeString("<iframe src='evil.com'></iframe>Conteúdo")).toBe("Conteúdo");
    expect(sanitizeString("<img src=x onerror=alert(1)>Compra de Mercado")).toBe("Compra de Mercado");
    expect(sanitizeString("Salário <b>Líquido</b>")).toBe("Salário Líquido");
  });

  it("remove null bytes e caracteres de controle perigosos", () => {
    const withNull = "Texto\u0000Com\u0000Null";
    expect(sanitizeString(withNull)).toBe("TextoComNull");

    const withControl = "Texto\u0001\u0007\u001F\u007F\u009FComControle";
    expect(sanitizeString(withControl)).toBe("TextoComControle");
  });

  it("preserva caracteres acentuados, números e espaços normais", () => {
    const legitimate = "Café da Manhã na Padaria São José · R$ 25,50";
    expect(sanitizeString(legitimate)).toBe("Café da Manhã na Padaria São José · R$ 25,50");
  });

  it("aplica trim em espaços nas extremidades", () => {
    expect(sanitizeString("   Conta de Luz   ")).toBe("Conta de Luz");
  });
});

describe("cleanTextSchema — Schema defensivo de texto Zod", () => {
  const schema = cleanTextSchema(50, { min: 2, requiredMessage: "Mínimo de 2 caracteres" });

  it("valida e sanitiza texto válido", () => {
    const result = schema.safeParse("  <b>Aluguel</b> de Janeiro  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Aluguel de Janeiro");
    }
  });

  it("rejeita textos que ficam menores que o mínimo após a sanitização", () => {
    const result = schema.safeParse("<b>a</b>");
    expect(result.success).toBe(false);
  });

  it("rejeita textos que excedem o limite de caracteres", () => {
    const result = schema.safeParse("A".repeat(51));
    expect(result.success).toBe(false);
  });
});

describe("moneyCentsSchema — Limites e Bounds em Centavos", () => {
  const strictCents = moneyCentsSchema();
  const allowZeroCents = moneyCentsSchema({ allowZero: true });

  it("rejeita valores decimais (deve ser inteiro em centavos)", () => {
    expect(strictCents.safeParse(100.5).success).toBe(false);
    expect(strictCents.safeParse(0.99).success).toBe(false);
  });

  it("rejeita valores negativos", () => {
    expect(strictCents.safeParse(-1).success).toBe(false);
    expect(allowZeroCents.safeParse(-500).success).toBe(false);
  });

  it("rejeita zero quando allowZero não é especificado", () => {
    expect(strictCents.safeParse(0).success).toBe(false);
    expect(allowZeroCents.safeParse(0).success).toBe(true);
  });

  it("rejeita valores que ultrapassam MAX_MONEY_CENTS (overflow guard)", () => {
    expect(strictCents.safeParse(MAX_MONEY_CENTS).success).toBe(true);
    expect(strictCents.safeParse(MAX_MONEY_CENTS + 1).success).toBe(false);
    expect(strictCents.safeParse(10 ** 15).success).toBe(false);
  });

  it("aceita centavos legítimos", () => {
    expect(strictCents.safeParse(1).success).toBe(true);
    expect(strictCents.safeParse(150000).success).toBe(true); // R$ 1.500,00
  });
});

describe("moneyAmountSchema — Limites e Bounds em Unidade Principal", () => {
  const strictAmount = moneyAmountSchema();
  const allowZeroAmount = moneyAmountSchema({ allowZero: true });

  it("rejeita valores com mais de 2 casas decimais", () => {
    expect(strictAmount.safeParse(10.555).success).toBe(false);
    expect(strictAmount.safeParse(0.001).success).toBe(false);
  });

  it("aceita até 2 casas decimais legítimas", () => {
    expect(strictAmount.safeParse(10.5).success).toBe(true);
    expect(strictAmount.safeParse(10.55).success).toBe(true);
    expect(strictAmount.safeParse(100).success).toBe(true);
  });

  it("rejeita valores acima de MAX_MONEY_AMOUNT", () => {
    expect(strictAmount.safeParse(MAX_MONEY_AMOUNT).success).toBe(true);
    expect(strictAmount.safeParse(MAX_MONEY_AMOUNT + 0.01).success).toBe(false);
    expect(strictAmount.safeParse(10 ** 12).success).toBe(false);
  });

  it("rejeita valores negativos ou zero conforme regra", () => {
    expect(strictAmount.safeParse(-10).success).toBe(false);
    expect(strictAmount.safeParse(0).success).toBe(false);
    expect(allowZeroAmount.safeParse(0).success).toBe(true);
  });
});
