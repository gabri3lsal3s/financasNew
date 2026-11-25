import { useState } from "react";
import { ArrowLeftRight, Briefcase, CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { formatPercent } from "@/services/masks";
import { pushToast } from "@/services/toast";

export function PainBusinessPreview() {
  const [proLaboreTransferred, setProLaboreTransferred] = useState(false);

  const faturamentoMesCents = 845000;
  const custosOperacionaisCents = 215000;
  const reservaDasCents = 7600;
  const lucroLiquidoCents = faturamentoMesCents - custosOperacionaisCents - reservaDasCents;
  const meiAnualAtualCents = 5820000;
  const meiTetoCents = 8100000;
  const meiUsagePct = (meiAnualAtualCents / meiTetoCents) * 100;

  const handleProLabore = () => {
    setProLaboreTransferred(true);
    pushToast({
      title: "Pró-labore registrado",
      description: "Transferência PJ para Pessoal de R$ 3.500,00 contabilizada sem duplicar renda.",
      variant: "success",
      duration: 5000,
      action: { label: "Desfazer", onClick: () => setProLaboreTransferred(false) },
    });
  };

  return (
    <Card
      data-testid="pain-preview-business"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-5 rounded-2xl sm:rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-foreground block">
            Prévia do Modo Negócio (MEI &amp; PJ)
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Esfera empresarial isolada do seu gasto pessoal no mesmo aplicativo
          </span>
        </div>
        <Badge variant="portfolio" size="xs">
          PF + PJ Separados
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Receita PJ (Mês)</span>
          <MoneyText cents={faturamentoMesCents} tone="positive" className="text-base font-bold" />
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">
            Custos + Reserva DAS
          </span>
          <MoneyText
            cents={-(custosOperacionaisCents + reservaDasCents)}
            tone="negative"
            className="text-base font-bold"
          />
        </div>
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-1">
          <span className="text-[11px] font-medium text-primary-strong block">
            Lucro Líquido (DRE)
          </span>
          <MoneyText cents={lucroLiquidoCents} tone="default" className="text-base font-bold" />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary-strong" aria-hidden="true" />
            Termômetro do Teto Anual MEI
          </span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatPercent(meiUsagePct)} utilizado
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${meiUsagePct}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            Acumulado:{" "}
            <MoneyText cents={meiAnualAtualCents} variant="caption" className="font-semibold" />
          </span>
          <span>
            Limite anual: <MoneyText cents={meiTetoCents} variant="caption" />
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <Briefcase className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Retirada de Pró-Labore para Conta Pessoal
            </p>
            <p className="text-[11px] text-muted-foreground">
              {proLaboreTransferred
                ? "R$ 3.500,00 transferidos: entra no seu Caixa Real sem inflar o faturamento."
                : "Transfira seu salário do negócio para o pessoal com blindagem contábil."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={proLaboreTransferred ? "outline" : "default"}
          onClick={proLaboreTransferred ? () => setProLaboreTransferred(false) : handleProLabore}
          className="shrink-0 gap-1.5 text-xs rounded-lg cursor-pointer"
        >
          {proLaboreTransferred ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              <span>Transferido (desfazer)</span>
            </>
          ) : (
            <>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              <span>Simular Pró-Labore</span>
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
        <span>
          Tax Shield automático reserva o imposto em cada entrada para você nunca ser pego de surpresa.
        </span>
      </div>
    </Card>
  );
}
