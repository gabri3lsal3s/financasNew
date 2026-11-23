import { describe, expect, it } from "vitest";
import {
  detectPixKey,
  extractAmountCentsFromText,
  extractPixKeyFromReceiptText,
  extractRecipientFromText,
  inferNatureFromText,
  parsePixFreeText,
} from "./pix-text-parser";

describe("pix-text-parser (Chaves Pix Estritas & Higiene Zero Falso Positivo)", () => {
  describe("detectPixKey (Golden Dataset G3 + G2 negativos)", () => {
    it("aceita CPF e CNPJ apenas quando matematicamente válidos (Módulo 11)", () => {
      expect(detectPixKey("123.456.789-09")).toEqual({
        rawKey: "123.456.789-09",
        normalizedKey: "12345678909",
        type: "cpf",
      });
      expect(detectPixKey("11.222.333/0001-81")).toEqual({
        rawKey: "11.222.333/0001-81",
        normalizedKey: "11222333000181",
        type: "cnpj",
      });
      expect(detectPixKey("18236120000158")?.type).toBe("cnpj");

      expect(detectPixKey("123.456.789-00")).toBeNull();
      expect(detectPixKey("111.111.111-11")).toBeNull();
      expect(detectPixKey("12.345.678/0001-90")).toBeNull();
      expect(detectPixKey("12345678900")).toBeNull();
    });

    it("aceita apenas UUID v4 estrito como chave aleatória EVP", () => {
      const validUuidV4 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
      expect(detectPixKey(validUuidV4)).toEqual({
        rawKey: validUuidV4,
        normalizedKey: validUuidV4,
        type: "evp",
      });

      // UUID v1 (versão != 4) e variantes inválidas devem ser rejeitados
      expect(detectPixKey("123e4567-e89b-12d3-a456-426614174000")).toBeNull();
      expect(detectPixKey("f47ac10b-58cc-4372-0567-0e02b2c3d479")).toBeNull();
      expect(detectPixKey("pedido-2026-4372-a567-0e02b2c3d479")).toBeNull();
    });

    it("aceita e-mail isolado <= 77 chars e celular com DDD oficial Anatel + 9o digito", () => {
      expect(detectPixKey("Pagamentos@Padaria.Com.Br")).toEqual({
        rawKey: "Pagamentos@Padaria.Com.Br",
        normalizedKey: "pagamentos@padaria.com.br",
        type: "email",
      });

      expect(detectPixKey("+55 (11) 98765-4321")).toEqual({
        rawKey: "+55 (11) 98765-4321",
        normalizedKey: "+5511987654321",
        type: "phone",
      });

      expect(detectPixKey("11987654321")?.normalizedKey).toBe("+5511987654321");

      // DDD inválido (20), telefone fixo (sem 9o dígito) e e-mail com .. devem falhar
      expect(detectPixKey("+55 20 98765-4321")).toBeNull();
      expect(detectPixKey("(11) 3333-4444")).toBeNull();
      expect(detectPixKey("user..name@example.com")).toBeNull();
    });

    it("suporta rótulo curto explícito <= 80 chars e rejeita frases longas", () => {
      const labeled = detectPixKey("Chave Pix: financeiro@empresa.com.br");
      expect(labeled).toEqual({
        rawKey: "financeiro@empresa.com.br",
        normalizedKey: "financeiro@empresa.com.br",
        type: "email",
      });

      expect(
        detectPixKey(
          "Oi tudo bem, esse aqui e meu celular +55 11 98765-4321 me manda os R$ 50,00 quando puder",
        ),
      ).toBeNull();
    });
  });

  describe("parsePixFreeText (somente chave isolada com valueCents === 0)", () => {
    it("retorna PIX_KEY com amountCents === 0 para chave isolada válida", () => {
      const result = parsePixFreeText("Chave Pix: 11.222.333/0001-81");
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("PIX_KEY");
      expect(result?.amountCents).toBe(0);
      expect(result?.pixKey).toBe("11222333000181");
      expect(result?.pixKeyType).toBe("cnpj");
    });

    it("rejeita links genéricos, conversas com telefone + valor e e-mails comerciais (G2)", () => {
      expect(parsePixFreeText("https://site.com/artigo-v2.50")).toBeNull();
      expect(parsePixFreeText("Me chama no 11987654321 ou manda R$ 50,00")).toBeNull();
      expect(
        parsePixFreeText("Prezado cliente, sua fatura de 45.00 vence amanha. Contato: sac@loja.com"),
      ).toBeNull();
      expect(parsePixFreeText("45,00")).toBeNull();
    });
  });

  describe("extractPixKeyFromReceiptText & auxiliares", () => {
    it("extrai chave rotulada dentro de texto de comprovante sem confundir dígitos soltos", () => {
      const receipt = "Comprovante Pix\nValor: R$ 45,00\nChave Pix: financeiro@cafesaojose.com.br";
      expect(extractPixKeyFromReceiptText(receipt)).toEqual({
        rawKey: "financeiro@cafesaojose.com.br",
        normalizedKey: "financeiro@cafesaojose.com.br",
        type: "email",
      });
    });

    it("extrai valores monetários com R$ ou vírgula e ignora versões com ponto sem R$", () => {
      expect(extractAmountCentsFromText("Transferencia de R$ 1.250,50 concluida")).toBe(125050);
      expect(extractAmountCentsFromText("Total 45,90")).toBe(4590);
      expect(extractAmountCentsFromText("Versao 2.50 ou porta 45.00")).toBe(0);
    });

    it("extrai destinatário e natureza corretamente", () => {
      expect(extractRecipientFromText("Pix enviado para Maria Clara Silva no valor de R$ 50,00")).toBe(
        "Maria Clara Silva",
      );
      expect(inferNatureFromText("Você recebeu um Pix de João")).toBe("income");
      expect(inferNatureFromText("Pix enviado para Padaria")).toBe("expense");
    });
  });
});
