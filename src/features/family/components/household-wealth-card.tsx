import { useMemo } from "react";
import { Landmark, PiggyBank, ShieldCheck, SlidersHorizontal, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { calculateFamilyEmergencyReserveHealth } from "@/domain/family";
import { cn } from "@/lib/utils";
import type { FamilyPortfolioSummary } from "@/types";

export interface HouseholdWealthCardProps {
  portfolioSummary: FamilyPortfolioSummary | null | undefined;
  monthlyCeilingCents?: number;
  monthlyExpensesCents?: number;
  onOpenManageAssets: () => void;
  className?: string;
}

/**
 * Card de Patrimônio & Reserva de Emergência Familiar.
 * Exibe a saúde da reserva conjunta da casa calculada prioritariamente contra
 * o teto mensal estipulado pela família (com meta de 6 meses de segurança),
 * total de investimentos compartilhados e proventos estimados, com ação para gerenciar ativos.
 *
 * Em conformidade estrita com:
 *  - AGENTS.md §4: Design tokens, MoneyText, zero emojis, ícones padronizados (Nível 1 sem caixas decorativas).
 *  - FINANCIAL_MATH_SPEC.md: Moeda tratada em centavos inteiros.
 */
export function HouseholdWealthCard({
  portfolioSummary,
  monthlyCeilingCents = 0,
  monthlyExpensesCents = 0,
  onOpenManageAssets,
  className,
}: HouseholdWealthCardProps) {
  const totalCashCents = portfolioSummary?.total_cash_cents ?? 0;
  const totalInvestedCents = portfolioSummary?.total_invested_cents ?? 0;
  const dividends12mCents = portfolioSummary?.dividends_12m_cents ?? 0;
  const assetsCount = portfolioSummary?.assets_count ?? 0;

  const isCeiling = monthlyCeilingCents > 0;
  const effectiveReferenceCents = isCeiling ? monthlyCeilingCents : monthlyExpensesCents;

  // Avaliação da reserva de emergência conjunta da casa (com base no teto familiar)
  const reserveHealth = useMemo(() => {
    return calculateFamilyEmergencyReserveHealth(totalCashCents, effectiveReferenceCents, {
      isCeiling,
      targetMonths: 6,
    });
  }, [totalCashCents, effectiveReferenceCents, isCeiling]);

  const reserveBadgeVariant =
    reserveHealth.status === "excellent" || reserveHealth.status === "solid"
      ? "positive"
      : reserveHealth.status === "moderate"
        ? "warning"
        : "critical";

  const hasDividends = dividends12mCents > 0;

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Patrimônio & Reserva Familiar</span>
        </CardTitle>

        <div className="flex items-center gap-2">
          <Badge variant={reserveBadgeVariant} size="sm">
            {reserveHealth.months_covered > 0
              ? `${reserveHealth.months_covered} ${reserveHealth.months_covered === 1 ? "mês" : "meses"} de reserva`
              : "Sem reserva cadastrada"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenManageAssets}
            className="gap-1.5 rounded-xl cursor-pointer h-7 text-xs px-2.5"
            aria-label="Gerenciar meus investimentos compartilhados com a família"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Gerenciar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Grid de Métricas Patrimoniais (Mobile-First) */}
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            hasDividends ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {/* Reserva de Emergência Conjunta */}
          <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Reserva da Casa</span>
            </span>
            <div className="text-base font-bold tracking-tight text-foreground">
              <MoneyText cents={totalCashCents} />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {isCeiling ? (
                <>
                  {reserveHealth.months_covered}m do teto (<MoneyText cents={monthlyCeilingCents} />/mês)
                </>
              ) : (
                reserveHealth.label
              )}
            </span>
          </div>

          {/* Total Investido Familiar */}
          <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-portfolio shrink-0" aria-hidden="true" />
              <span>Patrimônio Total Compartilhado</span>
            </span>
            <div className="text-base font-bold tracking-tight text-foreground">
              <MoneyText cents={totalInvestedCents} />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {assetsCount} {assetsCount === 1 ? "ativo compartilhado" : "ativos compartilhados"}
              {!hasDividends && " · Sem proventos 12m"}
            </span>
          </div>

          {/* Proventos Anuais (exibido apenas se > 0) */}
          {hasDividends && (
            <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <PiggyBank className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
                <span>Proventos 12m</span>
              </span>
              <div className="text-base font-bold tracking-tight text-foreground">
                <MoneyText cents={dividends12mCents} />
              </div>
              <span className="text-[10px] text-muted-foreground block">
                Renda passiva conjunta
              </span>
            </div>
          )}
        </div>

        {/* Régua de Meta da Reserva Familiar (6 Meses do Teto) */}
        {isCeiling && reserveHealth.target_cents ? (
          <div className="p-3.5 rounded-xl bg-surface-subtle/40 border border-border/60 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Target className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>Meta de Segurança (6 meses do teto)</span>
              </span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {reserveHealth.progress_percent}% concluído · Alvo:{" "}
                <MoneyText cents={reserveHealth.target_cents} />
              </span>
            </div>

            {/* Barra de Progresso Customizada (Role progressbar) */}
            <div
              className="h-2 w-full bg-border/40 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={reserveHealth.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso da meta de reserva familiar de 6 meses"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  reserveHealth.status === "excellent" || reserveHealth.status === "solid"
                    ? "bg-positive"
                    : reserveHealth.status === "moderate"
                      ? "bg-warning"
                      : "bg-critical",
                )}
                style={{ width: `${Math.min(100, reserveHealth.progress_percent ?? 0)}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground pt-0.5">
              <span>
                {reserveHealth.remaining_cents && reserveHealth.remaining_cents > 0 ? (
                  <>
                    Faltam <MoneyText cents={reserveHealth.remaining_cents} /> para cobrir 6 meses de contas da casa.
                  </>
                ) : (
                  "Meta de segurança de 6 meses alcançada pela família!"
                )}
              </span>
              <span className="font-medium text-foreground">
                {reserveHealth.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-surface-subtle/30 border border-border/50 text-[11px] text-muted-foreground">
            Defina o teto mensal de gastos da família nas configurações para acompanhar a meta automática de 6 meses de reserva.
          </div>
        )}

        {/* Rodapé explicativo com contexto e privacidade */}
        <p className="text-[11px] text-muted-foreground pt-0.5">
          Os investimentos e caixas exibidos são compostos exclusivamente pelos ativos que você e os membros da casa escolheram compartilhar como patrimônio familiar. Seus outros investimentos particulares permanecem 100% privados.
        </p>
      </CardContent>
    </Card>
  );
}
