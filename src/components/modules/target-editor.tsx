import { Button } from "@/components/ui/button";
import { NumberStepperInput } from "@/components/ui/number-stepper-input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface TargetEditorRow {
  key: string;
  label: string;
  /** Detalhe exibido ao lado do rótulo (ex.: valor atual e % hoje). */
  detail?: string;
  /** Meta atual em % (0–100). */
  target: number;
}

export interface TargetEditorProps {
  rows: TargetEditorRow[];
  onTargetChange: (key: string, value: number) => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  /** Callback para normalizar todas as metas para 100% em 1 clique (§F39). */
  onNormalize?: () => void;
  /** Soma atual dos percentuais (0–100+). */
  sumPercent: number;
  /** Mensagem de erro quando a soma excede 100% (bloqueia o save). */
  sumError: string | null;
  /** Texto de contexto acima da barra (ex.: "Metas por ativo"). */
  heading?: string;
  emptyMessage?: string;
}

/**
 * Editor em lote de metas de alocação (§3.11.1) — módulo de domínio F4.
 * Barra de soma ≤ 100% com feedback visual; a validação (soma/mensagem) é
 * calculada na tela via `validateTargetsSum` (domain) e passada por props.
 */
export function TargetEditor({
  rows,
  onTargetChange,
  onSave,
  saving = false,
  saveLabel = "Salvar metas",
  onNormalize,
  sumPercent,
  sumError,
  heading,
  emptyMessage = "Nenhum item para definir meta.",
}: TargetEditorProps) {
  const sumClamped = Math.min(100, Math.max(0, sumPercent));

  return (
    <section aria-label={heading ?? "Metas de alocação"} className="flex flex-col gap-4">
      {heading ? <h2 className="text-sm font-semibold text-foreground">{heading}</h2> : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Soma das metas</span>
          <span className={cn("num font-semibold", sumError ? "text-critical" : sumPercent > 0 ? "text-foreground" : "")}>
            {sumPercent.toFixed(1)}%
          </span>
        </div>
        <Progress
          value={sumClamped}
          tone={sumError ? "critical" : "auto"}
          aria-label={`Soma das metas: ${sumPercent.toFixed(1)}%`}
        />
        {sumError ? <p className="text-xs text-critical">{sumError}</p> : null}
        {sumError === null && sumPercent < 100 ? (
          <p className="text-xs text-muted-foreground">
            Sobram {(100 - sumPercent).toFixed(1)}% para caixa/reserva ou novas metas.
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-2 min-w-0">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 shadow-2xs"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                {row.detail ? <p className="truncate text-xs text-muted-foreground">{row.detail}</p> : null}
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
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onNormalize && rows.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={onNormalize}
            disabled={saving}
          >
            Normalizar para 100%
          </Button>
        ) : null}
        <Button type="button" onClick={onSave} disabled={saving || sumError !== null || rows.length === 0}>
          {saving ? "Salvando…" : saveLabel}
        </Button>
      </div>
    </section>
  );
}
