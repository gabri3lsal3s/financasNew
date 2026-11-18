import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";
import { DemoTrackSelectModal } from "@/components/modules/demo-track-select-modal";
import { HelpModal } from "@/components/modules/help-modal";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserSubscription } from "@/state";
import { AXIR_APP_NAME, AXIR_APP_VERSION } from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { ProfileIdentityHeader } from "./profile-identity-header";
import { ProfileQuickLinksGrid } from "./profile-quick-links-grid";

/** Retorna as iniciais do nome/email para o avatar. */
function getInitials(name: string | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (first && last && parts.length >= 2) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    if (first) {
      return first.charAt(0).toUpperCase();
    }
  }
  return (email?.charAt(0) ?? "U").toUpperCase();
}

export interface LogoProfileButtonProps {
  /** Se deve exibir o wordmark (nome da marca) ao lado do símbolo (padrão: false). */
  showWordmark?: boolean;
  /** Tamanho/classe CSS para o símbolo da marca (padrão: size-7). */
  markClassName?: string;
  /** Classes CSS adicionais para o botão trigger. */
  className?: string;
}

/**
 * Botão da logo (mobile no header e desktop na sidebar) que abre o modal de perfil.
 * Combina identidade visual da marca com acesso rápido a configurações, perfil, plano e logout.
 */
export function LogoProfileButton({
  showWordmark = false,
  markClassName = "size-7",
  className,
}: LogoProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [demoSelectOpen, setDemoSelectOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const subscription = useUserSubscription();

  const name: string | undefined = user?.user_metadata?.name as string | undefined;
  const email = user?.email;
  const initials = getInitials(name, email);
  const displayName = name ?? email?.split("@")[0] ?? "Usuário";

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
  };

  const navigateFromMenu = (path: string) => {
    triggerSensory("selection");
    setOpen(false);
    navigate(path);
  };

  const navigateFromButton = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir perfil do usuário"
        title="Perfil"
        onClick={() => {
          triggerSensory("selection");
          setOpen(true);
        }}
        className={cn(
          "flex items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "hover:opacity-85",
          className,
        )}
      >
        <BrandLogo showWordmark={showWordmark} markClassName={markClassName} />
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Minha Conta"
        size="sm"
        footer={
          <div className="flex flex-col gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              sensoryIntent="destructive"
              className="w-full justify-start gap-2.5 text-critical-strong hover:text-critical-strong hover:bg-critical/10 text-xs"
              onClick={handleLogout}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sair da Conta</span>
            </Button>
            <p className="text-[10px] text-muted-foreground/70 text-center select-none">
              {AXIR_APP_NAME} - v{AXIR_APP_VERSION}
            </p>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <ProfileIdentityHeader
            initials={initials}
            displayName={displayName}
            email={email}
            subscription={subscription}
            onUpgrade={() => navigateFromButton("/assinatura")}
          />

          <ProfileQuickLinksGrid
            isPro={subscription.isPro}
            onNavigateTab={navigateFromMenu}
            onOpenDemoSelect={() => {
              triggerSensory("selection");
              setOpen(false);
              setDemoSelectOpen(true);
            }}
            onOpenHelp={() => {
              triggerSensory("selection");
              setOpen(false);
              setHelpModalOpen(true);
            }}
          />
        </div>
      </Modal>

      <HelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        onOpenDemoSelect={() => setDemoSelectOpen(true)}
      />

      <DemoTrackSelectModal open={demoSelectOpen} onOpenChange={setDemoSelectOpen} />
    </>
  );
}
