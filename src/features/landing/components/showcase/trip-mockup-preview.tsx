import { useState } from "react";
import { ArrowRightLeft, Check, CheckCircle2, Copy, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

interface TripDemoBalance {
  initials: string;
  name: string;
  balanceCents: number;
  avatarClass: string;
  directionLabel: string;
}

const TRIP_BALANCES: TripDemoBalance[] = [
  {
    initials: "VC",
    name: "Você (Anfitrião)",
    balanceCents: 237000,
    avatarClass: "bg-primary/20 text-primary-strong dark:text-primary",
    directionLabel: "a receber",
  },
  {
    initials: "LS",
    name: "Lucas Silva",
    balanceCents: -35000,
    avatarClass: "bg-negative/20 text-negative-strong",
    directionLabel: "a pagar",
  },
  {
    initials: "MC",
    name: "Mariana Costa",
    balanceCents: -71000,
    avatarClass: "bg-negative/20 text-negative-strong",
    directionLabel: "a pagar",
  },
  {
    initials: "PA",
    name: "Pedro Alves",
    balanceCents: -131000,
    avatarClass: "bg-negative/20 text-negative-strong",
    directionLabel: "a pagar",
  },
];

export interface TripMockupPreviewProps {
  active: boolean;
}

export function TripMockupPreview({ active }: TripMockupPreviewProps) {
  const [copiedTripPix, setCopiedTripPix] = useState(false);
  const [settledTrip, setSettledTrip] = useState(false);

  const handleCopyTripPix = async () => {
    try {
      await navigator.clipboard?.writeText?.("voce@email.com");
    } catch {
      // Fallback
    }
    setCopiedTripPix(true);
    setTimeout(() => setCopiedTripPix(false), 2500);
  };

  return (
    <div
      id="panel-trip"
      role="region"
      aria-label="Modo Viagem"
      data-testid="card-viagem"
      className={cn("space-y-3 sm:space-y-3.5", active ? "block" : "hidden")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-foreground">
            Viagem Florianópolis / Réveillon
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            4 amigos · Livro-razão compartilhado · Link público com senha
          </div>
        </div>
        <Badge variant="warning" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
          4 despesas · 2 acertos
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs font-mono">
        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-raised/50 border border-border/80 min-w-0">
          <span className="text-muted-foreground block text-[11px] font-sans">
            Total da Viagem:
          </span>
          <MoneyText cents={524000} tone="default" className="font-bold text-sm sm:text-base" />
        </div>
        <div className="p-2.5 sm:p-3 rounded-xl bg-positive/10 border border-positive/30 min-w-0">
          <span className="text-positive-strong block text-[11px] font-sans font-semibold">
            Você Pagou:
          </span>
          <MoneyText cents={368000} tone="positive" className="font-bold text-sm sm:text-base" />
        </div>
        <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30 min-w-0">
          <span className="text-primary-strong block text-[11px] font-sans font-semibold">
            Seu Saldo Líquido:
          </span>
          <MoneyText
            cents={237000}
            sign="explicit"
            tone="default"
            className="font-bold text-primary-strong text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/40 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
          Balanço Individual em Tempo Real
        </div>

        <div className="space-y-1 text-xs divide-y divide-border/50">
          {TRIP_BALANCES.map((member) => (
            <div key={member.initials} className="flex justify-between items-center py-1.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold font-mono",
                    member.avatarClass,
                  )}
                >
                  {member.initials}
                </div>
                <span className="font-medium text-foreground truncate">{member.name}</span>
              </div>
              <div className="text-right shrink-0">
                <MoneyText
                  cents={member.balanceCents}
                  sign="explicit"
                  className="font-bold text-xs block"
                />
                <span className="text-[11px] text-muted-foreground block">
                  {member.directionLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-warning/30 bg-warning/10 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <ArrowRightLeft
            className="size-4 text-warning-strong shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-xs leading-relaxed">
            <div className="font-semibold text-foreground">
              Liquidação Otimizada (2 transferências em vez de 6):
            </div>
            <div className="text-muted-foreground mt-0.5">
              Pedro transfere <MoneyText cents={131000} tone="default" className="font-bold text-foreground" /> e
              Mariana transfere <MoneyText cents={71000} tone="default" className="font-bold text-foreground" />{" "}
              direto via Pix.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyTripPix}
            className="w-full justify-center gap-1.5 text-xs font-semibold rounded-lg"
          >
            {copiedTripPix ? (
              <>
                <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Pix Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copiar Chave Pix</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              setSettledTrip(true);
              setTimeout(() => setSettledTrip(false), 3000);
            }}
            className="w-full justify-center gap-1.5 text-xs font-semibold rounded-lg shadow-xs"
          >
            {settledTrip ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                <span>Confirmado</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>Confirmar Recebimento</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-raised/40 text-[11px] sm:text-xs text-muted-foreground">
        <Share2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">
          Zero atrito: compartilhe o link seguro da viagem. Seus amigos lançam gastos e conferem o
          acerto pelo navegador, sem necessidade de baixar o app ou criar conta.
        </span>
      </div>
    </div>
  );
}
