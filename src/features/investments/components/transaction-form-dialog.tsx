import { useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Modal, ModalFooter, MoneyInput, MoneyText, NumberStepperInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import { isCashAssetClass } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useCreatePortfolioContribution,
  useCreatePortfolioTransaction,
  useDeletePortfolioContribution,
  useDeletePortfolioTransaction,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioPosition,
  useUpdatePortfolioAsset,
  useUpdatePortfolioContribution,
  useUpdatePortfolioTransaction,
} from "@/state";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import type { DbInsert, PortfolioAsset, PortfolioContribution, PortfolioTransaction, PortfolioTransactionType } from "@/types";

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset;
  /** Transação em edição — quando informada, o diálogo salva (update) em vez de criar. */
  transaction?: PortfolioTransaction | null;
  /** Aporte vinculado conhecido (quando aberto a partir do extrato com via aporte). */
  linkedContribution?: PortfolioContribution;
}

interface TransactionFormContentProps {
  asset: PortfolioAsset;
  transaction?: PortfolioTransaction | null;
  linkedContribution?: PortfolioContribution;
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

export type FundingSource = "pocket" | "cash";

function TransactionFormContent({
  asset,
  transaction = null,
  linkedContribution = undefined,
  onClose,
}: TransactionFormContentProps) {
  const createTx = useCreatePortfolioTransaction();
  const updateTx = useUpdatePortfolioTransaction();
  const deleteTx = useDeletePortfolioTransaction();
  const createContrib = useCreatePortfolioContribution();
  const updateContrib = useUpdatePortfolioContribution();
  const deleteContrib = useDeletePortfolioContribution();
  const updateAsset = useUpdatePortfolioAsset();
  const assetsQuery = usePortfolioAssets();
  const contributionsQuery = usePortfolioContributions();
  const positionQuery = usePortfolioPosition();

  const usdRate = positionQuery.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25;

  const allAssets = assetsQuery.data ?? [];
  const cashAsset = allAssets.find((a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class));
  const cashBalance = typeof cashAsset?.quantity === "number" ? cashAsset.quantity : 0;

  // Localiza contribuição associada se não foi passada diretamente
  const existingContribution = useMemo(() => {
    if (linkedContribution) return linkedContribution;
    if (!transaction || transaction.type !== "buy") return undefined;
    return (contributionsQuery.data ?? []).find(
      (c) => c.asset_id === asset.id && c.date === transaction.date,
    );
  }, [linkedContribution, transaction, asset.id, contributionsQuery.data]);

  const [type, setType] = useState<PortfolioTransactionType>(transaction?.type ?? "buy");
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [quantity, setQuantity] = useState(transaction ? String(transaction.quantity) : "");
  const [price, setPrice] = useState(transaction ? String(transaction.price) : "");
  const [amountCents, setAmountCents] = useState(transaction ? numberToCents(transaction.total) : 0);

  // Origem dos recursos para compras: se tem contribuição vinculada, foi pocket; senão cash
  const [fundingSource, setFundingSource] = useState<FundingSource>(() => {
    if (transaction?.type === "buy") {
      return existingContribution ? "pocket" : "cash";
    }
    return cashBalance > 0 ? "cash" : "pocket";
  });

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = transaction !== null;
  const pending =
    createTx.isPending ||
    updateTx.isPending ||
    deleteTx.isPending ||
    createContrib.isPending ||
    updateContrib.isPending ||
    deleteContrib.isPending ||
    updateAsset.isPending;

  const withQtyPrice = NEEDS_QTY_PRICE.includes(type);
  const withAmount = IS_DIVIDEND.includes(type);
  const withFactor = IS_SPLIT.includes(type);

  const parseNumber = parseDecimalNumber;

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

      // Converte totalPreview para BRL se for USD
      const totalBRL =
        asset.currency === "USD" ? Math.round(totalPreview * usdRate * 100) / 100 : totalPreview;

      if (isEdit && transaction) {
        await updateTx.mutateAsync({ id: transaction.id, patch: payload });

        // Se for compra, reconcilia a origem dos recursos (Pocket vs Cash)
        if (type === "buy") {
          const wasPocket = Boolean(existingContribution);
          const isNowPocket = fundingSource === "pocket";

          if (wasPocket && !isNowPocket) {
            // Mudou de Bolso para Caixa: remove aporte e debita Caixa
            if (existingContribution) {
              await deleteContrib.mutateAsync(existingContribution);
            }
            if (cashAsset) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.max(0, Math.round((currentBal - totalBRL) * 100) / 100);
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          } else if (!wasPocket && isNowPocket) {
            // Mudou de Caixa para Bolso: cria aporte e estorna Caixa
            await createContrib.mutateAsync({
              asset_id: asset.id,
              date,
              amount: totalBRL,
              notes: `Aporte · Compra de ${asset.ticker}`,
            });
            if (cashAsset) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.round((currentBal + totalBRL) * 100) / 100;
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          } else if (wasPocket && isNowPocket && existingContribution) {
            // Continuou Pocket: atualiza valor e data do aporte vinculado se mudaram
            if (existingContribution.amount !== totalBRL || existingContribution.date !== date) {
              await updateContrib.mutateAsync({
                id: existingContribution.id,
                input: { amount: totalBRL, date },
              });
            }
          } else if (!wasPocket && !isNowPocket && cashAsset) {
            // Continuou Caixa: ajusta o saldo do Caixa pela diferença de valor
            const prevTotalBRL =
              asset.currency === "USD" ? Math.round(transaction.total * usdRate * 100) / 100 : transaction.total;
            const delta = totalBRL - prevTotalBRL;
            if (delta !== 0) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.max(0, Math.round((currentBal - delta) * 100) / 100);
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          }
        }
      } else {
        // Nova transação
        await createTx.mutateAsync(payload);

        if (type === "buy") {
          if (fundingSource === "pocket") {
            await createContrib.mutateAsync({
              asset_id: asset.id,
              date,
              amount: totalBRL,
              notes: `Aporte · Compra de ${asset.ticker}`,
            });
          } else if (fundingSource === "cash" && cashAsset) {
            const currentBal = Number(cashAsset.quantity ?? 0);
            const newBal = Math.max(0, Math.round((currentBal - totalBRL) * 100) / 100);
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: { quantity: newBal, average_price: 1 },
            });
          }
        }
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
        className="mt-4 flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Tipo de operação
            <Select
              value={type}
              onValueChange={(value) => setType(value as PortfolioTransactionType)}
              options={TX_OPTIONS}
              ariaLabel="Tipo de operação"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Data
            <DatePicker value={date} onValueChange={setDate} ariaLabel="Data da transação" />
          </label>
        </div>

