import { ArrowLeftRight, BarChart3, Briefcase, ShieldAlert, ShieldCheck, Target } from "lucide-react";
import { Badge, Card } from "@/components/ui";

const BUSINESS_PILLARS = [
  {
    title: "DRE Gerencial do Negócio",
    badge: "Competência",
    description:
      "Receita bruta, custos operacionais, impostos provisionados e margem líquida separados das suas contas pessoais.",
    icon: BarChart3,
  },
  {
    title: "Termômetro de Teto MEI",
    badge: "R$ 81 mil/ano",
    description:
      "Acompanhe o faturamento acumulado no ano e receba alertas preventivos antes de ultrapassar o limite do enquadramento.",
    icon: Target,
  },
  {
    title: "Tax Shield & Reserva DAS",
    badge: "Blindagem fiscal",
    description:
      "Provisiona automaticamente a alíquota de imposto e a guia mensal DAS para você saber o lucro realmente livre.",
    icon: ShieldAlert,
  },
  {
    title: "Ponto de Equilíbrio & Pró-Labore",
    badge: "PF e PJ",
    description:
      "Descubra quanto precisa faturar para pagar os custos fixos e transfira seu pró-labore para a conta pessoal em 1 toque.",
    icon: ArrowLeftRight,
  },
] as const;

export function BusinessModePreview() {
  return (
    <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-8 rounded-2xl sm:rounded-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start gap-2.5">
          <Briefcase className="size-4 text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">
              Modo Negócio: gestão completa para MEI, PJ e Autônomos
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Separe o dinheiro da empresa da sua vida pessoal sem precisar contratar outro sistema.
            </p>
          </div>
        </div>
        <Badge variant="portfolio" size="sm" className="self-start sm:self-center shrink-0">
          Kits de Categorias PJ
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {BUSINESS_PILLARS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-border/80 bg-surface-raised/40 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                </div>
                <Badge variant="muted" size="xs" className="shrink-0">
                  {item.badge}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-positive/25 bg-positive/5 p-3.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-foreground">Reembolso de cartão pessoal na empresa:</strong> comprou
          um insumo no cartão pessoal? O Axir rastreia o ressarcimento sem distorcer seu orçamento.
        </span>
      </div>
    </Card>
  );
}
