import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceTab } from "./appearance-tab";
import * as nativeServices from "@/services/native";

vi.mock("@/state", () => ({
  useUserPreferences: () => ({
    data: {
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 5,
      custom_settings: {},
    },
    isLoading: false,
    error: null,
  }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateReminderPreferences: () => ({ mutate: vi.fn(), isPending: false }),
  useUserAccess: () => ({
    role: "admin",
    hasFeature: () => true,
  }),
}));

vi.mock("@/services/native", async () => {
  const actual = await vi.importActual<typeof nativeServices>("@/services/native");
  return {
    ...actual,
    isDailyReminderEnabled: vi.fn().mockReturnValue(false),
    setDailyReminderEnabled: vi.fn(),
    getDailyReminderTime: vi.fn().mockReturnValue("20:00"),
    setDailyReminderTime: vi.fn(),
    scheduleDailyReminder: vi.fn().mockResolvedValue(true),
    cancelDailyReminder: vi.fn().mockResolvedValue(undefined),
    requestNotificationPermissions: vi.fn().mockResolvedValue({ granted: true }),
  };
});

import { ThemeProvider } from "@/app/theme-provider";

function renderAppearanceTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppearanceTab />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AppearanceTab - Lembrete de Fechamento Diário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o controle de Lembrete de Fechamento Diário", () => {
    renderAppearanceTab();
    expect(screen.getByText("Lembrete de Fechamento Diário")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Habilitar Lembrete de Fechamento Diário" }),
    ).toBeInTheDocument();
  });

  it("permite ativar o lembrete diário solicitando agendamento", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const reminderCheckbox = screen.getByRole("checkbox", {
      name: "Habilitar Lembrete de Fechamento Diário",
    });
    expect(reminderCheckbox).not.toBeChecked();

    await user.click(reminderCheckbox);

    expect(nativeServices.requestNotificationPermissions).toHaveBeenCalled();
    expect(nativeServices.scheduleDailyReminder).toHaveBeenCalledWith({ hour: 20, minute: 0 });
    expect(nativeServices.setDailyReminderEnabled).toHaveBeenCalledWith(true);
  });
});
