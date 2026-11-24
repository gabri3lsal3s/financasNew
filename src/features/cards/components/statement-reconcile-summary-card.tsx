import {
  AlertCircle,
  BookCheck,
  CheckCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type { StatementQualityGateResult } from "@/domain/reconciliation";
import type { StatementExtractionOrigin } from "./statement-import-helpers";

export interface StatementReconcileSummaryCardProps {
  totalReadCents: number;
  totalAppCents: number;
  selectedNewCount: number;
  selectedNewCents: number;
  officialInvoiceTotalCents: number | null;
  usedAiStructurer?: boolean;
  extractionOrigin?: StatementExtractionOrigin | null;
  qualityGate?: StatementQualityGateResult | null;
  onReanalyzeWithAi?: () => void;
  isReanalyzingWithAi?: boolean;
}

/**
 * Card de Sumário Financeiro Adaptativo (Etapa 3 / v3.2):
 * Apresenta métricas adaptativas de Total Lido, Já no App e Novos Selecionados,
 * integrando a validação contra o total impresso oficial da fatura quando disponível,
 * transparência de origem da leitura e botão direto de reanálise por IA em divergências.
 */
export function StatementReconcileSummaryCard({
  totalReadCents,
  totalAppCents,
  selectedNewCount,
  selectedNewCents,
  officialInvoiceTotalCents,
  usedAiStructurer = false,
  extractionOrigin = null,
  qualityGate = null,
  onReanalyzeWithAi,
  isReanalyzingWithAi = false,
}: StatementReconcileSummaryCardProps) {
  const hasOfficialTotal = officialInvoiceTotalCents !== null;
  const diffCents = hasOfficialTotal ? totalReadCents - officialInvoiceTotalCents : 0;
  const isConferred = hasOfficialTotal && Math.abs(diffCents) <= 5;

  const isAiStructured =
    extractionOrigin === "ai_text" ||
    extractionOrigin === "ai_vision" ||
    usedAiStructurer;
  const isLearnedBlueprint =
    !isAiStructured && extractionOrigin === "local_learned_blueprint";
  const isLocalVerified =
    !isAiStructured && extractionOrigin === "local_verified";
  const hasDiscrepancy =
    (hasOfficialTotal && !isConferred) ||
    (qualityGate !== null && !qualityGate.passed);

  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground tracking-tight">
            Conferência da Fatura
          </span>
          {isAiStructured ? (
            <Badge variant="default" size="xs">
              <Sparkles className="size-3" aria-hidden="true" />
              Estruturado com IA
            </Badge>
          ) : isLearnedBlueprint ? (
            <Badge variant="positive" size="xs">
              <BookCheck className="size-3" aria-hidden="true" />
              Leitura local (Layout aprendido)
            </Badge>
          ) : isLocalVerified ? (
            <Badge variant="muted" size="xs">
              <ShieldCheck className="size-3" aria-hidden="true" />
              Leitura local conferida
            </Badge>
          ) : null}
          {hasOfficialTotal ? (
            <Badge variant={isConferred ? "positive" : "warning"} size="xs">
              {isConferred ? (
                <>
                  <CheckCheck className="size-3" aria-hidden="true" />
                  Soma conferida
                </>
              ) : (
                <>
                  <AlertCircle className="size-3" aria-hidden="true" />
                  Diferença: {diffCents > 0 ? "+" : ""}
                  {(diffCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </>
              )}
            </Badge>
          ) : null}
        </div>

        {onReanalyzeWithAi && hasDiscrepancy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReanalyzingWithAi}
            onClick={onReanalyzeWithAi}
            className="h-7 gap-1.5 text-xs self-start sm:self-center shrink-0 cursor-pointer"
          >
            {isReanalyzingWithAi ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Reanalisando...
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reanalisar com IA
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
        <div className="space-y-0.5">
          <span className="text-[11px] text-muted-foreground block">Total Lido</span>
          <MoneyText cents={totalReadCents} tone="default" className="font-semibold text-sm tabular-nums" />
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-muted-foreground block">Já no App</span>
          <MoneyText cents={totalAppCents} tone="default" className="font-medium text-sm tabular-nums text-muted-foreground" />
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-muted-foreground block">
            Novos ({selectedNewCount})
          </span>
          <MoneyText cents={selectedNewCents} tone="positive" className="font-semibold text-sm tabular-nums" />
        </div>

        {hasOfficialTotal ? (
          <div className="space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-muted-foreground block">Fatura Oficial</span>
            <MoneyText cents={officialInvoiceTotalCents} tone="default" className="font-semibold text-sm tabular-nums" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
