import { useState } from "react";
import { FileSpreadsheet, FileText, Landmark, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import {
  PortfolioDarfMonitor,
  PortfolioExecutiveReport,
  PortfolioTaxReport,
} from "../components";

/**
 * Aba de Relatórios Executivos e Inteligência Fiscal / IRPF (§F40).
 */
export function RelatoriosTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const transactionsQuery = useAllPortfolioTransactions();

  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);
  const [taxReportOpen, setTaxReportOpen] = useState(false);
  const [darfMonitorOpen, setDarfMonitorOpen] = useState(false);

  const assets = assetsQuery.data ?? [];
  const dividends = dividendsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  const currentYear = new Date().getFullYear();
  const yearDividends = dividends
    .filter((d) => d.date.startsWith(String(currentYear)))
    .reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Relatórios & Inteligência Fiscal</h2>
        <p className="text-xs text-muted-foreground">
          Documentos executivos em A4/PDF, facilitador para o IRPF da Receita Federal e apuração de DARF.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Relatório Executivo A4/PDF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio">
              <Printer className="size-4.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Relatório Executivo (A4/PDF)</h3>
              <p className="text-xs text-muted-foreground">
                Documento de acompanhamento da carteira consolidada em padrão imprimível com gráficos, KPIs e detalhamento de custódia.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExecutiveReportOpen(true)}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Visualizar Relatório A4
          </Button>
        </div>

        {/* Card 2: Facilitador de IRPF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-positive/10 border border-positive/20 text-positive-strong">
              <Landmark className="size-4.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Facilitador de IRPF Anual</h3>
              <p className="text-xs text-muted-foreground">
                Fichas de Bens e Direitos (em 31/12) e Rendimentos Isentos/Exclusivos com botão de 1-clique para copiar a discriminação.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTaxReportOpen(true)}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
            Abrir Fichas do IRPF
          </Button>
        </div>

        {/* Card 3: Monitor de DARF & Isenção de 20k */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
              <FileSpreadsheet className="size-4.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Monitor Mensal de DARF</h3>
              <p className="text-xs text-muted-foreground">
                Controle do limite de isenção de R$ 20.000 em ações, alíquota de 20% em FIIs e apuração de DARF a recolher.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDarfMonitorOpen(true)}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
            Consultar Apuração Mensal
          </Button>
        </div>
      </div>

      {/* Diálogos Modais e Folhas de Impressão */}
      <PortfolioExecutiveReport
        open={executiveReportOpen}
        onOpenChange={setExecutiveReportOpen}
        rows={position.rows}
        totalBRL={position.totalBRL}
        cashBRL={position.cashBRL}
        yearDividendsBRL={yearDividends}
      />

      <PortfolioTaxReport
        open={taxReportOpen}
        onOpenChange={setTaxReportOpen}
        assets={assets}
        dividends={dividends}
      />

      <PortfolioDarfMonitor
        open={darfMonitorOpen}
        onOpenChange={setDarfMonitorOpen}
        assets={assets}
        transactions={transactions}
      />
    </div>
  );
}
