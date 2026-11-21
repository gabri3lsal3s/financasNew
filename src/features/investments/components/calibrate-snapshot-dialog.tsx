import { useState } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  FormField,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  Select,
  type SelectOption,
} from "@/components/ui";
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
  isNew?: boolean;
}

export interface CalibrateSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SnapshotCalibrationData | null;
  onDelete?: (month: string) => Promise<void> | void;
}

interface CalibrateSnapshotFormProps {
  snapshot: SnapshotCalibrationData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onDelete?: (month: string) => Promise<void> | void;
}

const MONTH_OPTIONS: SelectOption[] = [
  { value: "01", label: "01 - Janeiro" },
  { value: "02", label: "02 - Fevereiro" },
  { value: "03", label: "03 - Março" },
  { value: "04", label: "04 - Abril" },
  { value: "05", label: "05 - Maio" },
  { value: "06", label: "06 - Junho" },
  { value: "07", label: "07 - Julho" },
  { value: "08", label: "08 - Agosto" },
  { value: "09", label: "09 - Setembro" },
  { value: "10", label: "10 - Outubro" },
  { value: "11", label: "11 - Novembro" },
  { value: "12", label: "12 - Dezembro" },
];

const currentYearNum = new Date().getFullYear();
const YEAR_OPTIONS: SelectOption[] = Array.from({ length: 10 }, (_, i) => {
  const yr = String(currentYearNum - i);
  return { value: yr, label: yr };
});

function CalibrateSnapshotForm({
  snapshot,
  open,
  onOpenChange,
  onClose,
  onDelete,
}: CalibrateSnapshotFormProps) {
  const calibrateMutation = useCalibratePortfolioSnapshot();

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    snapshot.month && snapshot.month.length >= 4
      ? snapshot.month.slice(0, 4)
      : String(currentYearNum),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    snapshot.month && snapshot.month.length >= 7 ? snapshot.month.slice(5, 7) : "01",
  );
  const [totalValueCents, setTotalValueCents] = useState<number>(() =>
    numberToCents(snapshot.valueBRL),
  );
  const [totalCostCents, setTotalCostCents] = useState<number>(() =>
    numberToCents(snapshot.costBRL),
  );
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const targetMonth = snapshot.isNew ? `${selectedYear}-${selectedMonth}` : snapshot.month;

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
        month: targetMonth,
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
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={
          snapshot.isNew
            ? "Adicionar Fechamento Mensal"
            : `Calibrar Mês ${formatMonthYear(snapshot.month)}`
        }
        description={
          snapshot.isNew
            ? "Informe a competência e o saldo da carteira para preencher o histórico patrimonial e de rentabilidade."
            : "Ajuste o valor de mercado e o custo deste mês. O valor original gravado no fechamento permanecerá intacto."
        }
        size="md"
        showCalculator
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              onDelete && !snapshot.isNew ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={calibrateMutation.isPending}
                >
                  Excluir Registro
                </Button>
              ) : undefined
            }
          >
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
              {calibrateMutation.isPending
                ? "Salvando..."
                : snapshot.isNew
                  ? "Adicionar Fechamento"
                  : "Salvar Calibração"}
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

          {snapshot.isNew ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField
                label="Mês de Competência"
                htmlFor="calibrate-month-select"
                helperText="Mês do fechamento patrimonial."
              >
                <Select
                  id="calibrate-month-select"
                  value={selectedMonth}
                  onValueChange={setSelectedMonth}
                  options={MONTH_OPTIONS}
                  ariaLabel="Selecione o mês"
                />
              </FormField>

              <FormField
                label="Ano de Competência"
                htmlFor="calibrate-year-select"
                helperText="Ano de referência da carteira."
              >
                <Select
                  id="calibrate-year-select"
                  value={selectedYear}
                  onValueChange={setSelectedYear}
                  options={YEAR_OPTIONS}
                  ariaLabel="Selecione o ano"
                />
              </FormField>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField
              label="Patrimônio Total (R$)"
              htmlFor="calibrate-total-value"
              helperText="Valor de mercado total da custódia + caixa no fechamento."
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

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        elevated
        title="Excluir Fechamento Mensal"
        description={`Tem certeza que deseja remover o fechamento de ${formatMonthYear(snapshot.month)}? A competência permanecerá na linha do tempo como 'sem snapshot' com rentabilidade neutra (0,00%), sem perda de ativos ou movimentações. Você poderá preencher o saldo novamente quando quiser.`}
        confirmLabel="Excluir Fechamento"
        variant="destructive"
        confirmPending={isDeleting}
        onConfirm={async () => {
          if (!onDelete) return;
          setIsDeleting(true);
          try {
            await onDelete(snapshot.month);
            setShowDeleteConfirm(false);
            onClose();
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
}

/**
 * Diálogo modal para calibração manual e adição não destrutiva de snapshot patrimonial (§F50/F51).
 */
export function CalibrateSnapshotDialog({
  open,
  onOpenChange,
  snapshot,
  onDelete,
}: CalibrateSnapshotDialogProps) {
  if (!snapshot || !open) return null;

  return (
    <CalibrateSnapshotForm
      key={snapshot.isNew ? "new-snapshot" : snapshot.month}
      snapshot={snapshot}
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
      onDelete={onDelete}
    />
  );
}
