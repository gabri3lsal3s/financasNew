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
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 lg:p-5 shadow-xs transition-all hover:border-border h-full",
        className,
      )}
    >
      <div>
        {/* Linha superior: ícone + rótulo + ações */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
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
                  className="size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-hover cursor-pointer"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  aria-label="Excluir ativo de caixa"
                  title="Excluir ativo de caixa"
                  className="size-6 p-0 text-muted-foreground hover:text-negative-strong hover:bg-negative-surface/30 cursor-pointer"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
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
                className="h-6 px-1.5 text-[11px] font-medium gap-1 text-portfolio hover:text-portfolio hover:bg-portfolio/10 cursor-pointer"
              >
                <Plus className="size-3" aria-hidden="true" />
                Adicionar caixa
              </Button>
            )}
          </div>
        </div>

        {/* Valor principal */}
        <p className="num mt-1 sm:mt-1.5 tabular-nums tracking-tight whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold overflow-x-auto no-scrollbar">
          <MoneyText
            cents={numberToCents(cashBRL)}
            tone={hasCashAsset && cashBRL > 0 ? "portfolio" : "default"}
            animated
            className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight"
          />
        </p>
      </div>

      {/* Dica de percentual ou estado vazio */}
      <div className="min-w-0 mt-1">
        <span className="text-[11px] font-medium leading-tight text-muted-foreground truncate block">
          {hasCashAsset
            ? cashPct !== undefined && cashPct > 0
              ? `${cashPct.toFixed(1)}% do patrimônio total`
              : "Disponível para aportes"
            : "Nenhum saldo em caixa cadastrado"}
        </span>
      </div>
    </div>
  );
}
