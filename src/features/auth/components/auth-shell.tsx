import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BrandLogo } from "@/components/layout";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Casca das telas de auth — Card centralizado com a marca oficial (F10), DRY entre login/cadastro/recuperação. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <Card className="w-full max-w-sm border-border/80 bg-surface shadow-xs">
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
