import { AlertCircle, CheckCheck } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type { ReconciliationPlan, StatementQualityGateResult } from "@/domain/reconciliation";
import type { ReconcileCanonicalTab } from "./statement-import-types";

export interface StatementSummaryHeaderProps {
  totalReadCents: number;
  totalAppCents: number;
  printedTotalCents: number | null;
  qualityGate: StatementQualityGateResult | null;
  plan: ReconciliationPlan;
  activeTab: ReconcileCanonicalTab;
  canAdjustColumns?: boolean;
  onOpenMapping?: () => void;
  onChangeFile: () => void;
  onReviewAttention: () => void;
}

function buildPlanSummaryParts(plan: ReconciliationPlan): string[] {
  const parts: string[] = [];
  if (plan.newExpensesToCreate.length > 0) {
    parts.push(
      `importar ${plan.newExpensesToCreate.length} ${
        plan.newExpensesToCreate.length === 1 ? "compra" : "compras"
      }`,
    );
  }
  if (plan.futureInstallmentsToProject.length > 0) {
    parts.push(
      `projetar ${plan.futureInstallmentsToProject.length} ${
        plan.futureInstallmentsToProject.length === 1 ? "parcela futura" : "parcelas futuras"
      }`,
    );
  }
  if (plan.refundsToRegister.length > 0) {
    parts.push(
      `registrar ${plan.refundsToRegister.length} ${
        plan.refundsToRegister.length === 1 ? "estorno" : "estornos"
      }`,
    );
  }
  const adjCount = plan.microAdjustmentsToApply.length + plan.manualLinkAdjustments.length;
  if (adjCount > 0) {
    parts.push(`ajustar ${adjCount} ${adjCount === 1 ? "valor" : "valores"}`);
  }
  if (plan.competenceMovesToApply.length > 0) {
    parts.push(
      `mover ${plan.competenceMovesToApply.length} ${
        plan.competenceMovesToApply.length === 1 ? "compra de mês" : "compras de mês"
      }`,
    );
  }
  if (plan.expenseIdsToDelete.length > 0) {
    parts.push(
      `excluir ${plan.expenseIdsToDelete.length} ${
        plan.expenseIdsToDelete.length === 1 ? "item marcado" : "itens marcados"
      }`,
    );
  }
  return parts;
}

function joinPortugueseParts(parts: readonly string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/**
 * Card único de diagnóstico financeiro (Inteligência Invisível: sem selos técnicos ou reanálise IA).
 */
export function StatementSummaryHeader({
  totalReadCents,
  totalAppCents,
  printedTotalCents,
  qualityGate,
  plan,
  activeTab,
  canAdjustColumns = false,
  onOpenMapping,
  onChangeFile,
  onReviewAttention,
}: StatementSummaryHeaderProps) {
  const effectiveTarget = qualityGate?.effectiveTargetCents ?? printedTotalCents;
  const hasOfficialTarget = effectiveTarget !== null && effectiveTarget > 0;
  const cycleReadCents = qualityGate?.cycleNetCents ?? totalReadCents;
  const diffCents = hasOfficialTarget
    ? (qualityGate?.diffCents ?? Math.abs(cycleReadCents - effectiveTarget))
    : 0;
  const isConferred = hasOfficialTarget && diffCents <= 5;
  const plannedNewCents = plan.newExpensesToCreate.reduce(
    (sum, item) => sum + item.item.transaction.amountCents,
    0,
  );
  const summaryParts = buildPlanSummaryParts(plan);

  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/80 pb-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
            Conferência da fatura
          </h3>
          {hasOfficialTarget ? (
            <Badge variant={isConferred ? "positive" : "warning"} size="xs">
              {isConferred ? (
                <>
                  <CheckCheck className="size-3" aria-hidden="true" />
                  Soma conferida
                </>
              ) : (
                <>
                  <AlertCircle className="size-3" aria-hidden="true" />
                  <span>Diferença de </span>
                  <MoneyText cents={Math.abs(diffCents)} variant="caption" tone="default" sign="none" />
                </>
              )}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canAdjustColumns && onOpenMapping ? (
            <Button type="button" variant="ghost" size="xs" onClick={onOpenMapping}>
              Ajustar colunas
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="xs" onClick={onChangeFile}>
            Trocar arquivo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="space-y-0.5 min-w-0">
          <span className="text-[11px] text-muted-foreground block">Fatura lida</span>
          <MoneyText
            cents={totalReadCents}
            variant="value"
            tone="default"
            className="text-base sm:text-lg"
          />
        </div>

        <div className="space-y-0.5 min-w-0">
          <span className="text-[11px] text-muted-foreground block">
            A importar ({plan.newExpensesToCreate.length})
          </span>
          <MoneyText
            cents={plannedNewCents}
            variant="value"
            tone="positive"
            className="text-base sm:text-lg"
          />
        </div>

        <div className="space-y-0.5 col-span-2 sm:col-span-1 min-w-0">
          <span className="text-[11px] text-muted-foreground block">
            {hasOfficialTarget ? "Total oficial" : "Já no app"}
          </span>
          <MoneyText
            cents={hasOfficialTarget ? effectiveTarget : totalAppCents}
            variant="value"
            tone="default"
            className="text-base sm:text-lg"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/80">
        {plan.blockedByRollover
          ? "Fatura já rolada para outra competência — leitura somente para consulta."
          : summaryParts.length > 0
            ? `Pronto para ${joinPortugueseParts(summaryParts)}.`
            : "Todos os lançamentos principais desta fatura já estão conciliados no aplicativo."}
        {plan.pendingOptInCount > 0 && activeTab !== "attention" ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={onReviewAttention}
              className="font-medium text-warning-strong underline underline-offset-2 hover:opacity-80 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              {plan.pendingOptInCount}{" "}
              {plan.pendingOptInCount === 1
                ? "item em Atenção não incluído"
                : "itens em Atenção não incluídos"}{" "}
              — Revisar
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
