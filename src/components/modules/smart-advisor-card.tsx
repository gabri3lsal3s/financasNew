import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { currentMonth } from "@/lib/date";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

export interface SmartAdvisorCardProps {
  className?: string;
  /**
   * Mês de referência YYYY-MM.
   * Se omitido, assume o mês corrente. Se fornecido e for diferente do mês atual, o card não se renderiza.
   */
  month?: string;
  /**
   * Insight específico a ser renderizado (modo controlado para testes ou composição).
   * Se omitido, o componente consome diretamente do hook useSmartAdvisorInsights().
   */
  insight?: SmartAdvisorInsight | null;
  /**
   * Índice do insight exibido (modo controlado).
   */
  currentIndex?: number;
  /**
   * Total de insights disponíveis na fila (modo controlado).
   */
  totalCount?: number;
  /**
   * Callback ao avançar para a próxima sugestão.
   */
  onNext?: () => void;
  /**
   * Callback ao retornar para a sugestão anterior.
   */
  onPrev?: () => void;
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
 * Respeita a regra de discrição (100% oculto se o mês estiver regular, dispensado ou fora do mês vigente).
 */
export function SmartAdvisorCard({
  className,
  month,
  insight: controlledInsight,
  currentIndex: controlledCurrentIndex,
  totalCount: controlledTotalCount,
  onNext,
  onPrev,
  onDismiss,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onConfirmIncome,
}: SmartAdvisorCardProps) {
  const navigate = useNavigate();
  const isCurrentMonth = month ? month === currentMonth() : true;

  // Hook interno (utilizado se não houver insight controlado injetado e estiver no mês atual)
  const hook = useSmartAdvisorInsights({
    month,
    enabled: controlledInsight === undefined && isCurrentMonth,
  });

  const activeInsight = controlledInsight !== undefined ? controlledInsight : hook.insight;
  const currentIndex = controlledCurrentIndex ?? hook.currentIndex;
  const totalCount = controlledTotalCount ?? hook.totalCount;
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCurrentMonth || !activeInsight) {
    return null;
  }

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      hook.nextInsight();
    }
  };

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
    } else {
      hook.prevInsight();
    }
  };

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
    // 1. Registro pré-preenchido de despesa pendente -> abre LaunchWizard modal
    if (
      activeInsight.primaryAction?.kind === "register_expense" ||
      (activeInsight.category === "critical" && !activeInsight.id.startsWith("dup:"))
    ) {
      const p = activeInsight.primaryAction?.payload as
        | {
            name?: string;
            valueCents?: number;
            categoryId?: string;
            date?: string;
            forma?: string;
            cardId?: string;
          }
        | undefined;

      const params = new URLSearchParams(window.location.search);
      params.set("novo", "despesa");
      params.set("modo", "rapido");
      if (p?.valueCents) params.set("valor", String(p.valueCents));
      if (p?.name) params.set("descricao", p.name);
      if (p?.categoryId) params.set("categoria", p.categoryId);
      if (p?.date) params.set("data", p.date);
      if (p?.forma) params.set("forma", p.forma);
      if (p?.cardId) params.set("cartao", p.cardId);

      navigate?.(`?${params.toString()}`);
      return;
    }

    // 2. Registro pré-preenchido de renda variável habitual -> abre LaunchWizard modal
    if (activeInsight.category === "income" && activeInsight.primaryAction?.kind === "open_income") {
      const p = activeInsight.primaryAction?.payload as
        | {
            name?: string;
            categoryId?: string;
            date?: string;
            valueCents?: number;
          }
        | undefined;

      const params = new URLSearchParams(window.location.search);
      params.set("novo", "receita");
      params.set("modo", "rapido");
      if (p?.name) params.set("descricao", p.name);
      if (p?.categoryId) params.set("categoria", p.categoryId);
      if (p?.date) params.set("data", p.date);
      if (p?.valueCents) params.set("valor", String(p.valueCents));

      navigate?.(`?${params.toString()}`);
      return;
    }

    // 3. Aporte para rebalanceamento de carteira -> navega para calculadora de aporte
    if (activeInsight.primaryAction?.kind === "navigate_aporte" || activeInsight.themeKey.startsWith("aporte:")) {
      const p = activeInsight.primaryAction?.payload as { valorCents?: number } | undefined;
      const valor = p?.valorCents;
      if (valor && valor > 0) {
        navigate?.(`/investments?tab=aporte&valor=${valor}`);
      } else {
        navigate?.("/investments?tab=aporte");
      }
      return;
    }

    // 4. Rever assinatura ou cobrança duplicada -> foca o item na aba de recorrências
    if (
      activeInsight.category === "savings" ||
      activeInsight.primaryAction?.kind === "cut_subscription" ||
      activeInsight.id.startsWith("dup:")
    ) {
      const p = activeInsight.primaryAction?.payload as { key?: string } | undefined;
      const itemKey = p?.key ?? activeInsight.themeKey.replace(/^(dup:|savings:|price_adj:)/, "");
      navigate?.(`/insights?aba=recurrences&item=${encodeURIComponent(itemKey)}`);
      return;
    }
  };

  // Ícones e badges de acordo com a categoria canônica
  const { categoryIcon, categoryBadgeVariant, categoryBadgeLabel } = (() => {
    if (activeInsight.primaryAction?.kind === "navigate_aporte" || activeInsight.themeKey.startsWith("aporte:")) {
      return {
        categoryIcon: <TrendingUp className="size-4 text-portfolio shrink-0" aria-hidden="true" />,
        categoryBadgeVariant: "portfolio" as const,
        categoryBadgeLabel: "Aporte",
      };
    }

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

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          {/* Navegação compacta 1 de N quando houver mais de uma sugestão */}
          {totalCount > 1 && (
            <div className="flex items-center rounded-md border border-border/80 bg-surface-hover/50 px-1 py-0.5">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sugestão anterior"
                sensoryIntent="selection"
                onClick={handlePrev}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-1.5 select-none whitespace-nowrap">
                {currentIndex + 1} de {totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Próxima sugestão"
                sensoryIntent="selection"
                onClick={handleNext}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* Botão sutil de dispensar por 30 dias */}
          <Button
            variant="ghost"
            size="sm"
            sensoryIntent="action"
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 shrink-0 gap-1"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Dispensar por 30 dias</span>
          </Button>
        </div>
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
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
