import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { formatDateBR, formatMonthYear } from "@/lib/date";
import type { CycleObligationsBreakdown } from "@/domain/cash";

export interface CycleObligationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown?: CycleObligationsBreakdown;
}

interface ObligationItem {
  id: string;
  title: string;
  subtitle: string;
  amountCents: number;
  tone: "negative" | "positive";
  dotColor?: string;
  badge?: { label: string; variant: "critical" | "muted" };
  actionLabel?: string;
  actionAriaLabel?: string;
  onAction?: () => void;
}

function ObligationSection({
  icon,
  title,
  count,
  totalCents,
  tone,
  items,
  emptyMessage,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  totalCents: number;
  tone: "negative" | "positive";
  items: ObligationItem[];
  emptyMessage?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
          {icon}
          <span className="truncate">{title}</span>
          <Badge variant="muted" size="xs">{count}</Badge>
        </div>
        <MoneyText cents={totalCents} tone={tone} variant="caption" className="font-semibold" />
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface overflow-hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-surface-hover/50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.dotColor ? (
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.dotColor }} aria-hidden="true" />
                ) : null}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
                    {item.badge ? <Badge variant={item.badge.variant} size="xs">{item.badge.label}</Badge> : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <MoneyText cents={item.amountCents} tone={item.tone} variant="caption" />
                {item.onAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={item.onAction}
                    className="text-muted-foreground hover:text-foreground gap-1"
                    aria-label={item.actionAriaLabel}
                  >
                    <span className="hidden sm:inline">{item.actionLabel}</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : emptyMessage ? (
        <div className="rounded-xl border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}
    </div>
  );
}

export function CycleObligationsDialog({ open, onOpenChange, breakdown }: CycleObligationsDialogProps) {
  const navigate = useNavigate();
  if (!breakdown) return null;

  const goTo = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const invoiceItems: ObligationItem[] = breakdown.invoices.map((inv) => ({
    id: `${inv.cardId}:${inv.competenceMonth}`,
    title: inv.cardName,
    subtitle: `Fatura de ${formatMonthYear(inv.competenceMonth)} · Vence em ${formatDateBR(inv.dueDate)}`,
    amountCents: inv.saldoCents,
    tone: "negative",
    dotColor: inv.cardColor ?? "hsl(var(--primary))",
    actionLabel: "Ver fatura",
    actionAriaLabel: `Ver fatura de ${inv.cardName}`,
    onAction: () => goTo(`/cartoes?card=${encodeURIComponent(inv.cardId)}&month=${encodeURIComponent(inv.competenceMonth)}`),
  }));

  const payableItems: ObligationItem[] = breakdown.payableDebts.map((debt) => ({
    id: debt.id,
    title: debt.name,
    subtitle: `Vencimento: ${formatDateBR(debt.dueDate)}`,
    amountCents: debt.amountCents,
    tone: "negative",
    badge: debt.isOverdue ? { label: "Atrasada", variant: "critical" } : { label: "No prazo", variant: "muted" },
    actionLabel: "Ver dívida",
    actionAriaLabel: `Ver detalhes da dívida ${debt.name}`,
    onAction: () => goTo(`/dividas?q=${encodeURIComponent(debt.id)}`),
  }));

  const receivableItems: ObligationItem[] = breakdown.receivableDebts.map((rec) => ({
    id: rec.id,
    title: rec.name,
    subtitle: `Previsão: ${formatDateBR(rec.dueDate)}`,
    amountCents: rec.amountCents,
    tone: "positive",
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Obrigações do Ciclo Atual"
      description="Compromissos financeiros imediatos que vencem até o fechamento deste mês e que reduzem o seu Saldo Livre Real."
      size="lg"
      footer={
        <ModalFooter borderless className="sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => goTo("/dividas")} className="text-muted-foreground hover:text-foreground gap-1.5">
            <span>Gerenciar todas as dívidas</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/40 p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-negative/20 bg-negative/10 text-negative-strong">
              <ArrowDownRight className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground">Total Comprometido no Ciclo</span>
              <span className="text-[11px] text-muted-foreground">Faturas abertas + Contas a pagar deste mês</span>
            </div>
          </div>
          <MoneyText cents={breakdown.committedObligationsCents} tone="negative" className="text-base sm:text-lg font-bold tracking-tight shrink-0 self-end sm:self-auto" />
        </div>

        <ObligationSection
          icon={<CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          title="Faturas de Cartão de Crédito"
          count={breakdown.invoices.length}
          totalCents={breakdown.openInvoicesCents}
          tone="negative"
          items={invoiceItems}
          emptyMessage="Nenhuma fatura de cartão com saldo devedor em aberto no ciclo."
        />

        <ObligationSection
          icon={<Receipt className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          title="Contas e Dívidas a Pagar no Ciclo"
          count={breakdown.payableDebts.length}
          totalCents={breakdown.payableDebtsCents}
          tone="negative"
          items={payableItems}
          emptyMessage="Nenhuma conta a pagar pendente com vencimento neste mês."
        />

        {receivableItems.length > 0 ? (
          <ObligationSection
            icon={<ArrowUpRight className="size-3.5 text-positive-strong" aria-hidden="true" />}
            title="A Receber Previsto no Ciclo"
            count={breakdown.receivableDebts.length}
            totalCents={breakdown.receivablePendingCents}
            tone="positive"
            items={receivableItems}
          />
        ) : null}

        {breakdown.futureDebts.count > 0 ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground">Visão de Médio e Longo Prazo</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Você possui <strong className="text-foreground">{breakdown.futureDebts.count} parcela(s)/dívida(s) futura(s)</strong> totalizando{" "}
                  <MoneyText cents={breakdown.futureDebts.totalCents} tone="default" variant="caption" className="font-semibold" /> que vencerão nos próximos meses.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => goTo("/dividas")} className="font-medium shrink-0 self-end sm:self-center gap-1">
              <span>Ver todas</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
