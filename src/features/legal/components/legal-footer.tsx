import { Link } from "react-router";
import { Building2, Lock, Mail, MapPin, ShieldCheck, User } from "lucide-react";
import { BrandLogo } from "@/components/layout";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { cn } from "@/lib/utils";

export interface LegalFooterProps {
  activeTab: "terms" | "privacy";
}

export function LegalFooter({ activeTab }: LegalFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-surface pt-10 pb-[calc(2.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:py-12 mt-16 sm:mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="flex flex-col gap-3 md:col-span-5">
            <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Lock className="size-3.5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Ambiente criptografado com isolamento Row Level Security</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-4">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Canais Oficiais & DPO
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para exercer seus direitos de titular previstos na LGPD ou esclarecer dúvidas
              operacionais e contratuais:
            </p>
            <div className="flex flex-col gap-1.5 text-xs mt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-muted-foreground">Encarregado (DPO):</span>
                <a
                  href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`}
                  className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  {INSTITUTIONAL_CONFIG.dpoEmail}
                </a>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Mail className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-muted-foreground">Suporte ao Titular:</span>
                <a
                  href={`mailto:${INSTITUTIONAL_CONFIG.supportEmail}`}
                  className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  {INSTITUTIONAL_CONFIG.supportEmail}
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Documentos & Início
            </span>
            <div className="flex flex-col gap-1.5 text-xs">
              <Link
                to="/termos"
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center",
                  activeTab === "terms" && "font-semibold text-foreground",
                )}
              >
                Termos de Serviço
              </Link>
              <Link
                to="/privacidade"
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center",
                  activeTab === "privacy" && "font-semibold text-foreground",
                )}
              >
                Política de Privacidade (LGPD)
              </Link>
              <Link
                to="/"
                className="text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center"
              >
                Página Inicial
              </Link>
              <Link
                to="/entrar"
                className="text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0.5 inline-flex items-center"
              >
                Acessar Plataforma
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {currentYear} {INSTITUTIONAL_CONFIG.companyName}. Todos os direitos reservados.
          </div>
          <div className="text-center sm:text-right">
            <span>Conformidade com LGPD (Lei nº 13.709/2018), Marco Civil e CDC</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
