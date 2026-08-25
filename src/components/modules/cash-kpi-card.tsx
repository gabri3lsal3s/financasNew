import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export interface CashKpiCardProps {
  /** Saldo atual em BRL. */
  cashBRL: number;
  /** Percentual do patrimônio total representado pelo caixa. */
  cashPct?: number;
  /**
   * Quando `true`, o ativo de Caixa já existe e o card exibe
   * os botões "Editar" e "Excluir". Quando `false`/`undefined`,
   * exibe apenas o botão "Adicionar caixa".
   */
  hasCashAsset?: boolean;
  /** Chamado ao clicar em "Editar saldo" ou "Adicionar caixa". */
  onEdit: () => void;
  /** Chamado ao clicar em "Excluir caixa" (só renderizado quando hasCashAsset). */
  onDelete: () => void;
  className?: string;
}

/**
 * Card dedicado ao saldo em Caixa da carteira de investimentos.
 *
 * - Quando o ativo de Caixa **existe** → exibe saldo + botões Editar e Excluir.
 * - Quando **não existe** (caixa zerado ou não cadastrado) → exibe saldo zero
 *   com botão "Adicionar caixa" para abrir o formulário em modo Caixa.
 *
 * Projetado para ocupar `col-span-2` na grade de KPIs, sendo o primeiro card.
 */
export function CashKpiCard({
  cashBRL,
  cashPct,
  hasCashAsset = false,
  onEdit,
  onDelete,
  className,
}: CashKpiCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs transition-all hover:border-portfolio/30 hover:shadow-sm",
        className,
      )}
    >
      {/* Linha superior: ícone + rótulo + ações */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Wallet className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground truncate">Saldo em caixa</span>
        </div>

        {/* Botões de ação — visíveis sempre no mobile, no hover no desktop */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {hasCashAsset ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onEdit}
                aria-label="Editar saldo em caixa"
                title="Editar saldo em caixa"
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                aria-label="Excluir ativo de caixa"
                title="Excluir ativo de caixa"
                className="size-7 p-0 text-muted-foreground hover:text-negative-strong hover:bg-negative-surface/30"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onEdit}
              aria-label="Adicionar ativo de caixa"
              title="Cadastrar saldo em caixa"
              className="h-7 px-2 text-[11px] font-medium gap-1 text-portfolio hover:text-portfolio hover:bg-portfolio/10"
            >
              <Plus className="size-3" aria-hidden="true" />
              Adicionar caixa
            </Button>
          )}
        </div>
      </div>

      {/* Valor principal */}
      <MoneyText
        cents={numberToCents(cashBRL)}
        tone={hasCashAsset && cashBRL > 0 ? "portfolio" : "default"}
        animated
        className="text-xl font-bold leading-tight"
      />

      {/* Dica de percentual ou estado vazio */}
      <span className="text-[11px] text-muted-foreground">
        {hasCashAsset
          ? cashPct !== undefined && cashPct > 0
            ? `${cashPct.toFixed(1)}% do patrimônio total`
            : "Disponível para aportes"
          : "Nenhum saldo em caixa cadastrado"}
      </span>
    </div>
  );
}
