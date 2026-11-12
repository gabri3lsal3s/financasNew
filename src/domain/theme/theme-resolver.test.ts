import { describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_VARIANT,
  DEFAULT_THEME_SCHEDULE,
  THEME_COLORS,
  isDaytime,
  parseTimeToMinutes,
  resolveTheme,
} from "./theme-resolver";

describe("domain/theme/theme-resolver", () => {
  describe("parseTimeToMinutes", () => {
    it("converte strings HH:mm corretamente em minutos", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("06:00")).toBe(360);
      expect(parseTimeToMinutes("12:30")).toBe(750);
      expect(parseTimeToMinutes("18:00")).toBe(1080);
      expect(parseTimeToMinutes("23:59")).toBe(1439);
    });

    it("utiliza fallback para formatos inválidos ou nulos", () => {
      expect(parseTimeToMinutes("", 360)).toBe(360);
      expect(parseTimeToMinutes("abc", 720)).toBe(720);
      expect(parseTimeToMinutes("25:99", 0)).toBe(23 * 60 + 59);
    });
  });

  describe("isDaytime", () => {
    it("janela convencional (06:00 às 18:00): identifica dia e noite com precisão", () => {
      // Dia
      expect(isDaytime({ hours: 6, minutes: 0 }, "06:00", "18:00")).toBe(true);
      expect(isDaytime({ hours: 12, minutes: 0 }, "06:00", "18:00")).toBe(true);
      expect(isDaytime({ hours: 17, minutes: 59 }, "06:00", "18:00")).toBe(true);

      // Noite
      expect(isDaytime({ hours: 18, minutes: 0 }, "06:00", "18:00")).toBe(false);
      expect(isDaytime({ hours: 22, minutes: 0 }, "06:00", "18:00")).toBe(false);
      expect(isDaytime({ hours: 0, minutes: 0 }, "06:00", "18:00")).toBe(false);
      expect(isDaytime({ hours: 5, minutes: 59 }, "06:00", "18:00")).toBe(false);
    });

    it("janela personalizada (ex: 07:30 às 19:15)", () => {
      expect(isDaytime({ hours: 7, minutes: 29 }, "07:30", "19:15")).toBe(false);
      expect(isDaytime({ hours: 7, minutes: 30 }, "07:30", "19:15")).toBe(true);
      expect(isDaytime({ hours: 19, minutes: 14 }, "07:30", "19:15")).toBe(true);
      expect(isDaytime({ hours: 19, minutes: 15 }, "07:30", "19:15")).toBe(false);
    });

    it("janela invertida (ex: início do dia às 20:00 e noite às 06:00)", () => {
      expect(isDaytime({ hours: 21, minutes: 0 }, "20:00", "06:00")).toBe(true);
      expect(isDaytime({ hours: 2, minutes: 0 }, "20:00", "06:00")).toBe(true);
      expect(isDaytime({ hours: 10, minutes: 0 }, "20:00", "06:00")).toBe(false);
    });

    it("aceita objeto Date nativo", () => {
      const dayDate = new Date(2026, 10, 12, 14, 0, 0);
      const nightDate = new Date(2026, 10, 12, 23, 0, 0);

      expect(isDaytime(dayDate, "06:00", "18:00")).toBe(true);
      expect(isDaytime(nightDate, "06:00", "18:00")).toBe(false);
    });
  });

  describe("resolveTheme", () => {
    it("preferências manuais soberanas retornam o próprio tema diretamente", () => {
      expect(resolveTheme({ preference: "light", systemIsDark: true })).toBe("light");
      expect(resolveTheme({ preference: "dark", systemIsDark: false })).toBe("dark");
      expect(resolveTheme({ preference: "oled", systemIsDark: false })).toBe("oled");
    });

    describe("Modo Automático (system)", () => {
      it("se o SO estiver claro, resolve para 'light'", () => {
        expect(
          resolveTheme({
            preference: "system",
            systemIsDark: false,
          }),
        ).toBe("light");
      });

      it("se o SO estiver escuro, o padrão CANÔNICO deve ser 'dark' (Abissal Teal) e NÃO 'oled'", () => {
        const theme = resolveTheme({
          preference: "system",
          systemIsDark: true,
        });
        expect(theme).toBe("dark");
        expect(THEME_COLORS[theme]).toBe("#0C1923");
      });

      it("se o SO estiver escuro e o usuário tiver escolhido 'oled' como variante escura, resolve para 'oled'", () => {
        const theme = resolveTheme({
          preference: "system",
          systemIsDark: true,
          darkThemeVariant: "oled",
        });
        expect(theme).toBe("oled");
        expect(THEME_COLORS[theme]).toBe("#000000");
      });

      it("se o SO estiver escuro e a variante for explicitamente 'dark', resolve para 'dark'", () => {
        expect(
          resolveTheme({
            preference: "system",
            systemIsDark: true,
            darkThemeVariant: "dark",
          }),
        ).toBe("dark");
      });
    });

    describe("Modo Programado por Horário (schedule)", () => {
      it("durante o período diurno, resolve para 'light'", () => {
        const theme = resolveTheme({
          preference: "schedule",
          systemIsDark: true, // Ignora o SO pois segue o horário
          currentTime: { hours: 14, minutes: 0 },
          scheduleConfig: DEFAULT_THEME_SCHEDULE,
        });
        expect(theme).toBe("light");
      });

      it("durante o período noturno, o tema padrão é 'dark'", () => {
        const theme = resolveTheme({
          preference: "schedule",
          systemIsDark: false,
          currentTime: { hours: 21, minutes: 30 },
          scheduleConfig: DEFAULT_THEME_SCHEDULE,
        });
        expect(theme).toBe("dark");
      });

      it("durante o período noturno com variante 'oled', resolve para 'oled'", () => {
        const theme = resolveTheme({
          preference: "schedule",
          systemIsDark: false,
          currentTime: { hours: 22, minutes: 0 },
          darkThemeVariant: "oled",
          scheduleConfig: {
            ...DEFAULT_THEME_SCHEDULE,
            nightTheme: "oled",
          },
        });
        expect(theme).toBe("oled");
      });

      it("durante a virada exata para noite (18:00), comuta de 'light' para 'dark'", () => {
        const before = resolveTheme({
          preference: "schedule",
          systemIsDark: false,
          currentTime: { hours: 17, minutes: 59 },
        });
        const at = resolveTheme({
          preference: "schedule",
          systemIsDark: false,
          currentTime: { hours: 18, minutes: 0 },
        });
        expect(before).toBe("light");
        expect(at).toBe("dark");
      });
    });
  });

  describe("Constantes de tema", () => {
    it("DEFAULT_DARK_VARIANT é 'dark'", () => {
      expect(DEFAULT_DARK_VARIANT).toBe("dark");
    });

    it("THEME_COLORS mapeia as cores canônicas dos 3 temas", () => {
      expect(THEME_COLORS.light).toBe("#F4F7F9");
      expect(THEME_COLORS.dark).toBe("#0C1923");
      expect(THEME_COLORS.oled).toBe("#000000");
    });
  });
});
