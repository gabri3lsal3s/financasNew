import { describe, expect, it } from "vitest";
import {
  formatAdvisorThemeKey,
  formatCooldownExpiry,
  MEMORIZED_FEEDBACK_LABELS,
} from "./assistant-memory";

describe("assistant-memory (F30)", () => {
  describe("formatAdvisorThemeKey", () => {
    it("formata chaves com prefixo dup", () => {
      const result = formatAdvisorThemeKey("dup:netflix");
      expect(result.name).toBe("Netflix");
      expect(result.detail).toBe("Cobrança duplicada");
    });

    it("formata chaves com prefixo missing_expense", () => {
      const result = formatAdvisorThemeKey("missing_expense:aluguel");
      expect(result.name).toBe("Aluguel");
      expect(result.detail).toBe("Despesa pendente");
    });

    it("formata chaves com prefixo income", () => {
      const result = formatAdvisorThemeKey("income:salario");
      expect(result.name).toBe("Salario");
      expect(result.detail).toBe("Renda habitual");
    });

    it("formata chaves com prefixo aporte", () => {
      const result = formatAdvisorThemeKey("aporte:sobra_mensal");
      expect(result.name).toBe("Aporte mensal");
      expect(result.detail).toBe("Sugestão de aporte");
    });

    it("formata chaves simples sem prefixo", () => {
      const result = formatAdvisorThemeKey("spotify");
      expect(result.name).toBe("Spotify");
      expect(result.detail).toBeUndefined();
    });

    it("trata valores vazios de forma resiliente", () => {
      const result = formatAdvisorThemeKey("");
      expect(result.name).toBe("Desconhecido");
    });
  });

  describe("formatCooldownExpiry", () => {
    it("formata data no padrão DD/MM", () => {
      // 2026-11-22T12:00:00Z
      const date = new Date(2026, 10, 22, 12, 0, 0);
      expect(formatCooldownExpiry(date.getTime())).toBe("22/11");
    });

    it("retorna string vazia para timestamps inválidos", () => {
      expect(formatCooldownExpiry(NaN)).toBe("");
    });
  });

  describe("MEMORIZED_FEEDBACK_LABELS", () => {
    it("contém rótulos amigáveis sem emojis para todas as decisões", () => {
      expect(MEMORIZED_FEEDBACK_LABELS.already_cancelled).toBe("Já cancelei");
      expect(MEMORIZED_FEEDBACK_LABELS.one_off).toBe("É pontual");
      expect(MEMORIZED_FEEDBACK_LABELS.not_subscription).toBe("Não é assinatura");
      expect(MEMORIZED_FEEDBACK_LABELS.ignore).toBe("Ignorado");
      expect(MEMORIZED_FEEDBACK_LABELS.essential).toBe("Considerado essencial");
    });
  });
});
