import { Link } from "react-router";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Cloud,
  Zap,
  Smartphone,
} from "lucide-react";
import { Badge, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";

export function HeroEditorial() {
  const { trialUrl } = useLandingCta();
  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-16 sm:pb-24 md:pt-24 md:pb-32">
      {/* Luz ambiente suave de fundo */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] sm:size-[800px] rounded-full bg-primary/10 blur-[120px] sm:blur-[150px] -z-10"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col items-center text-center">
          {/* Badge de Destaque */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary transition-all duration-200">
            <Sparkles className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Engenharia Financeira & Inteligência de Aportes</span>
          </div>

          {/* Headline Principal Editorial Ampliada */}
          <h1 className="mt-5 sm:mt-8 max-w-4xl font-display text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.15] md:leading-[1.1]">
            O controle financeiro que você queria.{" "}
            <span className="text-primary-strong">A inteligência de investimentos</span> que você precisa.
          </h1>

          {/* Subtítulo Rico e Persuasivo com Tipografia Editorial */}
          <p className="mt-4 sm:mt-6 max-w-3xl text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed font-normal">
            Elimine planilhas manuais frágeis e faturas de cartão surpresas. Uma plataforma Online First de alta precisão que calcula seu caixa real, controla parcelamentos futuros em centavos e rebalanceia seu patrimônio com rigor matemático.
          </p>

          {/* CTAs de Conversão com Shimmer Reflexivo e Altura Confortável */}
          <div className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              to={trialUrl}
              className={cn(
                buttonVariants({ size: "lg" }),
                "group relative overflow-hidden w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-7 text-base sm:text-lg font-semibold shadow-lg inline-flex items-center justify-center gap-2.5 rounded-xl sm:rounded-2xl",
              )}
            >
              <span
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                aria-hidden="true"
              />
              <span className="relative z-10 flex items-center gap-2">
                Experimentar 30 Dias Grátis
                <ArrowRight className="size-4.5 sm:size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>

            <button
              type="button"
              onClick={() => {
                document.getElementById("recursos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-7 text-base sm:text-lg cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl",
              )}
            >
              <span>Conhecer os Recursos</span>
              <ChevronRight className="size-4.5 sm:size-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          {/* Indicadores de Confiança */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck className="size-4 sm:size-4.5 text-positive-strong dark:text-positive" aria-hidden="true" />
              <span>Sessão Protegida por RLS</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Sparkles className="size-4 sm:size-4.5 text-primary" aria-hidden="true" />
              <span>30 Dias Grátis sem Cartão</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="size-4 sm:size-4.5 text-portfolio" aria-hidden="true" />
              <span>Precisão em Centavos Exatos</span>
            </div>
          </div>
        </div>

        {/* Visual Mockup Espaçoso e Cinematográfico */}
        <ScrollReveal delay={120} className="mt-10 sm:mt-18 max-w-6xl mx-auto">
          <div className="relative rounded-2xl sm:rounded-3xl border border-border/80 bg-surface/95 p-4 sm:p-8 md:p-10 shadow-xl sm:shadow-2xl backdrop-blur-2xl">
            {/* Header da Janela */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 sm:pb-4 mb-4 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="size-2.5 sm:size-3.5 rounded-full bg-critical/70" />
                <div className="size-2.5 sm:size-3.5 rounded-full bg-warning/70" />
                <div className="size-2.5 sm:size-3.5 rounded-full bg-positive/70" />
                <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-mono text-muted-foreground hidden sm:inline">
                  guia-financeiro.app / visao-geral
                </span>
              </div>
              <Badge variant="default" size="xs" className="font-mono border border-primary/30">
                Online First
              </Badge>
            </div>

            {/* Grid de 3 Métricas Centrais Adaptativas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border/70 bg-background/60 flex flex-col justify-between overflow-hidden">
                <span className="text-xs sm:text-sm text-muted-foreground block truncate">Caixa Real Disponível</span>
                <div className="my-1.5 sm:my-2 font-mono text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight whitespace-nowrap tabular-nums">
                  R$ 6.240,00
                </div>
                <span className="text-xs text-positive-strong dark:text-positive font-medium flex items-center gap-1.5 whitespace-nowrap">
                  <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                  Livre de dívidas e faturas
                </span>
              </div>

              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border/70 bg-background/60 flex flex-col justify-between overflow-hidden">
                <span className="text-xs sm:text-sm text-muted-foreground block truncate">Ritmo Diário (Daily Budget)</span>
                <div className="my-1.5 sm:my-2 font-mono text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-primary-strong tracking-tight whitespace-nowrap tabular-nums flex items-baseline gap-1.5">
                  <span>R$ 148,00</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">/ dia</span>
                </div>
                <span className="text-xs text-muted-foreground block whitespace-nowrap">
                  Para terminar o mês no azul
                </span>
              </div>

              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border/70 bg-background/60 flex flex-col justify-between overflow-hidden">
                <span className="text-xs sm:text-sm text-muted-foreground block truncate">Taxa de Poupança</span>
                <div className="my-1.5 sm:my-2 font-mono text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-positive-strong dark:text-positive tracking-tight whitespace-nowrap tabular-nums">
                  34.5%
                </div>
                <span className="text-xs text-muted-foreground block whitespace-nowrap">
                  Meta saudável: acima de 20%
                </span>
              </div>
            </div>

            {/* Barra Consolidada de Orçamentos Ampliada */}
            <div className="mt-3.5 sm:mt-6 rounded-xl sm:rounded-2xl border border-border/70 bg-background/40 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-xs sm:text-sm mb-2.5 sm:mb-3">
                <span className="font-semibold text-foreground">Orçamento Mensal Consolidado</span>
                <span className="font-mono text-muted-foreground">R$ 3.820 de R$ 5.500 (69% utilizado)</span>
              </div>
              <div className="w-full h-3 sm:h-4 rounded-full overflow-hidden bg-muted/60 p-0.5 flex gap-1 border border-border/50">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: "35%" }} />
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: "20%" }} />
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: "14%" }} />
              </div>
              <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-5 text-xs sm:text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="size-2 sm:size-2.5 rounded-full bg-emerald-500" /> Moradia (R$ 1.925)
                </span>
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="size-2 sm:size-2.5 rounded-full bg-blue-500" /> Alimentação (R$ 1.100)
                </span>
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="size-2 sm:size-2.5 rounded-full bg-amber-500" /> Transporte (R$ 770)
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Faixa de Confiança & Garantias Técnicas */}
        <ScrollReveal delay={150} className="mt-8 sm:mt-14 border-t border-border/70 pt-8 sm:pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center">
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
                <span>Isolamento RLS</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Criptografia e sigilo de ponta</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <Cloud className="size-4 text-primary" aria-hidden="true" />
                <span>100% Online First</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Sincronização em tempo real</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <Zap className="size-4 text-warning-strong dark:text-warning" aria-hidden="true" />
                <span>Zero Planilhas Frágeis</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Cálculos determinísticos</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                <Smartphone className="size-4 text-portfolio" aria-hidden="true" />
                <span>PWA Multiplataforma</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Instalável no iOS e Android</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

