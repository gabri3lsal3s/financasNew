import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nativeServices from "@/services/native";
import { RemindersSettingsModal } from "./reminders-settings-modal";

const mockUpdateReminderPreferences = vi.fn();
const mockUpdateCustomSettings = vi.fn();

let mockPostNotificationsGranted = true;
let mockCloudDueEnabled = false;

vi.mock("@/state", () => ({
  useUserPreferences: vi.fn(() => ({
    data: {
      reminders_enabled: true,
      reminder_days_before_bill: 3,
      reminder_days_before_debt: 3,
      custom_settings: {
        deviceNotifications: {
          dueNotificationsEnabled: mockCloudDueEnabled,
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
  requestNotificationPermissions: vi.fn(() => Promise.resolve({ granted: true })),
  isNativePlatform: vi.fn(() => true),
  usePermissionsStatus: vi.fn(() => ({
    postNotificationsGranted: mockPostNotificationsGranted,
    listenerGranted: true,
    isChecking: false,
    refresh: vi.fn(() => Promise.resolve()),
    requestPostNotifications: vi.fn(() => Promise.resolve(mockPostNotificationsGranted)),
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
    mockPostNotificationsGranted = true;
    mockCloudDueEnabled = false;
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
  });

  it("renderiza o modal quando aberto com títulos, seletores de antecedência e switch unificado no dispositivo", () => {
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Configurações de Lembretes")).toBeInTheDocument();
    expect(screen.getByText("Lembretes no Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByText("Alertas neste Aparelho (Contas, Pix e Avisos)")).toBeInTheDocument();
    expect(screen.getByText("Lembrete de Fechamento Diário")).toBeInTheDocument();
    expect(screen.queryByText("Horário Silencioso")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Enviar notificação de teste/i }),
    ).not.toBeInTheDocument();
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

  it("suprime o Lembrete de Fechamento Diário na Web e exibe Horário Silencioso recolhido quando há alerta ativo", async () => {
    const user = userEvent.setup();
    mockCloudDueEnabled = true;
    mockPostNotificationsGranted = true;
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Lembrete de Fechamento Diário")).not.toBeInTheDocument();
    expect(screen.getByText("Ativado neste aparelho")).toBeInTheDocument();
    expect(screen.getByText("Horário Silencioso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar notificação de teste/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Início do horário silencioso")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Alterar horário" }));
    expect(screen.getByLabelText("Início do horário silencioso")).toBeInTheDocument();
  });

  it("verdade de estado: não exibe alertas no dispositivo ligados quando a permissão do sistema estiver pendente", () => {
    mockPostNotificationsGranted = false;
    mockCloudDueEnabled = true;
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    const unifiedSwitch = screen.getByRole("switch", {
      name: "Habilitar Alertas neste Aparelho",
    });
    expect(unifiedSwitch).not.toBeChecked();
    expect(screen.getByText("Permissão Pendente")).toBeInTheDocument();
  });

  it("exibe o switch mestre unificado de alertas no aparelho interativo e desligado por padrão no Android nativo", () => {
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
    render(<RemindersSettingsModal open={true} onOpenChange={vi.fn()} />);

    const unifiedSwitch = screen.getByRole("switch", {
      name: "Habilitar Alertas neste Aparelho",
    });
    expect(unifiedSwitch).toBeEnabled();
    expect(unifiedSwitch).not.toBeChecked();
  });
});
