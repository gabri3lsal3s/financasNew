import { LocalNotifications } from "@capacitor/local-notifications";
import {
  getKnownRecipientVersion,
  getOrCreatePushInstallationId,
} from "@/data/repositories/push-subscriptions";
import { setReminderState } from "@/data/repositories/reminder-states";
import { addDaysISO, todayISO } from "@/domain/debts/index";
import { DEMO_USER_ID } from "@/domain/demo-simulation/mock-finances";
import { DEFAULT_QUIET_HOURS, MAX_OVERDUE_DAYS_FOR_NOTIFICATION, adjustDateForQuietHours, buildDueNotificationSchedule, normalizeQuietHours, type QuietHoursConfig } from "@/domain/notifications/schedule";
import { inferCategoryKeyword } from "@/domain/notifications/category-inference";
import { type ParsedBankTransaction } from "@/domain/notifications/bank-parser";
import { getDemoSessionState } from "@/state/demo-mode/demo-session-store";
import { getActiveUserId, getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { isNativePlatform } from "./platform";
import {
  ACTION_EDIT,
  ACTION_QUICK_ADD,
  ACTION_UNDO,
  buildReviewRoute,
  hashString,
  quickAddTransaction,
  undoQuickAddTransaction,
} from "./interactive-notifications";

export { MAX_OVERDUE_DAYS_FOR_NOTIFICATION };

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
const KEY_LAST_DUE_SCHEDULE_SIG = "due_notifications_last_schedule_sig";
const KEY_ACTIVE_DUE_KEYS = "due_notifications_active_keys";
const KEY_SNOOZED_DUE_NOTIFS = "due_notifications_snoozed";
const KEY_REMINDER_TIME = "daily_reminder_time";
const KEY_REMOTE_PUSH_ENABLED = "device_notifications_remote_push_enabled";
const KEY_QUIET_HOURS = "device_notifications_quiet_hours";
const DEFAULT_REMINDER_TIME = "20:00";

let isActionListenerActive = false;

const KEY_DISMISSED_PERMISSION_ALERTS = "device_notifications_dismissed_permission_alerts";

export interface DeviceNotificationPreferences {
  dueNotificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  remotePushEnabled: boolean;
  quietHours: QuietHoursConfig;
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
 * Lê se o push remoto está habilitado para este usuário.
 */
export function isRemotePushEnabled(userId?: string | null): boolean {
  return getUserStorageItem(KEY_REMOTE_PUSH_ENABLED, userId) === "true";
}

/**
 * Atualiza a preferência local de push remoto.
 */
export function setRemotePushEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_REMOTE_PUSH_ENABLED, String(enabled), userId);
}

/**
 * Lê a configuração de Horário Silencioso (Quiet Hours) do usuário com fallback seguro (22:00–08:00).
 */
export function getQuietHoursConfig(userId?: string | null): QuietHoursConfig {
  const raw = getUserStorageItem(KEY_QUIET_HOURS, userId);
  if (!raw) return { ...DEFAULT_QUIET_HOURS };
  try {
    return normalizeQuietHours(JSON.parse(raw) as Partial<QuietHoursConfig>);
  } catch {
    return { ...DEFAULT_QUIET_HOURS };
  }
}

/**
 * Persiste atualização parcial do Horário Silencioso localmente com normalização.
 */
export function setQuietHoursConfig(
  patch: Partial<QuietHoursConfig>,
  userId?: string | null,
): QuietHoursConfig {
  const current = getQuietHoursConfig(userId);
  const next = normalizeQuietHours({ ...current, ...patch });
  setUserStorageItem(KEY_QUIET_HOURS, JSON.stringify(next), userId);
  return next;
}

/**
 * Obtém as preferências consolidadas de notificações no dispositivo.
 */
