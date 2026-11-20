import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  PiggyBank,
  Scale,
  Target,
  User,
  Wallet,
} from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { reconcileHouseholdSpending } from "@/domain/family";
import type { FamilyConsolidationResult } from "@/types";

export interface HouseholdKpisGridProps {
  consolidation: FamilyConsolidationResult;
  currentUserId?: string;
  onOpenSettlement?: () => void;
  className?: string;
}

/**
 * Grid Canônico de 4 KPIs no topo da Visão do Mês da Família.
 * Apresenta:
 * 1. Teto da Casa (realizado vs limite)
 * 2. Disponível no Mês (ou Sobra Líquida no caixa unificado)
 * 3. Sua Participação (gasto pelo usuário logado)
 * 4. Status de Acerto / Compensação (ou Taxa de Poupança no caixa unificado)
 */
export function HouseholdKpisGrid({
  consolidation,
  currentUserId,
  onOpenSettlement,
  className,
}: HouseholdKpisGridProps) {
  const isCombinedMode = consolidation.family.split_rule === "combined";
  const totalSpentCents = consolidation.total_spent_cents;
  const monthlyCeilingCents = consolidation.monthly_ceiling_cents;
  const hasCeiling = monthlyCeilingCents > 0;
  const isOverCeiling = hasCeiling && totalSpentCents > monthlyCeilingCents;
  const remainingCents = consolidation.remaining_cents;
  const spentPercentage = Math.round(consolidation.spent_percentage);

  // Participante atual
  const currentMember = useMemo(() => {
    if (currentUserId) {
      return consolidation.members.find((m) => m.user_id === currentUserId);
    }
    return consolidation.members.find((m) => m.role === "owner") ?? consolidation.members[0];
  }, [consolidation.members, currentUserId]);

  const currentSpentCents = currentMember?.spent_cents ?? 0;
  const currentPercent = currentMember?.percentage_of_total ?? 0;

  // Reconciliação para apurar status líquido
  const reconciliation = useMemo(() => {
    if (isCombinedMode) return null;
    return reconcileHouseholdSpending({
      monthly_ceiling_cents: consolidation.monthly_ceiling_cents,
      members: consolidation.members.map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        role: m.role,
        split_ratio: m.split_ratio,
        pix_key: m.pix_key,
        pix_key_type: m.pix_key_type,
      })),
      expenses: consolidation.expenses.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        amount_cents: e.amount_cents,
        date: e.date,
        description: e.description,
        category_id: e.category_id,
        category_name: e.category_name,
        category_icon: e.category_icon,
        category_color: e.category_color,
        created_at: e.created_at,
        is_family: true,
      })),
      options: {
        month: consolidation.month,
        splitRule: consolidation.family.split_rule,
      },
    });
  }, [consolidation, isCombinedMode]);

  const currentReconMember = useMemo(() => {
    if (!reconciliation || !currentMember) return null;
    return reconciliation.members.find((m) => m.user_id === currentMember.user_id);
  }, [reconciliation, currentMember]);

  // Cálculos de Caixa Unificado
  const totalIncomeCents = consolidation.total_income_cents;
  const netCents = totalIncomeCents - totalSpentCents;
  const isPositiveNet = netCents >= 0;
  const savingsRate =
    totalIncomeCents > 0
      ? Math.max(0, Math.round((netCents / totalIncomeCents) * 100))
      : 0;

  return (
    <KpiGrid columns={4} className={className} data-tour="family-kpis-grid">
      {/* KPI 1: Teto Mensal */}
      <KpiCard
        label="Teto Mensal"
        cents={totalSpentCents}
        tone={isOverCeiling ? "negative" : spentPercentage >= 85 ? "negative" : "default"}
        icon={<Target className="size-4" aria-hidden="true" />}
        hint={
          hasCeiling ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-[11px] text-muted-foreground">
              <span>{spentPercentage}% consumido</span>
              <span aria-hidden="true">·</span>
              <span>
                Teto: <MoneyText cents={monthlyCeilingCents} tone="default" variant="caption" />
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Sem teto definido</span>
          )
        }
      />

      {/* KPI 2: Disponível no Mês / Sobra Líquida */}
      {isCombinedMode ? (
        <KpiCard
          label={isPositiveNet ? "Sobra Líquida" : "Déficit do Mês"}
          cents={Math.abs(netCents)}
          tone={isPositiveNet ? "positive" : "negative"}
          icon={<Wallet className="size-4" aria-hidden="true" />}
          hint={
            <span className="text-[11px] text-muted-foreground">
              {isPositiveNet ? "Disponível para aportes" : "Gastos superaram receitas"}
            </span>
          }
        />
      ) : (
        <KpiCard
          label={isOverCeiling ? "Excedido no Teto" : "Disponível no Teto"}
          cents={Math.abs(remainingCents)}
          tone={isOverCeiling ? "negative" : "positive"}
          icon={<Wallet className="size-4" aria-hidden="true" />}
          hint={
            <span className="text-[11px] text-muted-foreground">
              {hasCeiling
                ? isOverCeiling
                  ? "Limite mensal estourado"
                  : "Restante para gastos da casa"
                : "Defina o teto nos ajustes"}
            </span>
          }
        />
      )}

      {/* KPI 3: Sua Participação */}
      <KpiCard
        label="Sua Participação"
        cents={currentSpentCents}
        tone="default"
        icon={<User className="size-4" aria-hidden="true" />}
        hint={
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {currentPercent}% do total pago da casa
          </span>
        }
      />

      {/* KPI 4: Status do Acerto / Poupança */}
      {isCombinedMode ? (
        <KpiCard
          label="Taxa de Poupança"
          value={`${savingsRate}%`}
          tone={savingsRate >= 20 ? "positive" : "default"}
          icon={<PiggyBank className="size-4" aria-hidden="true" />}
          hint={
            totalIncomeCents > 0 ? (
              <span className="tabular-nums text-[11px] text-muted-foreground">
                Receita conjunta: <MoneyText cents={totalIncomeCents} tone="default" variant="caption" />
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Receitas não lançadas</span>
            )
          }
        />
      ) : consolidation.is_settled && !consolidation.has_post_settlement_expenses ? (
        <KpiCard
          label="Status do Acerto"
          value="Em dia"
          tone="positive"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          hint={<span className="text-[11px] text-positive-strong">Acerto realizado no mês</span>}
          onClick={onOpenSettlement}
        />
      ) : currentReconMember?.is_creditor ? (
        <KpiCard
          label="Balanço do Acerto"
          cents={currentReconMember.net_balance_cents}
          tone="positive"
          icon={<ArrowDownLeft className="size-4 text-positive-strong" aria-hidden="true" />}
          hint={<span className="text-[11px] text-positive-strong">Você recebe na compensação</span>}
          onClick={onOpenSettlement}
        />
      ) : currentReconMember?.is_debtor ? (
        <KpiCard
          label="Balanço do Acerto"
          cents={Math.abs(currentReconMember.net_balance_cents)}
          tone="negative"
          icon={<ArrowUpRight className="size-4 text-negative-strong" aria-hidden="true" />}
          hint={<span className="text-[11px] text-negative-strong">Você acerta via Pix</span>}
          onClick={onOpenSettlement}
        />
      ) : (
        <KpiCard
          label="Status do Acerto"
          value="Equilibrado"
          tone="default"
          icon={<Scale className="size-4" aria-hidden="true" />}
          hint={<span className="text-[11px] text-muted-foreground">Contas da casa alinhadas</span>}
          onClick={onOpenSettlement}
        />
      )}
    </KpiGrid>
  );
}
