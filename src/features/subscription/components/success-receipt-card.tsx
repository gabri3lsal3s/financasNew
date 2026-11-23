import {
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Layers,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge, Card, CardContent, MoneyText } from "@/components/ui";

const PRO_BENEFITS = [
  {
    title: "Caixa Real, Cartões até 60x & Captura OCR/Pix",
    description:
      "Saldo livre para gastar hoje, faturas futuras, contas a pagar/receber e leitura de comprovantes sem digitação.",
    icon: Layers,
  },
  {
    title: "Modo Família, Viagens & Racha Pix",
    description:
      "Teto familiar proporcional, grupos de viagem, vaquinhas e divisão de parcelas com link público sem exigir cadastro.",
    icon: Users,
  },
  {
    title: "Carteira Multi-Ativos, Preço Teto & Aportes",
    description:
      "Ações, FIIs, Renda Fixa e Exterior com Valuation (Bazin, Graham, Gordon, P/VP) e rebalanceamento sem vendas.",
    icon: TrendingUp,
  },
  {
    title: "7 Relatórios Executivos A4/PDF & Excel (.xlsx)",
    description:
      "DRE Pessoal, Balanço 360°, Dossiê da Carteira e planilha auditável de 5 abas com memória de cálculo aberta.",
    icon: FileSpreadsheet,
  },
] as const;

export interface SuccessReceiptCardProps {
  planTitle: string;
  priceCents: number;
  isAnnual: boolean;
  isPix: boolean;
  isTrialScheduled: boolean;
  todayFormatted: string;
  renewalFormatted: string;
}

export function SuccessReceiptCard({
  planTitle,
  priceCents,
  isAnnual,
  isPix,
  isTrialScheduled,
  todayFormatted,
  renewalFormatted,
}: SuccessReceiptCardProps) {
  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardContent className="p-5 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-border/80">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Plano Ativado
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-lg sm:text-xl font-bold text-foreground">
                {planTitle}
              </span>
              <Badge variant="positive" size="xs">
                {isAnnual ? "Economia de 40%" : "Mensal"}
              </Badge>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-muted-foreground block">Valor do Plano</span>
            <span className="inline-flex items-baseline gap-0.5 font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              <MoneyText cents={priceCents} variant="value" tone="default" deemphasizeCents={false} />
              <span className="text-xs font-semibold text-muted-foreground">
                /{isAnnual ? "ano" : "mês"}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="size-3.5" aria-hidden="true" />
              <span>{isTrialScheduled ? "Cadastro do Cartão" : "Data de Ativação"}</span>
            </div>
            <span className="font-semibold text-foreground">{todayFormatted}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {isPix ? (
                <QrCode className="size-3.5" aria-hidden="true" />
              ) : (
                <CreditCard className="size-3.5" aria-hidden="true" />
              )}
              <span>Método</span>
            </div>
            <span className="font-semibold text-foreground">
              {isPix ? "PIX Instantâneo" : "Cartão de Crédito"}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
              <span>{isTrialScheduled ? "Primeira Cobrança" : "Próxima Renovação"}</span>
            </div>
            <span className="font-semibold text-foreground">{renewalFormatted}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border/80 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Recursos Exclusivos Disponíveis
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRO_BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface-raised/60 p-3"
              >
                <b.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground block">{b.title}</span>
                  <span className="text-[11px] text-muted-foreground leading-snug block">
                    {b.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
