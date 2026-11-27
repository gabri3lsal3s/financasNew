import { afterEach, describe, expect, it } from "vitest";
import {
  formatBrtDisplayDate,
  formatBrtIsoDate,
  isValidCPF,
  isValidLuhn,
  isValidCardExpiry,
  sanitizePaymentLog,
} from "../../supabase/functions/_shared/asaas.ts";
import {
  buildCorsHeaders,
  extractClientIp,
  isOriginAllowed,
} from "../../supabase/functions/_shared/http.ts";

describe("Validações Financeiras e Sanitização PCI — Asaas", () => {
  describe("isValidCPF", () => {
    it("valida CPFs matematicamente válidos", () => {
      // CPFs canônicos de teste gerados com algoritmo oficial
      expect(isValidCPF("11144477735")).toBe(true);
      expect(isValidCPF("52998224725")).toBe(true);
      expect(isValidCPF("11144477736")).toBe(false); // Dígito verificador incorreto
    });

    it("rejeita sequências homogêneas", () => {
      expect(isValidCPF("00000000000")).toBe(false);
      expect(isValidCPF("11111111111")).toBe(false);
      expect(isValidCPF("99999999999")).toBe(false);
    });

    it("rejeita comprimentos divergentes de 11 dígitos", () => {
      expect(isValidCPF("")).toBe(false);
      expect(isValidCPF("123")).toBe(false);
      expect(isValidCPF("123456789012")).toBe(false);
    });

    it("ignora caracteres de formatação", () => {
      expect(isValidCPF("111.444.777-35")).toBe(true);
      expect(isValidCPF("529.982.247-25")).toBe(true);
    });
  });

  describe("isValidLuhn", () => {
    it("valida números de cartão válidos por Luhn (Mod 10)", () => {
      // Cartão de teste Visa válido por Luhn
      expect(isValidLuhn("4532015112830366")).toBe(true);
      // Cartão com 1 dígito trocado
      expect(isValidLuhn("4532015112830367")).toBe(false);
    });

    it("rejeita comprimentos inválidos", () => {
      expect(isValidLuhn("1234")).toBe(false);
      expect(isValidLuhn("12345678901234567890")).toBe(false);
    });

    it("ignora espaços e hífens", () => {
      expect(isValidLuhn("4532 0151 1283 0366")).toBe(true);
      expect(isValidLuhn("4532-0151-1283-0366")).toBe(true);
    });
  });

  describe("isValidCardExpiry", () => {
    const fixedNow = new Date("2026-11-09T12:00:00Z");

    it("aprova cartões com vencimento no mês corrente ou futuro", () => {
      expect(isValidCardExpiry("11", "2026", fixedNow)).toBe(true);
      expect(isValidCardExpiry("12", "2026", fixedNow)).toBe(true);
      expect(isValidCardExpiry("01", "2027", fixedNow)).toBe(true);
      expect(isValidCardExpiry("05", "27", fixedNow)).toBe(true);
    });

    it("rejeita cartões já vencidos", () => {
      expect(isValidCardExpiry("10", "2026", fixedNow)).toBe(false);
      expect(isValidCardExpiry("12", "2025", fixedNow)).toBe(false);
      expect(isValidCardExpiry("01", "24", fixedNow)).toBe(false);
    });

    it("rejeita meses fora da faixa 1-12", () => {
      expect(isValidCardExpiry("0", "2027", fixedNow)).toBe(false);
      expect(isValidCardExpiry("13", "2027", fixedNow)).toBe(false);
      expect(isValidCardExpiry("abc", "2027", fixedNow)).toBe(false);
    });
  });

  describe("sanitizePaymentLog", () => {
    it("redige CCV e preserva apenas os últimos 4 dígitos do cartão", () => {
      const sensitive = {
        plan: "monthly",
        customer: "cus_123",
        card: {
          holderName: "GABRIEL SALES",
          number: "4532015112830366",
          expiryMonth: "12",
          expiryYear: "2028",
          ccv: "123",
        },
      };

      const sanitized = sanitizePaymentLog(sensitive) as typeof sensitive;

      expect(sanitized.card.ccv).toBe("***");
      expect(sanitized.card.number).toBe("**** **** **** 0366");
      expect(sanitized.card.holderName).toBe("GABRIEL SALES");
      expect(sanitized.plan).toBe("monthly");
    });

    it("mascara objetos aninhados com chaves variadas (cvv, number)", () => {
      const payload = {
        creditCard: {
          number: "5555444433332222",
          cvv: "999",
        },
      };

      const sanitized = sanitizePaymentLog(payload) as typeof payload;
      expect(sanitized.creditCard.cvv).toBe("***");
      expect(sanitized.creditCard.number).toBe("**** **** **** 2222");
    });

    it("sanitiza strings livres e Errors com PAN (13-19 dígitos), CVV, CPF, e-mail e telefone preservando IDs (D-05)", () => {
      const rawMsg =
        'Erro ao enviar cartao 4532 0151 1283 0366 ccv=123 cpf=111.444.777-35 email=gabriel@axir.com.br phone=(11) 98765-4321 pay_9988776655443322 uuid=550e8400-e29b-41d4-a716-446655440000';
      const cleaned = sanitizePaymentLog(rawMsg);

      expect(cleaned).not.toContain("4532");
      expect(cleaned).toContain("**** **** **** 0366");
      expect(cleaned).not.toContain("123 ");
      expect(cleaned).toContain("ccv=***");
      expect(cleaned).not.toContain("111.444.777-35");
      expect(cleaned).not.toContain("gabriel@axir.com.br");
      expect(cleaned).not.toContain("98765-4321");
      expect(cleaned).toContain("pay_9988776655443322");
      expect(cleaned).toContain("550e8400-e29b-41d4-a716-446655440000");

      const amexErr = sanitizePaymentLog(new Error("Recusado PAN 378282246310005"));
      expect(amexErr).toContain("**** **** **** 0005");
      expect(amexErr).not.toContain("378282246310005");
    });
  });

  describe("Datas em BRT America/Sao_Paulo (D-07)", () => {
    it("mantém a data local BRT entre 21:00 e 23:59 mesmo quando UTC já virou para D+1", () => {
      // 2026-11-24 23:30:00 BRT = 2026-11-25 02:30:00 UTC
      const lateNightBrt = new Date("2026-11-25T02:30:00.000Z");
      expect(formatBrtIsoDate(lateNightBrt)).toBe("2026-11-24");
      expect(formatBrtDisplayDate(lateNightBrt)).toBe("24/11/2026");

      // Última noite de novembro em BRT (30/11 23:30 BRT = 01/12 02:30 UTC): cartão 11/2026 ainda é válido
      const lastNightNovBrt = new Date("2026-12-01T02:30:00.000Z");
      expect(isValidCardExpiry("11", "2026", lastNightNovBrt)).toBe(true);
    });
  });

  describe("Fronteira HTTP: CORS estrito e extração confiável de IP (D-13 / D-04)", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("bloqueia http:// e localhost em produção e remove asaas-access-token do CORS de browser", () => {
      process.env.ASAAS_ENVIRONMENT = "production";

      expect(isOriginAllowed("https://axir.com.br")).toBe(true);
      expect(isOriginAllowed("https://app.axir.com.br")).toBe(true);
      expect(isOriginAllowed("capacitor://localhost")).toBe(true);
      expect(isOriginAllowed("https://localhost")).toBe(true);

      expect(isOriginAllowed("http://axir.com.br")).toBe(false);
      expect(isOriginAllowed("http://localhost:5173")).toBe(false);
      expect(isOriginAllowed("https://preview.financasnew.pages.dev")).toBe(false);

      const req = new Request("https://example.supabase.co/functions/v1/asaas-checkout", {
        headers: { Origin: "https://axir.com.br" },
      });
      const headers = buildCorsHeaders(req);
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://axir.com.br");
      expect(headers["Access-Control-Allow-Headers"]).not.toContain("asaas-access-token");
    });

    it("prioriza cf-connecting-ip e ignora x-forwarded-for falsificável", () => {
      const spoofedReq = new Request("https://example.supabase.co/functions/v1/asaas-checkout", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
          "cf-connecting-ip": "177.10.20.30",
        },
      });
      expect(extractClientIp(spoofedReq)).toBe("177.10.20.30");

      const onlyXffReq = new Request("https://example.supabase.co/functions/v1/asaas-checkout", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(extractClientIp(onlyXffReq)).toBe("");
    });
    it("mascara e-mails e tokens PII em strings e campos novos (creditCardToken, remoteIp)", () => {
      const sanitized = sanitizePaymentLog({
        email: "usuario@axir.com.br",
        creditCardToken: "tok_asaas_secret",
        remoteIp: "177.12.34.56",
        postalCode: "01310100",
        addressNumber: "1000",
        phone: "11987654321",
        rawError: "Falha para usuario@axir.com.br com cartão 4111 2222 3333 4444",
      });

      expect(sanitized.email).toBe("us***@axir.com.br");
      expect(sanitized.creditCardToken).toBe("***");
      expect(sanitized.remoteIp).toBe("***");
      expect(sanitized.postalCode).toBe("***");
      expect(sanitized.addressNumber).toBe("***");
      expect(sanitized.phone).toBe("(XX) *****-****");
      expect(sanitized.rawError).not.toContain("4111 2222 3333 4444");
      expect(sanitized.rawError).not.toContain("usuario@axir.com.br");
    });

    it("mapeia mensagens de rejeição de cartão, endereço e antifraude do Asaas", async () => {
      const { mapAsaasCardErrorMessage } = await import("../../supabase/functions/_shared/asaas.ts");
      expect(mapAsaasCardErrorMessage("CEP informado é inválido.")).toContain("CEP ou número do endereço");
      expect(mapAsaasCardErrorMessage("Transação bloqueada pelo antifraude.")).toContain("análise de segurança");
      expect(mapAsaasCardErrorMessage("Número do cartão inválido.")).toContain("número inválido");
    });

    it("isola cliente Asaas por userId/externalReference sem reutilizar cliente de outro usuário por CPF", async () => {
      const { findOrCreateAsaasCustomer } = await import("../../supabase/functions/_shared/asaas.ts");
      const prevEnv = process.env.ASAAS_ENVIRONMENT;
      const prevKey = process.env.ASAAS_API_KEY;
      const prevFetch = globalThis.fetch;
      process.env.ASAAS_ENVIRONMENT = "sandbox";
      process.env.ASAAS_API_KEY = "$aact_hmlg_test_key";

      const calls: string[] = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method || "GET"} ${url}`);
        if (url.includes("/customers/cus_other_user")) {
          return new Response(
            JSON.stringify({
              id: "cus_other_user",
              deleted: false,
              email: "outro@exemplo.com",
              externalReference: "user-other",
            }),
            { status: 200 },
          );
        }
        if (url.includes("externalReference=user-nazare") || url.includes("email=nazare%40exemplo.com")) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }
        if ((init?.method || "GET") === "POST" && url.endsWith("/customers")) {
          const parsedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
          expect(parsedBody.externalReference).toBe("user-nazare");
          expect(parsedBody.email).toBe("nazare@exemplo.com");
          return new Response(JSON.stringify({ id: "cus_nazare_new" }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as typeof fetch;

      try {
        const res = await findOrCreateAsaasCustomer({
          userId: "user-nazare",
          existingCustomerId: "cus_other_user",
          name: "Maria Nazare",
          email: "nazare@exemplo.com",
          cpfCnpj: "52998224725",
        });
        expect(res.id).toBe("cus_nazare_new");
        expect(calls.some((c) => c.includes("cpfCnpj="))).toBe(false);
      } finally {
        globalThis.fetch = prevFetch;
        if (prevEnv === undefined) delete process.env.ASAAS_ENVIRONMENT;
        else process.env.ASAAS_ENVIRONMENT = prevEnv;
        if (prevKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = prevKey;
      }
    });

    it("liquida cobrança vencida em payAsaasPaymentWithCreditCard sanitizando campos de cartão e titular", async () => {
      const { payAsaasPaymentWithCreditCard } = await import("../../supabase/functions/_shared/asaas.ts");
      const prevEnv = process.env.ASAAS_ENVIRONMENT;
      const prevKey = process.env.ASAAS_API_KEY;
      const prevFetch = globalThis.fetch;
      process.env.ASAAS_ENVIRONMENT = "sandbox";
      process.env.ASAAS_API_KEY = "$aact_hmlg_test_key";

      let capturedUrl = "";
      let capturedBody: Record<string, unknown> = {};
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({ id: "pay_overdue_1", status: "CONFIRMED" }), { status: 200 });
      }) as typeof fetch;

      try {
        const res = await payAsaasPaymentWithCreditCard("pay_overdue_1", {
          creditCard: {
            holderName: "MARIA NAZARE",
            number: "4111 2222 3333 4444",
            expiryMonth: "5",
            expiryYear: "29",
            ccv: "123",
          },
          holderInfo: {
            name: "Maria Nazare",
            email: "nazare@exemplo.com",
            cpfCnpj: "529.982.247-25",
            postalCode: "01310-100",
            addressNumber: "100",
            phone: "(11) 98765-4321",
          },
          remoteIp: "177.10.20.30",
        });

        expect(res.status).toBe("CONFIRMED");
        expect(capturedUrl).toContain("/payments/pay_overdue_1/payWithCreditCard");
        expect(capturedBody.creditCard).toEqual({
          holderName: "MARIA NAZARE",
          number: "4111222233334444",
          expiryMonth: "05",
          expiryYear: "2029",
          ccv: "123",
        });
        expect(capturedBody.creditCardHolderInfo).toEqual({
          name: "Maria Nazare",
          email: "nazare@exemplo.com",
          cpfCnpj: "52998224725",
          postalCode: "01310100",
          addressNumber: "100",
          phone: "11987654321",
        });
      } finally {
        globalThis.fetch = prevFetch;
        if (prevEnv === undefined) delete process.env.ASAAS_ENVIRONMENT;
        else process.env.ASAAS_ENVIRONMENT = prevEnv;
        if (prevKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = prevKey;
      }
    });
  });
});