        {withQtyPrice ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
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
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
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
            </div>
            <p className="num text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground"><MoneyText cents={numberToCents(totalPreview)} currency={asset.currency} /></span>
            </p>

            {/* Seletor exclusivo de Origem dos Recursos para Compras */}
            {type === "buy" && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-subtle p-3 text-xs">
                <span className="font-semibold text-foreground">Origem dos recursos desta compra:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("pocket");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "pocket"
                        ? "border-positive-strong bg-positive/10 text-positive-strong font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Dinheiro Novo (Aporte do Bolso)</div>
                    <div className="text-[10px] opacity-80">Transferido da conta corrente (não altera o Caixa)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("cash");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "cash"
                        ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Saldo da Corretora (Caixa)</div>
                    <div className="text-[10px] opacity-80">
                      Disponível: R$ {cashBalance.toFixed(2)} (abate do saldo em Caixa)
                    </div>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {withAmount ? (
          <label htmlFor="transaction-dividend-amount" className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Valor do provento ({asset.currency})
            <MoneyInput
              id="transaction-dividend-amount"
              cents={amountCents}
              currency={asset.currency}
              onCentsChange={setAmountCents}
              placeholder={asset.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
              aria-label="Valor do provento"
            />
          </label>
        ) : null}

        {withFactor ? (
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
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

        <ModalFooter className="sm:justify-between">
          {isEdit ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
              Excluir lançamento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </ModalFooter>
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
export function TransactionFormDialog({
  open,
  onOpenChange,
  asset,
  transaction = null,
  linkedContribution = undefined,
}: TransactionFormDialogProps) {
  const isEdit = transaction !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Transação · ${asset.ticker}`}
      description={
        isEdit
          ? "Atualize a operação — o ledger, aportes vinculados e caixa derivado são recalculados."
          : "O ledger e o caixa derivado são recalculados a partir das transações."
      }
      size="lg"
      showCalculator
    >
      {open ? (
        <TransactionFormContent
          key={transaction?.id ?? "new-tx"}
          asset={asset}
          transaction={transaction}
          linkedContribution={linkedContribution}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