export function getDeviceNotificationPreferences(userId?: string | null): DeviceNotificationPreferences {
  const rawDue = getUserStorageItem(KEY_DUE_NOTIFICATIONS_ENABLED, userId);
  const rawDaily = getUserStorageItem(KEY_REMINDER_ENABLED, userId);
  const rawTime = getUserStorageItem(KEY_REMINDER_TIME, userId);
  const rawRemotePush = getUserStorageItem(KEY_REMOTE_PUSH_ENABLED, userId);
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
    remotePushEnabled: rawRemotePush === "true",
    quietHours: getQuietHoursConfig(userId),
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
    remotePushEnabled?: boolean;
    quietHours?: Partial<QuietHoursConfig>;
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
  if (cloudPrefs.remotePushEnabled !== undefined) {
    setRemotePushEnabled(cloudPrefs.remotePushEnabled, userId);
  }
  if (cloudPrefs.quietHours !== undefined) {
    setQuietHoursConfig(cloudPrefs.quietHours, userId);
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
 * Agenda o lembrete de fechamento diário com botões de ação rápida (exclusivo no app Android nativo).
 * Retorna `false` na Web/PWA pois navegadores não suportam alarmes locais recorrentes offline.
 */
export async function scheduleDailyReminder(options?: {
  hour?: number;
  minute?: number;
  requestPermission?: boolean;
}): Promise<boolean> {
  if (getDemoSessionState().isDemoActive) {
    return false;
  }

  const hour = options?.hour ?? 20;
  const minute = options?.minute ?? 0;

  if (!isNativePlatform()) {
    return false;
  }

  try {
    const permissions =
      options?.requestPermission === false
        ? await checkNotificationPermissions()
        : await requestNotificationPermissions();
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
          title: "Fechamento Diário — Axir",
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
  scheduleAt?: Date;
  userId?: string | null;
  installationId?: string;
  recipientVersion?: number;
}

const NEUTRAL_LOCAL_TITLE = "Axir";
const NEUTRAL_LOCAL_BODY = "Você tem uma nova atualização na sua Central de Notificações.";

const SENSITIVE_LOCAL_PATTERNS = [
  /R\$\s*[\d.,]+/i,
  /\$\s*[\d.,]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
];

function sanitizeNeutralNotificationText(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback;
  for (const pattern of SENSITIVE_LOCAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }
  return trimmed;
}

function sanitizeNotificationUrl(rawUrl: string | undefined): string | undefined {
  if (typeof rawUrl !== "string") return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) return "/lembretes";

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://axir.local";
    const parsed = new URL(trimmed, base);
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      if (typeof window !== "undefined" && parsed.origin !== window.location.origin) {
        return "/lembretes";
      }
    }
    parsed.searchParams.delete("account");
    parsed.searchParams.delete("switchAccount");
    parsed.searchParams.delete("user_id");
    parsed.searchParams.delete("userId");
    parsed.searchParams.delete("token");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/lembretes";
  }
}

function isNotificationContextValid(
  extra: Record<string, unknown> | undefined,
  activeUserId?: string | null,
): boolean {
  if (!extra) return true;

  const currentInstallationId = getOrCreatePushInstallationId();
  if (
    typeof extra.installationId === "string" &&
    extra.installationId.trim().length > 0 &&
    extra.installationId.trim() !== currentInstallationId
  ) {
    return false;
  }

  const notifUserId =
    typeof extra.recipientUserId === "string" ? extra.recipientUserId.trim() : "";
  if (notifUserId && activeUserId && notifUserId !== activeUserId) {
    return false;
  }

  const rawVersion = extra.recipientVersion;
  const parsedVersion =
    typeof rawVersion === "number" && Number.isInteger(rawVersion) && rawVersion >= 1
      ? rawVersion
      : typeof rawVersion === "string" && /^\d+$/.test(rawVersion.trim())
        ? Number(rawVersion.trim())
        : null;

  if (parsedVersion !== null) {
    const knownVersion = getKnownRecipientVersion(notifUserId || activeUserId);
    if (knownVersion !== null && parsedVersion < knownVersion) {
      return false;
    }
  }

  return true;
}

