import { Link } from "react-router";
import {
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  PieChart,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Subtle background ambient light */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/10 blur-[120px] -z-10"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Badge Tag */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/50">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Gestão Pessoal & Motor de Rebalanceamento</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 max-w-4xl font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.15]">
            O controle financeiro que você queria.{" "}
            <span className="text-primary-strong">A inteligência de investimentos</span> que você precisa.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
            Elimine planilhas manuais. Acompanhe faturas de cartões, parcele sem juros ocultos,
            rebalanceie sua carteira e planeje sua independência financeira em uma única plataforma.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link
              to="/cadastro"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto px-8 py-6 text-base font-semibold shadow-md inline-flex items-center justify-center gap-2",
              )}
            >
              Experimentar Grátis por 7 dias
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto px-6 py-6 text-base"
              onClick={() => {
                document.getElementById("simulador")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Simular Independência FIRE
            </Button>
          </div>

          {/* Trust points */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
              Segurança e criptografia de ponta
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="size-4 text-primary" aria-hidden="true" />
              Sem necessidade de cartão para testar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="size-4 text-warning-strong dark:text-warning" aria-hidden="true" />
              Baseado na regra determinística FIRE
            </span>
          </div>

          {/* Live Product Showcase Mockup */}
          <div className="mt-12 sm:mt-16 w-full max-w-4xl">
            <div className="relative rounded-2xl border border-border/80 bg-surface/90 p-3 sm:p-5 shadow-2xl backdrop-blur-xl">
              {/* Top window bar simulation */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-rose-500/80" />
                  <div className="size-3 rounded-full bg-amber-500/80" />
                  <div className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-muted-foreground hidden sm:inline">
                    app.guiafinanceiro.com/overview
                  </span>
                </div>
                <Badge variant="default" className="text-[11px] font-mono border border-primary/40">
                  Sessão Protegida
                </Badge>
              </div>

              {/* Mockup Dashboard Body */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
                {/* Metric Card 1: Saldo & Taxa de Poupança */}
                <Card variant="flat" className="p-4 bg-background/60 border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Saldo do Mês</span>
                    <Badge variant="positive" className="text-[10px]">
                      +18.4%
                    </Badge>
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold text-foreground">
                    R$ 4.850,00
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Taxa de Poupança:</span>
                    <span className="font-mono font-semibold text-positive-strong dark:text-positive">32.8%</span>
                  </div>
                </Card>

                {/* Metric Card 2: Fatura do Cartão */}
                <Card variant="flat" className="p-4 bg-background/60 border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Cartão Principal</span>
                    <Badge variant="warning" className="text-[10px]">
                      Abre em 4d
                    </Badge>
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold text-foreground">
                    R$ 1.940,20
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Limite Disponível:</span>
                    <span className="font-mono font-semibold text-foreground">R$ 8.059,80</span>
                  </div>
                </Card>

                {/* Metric Card 3: Carteira & Rebalanceamento */}
                <Card variant="flat" className="p-4 bg-background/60 border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Patrimônio Investido</span>
                    <Badge variant="portfolio" className="text-[10px]">
                      Alocado
                    </Badge>
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold text-foreground">
                    R$ 142.680,00
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Aporte Sugerido:</span>
                    <span className="font-mono font-semibold text-primary-strong">R$ 1.500,00</span>
                  </div>
                </Card>
              </div>

              {/* Mockup Active Insight Alert */}
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                    <PieChart className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Rebalanceamento Otimizado de Aportes
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Direcionando 65% do próximo aporte para Renda Fixa IPCA+ para retomar sua meta de segurança.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                  <span>Ver cálculo</span>
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </div>
              </div>

              {/* Bottom Quick Row Preview */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border/60 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border/40">
                  <span className="text-muted-foreground">Ações BR</span>
                  <span className="font-mono font-bold text-foreground">35%</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border/40">
                  <span className="text-muted-foreground">FIIs</span>
                  <span className="font-mono font-bold text-foreground">25%</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border/40">
                  <span className="text-muted-foreground">Renda Fixa</span>
                  <span className="font-mono font-bold text-foreground">30%</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border/40">
                  <span className="text-muted-foreground">Internacional</span>
                  <span className="font-mono font-bold text-foreground">10%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
