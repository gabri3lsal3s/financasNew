import { useMemo, useState } from "react";
import { Copy, Equal, RotateCcw, Scale, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { calculateAssetAllocationDelta } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface TargetEditorRow {
  key: string;
  label: string;
  /** Classe do ativo (ex.: Ações, FIIs, Cripto). */
  assetClass?: string;
  /** Detalhe exibido ao lado do rótulo (ex.: valor atual e % hoje). */
  detail?: string;
  /** Meta atual em % (0–100). */
  target: number;
  /** Alocação real de mercado atual em % (0–100). */
  currentPct?: number;
}

export interface TargetEditorProps {
  rows: TargetEditorRow[];
  onTargetChange: (key: string, value: number) => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  /** Callback para normalizar metas em 1 clique (§F39). */
  onNormalize?: () => void;
  normalizeLabel?: string;
  /** Callback para normalizar toda a carteira globalmente para 100%. */
  onNormalizeAll?: () => void;
  /** Callback para distribuição equiponderada 1/N. */
  onDistributeEqually?: () => void;
  distributeLabel?: string;
  /** Callback para espelhar a posição atual da carteira nas metas. */
  onMirrorPosition?: () => void;
  /** Callback para zerar as metas da seleção. */
  onResetZero?: () => void;
  /** Soma atual dos percentuais (0–100+). */
  sumPercent: number;
  /** Mensagem de erro quando a soma excede 100% (bloqueia o save). */
  sumError: string | null;
  /** Texto de contexto acima da barra (ex.: "Metas por ativo"). */
  heading?: string;
  emptyMessage?: string;
}

type SortOption = "default" | "gap-desc" | "target-desc" | "current-desc" | "alpha";

/**
 * Editor em lote de metas de alocação (§3.11.1 e §F39) — módulo de domínio F4.
 * Barra de soma ≤ 100% com feedback visual, busca instantânea, ordenação
 * inteligente (prioridade de aporte por gap), comparativo visual e ações em 1-clique.
 */
export function TargetEditor({
  rows,
  onTargetChange,
  onSave,
  saving = false,
  saveLabel = "Salvar metas",
  onNormalize,
  normalizeLabel = "Normalizar para 100%",
  onNormalizeAll,
  onDistributeEqually,
  distributeLabel = "Distribuir igualmente (1/N)",
  onMirrorPosition,
  onResetZero,
  sumPercent,
  sumError,
  heading,
  emptyMessage = "Nenhum item para definir meta.",
}: TargetEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const sumClamped = Math.min(100, Math.max(0, sumPercent));

  const filteredAndSortedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = rows;

    if (query) {
      result = result.filter(
        (r) =>
          r.label.toLowerCase().includes(query) ||
          (r.assetClass && r.assetClass.toLowerCase().includes(query)),
      );
    }

    if (sortBy === "default") return result;

    return [...result].sort((a, b) => {
      if (sortBy === "gap-desc") {
        const deltaA = (a.target || 0) - (a.currentPct || 0);
        const deltaB = (b.target || 0) - (b.currentPct || 0);
        return deltaB - deltaA;
      }
      if (sortBy === "target-desc") {
        return (b.target || 0) - (a.target || 0);
      }
      if (sortBy === "current-desc") {
        return (b.currentPct || 0) - (a.currentPct || 0);
      }
      if (sortBy === "alpha") {
        return a.label.localeCompare(b.label);
      }
      return 0;
    });
  }, [rows, searchQuery, sortBy]);

  return (
    <section aria-label={heading ?? "Metas de alocação"} className="flex flex-col gap-4">
      {heading ? <h2 className="text-sm font-semibold text-foreground">{heading}</h2> : null}

      {/* Barra de Progresso e Validação da Soma */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface/70 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">Soma das metas</span>
          <span className={cn("num font-bold", sumError ? "text-critical" : sumPercent > 0 ? "text-foreground" : "")}>
            {sumPercent.toFixed(1)}% / 100%
          </span>
        </div>
        <Progress
          value={sumClamped}
          tone={sumError ? "critical" : "auto"}
          aria-label={`Soma das metas: ${sumPercent.toFixed(1)}%`}
        />
        {sumError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-critical font-medium">{sumError}</p>
            {onNormalizeAll ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNormalizeAll}
                disabled={saving}
                className="gap-1.5 text-xs border-critical/50 text-critical hover:bg-critical/10"
              >
                <Scale className="size-3.5 shrink-0" aria-hidden="true" />
                Ajustar carteira toda para 100%
              </Button>
            ) : null}
          </div>
        ) : null}
        {sumError === null && sumPercent < 100 ? (
          <p className="text-xs text-muted-foreground">
            Sobram {(100 - sumPercent).toFixed(1)}% para caixa/reserva ou novas metas.
          </p>
        ) : null}
      </div>

      {/* Barra de Ações Rápidas de 1-Clique */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {onNormalize ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNormalize}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              <Scale className="size-3.5 shrink-0" aria-hidden="true" />
              {normalizeLabel}
            </Button>
          ) : null}

          {onDistributeEqually ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDistributeEqually}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              <Equal className="size-3.5 shrink-0" aria-hidden="true" />
              {distributeLabel}
            </Button>
          ) : null}

          {onMirrorPosition ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMirrorPosition}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              <Copy className="size-3.5 shrink-0" aria-hidden="true" />
              Espelhar carteira atual
            </Button>
          ) : null}

          {onResetZero ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetZero}
              disabled={saving}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
              Zerar metas
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Barra de Busca e Ordenação para listas com muitos ativos */}
      {rows.length > 3 ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Input
              type="text"
              placeholder="Buscar ativo por código ou classe…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
              aria-label="Buscar ativo"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground select-none">Ordenar por:</span>
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as SortOption)}
              options={[
                { value: "default", label: "Ordem original" },
                { value: "gap-desc", label: "Prioridade de aporte (Gap)" },
                { value: "target-desc", label: "Maior meta %" },
                { value: "current-desc", label: "Maior patrimônio" },
                { value: "alpha", label: "Ticker (A-Z)" },
              ]}
              className="w-48 text-xs"
            />
          </div>
        </div>
      ) : null}

      {/* Lista de Ativos com visual comparativo */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : filteredAndSortedRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum ativo encontrado para &ldquo;{searchQuery}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-2 min-w-0">
          {filteredAndSortedRows.map((row) => {
            const currentPct = row.currentPct ?? 0;
            const delta = calculateAssetAllocationDelta(currentPct, row.target);

            return (
              <div
                key={row.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 shadow-2xs hover:border-border/90 transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{row.label}</span>
                    {row.assetClass ? (
                      <Badge variant="muted" size="xs">
                        {row.assetClass}
                      </Badge>
                    ) : null}

                    {/* Badge de Comparativo Visual Atual vs Alvo */}
                    {row.currentPct !== undefined ? (
                      delta.isUnderallocated ? (
                        <Badge variant="positive" size="xs" className="font-mono">
                          {delta.formattedDelta} · Recebe aporte
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="xs" className="font-mono text-muted-foreground">
                          {delta.formattedDelta} · Alocado
                        </Badge>
                      )
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {row.currentPct !== undefined ? (
                      <>
                        <span className="font-mono text-muted-foreground">
                          Atual: <strong className="text-foreground font-semibold">{row.currentPct.toFixed(1)}%</strong>
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="font-mono text-muted-foreground">
                          Meta: <strong className="text-foreground font-semibold">{(Number.isFinite(row.target) ? row.target : 0).toFixed(1)}%</strong>
                        </span>
                        {row.detail ? (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="text-muted-foreground truncate">{row.detail}</span>
                          </>
                        ) : null}
                      </>
                    ) : row.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex w-full sm:w-52 shrink-0 items-center gap-2 min-w-0">
                  <NumberStepperInput
                    value={Number.isFinite(row.target) ? row.target : 0}
                    min={0}
                    max={100}
                    step={0.5}
                    ariaLabel={`Meta de ${row.label} em %`}
                    onValueChange={(next) => onTargetChange(row.key, Number(next))}
                    className="flex-1 min-w-0 [&_input]:text-right"
                  />
                  <span className="text-sm font-semibold text-muted-foreground shrink-0 select-none">%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botões de Ação Inferiores */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" onClick={onSave} disabled={saving || sumError !== null || rows.length === 0}>
          {saving ? "Salvando…" : saveLabel}
        </Button>
      </div>
    </section>
  );
}
