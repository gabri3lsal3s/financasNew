import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
} from "@/components/modules";
import { Alert, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface TaxFacilitatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: readonly PortfolioAsset[];
  dividends: readonly PortfolioDividend[];
  appName?: string;
  accountHolder?: string;
}

/**
 * Facilitador de Declaração de IRPF Anual (F40/F42/F44).
 * Apresenta discriminações formatadas para cópia no programa da Receita Federal
 * e consolidação de rendimentos isentos/exclusivos em layout A4.
 */
export function TaxFacilitatorModal({
  open,
  onOpenChange,
  assets,
  dividends,
  appName = "Guia Financeiro",
  accountHolder,
}: TaxFacilitatorModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const calendarYear = currentYear - 1; // Ano base da declaração

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

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Facilitador de IRPF Anual"
      maxWidthClassName="max-w-5xl"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title={`Facilitador de Declaração de IRPF — Ano-Base ${calendarYear}`}
        subtitle="Bens &amp; Direitos (Discriminação Pronta) e Rendimentos Isentos &amp; Exclusivos"
        periodLabel={`Exercício ${currentYear}`}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Alerta Informativo (Apenas tela) */}
      <div className="print:hidden">
        <Alert variant="info">
          Utilize o botão de cópia rápida para preencher o campo &quot;Discriminação&quot; diretamente no programa da Receita Federal. Valores de custo calculados com base no Preço Médio Ponderado.
        </Alert>
      </div>

      {/* 3. Seção: Ficha de Bens e Direitos */}
      <section aria-label="Bens e Direitos" className="flex flex-col gap-3">
        <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
          Ficha: Bens e Direitos ({nonCashAssets.length} ativos em custódia)
        </h3>
        <div className="flex flex-col gap-3">
          {nonCashAssets.map((asset) => {
            const totalCostBRL = asset.quantity * asset.average_price;
            const code =
              asset.asset_class === "acoes"
                ? "31 - Ações"
                : asset.asset_class === "fiis"
                  ? "73 - Fundos Imobiliários"
                  : asset.asset_class === "cripto"
                    ? "81 - Criptoativos"
                    : "45 - Renda Fixa / Títulos";
            const textToCopy = `${asset.quantity.toLocaleString("pt-BR", {
              maximumFractionDigits: 4,
            })} cotas de ${asset.ticker}, custo médio unitário de R$ ${asset.average_price
              .toFixed(2)
              .replace(".", ",")}, totalizando R$ ${totalCostBRL.toFixed(2).replace(".", ",")}.`;

            return (
              <div
                key={asset.id}
                className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2 break-inside-avoid print:bg-white print:border-border"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{asset.ticker}</span>
                    <span className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/40">
                      {code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Situação em 31/12:</span>
                    <MoneyText
                      cents={numberToCents(totalCostBRL)}
                      className="font-bold font-mono num text-xs text-foreground"
                    />
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

      {/* 4. Seção: Ficha de Rendimentos Recebidos */}
      <section aria-label="Rendimentos Recebidos" className="break-inside-avoid flex flex-col gap-3 pt-2">
        <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
          Ficha: Rendimentos Isentos &amp; Exclusivos ({calendarYear})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse print:table-fixed">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
                <th className="py-2.5 px-3 print:w-[25%]">Ticker</th>
                <th className="py-2.5 px-3 print:w-[45%]">Tipo / Ficha</th>
                <th className="py-2.5 px-3 text-right print:w-[30%]">Total Recebido (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {nonCashAssets.map((asset) => {
                const assetDividends = dividends
                  .filter((d) => d.asset_id === asset.id && d.date.startsWith(String(calendarYear)))
                  .reduce((acc, d) => acc + d.amount, 0);

                if (assetDividends <= 0) return null;

                const tipoRendimento =
                  asset.asset_class === "fiis"
                    ? "Rendimentos Isentos (FII)"
                    : "Dividendos Isentos (Ações)";

                return (
                  <tr key={`div-${asset.id}`} className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-semibold text-foreground truncate">{asset.ticker}</td>
                    <td className="py-2 px-3 text-muted-foreground truncate">{tipoRendimento}</td>
                    <td className="py-2 px-3 text-right num font-mono font-medium text-positive-strong">
                      <MoneyText cents={numberToCents(assetDividends)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento auxiliar e orientativo gerado pelo Guia Financeiro. A verificação final e a entrega da Declaração de Ajuste Anual cabem exclusivamente ao contribuinte."
      />
    </ReportDocumentLayout>
  );
}
