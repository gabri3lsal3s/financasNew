import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Casca das telas de auth — Card centralizado com a marca oficial (F10), DRY entre login/cadastro/recuperação. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="flex-col items-center gap-3 text-center">
          <BrandLogo />
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
