import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  DollarSign,
  Mail,
  Percent,
  Receipt,
  Server,
  Settings2,
  TrendingDown,
  TrendingUp,
  Webhook,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  NumericInput,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { EquationBreakdownPopover, KpiCard, KpiGrid } from "@/components/modules";
import { calculateFinOpsOverview, type FinOpsConfidence } from "@/domain/admin";
import {
  buildAdminFinOpsInput,
  buildAdminFinOpsMemory,
} from "@/domain/calculation-memory/builders/admin-finops-memory";
import { parseDecimalNumber } from "@/domain/money/parse";
import { currentMonth, formatDateTimeBR, formatMonthYear, shiftMonth } from "@/lib/date";
import { formatPercent } from "@/services/masks";
import {
  useAdminBillingFinopsOverview,
  useAdminFinopsParams,
  useAdminUpsertFinopsParams,
  useUserAccess,
} from "@/state";

const CONFIDENCE_META: Record<FinOpsConfidence, { label: string; variant: "positive" | "warning" | "muted" }> = {
  measured: { label: "Medido", variant: "positive" },
  estimated: { label: "Estimado", variant: "warning" },
  partial: { label: "Parcial", variant: "warning" },
  no_data: { label: "Sem dados", variant: "muted" },
};

export function FinOpsOverviewPanel() {
  const [periodMonth, setPeriodMonth] = useState<string>(() => currentMonth());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pixFeeCents, setPixFeeCents] = useState(0);
  const [cardPercentText, setCardPercentText] = useState("0,00");
  const [aiReceiptCents, setAiReceiptCents] = useState(0);
  const [aiBatchCents, setAiBatchCents] = useState(0);
  const [fixedInfraCents, setFixedInfraCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { isSuperAdmin } = useUserAccess();
  const overviewQuery = useAdminBillingFinopsOverview(periodMonth);
  const paramsQuery = useAdminFinopsParams(periodMonth, isSuperAdmin);
  const upsertParamsMutation = useAdminUpsertFinopsParams();

  const computed = useMemo(() => {
    if (!overviewQuery.data) return null;
    const input = buildAdminFinOpsInput(overviewQuery.data);
    const result = calculateFinOpsOverview(input);
    const equations = buildAdminFinOpsMemory(input, result);
    return { input, result, equations };
  }, [overviewQuery.data]);

  const openEditModal = () => {
    const source = paramsQuery.data ?? overviewQuery.data?.params;
    setPixFeeCents(source?.asaas_pix_fee_cents ?? 0);
    const bps = source?.asaas_card_percent_bps ?? 0;
    setCardPercentText(formatPercent(bps / 100, 2));
    setAiReceiptCents(source?.ai_receipt_unit_cost_cents ?? 0);
    setAiBatchCents(source?.ai_batch_unit_cost_cents ?? 0);
    setFixedInfraCents(source?.fixed_infra_cents ?? 0);
    setNotes(source?.notes ?? "");
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSaveParams = async () => {
    const parsedCardPct = parseDecimalNumber(cardPercentText);
    if (parsedCardPct == null || !Number.isFinite(parsedCardPct) || parsedCardPct < 0 || parsedCardPct > 100) {
      setFormError("Informe uma taxa percentual de cartão entre 0% e 100%.");
      return;
    }

    const cardBps = Math.round(parsedCardPct * 100);
    setFormError(null);

    await upsertParamsMutation.mutateAsync({
      period_month: periodMonth,
      asaas_pix_fee_cents: pixFeeCents,
      asaas_card_percent_bps: cardBps,
      ai_receipt_unit_cost_cents: aiReceiptCents,
      ai_batch_unit_cost_cents: aiBatchCents,
      fixed_infra_cents: fixedInfraCents,
      notes: notes.trim() ? notes.trim() : null,
    });

    setIsEditOpen(false);
  };

  const currentMonthStr = currentMonth();
  const confidenceMeta = computed
    ? CONFIDENCE_META[computed.result.confidence]
    : CONFIDENCE_META.no_data;
  const overview = overviewQuery.data;
  const parsedPreviewPct = parseDecimalNumber(cardPercentText);
  const previewBps =
    parsedPreviewPct != null && Number.isFinite(parsedPreviewPct) && parsedPreviewPct >= 0 && parsedPreviewPct <= 100
      ? Math.round(parsedPreviewPct * 100)
      : null;

  return (
    <section aria-label="Visão FinOps Mensal" className="flex flex-col gap-5 w-full min-w-0">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Calculator className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Receita & Custos (FinOps)</h2>
            <Badge variant={confidenceMeta.variant} size="sm">
              {confidenceMeta.label}
            </Badge>
          </div>
          {overview && !overview.params.configured && (
            <p className="text-xs text-muted-foreground">Parâmetros pendentes</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-border/80 bg-surface shadow-xs">
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

          {isSuperAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openEditModal}
              disabled={overviewQuery.isLoading}
            >
              <Settings2 aria-hidden="true" />
              <span>Editar parâmetros</span>
            </Button>
          )}
        </div>
      </div>

      {overviewQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar os dados FinOps"
          description="Ocorreu um erro ao consultar receitas e custos do mês selecionado."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void overviewQuery.refetch();
                if (isSuperAdmin) {
                  void paramsQuery.refetch();
                }
              }}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : overviewQuery.isLoading || !overview || !computed ? (
        <div className="flex flex-col gap-4">
          <KpiGrid columns={4}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3 h-24"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </KpiGrid>
          <KpiGrid columns={2}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3 h-24"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </KpiGrid>
        </div>
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              label="Receita bruta"
              cents={computed.result.grossRevenueCents}
              tone="positive"
              hint={`${overview.payments.payments_count} pagamento(s) no mês`}
              icon={<DollarSign className="size-4 text-positive-strong" aria-hidden="true" />}
            />
            <KpiCard
              label="Taxas do gateway"
              cents={computed.result.gatewayFeesCents}
              tone="negative"
              hint={`Pix: ${overview.payments.pix_count} | Cartão: ${overview.payments.card_count}`}
              icon={<Receipt className="size-4 text-negative-strong" aria-hidden="true" />}
              action={
                <EquationBreakdownPopover
                  title={computed.equations.gateway.title}
                  description={computed.equations.gateway.description}
                  formula={computed.equations.gateway.formula}
                  items={computed.equations.gateway.items}
                  totalLabel={computed.equations.gateway.totalLabel}
                  totalCents={computed.equations.gateway.totalCents}
                  totalTone="negative"
                />
              }
            />
            <KpiCard
              label="Receita líquida"
              cents={computed.result.netRevenueCents}
              tone={computed.result.netRevenueCents >= 0 ? "positive" : "negative"}
              hint="Bruta menos taxas do gateway"
              icon={<TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />}
              action={
                <EquationBreakdownPopover
                  title={computed.equations.netRevenue.title}
                  description={computed.equations.netRevenue.description}
                  formula={computed.equations.netRevenue.formula}
                  items={computed.equations.netRevenue.items}
                  totalLabel={computed.equations.netRevenue.totalLabel}
                  totalCents={computed.equations.netRevenue.totalCents}
                />
              }
            />
            <KpiCard
              label="Resultado operacional"
              cents={computed.result.estimatedNetProfitCents}
              tone={computed.result.estimatedNetProfitCents >= 0 ? "positive" : "negative"}
              hint={
                computed.result.marginBps != null
                  ? `Margem: ${formatPercent(computed.result.marginBps / 100)}%`
                  : "Sem receita no período"
              }
              icon={
                computed.result.estimatedNetProfitCents >= 0 ? (
                  <TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-4 text-negative-strong" aria-hidden="true" />
                )
              }
              action={
                <EquationBreakdownPopover
                  title={computed.equations.operatingResult.title}
                  description={computed.equations.operatingResult.description}
                  formula={computed.equations.operatingResult.formula}
                  items={computed.equations.operatingResult.items}
                  totalLabel={computed.equations.operatingResult.totalLabel}
                  totalCents={computed.equations.operatingResult.totalCents}
                />
              }
            />
          </KpiGrid>

          <KpiGrid columns={2}>
            <KpiCard
              label="Custo variável de IA"
              cents={computed.result.aiVariableCostCents}
              tone="default"
              hint={`${overview.ai_quotas.total_receipt_calls} comprov. | ${overview.ai_quotas.total_batch_calls} lote`}
              icon={<Cpu className="size-4 text-muted-foreground" aria-hidden="true" />}
              action={
                <EquationBreakdownPopover
                  title={computed.equations.ai.title}
                  description={computed.equations.ai.description}
                  formula={computed.equations.ai.formula}
                  items={computed.equations.ai.items}
                  totalLabel={computed.equations.ai.totalLabel}
                  totalCents={computed.equations.ai.totalCents}
                  totalTone="default"
                />
              }
            />
            <KpiCard
              label="Custo fixo mensal"
              cents={computed.result.fixedInfraCents}
              tone="default"
              hint={overview.params.configured ? "Parâmetro configurado" : "Não configurado para o mês"}
              icon={<Server className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
            <KpiCard
              label="Margem operacional"
              value={
                computed.result.marginBps != null
                  ? `${formatPercent(computed.result.marginBps / 100)}%`
                  : "N/D"
              }
              tone={
                computed.result.marginBps != null && computed.result.marginBps < 0
                  ? "negative"
                  : "default"
              }
              hint={`${overview.ai_quotas.active_users_count} usuário(s) ativos em IA`}
              icon={<Percent className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
          </KpiGrid>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Receipt className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">Meios de pagamento</span>
                </div>
                <Badge variant="muted" size="xs">
                  {overview.payments.payments_count} total
                </Badge>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Pix ({overview.payments.pix_count})</span>
                  <MoneyText cents={overview.payments.pix_revenue_cents} tone="default" className="text-xs font-medium" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Cartão ({overview.payments.card_count})</span>
                  <MoneyText cents={overview.payments.card_revenue_cents} tone="default" className="text-xs font-medium" />
                </div>
                {overview.payments.other_count > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Outros meios</span>
                    <span className="font-mono text-foreground">{overview.payments.other_count}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Webhook className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">Webhooks do mês</span>
                </div>
                <Badge
                  variant={overview.webhooks.failures_count > 0 ? "warning" : "positive"}
                  size="xs"
                >
                  {overview.webhooks.failures_count} falha(s)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview.webhooks.events_count} evento(s) recebidos no período.
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">E-mails transacionais</span>
                </div>
                <Badge
                  variant={overview.emails.failed_count > 0 ? "warning" : "positive"}
                  size="xs"
                >
                  {overview.emails.failed_count} falha(s)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview.emails.sent_count} envio(s) concluídos no período.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">Parâmetros vigentes do mês</span>
                </div>
                {overview.params.updated_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Atualizado em {formatDateTimeBR(overview.params.updated_at)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Taxa fixa Pix</span>
                  <MoneyText cents={overview.params.asaas_pix_fee_cents} tone="default" className="text-xs font-semibold" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Taxa percentual cartão</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatPercent(overview.params.asaas_card_percent_bps / 100, 2)}%
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Custo IA (Comprovante)</span>
                  <MoneyText cents={overview.params.ai_receipt_unit_cost_cents} tone="default" className="text-xs font-semibold" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Custo IA (Lote)</span>
                  <MoneyText cents={overview.params.ai_batch_unit_cost_cents} tone="default" className="text-xs font-semibold" />
                </div>
              </div>
              {overview.params.notes && (
                <p className="border-t border-border/80 pt-2 text-[11px] text-muted-foreground">
                  Observação: {overview.params.notes}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {isSuperAdmin && (
        <Modal
          open={isEditOpen}
          onOpenChange={(next) => {
            if (next || !upsertParamsMutation.isPending) {
              setIsEditOpen(next);
            }
          }}
          size="md"
          title={`Parâmetros FinOps (${formatMonthYear(periodMonth)})`}
          description="Configure taxas do gateway, custos unitários de IA e custo fixo do mês selecionado."
          footer={
            <ModalFooter borderless>
              <Button
                type="button"
                variant="outline"
                disabled={upsertParamsMutation.isPending}
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={upsertParamsMutation.isPending}
                onClick={() => void handleSaveParams()}
              >
                {upsertParamsMutation.isPending ? "Salvando..." : "Salvar parâmetros"}
              </Button>
            </ModalFooter>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField
                label="Taxa fixa Pix"
                htmlFor="finops-pix-fee"
                helperText="Valor cobrado por pagamento Pix."
              >
                <MoneyInput
                  id="finops-pix-fee"
                  size="sm"
                  cents={pixFeeCents}
                  onCentsChange={setPixFeeCents}
                />
              </FormField>

              <FormField
                label="Taxa cartão (%)"
                htmlFor="finops-card-pct"
                helperText={
                  previewBps != null
                    ? `Equivalente a ${previewBps} bps sobre receita de cartão.`
                    : "Informe um percentual entre 0% e 100%."
                }
              >
                <NumericInput
                  id="finops-card-pct"
                  size="sm"
                  value={cardPercentText}
                  onValueChange={(value) => {
                    setCardPercentText(value);
                    if (formError) setFormError(null);
                  }}
                  maxDecimals={2}
                  placeholder="2,99"
                />
              </FormField>

              <FormField
                label="Custo IA por comprovante"
                htmlFor="finops-ai-receipt"
                helperText="Custo unitário estimado por leitura."
              >
                <MoneyInput
                  id="finops-ai-receipt"
                  size="sm"
                  cents={aiReceiptCents}
                  onCentsChange={setAiReceiptCents}
                />
              </FormField>

              <FormField
                label="Custo IA por lote"
                htmlFor="finops-ai-batch"
                helperText="Custo unitário estimado por chamada em lote."
              >
                <MoneyInput
                  id="finops-ai-batch"
                  size="sm"
                  cents={aiBatchCents}
                  onCentsChange={setAiBatchCents}
                />
              </FormField>

              <FormField
                label="Custo fixo mensal de infraestrutura"
                htmlFor="finops-fixed-infra"
                helperText="Soma de servidores, banco de dados, domínios e serviços fixos do mês."
                className="sm:col-span-2"
              >
                <MoneyInput
                  id="finops-fixed-infra"
                  size="sm"
                  cents={fixedInfraCents}
                  onCentsChange={setFixedInfraCents}
                />
              </FormField>

              <div className="sm:col-span-2">
                <Textarea
                  id="finops-notes"
                  label="Observações (opcional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Referência de faturas ou premissas usadas no fechamento do mês"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-[11px] text-critical-strong font-medium">
                {formError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
