import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemindersSettingsModal } from "./reminders-settings-modal";

const mockUpdateReminderPreferences = vi.fn();
const mockUpdateCustomSettings = vi.fn();

vi.mock("@/state", () => ({
  useUserPreferences: vi.fn(() => ({
    data: {
      reminders_enabled: true,
      reminder_days_before_bill: 3,
      reminder_days_before_debt: 3,
      custom_settings: {
        deviceNotifications: {
          dueNotificationsEnabled: false,
          dailyReminderEnabled: false,
          dailyReminderTime: "20:00",
        },
      },
    },
  })),
  useUpdateReminderPreferences: vi.fn(() => ({
    mutate: mockUpdateReminderPreferences,
  })),
  useUpdateCustomSettings: vi.fn(() => ({
    mutate: mockUpdateCustomSettings,
  })),
  useUserAccess: vi.fn(() => ({
    hasFeature: vi.fn(() => true),
  })),
}));

vi.mock("@/services/native", () => ({
  isDailyReminderEnabled: vi.fn(() => false),
  setDailyReminderEnabled: vi.fn(),
  isDueNotificationsEnabled: vi.fn(() => false),
  setDueNotificationsEnabled: vi.fn(),
  getDailyReminderTime: vi.fn(() => "20:00"),
  setDailyReminderTime: vi.fn(),
  scheduleDailyReminder: vi.fn(() => Promise.resolve(true)),
  cancelDailyReminder: vi.fn(() => Promise.resolve()),
  usePermissionsStatus: vi.fn(() => ({
    postNotificationsGranted: true,
    listenerGranted: true,
    isChecking: false,
    requestPostNotifications: vi.fn(() => Promise.resolve(true)),
  })),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("RemindersSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal quando aberto com títulos e seletores de antecedência", () => {
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Configurações de Lembretes")).toBeInTheDocument();
    expect(screen.getByText("Lembretes no Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByText("Notificações de Contas no Dispositivo")).toBeInTheDocument();
    expect(screen.getByText("Lembrete de Fechamento Diário")).toBeInTheDocument();
  });

  it("permite fechar através do botão Concluir", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<RemindersSettingsModal open={true} onOpenChange={onOpenChange} />);

    const finishBtn = screen.getByRole("button", { name: "Concluir" });
    await user.click(finishBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite alternar a ativação dos lembretes no app", async () => {
    const user = userEvent.setup();
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    const appRemindersCheckbox = screen.getByRole("checkbox", {
      name: "Habilitar Lembretes no Aplicativo",
    });
    expect(appRemindersCheckbox).toBeChecked();

    await user.click(appRemindersCheckbox);
    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({
      remindersEnabled: false,
    });
  });
});
