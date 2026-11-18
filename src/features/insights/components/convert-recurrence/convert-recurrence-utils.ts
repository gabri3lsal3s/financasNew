import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import { todayLocalIso } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import type { PaymentMethod } from "@/types";

export const FREQUENCY_OPTIONS = [
  { value: "monthly", label: RECURRENCE_FREQUENCY_LABELS.monthly },
  { value: "weekly", label: RECURRENCE_FREQUENCY_LABELS.weekly },
  { value: "quarterly", label: RECURRENCE_FREQUENCY_LABELS.quarterly },
  { value: "yearly", label: RECURRENCE_FREQUENCY_LABELS.yearly },
];

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "credit_card", label: PAYMENT_METHOD_LABELS.credit_card },
  { value: "pix", label: PAYMENT_METHOD_LABELS.pix },
  { value: "debit", label: PAYMENT_METHOD_LABELS.debit },
  { value: "cash", label: PAYMENT_METHOD_LABELS.cash },
  { value: "transfer", label: PAYMENT_METHOD_LABELS.transfer },
  { value: "other", label: PAYMENT_METHOD_LABELS.other },
];

export const DURATION_OPTIONS = [
  { value: "12", label: "12 ocorrências (1 ano)" },
  { value: "24", label: "24 ocorrências (2 anos)" },
  { value: "36", label: "36 ocorrências (3 anos)" },
  { value: "custom_date", label: "Até data de término" },
];

export function calculateDefaultStartDate(occurrence: RecurrenceOccurrence): string {
  if (occurrence.nextDueDate) return occurrence.nextDueDate;
  const today = todayLocalIso();
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = parseInt(yearStr ?? "2026", 10);
  const month = parseInt(monthStr ?? "1", 10);
  const day = parseInt(dayStr ?? "1", 10);
  const typical = occurrence.typicalDayOfMonth ?? day;

  if (day <= typical) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const actualDay = Math.min(typical, daysInMonth);
    return `${yearStr}-${String(month).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
  }

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
  const actualDay = Math.min(typical, daysInNextMonth);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
}

export function resolveDefaultPaymentMethod(occurrence: RecurrenceOccurrence): PaymentMethod {
  const firstMethod = occurrence.expenses?.[0]?.paymentMethod;
  if (firstMethod && PAYMENT_METHOD_OPTIONS.some((opt) => opt.value === firstMethod)) {
    return firstMethod as PaymentMethod;
  }
  return "credit_card";
}
