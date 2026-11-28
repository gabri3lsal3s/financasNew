import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { AccountSwitcherPanel } from "@/components/modules/account-switcher";
import { DemoTrackSelectModal } from "@/components/modules/demo-track-select-modal";
import { HelpModal } from "@/components/modules/help-modal";
import { useAuth } from "@/hooks/use-auth";
import { useModalTransition } from "@/hooks/use-modal-transition";
import { useSignOut } from "@/hooks/use-sign-out";
import { useAccountSwitcher } from "@/state/use-account-switcher";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useUserSubscription } from "@/state/queries/use-user-subscription";
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
 * Combina identidade visual da marca com acesso rápido a configurações, perfil, plano,
 * alternador de contas e logout.
 */
export function LogoProfileButton({
  showWordmark = false,
  markClassName = "size-7",
  className,
}: LogoProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isInitialListPending, setIsInitialListPending] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [demoSelectOpen, setDemoSelectOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const { scheduleAfterClose, cancelTransition } = useModalTransition();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const subscription = useUserSubscription();
  const { isAdmin } = useUserAccess(user?.id);
  const accountSwitcher = useAccountSwitcher();
  const { listAccounts } = accountSwitcher;

  useEffect(() => {
    if (open) cancelTransition();
  }, [open, cancelTransition]);

  useEffect(() => {
    if (!switcherOpen) return;
    const controller = new AbortController();
    void listAccounts({ signal: controller.signal }).finally(() => {
      if (!controller.signal.aborted) {
        setIsInitialListPending(false);
      }
    });
    return () => controller.abort();
  }, [switcherOpen, listAccounts]);

  const name: string | undefined = user?.user_metadata?.name as string | undefined;
  const email = user?.email;
  const initials = getInitials(name, email);
  const displayName = name ?? email?.split("@")[0] ?? "Usuário";

  const handleLogout = async () => {
    cancelTransition();
    setOpen(false);
    await signOut();
  };

  const navigateFromMenu = (path: string) => {
    cancelTransition();
    triggerSensory("selection");
    setOpen(false);
    navigate(path);
  };

  const navigateFromButton = (path: string) => {
    cancelTransition();
    setOpen(false);
    navigate(path);
  };

  const navigateFromSwitcher = (path: string) => {
    cancelTransition();
    setSwitcherOpen(false);
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
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto justify-start gap-2 text-xs sm:text-sm"
                onClick={() => {
                  scheduleAfterClose(
                    () => setOpen(false),
                    () => {
                      setIsInitialListPending(true);
                      setSwitcherOpen(true);
                    },
                  );
                }}
              >
                <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
                <span>Alternar conta</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                sensoryIntent="destructive"
                className="w-full sm:w-auto justify-start gap-2.5 text-critical-strong hover:text-critical-strong hover:bg-critical/10 text-xs sm:text-sm"
                onClick={handleLogout}
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                <span>Sair da Conta</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 text-center sm:text-right select-none">
              {AXIR_APP_NAME} - v{AXIR_APP_VERSION}
            </p>
          </div>
        }
      >
        <div className="space-y-4 sm:space-y-5 pt-1">
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
              scheduleAfterClose(
                () => setOpen(false),
                () => setDemoSelectOpen(true),
              );
            }}
            onOpenHelp={() => {
              triggerSensory("selection");
              scheduleAfterClose(
                () => setOpen(false),
                () => setHelpModalOpen(true),
              );
            }}
          />
        </div>
      </Modal>

      <Modal
        open={switcherOpen}
        onOpenChange={(nextOpen) => {
          setIsInitialListPending(nextOpen);
          setSwitcherOpen(nextOpen);
        }}
        title="Contas e Sessões"
        description="Alterne entre contas com isolamento por aba ou encerre sessões deste dispositivo."
        size="lg"
      >
        <AccountSwitcherPanel
          context={accountSwitcher.context}
          accounts={accountSwitcher.accounts}
          loading={accountSwitcher.loading || isInitialListPending}
          busyAction={accountSwitcher.busyAction}
          error={accountSwitcher.error}
          onClearError={accountSwitcher.clearError}
          onRefresh={() => void accountSwitcher.listAccounts()}
          onSwitchAccount={async (account) => {
            const res = await accountSwitcher.switchAccount({
              accountRef: account.accountRef,
              expectedGeneration: account.generation,
            });
            if (res.ok) {
              setIsSwitchingAccount(true);
              setSwitcherOpen(false);
              try {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                } else {
                  navigate("/");
                }
              } catch {
                setIsSwitchingAccount(false);
              }
            }
          }}
          onAddAccount={() => navigateFromSwitcher("/login?mode=add")}
          onReauthAccount={() => navigateFromSwitcher("/login?mode=reauth")}
          onUnlock={() => navigateFromSwitcher("/login?mode=unlock")}
          onOpenAdminPortal={
            isAdmin
              ? () => {
                  setSwitcherOpen(false);
                  if (typeof window !== "undefined") {
                    window.location.assign("/admin");
                  }
                }
              : undefined
          }
          onLogout={async ({ remember }) => {
            const res = await accountSwitcher.logout({ remember });
            if (res.ok) {
              setSwitcherOpen(false);
              await signOut();
            }
          }}
          onLogoutDevice={async () => {
            const res = await accountSwitcher.logoutDevice();
            if (res.ok) {
              setSwitcherOpen(false);
              await signOut();
            }
          }}
          onForgetAccount={async (account) => {
            await accountSwitcher.forgetAccount({ accountRef: account.accountRef });
          }}
        />
      </Modal>

      {isSwitchingAccount ? (
        <div className="fixed inset-0 z-[100] bg-background">
          <LoadingScreen statusText="Alternando para sua conta…" />
        </div>
      ) : null}

      <HelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        onOpenDemoSelect={() => setDemoSelectOpen(true)}
      />

      <DemoTrackSelectModal open={demoSelectOpen} onOpenChange={setDemoSelectOpen} />
    </>
  );
}
