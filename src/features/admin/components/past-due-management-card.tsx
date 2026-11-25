import { useState } from "react";
import { BellOff, BellRing, CalendarClock, CheckCircle2, Clock, Send, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Select,
  Skeleton,
} from "@/components/ui";
import {
  useAdminBlockPastDueNow,
  useAdminPastDueSubscriptions,
  useAdminSendPastDueReminder,
  useAdminSetPastDuePolicy,
} from "@/state";
import type { AdminPastDueSubscriptionRow, PastDueReminderPreset } from "@/types";

const REMINDER_PRESET_OPTIONS: { value: PastDueReminderPreset; label: string }[] = [
  { value: "friendly", label: "Lembrete amigável de pagamento" },
  { value: "update_card", label: "Solicitar atualização de cartão" },
  { value: "final_warning", label: "Último aviso antes do bloqueio" },
];

const GRACE_POLICY_OPTIONS = [
  { value: "manual", label: "Manual (não bloquear sozinho)" },
  { value: "auto_7", label: "Bloquear automaticamente em 7 dias" },
  { value: "auto_15", label: "Bloquear automaticamente em 15 dias" },
  { value: "auto_30", label: "Bloquear automaticamente em 30 dias" },
];

function formatDatePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function getDaysOverdue(sinceIso: string | null | undefined): number {
  if (!sinceIso) return 0;
  const start = new Date(sinceIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)));
}

function PastDueRow({ row }: { row: AdminPastDueSubscriptionRow }) {
  const setPolicy = useAdminSetPastDuePolicy();
  const blockNow = useAdminBlockPastDueNow();
  const sendReminder = useAdminSendPastDueReminder();

  const [preset, setPreset] = useState<PastDueReminderPreset>("friendly");
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);

  const daysOverdue = getDaysOverdue(row.past_due_since || row.current_period_end);
  const currentPolicyValue =
    row.past_due_grace_mode === "auto"
      ? "auto_7"
      : "manual";

  const handlePolicyChange = (val: string) => {
    if (val === "manual") {
      setPolicy.mutate({
        userId: row.user_id,
        graceMode: "manual",
        remindersEnabled: row.past_due_reminders_enabled,
      });
      return;
    }
    const days = Number(val.replace("auto_", "")) || 7;
    setPolicy.mutate({
      userId: row.user_id,
      graceMode: "auto",
      autoBlockDays: days,
      remindersEnabled: row.past_due_reminders_enabled,
    });
  };

  const handleToggleWeeklyReminders = () => {
    setPolicy.mutate({
      userId: row.user_id,
      graceMode: row.past_due_grace_mode,
      autoBlockDays: row.past_due_grace_mode === "auto" ? 7 : null,
      remindersEnabled: !row.past_due_reminders_enabled,
    });
  };

  const isBusy = setPolicy.isPending || blockNow.isPending || sendReminder.isPending;

  return (
    <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-4 flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {row.user_name || "Assinante"}
            </span>
            <Badge variant="warning" size="xs">
              {daysOverdue === 0 ? "Venceu hoje" : `${daysOverdue}d em atraso`}
            </Badge>
            <Badge variant={row.past_due_block_at ? "critical" : "muted"} size="xs">
              {row.past_due_block_at
                ? `Bloqueio em ${formatDatePtBr(row.past_due_block_at)}`
                : "Tolerância manual"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {row.user_email || row.user_id} ·{" "}
            {row.tier === "pro_annual" ? "Pro Anual" : "Pro Mensal"} ·{" "}
            {row.past_due_reminder_count} aviso(s) enviado(s)
            {row.past_due_last_reminded_at
              ? ` (último em ${formatDatePtBr(row.past_due_last_reminded_at)})`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={handleToggleWeeklyReminders}
            className="gap-1.5 text-xs"
          >
            {row.past_due_reminders_enabled ? (
              <>
                <BellRing className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Lembrete semanal ativo</span>
              </>
            ) : (
              <>
                <BellOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Lembrete semanal pausado</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={() => setConfirmBlockOpen(true)}
            className="gap-1.5 text-xs"
          >
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            <span>Bloquear agora</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Regra de Bloqueio para Somente-Leitura</span>
          </span>
          <Select
            value={currentPolicyValue}
            onValueChange={handlePolicyChange}
            disabled={isBusy}
            options={GRACE_POLICY_OPTIONS}
            placeholder="Selecione a regra de carência"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Send className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Enviar Aviso Oficial do App (Axir)</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as PastDueReminderPreset)}
                disabled={isBusy}
                options={REMINDER_PRESET_OPTIONS}
                placeholder="Escolha um modelo"
              />
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={() => sendReminder.mutate({ userId: row.user_id, preset })}
              className="gap-1.5 shrink-0"
            >
              <Send className="size-3.5" aria-hidden="true" />
              <span>Enviar</span>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBlockOpen}
        onOpenChange={setConfirmBlockOpen}
        title="Mover conta para Somente-Leitura?"
        description={`A conta de ${row.user_name || row.user_email || "usuário"} será imediatamente movida para o modo Somente-Leitura até que o pagamento seja regularizado.`}
        confirmLabel="Bloquear agora"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={blockNow.isPending}
        onConfirm={() => {
          blockNow.mutate(row.user_id, {
            onSuccess: () => setConfirmBlockOpen(false),
          });
        }}
      />
    </div>
  );
}

/**
 * Painel de gestão de inadimplência amigável (past_due) para o Administrador.
 */
export function PastDueManagementCard() {
  const pastDueQuery = useAdminPastDueSubscriptions();
  const rows = pastDueQuery.data ?? [];

  return (
    <section
      aria-label="Assinaturas em Atraso"
      className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-warning-strong" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Assinaturas em Atraso (Tolerância &amp; Lembretes)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Clientes pagantes em atraso mantêm acesso até você agendar o bloqueio ou bloquear manualmente.
            </p>
          </div>
        </div>
        <Badge variant={rows.length > 0 ? "warning" : "muted"} size="sm">
          {rows.length} em atraso
        </Badge>
      </div>

      {pastDueQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6 text-positive-strong" aria-hidden="true" />}
          title="Nenhuma assinatura em atraso"
          description="Quando um assinante tiver falha de pagamento na renovação, ele aparecerá aqui para acompanhamento."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <PastDueRow key={row.subscription_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
