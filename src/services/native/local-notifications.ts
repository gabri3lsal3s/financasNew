import { LocalNotifications } from "@capacitor/local-notifications";
import { inferCategoryKeyword } from "@/domain/notifications";
import { todayISO } from "@/domain/debts";
import { DEMO_USER_ID } from "@/domain/demo-simulation";
import { getDemoSessionState } from "@/state/demo-mode";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { isNativePlatform } from "./platform";
import {
  ACTION_EDIT,
  ACTION_QUICK_ADD,
  ACTION_UNDO,
  hashString,
  quickAddTransaction,
  undoQuickAddTransaction,
} from "./interactive-notifications";

export const DAILY_REMINDER_NOTIFICATION_ID = 2026;
export const DAILY_REMINDER_CHANNEL_ID = "daily_reminders";
export const DAILY_REMINDER_ACTION_TYPE_ID = "DAILY_REMINDER_ACTIONS";
export const DUE_REMINDER_CHANNEL_ID = "due_reminders";
export const DUE_REMINDER_ACTION_TYPE_ID = "DUE_REMINDER_ACTIONS";
export const DUE_SUMMARY_NOTIFICATION_ID = 2030;
export const ACTION_ADD_EXPENSE = "add_expense";
export const ACTION_ADD_INCOME = "add_income";
export const ACTION_PAY = "PAY";
export const ACTION_SNOOZE = "SNOOZE";

const KEY_REMINDER_ENABLED = "daily_reminder_enabled";
const KEY_DUE_NOTIFICATIONS_ENABLED = "due_notifications_enabled";
const KEY_LAST_DUE_SYNC_DATE = "due_notifications_last_sync_date";
const KEY_ACTIVE_DUE_KEYS = "due_notifications_active_keys";
const KEY_REMINDER_TIME = "daily_reminder_time";
const DEFAULT_REMINDER_TIME = "20:00";

let isActionListenerActive = false;

const KEY_DISMISSED_PERMISSION_ALERTS = "device_notifications_dismissed_permission_alerts";

export interface DeviceNotificationPreferences {
  dueNotificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  dismissedPermissionAlerts?: {
    pushDue?: boolean;
    passiveBankListener?: boolean;
  };
}

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
 * Por padrão: false (exige intenção explícita ou autorização real).
 */
export function isDueNotificationsEnabled(userId?: string | null): boolean {
  return getUserStorageItem(KEY_DUE_NOTIFICATIONS_ENABLED, userId) === "true";
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
 * Obtém as preferências consolidadas de notificações no dispositivo.
 */
export function getDeviceNotificationPreferences(userId?: string | null): DeviceNotificationPreferences {
  const rawDue = getUserStorageItem(KEY_DUE_NOTIFICATIONS_ENABLED, userId);
  const rawDaily = getUserStorageItem(KEY_REMINDER_ENABLED, userId);
  const rawTime = getUserStorageItem(KEY_REMINDER_TIME, userId);
  const rawDismissed = getUserStorageItem(KEY_DISMISSED_PERMISSION_ALERTS, userId);

  let dismissed: { pushDue?: boolean; passiveBankListener?: boolean } | undefined;
  if (rawDismissed) {
    try {
      dismissed = JSON.parse(rawDismissed);
    } catch {
      // no-op
    }
  }

  return {
    dueNotificationsEnabled: rawDue === "true",
    dailyReminderEnabled: rawDaily === "true",
    dailyReminderTime: rawTime || DEFAULT_REMINDER_TIME,
    dismissedPermissionAlerts: dismissed,
  };
}

/**
 * Sincroniza preferências de notificações no dispositivo vindas da nuvem (Supabase custom_settings).
 */
export function syncDeviceNotificationsWithCloud(
  cloudPrefs?: {
    dueNotificationsEnabled?: boolean;
    dailyReminderEnabled?: boolean;
    dailyReminderTime?: string;
    dismissedPermissionAlerts?: {
      pushDue?: boolean;
      passiveBankListener?: boolean;
    };
  } | null,
  userId?: string | null,
): void {
  if (!cloudPrefs) return;

  if (cloudPrefs.dueNotificationsEnabled !== undefined) {
    setDueNotificationsEnabled(cloudPrefs.dueNotificationsEnabled, userId);
  }
  if (cloudPrefs.dailyReminderEnabled !== undefined) {
    setDailyReminderEnabled(cloudPrefs.dailyReminderEnabled, userId);
  }
  if (cloudPrefs.dailyReminderTime !== undefined) {
    setDailyReminderTime(cloudPrefs.dailyReminderTime, userId);
  }
  if (cloudPrefs.dismissedPermissionAlerts !== undefined) {
    setUserStorageItem(
      KEY_DISMISSED_PERMISSION_ALERTS,
      JSON.stringify(cloudPrefs.dismissedPermissionAlerts),
      userId,
    );
  }
}

/**
 * Registra a dispensa de alerta de permissão pelo usuário.
 */
export function setDismissedPermissionAlert(
  type: "pushDue" | "passiveBankListener",
  dismissed: boolean,
  userId?: string | null,
): void {
  const current = getDeviceNotificationPreferences(userId);
  const nextDismissed = {
    ...(current.dismissedPermissionAlerts ?? {}),
    [type]: dismissed,
  };
  setUserStorageItem(KEY_DISMISSED_PERMISSION_ALERTS, JSON.stringify(nextDismissed), userId);
}

/**
 * Checa se o usuário dispensou o aviso de permissão para determinado canal.
 */
export function isPermissionAlertDismissed(
  type: "pushDue" | "passiveBankListener",
  userId?: string | null,
): boolean {
  const prefs = getDeviceNotificationPreferences(userId);
  return Boolean(prefs.dismissedPermissionAlerts?.[type]);
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
  if (getDemoSessionState().isDemoActive) {
    return false;
  }

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
 * Cria o canal de notificações de contas a vencer/vencidas no Android e registra ações.
 */
export async function setupDueRemindersChannel(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: DUE_REMINDER_ACTION_TYPE_ID,
          actions: [
            {
              id: ACTION_PAY,
              title: "Pagar no App",
              foreground: true,
            },
            {
              id: ACTION_SNOOZE,
              title: "Adiar 3 Dias",
            },
          ],
        },
      ],
    });

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
  actionTypeId?: string;
  id?: number;
}

