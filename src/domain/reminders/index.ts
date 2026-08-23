/**
 * Central de lembretes — ESPECIFICAÇÃO §3.10.
 *
 * Motores puros (testáveis isoladamente):
 *   • Consolida alertas de faturas (saldo aberto por competência: vencida/
 *     em breve) e dívidas (pendentes: vence em X dias/vencida);
 *   • Ações: marcar como lido e snooze (adiar); snooze expira
 *     automaticamente quando o item vence ou atrasa (o alerta volta);
 *   • Ordenação: atrasados primeiro; depois por data de vencimento.
 *
 * In-app (sem push): a tela consome os itens derivados + o estado
 * persistido em `reminder_states` (user_id + occurrence_key).
 */

import { invoiceDueDate, invoiceStatus } from "@/domain/cards";
import { addDaysISO, debtStatus, todayISO } from "@/domain/debts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ReminderKind = "bill" | "debt";

export type ReminderStatus = "overdue" | "due_today" | "due_soon" | "pending";

export interface ReminderSource {
  /** Chave estável persistida em `reminder_states`. */
  key: string;
  kind: ReminderKind;
  /** Título exibível (ex.: "Fatura Nubank · Ago/2026"). */
  title: string;
  /** Subtítulo exibível (ex.: "Saldo de R$ 1.234,56"). */
  subtitle?: string;
  /** Data de vencimento (YYYY-MM-DD). */
  dueDate: string;
  /** Saldo/valor pendente em centavos. */
  amountCents: number;
  /** Dados de navegação (deep-link). */
  link?: { path: string; params?: Record<string, string> };
}

export interface ReminderItem extends ReminderSource {
  status: ReminderStatus;
}

/** Estado persistido do usuário sobre um lembrete. */
export type ReminderStateKind = "read" | "snoozed";

export interface ReminderState {
  key: string;
  kind: ReminderStateKind;
  /** Snooze até esta data (YYYY-MM-DD) — expira ao vencer/atrasar. */
  snoozeUntil?: string;
}

export interface ReminderPreferences {
  enabled: boolean;
  /** Janela (dias antes) para dívidas. */
  debtDaysBefore: number;
  /** Janela (dias antes) para faturas. */
  billDaysBefore: number;
}

// ---------------------------------------------------------------------------
// Derivação de itens (§3.10)
// ---------------------------------------------------------------------------

/** Alerta de fatura: saldo aberto > 0 e status `overdue` ou `near_due`. */
export function billReminder(
  source: Omit<ReminderSource, "kind">,
  balanceCents: number,
  dueDay: number,
  today: string = todayISO(),
  nearDueDays = 3,
): ReminderItem | null {
  const status = invoiceStatus(source.dueDate.slice(0, 7), dueDay, balanceCents, today, nearDueDays);
  if (status === "closed" || status === "open") return null;
  return {
    ...source,
    kind: "bill",
    amountCents: balanceCents,
    status: status === "overdue" ? "overdue" : "due_soon",
  };
}

/** Alerta de dívida: pendente e dentro da janela (ou vencida). */
export function debtReminder(
  source: Omit<ReminderSource, "kind">,
  paidAt: string | null,
  today: string = todayISO(),
  daysBefore = 3,
): ReminderItem | null {
  if (paidAt) return null;
  const status = debtStatus(source.dueDate, null, today);
  if (status === "paid" || status === "pending") {
    // "pending" sem janela: ativa apenas dentro dos dias antes configurados.
    if (status === "pending" && source.dueDate > addDaysISO(today, daysBefore)) return null;
    if (status === "pending") {
      return { ...source, kind: "debt", status: "due_soon" };
    }
    return null;
  }
  return {
    ...source,
    kind: "debt",
    status: status === "due_today" ? "due_today" : status === "due_soon" ? "due_soon" : "overdue",
  };
}

/**
 * Aplica o estado persistido: itens lidos saem da lista; snoozados ficam
 * ocultos até `snoozeUntil` — que EXPIRA quando o item vence ou atrasa
 * (o alerta volta). Itens vencidos com snooze ativo sempre reaparecem.
 */
