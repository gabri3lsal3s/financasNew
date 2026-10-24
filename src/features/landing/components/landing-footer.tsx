import { useState } from "react";
import { Link } from "react-router";
import { ShieldCheck, MapPin, Building2, Mail, Lock } from "lucide-react";
import { BrandLogo } from "@/components/layout";
import { LegalDialog, type LegalTab } from "./legal-dialog";
import { useLandingCta } from "@/features/landing/hooks";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

/**
 * Rodapé oficial da Landing Page do Áxis Finance.
 *
 * Provê transparência institucional em estrita conformidade com:
 * - Decreto do Comércio Eletrônico (Decreto nº 7.962/2013): Razão Social, CNPJ e endereço físico.
 * - Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD Art. 41): Canal do DPO.
 * - Código de Defesa do Consumidor (Lei nº 8.078/1990): Canal de atendimento e links contratuais diretos.
 */
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
      <footer className="border-t border-border bg-surface/80 pt-12 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
            {/* Coluna 1: Marca & Fornecedor Oficial (Decreto 7.962/2013) */}
            <div className="flex flex-col gap-3 md:col-span-5">
              <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
                A plataforma definitiva para controle financeiro pessoal, inteligência de aportes e rebalanceamento de carteira sem fórmulas frágeis.
              </p>

              {/* Identificação Jurídica Obrigatória */}
              <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  {INSTITUTIONAL_CONFIG.companyName}
                </span>
                <span>CNPJ: {INSTITUTIONAL_CONFIG.cnpj}</span>
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

            {/* Coluna 2: Produto */}
            <div className="flex flex-col gap-1 sm:gap-2 md:col-span-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                Produto
              </span>
              <Link
                to={isLoggedIn ? "/" : "/entrar"}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
              >
                {isLoggedIn ? "Acessar o App" : "Entrar na Conta"}
              </Link>
              {!isLoggedIn && (
                <Link
                  to={trialUrl}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
                >
                  Cadastre-se Grátis
                </Link>
              )}
              <a
                href="#recursos"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
              >
                Funcionalidades
              </a>
              <a
                href="#investimentos"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
              >
                Investimentos & Dossiês
              </a>
              <a
                href="#simulador"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
              >
                Simulador Patrimonial
              </a>
              <a
                href="#precos"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-0.5 inline-block"
              >
                Planos & Preços
              </a>
            </div>

            {/* Coluna 3: Institucional, Legal & DPO */}
            <div className="flex flex-col gap-3 md:col-span-4">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Transparência & Conformidade Legal
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Não vendemos seus dados para instituições financeiras. Sem anúncios invasivos.
              </p>

              {/* Canais Oficiais de Atendimento */}
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
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
                <div className="flex items-center gap-1.5">
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

              {/* Links Legais Oficiais Diretos */}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Documentos Oficiais
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Link
                    to="/termos"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    Termos de Serviço
                  </Link>
                  <Link
                    to="/privacidade"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    Privacidade (LGPD)
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                  <span>Visualização rápida:</span>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal("terms")}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Termos de Serviço
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal("privacy")}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Privacidade (LGPD)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar com Copyright e Declaração de Conformidade */}
          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              © {currentYear} {INSTITUTIONAL_CONFIG.companyName}. Todos os direitos reservados.
            </div>
            <div className="flex items-center gap-1">
              <span>Conformidade com LGPD (Lei nº 13.709/2018), Marco Civil e CDC</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Diálogo Unificado de Termos e LGPD */}
      <LegalDialog
        open={legalOpen}
        onOpenChange={setLegalOpen}
        defaultTab={legalTab}
      />
    </>
  );
}
