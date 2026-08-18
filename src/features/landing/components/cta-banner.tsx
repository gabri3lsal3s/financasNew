import { Link } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function CtaBanner() {
  return (
    <section className="py-16 md:py-20 relative overflow-hidden bg-primary text-primary-foreground">
      {/* Decorative ambient background */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-black/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>Comece em Menos de 2 Minutos</span>
        </div>

        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
          Pronto para ter clareza total sobre o seu dinheiro?
        </h2>

        <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-primary-foreground/90 leading-relaxed">
          Junte-se a quem já abandonou o caos das planilhas e das faturas surpresas. Crie sua conta
          gratuita hoje mesmo.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/cadastro"
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-white text-primary hover:bg-white/90 border-transparent shadow-lg inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-95"
          >
            Criar Conta Gratuita Agora
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/80">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>7 dias de teste completo · Sem cartão de crédito · Cancelamento fácil</span>
        </div>
      </div>
    </section>
  );
}
