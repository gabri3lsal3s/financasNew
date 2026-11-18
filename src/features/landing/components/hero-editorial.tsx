import { Link } from "react-router";
import { ArrowRight, ChevronRight, Share2, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { Badge, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks";
import { HeroDashboardMockup } from "./hero-dashboard-mockup";

export function HeroEditorial() {
  const { trialUrl, isLoggedIn } = useLandingCta();

  const scrollToTarget = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-16 sm:pb-24 md:pt-24 md:pb-32">
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] sm:size-[800px] rounded-full bg-primary/10 blur-[120px] sm:blur-[150px] -z-10"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col items-center text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong transition-all duration-200">
              <Sparkles className="size-3.5 sm:size-4" aria-hidden="true" />
              <span>Controle Financeiro Real · Faturas, Cobranças e Aportes sem Planilhas</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <a
                href="#financas-compartilhadas"
                data-testid="hero-pill-racha"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget("financas-compartilhadas");
                }}
                className="group inline-flex min-h-11 items-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-pill cursor-pointer"
                title="Conhecer o Racha de Despesas com Pix"
              >
                <Badge
                  variant="muted"
                  size="md"
                  className="border border-border/80 text-muted-foreground group-hover:text-foreground group-hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <Share2 className="size-3 text-primary" aria-hidden="true" />
                  <span>Racha com Pix</span>
                </Badge>
              </a>

              <a
                href="#financas-compartilhadas"
                data-testid="hero-pill-family"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget("financas-compartilhadas");
                }}
                className="group inline-flex min-h-11 items-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-pill cursor-pointer"
                title="Conhecer o Modo Família Multi-Contas"
              >
                <Badge
                  variant="muted"
                  size="md"
                  className="border border-border/80 text-muted-foreground group-hover:text-foreground group-hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <Users className="size-3 text-primary" aria-hidden="true" />
                  <span>Modo Família</span>
                </Badge>
              </a>
            </div>
          </div>

          <h1 className="mt-5 sm:mt-8 max-w-4xl font-display text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.15] md:leading-[1.1]">
            Do controle de cartões e compromissos ao aporte do mês.{" "}
            <span className="text-primary-strong">
              Saiba exatamente quanto gastar hoje e onde investir o que sobrar.
            </span>
          </h1>

          <p className="mt-4 sm:mt-6 max-w-3xl text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed font-normal">
            Elimine o susto das faturas futuras e a desorganização de anotações soltas. O Axir
            calcula seu caixa real diário, acompanha o que você deve e tem a receber, e direciona
            seus aportes com rigor matemático sem vender posições.
          </p>

          <div className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
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
              onClick={() => scrollToTarget("recursos")}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-7 text-base sm:text-lg cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl",
              )}
            >
              <span>Conhecer os Recursos</span>
              <ChevronRight className="size-4.5 sm:size-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <span>
              {isLoggedIn ? "Precisa de ajuda ou configurações?" : "Prefere assinar direto?"}
            </span>
            {isLoggedIn ? (
              <Link
                to="/configuracoes"
                className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:text-primary-strong transition-colors"
              >
                Gerenciar assinatura nas configurações
              </Link>
            ) : (
              <a
                href="#precos"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget("precos");
                }}
                className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:text-primary-strong transition-colors cursor-pointer"
              >
                Conheça os planos Pro com até 40% de desconto
              </a>
            )}
          </div>

          <div className="mt-7 sm:mt-9 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck
                className="size-4 sm:size-4.5 text-positive-strong dark:text-positive"
                aria-hidden="true"
              />
              <span>30 Dias de Teste sem Compromisso</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Sparkles className="size-4 sm:size-4.5 text-primary" aria-hidden="true" />
              <span>Cancele a Qualquer Momento</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="size-4 sm:size-4.5 text-portfolio" aria-hidden="true" />
              <span>Garantia Legal de 7 Dias (CDC)</span>
            </div>
          </div>
        </div>

        <HeroDashboardMockup />
      </div>
    </section>
  );
}
