import { Users, UserCheck } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { usePublicSplitGuestIdentity } from "../hooks";
import type { SplitParticipantItem } from "@/types";

export interface PublicSplitIdentityBannerProps {
  /** Token público do racha para persistência de identidade em localStorage */
  token: string;
  /** Lista de participantes cadastrados no racha */
  participants: SplitParticipantItem[];
  /** Nome do anfitrião/organizador */
  hostName?: string;
  /** ID do participante ativo (controlado). Se omitido, utiliza o hook usePublicSplitGuestIdentity */
  activeParticipantId?: string | null;
  /** Callback acionado ao selecionar/alterar participante */
  onSelectParticipant?: (participantId: string | null) => void;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Banner de identificação do participante no link público de racha (/r/:token).
 *
 * Características:
 * 1. Sem identidade ativa: exibe card "Quem é você neste racha?" e lista de participantes clicáveis;
 * 2. Com identidade ativa: exibe badge "Você é [Nome]" acompanhado do botão "Alterar";
 * 3. Sanitiza nomes: o anfitrião exibe seu nome real com indicador "(Organizador)", nunca "Você (Anfitrião)".
 */
export function PublicSplitIdentityBanner({
  token,
  participants,
  hostName,
  activeParticipantId,
  onSelectParticipant,
  className,
}: PublicSplitIdentityBannerProps) {
  const guestIdentity = usePublicSplitGuestIdentity(token);
  const effectiveActiveId =
    activeParticipantId !== undefined ? activeParticipantId : guestIdentity.activeParticipantId;

  const activeParticipant = effectiveActiveId
    ? participants.find(
        (p) => p.id === effectiveActiveId || p.name.trim().toLowerCase() === effectiveActiveId.trim().toLowerCase(),
      ) ?? null
    : null;

  const handleSelect = (id: string | null) => {
    triggerSensory("selection");
    if (onSelectParticipant) {
      onSelectParticipant(id);
    }
    guestIdentity.setActiveParticipantId(id);
  };

  // Estado 1: Nenhuma identidade ativa selecionada
  if (!activeParticipant) {
    return (
      <Card
        className={cn(
          "border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3.5",
          className,
        )}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-foreground">
              Quem é você neste racha?
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Selecione seu nome para visualizar sua cota, parcelas e realizar o pagamento Pix diretamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-0.5">
          {participants.map((participant) => {
            const isHost = Boolean(participant.is_host);
            const cleanHostName = hostName || "Anfitrião";
            const displayName = isHost
              ? participant.name.includes("Você")
                ? cleanHostName
                : participant.name
              : participant.name;

            const participantKey = participant.id || participant.name;

            return (
              <button
                key={participantKey}
                type="button"
                onClick={() => handleSelect(participantKey)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer bg-surface-raised text-foreground border-border/80 hover:bg-surface-hover hover:border-border active:scale-[0.98]"
              >
                <span>{displayName}</span>
                {isHost && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (Organizador)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  // Estado 2: Identidade ativa identificada
  const isHost = Boolean(activeParticipant.is_host);
  const cleanHostName = hostName || "Anfitrião";
  const displayActiveName = isHost
    ? activeParticipant.name.includes("Você")
      ? cleanHostName
      : activeParticipant.name
    : activeParticipant.name;

  return (
    <Card
      className={cn(
        "border-border/80 bg-surface shadow-xs rounded-2xl p-3.5 sm:p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <Badge size="sm" variant="positive" className="font-semibold truncate">
            Você é {displayActiveName}
            {isHost ? " (Organizador)" : ""}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => handleSelect(null)}
          className="h-7 px-2.5 text-xs gap-1 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <span>Alterar</span>
        </Button>
      </div>
    </Card>
  );
}
