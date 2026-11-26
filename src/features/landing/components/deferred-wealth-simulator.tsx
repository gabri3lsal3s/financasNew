import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PieChart } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { SkeletonChart } from "@/components/ui/skeleton-base";

const MinimalWealthSimulator = lazy(() => import("./minimal-wealth-simulator").then((module) => ({ default: module.MinimalWealthSimulator })));

/** A âncora existe desde o primeiro paint e carrega o simulador ao se aproximar da viewport. */
export function DeferredWealthSimulator() {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visible || !container.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "900px" });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);

  const placeholder = <SkeletonChart className="self-stretch" />;

  return (
    <section
      id="simulador"
      className="py-14 md:py-24 bg-surface-raised/30 border-t border-border/60 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <PieChart className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Rebalanceamento sem vender ativos</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Simulador de Carteira & Aportes Inteligentes
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Depois de organizar seu caixa e suas metas, simule ao vivo onde colocar seu próximo
            aporte para equilibrar a carteira sem precisar vender nenhum ativo.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100} className="mt-10 sm:mt-14 max-w-6xl mx-auto">
          <div
            ref={container}
            className="grid items-start min-h-[1710px] max-[374px]:min-h-[1870px] sm:min-h-[1500px] lg:min-h-[960px] xl:min-h-[910px]"
          >
            <Suspense fallback={placeholder}>
              {visible ? <MinimalWealthSimulator /> : placeholder}
            </Suspense>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
