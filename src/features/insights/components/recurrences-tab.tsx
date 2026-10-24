import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CreditCard as CreditCardIcon,
  EyeOff,
  Receipt,
  Repeat,
  Sparkles,
} from "lucide-react";
import { Button, Tabs, type TabItem } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CardSubscriptionRadar, InsightList } from "@/components/modules";
import {
  calculateAllCardsSubscriptionImpact,
  calculateFixedCommitmentRate,
  filterRecurrencesByTab,
  getDismissReason,
  SERVICE_SEGMENT_LABELS,
  type CalibrationDecision,
  type RecurrenceFilterTab,
} from "@/domain/insights";
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
import { useCreditCards } from "@/state";
import { cn } from "@/lib/utils";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL } from "@/services/masks/money";
import { RecurrenceAuditModal } from "./recurrence-audit-modal";
import { ConvertRecurrenceDialog } from "./convert-recurrence-dialog";
import { AssistantMemorySection } from "./assistant-memory-section";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { FeedbackDecision, FeedbackMap } from "@/domain/insights/feedback";
import type { CreditCard } from "@/types";

export interface RecurrencesTabProps {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
  activeOccurrences: RecurrenceOccurrence[];
  ignoredOccurrences: RecurrenceOccurrence[];
  feedbackMap: FeedbackMap;
  showIgnored: boolean;
  setShowIgnored: (val: boolean | ((prev: boolean) => boolean)) => void;
  onFeedback: (occurrenceKey: string, decision: FeedbackDecision | null) => void;
  cards?: CreditCard[];
  /** Chave da ocorrência a ser aberta inicialmente para auditoria (ex.: vindo de atalho da Home) */
  initialSelectedKey?: string;
  /** Renda mensal total em centavos para cálculo da Taxa de Comprometimento Fixo (Tarefa 7.10) */
  monthlyIncomeCents?: number;
  /** Cooldowns de descarte do assistente (opcional para testes controlados) */
  dismissals?: Record<string, number>;
  /** Callback para revogação de descarte do assistente (opcional para testes controlados) */
  onRevokeDismissal?: (themeKey: string) => void;
}

