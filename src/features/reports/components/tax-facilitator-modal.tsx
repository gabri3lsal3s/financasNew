import { useState } from "react";
import { Check, Copy, Landmark, Printer } from "lucide-react";
import { Alert, Button, Modal } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { PrintSheet } from "@/components/ui/print-sheet";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface TaxFacilitatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: readonly PortfolioAsset[];
  dividends: readonly PortfolioDividend[];
  appName?: string;
}

export function TaxFacilitatorModal({
  open,
  onOpenChange,
  assets,
  dividends,
  appName = "Finanças Pessoais",
}: TaxFacilitatorModalProps) {
  const [printing, setPrinting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const calendarYear = currentYear - 1; // Ano base da declaração

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  const nonCashAssets = assets.filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Silencioso em falhas de clipboard
    }
  };

  const reportContent = (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary-strong">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">Facilitador de Declaração Anual de IRPF (Ano-Calendário {calendarYear})</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-medium text-foreground">Exercício {currentYear}</span>
          <span>Posição em 31/12/{calendarYear}</span>
        </div>
      </header>

      {/* Alerta Informativo */}
      <div className="print:hidden">
        <Alert variant="info">
          Utilize o botão de cópia rápida para preencher o campo &quot;Discriminação&quot; diretamente no programa da Receita Federal. Valores de custo calculados com base no Preço Médio Ponderado.
        </Alert>
      </div>

      {/* Seção 1: Ficha de Bens e Direitos */}
      <section aria-label="Bens e Direitos" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Ficha: Bens e Direitos ({nonCashAssets.length} ativos)</h3>
        <div className="flex flex-col gap-3">
          {nonCashAssets.map((asset) => {
            const totalCostBRL = asset.quantity * asset.average_price;
            const code = asset.asset_class === "acoes" ? "31 - Ações" : asset.asset_class === "fiis" ? "73 - Fundos Imobiliários" : asset.asset_class === "cripto" ? "81 - Criptoativos" : "45 - Renda Fixa / Títulos";
            const textToCopy = `${asset.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} cotas de ${asset.ticker}, custo médio unitário de R$ ${asset.average_price.toFixed(2).replace(".", ",")}, totalizando R$ ${totalCostBRL.toFixed(2).replace(".", ",")}.`;


            return (
              <div key={asset.id} className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{asset.ticker}</span>
                    <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[10px] text-muted-foreground font-medium">{code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Situação em 31/12:</span>
                    <MoneyText cents={numberToCents(totalCostBRL)} className="font-bold font-mono text-xs text-foreground" />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                    {textToCopy}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(asset.id, textToCopy)}
                    className="gap-1.5 shrink-0 text-xs print:hidden"
                  >
                    {copiedKey === asset.id ? (
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
            );
          })}
        </div>
      </section>

      {/* Seção 2: Ficha de Rendimentos Recebidos */}
      <section aria-label="Rendimentos Recebidos" className="flex flex-col gap-3 pt-2">
        <h3 className="text-sm font-semibold text-foreground">Ficha: Rendimentos Isentos &amp; Exclusivos ({calendarYear})</h3>
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3">Tipo / Ficha</th>
                <th className="py-2.5 px-3 text-right">Total Recebido (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {nonCashAssets.map((asset) => {
                const assetDividends = dividends
                  .filter((d) => d.asset_id === asset.id && d.date.startsWith(String(calendarYear)))
                  .reduce((acc, d) => acc + d.amount, 0);

                if (assetDividends <= 0) return null;

                const tipoRendimento = asset.asset_class === "fiis" ? "Rendimentos Isentos (FII)" : "Dividendos Isentos (Ações)";

                return (
                  <tr key={`div-${asset.id}`} className="hover:bg-surface-hover/30">
                    <td className="py-2 px-3 font-semibold text-foreground">{asset.ticker}</td>
                    <td className="py-2 px-3 text-muted-foreground">{tipoRendimento}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-positive-strong">
                      <MoneyText cents={numberToCents(assetDividends)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rodapé da Página A4 */}
      <footer className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>{appName} — Facilitador de Declaração de IRPF</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Facilitador de IRPF Anual"
        description="Discriminações de Bens &amp; Direitos prontas para cópia e consolidação de rendimentos."
        size="xl"
      >
        <div className="flex flex-col gap-6">
          <div className="p-4 sm:p-6 bg-surface rounded-xl border border-border">
            {reportContent}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="button" variant="default" onClick={handlePrint} className="gap-2">
              <Printer className="size-4" aria-hidden="true" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </Modal>

      <PrintSheet open={printing}>
        {reportContent}
      </PrintSheet>
    </>
  );
}
