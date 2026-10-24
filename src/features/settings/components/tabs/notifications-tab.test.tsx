import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsTab } from "./notifications-tab";
import * as nativeServices from "@/services/native";
import { DEFAULT_BANK_ASSISTANT_PREFERENCES } from "@/domain/notifications";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

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
    getInstalledBankingApps: vi
      .fn()
      .mockResolvedValue({ installedBankNames: [], installedPackages: [], apps: [] }),
    isNativePlatform: vi.fn().mockReturnValue(true),
  };
});

function renderNotificationsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationsTab />
      </QueryClientProvider>
    </MemoryRouter>,
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

    it("permite desmarcar todos os bancos e marcar todos novamente através do catálogo", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      // Abre o acordeão do catálogo completo
      const catalogAccordion = screen.getByRole("button", {
        name: /Explorar catálogo completo/i,
      });
      await user.click(catalogAccordion);

      const deselectAllBtn = screen.getByRole("button", { name: "Desmarcar todos" });
      await user.click(deselectAllBtn);

      let prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks.length).toBe(0);

      const selectAllBtn = screen.getByRole("button", { name: "Marcar todos" });
      await user.click(selectAllBtn);

      prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks.length).toBe(27);
    });

    it("permite alternar o monitoramento de um banco individual pelo catálogo", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      // Abre o acordeão do catálogo
      const catalogAccordion = screen.getByRole("button", {
        name: /Explorar catálogo completo/i,
      });
      await user.click(catalogAccordion);

      const nubankCheckbox = screen.getByRole("checkbox", { name: "Monitorar Nubank" });
      expect(nubankCheckbox).not.toBeChecked();

      await user.click(nubankCheckbox);

      let prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks).toContain("Nubank");

      await user.click(nubankCheckbox);

      prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks).not.toContain("Nubank");
    });

    it("exibe mensagem amigável quando nenhum app bancário é detectado no aparelho", () => {
      renderNotificationsTab();
      expect(
        screen.getByText(
          "Nenhum aplicativo bancário suportado detectado automaticamente no dispositivo",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Explore o catálogo completo abaixo para ativar manualmente as instituições que você utiliza.",
        ),
      ).toBeInTheDocument();
    });

    it("filtra instituições financeiras em tempo real pela busca instantânea do catálogo", async () => {
      const user = userEvent.setup();
      renderNotificationsTab();

      const catalogAccordion = screen.getByRole("button", {
        name: /Explorar catálogo completo/i,
      });
      await user.click(catalogAccordion);

      expect(screen.getByText(/Bancos Digitais e Tradicionais/i)).toBeInTheDocument();
      expect(screen.getByText(/Carteiras de Pagamento/i)).toBeInTheDocument();
      expect(screen.getByText(/Corretoras e Cripto/i)).toBeInTheDocument();

      const searchInput = screen.getByLabelText("Buscar no catálogo de instituições financeiras");
      await user.type(searchInput, "Binance");

      // Corretora Binance deve estar presente, enquanto grupos sem match somem
      expect(screen.getByRole("checkbox", { name: "Monitorar Binance" })).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: "Monitorar Nubank" })).not.toBeInTheDocument();
    });

    it("renderiza aplicativos detectados na seção superior e permite monitorar todos os instalados", async () => {
      vi.mocked(nativeServices.getInstalledBankingApps).mockResolvedValue({
        installedBankNames: ["Nubank", "Inter"],
        apps: [],
      });

      const user = userEvent.setup();
      renderNotificationsTab();

      // Aguarda detecção assíncrona
      const nubankInstalled = await screen.findByRole("checkbox", { name: "Monitorar Nubank" });
      expect(nubankInstalled).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Monitorar Inter" })).toBeInTheDocument();

      const monitorAllInstalledBtn = screen.getByRole("button", {
        name: "Monitorar todos os instalados",
      });
      await user.click(monitorAllInstalledBtn);

      const prefs = nativeServices.getBankAssistantPreferences();
      expect(prefs.monitoredBanks).toEqual(["Nubank", "Inter"]);
    });

    it("permite re-escanear aplicativos bancários chamando getInstalledBankingApps e emitindo feedback sensorial", async () => {
      vi.mocked(nativeServices.getInstalledBankingApps).mockResolvedValueOnce({
        installedBankNames: [],
        apps: [],
      });

      const user = userEvent.setup();
      renderNotificationsTab();

      expect(
        screen.getByText(
          "Nenhum aplicativo bancário suportado detectado automaticamente no dispositivo",
        ),
      ).toBeInTheDocument();

      // Configura retorno do re-escaneamento com Rico e XP
      vi.mocked(nativeServices.getInstalledBankingApps).mockResolvedValueOnce({
        installedBankNames: ["Rico", "XP Investimentos"],
        apps: [
          { packageName: "br.com.rico.rico", bankName: "Rico", isInstalled: true, category: "broker" },
          {
            packageName: "br.com.xp.investimentos",
            bankName: "XP Investimentos",
            isInstalled: true,
            category: "broker",
          },
        ],
      });

      // Clica no botão de re-escanear (no cabeçalho)
      const rescanButtons = screen.getAllByRole("button", {
        name: /Re-escanear/i,
      });
      expect(rescanButtons.length).toBeGreaterThan(0);
      await user.click(rescanButtons[0]!);

      expect(triggerSensory).toHaveBeenCalledWith("action");
      expect(nativeServices.getInstalledBankingApps).toHaveBeenCalledTimes(2);

      // Novos bancos detectados devem aparecer
      expect(await screen.findByRole("checkbox", { name: "Monitorar Rico" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Monitorar XP Investimentos" })).toBeInTheDocument();
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Lista de aplicativos atualizada",
          description: "2 aplicativos bancários detectados no dispositivo.",
          variant: "success",
        }),
      );
    });

    it("exibe badge [Instalado] para Rico, BTG Investimentos, Nomad e XP no catálogo após detecção", async () => {
      vi.mocked(nativeServices.getInstalledBankingApps).mockResolvedValue({
        installedBankNames: ["Rico", "BTG Investimentos", "Nomad", "XP Investimentos"],
        apps: [
          { packageName: "br.com.rico.rico", bankName: "Rico", isInstalled: true, category: "broker" },
          {
            packageName: "br.com.btg.pactual.digital",
            bankName: "BTG Investimentos",
            isInstalled: true,
            category: "broker",
          },
          { packageName: "com.nomadglobal.app", bankName: "Nomad", isInstalled: true, category: "broker" },
          {
            packageName: "br.com.xp.investimentos",
            bankName: "XP Investimentos",
            isInstalled: true,
            category: "broker",
          },
        ],
      });

      const user = userEvent.setup();
      renderNotificationsTab();

      // Aguarda carregar
      await screen.findByRole("checkbox", { name: "Monitorar Rico" });

      // Abre o catálogo completo
      const catalogAccordion = screen.getByRole("button", {
        name: /Explorar catálogo completo/i,
      });
      await user.click(catalogAccordion);

      // Localiza os itens dentro da seção do catálogo
      const catalogContent = document.getElementById("notification-catalog-content");
      expect(catalogContent).not.toBeNull();
      const catalogScope = within(catalogContent!);

      expect(catalogScope.getByText("Rico").closest("div")).toHaveTextContent("Instalado");
      expect(catalogScope.getByText("BTG Investimentos").closest("div")).toHaveTextContent("Instalado");
      expect(catalogScope.getByText("Nomad").closest("div")).toHaveTextContent("Instalado");
      expect(catalogScope.getByText("XP Investimentos").closest("div")).toHaveTextContent("Instalado");
    });

    it("recalcula e seleciona os novos apps detectados ao clicar em Monitorar todos os instalados", async () => {
      // Inicia com preferências contendo Nubank monitorado
      nativeServices.setBankAssistantPreferences({
        ...DEFAULT_BANK_ASSISTANT_PREFERENCES,
        monitoredBanks: ["Nubank"],
      });

      // Retorno do scanner com novos bancos instalados
      vi.mocked(nativeServices.getInstalledBankingApps).mockResolvedValue({
        installedBankNames: ["Rico", "Inter"],
        apps: [
          { packageName: "br.com.rico.rico", bankName: "Rico", isInstalled: true, category: "broker" },
          { packageName: "br.com.intermedium", bankName: "Inter", isInstalled: true, category: "bank" },
        ],
      });

      const user = userEvent.setup();
      renderNotificationsTab();

      await screen.findByRole("checkbox", { name: "Monitorar Rico" });

      const monitorAllInstalledBtn = screen.getByRole("button", {
        name: "Monitorar todos os instalados",
      });
      await user.click(monitorAllInstalledBtn);

      const prefs = nativeServices.getBankAssistantPreferences();
      // Deve conter Nubank (já monitorado) + Rico + Inter (novos instalados)
      expect(prefs.monitoredBanks).toContain("Nubank");
      expect(prefs.monitoredBanks).toContain("Rico");
      expect(prefs.monitoredBanks).toContain("Inter");
    });
  });

  describe("Prominent Disclosure Android (Contrato 4 & Google Play Store)", () => {
    it("exibe o banner permanente de processamento 100% no dispositivo (On-Device)", () => {
      renderNotificationsTab();
      expect(
        screen.getByText("Processamento 100% Local no Aparelho (On-Device)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/processador do seu celular/i),
      ).toBeInTheDocument();
    });

    it("abre o modal de Prominent Disclosure ao clicar em Habilitar no Android quando permissão estiver pendente", async () => {
      vi.mocked(nativeServices.isNotificationListenerGranted).mockResolvedValue(false);

      const user = userEvent.setup();
      renderNotificationsTab();

      // Aguarda e clica em Habilitar no Android
      const enableBtn = await screen.findByRole("button", { name: "Habilitar no Android" });
      await user.click(enableBtn);

      // Deve abrir o modal de consentimento
      expect(
        screen.getByRole("heading", { name: "Consentimento para Leitura de Notificações Bancárias" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/BIND_NOTIFICATION_LISTENER_SERVICE/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Descarte Instantâneo de Dados Críticos/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Entendi e Habilitar no Android" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agora Não" })).toBeInTheDocument();
    });

    it("chama requestNotificationListenerPermission ao confirmar no modal de Prominent Disclosure", async () => {
      vi.mocked(nativeServices.isNotificationListenerGranted).mockResolvedValue(false);

      const user = userEvent.setup();
      renderNotificationsTab();

      const enableBtn = await screen.findByRole("button", { name: "Habilitar no Android" });
      await user.click(enableBtn);

      const confirmBtn = screen.getByRole("button", { name: "Entendi e Habilitar no Android" });
      await user.click(confirmBtn);

      expect(nativeServices.requestNotificationListenerPermission).toHaveBeenCalledTimes(1);
    });

    it("fecha o modal sem solicitar permissão ao clicar em Agora Não", async () => {
      vi.mocked(nativeServices.isNotificationListenerGranted).mockResolvedValue(false);

      const user = userEvent.setup();
      renderNotificationsTab();

      const enableBtn = await screen.findByRole("button", { name: "Habilitar no Android" });
      await user.click(enableBtn);

      const cancelBtn = screen.getByRole("button", { name: "Agora Não" });
      await user.click(cancelBtn);

      expect(nativeServices.requestNotificationListenerPermission).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("heading", { name: "Consentimento para Leitura de Notificações Bancárias" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Ambiente Web / PWA (Ocultação Condicional)", () => {
    it("não renderiza o card nem opções do Assistente Passivo de Compras & Bancos na Web/PWA", () => {
      vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
      renderNotificationsTab();

      expect(screen.getByText("Exclusivo no App Android")).toBeInTheDocument();
      expect(
        screen.queryByRole("checkbox", { name: "Habilitar Captura Passiva de Notificações" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: "Monitorar Nubank" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Baixar App Pro/i })).toBeInTheDocument();
    });
  });
});
