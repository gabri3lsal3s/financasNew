import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Search,
  Smartphone,
  TrendingUp,
  Wallet,
  Download,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  type SelectOption,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import {
  useUpdateCustomSettings,
  useUserPreferences,
  useUpdateReminderPreferences,
  useUserAccess,
} from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  isDailyReminderEnabled,
  setDailyReminderEnabled,
  isDueNotificationsEnabled,
  setDueNotificationsEnabled,
  getDailyReminderTime,
  setDailyReminderTime,
  scheduleDailyReminder,
  cancelDailyReminder,
  checkNotificationPermissions,
  requestNotificationPermissions,
  useBankAssistantPreferences,
  isNotificationListenerGranted,
  requestNotificationListenerPermission,
  getInstalledBankingApps,
  isNativePlatform,
} from "@/services/native";
import {
  HOMOLOGATED_BANKS,
  HOMOLOGATED_INSTITUTIONS,
  type HomologatedInstitution,
  type InstitutionCategory,
} from "@/domain/notifications";

const DAILY_REMINDER_TIME_OPTIONS: SelectOption[] = [
  { value: "19:00", label: "19:00 (Início da noite)" },
  { value: "20:00", label: "20:00 (Padrão sugerido)" },
  { value: "21:00", label: "21:00" },
  { value: "22:00", label: "22:00 (Final da noite)" },
];

const REMINDER_DAYS_OPTIONS: SelectOption[] = [
  { value: "0", label: "No dia do vencimento" },
  { value: "1", label: "1 dia antes" },
  { value: "2", label: "2 dias antes" },
  { value: "3", label: "3 dias antes (recomendado)" },
  { value: "5", label: "5 dias antes" },
  { value: "7", label: "7 dias antes (1 semana)" },
  { value: "10", label: "10 dias antes" },
  { value: "15", label: "15 dias antes" },
  { value: "30", label: "30 dias antes (1 mês)" },
];

function getCategoryLabel(category: InstitutionCategory): string {
  switch (category) {
    case "traditional_digital":
      return "Banco";
    case "payment_wallets":
      return "Carteira";
    case "investments_crypto":
      return "Investimentos";
  }
}

/**
 * Aba "Notificações & Automações" em Configurações.
 *
 * Centraliza os canais de notificação e automações passivas:
 * 1. Lembretes de Vencimento de Contas (faturas e dívidas)
 * 2. Lembrete Diário no Dispositivo (notificação interativa)
 * 3. Assistente Passivo de Compras & Notificações Bancárias (Android nativo)
 */
