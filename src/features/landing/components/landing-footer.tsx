import { Link } from "react-router";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface/80 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
          {/* Coluna 1: Brand & Slogan */}
          <div className="flex flex-col gap-3 md:col-span-5">
            <BrandLogo markClassName="size-8" />
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mt-1">
              Gestão financeira inteligente, controle integrado de cartões e motor de rebalanceamento
              de carteira focado na independência financeira.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <ShieldCheck className="size-4 text-emerald-500" aria-hidden="true" />
              <span>Ambiente criptografado com Row Level Security</span>
            </div>
          </div>

          {/* Coluna 2: Produto */}
          <div className="flex flex-col gap-2 md:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Produto
            </span>
            <Link to="/entrar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Entrar na Conta
            </Link>
            <Link to="/cadastro" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cadastre-se Grátis
            </Link>
            <a href="#recursos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#simulador" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Simulador FIRE
            </a>
            <a href="#precos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
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
              <span className="text-xs text-muted-foreground">Termos de Serviço</span>
              <span className="text-xs text-muted-foreground">Privacidade (LGPD)</span>
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
  );
}
