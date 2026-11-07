import { describe, expect, it } from "vitest";
import { getLastBusinessDayOfMonth, isMarketClosedForMonth } from "./market-calendar";

describe("market-calendar: Calendário de Mercado B3", () => {
  describe("getLastBusinessDayOfMonth", () => {
    it("deve identificar o último dia útil de Outubro de 2026 (31 é sábado -> 30 é sexta)", () => {
      // 31 de Outubro de 2026 é Sábado
      const lastBizDay = getLastBusinessDayOfMonth(2026, 10);
      expect(lastBizDay).toBe("2026-10-30");
    });

    it("deve identificar o último dia útil de Fevereiro de 2024 (ano bissexto: 29 é quinta-feira)", () => {
      // 29/02/2024 é Quinta-feira útil
      const lastBizDay = getLastBusinessDayOfMonth(2024, 2);
      expect(lastBizDay).toBe("2024-02-29");
    });

    it("deve identificar o último dia útil de Dezembro de 2025 considerando ponto facultativo/feriado", () => {
      // 31/12/2025 é Quarta-feira (dia útil de pregão)
      const lastBizDay = getLastBusinessDayOfMonth(2025, 12);
      expect(lastBizDay).toBe("2025-12-31");
    });

    it("deve lançar erro para mês inválido (< 1 ou > 12)", () => {
      expect(() => getLastBusinessDayOfMonth(2026, 0)).toThrow();
      expect(() => getLastBusinessDayOfMonth(2026, 13)).toThrow();
    });
  });

  describe("isMarketClosedForMonth", () => {
    it("deve retornar falso antes das 19h BRT no último dia útil do mês", () => {
      // 30/10/2026 às 18h59 BRT (21:59 UTC)
      const refDate = new Date(Date.UTC(2026, 9, 30, 21, 59, 0));
      expect(isMarketClosedForMonth(2026, 10, refDate)).toBe(false);
    });

    it("deve retornar verdadeiro a partir das 19h BRT no último dia útil do mês", () => {
      // 30/10/2026 às 19h00 BRT (22:00 UTC)
      const refDate = new Date(Date.UTC(2026, 9, 30, 22, 0, 0));
      expect(isMarketClosedForMonth(2026, 10, refDate)).toBe(true);
    });

    it("deve retornar verdadeiro em dias posteriores do mês ou meses futuros", () => {
      // 31/10/2026 (sábado)
      const refDate = new Date(Date.UTC(2026, 9, 31, 12, 0, 0));
      expect(isMarketClosedForMonth(2026, 10, refDate)).toBe(true);

      // 01/11/2026
      const novDate = new Date(Date.UTC(2026, 10, 1, 10, 0, 0));
      expect(isMarketClosedForMonth(2026, 10, novDate)).toBe(true);
    });

    it("deve retornar falso no meio do mês", () => {
      const midMonth = new Date(Date.UTC(2026, 9, 15, 15, 0, 0));
      expect(isMarketClosedForMonth(2026, 10, midMonth)).toBe(false);
    });
  });
});
