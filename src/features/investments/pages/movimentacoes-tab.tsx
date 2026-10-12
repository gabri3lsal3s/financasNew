import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { PortfolioActivityPanel, PortfolioImportDialog } from "../components";

/**
 * Aba dedicada ao histórico de movimentações da carteira (ledger):
 * compras, vendas, proventos, desdobramentos e importação de planilha em lote.
 */
export function MovimentacoesTab() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <PortfolioActivityPanel />

      <section
        aria-label="Importar posição via planilha"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/80 bg-surface/70 px-4 py-3.5 shadow-xs transition-all hover:border-border"
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
          onClick={() => setImportOpen(true)}
          className="h-8 text-xs gap-1.5 shrink-0 sm:flex-initial"
        >
          <Upload className="size-3.5 text-portfolio" aria-hidden="true" />
          <span>Importar Planilha</span>
        </Button>
      </section>

      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
