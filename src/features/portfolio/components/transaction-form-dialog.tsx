import { useState } from "react";
import { Alert, Button, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { useCreatePortfolioTransaction } from "@/state";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset;
}

const TX_OPTIONS: { value: PortfolioTransactionType; label: string }[] = [
  { value: "buy", label: "Compra" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "jcp", label: "Juros sobre capital (JCP)" },
  { value: "fii_yield", label: "Rendimento de FII" },
  { value: "subscription", label: "Subscrição" },
  { value: "split", label: "Split (desdobramento)" },
  { value: "reverse_split", label: "Grupamento (reverse split)" },
];

const NEEDS_QTY_PRICE: readonly PortfolioTransactionType[] = ["buy", "sell", "subscription"];
const IS_DIVIDEND: readonly PortfolioTransactionType[] = ["dividend", "jcp", "fii_yield"];
const IS_SPLIT: readonly PortfolioTransactionType[] = ["split", "reverse_split"];

/** Registro de transação da carteira (§3.11.2) — alimenta o ledger derivado. */
export function TransactionFormDialog({ open, onOpenChange, asset }: TransactionFormDialogProps) {
  const createTx = useCreatePortfolioTransaction();
  const [type, setType] = useState<PortfolioTransactionType>("buy");
  const [date, setDate] = useState(() => todayISO());
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const withQtyPrice = NEEDS_QTY_PRICE.includes(type);
  const withAmount = IS_DIVIDEND.includes(type);
  const withFactor = IS_SPLIT.includes(type);

  const parseNumber = (raw: string): number => {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const totalPreview = withQtyPrice
    ? Math.round((Number.isFinite(parseNumber(quantity)) ? parseNumber(quantity) : 0) * (Number.isFinite(parseNumber(price)) ? parseNumber(price) : 0) * 100) / 100
    : withAmount
      ? amountCents / 100
      : 0;

  const canSubmit = !createTx.isPending && date !== "" && (withQtyPrice ? totalPreview > 0 : withAmount ? amountCents > 0 : withFactor ? parseNumber(quantity) > 0 : false);

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const base = { asset_id: asset.id, type, date };
      if (withQtyPrice) {
        await createTx.mutateAsync({ ...base, quantity: parseNumber(quantity), price: parseNumber(price), total: totalPreview });
      } else if (withAmount) {
        await createTx.mutateAsync({ ...base, quantity: 0, price: 0, total: amountCents / 100 });
      } else {
        await createTx.mutateAsync({ ...base, quantity: parseNumber(quantity), price: 0, total: 0 });
      }
      setType("buy");
      setDate(todayISO());
      setQuantity("");
      setPrice("");
      setAmountCents(0);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Transação · ${asset.ticker}`}
      description="O ledger e o caixa derivado são recalculados a partir das transações."
    >
      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Tipo de operação
          <Select
            value={type}
            onValueChange={(value) => setType(value as PortfolioTransactionType)}
            options={TX_OPTIONS}
            ariaLabel="Tipo de operação"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data
          <DatePicker value={date} onValueChange={setDate} ariaLabel="Data da transação" />
        </label>

        {withQtyPrice ? (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Quantidade
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Ex.: 10"
                aria-label="Quantidade"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Preço unitário ({asset.currency})
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Ex.: 42,50"
                aria-label="Preço unitário"
              />
            </label>
            <p className="num text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{totalPreview.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </p>
          </>
        ) : null}

        {withAmount ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Valor do provento
            <MoneyInput cents={amountCents} onCentsChange={setAmountCents} aria-label="Valor do provento" />
          </label>
        ) : null}

        {withFactor ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Fator ({type === "split" ? "2 = 2:1 (dobra cotas)" : "2 = 1:2 (reduz cotas)"})
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Ex.: 2"
              aria-label="Fator do desdobramento"
            />
          </label>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {createTx.isPending ? "Salvando…" : "Registrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
