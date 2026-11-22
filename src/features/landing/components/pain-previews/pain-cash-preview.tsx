import { useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Badge, Card, Checkbox, MoneyText } from "@/components/ui";
import { useAnimatedNumber } from "@/features/landing/hooks";
import { cn } from "@/lib/utils";

interface CommitmentItem {
  id: string;
  label: string;
  hint: string;
  cents: number;
  isReajustada?: boolean;
}

const BANK_BALANCE_CENTS = 890000;
const DAYS_IN_CYCLE = 15;

const COMMITMENTS: readonly CommitmentItem[] = [
  {
    id: "card-bill",
    label: "Fatura aberta do cartão",
    hint: "Vence dia 10 · compras já feitas",
    cents: 248000,
  },
  {
    id: "rent",
    label: "Aluguel e contas a vencer",
    hint: "Contas a pagar previstas até o dia 30",
    cents: 385000,
  },
  {
    id: "sub-hike",
    label: "Assinatura com reajuste detectado",
    hint: "Subiu +14% frente aos últimos meses",
    cents: 8900,
    isReajustada: true,
  },
];

export function PainCashPreview() {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({
    "card-bill": true,
    rent: true,
    "sub-hike": true,
  });

  const toggleItem = (id: string, nextChecked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: nextChecked }));
  };

  const totalCommittedCents = COMMITMENTS.reduce(
    (sum, item) => (selectedIds[item.id] ? sum + item.cents : sum),
    0,
  );
  const safeCashCents = Math.max(0, BANK_BALANCE_CENTS - totalCommittedCents);
  const dailyPaceCents = Math.round(safeCashCents / DAYS_IN_CYCLE);

  const animatedSafe = useAnimatedNumber(safeCashCents / 100, { duration: 250 });
  const animatedDaily = useAnimatedNumber(dailyPaceCents / 100, { duration: 250 });
  const isTight = safeCashCents <= 260000;

  return (
    <Card
      data-testid="pain-preview-cash"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-5 rounded-2xl sm:rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-foreground block">
            Simulador de Caixa Real Seguro
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Marque ou desmarque compromissos para ver o que realmente sobra hoje
          </span>
        </div>
        <Badge variant={isTight ? "warning" : "positive"} size="xs">
          {isTight ? "Atenção ao ritmo" : "Folga confortável"}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-raised/60 border border-border/80 px-3.5 py-2.5 text-xs sm:text-sm">
        <span className="text-muted-foreground">Saldo que aparece no banco hoje:</span>
        <MoneyText cents={BANK_BALANCE_CENTS} tone="default" className="font-bold text-foreground" />
      </div>

      <div className="space-y-2.5">
        {COMMITMENTS.map((item) => {
          const checked = Boolean(selectedIds[item.id]);
          const inputId = `pain-cash-${item.id}`;
          return (
            <label
              key={item.id}
              htmlFor={inputId}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors cursor-pointer",
                checked
                  ? "border-primary/35 bg-primary/5"
                  : "border-border/80 bg-surface hover:bg-surface-hover/50",
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={(next) => toggleItem(item.id, next)}
                  aria-label={item.label}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.isReajustada ? (
                      <Badge variant="warning" size="xs">
                        Aumento +14%
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                </div>
              </div>
              <MoneyText
                cents={-item.cents}
                tone={checked ? "negative" : "default"}
                className={cn("text-xs sm:text-sm font-bold shrink-0", !checked && "opacity-45")}
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-strong block">
            Caixa Real Disponível
          </span>
          <MoneyText
            cents={Math.round(animatedSafe * 100)}
            tone="default"
            className="text-lg sm:text-2xl font-extrabold text-foreground"
          />
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            {isTight ? (
              <>
                <AlertTriangle className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
                <span>Radar evita furo antes do fechamento</span>
              </>
            ) : (
              <>
                <TrendingUp className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                <span>Livre para despesas e novo aporte</span>
              </>
            )}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3.5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Ritmo Seguro ({DAYS_IN_CYCLE} dias)
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <MoneyText
              cents={Math.round(animatedDaily * 100)}
              tone="default"
              className="text-lg sm:text-2xl font-extrabold text-primary-strong"
            />
            <span className="text-xs font-mono text-muted-foreground">/ dia</span>
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Teto diário recalculado a cada gasto
          </span>
        </div>
      </div>
    </Card>
  );
}
