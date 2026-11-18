/**
 * Cockpit Contextual do Participante no Modo Viagem.
 * Exibe o status financeiro pessoal do usuário autenticado no grupo (saldo líquido,
 * cota consumida vs. gastos desembolsados e atalho rápido de quitação).
 */

import { Card, Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import {
  Wallet,
  ShieldCheck,
  UserCheck,
  Crown,
  FileText,
  Filter,
  LogOut,
} from "lucide-react";
import type { Trip, TripMember, TripMemberBalance } from "@/types/trips";

export interface TripPersonalContextCardProps {
  trip: Trip;
  myMember: TripMember | null;
  myBalance: TripMemberBalance | null;
  isHost: boolean;
  onOpenSettlement: () => void;
  onOpenStatement?: () => void;
  isFilterActive?: boolean;
  onToggleFilterMyExpenses?: () => void;
  onLeaveTrip?: () => void;
}

export function TripPersonalContextCard({
  myMember,
  myBalance,
  isHost,
  onOpenSettlement,
  onOpenStatement,
  isFilterActive,
  onToggleFilterMyExpenses,
  onLeaveTrip,
}: TripPersonalContextCardProps) {
  if (!myMember) {
    return null;
  }

  const netBalanceCents = myBalance?.netBalanceCents ?? 0;
  const totalPaidCents = myBalance?.totalPaidCents ?? 0;
  const totalShareCents = myBalance?.totalOwedCents ?? 0;

  const isCreditor = netBalanceCents > 0;
  const isDebtor = netBalanceCents < 0;
  const isSettled = netBalanceCents === 0;

  return (
    <Card
      data-testid="trip-personal-context-card"
      className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-foreground break-words">
              Seu Espaço na Viagem: {myMember.name}
            </span>
            {isHost ? (
              <Badge size="xs" variant="default" className="gap-1">
                <Crown className="size-3 text-warning-strong" aria-hidden="true" />
                Organizador da Viagem
              </Badge>
            ) : (
              <Badge size="xs" variant="positive" className="gap-1">
                <UserCheck className="size-3" aria-hidden="true" />
                Participante Conectado
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Balanço financeiro individual calculado em tempo real para sua conta.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onToggleFilterMyExpenses && (
            <Button
              type="button"
              size="sm"
              sensoryIntent="selection"
              variant={isFilterActive ? "default" : "outline"}
              onClick={onToggleFilterMyExpenses}
              className="gap-1.5"
            >
              <Filter className="size-3.5" aria-hidden="true" />
              <span>{isFilterActive ? "Mostrando Meus Gastos" : "Ver Meus Gastos"}</span>
            </Button>
          )}

          {onOpenStatement && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenStatement}
              className="gap-1.5"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              <span>Meu Extrato</span>
            </Button>
          )}

          {!isHost && onLeaveTrip && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onLeaveTrip}
              className="gap-1.5 text-muted-foreground hover:text-critical-strong hover:border-critical/30"
              title="Desvincular sua conta e sair desta viagem"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>Sair da Viagem</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid de Balanço Pessoal (M2: contraste de superfície sem borda dupla interna) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border/80">
        {/* Bloco de Saldo Líquido */}
        <div className="p-3.5 rounded-xl bg-surface-raised flex flex-col justify-between space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">
              Seu Saldo Líquido
            </span>
            {isSettled ? (
              <Badge size="xs" variant="muted" className="gap-1">
                <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
                Zerado
              </Badge>
            ) : isCreditor ? (
              <Badge size="xs" variant="positive">
                A Receber
              </Badge>
            ) : (
              <Badge size="xs" variant="warning">
                A Pagar
              </Badge>
            )}
          </div>

          <div className="space-y-0.5">
            <MoneyText
              cents={netBalanceCents}
              tone={isCreditor ? "positive" : isDebtor ? "negative" : "default"}
              variant="hero"
              className="font-bold tracking-tight"
            />
            <p className="text-[11px] text-muted-foreground">
              {isCreditor
                ? "Outros amigos devem reembolsar você"
                : isDebtor
                ? "Você precisa transferir para compensar sua cota"
                : "Todas as suas contas estão equilibradas"}
            </p>
          </div>

          {isDebtor && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onOpenSettlement}
              className="w-full gap-1.5 mt-1"
            >
              <Wallet className="size-3.5" aria-hidden="true" />
              <span>Quitar Minha Cota</span>
            </Button>
          )}
        </div>

        {/* Total Desembolsado do Bolso */}
        <div className="p-3.5 rounded-xl bg-surface-raised space-y-1 min-w-0">
          <span className="text-[11px] text-muted-foreground font-medium block">
            Desembolsado do Seu Bolso
          </span>
          <div className="pt-0.5">
            <MoneyText
              cents={totalPaidCents}
              tone="default"
              className="text-base sm:text-lg font-bold"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Valor integral passado em suas contas ou cartões
          </p>
        </div>

        {/* Cota Real Consumida */}
        <div className="p-3.5 rounded-xl bg-surface-raised space-y-1 min-w-0">
          <span className="text-[11px] text-muted-foreground font-medium block">
            Sua Cota Real Consumida
          </span>
          <div className="pt-0.5">
            <MoneyText
              cents={totalShareCents}
              tone="default"
              className="text-base sm:text-lg font-bold"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sua participação efetiva nas despesas rateadas
          </p>
        </div>
      </div>
    </Card>
  );
}
