import { useState } from "react";
import { Alert, Button, Modal, ModalFooter, MoneyInput } from "@/components/ui";
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
        {error ? (
          <Alert variant="error">{error}</Alert>
        ) : null}

        {autoVal !== null ? (
          <Alert variant="info">
            Fechamento de mercado oficial:{" "}
            <span className="font-semibold text-foreground">
              R$&nbsp;{autoVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {autoCost !== null ? (
              <span>
                {" "}(Custo: R$&nbsp;{autoCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            ) : null}
            . A calibração é não destrutiva e pode ser restaurada ao valor original a qualquer momento.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calibrate-total-value" className="text-xs font-semibold text-foreground">
              Patrimônio Total (R$)
            </label>
            <MoneyInput
              id="calibrate-total-value"
              cents={totalValueCents}
              onCentsChange={setTotalValueCents}
              className="text-base sm:text-sm"
              placeholder="0,00"
              showCalculatorAction
            />
            <span className="text-[11px] text-muted-foreground">
              Valor de mercado total da custódia + caixa.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="calibrate-total-cost" className="text-xs font-semibold text-foreground">
              Custo Total Aplicado (R$)
            </label>
            <MoneyInput
              id="calibrate-total-cost"
              cents={totalCostCents}
              onCentsChange={setTotalCostCents}
              className="text-base sm:text-sm"
              placeholder="0,00"
              showCalculatorAction
            />
            <span className="text-[11px] text-muted-foreground">
              Custo de aquisição total dos ativos + caixa.
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Diálogo modal para calibração manual não destrutiva de snapshot patrimonial (§F50/F51).
 * Permite ajustar pontualmente o valor e custo do mês fechado sem sobrescrever o fechamento original.
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
