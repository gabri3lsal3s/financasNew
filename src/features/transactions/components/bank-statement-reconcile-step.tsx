import { useMemo, useState } from "react";
import { Check, CheckCheck, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText, Select, Tabs } from "@/components/ui";
import type { Category } from "@/types";
import type { BankTransactionItem } from "@/domain/reconciliation";

interface BankStatementReconcileStepProps {
  items: BankTransactionItem[];
  categories: Category[];
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onChangeReceiveType: (id: string, receiveType: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

type FilterTab = "all" | "expenses" | "incomes" | "new" | "matched";

const RECEIVE_TYPE_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "salario", label: "Salário / Pró-labore" },
  { value: "ted", label: "TED / Transferência" },
  { value: "rendimento", label: "Rendimentos / Proventos" },
  { value: "outros", label: "Outros" },
];

/**
 * Passo 3 do Diálogo de Importação de Extrato Bancário:
 * Conferência e conciliação de despesas e receitas do extrato, seleção em lote,
 * badges de status e seletores de categoria/tipo de recebimento.
 */
export function BankStatementReconcileStep({
  items,
  categories,
  onToggleItem,
  onToggleAll,
  onChangeCategory,
  onChangeReceiveType,
  onBack,
  onConfirm,
  isPending,
}: BankStatementReconcileStepProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories],
  );

  // Contadores
  const countExpenses = items.filter((it) => it.kind === "expense").length;
  const countIncomes = items.filter((it) => it.kind === "income").length;
  const countNew = items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault).length;
  const countMatched = items.filter((it) => it.status === "exact_match" || it.status === "probable_match").length;

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "expenses":
        return items.filter((it) => it.kind === "expense" || it.kind === "card_payment_ignored" || it.kind === "transfer_ignored");
      case "incomes":
        return items.filter((it) => it.kind === "income");
      case "new":
        return items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault);
      case "matched":
        return items.filter((it) => it.status === "exact_match" || it.status === "probable_match");
      default:
        return items;
    }
  }, [items, filter]);

  const selectedItems = items.filter((it) => it.selected);
  const selectedCount = selectedItems.length;

  const selectedExpensesTotalCents = selectedItems
    .filter((it) => it.kind === "expense")
    .reduce((acc, it) => acc + it.transaction.amountCents, 0);

  const selectedIncomesTotalCents = selectedItems
    .filter((it) => it.kind === "income")
    .reduce((acc, it) => acc + it.transaction.amountCents, 0);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => it.selected);

  const tabsList = [
    { value: "all", label: `Todos (${items.length})`, content: null },
    { value: "expenses", label: `Despesas (${countExpenses})`, content: null },
    { value: "incomes", label: `Receitas (${countIncomes})`, content: null },
    { value: "new", label: `Novos (${countNew})`, content: null },
    { value: "matched", label: `Conciliados (${countMatched})`, content: null },
  ];

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Segmentados */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <Tabs
          value={filter}
          onValueChange={(val) => setFilter(val as FilterTab)}
          items={tabsList}
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:flex-none">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(!allFilteredSelected)}
          >
            {allFilteredSelected ? "Desmarcar visíveis" : "Marcar todos visíveis"}
          </Button>
        </div>
      </div>

      {/* Tabela de Itens */}
      <div className="max-h-[380px] overflow-y-auto rounded-lg border border-border/70 bg-surface/40 divide-y divide-border/40">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma transação encontrada nesta categoria de filtro.
          </div>
        ) : (
          filteredItems.map((item) => {
            const { transaction: tx, kind, status, score } = item;
            const isIncome = kind === "income";
            const isIgnored = item.ignoredByDefault;

            return (
              <div
                key={tx.id}
                className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                  item.selected ? "bg-surface/90" : "opacity-60 bg-surface/20"
                }`}
              >
                {/* Lado Esquerdo: Checkbox + Identificação */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => onToggleItem(tx.id)}
                    />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground font-medium">{tx.date}</span>

                      {/* Badge de Natureza */}
                      {kind === "card_payment_ignored" ? (
                        <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                          Fatura de Cartão
                        </Badge>
                      ) : kind === "transfer_ignored" ? (
                        <Badge variant="muted" className="text-[10px] py-0 px-1.5">
                          Transferência / Aporte
                        </Badge>
                      ) : isIncome ? (
                        <Badge variant="positive" className="text-[10px] py-0 px-1.5">
                          Receita (+)
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="text-[10px] py-0 px-1.5">
                          Despesa (-)
                        </Badge>
                      )}

                      {/* Badge de Status de Conciliação */}
                      {status === "exact_match" ? (
                        <Badge variant="positive" className="gap-1 text-[10px] py-0 px-1.5">
                          <CheckCheck className="size-3" aria-hidden />
                          Conciliado ({score}%)
                        </Badge>
                      ) : status === "probable_match" ? (
                        <Badge variant="warning" className="gap-1 text-[10px] py-0 px-1.5">
                          <Check className="size-3" aria-hidden />
                          Sugestão ({score}%)
                        </Badge>
                      ) : !isIgnored ? (
                        <Badge variant="default" className="gap-1 text-[10px] py-0 px-1.5">
                          <Sparkles className="size-3" aria-hidden />
                          Novo
                        </Badge>
                      ) : null}
                    </div>

                    <p className="font-medium text-xs text-foreground truncate">{tx.cleanDescription}</p>

                    {tx.rawDescription !== tx.cleanDescription && (
                      <p className="text-[10px] text-muted-foreground/80 truncate font-mono">
                        {tx.rawDescription}
                      </p>
                    )}

                    {/* Vínculo de Match Existente */}
                    {item.matchedExpenseDescription && (
                      <p className="text-[10px] text-emerald-500/90 flex items-center gap-1">
                        <span>Casou com despesa:</span>
                        <span className="font-medium truncate">{item.matchedExpenseDescription}</span>
                        <span>({item.matchedExpenseDate})</span>
                      </p>
                    )}
                    {item.matchedIncomeDescription && (
                      <p className="text-[10px] text-emerald-500/90 flex items-center gap-1">
                        <span>Casou com receita:</span>
                        <span className="font-medium truncate">{item.matchedIncomeDescription}</span>
                        <span>({item.matchedIncomeDate})</span>
                      </p>
                    )}

                    {/* Alerta de Item Ignorado */}
                    {item.ignoreReason && (
                      <p className="text-[10px] text-amber-500/90 italic">
                        {item.ignoreReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Valor + Categoria / ReceiveType */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 w-full sm:w-auto shrink-0">
                  <div className="font-mono text-sm font-semibold">
                    <span className={isIncome ? "text-emerald-500" : "text-foreground"}>
                      {isIncome ? "+" : "-"}
                      <MoneyText cents={tx.amountCents} />
                    </span>
                  </div>

                  <div className="w-40 sm:w-44">
                    {isIncome ? (
                      <Select
                        value={item.selectedReceiveType ?? "pix"}
                        onValueChange={(val) => onChangeReceiveType(tx.id, val)}
                        options={RECEIVE_TYPE_OPTIONS}
                        disabled={!item.selected}
                      />
                    ) : (
                      <Select
                        value={item.selectedCategoryId}
                        onValueChange={(val) => onChangeCategory(tx.id, val)}
                        options={categoryOptions}
                        disabled={!item.selected}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé e Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
        <div className="space-y-0.5 text-xs">
          <p className="text-muted-foreground">
            Selecionados: <strong className="text-foreground">{selectedCount}</strong> de {items.length} itens
          </p>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            {selectedExpensesTotalCents > 0 && (
              <span className="text-rose-500 font-medium">
                Despesas: -<MoneyText cents={selectedExpensesTotalCents} />
              </span>
            )}
            {selectedIncomesTotalCents > 0 && (
              <span className="text-emerald-500 font-medium">
                Receitas: +<MoneyText cents={selectedIncomesTotalCents} />
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={isPending}
            className="gap-1.5"
          >
            <RotateCcw className="size-4" aria-hidden />
            Voltar
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || selectedCount === 0}
            className="gap-1.5 min-w-[170px]"
          >
            {isPending ? (
              "Importando..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Importar ({selectedCount})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
