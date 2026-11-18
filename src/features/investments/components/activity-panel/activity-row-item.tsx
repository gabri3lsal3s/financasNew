import { ArrowDownLeft, ArrowUpRight, Coins, Layers, Pencil, Sparkles, Trash2, Wallet } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker } from "@/domain/portfolio";
import { isCashActivityItem, type ActivityItem } from "@/domain/portfolio/unified-activity-feed";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import type { PortfolioAsset } from "@/types";

export interface ActivityRowItemProps {
  item: ActivityItem;
  itemAsset: PortfolioAsset | null;
  onEdit: (item: ActivityItem, asset: PortfolioAsset | null) => void;
  onRequestDelete: (item: ActivityItem) => void;
}

export function ActivityRowItem({
  item,
  itemAsset,
  onEdit,
  onRequestDelete,
}: ActivityRowItemProps) {
  const isCash = isCashActivityItem(item, itemAsset);
  const isContribution = item.type === "contribution";
  const isCashContribution = isContribution && isCash;
  const isRegularContribution = isContribution && !isCash;
  const isBuy = item.type === "buy";
  const isSell = item.type === "sell";
  const isDividend = item.type === "dividend";
  const isSplit = item.type === "split";
  const itemCurrency = itemAsset?.currency ?? "BRL";
  const itemSector = inferSectorFromTicker(item.ticker, item.assetClass ?? undefined);
  const isSmartAporte =
    Boolean(item.notes?.toLowerCase().includes("aporte inteligente")) ||
    Boolean(item.notes?.toLowerCase().includes("rebalanceamento")) ||
    Boolean(item.notes?.toLowerCase().includes("lote"));

  const canEdit =
    item.type === "dividend" ||
    item.type === "contribution" ||
    (item.source === "transaction" && Boolean(item.rawTransaction) && Boolean(itemAsset));

  const badgeVariant = isCashContribution
    ? "portfolio"
    : isBuy || isRegularContribution
      ? "positive"
      : isSell
        ? "critical"
        : isDividend
          ? "portfolio"
          : "muted";

  const badgeLabel = isCashContribution
    ? "Aporte em Caixa"
    : item.notes?.toLowerCase().includes("aporte inicial")
      ? "Aporte Inicial"
      : isRegularContribution
        ? "Aporte"
        : isBuy
          ? "Compra"
          : isSell
            ? "Venda / Resgate"
            : isDividend
              ? "Provento"
              : "Split";

  const editTitle =
    item.type === "dividend"
      ? "Editar provento"
      : item.type === "contribution"
        ? "Editar aporte"
        : "Editar movimentação";

  const editAriaLabel =
    item.type === "dividend"
      ? `Editar provento de ${item.ticker}`
      : item.type === "contribution"
        ? `Editar aporte de ${item.ticker}`
        : `Editar movimentação de ${item.ticker}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 hover:bg-surface-hover/50 transition-colors">
      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              (isBuy || isRegularContribution) && "bg-positive/10 text-positive-strong",
              isCashContribution && "bg-portfolio/10 text-portfolio",
              isSell && "bg-critical/10 text-critical-strong",
              isDividend && "bg-portfolio/10 text-portfolio",
              isSplit && "bg-muted text-muted-foreground",
            )}
          >
            {isCashContribution ? (
              <Wallet className="size-4" aria-hidden="true" />
            ) : isBuy || isRegularContribution ? (
              <ArrowDownLeft className="size-4" aria-hidden="true" />
            ) : isSell ? (
              <ArrowUpRight className="size-4" aria-hidden="true" />
            ) : isDividend ? (
              <Coins className="size-4" aria-hidden="true" />
            ) : (
              <Layers className="size-4" aria-hidden="true" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-foreground">{item.ticker}</span>
              <Badge variant={badgeVariant} size="xs" className="max-w-full truncate">
                {badgeLabel}
              </Badge>
              {isDividend && Boolean(item.rawDividend?.sync_cash) ? (
                <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                  <Wallet className="size-2.5" aria-hidden="true" />
                  <span>Creditado no Caixa</span>
                </Badge>
              ) : null}
              {isBuy && Boolean(item.linkedContribution) ? (
                <Badge variant="muted" size="xs" className="font-medium">
                  Via Aporte
                </Badge>
              ) : null}
              {isSmartAporte ? (
                <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                  <Sparkles className="size-2.5" aria-hidden="true" />
                  <span>Aporte Inteligente</span>
                </Badge>
              ) : null}
              {itemSector && itemSector !== "Outros" ? (
                <Badge variant="muted" size="xs" className="max-w-full truncate">
                  {itemSector}
                </Badge>
              ) : null}
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatDateBR(item.date)}
              </span>
            </div>
          </div>
        </div>

        <div className="sm:hidden shrink-0 text-right">
          <MoneyText
            cents={numberToCents(item.total)}
            currency={itemCurrency}
            sign={isSell ? "explicit" : "auto"}
            tone={isSell ? "negative" : isDividend ? "positive" : "default"}
            className="text-xs font-bold"
          />
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pl-10.5 sm:pl-0 pt-0.5 sm:pt-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono min-w-0">
          {!isCashContribution && item.quantity && item.quantity > 0 && item.price && item.price > 0 ? (
            <span className="whitespace-nowrap inline-flex items-center gap-1">
              <span>{formatAssetQuantity(item.quantity, item.assetClass ?? undefined)} un @</span>
              <MoneyText
                cents={numberToCents(item.price)}
                currency={itemCurrency}
                variant="caption"
                tone="default"
                className="text-muted-foreground font-normal"
              />
            </span>
          ) : null}
          {item.notes ? (
            <span className="truncate max-w-[150px] sm:max-w-[200px] text-muted-foreground/80">
              · {item.notes}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden sm:flex flex-col items-end mr-1.5">
            <MoneyText
              cents={numberToCents(item.total)}
              currency={itemCurrency}
              sign={isSell ? "explicit" : "auto"}
              tone={isSell ? "negative" : isDividend ? "positive" : "default"}
              className="text-xs font-semibold"
            />
          </div>

          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item, itemAsset)}
              className="size-8 p-0 text-muted-foreground hover:text-foreground"
              title={editTitle}
              aria-label={editAriaLabel}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRequestDelete(item)}
            className="size-8 p-0 text-muted-foreground hover:text-critical-strong"
            title="Excluir movimentação"
            aria-label={`Excluir movimentação de ${item.ticker}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
