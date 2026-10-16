import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsTab } from "./notifications-tab";
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
    isNotificationListenerGranted: vi.fn().mockResolvedValue(true),
    requestNotificationListenerPermission: vi.fn().mockResolvedValue(true),
    isNativePlatform: vi.fn().mockReturnValue(true),
  };
});

function renderNotificationsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsTab />
    </QueryClientProvider>,
  );
}

describe("NotificationsTab - Lembretes e Assistente Bancário (Fase 1 — Tarefa 1.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    nativeServices.resetBankAssistantPreferences();
    vi.clearAllMocks();
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
  });

  describe("Lembretes de Vencimento & Diário", () => {
    it("renderiza o controle de Lembrete Automático e Lembrete de Fechamento Diário", () => {
      renderNotificationsTab();
      expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Lembretes no Aplicativo" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Lembrete de Fechamento Diário")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Lembrete de Fechamento Diário" }),
      ).toBeInTheDocument();
    });

    it("permite ativar o lembrete diário solicitando agendamento", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

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

  describe("Assistente Passivo de Compras & Bancos (Android Nativo)", () => {
    it("renderiza a seção e o toggle mestre de captura passiva", () => {
      renderNotificationsTab();
      expect(screen.getByText("Assistente Passivo de Compras & Bancos")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Captura Passiva de Notificações" }),
      ).toBeChecked();
    });

    it("exibe os toggles de notificações com ação rápida, parcelas e inferência de categorias", () => {
      renderNotificationsTab();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Notificações com Ação Rápida" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Cálculo Automático de Parcelas" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Habilitar Inferência Automática de Categorias" }),
      ).toBeChecked();
    });

    it("permite alternar preferências individuais do assistente bancário", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      const quickAddCheckbox = screen.getByRole("checkbox", {
        name: "Habilitar Notificações com Ação Rápida",
      });
      await user.click(quickAddCheckbox);

      const prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.interactiveNotificationsEnabled).toBe(false);
    });

    it("permite desmarcar todos os bancos e marcar todos novamente", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      const deselectAllBtn = screen.getByRole("button", { name: "Desmarcar todos" });
      await user.click(deselectAllBtn);

      let prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks.length).toBe(0);

      const selectAllBtn = screen.getByRole("button", { name: "Marcar todos" });
      await user.click(selectAllBtn);

      prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks.length).toBe(17);
    });

    it("permite alternar o monitoramento de um banco individual", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      const nubankCheckbox = screen.getByRole("checkbox", { name: "Monitorar Nubank" });
      expect(nubankCheckbox).toBeChecked();

      await user.click(nubankCheckbox);

      const prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks).not.toContain("Nubank");
    });
  });

  describe("Ambiente Web / PWA (Ocultação Condicional)", () => {
    it("não renderiza o card nem opções do Assistente Passivo de Compras & Bancos na Web/PWA", () => {
      vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
      renderNotificationsTab();

      expect(screen.queryByText("Assistente Passivo de Compras & Bancos")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("checkbox", { name: "Habilitar Captura Passiva de Notificações" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: "Monitorar Nubank" })).not.toBeInTheDocument();
    });
  });
});