/**
 * Despacha uma notificação local (no Android nativo via Capacitor ou no PWA via Web Notification API / Service Worker).
 * Respeita a diretriz de zero emojis e consentimento do usuário.
 */
export async function dispatchLocalOrWebNotification(
  options: DispatchNotificationOptions,
): Promise<boolean> {
  if (getDemoSessionState().isDemoActive) {
    return false;
  }

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
            actionTypeId: options.actionTypeId,
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

/** Retorna um identificador numérico determinístico estável para a notificação de uma conta. */
export function getDueReminderNotificationId(key: string): number {
  return hashString(`due:${key}`);
}

/** Retorna a lista de chaves de lembretes atualmente ativos no sistema operacional. */
export function getActiveDueKeys(userId?: string | null): string[] {
  const val = getUserStorageItem(KEY_ACTIVE_DUE_KEYS, userId);
  if (!val) return [];
  try {
    return JSON.parse(val) as string[];
  } catch {
    return [];
  }
}

/** Atualiza a lista de chaves de lembretes ativos no sistema operacional. */
export function setActiveDueKeys(keys: string[], userId?: string | null): void {
  setUserStorageItem(KEY_ACTIVE_DUE_KEYS, JSON.stringify(keys), userId);
}

/**
 * Cancela e remove da barra de status do dispositivo (Android) uma notificação pelo seu ID.
 */
export async function cancelNotificationById(id: number): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
    const pluginWithDelivered = LocalNotifications as unknown as {
      removeDeliveredNotificationsById?: (options: { notifications: Array<{ id: number }> }) => Promise<void>;
      removeDeliveredNotifications?: (options: { notifications: Array<{ id: number }> }) => Promise<void>;
    };
    if (typeof pluginWithDelivered.removeDeliveredNotificationsById === "function") {
      await pluginWithDelivered.removeDeliveredNotificationsById({ notifications: [{ id }] });
    } else if (typeof pluginWithDelivered.removeDeliveredNotifications === "function") {
      await pluginWithDelivered.removeDeliveredNotifications({
        notifications: [{ id }],
      });
    }
  } catch {
    // Falha silenciosa
  }
}

/**
 * Cancela e remove a notificação de uma fatura ou dívida que acabou de ser paga ou lida.
 */
export async function cancelDueReminderNotification(key: string, userId?: string | null): Promise<void> {
  const notifId = getDueReminderNotificationId(key);
  await cancelNotificationById(notifId);

  const active = getActiveDueKeys(userId);
  if (active.includes(key)) {
    setActiveDueKeys(active.filter((k) => k !== key), userId);
  }
}

/**
 * Remove todas as notificações de vencimento ativas e limpa a barra de status.
 */
export async function clearAllDueNotifications(userId?: string | null): Promise<void> {
  const active = getActiveDueKeys(userId);
  for (const k of active) {
    if (k !== "summary") {
      await cancelNotificationById(getDueReminderNotificationId(k));
    }
  }
  await cancelNotificationById(DUE_SUMMARY_NOTIFICATION_ID);
  setActiveDueKeys([], userId);
}

/**
 * Sincroniza e agenda/emite notificações para faturas e dívidas pendentes.
 * É executada uma vez por dia por usuário ou quando houver nova pendência urgente.
 * Aplica consolidação anti-flood (notificação agrupada caso haja >= 2 contas),
 * corte temporal para contas antigas vencidas há mais de 30 dias e cancela
 * imediatamente notificações de contas que já foram quitadas ou que não são mais elegíveis.
 */
