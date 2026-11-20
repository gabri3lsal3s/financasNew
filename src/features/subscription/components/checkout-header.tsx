import type { ReactNode } from "react";
import { BrandLogo, ThemeToggle } from "@/components/layout";

export interface CheckoutHeaderProps {
  rightAction?: ReactNode;
}

export function CheckoutHeader({ rightAction }: CheckoutHeaderProps) {
  return (
    <header className="sticky top-0 z-sticky w-full border-b border-border/80 bg-background/85 backdrop-blur-md shadow-xs pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
        <BrandLogo
          isPro
          showWordmark
          wordmarkClassName="text-base sm:text-lg"
          markClassName="size-8"
        />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {rightAction}
        </div>
      </div>
    </header>
  );
}
