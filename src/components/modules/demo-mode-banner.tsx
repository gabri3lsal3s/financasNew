import { useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmDialog } from "@/components/ui";
import { useClearDemoData } from "@/state";

export interface DemoModeBannerProps {
  className?: string;
}

/**
 * Barra informativa exibida quando a conta contém dados de demonstração ([Exemplo]).
 * Permite ao usuário remover os dados de teste com 1 clique através de diálogo seguro.
 */
export function DemoModeBanner({ className }: DemoModeBannerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const clearMutation = useClearDemoData();

  const handleConfirmClear = async () => {
    await clearMutation.mutateAsync();
    setConfirmOpen(false);
  };

  return (
    <>
      <aside
        aria-label="Aviso de Modo Demonstração"
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 p-3.5 sm:p-4 text-xs text-foreground shadow-xs transition-all ${className ?? ""}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-strong mt-0.5 sm:mt-0" aria-hidden="true">
            <Sparkles className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="warning" size="xs">
                Modo Demonstração
              </Badge>
              <span className="font-semibold text-foreground">
                Dados de exemplo ativos
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Você está explorando a plataforma com dados de teste realistas. Remova-os a qualquer momento para começar sua gestão real.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={clearMutation.isPending}
          className="shrink-0 self-end sm:self-auto gap-1.5 border-warning/40 hover:bg-warning/10 text-xs font-medium cursor-pointer"
        >
          <Trash2 className="size-3.5 text-warning-strong" aria-hidden="true" />
          <span>{clearMutation.isPending ? "Limpando…" : "Limpar dados de exemplo"}</span>
        </Button>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Limpar dados de exemplo?"
        description="Esta ação removerá cirurgicamente apenas os lançamentos, cartões e ativos de demonstração com a marca [Exemplo]. Qualquer dado real cadastrado por você permanecerá intacto."
        confirmLabel="Limpar dados"
        variant="destructive"
        onConfirm={handleConfirmClear}
      />
    </>
  );
}
