import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BrandLogo } from "@/components/layout";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Painel lateral esquerdo exibido apenas no desktop (≥ lg). Quando fornecido, ativa o layout split de 2 colunas. */
  sideHero?: ReactNode;
  className?: string;
}

/**
 * Casca das telas de auth — Layout split executivo no desktop (≥ lg) e card focado no mobile.
 * Elimina duplicação da marca no desktop (exibe a marca apenas no painel lateral esquerdo),
 * preserva a ordem de tabulação e foco acessível nativo no formulário e alinha o cabeçalho
 * harmonicamente à esquerda no desktop.
 */
export function AuthShell({ title, subtitle, children, sideHero, className }: AuthShellProps) {
  if (sideHero) {
    return (
      <div
        className={cn(
          "flex min-h-dvh items-center justify-center p-4 sm:p-6",
          "pt-[calc(1.5rem+env(safe-area-inset-top,0px))]",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          "overflow-y-auto bg-muted/20",
          className,
        )}
      >
        <div className="w-full max-w-lg lg:max-w-4xl">
          <Card className="w-full overflow-hidden border border-border/80 bg-surface shadow-xl rounded-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
              {/* Painel do formulário — primeiro na ordem DOM para garantir tabulação e foco acessível nativo */}
              <div className="lg:col-span-7 lg:order-2 flex flex-col justify-center p-6 sm:p-10">
                <CardHeader className="flex-col items-center lg:items-start gap-2 text-center lg:text-left p-0 pb-6">
                  {/* No mobile o logo é exibido; no desktop ele brilha no painel lateral */}
                  <div className="lg:hidden pb-2">
                    <BrandLogo markClassName="size-10" showWordmark showSubtitle />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                      {title}
                    </CardTitle>
                    {subtitle ? (
                      <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="p-0">{children}</CardContent>
              </div>

              {/* Painel lateral institucional — posicionado à esquerda no desktop (order-1) */}
              <div className="hidden lg:flex lg:col-span-5 lg:order-1 flex-col justify-between p-8 sm:p-10 bg-gradient-to-b from-[#0C1923] via-[#142531] to-[#0F1E29] text-white relative overflow-hidden border-r border-border/20">
                {/* Efeitos de iluminação ambiente suaves */}
                <div
                  className="absolute -top-20 -left-20 size-64 rounded-full bg-primary/20 blur-3xl pointer-events-none"
                  aria-hidden="true"
                />
                <div
                  className="absolute -bottom-20 -right-20 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none"
                  aria-hidden="true"
                />

                <div className="relative z-10 flex flex-col justify-between h-full gap-8">
                  {sideHero}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center p-4",
        "pt-[calc(1rem+env(safe-area-inset-top,0px))]",
        "pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        "overflow-y-auto bg-muted/20",
        className,
      )}
    >
      <Card className="w-full max-w-sm border-border/80 bg-surface shadow-lg rounded-2xl">
        <CardHeader className="flex-col items-center gap-3 text-center">
          <BrandLogo markClassName="size-12" showWordmark showSubtitle />
          <div className="flex flex-col gap-1">
            <CardTitle className="font-display text-xl">{title}</CardTitle>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
