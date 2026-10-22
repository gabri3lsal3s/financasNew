import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Painel lateral esquerdo exibido apenas no desktop (≥ lg). Quando fornecido, ativa layout split de 2 colunas. */
  sideHero?: ReactNode;
  className?: string;
}

/**
  * Casca das telas de autenticação — Card centralizado com identidade oficial Áxis Finance.
  * No desktop (≥ lg) com `sideHero`, ativa um layout split harmônico e reativo ao tema ativo
  * com a logo e benefícios à esquerda e formulário espaçoso à direita.
  */
export function AuthShell({ title, subtitle, children, sideHero, className }: AuthShellProps) {
  if (sideHero) {
    return (
      <div
        className={cn(
          "flex min-h-dvh items-center justify-center p-4 sm:p-6 lg:p-8",
          "pt-[calc(1.5rem+env(safe-area-inset-top,0px))]",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          "bg-background selection:bg-primary/20",
          "overflow-y-auto",
          className,
        )}
      >
        <div className="w-full max-w-lg lg:max-w-4xl">
          <div className="w-full flex justify-end mb-2.5">
            <ThemeToggle />
          </div>
          <Card className="w-full overflow-hidden border-border/80 bg-surface shadow-md rounded-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
              {/* Painel lateral institucional — Visível apenas no Desktop (≥ lg) e reativo ao tema */}
              <div className="relative hidden lg:flex lg:col-span-5 flex-col justify-between overflow-hidden bg-gradient-to-br from-surface-hover/80 via-muted/30 to-surface p-8 lg:p-9 text-foreground border-r border-border/60">
                {/* Iluminação ambiente suave refletindo a identidade do tema e acento ativo */}
                <div
                  className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-primary/15 blur-3xl"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -bottom-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl"
                  aria-hidden="true"
                />
                <div className="relative z-1 flex flex-col justify-between h-full gap-8">
                  {sideHero}
                </div>
              </div>

              {/* Painel do formulário — Mobile e Desktop */}
              <div className="lg:col-span-7 flex flex-col justify-center px-6 sm:px-10 lg:px-12 py-8 sm:py-10 bg-surface">
                <CardHeader className="p-0 flex-col items-center gap-2 text-center mb-6">
                  {/* Logo com adaptação automática a temas claros/escuros no Mobile */}
                  <BrandLogo
                    className="lg:hidden mb-2"
                    markClassName="size-10"
                    showWordmark
                    showSubtitle
                  />
                  <div className="flex flex-col gap-1 items-center">
                    <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                      {title}
                    </CardTitle>
                    {subtitle ? (
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="p-0">{children}</CardContent>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Layout simples (Recuperação de senha, etc.)
  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center p-4 sm:p-6",
        "pt-[calc(1.5rem+env(safe-area-inset-top,0px))]",
        "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
        "bg-background selection:bg-primary/20",
        "overflow-y-auto",
        className,
      )}
    >
      <div className="w-full max-w-md">
        <div className="w-full flex justify-end mb-2.5">
          <ThemeToggle />
        </div>
        <Card className="w-full border-border/80 bg-surface shadow-md rounded-2xl p-6 sm:p-8">
          <CardHeader className="p-0 flex-col items-center gap-3 text-center mb-6">
            <BrandLogo markClassName="size-11" showWordmark showSubtitle />
            <div className="flex flex-col gap-1">
              <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                {title}
              </CardTitle>
              {subtitle ? (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
