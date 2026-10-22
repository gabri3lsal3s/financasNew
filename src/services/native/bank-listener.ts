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
import { quickAddTransaction, scheduleInteractiveBankNotification } from "./interactive-notifications";
import {
  getBankAssistantPreferences,
  subscribeBankAssistantPreferences,
} from "./bank-assistant-preferences";

export interface InstalledBankApp {
  packageName: string;
  bankName: string;
  isInstalled: boolean;
  category?: "bank" | "wallet" | "broker";
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
  getPendingShare(): Promise<{ text?: string | null }>;
  extractTextFromReceipt(options: {
    base64Data: string;
    mimeType: string;
  }): Promise<{ text: string }>;
  getPendingReviewTransaction(): Promise<{ payload?: string | null }>;
  flushConfirmedTransactions(): Promise<{
    transactions: BankNotificationPayload[];
  }>;
  addListener(
    eventName: "bankNotificationReceived",
    listenerFunc: (payload: BankNotificationPayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "shareTextReceived",
    listenerFunc: (payload: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "openReviewTransaction",
    listenerFunc: (payload: { payload: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "bankTransactionConfirmed",
    listenerFunc: (payload: BankNotificationPayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "bankTransactionUndone",
    listenerFunc: (payload: BankNotificationPayload) => void,
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
      async getPendingShare() {
        return { text: null };
      },
      async extractTextFromReceipt() {
        return { text: "" };
      },
      async getPendingReviewTransaction() {
        return { payload: null };
      },
      async flushConfirmedTransactions() {
        return { transactions: [] };
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

  let parsed = parsePixShareText(text);
  if (!parsed) {
    parsed = parseBankNotification({ title: "", text });
  }

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
 * Constrói a rota com query parameters para abrir o Wizard Rápido pré-preenchido.
 */
export function buildReviewRoute(parsed: ParsedBankTransaction): string {
  const params = new URLSearchParams();
  params.set("novo", parsed.type);
  params.set("modo", "rapido");
  params.set("valor", parsed.amountCents.toString());
  params.set("descricao", parsed.description);
  params.set("data", parsed.date);
  if (parsed.paymentMethod) params.set("forma", parsed.paymentMethod);
  if (parsed.cardLastDigits) params.set("cartao", parsed.cardLastDigits);
  if (parsed.installments && parsed.installments > 1) {
    params.set("parcelas", parsed.installments.toString());
  }
  return `/transacoes?${params.toString()}`;
}

/**
 * Descarrega o buffer de transações confirmadas em segundo plano e realiza o cadastro silencioso.
 */
export async function flushConfirmedBankTransactions(): Promise<number> {
  if (!isNativePlatform()) return 0;
  try {
    const result = await BankNotificationPlugin.flushConfirmedTransactions();
    const list = result?.transactions || [];
    for (const item of list) {
      if (item.text) {
        const parsed = parseBankNotification(item);
        if (parsed) {
          void quickAddTransaction(parsed);
        }
      }
    }
    return list.length;
  } catch {
    return 0;
  }
}

/**
 * Inicializa a escuta de eventos nativos de compras e Pix compartilhados.
 * Retorna uma função de desinscrição para limpeza.
 */
export function initBankNotificationListener(onNavigate?: (route: string) => void): () => Promise<void> {
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

  // Esvazia transações confirmadas em segundo plano
  void flushConfirmedBankTransactions();

  // Consome qualquer comprovante retido no buffer nativo de Cold Start
  void BankNotificationPlugin.getPendingShare()
    .then((payload) => {
      if (payload?.text && payload.text.trim().length > 0) {
        processPixShare(payload.text);
      }
    })
    .catch(() => {
      // no-op em ambientes web ou falha defensiva
    });

  // Consome qualquer intenção de conferência pendente em Cold Start
  void BankNotificationPlugin.getPendingReviewTransaction()
    .then((res) => {
      if (res?.payload) {
        try {
          const obj = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload;
          if (obj.text) {
            const parsed = parseBankNotification(obj);
            if (parsed && onNavigate) {
              onNavigate(buildReviewRoute(parsed));
            }
          }
        } catch {
          // no-op
        }
      }
    })
    .catch(() => {
      // no-op
    });

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

  const reviewHandlePromise = BankNotificationPlugin.addListener(
    "openReviewTransaction",
    (payload) => {
      if (payload?.payload) {
        try {
          const obj = typeof payload.payload === "string" ? JSON.parse(payload.payload) : payload.payload;
          if (obj.text) {
            const parsed = parseBankNotification(obj);
            if (parsed && onNavigate) {
              onNavigate(buildReviewRoute(parsed));
            }
          }
        } catch {
          // no-op
        }
      }
    },
  );

  const confirmedHandlePromise = BankNotificationPlugin.addListener(
    "bankTransactionConfirmed",
    (payload) => {
      if (payload?.text) {
        const parsed = parseBankNotification(payload);
        if (parsed) {
          void quickAddTransaction(parsed);
        }
      }
    },
  );

  return async () => {
    isInitialized = false;
    unsubPrefs();
    try {
      const handles = await Promise.all([
        notifHandlePromise,
        shareHandlePromise,
        reviewHandlePromise,
        confirmedHandlePromise,
      ]);
      await Promise.all(handles.map((h) => h?.remove?.()));
    } catch {
      // no-op
    }
  };
}
