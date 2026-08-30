import { Link } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useLandingCta } from "@/features/landing/hooks";
import { ScrollReveal } from "./scroll-reveal";

export function CtaBanner() {
  const { trialUrl, isLoggedIn } = useLandingCta();

  return (
    <section className="py-14 md:py-32 relative overflow-hidden bg-surface/40 border-y border-border/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="relative rounded-2xl sm:rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-surface/90 to-surface p-6 sm:p-16 lg:p-20 shadow-xl sm:shadow-2xl backdrop-blur-xl overflow-hidden text-center max-w-6xl mx-auto">
          {/* Ambient background light spheres */}
          <div
            className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full bg-accent/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong">
              <Sparkles className="size-3.5 sm:size-4" aria-hidden="true" />
              <span>Comece em Menos de 2 Minutos</span>
            </div>

            <h2 className="mt-4 sm:mt-6 font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
              Pronto para ter clareza total sobre o seu dinheiro?
            </h2>

            <p className="mt-3 sm:mt-5 max-w-3xl mx-auto text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Junte-se a quem já abandonou o caos das planilhas e das faturas surpresas. Crie sua conta
              gratuita hoje mesmo e organize sua vida financeira.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={trialUrl}
                className="group relative overflow-hidden w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold bg-primary text-primary-foreground hover:bg-primary-strong shadow-lg hover:shadow-xl inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-95"
              >
                {/* Shimmer Sweep Effect */}
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <span className="relative z-10 flex items-center gap-2">
                  {isLoggedIn ? "Acessar Meu Painel Agora" : "Criar Conta Gratuita Agora"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </div>

            <div className="mt-5 sm:mt-6 flex items-center justify-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 sm:size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
              <span>30 dias de teste completo · Sem cartão de crédito · Histórico preservado</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