function mapOccurrenceToInsightItem(o: RecurrenceOccurrence) {
  const badges: { label: string; tone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted" }[] = [];

  if (o.cadence === "weekly") {
    badges.push({ label: "Semanal", tone: "default" });
  } else if (o.cadence === "annual") {
    badges.push({ label: "Anual", tone: "default" });
  }

  if (o.cardName) {
    badges.push({ label: o.cardName, tone: "muted" });
  }

  if (o.segment && o.segment !== "other") {
    badges.push({ label: SERVICE_SEGMENT_LABELS[o.segment], tone: "default" });
  }

  if (o.tier === "can_cut") {
    badges.push({ label: "Pode cortar", tone: "positive" });
  } else if (o.tier === "discretionary") {
    badges.push({ label: "Discricionário", tone: "default" });
  } else if (o.tier === "essential") {
    badges.push({ label: "Essencial", tone: "default" });
  }

  if (o.missingThisMonth) {
    badges.push({ label: "Pendente no mês", tone: "warning" });
  } else if (o.daysUntilNextDue !== undefined) {
    if (o.daysUntilNextDue === 0) {
      badges.push({ label: "Vence hoje", tone: "warning" });
    } else if (o.daysUntilNextDue > 0 && o.daysUntilNextDue <= 7) {
      badges.push({ label: `Em ${o.daysUntilNextDue}d`, tone: "warning" });
    } else if (o.typicalDayOfMonth) {
      badges.push({ label: `Dia ~${o.typicalDayOfMonth}`, tone: "muted" });
    }
  }

  if (o.priceAdjustment) {
    badges.push({ label: `+${o.priceAdjustment.percentIncrease}% reajuste`, tone: "warning" });
  }

  if (o.duplicateChargesThisMonth && o.duplicateChargesThisMonth > 1) {
    badges.push({ label: `${o.duplicateChargesThisMonth}x no mês`, tone: "warning" });
  }

  const subtitle =
    o.cadence === "weekly"
      ? `Semanal (~4x/mês) · Custo consolidado de ${formatCentsAsBRL(o.monthlyConsolidatedCents ?? o.averageCents)}/mês`
      : `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`;

  const amountCents =
    o.cadence === "weekly" && o.monthlyConsolidatedCents != null
      ? o.monthlyConsolidatedCents
      : o.averageCents;

  return {
    key: o.key,
    title: o.name,
    subtitle,
    confidence: o.confidence,
    amountCents,
    badges,
    icon: <Repeat className="size-4" aria-hidden="true" />,
  };
}

export function RecurrencesTab({
  totalRecurringCents,
  totalAnnualRecurringCents,
  canCutRecurringCents,
  canCutAnnualCents,
  activeOccurrences,
  ignoredOccurrences,
  feedbackMap,
  showIgnored,
  setShowIgnored,
  onFeedback,
  cards: cardsProp,
  initialSelectedKey,
  monthlyIncomeCents,
  dismissals,
  onRevokeDismissal,
}: RecurrencesTabProps) {
  const cardsQuery = useCreditCards();

  const cardImpacts = useMemo(() => {
    const cards = cardsProp ?? cardsQuery.data ?? [];
    if (cards.length === 0 || activeOccurrences.length === 0) return [];
    const impacts = calculateAllCardsSubscriptionImpact(cards, activeOccurrences);
    return impacts.filter((impact) => impact.totalProjectedCents > 0);
  }, [cardsProp, cardsQuery.data, activeOccurrences]);

  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState<string | null>(
    () => initialSelectedKey ?? null,
  );
  const [convertingOccurrence, setConvertingOccurrence] = useState<RecurrenceOccurrence | null>(null);
  const [filterTab, setFilterTab] = useState<RecurrenceFilterTab>("all");

  const cancelledAnnualSavingsCents = useMemo(() => {
    return ignoredOccurrences
      .filter((o) => feedbackMap[o.key] === "already_cancelled")
      .reduce((sum, o) => sum + o.averageCents * 12, 0);
  }, [ignoredOccurrences, feedbackMap]);

  const fixedCommitmentRate = useMemo(() => {
    return calculateFixedCommitmentRate(totalRecurringCents, monthlyIncomeCents);
  }, [totalRecurringCents, monthlyIncomeCents]);

  const tabCounts = useMemo(() => {
    return {
      all: activeOccurrences.length,
      subscriptions: activeOccurrences.filter((o) => filterRecurrencesByTab([o], "subscriptions").length > 0).length,
      fixed_bills: activeOccurrences.filter((o) => filterRecurrencesByTab([o], "fixed_bills").length > 0).length,
      with_alerts: activeOccurrences.filter((o) => filterRecurrencesByTab([o], "with_alerts").length > 0).length,
    };
  }, [activeOccurrences]);

  const handleIgnoreWithReason = useCallback(
    (key: string, reason: CalibrationDecision) => {
      onFeedback(key, reason);

      if (reason === "essential") {
        triggerSensory("action");
        pushToast({
          title: "Gasto classificado como essencial",
          description: "Mantido no monitoramento de custos fixos, com sugestões de corte silenciadas.",
          variant: "info",
        });
      } else if (reason === "already_cancelled") {
        const occ = activeOccurrences.find((o) => o.key === key);
        const annualSavings = (occ?.averageCents ?? 0) * 12;
        triggerSensory("success");
        pushToast({
          title: "Assinatura cancelada celebrada",
          description:
            annualSavings > 0
              ? `Economia projetada de ${formatCentsAsBRL(annualSavings)}/ano conquistada com sucesso.`
              : "Assinatura removida dos custos fixos ativos.",
          variant: "success",
        });
      } else if (reason === "not_subscription") {
        triggerSensory("action");
        pushToast({
          title: "Despesa reclassificada",
          description: "Probabilidade de recorrência deste fornecedor rebaixada no motor.",
          variant: "info",
        });
      } else {
        triggerSensory("action");
        pushToast({
          title: "Despesa pontual silenciada",
          description: "Item silenciado apenas para este ciclo.",
          variant: "default",
        });
      }
    },
    [activeOccurrences, onFeedback],
  );

  const selectedOccurrence = useMemo(() => {
    if (!selectedOccurrenceKey) return null;
    return (
      activeOccurrences.find((o) => o.key === selectedOccurrenceKey) ??
      ignoredOccurrences.find((o) => o.key === selectedOccurrenceKey) ??
      null
    );
  }, [activeOccurrences, ignoredOccurrences, selectedOccurrenceKey]);

  const handleStartConversion = useCallback(
    (keyOrOccurrence: string | RecurrenceOccurrence) => {
      const occ =
        typeof keyOrOccurrence === "string"
          ? (activeOccurrences.find((o) => o.key === keyOrOccurrence) ??
             ignoredOccurrences.find((o) => o.key === keyOrOccurrence) ??
             null)
          : keyOrOccurrence;
      if (occ) {
        setSelectedOccurrenceKey(null);
        setConvertingOccurrence(occ);
      }
    },
    [activeOccurrences, ignoredOccurrences],
  );

  const totalMetricsCount =
    3 +
    (canCutRecurringCents > 0 ? 1 : 0) +
    (cancelledAnnualSavingsCents > 0 ? 1 : 0);

  const gridColsClass =
    totalMetricsCount >= 5
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : totalMetricsCount === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-3";

  const getEmptyLabel = (tab: RecurrenceFilterTab) => {
    switch (tab) {
      case "subscriptions":
        return "Nenhuma assinatura (streaming, nuvem, clubes) detectada nos últimos meses.";
      case "fixed_bills":
        return "Nenhuma conta fixa essencial (energia, água, internet, saúde) detectada nos últimos meses.";
      case "with_alerts":
        return "Nenhuma recorrência com alertas de reajuste, duplicidade ou atraso no momento.";
      case "all":
      default:
        return "Nenhuma assinatura ou recorrência ativa detectada nos últimos meses.";
    }
  };

  const tabItems: TabItem[] = useMemo(() => {
    const tabsConfig: { value: RecurrenceFilterTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
      {
        value: "all",
        label: `Todas (${tabCounts.all})`,
        shortLabel: `Todas (${tabCounts.all})`,
        icon: <Repeat className="size-3.5" aria-hidden="true" />,
      },
      {
        value: "subscriptions",
        label: `Assinaturas (${tabCounts.subscriptions})`,
        shortLabel: `Assinaturas (${tabCounts.subscriptions})`,
        icon: <Sparkles className="size-3.5" aria-hidden="true" />,
      },
      {
        value: "fixed_bills",
        label: `Contas Fixas (${tabCounts.fixed_bills})`,
        shortLabel: `Fixas (${tabCounts.fixed_bills})`,
        icon: <Receipt className="size-3.5" aria-hidden="true" />,
      },
      {
        value: "with_alerts",
        label: `Com Alertas (${tabCounts.with_alerts})`,
        shortLabel: `Alertas (${tabCounts.with_alerts})`,
        icon: <AlertTriangle className="size-3.5 text-warning-strong" aria-hidden="true" />,
      },
    ];

    return tabsConfig.map((t) => {
      const list = filterRecurrencesByTab(activeOccurrences, t.value);
      return {
        value: t.value,
        label: t.label,
        shortLabel: t.shortLabel,
        icon: t.icon,
        content: (
          <InsightList
            items={list.map(mapOccurrenceToInsightItem)}
            feedback={feedbackMap}
            onIgnore={(key) => onFeedback(key, "ignore")}
            onIgnoreWithReason={handleIgnoreWithReason}
            onConfirm={(key) => onFeedback(key, "confirm")}
            onRestore={(key) => onFeedback(key, null)}
            onItemClick={(key) => setSelectedOccurrenceKey(key)}
            onConvert={handleStartConversion}
            emptyLabel={getEmptyLabel(t.value)}
          />
        ),
      };
    });
  }, [
    activeOccurrences,
    tabCounts,
    feedbackMap,
    onFeedback,
    handleIgnoreWithReason,
    handleStartConversion,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Card de Resumo de Recorrências com KPI de Comprometimento Fixo (Tarefa 7.10) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className={cn("grid gap-4 sm:gap-6 w-full", gridColsClass)}>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total mensal recorrente</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <MoneyText cents={totalRecurringCents} tone="default" animated className="text-xl sm:text-2xl font-bold" />
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Comprometimento fixo</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={cn(
                  "text-xl sm:text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap",
                  fixedCommitmentRate != null && fixedCommitmentRate > 50
                    ? "text-negative-strong"
                    : fixedCommitmentRate != null && fixedCommitmentRate > 30
                      ? "text-warning-strong"
                      : "text-foreground",
                )}
              >
                {fixedCommitmentRate != null ? `${fixedCommitmentRate.toFixed(1).replace(".", ",")}%` : "—"}
              </span>
              <span className="text-xs text-muted-foreground">da renda</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fixedCommitmentRate != null
                ? "Fatia da renda comprometida antes do mês iniciar"
                : "Cadastre sua renda para ver o percentual"}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total anual projetado</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <MoneyText cents={totalAnnualRecurringCents} tone="default" animated className="text-xl sm:text-2xl font-bold" />
              <span className="text-xs text-muted-foreground">/ano</span>
            </div>
          </div>
          {canCutRecurringCents > 0 ? (
            <div>
              <span className="text-xs font-medium text-positive-strong">Economia potencial (corte)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <MoneyText cents={canCutRecurringCents} tone="positive" animated className="text-xl sm:text-2xl font-bold" />
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <p className="text-xs font-medium text-positive-strong mt-0.5">
                +<MoneyText cents={canCutAnnualCents} tone="positive" /> ao ano
              </p>
            </div>
          ) : null}
          {cancelledAnnualSavingsCents > 0 ? (
            <div>
              <span className="text-xs font-medium text-positive-strong">Economia celebrada (canceladas)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <MoneyText cents={cancelledAnnualSavingsCents} tone="positive" animated className="text-xl sm:text-2xl font-bold" />
                <span className="text-xs text-muted-foreground">/ano</span>
              </div>
              <p className="text-xs font-medium text-positive-strong mt-0.5">
                Conquistada com sucesso
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Radar de Assinaturas por Cartão de Crédito e Impacto na Fatura (F22 / Tarefa 7.6) */}
      {cardImpacts.length > 0 ? (
        <section aria-label="Radar de assinaturas por cartão de crédito e faturas" className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-0.5">
            <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Impacto de Assinaturas na Fatura em Aberto
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {cardImpacts.map((impact) => (
              <CardSubscriptionRadar
                key={impact.cardId}
                impact={impact}
                onIgnoreItem={(key) => onFeedback(key, "ignore")}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Seção de Assinaturas e Recorrências com Abas Fluidas de Navegação (Tarefa 7.10) */}
      <section aria-label="Lista de assinaturas e recorrências" className="flex flex-col gap-3">
        <Tabs
          value={filterTab}
          onValueChange={(val) => setFilterTab(val as RecurrenceFilterTab)}
          items={tabItems}
          variant="pills"
          fullWidth={false}
          className="w-full"
        />
      </section>

      {/* Seção colapsável de Ocorrências Ignoradas */}
      {ignoredOccurrences.length > 0 ? (
        <section aria-label="Ocorrências ignoradas" className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowIgnored((prev) => !prev);
            }}
            className="flex items-center justify-between gap-2 self-start text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showIgnored}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <EyeOff className="size-3.5" aria-hidden="true" />
              Ocorrências ignoradas ({ignoredOccurrences.length})
            </span>
            {showIgnored ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          {showIgnored ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/80 p-3 bg-surface/40">
              <p className="text-xs text-muted-foreground">
                Ocorrências ignoradas são excluídas dos cálculos e relatórios. Clique no ícone de restaurar para devolvê-las à lista ativa.
              </p>
              <InsightList
                items={ignoredOccurrences.map((o) => ({
                  key: o.key,
                  title: o.name,
                  subtitle: `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`,
                  confidence: o.confidence,
                  amountCents: o.averageCents,
                  dismissReason: getDismissReason(feedbackMap[o.key]),
                  icon: <Repeat className="size-4" aria-hidden="true" />,
                }))}
                feedback={feedbackMap}
                onRestore={(key) => onFeedback(key, null)}
                onItemClick={(key) => setSelectedOccurrenceKey(key)}
                onConvert={handleStartConversion}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Seção de Memória e Aprendizado do Assistente (F30 / Tarefa 8.6) */}
      <AssistantMemorySection
        feedbackMap={feedbackMap}
        onRevokeFeedback={(key) => onFeedback(key, null)}
        activeOccurrences={activeOccurrences}
        ignoredOccurrences={ignoredOccurrences}
        dismissals={dismissals}
        onRevokeDismissal={onRevokeDismissal}
      />

      {/* Modal de Auditoria e Drill-Down de Transações */}
      <RecurrenceAuditModal
        open={Boolean(selectedOccurrence)}
        onOpenChange={(next) => {
          if (!next) setSelectedOccurrenceKey(null);
        }}
        occurrence={selectedOccurrence}
        onConvert={handleStartConversion}
        isEssential={
          selectedOccurrence
            ? feedbackMap[selectedOccurrence.key] === "essential" || selectedOccurrence.tier === "essential"
            : false
        }
        onToggleEssential={(key, nextEssential) => {
          onFeedback(key, nextEssential ? "essential" : null);
          triggerSensory("action");
          pushToast({
            title: nextEssential ? "Gasto classificado como essencial" : "Classificação removida",
            description: nextEssential
              ? "Mantido nos custos fixos sem sugestões de corte."
              : "Item voltou ao monitoramento regular de sugestões.",
            variant: "info",
          });
        }}
      />

      {/* Diálogo de Conversão em Agendamento Formal (Fase 32 / Tarefa 7.5) */}
      {convertingOccurrence ? (
        <ConvertRecurrenceDialog
          occurrence={convertingOccurrence}
          open={Boolean(convertingOccurrence)}
          onOpenChange={(open) => {
            if (!open) setConvertingOccurrence(null);
          }}
          onSuccess={(key) => {
            onFeedback(key, "confirm");
          }}
        />
      ) : null}
    </div>
  );
}
