import { addDaysISO } from "@/domain/debts";

export interface QuietHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
}

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  start: "22:00",
  end: "08:00",
};

export const DUE_SCHEDULE_HORIZON_DAYS = 7;
export const DEFAULT_DUE_REMINDER_HOUR = 9;
export const DEFAULT_DUE_REMINDER_MINUTE = 0;
export const MAX_OVERDUE_DAYS_FOR_NOTIFICATION = 30;
export const DUE_REMINDER_ACTION_TYPE = "DUE_REMINDER_ACTIONS";

export interface DueScheduleInputItem {
  key: string;
  kind: "bill" | "debt";
  direction?: "payable" | "receivable";
  title: string;
  dueDate: string;
  amountCents: number;
  status: "overdue" | "due_today" | "due_soon" | "pending";
  link?: { path: string; params?: Record<string, string> };
}

export interface ScheduledDueNotification {
  scope: "today" | "upcoming";
  dueDate: string;
  key: string;
  tag: string;
  title: string;
  body: string;
  url: string;
  isSummary: boolean;
  actionTypeId?: string;
  scheduleAt?: Date;
}

export interface BuildDueScheduleOptions {
  reminders: readonly DueScheduleInputItem[];
  today: string;
  now?: Date;
  isNative?: boolean;
  horizonDays?: number;
  maxOverdueDays?: number;
  quietHours?: QuietHoursConfig;
  reminderHour?: number;
  reminderMinute?: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function diffDaysBetween(fromISO: string, toISO: string): number {
  const fromMs = new Date(`${fromISO}T12:00:00`).getTime();
  const toMs = new Date(`${toISO}T12:00:00`).getTime();
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

function formatCentsPtBr(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildReminderUrl(item: DueScheduleInputItem): string {
  const basePath = item.link?.path || (item.kind === "bill" ? "/cartoes" : "/dividas");
  if (!item.link?.params) {
    return basePath;
  }
  const query = new URLSearchParams(item.link.params).toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildLocalDateAtTime(isoDate: string, hour: number, minute: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Faz parsing seguro de horário "HH:MM", retornando fallback em caso de entrada inválida.
 */
export function parseTimeHHMM(
  value: string | null | undefined,
  fallbackHour: number,
  fallbackMinute = 0,
): { hour: number; minute: number } {
  if (typeof value !== "string") {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  return { hour, minute };
}

/**
 * Normaliza configuração de Horário Silencioso (Quiet Hours) com fallbacks seguros.
 */
export function normalizeQuietHours(raw?: Partial<QuietHoursConfig> | null): QuietHoursConfig {
  const [defaultStartH, defaultStartM] = DEFAULT_QUIET_HOURS.start.split(":").map(Number);
  const [defaultEndH, defaultEndM] = DEFAULT_QUIET_HOURS.end.split(":").map(Number);

  const startParsed = parseTimeHHMM(raw?.start, defaultStartH ?? 22, defaultStartM ?? 0);
  const endParsed = parseTimeHHMM(raw?.end, defaultEndH ?? 8, defaultEndM ?? 0);

  return {
    enabled:
      typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULT_QUIET_HOURS.enabled,
    start: `${pad2(startParsed.hour)}:${pad2(startParsed.minute)}`,
    end: `${pad2(endParsed.hour)}:${pad2(endParsed.minute)}`,
  };
}

/**
 * Verifica se uma data/hora recai dentro do intervalo de Horário Silencioso.
 * Trata corretamente janelas que atravessam a meia-noite (ex.: 22:00 às 08:00).
 */
export function isWithinQuietHours(date: Date, quietHours: QuietHoursConfig): boolean {
  if (!quietHours.enabled) return false;
  const start = parseTimeHHMM(quietHours.start, 22, 0);
  const end = parseTimeHHMM(quietHours.end, 8, 0);
  const startMins = start.hour * 60 + start.minute;
  const endMins = end.hour * 60 + end.minute;

  if (startMins === endMins) return false;

  const currentMins = date.getHours() * 60 + date.getMinutes();
  if (startMins < endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}

/**
 * Ajusta uma data para o término do Horário Silencioso caso caia dentro da janela configurada.
 * Retorna uma nova instância `Date` sem mutar a original.
 */
export function adjustDateForQuietHours(date: Date, quietHours: QuietHoursConfig): Date {
  const clone = new Date(date.getTime());
  if (!isWithinQuietHours(clone, quietHours)) {
    return clone;
  }

  const start = parseTimeHHMM(quietHours.start, 22, 0);
  const end = parseTimeHHMM(quietHours.end, 8, 0);
  const startMins = start.hour * 60 + start.minute;
  const endMins = end.hour * 60 + end.minute;
  const currentMins = clone.getHours() * 60 + clone.getMinutes();

  if (startMins > endMins && currentMins >= startMins) {
    clone.setDate(clone.getDate() + 1);
  }
  clone.setHours(end.hour, end.minute, 0, 0);
  return clone;
}

/**
 * Monta o plano híbrido de notificações de vencimento:
 * - Balde imediato ("today"): contas atrasadas (<= 30d) e que vencem hoje (e due_soon na Web),
 *   com consolidação anti-flood quando >= 2 contas e respeito ao Horário Silencioso no Android e na Web.
 * - Balde futuro ("upcoming", apenas nativo): agendamento antecipado de até 7 dias (`schedule.at` às 09:00),
 *   agrupado por dia de vencimento para evitar excesso de notificações e respeitando o Horário Silencioso.
 */
export function buildDueNotificationSchedule(
  options: BuildDueScheduleOptions,
): ScheduledDueNotification[] {
  const {
    reminders,
    today,
    now = new Date(),
    isNative = true,
    horizonDays = DUE_SCHEDULE_HORIZON_DAYS,
    maxOverdueDays = MAX_OVERDUE_DAYS_FOR_NOTIFICATION,
    quietHours = DEFAULT_QUIET_HOURS,
    reminderHour = DEFAULT_DUE_REMINDER_HOUR,
    reminderMinute = DEFAULT_DUE_REMINDER_MINUTE,
  } = options;

  const normalizedQuietHours = normalizeQuietHours(quietHours);
  if (!isNative && isWithinQuietHours(now, normalizedQuietHours)) {
    return [];
  }
  const horizonEnd = horizonDays > 0 ? addDaysISO(today, horizonDays) : today;

  const todayItems: DueScheduleInputItem[] = [];
  const upcomingByDate = new Map<string, DueScheduleInputItem[]>();

  for (const rem of reminders) {
    if (rem.key.includes("mock-")) continue;
    if (rem.direction === "receivable") continue;

    if (rem.status === "overdue") {
      if (diffDaysBetween(rem.dueDate, today) > maxOverdueDays) continue;
      todayItems.push(rem);
      continue;
    }

    if (rem.status === "due_today") {
      todayItems.push(rem);
      continue;
    }

    if (!isNative) {
      if (rem.status === "due_soon" || rem.dueDate <= today) {
        if (rem.dueDate < today && diffDaysBetween(rem.dueDate, today) > maxOverdueDays) {
          continue;
        }
        todayItems.push(rem);
      }
      continue;
    }

    // Nativo: itens vencidos/de hoje ainda com status genérico ficam no balde imediato;
    // itens dos próximos `horizonDays` dias entram no agendamento futuro por data.
    if (rem.dueDate <= today) {
      if (rem.dueDate < today && diffDaysBetween(rem.dueDate, today) > maxOverdueDays) {
        continue;
      }
      todayItems.push(rem);
    } else if (horizonDays > 0 && rem.dueDate <= horizonEnd) {
      const bucket = upcomingByDate.get(rem.dueDate);
      if (bucket) {
        bucket.push(rem);
      } else {
        upcomingByDate.set(rem.dueDate, [rem]);
      }
    }
  }

  const schedule: ScheduledDueNotification[] = [];

  if (todayItems.length > 1) {
    const totalCents = todayItems.reduce((acc, item) => acc + item.amountCents, 0);
    const totalReais = formatCentsPtBr(totalCents);
    const scheduleAt =
      isNative && isWithinQuietHours(now, normalizedQuietHours)
        ? adjustDateForQuietHours(now, normalizedQuietHours)
        : undefined;

    schedule.push({
      scope: "today",
      dueDate: today,
      key: "summary",
      tag: "due:summary",
      title: `Axir · Contas e faturas pendentes (${todayItems.length})`,
      body: `Você tem ${todayItems.length} contas pendentes (total de R$ ${totalReais}). Toque para conferir.`,
      url: "/lembretes",
      isSummary: true,
      scheduleAt,
    });
  } else if (todayItems.length === 1) {
    const rem = todayItems[0]!;
    const statusLabel =
      rem.status === "overdue"
        ? "Vencida"
        : rem.status === "due_today"
          ? "Vence hoje"
          : `Vence em ${rem.dueDate.slice(8, 10)}/${rem.dueDate.slice(5, 7)}`;
    const reais = formatCentsPtBr(rem.amountCents);
    const scheduleAt =
      isNative && isWithinQuietHours(now, normalizedQuietHours)
        ? adjustDateForQuietHours(now, normalizedQuietHours)
        : undefined;

    schedule.push({
      scope: "today",
      dueDate: today,
      key: rem.key,
      tag: `due:${rem.key}`,
      title: `${rem.title} — ${statusLabel}`,
      body: `Saldo em aberto: R$ ${reais}. Toque para conferir e quitar.`,
      url: buildReminderUrl(rem),
      isSummary: false,
      actionTypeId: DUE_REMINDER_ACTION_TYPE,
      scheduleAt,
    });
  }

  if (isNative) {
    const sortedFutureDates = Array.from(upcomingByDate.keys()).sort();
    for (const dueDate of sortedFutureDates) {
      const dayItems = upcomingByDate.get(dueDate);
      if (!dayItems || dayItems.length === 0) continue;

      const rawTargetDate = buildLocalDateAtTime(dueDate, reminderHour, reminderMinute);
      if (!rawTargetDate) continue;
      const adjustedTarget = adjustDateForQuietHours(rawTargetDate, normalizedQuietHours);
      if (adjustedTarget.getTime() <= now.getTime()) continue;

      if (dayItems.length > 1) {
        const totalCents = dayItems.reduce((acc, item) => acc + item.amountCents, 0);
        const totalReais = formatCentsPtBr(totalCents);
        schedule.push({
          scope: "upcoming",
          dueDate,
          key: `day:${dueDate}`,
          tag: `due:day:${dueDate}`,
          title: `Axir · Contas que vencem hoje (${dayItems.length})`,
          body: `Você tem ${dayItems.length} contas que vencem hoje (total de R$ ${totalReais}). Toque para conferir.`,
          url: "/lembretes",
          isSummary: true,
          scheduleAt: adjustedTarget,
        });
      } else {
        const rem = dayItems[0]!;
        const reais = formatCentsPtBr(rem.amountCents);
        schedule.push({
          scope: "upcoming",
          dueDate,
          key: rem.key,
          tag: `due:${rem.key}`,
          title: `${rem.title} — Vence hoje`,
          body: `Saldo em aberto: R$ ${reais}. Toque para conferir e pagar.`,
          url: buildReminderUrl(rem),
          isSummary: false,
          actionTypeId: DUE_REMINDER_ACTION_TYPE,
          scheduleAt: adjustedTarget,
        });
      }
    }
  }

  return schedule;
}
