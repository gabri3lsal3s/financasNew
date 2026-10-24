import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { currentMonth } from "@/lib/date";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import type { SmartAdvisorCardContext, SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { QualifiedDismissPopover } from "./qualified-dismiss-popover";
import { SmartAdvisorCardSkeleton } from "./smart-advisor-card-skeleton";
import { pushToast } from "@/services/toast";

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
   * Contexto de fatura e limite de cartão de crédito injetável (modo controlado).
   */
  cardContext?: SmartAdvisorCardContext;
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
   * Callback ao ignorar ou calibrar uma despesa na calibração com motivo qualificado (§F23).
   */
  onIgnoreRecurrence?: (occurrenceKey: string, reason?: CalibrationDecision) => void | Promise<void>;
  /**
   * Callback ao confirmar entrada de renda em 1 clique.
   */
  onConfirmIncome?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => void | Promise<void>;
  /**
   * Callback ao confirmar despesa fixa em 1 toque (F27 / Tarefa 8.3).
   */
  onConfirmExpense?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
  }) => void | Promise<void>;
  /**
   * Callback ao marcar despesa recorrente como essencial (sincronizada na nuvem).
   */
  onMarkEssential?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
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
  cardContext: controlledCardContext,
  currentIndex: controlledCurrentIndex,
  totalCount: controlledTotalCount,
  onNext,
  onPrev,
  onDismiss,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onMarkEssential,
  onConfirmIncome,
  onConfirmExpense,
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
  const cardContext =
    controlledCardContext ?? activeInsight?.cardContext ?? activeInsight?.metadata?.cardContext;
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCurrentMonth) {
    return null;
  }

  // Estado de carregamento: preserva o espaço visual estável sem layout shift
  if (controlledInsight === undefined && hook.isLoading) {
    return <SmartAdvisorCardSkeleton className={className} />;
  }

  if (!activeInsight) {
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
    const key = activeInsight.themeKey;
    if (onDismiss) {
      onDismiss(key);
    } else {
      hook.dismiss(key);
    }
    pushToast({
      title: "Sugestão dispensada",
      description: "Esta recomendação foi pausada e reaparecerá após 30 dias.",
      variant: "default",
    });
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

  const handleConfirmExpense = async () => {
    const payload = activeInsight.primaryAction?.payload as
      | {
          name: string;
          valueCents: number;
          categoryId: string;
          date?: string;
          forma?: string;
          cardId?: string;
        }
      | undefined;

    if (!payload) return;

    try {
      setIsSubmitting(true);
      if (onConfirmExpense) {
        await onConfirmExpense(payload);
      } else {
        await hook.confirmExpense(payload);
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

  const handleIgnoreRecurrence = async (reason: CalibrationDecision = "one_off") => {
    if (reason === "essential") {
      await handleMarkEssential();
      hook.dismiss(activeInsight.themeKey);
      return;
    }

    const payload = activeInsight.secondaryAction?.payload as { key?: string } | undefined;
    const occurrenceKey =
      payload?.key ?? activeInsight.themeKey.replace(/^calib:/, "");

    try {
      setIsSubmitting(true);
      if (onIgnoreRecurrence) {
        await onIgnoreRecurrence(occurrenceKey, reason);
      } else {
        await hook.ignoreRecurrence(occurrenceKey, reason);
        hook.dismiss(activeInsight.themeKey);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkEssential = async () => {
    const payload = (activeInsight.secondaryAction?.payload ??
      activeInsight.primaryAction?.payload) as { key?: string; name?: string } | undefined;
    const occurrenceKey =
      payload?.key ??
      activeInsight.themeKey.replace(/^(savings:|calib:|price_adj:)/, "");
    const displayName = payload?.name ?? activeInsight.title;

    try {
      setIsSubmitting(true);
      if (onMarkEssential) {
        await onMarkEssential(occurrenceKey, displayName);
      } else {
        await hook.markAsEssential(occurrenceKey, displayName);
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
        "w-full flex flex-col justify-between gap-3 min-h-[148px] sm:min-h-[140px] rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all motion-reduce:transition-none",
        className,
      )}
    >
      {/* 1. Barra superior: Categoria e contexto à esquerda | Controles à direita */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex items-center justify-center transition-transform motion-safe:duration-150" aria-hidden="true">
            {categoryIcon}
          </span>
          <Badge variant={categoryBadgeVariant} size="xs" className="shrink-0 font-medium">
            {categoryBadgeLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Navegação compacta 1 de N quando houver mais de uma sugestão */}
          {totalCount > 1 && (
            <div className="flex items-center rounded-md border border-border/80 bg-surface-hover/50 px-1 py-0.5">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sugestão anterior"
                sensoryIntent="selection"
                onClick={handlePrev}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none"
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
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* Ação de dispensa ou marcação como essencial sincronizada */}
          {activeInsight.category === "savings" && activeInsight.primaryAction?.kind === "cut_subscription" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label="Manter como essencial"
              title="Manter como essencial"
              sensoryIntent="action"
              onClick={() => void handleMarkEssential()}
              disabled={isSubmitting}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 cursor-pointer"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Manter como essencial</span>
              <span className="sr-only sm:hidden">Manter como essencial</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="xs"
              aria-label="Dispensar por 30 dias"
              title="Dispensar por 30 dias"
              sensoryIntent="action"
              onClick={handleDismiss}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Dispensar por 30 dias</span>
              <span className="sr-only sm:hidden">Dispensar por 30 dias</span>
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo dinâmico com animação sutil e transições suaves entre itens da fila (Tarefa 8.7) */}
      <div
        key={activeInsight.id}
        data-testid="smart-advisor-content-body"
        className="flex flex-col gap-3 min-w-0 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transition-none"
      >
        {/* 2. Conteúdo editorial do insight com tipografia hierárquica */}
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {activeInsight.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeInsight.description}
          </p>
        </div>

        {/* 3. Ações contextuais de 1 toque */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {activeInsight.category === "calibration" ? (
            <>
              <Button
                size="sm"
                variant="default"
                sensoryIntent="success"
                onClick={() => void handleConfirmRecurrence()}
                disabled={isSubmitting}
                className="gap-1.5 text-xs h-8 cursor-pointer"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Sim, monitorar</span>
              </Button>
              <QualifiedDismissPopover
                occurrenceName={activeInsight.title}
                averageCents={activeInsight.metadata?.valueCents}
                onSelectReason={(reason) => void handleIgnoreRecurrence(reason)}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  sensoryIntent="action"
                  disabled={isSubmitting}
                  className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  <span>Não, foi pontual</span>
                </Button>
              </QualifiedDismissPopover>
            </>
          ) : activeInsight.category === "savings" && activeInsight.primaryAction?.kind === "cut_subscription" ? (
            <>
              <Button
                size="sm"
                variant="default"
                sensoryIntent="selection"
                onClick={handleActionClick}
                disabled={isSubmitting}
                className="gap-1.5 text-xs h-8 cursor-pointer"
              >
                <span>{activeInsight.primaryAction.label}</span>
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                sensoryIntent="action"
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>Dispensar</span>
              </Button>
            </>
          ) : activeInsight.primaryAction?.kind === "confirm_expense" ? (
            <Button
              size="sm"
              variant="default"
              sensoryIntent="success"
              onClick={() => void handleConfirmExpense()}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{activeInsight.primaryAction.label}</span>
            </Button>
          ) : activeInsight.category === "income" && activeInsight.primaryAction?.kind === "confirm_income" ? (
            <Button
              size="sm"
              sensoryIntent="success"
              onClick={() => void handleConfirmIncome()}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{activeInsight.primaryAction.label}</span>
            </Button>
          ) : activeInsight.primaryAction ? (
            <Button
              size="sm"
              variant="default"
              sensoryIntent="selection"
              onClick={handleActionClick}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer"
            >
              <span>{activeInsight.primaryAction.label}</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {/* 4. Linha contextual de fatura e limite de cartão de crédito (F28 / Tarefa 8.4) */}
        {cardContext && (
          <div
            data-testid="smart-advisor-card-context"
            className={cn(
              "flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs",
              cardContext.exceedsAvailableLimit
                ? "text-critical-strong font-medium"
                : cardContext.isSeverelyCompromised
                  ? "text-warning-strong font-medium"
                  : "text-muted-foreground",
            )}
          >
            <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Previsto na fatura {cardContext.cardName}</span>
            <span aria-hidden="true">•</span>
            {cardContext.availableLimitCents !== null && (
              <>
                <span className="whitespace-nowrap">
                  Limite restante:{" "}
                  <MoneyText
                    cents={cardContext.availableLimitCents}
                    className={cn(
                      "tabular-nums tracking-tight whitespace-nowrap inline font-medium",
                      cardContext.exceedsAvailableLimit
                        ? "text-critical-strong"
                        : cardContext.isSeverelyCompromised
                          ? "text-warning-strong"
                          : "text-foreground",
                    )}
                  />
                </span>
                <span aria-hidden="true">•</span>
              </>
            )}
            <span className="whitespace-nowrap">
              {cardContext.closingLabel ??
                (cardContext.daysUntilClosing === 1
                  ? "Fecha em 1 dia"
                  : `Fecha em ${cardContext.daysUntilClosing} dias`)}
            </span>
            {cardContext.orientationMessage && (
              <span className="w-full sm:w-auto text-[11px] block sm:inline">
                • {cardContext.orientationMessage}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
