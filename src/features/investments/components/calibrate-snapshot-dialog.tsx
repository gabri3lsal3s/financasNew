import { useState } from "react";
import { Alert, Button, FormField, Modal, ModalFooter, MoneyInput, MoneyText } from "@/components/ui";
import { formatMonthYear } from "@/lib/date";
import { numberToCents } from "@/domain/money";
import { useCalibratePortfolioSnapshot } from "@/state";
import { getErrorMessage } from "@/services/errors";

export interface SnapshotCalibrationData {
  month: string;
  valueBRL: number;
  costBRL: number;
  autoTotalValue?: number | null;
  autoTotalCost?: number | null;
  isManuallyCalibrated?: boolean;
}

export interface CalibrateSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SnapshotCalibrationData | null;
}

interface CalibrateSnapshotFormProps {
  snapshot: SnapshotCalibrationData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

function CalibrateSnapshotForm({ snapshot, open, onOpenChange, onClose }: CalibrateSnapshotFormProps) {
  const calibrateMutation = useCalibratePortfolioSnapshot();

  const [totalValueCents, setTotalValueCents] = useState<number>(() =>
    numberToCents(snapshot.valueBRL),
  );
  const [totalCostCents, setTotalCostCents] = useState<number>(() =>
    numberToCents(snapshot.costBRL),
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = totalValueCents / 100;
    const cost = totalCostCents / 100;

    if (val < 0 || cost < 0) {
      setError("Os valores de patrimônio e custo não podem ser negativos.");
      return;
    }

    try {
      await calibrateMutation.mutateAsync({
        month: snapshot.month,
        total_value: val,
        total_cost: cost,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const autoVal = snapshot.autoTotalValue != null ? snapshot.autoTotalValue : null;
  const autoCost = snapshot.autoTotalCost != null ? snapshot.autoTotalCost : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Calibrar Mês ${formatMonthYear(snapshot.month)}`}
      description="Ajuste o valor de mercado e o custo deste mês. O valor original gravado no fechamento permanecerá intacto."
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={calibrateMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="calibrate-snapshot-form"
            variant="portfolio"
            disabled={calibrateMutation.isPending}
          >
            {calibrateMutation.isPending ? "Salvando..." : "Salvar Calibração"}
          </Button>
        </ModalFooter>
      }
    >
      <form id="calibrate-snapshot-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {autoVal !== null ? (
          <Alert variant="info">
            Fechamento de mercado oficial:{" "}
            <MoneyText cents={numberToCents(autoVal)} tone="default" className="font-semibold" />
            {autoCost !== null ? (
              <span>
                {" "}
                (Custo:{" "}
                <MoneyText cents={numberToCents(autoCost)} tone="default" variant="caption" />)
              </span>
            ) : null}
            . A calibração é não destrutiva e pode ser restaurada ao valor original a qualquer momento.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField
            label="Patrimônio Total (R$)"
            htmlFor="calibrate-total-value"
            helperText="Valor de mercado total da custódia + caixa."
          >
            <MoneyInput
              id="calibrate-total-value"
              cents={totalValueCents}
              onCentsChange={setTotalValueCents}
              className="text-base sm:text-sm"
              placeholder="0,00"
              showCalculatorAction
            />
          </FormField>

          <FormField
            label="Custo Total Aplicado (R$)"
            htmlFor="calibrate-total-cost"
            helperText="Custo de aquisição total dos ativos + caixa."
          >
            <MoneyInput
              id="calibrate-total-cost"
              cents={totalCostCents}
              onCentsChange={setTotalCostCents}
              className="text-base sm:text-sm"
              placeholder="0,00"
              showCalculatorAction
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Diálogo modal para calibração manual não destrutiva de snapshot patrimonial (§F50/F51).
 */
export function CalibrateSnapshotDialog({
  open,
  onOpenChange,
  snapshot,
}: CalibrateSnapshotDialogProps) {
  if (!snapshot || !open) return null;

  return (
    <CalibrateSnapshotForm
      key={snapshot.month}
      snapshot={snapshot}
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
    />
  );
}
