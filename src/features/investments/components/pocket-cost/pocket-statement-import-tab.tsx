import { Check, Sparkles } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText, Textarea } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { StatementParseResult } from "@/domain/portfolio/pocket-statement-parser";
import { formatDateBR } from "@/lib/date";

export interface PocketStatementImportTabProps {
  statementText: string;
  onStatementTextChange: (text: string) => void;
  parseResult: StatementParseResult | null;
  replaceExisting: boolean;
  onReplaceExistingChange: (replace: boolean) => void;
  isImporting: boolean;
  onProcessStatement: () => void;
  onConfirmImport: () => void;
}

export function PocketStatementImportTab({
  statementText,
  onStatementTextChange,
  parseResult,
  replaceExisting,
  onReplaceExistingChange,
  isImporting,
  onProcessStatement,
  onConfirmImport,
}: PocketStatementImportTabProps) {
  const grossCount = parseResult?.rows.filter((r) => r.grossBalance !== undefined).length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 flex items-start gap-2.5">
        <Sparkles className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            Cálculo Automático de Aportes e Resgates
          </span>
          <p>
            Copie a tabela do extrato da sua corretora ou banco (com colunas como Mês, Ano, Valor Aplicado e Saldo) e cole abaixo. O assistente calculará automaticamente os deltas de cada mês, identificará aportes e resgates e descartará meses zerados.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          value={statementText}
          onChange={(e) => onStatementTextChange(e.target.value)}
          placeholder={`Cole o extrato aqui...\nExemplo:\nOut. 2023  6.187,37  6.147,97\nNov. 2023  8.678,16  8.745,74\nDez. 2023  13.527,62 14.221,47`}
          rows={5}
          aria-label="Conteúdo do extrato da corretora"
          className="font-mono text-base sm:text-sm"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1.5">
          <span className="text-[11px] text-muted-foreground leading-tight">
            Suporta formatos da XP, BTG, Itaú, Kinvo, Gorila e planilhas Excel.
          </span>
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent="selection"
            onClick={onProcessStatement}
            className="gap-1.5 w-full sm:w-auto shrink-0 justify-center"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Processar Extrato</span>
          </Button>
        </div>
      </div>

      {parseResult ? (
        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-xs">
                Pré-visualização dos Marcos Detectados
              </span>
              <Badge variant="default" size="xs">
                {parseResult.actionableRows.length} movimentações
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Capital Líquido: <MoneyText cents={numberToCents(parseResult.netCapital)} />
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-surface border border-border/80 flex flex-col">
              <span className="text-muted-foreground">Meses Analisados</span>
              <span className="font-semibold font-mono text-foreground">{parseResult.rows.length}</span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-border/80 flex flex-col">
              <span className="text-muted-foreground">Aportes Brutos</span>
              <MoneyText cents={numberToCents(parseResult.totalAportes)} tone="positive" sign="explicit" className="font-semibold" />
            </div>
            <div className="p-2 rounded-lg bg-surface border border-border/80 flex flex-col">
              <span className="text-muted-foreground">Resgates Brutos</span>
              <span className="font-semibold font-mono text-warning-strong">
                - <MoneyText cents={numberToCents(parseResult.totalResgates)} tone="default" className="text-warning-strong" />
              </span>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-border/80 flex flex-col">
              <span className="text-muted-foreground">Meses sem aporte</span>
              <span className="font-semibold font-mono text-muted-foreground">
                {parseResult.rows.length - parseResult.actionableRows.length} (ignorados)
              </span>
            </div>
          </div>

          {grossCount > 0 ? (
            <div className="rounded-lg border border-portfolio/20 bg-portfolio/5 p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="size-3.5 text-portfolio shrink-0" aria-hidden="true" />
                <span className="text-foreground font-medium text-[11px]">
                  Saldo Bruto detectado em {grossCount} meses — gerará automaticamente os snapshots para TWR e evolução histórica!
                </span>
              </div>
              <Badge variant="portfolio" size="xs">TWR Ativo</Badge>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            {parseResult.actionableRows.map((row, idx) => (
              <div
                key={`${row.date}-${idx}`}
                className="rounded-lg border border-border/80 bg-surface px-2.5 py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-foreground font-medium shrink-0">
                    {formatDateBR(row.date)}
                  </span>
                  <Badge variant={row.type === "resgate" ? "warning" : "muted"} size="xs" className="shrink-0">
                    {row.type === "resgate" ? "Resgate" : "Aporte"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                    {row.label}
                  </span>
                  {row.grossBalance !== undefined ? (
                    <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap tabular-nums hidden md:inline-flex items-center gap-1">
                      <span>· Saldo:</span>
                      <MoneyText cents={numberToCents(row.grossBalance)} tone="default" variant="caption" />
                    </span>
                  ) : null}
                </div>
                <span
                  className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                    row.type === "resgate" ? "text-warning-strong" : "text-positive-strong"
                  }`}
                >
                  {row.type === "resgate" ? "- " : "+ "}
                  <MoneyText
                    cents={numberToCents(Math.abs(row.delta))}
                    tone={row.type === "resgate" ? "default" : "positive"}
                    className={row.type === "resgate" ? "text-warning-strong" : undefined}
                  />
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-border/80">
            <Checkbox
              checked={replaceExisting}
              onCheckedChange={onReplaceExistingChange}
              label="Substituir marcos anteriores cadastrados (recomendado)"
            />

            <Button
              type="button"
              variant="default"
              size="sm"
              loading={isImporting}
              onClick={onConfirmImport}
              disabled={isImporting}
              sensoryIntent={false}
              className="gap-1.5 w-full sm:w-auto"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{`Gravar ${parseResult.actionableRows.length} Marcos`}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
