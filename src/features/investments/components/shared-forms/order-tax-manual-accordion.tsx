import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  DatePicker,
  MoneyInput,
  PercentInput,
} from "@/components/ui";
import { numberToCents } from "@/domain/money";
import {
  computeEffectiveTaxRateFromAmount,
  type FixedIncomeRedemptionPreviewResult,
} from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { AssetCurrency } from "@/types";

export interface OrderTaxManualAccordionProps {
  preview: FixedIncomeRedemptionPreviewResult;
  currency?: AssetCurrency;
  customTaxRatePct?: number | null;
  customTaxAmountCents?: number | null;
  customInitialDate?: string | null;
  onCustomTaxChange: (patch: {
    customTaxRatePct?: number | null;
    customTaxAmountCents?: number | null;
    customInitialDate?: string | null;
  }) => void;
  idPrefix: string;
}

const TAX_RATE_PRESETS = [
  { label: "22,5%", rate: 22.5 },
  { label: "20%", rate: 20 },
  { label: "17,5%", rate: 17.5 },
  { label: "15%", rate: 15 },
  { label: "Isento (0%)", rate: 0 },
] as const;

export function OrderTaxManualAccordion({
  preview,
  currency = "BRL",
  customTaxRatePct = null,
  customTaxAmountCents = null,
  customInitialDate = null,
  onCustomTaxChange,
  idPrefix,
}: OrderTaxManualAccordionProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <Accordion
      type="single"
      collapsible
      value={editorOpen ? "tax-editor" : ""}
      onValueChange={(v) => setEditorOpen(v === "tax-editor")}
    >
      <AccordionItem value="tax-editor" className="border-border/60 bg-surface-raised/60">
        <AccordionTrigger
          aria-label="Ajustar alíquota e imposto de renda retido na fonte"
          className="min-h-10 px-3 py-2 text-xs font-medium"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              {editorOpen
                ? "Fechar Ajuste"
                : `Alíquota: ${formatPercent(preview.taxRatePct)}% (ajustar IRRF)`}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-1 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground">
              Ajuste Fiscal Manual (Nota de Corretagem)
            </span>
            {preview.isCustomized && (
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onCustomTaxChange({
                    customTaxRatePct: null,
                    customTaxAmountCents: null,
                    customInitialDate: null,
                  });
                }}
                className="flex items-center gap-1 text-[11px] text-primary-strong hover:underline cursor-pointer"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Restaurar Projeção</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`${idPrefix}-tax-rate`} className="text-[11px] font-medium text-foreground">
                Alíquota de IR (%):
              </label>
              <span className="text-[11px] text-muted-foreground">Regressiva</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TAX_RATE_PRESETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onCustomTaxChange({ customTaxRatePct: item.rate, customTaxAmountCents: null });
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer",
                    preview.taxRatePct === item.rate && customTaxAmountCents === null
                      ? "border-primary bg-primary/10 text-primary-strong font-bold"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <PercentInput
              id={`${idPrefix}-tax-rate`}
              value={customTaxRatePct !== null ? customTaxRatePct : preview.taxRatePct}
              onValueChange={(val) => {
                onCustomTaxChange({
                  customTaxRatePct: Math.max(0, Math.min(100, val)),
                  customTaxAmountCents: null,
                });
              }}
              aria-label="Alíquota personalizada de imposto de renda"
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label htmlFor={`${idPrefix}-tax-irrf`} className="text-[11px] font-medium text-foreground">
                IRRF Retido na Fonte ({currency}):
              </label>
              <span className="text-[11px] text-muted-foreground">Valor na corretora</span>
            </div>
            <MoneyInput
              id={`${idPrefix}-tax-irrf`}
              cents={customTaxAmountCents !== null ? customTaxAmountCents : numberToCents(preview.taxAmount)}
              currency={currency}
              onCentsChange={(cents) => {
                onCustomTaxChange({
                  customTaxAmountCents: cents,
                  customTaxRatePct:
                    preview.realizedProfit > 0
                      ? computeEffectiveTaxRateFromAmount(cents / 100, preview.realizedProfit)
                      : customTaxRatePct,
                });
              }}
              placeholder="R$ 0,00"
              aria-label="Valor de imposto de renda retido na fonte"
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label htmlFor={`${idPrefix}-tax-initial-date`} className="text-[11px] font-medium text-foreground">
                Data da Aplicação Original (Marco Zero de IR):
              </label>
              <span className="text-[11px] text-muted-foreground">Tabela regressiva</span>
            </div>
            <DatePicker
              id={`${idPrefix}-tax-initial-date`}
              value={customInitialDate ?? preview.initialInvestmentDate ?? ""}
              onValueChange={(val) => {
                onCustomTaxChange({
                  customInitialDate: val || null,
                  customTaxRatePct: null,
                  customTaxAmountCents: null,
                });
              }}
              placeholder="Data da primeira aplicação"
              className="text-base sm:text-sm"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
