import { Link } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function CtaBanner() {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden bg-surface/40 border-y border-border/70">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-surface/90 to-surface p-8 sm:p-14 shadow-2xl backdrop-blur-xl overflow-hidden text-center">
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
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary-strong">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>Comece em Menos de 2 Minutos</span>
            </div>

            <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Pronto para ter clareza total sobre o seu dinheiro?
            </h2>

            <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              Junte-se a quem já abandonou o caos das planilhas e das faturas surpresas. Crie sua conta
              gratuita hoje mesmo e organize sua vida financeira.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/cadastro"
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary-strong shadow-lg hover:shadow-xl inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-95"
              >
                Criar Conta Gratuita Agora
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
              <span>7 dias de teste completo · Sem cartão de crédito · Cancelamento fácil</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
