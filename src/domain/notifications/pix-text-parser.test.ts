import { describe, it, expect } from "vitest";
import {
  detectPixKey,
  extractAmountCentsFromText,
  extractRecipientFromText,
  inferNatureFromText,
  parsePixFreeText,
  parsePixUrl,
} from "./pix-text-parser";

describe("pix-text-parser", () => {
  describe("detectPixKey", () => {
    it("detecta chave aleatória EVP (UUIDv4)", () => {
      const key = "123e4567-e89b-12d3-a456-426614174000";
      const result = detectPixKey(key);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("evp");
      expect(result?.normalizedKey).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("detecta chave e-mail", () => {
      const result = detectPixKey("contato@lojinha.com.br");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("email");
      expect(result?.normalizedKey).toBe("contato@lojinha.com.br");
    });

    it("detecta chave CNPJ formatada e desformatada", () => {
      const res1 = detectPixKey("12.345.678/0001-90");
      expect(res1?.type).toBe("cnpj");
      expect(res1?.normalizedKey).toBe("12345678000190");

      const res2 = detectPixKey("12345678000190");
      expect(res2?.type).toBe("cnpj");
      expect(res2?.normalizedKey).toBe("12345678000190");
    });

    it("detecta chave CPF formatada e desformatada", () => {
      const res1 = detectPixKey("123.456.789-00");
      expect(res1?.type).toBe("cpf");
      expect(res1?.normalizedKey).toBe("12345678900");

      const res2 = detectPixKey("12345678900");
      expect(res2?.type).toBe("cpf");
      expect(res2?.normalizedKey).toBe("12345678900");
    });

    it("detecta chave telefone celular brasileiro", () => {
      const res1 = detectPixKey("(11) 98765-4321");
      expect(res1?.type).toBe("phone");
      expect(res1?.normalizedKey).toBe("5511987654321");

      const res2 = detectPixKey("+55 21 99999-8888");
      expect(res2?.type).toBe("phone");
      expect(res2?.normalizedKey).toBe("5521999998888");
    });

    it("retorna null para texto genérico", () => {
      expect(detectPixKey("Olá, tudo bem?")).toBeNull();
      expect(detectPixKey("")).toBeNull();
    });
  });

  describe("extractAmountCentsFromText", () => {
    it("extrai valores em formato brasileiro", () => {
      expect(extractAmountCentsFromText("Valor: R$ 1.250,50")).toBe(125050);
      expect(extractAmountCentsFromText("Pix de 45,90")).toBe(4590);
    });

    it("extrai valores inteiros com moeda", () => {
      expect(extractAmountCentsFromText("R$ 100")).toBe(10000);
    });

    it("retorna 0 para textos sem valor", () => {
      expect(extractAmountCentsFromText("chave pix contato@loja.com")).toBe(0);
    });
  });

  describe("extractRecipientFromText", () => {
    it("extrai nome de favorecido", () => {
      expect(extractRecipientFromText("Pagar para Padaria Central")).toBe("Padaria Central");
      expect(extractRecipientFromText("Favorecido: João da Silva")).toBe("João da Silva");
    });
  });

  describe("inferNatureFromText", () => {
    it("identifica despesa por padrão", () => {
      expect(inferNatureFromText("Pix de R$ 50 para o almoço")).toBe("expense");
    });

    it("identifica receita para mensagens de recebimento", () => {
      expect(inferNatureFromText("Você recebeu um Pix de R$ 150,00")).toBe("income");
      expect(inferNatureFromText("Transferência recebida no valor de R$ 300")).toBe("income");
    });
  });

  describe("parsePixUrl", () => {
    it("extrai dados de links com query params", () => {
      const url = "https://pix.bcb.gov.br/qr/cob?valor=75.50&chave=11988887777&nome=Restaurante+Bom+Gosto";
      const result = parsePixUrl(url);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix_link");
      expect(result?.amountCents).toBe(7550);
      expect(result?.recipientName).toContain("Restaurante Bom Gosto");
    });
  });

  describe("parsePixFreeText", () => {
    it("faz o parsing de mensagem do WhatsApp com chave e valor", () => {
      const text = "Segue a chave Pix da padaria: contato@padaria.com.br no valor de R$ 32,50 para o café";
      const result = parsePixFreeText(text);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix_message");
      expect(result?.amountCents).toBe(3250);
      expect(result?.pixKey).toBe("contato@padaria.com.br");
      expect(result?.nature).toBe("expense");
    });

    it("faz o parsing de chave Pix avulsa", () => {
      const text = "fulano@exemplo.com";
      const result = parsePixFreeText(text);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe("pix_key");
      expect(result?.pixKey).toBe("fulano@exemplo.com");
      expect(result?.amountCents).toBe(0);
    });

    it("retorna null para textos sem relação com Pix", () => {
      expect(parsePixFreeText("Reunião agendada para amanhã às 14h")).toBeNull();
    });
  });
});
