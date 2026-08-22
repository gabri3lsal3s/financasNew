import { useState } from "react";
import { Alert, Button, Input, Modal, MoneyInput, Select } from "@/components/ui";
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
      await createDividend.mutateAsync({
        asset_id: selectedAsset.id,
        date,
        amount: amountCents / 100,
        notes: notes.trim() ? `${type.toUpperCase()}: ${notes.trim()}` : type.toUpperCase(),
      });

      triggerSensory("success");
      pushToast({
        title: "Provento registrado",
        description: `${selectedAsset.ticker} · R$ ${(amountCents / 100).toFixed(2)} registrado com sucesso.`,
      });

      onOpenChange(false);
      setAmountCents(0);
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
            onValueChange={setSelectedAssetId}
            options={assets.map((a) => ({
              value: a.id,
              label: `${a.ticker} — ${a.asset_class ?? "Sem classe"}`,
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
