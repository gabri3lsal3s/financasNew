import { useState } from "react";
import { Link } from "react-router";
import { Building2, Lock, Mail, MapPin, ShieldCheck, User } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LegalDialog, type LegalTab } from "./legal-dialog";
import { useLandingCta } from "@/features/landing/hooks/use-landing-cta";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const { trialUrl, isLoggedIn } = useLandingCta();

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalOpen(true);
  };

  return (
    <>
      <footer className="border-t border-border/80 bg-surface pt-12 pb-[calc(5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
            <div className="flex flex-col gap-3 md:col-span-5">
              <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
                A plataforma definitiva para controle financeiro pessoal, inteligência de aportes e
                rebalanceamento de carteira sem fórmulas frágeis.
              </p>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {INSTITUTIONAL_CONFIG.cnpj ? (
                    <Building2 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  ) : (
                    <User className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  {INSTITUTIONAL_CONFIG.companyName}
                </span>
                {INSTITUTIONAL_CONFIG.cnpj ? (
                  <span>CNPJ: {INSTITUTIONAL_CONFIG.cnpj}</span>
                ) : (
                  <span>Desenvolvedor Responsável: {INSTITUTIONAL_CONFIG.developerName}</span>
                )}
                <div className="flex items-start gap-1.5 mt-0.5">
                  <MapPin className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <span>{INSTITUTIONAL_CONFIG.address}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Lock className="size-3.5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Ambiente criptografado com Row Level Security</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:gap-2 md:col-span-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                Produto
              </span>
              <Link
                to={isLoggedIn ? "/" : "/entrar"}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {isLoggedIn ? "Acessar o App" : "Entrar na Conta"}
              </Link>
              {!isLoggedIn ? (
                <Link
                  to={trialUrl}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Cadastre-se Grátis
                </Link>
              ) : null}
              <a
                href="#dores"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("dores")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Na Prática
              </a>
              <a
                href="#profundidade"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("profundidade")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Investimentos &amp; Relatórios
              </a>
              <a
                href="#simulador"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("simulador")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Simulador Patrimonial
              </a>
              <a
                href="#precos"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Planos & Preços
              </a>
              <div className="pt-2 mt-1 border-t border-border/50 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ferramentas Abertas
                </span>
                <Link
                  to="/ferramentas"
                  className="text-xs text-primary-strong dark:text-primary font-medium hover:underline py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Hub de Simuladores
                </Link>
                <Link
                  to="/ferramentas/simulador-dividas"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Simulador de Dívidas
                </Link>
                <Link
                  to="/ferramentas/rebalanceamento"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Simulador de Rebalanceamento
                </Link>
                <Link
                  to="/ferramentas/juros-compostos"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Juros Compostos & Independência
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:col-span-4">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Transparência & Conformidade Legal
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Não vendemos seus dados para instituições financeiras. Sem anúncios invasivos.
              </p>

              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>Encarregado (DPO):</span>
                  <a
                    href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`}
                    aria-label="Enviar e-mail para o Encarregado de Proteção de Dados (DPO)"
                    className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    {INSTITUTIONAL_CONFIG.dpoEmail}
                  </a>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Mail className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>Suporte:</span>
                  <a
                    href={`mailto:${INSTITUTIONAL_CONFIG.supportEmail}`}
                    aria-label="Enviar e-mail para o Suporte ao Consumidor"
                    className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    {INSTITUTIONAL_CONFIG.supportEmail}
                  </a>
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Documentos Oficiais
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Link
                    to="/termos"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Termos de Serviço
                  </Link>
                  <Link
                    to="/privacidade"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors py-1.5 sm:py-0.5 inline-flex items-center rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Privacidade (LGPD)
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                  <span>Visualização rápida:</span>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal("terms")}
                    className="min-h-11 sm:min-h-0 inline-flex items-center text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Termos de Serviço
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal("privacy")}
                    className="min-h-11 sm:min-h-0 inline-flex items-center text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Privacidade (LGPD)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              © {currentYear} {INSTITUTIONAL_CONFIG.companyName}. Todos os direitos reservados.
            </div>
            <div className="flex items-center gap-1 text-center sm:text-right">
              <span>Conformidade com LGPD (Lei nº 13.709/2018), Marco Civil e CDC</span>
            </div>
          </div>
        </div>
      </footer>

      <LegalDialog open={legalOpen} onOpenChange={setLegalOpen} defaultTab={legalTab} />
    </>
  );
}