export function applyReminderState(
  items: readonly ReminderItem[],
  states: readonly ReminderState[],
  today: string = todayISO(),
): ReminderItem[] {
  const map = new Map(states.map((state) => [state.key, state]));
  return items.filter((item) => {
    const state = map.get(item.key);
    if (!state) return true;
    if (state.kind === "read") return false;
    // Snooze expira ao vencer ou atrasar.
    if (state.snoozeUntil != null && item.dueDate > state.snoozeUntil) return true;
    if (item.dueDate <= today) return true;
    return false;
  });
}

/** Snooze está expirado (item venceu/atrasou ou a data passou)? */
export function isSnoozeExpired(state: ReminderState, dueDate: string, today: string = todayISO()): boolean {
  if (state.kind !== "snoozed") return false;
  if (dueDate <= today) return true;
  return state.snoozeUntil != null && dueDate > state.snoozeUntil;
}

// ---------------------------------------------------------------------------
// Ordenação (§3.10 — atrasados primeiro; depois por vencimento)
// ---------------------------------------------------------------------------

/** Ordena: atrasados primeiro, depois por data de vencimento crescente. */
export function sortReminders(items: readonly ReminderItem[]): ReminderItem[] {
  const rank = (item: ReminderItem) => (item.status === "overdue" ? 0 : 1);
  return [...items].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

// ---------------------------------------------------------------------------
// Consolidação completa
// ---------------------------------------------------------------------------

export interface RemindersInput {
  /** Faturas com saldo aberto (por cartão × competência). */
  bills: readonly {
    key: string;
    title: string;
    subtitle?: string;
    competenceMonth: string;
    dueDay: number;
    balanceCents: number;
    link?: ReminderSource["link"];
  }[];
  /** Dívidas pendentes/quitação. */
  debts: readonly {
    key: string;
    title: string;
    subtitle?: string;
    dueDate: string;
    amountCents: number;
    paidAt: string | null;
    link?: ReminderSource["link"];
  }[];
  preferences: ReminderPreferences;
  /** Referência de hoje (YYYY-MM-DD) — injetável. */
  today?: string;
}

/**
 * Deriva todos os alertas de faturas e dívidas elegíveis para lembrete (dentro da janela
 * ou atrasadas), sem aplicar o filtro de lido/adiado.
 * Retorna vazio quando a preferência está desabilitada.
 */
export function deriveReminderItems(input: RemindersInput): ReminderItem[] {
  if (!input.preferences.enabled) return [];
  const today = input.today ?? todayISO();

  const items: ReminderItem[] = [];
  for (const bill of input.bills) {
    const item = billReminder(
      {
        key: bill.key,
        title: bill.title,
        subtitle: bill.subtitle,
        dueDate: invoiceDueDate(bill.competenceMonth, bill.dueDay),
        amountCents: bill.balanceCents,
        link: bill.link,
      },
      bill.balanceCents,
      bill.dueDay,
      today,
      input.preferences.billDaysBefore,
    );
    if (item) items.push(item);
  }

  for (const debt of input.debts) {
    const item = debtReminder(
      {
        key: debt.key,
        title: debt.title,
        subtitle: debt.subtitle,
        dueDate: debt.dueDate,
        amountCents: debt.amountCents,
        link: debt.link,
      },
      debt.paidAt,
      today,
      input.preferences.debtDaysBefore,
    );
    if (item) items.push(item);
  }

  return sortReminders(items);
}

/**
 * Consolida os alertas de faturas e dívidas, aplica o estado persistido
 * (lido/snooze) e ordena: atrasados primeiro, depois por vencimento.
 * Retorna vazio quando a preferência está desabilitada.
 */
export function buildReminders(
  input: RemindersInput,
  states: readonly ReminderState[] = [],
): ReminderItem[] {
  const all = deriveReminderItems(input);
  const today = input.today ?? todayISO();
  return sortReminders(applyReminderState(all, states, today));
}
