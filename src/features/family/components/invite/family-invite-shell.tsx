import type { ReactNode } from "react";
import { SharedLinkHeaderNav } from "@/features/public-share/components";

export interface FamilyInviteShellProps {
  token?: string;
  showFooter?: boolean;
  children: ReactNode;
}

export function FamilyInviteShell({
  token = "",
  showFooter = false,
  children,
}: FamilyInviteShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SharedLinkHeaderNav
        badgeLabel="Convite Familiar"
        targetPath={`convite-familiar/${token}`}
        maxWidth="2xl"
      />

      <main className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {children}
      </main>

      {showFooter ? (
        <footer className="text-center text-xs text-muted-foreground pb-6 px-4">
          <span>Axir · Gestão Financeira Inteligente e Colaborativa</span>
        </footer>
      ) : null}
    </div>
  );
}
