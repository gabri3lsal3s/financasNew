import { useState } from "react";
import { ArrowRightLeft, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface FamilyMockupPreviewProps {
  active: boolean;
}

export function FamilyMockupPreview({ active }: FamilyMockupPreviewProps) {
  const [settledFamily, setSettledFamily] = useState(false);

  const handleSettleFamily = () => {
    setSettledFamily(true);
    setTimeout(() => setSettledFamily(false), 3000);
  };

  return (
    <div
      id="panel-family"
      role="region"
      aria-label="Modo Família"
      data-testid="card-familia"
      className={cn("space-y-3 sm:space-y-3.5", active ? "block" : "hidden")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-foreground">
            Gestão do Lar · Família Silva
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Teto Compartilhado:{" "}
            <MoneyText cents={600000} tone="default" className="font-semibold text-foreground" /> / mês
          </div>
        </div>
        <Badge variant="default" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
          Divisão 50% / 50%
        </Badge>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/50 space-y-2.5">
        <div className="flex justify-between items-center text-xs gap-2">
          <span className="font-semibold text-foreground">Despesas Comuns do Mês:</span>
          <MoneyText cents={600000} tone="default" className="font-bold" />
        </div>

        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-muted">
          <div className="h-full bg-primary" style={{ width: "53.3%" }} />
          <div className="h-full bg-portfolio" style={{ width: "46.7%" }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono pt-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-strong dark:text-primary text-[11px] font-bold">
              VC
            </div>
            <div className="min-w-0">
              <span className="font-sans text-muted-foreground block text-[11px] truncate">
                Você pagou:
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <MoneyText cents={320000} tone="default" className="font-bold text-xs" />
                <span className="text-[11px] text-muted-foreground">(53%)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-portfolio/20 text-portfolio text-[11px] font-bold">
              CS
            </div>
            <div className="min-w-0">
              <span className="font-sans text-muted-foreground block text-[11px] truncate">
                Camila pagou:
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <MoneyText cents={280000} tone="default" className="font-bold text-xs" />
                <span className="text-[11px] text-muted-foreground">(47%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-primary/30 bg-primary/10 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <ArrowRightLeft className="size-4 text-primary-strong dark:text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <div className="font-semibold text-foreground">Compensação Automática Calculada:</div>
            <div className="text-muted-foreground mt-0.5">
              Camila deve transferir{" "}
              <MoneyText cents={20000} tone="default" className="font-bold text-foreground" /> para Você via Pix
              para equilibrar em 50/50.
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-0.5">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSettleFamily}
            className="w-full sm:w-auto justify-center gap-1.5 text-xs font-semibold rounded-lg shadow-xs"
          >
            {settledFamily ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                <span>Acerto Quitado</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>Liquidar Acerto Pix</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-raised/40 text-[11px] sm:text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">
          Privacidade absoluta: compras individuais, presentes e faturas pessoais permanecem 100%
          invisíveis para os outros membros da família.
        </span>
      </div>
    </div>
  );
}
