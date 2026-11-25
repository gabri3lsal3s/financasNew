import { Link } from "react-router";
import { ArrowRight, CheckCircle2, ChevronRight, Layers, Lock, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks";
import { HeroDashboardMockup } from "./hero-dashboard-mockup";

export function HeroEditorial() {
  const { trialUrl, isLoggedIn } = useLandingCta();

  const scrollToTarget = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-14 sm:pb-20 md:pt-20 md:pb-24">
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] sm:size-[800px] rounded-full bg-primary/10 blur-[120px] sm:blur-[150px] -z-10"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong">
            <Layers className="size-3.5 sm:size-4 shrink-0" aria-hidden="true" />
            <span>Vida pessoal, negócio (MEI/PJ) e investimentos com IA integrada · sem planilhas</span>
          </div>

          <h1 className="mt-5 sm:mt-8 max-w-4xl font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15] md:leading-[1.1]">
            Do gasto do dia a dia aos seus investimentos.{" "}
            <span className="text-primary-strong">
              Um único app com IA que conecta caixa, cartões, negócio e carteira.
            </span>
          </h1>

          <p className="mt-4 sm:mt-6 max-w-3xl text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed font-normal">
            Substitua planilhas e apps soltos. Leia cupons e faturas com IA, separe finanças pessoais e
            do negócio (MEI/PJ), divida gastos em grupo e invista com preço teto e memória de
            cálculo transparente.
          </p>

          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              to={trialUrl}
              aria-label={
                isLoggedIn ? "Acessar Meu Painel" : "Começar 30 Dias Grátis — teste sem cartão"
              }
              className={cn(
                buttonVariants({ size: "lg" }),
                "group relative overflow-hidden w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-7 text-base sm:text-lg font-semibold shadow-lg inline-flex items-center justify-center gap-2.5 rounded-xl sm:rounded-2xl",
              )}
            >
              <span
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent pointer-events-none"
                aria-hidden="true"
              />
              <span className="relative z-10 flex items-center gap-2">
                {isLoggedIn ? "Acessar Meu Painel" : "Começar 30 Dias Grátis"}
                <ArrowRight
                  className="size-4.5 sm:size-5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>

            <button
              type="button"
              onClick={() => scrollToTarget("ecossistema")}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-7 text-base sm:text-lg cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl",
              )}
            >
              <span>Ver como tudo se conecta</span>
              <ChevronRight className="size-4.5 sm:size-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck
                className="size-4 sm:size-4.5 text-positive-strong dark:text-positive shrink-0"
                aria-hidden="true"
              />
              <span>30 dias grátis sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Lock
                className="size-4 sm:size-4.5 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
              <span>Nunca pedimos senha de banco</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckCircle2
                className="size-4 sm:size-4.5 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
              <span>Cancele em 1 clique</span>
            </div>
          </div>
        </div>

        <HeroDashboardMockup />
      </div>
    </section>
  );
}
