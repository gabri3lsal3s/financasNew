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
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
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
              variant={isFilterActive ? "default" : "outline"}
              onClick={onToggleFilterMyExpenses}
              className="h-8 text-xs gap-1.5"
            >
              <Filter className="size-3" aria-hidden="true" />
              <span>{isFilterActive ? "Mostrando Meus Gastos" : "Ver Meus Gastos"}</span>
            </Button>
          )}

          {onOpenStatement && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenStatement}
              className="h-8 text-xs gap-1.5"
            >
              <FileText className="size-3" aria-hidden="true" />
              <span>Meu Extrato</span>
            </Button>
          )}

          {!isHost && onLeaveTrip && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onLeaveTrip}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-critical hover:border-critical/30 cursor-pointer"
              title="Desvincular sua conta e sair desta viagem"
            >
              <LogOut className="size-3" aria-hidden="true" />
              <span>Sair da Viagem</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid de Balanço Pessoal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/80">
        {/* Card de Saldo Líquido */}
        <div className="p-3.5 rounded-xl bg-surface-raised border border-border/80 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-medium">
              Seu Saldo Líquido
            </span>
            {isSettled ? (
              <Badge size="xs" variant="muted" className="gap-1">
                <ShieldCheck className="size-3 text-positive" aria-hidden="true" />
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

          <div>
            <MoneyText
              cents={netBalanceCents}
              tone={isCreditor ? "positive" : isDebtor ? "negative" : "default"}
              variant="hero"
              className="font-bold tracking-tight"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
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
              className="w-full h-7 text-xs gap-1 mt-1"
            >
              <Wallet className="size-3" aria-hidden="true" />
              Quitar Minha Cota
            </Button>
          )}
        </div>

        {/* Total Desembolsado do Bolso */}
        <div className="p-3.5 rounded-xl bg-surface-raised border border-border/80 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            Desembolsado do Seu Bolso
          </span>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
            <MoneyText cents={totalPaidCents} variant="value" />
          </p>
          <p className="text-[10px] text-muted-foreground">
            Valor integral passado em suas contas ou cartões
          </p>
        </div>

        {/* Cota Real Consumida */}
        <div className="p-3.5 rounded-xl bg-surface-raised border border-border/80 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            Sua Cota Real Consumida
          </span>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
            <MoneyText cents={totalShareCents} variant="value" />
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sua participação efetiva nas despesas rateadas
          </p>
        </div>
      </div>
    </Card>
  );
}
