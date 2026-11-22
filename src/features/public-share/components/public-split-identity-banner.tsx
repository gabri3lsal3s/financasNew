import { Eye, UserCheck, Users } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { SplitParticipantItem } from "@/types";
import { usePublicSplitGuestIdentity } from "../hooks";

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
  /** Indica quando o próprio anfitrião logado está pré-visualizando a página pública */
  isHostPreview?: boolean;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Banner de identificação do convidado no link público de racha (/r/:token).
 * Exclui rigorosamente o anfitrião da seleção de pagamento e oferece prévia segura quando visualizado por ele.
 */
export function PublicSplitIdentityBanner({
  token,
  participants,
  activeParticipantId,
  onSelectParticipant,
  isHostPreview = false,
  className,
}: PublicSplitIdentityBannerProps) {
  const guestIdentity = usePublicSplitGuestIdentity(token);

  // Regra de domínio: o anfitrião NUNCA pode ser selecionado como pagador convidado
  const guestParticipants = participants.filter((p) => !p.is_host);

  const effectiveActiveId =
    activeParticipantId !== undefined ? activeParticipantId : guestIdentity.activeParticipantId;

  const activeGuest = effectiveActiveId
    ? guestParticipants.find(
        (p) =>
          p.id === effectiveActiveId ||
          p.name.trim().toLowerCase() === effectiveActiveId.trim().toLowerCase(),
      ) ?? null
    : guestParticipants.length === 1
      ? (guestParticipants[0] ?? null)
      : null;

  const persistParticipant = (id: string | null) => {
    if (onSelectParticipant) {
      onSelectParticipant(id);
    }
    guestIdentity.setActiveParticipantId(id);
  };

  if (isHostPreview) {
    return (
      <Card
        className={cn(
          "border-portfolio/30 bg-portfolio/5 shadow-xs rounded-2xl p-4 space-y-3",
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <Eye className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">Prévia do Anfitrião</span>
              <Badge size="xs" variant="portfolio">Somente visualização</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Você criou este racha. Seus convidados visualizam apenas suas próprias cotas e o botão de aviso fica desabilitado para você.
            </p>
          </div>
        </div>

        {guestParticipants.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-portfolio/15">
            <span className="text-[11px] text-muted-foreground mr-1">Simular visão de:</span>
            {guestParticipants.map((guest) => {
              const key = guest.id || guest.name;
              const isSelected = activeGuest?.id === guest.id || activeGuest?.name === guest.name;
              return (
                <Button
                  key={key}
                  type="button"
                  size="xs"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => persistParticipant(key)}
                >
                  {guest.name}
                </Button>
              );
            })}
          </div>
        ) : null}
      </Card>
    );
  }

  if (guestParticipants.length === 0) {
    return null;
  }

  if (!activeGuest) {
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
          {guestParticipants.map((participant) => {
            const participantKey = participant.id || participant.name;

            return (
              <button
                key={participantKey}
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  persistParticipant(participantKey);
                }}
                className="min-h-11 sm:min-h-9 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer bg-surface-raised text-foreground border-border/80 hover:bg-surface-hover hover:border-border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span>{participant.name}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  const canSwitch = guestParticipants.length > 1;

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
          <Badge size="sm" variant="positive" className="font-semibold max-w-full truncate">
            Você é {activeGuest.name}
          </Badge>
        </div>

        {canSwitch ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            sensoryIntent="selection"
            onClick={() => persistParticipant(null)}
            className="px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <span>Alterar</span>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
