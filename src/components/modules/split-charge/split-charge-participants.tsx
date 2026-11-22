import { Badge, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SplitParticipantView } from "./split-charge-types";

export interface SplitChargeParticipantsProps {
  participants?: SplitParticipantView[];
  hostName: string;
  activeParticipantId?: string | null;
}

/**
 * Lista de participantes e respectivas cotas exibida dentro do `SplitChargeCard`.
 */
export function SplitChargeParticipants({
  participants,
  hostName,
  activeParticipantId,
}: SplitChargeParticipantsProps) {
  if (!participants || participants.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border/80 space-y-2">
      <span className="text-xs font-semibold text-muted-foreground block">
        Divisão entre os participantes
      </span>
      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
        {participants.map((item, idx) => {
          const isHost = Boolean(item.is_host);
          const isMe = Boolean(
            activeParticipantId &&
              (item.id === activeParticipantId ||
                item.name.trim().toLowerCase() === activeParticipantId.trim().toLowerCase()) &&
              !isHost,
          );
          const cleanHostName = hostName || "Anfitrião";
          const displayName = isHost
            ? item.name.includes("Você")
              ? cleanHostName
              : item.name
            : item.name;

          return (
            <div
              key={item.id ?? idx}
              className={cn(
                "flex items-center justify-between text-xs py-2 px-3 rounded-xl transition-colors",
                isMe
                  ? "bg-primary/5 border border-primary/30 ring-1 ring-primary/20"
                  : "bg-surface-raised",
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-foreground truncate font-medium">{displayName}</span>
                {isHost && (
                  <Badge variant="muted" size="xs">
                    Anfitrião
                  </Badge>
                )}
                {!isHost && item.is_settled && (
                  <Badge variant="positive" size="xs">
                    Pago
                  </Badge>
                )}
                {isMe && (
                  <Badge variant="default" size="xs">
                    Você
                  </Badge>
                )}
              </div>
              <MoneyText
                cents={item.share_cents}
                variant="caption"
                tone="default"
                className="text-xs font-semibold shrink-0 ml-2"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