export function NotificationsTab() {
  const navigate = useNavigate();
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateReminderPreferencesMutation = useUpdateReminderPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;

  const handleToggleReminders = (enabled: boolean) => {
    triggerSensory("toggle");
    updateReminderPreferencesMutation.mutate({ remindersEnabled: enabled });
  };

  const handleUpdateBillDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeBill: num });
    }
  };

  const handleUpdateDebtDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeDebt: num });
    }
  };

  const [dailyReminderActive, setDailyReminderActive] = useState(() => isDailyReminderEnabled());
  const [dailyReminderTime, setDailyReminderTimeState] = useState(() => getDailyReminderTime());
  const [dueNotificationsActive, setDueNotificationsActive] = useState(() => isDueNotificationsEnabled());
  const [devicePermissionGranted, setDevicePermissionGranted] = useState(false);

  useEffect(() => {
    void checkNotificationPermissions().then((res) => {
      setDevicePermissionGranted(res.granted);
    });
  }, []);

  const handleToggleDueNotifications = async (enabled: boolean) => {
    triggerSensory("toggle");
    if (enabled) {
      const perm = await requestNotificationPermissions();
      setDevicePermissionGranted(perm.granted);
      if (!perm.granted) {
        pushToast({
          title: "Permissão de notificação necessária",
          description: "Habilite as notificações no navegador ou nas configurações do seu celular para receber alertas de contas.",
          variant: "destructive",
        });
        return;
      }
      setDueNotificationsEnabled(true);
      setDueNotificationsActive(true);
      pushToast({
        title: "Notificações de contas ativadas",
        description: "Você receberá alertas no dispositivo sobre faturas e dívidas próximas do vencimento.",
        variant: "success",
      });
    } else {
      setDueNotificationsEnabled(false);
      setDueNotificationsActive(false);
      pushToast({
        title: "Notificações de contas desativadas",
        variant: "default",
      });
    }
  };

  const handleToggleDailyReminder = async (enabled: boolean) => {
    if (enabled) {
      const perm = await requestNotificationPermissions();
      if (!perm.granted) {
        pushToast({
          title: "Permissão de notificação necessária",
          description: "Habilite as notificações nas configurações do seu celular para receber o lembrete.",
          variant: "destructive",
        });
        return;
      }
      const [h, m] = dailyReminderTime.split(":").map(Number);
      const scheduled = await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      if (scheduled) {
        setDailyReminderEnabled(true);
        setDailyReminderActive(true);
        pushToast({
          title: "Lembrete diário ativado",
          description: `Você receberá uma notificação com botões rápidos todos os dias às ${dailyReminderTime}.`,
          variant: "success",
        });
      } else {
        pushToast({
          title: "Falha ao agendar",
          description: "Não foi possível agendar o lembrete diário no dispositivo.",
          variant: "destructive",
        });
      }
    } else {
      await cancelDailyReminder();
      setDailyReminderEnabled(false);
      setDailyReminderActive(false);
      pushToast({
        title: "Lembrete diário desativado",
        variant: "default",
      });
    }
  };

  const handleDailyReminderTimeChange = async (time: string) => {
    setDailyReminderTimeState(time);
    setDailyReminderTime(time);
    if (dailyReminderActive) {
      const [h, m] = time.split(":").map(Number);
      await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      pushToast({
        title: "Horário atualizado",
        description: `Lembrete diário reagendado para às ${time}.`,
        variant: "success",
      });
    }
  };

  const { preferences: bankPrefs, updatePreferences: updateBankPrefs } = useBankAssistantPreferences();
  const [listenerPermissionGranted, setListenerPermissionGranted] = useState(true);
  const [installedBanks, setInstalledBanks] = useState<string[]>([]);

  useEffect(() => {
    if (isNativePlatform()) {
      void isNotificationListenerGranted().then((granted) => {
        setListenerPermissionGranted(granted);
      });
      void getInstalledBankingApps().then((res) => {
        setInstalledBanks(res.installedBankNames);
      });
    }
  }, []);

  const handleTogglePassiveCapture = async (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ passiveCaptureEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { passiveCaptureEnabled: enabled },
    });

    if (enabled) {
      const granted = await isNotificationListenerGranted();
      setListenerPermissionGranted(granted);
      if (!granted) {
        pushToast({
          title: "Permissão de leitura de notificações necessária",
          description: "Habilite o acesso a notificações nas configurações do seu celular.",
          variant: "warning",
        });
      } else {
        pushToast({
          title: "Captura de compras ativada",
          description: "Notificações bancárias serão detectadas e convertidas em sugestões.",
        });
      }
    } else {
      pushToast({
        title: "Captura de compras desativada",
        description: "Nenhuma notificação bancária será processada.",
      });
    }
  };

  const handleRequestPermission = async () => {
    await requestNotificationListenerPermission();
    const granted = await isNotificationListenerGranted();
    setListenerPermissionGranted(granted);
  };

  const handleToggleInteractiveNotifications = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ interactiveNotificationsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { interactiveNotificationsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Notificações com botões de ação rápida ativadas."
        : "Notificações silenciosas ativadas (apenas card discreto na tela inicial).",
    });
  };

  const handleToggleAutoInstallments = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoInstallmentsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoInstallmentsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Detecção e desmembramento automático de parcelas ativado."
        : "Cálculo de parcelas desativado (compras tratadas como parcela única).",
    });
  };

  const handleToggleAutoCategoryInference = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoCategoryInferenceEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoCategoryInferenceEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Inferência automática de categorias ativada."
        : "Inferência desativada (seleção manual exigida).",
    });
  };

  const handleToggleBank = (bankName: string, nextChecked: boolean) => {
    triggerSensory("toggle");
    const currentList = bankPrefs.monitoredBanks;
    const nextList = nextChecked
      ? [...new Set([...currentList, bankName])]
      : currentList.filter((b) => b !== bankName);

    updateBankPrefs({ monitoredBanks: nextList });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: nextList },
    });
  };

  const handleSelectAllBanks = () => {
    const all = [...HOMOLOGATED_BANKS];
    updateBankPrefs({ monitoredBanks: all });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: all },
    });
    pushToast({
      title: "Todos os bancos selecionados",
      description: `Todos os ${HOMOLOGATED_BANKS.length} bancos homologados estão sendo monitorados.`,
    });
  };

  const handleDeselectAllBanks = () => {
    updateBankPrefs({ monitoredBanks: [] });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: [] },
    });
    pushToast({
      title: "Todos os bancos desmarcados",
      description: "Nenhum banco está selecionado para captura.",
    });
  };

  const handleSelectOnlyInstalledBanks = () => {
    if (installedBanks.length === 0) return;
    updateBankPrefs({ monitoredBanks: installedBanks });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: installedBanks },
    });
    pushToast({
      title: "Bancos instalados selecionados",
      description: `${installedBanks.length} aplicativo(s) bancário(s) detectado(s) no dispositivo estão sendo monitorados.`,
      variant: "success",
    });
  };

  const [catalogSearch, setCatalogSearch] = useState("");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const searchLower = catalogSearch.toLowerCase().trim();

  const traditionalBanks = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "traditional_digital" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const paymentWallets = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "payment_wallets" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const investmentBrokers = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "investments_crypto" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const totalMatching =
    traditionalBanks.length + paymentWallets.length + investmentBrokers.length;

  const renderInstitutionItem = (inst: HomologatedInstitution) => {
    const isChecked = bankPrefs.monitoredBanks.includes(inst.name);
    const isInstalled = installedBanks.includes(inst.name);

    return (
      <div
        key={inst.id}
        role="button"
        tabIndex={0}
        onClick={() => handleToggleBank(inst.name, !isChecked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggleBank(inst.name, !isChecked);
          }
        }}
        className={cn(
          "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors cursor-pointer select-none",
          isChecked
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
            : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
          <span className="truncate">{inst.name}</span>
          {isInstalled && (
            <Badge variant="positive" size="xs">
              Instalado
            </Badge>
          )}
        </div>
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => handleToggleBank(inst.name, Boolean(checked))}
          aria-label={`Monitorar ${inst.name}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- CARD 1: LEMBRETES & NOTIFICAÇÕES --- */}
      {hasFeature("reminders") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Lembretes &amp; Notificações</span>
              </span>
              <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
                {remindersEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggleReminders(!remindersEnabled)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleReminders(!remindersEnabled);
                }
              }}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                remindersEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border/80 bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="pr-4">
                <div className="font-semibold text-sm text-foreground">
                  Habilitar Lembretes Automáticos
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Notifica sobre faturas de cartão e dívidas próximas do vencimento no sino do cabeçalho.
                </div>
              </div>
              <Checkbox
                checked={remindersEnabled}
                onCheckedChange={handleToggleReminders}
                aria-label="Habilitar Lembretes no Aplicativo"
              />
            </div>

            {remindersEnabled && (
              <div className="grid gap-3.5 pt-1 sm:grid-cols-2">
                {/* Antecedência para Faturas */}
                {hasFeature("cards") && (
                  <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        Antecedência para Faturas de Cartão
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Momento do alerta antes do fechamento/vencimento.
                      </p>
                    </div>

                    <Select
                      value={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                          ? String(billDaysBefore)
                          : "custom"
                      }
                      onValueChange={(val) => {
                        if (val !== "custom") {
                          handleUpdateBillDays(val);
                        }
                      }}
                      options={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                          ? REMINDER_DAYS_OPTIONS
                          : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${billDaysBefore} dias (Personalizado)` }]
                      }
                      ariaLabel="Seletor de dias de antecedência para faturas"
                    />
                  </div>
                )}

                {/* Antecedência para Dívidas */}
                {hasFeature("debts") && (
                  <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        Antecedência para Dívidas
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Momento do alerta antes da data de quitação.
                      </p>
                    </div>

                    <Select
                      value={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                          ? String(debtDaysBefore)
                          : "custom"
                      }
                      onValueChange={(val) => {
                        if (val !== "custom") {
                          handleUpdateDebtDays(val);
                        }
                      }}
                      options={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                          ? REMINDER_DAYS_OPTIONS
                          : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${debtDaysBefore} dias (Personalizado)` }]
                      }
                      ariaLabel="Seletor de dias de antecedência para dívidas"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notificações no Dispositivo para Contas a Vencer */}
            <div className="pt-3.5 border-t border-border/80 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
                <div className="pr-4 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      Notificações de Contas no Dispositivo
                    </span>
                    <Badge variant={devicePermissionGranted ? "positive" : "muted"} size="xs">
                      {devicePermissionGranted ? "Permitido" : "Não autorizado"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Emite alertas no celular ou navegador quando houver faturas ou dívidas vencendo hoje ou atrasadas.
                  </div>
                </div>
                <Checkbox
                  checked={dueNotificationsActive}
                  onCheckedChange={handleToggleDueNotifications}
                  aria-label="Habilitar Notificações de Contas no Dispositivo"
                />
              </div>
            </div>

            {/* Lembrete de Fechamento Diário (Notificação no Celular / Dispositivo) */}
            <div className="pt-3.5 border-t border-border/80 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
                <div className="pr-4 space-y-0.5">
                  <div className="font-semibold text-sm text-foreground">
                    Lembrete de Fechamento Diário
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Receba uma notificação no dispositivo com ações rápidas para registrar despesas e receitas do dia.
                  </div>
                </div>
                <Checkbox
                  checked={dailyReminderActive}
                  onCheckedChange={handleToggleDailyReminder}
                  aria-label="Habilitar Lembrete de Fechamento Diário"
                />
              </div>

              {dailyReminderActive && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Horário do Lembrete
                  </span>
                  <Select
                    value={dailyReminderTime}
                    onValueChange={handleDailyReminderTimeChange}
                    options={DAILY_REMINDER_TIME_OPTIONS}
                    ariaLabel="Selecione o horário para o lembrete diário"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O aplicativo emitirá a notificação programada todos os dias no horário selecionado.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- CARD 2: ASSISTENTE PASSIVO DE COMPRAS & BANCOS (Android nativo vs Vitrine Web/PWA) --- */}
      {isNativePlatform() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Assistente Passivo de Compras &amp; Bancos</span>
              </span>
              <Badge variant={bankPrefs.passiveCaptureEnabled ? "positive" : "muted"} size="xs">
                {bankPrefs.passiveCaptureEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle Mestre */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled);
                }
              }}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                bankPrefs.passiveCaptureEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border/80 bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="pr-4">
                <div className="font-semibold text-sm text-foreground">
                  Captura Passiva de Notificações Bancárias
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Detecta compras no cartão, transferências e Pix recebidos/enviados e gera sugestões inteligentes no aplicativo.
                </div>
              </div>
              <Checkbox
                checked={bankPrefs.passiveCaptureEnabled}
                onCheckedChange={handleTogglePassiveCapture}
                aria-label="Habilitar Captura Passiva de Notificações"
              />
            </div>

            {/* Alerta de permissão do Android se pendente */}
            {bankPrefs.passiveCaptureEnabled && !listenerPermissionGranted && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-warning/40 bg-warning/5 gap-3">
                <div>
                  <div className="font-semibold text-xs text-foreground">
                    Acesso a Notificações Pendente no Android
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Para detectar compras em segundo plano, conceda acesso ao leitor de notificações nas configurações do dispositivo.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestPermission}
                  className="shrink-0 text-xs gap-1.5"
                >
                  <span>Habilitar no Android</span>
                </Button>
              </div>
            )}

            {/* Opções Detalhadas se o Toggle Mestre estiver ativo */}
            {bankPrefs.passiveCaptureEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Toggle 1: Notificações Interativas */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                      bankPrefs.interactiveNotificationsEnabled
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-xs text-foreground">
                        Notificações com Ação Rápida
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Exibe push rico no celular com botões Adicionar Rápido e Editar.
                      </div>
                    </div>
                    <Checkbox
                      checked={bankPrefs.interactiveNotificationsEnabled}
                      onCheckedChange={handleToggleInteractiveNotifications}
                      aria-label="Habilitar Notificações com Ação Rápida"
                    />
                  </div>

                  {/* Toggle 2: Parcelamento Automático */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                      bankPrefs.autoInstallmentsEnabled
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-xs text-foreground">
                        Cálculo Automático de Parcelas
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Identifica compras parceladas e divide os valores mensalmente.
                      </div>
                    </div>
                    <Checkbox
                      checked={bankPrefs.autoInstallmentsEnabled}
                      onCheckedChange={handleToggleAutoInstallments}
                      aria-label="Habilitar Cálculo Automático de Parcelas"
                    />
                  </div>
                </div>

                {/* Toggle 3: Inferência de Categorias */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    bankPrefs.autoCategoryInferenceEnabled
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border/80 bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="pr-3">
                    <div className="font-semibold text-xs text-foreground">
                      Inferência Automática de Categorias
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Sugere categorias pelo estabelecimento (alimentação, mercado, transporte, farmácia).
                    </div>
                  </div>
                  <Checkbox
                    checked={bankPrefs.autoCategoryInferenceEnabled}
                    onCheckedChange={handleToggleAutoCategoryInference}
                    aria-label="Habilitar Inferência Automática de Categorias"
                  />
                </div>

                {/* SEÇÃO SUPERIOR: APLICATIVOS NO SEU DISPOSITIVO (§3.1) */}
                <div className="pt-2 border-t border-border/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-semibold text-xs text-foreground">
                        Aplicativos no seu Dispositivo
                      </span>
                      {installedBanks.length > 0 && (
                        <Badge variant="positive" size="xs">
                          {installedBanks.length} detectado{installedBanks.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    {installedBanks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={handleSelectOnlyInstalledBanks}
                        className="text-[11px] h-7 px-2 text-primary hover:text-primary-hover font-medium"
                      >
                        Monitorar todos os instalados
                      </Button>
                    )}
                  </div>

                  {installedBanks.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-border/80 bg-surface/50 text-center space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Nenhum aplicativo bancário suportado detectado automaticamente no dispositivo
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Explore o catálogo completo abaixo para ativar manualmente as instituições que você utiliza.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {installedBanks.map((bankName) => {
                        const institution = HOMOLOGATED_INSTITUTIONS.find(
                          (inst) => inst.name.toLowerCase() === bankName.toLowerCase(),
                        );
                        const isChecked = bankPrefs.monitoredBanks.includes(bankName);
                        const categoryLabel = institution
                          ? getCategoryLabel(institution.category)
                          : "Banco";

                        return (
                          <div
                            key={bankName}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleToggleBank(bankName, !isChecked)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleToggleBank(bankName, !isChecked);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-xs transition-colors cursor-pointer select-none shadow-xs",
                              isChecked
                                ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
                                : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {bankName}
                              </span>
                              <Badge variant={isChecked ? "positive" : "muted"} size="xs">
                                {categoryLabel}
                              </Badge>
                            </div>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => handleToggleBank(bankName, Boolean(checked))}
                              aria-label={`Monitorar ${bankName}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SEÇÃO INFERIOR: ACCORDION DO CATÁLOGO GERAL (§3.1) */}
                <div className="pt-2 border-t border-border/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      triggerSensory("toggle");
                      setIsCatalogOpen((prev) => !prev);
                    }}
                    className="flex w-full items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-hover shadow-xs text-xs font-semibold text-foreground transition-colors cursor-pointer select-none"
                    aria-expanded={isCatalogOpen}
                    aria-controls="notification-catalog-content"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>Explorar catálogo completo (25+ instituições financeiras)</span>
                      <Badge variant="muted" size="xs">
                        {bankPrefs.monitoredBanks.length}/{HOMOLOGATED_BANKS.length} ativos
                      </Badge>
                    </div>
                    {isCatalogOpen ? (
                      <ChevronUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {isCatalogOpen && (
                    <div
                      id="notification-catalog-content"
                      className="p-4 rounded-xl border border-border/80 bg-surface shadow-xs space-y-4"
                    >
                      {/* Busca Instantânea e Ações Globais */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                          <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                            aria-hidden="true"
                          />
                          <Input
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                            placeholder="Buscar banco, carteira ou corretora..."
                            className="pl-8 text-xs h-9"
                            aria-label="Buscar no catálogo de instituições financeiras"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleSelectAllBanks}
                            className="text-[11px] h-8 px-2"
                          >
                            Marcar todos
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleDeselectAllBanks}
                            className="text-[11px] h-8 px-2 text-muted-foreground hover:text-foreground"
                          >
                            Desmarcar todos
                          </Button>
                        </div>
                      </div>

                      {totalMatching === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          Nenhuma instituição encontrada para &quot;{catalogSearch}&quot;.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Grupo 1: Bancos Digitais e Tradicionais */}
                          {traditionalBanks.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                <span>Bancos Digitais e Tradicionais ({traditionalBanks.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {traditionalBanks.map((inst) => renderInstitutionItem(inst))}
                              </div>
                            </div>
                          )}

                          {/* Grupo 2: Carteiras de Pagamento */}
                          {paymentWallets.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                <span>Carteiras de Pagamento ({paymentWallets.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {paymentWallets.map((inst) => renderInstitutionItem(inst))}
                              </div>
                            </div>
                          )}

                          {/* Grupo 3: Corretoras e Cripto */}
                          {investmentBrokers.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                <span>Corretoras e Cripto ({investmentBrokers.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {investmentBrokers.map((inst) => renderInstitutionItem(inst))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Vitrine Informativa do Assistente Bancário para Web / PWA */
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Assistente Passivo de Compras &amp; Bancos</span>
              </span>
              <Badge variant="default" size="xs">
                Exclusivo no App Android
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Zap className="size-3.5" aria-hidden="true" />
                    <span>Automação em Segundo Plano</span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Leitura Automática de Comprovantes Pix e Notificações de Cartão
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                    Disponível através do Aplicativo Android Pro. Ele escuta notificações de mais de 20 bancos (Nubank, Itaú, Inter, etc.) e sugere o lançamento imediatamente com um único toque, com 100% de privacidade local no celular.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => navigate("/configuracoes?tab=devices")}
                    className="gap-2 text-xs"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span>Baixar App Pro</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
