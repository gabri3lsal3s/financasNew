import { FileText, UserCheck, Users } from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL } from "@/services/masks/money";
import { cn } from "@/lib/utils";
import { usePublicTripGuestIdentity } from "../hooks";
import { PublicTripIdentityFooter } from "./public-trip-identity-footer";
import type { PublicTripMember, TripMemberBalance } from "@/types/trips";

export interface PublicTripIdentityBannerProps {
  /** Token público da viagem para resolução de rota e persistência de identidade */
  token: string;
  /** Lista de participantes da viagem */
  members: PublicTripMember[];
  /** ID do participante ativo (controlado). Se omitido, utiliza o hook `usePublicTripGuestIdentity` */
  activeMemberId?: string | null;
  /** Callback acionado ao selecionar/alterar participante */
  onSelectMember?: (memberId: string | null) => void;
  /** Balanço opcional do participante selecionado para exibir resumo financeiro */
  balance?: TripMemberBalance | null;
  /** Callback acionado para abrir o extrato detalhado do participante selecionado */
  onOpenStatement?: (member: PublicTripMember) => void;
  /** Callback acionado para abrir o diálogo de vinculação da viagem à conta Axir */
  onClaimAccount?: () => void;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Banner de identificação e boas-vindas do participante no link público da viagem (/viagem/:token).
 */
export function PublicTripIdentityBanner({
  token,
  members,
  activeMemberId,
  onSelectMember,
  balance,
  onOpenStatement,
  onClaimAccount,
  className,
}: PublicTripIdentityBannerProps) {
  const guestIdentity = usePublicTripGuestIdentity(token);
  const effectiveActiveMemberId =
    activeMemberId !== undefined ? activeMemberId : guestIdentity.activeMemberId;

  const activeMember = effectiveActiveMemberId
    ? members.find((m) => m.id === effectiveActiveMemberId) ?? null
    : null;

  const { session } = useAuth();
  const isAuthenticated = Boolean(session?.user);
  const loginRedirectUrl = `/entrar?redirect=${encodeURIComponent(`/viagem/${token}`)}`;

  const persistMember = (memberId: string | null) => {
    if (onSelectMember) {
      onSelectMember(memberId);
    }
    guestIdentity.setActiveMemberId(memberId);
  };

  if (!activeMember) {
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
              Quem é você nesta viagem?
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Selecione seu nome para facilitar lançamentos e visualizar seu rateio individual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-0.5">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                triggerSensory("selection");
                persistMember(member.id);
              }}
              className="min-h-11 sm:min-h-9 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer bg-surface-raised text-foreground border-border/80 hover:bg-surface-hover hover:border-border active:scale-[0.98]"
            >
              <span>{member.name}</span>
              {member.is_host && (
                <span className="text-muted-foreground font-normal ml-1">(Organizador)</span>
              )}
            </button>
          ))}
        </div>

        <PublicTripIdentityFooter
          isAuthenticated={isAuthenticated}
          loginRedirectUrl={loginRedirectUrl}
          onClaimAccount={onClaimAccount}
        />
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <Badge size="sm" variant="positive" className="font-semibold max-w-full truncate">
            Você é {activeMember.name}
            {activeMember.is_host ? " (Organizador)" : ""}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          sensoryIntent="selection"
          onClick={() => persistMember(null)}
          className="px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <span>Alterar</span>
        </Button>
      </div>

      {balance && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-surface-raised space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Você pagou no total:</span>
            <MoneyText cents={balance.totalPaidCents} variant="value" tone="default" className="text-xs font-semibold" />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Sua cota nas despesas:</span>
            <MoneyText cents={balance.totalOwedCents} variant="value" tone="default" className="text-xs font-semibold" />
          </div>
          <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="font-semibold text-foreground">Balanço Final:</span>
            {balance.netBalanceCents > 0 ? (
              <Badge variant="positive" size="sm">
                <span className="num">Você tem {formatCentsAsBRL(balance.netBalanceCents)} a receber</span>
              </Badge>
            ) : balance.netBalanceCents < 0 ? (
              <Badge variant="critical" size="sm">
                <span className="num">Você deve {formatCentsAsBRL(Math.abs(balance.netBalanceCents))}</span>
              </Badge>
            ) : (
              <Badge variant="muted" size="sm">
                Contas equilibradas
              </Badge>
            )}
          </div>

          {onOpenStatement && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenStatement(activeMember)}
              className="w-full gap-2 text-xs font-semibold"
            >
              <FileText className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>Ver Extrato Detalhado do Meu Rateio</span>
            </Button>
          )}
        </div>
      )}

      <PublicTripIdentityFooter
        isAuthenticated={isAuthenticated}
        loginRedirectUrl={loginRedirectUrl}
        onClaimAccount={onClaimAccount}
      />
    </Card>
  );
}
