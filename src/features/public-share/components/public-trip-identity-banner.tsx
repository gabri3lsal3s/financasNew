import { Link } from "react-router";
import { Users, UserCheck, LogIn, ArrowRight, FileText } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL } from "@/services/masks/money";
import { cn } from "@/lib/utils";
import { usePublicTripGuestIdentity } from "../hooks";
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
 *
 * Características:
 * 1. Quando sem identidade: exibe card sóbrio com título "Quem é você nesta viagem?" e lista de participantes;
 * 2. Quando com identidade ativa: exibe badge "Você é [Nome]" acompanhado de botão compacto "Alterar";
 * 3. Se participante possuir balanço: exibe resumo financeiro e atalho para o extrato individual;
 * 4. Para visitantes desautenticados: exibe banner discreto convidando ao login/sincronização no Axir.
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

  const handleSelectMember = (memberId: string | null) => {
    triggerSensory("selection");
    if (onSelectMember) {
      onSelectMember(memberId);
    }
    guestIdentity.setActiveMemberId(memberId);
  };

  const loginRedirectUrl = `/entrar?redirect=${encodeURIComponent(`/viagem/${token}`)}`;

  // Estado 1: Nenhuma identidade ativa selecionada
  if (!activeMember) {
    return (
      <Card
        className={cn(
          "border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3.5",
          className
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
              onClick={() => handleSelectMember(member.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer bg-surface-raised text-foreground border-border/80 hover:bg-surface-hover hover:border-border active:scale-[0.98]"
            >
              <span>{member.name}</span>
              {member.is_host && (
                <span className="text-muted-foreground font-normal ml-1">
                  (Organizador)
                </span>
              )}
            </button>
          ))}
        </div>

        {!isAuthenticated ? (
          <div className="pt-2 border-t border-border/60">
            <Link
              to={loginRedirectUrl}
              className="group flex items-center justify-between p-2.5 rounded-xl bg-surface-raised/70 border border-border/70 hover:bg-surface-hover hover:border-border transition-colors text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <LogIn
                  className="size-3.5 text-muted-foreground group-hover:text-primary-strong transition-colors shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                  Já tem conta no Axir?{" "}
                  <span className="font-semibold text-foreground underline decoration-border group-hover:decoration-primary">
                    Entrar com minha conta Axir para sincronizar com meu extrato
                  </span>
                </span>
              </div>
              <ArrowRight
                className="size-3 text-muted-foreground group-hover:text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                aria-hidden="true"
              />
            </Link>
          </div>
        ) : onClaimAccount ? (
          <div className="pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClaimAccount}
              className="group flex w-full items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-xs cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck
                  className="size-3.5 text-primary-strong shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                  Conectado ao Axir.{" "}
                  <span className="font-semibold text-foreground underline decoration-primary/40 group-hover:decoration-primary">
                    Vincular esta viagem ao meu aplicativo Axir
                  </span>
                </span>
              </div>
              <ArrowRight
                className="size-3 text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                aria-hidden="true"
              />
            </button>
          </div>
        ) : null}
      </Card>
    );
  }

  // Estado 2: Identidade ativa identificada
  return (
    <Card
      className={cn(
        "border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <Badge size="sm" variant="positive" className="font-semibold truncate">
            Você é {activeMember.name}
            {activeMember.is_host ? " (Organizador)" : ""}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => handleSelectMember(null)}
          className="h-7 px-2.5 text-xs gap-1 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <span>Alterar</span>
        </Button>
      </div>

      {balance && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-surface-raised border border-border/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Você pagou no total:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCentsAsBRL(balance.totalPaidCents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sua cota nas despesas:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCentsAsBRL(balance.totalOwedCents)}
            </span>
          </div>
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Balanço Final:</span>
            {balance.netBalanceCents > 0 ? (
              <Badge variant="positive" size="sm">
                Você tem {formatCentsAsBRL(balance.netBalanceCents)} a receber
              </Badge>
            ) : balance.netBalanceCents < 0 ? (
              <Badge variant="critical" size="sm">
                Você deve {formatCentsAsBRL(Math.abs(balance.netBalanceCents))}
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
              className="w-full h-8.5 gap-2 text-xs font-semibold border-border/80 bg-surface hover:bg-surface-hover cursor-pointer"
            >
              <FileText className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>Ver Extrato Detalhado do Meu Rateio</span>
            </Button>
          )}
        </div>
      )}

      {!isAuthenticated ? (
        <div className="pt-2 border-t border-border/60">
          <Link
            to={loginRedirectUrl}
            className="group flex items-center justify-between p-2.5 rounded-xl bg-surface-raised/70 border border-border/70 hover:bg-surface-hover hover:border-border transition-colors text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <LogIn
                className="size-3.5 text-muted-foreground group-hover:text-primary-strong transition-colors shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                Já tem conta no Axir?{" "}
                <span className="font-semibold text-foreground underline decoration-border group-hover:decoration-primary">
                  Entrar com minha conta Axir para sincronizar com meu extrato
                </span>
              </span>
            </div>
            <ArrowRight
              className="size-3 text-muted-foreground group-hover:text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
              aria-hidden="true"
            />
          </Link>
        </div>
      ) : onClaimAccount ? (
        <div className="pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClaimAccount}
            className="group flex w-full items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-xs cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck
                className="size-3.5 text-primary-strong shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                Conectado ao Axir.{" "}
                <span className="font-semibold text-foreground underline decoration-primary/40 group-hover:decoration-primary">
                  Vincular esta viagem ao meu aplicativo Axir
                </span>
              </span>
            </div>
            <ArrowRight
              className="size-3 text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
    </Card>
  );
}
