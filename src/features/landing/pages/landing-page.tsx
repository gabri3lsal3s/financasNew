import { LandingHeader } from "@/features/landing/components/landing-header";
import { HeroEditorial } from "@/features/landing/components/hero-editorial";
import { ProductNarratives } from "@/features/landing/components/product-narratives";
import { InvestmentsShowcase } from "@/features/landing/components/investments-showcase";
import { MinimalWealthSimulator } from "@/features/landing/components/minimal-wealth-simulator";
import { PricingSection } from "@/features/landing/components/pricing-section";
import { FaqSection } from "@/features/landing/components/faq-section";
import { CtaBanner } from "@/features/landing/components/cta-banner";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { BackToTop } from "@/features/landing/components/back-to-top";
import { MobileCtaDock } from "@/features/landing/components/mobile-cta-dock";
import { ScrollRevealProvider } from "@/features/landing/components/scroll-reveal-context";
import { useScrollSpy } from "@/features/landing/hooks";

export function LandingPage() {
  const { showBackToTop, resetKey, activeSection } = useScrollSpy();
  const isDockVisible = showBackToTop && activeSection !== "precos";

  return (
    <ScrollRevealProvider resetKey={resetKey}>
      <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
        {/* Skip to main content (a11y para teclado e leitores de tela) */}
        <a
          href="#conteudo-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Pular para o conteúdo principal
        </a>

        {/* Header Sticky com Barra de Progresso e Scroll-Spy */}
        <LandingHeader />

        {/* Main Content Editorial */}
        <main id="conteudo-principal" className="flex-1">
          <HeroEditorial />
          <ProductNarratives />
          <InvestmentsShowcase />
          <MinimalWealthSimulator />
          <PricingSection />
          <FaqSection />
          <CtaBanner />
        </main>

        {/* Footer com Diálogo Legal */}
        <LandingFooter />

        {/* Dock Flutuante de Conversão Mobile */}
        <MobileCtaDock visible={isDockVisible} />

        {/* Botão Ergonômico de Retorno ao Topo */}
        <BackToTop visible={showBackToTop} hasBottomDock={isDockVisible} />
      </div>
    </ScrollRevealProvider>
  );
}
