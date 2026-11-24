import { useMemo } from "react";
import { AlertTriangle, CreditCard as CreditCardIcon, EyeOff, Receipt, Repeat, Sparkles } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui";
import { CardSubscriptionRadar, InsightList } from "@/components/modules";
import {
  filterRecurrencesByTab,
  type FeedbackDecision,
  type FeedbackMap,
  type InsightThemeFamily,
  type PaydayProfile,
  type RecurrenceFilterTab,
  type RecurrenceOccurrence,
  type SmartDecayRecord,
} from "@/domain/insights";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types";
import { useRecurrencesTab } from "../hooks/use-recurrences-tab";
import { AssistantMemorySection, type MerchantMemoryEntryLike } from "./assistant-memory-section";
import { ConvertRecurrenceDialog } from "./convert-recurrence-dialog";
import { RecurrenceAuditModal } from "./recurrence-audit-modal";
import { CollapsibleOccurrencesSection } from "./recurrences/CollapsibleOccurrencesSection";
import { mapOccurrenceToInsightItem } from "./recurrences/map-occurrence-item";
import { RecurrencesSummaryCard } from "./recurrences/RecurrencesSummaryCard";

export interface RecurrencesTabProps {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
  activeOccurrences: RecurrenceOccurrence[];
  ignoredOccurrences: RecurrenceOccurrence[];
  lapsedOccurrences?: RecurrenceOccurrence[];
  feedbackMap: FeedbackMap;
  showIgnored: boolean;
  setShowIgnored: (val: boolean | ((prev: boolean) => boolean)) => void;
  onFeedback: (occurrenceKey: string, decision: FeedbackDecision | null) => void;
  cards?: CreditCard[];
  initialSelectedKey?: string;
  monthlyIncomeCents?: number;
  dismissals?: Record<string, number>;
  onRevokeDismissal?: (themeKey: string) => void;
  paydayProfile?: PaydayProfile;
  decayByFamily?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
  onUnmuteFamily?: (family: InsightThemeFamily) => void;
  merchantLearning?: Readonly<Record<string, MerchantMemoryEntryLike>> | null;
  onForgetMerchant?: (merchantKey: string) => void;
}

const TAB_EMPTY_LABELS: Record<RecurrenceFilterTab, string> = {
  subscriptions: "Nenhuma assinatura (streaming, nuvem, clubes) detectada nos últimos meses.",
  fixed_bills: "Nenhuma conta fixa essencial (energia, água, internet, saúde) detectada nos últimos meses.",
  with_alerts: "Nenhuma recorrência com alertas de reajuste, duplicidade ou atraso no momento.",
  all: "Nenhuma assinatura ou recorrência ativa detectada nos últimos meses.",
};

