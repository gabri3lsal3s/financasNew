/**
 * Modal público de Extrato e Explicabilidade Contábil do Participante.
 * Permite a convidados sem login auditar item a item por que devem ou têm a receber determinado valor.
 * Cumpre regras do AGENTS.md (Regras 4, 7, 8, 14, 15, 18 e 20).
 */

import {
  Modal,
  ModalFooter,
  Button,
  Badge,
  Card,
} from "@/components/ui";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { getMemberExpenseStatement } from "@/domain/trips/trip-math";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { PublicTripMember, PublicTripExpense } from "@/types/trips";

export interface PublicTripMemberStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: PublicTripMember | null;
  members: readonly PublicTripMember[];
  expenses: readonly PublicTripExpense[];
}

export function PublicTripMemberStatementDialog({
  open,
  onOpenChange,
  member,
  members,
  expenses,
}: PublicTripMemberStatementDialogProps) {
  if (!member) return null;

  const statement = getMemberExpenseStatement(
    member.id,
    members.map((m) => ({
      id: m.id,
      name: m.name,
      pix_key: m.pix_key,
      pix_key_type: m.pix_key_type,
      joined_date: m.joined_date,
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
    }))
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`Extrato de Gastos — ${member.name}`}
      description="Discriminação detalhada de participações, cotas devidas e justificativas de despesas da viagem."
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar Extrato
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {/* Cartão de Identificação e Trinca de Saldos */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-raised border border-border/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {member.name}
              </span>
              {member.is_host && (
                <Badge size="xs" variant="default">
                  Organizador
                </Badge>
              )}
            </div>

            <Badge size="xs" variant="muted">
              {member.joined_date
                ? `Ingressou em ${member.joined_date}`
                : "Presente desde o início"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/60">
            <div className="p-2.5 rounded-xl bg-surface border border-border/60">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Total Pago
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatCentsAsBRL(statement.totalPaidCents)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-surface border border-border/60">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Sua Cota nas Contas
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatCentsAsBRL(statement.totalOwedCents)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-surface border border-border/60">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Balanço Líquido
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  statement.netBalanceCents > 0
                    ? "text-positive"
                    : statement.netBalanceCents < 0
                    ? "text-warning"
                    : "text-muted-foreground"
                }`}
              >
                {statement.netBalanceCents > 0
                  ? `+ ${formatCentsAsBRL(statement.netBalanceCents)}`
                  : statement.netBalanceCents < 0
                  ? formatCentsAsBRL(statement.netBalanceCents)
                  : "R$ 0,00"}
              </span>
            </div>
          </div>
        </div>

        {/* Seção 1: Despesas com Participação */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-positive" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">
              Despesas com sua Participação ({statement.participations.length})
            </h3>
          </div>

          {statement.participations.length === 0 ? (
            <Card className="p-4 border-border/80 bg-surface text-center">
              <p className="text-xs text-muted-foreground">
                Nenhuma despesa atribuída a este participante até o momento.
              </p>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {statement.participations.map((item, idx) => (
                <div
                  key={`${item.expenseId}-${idx}`}
                  className="p-2.5 rounded-xl border border-border/80 bg-surface flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate">
                        {item.description}
                      </span>
                      <Badge size="xs" variant="muted">
                        {item.categoryName}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.expenseDate} • Pago por {item.payerName} ({formatCentsAsBRL(item.totalAmountCents)})
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-muted-foreground block">
                      Sua Cota
                    </span>
                    <span className="font-bold tabular-nums text-foreground">
                      {formatCentsAsBRL(item.userShareCents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seção 2: Despesas Fora da Participação (Explicabilidade / Transparência) */}
        {statement.exclusions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/80">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-4 text-warning" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-foreground">
                Despesas em que NÃO Participou ({statement.exclusions.length})
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gastos isentos que não foram cobrados de você nesta viagem:
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {statement.exclusions.map((item, idx) => (
                <div
                  key={`ex-${item.expenseId}-${idx}`}
                  className="p-2.5 rounded-xl border border-border/80 bg-surface-raised/60 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate">
                        {item.description}
                      </span>
                      <Badge size="xs" variant="warning">
                        Isento
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Motivo: {item.reasonText}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Data: {item.expenseDate} • Total: {formatCentsAsBRL(item.totalAmountCents)}
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
