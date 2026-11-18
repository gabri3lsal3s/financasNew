import { LogoProfileButton } from "@/components/layout/logo-profile-button";

export interface MobileTopbarProps {
  showLogo: boolean;
}

export function MobileTopbar({ showLogo }: MobileTopbarProps) {
  if (!showLogo) return null;

  return (
    <div className="flex items-center gap-1.5 lg:hidden shrink-0">
      <LogoProfileButton />
      <div className="h-5 w-px bg-border shrink-0" aria-hidden="true" />
    </div>
  );
}
