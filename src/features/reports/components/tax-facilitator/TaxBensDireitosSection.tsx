import { useMemo } from "react";
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

interface TaxGroupSummary {
  key: string;
  groupCode: string;
  groupName: string;
  itemCode: string;
  itemName: string;
  items: TaxAssetItemDetails[];
  subtotalBRL: number;
}

export function TaxBensDireitosSection({
  items,
  totalCostAllAssetsBRL,
  calendarYear,
  copiedKey,
  onCopy,
}: TaxBensDireitosSectionProps) {
  const groupedItems = useMemo(() => {
    const map = new Map<string, TaxGroupSummary>();

    for (const item of items) {
      const key = `${item.group}-${item.code}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        existing.subtotalBRL += item.totalCostBRL;
      } else {
        map.set(key, {
          key,
          groupCode: item.group,
          groupName: item.groupName,
          itemCode: item.code,
          itemName: item.itemName,
          items: [item],
          subtotalBRL: item.totalCostBRL,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [items]);

  return (
    <>
      <section aria-label="Bens e Direitos Tela" className="flex flex-col gap-3 print:hidden print:pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
              Ficha: Bens e Direitos ({items.length} ativos em custódia)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono num">
            Total em 31/12: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {groupedItems.map((group) => (
            <div key={`screen-group-${group.key}`} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 border-b border-border/60 pb-1">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Grupo {group.groupCode} - {group.groupName} · Código {group.itemCode} - {group.itemName}
                </span>
                <span className="text-xs font-mono num text-muted-foreground">
                  Subtotal: <MoneyText cents={numberToCents(group.subtotalBRL)} className="font-bold text-foreground inline" />
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
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
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Bens e Direitos Impressão" className="hidden print:flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-border/80 pb-1">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Ficha: Bens e Direitos — Posição em 31/12/{calendarYear} ({items.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] font-mono num text-muted-foreground">
            Custo Total: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {groupedItems.map((group) => (
            <div key={`print-group-${group.key}`} className="flex flex-col gap-0.5 break-inside-avoid">
              <header className="flex items-center justify-between gap-2 bg-muted/30 border border-border/80 px-2 py-1 text-[8.5px] font-bold text-foreground uppercase tracking-wider break-after-avoid rounded-t">
                <span className="flex-1 min-w-0 leading-tight">
                  Grupo {group.groupCode} - {group.groupName} · Código {group.itemCode} - {group.itemName}
                </span>
                <span className="font-mono num whitespace-nowrap shrink-0 text-right text-[8.5px] inline-flex items-center gap-1 font-bold text-foreground">
                  <span className="font-normal text-muted-foreground">Subtotal:</span>
                  <MoneyText cents={numberToCents(group.subtotalBRL)} className="inline font-bold text-foreground whitespace-nowrap" />
                </span>
              </header>

              <div className="border-x border-b border-border/80 rounded-b overflow-hidden">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "62%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[8.5px] uppercase tracking-wider">
                      <th className="py-0.5 px-2">Ticker</th>
                      <th className="py-0.5 px-2">Discriminação para o Programa IRPF</th>
                      <th className="py-0.5 px-2 text-right">Situação em 31/12 (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {group.items.map((item) => (
                      <tr key={`print-tax-${item.id}`} className="break-inside-avoid even:bg-muted/10">
                        <td className="py-1 px-2 font-bold text-foreground text-[10px] align-top">
                          <span className="break-words whitespace-normal leading-tight block">
                            {item.safeTicker}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-[9px] text-muted-foreground leading-tight align-top">
                          {item.textToCopy}
                        </td>
                        <td className="py-1 px-2 text-right num font-mono font-bold text-foreground whitespace-nowrap text-[10px] align-top">
                          <MoneyText cents={numberToCents(item.totalCostBRL)} hideCurrency />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
