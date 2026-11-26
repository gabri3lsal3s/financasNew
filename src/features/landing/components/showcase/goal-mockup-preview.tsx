import { useState } from "react";
import { Calendar, Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

interface GoalContributor {
  initials: string;
  name: string;
  amountCents: number;
  avatarClass: string;
}

const GOAL_CONTRIBUTORS: GoalContributor[] = [
  {
    initials: "VC",
    name: "Você",
    amountCents: 300000,
    avatarClass: "bg-primary/15 text-primary-strong dark:text-primary",
  },
  {
    initials: "MC",
    name: "Mariana C.",
    amountCents: 150000,
    avatarClass: "bg-positive/15 text-positive-strong",
  },
  {
    initials: "LO",
    name: "Lucas O.",
    amountCents: 150000,
    avatarClass: "bg-positive/15 text-positive-strong",
  },
];

export interface GoalMockupPreviewProps {
  active: boolean;
}

export function GoalMockupPreview({ active }: GoalMockupPreviewProps) {
  const [copiedGoalPix, setCopiedGoalPix] = useState(false);

  const handleCopyGoalPix = async () => {
    try {
      await navigator.clipboard?.writeText?.("viagem.familia@exemplo.com");
    } catch {
      // Ignora falhas de clipboard
    }
    setCopiedGoalPix(true);
    setTimeout(() => setCopiedGoalPix(false), 2500);
  };

  return (
    <div
      id="panel-goal"
      role="region"
      aria-label="Vaquinha Coletiva (Metas)"
      data-testid="card-vaquinha"
      className={cn("space-y-3 sm:space-y-3.5", active ? "block" : "hidden")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-foreground">
            Viagem de Fim de Ano em Família
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Vaquinha Coletiva com Chave Pix Oficial
          </div>
        </div>
        <Badge variant="positive" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
          75% Concluído
        </Badge>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/50 space-y-2.5">
        <div className="flex flex-wrap justify-between items-baseline gap-2 font-mono">
          <div>
            <span className="text-[11px] font-sans text-muted-foreground block">
              Total Arrecadado:
            </span>
            <MoneyText cents={600000} tone="default" className="text-xl sm:text-2xl font-bold" />
          </div>
          <div className="sm:text-right">
            <span className="text-[11px] font-sans text-muted-foreground block">Meta Final:</span>
            <MoneyText
              cents={800000}
              tone="default"
              className="text-sm sm:text-base font-semibold text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-700"
              style={{ width: "75%" }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span className="font-bold text-positive-strong">75% Atual</span>
            <span>100% Meta</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>
            Restam 14 dias para encerrar · Faltam{" "}
            <MoneyText cents={200000} tone="default" className="font-semibold text-foreground" /> para a meta
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
          Últimas Contribuições via Pix
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {GOAL_CONTRIBUTORS.map((c) => (
            <div
              key={c.initials}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised/40 border border-border/80 min-w-0"
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold font-mono",
                  c.avatarClass,
                )}
              >
                {c.initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-muted-foreground block truncate">{c.name}</span>
                <MoneyText cents={c.amountCents} tone="default" className="font-bold text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyGoalPix}
          className="w-full justify-center gap-1.5 text-xs font-semibold rounded-lg"
        >
          {copiedGoalPix ? (
            <>
              <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
              <span>Chave Pix Copiada</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden="true" />
              <span>Copiar Chave Pix</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
