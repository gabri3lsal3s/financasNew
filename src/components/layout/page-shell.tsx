import { Suspense } from "react";
import { Outlet } from "react-router";
import { BottomNav } from "@/components/layout/bottom-nav";
import { GlobalSearch } from "@/components/layout/global-search";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Skeleton } from "@/components/ui";

/** Fallback de carregamento das rotas lazy (bundle splitting F5.5) — Skeleton, sem spinner. */
function RouteFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function PageShell() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-8">
          <GlobalSearch />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 lg:px-8">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