/**
 * Despacha uma notificação local (no Android nativo via Capacitor ou no PWA via Web Notification API / Service Worker).
 * Respeita a diretriz de zero emojis, payload neutro (sem PII/valores) e isolamento por instalação.
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

  const safeTitle = sanitizeNeutralNotificationText(options.title, NEUTRAL_LOCAL_TITLE);
  const safeBody = sanitizeNeutralNotificationText(options.body, NEUTRAL_LOCAL_BODY);
  const safeUrl = sanitizeNotificationUrl(options.url);
  const installationId = options.installationId?.trim() || getOrCreatePushInstallationId();
  const recipientUserId = options.userId?.trim() || undefined;
  const recipientVersion =
    options.recipientVersion ?? getKnownRecipientVersion(recipientUserId) ?? 1;

  if (isNativePlatform()) {
    try {
      await setupDueRemindersChannel();
      const notifId =
        options.id ??
        (options.tag ? hashString(options.tag) : Math.floor(Math.random() * 100000) + 10000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: safeTitle,
            body: safeBody,
            channelId: options.channelId ?? DUE_REMINDER_CHANNEL_ID,
            actionTypeId: options.actionTypeId,
            ...(options.scheduleAt
              ? { schedule: { at: options.scheduleAt, allowWhileIdle: true } }
              : {}),
            extra: {
              url: safeUrl,
              tag: options.tag,
              installationId,
              recipientVersion,
              ...(recipientUserId ? { recipientUserId } : {}),
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
          await registration.showNotification(safeTitle, {
            body: safeBody,
            icon: "/pwa/icons/icon-192.png",
            badge: "/pwa/icons/icon-192.png",
            tag: options.tag,
            data: {
              url: safeUrl,
              installationId,
              recipientVersion,
              ...(recipientUserId ? { recipientUserId } : {}),
            },
          });
          return true;
        }
      }

      // Fallback para Notification direta da janela
      const notif = new Notification(safeTitle, {
        body: safeBody,
        icon: "/pwa/icons/icon-192.png",
        tag: options.tag,
      });

      if (safeUrl) {
        const rawUrl = safeUrl.trim();
        notif.onclick = () => {
          window.focus();
          if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
            window.location.href = rawUrl;
          } else {
            try {
              const parsed = new URL(rawUrl, window.location.origin);
              if (parsed.origin === window.location.origin) {
                window.location.href = parsed.href;
              }
            } catch {
              // URL inválida ignorada por segurança
            }
          }
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
  direction?: "payable" | "receivable";
  title: string;
  dueDate: string;
  amountCents: number;
  status: "overdue" | "due_today" | "due_soon" | "pending";
  link?: { path: string; params?: Record<string, string> };
}

/** Retorna um identificador numérico determinístico estável para a notificação de uma conta. */
export function getDueReminderNotificationId(key: string): number {
  return hashString(`due:${key}`);
}

/** Retorna um identificador numérico determinístico para agrupamento diário futuro agendado. */
export function getDueScheduledDayNotificationId(dueDate: string): number {
  return hashString(`due:day:${dueDate}`);
}

function resolveDueNotificationId(key: string): number {
  if (key === "summary") {
    return DUE_SUMMARY_NOTIFICATION_ID;
  }
  if (key.startsWith("day:")) {
    return getDueScheduledDayNotificationId(key.slice(4));
  }
  return getDueReminderNotificationId(key);
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

interface SnoozedDueNotifEntry {
  key: string;
  id: number;
  untilIso: string;
}

function getSnoozedDueNotifs(userId?: string | null): SnoozedDueNotifEntry[] {
  const val = getUserStorageItem(KEY_SNOOZED_DUE_NOTIFS, userId);
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (!Array.isArray(parsed)) return [];
    const today = todayISO();
    return parsed.filter(
      (item): item is SnoozedDueNotifEntry =>
        typeof item?.key === "string" &&
        typeof item?.id === "number" &&
        typeof item?.untilIso === "string" &&
        item.untilIso > today,
    );
  } catch {
    return [];
  }
}

function setSnoozedDueNotifs(entries: SnoozedDueNotifEntry[], userId?: string | null): void {
  const today = todayISO();
  const valid = entries.filter((item) => item.untilIso > today);
  setUserStorageItem(KEY_SNOOZED_DUE_NOTIFS, JSON.stringify(valid), userId);
}

function addSnoozedDueNotif(entry: SnoozedDueNotifEntry, userId?: string | null): void {
  const current = getSnoozedDueNotifs(userId).filter((s) => s.key !== entry.key && s.id !== entry.id);
  setSnoozedDueNotifs([...current, entry], userId);
}

function removeSnoozedDueNotifByKey(key: string, userId?: string | null): void {
  if (!key) return;
  const current = getSnoozedDueNotifs(userId);
  const next = current.filter((s) => s.key !== key);
  if (next.length !== current.length) {
    setSnoozedDueNotifs(next, userId);
  }
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
  if (active.includes("summary")) {
    await cancelNotificationById(DUE_SUMMARY_NOTIFICATION_ID);
  }
  for (const activeKey of active) {
    if (activeKey.startsWith("day:")) {
      await cancelNotificationById(resolveDueNotificationId(activeKey));
    }
  }
  const nextActive = active.filter(
    (k) => k !== key && k !== "summary" && !k.startsWith("day:"),
  );
  if (nextActive.length !== active.length) {
    setActiveDueKeys(nextActive, userId);
  }
  setUserStorageItem(KEY_LAST_DUE_SCHEDULE_SIG, "", userId);
}

