import { Coins, Pencil, Plus, Wallet } from "lucide-react";
import { Skeleton, SkeletonKpi } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";

export interface CashKpiCardProps {
  cashBRL: number;
  cashPct?: number;
  hasCashAsset?: boolean;
  onEdit: () => void;
  onAporte?: () => void;
  variant?: "banner" | "card";
  isLoading?: boolean;
  className?: string;
}

/**
 * Card dedicado ao saldo em Caixa e Liquidez da carteira de investimentos.
 */
export function CashKpiCard({
  cashBRL,
  cashPct,
  hasCashAsset = false,
  onEdit,
  onAporte,
  variant = "banner",
  isLoading = false,
  className,
}: CashKpiCardProps) {
  if (isLoading) {
    return variant === "banner" ? (
      <Skeleton className={cn("h-24 w-full rounded-2xl", className)} aria-hidden="true" />
    ) : (
      <SkeletonKpi className={className} />
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 lg:p-5 shadow-xs transition-all h-full",
          className,
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Wallet className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground truncate">Saldo em caixa</span>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              {hasCashAsset ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label="Editar saldo em caixa"
                  title="Editar saldo em caixa"
                  className="relative h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-hover cursor-pointer focus-visible:opacity-100 max-sm:after:absolute max-sm:after:-inset-2"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label="Adicionar ativo de caixa"
                  title="Cadastrar saldo em caixa"
                  className="h-7 px-2 text-[11px] font-medium gap-1 text-portfolio hover:text-portfolio hover:bg-portfolio/10 cursor-pointer focus-visible:opacity-100"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  Adicionar caixa
                </Button>
              )}
            </div>
          </div>

          <p className="num mt-1 sm:mt-1.5 tabular-nums tracking-tight whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold overflow-x-auto no-scrollbar">
            <MoneyText
              cents={numberToCents(cashBRL)}
              tone={hasCashAsset && cashBRL > 0 ? "portfolio" : "default"}
              animated
              className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight"
            />
          </p>
        </div>

        <div className="min-w-0 mt-1">
          <span className="text-[11px] font-medium leading-tight text-muted-foreground truncate block">
            {hasCashAsset
              ? cashPct !== undefined && cashPct > 0
                ? `${formatPercent(cashPct)}% do patrimônio total`
                : "Disponível para aportes"
              : "Nenhum saldo em caixa cadastrado"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Saldo em Caixa & Liquidez
            </span>
          </div>
          {hasCashAsset && cashBRL > 0 ? (
            <Badge variant="portfolio" size="xs">Pólvora Seca</Badge>
          ) : hasCashAsset ? (
            <Badge variant="muted" size="xs">Caixa zerado</Badge>
          ) : (
            <Badge variant="muted" size="xs">Não cadastrado</Badge>
          )}
        </div>

        <div className="flex items-baseline gap-2.5 flex-wrap mt-0.5">
          <p className="num tabular-nums tracking-tight whitespace-nowrap text-xl sm:text-2xl lg:text-3xl font-bold overflow-x-auto no-scrollbar">
            <MoneyText
              cents={numberToCents(cashBRL)}
              tone={hasCashAsset && cashBRL > 0 ? "portfolio" : "default"}
              animated
              className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight"
            />
          </p>

          {hasCashAsset && cashPct !== undefined && cashPct > 0 ? (
            <span className="text-xs font-medium text-muted-foreground">
              ({formatPercent(cashPct)}% do patrimônio)
            </span>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          {hasCashAsset
            ? cashBRL > 0
              ? "Recursos disponíveis para aproveitar oportunidades e rebalancear a carteira."
              : "Sem liquidez disponível em caixa no momento para novos aportes diretos."
            : "Cadastre seu saldo de caixa para acompanhar a liquidez e simular aportes com precisão."}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap self-stretch sm:self-auto pt-2 sm:pt-0 border-t border-border/80 sm:border-t-0">
        {hasCashAsset ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEdit}
              aria-label="Editar saldo em caixa"
              className="flex-1 sm:flex-initial text-xs h-8 gap-1.5 cursor-pointer"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Ajustar Caixa
            </Button>

            {onAporte && cashBRL > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={onAporte}
                aria-label="Simular aporte com caixa"
                className="flex-1 sm:flex-initial text-xs h-8 gap-1.5 cursor-pointer"
              >
                <Coins className="size-3.5" aria-hidden="true" />
                Aportar
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onEdit}
            aria-label="Cadastrar saldo em caixa"
            className="flex-1 sm:flex-initial text-xs h-8 gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Cadastrar Saldo em Caixa
          </Button>
        )}
      </div>
    </div>
  );
}
