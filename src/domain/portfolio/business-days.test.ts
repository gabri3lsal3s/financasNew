import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  countBusinessDays,
  countCalendarDays,
  getEasterSunday,
  getNationalHolidays,
  getNextBusinessDay,
  isBusinessDay,
  isWeekend,
} from "./business-days";

describe("business-days domain calculations", () => {
  it("calcula a data correta da Páscoa para diferentes anos", () => {
    // Páscoa 2024: 31 de Março
    expect(getEasterSunday(2024)).toEqual({ month: 3, day: 31 });
    // Páscoa 2025: 20 de Abril
    expect(getEasterSunday(2025)).toEqual({ month: 4, day: 20 });
    // Páscoa 2026: 05 de Abril
    expect(getEasterSunday(2026)).toEqual({ month: 4, day: 5 });
  });

  it("identifica feriados fixos e móveis no ano de 2025", () => {
    const holidays2025 = getNationalHolidays(2025);

    // Feriados fixos
    expect(holidays2025.has("2025-01-01")).toBe(true); // Ano Novo
    expect(holidays2025.has("2025-04-21")).toBe(true); // Tiradentes
    expect(holidays2025.has("2025-05-01")).toBe(true); // Dia do Trabalho
    expect(holidays2025.has("2025-09-07")).toBe(true); // Independência
    expect(holidays2025.has("2025-10-12")).toBe(true); // N. Sra Aparecida
    expect(holidays2025.has("2025-11-02")).toBe(true); // Finados
    expect(holidays2025.has("2025-11-15")).toBe(true); // Proclamação da República
    expect(holidays2025.has("2025-11-20")).toBe(true); // Consciência Negra (Lei 14.759)
    expect(holidays2025.has("2025-12-25")).toBe(true); // Natal

    // Feriados móveis 2025 (Páscoa em 20/04/2025)
    // Carnaval: 03/03 e 04/03/2025
    expect(holidays2025.has("2025-03-03")).toBe(true);
    expect(holidays2025.has("2025-03-04")).toBe(true);
    // Sexta-Feira Santa: 18/04/2025
    expect(holidays2025.has("2025-04-18")).toBe(true);
    // Corpus Christi: 19/06/2025
    expect(holidays2025.has("2025-06-19")).toBe(true);
  });

  it("identifica corretamente finais de semana", () => {
    expect(isWeekend("2026-08-22")).toBe(true); // Sábado
    expect(isWeekend("2026-08-23")).toBe(true); // Domingo
    expect(isWeekend("2026-08-24")).toBe(false); // Segunda-feira
    expect(isWeekend("2026-08-25")).toBe(false); // Terça-feira
  });

  it("identifica se uma data é dia útil bancário", () => {
    expect(isBusinessDay("2025-01-01")).toBe(false); // Feriado Ano Novo
    expect(isBusinessDay("2025-01-02")).toBe(true); // Quinta-feira útil
    expect(isBusinessDay("2025-01-04")).toBe(false); // Sábado
    expect(isBusinessDay("2025-01-05")).toBe(false); // Domingo
    expect(isBusinessDay("2025-03-03")).toBe(false); // Segunda de Carnaval
    expect(isBusinessDay("2025-03-04")).toBe(false); // Terça de Carnaval
  });

  it("conta dias úteis decorridos corretamente", () => {
    // Mesmo dia -> 0
    expect(countBusinessDays("2026-08-25", "2026-08-25")).toBe(0);
    // De Quinta (2026-08-20) para Sexta (2026-08-21) -> 1 dia útil
    expect(countBusinessDays("2026-08-20", "2026-08-21")).toBe(1);
    // De Sexta (2026-08-21) para Segunda (2026-08-24) -> 1 dia útil (pula sábado e domingo)
    expect(countBusinessDays("2026-08-21", "2026-08-24")).toBe(1);
    // De Sexta (2026-08-21) para Sexta seguinte (2026-08-28) -> 5 dias úteis
    expect(countBusinessDays("2026-08-21", "2026-08-28")).toBe(5);
    // Data final anterior -> 0
    expect(countBusinessDays("2026-08-28", "2026-08-21")).toBe(0);
  });

  it("conta dias corridos no calendário", () => {
    expect(countCalendarDays("2026-08-01", "2026-08-31")).toBe(30);
    expect(countCalendarDays("2026-08-25", "2026-08-25")).toBe(0);
  });

  it("adiciona dias úteis a uma data", () => {
    // Sexta-feira + 1 dia útil = Segunda-feira
    expect(addBusinessDays("2026-08-21", 1)).toBe("2026-08-24");
    // Sexta-feira + 5 dias úteis = Sexta-feira seguinte
    expect(addBusinessDays("2026-08-21", 5)).toBe("2026-08-28");
    // Adicionar 0 dias
    expect(addBusinessDays("2026-08-21", 0)).toBe("2026-08-21");
  });

  it("retorna o próximo dia útil a partir de uma data", () => {
    expect(getNextBusinessDay("2026-08-25")).toBe("2026-08-25"); // Já é dia útil
    expect(getNextBusinessDay("2026-08-22")).toBe("2026-08-24"); // Sábado -> Segunda
    expect(getNextBusinessDay("2026-08-23")).toBe("2026-08-24"); // Domingo -> Segunda
    expect(getNextBusinessDay("2025-01-01")).toBe("2025-01-02"); // Feriado -> Dia útil seguinte
  });
});
