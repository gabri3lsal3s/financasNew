import { useState } from "react";
import { Check, Copy, FileText, Landmark, ShieldCheck } from "lucide-react";
import { Badge, Button, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { ReportDocumentLayout, ReportHeader, ReportFooter } from "@/components/modules/reports";
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
 * Facilitador Anual de IRPF com fichas da Receita Federal e exportação A4/PDF (§F40).
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
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Facilitador de IRPF / Declaração Anual"
      documentTitle={`Informe_Rendimentos_IRPF_${selectedYear}.pdf`}
      size="2xl"
    >
      <div className="flex flex-col gap-5 w-full">
        {/* Cabeçalho Institucional */}
        <ReportHeader
          title="Informe Consolidado para IRPF"
          subtitle="Bens e Direitos, Rendimentos Isentos e Tributação Exclusiva"
          periodLabel={`Ano-Calendário ${selectedYear}`}
          icon={Landmark}
        />

        {/* Seletor de Ano Base */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-hover/40 p-3 rounded-xl border border-border print:hidden">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">Ano-Calendário de Referência:</span>
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {[selectedYear - 1, selectedYear].map((y) => (
              <Button
                key={y}
                type="button"
                size="sm"
                variant={selectedYear === y ? "default" : "outline"}
                onClick={() => setSelectedYear(y)}
                className="h-7 px-3 text-xs flex-1 sm:flex-initial"
              >
                {y}
              </Button>
            ))}
          </div>
        </div>

        {/* 1. Modo Interativo em Tela com Tabs */}
        <div className="print:hidden">
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

                    <div className="flex flex-col gap-2.5">
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
                                {item.groupName} - {item.itemName}
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
                  <div className="flex flex-col gap-4">
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

        {/* 2. Modo Impressão Contínua (Renderiza todas as fichas sequencialmente) */}
        <div className="hidden print:flex print:flex-col print:gap-4 w-full">
          {/* Seção 1: Bens e Direitos */}
          <section className="flex flex-col gap-2 break-inside-avoid">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Ficha de Bens e Direitos (Posição em 31/12)
              </h3>
              <span className="text-xs font-bold">
                Total: <MoneyText cents={bensDireitosReport.totalCostCents} tone="default" />
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {bensDireitosReport.items.map((item) => (
                <div
                  key={item.assetId}
                  className="flex flex-col gap-1 rounded-lg border border-border p-2.5 break-inside-avoid bg-white"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-xs font-bold">{item.ticker}</strong>
                      <span className="text-[10px] text-muted-foreground">
                        Grupo {item.groupCode} · Código {item.itemCode}
                      </span>
                    </div>
                    <MoneyText cents={item.totalCostCents} tone="default" className="text-xs font-bold" />
                  </div>
                  <div className="text-[11px] text-foreground font-mono leading-snug pt-0.5">
                    {item.discrimination}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Seção 2: Proventos Isentos e Tributação Exclusiva */}
          <section className="grid grid-cols-2 gap-3 break-inside-avoid pt-2">
            <div className="rounded-lg border border-border p-2.5 flex flex-col gap-1.5 bg-white">
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span className="text-[11px] font-bold">Ficha 09 — Isentos</span>
                <MoneyText cents={dividendsReport.exemptDividends.totalCents} tone="positive" className="text-xs font-bold" />
              </div>
              {dividendsReport.exemptDividends.items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">Nenhum dividendo isento no ano.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border/40">
                  {dividendsReport.exemptDividends.items.map((it) => (
                    <div key={it.assetId} className="flex items-center justify-between py-1 text-[11px]">
                      <span className="font-mono">{it.ticker}</span>
                      <MoneyText cents={it.amountCents} tone="positive" className="font-medium" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-2.5 flex flex-col gap-1.5 bg-white">
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span className="text-[11px] font-bold">Ficha 10 — Exclusiva (JCP)</span>
                <MoneyText cents={dividendsReport.exclusiveJCP.totalCents} tone="portfolio" className="text-xs font-bold" />
              </div>
              {dividendsReport.exclusiveJCP.items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">Nenhum JCP no ano.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border/40">
                  {dividendsReport.exclusiveJCP.items.map((it) => (
                    <div key={it.assetId} className="flex items-center justify-between py-1 text-[11px]">
                      <span className="font-mono">{it.ticker}</span>
                      <MoneyText cents={it.amountCents} tone="portfolio" className="font-medium" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Rodapé Institucional */}
        <ReportFooter
          disclaimer="Documento gerado automaticamente para suporte ao preenchimento da Declaração de Ajuste Anual do IRPF. Os valores refletem os registros de custódia e proventos mantidos no Guia Financeiro."
        />
      </div>
    </ReportDocumentLayout>
  );
}
