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
export const DUE_REMINDER_CHANNEL_ID = "due_reminders";
export const ACTION_ADD_EXPENSE = "add_expense";
export const ACTION_ADD_INCOME = "add_income";

const KEY_REMINDER_ENABLED = "daily_reminder_enabled";
const KEY_DUE_NOTIFICATIONS_ENABLED = "due_notifications_enabled";
const KEY_LAST_DUE_SYNC_DATE = "due_notifications_last_sync_date";
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
 * Lê se as notificações no dispositivo para contas a vencer/vencidas estão ativadas.
 * Por padrão: true se o usuário tiver lembretes habilitados.
 */
export function isDueNotificationsEnabled(userId?: string | null): boolean {
  const val = getUserStorageItem(KEY_DUE_NOTIFICATIONS_ENABLED, userId);
  return val === null ? true : val === "true";
}

/**
 * Define se as notificações no dispositivo para contas a vencer/vencidas estão ativadas.
 */
export function setDueNotificationsEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_DUE_NOTIFICATIONS_ENABLED, String(enabled), userId);
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
          title: "Fechamento Diário — Áxis Finance",
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
 * Cria o canal de notificações de contas a vencer/vencidas no Android.
 */
export async function setupDueRemindersChannel(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: DUE_REMINDER_CHANNEL_ID,
      name: "Contas e Vencimentos",
      description: "Alertas de faturas de cartão e dívidas próximas do vencimento",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
    });
  } catch {
    // no-op
  }
}

export interface DispatchNotificationOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  channelId?: string;
  id?: number;
}

/**
 * Despacha uma notificação local (no Android nativo via Capacitor ou no PWA via Web Notification API / Service Worker).
 * Respeita a diretriz de zero emojis e consentimento do usuário.
 */
export async function dispatchLocalOrWebNotification(
  options: DispatchNotificationOptions,
): Promise<boolean> {
  const perm = await checkNotificationPermissions();
  if (!perm.granted) {
    return false;
  }

  if (isNativePlatform()) {
    try {
      await setupDueRemindersChannel();
      const notifId = options.id ?? (options.tag ? Math.abs(options.tag.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) : Math.floor(Math.random() * 100000) + 10000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: options.title,
            body: options.body,
            channelId: options.channelId ?? DUE_REMINDER_CHANNEL_ID,
            extra: {
              url: options.url,
              tag: options.tag,
            },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  // Ambiente PWA / Web Browser
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      // Prioriza ServiceWorkerRegistration se disponível para suporte a PWA em background
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && "showNotification" in registration) {
          await registration.showNotification(options.title, {
            body: options.body,
            icon: "/pwa/icons/icon-192.png",
            badge: "/pwa/icons/icon-192.png",
            tag: options.tag,
            data: { url: options.url },
          });
          return true;
        }
      }

      // Fallback para Notification direta da janela
      const notif = new Notification(options.title, {
        body: options.body,
        icon: "/pwa/icons/icon-192.png",
        tag: options.tag,
      });

      if (options.url) {
        notif.onclick = () => {
          window.focus();
          window.location.href = options.url!;
          notif.close();
        };
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export interface DueReminderPayload {
  key: string;
  kind: "bill" | "debt";
  title: string;
  dueDate: string;
  amountCents: number;
  status: "overdue" | "due_today" | "due_soon" | "pending";
  link?: { path: string; params?: Record<string, string> };
}

/** Janela máxima em dias para emissão de notificação ativa de conta vencida. */
export const MAX_OVERDUE_DAYS_FOR_NOTIFICATION = 30;

/**
 * Sincroniza e agenda/emite notificações para faturas e dívidas pendentes.
 * É executada uma vez por dia por usuário ou quando houver nova pendência urgente.
 * Aplica consolidação anti-flood (notificação agrupada caso haja >= 2 contas)
 * e corte temporal para contas antigas vencidas há mais de 30 dias.
 */
export async function syncDueReminderNotifications(
  reminders: readonly DueReminderPayload[],
  userId?: string | null,
  force = false,
): Promise<number> {
  if (!isDueNotificationsEnabled(userId) || reminders.length === 0) {
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastSync = getUserStorageItem(KEY_LAST_DUE_SYNC_DATE, userId);
  if (!force && lastSync === today) {
    return 0;
  }

  const perm = await checkNotificationPermissions();
  if (!perm.granted) {
    return 0;
  }

  // Filtra apenas contas que vencem hoje, nos próximos 3 dias ou atrasadas recentemente (<= 30 dias)
  const eligible = reminders.filter((rem) => {
    if (rem.status === "due_today" || rem.status === "due_soon") {
      return true;
    }
    if (rem.status === "overdue") {
      const diffMs = new Date(today).getTime() - new Date(rem.dueDate).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= MAX_OVERDUE_DAYS_FOR_NOTIFICATION;
    }
    return false;
  });

  if (eligible.length === 0) {
    setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, today, userId);
    return 0;
  }

  let count = 0;

  // Consolidação anti-flood: se houver 2 ou mais contas pendentes, consolida em 1 notificação elegante
  if (eligible.length > 1) {
    const totalCents = eligible.reduce((acc, r) => acc + r.amountCents, 0);
    const totalReais = (totalCents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const title = `Áxis · Contas e faturas pendentes (${eligible.length})`;
    const body = `Você possui ${eligible.length} contas aguardando quitação (total de R$ ${totalReais}). Toque para conferir.`;
    const tag = `due:summary:${today}`;

    const sent = await dispatchLocalOrWebNotification({
      title,
      body,
      url: "/lembretes",
      tag,
      channelId: DUE_REMINDER_CHANNEL_ID,
    });

    if (sent) count = 1;
  } else {
    // Apenas 1 conta pendente: exibe os detalhes específicos da fatura/dívida
    const rem = eligible[0]!;
    const statusLabel =
      rem.status === "overdue"
        ? "Vencida"
        : rem.status === "due_today"
          ? "Vence hoje"
          : `Vence em ${rem.dueDate.slice(8, 10)}/${rem.dueDate.slice(5, 7)}`;

    const reais = (rem.amountCents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    let routeUrl = rem.kind === "bill" ? "/cartoes" : "/dividas";
    if (rem.link?.params) {
      const q = new URLSearchParams(rem.link.params).toString();
      if (q) routeUrl = `${rem.link.path}?${q}`;
    }

    const title = `${rem.title} — ${statusLabel}`;
    const body = `Saldo em aberto: R$ ${reais}. Toque para conferir e quitar.`;
    const tag = `due:${rem.key}:${today}`;

    const sent = await dispatchLocalOrWebNotification({
      title,
      body,
      url: routeUrl,
      tag,
      channelId: DUE_REMINDER_CHANNEL_ID,
    });

    if (sent) count = 1;
  }

  setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, today, userId);
  return count;
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
            modo: "rapido",
            origem: "notificacao",
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
          onNavigate(`/transacoes?${params.toString()}`);
        } else {
          onNavigate("/transacoes?novo=despesa&modo=rapido");
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
        } else if (extra?.url && typeof extra.url === "string") {
          onNavigate(extra.url);
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
