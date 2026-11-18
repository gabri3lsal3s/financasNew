import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button, DatePicker, FormField, Input, NumericInput, Select } from "@/components/ui";
import { parseDecimalNumber } from "@/domain/money";
import type { ParsedPortfolioImportRow } from "@/domain/portfolio/b3-csv-parser";
import type { PortfolioTransactionType } from "@/types";

const ASSET_CLASS_OPTIONS = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs" },
  { value: "ETFs", label: "ETFs" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Cripto" },
  { value: "Internacional", label: "Internacional" },
  { value: "Outros", label: "Outros" },
];

const OPERATION_TYPE_OPTIONS = [
  { value: "buy", label: "Compra / Posição Inicial" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "fii_yield", label: "Rendimento de FII" },
  { value: "jcp", label: "JCP" },
  { value: "subscription", label: "Subscrição" },
  { value: "split", label: "Desdobramento" },
  { value: "reverse_split", label: "Grupamento" },
];

export interface ImportInlineRowEditorProps {
  index: number;
  row: ParsedPortfolioImportRow;
  isPositionMode: boolean;
  onUpdate: (updates: Partial<ParsedPortfolioImportRow>) => void;
  onDone: () => void;
}

export function ImportInlineRowEditor({
  index,
  row,
  isPositionMode,
  onUpdate,
  onDone,
}: ImportInlineRowEditorProps) {
  const [qtyText, setQtyText] = useState(() => (row.quantity ? String(row.quantity) : ""));
  const [priceText, setPriceText] = useState(() => (row.price ? String(row.price) : ""));
  const [totalText, setTotalText] = useState(() => (row.total ? String(row.total) : ""));

  const syncTotal = (nextQty: number, nextPrice: number) => {
    if (nextQty > 0 && nextPrice > 0) {
      setTotalText(String(Math.round(nextQty * nextPrice * 100) / 100));
    }
  };

  return (
    <div className="p-3.5 bg-surface rounded-xl border border-primary/40 space-y-3 shadow-xs my-1">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Pencil className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          Editando ativo #{index + 1} ({row.ticker})
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onDone} className="gap-1 text-xs">
          <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
          Concluir edição
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FormField label="Código / Ticker" htmlFor={`import-ticker-${index}`}>
          <Input
            id={`import-ticker-${index}`}
            value={row.ticker}
            onChange={(e) => onUpdate({ ticker: e.target.value.toUpperCase().trim() })}
            className="font-mono uppercase text-base sm:text-sm"
          />
        </FormField>

        <FormField label="Data" htmlFor={`import-date-${index}`}>
          <DatePicker
            id={`import-date-${index}`}
            value={row.date}
            onValueChange={(date) => onUpdate({ date })}
            ariaLabel="Data da operação"
          />
        </FormField>

        <FormField label="Tipo de Operação" htmlFor={`import-type-${index}`}>
          <Select
            id={`import-type-${index}`}
            value={row.type}
            onValueChange={(val) => onUpdate({ type: val as PortfolioTransactionType })}
            options={OPERATION_TYPE_OPTIONS}
          />
        </FormField>

        <FormField label="Classe do Ativo" htmlFor={`import-class-${index}`}>
          <Select
            id={`import-class-${index}`}
            value={row.assetClass ?? "Ações"}
            onValueChange={(val) => onUpdate({ assetClass: val })}
            options={ASSET_CLASS_OPTIONS}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Quantidade / Cotas" htmlFor={`import-qty-${index}`}>
          <NumericInput
            id={`import-qty-${index}`}
            value={qtyText}
            onValueChange={(val) => {
              setQtyText(val);
              const qty = Math.max(0, parseDecimalNumber(val) ?? 0);
              onUpdate({ quantity: qty });
              syncTotal(qty, row.price);
            }}
            aria-label="Quantidade / Cotas"
            calculatorLabel="Quantidade / Cotas"
            showCalculatorAction
          />
        </FormField>

        <FormField
          label={isPositionMode ? "Preço Médio (R$)" : "Preço Unitário (R$)"}
          htmlFor={`import-price-${index}`}
        >
          <NumericInput
            id={`import-price-${index}`}
            value={priceText}
            onValueChange={(val) => {
              setPriceText(val);
              const price = Math.max(0, parseDecimalNumber(val) ?? 0);
              onUpdate({ price });
              syncTotal(row.quantity, price);
            }}
            aria-label={isPositionMode ? "Preço Médio (R$)" : "Preço Unitário (R$)"}
            calculatorLabel={isPositionMode ? "Preço Médio (R$)" : "Preço Unitário (R$)"}
            showCalculatorAction
          />
        </FormField>

        <FormField label="Valor Total (R$)" htmlFor={`import-total-${index}`}>
          <NumericInput
            id={`import-total-${index}`}
            value={totalText}
            onValueChange={(val) => {
              setTotalText(val);
              const total = Math.max(0, parseDecimalNumber(val) ?? 0);
              onUpdate({ total });
              if (row.quantity > 0 && total > 0) {
                setPriceText(String(Math.round((total / row.quantity) * 10000) / 10000));
              }
            }}
            aria-label="Valor Total (R$)"
            calculatorLabel="Valor Total (R$)"
            showCalculatorAction
            className="font-semibold"
          />
        </FormField>
      </div>
    </div>
  );
}