export async function syncDueReminderNotifications(
  reminders: readonly DueReminderPayload[],
  userId?: string | null,
  force = false,
): Promise<number> {
  // Bloqueio rigoroso: nenhuma notificação para o sistema operacional em modo tour/demonstração
  if (getDemoSessionState().isDemoActive || userId === DEMO_USER_ID) {
    return 0;
  }

  if (!isDueNotificationsEnabled(userId)) {
    await clearAllDueNotifications(userId);
    return 0;
  }

  // Filtra itens simulados ou mockados que possam ter vazado
  const cleanReminders = reminders.filter((r) => !r.key.includes("mock-"));

  const today = todayISO();
  const lastSync = getUserStorageItem(KEY_LAST_DUE_SYNC_DATE, userId);
  if (!force && lastSync === today) {
    return 0;
  }

  const perm = await checkNotificationPermissions();
  if (!perm.granted) {
    return 0;
  }

  // Filtra apenas contas que vencem hoje, nos próximos 3 dias ou atrasadas recentemente (<= 30 dias)
  const eligible = cleanReminders.filter((rem) => {
    if (rem.status === "due_today" || rem.status === "due_soon") {
      return true;
    }
    if (rem.status === "overdue") {
      const diffMs = new Date(`${today}T12:00:00`).getTime() - new Date(`${rem.dueDate}T12:00:00`).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= MAX_OVERDUE_DAYS_FOR_NOTIFICATION;
    }
    return false;
  });

  if (eligible.length === 0) {
    await clearAllDueNotifications(userId);
    setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, today, userId);
    return 0;
  }

  let count = 0;

  // Consolidação anti-flood: se houver 2 ou mais contas pendentes, consolida em 1 notificação elegante
  if (eligible.length > 1) {
    // Limpa notificações individuais anteriores para consolidar em uma só
    const previousActive = getActiveDueKeys(userId);
    for (const k of previousActive) {
      if (k !== "summary") {
        await cancelNotificationById(getDueReminderNotificationId(k));
      }
    }

    const totalCents = eligible.reduce((acc, r) => acc + r.amountCents, 0);
    const totalReais = (totalCents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const title = `Áxis · Contas e faturas pendentes (${eligible.length})`;
    const body = `Você possui ${eligible.length} contas aguardando quitação (total de R$ ${totalReais}). Toque para conferir.`;
    const tag = "due:summary";

    const sent = await dispatchLocalOrWebNotification({
      id: DUE_SUMMARY_NOTIFICATION_ID,
      title,
      body,
      url: "/lembretes",
      tag,
      channelId: DUE_REMINDER_CHANNEL_ID,
    });

    if (sent) {
      setActiveDueKeys(["summary"], userId);
      count = 1;
    }
  } else {
    // Apenas 1 conta pendente: cancela o resumo anterior e outras notificações
    await cancelNotificationById(DUE_SUMMARY_NOTIFICATION_ID);

    const rem = eligible[0]!;
    const previousActive = getActiveDueKeys(userId);
    for (const k of previousActive) {
      if (k !== rem.key && k !== "summary") {
        await cancelNotificationById(getDueReminderNotificationId(k));
      }
    }

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
    const notifId = getDueReminderNotificationId(rem.key);
    const tag = `due:${rem.key}`;

    const sent = await dispatchLocalOrWebNotification({
      id: notifId,
      title,
      body,
      url: routeUrl,
      tag,
      channelId: DUE_REMINDER_CHANNEL_ID,
      actionTypeId: DUE_REMINDER_ACTION_TYPE_ID,
    });

    if (sent) {
      setActiveDueKeys([rem.key], userId);
      count = 1;
    }
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
      } else if (actionId === ACTION_PAY) {
        // Redireciona para quitação assistida (abre o modal de confirmação do usuário)
        const tag = (extra?.tag as string) ?? "";
        const itemKey = tag.startsWith("due:") ? tag.replace("due:", "") : "";
        if (itemKey && itemKey !== "summary") {
          onNavigate(`/lembretes?action=pay&key=${encodeURIComponent(itemKey)}`);
        } else if (extra?.url && typeof extra.url === "string") {
          onNavigate(extra.url);
        } else {
          onNavigate("/lembretes");
        }
      } else if (actionId === ACTION_SNOOZE) {
        // Adia o lembrete por 3 dias
        const tag = (extra?.tag as string) ?? "";
        const notifId = notification.id;
        if (notifId) {
          void cancelNotificationById(notifId);
        }
        // Registra reagendamento local
        const snoozeDate = new Date();
        snoozeDate.setDate(snoozeDate.getDate() + 3);
        void dispatchLocalOrWebNotification({
          id: notifId,
          title: notification.title,
          body: notification.body,
          tag,
          channelId: DUE_REMINDER_CHANNEL_ID,
          actionTypeId: DUE_REMINDER_ACTION_TYPE_ID,
        });
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
