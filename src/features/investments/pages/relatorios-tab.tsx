import { useState } from "react";
import { useNavigate } from "react-router";
import { FileSpreadsheet, FileText, Landmark, Printer, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useAllPortfolioTransactions, usePortfolioAssets } from "@/state";
import { PortfolioDarfMonitor, PortfolioImportDialog } from "../components";

/**
 * Aba de Ferramentas da Carteira (§F40 & §F42).
 * Focada em Importação de Planilha e Atalhos para a Central Unificada de Relatórios.
 */
export function FerramentasTab() {
  const navigate = useNavigate();
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();

  const [importOpen, setImportOpen] = useState(false);
  const [darfMonitorOpen, setDarfMonitorOpen] = useState(false);

  const assets = assetsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

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

        {/* Card 2: Dossiê Executivo de Carteira */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <Printer className="size-5 text-portfolio" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Dossiê Executivo A4</h3>
              <p className="text-xs text-muted-foreground">
                Acompanhamento completo de alocação, metas (Target vs Actual) e risco de concentração.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/relatorios?aba=investimentos")}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Abrir na Central
          </Button>
        </div>

        {/* Card 3: Facilitador de IRPF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <Landmark className="size-5 text-positive-strong" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Facilitador de IRPF Anual</h3>
              <p className="text-xs text-muted-foreground">
                Fichas de Bens e Direitos e Rendimentos com botão de 1-clique para copiar a discriminação.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/relatorios?aba=fiscal")}
            className="mt-4 gap-1.5 w-full justify-center"
          >
            <Landmark className="size-3.5" aria-hidden="true" />
            Abrir Fichas IRPF
          </Button>
        </div>

        {/* Card 4: Monitor de DARF */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
          <div className="flex flex-col gap-3">
            <FileSpreadsheet className="size-5 text-primary-strong" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Monitor Mensal de DARF</h3>
              <p className="text-xs text-muted-foreground">
                Apuração de vendas em renda variável, isenção mensal de R$ 20k e controle de prejuízos a compensar.
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
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            Abrir Monitor DARF
          </Button>
        </div>
      </div>

      {/* Diálogos */}
      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <PortfolioDarfMonitor
        open={darfMonitorOpen}
        onOpenChange={setDarfMonitorOpen}
        assets={assets}
        transactions={transactions}
      />
    </div>
  );
}
