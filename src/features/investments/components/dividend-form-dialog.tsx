import { useState } from "react";
import { Alert, Button, Input, Modal, MoneyInput, MoneyText, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useCreatePortfolioDividend, usePortfolioAssets } from "@/state";

export interface DividendFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssetId?: string;
}

const DIVIDEND_OPTIONS: { value: string; label: string }[] = [
  { value: "dividend", label: "Dividendo" },
  { value: "jcp", label: "Juros sobre capital próprio (JCP)" },
  { value: "fii_yield", label: "Rendimento de FII" },
];

export function DividendFormDialog({ open, onOpenChange, defaultAssetId }: DividendFormDialogProps) {
  const assetsQuery = usePortfolioAssets();
  const createDividend = useCreatePortfolioDividend();

  const assets = assetsQuery.data ?? [];
  const [selectedAssetId, setSelectedAssetId] = useState(defaultAssetId ?? (assets[0]?.id ?? ""));
  const [type, setType] = useState("dividend");
  const [date, setDate] = useState(todayISO());
  const [amountCents, setAmountCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      const perShareNote = inputMode === "per_share" && perShareCents > 0
        ? ` (R$ ${(perShareCents / 100).toFixed(2)}/cota × ${effectiveQty})`
        : "";
      const baseNote = notes.trim() ? `${type.toUpperCase()}: ${notes.trim()}` : type.toUpperCase();

      await createDividend.mutateAsync({
        asset_id: selectedAsset.id,
        date,
        amount: amountCents / 100,
        notes: `${baseNote}${perShareNote}`,
      });

      triggerSensory("success");
      pushToast({
        title: "Provento registrado",
        description: `${selectedAsset.ticker} · R$ ${(amountCents / 100).toFixed(2)} registrado com sucesso.`,
      });

      onOpenChange(false);
      setAmountCents(0);
      setPerShareCents(0);
      setNotes("");
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Provento Recebido"
      description="Cadastre rendimentos de dividendos, JCP ou FIIs creditados na sua conta."
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Ativo</span>
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
          <span className="text-xs font-medium text-muted-foreground">Tipo de Provento</span>
          <Select
            value={type}
            onValueChange={setType}
            options={DIVIDEND_OPTIONS}
            aria-label="Tipo de provento"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Data de Recebimento</span>
          <DatePicker value={date} onValueChange={setDate} aria-label="Data do provento" />
        </div>

        {/* Alternador de Modo de Entrada: Total vs Por Cota */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-hover/60 p-1 border border-border/60">
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
              <label htmlFor="dividend-pershare" className="text-xs font-medium text-primary">
                Valor por Cota (R$)
              </label>
              <MoneyInput
                id="dividend-pershare"
                cents={perShareCents}
                onCentsChange={handlePerShareChange}
                aria-label="Valor por cota"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cotas na Data ({selectedAsset?.ticker ?? "Ativo"})
              </label>
              <Input
                value={assetQuantity > 0 ? String(assetQuantity) : customQuantityStr}
                onChange={(e) => handleCustomQtyChange(e.target.value)}
                disabled={assetQuantity > 0}
                placeholder="100"
                inputMode="numeric"
                aria-label="Quantidade de cotas"
              />
            </div>
            <div className="col-span-full flex items-center justify-between text-xs text-primary pt-1 border-t border-primary/20">
              <span>Total Calculado:</span>
              <MoneyText cents={amountCents} tone="portfolio" className="font-semibold text-sm" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dividend-amount" className="text-xs font-medium text-muted-foreground">
              Valor Total Recebido
            </label>
            <MoneyInput
              id="dividend-amount"
              cents={amountCents}
              onCentsChange={setAmountCents}
              aria-label="Valor do provento"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Proventos extraordinários, corretora..."
            maxLength={100}
          />
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createDividend.isPending || amountCents <= 0}>
            {createDividend.isPending ? "Salvando…" : "Salvar Provento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
