import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nativeServices from "@/services/native";
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
  isRemotePushEnabled: vi.fn(() => false),
  setRemotePushEnabled: vi.fn(),
  getQuietHoursConfig: vi.fn(() => ({ enabled: true, start: "22:00", end: "08:00" })),
  setQuietHoursConfig: vi.fn((patch) => ({ enabled: true, start: "22:00", end: "08:00", ...patch })),
  scheduleDailyReminder: vi.fn(() => Promise.resolve(false)),
  cancelDailyReminder: vi.fn(() => Promise.resolve()),
  clearAllDueNotifications: vi.fn(() => Promise.resolve()),
  dispatchLocalOrWebNotification: vi.fn(() => Promise.resolve(true)),
  isNativePlatform: vi.fn(() => true),
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
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
  });

  it("renderiza o modal quando aberto com títulos e seletores de antecedência", () => {
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Configurações de Lembretes")).toBeInTheDocument();
    expect(screen.getByText("Lembretes no Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByText("Notificações de Contas no Dispositivo")).toBeInTheDocument();
    expect(screen.getByText("Lembrete de Fechamento Diário")).toBeInTheDocument();
    expect(screen.getByText("Horário Silencioso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar notificação de teste/i })).toBeInTheDocument();
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

    const appRemindersSwitch = screen.getByRole("switch", {
      name: "Habilitar Lembretes no Aplicativo",
    });
    expect(appRemindersSwitch).toBeChecked();

    await user.click(appRemindersSwitch);
    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({
      remindersEnabled: false,
    });
    expect(nativeServices.clearAllDueNotifications).toHaveBeenCalledTimes(1);
  });

  it("sinaliza transparência na Web sobre disponibilidade do lembrete diário no App Android", () => {
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Disponível no App Android")).toBeInTheDocument();
    expect(
      screen.getByText(/navegadores Web não executam alarmes offline/i),
    ).toBeInTheDocument();
  });

  it("exibe o toggle de Push Remoto interativo e desligado por padrão no Android nativo", () => {
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    const remotePushSwitch = screen.getByRole("switch", {
      name: "Habilitar Notificações Push Remotas",
    });
    expect(remotePushSwitch).toBeEnabled();
    expect(remotePushSwitch).not.toBeChecked();
  });
});
