import { useState } from "react";
import { Alert, Button, DatePicker, FormField, Modal, ModalFooter, MoneyInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { formatDateBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsCurrency } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useSetManualPrice, useUpdatePortfolioAsset } from "@/state";
import type { FixedIncomeMetadata, PortfolioAsset } from "@/types";

export interface CalibrateFixedIncomeDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimatedValueCents?: number;
}

interface CalibrateFixedIncomeContentProps {
  asset: PortfolioAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimatedValueCents: number;
}

const CALIBRATE_FI_FORM_ID = "calibrate-fixed-income-form";

function CalibrateFixedIncomeContent({
  asset,
  open,
  onOpenChange,
  currentEstimatedValueCents,
}: CalibrateFixedIncomeContentProps) {
  const updateAsset = useUpdatePortfolioAsset();
  const setManualPrice = useSetManualPrice();

  const [statementBalanceCents, setStatementBalanceCents] = useState(currentEstimatedValueCents);
  const [baseDate, setBaseDate] = useState(() => todayISO());
  const [error, setError] = useState<string | null>(null);

  const pending = updateAsset.isPending || setManualPrice.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const newBalance = statementBalanceCents / 100;
    if (newBalance <= 0) {
      setError("Informe o saldo atual do extrato.");
      return;
    }

    try {
      const updatedFiMetadata: FixedIncomeMetadata = asset.fixed_income_metadata
        ? {
            ...asset.fixed_income_metadata,
            base_value: newBalance,
            base_date: baseDate,
            initial_investment_date:
              asset.fixed_income_metadata.initial_investment_date ??
              asset.fixed_income_metadata.base_date,
          }
        : {
            rate_type: "cdi",
            rate_value: 100,
            base_value: newBalance,
            base_date: baseDate,
            initial_investment_date: baseDate,
            maturity_date: null,
            is_tax_exempt: false,
          };

      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          quantity: 1,
          average_price: asset.average_price > 0 ? asset.average_price : newBalance,
          fixed_income_metadata: updatedFiMetadata,
        },
      });

      await setManualPrice.mutateAsync({
        ticker: asset.ticker,
        price: newBalance,
      });

      triggerSensory("success");
      pushToast({
        title: "Saldo calibrado com sucesso",
        description: `${asset.ticker} calibrado para ${formatCentsAsCurrency(statementBalanceCents, asset.currency)} em ${formatDateBR(baseDate)}.`,
      });

      onOpenChange(false);
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Calibrar com Extrato"
      description={`Redefina o saldo de ${asset.ticker} e reinicie o cálculo a partir do Marco Zero (D₀).`}
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="submit" form={CALIBRATE_FI_FORM_ID} disabled={pending} sensoryIntent={false}>
            {pending ? "Calibrando..." : "Confirmar Calibração"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={CALIBRATE_FI_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-1">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField
            label={`Saldo Atual do Extrato (${asset.currency ?? "BRL"})`}
            htmlFor="calib-balance"
            helperText="Este valor passará a ser a nova base de cálculo para a rentabilidade diária."
          >
            <MoneyInput
              id="calib-balance"
              cents={statementBalanceCents}
              onCentsChange={setStatementBalanceCents}
              placeholder="R$ 0,00"
              currency={asset.currency}
              aria-label="Saldo atual do extrato bancário"
              className="text-base sm:text-sm"
              showCalculatorAction
            />
          </FormField>

          <FormField
            label="Data do Extrato / Novo Marco Zero (D₀)"
            htmlFor="calib-base-date"
          >
            <DatePicker
              id="calib-base-date"
              value={baseDate}
              onValueChange={setBaseDate}
              placeholder="Selecione a data"
              ariaLabel="Data do extrato bancário"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Diálogo rápido para calibrar o saldo de um título de Renda Fixa
 * com o extrato bancário oficial e redefinir o Marco Zero (D₀).
 */
export function CalibrateFixedIncomeDialog({
  asset,
  open,
  onOpenChange,
  currentEstimatedValueCents = 0,
}: CalibrateFixedIncomeDialogProps) {
  if (!asset || !open) return null;

  return (
    <CalibrateFixedIncomeContent
      key={`${asset.id}-${currentEstimatedValueCents}`}
      asset={asset}
      open={open}
      onOpenChange={onOpenChange}
      currentEstimatedValueCents={currentEstimatedValueCents}
    />
  );
}
