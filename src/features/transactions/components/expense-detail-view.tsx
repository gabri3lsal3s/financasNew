import { Plane, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import {
  normalizeSplitParticipants,
  sumExpectedFromFriendsCents,
  sumSettledFromFriendsCents,
} from "@/domain/finance";
import { formatDateBR, monthLabel } from "@/lib/date";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { Category, Debt, Expense, PublicShare, SplitSharePayload } from "@/types";
import { ExpensePriceEvolution, type PriceEvolutionData } from "./expense-price-evolution";

export interface ExpenseDetailViewProps {
  expense: Expense;
  currentCategory?: Category;
  isFamilyActive: boolean;
  isInstallment: boolean;
  isRecurring: boolean;
  priceEvolution: PriceEvolutionData | null;
  linkedSplitShare?: PublicShare | null;
  linkedRachaDebt?: Debt | null;
  onManageSplit?: () => void;
  onCreateSplit?: () => void;
}

/** Exibição dos dados consolidados da despesa com metadados avançados em Accordion (M9). */
export function ExpenseDetailView({
  expense,
  currentCategory,
  isFamilyActive,
  isInstallment,
  isRecurring,
  priceEvolution,
  linkedSplitShare,
  linkedRachaDebt,
  onManageSplit,
  onCreateSplit,
}: ExpenseDetailViewProps) {
  const grossAmountCents = Math.round(expense.value * 100);
  const reportAmountCents = Math.round(expense.value * expense.report_weight * 100);
  const reimbursedCents = Math.max(0, grossAmountCents - reportAmountCents);
  const isSplitLinked = Boolean(linkedSplitShare || linkedRachaDebt);
  const splitPayload = linkedSplitShare
    ? (linkedSplitShare.payload as unknown as SplitSharePayload)
    : null;
  const splitParticipants = splitPayload ? normalizeSplitParticipants(splitPayload) : [];
  const splitGuests = splitParticipants.filter((p) => !p.is_host);
  const splitSettledCount = splitGuests.filter((p) => p.is_settled).length;
  const splitReceivedCents = sumSettledFromFriendsCents(splitParticipants);
  const splitExpectedCents = sumExpectedFromFriendsCents(splitParticipants);
  const splitPendingCents = Math.max(0, splitExpectedCents - splitReceivedCents);
  const splitPendingSignals = (splitPayload?.payment_signals ?? []).filter(
    (s) => s.status === "pending",
  ).length;
  const hasAdvancedMetadata =
    expense.report_weight < 1 || isInstallment || Boolean(expense.bill_competence) || isRecurring || Boolean(priceEvolution);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <MoneyText
          cents={grossAmountCents}
          tone="negative"
          variant="value"
          className="text-3xl font-bold"
        />
        {expense.report_weight < 1 ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <span className="text-muted-foreground">Sua parte:</span>
              <MoneyText cents={reportAmountCents} tone="default" variant="caption" className="font-semibold text-foreground" />
              <span className="font-mono tabular-nums text-muted-foreground">({Math.round(expense.report_weight * 100)}%)</span>
            </span>
            {reimbursedCents > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-positive-strong">
                <span>Reembolsado:</span>
                <MoneyText cents={reimbursedCents} tone="positive" variant="caption" className="font-semibold" />
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm font-medium text-foreground">
          {expense.description || currentCategory?.name || "Despesa"}
        </p>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-sm shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Categoria</dt>
          <dd className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            {currentCategory ? (
              <>
                <CategoryIcon icon={currentCategory.icon} color={currentCategory.color} className="size-3.5" />
                <span>{currentCategory.name}</span>
              </>
            ) : (
              "Outra"
            )}
          </dd>
        </div>

        {isFamilyActive ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Orçamento</dt>
            <dd className="font-medium text-foreground text-xs">
              {expense.is_family ? (
                <Badge variant="muted" size="xs">Familiar</Badge>
              ) : isSplitLinked ? (
                <Badge variant="portfolio" size="xs">Racha</Badge>
              ) : (
                "Individual"
              )}
            </dd>
          </div>
        ) : isSplitLinked ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Compartilhamento</dt>
            <dd className="font-medium text-foreground text-xs">
              <Badge variant="portfolio" size="xs">Racha</Badge>
            </dd>
          </div>
        ) : null}

        {expense.trip_id ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Viagem</dt>
            <dd className="font-medium text-foreground text-xs">
              <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                <Plane className="size-3 text-portfolio" aria-hidden="true" />
                <span>Modo Viagem</span>
              </Badge>
            </dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd className="font-medium text-foreground text-xs tabular-nums">{formatDateBR(expense.date)}</dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Pagamento</dt>
          <dd className="font-medium text-foreground text-xs">
            {PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}
          </dd>
        </div>
      </dl>

      {linkedSplitShare && splitPayload ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">Status do Racha</span>
              <Badge variant={splitPayload.is_completed ? "positive" : "portfolio"} size="xs">
                {splitPayload.is_completed
                  ? "Concluído"
                  : `${splitSettledCount}/${splitGuests.length} pagos`}
              </Badge>
              {splitPendingSignals > 0 ? (
                <Badge variant="warning" size="xs">
                  {splitPendingSignals} aviso{splitPendingSignals > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
            {onManageSplit ? (
              <Button type="button" variant="outline" size="sm" onClick={onManageSplit}>
                Gerenciar Racha
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <span className="block text-[11px] text-muted-foreground">Recebido</span>
              <MoneyText cents={splitReceivedCents} tone="positive" variant="caption" className="font-semibold" />
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <span className="block text-[11px] text-muted-foreground">A receber</span>
              <MoneyText
                cents={splitPendingCents}
                tone={splitPendingCents > 0 ? "default" : "positive"}
                variant="caption"
                className="font-semibold text-foreground"
              />
            </div>
          </div>
        </div>
      ) : linkedRachaDebt ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground">Racha sem link público</span>
              <span className="text-[11px] text-muted-foreground truncate">{linkedRachaDebt.name}</span>
            </div>
          </div>
          {onCreateSplit ? (
            <Button type="button" variant="outline" size="sm" onClick={onCreateSplit}>
              Gerar Link Pix
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasAdvancedMetadata ? (
        <Accordion type="single" collapsible defaultValue={priceEvolution?.hasPriceIncrease ? "advanced" : undefined}>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-xs py-2.5">
              Mais detalhes · Fatura, rateio e histórico
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <dl className="flex flex-col gap-2 text-xs">
                {expense.report_weight < 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Participação no relatório</dt>
                    <dd className="flex items-center gap-1 font-medium text-foreground">
                      <MoneyText cents={reportAmountCents} tone="default" variant="caption" />
                      <span className="font-mono tabular-nums">({Math.round(expense.report_weight * 100)}%)</span>
                    </dd>
                  </div>
                ) : null}
                {isInstallment ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Parcela</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {expense.installment_number}/{expense.installments_total}
                    </dd>
                  </div>
                ) : null}
                {expense.bill_competence ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Fatura</dt>
                    <dd className="font-medium text-foreground">{monthLabel(expense.bill_competence)}</dd>
                  </div>
                ) : null}
                {isRecurring ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Série</dt>
                    <dd className="font-medium text-foreground">Lançamento recorrente</dd>
                  </div>
                ) : null}
              </dl>
              {priceEvolution ? <ExpensePriceEvolution evolution={priceEvolution} /> : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
