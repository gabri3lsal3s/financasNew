import { useState } from "react";
import { ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { useAllPortfolioTransactions, usePortfolioAssets } from "@/state";
import { PortfolioActivityPanel, PortfolioDarfMonitor, PortfolioImportDialog } from "../components";

/**
 * Aba dedicada ao histórico de movimentações da carteira (ledger):
 * compras, vendas, proventos, desdobramentos, apuração fiscal e importação de planilha em lote.
 */
export function MovimentacoesTab() {
  const [importOpen, setImportOpen] = useState(false);
  const [darfOpen, setDarfOpen] = useState(false);
  const assetsQuery = usePortfolioAssets();
  const txsQuery = useAllPortfolioTransactions();

  const { guardAction, upgradeModal } = useMutationGuard({
    moduleKey: "investments",
    defaultContext: "Importar Carteira / Movimentações",
  });

  return (
    <div className="flex flex-col gap-5">
      <PortfolioActivityPanel />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <section
          aria-label="Importar posição via planilha"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 shadow-xs transition-all hover:border-border"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">Posição ou histórico desatualizado?</span>
            <span className="text-xs text-muted-foreground">
              Importe um arquivo .xlsx ou .csv para atualizar suas posições e registrar operações em lote.
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
          className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 shadow-xs transition-all hover:border-border"
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
