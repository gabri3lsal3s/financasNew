import { CheckCircle2, History } from "lucide-react";
import { Badge, EmptyState, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { TripMember, TripSettlement } from "@/types/trips";

export interface TripSettlementHistoryTabProps {
  settlements: TripSettlement[];
  members?: TripMember[];
}

export function TripSettlementHistoryTab({ settlements, members = [] }: TripSettlementHistoryTabProps) {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  if (settlements.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-6" aria-hidden="true" />}
        title="Nenhum acerto gravado"
        description="Quando os participantes confirmarem transferências Pix, o registro aparecerá aqui."
      />
    );
  }

  return (
    <div className="space-y-2">
      {settlements.map((s) => {
        const fromName = memberNameMap.get(s.from_member_id) ?? "Participante";
        const toName = memberNameMap.get(s.to_member_id) ?? "Participante";
        const isConfirmed = s.status === "confirmed";

        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-surface text-xs"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <CheckCircle2
                  className={isConfirmed ? "size-3.5 text-positive-strong shrink-0" : "size-3.5 text-muted-foreground shrink-0"}
                  aria-hidden="true"
                />
                <span className="font-semibold text-foreground truncate">
                  {fromName} para {toName}
                </span>
                <Badge size="xs" variant={isConfirmed ? "positive" : "muted"}>
                  {isConfirmed ? "Quitado" : "Pendente"}
                </Badge>
              </div>
              {s.confirmed_at ? (
                <p className="text-[11px] text-muted-foreground">
                  Confirmado em {formatDateBR(s.confirmed_at)}
                </p>
              ) : null}
            </div>

            <MoneyText cents={s.amount_cents} tone={isConfirmed ? "positive" : "default"} className="font-bold shrink-0" />
          </div>
        );
      })}
    </div>
  );
}
