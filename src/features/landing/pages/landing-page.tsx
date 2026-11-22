import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { LandingHeader } from "@/features/landing/components/landing-header";
import { HeroEditorial } from "@/features/landing/components/hero-editorial";
import {
  UnifiedEcosystemSection,
  type EcosystemDestination,
} from "@/features/landing/components/unified-ecosystem-section";
import {
  FinancialPainPointsSection,
  type PainKey,
} from "@/features/landing/components/financial-pain-points-section";
import {
  DeepDiveTabsSection,
  type DeepDiveTabKey,
} from "@/features/landing/components/deep-dive-tabs-section";
import { MinimalWealthSimulator } from "@/features/landing/components/minimal-wealth-simulator";
import { PlatformComparison } from "@/features/landing/components/platform-comparison";
import { ToolsShowcase } from "@/features/landing/components/tools-showcase";
import { PricingSection } from "@/features/landing/components/pricing-section";
import { FaqSection } from "@/features/landing/components/faq-section";
import { CtaBanner } from "@/features/landing/components/cta-banner";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { BackToTop } from "@/components/layout/back-to-top";
import { MobileCtaDock } from "@/features/landing/components/mobile-cta-dock";
import { ScrollRevealProvider } from "@/features/landing/components/scroll-reveal-context";
import { useScrollSpy } from "@/features/landing/hooks";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { hasNativeBrowserBackToTop } from "@/services/native";

const PLAN_ROUTES = ["/precos", "/planos", "/vendas"];

export function LandingPage() {
  const { showBackToTop, resetKey, activeSection } = useScrollSpy();
  const location = useLocation();
  const [activePain, setActivePain] = useState<PainKey>("cash");
  const [activeDeepTab, setActiveDeepTab] = useState<DeepDiveTabKey>("investments");
  const isDockVisible = showBackToTop && activeSection !== "precos";
  const isPricingRoute = PLAN_ROUTES.includes(location.pathname);
  const hideBackToTopForNativeBrowserControl = hasNativeBrowserBackToTop();

  useDocumentMeta(
    isPricingRoute
      ? {
          title: "Planos e Preços — Axir | 30 Dias Grátis sem Cartão",
          description:
            "Compare os planos do Axir: 30 dias de Acesso Pro Total sem cartão, assinatura mensal ou anual com desconto e garantia legal de 7 dias.",
          canonicalPath: "/planos",
        }
      : {
          title: "Axir — Toda Sua Vida Financeira em Um Único App",
          description:
            "Do gasto do dia a dia aos seus investimentos. Conecte caixa real, cartões, contas a pagar e receber, racha em grupo, Modo Família, preço teto e relatórios com memória de cálculo.",
          canonicalPath: "/",
        },
  );

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSelectEcosystemDestination = (destination: EcosystemDestination) => {
    if (destination.section === "dores") {
      setActivePain(destination.key);
      scrollToSection("dores");
      return;
    }

    setActiveDeepTab(destination.key);
    scrollToSection("profundidade");
  };

  const handleExploreInvestments = () => {
    setActiveDeepTab("investments");
    scrollToSection("profundidade");
  };

  useEffect(() => {
    if (
      location.pathname === "/precos" ||
      location.pathname === "/planos" ||
      location.pathname === "/vendas" ||
      location.hash === "#precos"
    ) {
      const el = document.getElementById("precos");
      if (el) {
        // Timeout para aguardar render inicial
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, [location.pathname, location.hash]);

  return (
    <ScrollRevealProvider resetKey={resetKey}>
      <div className="min-h-dvh bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
        {/* Skip to main content (a11y para teclado e leitores de tela) */}
        <a
          href="#conteudo-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-toast rounded-lg bg-primary-strong px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Pular para o conteúdo principal
        </a>

        {/* Header Sticky com Barra de Progresso e Scroll-Spy */}
        <LandingHeader />

        {/* Main Content Editorial */}
        <main id="conteudo-principal" className="flex-1">
          <HeroEditorial />
          <UnifiedEcosystemSection onSelectDestination={handleSelectEcosystemDestination} />
          <FinancialPainPointsSection
            activePain={activePain}
            onPainChange={setActivePain}
            onExploreInvestments={handleExploreInvestments}
          />
          <DeepDiveTabsSection activeTab={activeDeepTab} onTabChange={setActiveDeepTab} />
          <MinimalWealthSimulator />
          <ToolsShowcase />
          <PricingSection />
          <PlatformComparison />
          <FaqSection />
          <CtaBanner />
        </main>

        {/* Footer com Diálogo Legal */}
        <LandingFooter />

        {/* Dock Flutuante de Conversão Mobile */}
        <MobileCtaDock visible={isDockVisible} />

        {/* Botão Ergonômico de Retorno ao Topo — omitido no Samsung Internet fora do PWA para evitar duplicidade com o botão nativo do navegador (ver docs/platforms/PWA_GUIDELINES.md §9) */}
        {!hideBackToTopForNativeBrowserControl ? (
          <BackToTop visible={showBackToTop} hasBottomDock={isDockVisible} />
        ) : null}
      </div>
    </ScrollRevealProvider>
  );
}
