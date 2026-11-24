import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  RotateCcw,
  Scissors,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ModalFooter,
  MoneyText,
  SegmentedControl,
} from "@/components/ui";
import {
  buildClipperLinePreviews,
  computeClippedSelection,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { cn } from "@/lib/utils";

type ClipperViewMode = "candidates" | "all";

export interface StatementBlockClipperSelection {
  transactions: StatementTransaction[];
  startIndex: number;
  endIndex: number;
  excludedLineIndices: number[];
}

export interface StatementBlockClipperStepProps {
  rawLines: readonly string[];
  cardId: string;
  competenceMonth: string;
  officialTotalCents?: number | null;
  reasonMessage?: string | null;
  onConfirmSelection: (selection: StatementBlockClipperSelection) => void;
  onBack: () => void;
  formId?: string;
  hideFooter?: boolean;
}

/**
 * Camada 5 — Assistente Guiado Sem Tokens (`StatementBlockClipperStep`):
 * 100% inline no modal de importação (zero modais aninhados, zero autoFocus, zero emojis).
 * Permite marcar em 2 cliques Início e Fim das compras, alternar entre linhas candidatas e todas,
 * desmarcar linhas intrusas pontualmente e acompanhar em tempo real Selecionado vs Fatura Oficial.
 */
export function StatementBlockClipperStep({
  rawLines,
  cardId,
  competenceMonth,
  officialTotalCents = null,
  reasonMessage = null,
  onConfirmSelection,
  onBack,
  formId,
  hideFooter = false,
}: StatementBlockClipperStepProps) {
  const [viewMode, setViewMode] = useState<ClipperViewMode>("candidates");
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [endIndex, setEndIndex] = useState<number | null>(null);
  const [excludedSet, setExcludedSet] = useState<Set<number>>(() => new Set());

  const previews = useMemo(
    () =>
      buildClipperLinePreviews({
        rawLines,
        cardId,
        competenceMonth,
      }),
    [rawLines, cardId, competenceMonth],
  );

  const candidateCount = useMemo(
    () => previews.filter((p) => p.isCandidate).length,
    [previews],
  );

  const visibleLines = useMemo(
    () =>
      viewMode === "candidates"
        ? previews.filter((p) => p.isCandidate)
        : previews,
    [previews, viewMode],
  );

  const selection = useMemo(
    () =>
      computeClippedSelection({
        previews,
        startIndex,
        endIndex,
        excludedLineIndices: excludedSet,
        cardId,
        competenceMonth,
      }),
    [previews, startIndex, endIndex, excludedSet, cardId, competenceMonth],
  );

  const rangeMin =
    startIndex !== null
      ? Math.min(startIndex, endIndex ?? startIndex)
      : null;
  const rangeMax =
    startIndex !== null
      ? Math.max(startIndex, endIndex ?? startIndex)
      : null;

  const hasOfficialTotal = officialTotalCents !== null && officialTotalCents > 0;
  const diffCents = hasOfficialTotal
    ? selection.selectedNetCents - officialTotalCents
    : 0;
  const isConferred =
    hasOfficialTotal &&
    selection.transactions.length > 0 &&
    Math.abs(diffCents) <= 5;

  const handleRowClick = (lineIndex: number) => {
    if (startIndex === null) {
      setStartIndex(lineIndex);
      setEndIndex(null);
      setExcludedSet(new Set());
      return;
    }

    if (endIndex === null) {
      setEndIndex(lineIndex);
      return;
    }

    // Já possui intervalo marcado: novo clique reinicia o recorte a partir da linha clicada
    setStartIndex(lineIndex);
    setEndIndex(null);
    setExcludedSet(new Set());
  };

  const handleToggleExcluded = (lineIndex: number, include: boolean) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      if (include) {
        next.delete(lineIndex);
      } else {
        next.add(lineIndex);
      }
      return next;
    });
  };

  const handleResetSelection = () => {
    setStartIndex(null);
    setEndIndex(null);
    setExcludedSet(new Set());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rangeMin === null || rangeMax === null || selection.transactions.length === 0) {
      return;
    }
    onConfirmSelection({
      transactions: selection.transactions,
      startIndex: rangeMin,
      endIndex: rangeMax,
      excludedLineIndices: Array.from(excludedSet).sort((a, b) => a - b),
    });
  };

  const instructionText =
    startIndex === null
      ? "Passo 1 de 2: clique na primeira linha de compra para marcar o início."
      : endIndex === null
        ? "Passo 2 de 2: clique na última linha de compra para marcar o fim."
        : "Intervalo definido. Desmarque eventuais linhas intrusas para ajustar o total.";

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-3">
      {/* Barra fixa de conferência ao vivo: Selecionado vs Fatura Oficial */}
      <div
        role="region"
        aria-label="Resumo do recorte manual"
        className="sticky top-0 z-10 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs space-y-2.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Scissors className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground tracking-tight">
              Recorte guiado de lançamentos
            </span>
            <Badge variant="muted" size="xs">
              {selection.transactions.length}{" "}
              {selection.transactions.length === 1 ? "selecionado" : "selecionados"}
            </Badge>
            {hasOfficialTotal && selection.transactions.length > 0 ? (
              <Badge variant={isConferred ? "positive" : "warning"} size="xs">
                {isConferred ? (
                  <>
                    <CheckCheck className="size-3" aria-hidden="true" />
                    Soma conferida
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3" aria-hidden="true" />
                    Diferença: {diffCents > 0 ? "+" : ""}
                    {(diffCents / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </>
                )}
              </Badge>
            ) : null}
          </div>

          {startIndex !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetSelection}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground self-start sm:self-center cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
              Limpar marcação
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2 rounded-xl bg-surface-raised px-3 py-2 border border-border/60">
            <span className="text-[11px] text-muted-foreground">Selecionado:</span>
            <MoneyText
              cents={selection.selectedNetCents}
              tone={isConferred ? "positive" : "default"}
              className="font-semibold text-sm tabular-nums"
            />
          </div>

          {hasOfficialTotal ? (
            <div className="flex items-baseline justify-between sm:justify-start sm:gap-2 rounded-xl bg-surface-raised px-3 py-2 border border-border/60">
              <span className="text-[11px] text-muted-foreground">Fatura Oficial:</span>
              <MoneyText
                cents={officialTotalCents}
                tone="default"
                className="font-semibold text-sm tabular-nums"
              />
            </div>
          ) : null}
        </div>

        {reasonMessage ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {reasonMessage}
          </p>
        ) : null}
      </div>

      {/* Controles de instrução e filtro (Candidatas vs Todas as linhas) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
        <p className="text-xs text-muted-foreground">{instructionText}</p>
        <SegmentedControl
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Filtro de linhas do extrato"
          size="sm"
          options={[
            { value: "candidates", label: `Candidatas (${candidateCount})` },
            { value: "all", label: `Todas (${previews.length})` },
          ]}
        />
      </div>

      {/* Lista interativa de linhas para marcação Início–Fim + Exclusão Pontual */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs max-h-[340px] overflow-y-auto divide-y divide-border/60">
        {visibleLines.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nenhuma linha encontrada neste filtro"
              description="Alterne para Todas as linhas para visualizar o conteúdo bruto do documento."
            />
          </div>
        ) : (
          visibleLines.map((line) => {
            const isInRange =
              rangeMin !== null &&
              rangeMax !== null &&
              line.lineIndex >= rangeMin &&
              line.lineIndex <= rangeMax;
            const isStartBoundary = rangeMin === line.lineIndex;
            const isEndBoundary = endIndex !== null && rangeMax === line.lineIndex;
            const isExcluded = excludedSet.has(line.lineIndex);
            const isIncludedCandidate = isInRange && line.isCandidate && !isExcluded;

            return (
              <div
                key={line.lineIndex}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                  isIncludedCandidate && "bg-primary/8",
                  isInRange && isExcluded && "bg-muted/40 opacity-65",
                  !isInRange && "hover:bg-surface-hover",
                )}
              >
                {/* Checkbox compacto de exclusão pontual apenas para candidatas dentro do intervalo */}
                {isInRange && line.isCandidate ? (
                  <Checkbox
                    checked={!isExcluded}
                    onCheckedChange={(checked) =>
                      handleToggleExcluded(line.lineIndex, checked)
                    }
                    aria-label={`Incluir linha ${line.lineIndex + 1}: ${line.parsedTransaction?.cleanDescription ?? line.rawText}`}
                  />
                ) : (
                  <span
                    className="w-4 text-center text-[10px] font-mono text-muted-foreground shrink-0 select-none"
                    aria-hidden="true"
                  >
                    {line.lineIndex + 1}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleRowClick(line.lineIndex)}
                  className="flex-1 min-w-0 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 py-0.5"
                >
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    {isStartBoundary ? (
                      <Badge variant="default" size="xs">
                        Início
                      </Badge>
                    ) : null}
                    {isEndBoundary ? (
                      <Badge variant="portfolio" size="xs">
                        Fim
                      </Badge>
                    ) : null}
                    <span
                      className={cn(
                        "break-words text-foreground",
                        !line.isCandidate && "text-muted-foreground",
                        isInRange && isExcluded && "line-through",
                      )}
                    >
                      {line.rawText}
                    </span>
                  </div>

                  {line.parsedTransaction ? (
                    <MoneyText
                      cents={line.parsedTransaction.amountCents}
                      tone={line.parsedTransaction.isRefund ? "positive" : "default"}
                      className={cn(
                        "text-xs font-semibold shrink-0 tabular-nums",
                        isInRange && isExcluded && "line-through text-muted-foreground",
                      )}
                    />
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>

      {!hideFooter ? (
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={onBack} className="gap-1.5">
            <RotateCcw className="size-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button
            type="submit"
            disabled={selection.transactions.length === 0}
            className="gap-1.5"
          >
            <Check className="size-4" aria-hidden="true" />
            Usar {selection.transactions.length}{" "}
            {selection.transactions.length === 1 ? "lançamento" : "lançamentos"}
          </Button>
        </ModalFooter>
      ) : null}
    </form>
  );
}
