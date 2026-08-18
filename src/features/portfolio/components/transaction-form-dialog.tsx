import { useState } from "react";
import { Alert, Button, ConfirmDialog, Modal, MoneyInput, NumberStepperInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreatePortfolioTransaction, useDeletePortfolioTransaction, useUpdatePortfolioTransaction } from "@/state";
import { numberToCents } from "@/domain/money";
import type { DbInsert, PortfolioAsset, PortfolioTransaction, PortfolioTransactionType } from "@/types";

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset;
  /** Transação em edição — quando informada, o diálogo salva (update) em vez de criar. */
  transaction?: PortfolioTransaction | null;
}

interface TransactionFormContentProps {
  asset: PortfolioAsset;
  transaction?: PortfolioTransaction | null;
  onClose: () => void;
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

function TransactionFormContent({ asset, transaction = null, onClose }: TransactionFormContentProps) {
  const createTx = useCreatePortfolioTransaction();
  const updateTx = useUpdatePortfolioTransaction();
  const deleteTx = useDeletePortfolioTransaction();

  const [type, setType] = useState<PortfolioTransactionType>(transaction?.type ?? "buy");
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [quantity, setQuantity] = useState(transaction ? String(transaction.quantity) : "");
  const [price, setPrice] = useState(transaction ? String(transaction.price) : "");
  const [amountCents, setAmountCents] = useState(transaction ? numberToCents(transaction.total) : 0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = transaction !== null;
  const pending = createTx.isPending || updateTx.isPending || deleteTx.isPending;

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

  const canSubmit = !pending && date !== "" && (withQtyPrice ? totalPreview > 0 : withAmount ? amountCents > 0 : withFactor ? parseNumber(quantity) > 0 : false);

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const base = { asset_id: asset.id, type, date };
      let payload: Omit<DbInsert<PortfolioTransaction>, "user_id">;
      if (withQtyPrice) {
        payload = { ...base, quantity: parseNumber(quantity), price: parseNumber(price), total: totalPreview };
      } else if (withAmount) {
        payload = { ...base, quantity: 0, price: 0, total: amountCents / 100 };
      } else {
        payload = { ...base, quantity: parseNumber(quantity), price: 0, total: 0 };
      }
      if (isEdit && transaction) {
        await updateTx.mutateAsync({ id: transaction.id, patch: payload });
      } else {
        await createTx.mutateAsync(payload);
      }
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDeleteTx = async () => {
    if (!transaction) return;
    setError(null);
    try {
      await deleteTx.mutateAsync(transaction.id);
      triggerSensory("destructive");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            void submit();
          }
        }}
        className="mt-4 flex flex-col gap-4"
      >
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
              <NumberStepperInput
                value={quantity}
                step={1}
                min={0}
                onValueChange={setQuantity}
                placeholder="Ex.: 10"
                ariaLabel="Quantidade"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Preço unitário ({asset.currency})
              <NumberStepperInput
                value={price}
                step={0.01}
                min={0}
                onValueChange={setPrice}
                placeholder="Ex.: 42,50"
                ariaLabel="Preço unitário"
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
            <NumberStepperInput
              value={quantity}
              step={1}
              min={0}
              onValueChange={setQuantity}
              placeholder="Ex.: 2"
              ariaLabel="Fator do desdobramento"
            />
          </label>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex items-center justify-between gap-2">
          {isEdit ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
              Excluir lançamento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir lançamento?"
        description="A transação será removida e o ledger da posição recalculado automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteTx.isPending}
        onConfirm={() => void confirmDeleteTx()}
      />
    </>
  );
}

/** Registro/edição de transação da carteira (§3.11.2) — alimenta o ledger derivado. */
export function TransactionFormDialog({ open, onOpenChange, asset, transaction = null }: TransactionFormDialogProps) {
  const isEdit = transaction !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Transação · ${asset.ticker}`}
      description={
        isEdit
          ? "Atualize a operação — o ledger e o caixa derivado são recalculados a partir das transações."
          : "O ledger e o caixa derivado são recalculados a partir das transações."
      }
    >
      {open ? (
        <TransactionFormContent
          key={transaction?.id ?? "new-tx"}
          asset={asset}
          transaction={transaction}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
