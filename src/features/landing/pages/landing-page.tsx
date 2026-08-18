import { LandingHeader } from "@/features/landing/components/landing-header";
import { HeroSection } from "@/features/landing/components/hero-section";
import { FeaturesGrid } from "@/features/landing/components/features-grid";
import { InteractiveSimulator } from "@/features/landing/components/interactive-simulator";
import { PricingSection } from "@/features/landing/components/pricing-section";
import { FaqSection } from "@/features/landing/components/faq-section";
import { CtaBanner } from "@/features/landing/components/cta-banner";
import { LandingFooter } from "@/features/landing/components/landing-footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Header Sticky */}
      <LandingHeader />

      {/* Main Content */}
      <main className="flex-1">
        <HeroSection />
        <FeaturesGrid />
        <InteractiveSimulator />
        <PricingSection />
        <FaqSection />
        <CtaBanner />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
