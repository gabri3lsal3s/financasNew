import { useState } from "react";
import { Link } from "react-router";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout";
import { LegalDialog } from "./legal-dialog";
import { useLandingCta } from "@/features/landing/hooks";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();
  const [legalOpen, setLegalOpen] = useState(false);
  const { trialUrl, isLoggedIn } = useLandingCta();

  return (
    <>
      <footer className="border-t border-border bg-surface/80 pt-12 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
            {/* Coluna 1: Marca & Compromisso */}
            <div className="flex flex-col gap-4 md:col-span-5">
              <BrandLogo markClassName="size-8" wordmarkClassName="text-base sm:text-lg" />
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
                A plataforma definitiva para controle financeiro pessoal, inteligência de aportes e rebalanceamento de carteira sem fórmulas frágeis.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
                <span>Ambiente criptografado com Row Level Security</span>
              </div>
            </div>

            {/* Coluna 2: Produto */}
            <div className="flex flex-col gap-1 sm:gap-2 md:col-span-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                Produto
              </span>
              <Link to={isLoggedIn ? "/" : "/entrar"} className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                {isLoggedIn ? "Acessar o App" : "Entrar na Conta"}
              </Link>
              {!isLoggedIn && (
                <Link to={trialUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                  Cadastre-se Grátis
                </Link>
              )}
              <a href="#recursos" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                Funcionalidades
              </a>
              <a href="#investimentos" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                Investimentos & Dossiês
              </a>
              <a href="#simulador" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                Simulador FIRE
              </a>
              <a href="#precos" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block">
                Planos & Preços
              </a>
            </div>

            {/* Coluna 3: Institucional & Legal */}
            <div className="flex flex-col gap-2 md:col-span-4">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Transparência & Segurança
              </span>
              <p className="text-xs text-muted-foreground">
                Não vendemos seus dados para instituições financeiras. Sem anúncios invasivos.
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setLegalOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Termos de Serviço
                </button>
                <button
                  type="button"
                  onClick={() => setLegalOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Privacidade (LGPD)
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              © {currentYear} Guia Financeiro. Todos os direitos reservados.
            </div>
            <div className="flex items-center gap-1">
              <span>Desenvolvido com foco em precisão e liberdade</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Diálogo Unificado de Termos e LGPD */}
      <LegalDialog open={legalOpen} onOpenChange={setLegalOpen} />
    </>
  );
}
