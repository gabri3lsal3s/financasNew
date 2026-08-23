import { useState } from "react";
import { FileSpreadsheet, FileText, Landmark, Printer, ShieldCheck, Sparkles, Upload } from "lucide-react";
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
  PortfolioImportDialog,
  PortfolioTaxReport,
} from "../components";

/**
 * Aba de Ferramentas: Importação de Carteira + Relatórios Executivos e Inteligência Fiscal (§F40).
 * Grade balanceada e direta sem cabeçalhos redundantes.
 */
export function FerramentasTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const transactionsQuery = useAllPortfolioTransactions();

  const [importOpen, setImportOpen] = useState(false);
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
      {/* Grade de Ferramentas & Relatórios */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Importação de Planilha */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <Upload className="size-5 text-portfolio" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Importar via Planilha</h3>
              <p className="text-xs text-muted-foreground">
                Carregue arquivos .xlsx ou .csv com posições e histórico de operações para popular a carteira em lote.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Importar Carteira
          </Button>
        </div>

        {/* Card 2: Relatório Executivo A4/PDF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <Printer className="size-5 text-portfolio" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Relatório Executivo (A4/PDF)</h3>
              <p className="text-xs text-muted-foreground">
                Documento de acompanhamento da carteira consolidada em padrão imprimível com gráficos, KPIs e custódia.
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

        {/* Card 3: Facilitador de IRPF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <Landmark className="size-5 text-positive-strong" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Facilitador de IRPF Anual</h3>
              <p className="text-xs text-muted-foreground">
                Fichas de Bens e Direitos e Rendimentos com botão de 1-clique para copiar a discriminação para a Receita.
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

        {/* Card 4: Monitor de DARF & Isenção de 20k */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <FileSpreadsheet className="size-5 text-primary-strong" aria-hidden="true" />
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
      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} />

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

/** Alias para manter compatibilidade com testes e referências legadas */
export const FerrantasTab = FerramentasTab;

