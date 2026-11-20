import { useState } from "react";
import { History, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { currentMonth } from "@/lib/date";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { useAllPortfolioTransactions, usePortfolioAssets, usePortfolioPosition } from "@/state";
import {
  InitialPocketCostDialog,
  PortfolioActivityPanel,
  PortfolioDarfMonitor,
  PortfolioImportDialog,
  PortfolioSnapshotsDialog,
} from "../components";

/**
 * Extrato da Carteira: histórico completo de lançamentos, proventos, aportes,
 * marcos históricos mensais, importação de planilha em lote e apuração fiscal DARF 6015.
 */
export function MovimentacoesTab() {
  const [pocketCostOpen, setPocketCostOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [darfOpen, setDarfOpen] = useState(false);
  const assetsQuery = usePortfolioAssets();
  const txsQuery = useAllPortfolioTransactions();
  const position = usePortfolioPosition();
  const allSeries = position.allMonthlySeries ?? position.monthlySeries ?? [];

  const { guardAction, upgradeModal } = useMutationGuard({
    moduleKey: "investments",
    defaultContext: "Importar Carteira / Movimentações",
  });

  return (
    <div className="flex flex-col gap-5">
      <PortfolioActivityPanel />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <section
          aria-label="Marcos históricos da carteira"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs transition-all hover:border-border"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">Marcos Históricos & TWR</span>
            <span className="text-xs text-muted-foreground">
              Cadastre aportes do bolso anteriores ao app e audite fechamentos mensais e evolução de cotas.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setPocketCostOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <History className="size-3.5" aria-hidden="true" />
              <span>Marcos do Bolso</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSnapshotsOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <span>Auditar Fechamentos</span>
            </Button>
          </div>
        </section>

        <section
          aria-label="Importar posição via planilha"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs transition-all hover:border-border"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">Posição ou histórico desatualizado?</span>
            <span className="text-xs text-muted-foreground">
              Importe um arquivo .xlsx ou .csv para atualizar posições e registrar operações em lote.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => guardAction(() => setImportOpen(true))}
            className="h-8 text-xs gap-1.5 self-start"
          >
            <Upload className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Importar Planilha</span>
          </Button>
        </section>

        <section
          aria-label="Apuração fiscal e DARF"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs transition-all hover:border-border"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">Apuração Fiscal & DARF 6015</span>
            <span className="text-xs text-muted-foreground">
              Monitore a isenção de R$ 20k em ações e apure o imposto devido sobre vendas no mês.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDarfOpen(true)}
            className="h-8 text-xs gap-1.5 self-start"
          >
            <ShieldCheck className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Consultar DARF Mensal</span>
          </Button>
        </section>
      </div>

      <InitialPocketCostDialog
        open={pocketCostOpen}
        onOpenChange={setPocketCostOpen}
        defaultCostBRL={position.totalCostBRL}
        onOpenSnapshotsDialog={() => setSnapshotsOpen(true)}
      />
      <PortfolioSnapshotsDialog
        open={snapshotsOpen}
        onOpenChange={setSnapshotsOpen}
        series={allSeries}
        currentMonthStr={currentMonth()}
        onOpenPocketCostDialog={() => setPocketCostOpen(true)}
      />
      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <PortfolioDarfMonitor
        open={darfOpen}
        onOpenChange={setDarfOpen}
        assets={assetsQuery.data ?? []}
        transactions={txsQuery.data ?? []}
      />
      {upgradeModal}
    </div>
  );
}
