import { Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatDateBR } from "@/lib/date";
import { INTERNAL_TRANSFER_KIND_LABELS, RECEIVE_TYPE_LABELS, TRANSACTION_SCOPE_LABELS } from "@/lib/labels";
import type { Category, Income, InternalTransferKind } from "@/types";

export interface IncomeDetailViewProps {
  income: Income;
  currentCategory?: Category;
  isFamilyActive: boolean;
  isBusinessActive?: boolean;
  isReadOnly: boolean;
  isInstallment: boolean;
  isRecurring: boolean;
}

/** Exibição dos dados consolidados da receita com metadados avançados em Accordion (M9). */
export function IncomeDetailView({
  income,
  currentCategory,
  isFamilyActive,
  isBusinessActive = false,
  isReadOnly,
  isInstallment,
  isRecurring,
}: IncomeDetailViewProps) {
  const reportAmountCents = Math.round(income.value * income.report_weight * 100);
  const hasAdvancedMetadata = income.report_weight < 1 || isInstallment || isRecurring;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <MoneyText
          cents={Math.round(income.value * 100)}
          tone="positive"
          variant="value"
          className="text-3xl font-bold"
        />
        {income.report_weight < 1 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Valor no relatório:</span>
            <MoneyText cents={reportAmountCents} tone="default" variant="caption" className="font-semibold text-foreground" />
            <span className="font-mono tabular-nums">({Math.round(income.report_weight * 100)}%)</span>
          </div>
        ) : null}
        <p className="text-sm font-medium text-foreground">
          {income.description || currentCategory?.name || "Receita"}
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
              {income.is_family ? <Badge variant="muted" size="xs">Familiar</Badge> : "Individual"}
            </dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd className="font-medium text-foreground text-xs tabular-nums">{formatDateBR(income.date)}</dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Recebimento</dt>
          <dd className="font-medium text-foreground text-xs">
            {RECEIVE_TYPE_LABELS[income.receive_type] ?? income.receive_type}
          </dd>
        </div>

        {isBusinessActive || income.is_internal_transfer ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Esfera</dt>
            <dd className="font-medium text-foreground text-xs">
              <Badge variant={income.scope === "business" ? "portfolio" : "muted"} size="xs">
                {TRANSACTION_SCOPE_LABELS[income.scope ?? "personal"]}
              </Badge>
            </dd>
          </div>
        ) : null}

        {income.is_internal_transfer ? (
          <div className="flex flex-col gap-1 border-t border-border/80 pt-2">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">Movimentação</dt>
              <dd className="font-medium text-foreground text-xs">
                <Badge variant="muted" size="xs">
                  {income.transfer_kind && income.transfer_kind in INTERNAL_TRANSFER_KIND_LABELS
                    ? INTERNAL_TRANSFER_KIND_LABELS[income.transfer_kind as InternalTransferKind]
                    : "Transferência Interna"}
                </Badge>
              </dd>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Transferência interna pareada PF/PJ — somente leitura (exclua o par para corrigir).
            </p>
          </div>
        ) : isReadOnly ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Origem</dt>
            <dd className="flex items-center gap-1 font-medium text-foreground text-xs">
              <Sparkles className="size-3 text-positive-strong" aria-hidden="true" />
              Renda automática — somente leitura
            </dd>
          </div>
        ) : null}
      </dl>

      {hasAdvancedMetadata ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-xs py-2.5">
              Mais detalhes · Parcelas e rateio
            </AccordionTrigger>
            <AccordionContent>
              <dl className="flex flex-col gap-2 text-xs">
                {income.report_weight < 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Participação no relatório</dt>
                    <dd className="flex items-center gap-1 font-medium text-foreground">
                      <MoneyText cents={reportAmountCents} tone="default" variant="caption" />
                      <span className="font-mono tabular-nums">({Math.round(income.report_weight * 100)}%)</span>
                    </dd>
                  </div>
                ) : null}
                {isInstallment ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Parcela</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {income.installment_number}/{income.installments_total}
                    </dd>
                  </div>
                ) : null}
                {isRecurring ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Série</dt>
                    <dd className="font-medium text-foreground">Receita recorrente</dd>
                  </div>
                ) : null}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
