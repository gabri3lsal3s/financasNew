import { ArrowRight, CheckCircle2, PieChart, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";

export interface PainInvestPreviewProps {
  onExploreDeep?: () => void;
}

export function PainInvestPreview({ onExploreDeep }: PainInvestPreviewProps) {
  return (
    <Card
      data-testid="pain-preview-invest"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-5 rounded-2xl sm:rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-foreground block">
            Aporte Inteligente + Preço Teto em 1 Visão
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Saiba quanto comprar em cada ativo sem vender nada e sem pagar caro
          </span>
        </div>
        <Badge variant="portfolio" size="xs">
          Aporte: R$ 2.000,00
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Target className="size-3.5 text-portfolio" aria-hidden="true" />
              Renda Fixa IPCA+ (Atual 25% · Meta 35%)
            </span>
            <span className="font-mono font-bold text-portfolio whitespace-nowrap">
              Aportar <MoneyText cents={140000} hideCents tone="portfolio" /> (70%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-positive" style={{ width: "70%" }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Motivo: classe mais distante da sua meta percentual no momento.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong" aria-hidden="true" />
              FIIs / Ações com Preço Teto favorável
            </span>
            <span className="font-mono font-bold text-foreground whitespace-nowrap">
              Aportar <MoneyText cents={60000} hideCents tone="default" /> (30%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-cat-5" style={{ width: "30%" }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
            <span>Exemplo: BBAS3 · Consenso Preço Teto R$ 31,40 (Margem +16%)</span>
            <Badge variant="positive" size="xs">
              Dentro do teto
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span>Inclui Governança de Teses, TWR/TIR e Relatórios Executivos</span>
        </div>

        {onExploreDeep ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExploreDeep}
            className="gap-1.5 text-xs font-medium shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>Explorar ferramentas completas</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
