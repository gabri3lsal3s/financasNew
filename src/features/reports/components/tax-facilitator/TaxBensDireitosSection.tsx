import { Check, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { TaxAssetItemDetails } from "./tax-facilitator-utils";

export interface TaxBensDireitosSectionProps {
  items: readonly TaxAssetItemDetails[];
  totalCostAllAssetsBRL: number;
  calendarYear: number;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}

export function TaxBensDireitosSection({
  items,
  totalCostAllAssetsBRL,
  calendarYear,
  copiedKey,
  onCopy,
}: TaxBensDireitosSectionProps) {
  return (
    <>
      <section aria-label="Bens e Direitos Tela" className="flex flex-col gap-3 print:hidden print:pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
              Ficha: Bens e Direitos ({items.length} ativos em custódia)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono num">
            Total em 31/12: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-bold text-foreground text-sm">{item.safeTicker}</span>
                  <span className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/40">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Situação em 31/12/{calendarYear}:</span>
                  <MoneyText
                    cents={numberToCents(item.totalCostBRL)}
                    className="font-bold text-xs text-foreground"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {item.textToCopy}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent="selection"
                  onClick={() => onCopy(item.id, item.textToCopy)}
                  className="gap-1.5 shrink-0 text-xs self-end sm:self-start"
                >
                  {copiedKey === item.id ? (
                    <>
                      <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Bens e Direitos Impressão" className="hidden print:flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-border/70 pb-1">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Ficha: Bens e Direitos — Posição em 31/12/{calendarYear} ({items.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] font-mono num text-muted-foreground">
            Custo Total: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <div className="rounded-lg border border-border/80 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                <th className="py-1.5 px-2 w-[16%]">Código / Grupo</th>
                <th className="py-1.5 px-1.5 w-[12%]">Ticker</th>
                <th className="py-1.5 px-2 w-[56%]">Discriminação para o Programa IRPF</th>
                <th className="py-1.5 px-2 text-right w-[16%]">Situação em 31/12</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((item) => (
                <tr key={`print-tax-${item.id}`} className="break-inside-avoid even:bg-muted/20">
                  <td className="py-1 px-2 text-[10px] font-mono text-muted-foreground">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground leading-tight">
                        {item.group}-{item.code}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {item.itemName}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 px-1.5 font-bold text-foreground text-[11px] truncate">
                    {item.safeTicker}
                  </td>
                  <td className="py-1 px-2 text-[10px] text-muted-foreground leading-tight">
                    {item.textToCopy}
                  </td>
                  <td className="py-1 px-2 text-right num font-mono font-bold text-foreground whitespace-nowrap text-[11px]">
                    <MoneyText cents={numberToCents(item.totalCostBRL)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
