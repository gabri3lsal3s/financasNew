import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Progress,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { KpiCard, KpiGrid } from "@/components/modules";
import { currentMonth, formatDateTimeBR, formatMonthYear, shiftMonth } from "@/lib/date";
import {
  useAdminAiUsageSummary,
  useAdminResetUserAiQuota,
  useUserAccess,
} from "@/state";
import type { AdminAiUsageRow } from "@/types";
import { ADMIN_AI_QUOTA_LIMITS } from "@/domain/admin";

type QuotaBucketChoice = "all" | "receipt_calls" | "batch_calls";

const RECEIPT_LIMITS = ADMIN_AI_QUOTA_LIMITS.receipt_calls;
const BATCH_LIMITS = ADMIN_AI_QUOTA_LIMITS.batch_calls;

const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trialing: "Em Teste",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  read_only_expired: "Somente Leitura",
};

function resolveStatusVariant(status: string | null): "positive" | "warning" | "critical" | "muted" {
  if (status === "active") return "positive";
  if (status === "trialing") return "warning";
  if (status === "past_due") return "critical";
  return "muted";
}

function computePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function AiQuotasUsagePanel() {
  const [periodMonth, setPeriodMonth] = useState<string>(() => currentMonth());
  const [resetTarget, setResetTarget] = useState<AdminAiUsageRow | null>(null);
  const [resetBucket, setResetBucket] = useState<QuotaBucketChoice>("all");
  const [resetReason, setResetReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const { isSuperAdmin } = useUserAccess();
  const usageQuery = useAdminAiUsageSummary({ periodMonth, limit: 50, offset: 0 });
  const resetQuotaMutation = useAdminResetUserAiQuota();

  const rows = useMemo(() => usageQuery.data ?? [], [usageQuery.data]);

  const totals = useMemo(() => {
    let receiptMonth = 0;
    let batchMonth = 0;
    for (const row of rows) {
      receiptMonth += row.receipt_calls_month;
      batchMonth += row.batch_calls_month;
    }
    return {
      usersCount: rows.length,
      receiptMonth,
      batchMonth,
    };
  }, [rows]);

  const openResetDialog = (row: AdminAiUsageRow) => {
    setResetTarget(row);
    setResetBucket("all");
    setResetReason("");
    setReasonError(null);
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    const trimmed = resetReason.trim();
    if (trimmed.length < 3) {
      setReasonError("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }

    setReasonError(null);
    await resetQuotaMutation.mutateAsync({
      userId: resetTarget.user_id,
      bucket: resetBucket,
      reason: trimmed,
    });
    setResetTarget(null);
  };

  const currentMonthStr = currentMonth();

  return (
    <section aria-label="Cotas e Uso de IA" className="flex flex-col gap-5 w-full min-w-0">
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Cpu className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-base font-bold text-foreground">Cotas & Uso de IA</h2>
          <Badge variant="muted" size="sm">
            Comprov.: {RECEIPT_LIMITS.day}/dia e {RECEIPT_LIMITS.month}/mês
          </Badge>
          <Badge variant="muted" size="sm">
            Lote: {BATCH_LIMITS.day}/dia e {BATCH_LIMITS.month}/mês
          </Badge>
        </div>

        <div className="inline-flex items-center self-start sm:self-auto rounded-lg border border-border/80 bg-surface shadow-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mês anterior"
            onClick={() => setPeriodMonth((prev) => shiftMonth(prev, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="px-2.5 text-xs font-semibold text-foreground whitespace-nowrap capitalize">
            {formatMonthYear(periodMonth)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Próximo mês"
            disabled={periodMonth >= currentMonthStr}
            onClick={() => setPeriodMonth((prev) => shiftMonth(prev, 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {usageQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar o uso de IA"
          description="Ocorreu um erro ao consultar os contadores de cotas do período."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void usageQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : usageQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <KpiGrid columns={3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3 h-24"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </KpiGrid>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <KpiGrid columns={3}>
            <KpiCard
              label="Usuários com uso"
              value={String(totals.usersCount)}
              hint={`Competência ${periodMonth}`}
              icon={<Users className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
            <KpiCard
              label="Comprovantes no mês"
              value={String(totals.receiptMonth)}
              hint={`Limite individual: ${RECEIPT_LIMITS.month}/mês`}
              icon={<Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
            <KpiCard
              label="Chamadas em lote"
              value={String(totals.batchMonth)}
              hint={`Limite individual: ${BATCH_LIMITS.month}/mês`}
              icon={<Cpu className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
          </KpiGrid>

          {rows.length === 0 ? (
            <EmptyState
              title="Sem consumo de IA no período"
              description="Nenhum usuário registrou chamadas de comprovantes ou lote neste mês."
            />
          ) : (
            <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
              <div className="flex flex-col divide-y divide-border/80 md:hidden">
                {rows.map((row) => {
                  const receiptDayPct = computePercent(row.receipt_calls_day, RECEIPT_LIMITS.day);
                  const receiptMonthPct = computePercent(row.receipt_calls_month, RECEIPT_LIMITS.month);
                  const batchDayPct = computePercent(row.batch_calls_day, BATCH_LIMITS.day);
                  const batchMonthPct = computePercent(row.batch_calls_month, BATCH_LIMITS.month);

                  return (
                    <div key={row.user_id} className="p-4 flex flex-col gap-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground break-words">
                            {row.name || row.email || row.user_id}
                          </span>
                          {row.email && row.name && (
                            <span className="text-[11px] text-muted-foreground break-all">
                              {row.email}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {row.tier && (
                            <Badge variant="muted" size="xs">
                              {row.tier}
                            </Badge>
                          )}
                          {row.sub_status && (
                            <Badge variant={resolveStatusVariant(row.sub_status)} size="xs">
                              {SUB_STATUS_LABELS[row.sub_status] ?? row.sub_status}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground">Comprovantes</span>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Dia ({row.period_day})</span>
                              <span className="font-mono tabular-nums text-foreground">
                                {row.receipt_calls_day}/{RECEIPT_LIMITS.day}
                              </span>
                            </div>
                            <Progress value={receiptDayPct} size="sm" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Mês</span>
                              <span className="font-mono tabular-nums text-foreground">
                                {row.receipt_calls_month}/{RECEIPT_LIMITS.month}
                              </span>
                            </div>
                            <Progress value={receiptMonthPct} size="sm" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground">Lote</span>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Dia ({row.period_day})</span>
                              <span className="font-mono tabular-nums text-foreground">
                                {row.batch_calls_day}/{BATCH_LIMITS.day}
                              </span>
                            </div>
                            <Progress value={batchDayPct} size="sm" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Mês</span>
                              <span className="font-mono tabular-nums text-foreground">
                                {row.batch_calls_month}/{BATCH_LIMITS.month}
                              </span>
                            </div>
                            <Progress value={batchMonthPct} size="sm" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/80">
                        <span className="text-[11px] text-muted-foreground">
                          Atualizado: {formatDateTimeBR(row.updated_at)}
                        </span>
                        {isSuperAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openResetDialog(row)}
                          >
                            <RotateCcw aria-hidden="true" />
                            <span>Resetar balde</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto no-scrollbar scroll-smooth w-full">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-surface-raised border-b border-border/80 text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Plano / Status</th>
                      <th className="py-3 px-4">Comprovantes (Dia / Mês)</th>
                      <th className="py-3 px-4">Lote (Dia / Mês)</th>
                      <th className="py-3 px-4">Atualizado</th>
                      {isSuperAdmin && <th className="py-3 px-4 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {rows.map((row) => {
                      const receiptDayPct = computePercent(row.receipt_calls_day, RECEIPT_LIMITS.day);
                      const receiptMonthPct = computePercent(row.receipt_calls_month, RECEIPT_LIMITS.month);
                      const batchDayPct = computePercent(row.batch_calls_day, BATCH_LIMITS.day);
                      const batchMonthPct = computePercent(row.batch_calls_month, BATCH_LIMITS.month);

                      return (
                        <tr key={row.user_id} className="hover:bg-surface-hover/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-foreground">
                                {row.name || row.email || row.user_id}
                              </span>
                              {row.email && row.name && (
                                <span className="text-[11px] text-muted-foreground">
                                  {row.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="muted" size="xs">
                                {row.tier ?? "N/D"}
                              </Badge>
                              {row.sub_status && (
                                <Badge variant={resolveStatusVariant(row.sub_status)} size="xs">
                                  {SUB_STATUS_LABELS[row.sub_status] ?? row.sub_status}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 min-w-[180px]">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>Dia</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    {row.receipt_calls_day}/{RECEIPT_LIMITS.day}
                                  </span>
                                </div>
                                <Progress value={receiptDayPct} size="sm" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>Mês</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    {row.receipt_calls_month}/{RECEIPT_LIMITS.month}
                                  </span>
                                </div>
                                <Progress value={receiptMonthPct} size="sm" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 min-w-[180px]">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>Dia</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    {row.batch_calls_day}/{BATCH_LIMITS.day}
                                  </span>
                                </div>
                                <Progress value={batchDayPct} size="sm" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>Mês</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    {row.batch_calls_month}/{BATCH_LIMITS.month}
                                  </span>
                                </div>
                                <Progress value={batchMonthPct} size="sm" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTimeBR(row.updated_at)}
                          </td>
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openResetDialog(row)}
                              >
                                <RotateCcw aria-hidden="true" />
                                <span>Resetar balde</span>
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {isSuperAdmin && (
        <ConfirmDialog
          open={Boolean(resetTarget)}
          onOpenChange={(next) => {
            if (!next && !resetQuotaMutation.isPending) {
              setResetTarget(null);
              setReasonError(null);
            }
          }}
          title="Resetar balde de cota de IA"
          description={
            resetTarget
              ? `Esta ação zera os contadores do balde selecionado para ${resetTarget.name || resetTarget.email || resetTarget.user_id} e registra auditoria.`
              : undefined
          }
          variant="destructive"
          confirmLabel="Confirmar reset"
          confirmPending={resetQuotaMutation.isPending}
          onConfirm={() => void handleConfirmReset()}
        >
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Balde a redefinir</span>
              <Select
                value={resetBucket}
                onValueChange={(value) => setResetBucket(value as QuotaBucketChoice)}
                ariaLabel="Selecionar balde de cota para reset"
                options={[
                  { value: "all", label: "Todos os baldes (Comprovantes e Lote)" },
                  { value: "receipt_calls", label: "Somente Comprovantes" },
                  { value: "batch_calls", label: "Somente Lote" },
                ]}
              />
            </div>

            <Textarea
              id="ai-quota-reset-reason"
              label="Motivo obrigatório"
              value={resetReason}
              onChange={(event) => {
                setResetReason(event.target.value);
                if (reasonError) setReasonError(null);
              }}
              error={reasonError ?? undefined}
              placeholder="Descreva o motivo operacional para redefinir a cota (mín. 3 caracteres)"
            />
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
