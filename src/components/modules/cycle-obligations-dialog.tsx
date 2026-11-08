import { useNavigate } from "react-router";
import { CreditCard, Receipt, CalendarClock, ArrowRight, ExternalLink, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR, formatMonthYear } from "@/lib/date";
import type { CycleObligationsBreakdown } from "@/domain/cash";

export interface CycleObligationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown?: CycleObligationsBreakdown;
}

export function CycleObligationsDialog({
  open,
  onOpenChange,
  breakdown,
}: CycleObligationsDialogProps) {
  const navigate = useNavigate();

  if (!breakdown) return null;

  const handleNavigateCards = (cardId: string, month: string) => {
    onOpenChange(false);
    navigate(`/cartoes?card=${encodeURIComponent(cardId)}&month=${encodeURIComponent(month)}`);
  };

  const handleNavigateDebts = (debtId?: string) => {
    onOpenChange(false);
    if (debtId) {
      navigate(`/dividas?q=${encodeURIComponent(debtId)}`);
    } else {
      navigate("/dividas");
    }
  };

  const hasInvoices = breakdown.invoices.length > 0;
  const hasPayableDebts = breakdown.payableDebts.length > 0;
  const hasReceivables = breakdown.receivableDebts.length > 0;
  const hasFutureDebts = breakdown.futureDebts.count > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Obrigações do Ciclo Atual"
      description="Compromissos financeiros imediatos que vencem até o fechamento deste mês e que reduzem o seu Saldo Livre Real."
      size="lg"
      footer={
        <ModalFooter borderless={true} className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleNavigateDebts()}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <span>Gerenciar todas as dívidas</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Card Resumo do Total Comprometido */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/40 p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-negative/20 bg-negative/10 text-negative">
              <ArrowDownRight className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground">
                Total Comprometido no Ciclo
              </span>
              <span className="text-[11px] text-muted-foreground">
                Faturas abertas + Contas a pagar deste mês
              </span>
            </div>
          </div>

          <MoneyText
            cents={breakdown.committedObligationsCents}
            tone="negative"
            className="text-base sm:text-lg font-bold tracking-tight shrink-0 self-end sm:self-auto"
          />
        </div>

        {/* Seção 1: Faturas de Cartão de Crédito */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Faturas de Cartão de Crédito</span>
              <Badge variant="muted" size="xs">
                {breakdown.invoices.length}
              </Badge>
            </div>
            <MoneyText
              cents={breakdown.openInvoicesCents}
              tone="negative"
              className="text-xs font-semibold"
            />
          </div>

          {hasInvoices ? (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
              {breakdown.invoices.map((inv) => (
                <div
                  key={`${inv.cardId}:${inv.competenceMonth}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: inv.cardColor ?? "var(--primary)" }}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">
                        {inv.cardName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Fatura de {formatMonthYear(inv.competenceMonth)} • Vence em {formatDateBR(inv.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <MoneyText
                      cents={inv.saldoCents}
                      tone="negative"
                      className="text-xs font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNavigateCards(inv.cardId, inv.competenceMonth)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      aria-label={`Ver fatura de ${inv.cardName}`}
                    >
                      <span className="hidden sm:inline">Ver fatura</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
              Nenhuma fatura de cartão com saldo devedor em aberto no ciclo.
            </div>
          )}
        </div>

        {/* Seção 2: Contas e Dívidas a Pagar do Mês */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Receipt className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Contas e Dívidas a Pagar no Ciclo</span>
              <Badge variant="muted" size="xs">
                {breakdown.payableDebts.length}
              </Badge>
            </div>
            <MoneyText
              cents={breakdown.payableDebtsCents}
              tone="negative"
              className="text-xs font-semibold"
            />
          </div>

          {hasPayableDebts ? (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
              {breakdown.payableDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">
                          {debt.name}
                        </span>
                        {debt.isOverdue ? (
                          <Badge variant="critical" size="xs">
                            Atrasada
                          </Badge>
                        ) : (
                          <Badge variant="muted" size="xs">
                            No prazo
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Vencimento: {formatDateBR(debt.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <MoneyText
                      cents={debt.amountCents}
                      tone="negative"
                      className="text-xs font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNavigateDebts(debt.id)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      aria-label={`Ver detalhes da dívida ${debt.name}`}
                    >
                      <span className="hidden sm:inline">Ver dívida</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
              Nenhuma conta a pagar pendente com vencimento neste mês.
            </div>
          )}
        </div>

        {/* Seção Opcional: A Receber no Mês */}
        {hasReceivables && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ArrowUpRight className="size-3.5 text-positive" aria-hidden="true" />
                <span>A Receber Previsto no Ciclo</span>
                <Badge variant="muted" size="xs">
                  {breakdown.receivableDebts.length}
                </Badge>
              </div>
              <MoneyText
                cents={breakdown.receivablePendingCents}
                tone="positive"
                className="text-xs font-semibold"
              />
            </div>

            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
              {breakdown.receivableDebts.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-2 p-3 hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">
                      {rec.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Previsão: {formatDateBR(rec.dueDate)}
                    </span>
                  </div>

                  <MoneyText
                    cents={rec.amountCents}
                    tone="positive"
                    className="text-xs font-medium shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção 3: Dívidas Futuras (Longo Prazo / Próximos Meses) */}
        {hasFutureDebts && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground">
                  Visão de Médio e Longo Prazo
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Você possui <strong className="text-foreground">{breakdown.futureDebts.count} parcela(s)/dívida(s) futura(s)</strong> totalizando{" "}
                  <MoneyText cents={breakdown.futureDebts.totalCents} tone="default" className="font-semibold text-foreground" /> que vencerão nos próximos meses.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleNavigateDebts()}
              className="h-7 text-xs font-medium shrink-0 self-end sm:self-center"
            >
              <span>Ver todas</span>
              <ArrowRight className="size-3 ml-1" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