/**
 * Remove todas as notificações de vencimento ativas e limpa a barra de status.
 */
export async function clearAllDueNotifications(
  userId?: string | null,
  options?: { preserveSnoozed?: boolean },
): Promise<void> {
  const preserveSnoozed = options?.preserveSnoozed ?? false;
  const snoozed = getSnoozedDueNotifs(userId);
  const snoozedKeys = new Set(snoozed.map((s) => s.key));
  const active = getActiveDueKeys(userId);
  for (const k of active) {
    if (preserveSnoozed && snoozedKeys.has(k)) continue;
    if (k !== "summary") {
      await cancelNotificationById(resolveDueNotificationId(k));
    }
  }
  await cancelNotificationById(DUE_SUMMARY_NOTIFICATION_ID);
  if (!preserveSnoozed) {
    for (const entry of snoozed) {
      await cancelNotificationById(entry.id);
    }
    setSnoozedDueNotifs([], userId);
  }
  setActiveDueKeys(preserveSnoozed ? active.filter((k) => snoozedKeys.has(k)) : [], userId);
  setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, "", userId);
  setUserStorageItem(KEY_LAST_DUE_SCHEDULE_SIG, "", userId);
}

/**
 * Sincroniza e agenda notificações híbridas para contas a pagar pendentes:
 * - Hoje / atrasadas (<= 30d): disparo único diário com consolidação anti-flood.
 * - Próximos 7 dias (Android nativo): agendamento antecipado às 09:00 (`schedule.at`),
 *   agrupado por data e respeitando o Horário Silencioso (Quiet Hours).
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

  const today = todayISO();
  const isNative = isNativePlatform();
  const lastSync = getUserStorageItem(KEY_LAST_DUE_SYNC_DATE, userId);
  const lastScheduleSig = getUserStorageItem(KEY_LAST_DUE_SCHEDULE_SIG, userId);

  const perm = await checkNotificationPermissions();
  if (!perm.granted) {
    return 0;
  }

  const quietHours = getQuietHoursConfig(userId);
  const plan = buildDueNotificationSchedule({
    reminders,
    today,
    now: new Date(),
    isNative,
    quietHours,
  });

  if (plan.length === 0) {
    if (!force && lastSync === today && (!isNative || lastScheduleSig === "[]")) {
      return 0;
    }
    await clearAllDueNotifications(userId, { preserveSnoozed: true });
    setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, today, userId);
    if (isNative) {
      setUserStorageItem(KEY_LAST_DUE_SCHEDULE_SIG, "[]", userId);
    }
    return 0;
  }

  const todayPlan = plan.filter((item) => item.scope === "today");
  const upcomingPlan = plan.filter((item) => item.scope === "upcoming");
  const upcomingSig = JSON.stringify(
    upcomingPlan.map((u) => [u.key, u.dueDate, u.title, u.body, u.scheduleAt?.getTime() ?? 0]),
  );

  const shouldDispatchToday = force || lastSync !== today;
  const shouldSyncUpcoming = isNative && (force || lastScheduleSig !== upcomingSig);

  if (!shouldDispatchToday && !shouldSyncUpcoming) {
    return 0;
  }

  const desiredKeys = new Set(plan.map((p) => p.key));
  const todayKeys = new Set(todayPlan.map((p) => p.key));
  const upcomingKeys = new Set(upcomingPlan.map((p) => p.key));
  const previousActive = getActiveDueKeys(userId);
  const snoozedKeys = new Set(getSnoozedDueNotifs(userId).map((s) => s.key));

  for (const prevKey of previousActive) {
    if (snoozedKeys.has(prevKey)) {
      continue;
    }
    if (!desiredKeys.has(prevKey)) {
      await cancelNotificationById(resolveDueNotificationId(prevKey));
      continue;
    }
    if (shouldSyncUpcoming && prevKey.startsWith("day:") && !upcomingKeys.has(prevKey)) {
      await cancelNotificationById(resolveDueNotificationId(prevKey));
    }
  }

  if (shouldDispatchToday && todayPlan.some((p) => !p.isSummary) && previousActive.includes("summary")) {
    await cancelNotificationById(DUE_SUMMARY_NOTIFICATION_ID);
  }

  const toDispatch = [
    ...(shouldDispatchToday ? todayPlan : []),
    ...(shouldSyncUpcoming ? upcomingPlan : []),
  ];

  const activeKeysSet = new Set(
    previousActive.filter((k) => {
      if (!desiredKeys.has(k)) return false;
      if (shouldDispatchToday && todayKeys.has(k)) return false;
      if (shouldSyncUpcoming && upcomingKeys.has(k)) return false;
      return true;
    }),
  );

  let count = 0;
  for (const item of toDispatch) {
    const notifId = resolveDueNotificationId(item.key);
    const sent = await dispatchLocalOrWebNotification({
      id: notifId,
      title: item.title,
      body: item.body,
      url: item.url,
      tag: item.tag,
      channelId: DUE_REMINDER_CHANNEL_ID,
      actionTypeId: item.actionTypeId,
      scheduleAt: item.scheduleAt,
      userId,
    });
    if (sent) {
      activeKeysSet.add(item.key);
      count += 1;
    }
  }

  setActiveDueKeys(Array.from(activeKeysSet), userId);
  if (shouldDispatchToday) {
    setUserStorageItem(KEY_LAST_DUE_SYNC_DATE, today, userId);
  }
  if (isNative && shouldSyncUpcoming) {
    setUserStorageItem(KEY_LAST_DUE_SCHEDULE_SIG, upcomingSig, userId);
  }
  return count;
}

/**
 * Registra o manipulador de ações do usuário disparadas a partir das notificações.
 */
