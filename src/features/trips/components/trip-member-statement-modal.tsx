import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText, type ModalSize } from "@/components/ui";
import { getMemberExpenseStatement } from "@/domain/trips/trip-math";
import { formatDateBR } from "@/lib/date";
import { TRIP_PIX_KEY_TYPES, type TripPixKeyType, type TripSplitType } from "@/types/trips";

function normalizePixKeyType(raw: string | null | undefined): TripPixKeyType | null {
  if (!raw) return null;
  return (TRIP_PIX_KEY_TYPES as readonly string[]).includes(raw) ? (raw as TripPixKeyType) : null;
}

export interface StatementMemberInput {
  id: string;
  name: string;
  is_host: boolean;
  pix_key?: string | null;
  pix_key_type?: string | null;
  joined_date?: string | null;
}

export interface StatementExpenseInput {
  id: string;
  description: string;
  category_name: string;
  paid_by_member_id: string;
  amount_cents: number;
  expense_date: string;
  split_type: TripSplitType;
  splits?: readonly { member_id: string; share_cents: number }[];
}

export interface TripMemberStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StatementMemberInput | null;
  members: readonly StatementMemberInput[];
  expenses: readonly StatementExpenseInput[];
  size?: ModalSize;
  description?: string;
  owedLabel?: string;
  netLabel?: string;
  participationsTitle?: string;
  exclusionsSubtitle?: string;
}

export function TripMemberStatementModal({
  open,
  onOpenChange,
  member,
  members,
  expenses,
  size = "lg",
  description = "Discriminação detalhada de participações, cotas devidas e justificativas de despesas.",
  owedLabel = "Total Devido",
  netLabel = "Saldo Líquido",
  participationsTitle = "Despesas com Participação",
  exclusionsSubtitle = "Despesas que não entraram no cálculo da dívida deste participante e a respectiva justificativa:",
}: TripMemberStatementModalProps) {
  if (!member) return null;

  const statement = getMemberExpenseStatement(
    member.id,
    members.map((m) => ({
      id: m.id,
      name: m.name,
      pix_key: m.pix_key ?? null,
      pix_key_type: normalizePixKeyType(m.pix_key_type),
      joined_date: m.joined_date ?? null,
    })),
    expenses.map((e) => ({
      id: e.id,
      description: e.description,
      category_name: e.category_name,
      paid_by_member_id: e.paid_by_member_id,
      amount_cents: e.amount_cents,
      expense_date: e.expense_date,
      split_type: e.split_type,
      splits: (e.splits ?? []).map((s) => ({
        member_id: s.member_id,
        share_cents: s.share_cents,
      })),
    })),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      title={`Extrato de Gastos — ${member.name}`}
      description={description}
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
            Fechar Extrato
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border/80 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{member.name}</span>
              {member.is_host && (
                <Badge size="xs" variant="default">
                  Organizador
                </Badge>
              )}
            </div>

            <Badge size="xs" variant="muted">
              {member.joined_date
                ? `Ingressou em ${formatDateBR(member.joined_date)}`
                : "Presente desde o início"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/80">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Pago</span>
              <MoneyText cents={statement.totalPaidCents} tone="default" className="text-sm sm:text-base font-bold tabular-nums" />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{owedLabel}</span>
              <MoneyText cents={statement.totalOwedCents} tone="default" className="text-sm sm:text-base font-bold tabular-nums" />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{netLabel}</span>
              <MoneyText cents={statement.netBalanceCents} tone="auto" sign="explicit" className="text-sm sm:text-base font-bold tabular-nums" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">
              {participationsTitle} ({statement.participations.length})
            </h3>
          </div>

          {statement.participations.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-surface text-center">
              <p className="text-xs text-muted-foreground">
                Nenhuma despesa atribuída a este participante até o momento.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {statement.participations.map((item, idx) => (
                <div
                  key={`${item.expenseId}-${idx}`}
                  className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{item.description}</span>
                      <Badge size="xs" variant="muted">
                        {item.categoryName}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateBR(item.expenseDate)} · Pago por {item.payerName} (
                      <MoneyText cents={item.totalAmountCents} tone="default" variant="caption" className="text-muted-foreground" />)
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-muted-foreground block">Sua Cota</span>
                    <MoneyText cents={item.userShareCents} tone="default" className="font-bold" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {statement.exclusions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/80">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-4 text-warning-strong" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-foreground">
                Despesas em que NÃO Participou ({statement.exclusions.length})
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">{exclusionsSubtitle}</p>

            <div className="space-y-1.5">
              {statement.exclusions.map((item, idx) => (
                <div
                  key={`ex-${item.expenseId}-${idx}`}
                  className="p-2.5 rounded-xl border border-border/80 bg-surface-raised/60 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{item.description}</span>
                      <Badge size="xs" variant="warning">
                        Isento
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Motivo: {item.reasonText}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Data: {formatDateBR(item.expenseDate)} · Total:{" "}
                      <MoneyText cents={item.totalAmountCents} tone="default" variant="caption" className="text-muted-foreground" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
