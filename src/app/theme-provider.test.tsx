import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

function TestConsumer() {
  const {
    theme,
    preference,
    setPreference,
    darkThemeVariant,
    setDarkThemeVariant,
    scheduleConfig,
    setScheduleConfig,
  } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <span data-testid="darkVariant">{darkThemeVariant}</span>
      <span data-testid="dayStart">{scheduleConfig.dayStart}</span>
      <span data-testid="nightStart">{scheduleConfig.nightStart}</span>
      <button type="button" onClick={() => setPreference("dark")}>
        Set Dark
      </button>
      <button type="button" onClick={() => setPreference("schedule")}>
        Set Schedule
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        Set System
      </button>
      <button type="button" onClick={() => setDarkThemeVariant("oled")}>
        Set OLED Variant
      </button>
      <button
        type="button"
        onClick={() => setScheduleConfig({ dayStart: "07:00", nightStart: "19:00" })}
      >
        Update Schedule
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("novo usuário sem preferências salvas inicia obrigatoriamente no modo 'system'", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("preference").textContent).toBe("system");
    expect(screen.getByTestId("darkVariant").textContent).toBe("dark");
  });

  it("sob prefers-color-scheme: dark, o tema padrão é 'dark' (Abissal Teal) e NÃO 'oled'", () => {
    // Mock matchMedia para simular SO em modo escuro
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("preference").textContent).toBe("system");
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("quando o usuário define a variante escura como 'oled', sob SO escuro ativa 'oled'", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme").textContent).toBe("dark");

    await user.click(screen.getByText("Set OLED Variant"));

    expect(screen.getByTestId("darkVariant").textContent).toBe("oled");
    expect(screen.getByTestId("theme").textContent).toBe("oled");
    expect(document.documentElement.dataset.theme).toBe("oled");
  });

  it("permite alterar para o modo 'schedule' e atualizar janelas de horário", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByText("Set Schedule"));
    expect(screen.getByTestId("preference").textContent).toBe("schedule");

    await user.click(screen.getByText("Update Schedule"));
    expect(screen.getByTestId("dayStart").textContent).toBe("07:00");
    expect(screen.getByTestId("nightStart").textContent).toBe("19:00");
  });

  it("permite selecionar temas manuais fixos e sincroniza no DOM", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByText("Set Dark"));
    expect(screen.getByTestId("preference").textContent).toBe("dark");
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
