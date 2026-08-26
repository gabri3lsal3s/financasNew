import { useState, useMemo } from "react";
import { Check, Copy, Landmark, FileText, PiggyBank } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
} from "@/components/modules";
import { Alert, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import { sanitizeReportText } from "@/domain/reports";
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
 * e consolidação de rendimentos isentos/exclusivos em layout A4 de alta densidade contábil.
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

  const nonCashAssets = useMemo(
    () => assets.filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0),
    [assets],
  );

  const totalCostAllAssetsBRL = useMemo(
    () => nonCashAssets.reduce((acc, a) => acc + a.quantity * a.average_price, 0),
    [nonCashAssets],
  );

  // Rendimentos isentos calculados por ativo no ano-base
  const rendimentosPorAtivo = useMemo(() => {
    return nonCashAssets
      .map((asset) => {
        const assetDividends = dividends
          .filter((d) => d.asset_id === asset.id && d.date.startsWith(String(calendarYear)))
          .reduce((acc, d) => acc + d.amount, 0);

        if (assetDividends <= 0) return null;

        const tipoRendimento =
          asset.asset_class === "fiis"
            ? "Rendimentos Isentos (FII)"
            : "Dividendos Isentos (Ações)";

        return {
          asset,
          tipoRendimento,
          amountBRL: assetDividends,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [nonCashAssets, dividends, calendarYear]);

  const totalRendimentosBRL = useMemo(
    () => rendimentosPorAtivo.reduce((acc, r) => acc + r.amountBRL, 0),
    [rendimentosPorAtivo],
  );

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Silencioso em falhas de clipboard
    }
  };

  const formatMoneyBR = (cents: number): string =>
    (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTaxGroupCode = (assetClass?: string | null): { group: string; code: string; label: string } => {
    const normalized = (assetClass ?? "").toLowerCase().trim();
    switch (normalized) {
      case "acao":
      case "acoes":
      case "ações":
        return { group: "03", code: "01", label: "03-01 Ações" };
      case "fii":
      case "fiis":
        return { group: "07", code: "03", label: "07-03 FIIs" };
      case "cripto":
      case "bitcoin":
      case "crypto":
        return { group: "08", code: "01", label: "08-01 Cripto" };
      case "renda_fixa":
      case "rendafixa":
      case "cdb":
      case "tesouro":
      case "lci":
      case "lca":
        return { group: "04", code: "02", label: "04-02 Renda Fixa" };
      case "internacional":
      case "etf":
      case "etfs":
      case "bdr":
      case "bdrs":
        return { group: "07", code: "09", label: "07-09 Internacional" };
      default:
        return { group: "99", code: "99", label: "99-99 Outros" };
    }
  };

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê Fiscal & Facilitador de IRPF"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title={`Facilitador de Declaração de IRPF — Ano-Base ${calendarYear}`}
        subtitle="Bens & Direitos (Discriminação Pronta) e Rendimentos Isentos & Exclusivos"
        periodLabel={`Exercício ${currentYear}`}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Alerta Informativo (Apenas tela interativa) */}
      <div className="print:hidden">
        <Alert variant="info">
          Utilize o botão de cópia rápida para preencher o campo &quot;Discriminação&quot; diretamente no programa da Receita Federal. Valores calculados pelo Preço Médio Ponderado.
        </Alert>
      </div>

      {/* 3. Seção: Ficha de Bens e Direitos — VISÃO INTERATIVA EM TELA */}
      <section aria-label="Bens e Direitos Tela" className="flex flex-col gap-3 print:hidden print:pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary-strong" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
              Ficha: Bens e Direitos ({nonCashAssets.length} ativos em custódia)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono num">
            Total em 31/12: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {nonCashAssets.map((asset) => {
            const safeTicker = sanitizeReportText(asset.ticker);
            const totalCostBRL = asset.quantity * asset.average_price;
            const taxInfo = getTaxGroupCode(asset.asset_class);
            const qtyStr = asset.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
            const cotaWord = asset.quantity === 1 ? "cota" : "cotas";
            const textToCopy = `${qtyStr} ${cotaWord} de ${safeTicker}, custo médio unitário de R$ ${formatMoneyBR(numberToCents(asset.average_price))}, totalizando R$ ${formatMoneyBR(numberToCents(totalCostBRL))}.`;

            return (
              <div
                key={asset.id}
                className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{safeTicker}</span>
                    <span className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/40">
                      {taxInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Situação em 31/12/{calendarYear}:</span>
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
                    className="gap-1.5 shrink-0 text-xs"
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

      {/* 3.1. Seção: Ficha de Bens e Direitos — TABELA FISCAL OFICIAL NO PDF / IMPRESSÃO */}
      <section aria-label="Bens e Direitos Impressão" className="hidden print:flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
              Ficha: Bens e Direitos — Posição em 31/12/{calendarYear} ({nonCashAssets.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] font-mono num text-slate-600">
            Custo Total: <MoneyText cents={numberToCents(totalCostAllAssetsBRL)} className="font-bold text-slate-900 inline" />
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-visible">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold text-[9px] uppercase tracking-wider">
                <th className="py-1.5 px-2 w-[14%]">Código / Grupo</th>
                <th className="py-1.5 px-1.5 w-[12%]">Ticker</th>
                <th className="py-1.5 px-2 w-[58%]">Discriminação para o Programa IRPF</th>
                <th className="py-1.5 px-2 text-right w-[16%]">Situação em 31/12</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nonCashAssets.map((asset) => {
                const safeTicker = sanitizeReportText(asset.ticker);
                const totalCostBRL = asset.quantity * asset.average_price;
                const taxInfo = getTaxGroupCode(asset.asset_class);
                const qtyStr = asset.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
                const cotaWord = asset.quantity === 1 ? "cota" : "cotas";
                const textToCopy = `${qtyStr} ${cotaWord} de ${safeTicker}, custo unitário de R$ ${formatMoneyBR(numberToCents(asset.average_price))}, totalizando R$ ${formatMoneyBR(numberToCents(totalCostBRL))}.`;

                return (
                  <tr key={`print-tax-${asset.id}`} className="break-inside-avoid even:bg-slate-50/50 print:even:bg-slate-50/50">
                    <td className="py-1 px-2 text-[9px] font-mono text-slate-600 truncate">
                      {taxInfo.label}
                    </td>
                    <td className="py-1 px-1.5 font-bold text-slate-900 text-[11px] truncate">
                      {safeTicker}
                    </td>
                    <td className="py-1 px-2 text-[9px] text-slate-600 leading-tight">
                      {textToCopy}
                    </td>
                    <td className="py-1 px-2 text-right num font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">
                      <MoneyText cents={numberToCents(totalCostBRL)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


      {/* 4. Seção: Ficha de Rendimentos Recebidos */}
      <section aria-label="Rendimentos Recebidos" className="flex flex-col gap-2.5 pt-1 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-3.5 text-positive-strong" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ficha: Rendimentos Isentos &amp; Exclusivos ({calendarYear})
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono num">
            Total Recebido: <MoneyText cents={numberToCents(totalRendimentosBRL)} className="font-bold text-positive-strong inline" />
          </span>
        </div>

        {rendimentosPorAtivo.length === 0 ? (
          <div className="rounded-xl border border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground italic print:bg-white print:border-border">
            Nenhum rendimento isento ou tributado exclusivamente na fonte apurado no ano-base {calendarYear}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse print:table-fixed">
              <thead>
                <tr className="border-b border-border/80 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3 print:w-[20%]">Ticker</th>
                  <th className="py-2 px-3 print:w-[50%]">Tipo / Ficha da Declaração</th>
                  <th className="py-2 px-3 text-right print:w-[30%]">Total Recebido (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rendimentosPorAtivo.map(({ asset, tipoRendimento, amountBRL }) => (
                  <tr key={`div-${asset.id}`} className="hover:bg-muted/20 break-inside-avoid even:bg-slate-50/50 print:even:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-semibold text-foreground truncate">{sanitizeReportText(asset.ticker)}</td>
                    <td className="py-1.5 px-3 text-muted-foreground truncate">{tipoRendimento}</td>
                    <td className="py-1.5 px-3 text-right num font-mono font-bold text-positive-strong whitespace-nowrap">
                      <MoneyText cents={numberToCents(amountBRL)} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100/80 border-t border-border/80 font-bold print:bg-slate-100 break-inside-avoid">
                  <td colSpan={2} className="py-2 px-3 text-foreground uppercase text-[10px] tracking-wider">
                    Total de Rendimentos no Exercício
                  </td>
                  <td className="py-2 px-3 text-right num font-mono text-positive-strong whitespace-nowrap">
                    <MoneyText cents={numberToCents(totalRendimentosBRL)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento auxiliar e orientativo gerado pelo Guia Financeiro. A verificação final e a entrega da Declaração de Ajuste Anual cabem exclusivamente ao contribuinte."
      />
    </ReportDocumentLayout>
  );
}

