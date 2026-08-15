import { Bell } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "@/components/ui";
import { ReminderItem } from "@/components/modules";
import { autoSelectBillMonth, buildCompetenceSummaries } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { buildReminders } from "@/domain/reminders";
import { shiftMonth } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useCreditCards,
  useDebts,
  useReminderStates,
  useSetReminderState,
} from "@/state";

/**
 * Central de lembretes (§3.10) — consolida faturas (saldo aberto por
 * competência) e dívidas pendentes; ações de lido/snooze/restaurar
 * persistidas em `reminder_states`.
 */
export function RemindersPage() {
  const cardsQuery = useCreditCards();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();
  const debtsQuery = useDebts();
  const statesQuery = useReminderStates();
  const setState = useSetReminderState();

  const loading = cardsQuery.isLoading || cardExpensesQuery.isLoading || cardPaymentsQuery.isLoading || debtsQuery.isLoading;
  const error =
    cardsQuery.error ?? cardExpensesQuery.error ?? cardPaymentsQuery.error ?? debtsQuery.error ?? statesQuery.error;

  const today = todayISO();
  const preferences = { enabled: true, debtDaysBefore: 3, billDaysBefore: 3 };

  // Faturas: para cada cartão ativo, resumos por competência com saldo aberto.
  const bills = (cardsQuery.data ?? [])
    .filter((card) => card.is_active)
    .flatMap((card) => {
      const expenses = (cardExpensesQuery.data ?? []).filter((e) => e.card_id === card.id);
      const payments = (cardPaymentsQuery.data ?? []).filter((p) => p.card_id === card.id);
      const summaries = buildCompetenceSummaries(expenses, payments);
      const month = autoSelectBillMonth(summaries, today);
      const summary = summaries.find((s) => s.month === month);
      if (!summary || summary.saldoCents <= 0) return [];
      return [
        {
          key: `bill:${card.id}:${month}`,
          title: `Fatura ${card.name} · ${month}`,
          subtitle: `Saldo de ${formatCentsAsBRL(summary.saldoCents)}`,
          competenceMonth: month,
          dueDay: card.due_day,
          balanceCents: summary.saldoCents,
          link: { path: "/cartoes", params: { card: card.id, month } },
        },
      ];
    });

  // Dívidas pendentes do mês em diante (janela 3 dias antes já tratada no domínio).
  const rangeStart = `${shiftMonth(today.slice(0, 7), 0)}-01`;
  const debts = (debtsQuery.data ?? [])
    .filter((d) => d.paid_at === null && d.due_date >= rangeStart)
    .map((d) => ({
      key: `debt:${d.id}`,
      title: d.name,
      subtitle: d.type === "payable" ? "A pagar" : "A receber",
      dueDate: d.due_date,
      amountCents: Math.round(d.amount * 100),
      paidAt: null,
      link: { path: "/dividas" },
    }));

  const items = buildReminders({ bills, debts, preferences, today }, statesQuery.data ?? []);

  const handle = (occurrenceKey: string, state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null) => {
    setState.mutate({ occurrenceKey, state });
  };

  const snooze = (key: string) => {
    // Snooze de 7 dias (janela padrão de adiamento).
    const until = addDays(key);
    handle(key, { kind: "snoozed", snoozeUntil: until });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Lembretes</h1>
          <p className="text-sm text-muted-foreground">Faturas e dívidas que precisam de atenção.</p>
        </div>
      </header>

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Tudo em dia"
          description="Nenhuma fatura ou dívida vencendo nos próximos dias."
          tone="positive"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ReminderItem
              key={item.key}
              item={item}
              stateKind={statesQuery.data?.find((s) => s.key === item.key)?.kind ?? null}
              onMarkRead={(key) => handle(key, { kind: "read" })}
              onSnooze={snooze}
              onRestore={(key) => handle(key, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Soma 7 dias a uma data ISO local (YYYY-MM-DD) — snooze padrão. */
function addDays(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 7);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}