export function RecurrencesTab({
  totalRecurringCents,
  totalAnnualRecurringCents,
  canCutRecurringCents,
  canCutAnnualCents,
  activeOccurrences,
  ignoredOccurrences,
  lapsedOccurrences = [],
  feedbackMap,
  showIgnored,
  setShowIgnored,
  onFeedback,
  cards: cardsProp,
  initialSelectedKey,
  monthlyIncomeCents,
  dismissals,
  onRevokeDismissal,
  paydayProfile,
  decayByFamily,
  onUnmuteFamily,
  merchantLearning,
  onForgetMerchant,
}: RecurrencesTabProps) {
  const s = useRecurrencesTab({
    totalRecurringCents,
    activeOccurrences,
    ignoredOccurrences,
    lapsedOccurrences,
    feedbackMap,
    onFeedback,
    cardsProp,
    initialSelectedKey,
    monthlyIncomeCents,
  });

  const tabItems: TabItem[] = useMemo(() => {
    const configs: { value: RecurrenceFilterTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
      { value: "all", label: `Todas (${s.tabCounts.all})`, shortLabel: `Todas (${s.tabCounts.all})`, icon: <Repeat className="size-3.5" aria-hidden="true" /> },
      { value: "subscriptions", label: `Assinaturas (${s.tabCounts.subscriptions})`, shortLabel: `Assinaturas (${s.tabCounts.subscriptions})`, icon: <Sparkles className="size-3.5" aria-hidden="true" /> },
      { value: "fixed_bills", label: `Contas Fixas (${s.tabCounts.fixed_bills})`, shortLabel: `Fixas (${s.tabCounts.fixed_bills})`, icon: <Receipt className="size-3.5" aria-hidden="true" /> },
      { value: "with_alerts", label: `Com Alertas (${s.tabCounts.with_alerts})`, shortLabel: `Alertas (${s.tabCounts.with_alerts})`, icon: <AlertTriangle className="size-3.5 text-warning-strong" aria-hidden="true" /> },
    ];
    return configs.map((t) => ({
      ...t,
      content: (
        <InsightList
          items={filterRecurrencesByTab(activeOccurrences, t.value).map((o) => ({
            ...mapOccurrenceToInsightItem(o),
            icon: <Repeat className="size-4" aria-hidden="true" />,
          }))}
          feedback={feedbackMap}
          onIgnore={(key) => onFeedback(key, "ignore")}
          onIgnoreWithReason={s.handleIgnoreWithReason}
          onConfirm={(key) => onFeedback(key, "confirm")}
          onRestore={(key) => onFeedback(key, null)}
          onItemClick={s.setSelectedOccurrenceKey}
          onConvert={s.handleStartConversion}
          emptyLabel={TAB_EMPTY_LABELS[t.value]}
        />
      ),
    }));
  }, [activeOccurrences, s.tabCounts, s.handleIgnoreWithReason, s.setSelectedOccurrenceKey, s.handleStartConversion, feedbackMap, onFeedback]);

  const ignoredItemsWithIcons = useMemo(
    () => s.ignoredItems.map((item) => ({ ...item, icon: <Repeat className="size-4" aria-hidden="true" /> })),
    [s.ignoredItems],
  );

  return (
    <div data-tour="insights-recurrences-content" className="flex flex-col gap-4 min-w-0">
      <RecurrencesSummaryCard
        totalRecurringCents={totalRecurringCents}
        totalAnnualRecurringCents={totalAnnualRecurringCents}
        canCutRecurringCents={canCutRecurringCents}
        canCutAnnualCents={canCutAnnualCents}
        cancelledAnnualSavingsCents={s.cancelledAnnualSavingsCents}
        fixedCommitmentRate={s.fixedCommitmentRate}
      />

      {s.cardImpacts.length > 0 ? (
        <section aria-label="Radar de assinaturas por cartão de crédito e faturas" className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-0.5">
            <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Impacto de Assinaturas na Fatura em Aberto
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {s.cardImpacts.map((impact) => (
              <CardSubscriptionRadar
                key={impact.cardId}
                impact={impact}
                onIgnoreItem={(key) => onFeedback(key, "ignore")}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="Lista de assinaturas e recorrências" className="flex flex-col gap-3">
        <Tabs
          value={s.filterTab}
          onValueChange={(val) => s.setFilterTab(val as RecurrenceFilterTab)}
          items={tabItems}
          variant="pills"
          fullWidth={false}
          className="w-full"
        />
      </section>

      {ignoredOccurrences.length > 0 ? (
        <CollapsibleOccurrencesSection
          ariaLabel="Ocorrências ignoradas"
          toggleLabel={`Ocorrências ignoradas (${ignoredOccurrences.length})`}
          description="Ocorrências ignoradas são excluídas dos cálculos e relatórios. Clique no ícone de restaurar para devolvê-las à lista ativa."
          icon={<EyeOff className="size-3.5" aria-hidden="true" />}
          open={showIgnored}
          onToggle={() => setShowIgnored((prev) => !prev)}
          items={ignoredItemsWithIcons}
          feedbackMap={feedbackMap}
          onRestore={(key) => onFeedback(key, null)}
          onItemClick={s.setSelectedOccurrenceKey}
          onConvert={s.handleStartConversion}
        />
      ) : null}

      {lapsedOccurrences.length > 0 ? (
        <CollapsibleOccurrencesSection
          ariaLabel="Recorrências interrompidas"
          toggleLabel={`Recorrências interrompidas / histórico (${lapsedOccurrences.length})`}
          description="Gastos que não se repetiram nos últimos ciclos. Não somam no custo mensal ativo nem geram alertas."
          icon={<Repeat className="size-3.5 opacity-60" aria-hidden="true" />}
          open={s.showLapsed}
          onToggle={() => s.setShowLapsed((prev) => !prev)}
          items={lapsedOccurrences.map((o) => ({
            ...mapOccurrenceToInsightItem(o),
            icon: <Repeat className="size-4" aria-hidden="true" />,
          }))}
          feedbackMap={feedbackMap}
          onIgnore={(key) => onFeedback(key, "ignore")}
          onIgnoreWithReason={s.handleIgnoreWithReason}
          onConfirm={(key) => onFeedback(key, "confirm")}
          onRestore={(key) => onFeedback(key, null)}
          onItemClick={s.setSelectedOccurrenceKey}
          onConvert={s.handleStartConversion}
        />
      ) : null}

      <AssistantMemorySection
        feedbackMap={feedbackMap}
        onRevokeFeedback={(key) => onFeedback(key, null)}
        activeOccurrences={activeOccurrences}
        ignoredOccurrences={ignoredOccurrences}
        dismissals={dismissals}
        onRevokeDismissal={onRevokeDismissal}
        paydayProfile={paydayProfile}
        decayByFamily={decayByFamily}
        onUnmuteFamily={onUnmuteFamily}
        merchantLearning={merchantLearning}
        onForgetMerchant={onForgetMerchant}
      />

      <RecurrenceAuditModal
        open={Boolean(s.selectedOccurrence)}
        onOpenChange={(next) => {
          if (!next) s.setSelectedOccurrenceKey(null);
        }}
        occurrence={s.selectedOccurrence}
        onConvert={s.handleStartConversion}
        currentFeedbackDecision={s.selectedOccurrence ? (feedbackMap[s.selectedOccurrence.key] ?? null) : null}
        onFeedbackDecision={(key, decision) => onFeedback(key, decision)}
        isEssential={
          s.selectedOccurrence
            ? feedbackMap[s.selectedOccurrence.key] === "essential" || s.selectedOccurrence.tier === "essential"
            : false
        }
        onToggleEssential={(key, nextEssential) => {
          onFeedback(key, nextEssential ? "essential" : null);
          pushToast({
            title: nextEssential ? "Gasto classificado como essencial" : "Classificação removida",
            description: nextEssential
              ? "Mantido nos custos fixos sem sugestões de corte."
              : "Item voltou ao monitoramento regular de sugestões.",
            variant: "info",
          });
        }}
      />

      {s.convertingOccurrence ? (
        <ConvertRecurrenceDialog
          occurrence={s.convertingOccurrence}
          open={Boolean(s.convertingOccurrence)}
          onOpenChange={(open) => {
            if (!open) s.setConvertingOccurrence(null);
          }}
          onSuccess={(key) => onFeedback(key, "confirm")}
        />
      ) : null}
    </div>
  );
}
