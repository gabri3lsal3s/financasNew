import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import {
  parseBankNotification,
  parsePixShareText,
  type BankNotificationPayload,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { isNativePlatform } from "./platform";
import { addPendingSuggestion } from "./suggestions-store";
import { scheduleInteractiveBankNotification } from "./interactive-notifications";

export interface BankNotificationPluginInterface {
  isPermissionGranted(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  flushPendingNotifications(): Promise<{ notifications: BankNotificationPayload[] }>;
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
      async addListener() {
        return { remove: async () => {} };
      },
    },
  },
);

let isInitialized = false;

/**
 * Processa uma notificação bancária recebida:
 * Se reconhecer uma transação com valor válido, adiciona à fila de sugestões pendentes.
 */
export function processBankNotification(
  payload: BankNotificationPayload,
): ParsedBankTransaction | null {
  const parsed = parseBankNotification(payload);
  if (parsed) {
    addPendingSuggestion(parsed);
    void scheduleInteractiveBankNotification(parsed);
  }
  return parsed;
}

/**
 * Processa um texto compartilhado via Android Share Target (comprovante Pix):
 * Se reconhecer valor válido, adiciona à fila de sugestões pendentes
 * e emite notificação local para confirmação rápida.
 */
export function processPixShare(text: string): ParsedBankTransaction | null {
  const parsed = parsePixShareText(text);
  if (parsed) {
    addPendingSuggestion(parsed);
    void scheduleInteractiveBankNotification(parsed);
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
 * Inicializa a escuta de eventos nativos de compras e Pix compartilhados.
 * Retorna uma função de desinscrição para limpeza.
 */
export function initBankNotificationListener(): () => Promise<void> {
  if (!isNativePlatform() || isInitialized) {
    return async () => {};
  }

  isInitialized = true;

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
    try {
      const [h1, h2] = await Promise.all([notifHandlePromise, shareHandlePromise]);
      await Promise.all([h1?.remove?.(), h2?.remove?.()]);
    } catch {
      // no-op
    }
  };
}
