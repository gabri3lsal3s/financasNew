import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  Check,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  TrendingDown,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

export interface SmartAdvisorCardProps {
  className?: string;
  /**
   * Insight específico a ser renderizado (modo controlado para testes ou composição).
   * Se omitido, o componente consome diretamente do hook useSmartAdvisorInsights().
   */
  insight?: SmartAdvisorInsight | null;
  /**
   * Callback ao dispensar o card.
   */
  onDismiss?: (themeKey?: string, days?: number) => void;
  /**
   * Callback ao confirmar uma recorrência na calibração.
   */
  onConfirmRecurrence?: (occurrenceKey: string) => void | Promise<void>;
  /**
   * Callback ao ignorar uma despesa na calibração.
   */
  onIgnoreRecurrence?: (occurrenceKey: string) => void | Promise<void>;
  /**
   * Callback ao confirmar entrada de renda em 1 clique.
   */
  onConfirmIncome?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => void | Promise<void>;
}

/**
 * Microcard do Assistente Proativo de Insights na Home (SmartAdvisor).
 *
 * Apresenta recomendações contextuais de alta prioridade, confirmação de rendas
 * habituais em 1 clique e perguntas de aprendizado ativo para calibrar o motor.
 * Respeita a regra de discrição (100% oculto se o mês estiver regular ou se dispensado).
 */
export function SmartAdvisorCard({
  className,
  insight: controlledInsight,
  onDismiss,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onConfirmIncome,
}: SmartAdvisorCardProps) {
  const navigate = useNavigate();

  // Hook interno (utilizado se não houver insight controlado injetado)
  const hook = useSmartAdvisorInsights({
    enabled: controlledInsight === undefined,
  });

  const activeInsight = controlledInsight !== undefined ? controlledInsight : hook.insight;
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeInsight) {
    return null;
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(activeInsight.themeKey);
    } else {
      hook.dismiss(activeInsight.themeKey);
    }
  };

  const handleConfirmIncome = async () => {
    const payload = activeInsight.primaryAction?.payload as
      | {
          name: string;
          valueCents: number;
          categoryId: string;
          date?: string;
        }
      | undefined;

    if (!payload) return;

    try {
      setIsSubmitting(true);
      if (onConfirmIncome) {
        await onConfirmIncome(payload);
      } else {
        await hook.confirmIncome(payload);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecurrence = async () => {
    const payload = activeInsight.primaryAction?.payload as { key?: string } | undefined;
    const occurrenceKey =
      payload?.key ?? activeInsight.themeKey.replace(/^calib:/, "");

    try {
      setIsSubmitting(true);
      if (onConfirmRecurrence) {
        await onConfirmRecurrence(occurrenceKey);
      } else {
        await hook.confirmRecurrence(occurrenceKey);
        hook.dismiss(activeInsight.themeKey);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIgnoreRecurrence = async () => {
    const payload = activeInsight.secondaryAction?.payload as { key?: string } | undefined;
    const occurrenceKey =
      payload?.key ?? activeInsight.themeKey.replace(/^calib:/, "");

    try {
      setIsSubmitting(true);
      if (onIgnoreRecurrence) {
        await onIgnoreRecurrence(occurrenceKey);
      } else {
        await hook.ignoreRecurrence(occurrenceKey);
        hook.dismiss(activeInsight.themeKey);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = () => {
    if (activeInsight.category === "savings" || activeInsight.primaryAction?.kind === "cut_subscription") {
      navigate?.("/insights?aba=recurrences");
      return;
    }

    if (activeInsight.category === "critical") {
      if (activeInsight.id.startsWith("dup:")) {
        navigate?.("/insights?aba=recurrences");
      } else {
        navigate?.("/transactions");
      }
      return;
    }

    if (activeInsight.category === "income" && activeInsight.primaryAction?.kind === "open_income") {
      navigate?.("/transactions?tipo=receita");
      return;
    }
  };

  // Ícones e badges de acordo com a categoria canônica
  const { categoryIcon, categoryBadgeVariant, categoryBadgeLabel } = (() => {
    switch (activeInsight.category) {
      case "critical":
        return {
          categoryIcon: <AlertTriangle className="size-4 text-critical-strong shrink-0" aria-hidden="true" />,
          categoryBadgeVariant: "critical" as const,
          categoryBadgeLabel: "Atenção",
        };
      case "income":
        return {
          categoryIcon: <ArrowDownLeft className="size-4 text-positive-strong shrink-0" aria-hidden="true" />,
          categoryBadgeVariant: "positive" as const,
          categoryBadgeLabel: "Entrada Prevista",
        };
      case "savings":
        return {
          categoryIcon: <TrendingDown className="size-4 text-warning-strong shrink-0" aria-hidden="true" />,
          categoryBadgeVariant: "warning" as const,
          categoryBadgeLabel: "Economia",
        };
      case "calibration":
      default:
        return {
          categoryIcon: <HelpCircle className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />,
          categoryBadgeVariant: "muted" as const,
          categoryBadgeLabel: "Calibração",
        };
    }
  })();

  return (
    <div
      role="region"
      aria-label="Assistente Proativo de Insights"
      className={cn(
        "w-full flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all",
        className,
      )}
    >
      {/* Cabeçalho adaptativo (Regra 12) */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="shrink-0 flex items-center justify-center" aria-hidden="true">
            {categoryIcon}
          </span>
          <Badge variant={categoryBadgeVariant} size="xs" className="shrink-0">
            {categoryBadgeLabel}
          </Badge>
          <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
            {activeInsight.title}
          </h3>
        </div>

        {/* Botão sutil de dispensar por 30 dias */}
        <Button
          variant="ghost"
          size="sm"
          sensoryIntent="action"
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 shrink-0 self-end sm:self-auto gap-1"
        >
          <X className="size-3.5" aria-hidden="true" />
          <span>Dispensar por 30 dias</span>
        </Button>
      </div>

      {/* Descrição contextual */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {activeInsight.description}
      </p>

      {/* Ações contextuais de 1 toque */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {activeInsight.category === "calibration" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              sensoryIntent="success"
              onClick={() => void handleConfirmRecurrence()}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Sim, monitorar</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              sensoryIntent="action"
              onClick={() => void handleIgnoreRecurrence()}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Não, foi pontual</span>
            </Button>
          </>
        ) : activeInsight.category === "income" && activeInsight.primaryAction?.kind === "confirm_income" ? (
          <Button
            size="sm"
            sensoryIntent="success"
            onClick={() => void handleConfirmIncome()}
            disabled={isSubmitting}
            className="gap-1.5 text-xs h-8"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{activeInsight.primaryAction.label}</span>
          </Button>
        ) : activeInsight.primaryAction ? (
          <Button
            size="sm"
            variant="outline"
            sensoryIntent="selection"
            onClick={handleActionClick}
            disabled={isSubmitting}
            className="gap-1.5 text-xs h-8"
          >
            <span>{activeInsight.primaryAction.label}</span>
            {activeInsight.primaryAction.kind === "open_income" ? (
              <ExternalLink className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
