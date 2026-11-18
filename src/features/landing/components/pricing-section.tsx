import { useState } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks";
import { triggerSensory } from "@/services/sensory";
import { ScrollReveal } from "./scroll-reveal";
import { PricingCardsGrid } from "./pricing-cards-grid";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const { trialUrl, proUrl } = useLandingCta();

  return (
    <section
      id="precos"
      className="py-14 md:py-32 bg-surface-raised/30 border-y border-border/80 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary-strong dark:text-primary">
            Planos Transparentes & Justos
          </h2>
          <p className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Invista na sua organização com o melhor custo-benefício
          </p>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Comece com acesso total gratuito, sem cartão de crédito. Após o período de teste, seu
            histórico fica preservado para consulta e você assina o Pro quando quiser.
          </p>

          <div className="mt-6 sm:mt-8 inline-flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl border border-border/80 bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setIsAnnual(false);
              }}
              className={cn(
                "min-h-11 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center",
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
              className={cn(
                "min-h-11 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5",
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
