import { Award, Info, SlidersHorizontal } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { ALLOCATION_STATUS_META, getScoreConvictionMeta } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import type { AssetAllocationStatus } from "@/types";

export interface TargetAssetScoreRow {
  assetId: string;
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector: string | null;
  valueBRL: number;
  currentPct: number;
  rawScore: number | null;
  effectiveScore: number;
  effectiveTargetPct: number;
  status: AssetAllocationStatus;
  formulaLabel: string;
  onEvaluate?: () => void;
}

export interface TargetAssetsCardProps {
  classes: string[];
  assetClassFilter: string | null;
  rows: TargetAssetScoreRow[];
  onAssetClassFilterChange: (cls: string | null) => void;
}

/**
 * Nível 3 de Governança (§3.11.1 · Plano 42):
 * Substitui as metas manuais (%) por Notas de Tese (0–10) e Status de Alocação,
 * exibindo a meta efetiva (%) derivada automaticamente de Classe × Setor × Nota.
 */
export function TargetAssetsCard({
  classes,
  assetClassFilter,
  rows,
  onAssetClassFilterChange,
}: TargetAssetsCardProps) {
  const visibleRows = assetClassFilter
    ? rows.filter((r) => r.assetClass === assetClassFilter)
    : rows;

  const ratedCount = visibleRows.filter((r) => r.rawScore !== null).length;

  return (
    <section
      role="region"
      aria-label="Notas e status por ativo"
      data-tour="targets-assets-card"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
    >
      {/* Cabeçalho composto adaptativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <Award className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Notas e status dos ativos</h3>
            <p className="text-xs text-muted-foreground">
              Defina a nota de convicção (0 a 10) e o status de cada ativo. A meta efetiva (% da carteira investível) é derivada automaticamente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="muted" size="xs">
            {ratedCount}/{visibleRows.length} avaliados
          </Badge>
        </div>
      </div>

      {/* Explicação da cascata Classe x Setor x Nota */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-foreground">Meta efetiva automática:</strong>{" "}
          calculada a partir da Meta da Classe × Meta do Setor (se configurada) × peso proporcional da Nota. Ativos sem avaliação recebem peso neutro 5 até serem avaliados.
        </p>
      </div>

      {/* Filtros de classe */}
      {classes.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
          <button
            type="button"
            onClick={() => onAssetClassFilterChange(null)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              assetClassFilter === null
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
            )}
          >
            Todas as classes
          </button>
          {classes.map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => onAssetClassFilterChange(assetClassFilter === cls ? null : cls)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                assetClassFilter === cls
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {cls}
            </button>
          ))}
        </div>
      ) : null}

      {/* Lista de governança dos ativos */}
      {visibleRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          {assetClassFilter
            ? `Nenhum ativo na classe ${assetClassFilter}.`
            : "Nenhum ativo investível na carteira."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 min-w-0">
          {visibleRows.map((row) => {
            const statusMeta = ALLOCATION_STATUS_META[row.status];
            const scoreBadgeVariant =
              row.rawScore === null
                ? "warning"
                : getScoreConvictionMeta(row.rawScore).badgeVariant;
            const statusBadgeVariant =
              row.status === "quarantine" ? "warning" : statusMeta.badgeVariant;
            const isBlocked = row.status !== "active" || row.rawScore === 0;
            const diffPct = row.effectiveTargetPct - row.currentPct;

            return (
              <div
                key={row.assetId}
                className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between min-w-0 transition-colors hover:border-border"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* Linha 1: Ticker + Nota + Status */}
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{row.ticker}</span>
                    <Badge variant={scoreBadgeVariant} size="xs">
                      {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                    </Badge>
                    <Badge variant={statusBadgeVariant} size="xs">
                      {statusMeta.shortLabel}
                    </Badge>
                  </div>

                  {/* Linha 2: Classe, Setor e Saldo */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{row.assetClass}</span>
                    {row.sector ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{row.sector}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <MoneyText
                      cents={numberToCents(row.valueBRL)}
                      tone="default"
                      className="text-xs font-medium text-foreground"
                    />
                  </div>

                  {/* Linha 3: Participação Atual vs Meta Efetiva Derivada */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono tabular-nums whitespace-nowrap text-muted-foreground">
                      Atual:{" "}
                      <strong className="font-semibold text-foreground">
                        {formatPercent(row.currentPct)}%
                      </strong>
                    </span>
                    <span className="text-muted-foreground/60" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono tabular-nums whitespace-nowrap text-muted-foreground">
                      Meta efetiva:{" "}
                      <strong
                        className={cn(
                          "font-semibold",
                          isBlocked ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {formatPercent(row.effectiveTargetPct)}%
                      </strong>
                    </span>
                    {!isBlocked && row.effectiveTargetPct > 0 ? (
                      <Badge
                        variant={diffPct > 0.1 ? "positive" : "muted"}
                        size="xs"
                        className="font-mono"
                      >
                        {diffPct >= 0
                          ? `+${formatPercent(diffPct)}%`
                          : `${formatPercent(diffPct)}%`}
                      </Badge>
                    ) : null}
                  </div>

                  {/* Linha 4: Rastro da fórmula hierárquica */}
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {row.formulaLabel}
                  </p>
                </div>

                {/* Ação de avaliação de tese */}
                <div className="flex items-center justify-end shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!row.onEvaluate}
                    onClick={row.onEvaluate}
                    aria-label={`Avaliar nota e status de ${row.ticker}`}
                    className="w-full sm:w-auto gap-1.5"
                  >
                    <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
                    Avaliar nota
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
