import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  FileText,
  ShieldCheck,
  Lock,
  Mail,
  MapPin,
  Building2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { cn } from "@/lib/utils";

export interface LegalPageShellProps {
  /** Identificador da aba/documento legal ativo ('terms' | 'privacy'). */
  activeTab: "terms" | "privacy";
  /** Título principal do documento legal. */
  title: string;
  /** Subtítulo ou descrição contextual do documento. */
  description?: string;
  /** Data da última revisão/atualização (ex: "23 de Outubro de 2026"). */
  lastUpdated?: string;
  /** Versão documental opcional (ex: "v2.0" ou "2026.1"). */
  version?: string;
  /** Classes adicionais para customização do contêiner do documento. */
  className?: string;
  /** Conteúdo legal completo (seções, cláusulas, avisos). */
  children: ReactNode;
}

/**
 * Shell institucional acessível para exibição pública de Termos de Serviço e Política de Privacidade.
 *
 * Provê:
 * - Skip-link acessível no topo com navegação por teclado direta para o conteúdo;
 * - Cabeçalho institucional com marca oficial, seletor de abas Termos/Privacidade e ThemeToggle;
 * - Estrutura semântica rigorosa (header, nav, main, footer) auditada para leitores de tela e WCAG AA;
 * - Rodapé institucional com identidade jurídica oficial (Decreto 7.962/2013, LGPD Art. 41 e CDC).
 */
export function LegalPageShell({
  activeTab,
  title,
  description,
  lastUpdated,
  version,
  className,
  children,
}: LegalPageShellProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Skip-link acessível para navegação rápida por teclado (WCAG 2.4.1) */}
      <a
        href="#conteudo-legal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-toast bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-xs sm:text-sm shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all outline-none"
      >
        Pular para o conteúdo principal
      </a>

      {/* Cabeçalho Institucional Fixo */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md shadow-xs pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Marca / Identidade Oficial */}
          <Link
            to="/landing"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Áxis Finance - Ir para a página inicial"
          >
            <BrandLogo
              markClassName="size-8"
              showWordmark
              wordmarkClassName="text-base sm:text-lg"
            />
          </Link>

          {/* Navegação entre Documentos Legais (Desktop) */}
          <nav
            aria-label="Documentos Legais"
            className="hidden sm:flex items-center gap-1 p-1 bg-surface-hover/80 rounded-xl border border-border/60"
          >
            <Link
              to="/termos"
              aria-current={activeTab === "terms" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "terms"
                  ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Termos de Uso</span>
            </Link>
            <Link
              to="/privacidade"
              aria-current={activeTab === "privacy" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "privacy"
                  ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Privacidade (LGPD)</span>
            </Link>
          </nav>

          {/* Ações Rápidas: Alternância de Tema e Acesso ao App */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to="/entrar" className="hidden sm:inline-flex">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs font-medium border-border/80 bg-surface hover:bg-surface-hover shadow-xs cursor-pointer"
              >
                Acessar Plataforma
              </Button>
            </Link>
          </div>
        </div>

        {/* Navegação entre Documentos Legais (Mobile) */}
        <div className="sm:hidden border-t border-border/60 bg-surface/50 px-4 py-2">
          <nav
            aria-label="Documentos Legais (Mobile)"
            className="flex items-center justify-center gap-1 p-1 bg-surface-hover/80 rounded-xl border border-border/60"
          >
            <Link
              to="/termos"
              aria-current={activeTab === "terms" ? "page" : undefined}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "terms"
                  ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Termos de Uso</span>
            </Link>
            <Link
              to="/privacidade"
              aria-current={activeTab === "privacy" ? "page" : undefined}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "privacy"
                  ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Privacidade (LGPD)</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal do Documento Legal */}
      <main
        id="conteudo-legal"
        tabIndex={-1}
        className={cn(
          "focus-visible:outline-none flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12",
          className,
        )}
      >
        {/* Cabeçalho do Documento */}
        <div className="flex flex-col gap-3 pb-6 sm:pb-8 border-b border-border/80">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" size="sm">
              {INSTITUTIONAL_CONFIG.appName}
            </Badge>
            <Badge variant="muted" size="sm">
              Jurisdição: República Federativa do Brasil
            </Badge>
            {version && (
              <Badge variant="muted" size="sm">
                Versão {version}
              </Badge>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>

          {description && (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-muted-foreground">
            {lastUpdated && (
              <div>
                <span className="font-semibold text-foreground">Última atualização:</span>{" "}
                {lastUpdated}
              </div>
            )}
            <div>
              <span className="font-semibold text-foreground">Foro Legal:</span>{" "}
              {INSTITUTIONAL_CONFIG.legalJurisdiction}
            </div>
          </div>
        </div>

        {/* Conteúdo do Documento */}
        <div className="mt-8 space-y-8 text-foreground leading-relaxed">
          {children}
        </div>
      </main>

      {/* Rodapé Institucional Completo (Decreto 7.962/2013, LGPD Art. 41 e CDC) */}
      <footer className="border-t border-border/80 bg-surface/80 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:py-12 mt-16 sm:mt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Bloco 1: Fornecedor e Identidade Jurídica */}
            <div className="flex flex-col gap-3 md:col-span-5">
              <BrandLogo
                markClassName="size-8"
                showWordmark
                wordmarkClassName="text-base sm:text-lg"
              />
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Lock className="size-3.5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Ambiente criptografado com isolamento Row Level Security</span>
              </div>
            </div>

            {/* Bloco 2: Atendimento ao Consumidor & Canal do DPO (LGPD Art. 41) */}
            <div className="flex flex-col gap-2 md:col-span-4">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Canais Oficiais & DPO
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Para exercer seus direitos de titular previstos na LGPD ou esclarecer dúvidas operacionais e contratuais:
              </p>
              <div className="flex flex-col gap-1.5 text-xs mt-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Encarregado (DPO):</span>
                  <a
                    href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`}
                    className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    {INSTITUTIONAL_CONFIG.dpoEmail}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
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

            {/* Bloco 3: Navegação Rápida Institucional */}
            <div className="flex flex-col gap-2 md:col-span-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Documentos & Início
              </span>
              <div className="flex flex-col gap-1.5 text-xs">
                <Link
                  to="/termos"
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors py-0.5",
                    activeTab === "terms" && "font-semibold text-foreground",
                  )}
                >
                  Termos de Serviço
                </Link>
                <Link
                  to="/privacidade"
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors py-0.5",
                    activeTab === "privacy" && "font-semibold text-foreground",
                  )}
                >
                  Política de Privacidade (LGPD)
                </Link>
                <Link
                  to="/landing"
                  className="text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  Página Inicial
                </Link>
                <Link
                  to="/entrar"
                  className="text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  Acessar Plataforma
                </Link>
              </div>
            </div>
          </div>

          {/* Linha Inferior / Direitos e Conformidade */}
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
    </div>
  );
}
