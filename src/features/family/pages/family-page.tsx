import { useState } from "react";
import { Link, Navigate } from "react-router";
import { AlertCircle, RotateCcw, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/modules/month-picker";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useFamilyMode, useMyFamily, useFamilyConsolidation } from "@/state";
import {
  HouseholdCeilingCard,
  HouseholdBalanceCard,
  HouseholdComparisonCard,
  HouseholdClusteringRanking,
  HouseholdExpenseFeed,
  FamilySettlementDialog,
} from "../components";

/**
 * Hub de Gestão e Orçamento Familiar (/familia).
 * Exibe a consolidação de gastos da casa, equilíbrio entre participantes,
 * fatias de consumo por categoria, extrato filtrável e liquidação via Pix.
 * Acesso condicional restrito a participantes de uma família ativa (§F1–F5).
 */
export function FamilyPage() {
  const { data: myFamilyData, isLoading: isFamilyLoading } = useMyFamily();
  const { isFamilyModeEnabled, isLoading: isModeLoading } = useFamilyMode();

  const [month, setMonth] = useState<string>(() => currentMonth());
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  const {
    data: consolidation,
    isLoading: isConsolidationLoading,
    error: consolidationError,
    refetch,
  } = useFamilyConsolidation(month);

  const isLoading = isFamilyLoading || isModeLoading;
  const isFamilyActive = Boolean(myFamilyData?.family || isFamilyModeEnabled);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" data-testid="family-page-skeleton">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-9 w-48 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isFamilyActive) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Users className="size-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Orçamento Familiar
            </h1>
            {myFamilyData?.family?.name ? (
              <Badge variant="default" size="sm" className="hidden sm:inline-flex">
                {myFamilyData.family.name}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <MonthPicker
              value={month}
              onValueChange={setMonth}
              aria-label="Selecionar mês da consolidação familiar"
            />
          </div>

          <Link
            to="/configuracoes?tab=familia"
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
            aria-label="Abrir configurações da família"
          >
            <Settings className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Tratamento de Erro de Consolidação */}
      {consolidationError ? (
        <div
          role="alert"
          className="p-6 rounded-2xl border border-critical/30 bg-critical/10 space-y-3 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-critical shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-critical-strong">
                Não foi possível carregar a consolidação familiar deste mês.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifique sua conexão e tente novamente.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 self-center sm:self-auto"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Tentar novamente</span>
          </Button>
        </div>
      ) : isConsolidationLoading ? (
        <div className="space-y-6 animate-pulse" aria-busy="true">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : consolidation ? (
        <>
          {/* Grid de Cards Analíticos Mobile-First */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <HouseholdCeilingCard
              monthlyCeilingCents={consolidation.monthly_ceiling_cents}
              totalSpentCents={consolidation.total_spent_cents}
              remainingCents={consolidation.remaining_cents}
              spentPercentage={consolidation.spent_percentage}
              totalIncomeCents={consolidation.total_income_cents}
            />

            <HouseholdBalanceCard
              members={consolidation.members}
              splitRule={consolidation.family.split_rule}
              isSettled={consolidation.is_settled}
              settlement={consolidation.settlement}
              hasPostSettlementExpenses={consolidation.has_post_settlement_expenses}
              onOpenSettlement={() => setIsSettlementOpen(true)}
            />

            <HouseholdComparisonCard
              members={consolidation.members}
              expenses={consolidation.expenses}
              monthlyCeilingCents={consolidation.monthly_ceiling_cents}
              splitRule={consolidation.family.split_rule}
              month={consolidation.month}
            />

            <HouseholdClusteringRanking expenses={consolidation.expenses} />
          </section>

          {/* Extrato Consolidado da Casa */}
          <section>
            <HouseholdExpenseFeed
              expenses={consolidation.expenses}
              currentUserId={myFamilyData?.currentMember?.user_id}
            />
          </section>

          {/* Diálogo de Acerto de Contas & Chave Pix */}
          <FamilySettlementDialog
            open={isSettlementOpen}
            onOpenChange={setIsSettlementOpen}
            consolidation={consolidation}
            currentUserId={myFamilyData?.currentMember?.user_id}
          />
        </>
      ) : null}
    </div>
  );
}
