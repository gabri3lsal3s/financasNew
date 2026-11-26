import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
    }, { rootMargin: "600px" });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={container} id="simulador" className="scroll-mt-20 min-h-[900px] lg:min-h-[750px]">
      <Suspense fallback={<SkeletonChart className="h-[900px] lg:h-[750px]" />}>
        {visible ? <MinimalWealthSimulator /> : <SkeletonChart className="h-[900px] lg:h-[750px]" />}
      </Suspense>
    </div>
  );
}
