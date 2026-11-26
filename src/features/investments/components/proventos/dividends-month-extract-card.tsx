import { Coins, Pencil, Trash2, Wallet } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { FALLBACK_USD_RATE } from "@/domain/portfolio";
import type { DividendPositionRef } from "@/domain/portfolio/dividends-analytics";
import { formatDateBR, monthLabel } from "@/lib/date";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface DividendsMonthExtractCardProps {
  month: string;
  extract: readonly PortfolioDividend[];
  assetById: ReadonlyMap<string, PortfolioAsset>;
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>;
  monthTotal?: number;
  projectedTotal?: number;
  projectedCount?: number;
  onOpenPendingDividends?: () => void;
  onEditDividend: (entry: PortfolioDividend) => void;
  onDeleteDividend: (entry: PortfolioDividend) => void;
}

export function DividendsMonthExtractCard({
  month,
  extract,
  assetById,
  rowByAssetId,
  monthTotal,
  projectedTotal = 0,
  projectedCount = 0,
  onOpenPendingDividends,
  onEditDividend,
  onDeleteDividend,
}: DividendsMonthExtractCardProps) {
  const computedExtractTotal =
    typeof monthTotal === "number"
      ? monthTotal
      : extract.reduce((sum, entry) => {
          const asset = entry.asset_id ? assetById.get(entry.asset_id) : null;
          const row = entry.asset_id ? rowByAssetId.get(entry.asset_id) : null;
          const currency = asset?.currency ?? row?.currency ?? "BRL";
          const rate = currency === "USD" ? row?.usdRate || FALLBACK_USD_RATE : 1;
          return sum + entry.amount * rate;
        }, 0);
  const expectedTotal = computedExtractTotal + Math.max(0, projectedTotal);
  const showReconciliationBar = computedExtractTotal > 0 || projectedTotal > 0;

  return (
    <section
      aria-label={`Extrato de ${monthLabel(month)}`}
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Coins className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Extrato do mês</h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showReconciliationBar ? (
            projectedCount > 0 || projectedTotal > 0.01 ? (
              <Badge variant="warning" size="xs">
                Diferença a conferir
              </Badge>
            ) : (
              <Badge variant="positive" size="xs">
                Tudo batido
              </Badge>
            )
          ) : null}
          <Badge variant="muted" size="sm">
            {monthLabel(month)}
          </Badge>
        </div>
      </div>

      {showReconciliationBar ? (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] text-muted-foreground">Lançado no extrato</span>
            <MoneyText
              cents={numberToCents(computedExtractTotal)}
              currency="BRL"
              tone="positive"
              className="text-sm font-semibold"
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] text-muted-foreground">Pendente / previsto</span>
            <div className="flex items-center gap-2 flex-wrap">
              <MoneyText
                cents={numberToCents(Math.max(0, projectedTotal))}
                currency="BRL"
                tone="default"
                className="text-sm font-semibold"
              />
              {projectedCount > 0 && onOpenPendingDividends ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={onOpenPendingDividends}
                >
                  Conferir ({projectedCount})
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] text-muted-foreground">Total esperado (corretora)</span>
            <MoneyText
              cents={numberToCents(expectedTotal)}
              currency="BRL"
              tone="default"
              className="text-sm font-semibold"
            />
          </div>
        </div>
      ) : null}

      {extract.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum provento recebido neste mês.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-xl bg-surface-raised/40 overflow-hidden">
          {extract.map((entry) => {
            const asset = entry.asset_id ? assetById.get(entry.asset_id) : null;
            const row = entry.asset_id ? rowByAssetId.get(entry.asset_id) : null;
            const currency = asset?.currency ?? row?.currency ?? "BRL";
            const ticker = asset?.ticker ?? entry.ticker ?? "Ativo";
            const rate = currency === "USD" ? row?.usdRate || FALLBACK_USD_RATE : 1;
            const amountBRL = entry.amount * rate;

            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-surface-hover/50 transition-colors"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-bold font-mono text-foreground">
                      {ticker}
                    </span>
                    {asset?.asset_class ? (
                      <Badge variant="muted" size="xs" className="font-medium">
                        {asset.asset_class}
                      </Badge>
                    ) : null}
                    {entry.sync_cash ? (
                      <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                        <Wallet className="size-2.5" aria-hidden="true" />
                        <span>Creditado no Caixa</span>
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateBR(entry.date)} {entry.notes ? `· ${entry.notes}` : ""}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <MoneyText
                      cents={numberToCents(entry.amount)}
                      currency={currency}
                      tone="positive"
                      className="text-sm font-semibold"
                    />
                    {currency === "USD" ? (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (≈{" "}
                        <MoneyText
                          cents={numberToCents(amountBRL)}
                          currency="BRL"
                          variant="caption"
                          tone="default"
                        />
                        )
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Editar lançamento de provento"
                    aria-label={`Editar provento de ${ticker}`}
                    onClick={() => onEditDividend(entry)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-muted-foreground hover:text-negative-strong"
                    title="Excluir lançamento de provento"
                    aria-label={`Excluir provento de ${ticker}`}
                    onClick={() => onDeleteDividend(entry)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
