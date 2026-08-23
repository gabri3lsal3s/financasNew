import { useState } from "react";
import { Check, Copy, FileText, Landmark, ShieldCheck } from "lucide-react";
import { Badge, Button, Modal, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import {
  classifyAnnualDividendsReport,
  generateAnnualBensDireitosReport,
} from "@/domain/portfolio";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface PortfolioTaxReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: PortfolioAsset[];
  dividends: PortfolioDividend[];
  defaultYear?: number;
}

/**
 * Facilitador Anual de IRPF com fichas da Receita Federal e botão de cópia rápida (§F40).
 */
export function PortfolioTaxReport({
  open,
  onOpenChange,
  assets,
  dividends,
  defaultYear = new Date().getFullYear(),
}: PortfolioTaxReportProps) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [taxTab, setTaxTab] = useState("bens_direitos");

  const bensDireitosReport = generateAnnualBensDireitosReport(assets, selectedYear);
  const dividendsReport = classifyAnnualDividendsReport(dividends, assets, selectedYear);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      triggerSensory("selection");
      pushToast({
        title: "Texto copiado",
        description: "Texto de discriminação pronto para colar no programa IRPF.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Facilitador de IRPF / Declaração Anual"
      description={`Textos e enquadramentos fiscais pré-formatados para o exercício de ${selectedYear}.`}
      size="xl"
    >
      <div className="flex flex-col gap-5 mt-3">
        {/* Seletor de Ano Base */}
        <div className="flex items-center justify-between gap-3 bg-surface-hover/40 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">Ano-Calendário de Referência:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[selectedYear - 1, selectedYear].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedYear === y
                    ? "bg-portfolio text-portfolio-foreground shadow-xs"
                    : "bg-surface-hover text-muted-foreground hover:text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Fichas IRPF em Tabs */}
        <Tabs
          value={taxTab}
          onValueChange={setTaxTab}
          items={[
            {
              value: "bens_direitos",
              label: "Bens e Direitos",
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Posição em 31/12 (Custo de Aquisição Histórico)</span>
                    <span className="font-semibold text-foreground">
                      Total: <MoneyText cents={bensDireitosReport.totalCostCents} tone="default" />
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {bensDireitosReport.items.map((item) => {
                      const isCopied = copiedId === item.assetId;
                      return (
                        <div
                          key={item.assetId}
                          className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2">
                              <strong className="font-mono text-sm font-bold text-foreground">{item.ticker}</strong>
                              <Badge variant="muted" className="text-[10px]">
                                Grupo {item.groupCode} · Código {item.itemCode}
                              </Badge>
                            </div>
                            <MoneyText cents={item.totalCostCents} tone="default" className="text-xs font-bold" />
                          </div>

                          <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground/90 font-mono select-all leading-relaxed">
                            {item.discrimination}
                          </div>

                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {item.groupName} — {item.itemName}
                            </span>
                            <Button
                              type="button"
                              variant={isCopied ? "positive" : "outline"}
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1.5 shrink-0"
                              onClick={() => void handleCopy(item.assetId, item.discrimination)}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" aria-hidden="true" />
                                  <span>Copiar Discriminação</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            },
            {
              value: "proventos_fichas",
              label: `Rendimentos Isentos & Exclusivos`,
              content: (
                <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-1">
                  {/* Ficha 09 */}
                  <div className="flex flex-col gap-2 rounded-xl border border-border p-3.5 bg-surface">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />
                        <h4 className="text-xs font-semibold text-foreground">
                          Ficha 09 — Rendimentos Isentos e Não Tributáveis
                        </h4>
                      </div>
                      <MoneyText cents={dividendsReport.exemptDividends.totalCents} tone="positive" className="text-xs font-bold" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Dividendos de ações e rendimentos mensais de FIIs isentos de IR.
                    </p>

                    {dividendsReport.exemptDividends.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhum dividendo isento registrado no ano.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border/60">
                        {dividendsReport.exemptDividends.items.map((it) => (
                          <div key={it.assetId} className="flex items-center justify-between py-1.5 text-xs">
                            <span className="font-mono font-medium text-foreground">{it.ticker}</span>
                            <MoneyText cents={it.amountCents} tone="positive" className="font-semibold" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ficha 10 */}
                  <div className="flex flex-col gap-2 rounded-xl border border-border p-3.5 bg-surface">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-portfolio" aria-hidden="true" />
                        <h4 className="text-xs font-semibold text-foreground">
                          Ficha 10 — Rendimentos Sujeitos à Tributação Exclusiva
                        </h4>
                      </div>
                      <MoneyText cents={dividendsReport.exclusiveJCP.totalCents} tone="portfolio" className="text-xs font-bold" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Juros sobre Capital Próprio (JCP) retidos na fonte (15%).
                    </p>

                    {dividendsReport.exclusiveJCP.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhum JCP registrado no ano.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border/60">
                        {dividendsReport.exclusiveJCP.items.map((it) => (
                          <div key={it.assetId} className="flex items-center justify-between py-1.5 text-xs">
                            <span className="font-mono font-medium text-foreground">{it.ticker}</span>
                            <MoneyText cents={it.amountCents} tone="portfolio" className="font-semibold" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
