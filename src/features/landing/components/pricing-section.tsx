import { useState } from "react";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, Badge, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { useLandingCta } from "@/features/landing/hooks";
import { ScrollReveal } from "./scroll-reveal";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const { trialUrl, proUrl } = useLandingCta();

  return (
    <section id="precos" className="py-14 md:py-32 bg-surface/40 border-y border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">
            Planos Transparentes & Justos
          </h2>
          <p className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Invista na sua organização com o melhor custo-benefício
          </p>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Comece com 30 dias de acesso total gratuito sem precisar de cartão de crédito. Após o período, seu histórico fica preservado para consulta e você assina o Pro quando quiser.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-6 sm:mt-8 inline-flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl border border-border bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`min-h-[40px] sm:min-h-[44px] px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center justify-center ${
                !isAnnual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`min-h-[40px] sm:min-h-[44px] px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                isAnnual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Anual</span>
              <Badge
                variant={isAnnual ? "default" : "positive"}
                size="xs"
                className={cn(
                  "font-bold transition-colors",
                  isAnnual
                    ? "bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30"
                    : "border border-transparent"
                )}
              >
                Economize 25%
              </Badge>
            </button>
          </div>
        </ScrollReveal>

        {/* Pricing Cards Grid com Entrada Escalonada */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
          {/* Card 1: Teste de 30 Dias (Depois Somente-Leitura) */}
          <ScrollReveal delay={0} className="h-full">
            <Card className="flex flex-col justify-between border-border/80 bg-surface/90 shadow-sm p-5 sm:p-8 rounded-2xl sm:rounded-3xl h-full">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Teste de 30 Dias
                  </span>
                  <Badge variant="default" size="xs" className="font-mono border border-primary/30">
                    Sem Cartão
                  </Badge>
                </div>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold text-foreground">R$ 0</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">/ 30 dias</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Acesso irrestrito a todas as funcionalidades do Pro
                </p>

                <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                  Experimente o poder do Safe-to-Spend e do motor de aportes na prática com seus dados reais.
                </p>

                <div className="mt-6 sm:mt-8 flex flex-col gap-2.5 sm:gap-3.5 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span>Lançamentos e escritas 100% liberados</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span>Gestão de múltiplos cartões e parcelamentos</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span>Simulador e rebalanceamento de carteira</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Modo Somente-Leitura após o período:</strong> seus dados continuam seus para consulta</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/60">
                <Link
                  to={trialUrl}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full justify-center font-semibold inline-flex items-center gap-2 rounded-xl",
                  )}
                >
                  Começar Teste Grátis
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-positive-strong dark:text-positive" aria-hidden="true" />
                  <span>Não pedimos dados bancários</span>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Card 2: Plano Pro (Featured) */}
          <ScrollReveal delay={100} className="h-full">
            <Card className="flex flex-col justify-between border-primary/50 bg-surface/95 shadow-xl p-5 sm:p-8 relative overflow-hidden ring-2 ring-primary/20 rounded-2xl sm:rounded-3xl h-full">
              {/* Top highlight banner */}
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Mais Escolhido
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-bold text-primary-strong uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Plano Pro
                  </span>
                </div>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold text-foreground">
                    {isAnnual ? "R$ 14,90" : "R$ 19,90"}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground">/ mês</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAnnual ? "Cobrado anualmente (R$ 178,80/ano)" : "Cobrado mensalmente"}
                </p>

                <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                  Gestão ativa contínua, lançamentos ilimitados e motor avançado de inteligência fiscal.
                </p>

                <div className="mt-6 sm:mt-8 flex flex-col gap-2.5 sm:gap-3.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 font-medium text-foreground">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Lançamentos e escritas 100% ilimitados</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Histórico vitalício</strong> e relatórios executivos</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Multi-Cartões</strong> + Parcelamentos em até 60x</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Motor de Rebalanceamento</strong> determinístico de aportes</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span><strong>Radar Fiscal de IR</strong> & Apuração de DARF</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                    <span>Dossiê completo em <strong>Excel (.xlsx nativo)</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/60">
                <Link
                  to={proUrl(isAnnual ? "pro-anual" : "pro-mensal")}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full justify-center shadow-md font-semibold inline-flex items-center gap-2 rounded-xl",
                  )}
                >
                  Assinar Plano Pro
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-positive-strong dark:text-positive" aria-hidden="true" />
                  <span>30 dias de teste sem fidelidade</span>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
