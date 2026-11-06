import { useState, useMemo } from "react";
import { Alert, Button, Checkbox, Input, Modal, ModalFooter, MoneyInput, MoneyText, NumericInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker } from "@/components/modules";
import { todayISO } from "@/domain/debts";
import { currentMonth } from "@/lib/date";
import { numberToCents } from "@/domain/money";
import { resolveDividendDate, resolveDividendNote, type DividendEntryMode } from "@/domain/portfolio/dividends";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { usePortfolioAssets, useRecordOrder, useUpdatePortfolioDividend } from "@/state";
import type { PortfolioDividend } from "@/types";

export interface DividendFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssetId?: string;
  dividend?: PortfolioDividend | null;
}

interface DividendFormContentProps {
  defaultAssetId?: string;
  dividend?: PortfolioDividend | null;
  onClose: () => void;
}

const DIVIDEND_OPTIONS: { value: string; label: string }[] = [
  { value: "dividend", label: "Dividendo" },
  { value: "jcp", label: "Juros sobre capital próprio (JCP)" },
  { value: "fii_yield", label: "Rendimento de FII" },
];

function DividendFormContent({ defaultAssetId, dividend = null, onClose }: DividendFormContentProps) {
  const assetsQuery = usePortfolioAssets();
  const recordOrder = useRecordOrder();
  const updateDividend = useUpdatePortfolioDividend();
  const isEdit = Boolean(dividend);

  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const [selectedAssetId, setSelectedAssetId] = useState(dividend?.asset_id ?? defaultAssetId ?? (assets[0]?.id ?? ""));
  const [type, setType] = useState("dividend");

  // Modo de registro de data: Diário (data exata) ou Extrato do Mês (competência)
  const [entryMode, setEntryMode] = useState<DividendEntryMode>("daily");
  const [date, setDate] = useState(dividend?.date ?? todayISO());
  const [month, setMonth] = useState(dividend ? dividend.date.slice(0, 7) : currentMonth());

  const [amountCents, setAmountCents] = useState(dividend ? numberToCents(dividend.amount) : 0);
  const [notes, setNotes] = useState(dividend?.notes ?? "");
  const [syncCash, setSyncCash] = useState(dividend ? Boolean(dividend.sync_cash) : true);
  const [error, setError] = useState<string | null>(null);

  const cashAsset = useMemo(
    () => assets.find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") ?? null,
    [assets],
  );

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? assets[0];
  const assetQuantity = selectedAsset?.quantity ?? 0;

  const [inputMode, setInputMode] = useState<"total" | "per_share">("total");
  const [perShareCents, setPerShareCents] = useState(0);
  const [customQuantityStr, setCustomQuantityStr] = useState(assetQuantity > 0 ? String(assetQuantity) : "1");

  const effectiveQty = inputMode === "per_share"
    ? (assetQuantity > 0 ? assetQuantity : Number(customQuantityStr) || 1)
    : 1;

  const handlePerShareChange = (cents: number) => {
    setPerShareCents(cents);
    setAmountCents(Math.round(cents * effectiveQty));
  };

  const handleCustomQtyChange = (qtyStr: string) => {
    setCustomQuantityStr(qtyStr);
    const qty = Number(qtyStr) || 0;
    setAmountCents(Math.round(perShareCents * qty));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) {
      setError("Selecione um ativo para vincular o provento.");
      return;
    }
    if (amountCents <= 0) {
      setError("Informe o valor do provento recebido.");
      return;
    }

    try {
      // Resolve data e nota conforme o modo de entrada
      const rawDateValue = entryMode === "monthly" ? month : date;
      const resolvedDate = resolveDividendDate(entryMode, rawDateValue);
      const assetCurrency = selectedAsset.currency ?? "BRL";
      const symbol = assetCurrency === "USD" ? "$" : "R$";

      const perShareNote = inputMode === "per_share" && perShareCents > 0
        ? ` (${symbol} ${(perShareCents / 100).toFixed(2)}/cota x ${effectiveQty})`
        : "";
      const userNote = notes.trim() ? `${notes.trim()}${perShareNote}` : perShareNote.trim();
      const resolvedNote = resolveDividendNote(entryMode, userNote, type);

      if (isEdit && dividend) {
        const newAmount = amountCents / 100;
        await updateDividend.mutateAsync({
          id: dividend.id,
          patch: {
            asset_id: selectedAsset.id,
            ticker: selectedAsset.ticker,
            date: resolvedDate,
            amount: newAmount,
            notes: resolvedNote || null,
            sync_cash: syncCash,
            cash_amount: syncCash ? newAmount : null,
          },
          syncCash,
          previousSyncCash: Boolean(dividend.sync_cash),
          previousCashAmount: dividend.cash_amount ?? dividend.amount,
        });

        pushToast({
          title: "Provento atualizado",
          description: `${selectedAsset.ticker} · ${symbol} ${newAmount.toFixed(2)} atualizado com sucesso.`,
        });
      } else {
        await recordOrder.mutateAsync({
          asset: selectedAsset,
          type: type as "dividend" | "jcp" | "fii_yield",
          date: resolvedDate,
          quantity: 0,
          price: 0,
          total: amountCents / 100,
          syncCash,
          cashAsset,
          notes: resolvedNote,
        });

        triggerSensory("success");
        pushToast({
          title: "Provento registrado",
          description: `${selectedAsset.ticker} · ${symbol} ${(amountCents / 100).toFixed(2)} registrado com sucesso.`,
        });
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const assetCurrency = selectedAsset?.currency ?? "BRL";

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">Ativo</span>
        <Select
          value={selectedAsset?.id ?? ""}
          onValueChange={(id) => {
            setSelectedAssetId(id);
            const nextAsset = assets.find((a) => a.id === id);
            if (nextAsset && inputMode === "per_share") {
              const nextQty = nextAsset.quantity > 0 ? nextAsset.quantity : Number(customQuantityStr) || 1;
              setAmountCents(Math.round(perShareCents * nextQty));
            }
          }}
          options={assets.map((a) => ({
            value: a.id,
            label: `${a.ticker} — ${a.asset_class ?? "Sem classe"} (${a.quantity ?? 0} cotas)`,
          }))}
          aria-label="Selecionar ativo do provento"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">Tipo de Provento</span>
        <Select
          value={type}
          onValueChange={setType}
          options={DIVIDEND_OPTIONS}
          aria-label="Tipo de provento"
        />
      </div>

      {/* Alternador de Modo de Data: Diário vs Extrato do Mês */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">Modo de Registro</span>
        <div className="flex items-center gap-1 rounded-xl bg-surface-hover/60 p-1 border border-border/80">
          <button
            type="button"
            onClick={() => {
              setEntryMode("daily");
              triggerSensory("selection");
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              entryMode === "daily"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Diario (Data Exata)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode("monthly");
              triggerSensory("selection");
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              entryMode === "monthly"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Extrato do Mes
          </button>
        </div>

        {/* Campo de data conforme o modo selecionado */}
        {entryMode === "daily" ? (
          <DatePicker value={date} onValueChange={setDate} aria-label="Data do provento" />
        ) : (
          <div className="flex flex-col gap-1">
            <MonthPicker value={month} onValueChange={setMonth} />
            <p className="text-[10px] text-muted-foreground">
              Gravado como {month}-01 com tag [MENSAL]. Aparece no extrato do mes selecionado.
            </p>
          </div>
        )}
      </div>

      {/* Alternador de Modo de Entrada: Total vs Por Cota */}
      <div className="flex items-center gap-1 rounded-xl bg-surface-hover/60 p-1 border border-border/80">
        <button
          type="button"
          onClick={() => {
            setInputMode("total");
            triggerSensory("selection");
          }}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            inputMode === "total"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Valor Total
        </button>
        <button
          type="button"
          onClick={() => {
            setInputMode("per_share");
            triggerSensory("selection");
            if (perShareCents > 0) {
              setAmountCents(Math.round(perShareCents * effectiveQty));
            }
          }}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            inputMode === "per_share"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Por Cota (Unitário)
        </button>
      </div>

      {inputMode === "per_share" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dividend-pershare" className="text-xs font-semibold text-foreground">
              Valor por Cota ({assetCurrency})
            </label>
            <MoneyInput
              id="dividend-pershare"
              cents={perShareCents}
              currency={assetCurrency}
              onCentsChange={handlePerShareChange}
              placeholder={assetCurrency === "USD" ? "$ 0.00" : "R$ 0,00"}
              aria-label="Valor por cota"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Cotas na Data ({selectedAsset?.ticker ?? "Ativo"})
            </label>
            <NumericInput
              value={assetQuantity > 0 ? String(assetQuantity) : customQuantityStr}
              onValueChange={(v) => handleCustomQtyChange(v)}
              disabled={assetQuantity > 0}
              placeholder="100"
              aria-label="Quantidade de cotas"
              showCalculatorAction
            />
          </div>
          <div className="col-span-full flex items-center justify-between text-xs text-primary pt-1 border-t border-primary/20">
            <span>Total Calculado:</span>
            <MoneyText cents={amountCents} currency={assetCurrency} tone="portfolio" className="font-semibold text-sm tabular-nums tracking-tight whitespace-nowrap" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dividend-amount" className="text-xs font-semibold text-foreground">
            Valor Total Recebido ({assetCurrency})
          </label>
          <MoneyInput
            id="dividend-amount"
            cents={amountCents}
            currency={assetCurrency}
            onCentsChange={setAmountCents}
            placeholder={assetCurrency === "USD" ? "$ 0.00" : "R$ 0,00"}
            aria-label="Valor do provento"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Observações (opcional)</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: Proventos extraordinários, corretora..."
          maxLength={100}
        />
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <Checkbox
          id="dividend-sync-cash"
          checked={syncCash}
          onCheckedChange={(checked) => setSyncCash(Boolean(checked))}
          label={isEdit ? "Adicionar / Manter valor no ativo Caixa" : "Creditar provento no saldo em caixa (corretora)"}
        />
        <p className="text-[11px] text-muted-foreground pl-6">
          {isEdit
            ? "Ao marcar, o saldo do Caixa será sincronizado com este provento. Se desmarcar, o valor previamente creditado será estornado do Caixa."
            : "Aumenta a liquidez em caixa para reinvestimentos sem registrar novo aporte financeiro do bolso."}
        </p>
      </div>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={(isEdit ? updateDividend.isPending : recordOrder.isPending) || amountCents <= 0}
          className="w-full sm:w-auto"
        >
          {(isEdit ? updateDividend.isPending : recordOrder.isPending)
            ? "Salvando..."
            : isEdit
              ? "Salvar Alterações"
              : "Salvar Provento"}
        </Button>
      </ModalFooter>
    </form>
  );
}

export function DividendFormDialog({ open, onOpenChange, defaultAssetId, dividend = null }: DividendFormDialogProps) {
  const isEdit = Boolean(dividend);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar Provento Recebido" : "Registrar Provento Recebido"}
      description={
        isEdit
          ? "Edite os valores do provento e escolha se deseja adicionar ou estornar o valor no ativo Caixa."
          : "Cadastre rendimentos de dividendos, JCP ou FIIs creditados na sua conta."
      }
      size="lg"
      showCalculator
    >
      {open ? (
        <DividendFormContent
          key={dividend?.id ?? defaultAssetId ?? "new-dividend"}
          defaultAssetId={defaultAssetId}
          dividend={dividend}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
