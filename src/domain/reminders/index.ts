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
import { addDaysISO, todayISO } from "@/domain/debts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ReminderKind = "bill" | "debt";

export type ReminderDirection = "payable" | "receivable";

export type ReminderStatus = "overdue" | "due_today" | "due_soon" | "pending";

export interface ReminderSource {
  /** Chave estável persistida em `reminder_states`. */
  key: string;
  kind: ReminderKind;
  /** Direção financeira do compromisso (a pagar vs a receber). */
  direction?: ReminderDirection;
  /** Indica se a dívida está vinculada a um racha compartilhado. */
  isSplitLinked?: boolean;
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
  /** Snooze até esta data (YYYY-MM-DD) — oculta enquanto today < snoozeUntil. */
  snoozeUntil?: string;
}

export interface ReminderPreferences {
  enabled: boolean;
  /** Janela (dias antes) para dívidas. */
  debtDaysBefore: number;
  /** Janela (dias antes) para faturas. */
  billDaysBefore: number;
}

export interface SplitShareLinkCandidate {
  debt_id?: string | null;
  expense_id?: string | null;
  installment_group_id?: string | null;
  is_revoked?: boolean | null;
  payload?: {
    debt_id?: string | null;
    expense_id?: string | null;
    installment_group_id?: string | null;
  } | null;
}

/**
 * Identifica se uma dívida a receber pertence a um racha compartilhado,
 * evitando duplicação com o módulo de Rachas na Central e no Push.
 */
export function isDebtLinkedToSplit(
  debt: {
    id: string;
    name: string;
    type: ReminderDirection;
    expense_id?: string | null;
    installment_group_id?: string | null;
  },
  splitShares: readonly SplitShareLinkCandidate[] = [],
  allDebts: readonly {
    id: string;
    expense_id?: string | null;
    installment_group_id?: string | null;
  }[] = [],
): boolean {
  if (debt.type !== "receivable") return false;
  const normalizedName = debt.name.trim().toLowerCase();
  if (normalizedName.startsWith("racha:") || /(?:^|[\s:_-])racha(?:$|[\s:_-])/.test(normalizedName)) {
    return true;
  }

  const mappedDebtIds = new Set<string>();
  const mappedExpenseIds = new Set<string>();

  for (const share of splitShares) {
    const shareDebtId = share.debt_id ?? share.payload?.debt_id;
    if (shareDebtId) {
      mappedDebtIds.add(shareDebtId);
      if (shareDebtId === debt.id) return true;
    }

    const shareExpenseId = share.expense_id ?? share.payload?.expense_id;
    if (shareExpenseId) {
      mappedExpenseIds.add(shareExpenseId);
      if (debt.expense_id && shareExpenseId === debt.expense_id) return true;
    }

    const shareGroupId = share.installment_group_id ?? share.payload?.installment_group_id;
    if (debt.installment_group_id && shareGroupId && shareGroupId === debt.installment_group_id) {
      return true;
    }
  }

  if (debt.installment_group_id && allDebts.length > 0 && (mappedDebtIds.size > 0 || mappedExpenseIds.size > 0)) {
    for (const candidate of allDebts) {
      if (candidate.installment_group_id !== debt.installment_group_id) continue;
      if (mappedDebtIds.has(candidate.id)) return true;
      if (candidate.expense_id && mappedExpenseIds.has(candidate.expense_id)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Derivação de itens (§3.10)
// ---------------------------------------------------------------------------

/** Alerta de fatura: saldo aberto > 0 e status `overdue`, `due_today` ou `due_soon`. */
export function billReminder(
  source: Omit<ReminderSource, "kind">,
  balanceCents: number,
  dueDay: number,
  today: string = todayISO(),
  nearDueDays = 3,
): ReminderItem | null {
  if (balanceCents <= 0) return null;
  const status = invoiceStatus(source.dueDate.slice(0, 7), dueDay, balanceCents, today, nearDueDays);
  if (status !== "overdue" && status !== "near_due") return null;
  const resolvedStatus: ReminderStatus =
    status === "overdue" ? "overdue" : source.dueDate === today ? "due_today" : "due_soon";
  return {
    ...source,
    kind: "bill",
    direction: "payable",
    amountCents: balanceCents,
    status: resolvedStatus,
  };
}

/** Alerta de dívida: pendente e dentro da janela (ou vencida para contas a pagar). */
export function debtReminder(
  source: Omit<ReminderSource, "kind">,
  paidAt: string | null,
  today: string = todayISO(),
  daysBefore = 3,
): ReminderItem | null {
  if (paidAt) return null;
  const direction: ReminderDirection = source.direction ?? "payable";
  const horizonEnd = addDaysISO(today, Math.max(0, daysBefore));

  if (direction === "receivable") {
    if (source.dueDate > horizonEnd) return null;
    return {
      ...source,
      kind: "debt",
      direction: "receivable",
      status: "pending",
    };
  }

  let resolvedStatus: ReminderStatus;
  if (source.dueDate < today) {
    resolvedStatus = "overdue";
  } else if (source.dueDate === today) {
    resolvedStatus = "due_today";
  } else if (source.dueDate <= horizonEnd) {
    resolvedStatus = "due_soon";
  } else {
    return null;
  }

  return {
    ...source,
    kind: "debt",
    direction: "payable",
    status: resolvedStatus,
  };
}

/**
 * Aplica o estado persistido: itens lidos saem da lista; snoozados ficam
 * ocultos enquanto `today < snoozeUntil` e reaparecem quando `today >= snoozeUntil`.
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
    return isSnoozeExpired(state, item.dueDate, today);
  });
}

/** Snooze expira quando a data atual atinge ou ultrapassa `snoozeUntil`. */
export function isSnoozeExpired(
  state: ReminderState,
  _dueDate: string,
  today: string = todayISO(),
): boolean {
  if (state.kind !== "snoozed") return false;
  if (state.snoozeUntil != null) return today >= state.snoozeUntil;
  return false;
}

// ---------------------------------------------------------------------------
// Ordenação (§3.10 — atrasados primeiro; depois hoje, em breve, informativo)
// ---------------------------------------------------------------------------

const REMINDER_STATUS_RANK: Record<ReminderStatus, number> = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  pending: 3,
};

/** Ordena: atrasados primeiro, depois vence hoje, em breve e informativo, por vencimento. */
export function sortReminders(items: readonly ReminderItem[]): ReminderItem[] {
  return [...items].sort((a, b) => {
    const rankDiff = REMINDER_STATUS_RANK[a.status] - REMINDER_STATUS_RANK[b.status];
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
    direction?: ReminderDirection;
    isSplitLinked?: boolean;
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
    if (debt.isSplitLinked) continue;
    const item = debtReminder(
      {
        key: debt.key,
        title: debt.title,
        subtitle: debt.subtitle,
        direction: debt.direction ?? "payable",
        isSplitLinked: debt.isSplitLinked,
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
