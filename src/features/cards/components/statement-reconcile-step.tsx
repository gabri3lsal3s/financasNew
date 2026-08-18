import { useMemo, useState } from "react";
import { Check, CheckCheck, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText, Select, Tabs } from "@/components/ui";
import type { Category } from "@/types";
import type { ReconciliationItem } from "@/domain/reconciliation";

interface StatementReconcileStepProps {
  items: ReconciliationItem[];
  categories: Category[];
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

type FilterTab = "all" | "new" | "suggested" | "matched";

/**
 * Passo 3 do Diálogo de Importação de Fatura:
 * Tabela de conferência e classificação com filtros rápidos (Todos, Novos, Sugestões, Conciliados),
 * seleção individual ou em lote, badges de status e seletor de categoria preditiva.
 */
export function StatementReconcileStep({
  items,
  categories,
  onToggleItem,
  onToggleAll,
  onChangeCategory,
  onBack,
  onConfirm,
  isPending,
}: StatementReconcileStepProps) {
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
  const countExact = items.filter((it) => it.status === "exact_match").length;
  const countProbable = items.filter((it) => it.status === "probable_match").length;
  const countNew = items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault).length;

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "new":
        return items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault);
      case "suggested":
        return items.filter((it) => it.status === "probable_match");
      case "matched":
        return items.filter((it) => it.status === "exact_match");
      default:
        return items;
    }
  }, [items, filter]);

  const selectedItems = items.filter((it) => it.selected);
  const selectedCount = selectedItems.length;
  const selectedTotalCents = selectedItems.reduce((acc, it) => acc + it.transaction.amountCents, 0);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => it.selected);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Segmentados */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <Tabs
          value={filter}
          onValueChange={(val) => setFilter(val as FilterTab)}
          items={[
            { value: "all", label: `Todos (${items.length})`, content: null },
            { value: "new", label: `Novos (${countNew})`, content: null },
            { value: "suggested", label: `Sugestões (${countProbable})`, content: null },
            { value: "matched", label: `Conciliados (${countExact})`, content: null },
          ]}
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
            Nenhum lançamento nesta categoria de filtro.
          </div>
        ) : (
          filteredItems.map((item) => {
            const tx = item.transaction;

            return (
              <div
                key={tx.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 transition-colors ${
                  item.selected ? "bg-primary-subtle/20" : "opacity-75 hover:opacity-100"
                }`}
              >
                {/* Checkbox + Descrição + Data */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => onToggleItem(tx.id)}
                      aria-label={`Selecionar ${tx.cleanDescription}`}
                    />
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs text-foreground truncate">
                        {tx.cleanDescription}
                      </span>

                      {tx.installment ? (
                        <Badge variant="muted" className="text-[10px] py-0 px-1 font-mono">
                          {tx.installment.current}/{tx.installment.total}
                        </Badge>
                      ) : null}

                      {item.status === "exact_match" ? (
                        <Badge variant="positive" className="text-[10px] py-0 px-1 gap-1">
                          <CheckCheck className="size-3" aria-hidden />
                          Conciliado ({item.score}%)
                        </Badge>
                      ) : item.status === "probable_match" ? (
                        <Badge variant="warning" className="text-[10px] py-0 px-1 gap-1">
                          <Sparkles className="size-3" aria-hidden />
                          Sugestão ({item.score}%)
                        </Badge>
                      ) : item.ignoredByDefault ? (
                        <Badge variant="muted" className="text-[10px] py-0 px-1 text-muted-foreground">
                          Pagamento / Ignorado
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] py-0 px-1">
                          Novo
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{tx.date}</span>
                      {tx.rawDescription !== tx.cleanDescription ? (
                        <span className="truncate max-w-[200px]" title={tx.rawDescription}>
                          · {tx.rawDescription}
                        </span>
                      ) : null}
                    </div>

                    {item.matchedExpenseDescription ? (
                      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
                        <span>Casa com:</span>
                        <span className="font-medium text-foreground">{item.matchedExpenseDescription}</span>
                        <span className="font-mono">({item.matchedExpenseDate})</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Seletor de Categoria + Valor */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
                  <div className="w-40 sm:w-44">
                    <Select
                      value={item.selectedCategoryId}
                      onValueChange={(val) => onChangeCategory(tx.id, val)}
                      options={categoryOptions}
                    />
                  </div>

                  <div className="text-right min-w-[80px]">
                    <MoneyText
                      cents={tx.amountCents}
                      tone={tx.isRefund ? "positive" : "negative"}
                      className="font-medium text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sumário e Rodapé de Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedCount}</span> de {items.length} itens selecionados (
          <MoneyText cents={selectedTotalCents} className="font-medium text-foreground" />)
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
            disabled={selectedCount === 0 || isPending}
            loading={isPending}
            onClick={onConfirm}
            className="gap-1.5"
          >
            <Check className="size-4" aria-hidden />
            Importar {selectedCount} {selectedCount === 1 ? "Lançamento" : "Lançamentos"}
          </Button>
        </div>
      </div>
    </div>
  );
}
