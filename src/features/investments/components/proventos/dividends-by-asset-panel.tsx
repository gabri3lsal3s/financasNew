import { KpiCard } from "@/components/modules";
import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { AssetDividendBreakdownItem } from "@/domain/portfolio/dividends-analytics";
import { formatPercent } from "@/services/masks/percent";

export interface DividendsByAssetPanelProps {
  lifetimeTotal: number;
  historicalTotal: number;
  portfolioAverageYoC: number;
  items: readonly AssetDividendBreakdownItem[];
}

export function DividendsByAssetPanel({
  lifetimeTotal,
  historicalTotal,
  portfolioAverageYoC,
  items,
}: DividendsByAssetPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Total Geral Vitalício"
          cents={numberToCents(lifetimeTotal)}
          tone="positive"
          hint="Histórico inicial + lançamentos no app"
        />

        <KpiCard
          label="Histórico Anterior"
          cents={numberToCents(historicalTotal)}
          tone="positive"
          hint="Proventos cadastrados nos ativos"
        />

        <KpiCard
          label="YoC Médio da Carteira"
          value={portfolioAverageYoC > 0 ? `${formatPercent(portfolioAverageYoC, 2)}%` : "—"}
          hint="Yield on Cost sobre preço de compra"
        />
      </div>

      <section
        aria-label="Proventos por Ativo"
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Proventos por Ativo</h2>
            <p className="text-xs text-muted-foreground">
              Consolidação de proventos iniciais anteriores ao cadastro e lançamentos no app.
            </p>
          </div>
          <Badge variant="muted" size="sm">
            {items.length} {items.length === 1 ? "ativo" : "ativos"}
          </Badge>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum ativo com proventos acumulados.
          </p>
        ) : (
          <>
            {/* Visão Mobile: Cards Adaptativos */}
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map(({ asset, isUSD, initialHistorical, periodicAmount, totalAmount, totalAmountBRL, yoc }) => (
                <div
                  key={asset.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-foreground text-sm font-mono truncate">
                        {asset.ticker}
                      </span>
                      {asset.asset_class ? (
                        <Badge variant="muted" size="xs" className="font-medium">
                          {asset.asset_class}
                        </Badge>
                      ) : null}
                    </div>
                    {yoc > 0 ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-medium">YoC:</span>
                        <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                          {`${formatPercent(yoc, 2)}%`}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                    <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>Inicial:</span>
                        <span className="font-mono text-foreground">
                          {initialHistorical > 0 ? (
                            <MoneyText
                              cents={numberToCents(initialHistorical)}
                              currency={asset.currency}
                              tone="default"
                              variant="caption"
                            />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>No App:</span>
                        <span className="font-mono text-foreground">
                          {periodicAmount > 0 ? (
                            <MoneyText
                              cents={numberToCents(periodicAmount)}
                              currency={asset.currency}
                              tone="default"
                              variant="caption"
                            />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                        Total Recebido
                      </span>
                      <MoneyText
                        cents={numberToCents(totalAmount)}
                        currency={asset.currency}
                        tone="positive"
                        className="text-sm font-semibold"
                      />
                      {isUSD && totalAmountBRL > 0 ? (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          (≈{" "}
                          <MoneyText
                            cents={numberToCents(totalAmountBRL)}
                            currency="BRL"
                            variant="caption"
                            tone="default"
                          />
                          )
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Visão Tablet & Desktop: Tabela com overflow-x-auto */}
            <div className="hidden sm:block overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead className="bg-surface-hover/50 text-muted-foreground border-b border-border/80">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Ativo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Histórico Inicial</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lançado no App</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Recebido</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Yield on Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map(({ asset, isUSD, initialHistorical, periodicAmount, totalAmount, totalAmountBRL, yoc }) => (
                    <tr key={asset.id} className="hover:bg-surface-hover/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-foreground font-mono">{asset.ticker}</span>
                          {asset.asset_class ? (
                            <span className="text-[10px] text-muted-foreground">({asset.asset_class})</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {initialHistorical > 0 ? (
                          <MoneyText
                            cents={numberToCents(initialHistorical)}
                            currency={asset.currency}
                            tone="default"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {periodicAmount > 0 ? (
                          <MoneyText
                            cents={numberToCents(periodicAmount)}
                            currency={asset.currency}
                            tone="default"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-positive-strong">
                        <MoneyText
                          cents={numberToCents(totalAmount)}
                          currency={asset.currency}
                          tone="positive"
                        />
                        {isUSD && totalAmountBRL > 0 ? (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            (≈{" "}
                            <MoneyText
                              cents={numberToCents(totalAmountBRL)}
                              currency="BRL"
                              variant="caption"
                              tone="default"
                            />
                            )
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground tabular-nums">
                        {yoc > 0 ? `${formatPercent(yoc, 2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
