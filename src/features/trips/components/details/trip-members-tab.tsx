import { FileText, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { TripMember, TripMemberBalance } from "@/types/trips";

export interface TripMembersTabProps {
  members: readonly TripMember[];
  balances: readonly TripMemberBalance[];
  myMember: TripMember | null;
  isHost: boolean;
  onOpenInvite: () => void;
  onOpenAddMember: () => void;
  onOpenMemberStatement: (member: TripMember) => void;
  onRequestRemoveMember: (member: TripMember) => void;
}

export function TripMembersTab({
  members,
  balances,
  myMember,
  isHost,
  onOpenInvite,
  onOpenAddMember,
  onOpenMemberStatement,
  onRequestRemoveMember,
}: TripMembersTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="text-xs font-semibold text-foreground">
          Membros do Grupo
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {isHost && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onOpenInvite}
              className="gap-1.5"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              <span>Convidar Amigo</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenAddMember}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Adicionar Manual</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2.5">
        {members.map((member) => {
          const memBalance = balances.find((b) => b.memberId === member.id);
          const paid = memBalance?.totalPaidCents ?? 0;
          const net = memBalance?.netBalanceCents ?? 0;

          return (
            <Card
              key={member.id}
              className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-surface shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1.5 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 break-words">
                  {member.name}
                </p>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {member.is_host && (
                    <Badge size="xs" variant="default">
                      Organizador
                    </Badge>
                  )}
                  {member.user_id && (
                    <Badge size="xs" variant="positive">
                      Conta Axir
                    </Badge>
                  )}
                  {myMember && member.id === myMember.id && (
                    <Badge size="xs" variant="warning">
                      Você
                    </Badge>
                  )}
                  {member.joined_date && (
                    <Badge size="xs" variant="muted">
                      Entrou em {formatDateBR(member.joined_date)}
                    </Badge>
                  )}
                  {net > 0 && (
                    <Badge size="xs" variant="positive">
                      A receber:{" "}
                      <MoneyText
                        cents={net}
                        sign="explicit"
                        tone="positive"
                        className="text-[10px] font-semibold text-current"
                      />
                    </Badge>
                  )}
                  {net < 0 && (
                    <Badge size="xs" variant="warning">
                      A pagar:{" "}
                      <MoneyText
                        cents={Math.abs(net)}
                        tone="default"
                        className="text-[10px] font-semibold text-current"
                      />
                    </Badge>
                  )}
                  {net === 0 && (
                    <Badge size="xs" variant="muted">
                      Equilibrado
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <span>Total em despesas:</span>
                    <MoneyText
                      cents={paid}
                      tone="default"
                      variant="caption"
                      className="font-semibold text-foreground"
                    />
                  </span>

                  {Boolean(
                    memBalance?.settlementsPaidCents &&
                      memBalance.settlementsPaidCents > 0,
                  ) && (
                    <span className="inline-flex items-center gap-1">
                      <span>Acertos pagos:</span>
                      <MoneyText
                        cents={memBalance!.settlementsPaidCents!}
                        tone="default"
                        variant="caption"
                        className="font-semibold text-foreground"
                      />
                    </span>
                  )}

                  {Boolean(
                    memBalance?.settlementsReceivedCents &&
                      memBalance.settlementsReceivedCents > 0,
                  ) && (
                    <span className="inline-flex items-center gap-1">
                      <span>Acertos recebidos:</span>
                      <MoneyText
                        cents={memBalance!.settlementsReceivedCents!}
                        tone="default"
                        variant="caption"
                        className="font-semibold text-foreground"
                      />
                    </span>
                  )}

                  {member.pix_key && (
                    <span className="font-mono break-all">Pix: {member.pix_key}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/80">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenMemberStatement(member)}
                  className="gap-1.5"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  <span>Extrato</span>
                </Button>

                {isHost && !member.is_host && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    sensoryIntent="selection"
                    onClick={() => onRequestRemoveMember(member)}
                    className="size-10 sm:size-8 text-muted-foreground hover:text-critical-strong"
                    title="Remover participante"
                    aria-label={`Remover ${member.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