export function initNotificationActionListener(
  onNavigate: (routePath: string) => void,
  options?: { activeUserId?: string | null },
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

      if (!isNotificationContextValid(extra, options?.activeUserId)) {
        return;
      }

      if (actionId === ACTION_QUICK_ADD) {
        if (extra?.suggestion) {
          const sug = extra.suggestion as ParsedBankTransaction;
          void quickAddTransaction(sug).then((res) => {
            if (!res.success && res.requiresWizard) {
              onNavigate(buildReviewRoute(sug));
            }
          });
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
        if (itemKey) {
          removeSnoozedDueNotifByKey(itemKey);
        }
        if (itemKey && itemKey !== "summary" && !itemKey.startsWith("day:")) {
          onNavigate(`/lembretes?action=pay&key=${encodeURIComponent(itemKey)}`);
        } else if (extra?.url && typeof extra.url === "string") {
          onNavigate(sanitizeNotificationUrl(extra.url) ?? "/lembretes");
        } else {
          onNavigate("/lembretes");
        }
      } else if (actionId === ACTION_SNOOZE) {
        // Adia o lembrete por 3 dias (agendado para 09:00, respeitando Horário Silencioso) e persiste o snooze no banco
        const tag = (extra?.tag as string) ?? "";
        const itemKey = tag.startsWith("due:") ? tag.replace("due:", "") : "";
        const untilIso = addDaysISO(todayISO(), 3);
        const notifId =
          notification.id ?? (itemKey ? resolveDueNotificationId(itemKey) : hashString(tag || "due:snooze"));
        if (notification.id) {
          void cancelNotificationById(notification.id);
        }
        addSnoozedDueNotif(
          {
            key: itemKey || `notif:${notifId}`,
            id: notifId,
            untilIso,
          },
          undefined,
        );
        if (itemKey && itemKey !== "summary" && !itemKey.startsWith("day:")) {
          void setReminderState(itemKey, {
            kind: "snoozed",
            snoozeUntil: untilIso,
          })
            .then(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("axir:reminder-states-changed"));
              }
            })
            .catch(() => {});
        }
        const rawSnoozeDate = new Date();
        rawSnoozeDate.setDate(rawSnoozeDate.getDate() + 3);
        rawSnoozeDate.setHours(9, 0, 0, 0);
        const snoozeDate = adjustDateForQuietHours(rawSnoozeDate, getQuietHoursConfig());
        const snoozeUserId =
          typeof extra?.recipientUserId === "string" ? extra.recipientUserId : getActiveUserId() ?? undefined;
        void dispatchLocalOrWebNotification({
          id: notifId,
          title: "Lembrete adiado — Confira sua pendência",
          body: notification.body,
          url: typeof extra?.url === "string" ? extra.url : "/lembretes",
          tag,
          channelId: DUE_REMINDER_CHANNEL_ID,
          actionTypeId: DUE_REMINDER_ACTION_TYPE_ID,
          scheduleAt: snoozeDate,
          userId: snoozeUserId,
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
          onNavigate(sanitizeNotificationUrl(extra.url) ?? "/lembretes");
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
