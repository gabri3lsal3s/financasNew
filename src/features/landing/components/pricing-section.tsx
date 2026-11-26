import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks/use-landing-cta";
import { triggerSensory } from "@/services/sensory";
import { ScrollReveal } from "./scroll-reveal";
import { PricingCardsGrid } from "./pricing-cards-grid";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const { trialUrl, proUrl } = useLandingCta();

  return (
    <section
      id="precos"
      className="py-14 md:py-24 bg-surface-raised/30 border-t border-border/80 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <Sparkles className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Planos Transparentes &amp; Justos</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Um único app no lugar de vários assinados e planilhas
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Comece com acesso total gratuito por 30 dias, sem cartão de crédito. Depois do teste,
            todo o seu histórico fica salvo no Modo Somente Leitura para consultar quando quiser.
          </p>

          <div className="mt-6 sm:mt-8 inline-flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl border border-border/80 bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setIsAnnual(false);
              }}
              aria-pressed={!isAnnual}
              className={cn(
                "min-h-11 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                !isAnnual
                  ? "bg-primary-strong text-primary-foreground dark:bg-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setIsAnnual(true);
              }}
              aria-pressed={isAnnual}
              className={cn(
                "min-h-11 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isAnnual
                  ? "bg-primary-strong text-primary-foreground dark:bg-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Anual</span>
              <Badge
                variant={isAnnual ? "default" : "positive"}
                size="xs"
                className={cn(
                  "font-bold transition-colors",
                  isAnnual
                    ? "bg-surface text-primary-strong shadow-xs border border-primary-strong/20"
                    : "border border-transparent",
                )}
              >
                Economize 40%
              </Badge>
            </button>
          </div>
        </ScrollReveal>

        <PricingCardsGrid
          isAnnual={isAnnual}
          trialUrl={trialUrl}
          proPlanUrl={proUrl(isAnnual ? "pro-anual" : "pro-mensal")}
        />
      </div>
    </section>
  );
}
