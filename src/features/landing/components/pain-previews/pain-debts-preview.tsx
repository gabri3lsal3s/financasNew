import { useState } from "react";
import { Calendar, Coins, CreditCard, HandCoins, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

const INSTALLMENTS = [
  { label: "Fatura atual", totalCents: 248000, widthPct: "85%" },
  { label: "Mês +1", totalCents: 164000, widthPct: "56%" },
  { label: "Mês +2", totalCents: 98000, widthPct: "34%" },
  { label: "Mês +3", totalCents: 42000, widthPct: "15%" },
];

export function PainDebtsPreview() {
  const [mode, setMode] = useState<"cards_receivables" | "contracts">("cards_receivables");

  return (
    <Card
      data-testid="pain-preview-debts"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-5 rounded-2xl sm:rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-foreground block">
            Parcelas Futuras, A Receber &amp; Contratos
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Enxergue os próximos meses e simule como quitar dívidas mais rápido
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "cards_receivables" ? "default" : "outline"}
            aria-pressed={mode === "cards_receivables"}
            onClick={() => {
              triggerSensory("selection");
              setMode("cards_receivables");
            }}
            className="h-7 px-2.5 text-xs cursor-pointer"
          >
            Parcelas &amp; Receber
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "contracts" ? "default" : "outline"}
            aria-pressed={mode === "contracts"}
            onClick={() => {
              triggerSensory("selection");
              setMode("contracts");
            }}
            className="h-7 px-2.5 text-xs cursor-pointer"
          >
            Price / SAC
          </Button>
        </div>
      </div>

      {mode === "cards_receivables" ? (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Horizonte de parcelas no cartão (até 60x)
              </span>
              <span className="text-muted-foreground">Melhor dia de compra: 12</span>
            </div>

            <div className="space-y-2">
              {INSTALLMENTS.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <MoneyText cents={row.totalCents} tone="default" className="font-semibold" />
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: row.widthPct }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="rounded-xl border border-negative/25 bg-negative/5 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-negative-strong" aria-hidden="true" />
                  A Pagar no mês
                </span>
                <Badge variant="warning" size="xs">
                  2 vencimentos
                </Badge>
              </div>
              <MoneyText cents={-124000} tone="negative" className="text-base font-bold" />
              <p className="text-[11px] text-muted-foreground">
                Inclui faturas, boletos e parcelas fixas
              </p>
            </div>

            <div className="rounded-xl border border-positive/25 bg-positive/5 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <HandCoins className="size-3.5 text-positive-strong" aria-hidden="true" />
                  A Receber (racha e empréstimos)
                </span>
                <Badge variant="positive" size="xs">
                  Cobrança Pix
                </Badge>
              </div>
              <MoneyText cents={48000} tone="positive" className="text-base font-bold" />
              <p className="text-[11px] text-muted-foreground">
                Cada parcela recebida abate seu saldo real
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Coins className="size-4 text-warning-strong" aria-hidden="true" />
                Financiamento · Tabela SAC (36 meses restantes)
              </span>
              <Badge variant="default" size="xs">
                Amortização simulada
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao simular um aporte extra de <strong className="text-foreground">R$ 2.500,00</strong>{" "}
              para abater o saldo devedor no prazo:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-border/80 bg-surface p-3 space-y-0.5">
                <span className="text-[11px] text-muted-foreground block">Economia em juros</span>
                <MoneyText cents={142000} tone="positive" className="text-base font-extrabold" />
              </div>
              <div className="rounded-lg border border-border/80 bg-surface p-3 space-y-0.5">
                <span className="text-[11px] text-muted-foreground block">Meses eliminados</span>
                <span className="font-mono tabular-nums text-base font-extrabold text-primary-strong">
                  5 meses a menos
                </span>
              </div>
            </div>
          </div>

          <div className={cn("rounded-xl border border-border/80 bg-surface p-3.5 flex items-start gap-2.5 text-xs")}>
            <TrendingDown className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-muted-foreground leading-relaxed">
              Compare ainda suas dívidas pelos métodos <strong className="text-foreground">Avalanche</strong>{" "}
              (menor juro total) e <strong className="text-foreground">Bola de Neve</strong> (quitar as
              menores primeiro) antes de decidir onde colocar cada real extra.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
