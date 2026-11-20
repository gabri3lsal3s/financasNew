import { useMemo } from "react";
import { Landmark, PiggyBank, ShieldCheck, SlidersHorizontal, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { KpiCard, KpiGrid } from "@/components/modules";
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
 * Hub de Patrimônio & Reserva de Emergência Familiar.
 * Estrutura padronizada com o restante do aplicativo:
 * - KPIs executivos em KpiCards brancos padrão (Reserva e Patrimônio Compartilhado)
 * - Card canônico para a Meta de Segurança (6 meses)
 * - Card canônico com lista em divide-y para os ativos compartilhados
 * - Cláusula e notas de privacidade limpas
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
  const otherInvestedCents = Math.max(0, totalInvestedCents - totalCashCents);

  const isCeiling = monthlyCeilingCents > 0;
  const effectiveReferenceCents = isCeiling ? monthlyCeilingCents : monthlyExpensesCents;

  const reserveHealth = useMemo(() => {
    return calculateFamilyEmergencyReserveHealth(totalCashCents, effectiveReferenceCents, {
      isCeiling,
      targetMonths: 6,
    });
  }, [totalCashCents, effectiveReferenceCents, isCeiling]);

  const statusTone =
    reserveHealth.status === "excellent" || reserveHealth.status === "solid"
      ? "positive"
      : reserveHealth.status === "moderate"
        ? "warning"
        : "critical";

  const hasDividends = dividends12mCents > 0;

  return (
    <div className={cn("flex flex-col gap-5 sm:gap-6 min-w-0", className)}>
      {/* Barra de Título da Seção e Ação */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Patrimônio &amp; Reserva Familiar</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusTone} size="sm">
            {reserveHealth.months_covered > 0
              ? `${reserveHealth.months_covered} ${reserveHealth.months_covered === 1 ? "mês" : "meses"} de reserva`
              : "Sem reserva cadastrada"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenManageAssets}
            className="gap-1.5"
            aria-label="Gerenciar meus investimentos compartilhados com a família"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Gerenciar</span>
          </Button>
        </div>
      </div>

      {/* Grid de KPIs Patrimoniais (Cards brancos padronizados do app, sem caixas cinzas aninhadas!) */}
      <KpiGrid columns={hasDividends ? 3 : 2}>
        <KpiCard
          label="Reserva da Casa"
          cents={totalCashCents}
          tone="default"
          icon={<ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />}
          hint={
            <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-x-1">
                {isCeiling ? (
                  <>
                    <span>{reserveHealth.months_covered}m do teto</span>
                    <span>
                      (<MoneyText cents={monthlyCeilingCents} tone="default" variant="caption" />/mês)
                    </span>
                  </>
                ) : (
                  <span>{reserveHealth.label}</span>
                )}
              </div>
              <span>Liquidez imediata (Caixa, Selic e CDI)</span>
            </div>
          }
        />

        <KpiCard
          label="Patrimônio Total Compartilhado"
          cents={totalInvestedCents}
          tone="default"
          icon={<TrendingUp className="size-4 text-portfolio" aria-hidden="true" />}
          hint={
            <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5">
              <span>
                {assetsCount} {assetsCount === 1 ? "ativo compartilhado" : "ativos compartilhados"}
                {!hasDividends && " · Sem proventos 12m"}
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {otherInvestedCents > 0 ? (
                  <>
                    <span>Reserva +</span>
                    <MoneyText cents={otherInvestedCents} tone="default" variant="caption" className="font-medium" />
                    <span>em outros ativos</span>
                  </>
                ) : (
                  <span>100% alocado na reserva da casa</span>
                )}
              </div>
            </div>
          }
        />

        {hasDividends && (
          <KpiCard
            label="Proventos 12m"
            cents={dividends12mCents}
            tone="default"
            icon={<PiggyBank className="size-4 text-warning-strong" aria-hidden="true" />}
            hint={<span className="text-[11px] text-muted-foreground">Renda passiva conjunta</span>}
          />
        )}
      </KpiGrid>

      {/* Seção de Meta de Segurança e Ativos Compartilhados (Largura Total 100%, sem desequilíbrios de altura) */}
      <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
        {/* Card Canônico da Meta de Segurança (6 meses do teto) */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Target className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Meta de Segurança (6 meses do teto)</span>
            </CardTitle>
            {isCeiling && reserveHealth.target_cents ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {reserveHealth.progress_percent}% concluído · Alvo:{" "}
                <MoneyText cents={reserveHealth.target_cents} tone="default" variant="caption" />
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {isCeiling && reserveHealth.target_cents ? (
              <>
                <Progress
                  value={reserveHealth.progress_percent ?? 0}
                  tone={statusTone}
                  size="md"
                  aria-label="Progresso da meta de reserva familiar de 6 meses"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground pt-0.5">
                  <span>
                    {reserveHealth.remaining_cents && reserveHealth.remaining_cents > 0 ? (
                      <>
                        Faltam <MoneyText cents={reserveHealth.remaining_cents} tone="default" variant="caption" /> para cobrir 6 meses de contas da casa.
                      </>
                    ) : (
                      "Meta de segurança de 6 meses alcançada pela família!"
                    )}
                  </span>
                  <span className="font-medium text-foreground">{reserveHealth.label}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Defina o teto mensal de gastos da família nas configurações para acompanhar a meta automática de 6 meses de reserva.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card Canônico de Ativos Compartilhados pela Casa (Lista em divide-y, sem caixas cinzas!) */}
        {portfolioSummary?.assets && portfolioSummary.assets.length > 0 ? (
          <Card className="border-border/80 bg-surface shadow-xs rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Ativos Compartilhados pela Casa
              </CardTitle>
              <Badge variant="muted" size="xs">
                {portfolioSummary.assets.length}{" "}
                {portfolioSummary.assets.length === 1 ? "ativo" : "ativos"}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border/80">
                {portfolioSummary.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">{asset.ticker}</span>
                      <Badge variant="muted" size="xs" className="uppercase font-mono text-[10px]">
                        {asset.asset_class}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        · Titular: {asset.owner_name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <MoneyText cents={asset.total_value_cents} tone="default" className="font-semibold text-sm" />
                      <span className="text-[11px] text-muted-foreground block sm:hidden">
                        Titular: {asset.owner_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Disclaimer de Privacidade */}
      <div className="space-y-1 text-center sm:text-left pt-1">
        <p className="text-[11px] text-muted-foreground">
          Os valores refletem o saldo atualizado a mercado (com rendimentos acumulados) dos ativos que você e os membros da casa escolheram compartilhar.
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          Seus outros investimentos particulares e contas bancárias pessoais permanecem 100% privados.
        </p>
      </div>
    </div>
  );
}
