import { useState } from "react";
import { Alert, Button, DatePicker, Modal, MoneyInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { useSetManualPrice, useUpdatePortfolioAsset } from "@/state";
import type { FixedIncomeMetadata, PortfolioAsset } from "@/types";

export interface CalibrateFixedIncomeDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimatedValueCents?: number;
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
  const updateAsset = useUpdatePortfolioAsset();
  const setManualPrice = useSetManualPrice();

  const [statementBalanceCents, setStatementBalanceCents] = useState(currentEstimatedValueCents);
  const [baseDate, setBaseDate] = useState(() => todayISO());
  const [error, setError] = useState<string | null>(null);

  if (!asset) return null;

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
              asset.fixed_income_metadata.initial_investment_date ?? asset.fixed_income_metadata.base_date,
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

      // Atualiza override manual de preço/cotação
      await setManualPrice.mutateAsync({
        ticker: asset.ticker,
        price: newBalance,
      });

      onOpenChange(false);
    } catch (err) {
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
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="calib-balance" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saldo Atual do Extrato ({asset.currency ?? "BRL"})
          </label>
          <MoneyInput
            id="calib-balance"
            cents={statementBalanceCents}
            onCentsChange={setStatementBalanceCents}
            placeholder="R$ 0,00"
            currency={asset.currency}
            aria-label="Saldo atual do extrato bancário"
          />
          <span className="text-[11px] text-muted-foreground">
            Este valor passará a ser a nova base de cálculo para a rentabilidade diária.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Data do Extrato / Novo Marco Zero (D₀)
          </span>
          <DatePicker
            value={baseDate}
            onValueChange={setBaseDate}
            placeholder="Selecione a data"
            ariaLabel="Data do extrato bancário"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateAsset.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={updateAsset.isPending}>
            {updateAsset.isPending ? "Calibrando..." : "Confirmar Calibração"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
