import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import {
  parseBankNotification,
  parsePixShareText,
  resolveBankName,
  isBankMonitored,
  getPackagesForMonitoredBanks,
  type BankNotificationPayload,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { isNativePlatform } from "./platform";
import { addPendingSuggestion } from "./suggestions-store";
import { scheduleInteractiveBankNotification } from "./interactive-notifications";
import {
  getBankAssistantPreferences,
  subscribeBankAssistantPreferences,
} from "./bank-assistant-preferences";

export interface InstalledBankApp {
  packageName: string;
  bankName: string;
  isInstalled: boolean;
}

export interface BankNotificationPluginInterface {
  isPermissionGranted(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  flushPendingNotifications(): Promise<{ notifications: BankNotificationPayload[] }>;
  getInstalledBankingApps(): Promise<{
    apps: InstalledBankApp[];
    installedBankNames: string[];
  }>;
  syncMonitoredPackages(options: {
    packages: string[];
  }): Promise<{ success: boolean; count: number }>;
  addListener(
    eventName: "bankNotificationReceived",
    listenerFunc: (payload: BankNotificationPayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "shareTextReceived",
    listenerFunc: (payload: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const BankNotificationPlugin = registerPlugin<BankNotificationPluginInterface>(
  "BankNotificationPlugin",
  {
    web: {
      async isPermissionGranted() {
        return { granted: false };
      },
      async requestPermission() {
        return { granted: false };
      },
      async flushPendingNotifications() {
        return { notifications: [] };
      },
      async getInstalledBankingApps() {
        return { apps: [], installedBankNames: [] };
      },
      async syncMonitoredPackages() {
        return { success: true, count: 0 };
      },
      async addListener() {
        return { remove: async () => {} };
      },
    },
  },
);

let isInitialized = false;

/**
 * Processa uma notificação bancária recebida respeitando as preferências do usuário:
 * - Filtra por bancos monitorados e toggle mestre de captura
 * - Aplica toggles de detecção de parcelas e inferência de categorias
 * - Dispara push interativo apenas se o toggle correspondente estiver ativo
 */
export function processBankNotification(
  payload: BankNotificationPayload,
): ParsedBankTransaction | null {
  const prefs = getBankAssistantPreferences();
  if (!prefs.passiveCaptureEnabled) {
    return null;
  }

  const bankName = resolveBankName(payload.packageName, payload.title, payload.text);
  if (!bankName || !isBankMonitored(bankName, prefs)) {
    return null;
  }

  const parsed = parseBankNotification(payload);
  if (parsed) {
    // Se o usuário desativou cálculo automático de parcelas, normaliza para parcela única
    if (!prefs.autoInstallmentsEnabled && (parsed.installments || 1) > 1) {
      parsed.installments = 1;
      parsed.currentInstallment = 1;
      parsed.installmentAmountCents = parsed.amountCents;
    }

    // Se o usuário desativou inferência de categorias, remove o slug inferido
    if (!prefs.autoCategoryInferenceEnabled) {
      delete parsed.categorySlug;
    }

    addPendingSuggestion(parsed);

    // Notificação interativa rica (com botões Adicionar Rápido e Editar)
    // Se desativada, não envia push no celular (fica apenas no card discreto da Home)
    if (prefs.interactiveNotificationsEnabled) {
      void scheduleInteractiveBankNotification(parsed);
    }
  }
  return parsed;
}

/**
 * Processa um texto compartilhado via Android Share Target (comprovante Pix):
 * Se reconhecer valor válido, adiciona à fila de sugestões pendentes
 * e emite notificação local para confirmação rápida caso habilitado.
 */
export function processPixShare(text: string): ParsedBankTransaction | null {
  const prefs = getBankAssistantPreferences();
  if (!prefs.passiveCaptureEnabled) {
    return null;
  }

  const parsed = parsePixShareText(text);
  if (parsed) {
    if (!prefs.autoCategoryInferenceEnabled) {
      delete parsed.categorySlug;
    }

    addPendingSuggestion(parsed);

    if (prefs.interactiveNotificationsEnabled) {
      void scheduleInteractiveBankNotification(parsed);
    }
  }
  return parsed;
}

/**
 * Verifica se a permissão de escuta de notificações do sistema Android está concedida.
 */
export async function isNotificationListenerGranted(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const result = await BankNotificationPlugin.isPermissionGranted();
    return Boolean(result?.granted);
  } catch {
    return false;
  }
}

/**
 * Abre as configurações do Android para o usuário habilitar o acesso a notificações.
 */
export async function requestNotificationListenerPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const result = await BankNotificationPlugin.requestPermission();
    return Boolean(result?.granted);
  } catch {
    return false;
  }
}

/**
 * Descarrega o buffer de notificações acumuladas em segundo plano quando o app estava fechado.
 * Processa cada transação adicionando à fila de sugestões e emitindo notificações interativas.
 */
export async function flushPendingBankNotifications(): Promise<number> {
  if (!isNativePlatform()) return 0;
  try {
    const result = await BankNotificationPlugin.flushPendingNotifications();
    const list = result?.notifications || [];
    for (const item of list) {
      processBankNotification(item);
    }
    return list.length;
  } catch {
    return 0;
  }
}

/**
 * Consulta a lista de aplicativos bancários homologados instalados no dispositivo móvel do usuário.
 */
export async function getInstalledBankingApps(): Promise<{
  apps: InstalledBankApp[];
  installedBankNames: string[];
}> {
  if (!isNativePlatform()) {
    return { apps: [], installedBankNames: [] };
  }
  try {
    const result = await BankNotificationPlugin.getInstalledBankingApps();
    return {
      apps: result?.apps || [],
      installedBankNames: result?.installedBankNames || [],
    };
  } catch {
    return { apps: [], installedBankNames: [] };
  }
}

/**
 * Sincroniza a lista de bancos monitorados do usuário diretamente com o serviço nativo Android.
 */
export async function syncMonitoredBanksWithNative(monitoredBanks: string[]): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const packages = getPackagesForMonitoredBanks(monitoredBanks);
    const result = await BankNotificationPlugin.syncMonitoredPackages({ packages });
    return Boolean(result?.success);
  } catch {
    return false;
  }
}

/**
 * Inicializa a escuta de eventos nativos de compras e Pix compartilhados.
 * Retorna uma função de desinscrição para limpeza.
 */
export function initBankNotificationListener(): () => Promise<void> {
  if (!isNativePlatform() || isInitialized) {
    return async () => {};
  }

  isInitialized = true;

  // Sincroniza imediatamente os pacotes autorizados nas preferências com o serviço nativo
  const prefs = getBankAssistantPreferences();
  void syncMonitoredBanksWithNative(prefs.monitoredBanks);

  // Inscreve ouvinte para sincronizar pacotes quando o usuário altera as preferências
  const unsubPrefs = subscribeBankAssistantPreferences((nextPrefs) => {
    void syncMonitoredBanksWithNative(nextPrefs.monitoredBanks);
  });

  // Esvazia imediatamente o buffer de notificações capturadas em segundo plano
  void flushPendingBankNotifications();

  const notifHandlePromise = BankNotificationPlugin.addListener(
    "bankNotificationReceived",
    (payload) => {
      processBankNotification(payload);
    },
  );

  const shareHandlePromise = BankNotificationPlugin.addListener(
    "shareTextReceived",
    (payload) => {
      if (payload?.text) {
        processPixShare(payload.text);
      }
    },
  );

  return async () => {
    isInitialized = false;
    unsubPrefs();
    try {
      const [h1, h2] = await Promise.all([notifHandlePromise, shareHandlePromise]);
      await Promise.all([h1?.remove?.(), h2?.remove?.()]);
    } catch {
      // no-op
    }
  };
}
