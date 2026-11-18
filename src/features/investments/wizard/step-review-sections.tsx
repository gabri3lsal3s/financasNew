import { MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { ALLOCATION_STATUS_META, getScoreConvictionMeta, type InvestmentPreviewResult } from "@/domain/portfolio";
import { formatDateBR, formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { AssetCurrency } from "@/types";
import type { InvestmentWizardState } from "./wizard-state";

export function ReviewOrderTotalRow({
  label,
  currency,
  preview,
  positive = false,
}: {
  label: string;
  currency: AssetCurrency;
  preview: InvestmentPreviewResult;
  positive?: boolean;
}) {
  const nativeVal = preview.totalOrderValueNative ?? preview.totalOrderValueBRL;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex flex-col items-end">
        {currency === "USD" && preview.totalOrderValueNative !== undefined ? (
          <>
            <MoneyText
              cents={numberToCents(nativeVal)}
              currency="USD"
              tone={positive ? "positive" : "default"}
              className="text-base font-bold"
            />
            <span className="text-[11px] text-muted-foreground font-mono">
              (<MoneyText cents={numberToCents(preview.totalOrderValueBRL)} currency="BRL" variant="caption" tone="default" className="inline" />)
            </span>
          </>
        ) : (
          <MoneyText
            cents={numberToCents(preview.totalOrderValueBRL)}
            currency="BRL"
            tone={positive ? "positive" : "default"}
            className="text-base font-bold"
          />
        )}
      </div>
    </div>
  );
}

export function ReviewNewAssetGovernanceSummary({
  state,
  isFixedIncome,
}: {
  state: InvestmentWizardState;
  isFixedIncome: boolean;
}) {
  return (
    <div className="mt-2 pt-2.5 border-t border-border/60 flex flex-col gap-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Nota de Convicção:</span>
        <span className="font-semibold text-foreground">
          {state.score !== null
            ? `Nota ${state.score}/10 (${getScoreConvictionMeta(state.score).label})`
            : "Sem nota (peso neutro 5)"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Status na Carteira:</span>
        <span className="font-semibold text-foreground">
          {ALLOCATION_STATUS_META[state.allocationStatus].label}
        </span>
      </div>
      {isFixedIncome && state.isEmergencyFund && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Reserva de Emergência:</span>
          <span className="font-semibold text-positive-strong">Incluído automaticamente</span>
        </div>
      )}
      {state.thesisSummary.trim().length > 0 && (
        <div className="flex flex-col gap-0.5 pt-1">
          <span className="text-muted-foreground">Tese resumida:</span>
          <span className="text-foreground line-clamp-2">{state.thesisSummary.trim()}</span>
        </div>
      )}
    </div>
  );
}

export function ReviewDividendAndSplitSections({
  state,
  preview,
}: {
  state: InvestmentWizardState;
  preview: InvestmentPreviewResult;
}) {
  if (state.mode === "dividend") {
    const formattedDate =
      state.dividendEntryMode === "monthly" ? formatMonthYear(state.month) : formatDateBR(state.date);
    return (
      <div className="pt-3 flex flex-col gap-2 text-xs">
        <ReviewOrderTotalRow label="Valor Total Recebido:" currency={state.currency} preview={preview} positive />
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          <span>{state.dividendEntryMode === "monthly" ? "Competência:" : "Data do Pagamento:"}</span>
          <span className="font-mono font-medium text-foreground">{formattedDate}</span>
        </div>
        {state.syncCash && (
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Crédito em Caixa (R$):</span>
            <span className="font-mono text-positive-strong">
              + <MoneyText cents={numberToCents(preview.cashCreditBRL ?? preview.totalOrderValueBRL)} currency="BRL" variant="caption" tone="positive" className="inline" />
            </span>
          </div>
        )}
      </div>
    );
  }

  if (state.mode === "split" || state.mode === "reverse_split") {
    const isReverse = state.mode === "reverse_split";
    const ratioLabel =
      state.splitFromStr && state.splitToStr
        ? `${state.splitFromStr} para ${state.splitToStr}`
        : isReverse
          ? `${state.reverseSplitFactor} para 1`
          : `1 para ${state.splitFactor}`;

    return (
      <div className="pt-3 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {isReverse ? "Fator do Grupamento:" : "Fator do Desdobramento:"}
          </span>
          <span className="font-mono font-bold text-foreground">{ratioLabel}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          <span>Data do Evento:</span>
          <span className="font-mono font-medium text-foreground">{formatDateBR(state.date)}</span>
        </div>
        <div className={cn("grid grid-cols-2 gap-3 py-2.5 text-xs bg-surface-raised/60 -mx-4 px-4 rounded-lg")}>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Nova Quantidade</span>
            <span className="font-mono font-bold text-primary-strong">{preview.newQuantity} cotas</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-muted-foreground">Novo Preço Médio</span>
            <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} className="font-bold text-primary-strong" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
