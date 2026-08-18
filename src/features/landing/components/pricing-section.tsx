import { useState } from "react";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="precos" className="py-16 md:py-24 bg-surface/40 border-y border-border/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
            Planos Transparentes & Justos
          </h2>
          <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            Invista na sua organização com o melhor custo-benefício
          </p>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Comece no plano gratuito ou desbloqueie todo o poder da inteligência de investimentos e
            simulações avançadas no Plano Pro. Cancele quando quiser.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-xl border border-border bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isAnnual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Anual</span>
              <Badge variant="positive" className="text-[10px] font-bold">
                Economize 25%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
          {/* Free Tier Card */}
          <Card className="flex flex-col justify-between border-border/80 bg-surface/90 shadow-sm p-6 sm:p-8">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Plano Gratuito
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-extrabold text-foreground">R$ 0</span>
                <span className="text-sm text-muted-foreground">/ sempre</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Ideal para quem deseja iniciar a organização de despesas, contas e cartões básicos.
              </p>

              <div className="mt-8 flex flex-col gap-3.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Lançamentos de despesas e receitas ilimitados</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Até 2 cartões de crédito simultâneos</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Histórico completo de 3 meses</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Simulador FIRE em modo básico</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Suporte a PWA e uso em qualquer dispositivo</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/60">
              <Link
                to="/cadastro"
                className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
              >
                Começar Grátis
              </Link>
            </div>
          </Card>

          {/* Pro Tier Card (Featured) */}
          <Card className="flex flex-col justify-between border-primary/50 bg-surface/95 shadow-xl p-6 sm:p-8 relative overflow-hidden ring-2 ring-primary/20">
            {/* Top highlight banner */}
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
              Mais Recomendado
            </div>

            <div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-primary-strong uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Plano Pro
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-extrabold text-foreground">
                  {isAnnual ? "R$ 14,90" : "R$ 19,90"}
                </span>
                <span className="text-sm text-muted-foreground">/ mês</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isAnnual ? "Cobrado anualmente (R$ 178,80/ano)" : "Cobrado mensalmente"}
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                Para quem quer acelerar a independência financeira com inteligência de aportes e sem limites.
              </p>

              <div className="mt-8 flex flex-col gap-3.5 text-sm">
                <div className="flex items-center gap-2.5 font-medium text-foreground">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span>Tudo incluído no Plano Gratuito</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span><strong>Cartões ilimitados</strong> & gestão de faturas</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span><strong>Motor de Rebalanceamento</strong> de carteira</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span><strong>Histórico vitalício</strong> e relatórios ilimitados</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span>Fechamento Mensal Executivo em <strong>PDF/Impressão</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                  <span>Detecção de assinaturas ocultas & cortes inteligentes</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/60">
              <Link
                to="/cadastro"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full justify-center shadow-md font-semibold inline-flex items-center gap-2",
                )}
              >
                Testar 7 dias Grátis
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-positive-strong dark:text-positive" aria-hidden="true" />
                <span>Garantia de 7 dias ou seu dinheiro de volta</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
