import { LocalNotifications } from "@capacitor/local-notifications";
import { inferCategoryKeyword } from "@/domain/notifications";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { isNativePlatform } from "./platform";
import {
  ACTION_EDIT,
  ACTION_QUICK_ADD,
  ACTION_UNDO,
  quickAddTransaction,
  undoQuickAddTransaction,
} from "./interactive-notifications";

export const DAILY_REMINDER_NOTIFICATION_ID = 2026;
export const DAILY_REMINDER_CHANNEL_ID = "daily_reminders";
export const DAILY_REMINDER_ACTION_TYPE_ID = "DAILY_REMINDER_ACTIONS";
export const ACTION_ADD_EXPENSE = "add_expense";
export const ACTION_ADD_INCOME = "add_income";

const KEY_REMINDER_ENABLED = "daily_reminder_enabled";
const KEY_REMINDER_TIME = "daily_reminder_time";
const DEFAULT_REMINDER_TIME = "20:00";

let isActionListenerActive = false;

/**
 * Lê se o lembrete de fechamento diário está ativado.
 */
export function isDailyReminderEnabled(userId?: string | null): boolean {
  return getUserStorageItem(KEY_REMINDER_ENABLED, userId) === "true";
}

/**
 * Atualiza a preferência do lembrete diário.
 */
export function setDailyReminderEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_REMINDER_ENABLED, String(enabled), userId);
}

/**
 * Obtém o horário configurado para o lembrete diário (HH:MM). Padrão: "20:00".
 */
export function getDailyReminderTime(userId?: string | null): string {
  const val = getUserStorageItem(KEY_REMINDER_TIME, userId);
  return val || DEFAULT_REMINDER_TIME;
}

/**
 * Define o horário configurado para o lembrete diário (HH:MM).
 */
export function setDailyReminderTime(time: string, userId?: string | null): void {
  setUserStorageItem(KEY_REMINDER_TIME, time, userId);
}

/**
 * Verifica se a permissão de notificações locais está concedida.
 */
export async function checkNotificationPermissions(): Promise<{ granted: boolean }> {
  if (!isNativePlatform()) {
    if (typeof window !== "undefined" && "Notification" in window) {
      return { granted: Notification.permission === "granted" };
    }
    return { granted: false };
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    return { granted: status.display === "granted" };
  } catch {
    return { granted: false };
  }
}

/**
 * Solicita permissão para emissão de notificações locais.
 */
export async function requestNotificationPermissions(): Promise<{ granted: boolean }> {
  if (!isNativePlatform()) {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      return { granted: permission === "granted" };
    }
    return { granted: false };
  }

  try {
    const status = await LocalNotifications.requestPermissions();
    return { granted: status.display === "granted" };
  } catch {
    return { granted: false };
  }
}

/**
 * Agenda o lembrete de fechamento diário com botões de ação rápida.
 */
export async function scheduleDailyReminder(options?: {
  hour?: number;
  minute?: number;
}): Promise<boolean> {
  const hour = options?.hour ?? 20;
  const minute = options?.minute ?? 0;

  if (!isNativePlatform()) {
    return true;
  }

  try {
    const permissions = await requestNotificationPermissions();
    if (!permissions.granted) {
      return false;
    }

    // Registra os botões de ação da notificação
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: DAILY_REMINDER_ACTION_TYPE_ID,
          actions: [
            {
              id: ACTION_ADD_EXPENSE,
              title: "Despesa",
            },
            {
              id: ACTION_ADD_INCOME,
              title: "Receita",
            },
          ],
        },
      ],
    });

    // Cria o canal com prioridade adequada no Android 8+
    await LocalNotifications.createChannel({
      id: DAILY_REMINDER_CHANNEL_ID,
      name: "Lembretes Diários",
      description: "Notificação programada de fechamento diário de finanças",
      importance: 3,
      visibility: 1,
      vibration: true,
    });

    // Cancela notificação anterior para evitar duplicidade
    await cancelDailyReminder();

    // Agenda a notificação diária recorrente
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_REMINDER_NOTIFICATION_ID,
          title: "Fechamento Diário — Áxis • Guia Financeiro",
          body: "Registre suas movimentações de hoje para manter seus saldos e orçamentos em dia.",
          channelId: DAILY_REMINDER_CHANNEL_ID,
          actionTypeId: DAILY_REMINDER_ACTION_TYPE_ID,
          schedule: {
            on: {
              hour,
              minute,
            },
            allowWhileIdle: true,
          },
        },
      ],
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Cancela o agendamento do lembrete diário.
 */
export async function cancelDailyReminder(): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
    });
  } catch {
    // Falha silenciosa no cancelamento
  }
}

/**
 * Registra o manipulador de ações do usuário disparadas a partir das notificações.
 */
export function initNotificationActionListener(
  onNavigate: (routePath: string) => void,
): () => Promise<void> {
  if (!isNativePlatform() || isActionListenerActive) {
    return async () => {};
  }

  isActionListenerActive = true;
  const listenerPromise = LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (notificationAction) => {
      const actionId = notificationAction.actionId;
      const notification = notificationAction.notification;
      const extra = notification?.extra as Record<string, unknown> | undefined;

      if (actionId === ACTION_QUICK_ADD) {
        if (extra?.suggestion) {
          void quickAddTransaction(extra.suggestion as never);
        }
      } else if (actionId === ACTION_EDIT) {
        if (extra?.suggestion) {
          const sug = extra.suggestion as {
            type: string;
            amountCents: number;
            description: string;
            date: string;
            paymentMethod?: string;
            installments?: number;
            categorySlug?: string;
            id: string;
          };
          const inferredSlug = sug.categorySlug || inferCategoryKeyword(sug.description);
          const params = new URLSearchParams({
            novo: sug.type,
            valor: String(sug.amountCents),
            descricao: sug.description,
            data: sug.date,
            forma: sug.paymentMethod || "pix",
            sug_id: sug.id,
          });
          if (inferredSlug) {
            params.set("categoria", inferredSlug);
          }
          if (sug.installments && sug.installments > 1) {
            params.set("parcelas", String(sug.installments));
          }
          onNavigate(`/?${params.toString()}`);
        } else {
          onNavigate("/transacoes?novo=despesa");
        }
      } else if (actionId === ACTION_UNDO) {
        if (extra?.createdId && extra?.type && extra?.suggestion) {
          void undoQuickAddTransaction(
            String(extra.createdId),
            extra.type as "expense" | "income",
            extra.suggestion as never,
          );
        }
      } else if (actionId === ACTION_ADD_INCOME) {
        onNavigate("/transacoes?novo=receita");
      } else if (actionId === ACTION_ADD_EXPENSE) {
        onNavigate("/transacoes?novo=despesa");
      } else {
        // Toque no corpo da notificação (tap padrão)
        if (extra?.suggestion) {
          const sug = extra.suggestion as {
            type: string;
            amountCents: number;
            description: string;
            date: string;
            paymentMethod?: string;
            installments?: number;
            id: string;
          };
          const params = new URLSearchParams({
            novo: sug.type,
            valor: String(sug.amountCents),
            descricao: sug.description,
            data: sug.date,
            forma: sug.paymentMethod || "pix",
            sug_id: sug.id,
          });
          if (sug.installments && sug.installments > 1) {
            params.set("parcelas", String(sug.installments));
          }
          onNavigate(`/?${params.toString()}`);
        } else {
          onNavigate("/transacoes?novo=despesa");
        }
      }
    },
  );

  return async () => {
    isActionListenerActive = false;
    const handle = await listenerPromise;
    void handle.remove();
  };
}
