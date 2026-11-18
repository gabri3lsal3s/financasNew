import { Cloud, PieChart, ShieldCheck, Smartphone, TrendingUp, Zap } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";

const TRUST_GUARANTEES = [
  {
    icon: ShieldCheck,
    iconClass: "text-positive-strong dark:text-positive",
    title: "Isolamento RLS",
    subtitle: "Criptografia e sigilo de ponta",
  },
  {
    icon: Cloud,
    iconClass: "text-primary",
    title: "100% Online First",
    subtitle: "Sincronização em tempo real",
  },
  {
    icon: Zap,
    iconClass: "text-warning-strong dark:text-warning",
    title: "Zero Planilhas Frágeis",
    subtitle: "Cálculos determinísticos",
  },
  {
    icon: Smartphone,
    iconClass: "text-portfolio",
    title: "PWA & Android Pro",
    subtitle: "Instalável no iOS, Android e Desktop",
  },
];

export function HeroDashboardMockup() {
  return (
    <>
      <ScrollReveal delay={120} direction="none" className="mt-10 sm:mt-18 max-w-6xl mx-auto">
        <div className="relative rounded-2xl sm:rounded-3xl border border-border/80 bg-surface p-4 sm:p-8 md:p-10 shadow-xl sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 sm:pb-4 mb-4 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="size-2.5 sm:size-3.5 rounded-full bg-critical/70" />
              <div className="size-2.5 sm:size-3.5 rounded-full bg-warning/70" />
              <div className="size-2.5 sm:size-3.5 rounded-full bg-positive/70" />
              <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-mono text-muted-foreground hidden sm:inline">
                axir.app / dashboard
              </span>
            </div>
            <Badge variant="default" size="xs" className="font-mono border border-primary/30">
              Online First
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/50 flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Caixa Real Disponível
              </span>
              <div className="my-1.5 sm:my-2">
                <MoneyText
                  cents={624000}
                  tone="default"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground"
                />
              </div>
              <span className="text-xs text-positive-strong dark:text-positive font-medium flex items-center gap-1.5">
                <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Livre de dívidas e faturas</span>
              </span>
            </div>

            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/50 flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Ritmo Diário
              </span>
              <div className="my-1.5 sm:my-2 flex items-baseline gap-1.5 flex-wrap">
                <MoneyText
                  cents={14800}
                  tone="default"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary-strong"
                />
                <span className="text-xs sm:text-sm font-mono font-normal text-muted-foreground">
                  / dia
                </span>
              </div>
              <span className="text-xs text-muted-foreground block">
                Para terminar o mês no azul
              </span>
            </div>

            <div className="p-3.5 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/50 flex flex-col justify-between min-w-0">
              <span className="text-xs sm:text-sm text-muted-foreground block line-clamp-2 break-words">
                Aporte Calibrado do Mês
              </span>
              <div className="my-1.5 sm:my-2">
                <MoneyText
                  cents={150000}
                  tone="portfolio"
                  deemphasizeCents={false}
                  className="text-xl sm:text-2xl lg:text-3xl font-extrabold"
                />
              </div>
              <span className="text-xs text-portfolio font-medium flex items-center gap-1.5">
                <PieChart className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Direcionado: Renda Fixa & FIIs</span>
              </span>
            </div>
          </div>

          <div className="mt-3.5 sm:mt-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-raised/40 p-3.5 sm:p-5 lg:p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-xs sm:text-sm mb-2.5 sm:mb-3">
              <span className="font-semibold text-foreground">Orçamento Mensal Consolidado</span>
              <span className="font-mono tabular-nums text-muted-foreground text-xs sm:text-sm">
                R$ 3.820 de R$ 5.500 (69% utilizado · R$ 1.680 livres)
              </span>
            </div>
            <div className="w-full h-3 sm:h-4 rounded-full overflow-hidden bg-muted p-0.5 flex gap-1 border border-border/60">
              <div className="h-full rounded-full bg-cat-2 transition-all" style={{ width: "35%" }} />
              <div className="h-full rounded-full bg-cat-1 transition-all" style={{ width: "20%" }} />
              <div className="h-full rounded-full bg-cat-3 transition-all" style={{ width: "14%" }} />
            </div>
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-5 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-2" /> Moradia (R$ 1.925)
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-1" /> Alimentação (R$ 1.100)
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <span className="size-2 sm:size-2.5 rounded-full bg-cat-3" /> Transporte (R$ 770)
              </span>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal
        delay={150}
        direction="none"
        className="mt-8 sm:mt-14 border-t border-border/70 pt-8 sm:pt-10"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center">
          {TRUST_GUARANTEES.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface border border-border/80 shadow-xs"
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <item.icon className={`size-4 ${item.iconClass}`} aria-hidden="true" />
                <span>{item.title}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </>
  );
}
